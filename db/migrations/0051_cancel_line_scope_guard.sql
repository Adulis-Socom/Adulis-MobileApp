-- ============================================================================
-- 0051 -- fn_cancel_line's scope guard was defeated by three-valued logic
--         (WORK ORDER T26 Phase 1; register D-325)
--
-- THE DEFECT. The seller arm read:
--
--   OR (p_as_seller AND v_order.seller_id <> (SELECT s.id FROM core.seller s
--          WHERE s.id = v_order.seller_id AND (owner OR live member)))
--
-- For an actor with NO relationship to the order's seller the subquery
-- returns no row, so it evaluates to NULL; `seller_id <> NULL` is NULL;
-- `true AND NULL` is NULL; and `IF (NULL) THEN RAISE` does not fire. The
-- function then proceeded and COMMITTED: T25's refuter cancelled seller B's
-- order line as seller A's owner over HTTP and got a 200, with B's
-- reservation and order left CANCELLED_BY_SELLER and the stock event
-- written. A committed cross-tenant destructive write.
--
-- WHY EVERY SIBLING HELD. fn_confirm_payment, fn_reject_payment,
-- fn_mark_order_ready, fn_report_refund and fn_publish_product all use
-- `SELECT ... WHERE id = p_target AND seller_id = p_seller; IF NOT FOUND
-- THEN RAISE U0002` -- a positive test whose failure mode is a missing row,
-- not a NULL. This one function compared against a subquery instead, and an
-- inequality against a subquery is the grep for the whole class.
--
-- THE FIX IS THE SIBLINGS' SHAPE, restructured so each arm is two-valued and
-- raises unless a relationship is positively found. The buyer arm gets
-- `IS DISTINCT FROM` for the same reason, closing the NULL-actor twin
-- before anybody finds it.
--
-- NOT A SIGNATURE CHANGE. CREATE OR REPLACE preserves the owner and the
-- grants from 0021, and the two in-database callers -- core.fn_delete_account
-- (0023, superseded by 0038) -- keep the four-argument function they call.
-- The body below is 0042's byte for byte except the guard block.
--
-- WHAT THIS MIGRATION DOES NOT DO. It does not bind the cancellation to the
-- ACTIVE seller (X-Adulis-Seller): the function has no p_seller parameter and
-- adding one would drop and recreate a signature two merged migrations call.
-- An actor who is a live member of two sellers could therefore satisfy this
-- guard for either of them. That binding is the handler's, and T26 Phase 1
-- adds it to orders.service.ts `cancelLineAsSeller` alongside this change --
-- ownership resolved against req.ctx.sellerId BEFORE the function is called.
-- ============================================================================

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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;

  -- THE SCOPE GUARD, AS THE SIBLINGS HAVE IT (D-325). Three arms, each of
  -- them TWO-VALUED and each of them raising unless a relationship was
  -- POSITIVELY established. Nothing below compares a value against a
  -- subquery that can be NULL: that is what the old guard did, and for an
  -- actor with no relationship to this order's seller the subquery returned
  -- NULL, `seller_id <> NULL` was NULL, `true AND NULL` was NULL, and
  -- `IF (NULL)` does not fire -- so the function proceeded and committed.
  IF p_as_seller IS NULL THEN
    -- Fail closed on an undetermined arm rather than falling into one.
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  ELSIF p_as_seller THEN
    IF NOT EXISTS (
         SELECT 1 FROM core.seller s
          WHERE s.id = v_order.seller_id
            AND (s.owner_account_id = p_actor
                 OR EXISTS (SELECT 1 FROM core.seller_team_member tm
                             WHERE tm.seller_id = s.id AND tm.account_id = p_actor
                               AND tm.revoked_at IS NULL
                               AND tm.suspended_at IS NULL))) THEN
      RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
    END IF;
  ELSE
    -- IS DISTINCT FROM, not <>. buyer_account_id is NOT NULL so the old
    -- comparison was total on the column's side, but a NULL p_actor made
    -- the whole expression NULL and the buyer arm would have fallen through
    -- exactly as the seller arm did. Closed here for the same one word.
    IF v_order.buyer_account_id IS DISTINCT FROM p_actor THEN
      RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
    END IF;
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
