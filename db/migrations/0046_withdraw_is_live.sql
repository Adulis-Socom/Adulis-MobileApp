-- ============================================================================
-- 0046 -- is_live is withdrawn (ADU-RUL-06 v1.0 -- D-183; WORK ORDER T14 S5)
--
-- RULING: "Every market resolution reads activation_state = 'ACTIVE'. is_live
-- is withdrawn. SUSPENDED then means what suspension should mean: no new OTP,
-- no new device assigned there, and every account already in that market
-- unaffected."
--
-- is_live and activation_state were two truths about one market, and is_live
-- was the one deciding which market a new account joins (D-104's territory,
-- which v2.6 never mentions). One boolean cannot express SUSPENDED -- no new
-- entry, existing trade continues -- and activation_state can, so the boolean
-- goes and the enum governs.
--
-- THE GUARD MOVES WITH THE MEANING. fn_guard_market_live enforced 12.2.1 -- a
-- market cannot go live while any state transition is unratified -- against
-- is_live. "Going live" is now the transition INTO activation_state = 'ACTIVE',
-- so the guard fires on that instead. Same invariant, same ERRCODE; only the
-- column it reads changes. check 13 asserts the function stays attached, and
-- it does.
-- ============================================================================

CREATE OR REPLACE FUNCTION core.fn_guard_market_live() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  -- 12.2.1, now keyed on activation_state: a market may not ENTER 'ACTIVE'
  -- while any transition row is unratified. A review that blocks a release is
  -- a gate; a review that is merely scheduled is a hope.
  IF NEW.activation_state = 'ACTIVE' AND OLD.activation_state IS DISTINCT FROM 'ACTIVE'
     AND EXISTS (SELECT 1 FROM core.order_state_transition_legal WHERE ratified_at IS NULL
                 UNION ALL
                 SELECT 1 FROM core.reservation_state_transition_legal WHERE ratified_at IS NULL) THEN
    RAISE EXCEPTION 'State machine not ratified; market cannot go ACTIVE'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $fn$;

-- The boolean is gone. Every reader now reads activation_state = 'ACTIVE'
-- (bootstrap and orders.service, D-116's two readers, both moved in this PR).
-- Dropping it on a populated table is why this is its own change: the seed and
-- ~35 test fixtures wrote it, and all are updated in the same commit.
ALTER TABLE core.market DROP COLUMN is_live;