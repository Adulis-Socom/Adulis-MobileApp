-- ===========================================================================
-- MIGRATION 08 - TRUST LADDER, LEVEL EVENTS, ANTI-GAMING, PUBLIC STATS
--
-- Source: ADU-DB-01 v1.10 section 28 item 8. Transcribed from sections 8.1,
-- 8.2 and 8.3. (File 0010: document and file numbering diverged when
-- migration 05 split across 0005/0006 and A3.3 took 0009.)
--
-- Five tables, one function, and the R16 trigger-maintained stats table.
--
-- THE RULE THIS MIGRATION EXISTS TO HOLD (section 5.1): a seller's level is
-- computed from completed, scanned handoffs and published reliability
-- statistics. It is NEVER set manually, never purchasable, and never affected
-- by subscription tier - the one rule whose violation makes the entire
-- product worthless. Three mechanisms, all here:
--   1. seller_level_state has NO UPDATE grant to adulis_app;
--   2. fn_recompute_seller_level references NO billing table - there is no
--      join path from a subscription to a level;
--   3. every change writes seller_level_event (append-only), and a MODERATION
--      change without a moderation_event_id is a constraint violation.
--
-- FAIL-CLOSED IS THE DESIGN, NOT AN ACCIDENT OF THREE-VALUED LOGIC (Work
-- Order T3 section 4 trap 1). core.ladder_config's sixteen value columns are
-- DELIBERATELY unseeded (ADU-VAL-01 Groups A/B/C). With no config row in
-- force - or any threshold NULL - every promotion comparison in
-- fn_recompute_seller_level collapses to an explicit false via coalesce, so a
-- missing threshold makes that level UNREACHABLE, never universally
-- reachable. The CP-7 test asserts it: with thresholds absent, no volume of
-- evidence promotes anyone.
--
-- DORMANT REFERENCES, per the D3/D4 precedent (section 28.1):
-- fn_recompute_seller_level reads core.handoff_scan (migration 11),
-- core.review and core.claim (migration 12). plpgsql resolves table names at
-- execution, so it compiles here and is callable once those exist. THE GRANTS
-- adulis_migrate NEEDS ON THOSE TABLES ARE ISSUED IN THEIR OWN MIGRATIONS.
--
-- Stats maintenance is split the same way: the trigger on seller_level_event
-- lands here; the triggers on reservation (cancellation rate, migration 09),
-- payment_submission (confirmation rate and missed windows, migration 10),
-- handoff_scan (handoffs and scan completion, migration 11) and claim
-- (unresolved count, migration 12) land WITH THEIR TABLES. Every one is an
-- O(1) primary-key UPDATE - R16's whole point.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. core.seller_level_state (section 8.1)
--
-- One row per seller, created by fn_enter_ladder (migration 05, dormant until
-- now) when eligibility is satisfied - C5's ruling: NEW on eligibility, not on
-- ID attestation. ON CONFLICT DO NOTHING there means re-evaluation never
-- resets a seller who has already climbed.
-- ---------------------------------------------------------------------------
CREATE TABLE core.seller_level_state (
  seller_id   uuid PRIMARY KEY REFERENCES core.seller(id),
  level       core.trust_level NOT NULL DEFAULT 'NEW',
  since       timestamptz NOT NULL DEFAULT now(),
  computed_at timestamptz NOT NULL DEFAULT now(),
  evidence_snapshot jsonb NULL
);

COMMENT ON TABLE core.seller_level_state IS
  'Section 8.1. Written ONLY by core.fn_recompute_seller_level (SECURITY '
  'DEFINER, owner adulis_migrate) and inserted by the fn_enter_ladder trigger '
  'path. adulis_app holds no UPDATE grant - mechanism 1 of the three that '
  'keep a level from ever being set by hand. `since` moves only when the '
  'level CHANGES; re-satisfaction after revocation does not reset it, because '
  'the ladder measures accumulated handoff evidence (P2).';

-- ---------------------------------------------------------------------------
-- 2. core.seller_level_event (section 8.1) - APPEND-ONLY
--
-- moderation_event_id is a BARE uuid: core.moderation_event is migration 14,
-- which adds the FK. Same deferral shape as stock_event's order columns.
-- ---------------------------------------------------------------------------
CREATE TABLE core.seller_level_event (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id           uuid NOT NULL REFERENCES core.seller(id),
  from_level          core.trust_level NULL,
  to_level            core.trust_level NOT NULL,
  source              core.level_change_source NOT NULL,
  moderation_event_id uuid NULL,          -- FK added by migration 14
  occurred_at         timestamptz NOT NULL DEFAULT now(),

  -- Section 5.1: "no manual downgrade except through moderation action, which
  -- is logged" - expressed so an unlogged manual downgrade is a constraint
  -- violation, not an oversight.
  CONSTRAINT moderation_change_is_logged CHECK (
    source <> 'MODERATION' OR moderation_event_id IS NOT NULL
  )
);

CREATE INDEX idx_seller_level_event_seller
  ON core.seller_level_event (seller_id, occurred_at DESC);

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON core.seller_level_event
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

-- ---------------------------------------------------------------------------
-- 3. Anti-gaming support tables (section 8.2)
--
-- Columns are minimal transcriptions - the document names the tables and
-- their jobs, not their columns. Flagged in the defect register (D-12 family)
-- rather than silently invented beyond the minimum the job needs.
-- ---------------------------------------------------------------------------
CREATE TABLE core.level_velocity_flag (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid NOT NULL REFERENCES core.seller(id),
  reason      text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz NULL
);

COMMENT ON TABLE core.level_velocity_flag IS
  'Section 8.2 - automatic review flag when a level rises unusually fast; '
  'section 14.2 also feeds it when a reported clock offset disagrees with the '
  'population. Read by operators, never by the recompute function - a flag is '
  'a review queue entry, not an input to the arithmetic it questions.';

CREATE TABLE core.buyer_seller_pair_signal (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_account_id uuid NOT NULL REFERENCES core.account(id),
  seller_id        uuid NOT NULL REFERENCES core.seller(id),
  detail           text NOT NULL,
  computed_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.buyer_seller_pair_signal IS
  'Section 8.2 - written by the scheduled graph-analysis job. Rows are '
  'signals for human review, not levers: nothing in the ladder arithmetic '
  'reads this table.';

-- ---------------------------------------------------------------------------
-- 4. core.seller_public_stats (section 8.3) - R16: A PLAIN TABLE, NEVER A
--    MATERIALIZED VIEW
--
-- One row per seller, read on every storefront page load on a low-end Android
-- - the binding performance constraint. Maintained in O(1) by triggers: each
-- source-table write performs one UPDATE ... WHERE seller_id = $1 against
-- this primary key. Counts are incremented; rates are recomputed FROM
-- COUNTERS HELD ON THE SAME ROW, never by scanning the source tables.
--
-- THE COUNTER COLUMNS ARE THE R16 MECHANISM, NOT PUBLISHED VALUES (register
-- D-12): a rate maintained in O(1) needs its numerator and denominator on the
-- row. The published set is exactly section 8.3's list. "Stock confidence" is
-- NOT stored here - a stored level drifts the moment a job misses a run,
-- which is section 10.2's own argument; the storefront reads
-- v_stock_confidence per variant.
--
-- INVARIANT (section 13.2 / 8.3) - only numbers, dates and the three level
-- names. NO free-text column exists, so a published statistic that cannot
-- hold a sentence cannot hold an accusation.
-- ---------------------------------------------------------------------------
CREATE TABLE core.seller_public_stats (
  seller_id                    uuid PRIMARY KEY REFERENCES core.seller(id),
  level                        core.trust_level NOT NULL DEFAULT 'NEW',

  -- published counts
  completed_handoff_count      int NOT NULL DEFAULT 0,
  unresolved_claim_count       int NOT NULL DEFAULT 0,
  missed_confirmation_windows  int NOT NULL DEFAULT 0,

  -- published rates, recomputed from the counters below on each O(1) update
  cancellation_rate            numeric(5,4) NULL,
  confirmation_rate            numeric(5,4) NULL,
  scan_completion_rate         numeric(5,4) NULL,

  -- R16 counters (numerator / denominator per rate; section 12.5's
  -- arithmetic: the cancellation rate counts reservation rows, never orders)
  reservations_cancelled_count int NOT NULL DEFAULT 0,
  reservations_terminal_count  int NOT NULL DEFAULT 0,
  payments_confirmed_count     int NOT NULL DEFAULT 0,
  payments_decided_count       int NOT NULL DEFAULT 0,
  orders_completed_count       int NOT NULL DEFAULT 0,

  updated_at                   timestamptz NOT NULL DEFAULT now()
);

-- The row exists from the moment the seller does, so the storefront read is
-- one primary-key lookup with no absent-row branch.
CREATE FUNCTION core.fn_create_public_stats() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
BEGIN
  INSERT INTO core.seller_public_stats (seller_id)
  VALUES (NEW.id)
  ON CONFLICT (seller_id) DO NOTHING;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_create_public_stats
  AFTER INSERT ON core.seller
  FOR EACH ROW EXECUTE FUNCTION core.fn_create_public_stats();

-- Level flows to the public row from the EVENT, so the stats surface can only
-- ever show a level the append-only log records.
CREATE FUNCTION core.fn_stats_on_level_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
BEGIN
  UPDATE core.seller_public_stats
     SET level = NEW.to_level, updated_at = now()
   WHERE seller_id = NEW.seller_id;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_stats_on_level_event
  AFTER INSERT ON core.seller_level_event
  FOR EACH ROW EXECUTE FUNCTION core.fn_stats_on_level_event();

-- ---------------------------------------------------------------------------
-- 5. core.fn_recompute_seller_level (sections 8.1, 8.2, 5.5)
--
-- The ONLY writer of seller_level_state. The document describes this function
-- by its three mechanisms and its criteria columns and elides the SQL; the
-- body below is a transcription of those statements, with the denominators
-- it needs recorded in the defect register (D-13) for ratification.
--
-- Criteria (section 5.5's sixteen columns, ADU-VAL-01 Groups A-C):
--   ESTABLISHED: >= established_min_handoffs counting handoffs inside
--     established_window, average rating >= established_min_avg_rating,
--     upheld-claim rate <= established_max_claim_rate.
--   TRUSTED: >= trusted_min_handoffs inside trusted_window, scan-completion
--     rate >= trusted_min_scan_completion_rate, upheld-claim rate <=
--     trusted_max_claim_rate.
--   DEMOTION (hysteresis - its own thresholds, deliberately): claim rate >
--     demotion_max_claim_rate, OR cancellation rate >
--     demotion_max_cancellation_rate, OR scan-completion rate <
--     demotion_min_scan_completion_rate, over demotion_window -> one level
--     down, floor NEW.
--
-- EVERY comparison is coalesced to false. A NULL threshold - or an absent
-- config row entirely - therefore refuses the promotion and refuses the
-- threshold demotion; it never grants either. Forced demotion (the upheld-
-- claim trigger, section 5.2's "always demotes, regardless of volume") works
-- with or without configuration, because the PRD says ALWAYS.
--
-- It references core.handoff_scan, core.review, core.claim and
-- core.ladder_config. IT REFERENCES NO BILLING TABLE - mechanism 2.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_recompute_seller_level(
  p_seller uuid,
  p_forced_demotion boolean DEFAULT false,
  p_moderation_event uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_state     core.seller_level_state;
  v_cfg       core.ladder_config;
  v_target    core.trust_level;
  v_handoffs_est int;
  v_handoffs_tru int;
  v_avg_rating   numeric;
  v_claim_rate_est numeric;
  v_claim_rate_tru numeric;
  v_claim_rate_dem numeric;
  v_cancel_rate    numeric;
  v_scan_rate_tru  numeric;
  v_scan_rate_dem  numeric;
BEGIN
  -- Lock the row: two concurrent recomputes must serialise, or two triggers
  -- firing together could each read the old level and both "demote once".
  SELECT * INTO v_state
    FROM core.seller_level_state
   WHERE seller_id = p_seller
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;   -- not on the ladder yet (eligibility not satisfied) - nothing to compute
  END IF;

  IF p_forced_demotion THEN
    -- Section 5.2 / 14: an upheld claim ALWAYS demotes, unconditionally.
    v_target := CASE v_state.level
                  WHEN 'TRUSTED'     THEN 'ESTABLISHED'::core.trust_level
                  WHEN 'ESTABLISHED' THEN 'NEW'::core.trust_level
                  ELSE 'NEW'::core.trust_level
                END;
    IF v_target <> v_state.level THEN
      INSERT INTO core.seller_level_event
        (seller_id, from_level, to_level, source, moderation_event_id)
      VALUES (p_seller, v_state.level, v_target, 'MODERATION', p_moderation_event);
      UPDATE core.seller_level_state
         SET level = v_target, since = now(), computed_at = now()
       WHERE seller_id = p_seller;
    ELSE
      UPDATE core.seller_level_state SET computed_at = now()
       WHERE seller_id = p_seller;
    END IF;
    RETURN;
  END IF;

  -- Configuration in force for the seller's market. ABSENT CONFIG IS THE
  -- FAIL-CLOSED EXIT, taken before a single evidence row is read: no
  -- thresholds means no promotion and no threshold demotion, whatever the
  -- evidence says - ADU-VAL-01's deliberate deferral must make every level
  -- UNREACHABLE, never universally reachable. (Forced demotion returned
  -- above, because "always demotes" needs no configuration.)
  SELECT lc.* INTO v_cfg
    FROM core.ladder_config lc
    JOIN core.seller s ON s.market_id = lc.market_id
   WHERE s.id = p_seller
     AND lc.effective @> now();
  IF NOT FOUND THEN
    UPDATE core.seller_level_state SET computed_at = now()
     WHERE seller_id = p_seller;
    RETURN;
  END IF;

  -- Evidence. Only counting handoffs (section 11.3: the recompute reads
  -- handoff_scan alone, never order_confirmation).
  SELECT count(*) INTO v_handoffs_est
    FROM core.handoff_scan h
    JOIN core."order" o ON o.id = h.order_id
   WHERE o.seller_id = p_seller AND h.counts_toward_level
     AND h.received_at >= now() - v_cfg.established_window;
  SELECT count(*) INTO v_handoffs_tru
    FROM core.handoff_scan h
    JOIN core."order" o ON o.id = h.order_id
   WHERE o.seller_id = p_seller AND h.counts_toward_level
     AND h.received_at >= now() - v_cfg.trusted_window;

  SELECT avg(seller_rating) INTO v_avg_rating
    FROM core.review
   WHERE seller_id = p_seller AND anonymised_at IS NULL;

  -- Denominators recorded in register D-13:
  --   claim rate        = upheld claims / counting handoffs, per window
  --   cancellation rate = cancelled reservations / terminal reservations
  --   scan completion   = counting scans / completed orders, per window
  v_claim_rate_est := core.fn_ladder_claim_rate(p_seller, v_cfg.established_window);
  v_claim_rate_tru := core.fn_ladder_claim_rate(p_seller, v_cfg.trusted_window);
  v_claim_rate_dem := core.fn_ladder_claim_rate(p_seller, v_cfg.demotion_window);
  v_cancel_rate    := core.fn_ladder_cancellation_rate(p_seller, v_cfg.demotion_window);
  v_scan_rate_tru  := core.fn_ladder_scan_rate(p_seller, v_cfg.trusted_window);
  v_scan_rate_dem  := core.fn_ladder_scan_rate(p_seller, v_cfg.demotion_window);

  -- FAIL CLOSED: coalesce(_, false) on every gate. NULL never promotes.
  IF coalesce(
       v_handoffs_tru >= v_cfg.trusted_min_handoffs
       AND v_scan_rate_tru >= v_cfg.trusted_min_scan_completion_rate
       AND v_claim_rate_tru <= v_cfg.trusted_max_claim_rate
       -- Trusted presumes Established's bar was climbed first
       AND v_handoffs_est >= v_cfg.established_min_handoffs
       AND v_avg_rating   >= v_cfg.established_min_avg_rating,
     false)
  THEN
    v_target := 'TRUSTED';
  ELSIF coalesce(
       v_handoffs_est >= v_cfg.established_min_handoffs
       AND v_avg_rating >= v_cfg.established_min_avg_rating
       AND v_claim_rate_est <= v_cfg.established_max_claim_rate,
     false)
  THEN
    v_target := 'ESTABLISHED';
  ELSE
    v_target := 'NEW';
  END IF;

  -- Hysteresis demotion: its own thresholds, one level down, floor NEW.
  -- Also fail-closed - an absent threshold never demotes on its own.
  IF v_state.level <> 'NEW' AND coalesce(
       v_claim_rate_dem > v_cfg.demotion_max_claim_rate
       OR v_cancel_rate  > v_cfg.demotion_max_cancellation_rate
       OR v_scan_rate_dem < v_cfg.demotion_min_scan_completion_rate,
     false)
  THEN
    v_target := CASE v_state.level
                  WHEN 'TRUSTED' THEN 'ESTABLISHED'::core.trust_level
                  ELSE 'NEW'::core.trust_level
                END;
  END IF;

  -- A recompute never promotes past the next rung a demotion just set; the
  -- CASE above already produced a single target. Apply it.
  IF v_target <> v_state.level THEN
    INSERT INTO core.seller_level_event
      (seller_id, from_level, to_level, source)
    VALUES (p_seller, v_state.level, v_target, 'COMPUTED');
    UPDATE core.seller_level_state
       SET level = v_target, since = now(), computed_at = now(),
           evidence_snapshot = jsonb_build_object(
             'handoffs_established_window', v_handoffs_est,
             'handoffs_trusted_window',     v_handoffs_tru,
             'avg_rating',                  v_avg_rating,
             'claim_rate_demotion_window',  v_claim_rate_dem,
             'cancellation_rate',           v_cancel_rate,
             'scan_completion_rate',        v_scan_rate_dem)
     WHERE seller_id = p_seller;
  ELSE
    UPDATE core.seller_level_state SET computed_at = now()
     WHERE seller_id = p_seller;
  END IF;
END $fn$;

-- The three rate helpers. Split out so each denominator choice is one
-- greppable, testable place (register D-13), not arithmetic buried mid-body.
CREATE FUNCTION core.fn_ladder_claim_rate(p_seller uuid, p_window interval)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_upheld int; v_handoffs int;
BEGIN
  IF p_window IS NULL THEN RETURN NULL; END IF;
  SELECT count(*) INTO v_upheld
    FROM core.claim c JOIN core."order" o ON o.id = c.order_id
   WHERE o.seller_id = p_seller AND c.outcome = 'UPHELD'
     AND c.decided_at >= now() - p_window;
  SELECT count(*) INTO v_handoffs
    FROM core.handoff_scan h JOIN core."order" o ON o.id = h.order_id
   WHERE o.seller_id = p_seller AND h.counts_toward_level
     AND h.received_at >= now() - p_window;
  IF v_handoffs = 0 THEN
    -- No handoffs: no rate exists. NULL, which every caller fails closed on.
    RETURN CASE WHEN v_upheld > 0 THEN 1 ELSE NULL END;
  END IF;
  RETURN v_upheld::numeric / v_handoffs;
END $fn$;

CREATE FUNCTION core.fn_ladder_cancellation_rate(p_seller uuid, p_window interval)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_cancelled int; v_terminal int;
BEGIN
  IF p_window IS NULL THEN RETURN NULL; END IF;
  -- Section 12.5: the cancellation rate counts reservation rows, never orders,
  -- and it is the SELLER's rate - seller-caused terminals (CANCELLED_BY_SELLER,
  -- REFUNDED) over all terminal reservations. The window is anchored on the
  -- parent order's created_at: every terminal reservation has one, while only
  -- cancelled rows carry cancelled_at, and a rate whose numerator and
  -- denominator use different clocks is not a rate.
  SELECT count(*) FILTER (WHERE r.state IN ('CANCELLED_BY_SELLER', 'REFUNDED')),
         count(*)
    INTO v_cancelled, v_terminal
    FROM core.reservation r
    JOIN core."order" o ON o.id = r.order_id
   WHERE r.seller_id = p_seller
     AND r.state <> 'ACTIVE'
     AND o.created_at >= now() - p_window;
  IF v_terminal = 0 THEN RETURN NULL; END IF;
  RETURN v_cancelled::numeric / v_terminal;
END $fn$;

CREATE FUNCTION core.fn_ladder_scan_rate(p_seller uuid, p_window interval)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_scanned int; v_completed int;
BEGIN
  IF p_window IS NULL THEN RETURN NULL; END IF;
  SELECT count(*) INTO v_completed
    FROM core."order" o
   WHERE o.seller_id = p_seller AND o.state = 'COMPLETED'
     AND o.created_at >= now() - p_window;
  SELECT count(*) INTO v_scanned
    FROM core.handoff_scan h JOIN core."order" o ON o.id = h.order_id
   WHERE o.seller_id = p_seller AND h.counts_toward_level
     AND h.received_at >= now() - p_window;
  IF v_completed = 0 THEN RETURN NULL; END IF;
  RETURN least(v_scanned::numeric / v_completed, 1);
END $fn$;

-- ---------------------------------------------------------------------------
-- 6. Ownership and grants
--
-- SECURITY DEFINER runs as the function OWNER; these migrations are applied by
-- a bootstrap superuser, so every definer function above is re-owned to
-- adulis_migrate (the m05 precedent). adulis_migrate receives exactly the
-- table privileges the bodies need - on tables that exist. Grants on
-- handoff_scan, review and claim are issued by migrations 11 and 12.
-- ---------------------------------------------------------------------------
ALTER FUNCTION core.fn_recompute_seller_level(uuid, boolean, uuid) OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_ladder_claim_rate(uuid, interval)           OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_ladder_cancellation_rate(uuid, interval)    OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_ladder_scan_rate(uuid, interval)            OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_create_public_stats()                       OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_stats_on_level_event()                      OWNER TO adulis_migrate;

GRANT SELECT ON core.ladder_config, core.seller, core.seller_level_state
  TO adulis_migrate;
GRANT UPDATE, INSERT ON core.seller_level_state       TO adulis_migrate;
GRANT INSERT         ON core.seller_level_event       TO adulis_migrate;
GRANT SELECT, INSERT, UPDATE ON core.seller_public_stats TO adulis_migrate;

REVOKE ALL ON FUNCTION core.fn_recompute_seller_level(uuid, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.fn_recompute_seller_level(uuid, boolean, uuid)
  TO adulis_app, adulis_jobs;

-- Application grants. seller_level_state: SELECT + INSERT only - the INSERT
-- is the fn_enter_ladder trigger path (it runs as the inserting role), and
-- the ABSENT UPDATE is mechanism 1. seller_public_stats: SELECT ONLY - every
-- write path is a SECURITY DEFINER trigger function above, so the buyer-
-- visible surface cannot be written except through the append-only event log
-- and the counter triggers. Stricter than the letter of 8.3, in the service
-- of 5.1; noted, not hidden.
GRANT SELECT, INSERT ON core.seller_level_state TO adulis_app;
GRANT SELECT ON core.seller_level_event         TO adulis_app;
REVOKE UPDATE, DELETE ON core.seller_level_event FROM adulis_app;
GRANT SELECT ON core.seller_public_stats        TO adulis_app;
GRANT SELECT, INSERT, UPDATE ON core.level_velocity_flag      TO adulis_app;
GRANT SELECT, INSERT         ON core.buyer_seller_pair_signal TO adulis_app, adulis_jobs;

GRANT SELECT ON core.seller_level_state, core.seller_level_event,
                core.level_velocity_flag, core.buyer_seller_pair_signal,
                core.seller_public_stats
  TO adulis_readonly;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'Migration 08 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
