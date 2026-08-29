-- 0038 -- D-64's residual: sessions die with the account, and the
--         remembered-device rows die WITH them rather than outliving them.
--
-- ADU-RUL-02 via WORK ORDER T7 S3.4 (document text owed -- register D-84).
--
-- WHAT WAS ALREADY TRUE: fn_delete_account has revoked every session since
-- 0023 (the ruling's first half was in force). WHAT WAS NOT: account_device
-- rows were only STAMPED revoked -- the row, its token_hash, and the
-- device binding survived the scrub. This migration replaces the stamp with
-- a DELETE, unhooking core.session.account_device_id first.
--
-- METHOD (D-62, the standing rule): the body below is EXTRACTED from the
-- live database with pg_get_functiondef and patched at exactly one site --
-- never retyped. The signature is identical, so CREATE OR REPLACE preserves
-- the function object, its owner and its grants; all three are re-asserted
-- below anyway, per 0023's own doctrine, because a re-grant is a documented
-- no-op and a missing one is a hole.

CREATE OR REPLACE FUNCTION core.fn_delete_account(p_account_id uuid, p_otp_challenge_id uuid, p_phone_hash bytea)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core'
AS $function$
DECLARE
  v_account core.account;
  v_seller  record;
  v_res     record;
  v_money   int;
  v_cooling interval;
BEGIN
  SELECT * INTO v_account FROM core.account
   WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND OR v_account.status = 'SCRUBBED' THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;

  -- The ticket: a consumed deletion challenge for THIS phone, still fresh.
  IF NOT EXISTS (
    SELECT 1 FROM core.otp_challenge c
     WHERE c.id = p_otp_challenge_id
       AND c.purpose = 'ACCOUNT_DELETION'
       AND c.phone_e164 = v_account.phone_e164
       AND c.consumed_at IS NOT NULL
       AND c.consumed_at > now() - interval '15 minutes'
  ) THEN
    RAISE EXCEPTION 'deletion ticket invalid' USING ERRCODE = 'U0001';
  END IF;

  -- Owned sellers: each must clear its S16.9 blockers, then each is deleted
  -- with the full effects, including its phone-reuse block.
  FOR v_seller IN
    SELECT id, market_id FROM core.seller
     WHERE owner_account_id = p_account_id AND status <> 'DELETED'
  LOOP
    IF EXISTS (SELECT 1 FROM core.fn_deletion_blockers(v_seller.id)) THEN
      RAISE EXCEPTION 'deletion blocked' USING ERRCODE = '23001';
    END IF;
  END LOOP;

  -- Buyer-side money gate (DECIDED, see header): an order whose payment is
  -- submitted or confirmed cannot be settled against a scrubbed account.
  SELECT count(*)::int INTO v_money
    FROM core."order" o
   WHERE o.buyer_account_id = p_account_id
     AND o.state IN ('PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED');
  IF v_money > 0 THEN
    RAISE EXCEPTION 'deletion blocked' USING ERRCODE = '23001';
  END IF;

  FOR v_seller IN
    SELECT id, market_id FROM core.seller
     WHERE owner_account_id = p_account_id AND status <> 'DELETED'
  LOOP
    PERFORM core.fn_delete_seller_effects(v_seller.id);
    SELECT tc.deleted_number_cooling_period INTO v_cooling
      FROM core.timing_config tc
     WHERE tc.market_id = v_seller.market_id AND tc.effective @> now();
    IF v_cooling IS NULL THEN
      RAISE EXCEPTION 'timing configuration absent for market %',
        v_seller.market_id USING ERRCODE = 'restrict_violation';
    END IF;
    INSERT INTO core.phone_reuse_block (phone_hash, market_id, blocked_until)
    VALUES (p_phone_hash, v_seller.market_id, now() + v_cooling)
    ON CONFLICT (phone_hash, market_id) DO UPDATE
       SET blocked_until = greatest(core.phone_reuse_block.blocked_until,
                                    EXCLUDED.blocked_until);
  END LOOP;

  -- Active reservations released (PRD section 21): the buyer-cancel path,
  -- reused, so the stock release, the order transition and the counters all
  -- happen exactly as they do for an ordinary cancellation. Only pre-payment
  -- orders reach here - the money gate above excluded the rest.
  FOR v_res IN
    SELECT r.id AS reservation_id, r.order_id
      FROM core.reservation r
      JOIN core."order" o ON o.id = r.order_id
     WHERE o.buyer_account_id = p_account_id AND r.state = 'ACTIVE'
       AND o.state IN ('CREATED', 'NOTIFIED')
  LOOP
    PERFORM core.fn_cancel_line(
      v_res.order_id, v_res.reservation_id, p_account_id, false);
  END LOOP;

  -- Sessions die with the status flip: authentication reads account status
  -- on every request and refuses anything but ACTIVE. Explicit revocation
  -- as well, so the sessions surface shows the truth immediately.
  UPDATE core.session SET revoked_at = now()
   WHERE account_id = p_account_id AND revoked_at IS NULL;
  -- T7 S3.4 (ADU-RUL-02 via D-64's residual): account_device rows are
  -- REMOVED, not stamped. A remembered-device row is a standing credential
  -- for an identity that no longer exists -- worse than the wedge D-64
  -- fixed, because that failed loudly in a log and this outlives its
  -- account silently. The session FK is unhooked first:
  -- core.session.account_device_id references these rows with NO ON DELETE
  -- action, and revoked session rows are retained, so a bare DELETE would
  -- raise 23503 for any account that ever remembered a CONSOLE device.
  -- Filtered by the REFERENCING column, not session.account_id -- the
  -- constraint does not guarantee the referencing session belongs to this
  -- account.
  UPDATE core.session SET account_device_id = NULL
   WHERE account_device_id IN (SELECT ad.id FROM core.account_device ad
                                WHERE ad.account_id = p_account_id);
  DELETE FROM core.account_device WHERE account_id = p_account_id;

  -- Reviews this account wrote: anonymised, never deleted.
  UPDATE core.review
     SET buyer_account_id = NULL,
         anonymised_at = coalesce(anonymised_at, now())
   WHERE buyer_account_id = p_account_id;

  -- Identity scrubbed. The tombstone phone (header) satisfies core.e164,
  -- stays unique, and frees the real number. person survives (section 6.2).
  UPDATE core.account
     SET phone_e164 = '+999' || lpad(
           ((('x' || substr(replace(id::text, '-', ''), 1, 12))::bit(48)::bigint)
            % 1000000000000)::text, 12, '0'),
         status = 'SCRUBBED',
         scrubbed_at = now(),
         age_declared_over_18 = NULL,
         age_declared_at = NULL
   WHERE id = p_account_id;

  -- Devices: unbound, so the purge in section 11 treats them as anonymous.
  UPDATE core.device SET account_id = NULL, push_token = NULL
   WHERE account_id = p_account_id;
END $function$;

-- The one grant the patched body newly needs. adulis_migrate (the definer)
-- holds SELECT + UPDATE on core.account_device (0023:493-494) and no
-- DELETE anywhere -- without this line everything works until the first
-- real deletion of an account that remembered a device, which then 42501s
-- at runtime. The exact failure class 0023's header names.
GRANT DELETE ON core.account_device TO adulis_migrate;

-- Definer discipline, re-asserted (S4.4a; no-ops where already true):
ALTER FUNCTION core.fn_delete_account(uuid, uuid, bytea) OWNER TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_delete_account(uuid, uuid, bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.fn_delete_account(uuid, uuid, bytea) TO adulis_app;
