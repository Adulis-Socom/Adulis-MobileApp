-- ===========================================================================
-- MIGRATION 0023 - STEP-UP SINGLE USE (roll-forward) AND SELLER/ACCOUNT
--                  DELETION FUNCTIONS
--
-- Sources:
--   ADU-AUTH-01 v2.4 section 9.2  - "Uses: exactly one. Consumed by the
--                                    action it authorised."
--   ADU-DB-01  v1.10 section 18.6 - fn_deletion_blockers, fn_delete_seller,
--                                    phone_reuse_block, the S16.9 effects
--   ADU-PRD-01 v8.5  section 16.9 - the six blockers and the effects table
--   ADU-PRD-01 v8.5  section 21   - (line "Account deletion") buyers:
--                                    identity scrubbed, transactional records
--                                    retained anonymised, reviews anonymised
--                                    not deleted, active reservations released
--   ADU-AUTH-01 v2.4 section 11   - the deletion ticket: 15 minutes, scoped
--                                    to the deletion flow, never a session
--
-- Part 1 rolls forward migration 0019: fn_assert_step_up verified freshness
-- and binding but never CONSUMED the challenge, so one satisfied challenge
-- could authorise the same action repeatedly inside the freshness window.
-- Section 9.2 says one use. A consumed_at column plus a consume-on-assert
-- makes the count structural; consumption participates in the caller's
-- transaction, so an action that fails and rolls back does not burn the
-- challenge - which is the behaviour a retrying client needs.
--
-- Part 2 transcribes deletion. Two entry points, two proofs:
--   fn_delete_seller  (console)  - fn_has_permission + Owner-only + step-up
--   fn_delete_account (web 12.18) - the consumed ACCOUNT_DELETION challenge
--                                    is the proof; it never minted a session
-- Both share fn_delete_seller_effects, which is NOT app-callable: only the
-- two gatekeepers reach it.
--
-- DECIDED (recorded in the defect register):
--   - Account deletion is BLOCKED while the account, as a buyer, holds an
--     order in PAYMENT_SUBMITTED or PAYMENT_CONFIRMED. The PRD's buyer line
--     says "active reservations released" and lists no buyer blockers, but
--     releasing a reservation whose money has already moved would strand a
--     paid buyer's goods or a seller's refund against a scrubbed account.
--     S16.9's own principle - money owed blocks deletion - is applied to
--     the buyer side rather than inventing a settlement path. Amendment
--     owed to ADU-PRD-01.
--   - The scrubbed account keeps a tombstone phone (the column is NOT NULL
--     UNIQUE and is the authentication factor): '+999' plus twelve digits
--     derived from the account id. +999 is an ITU spare code; the value
--     satisfies core.e164 and frees the real number for a future account.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. Step-up challenges are single-use (ADU-AUTH-01 section 9.2)
-- ---------------------------------------------------------------------------
ALTER TABLE core.step_up_challenge ADD COLUMN consumed_at timestamptz NULL;

COMMENT ON COLUMN core.step_up_challenge.consumed_at IS
  'Section 9.2 - "Uses: exactly one." Set by fn_assert_step_up inside the '
  'transaction of the action it authorised; a rolled-back action rolls the '
  'consumption back with it.';

CREATE OR REPLACE FUNCTION core.fn_assert_step_up(
  p_challenge uuid, p_account uuid, p_action core.step_up_action
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_ch        core.step_up_challenge;
  v_freshness interval;
BEGIN
  IF p_challenge IS NULL THEN
    RAISE EXCEPTION 'step-up required' USING ERRCODE = 'U0004';
  END IF;

  -- FOR UPDATE: two concurrent actions presenting the same challenge must
  -- serialise here, so exactly one of them consumes it.
  SELECT * INTO v_ch FROM core.step_up_challenge
   WHERE id = p_challenge FOR UPDATE;
  IF NOT FOUND OR v_ch.account_id IS DISTINCT FROM p_account THEN
    RAISE EXCEPTION 'step-up required' USING ERRCODE = 'U0004';
  END IF;
  IF v_ch.satisfied_at IS NULL OR v_ch.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'step-up required' USING ERRCODE = 'U0004';
  END IF;
  IF v_ch.action IS DISTINCT FROM p_action THEN
    RAISE EXCEPTION 'step-up action mismatch' USING ERRCODE = 'U0006';
  END IF;

  SELECT tc.step_up_freshness INTO v_freshness
    FROM core.account a
    JOIN core.timing_config tc
      ON tc.market_id = a.market_id AND tc.effective @> now()
   WHERE a.id = p_account;

  -- Fail closed on absent configuration: a freshness rule that cannot be
  -- evaluated is a freshness rule that failed.
  IF v_freshness IS NULL
     OR now() > v_ch.satisfied_at + v_freshness
     OR now() > v_ch.expires_at THEN
    RAISE EXCEPTION 'step-up expired' USING ERRCODE = 'U0005';
  END IF;

  UPDATE core.step_up_challenge SET consumed_at = now() WHERE id = p_challenge;
END $fn$;

-- ---------------------------------------------------------------------------
-- 2. core.fn_deletion_blockers (ADU-DB-01 section 18.6, signature verbatim)
--
-- Six independent checks; S24 requires each testable independently, which
-- is why they are six UNIONed queries rather than one join. resolving_action
-- is a stable key the client localises - never assembled prose (S7).
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_deletion_blockers(p_seller_id uuid)
RETURNS TABLE (blocker text, count int, resolving_action text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = core AS $fn$
  SELECT * FROM (
    SELECT 'NON_TERMINAL_RESERVATIONS'::text,
           count(*)::int,
           'RESOLVE_OPEN_RESERVATIONS'::text
      FROM core.reservation r
      JOIN core."order" o ON o.id = r.order_id
     WHERE o.seller_id = p_seller_id AND r.state = 'ACTIVE'
    UNION ALL
    SELECT 'EVIDENCE_AWAITING_CONFIRMATION', count(*)::int,
           'CONFIRM_OR_REJECT_PAYMENTS'
      FROM core."order" o
     WHERE o.seller_id = p_seller_id AND o.state = 'PAYMENT_SUBMITTED'
    UNION ALL
    SELECT 'ORDERS_AWAITING_HANDOFF', count(*)::int,
           'COMPLETE_CONFIRMED_ORDERS'
      FROM core."order" o
     WHERE o.seller_id = p_seller_id AND o.state = 'PAYMENT_CONFIRMED'
    UNION ALL
    SELECT 'REFUNDS_UNRESOLVED', count(*)::int,
           'REPORT_AND_AWAIT_REFUND_ACKNOWLEDGEMENT'
      FROM core.refund f
      JOIN core.reservation r ON r.id = f.reservation_id
      JOIN core."order" o ON o.id = r.order_id
     WHERE o.seller_id = p_seller_id AND f.acknowledged_by_buyer_at IS NULL
    UNION ALL
    SELECT 'OPEN_CLAIMS', count(*)::int, 'RESOLVE_OPEN_CLAIMS'
      FROM core.claim c
      JOIN core."order" o ON o.id = c.order_id
     WHERE o.seller_id = p_seller_id AND c.state <> 'RESOLVED'
    UNION ALL
    SELECT 'SUBSCRIPTION_PAST_DUE', count(*)::int,
           'SETTLE_SUBSCRIPTION_BALANCE'
      FROM billing.subscription s
     WHERE s.seller_id = p_seller_id AND s.state = 'PAST_DUE'
  ) checks (b, c, r)
  WHERE checks.c > 0
$fn$;

-- ---------------------------------------------------------------------------
-- 3. core.fn_delete_seller_effects - the S16.9 effects table, transcribed.
--    INTERNAL: no app grant; reached only through the two gatekeepers below.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_delete_seller_effects(p_seller_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_seller    core.seller;
  v_retention interval;
BEGIN
  SELECT * INTO v_seller FROM core.seller
   WHERE id = p_seller_id FOR UPDATE;
  IF NOT FOUND OR v_seller.status = 'DELETED' THEN
    RETURN; -- idempotent: deleting a deleted seller is a no-op
  END IF;

  SELECT tc.media_retention INTO v_retention
    FROM core.timing_config tc
   WHERE tc.market_id = v_seller.market_id AND tc.effective @> now();
  IF v_retention IS NULL THEN
    -- Fail closed: a retention policy that cannot be read cannot schedule
    -- a purge, and an unscheduled purge never happens.
    RAISE EXCEPTION 'timing configuration absent for market %',
      v_seller.market_id USING ERRCODE = 'restrict_violation';
  END IF;

  -- Storefront and products: unpublished immediately... (S16.9). 'SELLER'
  -- is the enum's own-choice value; deletion is the seller's choice.
  UPDATE core.product
     SET published_at = NULL, unpublished_reason = 'SELLER'
   WHERE seller_id = p_seller_id AND published_at IS NOT NULL;

  -- ...then purged after the retention period, on the media lifecycle.
  INSERT INTO core.media_lifecycle (object_key, class, purge_after, reason)
  SELECT k.object_key, 'INFREQUENT', now() + v_retention, 'SELLER_DELETED'
    FROM core.product p
    JOIN core.product_image i ON i.product_id = p.id
    CROSS JOIN LATERAL unnest(ARRAY[i.thumb_key, i.card_key, i.full_key])
         AS k (object_key)
   WHERE p.seller_id = p_seller_id
  ON CONFLICT (object_key) DO UPDATE
     SET purge_after = EXCLUDED.purge_after, reason = EXCLUDED.reason;

  INSERT INTO core.media_lifecycle (object_key, class, purge_after, reason)
  SELECT v.key, 'INFREQUENT', now() + v_retention, 'SELLER_DELETED'
    FROM core.product p
    JOIN core.product_video v ON v.product_id = p.id
   WHERE p.seller_id = p_seller_id
  ON CONFLICT (object_key) DO UPDATE
     SET purge_after = EXCLUDED.purge_after, reason = EXCLUDED.reason;

  -- Seller identity fields: scrubbed. The handle is freed under a tombstone
  -- that stays unique per market. person_id survives - S16.9: the keyed ID
  -- hash outlives deletion or deletion becomes the way to evade
  -- duplicate-identity detection.
  UPDATE core.seller
     SET store_name  = 'Deleted store',
         handle      = 'deleted-' || replace(id::text, '-', ''),
         description = NULL,
         status      = 'DELETED',
         updated_at  = now()
   WHERE id = p_seller_id;

  UPDATE core.seller_company_detail
     SET registration_identifier = NULL,
         trade_licence_number = NULL,
         tin = NULL,
         representative_relationship = NULL,
         updated_at = now()
   WHERE seller_id = p_seller_id;

  -- Team member access revoked; their own accounts untouched.
  UPDATE core.seller_team_member SET revoked_at = now()
   WHERE seller_id = p_seller_id AND revoked_at IS NULL;

  -- Courier relationships revoked and assignments ended.
  UPDATE core.seller_courier SET revoked_at = now()
   WHERE seller_id = p_seller_id AND revoked_at IS NULL;
  UPDATE core.order_courier_assignment a SET ended_at = now()
    FROM core."order" o
   WHERE o.id = a.order_id AND o.seller_id = p_seller_id
     AND a.ended_at IS NULL;

  -- Payout details purged on the core side; the ciphertext purge is
  -- financial.purge_payout_credential, called by the API on the financial
  -- connection - core cannot reach across the boundary (section 13).
  UPDATE core.payout_details
     SET bank_code = 'PURGED', account_last4 = '0000'
   WHERE seller_id = p_seller_id;

  -- Reviews written by buyers: anonymised, never deleted (S16.9).
  UPDATE core.review
     SET buyer_account_id = NULL,
         anonymised_at = coalesce(anonymised_at, now())
   WHERE seller_id = p_seller_id AND anonymised_at IS NULL;

  -- The subscription ends by an explicit transition, never silently (S16.10);
  -- the transition trigger logs the reason from the transaction-local GUC.
  PERFORM set_config('adulis.transition_reason', 'SELLER_DELETED', true);
  UPDATE billing.subscription SET state = 'CANCELLED'
   WHERE seller_id = p_seller_id AND state <> 'CANCELLED';

  -- Everything else in the S16.9 table is retention, not action:
  -- transactional records, moderation, audit, trust and handoff history
  -- stay exactly where they are.
END $fn$;

-- ---------------------------------------------------------------------------
-- 4. core.fn_delete_seller - the console path (12.12).
--    p_phone_hash is computed BY THE API with the keyed identity hash;
--    the key never enters PostgreSQL (R15's doctrine, applied to phones).
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_delete_seller(
  p_seller_id uuid,
  p_account_id uuid,
  p_audience core.session_audience,
  p_step_up_challenge_id uuid,
  p_phone_hash bytea
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_owner   uuid;
  v_market  uuid;
  v_cooling interval;
BEGIN
  PERFORM core.fn_has_permission(
    p_account_id, p_seller_id, 'seller.account:delete', p_audience);

  SELECT owner_account_id, market_id INTO v_owner, v_market
    FROM core.seller
   WHERE id = p_seller_id AND status <> 'DELETED' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;
  -- Only the Owner may initiate deletion (S16.9). The matrix already grants
  -- seller.account:delete to OWNER alone; this re-check makes the rule
  -- survive any future matrix edit.
  IF v_owner IS DISTINCT FROM p_account_id THEN
    RAISE EXCEPTION 'deletion owner only' USING ERRCODE = 'U0001';
  END IF;

  PERFORM core.fn_assert_step_up(
    p_step_up_challenge_id, p_account_id, 'SELLER_DELETION');

  IF EXISTS (SELECT 1 FROM core.fn_deletion_blockers(p_seller_id)) THEN
    RAISE EXCEPTION 'deletion blocked' USING ERRCODE = '23001';
  END IF;

  PERFORM core.fn_delete_seller_effects(p_seller_id);

  -- The deleted number does not become immediately reusable for a new
  -- seller account (S16.9). Fail closed on absent configuration.
  SELECT tc.deleted_number_cooling_period INTO v_cooling
    FROM core.timing_config tc
   WHERE tc.market_id = v_market AND tc.effective @> now();
  IF v_cooling IS NULL THEN
    RAISE EXCEPTION 'timing configuration absent for market %', v_market
      USING ERRCODE = 'restrict_violation';
  END IF;
  INSERT INTO core.phone_reuse_block (phone_hash, market_id, blocked_until)
  VALUES (p_phone_hash, v_market, now() + v_cooling)
  ON CONFLICT (phone_hash, market_id) DO UPDATE
     SET blocked_until = greatest(core.phone_reuse_block.blocked_until,
                                  EXCLUDED.blocked_until);
END $fn$;

-- ---------------------------------------------------------------------------
-- 5. core.fn_delete_account - the web path (12.18).
--
-- The proof is the consumed ACCOUNT_DELETION challenge: verified against
-- the account's own phone, within the ticket's fifteen minutes (ADU-AUTH-01
-- section 11 - the lifetime is fixed in the document, not per-market).
-- The challenge could never have minted a session (trigger, migration 03).
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_delete_account(
  p_account_id uuid,
  p_otp_challenge_id uuid,
  p_phone_hash bytea
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
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
  UPDATE core.account_device SET revoked_at = now()
   WHERE account_id = p_account_id AND revoked_at IS NULL;

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
END $fn$;

-- ---------------------------------------------------------------------------
-- 6. financial.purge_payout_credential - the ciphertext purge (S16.9
--    "Payout details: Purged"), on the financial side of the boundary.
--    The API supplies the payout_details ids it read from core; this
--    function deletes ciphertext and nothing can read it back - the only
--    reader remains render_payment_instructions.
-- ---------------------------------------------------------------------------
CREATE FUNCTION financial.purge_payout_credential(p_details_ids uuid[])
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = financial AS $fn$
DECLARE
  v_count int;
BEGIN
  DELETE FROM financial.payout_credential
   WHERE payout_details_id = ANY (p_details_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

-- ---------------------------------------------------------------------------
-- 7. Ownership and grants. Everything definer, owned by adulis_migrate;
--    PUBLIC EXECUTE revoked everywhere (the default grant is a hole);
--    the effects function is deliberately NOT app-callable.
--
--    adulis_migrate does NOT own the tables (the bootstrap role that runs
--    migrations does), so every table a definer body touches needs an
--    explicit grant - the "grants that work until called" class this run
--    keeps finding. Enumerated per function; re-granting an existing
--    privilege is a no-op, so overlap with earlier migrations is harmless.
-- ---------------------------------------------------------------------------
-- fn_assert_step_up now consumes:
GRANT UPDATE (consumed_at) ON core.step_up_challenge TO adulis_migrate;
-- fn_deletion_blockers:
GRANT SELECT ON core.reservation, core."order", core.refund, core.claim
  TO adulis_migrate;
GRANT SELECT ON billing.subscription TO adulis_migrate;
-- fn_delete_seller_effects:
GRANT SELECT, UPDATE ON core.seller, core.seller_company_detail,
  core.seller_team_member, core.seller_courier, core.order_courier_assignment
  TO adulis_migrate;
GRANT SELECT ON core.product, core.product_image, core.product_video,
  core.timing_config TO adulis_migrate;
GRANT UPDATE (published_at, unpublished_reason) ON core.product
  TO adulis_migrate;
GRANT SELECT, INSERT, UPDATE ON core.media_lifecycle TO adulis_migrate;
GRANT UPDATE (buyer_account_id, anonymised_at) ON core.review
  TO adulis_migrate;
GRANT UPDATE (state) ON billing.subscription TO adulis_migrate;
-- fn_delete_seller / fn_delete_account:
GRANT SELECT, INSERT, UPDATE ON core.phone_reuse_block TO adulis_migrate;
GRANT SELECT, UPDATE ON core.account, core.session, core.account_device,
  core.device TO adulis_migrate;
GRANT SELECT ON core.otp_challenge TO adulis_migrate;
-- financial.purge_payout_credential: DELETE, plus column read for the
-- WHERE clause - a DELETE with a predicate needs SELECT on the columns it
-- filters by, and a bare DELETE grant fails only when called.
GRANT USAGE ON SCHEMA financial TO adulis_migrate;
GRANT DELETE ON financial.payout_credential TO adulis_migrate;
GRANT SELECT (payout_details_id) ON financial.payout_credential TO adulis_migrate;

ALTER FUNCTION core.fn_assert_step_up(uuid, uuid, core.step_up_action)
  OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_deletion_blockers(uuid) OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_delete_seller_effects(uuid) OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_delete_seller(uuid, uuid, core.session_audience, uuid, bytea)
  OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_delete_account(uuid, uuid, bytea) OWNER TO adulis_migrate;
ALTER FUNCTION financial.purge_payout_credential(uuid[]) OWNER TO adulis_migrate;

REVOKE ALL ON FUNCTION core.fn_deletion_blockers(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_delete_seller_effects(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_delete_seller(uuid, uuid, core.session_audience, uuid, bytea)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_delete_account(uuid, uuid, bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION financial.purge_payout_credential(uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION core.fn_deletion_blockers(uuid) TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_delete_seller(uuid, uuid, core.session_audience, uuid, bytea)
  TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_delete_account(uuid, uuid, bytea) TO adulis_app;
GRANT EXECUTE ON FUNCTION financial.purge_payout_credential(uuid[]) TO adulis_app;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
