-- ============================================================================
-- 0052 -- fn_cancel_ownership_transfer's guard has fn_cancel_line's NULL hole
--         (WORK ORDER T26 Phase 1, refutation pass; register D-362)
--
-- 0051 closed D-325 and its header claimed to be closing "the NULL-actor twin
-- before anybody finds it". It closed that twin INSIDE fn_cancel_line and
-- asserted, from a grep for `<> (SELECT`, that fn_cancel_line was the only
-- member of the class. The grep was right about its own spelling and too
-- narrow about the class: an adversarial pass over every `IF NOT FOUND OR`
-- guard in db/migrations found one more, spelled `NOT IN` instead.
--
--   IF NOT FOUND OR p_actor NOT IN (v_t.from_account_id, v_t.to_account_id)
--
-- from_account_id and to_account_id are NOT NULL, so the LIST side is total.
-- A NULL p_actor is not: `NULL NOT IN (a, b)` is NULL, `false OR NULL` is
-- NULL, `IF (NULL)` does not fire, and the function cancels a transfer for an
-- actor it never identified.
--
-- LATENT, NOT LIVE, and the difference is worth stating rather than leaning
-- on. p_actor is `req.ctx?.accountId` on an authenticated route, and the
-- request pipeline refuses before a handler runs without one -- so no HTTP
-- path reaches this with NULL today. It is fixed because it is one word, and
-- because "no caller passes NULL" is a property of every call site rather than
-- of the guard, and guards are what survive a new call site.
--
-- THE FIX IS THE SAME ONE 0051 APPLIED: two-valued comparisons that cannot
-- evaluate to NULL. IS DISTINCT FROM, twice, rather than NOT IN.
--
-- CREATE OR REPLACE preserves the owner and the 0034 grants; the body is
-- 0034's byte for byte except the guard line.
-- ============================================================================

CREATE OR REPLACE FUNCTION core.fn_cancel_ownership_transfer(
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
  IF NOT FOUND
     OR (p_actor IS DISTINCT FROM v_t.from_account_id
         AND p_actor IS DISTINCT FROM v_t.to_account_id) THEN
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
