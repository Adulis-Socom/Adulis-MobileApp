-- ============================================================================
-- 0050 -- the effective limit says WHICH limit binds (WORK ORDER T22 Phase 4.2)
--
-- Transcribes: ADU-CON-03 v1.3 S8 (SC-07 Products), verbatim:
--   "The product cap is the INTERSECTION of tier and level, and the counter
--    must say which one binds. A NEW seller on a paid tier is capped at 10 by
--    ladder_config.new_level_product_cap, whatever the tier allows -- and
--    '10 of unlimited' is a bug report waiting to be filed."
-- and its model sentence:
--   "10 of 10 -- new sellers can list 10 products. This lifts when your store
--    reaches Established."
--
-- THE FUNCTION ALREADY COMPUTED THE INTERSECTION AND THREW BOTH OPERANDS AWAY
-- ONE LINE AFTER READING THEM. `least(tier_cap, level_cap)` collapses two facts
-- into one number, and the screen needs the two facts: a seller capped at ten
-- must be told whether ten is their TIER's ceiling (which a payment lifts) or
-- their LEVEL's (which only trading lifts). Those are different sentences and
-- different actions, and the number is identical.
--
-- ADDITIVE ONLY. `allowed` and `cap` are byte-identical to what 0018 returned,
-- so `core.fn_publish_product` (0007, 0020) and every other reader is
-- untouched -- they read `cap` and nothing else. Adding keys to a jsonb return
-- is not a signature change, so CREATE OR REPLACE preserves the owner and the
-- grants, which is the property 0028 relies on and documents.
--
-- `level_cap` IS READ FROM THE LADDER SUBSELECT DIRECTLY rather than derived
-- from `cap`, and that is deliberate. `least()` IGNORES NULLS in Postgres --
-- least(NULL, 10) is 10, not NULL -- so `cap` alone cannot tell you which
-- operand produced it, and reconstructing the operands from the result would
-- inherit exactly that hole.
--
-- `binding` is TIER | LEVEL | BOTH | NONE. BOTH when the two are equal and
-- non-null, because naming one of them there would be a coin flip; NONE when
-- the cap is null, which is the case the screen must never render as the word
-- "unlimited" (S8:415).
-- ============================================================================

CREATE OR REPLACE FUNCTION billing.fn_effective_limit(p_seller_id uuid, p_capability text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = billing, core AS $fn$
DECLARE
  v_sub       billing.subscription;
  v_def       billing.tier_definition;
  v_level     core.trust_level;
  v_cap       int;
  v_tier_cap  int;
  v_level_cap int;
  v_binding   text;
BEGIN
  SELECT * INTO v_sub FROM billing.subscription WHERE seller_id = p_seller_id;

  IF FOUND AND v_sub.state = 'BETA' THEN
    SELECT * INTO v_def FROM billing.tier_definition
     WHERE subscription_state = 'BETA'
     ORDER BY version DESC LIMIT 1;
  ELSE
    SELECT * INTO v_def FROM billing.tier_definition
     WHERE tier = coalesce(v_sub.tier, 'LISTED')
     ORDER BY version DESC LIMIT 1;
  END IF;

  -- FAIL CLOSED on an absent definition row: a deferred value makes the
  -- capability unreachable, never universally reachable (the ladder
  -- precedent). The one exception is a PRESENT row whose cap is NULL,
  -- which S18.4's BETA row rules as "unlimited".
  IF v_def.id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'NO_TIER_DEFINITION');
  END IF;

  SELECT coalesce(sls.level, 'NEW') INTO v_level
    FROM core.seller s
    LEFT JOIN core.seller_level_state sls ON sls.seller_id = s.id
   WHERE s.id = p_seller_id;

  CASE p_capability
    WHEN 'PRODUCT_COUNT' THEN
      -- The two operands, kept. Only NEW carries a level cap (S5.5 admits no
      -- higher-level one), so a non-NEW seller's level_cap is NULL by design
      -- rather than by absence.
      v_tier_cap := v_def.product_cap;
      v_level_cap := CASE WHEN v_level = 'NEW'
                          THEN (SELECT lc.new_level_product_cap
                                  FROM core.ladder_config lc
                                  JOIN core.seller s ON s.market_id = lc.market_id
                                 WHERE s.id = p_seller_id AND lc.effective @> now())
                     END;

      -- lesser of tier cap and level cap, exactly as 0018 computed it.
      SELECT least(v_tier_cap, v_level_cap) INTO v_cap;

      -- A NEW seller in a market with no ladder config: fail closed.
      IF v_level = 'NEW' AND v_cap IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'NO_LADDER_CONFIG');
      END IF;

      v_binding := CASE
        WHEN v_cap IS NULL THEN 'NONE'
        WHEN v_tier_cap IS NOT NULL AND v_level_cap IS NOT NULL
             AND v_tier_cap = v_level_cap THEN 'BOTH'
        WHEN v_level_cap IS NOT NULL AND v_cap = v_level_cap THEN 'LEVEL'
        ELSE 'TIER'
      END;

      RETURN jsonb_build_object(
        'allowed', true,
        'cap', v_cap,
        'tier_cap', v_tier_cap,
        'level_cap', v_level_cap,
        'binding', v_binding,
        'level', v_level);

    WHEN 'BROADCAST' THEN
      -- Tier grants the capability; level grants the right to use it
      -- (S16.1): Pro-or-Business AND Trusted, the same intersection.
      RETURN jsonb_build_object(
        'allowed', v_def.broadcast AND v_level = 'TRUSTED');

    WHEN 'ANALYTICS_SCOPE' THEN
      RETURN jsonb_build_object('allowed', v_def.analytics_scope IS NOT NULL,
                                'scope', v_def.analytics_scope);

    WHEN 'CHATBOT_SCOPE' THEN
      RETURN jsonb_build_object('allowed', v_def.chatbot_scope IS NOT NULL,
                                'scope', v_def.chatbot_scope);

    WHEN 'TEAM_SEATS' THEN
      RETURN jsonb_build_object('allowed', coalesce(v_def.team_seats, 0) > 0,
                                'cap', v_def.team_seats);

    WHEN 'DATA_EXPORT' THEN
      RETURN jsonb_build_object('allowed', v_def.data_export);

    ELSE
      -- An unnamed capability is a capability nothing granted.
      RETURN jsonb_build_object('allowed', false, 'reason', 'UNKNOWN_CAPABILITY');
  END CASE;
END $fn$;
