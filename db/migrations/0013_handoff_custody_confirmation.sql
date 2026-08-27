-- ===========================================================================
-- MIGRATION 11 - HANDOFF, CUSTODY TRANSFER, CONFIRMATION TIERS
--
-- Source: ADU-DB-01 v1.10 section 28 item 11. Transcribed from sections 14.1,
-- 14.2, 14.3. (File 0013; see 0010's header for the numbering offset.)
--
-- TWO EVENTS, TWO TABLES, DELIBERATELY. Event A (courier custody) never
-- completes an order, never counts toward level, never enables a review -
-- expressed STRUCTURALLY: courier_custody_transfer has no column for any of
-- those and no trigger that reaches order, seller_level_state or review.
-- Conflating the two events would make the trust ladder fakeable by any
-- seller with one cooperative courier.
--
-- Event B (the buyer's scan) is where A5's two clocks separate:
-- COMPLETION TRUSTS THE DEVICE (skew-corrected, floored at token issuance);
-- LEVEL CREDIT TRUSTS THE SERVER (received_at against window + grace).
-- Getting completion wrong hurts one buyer; getting level credit wrong
-- corrupts the product's only differentiator.
--
-- D-11 lands here: section 14.2's cross-table "CHECK (signed_at >=
-- order_qr_token.issued_at)" cannot be a CHECK in PostgreSQL; the validity
-- trigger enforces it - same transaction, same read, and it raises.
--
-- DORMANT BRANCH: the R-1 double-allocation path inserts a
-- moderation_queue_item, which is migration 14's table. plpgsql resolves at
-- execution; the branch is unreachable until re-reservation is possible, and
-- migration 14 lands in this same tier.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. core.courier_custody_transfer - Event A (section 14.1)
-- ---------------------------------------------------------------------------
CREATE TABLE core.courier_custody_transfer (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES core."order"(id),
  courier_account_id   uuid NOT NULL REFERENCES core.account(id),
  seller_confirmed_at  timestamptz NULL,
  courier_confirmed_at timestamptz NULL
);

COMMENT ON TABLE core.courier_custody_transfer IS
  'Event A. NO column for completion, level or review, and NO trigger on this '
  'table touches order.state, seller_level_state or review - the absence is '
  'the invariant (section 14.1).';

-- ---------------------------------------------------------------------------
-- 2. core.handoff_scan - Event B (section 14.2) - APPEND-ONLY
-- ---------------------------------------------------------------------------
CREATE TABLE core.handoff_scan (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                 uuid NOT NULL,
  scanned_by_account_id    uuid NOT NULL,
  nonce                    uuid NOT NULL UNIQUE,
  signed_at                timestamptz NOT NULL,
  reported_clock_offset_ms bigint NOT NULL DEFAULT 0,
  corrected_at             timestamptz NULL,
  received_at              timestamptz NOT NULL DEFAULT now(),
  validity                 core.scan_validity NULL,
  counts_toward_level      boolean NOT NULL DEFAULT false,
  review_badge             core.review_badge NULL,

  -- INVARIANT (section 14.2) - a courier can NEVER perform the buyer's scan,
  -- on any client, under any circumstance. The account that scans must be the
  -- account on the order, as a foreign key, not a check in a service.
  CONSTRAINT handoff_scanned_by_buyer
    FOREIGN KEY (order_id, scanned_by_account_id)
    REFERENCES core."order" (id, buyer_account_id)
);

CREATE INDEX idx_handoff_scan_by_order ON core.handoff_scan (order_id);
CREATE INDEX idx_handoff_scan_received ON core.handoff_scan (received_at DESC);

CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON core.handoff_scan
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

-- ---------------------------------------------------------------------------
-- 3. Validity and level credit (sections 14.2, 8.2) - BEFORE INSERT
--
-- Replay is NOT decided here: a seen nonce dies on the UNIQUE constraint,
-- the cheapest and most reliable rejection available, and the API maps that
-- unique_violation to outcome REJECTED_REPLAY.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_handoff_scan_validity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_order   core."order";
  v_token   core.order_qr_token;
  v_horizon interval;
  v_grace   interval;
  v_window  interval;
  v_maxcnt  int;
  v_prior   int;
BEGIN
  SELECT * INTO v_order FROM core."order" WHERE id = NEW.order_id;

  SELECT * INTO v_token FROM core.order_qr_token WHERE order_id = NEW.order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no QR token exists for order %', NEW.order_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- D-11: a scan cannot predate the token it scanned. Enforced here because
  -- a CHECK cannot cross tables; it raises, exactly as the printed CHECK
  -- would have.
  IF NEW.signed_at < v_token.issued_at THEN
    RAISE EXCEPTION 'scan predates its token' USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT tc.offline_sync_horizon, tc.level_credit_grace
    INTO v_horizon, v_grace
    FROM core.timing_config tc
   WHERE tc.market_id = v_order.market_id AND tc.effective @> now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no timing configuration in force for market of order %', NEW.order_id
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Beyond the sync horizon: rejected outright, server clock's call.
  IF NEW.received_at - NEW.signed_at > v_horizon THEN
    NEW.validity := 'REJECTED_HORIZON';
    NEW.counts_toward_level := false;
    NEW.review_badge := 'UNVERIFIED';
    RETURN NEW;
  END IF;

  -- COMPLETION: the device clock, skew-corrected, floored at token issuance.
  -- The floor bounds a lying offset at the order's own lifetime.
  NEW.corrected_at := greatest(
    NEW.signed_at - make_interval(secs => NEW.reported_clock_offset_ms / 1000.0),
    v_token.issued_at);

  IF NEW.corrected_at <= v_order.expires_at THEN
    NEW.validity := 'VALID';
  ELSE
    NEW.validity := 'LATE';
  END IF;

  -- LEVEL CREDIT: the server clock, and section 8.2's distinct-buyer rules.
  -- Every leg fails closed: absent anti-gaming config means the scan
  -- completes the order and advances nothing.
  NEW.counts_toward_level := false;
  IF NEW.validity = 'VALID'
     AND NEW.received_at <= v_order.expires_at + v_grace THEN
    -- the buyer is not the seller's owner or any team member
    IF NOT EXISTS (SELECT 1 FROM core.seller s
                    WHERE s.id = v_order.seller_id
                      AND s.owner_account_id = NEW.scanned_by_account_id)
       AND NOT EXISTS (SELECT 1 FROM core.seller_team_member tm
                        WHERE tm.seller_id = v_order.seller_id
                          AND tm.account_id = NEW.scanned_by_account_id
                          AND tm.revoked_at IS NULL) THEN
      SELECT lc.distinct_buyer_window, lc.distinct_buyer_max_count
        INTO v_window, v_maxcnt
        FROM core.ladder_config lc
       WHERE lc.market_id = v_order.market_id AND lc.effective @> now();
      IF FOUND AND v_window IS NOT NULL AND v_maxcnt IS NOT NULL THEN
        SELECT count(*) INTO v_prior
          FROM core.handoff_scan h
          JOIN core."order" o ON o.id = h.order_id
         WHERE o.seller_id = v_order.seller_id
           AND h.scanned_by_account_id = NEW.scanned_by_account_id
           AND h.counts_toward_level
           AND h.received_at >= now() - v_window;
        IF v_prior < v_maxcnt THEN
          NEW.counts_toward_level := true;
        END IF;
      END IF;
    END IF;
  END IF;

  NEW.review_badge := CASE WHEN NEW.validity IN ('VALID','LATE')
                           THEN 'VERIFIED_HANDOFF'::core.review_badge
                           ELSE 'UNVERIFIED'::core.review_badge END;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_handoff_scan_validity
  BEFORE INSERT ON core.handoff_scan
  FOR EACH ROW EXECUTE FUNCTION core.fn_handoff_scan_validity();

-- ---------------------------------------------------------------------------
-- 4. Completion effects (sections 14.2, 12.2.1 R-1) - AFTER INSERT
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_handoff_scan_effects() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_order core."order";
BEGIN
  IF NEW.validity NOT IN ('VALID', 'LATE') THEN
    RETURN NEW;   -- a rejected scan completes nothing
  END IF;

  SELECT * INTO v_order FROM core."order" WHERE id = NEW.order_id;

  IF v_order.state = 'PAYMENT_CONFIRMED' THEN
    UPDATE core."order" SET state = 'HANDED_OFF' WHERE id = NEW.order_id;
  ELSIF v_order.state = 'EXPIRED_UNCLAIMED' THEN
    -- R-1: the doorway handoff that synced after the server expired the
    -- order. It completes; stock is NEVER re-decremented - a delta-0
    -- reconciliation event records the discrepancy instead.
    -- The scan IS the clock stop on this path: the order expired with its
    -- clock running (order_clock_consistency requires NULL there), and
    -- HANDED_OFF requires it stopped. corrected_at is the honest instant.
    PERFORM set_config('adulis.transition_reason', 'LATE_SYNC_RECOVERY', true);
    UPDATE core."order"
       SET state = 'HANDED_OFF',
           clock_stopped_at = coalesce(clock_stopped_at, NEW.corrected_at)
     WHERE id = NEW.order_id;
    PERFORM set_config('adulis.transition_reason', '', true);

    INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason, order_id, reservation_id)
    SELECT gen_random_uuid(), r.variant_id, r.seller_id, 0, 'RECONCILIATION', r.order_id, r.id
      FROM core.reservation r WHERE r.order_id = NEW.order_id;

    -- Where the released stock was re-reserved by a different buyer in the
    -- interval, the platform must NOTICE: two buyers hold claims on one item
    -- and no software resolves that. That write goes to
    -- moderation_queue_item, which is migration 14's table - and plpgsql
    -- plans a static INSERT the first time the branch RUNS, not when it
    -- fires rows, so the reference cannot sit here dormant. DEFERRED-OBJECT
    -- PATTERN (as fn_create_order, 09 -> 10): migration 14 REPLACES this
    -- function with the DOUBLE_ALLOCATION queue write added.
  END IF;

  -- The confirmation tier (section 14.3): a scanned handoff is the verified
  -- tier. The recompute reads handoff_scan alone, never this table.
  INSERT INTO core.order_confirmation (id, order_id, tier, source_scan_id)
  VALUES (gen_random_uuid(), NEW.order_id, 'VERIFIED_HANDOFF', NEW.id);

  -- R16 stats: one O(1) row update.
  UPDATE core.seller_public_stats
     SET completed_handoff_count = completed_handoff_count
           + CASE WHEN NEW.counts_toward_level THEN 1 ELSE 0 END,
         updated_at = now()
   WHERE seller_id = v_order.seller_id;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_handoff_scan_effects
  AFTER INSERT ON core.handoff_scan
  FOR EACH ROW EXECUTE FUNCTION core.fn_handoff_scan_effects();

-- ---------------------------------------------------------------------------
-- 5. core.order_confirmation (section 14.3)
-- ---------------------------------------------------------------------------
CREATE TABLE core.order_confirmation (
  id             uuid PRIMARY KEY,
  order_id       uuid NOT NULL REFERENCES core."order"(id),
  tier           core.confirmation_tier NOT NULL,
  source_scan_id uuid NULL REFERENCES core.handoff_scan(id),
  confirmed_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.order_confirmation IS
  'Section 14.3. Only a SCANNED handoff counts toward trust level: the '
  'recompute filters handoff_scan.counts_toward_level and NEVER reads this '
  'table. A tapped confirmation publishes a review at medium weight and '
  'advances nothing.';

-- Completed orders feed the scan-completion denominator, O(1).
CREATE FUNCTION core.fn_stats_on_order_completed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
BEGIN
  IF NEW.state = 'COMPLETED' AND OLD.state IS DISTINCT FROM 'COMPLETED' THEN
    UPDATE core.seller_public_stats
       SET orders_completed_count = orders_completed_count + 1,
           scan_completion_rate = round(
             least(completed_handoff_count::numeric / (orders_completed_count + 1), 1), 4),
           updated_at = now()
     WHERE seller_id = NEW.seller_id;
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_stats_on_order_completed
  AFTER UPDATE OF state ON core."order"
  FOR EACH ROW EXECUTE FUNCTION core.fn_stats_on_order_completed();

-- ---------------------------------------------------------------------------
-- 6. Ownership and grants. The recompute's promised grant (0010) lands here.
-- ---------------------------------------------------------------------------
ALTER FUNCTION core.fn_handoff_scan_validity()    OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_handoff_scan_effects()     OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_stats_on_order_completed() OWNER TO adulis_migrate;

GRANT SELECT ON core.handoff_scan, core.order_qr_token, core.order_confirmation,
                core.courier_custody_transfer
  TO adulis_migrate;
GRANT INSERT ON core.order_confirmation TO adulis_migrate;
-- The transition guard and log triggers execute as the role whose UPDATE
-- fired them - here adulis_migrate, inside the scan-effects definer. The
-- guard reads the legal table; the log appends.
GRANT SELECT ON core.order_state_transition_legal TO adulis_migrate;
GRANT SELECT ON core.reservation TO adulis_migrate;  -- R-1 reads the lines it reconciles
GRANT SELECT, INSERT ON core.order_state_transition TO adulis_migrate;
-- (moderation_queue_item's grant lands with the table, migration 14 - a GRANT,
-- unlike a plpgsql reference, is not dormant.)

GRANT SELECT, INSERT ON core.handoff_scan TO adulis_app, adulis_jobs;
REVOKE UPDATE, DELETE ON core.handoff_scan FROM adulis_app, adulis_jobs;
GRANT SELECT, INSERT, UPDATE ON core.courier_custody_transfer TO adulis_app;
GRANT SELECT, INSERT ON core.order_confirmation TO adulis_app;

GRANT SELECT ON core.courier_custody_transfer, core.handoff_scan,
                core.order_confirmation
  TO adulis_readonly;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'Migration 11 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
