-- ===========================================================================
-- MIGRATION 0025 - REVOKE THE DEFAULT PUBLIC EXECUTE ON EVERY CALLABLE
--                  SECURITY DEFINER FUNCTION (Phase D finding SR-1 / D-46)
--
-- PostgreSQL grants EXECUTE to PUBLIC on every new function by default.
-- Migrations 0018 onward learned to revoke it; migrations 04 and 12-13
-- predate the lesson, so the Phase D definer sweep found ten CALLABLE
-- definer functions any connecting role could execute - among them all six
-- isolated-boundary functions. Their internal checks take the actor as a
-- PARAMETER, so a foreign role could name any actor it liked: the
-- boundary's access log would faithfully record an access the caller
-- attributed to someone else, and ciphertext would leave the schema on a
-- connection that was never meant to reach it.
--
-- Trigger-returning definer functions also default to PUBLIC but cannot be
-- invoked directly (PostgreSQL refuses a direct call of a function
-- returning trigger), so the exposure is exactly these ten. Revoked, and
-- the intended callers re-granted BY NAME. Check 10 now also asserts no
-- boundary-schema function is PUBLIC-executable, so the class cannot
-- return.
-- ===========================================================================

-- Up Migration

-- The financial boundary (migration 12; check 10's permitted list).
REVOKE ALL ON FUNCTION financial.read_payment_evidence(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION financial.render_payment_instructions(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION financial.write_payment_evidence(uuid, text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION financial.read_payment_evidence(uuid, uuid, text) TO adulis_app;
GRANT EXECUTE ON FUNCTION financial.render_payment_instructions(uuid, uuid) TO adulis_app;
GRANT EXECUTE ON FUNCTION financial.write_payment_evidence(uuid, text, text, int, int) TO adulis_app;

-- The verification boundary (migration 04).
REVOKE ALL ON FUNCTION verification.read_attestation(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION verification.write_attestation(uuid, verification.verifier_kind, text, text, text, bytea, int, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION verification.id_hash_matches(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verification.read_attestation(uuid, uuid, text) TO adulis_app;
GRANT EXECUTE ON FUNCTION verification.write_attestation(uuid, verification.verifier_kind, text, text, text, bytea, int, date) TO adulis_app;
GRANT EXECUTE ON FUNCTION verification.id_hash_matches(bytea) TO adulis_app;

-- The ladder helpers (migration 10): read by fn_recompute_seller_level,
-- whose owner needs no grant; nothing else calls them.
REVOKE ALL ON FUNCTION core.fn_ladder_cancellation_rate(uuid, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_ladder_claim_rate(uuid, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_ladder_scan_rate(uuid, interval) FROM PUBLIC;

-- The lapse sweep (migration 13): the worker's job body will run it.
REVOKE ALL ON FUNCTION core.fn_confirmation_window_lapse(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.fn_confirmation_window_lapse(uuid) TO adulis_app, adulis_jobs;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
