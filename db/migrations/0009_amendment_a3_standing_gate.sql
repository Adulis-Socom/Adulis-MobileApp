-- ===========================================================================
-- AMENDMENT A3.3 - THE STANDING GATE RAISES U0001, NOT U0002
--
-- Source: AMENDMENT A3 to ADU-DB-01 v1.10, ruling A3.3. Supersedes the body
-- printed at v1.10 section 6.9a.
--
-- WHY THIS IS A NEW MIGRATION RATHER THAN AN EDIT TO 05a.
--
-- A3.6 says "apply A3.3 in migration 05a, before merge". Migration 05a HAS
-- MERGED - work order T2 Task B directed it, and PRs #1, #2 and #3 put
-- migrations 01-06 on main in the previous session. The standing rule is that a
-- migration is never edited after it has merged, and ADU-CON-02 section 19's
-- doctrine is roll forward. Editing 0005 in place would also mean any database
-- already carrying it never receives the fix, because node-pg-migrate would not
-- re-run a migration it has recorded.
--
-- So the ruling lands as CREATE OR REPLACE FUNCTION here. The signature is
-- identical, so every call site, grant and dependency is unaffected.
--
-- ---------------------------------------------------------------------------
-- WHAT A3.3 CHANGES, AND WHY IT IS THE ONE THAT MATTERED
--
-- A1.3's body folded the standing check into the ROLE LOOKUP, so a suspended
-- member matched no row, fell through to step 3 and raised U0002 -> 404.
-- ADU-AUTH-01 v2.4 section 14 lists Standing as raising U0001 -> 403. The
-- previous session shipped the enforcement and reported the contradiction
-- rather than reconciling it silently; A3.3 rules the enforcement wrong.
--
--   "The principle the 404 rests on is DO NOT CONFIRM EXISTENCE TO SOMEONE WITH
--    NO BUSINESS KNOWING. It exists to defeat enumeration by strangers. A
--    suspended Admin is not a stranger - they worked there, they know the store
--    exists, and telling them it does not is not protecting a secret. It is a
--    lie that produces a support ticket and looks like a bug."
--
-- So the boundary is "DID YOU EVER HAVE STANDING", not "do you have it now":
--
--   never a member                        -> U0002 -> 404
--   ever a member, not in good standing   -> U0001 -> 403
--   in good standing, role or surface bad -> U0001 -> 403
--
-- The residual leak is that a caller can learn their own suspension status,
-- which they are entitled to know.
--
-- R28 IS UNAFFECTED AND STILL HOLDS. A suspended member still loses every
-- permission on the next request. Only the code changes, and with it the HTTP
-- status the seller sees.
-- ===========================================================================

-- Up Migration

CREATE OR REPLACE FUNCTION core.fn_has_permission(
  p_account uuid, p_seller uuid, p_permission text, p_audience core.session_audience
) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_role     core.team_role;
        v_standing boolean := false;
BEGIN
  -- 1. Owner first. The Owner is core.seller.owner_account_id and nothing else,
  --    and there is no suspended_at on core.seller: Owner-level suspension is
  --    seller.status, which is gate 0 and belongs to the calling function.
  SELECT true, 'OWNER'::core.team_role INTO v_standing, v_role
    FROM core.seller s
   WHERE s.id = p_seller AND s.owner_account_id = p_account;

  -- 2. Otherwise resolve the membership REGARDLESS of standing, so that a
  --    suspended or revoked member is distinguishable from a stranger.
  IF v_role IS NULL THEN
    SELECT (tm.suspended_at IS NULL AND tm.revoked_at IS NULL), tm.role
      INTO v_standing, v_role
      FROM core.seller_team_member tm
     WHERE tm.seller_id = p_seller AND tm.account_id = p_account
     -- THE ORDER BY IS THIS MIGRATION'S, NOT THE AMENDMENT'S, and without it
     -- this lookup is non-deterministic. seller_team_member_live is UNIQUE on
     -- (seller_id, account_id) only WHERE revoked_at IS NULL, so a member who
     -- was revoked and later re-invited has SEVERAL rows - one live, one or
     -- more revoked. A bare SELECT INTO takes an arbitrary one, so a member in
     -- good standing could be denied because the planner returned their old
     -- revoked row. Preferring the row in good standing is the reading that
     -- matches A3.3's own boundary: a live membership is the current fact, and
     -- a revoked one is history. Reported for v1.11.
     ORDER BY (tm.suspended_at IS NULL AND tm.revoked_at IS NULL) DESC,
              tm.created_at DESC
     LIMIT 1;
  END IF;

  -- 3. Never held a relationship. A scope failure, and it must not be reported
  --    as a permission failure: 403 confirms the object exists.
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';        -- API: 404
  END IF;

  -- 4. Held one, suspended or revoked. Standing, and it is a 403.
  --    coalesce is defensive rather than load-bearing: v_standing is only NULL
  --    when no row was found, and that case raised at step 3.
  IF NOT coalesce(v_standing, false) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'U0001';   -- API: 403
  END IF;

  -- 5. Role grant AND surface, in ONE query, so the two cannot be told apart.
  IF NOT EXISTS (
    SELECT 1 FROM core.role_permission rp
      JOIN core.permission p ON p.code = rp.permission_code
     WHERE rp.role = v_role AND rp.permission_code = p_permission
       AND p_audience = ANY(p.surfaces)
  ) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'U0001';   -- API: 403
  END IF;
END $fn$;

COMMENT ON FUNCTION core.fn_has_permission IS
  'Gates 1, 2 and the STANDING gate of ADU-AUTH-01 v2.4 section 14. '
  'A3.3: three cases, not two. Never a member raises U0002 (404); ever a '
  'member but not currently in good standing raises U0001 (403); a role or '
  'surface failure raises U0001. RETURNS void AND RAISES: every call site uses '
  'PERFORM, because a boolean return invites "IF NOT fn_has_permission(...)" '
  'and the failure mode of that shape is a caller who forgets the IF, which '
  'reads as authorised. It checks NEITHER seller.status (gate 0, 409) NOR '
  'object ownership (gate 4, 404 via composite FK).';

-- CREATE OR REPLACE preserves owner and grants, but they are re-asserted so
-- that this file states the whole truth about the function rather than relying
-- on 05a still being read alongside it. SECURITY DEFINER runs as the OWNER, and
-- these migrations are applied by a bootstrap superuser.
ALTER FUNCTION core.fn_has_permission(uuid, uuid, text, core.session_audience)
  OWNER TO adulis_migrate;

REVOKE ALL     ON FUNCTION core.fn_has_permission(uuid, uuid, text, core.session_audience) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION core.fn_has_permission(uuid, uuid, text, core.session_audience) TO adulis_app;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'Amendment A3.3 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
