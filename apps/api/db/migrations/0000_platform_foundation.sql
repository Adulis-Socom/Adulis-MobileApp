-- 0000_platform_foundation -- replacement lineage rebuild-20261125, first migration (ARC-BE-03 / ARC-BE-04).
-- Transcribes ADU-EVT-01 v3.2 S9 (envelope), S10 (transactional outbox), S12-S13 (relay lease, delivery
-- registry), S18 (processed-event marker) and S22 (application dead letter). Runs as adulis_migrator.
-- NO domain table: every domain arrives with its own work order (RBL-04). No Reservation, Order, payment,
-- payout or placeholder table, ever, in this lineage (RB25-D03). Account/operator/market columns are typed
-- uuid now and gain their foreign keys when those owner tables exist (SC-BE-02, MKT).
CREATE SCHEMA platform;
--> statement-breakpoint
REVOKE ALL ON SCHEMA platform FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA platform TO adulis_api, adulis_worker;
--> statement-breakpoint
CREATE TABLE platform.event_outbox (
  event_id uuid PRIMARY KEY,
  event_type text NOT NULL CHECK (length(event_type) <= 100 AND event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  event_version integer NOT NULL CHECK (event_version >= 1),
  scope text NOT NULL CHECK (scope IN ('GLOBAL', 'MARKET')),
  market_id uuid,
  originating_market_id uuid,
  aggregate_type text NOT NULL CHECK (length(aggregate_type) BETWEEN 1 AND 100),
  aggregate_id text NOT NULL CHECK (length(aggregate_id) BETWEEN 1 AND 200),
  aggregate_revision bigint NOT NULL CHECK (aggregate_revision >= 0),
  logical_effect_id text NOT NULL CHECK (length(logical_effect_id) BETWEEN 1 AND 200),
  actor_type text NOT NULL CHECK (actor_type IN ('ANONYMOUS_PUBLIC', 'ORDINARY_ACCOUNT', 'OPERATOR_ACCOUNT', 'SYSTEM')),
  ordinary_account_id uuid,
  operator_account_id uuid,
  anonymous_ref text CHECK (length(anonymous_ref) <= 128),
  trusted_service_ref text CHECK (length(trusted_service_ref) <= 128),
  seller_context_id uuid,
  request_id text CHECK (length(request_id) <= 128),
  correlation_id text NOT NULL CHECK (length(correlation_id) BETWEEN 8 AND 128),
  causation_id text CHECK (length(causation_id) <= 128),
  policy_version text CHECK (length(policy_version) <= 64),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  relay_owner text,
  lease_expires_at timestamptz,
  -- S9: MARKET facts carry a resource-derived market; GLOBAL facts never fabricate one.
  CONSTRAINT event_outbox_scope CHECK ((scope = 'MARKET') = (market_id IS NOT NULL) AND (scope = 'GLOBAL' OR originating_market_id IS NULL)),
  -- S9: the discriminated principal. Anonymous input is never SYSTEM; identities never overload each other.
  CONSTRAINT event_outbox_actor CHECK (
       (actor_type = 'ANONYMOUS_PUBLIC' AND anonymous_ref IS NOT NULL AND ordinary_account_id IS NULL AND operator_account_id IS NULL AND trusted_service_ref IS NULL AND seller_context_id IS NULL)
    OR (actor_type = 'ORDINARY_ACCOUNT' AND ordinary_account_id IS NOT NULL AND operator_account_id IS NULL AND anonymous_ref IS NULL AND trusted_service_ref IS NULL)
    OR (actor_type = 'OPERATOR_ACCOUNT' AND operator_account_id IS NOT NULL AND ordinary_account_id IS NULL AND anonymous_ref IS NULL AND trusted_service_ref IS NULL)
    OR (actor_type = 'SYSTEM' AND trusted_service_ref IS NOT NULL AND ordinary_account_id IS NULL AND operator_account_id IS NULL AND anonymous_ref IS NULL AND seller_context_id IS NULL)),
  -- S12: a dispatched row holds no lease.
  CONSTRAINT event_outbox_dispatch CHECK (dispatched_at IS NULL OR (relay_owner IS NULL AND lease_expires_at IS NULL))
);
--> statement-breakpoint
CREATE INDEX event_outbox_undispatched ON platform.event_outbox (recorded_at) WHERE dispatched_at IS NULL;
--> statement-breakpoint
-- S10: an outbox row is an immutable fact. Only the relay's dispatch columns change, and dispatch is final.
CREATE FUNCTION platform.event_outbox_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['dispatched_at', 'relay_owner', 'lease_expires_at'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['dispatched_at', 'relay_owner', 'lease_expires_at']) THEN
    RAISE EXCEPTION 'platform.event_outbox: an event is an immutable fact';
  END IF;
  IF OLD.dispatched_at IS NOT NULL AND NEW.dispatched_at IS DISTINCT FROM OLD.dispatched_at THEN
    RAISE EXCEPTION 'platform.event_outbox: dispatch is final';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER event_outbox_immutable BEFORE UPDATE ON platform.event_outbox
  FOR EACH ROW EXECUTE FUNCTION platform.event_outbox_immutable();
--> statement-breakpoint
-- A fact is recorded now and undispatched, whoever inserts it: no row can be inserted pre-dispatched, pre-leased or
-- back-dated. (A trigger, not column grants: the ORM names every column, with DEFAULT, in its INSERT.)
CREATE FUNCTION platform.event_outbox_on_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.recorded_at := now();
  NEW.dispatched_at := NULL;
  NEW.relay_owner := NULL;
  NEW.lease_expires_at := NULL;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER event_outbox_on_insert BEFORE INSERT ON platform.event_outbox
  FOR EACH ROW EXECUTE FUNCTION platform.event_outbox_on_insert();
--> statement-breakpoint
CREATE TABLE platform.event_delivery (
  event_id uuid NOT NULL REFERENCES platform.event_outbox (event_id),
  consumer text NOT NULL CHECK (consumer ~ '^[a-z][a-z0-9_.-]{0,99}$'),
  state text NOT NULL DEFAULT 'PENDING'
    CHECK (state IN ('PENDING', 'ENQUEUE_UNKNOWN', 'QUEUED', 'PROCESSING', 'SUCCEEDED', 'SKIPPED', 'DEAD_LETTERED')),
  -- Deterministic BullMQ jobId (S12 step 4): consumer + event, so a re-enqueue is the same physical job.
  job_id text NOT NULL UNIQUE CHECK (length(job_id) <= 200),
  enqueue_attempts integer NOT NULL DEFAULT 0 CHECK (enqueue_attempts >= 0),
  last_error_code text CHECK (length(last_error_code) <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, consumer)
);
--> statement-breakpoint
CREATE INDEX event_delivery_open ON platform.event_delivery (event_id) WHERE state IN ('PENDING', 'ENQUEUE_UNKNOWN');
--> statement-breakpoint
-- S18: the processed-event marker, committed in the same transaction as the consumer's effect. BullMQ job
-- removal never releases it, so a duplicate delivery can never apply a second effect.
CREATE TABLE platform.processed_event (
  consumer text NOT NULL,
  event_id uuid NOT NULL REFERENCES platform.event_outbox (event_id),
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, event_id)
);
--> statement-breakpoint
-- S22: application-owned dead letter. A sanitized summary only: never a payload, message body, token or OTP.
CREATE TABLE platform.async_dead_letter (
  dead_letter_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_job_id text NOT NULL UNIQUE CHECK (length(logical_job_id) <= 200),
  source_event_id uuid REFERENCES platform.event_outbox (event_id),
  consumer text NOT NULL,
  failure_class text NOT NULL CHECK (failure_class IN ('TRANSIENT', 'RATE_LIMIT', 'DEPENDENCY_UNAVAILABLE', 'PERMANENT_VALIDATION',
    'STATE_CONFLICT', 'POISON_PAYLOAD', 'SECURITY_FAILURE', 'UNSUPPORTED_VERSION')),
  failure_fingerprint text NOT NULL CHECK (length(failure_fingerprint) <= 200),
  sanitized_summary text NOT NULL CHECK (length(sanitized_summary) <= 500),
  attempt_count integer NOT NULL CHECK (attempt_count >= 1),
  effect_may_have_happened boolean NOT NULL,
  replay_count integer NOT NULL DEFAULT 0 CHECK (replay_count >= 0),
  resolution_status text NOT NULL DEFAULT 'UNRESOLVED' CHECK (resolution_status IN ('UNRESOLVED', 'RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- Least privilege. The API appends facts; it never reads, changes or deletes them. The worker reads facts,
-- moves only the relay columns, and owns delivery, processed markers and dead letters. Nobody deletes.
GRANT INSERT ON platform.event_outbox TO adulis_api;
--> statement-breakpoint
GRANT SELECT, UPDATE (dispatched_at, relay_owner, lease_expires_at) ON platform.event_outbox TO adulis_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE (state, enqueue_attempts, last_error_code, updated_at) ON platform.event_delivery TO adulis_worker;
--> statement-breakpoint
GRANT SELECT, INSERT ON platform.processed_event TO adulis_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE (failure_class, failure_fingerprint, sanitized_summary, attempt_count, effect_may_have_happened, updated_at)
  ON platform.async_dead_letter TO adulis_worker;
