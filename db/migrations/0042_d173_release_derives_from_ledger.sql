-- ---------------------------------------------------------------------------
-- 0042: D-173 -- the release derives from the reserving stock_event.
--
-- WORK ORDER T12 S1's RULING, verbatim in effect: "the release derives its
-- quantity from the reserving stock_event, not from the reservation row. If
-- no ORDER_CREATED event exists for that reservation, the release returns
-- nothing and the order fails loudly."
--
-- WHY. T11 Phase 6 (register D-173) found that nothing enforces the
-- reservation/stock-event pairing -- it exists only inside fn_create_order.
-- A reservation arriving by any other path (a fixture did it; a repair
-- script or partial restore could) then RELEASES STOCK THAT WAS NEVER
-- TAKEN on cancellation or expiry. Two things make that worse than it
-- sounds: CHECK (stock_count >= 0) holds throughout, so the invented stock
-- is silently correct-looking inventory; and A3.2's release idempotency is
-- keyed (reservation_id, reason), which prevents releasing TWICE and says
-- nothing about releasing something never reserved.
--
-- THE SHAPE OF THE FIX: deriving quantity -- and variant and seller -- from
-- the reserving event means the reservation row and its event CANNOT
-- disagree. "A constraint enforcing agreement between two numbers is weaker
-- than having one number."
--
-- WHAT THIS MIGRATION DOES NOT DO: the deferred constraint trigger that
-- would prevent the bad state EXISTING is parked pending a measurement
-- against the A1 S6.1 300-concurrent-orders load test (T12 S1). Until then
-- db:reset's stock_drift pin converts silent divergence into loud.
--
-- Roll-forward of 0021 (a migration is never edited after merge): the two
-- release sites there are re-created below with their bodies UNCHANGED
-- except the release block; the third site, the expiry sweep, is
-- TypeScript (jobs/e1-clock.ts) and changes in the same commit.
-- ---------------------------------------------------------------------------

CREATE FUNCTION core.fn_release_reservation_stock(
  p_reservation uuid, p_order uuid, p_reason core.stock_event_reason
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_variant uuid;
  v_seller  uuid;
  v_qty     int;
BEGIN
  -- STRICT does the enforcement: zero reserving events -> NO_DATA_FOUND ->
  -- the loud failure the ruling demands, with the reservation named; a
  -- GROUP BY yielding more than one row -> TOO_MANY_ROWS -> a reserving
  -- ledger spanning variants or sellers, which is corrupt and also refuses.
  -- sum() rather than a bare -delta so a double-reserved ledger (nothing
  -- structural prevents one -- that is D-173's parked half) releases what
  -- was actually taken rather than half of it.
  SELECT e.variant_id, e.seller_id, sum(-e.delta)
    INTO STRICT v_variant, v_seller, v_qty
    FROM core.stock_event e
   WHERE e.reservation_id = p_reservation AND e.reason = 'ORDER_CREATED'
   GROUP BY e.variant_id, e.seller_id;

  -- The A3.2 anchor is unchanged: (reservation_id, reason) stays unique, so
  -- a second release of the same reservation still refuses on the index.
  INSERT INTO core.stock_event
    (id, variant_id, seller_id, delta, reason, order_id, reservation_id)
  VALUES (gen_random_uuid(), v_variant, v_seller, v_qty, p_reason, p_order,
          p_reservation);
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION
      'reservation % has no ORDER_CREATED stock event; refusing to release stock that was never taken (D-173)',
      p_reservation;
  WHEN TOO_MANY_ROWS THEN
    RAISE EXCEPTION
      'reservation % carries reserving events for more than one variant or seller; the ledger is corrupt (D-173)',
      p_reservation;
END $fn$;

-- ---------------------------------------------------------------------------
-- fn_reject_payment, body verbatim from 0021 except the release block.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.fn_reject_payment(
  p_order uuid, p_seller uuid, p_actor uuid, p_reason text
) RETURNS text  -- 'RETRY_WINDOW_OPEN' or 'ORDER_ENDED'
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_order      core."order";
  v_sub        core.payment_submission;
  v_rejections int;
  r            record;
BEGIN
  SELECT * INTO v_order FROM core."order"
   WHERE id = p_order AND seller_id = p_seller
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;
  IF v_order.state <> 'PAYMENT_SUBMITTED' THEN
    RAISE EXCEPTION 'payment already decided (%)', v_order.state
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT * INTO v_sub FROM core.payment_submission
   WHERE order_id = p_order AND state = 'SUBMITTED'
   ORDER BY submitted_at DESC LIMIT 1;
  IF v_sub.id IS NOT NULL THEN
    UPDATE core.payment_submission
       SET state = 'REJECTED', decided_by_account_id = p_actor,
           decided_at = now(), rejection_reason = p_reason
     WHERE id = v_sub.id;
  END IF;

  SELECT count(*) INTO v_rejections FROM core.payment_submission
   WHERE order_id = p_order AND state = 'REJECTED';

  IF v_rejections <= 1 THEN
    PERFORM set_config('adulis.transition_reason', 'PAYMENT_REJECTED_RETRY', true);
    UPDATE core."order"
       SET state = 'NOTIFIED',
           expires_at = least(expires_at, now() + interval '12 hours')
     WHERE id = p_order;
    PERFORM set_config('adulis.transition_reason', '', true);
    RETURN 'RETRY_WINDOW_OPEN';
  END IF;

  -- Second rejection: the order ends, seller-caused, with the stock
  -- released line by line - the same release path any cancellation takes.
  FOR r IN SELECT * FROM core.reservation
            WHERE order_id = p_order AND state = 'ACTIVE' LOOP
    UPDATE core.reservation
       SET state = 'CANCELLED_BY_SELLER', cancelled_at = now(), cancelled_by = 'SELLER'
     WHERE id = r.id;
    -- T12 S1 RULING (D-173): quantity, variant and seller all derive from
    -- the reserving event. See fn_release_reservation_stock's header.
    PERFORM core.fn_release_reservation_stock(r.id, p_order, 'LINE_CANCELLED');
  END LOOP;
  RETURN 'ORDER_ENDED';
END $fn$;

-- ---------------------------------------------------------------------------
-- fn_cancel_line, body verbatim from 0021 except the release block.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.fn_cancel_line(
  p_order uuid, p_reservation uuid, p_actor uuid, p_as_seller boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_order core."order";
  v_res   core.reservation;
  v_cfg   core.timing_config;
  v_cnt   core.buyer_cancellation_counter;
  v_cross core.buyer_cancellation_counter;
  v_step  int;
BEGIN
  SELECT * INTO v_order FROM core."order" WHERE id = p_order FOR UPDATE;
  IF NOT FOUND
     OR (p_as_seller AND v_order.seller_id <> (SELECT s.id FROM core.seller s
            WHERE s.id = v_order.seller_id
              AND (s.owner_account_id = p_actor OR EXISTS (
                    SELECT 1 FROM core.seller_team_member tm
                     WHERE tm.seller_id = s.id AND tm.account_id = p_actor
                       AND tm.revoked_at IS NULL AND tm.suspended_at IS NULL))))
     OR (NOT p_as_seller AND v_order.buyer_account_id <> p_actor) THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;

  SELECT * INTO v_res FROM core.reservation
   WHERE id = p_reservation AND order_id = p_order;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;
  IF v_res.state <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Illegal reservation transition % -> CANCELLED', v_res.state
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF p_as_seller AND v_order.state = 'PAYMENT_CONFIRMED' THEN
    -- After payment the seller's cancellation is a REFUND (S12.5); the
    -- refund money-trail rows follow through fn_report_refund.
    UPDATE core.reservation
       SET state = 'REFUNDED', cancelled_at = now(), cancelled_by = 'SELLER'
     WHERE id = p_reservation;
  ELSE
    UPDATE core.reservation
       SET state = CASE WHEN p_as_seller
                        THEN 'CANCELLED_BY_SELLER'::core.reservation_state
                        ELSE 'CANCELLED_BY_BUYER'::core.reservation_state END,
           cancelled_at = now(),
           cancelled_by = CASE WHEN p_as_seller THEN 'SELLER'::core.cancelled_by
                               ELSE 'BUYER'::core.cancelled_by END
     WHERE id = p_reservation;
  END IF;

  -- The A3.2-anchored release: stock returns exactly once per line, and
  -- since T12 S1 (D-173) the quantity DERIVES FROM THE RESERVING EVENT --
  -- a reservation with no ORDER_CREATED event fails loudly instead of
  -- releasing stock that was never taken.
  PERFORM core.fn_release_reservation_stock(p_reservation, p_order, 'LINE_CANCELLED');

  IF NOT p_as_seller THEN
    SELECT tc.* INTO v_cfg FROM core.timing_config tc
     WHERE tc.market_id = v_order.market_id AND tc.effective @> now();
    IF FOUND THEN
      -- Same-seller counter: consecutive within the decay window.
      -- Decay: 30 days of clean activity resets the streak; otherwise it
      -- grows. One expression, evaluated once, on both columns.
      INSERT INTO core.buyer_cancellation_counter
        (id, buyer_account_id, seller_id, count, window_start)
      VALUES (gen_random_uuid(), p_actor, v_order.seller_id, 1, now())
      ON CONFLICT (buyer_account_id, seller_id) WHERE seller_id IS NOT NULL
      DO UPDATE SET
        count = CASE WHEN core.buyer_cancellation_counter.window_start
                          < now() - v_cfg.cancellation_counter_decay
                     THEN 1
                     ELSE core.buyer_cancellation_counter.count + 1 END,
        window_start = CASE WHEN core.buyer_cancellation_counter.window_start
                                 < now() - v_cfg.cancellation_counter_decay
                            THEN now()
                            ELSE core.buyer_cancellation_counter.window_start END
      RETURNING * INTO v_cnt;

      IF v_cnt.count >= v_cfg.same_seller_cancellation_threshold THEN
        UPDATE core.buyer_cancellation_counter
           SET cooldown_until = now() + v_cfg.same_seller_cooldown, count = 0
         WHERE id = v_cnt.id;

        -- The cross-seller ladder: each same-seller cooldown escalates the
        -- global rung; the last value repeats (S5.4's column note).
        INSERT INTO core.buyer_cancellation_counter
          (id, buyer_account_id, seller_id, count, window_start)
        VALUES (gen_random_uuid(), p_actor, NULL, 1, now())
        ON CONFLICT (buyer_account_id) WHERE seller_id IS NULL
        DO UPDATE SET count = core.buyer_cancellation_counter.count + 1
        RETURNING * INTO v_cross;

        IF v_cross.count >= 2 THEN
          v_step := least(v_cross.count - 1,
                          array_length(v_cfg.cross_seller_cooldown_ladder, 1));
          UPDATE core.buyer_cancellation_counter
             SET cooldown_until = now() + v_cfg.cross_seller_cooldown_ladder[v_step]
           WHERE id = v_cross.id;
        END IF;
      END IF;
    END IF;
  END IF;
END $fn$;

-- Ownership and grants, exactly as 0021 holds them for the pair; the helper
-- adds adulis_jobs because the expiry sweep runs on the jobs role.
ALTER FUNCTION core.fn_release_reservation_stock(uuid, uuid, core.stock_event_reason) OWNER TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_release_reservation_stock(uuid, uuid, core.stock_event_reason) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.fn_release_reservation_stock(uuid, uuid, core.stock_event_reason) TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_release_reservation_stock(uuid, uuid, core.stock_event_reason) TO adulis_jobs;
