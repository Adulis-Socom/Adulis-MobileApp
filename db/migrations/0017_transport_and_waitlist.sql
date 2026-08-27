-- ===========================================================================
-- MIGRATION 15 - TRANSPORT TABLES AND THE WAITLIST STORE
--
-- Source: ADU-DB-01 v1.10 section 28 item 15 (sections 12.8, 12.9), section
-- 25, and section 27's churn-table tuning. (File 0017; see 0010's header.)
--
-- The transport pair is NOT append-only, deliberately (12.8, 12.9): an
-- expiring cache of what was already answered and a sliding counter are not
-- records of what happened - analytics.event is the record. Marking them
-- append-only would also move the figure Appendix C check 5 compares
-- against the trigger and REVOKE totals, and that figure has been wrong
-- once already (Appendix B).
--
-- waitlist.application is D-06's resolution: named by the manifest, carried
-- by no migration item until here. It is C7's SEPARATE store - deployed
-- with the website in production - so nothing in it references core, not
-- even the e164 domain: extraction must cost a connection string, not a
-- schema surgery.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. core.idempotency_record (section 12.8, verbatim shape)
--
-- A retry on a lost response must not create a second order; on the binding
-- low-end-Android constraint the retry is the NORMAL case. actor_kind
-- admits DEVICE because cart and device-registration are reachable before
-- an account exists (C6) - the pre-identity endpoints are the ones hit on
-- the worst connections.
-- ---------------------------------------------------------------------------
CREATE TABLE core.idempotency_record (
  id              uuid PRIMARY KEY,
  key             uuid NOT NULL,
  actor_kind      core.idempotency_actor_kind NOT NULL,
  actor_id        uuid NOT NULL,
  endpoint        text NOT NULL,
  request_hash    bytea NOT NULL,
  response_status int  NOT NULL,
  response_body   jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  UNIQUE (key, actor_kind, actor_id, endpoint)
);

CREATE INDEX idx_idempotency_expiry ON core.idempotency_record (expires_at);

-- ---------------------------------------------------------------------------
-- 2. core.rate_limit_bucket (section 12.9, verbatim shape)
--
-- Postgres is the sole datastore, so the bucket is a table. A phone-keyed
-- limit stores a HASH in subject_id, never the number: the OTP limit works
-- before an account exists, which is exactly when a raw number would sit in
-- a counter table with no retention story. Anonymous reads are limited at
-- the edge and never reach this table.
-- ---------------------------------------------------------------------------
CREATE TABLE core.rate_limit_bucket (
  subject_kind core.rate_limit_subject_kind NOT NULL,
  subject_id   text NOT NULL,
  bucket_key   text NOT NULL,
  window_start timestamptz NOT NULL,
  count        int NOT NULL DEFAULT 0,
  PRIMARY KEY (subject_kind, subject_id, bucket_key, window_start)
);

CREATE INDEX idx_rate_limit_stale ON core.rate_limit_bucket (window_start);

-- ---------------------------------------------------------------------------
-- 3. waitlist.application (section 25)
-- ---------------------------------------------------------------------------
CREATE TABLE waitlist.application (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code                text NOT NULL UNIQUE,
  full_name                     text NOT NULL,
  -- text, not core.e164: C7's store must extract without schema surgery.
  phone_e164                    text NOT NULL,
  primary_platform              waitlist.platform NOT NULL,
  primary_handle                text NOT NULL,
  secondary_platform            waitlist.platform NULL,
  secondary_handle              text NULL,
  -- OPTIONAL, and never validated against a threshold (ADU-WEB-01 S7.1):
  -- no CHECK, no NOT NULL, and no rejection value exists to write. Every
  -- applicant is accepted onto the list. Two handles are captured because
  -- assessment is on the HIGHEST single account, never the sum (S4.1).
  follower_count_self_reported  int NULL,
  sells_what                    text NOT NULL,
  city                          text NOT NULL,
  consent_at                    timestamptz NOT NULL,
  consent_text_version          text NOT NULL,
  submitted_at                  timestamptz NOT NULL DEFAULT now(),
  -- THE NUMBER IS A COLUMN, not a job's hard-coded interval: the consent
  -- line, the privacy notice and the implementation must state the same
  -- twelve months, readable in one query. (A generated column would be the
  -- cleanest spelling, but timestamptz + interval is not IMMUTABLE under
  -- timezone rules; the BEFORE trigger below writes and re-writes it, so a
  -- row cannot carry any other value.)
  purge_after                   timestamptz NOT NULL DEFAULT now() + interval '12 months',
  reviewed_by                   uuid NULL,
  reviewed_at                   timestamptz NULL,
  outcome                       text NULL,

  CONSTRAINT secondary_handle_shape CHECK (
    (secondary_platform IS NULL) = (secondary_handle IS NULL))
);

CREATE FUNCTION waitlist.fn_fix_purge_after() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.purge_after := NEW.submitted_at + interval '12 months';
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_fix_purge_after
  BEFORE INSERT OR UPDATE ON waitlist.application
  FOR EACH ROW EXECUTE FUNCTION waitlist.fn_fix_purge_after();

CREATE INDEX idx_application_purge ON waitlist.application (purge_after);

COMMENT ON TABLE waitlist.application IS
  'Section 25, C7: deployed with the website, independently of product '
  'infrastructure. The DPIA must cover this table before the first '
  'submission - the earliest hard external gate in the project. At '
  'onboarding the row is read ONCE to pre-fill the seller record; '
  'follower_count_self_reported lands in seller.waitlist_follower_claim, a '
  'DISTINCT column from the verified count - self-reported and verified '
  'are never blended, because the difference between them is a signal.';

-- ---------------------------------------------------------------------------
-- 4. Churn-table autovacuum (section 27 directive; the v1.6 change row
--    names these tables for per-table tuning and no document rules the
--    numbers - these are conventional high-churn settings, recorded here
--    so the eventual measurement has a baseline to correct)
-- ---------------------------------------------------------------------------
ALTER TABLE core.idempotency_record SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE core.rate_limit_bucket SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02);
-- (The jobs schema's tables are created by graphile-worker at its own
-- bootstrap; their tuning belongs to the worker's setup, not a migration
-- that runs before the library ever has.)

-- ---------------------------------------------------------------------------
-- 5. Grants. The purge jobs are the ONLY deleters (their idempotency is the
--    predicate itself); the app writes and reads its own cache and buckets.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA waitlist TO adulis_app, adulis_jobs;

GRANT SELECT, INSERT ON core.idempotency_record TO adulis_app;
GRANT SELECT, DELETE ON core.idempotency_record TO adulis_jobs;

GRANT SELECT, INSERT, UPDATE ON core.rate_limit_bucket TO adulis_app;
GRANT SELECT, DELETE ON core.rate_limit_bucket TO adulis_jobs;

GRANT SELECT, INSERT, UPDATE ON waitlist.application TO adulis_app;
GRANT SELECT, DELETE ON waitlist.application TO adulis_jobs;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'Migration 15 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
