-- ============================================================================
-- 0053 -- the session credential is no longer the session id
--         (WORK ORDER WO-API-001A, SEC-1; founder rulings A and B)
--
-- Until now core.session.id was BOTH the public identifier and the bearer /
-- cookie credential: SessionService looked sessions up by id, and
-- GET /v1/auth/sessions listed every live id on the account, so any one
-- session could read every other session's credential (register
-- docs/mobile/WO-001C-CONTRACT-GAPS.json, SEC-1, release gate).
--
-- ADU-AUTH-02 v3.3 S31: "The client holds an opaque credential; PostgreSQL
-- stores the hash and canonical session state." So:
--
--   id          stays the PUBLIC identifier (session lists, revoke-one, audit
--               columns such as revoked_by_session_id and
--               payout_change_log.session_id). It no longer authenticates.
--   token_hash  SHA-256 of a separate 256-bit random credential the API mints
--               and returns once. The plaintext is never stored. A fast hash
--               is the right construction for a high-entropy random secret;
--               slow password hashing protects low-entropy inputs only.
--
-- RULING B -- ONE-TIME GLOBAL SIGN-OUT. Every live session is revoked here.
-- Revoked, not deleted: the rows anchor revoked_by_session_id, the payout
-- audit columns, the D5 new-device trigger's "this pair signed in before"
-- test and the new-device payout lock's first-session reading.
--
-- THE DEFAULT IS A RANDOM HASH NOBODY HOLDS A PREIMAGE FOR. It is volatile, so
-- ADD COLUMN evaluates it per row: every existing row gets a distinct value
-- no presented token can match, which is what makes the old uuid credentials
-- dead independently of the revocation above. A writer that omits token_hash
-- gets the same unusable row, so the default fails closed. The API always
-- supplies the hash of the token it returns.
-- ============================================================================

ALTER TABLE core.session
  ADD COLUMN token_hash bytea NOT NULL
    DEFAULT sha256(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()));

ALTER TABLE core.session
  ADD CONSTRAINT session_token_hash_unique UNIQUE (token_hash),
  ADD CONSTRAINT session_token_hash_is_sha256 CHECK (octet_length(token_hash) = 32);

UPDATE core.session SET revoked_at = now() WHERE revoked_at IS NULL;

-- SEC-3 (founder ruling E): OTP-verify idempotency records written before this
-- migration carry the raw session token (dead after the sign-out above) and
-- the raw remembered-device token (live for up to seven days). From now on the
-- API stores only a non-secret marker; the old rows go now rather than at the
-- 24-hour purge. A replay of one of them re-executes and finds its code spent.
DELETE FROM core.idempotency_record WHERE endpoint = 'POST /v1/auth/otp/verify';

COMMENT ON COLUMN core.session.token_hash IS
  'SHA-256 of the session credential (WO-API-001A, ADU-AUTH-02 v3.3 S31). '
  'The credential is minted by the API, returned once, and never stored. '
  'core.session.id is the public identifier and does not authenticate. '
  'The default is a random hash with no known preimage, so a row written '
  'without an explicit hash can never authenticate.';
