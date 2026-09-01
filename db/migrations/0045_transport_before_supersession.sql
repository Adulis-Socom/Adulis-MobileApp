-- ============================================================================
-- 0045 -- transport before supersession (ADU-RUL-06 v1.0 S5, D-204.1)
--
-- WORK ORDER T14 S4. RULING: "A challenge that has not been transported is not
-- live and cannot be verified against. Supersession happens at transport
-- acceptance. There is exactly one verifiable challenge at every instant."
--
-- THE DEFECT: issueChallenge superseded the prior code AT MINT -- expired it
-- the instant the new one was inserted, before the new one was sent. A resend
-- whose delivery then failed (Ethiopia's configured no-fallback state, a
-- vendor outage) left the user with TWO DEAD CODES: the old destroyed, the new
-- undelivered, a late-arriving first SMS now worthless. A code the user cannot
-- have received is not a code they hold, and S5.3's purpose is that only one
-- code WORKS, not that only one ROW exists.
--
-- THE COLUMN, NOT THE LEDGER. Verifiability is gated on transport acceptance,
-- and it would have been tempting to read otp_delivery_attempt.status =
-- 'ACCEPTED' at verify -- but S12.2 forbids exactly that: "Security code
-- validity is not derived from these statuses." So acceptance is recorded on
-- the CHALLENGE as a security fact (this code is now the live one), written by
-- the delivery service when a provider accepts, and separate from the
-- transport ledger's own DELIVERED/FAILED_FINAL states.
--
--   transported_at NULL      minted, not yet on its way -- NOT verifiable, and
--                            it supersedes nothing
--   transported_at set       a provider accepted it; it is THE live code, and
--                            accepting it expired every sibling in the same act
-- ============================================================================

ALTER TABLE core.otp_challenge
  ADD COLUMN transported_at timestamptz NULL;

COMMENT ON COLUMN core.otp_challenge.transported_at IS
  'ADU-RUL-06 S5 (D-204.1). When a provider ACCEPTED transport of this code, '
  'set by the delivery service in the same statement that expires every '
  'sibling live challenge for the (phone, purpose) pair. NULL means minted '
  'but not yet on its way: not verifiable, and superseding nothing, so a '
  'failed resend leaves the PREVIOUS code live. This is a security fact on '
  'the challenge, NOT a read of otp_delivery_status -- S12.2 forbids deriving '
  'validity from transport status, and this is the challenge''s own record '
  'that it became the live code. Pre-0045 rows have it NULL; the service '
  'treats a SIGN_IN/STEP_UP challenge issued after 0045 as unverifiable until '
  'set, and the one-TTL transitional window closes itself.';

-- Verify reads (phone, purpose, transported_at IS NOT NULL) to find the live
-- challenge; the partial index serves that lookup and the supersession sweep.
CREATE INDEX otp_challenge_live
  ON core.otp_challenge (phone_e164, purpose)
  WHERE transported_at IS NOT NULL AND consumed_at IS NULL;