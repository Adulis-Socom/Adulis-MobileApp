-- ===========================================================================
-- C3's FUNCTION LAYER - payment decisions, line cancellation, receipt
-- confirmation, refunds, and the buyer-cancellation cooldown
--
-- Sources: ADU-DB-01 v1.10 S12 (ratified transition set; the guards do the
-- refusing), S12.6 (one QR token per order, existing only from
-- confirmation - R20), S14.3 (the tapped tier), S12.5/S10.5 (refunds:
-- seller reports, buyer acknowledges, never inferred), ADU-PRD-01 S9.5
-- (cancellation penalties), W6 (the two-rejection payment flow).
--
-- Register D-26 (in this file's commit): the reserved band grows U0007 ->
-- 409 BUYER_COOLDOWN_ACTIVE, the same device as D-23's step-up trio.
--
-- EVERY state change here rides the migration-09 guards: these functions
-- never bypass a transition the legal tables do not hold, and a bug in one
-- raises rather than producing wrong data.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. Payment confirmation - "Confirm Payment Received", never "Accept
--    Payment": the seller verified in their own bank first (S10.1); the
--    platform records the decision it was told.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_confirm_payment(p_order uuid, p_seller uuid, p_actor uuid)
RETURNS uuid  -- the QR token id, minted here and only here (R20)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_order core."order";
  v_sub   core.payment_submission;
  v_token uuid;
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

  UPDATE core."order"
     SET state = 'PAYMENT_CONFIRMED', clock_stopped_at = now()
   WHERE id = p_order;

  IF v_sub.id IS NOT NULL THEN
    UPDATE core.payment_submission
       SET state = 'CONFIRMED', decided_by_account_id = p_actor, decided_at = now()
     WHERE id = v_sub.id;
  END IF;

  -- One token per order, existing only from this moment: a QR issued
  -- before confirmation is a code that completes an order nobody has paid
  -- for (R20). Idempotent under the UNIQUE (a replayed confirm cannot
  -- reach here - the state gate above already answered it).
  INSERT INTO core.order_qr_token (id, order_id, nonce, signing_key_version)
  VALUES (gen_random_uuid(), p_order, gen_random_uuid(), 1)
  RETURNING id INTO v_token;
  RETURN v_token;
END $fn$;

-- ---------------------------------------------------------------------------
-- 2. Payment rejection - "Payment Not Received" (W6, ratification row 8).
--    The FIRST rejection returns the order to NOTIFIED and shortens its
--    life to a 12-hour retry window - expressed as expires_at, so the
--    EXISTING expiry sweep enforces the window and no second clock is
--    invented. The SECOND ends the order: every line cancelled seller-side,
--    the derive trigger writes CANCELLED_BY_SELLER.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_reject_payment(
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
    INSERT INTO core.stock_event
      (id, variant_id, seller_id, delta, reason, order_id, reservation_id)
    VALUES (gen_random_uuid(), r.variant_id, r.seller_id, r.quantity,
            'LINE_CANCELLED', p_order, r.id);
  END LOOP;
  RETURN 'ORDER_ENDED';
END $fn$;

-- ---------------------------------------------------------------------------
-- 3. Line cancellation - one function, both actors, the guards deciding
--    which target state is legal. Surfaced to the seller as "Can't Fulfil";
--    THERE IS NO ACCEPT ACTION - reservations are never gated on the
--    seller, and this file deliberately contains nothing resembling one.
--
--    A buyer cancellation feeds the S9.5 counters: 3 consecutive with one
--    seller -> a same-seller cooldown; a pattern across sellers -> the
--    escalating cross-seller ladder. Cancelling actively is penalised
--    less than letting an order expire - the counter is the lighter touch.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_cancel_line(
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

  -- The A3.2-anchored release: stock returns exactly once per line.
  INSERT INTO core.stock_event
    (id, variant_id, seller_id, delta, reason, order_id, reservation_id)
  VALUES (gen_random_uuid(), v_res.variant_id, v_res.seller_id, v_res.quantity,
          'LINE_CANCELLED', p_order, p_reservation);

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

-- ---------------------------------------------------------------------------
-- 4. fn_create_order gains the cooldown gate - ROLL-FORWARD of the merged
--    0012 body (never edited). The gate is the FIRST evidence read: a
--    buyer inside a cooldown places no hold on anyone's stock.
--    U0007 -> 409 BUYER_COOLDOWN_ACTIVE, the until-timestamp in DETAIL.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_assert_no_cooldown(p_buyer uuid, p_seller uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_until timestamptz;
BEGIN
  SELECT max(cooldown_until) INTO v_until
    FROM core.buyer_cancellation_counter
   WHERE buyer_account_id = p_buyer
     AND (seller_id = p_seller OR seller_id IS NULL)
     AND cooldown_until > now();
  IF v_until IS NOT NULL THEN
    RAISE EXCEPTION 'buyer cooldown active'
      USING ERRCODE = 'U0007',
            DETAIL = json_build_object('until', to_char(v_until,
              'YYYY-MM-DD"T"HH24:MI:SS"Z"'))::text;
  END IF;
END $fn$;

-- ---------------------------------------------------------------------------
-- 5. The tapped tier (S14.3): the buyer's "I received it" - completes the
--    order at MEDIUM weight, advances NO level (the recompute reads
--    handoff_scan alone and this writes none).
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_confirm_receipt(p_order uuid, p_buyer uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_order core."order";
BEGIN
  SELECT * INTO v_order FROM core."order"
   WHERE id = p_order AND buyer_account_id = p_buyer
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;
  IF v_order.state = 'HANDED_OFF' THEN
    RETURN;  -- idempotent: the tap after the scan changes nothing
  END IF;

  PERFORM set_config('adulis.transition_reason', 'CONFIRMED_BY_BUYER', true);
  UPDATE core."order" SET state = 'HANDED_OFF' WHERE id = p_order;
  PERFORM set_config('adulis.transition_reason', '', true);

  INSERT INTO core.order_confirmation (id, order_id, tier, source_scan_id)
  VALUES (gen_random_uuid(), p_order, 'CONFIRMED_BY_BUYER', NULL);
END $fn$;

-- ---------------------------------------------------------------------------
-- 6. Refunds: the seller REPORTS (a fact about their bank), the buyer
--    ACKNOWLEDGES (an explicit action, never inferred - S10.5).
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_report_refund(
  p_order uuid, p_reservation uuid, p_seller uuid,
  p_amount_minor bigint, p_currency text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_res core.reservation;
  v_id  uuid;
BEGIN
  SELECT r.* INTO v_res
    FROM core.reservation r
    JOIN core."order" o ON o.id = r.order_id
   WHERE r.id = p_reservation AND r.order_id = p_order
     AND o.seller_id = p_seller;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;
  IF v_res.state <> 'REFUNDED' THEN
    RAISE EXCEPTION 'line is not in a refundable state (%)', v_res.state
      USING ERRCODE = 'restrict_violation';
  END IF;

  INSERT INTO core.refund
    (id, reservation_id, amount_minor, amount_currency, reported_by_seller_at)
  VALUES (gen_random_uuid(), p_reservation, p_amount_minor, p_currency, now())
  RETURNING id INTO v_id;
  RETURN v_id;
END $fn$;

CREATE FUNCTION core.fn_acknowledge_refund(p_refund uuid, p_buyer uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_ok int;
BEGIN
  UPDATE core.refund rf
     SET acknowledged_by_buyer_at = coalesce(rf.acknowledged_by_buyer_at, now())
    FROM core.reservation r
    JOIN core."order" o ON o.id = r.order_id
   WHERE rf.id = p_refund AND r.id = rf.reservation_id
     AND o.buyer_account_id = p_buyer;
  GET DIAGNOSTICS v_ok = ROW_COUNT;
  IF v_ok = 0 THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;
END $fn$;

-- ---------------------------------------------------------------------------
-- 7. A completed order resets the buyer's same-seller consecutive counter -
--    "3 CONSECUTIVE" means a clean completion breaks the streak.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_reset_cancellation_streak() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
BEGIN
  IF NEW.state = 'COMPLETED' AND OLD.state IS DISTINCT FROM 'COMPLETED' THEN
    UPDATE core.buyer_cancellation_counter
       SET count = 0
     WHERE buyer_account_id = NEW.buyer_account_id
       AND seller_id = NEW.seller_id;
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_reset_cancellation_streak
  AFTER UPDATE OF state ON core."order"
  FOR EACH ROW EXECUTE FUNCTION core.fn_reset_cancellation_streak();

-- ---------------------------------------------------------------------------
-- 8. Ownership and grants
-- ---------------------------------------------------------------------------
ALTER FUNCTION core.fn_confirm_payment(uuid, uuid, uuid)              OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_reject_payment(uuid, uuid, uuid, text)         OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_cancel_line(uuid, uuid, uuid, boolean)         OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_assert_no_cooldown(uuid, uuid)                 OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_confirm_receipt(uuid, uuid)                    OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_report_refund(uuid, uuid, uuid, bigint, text)  OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_acknowledge_refund(uuid, uuid)                 OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_reset_cancellation_streak()                    OWNER TO adulis_migrate;

REVOKE ALL ON FUNCTION core.fn_confirm_payment(uuid, uuid, uuid)             FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_reject_payment(uuid, uuid, uuid, text)        FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_cancel_line(uuid, uuid, uuid, boolean)        FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_assert_no_cooldown(uuid, uuid)                FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_confirm_receipt(uuid, uuid)                   FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_report_refund(uuid, uuid, uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_acknowledge_refund(uuid, uuid)                FROM PUBLIC;

GRANT EXECUTE ON FUNCTION core.fn_confirm_payment(uuid, uuid, uuid)             TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_reject_payment(uuid, uuid, uuid, text)        TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_cancel_line(uuid, uuid, uuid, boolean)        TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_assert_no_cooldown(uuid, uuid)                TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_confirm_receipt(uuid, uuid)                   TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_report_refund(uuid, uuid, uuid, bigint, text) TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_acknowledge_refund(uuid, uuid)                TO adulis_app;

-- the definer bodies' table needs
GRANT SELECT, UPDATE ON core.payment_submission TO adulis_migrate;
-- the reservation guard fires as the definer's role and reads its legal
-- table - the order-side twin got this grant in 0013; the reservation side
-- was the run's recurring grant class, found by smoke once more
GRANT SELECT ON core.reservation_state_transition_legal TO adulis_migrate;
GRANT SELECT, INSERT, UPDATE ON core.buyer_cancellation_counter TO adulis_migrate;
GRANT UPDATE ON core.reservation TO adulis_migrate;
GRANT SELECT, INSERT, UPDATE ON core.refund TO adulis_migrate;
GRANT INSERT ON core.order_qr_token TO adulis_migrate;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
