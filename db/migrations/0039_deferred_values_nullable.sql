-- 0039 -- ADU-RUL-02: deferral becomes a state the schema can hold.
--
-- ADU-RUL-02 via WORK ORDER T7 S5 (document text owed -- register D-84).
-- ADU-VAL-01 v1.1 S0.2/S1.1. Register D-61, the standing record this
-- migration closes: "a NOT NULL column holding a value this register marks
-- OPEN is not a deferral. It is a forced invention with a later deadline."
--
-- For four work orders the ladder was safe only because no ladder_config
-- row existed -- a safety that expires the first time a market is seeded,
-- because every fail-closed coalesce() guard in fn_recompute_seller_level
-- was guarding against a NULL the schema forbade. Decorative, and it read
-- as careful.
--
-- ------------------------------------------------------------------------
-- TEN COLUMNS, ENUMERATED FROM THE SCHEMA -- NOT FROM ANY PROSE COUNT,
-- because three documents carry three different wrong counts (register
-- D-88): D-61 says eight remain (it forgot demotion_window and
-- distinct_buyer_window); ADU-VAL-01 v1.1 S1.1 says "0028 made 5 of them
-- so" (0028 dropped five NOT NULLs, but the fifth was
-- new_level_transaction_cap_minor, an S2 row, not an S1.1 row -- only the
-- four trusted_* count); information_schema says: of S1.1's fourteen
-- ladder columns, four are nullable and TEN are not. v1.1 S0.3's own rule
-- resolves the tie: where the list and the schema disagree, the schema
-- wins.
--
-- NOT touched, each for a stated reason:
--   * trusted_* (4)                    -- already nullable (0028).
--   * new_to_established_min_tenure/_min_orders, new_level_product_cap
--                                      -- SET by ADU-RUL-01 (G1.2); ruled
--                                         values, not deferrals.
--   * new_level_transaction_cap_minor  -- nullable AND SET: NULL means NO
--                                         CAP (fail OPEN). The opposite
--                                         semantics of every column below,
--                                         which is why it is absent from
--                                         the deferred-values fixture.
--   * eligibility_config.follower_threshold -- already nullable (0002).
--   * nlu.intent_phrase.embedding      -- already nullable; its deferral
--                                         is the DIMENSION (D-05, S1.4).
--
-- NO consumer changes ride with this, and that is the point: 0028's
-- coalesce(..., false) gates, the helpers' IF p_window IS NULL RETURN NULL
-- guards (0010), fn_handoff_scan_validity's explicit IS NOT NULL pair
-- (0013:159), and fn_effective_limit's NO_LADDER_CONFIG fail-closed
-- (0018) were all written for NULLs that could not exist. This migration
-- makes them live rather than decorative; t7-deferred-nullability.spec.ts
-- asserts what D-61 said could not be written before.
--
-- Both CHECK constraints on ladder_config tolerate NULL already (a NULL
-- operand makes the AND-chain NULL, and a NULL CHECK passes) -- verified,
-- no rewrite. Lock note: DROP NOT NULL takes ACCESS EXCLUSIVE, no rewrite,
-- on a tiny config table.
-- ------------------------------------------------------------------------

ALTER TABLE core.ladder_config
  ALTER COLUMN established_min_handoffs          DROP NOT NULL,
  ALTER COLUMN established_window                DROP NOT NULL,
  ALTER COLUMN established_min_avg_rating        DROP NOT NULL,
  ALTER COLUMN established_max_claim_rate        DROP NOT NULL,
  ALTER COLUMN demotion_max_claim_rate           DROP NOT NULL,
  ALTER COLUMN demotion_max_cancellation_rate    DROP NOT NULL,
  ALTER COLUMN demotion_min_scan_completion_rate DROP NOT NULL,
  ALTER COLUMN demotion_window                   DROP NOT NULL,
  ALTER COLUMN distinct_buyer_window             DROP NOT NULL,
  ALTER COLUMN distinct_buyer_max_count          DROP NOT NULL;

-- The semantics each NULL carries, stated on the column because two
-- meanings of NULL now coexist on this table (the transaction cap's NULL
-- means NO CAP, fail open; these mean CANNOT FIRE, fail closed) and the
-- column comment is where the next reader looks first.
COMMENT ON COLUMN core.ladder_config.established_min_handoffs IS
  'ADU-VAL-01 v1.1 S1.1 row 1, OPEN. NULL = the value is not yet decided; '
  'read by NOTHING since A1.3 rewired the NEW exit (retained, unread -- '
  '0028). Fail closed.';
COMMENT ON COLUMN core.ladder_config.demotion_window IS
  'ADU-VAL-01 v1.1 S1.1 row 12, OPEN. NULL = the three demotion rates come '
  'back NULL from the 0010 helpers and the OR-gate collapses to false: '
  'nobody is demoted except by an upheld claim, which ignores every value '
  'here (S5.2). Fail closed. NOTE the OR semantics: a PARTIALLY configured '
  'demotion set still demotes on its configured legs -- NULL OR TRUE is '
  'TRUE -- which is intended, not a bug (hysteresis needs its own numbers, '
  'S1.2).';
COMMENT ON COLUMN core.ladder_config.distinct_buyer_window IS
  'ADU-VAL-01 v1.1 S1.1 row 13 (Group C), OPEN. NULL = '
  'fn_handoff_scan_validity leaves counts_toward_level false (0013:159): '
  'scans complete orders but earn no level credit, and handoff_scan is '
  'append-only, so scans recorded before Group C is seeded are PERMANENTLY '
  'non-counting. Fail closed, with a memory.';

-- The dev database holds only test fixtures, every one of which supplies
-- these columns; no data change. A fresh database is unchanged in
-- behavior: fn_recompute_seller_level already fail-closes on a missing
-- config ROW, and now also on a present row with absent values.
