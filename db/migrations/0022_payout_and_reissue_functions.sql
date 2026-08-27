-- ===========================================================================
-- C4's FUNCTION LAYER - the payout write path and single-order reissue
--
-- Sources: ADU-DB-01 v1.10 S10.4/S13 (the write attack is defeated on the
-- WRITE path: step-up, activation delay, unsuppressible notification,
-- immutable log, order snapshot - none of it depends on the value being
-- encrypted at rest, and the credential ciphertext still never sits in
-- core), S8.5 (reissue: a single NAMED order, never bulk - no function in
-- this file accepts an array and none ever will), S7.2 (the new-device
-- payout lock), S6.6 (recovery cooling).
--
-- Register D-28: U0008 -> 409 PAYOUT_CHANGE_PENDING and the
-- PAYOUT_LOCKED_RECOVERY code carrying BOTH lock reasons (recovery cooling
-- and the new-device lock) distinguished by a typed slot - the closed
-- taxonomy names one payout-lock code, and a lock is a lock; the reason
-- travels as data.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. The credential writer - D-16's argument, payout side: a boundary with
--    readers and no writer forces app table grants in financial.
-- ---------------------------------------------------------------------------
CREATE FUNCTION financial.write_payout_credential(
  p_details_id uuid,
  p_account_ct bytea,
  p_name_ct    bytea,
  p_key_ref    text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = financial AS $fn$
BEGIN
  INSERT INTO financial.payout_credential
    (payout_details_id, account_ciphertext, account_name_ciphertext, encryption_key_ref)
  VALUES (p_details_id, p_account_ct, p_name_ct, p_key_ref)
  ON CONFLICT (payout_details_id) DO UPDATE SET
    account_ciphertext = EXCLUDED.account_ciphertext,
    account_name_ciphertext = EXCLUDED.account_name_ciphertext,
    encryption_key_ref = EXCLUDED.encryption_key_ref;
END $fn$;

ALTER FUNCTION financial.write_payout_credential(uuid, bytea, bytea, text)
  OWNER TO adulis_financial;
REVOKE ALL ON FUNCTION financial.write_payout_credential(uuid, bytea, bytea, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION financial.write_payout_credential(uuid, bytea, bytea, text)
  TO adulis_app;

-- ---------------------------------------------------------------------------
-- 2. fn_request_payout_change - every S10.4 control on the write path,
--    in order: step-up, the two locks, one-pending-per-seller, the delay,
--    the immutable log.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_request_payout_change(
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

  -- The new-device lock (S7.2): a device this account first saw within the
  -- lock window cannot change payout details, whatever else it may do.
  IF p_device IS NOT NULL AND EXISTS (
       SELECT 1
        WHERE (SELECT min(s.created_at) FROM core.session s
                WHERE s.account_id = p_actor AND s.device_id = p_device)
              > now() - v_cfg.new_device_payout_lock) THEN
    RAISE EXCEPTION 'payout locked'
      USING ERRCODE = 'U0008', DETAIL = '{"reason": "NEW_DEVICE"}';
  END IF;

  IF EXISTS (SELECT 1 FROM core.payout_details pd
              WHERE pd.seller_id = p_seller AND pd.state = 'PENDING') THEN
    RAISE EXCEPTION 'payout change already pending'
      USING ERRCODE = 'restrict_violation';
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

-- ---------------------------------------------------------------------------
-- 3. Cancelling a pending change requires NO step-up (S10.4): reverting
--    must always be easier than changing.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_cancel_payout_change(p_seller uuid, p_actor uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_pd core.payout_details;
BEGIN
  SELECT * INTO v_pd FROM core.payout_details
   WHERE seller_id = p_seller AND state = 'PENDING'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;
  UPDATE core.payout_details SET state = 'CANCELLED' WHERE id = v_pd.id;
  INSERT INTO core.payout_change_log
    (id, seller_id, actor_account_id, previous_last4, new_last4, outcome)
  VALUES (gen_random_uuid(), p_seller, p_actor, v_pd.account_last4,
          v_pd.account_last4, 'CANCELLED');
END $fn$;

-- ---------------------------------------------------------------------------
-- 4. Activation, idempotent, for the worker's sweep AND lazy invocation:
--    a due PENDING becomes ACTIVE, the prior ACTIVE is SUPERSEDED, the log
--    records it. Runs per seller so a wedged row cannot stall the fleet.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_activate_due_payout(p_seller uuid)
RETURNS boolean  -- true when an activation happened
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_pd core.payout_details;
BEGIN
  SELECT * INTO v_pd FROM core.payout_details
   WHERE seller_id = p_seller AND state = 'PENDING' AND activates_at <= now()
   ORDER BY requested_at ASC LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE core.payout_details SET state = 'SUPERSEDED'
   WHERE seller_id = p_seller AND state = 'ACTIVE';
  UPDATE core.payout_details SET state = 'ACTIVE', activated_at = now()
   WHERE id = v_pd.id;
  INSERT INTO core.payout_change_log
    (id, seller_id, actor_account_id, previous_last4, new_last4, outcome)
  VALUES (gen_random_uuid(), p_seller, v_pd.requested_by_account_id,
          NULL, v_pd.account_last4, 'ACTIVATED');
  RETURN true;
END $fn$;

-- ---------------------------------------------------------------------------
-- 5. Reissue - ONE named order (S8.5; there is no bulk path and this
--    signature cannot express one). A fresh snapshot from the CURRENT
--    active payout replaces the order's, the append-only record links
--    both, and the buyer is renotified by the caller's flow.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_reissue_instructions(
  p_order uuid, p_seller uuid, p_actor uuid, p_step_up uuid
) RETURNS uuid  -- the new snapshot id
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_order core."order";
  v_pd    core.payout_details;
  v_snap  uuid;
BEGIN
  PERFORM core.fn_assert_step_up(p_step_up, p_actor, 'REISSUE_INSTRUCTIONS');

  SELECT * INTO v_order FROM core."order"
   WHERE id = p_order AND seller_id = p_seller
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;
  IF v_order.state NOT IN ('CREATED', 'NOTIFIED', 'PAYMENT_SUBMITTED') THEN
    RAISE EXCEPTION 'order is not payable'
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT * INTO v_pd FROM core.payout_details
   WHERE seller_id = p_seller AND state = 'ACTIVE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active payout details'
      USING ERRCODE = 'restrict_violation';
  END IF;

  INSERT INTO core.order_payout_snapshot
    (id, seller_id, payout_details_id, bank_code, account_last4)
  VALUES (gen_random_uuid(), p_seller, v_pd.id, v_pd.bank_code, v_pd.account_last4)
  RETURNING id INTO v_snap;

  INSERT INTO core.payment_instruction_reissue
    (id, order_id, previous_snapshot_id, new_snapshot_id, actor_account_id,
     step_up_challenge_id)
  VALUES (gen_random_uuid(), p_order, v_order.payout_snapshot_id, v_snap,
          p_actor, p_step_up);

  UPDATE core."order" SET payout_snapshot_id = v_snap WHERE id = p_order;
  RETURN v_snap;
END $fn$;

-- ---------------------------------------------------------------------------
-- 6. Ownership and grants
-- ---------------------------------------------------------------------------
ALTER FUNCTION core.fn_request_payout_change(uuid, uuid, text, text, uuid, uuid, uuid)
  OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_cancel_payout_change(uuid, uuid)  OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_activate_due_payout(uuid)         OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_reissue_instructions(uuid, uuid, uuid, uuid)
  OWNER TO adulis_migrate;

REVOKE ALL ON FUNCTION core.fn_request_payout_change(uuid, uuid, text, text, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_cancel_payout_change(uuid, uuid)  FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_activate_due_payout(uuid)         FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_reissue_instructions(uuid, uuid, uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION core.fn_request_payout_change(uuid, uuid, text, text, uuid, uuid, uuid)
  TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_cancel_payout_change(uuid, uuid) TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_activate_due_payout(uuid)        TO adulis_app, adulis_jobs;
GRANT EXECUTE ON FUNCTION core.fn_reissue_instructions(uuid, uuid, uuid, uuid)
  TO adulis_app;

GRANT SELECT, INSERT, UPDATE ON core.payout_details TO adulis_migrate;
GRANT SELECT, INSERT ON core.payout_change_log TO adulis_migrate;
GRANT SELECT, INSERT ON core.payment_instruction_reissue TO adulis_migrate;
GRANT SELECT ON core.account_recovery_case TO adulis_migrate;
GRANT UPDATE (payout_snapshot_id) ON core."order" TO adulis_migrate;

-- ---------------------------------------------------------------------------
-- ROLL-FORWARD of the courier SELECT policy (0011, merged - never edited).
-- The document's verbatim expression casts current_setting('adulis.
-- account_id') straight to uuid; a custom GUC's post-transaction default is
-- the EMPTY STRING on any pooled connection that has ever set it, and
-- PostgreSQL does not guarantee OR short-circuit inside a policy - so a
-- buyer-context read could die on ''::uuid (22P02) depending on the plan.
-- Register D-29: nullif() makes the cast total; the policy's meaning is
-- unchanged (an unset/empty account matches no assignment - fail closed).
-- ---------------------------------------------------------------------------
ALTER POLICY courier_assigned_orders ON core."order"
  USING (
    current_setting('adulis.actor_role', true) <> 'COURIER'
    OR EXISTS (
      SELECT 1 FROM core.order_courier_assignment a
       WHERE a.order_id = "order".id
         AND a.courier_account_id =
             nullif(current_setting('adulis.account_id', true), '')::uuid
         AND a.ended_at IS NULL));

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
