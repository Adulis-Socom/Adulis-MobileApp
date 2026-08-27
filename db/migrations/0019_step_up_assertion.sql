-- ===========================================================================
-- STEP-UP ASSERTION - the challenge check every S6.5 writing path takes as
-- a PARAMETER (ADU-DB-01 S6.7, ADU-AUTH-01 S9, ADU-API-01 S6)
--
-- "Step-up travels as a function parameter, never as ambient middleware
-- state - so a code path that omits it does not compile. A middleware
-- guard is a decorator someone forgets on the seventh endpoint." The
-- documents rule the doctrine and elide the checking function (D-07's
-- family); this is its body, used by every step-up endpoint from C1's
-- identity verification onward.
--
-- Register D-23 - THREE RESERVED-BAND SQLSTATES ALLOCATED. ADU-API-01
-- S7.1a reserves U0003-U0999 "for future deliberate raises"; the step-up
-- failure modes are distinct codes in the ratified taxonomy
-- (STEP_UP_REQUIRED / STEP_UP_EXPIRED / STEP_UP_ACTION_MISMATCH), so they
-- need distinct SQLSTATEs to reach the wire distinct:
--   U0004  no challenge, unsatisfied, or another account's -> 403 STEP_UP_REQUIRED
--   U0005  satisfied but stale (step_up_freshness), or past expires_at
--                                                        -> 403 STEP_UP_EXPIRED
--   U0006  satisfied and fresh, for a DIFFERENT action    -> 403 STEP_UP_ACTION_MISMATCH
-- Recorded for ratification into S7.1a's table.
--
-- ANOTHER ACCOUNT'S CHALLENGE IS U0004, NOT U0006: telling a caller the
-- challenge they replayed belongs to someone else confirms it exists -
-- the same reasoning that makes a scope failure a 404.
--
-- Freshness beats expiry in precedence only in the sense that both are
-- U0005; the check that distinguishes REQUIRED from EXPIRED is whether
-- the caller ever satisfied this challenge.
-- ===========================================================================

-- Up Migration

CREATE FUNCTION core.fn_assert_step_up(
  p_challenge uuid,
  p_account   uuid,
  p_action    core.step_up_action
) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_ch        core.step_up_challenge;
  v_freshness interval;
BEGIN
  IF p_challenge IS NULL THEN
    RAISE EXCEPTION 'step-up required' USING ERRCODE = 'U0004';
  END IF;

  SELECT * INTO v_ch FROM core.step_up_challenge WHERE id = p_challenge;
  IF NOT FOUND OR v_ch.account_id IS DISTINCT FROM p_account THEN
    RAISE EXCEPTION 'step-up required' USING ERRCODE = 'U0004';
  END IF;
  IF v_ch.satisfied_at IS NULL THEN
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
END $fn$;

ALTER FUNCTION core.fn_assert_step_up(uuid, uuid, core.step_up_action)
  OWNER TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_assert_step_up(uuid, uuid, core.step_up_action)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.fn_assert_step_up(uuid, uuid, core.step_up_action)
  TO adulis_app;
GRANT SELECT ON core.step_up_challenge TO adulis_migrate;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
