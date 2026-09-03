-- ---------------------------------------------------------------------------
-- 0047 - WORK ORDER T18 Phase 4: the new-device payout lock does not fire on
--        a FIRST SET.
--
-- RULING (T18 S4): "The lock exists to stop an attacker redirecting payments
-- after a takeover. On a brand-new account there is nothing to redirect. If
-- core.payout_details holds no active row for that seller, the lock has no
-- subject. A change is a change; a first set is not one."
--
-- THE PREDICATE IS "HAS NEVER HAD A PAYOUT ROW", NOT "HAS NO ACTIVE ROW", and
-- the difference is the whole security of this change. The first draft of this
-- migration used state = 'ACTIVE', reading the ruling literally. The
-- adversarial pass broke it in one move:
--
--   CANCEL-THEN-SET. core.fn_cancel_payout_change (0022) requires NO step-up,
--   checks NO lock, and is deliberately easy -- "reverting must always be
--   easier than changing". So an attacker who has taken over an account, on a
--   device we have never seen, cancels the seller's legitimate PENDING first
--   set for free. That leaves no ACTIVE row and no PENDING row, an "ACTIVE"
--   carve-out then applies, and the attacker sets their own bank account
--   unlocked. Before this migration they were held for the full window.
--
--   Aggravating: activation is lazy and reader-driven. core.fn_activate_due
--   _payout is invoked from exactly ONE place in the product -- the GET on
--   /v1/seller/payout -- and no job calls it. A due PENDING therefore stays
--   PENDING, and stays cancellable, until somebody opens the payout screen.
--   The window is not 24 hours; it is "until the seller next looks".
--
-- A CANCELLED row is still a row, so "has this seller ever had payout details"
-- is the question that cannot be walked back by an attacker-controlled move.
-- A brand-new seller has never had one. Everyone else has.
--
-- GUARD ORDER IS CHANGED, DELIBERATELY, AND THIS IS THE SECOND CHANGE.
-- One-pending-per-seller now runs BEFORE the new-device lock. Without the
-- move, a seller whose only row is PENDING would be refused with a message
-- about a device we have not seen, when the true and more useful answer is
-- that they already have a change in flight. Both are refusals and neither
-- writes, so nothing is weakened by the order; the message improves.
--
-- The full order, after this migration:
--   1. step-up assertion                              UNCHANGED
--   2. timing_config, fail-closed NO_TIMING_CONFIG    UNCHANGED
--   3. recovery cooling, RECOVERY_COOLING             UNCHANGED
--   4. one-pending-per-seller                         MOVED UP (was 5)
--   5. the new-device lock, NEW_DEVICE                CARVE-OUT ADDED (was 4)
--   6. the activation delay                           UNCHANGED
--   7. the immutable payout_change_log row            UNCHANGED
--
-- WHAT IS NOT RELAXED:
--   * A seller with ANY prior payout row who changes it from a device we have
--     not seen is STILL LOCKED for the full window. That is the takeover case.
--   * The activation delay is separate and downstream (fn_activate_due_payout
--     enforces activates_at <= now()), so even an accepted first set cannot
--     receive money today. ADU-AUTH-01 v2.6 S20.1 -- "New-device payout lock
--     and normal payout activation delay stack" -- still holds for every
--     seller the lock still has a subject for.
--   * RECOVERY_COOLING runs BEFORE this guard and knows nothing about payout
--     rows, so a first set cannot be used to step around account recovery.
--   * Step-up is still required on every set, first or not.
--
-- DOCUMENT DEBT, recorded rather than assumed: ADU-AUTH-01 v2.6 S20 states the
-- new-device payout lock unconditionally, and v2.5 S-INVARIANT quantifies the
-- guarantee as "an attacker needs 48 hours". For a seller who has never had
-- payout details, it is now 24 (the activation delay alone). That narrowing is
-- a founder ruling (T18 S4) carried here as an interim ruling; the spec is
-- unreissued and the debt is registered.
--
-- The render-side twin in financial.service.ts (payoutLockState, SC-24's
-- proactive panel) is changed in the same commit and reads the same rows by
-- the same predicate. A panel that disagrees with the write path is worse than
-- no panel.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION core.fn_request_payout_change(
  p_seller    uuid,
  p_actor     uuid,
  p_bank_code text,
  p_last4     text,
  p_step_up   uuid,
  p_session   uuid,
  p_device    uuid
) RETURNS TABLE (payout_details_id uuid, activates_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_cfg        core.timing_config;
  v_prev_last4 char(4);
  v_id         uuid;
  v_activates  timestamptz;
BEGIN
  PERFORM core.fn_assert_step_up(p_step_up, p_actor, 'PAYOUT_CHANGE');

  SELECT tc.* INTO v_cfg
    FROM core.timing_config tc
    JOIN core.seller s ON s.market_id = tc.market_id
   WHERE s.id = p_seller AND tc.effective @> now();
  IF NOT FOUND THEN
    -- Fail closed: locks that cannot be evaluated are locks that hold.
    RAISE EXCEPTION 'payout locked'
      USING ERRCODE = 'U0008',
            DETAIL = '{"reason": "NO_TIMING_CONFIG"}';
  END IF;

  -- Recovery cooling (S6.6): the recovery case itself carries the lock
  -- horizon (payout_locked_until) - the schema already ruled where this
  -- fact lives, and this function reads it rather than recomputing it.
  IF EXISTS (SELECT 1 FROM core.account_recovery_case rc
              WHERE rc.account_id = p_actor
                AND rc.payout_locked_until > now()) THEN
    RAISE EXCEPTION 'payout locked'
      USING ERRCODE = 'U0008', DETAIL = '{"reason": "RECOVERY_COOLING"}';
  END IF;

  -- One pending change per seller. MOVED ABOVE the new-device lock at T18
  -- Phase 4: a seller with a change already in flight should be told that,
  -- not told about a device.
  IF EXISTS (SELECT 1 FROM core.payout_details pd
              WHERE pd.seller_id = p_seller AND pd.state = 'PENDING') THEN
    RAISE EXCEPTION 'payout change already pending'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- The new-device lock (S7.2): a device this account first saw within the
  -- lock window cannot change payout details, whatever else it may do.
  --
  -- T18 Phase 4 -- UNLESS THIS SELLER HAS NEVER HAD PAYOUT DETAILS AT ALL.
  -- The lock protects an existing destination from being redirected; with no
  -- payout row in any state there has never been a destination, and the person
  -- being refused is a brand-new seller on the only device they have ever
  -- used. ANY state counts, CANCELLED and SUPERSEDED included: a cancelled row
  -- is still evidence that this seller had a destination, and cancelling is
  -- the one move an attacker can make for free.
  IF p_device IS NOT NULL
     AND EXISTS (SELECT 1 FROM core.payout_details pd
                  WHERE pd.seller_id = p_seller)
     AND EXISTS (
       SELECT 1
        WHERE (SELECT min(s.created_at) FROM core.session s
                WHERE s.account_id = p_actor AND s.device_id = p_device)
              > now() - v_cfg.new_device_payout_lock) THEN
    RAISE EXCEPTION 'payout locked'
      USING ERRCODE = 'U0008', DETAIL = '{"reason": "NEW_DEVICE"}';
  END IF;

  SELECT pd.account_last4 INTO v_prev_last4
    FROM core.payout_details pd
   WHERE pd.seller_id = p_seller AND pd.state = 'ACTIVE';

  v_activates := now() + v_cfg.payout_activation_delay;
  INSERT INTO core.payout_details
    (id, seller_id, bank_code, account_last4, state, requested_by_account_id,
     step_up_challenge_id, activates_at)
  VALUES (gen_random_uuid(), p_seller, p_bank_code, p_last4, 'PENDING',
          p_actor, p_step_up, v_activates)
  RETURNING id INTO v_id;

  INSERT INTO core.payout_change_log
    (id, seller_id, actor_account_id, session_id, device_id,
     previous_last4, new_last4, outcome)
  VALUES (gen_random_uuid(), p_seller, p_actor, p_session, p_device,
          v_prev_last4, p_last4, 'REQUESTED');

  RETURN QUERY SELECT v_id, v_activates;
END $fn$;

-- 0022 set OWNER TO adulis_migrate and granted EXECUTE to adulis_app on this
-- signature. CREATE OR REPLACE preserves both, so neither is reissued here.
