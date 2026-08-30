-- 0040 -- core.device_platform gains WEB.
--
-- ADU-RUL-03 S2 / T8 PHASE 2 S1. Register D-95 asked whether a browser can
-- honestly register a device; the ruling answers by making the SERVER mint
-- the row at /v1/bootstrap, which forces this column to have a value that is
-- true of a browser. It had two, and both were lies about a web client.
--
-- WHY THIS MATTERS BEYOND A NOT NULL. core.device.platform is read by the
-- new-device payout lock's neighbourhood (S7.2) and by anything that reasons
-- about where a device came from. Declaring a browser ANDROID to satisfy a
-- constraint would put a false statement in a column that gates money --
-- the same reasoning that gave verification.verifier_kind its
-- OPERATOR_ATTESTED value rather than reusing KYC_VENDOR: an audit-adjacent
-- value that says something other than what happened is worse than one that
-- says less.
--
-- ALONE IN THIS FILE, DELIBERATELY. A new enum value cannot be USED in the
-- transaction that adds it (T8 Phase 2 S3.1). Nothing here inserts a WEB
-- device; the first one is written at runtime by bootstrap, long after this
-- has committed. A migration that added the value and then used it would
-- fail on a value the same file had just created.
--
-- IF NOT EXISTS keeps `pnpm db:determinism` happy: re-running the migration
-- set must be a no-op, and ADD VALUE is not otherwise idempotent.

ALTER TYPE core.device_platform ADD VALUE IF NOT EXISTS 'WEB';

COMMENT ON TYPE core.device_platform IS
  'ANDROID and IOS are client-generated identities persisted in a platform '
  'keystore and presented on the request. WEB is server-minted at '
  '/v1/bootstrap and carried in an httpOnly __Host- cookie, because a '
  'browser has no secure storage and a value JavaScript can read is a value '
  'XSS can forge (ADU-RUL-03 S2). The same ruling produces two mechanisms '
  'because the two surfaces differ in exactly that one way.';
