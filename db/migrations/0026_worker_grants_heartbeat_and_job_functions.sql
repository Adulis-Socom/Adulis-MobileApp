-- ===========================================================================
-- MIGRATION 0026 - WHAT THE WORKER NEEDS: SCHEMA ACCESS, A HEARTBEAT, AND
--                  THE TWO JOB FUNCTIONS THAT MUST NOT BE PLAIN SQL
--
-- Sources:
--   ADU-DB-01 v1.10 S24      - the twenty scheduled jobs and their cadences
--   ADU-DB-01 v1.10 S13.3    - the evidence purge is scoped BY NAME
--   ADU-DB-01 v1.10 S22      - analytics.event monthly partitions
--   ADU-CON-02 v3.0 S20.2    - a worker heartbeat row every 5 minutes;
--                              /healthz reddens when it goes stale
--   WORK ORDER T4 S1.2       - every function a job calls needs an explicit
--                              grant to adulis_jobs, justified in one line
--
-- ---------------------------------------------------------------------------
-- THE FINDING THIS MIGRATION EXISTS FOR (register D-47)
--
-- adulis_jobs had NO USAGE ON SCHEMA core. Not "the wrong table grants" -
-- no access to the schema at all, so every one of the twenty jobs would
-- have died on its first statement with 42501, including the ones migration
-- 0025 had just granted EXECUTE on. Proven, not inferred:
--
--   SET ROLE adulis_jobs;
--   SELECT core.fn_confirmation_window_lapse('...');
--   ERROR:  permission denied for schema core
--
-- USAGE conveys namespace visibility and no data access whatsoever (the same
-- argument check 10's header makes for adulis_app), so granting it opens
-- nothing on its own - every table privilege below is still explicit and
-- narrow. The reason it was invisible is that nothing had ever run.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. The schema the worker could not see
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA core TO adulis_jobs;

-- ---------------------------------------------------------------------------
-- 2. Table privileges, one job's need per line. Nothing here is granted to
--    make an error go away; each names the job that fails without it.
--    (SELECT/UPDATE on reservation, stock_event, notification, subscription
--    and the transition log were already granted by migrations 10-16 and are
--    not repeated.)
-- ---------------------------------------------------------------------------
-- order.expire_sweep: reads the due set, writes the terminal state. The
-- guard and log triggers are NOT definer, so they run as adulis_jobs - the
-- SELECT on the legal table and INSERT on the log already exist.
GRANT SELECT ON core."order" TO adulis_jobs;
-- state AND total_minor, and the second one is not the job's own write:
-- fn_derive_order_state is an INVOKER trigger on core.reservation that
-- recalculates the order total on every line state change, so it runs as
-- adulis_jobs and needs the column. A grant of (state) alone passes every
-- statement test and fails the first time a real row moves - the run's
-- recurring class, caught here by running the job as the role.
GRANT UPDATE (state, total_minor) ON core."order" TO adulis_jobs;

-- order.expire_sweep + order.close_confirmation_window: the window arithmetic
-- and the market a notification is timed against.
GRANT SELECT ON core.timing_config TO adulis_jobs;
GRANT SELECT ON core.market        TO adulis_jobs;
GRANT SELECT ON core.seller        TO adulis_jobs;

-- buyer_cooldown.decay: a counter whose window has passed is removed, not
-- zeroed - a zero row and no row mean the same thing to fn_assert_no_cooldown.
GRANT DELETE ON core.buyer_cancellation_counter TO adulis_jobs;

-- device.purge_unbound: unbound devices AND their carts (S11's purge).
GRANT SELECT, DELETE ON core.device    TO adulis_jobs;
-- SELECT as well as DELETE on cart: the purge finds the carts by device and
-- then re-checks that none survived before removing the device itself.
GRANT SELECT, DELETE ON core.cart      TO adulis_jobs;
GRANT DELETE         ON core.cart_line TO adulis_jobs;
-- ...and the two columns fn_cart_last_line writes. It is an INVOKER trigger
-- on cart_line that clears the cart's seller when the last line goes, so it
-- runs as adulis_jobs. Third instance of this run's recurring class - a
-- trigger the writer never mentions, needing a privilege the writer's own
-- statement does not suggest - and, like the other two, only reachable by
-- running the job as the role.
GRANT UPDATE (seller_id, updated_at) ON core.cart TO adulis_jobs;

-- media.lifecycle: the purge schedule it drains.
GRANT SELECT, DELETE ON core.media_lifecycle TO adulis_jobs;

-- stock.confidence_nudge: the variant's confirmation age, via
-- v_stock_confidence, and the product it belongs to (only a PUBLISHED
-- product's stale stock is worth a nudge).
GRANT SELECT ON core.product_variant    TO adulis_jobs;
GRANT SELECT ON core.v_stock_confidence TO adulis_jobs;
GRANT SELECT ON core.product            TO adulis_jobs;

-- social_post.availability_check: marks a post whose platform no longer
-- serves it. status is the only column it may touch.
GRANT SELECT          ON core.social_post TO adulis_jobs;
GRANT UPDATE (status) ON core.social_post TO adulis_jobs;

-- subscription.collect_reminder: the outstanding collection and its reminder
-- stamp. Nothing here decides a price.
GRANT SELECT                    ON billing.collection_record TO adulis_jobs;
GRANT UPDATE (reminder_sent_at) ON billing.collection_record TO adulis_jobs;

-- ledger.assert_zero: the balance view and the two tables beneath it (a view
-- runs as its invoker here - both need reading).
GRANT SELECT ON ledger.v_adulis_balance TO adulis_jobs;
GRANT SELECT ON ledger.entry            TO adulis_jobs;
GRANT SELECT ON ledger.transaction      TO adulis_jobs;

-- waitlist.retention_purge: twelve months (S25). The table is application,
-- not signup - S25's prose and the schema differ, and the schema governs.
GRANT SELECT, DELETE ON waitlist.application TO adulis_jobs;

-- nlu.harvest_unmatched: reads escalated turns, writes identity-stripped
-- phrases. chat SELECT and nlu INSERT already exist from migration 15; the
-- ONE-WAY direction is the invariant (check 4) and is unchanged.
GRANT SELECT ON chat.conversation TO adulis_jobs;
-- ...and SELECT on its own target: the ETL is idempotent by a NOT EXISTS
-- against the phrase library, and migration 15 granted only INSERT. An
-- append-only table cannot have a duplicate cleaned up afterwards, so the
-- read is what makes re-running safe.
GRANT SELECT ON nlu.unmatched_phrase TO adulis_jobs;

-- notification.morning_reminder / send: the reservation lines a reminder
-- names, the buyer it goes to, and the row it enqueues.
GRANT SELECT ON core.reservation   TO adulis_jobs;
GRANT SELECT ON core.account       TO adulis_jobs;
GRANT INSERT ON core.notification  TO adulis_jobs;
-- notification.send consults the preference before every suppressible send;
-- it never writes one (12.14 owns that), so SELECT alone.
GRANT SELECT ON core.notification_preference TO adulis_jobs;
-- notification.push_seller reads the seller's registered device tokens and
-- clears one that the provider reports permanently dead.
GRANT UPDATE (push_token) ON core.device TO adulis_jobs;

-- ---------------------------------------------------------------------------
-- 3. jobs.worker_heartbeat (ADU-CON-02 S20.2)
--
-- One row, ever: id is a constant. The worker upserts it every five minutes
-- and /healthz reddens when it is stale, so a dead worker is discovered by
-- us rather than by a seller noticing that 48-hour-old orders never expired.
-- ---------------------------------------------------------------------------
CREATE TABLE jobs.worker_heartbeat (
  id        boolean PRIMARY KEY DEFAULT true CONSTRAINT one_row CHECK (id),
  beat_at   timestamptz NOT NULL DEFAULT now(),
  worker_id text NOT NULL,
  jobs_registered int NOT NULL DEFAULT 0
);

COMMENT ON TABLE jobs.worker_heartbeat IS
  'ADU-CON-02 v3.0 S20.2 - "A worker heartbeat row every 5 minutes; '
  '/healthz reddens when stale." ONE row by construction (id boolean PK with '
  'a CHECK): a heartbeat table that can hold two rows is a heartbeat that '
  'can be green because a dead worker beat once, months ago.';

GRANT SELECT, INSERT, UPDATE ON jobs.worker_heartbeat TO adulis_jobs;
-- graphile-worker's OWN tables are installed by the DDL role (pnpm
-- worker:install), and the `jobs` schema is owned by adulis_jobs, so the DDL
-- role needs CREATE inside it. The alternative - letting the worker install
-- its own schema - requires CREATE on the DATABASE at runtime, which is a
-- standing privilege the runtime role must not hold (register D-52).
GRANT CREATE, USAGE ON SCHEMA jobs TO adulis_migrate;
-- The API reads it to answer /healthz; it never writes it.
GRANT USAGE  ON SCHEMA jobs        TO adulis_app;
GRANT SELECT ON jobs.worker_heartbeat TO adulis_app;

-- ---------------------------------------------------------------------------
-- 4. financial.purge_payment_evidence - the boundary crossing, and why it is
--    a function rather than a grant (register D-48)
--
-- S24: "Scoped to financial.payment_evidence BY NAME, never to the schema -
-- payout credentials share it and must not be purged." The safest way to
-- honour that is to make the schema unreachable to the job at all: no table
-- privilege in financial is granted here, and the purge is two definer
-- functions the job calls in sequence.
--
-- TWO functions, not one, because the object must leave R2 before the row
-- leaves Postgres, and an object store call must never happen inside an open
-- transaction (T4 S2.3 trap 5 / the gate's last line):
--
--   list_purgeable_evidence -> the job deletes each object -> purge_payment_evidence
--
-- The ORDER is the recoverable one. A crash after the object is deleted and
-- before the row is leaves a row pointing at a missing object -> a reader
-- 500s. A crash the other way leaves an object nothing references -> storage
-- cost, and the next run finds the row again and re-deletes an absent object,
-- which R2 treats as success. So: object first, row second, and re-running is
-- always safe.
-- ---------------------------------------------------------------------------
CREATE FUNCTION financial.list_purgeable_evidence(p_limit int)
RETURNS TABLE (id uuid, object_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = financial AS $fn$
  SELECT e.id, e.object_key
    FROM financial.payment_evidence e
   WHERE e.validated_at IS NOT NULL
     AND e.retention_reason IS NULL
     AND e.deleted_at IS NULL
   ORDER BY e.validated_at
   LIMIT p_limit
$fn$;

CREATE FUNCTION financial.purge_payment_evidence(p_ids uuid[])
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = financial AS $fn$
DECLARE
  v_count int;
BEGIN
  -- The predicate is REPEATED here deliberately. The job passes ids it read
  -- a moment ago; a claim opened in between sets retention_reason, and this
  -- second evaluation is what makes the race safe. Never widen it to
  -- "WHERE id = ANY(p_ids)" alone.
  UPDATE financial.payment_evidence e
     SET deleted_at = now()
   WHERE e.id = ANY (p_ids)
     AND e.validated_at IS NOT NULL
     AND e.retention_reason IS NULL
     AND e.deleted_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

COMMENT ON FUNCTION financial.purge_payment_evidence(uuid[]) IS
  'S13.3/S24 - scoped to financial.payment_evidence BY NAME. '
  'financial.payout_credential is in the same schema and is not reachable '
  'from here: this function names one table, and adulis_jobs holds no table '
  'privilege in financial at all.';

ALTER FUNCTION financial.list_purgeable_evidence(int)  OWNER TO adulis_financial;
ALTER FUNCTION financial.purge_payment_evidence(uuid[]) OWNER TO adulis_financial;
REVOKE ALL ON FUNCTION financial.list_purgeable_evidence(int)  FROM PUBLIC;
REVOKE ALL ON FUNCTION financial.purge_payment_evidence(uuid[]) FROM PUBLIC;
-- The JOB alone. adulis_app has no business purging evidence.
GRANT EXECUTE ON FUNCTION financial.list_purgeable_evidence(int)  TO adulis_jobs;
GRANT EXECUTE ON FUNCTION financial.purge_payment_evidence(uuid[]) TO adulis_jobs;
GRANT USAGE ON SCHEMA financial TO adulis_jobs;

-- ---------------------------------------------------------------------------
-- 5. analytics.create_partition (S22, S24)
--
-- S24 names the job and migration 16 names the function in a comment; the
-- function was never written, so partitions have only ever landed in the
-- DEFAULT partition. Creating a partition is DDL, so it is a definer owned
-- by the schema's owner - the job holds no CREATE anywhere.
-- ---------------------------------------------------------------------------
-- The parent must be owned by the definer's owner or PostgreSQL refuses the
-- ATTACH with "must be owner of table event" (register D-49): migrations run
-- as the bootstrap role, so every table is bootstrap-owned while the SCHEMA
-- is adulis_migrate's. Aligning the partitioned parent with its own schema's
-- owner is what makes S24's monthly job possible at all; grants live in the
-- ACL and survive the change, and routed INSERTs are checked on the parent,
-- so nothing the API does is affected.
ALTER TABLE analytics.event OWNER TO adulis_migrate;

CREATE FUNCTION analytics.create_partition(p_month date)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = analytics AS $fn$
DECLARE
  v_start date := date_trunc('month', p_month)::date;
  v_end   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_name  text := 'event_' || to_char(v_start, 'YYYY_MM');
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'analytics' AND c.relname = v_name) THEN
    RETURN v_name;   -- idempotent: the monthly job may run twice
  END IF;
  EXECUTE format(
    'CREATE TABLE analytics.%I PARTITION OF analytics.event FOR VALUES FROM (%L) TO (%L)',
    v_name, v_start, v_end);
  RETURN v_name;
END $fn$;

COMMENT ON FUNCTION analytics.create_partition(date) IS
  'S22/S24. Idempotent by existence check, not by exception handling: a '
  'CREATE that raises inside a transaction poisons it, and the monthly job '
  'must be safe to run twice on the same month.';

ALTER FUNCTION analytics.create_partition(date) OWNER TO adulis_migrate;
REVOKE ALL ON FUNCTION analytics.create_partition(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION analytics.create_partition(date) TO adulis_jobs;

-- ---------------------------------------------------------------------------
-- 6. Function EXECUTE for the jobs that call a named function (T4 S1.2).
--    fn_confirmation_window_lapse was already granted (0014, re-granted
--    0025). These are the rest, one line each.
-- ---------------------------------------------------------------------------
-- level.recompute nightly sweep. Definer-owned by adulis_migrate, so its
-- internal reads of the ladder helpers (revoked from PUBLIC in 0025) run as
-- the owner and need no grant of their own.
GRANT EXECUTE ON FUNCTION core.fn_recompute_seller_level(uuid, boolean, uuid) TO adulis_jobs;
-- The nightly sweep also re-evaluates eligibility where a window moved.
GRANT EXECUTE ON FUNCTION core.fn_evaluate_eligibility(uuid, timestamptz) TO adulis_jobs;
-- NOT GRANTED, deliberately: fn_unpublish_product. S13.3's graduated
-- consequences at stock-confidence levels 2-5 are all READ-TIME (a staleness
-- notice, a hedging chatbot, a degraded badge, blocked broadcasts) and level
-- 5 is "broadcasts blocked", not unpublished. The nudge job's only action is
-- the level-1 nudge, so the job never needs to unpublish anything - and a
-- grant issued "in case" is how a job acquires a power nobody asked it to
-- have.

-- ---------------------------------------------------------------------------
-- 7. core.fn_stats_on_reservation was owned by the SUPERUSER (register D-50)
--
-- Migration 0011 created it SECURITY DEFINER and never issued the
-- `ALTER FUNCTION ... OWNER TO adulis_migrate` that every one of its siblings
-- got, so it defaulted to the role migrations run as - adulis_bootstrap,
-- which is rolsuper. A definer owned by a superuser executes with superuser
-- rights: it bypasses RLS and every privilege check in the database.
--
-- Nothing exploits it today (it returns `trigger`, so it cannot be called
-- directly, and its body touches one table), which is exactly why it went
-- unnoticed through four work orders. Re-owned to adulis_migrate, matching
-- fn_stats_on_order_completed beside it; adulis_migrate already holds
-- SELECT/INSERT/UPDATE on core.seller_public_stats, which is all the body
-- needs.
-- ---------------------------------------------------------------------------
ALTER FUNCTION core.fn_stats_on_reservation() OWNER TO adulis_migrate;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
