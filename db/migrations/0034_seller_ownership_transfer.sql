-- 0034 -- G1.6: ownership transfer gets a policy, a pending record, and an
--         activation that does four things in one transaction.
--
-- ADU-API-01 v1.7 S12.12 (G1.6)  -  ADU-AUTH-01 v2.5 S16.5
-- AMENDMENT A1 to ADU-RUL-01, A1.1 and A1.2.  -  WORK ORDER T6-B S1.
--
-- THE POLICY, as ADU-API-01 v1.7 S12.12 prints it:
--   Who may receive  : "An account holding an active ADMIN membership on that
--                       seller. Not an arbitrary phone number -- the recipient
--                       must already be known to the store"
--   Notice           : "Both parties notified unsuppressibly. Activation after
--                       24 hours, cancellable by the outgoing owner throughout"
--   Blocked while    : "A payout change is pending, or a claim is open"
--   Rationale        : "The 24-hour delay is the design, not a formality ... a
--                       compromised Owner session cannot hand the store away
--                       before anyone notices, and the unsuppressible notice is
--                       what makes the delay useful rather than merely slow."
--
-- ------------------------------------------------------------------------
-- WHAT A1 CHANGES, AND IT IS NOT A DETAIL.
--
-- A1.2 withdraws "the outgoing owner keeps an ADMIN membership". They keep
-- NOTHING by default. They may NOMINATE a residual role at request time, from
-- any role EXCEPT ADMIN -- "excluded for exactly one reason: it holds payout".
-- S12.12's own two sentences were incompatible under the shipped matrix: it
-- promised the outgoing owner an ADMIN membership AND that "payout access ends
-- at activation", and ADMIN holds seller.payout:read and seller.payout:update
-- (verified: OWNER minus ADMIN is exactly seller.account:delete and
-- seller.ownership:transfer). There is no per-member grant column, so there is
-- no ADMIN-minus-payout to hand out. A1.2 resolves it by removing the promise,
-- not the permission.
--
-- A1.2 also fixes WHEN: the membership is created AT ACTIVATION, in the same
-- transaction as the owner flip. Creating it at request time would give the
-- outgoing owner a second standing during the 24 hours, on top of ownership.
--
-- A1.1 withdraws v1.12 S30 E6's foreign-key warning. Enumerated: 29 FKs
-- reference core.seller, 28 on (id) and one on (id, entity_type); ZERO on
-- (id, owner_account_id), and confupdtype is 'a' (NO ACTION) on all 29 -- in
-- fact NO ON UPDATE action exists anywhere in this database. UPDATE
-- core.seller SET owner_account_id will not raise on FK grounds on any row.
-- The real risk A1.1 names instead is that EIGHT functions resolve authority
-- from owner_account_id, so the flip takes effect everywhere at once and
-- immediately: "a live session held by the outgoing owner across the
-- activation boundary must lose those capabilities on its next request, with
-- no re-authentication." That is asserted in the tests.
--
-- NO NEW ENUM. Appendix C check 16 compares enum names AND values against
-- db/checks/fixtures/appendix-a.json, a transcription of ADU-DB-01 Appendix A.
-- The state here is three timestamps: PENDING is activated_at IS NULL AND
-- cancelled_at IS NULL. Same shape as billing.purchase_intent (0033), and the
-- same reason.
--
-- Register D-70: Appendix B owes this table's row; no document gives ownership
-- transfer a pending record, though ADU-DB-01 v1.12 names the function three
-- times (:195, :990, :1022) and prints no signature for it anywhere.
-- ------------------------------------------------------------------------

CREATE TABLE core.seller_ownership_transfer (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id               uuid NOT NULL REFERENCES core.seller(id),
  from_account_id         uuid NOT NULL REFERENCES core.account(id),
  to_account_id           uuid NOT NULL REFERENCES core.account(id),
  -- A1.2. NULL is the default and the common case: the outgoing owner keeps
  -- nothing. Nominated AT REQUEST TIME, created AT ACTIVATION.
  residual_role           core.team_role NULL,
  step_up_challenge_id    uuid NOT NULL REFERENCES core.step_up_challenge(id),
  requested_at            timestamptz NOT NULL DEFAULT now(),
  activates_at            timestamptz NOT NULL,
  activated_at            timestamptz NULL,
  cancelled_at            timestamptz NULL,
  cancelled_by_account_id uuid NULL REFERENCES core.account(id),
  cancel_reason           text NULL,

  -- A1.2's exclusion, as a constraint rather than as a code path: ADMIN is
  -- excluded "for exactly one reason: it holds payout", and OWNER cannot be a
  -- membership at all (team_member_is_never_owner). A residual role that
  -- reached activation and then failed the CHECK would fail it INSIDE the
  -- transaction that had already moved the store.
  CONSTRAINT residual_role_is_never_admin CHECK (
    residual_role IS NULL OR residual_role NOT IN ('ADMIN', 'OWNER')),
  CONSTRAINT ownership_transfer_one_terminal CHECK (
    num_nonnulls(activated_at, cancelled_at) <= 1),
  CONSTRAINT ownership_transfer_cancel_shape CHECK (
    (cancelled_at IS NULL) = (cancelled_by_account_id IS NULL)),
  CONSTRAINT ownership_transfer_two_parties CHECK (
    from_account_id <> to_account_id)
);

-- One pending transfer per seller. Two racing requests would otherwise both
-- activate, and the second would move the store to an account the first had
-- already taken it from.
CREATE UNIQUE INDEX ownership_transfer_one_pending
  ON core.seller_ownership_transfer (seller_id)
  WHERE activated_at IS NULL AND cancelled_at IS NULL;

COMMENT ON TABLE core.seller_ownership_transfer IS
  'ADU-API-01 v1.7 S12.12 (G1.6) with AMENDMENT A1.2. The 24-hour delay is '
  'the design: a compromised Owner session cannot hand the store away before '
  'anyone notices. EITHER PARTY may cancel throughout - the recipient DECLINES '
  '- because a person notified of something they cannot refuse has been '
  'informed, not consulted.';

-- ===========================================================================
-- The blocking conditions, in one place so request and activation cannot
-- drift. "Blocked while: a payout change is pending, or a claim is open."
-- ===========================================================================
CREATE FUNCTION core.fn_ownership_transfer_blockers(p_seller uuid)
RETURNS TABLE (blocker text, count int, resolving_action text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = core AS $fn$
  SELECT * FROM (
    SELECT 'PAYOUT_CHANGE_PENDING'::text, count(*)::int,
           'AWAIT_OR_CANCEL_PAYOUT_CHANGE'::text
      FROM core.payout_details pd
     WHERE pd.seller_id = p_seller AND pd.state = 'PENDING'
    UNION ALL
    SELECT 'OPEN_CLAIMS', count(*)::int, 'RESOLVE_OPEN_CLAIMS'
      FROM core.claim c
      JOIN core."order" o ON o.id = c.order_id
     WHERE o.seller_id = p_seller AND c.state <> 'RESOLVED'
  ) checks (b, c, r)
  WHERE checks.c > 0
$fn$;

COMMENT ON FUNCTION core.fn_ownership_transfer_blockers IS
  'G1.6. Read TWICE - at request and again at activation - because 24 hours '
  'is long enough for a claim to open, and a store must not change hands '
  'while somebody is disputing an order against the outgoing owner. Shaped '
  'like fn_deletion_blockers so every blocker names its clearing action and '
  'items[] can carry all of them.';

-- ===========================================================================
-- 1. Requesting
-- ===========================================================================
--
-- THE RECIPIENT IS NAMED BY MEMBERSHIP, NOT BY ACCOUNT. "Not an arbitrary
-- phone number -- the recipient must already be known to the store", and a
-- membership id is the only identifier that CANNOT name a stranger. It is
-- also what the console actually holds: GET /v1/seller/team returns
-- seller_team_member.id and deliberately does not return account ids.
CREATE FUNCTION core.fn_request_ownership_transfer(
  p_seller        uuid,
  p_actor         uuid,
  p_audience      core.session_audience,
  p_to_member     uuid,
  p_residual_role core.team_role,
  p_step_up       uuid
) RETURNS TABLE (transfer_id uuid, activates_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_owner      uuid;
  v_to_account uuid;
  v_blockers   jsonb;
  v_activates  timestamptz;
  v_id         uuid;
BEGIN
  PERFORM core.fn_has_permission(p_actor, p_seller,
                                 'seller.ownership:transfer', p_audience);
  PERFORM core.fn_assert_step_up(p_step_up, p_actor, 'OWNERSHIP_TRANSFER');

  SELECT s.owner_account_id INTO v_owner FROM core.seller s WHERE s.id = p_seller;
  -- fn_has_permission's Owner arm is core.seller.owner_account_id and only
  -- that, and seller.ownership:transfer is granted to OWNER alone - so this
  -- can only fail if the matrix is widened, which is why it is here.
  IF v_owner IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'U0001';
  END IF;

  -- "An account holding an ACTIVE ADMIN membership on that seller. Not an
  -- arbitrary phone number." Suspended counts as not active (R28): a
  -- suspended Admin has lost every permission on their next request, and
  -- handing them the store would restore all of them at once.
  SELECT tm.account_id INTO v_to_account
    FROM core.seller_team_member tm
   WHERE tm.id = p_to_member
     AND tm.seller_id = p_seller
     AND tm.role = 'ADMIN'
     AND tm.revoked_at IS NULL
     AND tm.suspended_at IS NULL;
  IF v_to_account IS NULL THEN
    -- 422 NAMING THE REASON AND THE REMEDY (T6-B S1.4). Not a 404: the
    -- recipient is an account the OWNER named, and the owner may see their
    -- own team. The remedy is a real route - invite them, promote them to
    -- Admin, come back - so the refusal is actionable rather than final.
    RAISE EXCEPTION 'ownership transfer needs an active admin'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF p_residual_role IS NOT NULL AND p_residual_role IN ('ADMIN', 'OWNER') THEN
    RAISE EXCEPTION 'residual role may not be admin'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM core.seller_ownership_transfer t
              WHERE t.seller_id = p_seller
                AND t.activated_at IS NULL AND t.cancelled_at IS NULL) THEN
    RAISE EXCEPTION 'ownership transfer already pending'
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('code', b.blocker, 'count', b.count,
                                      'resolving_action', b.resolving_action))
    INTO v_blockers
    FROM core.fn_ownership_transfer_blockers(p_seller) b;
  IF v_blockers IS NOT NULL THEN
    RAISE EXCEPTION 'ownership transfer blocked'
      USING ERRCODE = 'restrict_violation', DETAIL = v_blockers::text;
  END IF;

  -- TWENTY-FOUR HOURS, as the ruling prints it, and NOT
  -- timing_config.payout_activation_delay. The two are equal today and they
  -- are not the same decision: the payout delay is a per-market configurable
  -- and this is a flat rule in ADU-API-01. Registered (D-71) so that if a
  -- market ever wants its own, the column is added deliberately rather than
  -- discovered by a reader who assumed the coupling.
  v_activates := now() + interval '24 hours';

  INSERT INTO core.seller_ownership_transfer
    (id, seller_id, from_account_id, to_account_id, residual_role,
     step_up_challenge_id, activates_at)
  VALUES (gen_random_uuid(), p_seller, p_actor, v_to_account, p_residual_role,
          p_step_up, v_activates)
  RETURNING id INTO v_id;

  PERFORM core.fn_notify_ownership_transfer(v_id, 'OWNERSHIP_TRANSFER_REQUESTED');

  RETURN QUERY SELECT v_id, v_activates;
END $fn$;

-- ===========================================================================
-- 2. The notice. BOTH PARTIES, UNSUPPRESSIBLY.
-- ===========================================================================
--
-- "The unsuppressible notice is what makes the delay useful rather than
-- merely slow." A delay nobody is told about is not a control, it is a wait.
-- suppressible = false is refused by the preference endpoint (12.14) AND
-- again by the sender (e2-notification's claim), so this cannot be turned off
-- by either party.
CREATE FUNCTION core.fn_notify_ownership_transfer(p_transfer uuid, p_template text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_t core.seller_ownership_transfer; v_locale text;
BEGIN
  SELECT * INTO v_t FROM core.seller_ownership_transfer WHERE id = p_transfer;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT m.default_locale INTO v_locale
    FROM core.seller s JOIN core.market m ON m.id = s.market_id
   WHERE s.id = v_t.seller_id;

  INSERT INTO core.notification
    (recipient_account_id, channel, template_key, locale, slots, suppressible)
  SELECT r.account_id, 'SMS', p_template, v_locale,
         jsonb_build_object('seller_id', v_t.seller_id,
                            'transfer_id', v_t.id,
                            'activates_at', v_t.activates_at),
         false
    FROM (SELECT v_t.from_account_id AS account_id
          UNION
          SELECT v_t.to_account_id) r;
END $fn$;

-- ===========================================================================
-- 3. Cancelling -- and EITHER PARTY MAY DO IT.
-- ===========================================================================
--
-- T6-B S1.2: "A person who is notified of something they cannot refuse has
-- been informed, not consulted." S12.12 says "cancellable by the outgoing
-- owner throughout" and stops there; the recipient's side is the DECLINE, and
-- it is the same row and the same act.
--
-- ITS GATE IS THIS FUNCTION'S OWN DERIVATION, NOT fn_has_permission.
-- seller.ownership:transfer is granted to OWNER alone, so the recipient -- an
-- Admin -- could never pass it, and widening the matrix to let them would hand
-- Admins the power to START a transfer. The party test is the authority: you
-- may cancel a transfer you are a party to, and nothing else.
--
-- NO STEP-UP, following fn_cancel_payout_change: reverting must always be
-- easier than changing.
CREATE FUNCTION core.fn_cancel_ownership_transfer(
  p_seller uuid, p_actor uuid, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_t core.seller_ownership_transfer;
BEGIN
  SELECT * INTO v_t FROM core.seller_ownership_transfer
   WHERE seller_id = p_seller AND activated_at IS NULL AND cancelled_at IS NULL
   FOR UPDATE;
  -- No pending transfer, or the actor is not a party to it: both are scope
  -- failures. A stranger must not learn that a transfer exists (S19/S21).
  IF NOT FOUND OR p_actor NOT IN (v_t.from_account_id, v_t.to_account_id) THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;

  UPDATE core.seller_ownership_transfer
     SET cancelled_at = now(), cancelled_by_account_id = p_actor,
         cancel_reason = coalesce(
           p_reason,
           CASE WHEN p_actor = v_t.to_account_id THEN 'DECLINED' ELSE 'CANCELLED' END)
   WHERE id = v_t.id;

  PERFORM core.fn_notify_ownership_transfer(v_t.id, 'OWNERSHIP_TRANSFER_CANCELLED');
  RETURN v_t.id;
END $fn$;

-- ===========================================================================
-- 4. Activation: ONE TRANSACTION, FOUR THINGS.
-- ===========================================================================
--
-- Idempotent and per seller, exactly like core.fn_activate_due_payout, so a
-- wedged row cannot stall anything and a double call is a no-op.
--
-- IT NEVER RAISES FOR AN ORDINARY OUTCOME, and that is load-bearing: it is
-- invoked from HandlerTransaction on every seller-scoped request, so a raise
-- here would 500 every call on that store. A transfer that cannot proceed is
-- CANCELLED and both parties are told; the function returns false.
CREATE FUNCTION core.fn_activate_due_ownership_transfer(p_seller uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_t core.seller_ownership_transfer;
BEGIN
  SELECT * INTO v_t FROM core.seller_ownership_transfer
   WHERE seller_id = p_seller
     AND activated_at IS NULL AND cancelled_at IS NULL
     AND activates_at <= now()
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- T6-B S1.3 -- RE-CHECKED HERE, not only at request. Twenty-four hours is
  -- long enough for a claim to open or a payout change to be requested, and
  -- a store must not change hands while either stands. If it does, the
  -- transfer is CANCELLED rather than postponed: a pending transfer that
  -- silently waits is a transfer nobody is watching any more.
  IF EXISTS (SELECT 1 FROM core.fn_ownership_transfer_blockers(p_seller)) THEN
    UPDATE core.seller_ownership_transfer
       SET cancelled_at = now(),
           cancelled_by_account_id = v_t.from_account_id,
           cancel_reason = 'BLOCKED_AT_ACTIVATION'
     WHERE id = v_t.id;
    PERFORM core.fn_notify_ownership_transfer(v_t.id, 'OWNERSHIP_TRANSFER_CANCELLED');
    RETURN false;
  END IF;

  -- (a) THE RECIPIENT'S ADMIN MEMBERSHIP GOES FIRST. This is the step that
  --     will be missed. The Owner is core.seller.owner_account_id and ONLY
  --     that (A1.3), and core.seller_team_member NEVER holds the Owner --
  --     team_member_is_never_owner is a CHECK, so the naive shape (promote
  --     the recipient's row to OWNER) raises, and the merely-untidy shape
  --     (leave the ADMIN row alongside) leaves the new Owner holding a
  --     membership the invariant says cannot exist.
  UPDATE core.seller_team_member
     SET revoked_at = now()
   WHERE seller_id = v_t.seller_id
     AND account_id = v_t.to_account_id
     AND revoked_at IS NULL;

  -- (b) THE STORE MOVES. Eight functions resolve authority from this column,
  --     so this single UPDATE is the whole capability change: the outgoing
  --     owner's live session loses OWNER on its next request with no
  --     re-authentication, because nothing anywhere cached the answer.
  UPDATE core.seller SET owner_account_id = v_t.to_account_id, updated_at = now()
   WHERE id = v_t.seller_id;

  -- (c) THE RESIDUAL MEMBERSHIP, if one was nominated, IN THIS TRANSACTION
  --     (A1.2). Default is nothing at all. The revoke first is not
  --     defensive noise: seller_team_member_live is unique on
  --     (seller_id, account_id) WHERE revoked_at IS NULL, and an outgoing
  --     owner who somehow holds a live row would collide.
  IF v_t.residual_role IS NOT NULL THEN
    UPDATE core.seller_team_member SET revoked_at = now()
     WHERE seller_id = v_t.seller_id
       AND account_id = v_t.from_account_id
       AND revoked_at IS NULL;
    INSERT INTO core.seller_team_member
      (id, seller_id, account_id, role, invited_by)
    VALUES (gen_random_uuid(), v_t.seller_id, v_t.from_account_id,
            v_t.residual_role, v_t.to_account_id);
  END IF;

  UPDATE core.seller_ownership_transfer SET activated_at = now() WHERE id = v_t.id;

  -- (d) BOTH PARTIES TOLD, unsuppressibly, in the same transaction. If this
  --     rolled back separately the store would have moved silently.
  PERFORM core.fn_notify_ownership_transfer(v_t.id, 'OWNERSHIP_TRANSFER_ACTIVATED');
  RETURN true;
END $fn$;

-- ===========================================================================
-- THE DEFINER DISCIPLINE (S4.4a): own it, revoke PUBLIC, grant by name.
-- ===========================================================================
ALTER FUNCTION core.fn_ownership_transfer_blockers(uuid)          OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_notify_ownership_transfer(uuid, text)      OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_request_ownership_transfer(
  uuid, uuid, core.session_audience, uuid, core.team_role, uuid)  OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_cancel_ownership_transfer(uuid, uuid, text) OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_activate_due_ownership_transfer(uuid)      OWNER TO adulis_migrate;

REVOKE ALL ON FUNCTION core.fn_ownership_transfer_blockers(uuid)          FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_notify_ownership_transfer(uuid, text)      FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_request_ownership_transfer(
  uuid, uuid, core.session_audience, uuid, core.team_role, uuid)          FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_cancel_ownership_transfer(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_activate_due_ownership_transfer(uuid)      FROM PUBLIC;

GRANT EXECUTE ON FUNCTION core.fn_ownership_transfer_blockers(uuid) TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_request_ownership_transfer(
  uuid, uuid, core.session_audience, uuid, core.team_role, uuid)    TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_cancel_ownership_transfer(uuid, uuid, text) TO adulis_app;
-- adulis_jobs as well, so a future sweep can activate without a reader --
-- the same pair core.fn_activate_due_payout was granted to in 0022.
GRANT EXECUTE ON FUNCTION core.fn_activate_due_ownership_transfer(uuid)
  TO adulis_app, adulis_jobs;
-- fn_notify_ownership_transfer is an internal step of the other three and is
-- granted to nobody: a caller who can send an unsuppressible SMS to two named
-- accounts by transfer id needs no store relationship at all to do it.

-- The API reads its own pending row; every write is a named function.
GRANT SELECT ON core.seller_ownership_transfer TO adulis_app;

-- What the definer needs. core.seller SELECT/UPDATE and core.notification
-- INSERT it already holds (0005, 0016:779); these are the rest.
GRANT SELECT, INSERT, UPDATE ON core.seller_ownership_transfer TO adulis_migrate;
GRANT SELECT, INSERT, UPDATE ON core.seller_team_member        TO adulis_migrate;
GRANT SELECT ON core.payout_details TO adulis_migrate;
GRANT SELECT ON core.claim          TO adulis_migrate;
GRANT SELECT ON core.market         TO adulis_migrate;
