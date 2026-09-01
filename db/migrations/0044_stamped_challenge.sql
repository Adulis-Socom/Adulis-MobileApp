-- ============================================================================
-- 0044 -- the challenge is STAMPED, not resolved
--
-- Transcribed from ADU-RUL-06 v1.0 S2 (rules D-193 and D-203 together) and
-- WORK ORDER T14 S3. ADU-DB-01 v1.14 does not carry these columns; the founder
-- ruling authorizes them and ADU-DB-01 v1.15 owes the prose (the same debt
-- v1.15 already owes for D-190).
--
-- THE DEFECT THIS CLOSES WAS FOUND THREE TIMES BY THREE LENSES AND IS ONE
-- DEFECT: a value the challenge should have carried was re-resolved later,
-- from a source that could differ.
--
--   D-180  audience from the request body at VERIFY, not from the challenge
--   D-203  the attempt budget from a MARKET lookup at verify -- and the
--          market from the ACCOUNT, so counting wrong guesses before the 429
--          told an unauthenticated caller whether a phone has an account
--   D-193  per-market spend unattributable, because nothing named a market
--
-- RULING (ADU-RUL-06 S2): "core.otp_challenge carries market_id, stamped at
-- creation from the DEVICE's market. Every parameter the challenge needs is
-- stamped with it. Verification reads the challenge and never re-resolves a
-- market."
--
-- And the ruling's own closing reason, kept where the schema enforces it:
-- without stamping, a challenge created under one market's parameters could
-- be VERIFIED under another's -- the device's market at request, the
-- account's at verify. Reading the challenge makes that impossible rather
-- than unlikely.
-- ============================================================================

ALTER TABLE core.otp_challenge
  ADD COLUMN market_id    uuid NULL REFERENCES core.market(id),
  ADD COLUMN max_attempts int  NULL CHECK (max_attempts IS NULL OR max_attempts > 0);

COMMENT ON COLUMN core.otp_challenge.market_id IS
  'ADU-RUL-06 S2. The market that GOVERNED CREATION: the device''s market on '
  'every anonymous path, the account''s only for authenticated step-up. '
  'Verification never resolves a market; the budget counter attributes spend '
  'through this column (D-193). NULL only on rows issued before 0044 -- the '
  'service treats an unstamped row as expired, and a challenge lives five '
  'minutes, so the transitional window closes itself.';

COMMENT ON COLUMN core.otp_challenge.max_attempts IS
  'ADU-RUL-06 S2 -- "every parameter the challenge needs is stamped with it". '
  'The attempt budget that governs THIS challenge, copied from the governing '
  'market''s timing_config at creation. Comparing attempt_count against a '
  'live timing lookup was D-203''s oracle: the lookup resolved the ACCOUNT''s '
  'market, and the number of OTP_INVALID answers before OTP_ATTEMPTS_EXCEEDED '
  'is a number an unauthenticated caller can count. The TTL needs no column '
  'of its own -- expires_at has always been the stamped form of it.';

-- The budget counter reads (market_id, created_at) on the attempt's challenge.
-- One index on the challenge side serves it; the attempt side already joins by
-- otp_challenge_id through its FK's unique support.
CREATE INDEX otp_challenge_market_day
  ON core.otp_challenge (market_id, created_at);
