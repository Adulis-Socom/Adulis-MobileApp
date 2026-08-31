-- 0041_d92_follower_threshold_fails_open.sql
--
-- D-92 RULED (WORK ORDER T9 S3.1). `core.eligibility_config.follower_threshold`
-- may be NULL, and NULL there is a DECIDED value -- "this market sets no
-- bar" -- not a deferred one. ADU-PRD-01 S4.1 governs, and the consumer FAILS
-- OPEN on it.
--
-- Before this migration `fn_evaluate_eligibility` read:
--
--     v_audience := coalesce(v_best >= v_cfg.follower_threshold, false);
--
-- `v_best >= NULL` is NULL, coalesced to false -- so a market that had
-- deliberately set no follower bar refused EVERY seller for
-- FOLLOWER_THRESHOLD_NOT_MET, which is the opposite of what the absent bar
-- means.
--
-- THE TWO NULLS ARE NOT THE SAME and the fix keeps them apart. A NULL
-- `v_best` is ABSENT EVIDENCE -- the seller has no verified account on a
-- counting platform -- and still fails closed. A NULL threshold is an ABSENT
-- RULE and now passes. The old single coalesce collapsed both into "no".
--
-- THE BODY BELOW WAS EXTRACTED WITH pg_get_functiondef AND PATCHED, never
-- retyped: one line replaced, everything else byte-for-byte as the database
-- holds it. Migration 0005 created this function and is merged, so it is not
-- edited.
--
-- Reversibility: re-running 0005's definition restores the old behaviour.

CREATE OR REPLACE FUNCTION core.fn_evaluate_eligibility(p_seller uuid, p_at timestamp with time zone DEFAULT now())
 RETURNS core.seller_eligibility_evaluation
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core'
AS $function$
DECLARE
  v_seller   core.seller;
  v_cfg      core.eligibility_config;
  v_reasons  text[] := '{}';
  v_path     core.eligibility_path;
  v_outcome  core.eligibility_outcome;
  v_audience boolean := false;
  v_identity boolean := false;
  v_best     int;
  v_person   uuid;
  v_row      core.seller_eligibility_evaluation;
BEGIN
  SELECT * INTO v_seller FROM core.seller WHERE id = p_seller;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;

  SELECT ec.* INTO v_cfg
    FROM core.eligibility_config ec
   WHERE ec.market_id = v_seller.market_id AND ec.effective @> p_at;

  IF NOT FOUND THEN
    v_outcome := 'NOT_SATISFIED';
    v_reasons := ARRAY['NO_ELIGIBILITY_CONFIG'];
    v_path    := 'AUDIENCE';  -- the Phase 1 default; nothing was evaluated
  ELSE
    IF NOT (v_seller.entity_type = ANY (v_cfg.permitted_seller_types)) THEN
      v_reasons := array_append(v_reasons, 'SELLER_TYPE_NOT_PERMITTED');
    END IF;

    -- AUDIENCE: the highest single VERIFIED account on a counting platform
    -- (S4.1 threshold_basis HIGHEST_SINGLE - never the sum), against the
    -- count captured AT VERIFICATION (S4.2: never re-evaluated
    -- retroactively).
    SELECT max(sa.follower_count_at_verification) INTO v_best
      FROM core.seller_social_account sa
     WHERE sa.seller_id = p_seller
       AND sa.status = 'VERIFIED'
       AND sa.platform = ANY (v_cfg.counting_platforms);
    -- D-92, RULED (WORK ORDER T9 S3.1): a NULL follower_threshold is a
    -- DECIDED value -- this market sets no bar -- not a deferral. PRD S4.1
    -- governs and the consumer FAILS OPEN: with no bar, there is nothing to
    -- clear, so the audience gate is satisfied. The old line coalesced the
    -- NULL comparison to false and refused every seller in such a market.
    -- v_best IS NULL still fails CLOSED: that is absent evidence, not an
    -- absent rule, and the two must not collapse into one coalesce.
    v_audience := CASE
                    WHEN v_cfg.follower_threshold IS NULL THEN true
                    ELSE coalesce(v_best >= v_cfg.follower_threshold, false)
                  END;

    v_person   := core.fn_seller_attestation_person(p_seller);
    v_identity := v_person IS NOT NULL
                  AND verification.has_attestation(v_person);

    -- id_verification_requirement is orthogonal to the path (S5.4's
    -- column): MANDATORY_ALL demands the attestation whatever else holds;
    -- MANDATORY_WITHOUT_AUDIENCE demands it exactly when the audience gate
    -- did not open.
    IF v_cfg.id_verification_requirement = 'MANDATORY_ALL' AND NOT v_identity THEN
      v_reasons := array_append(v_reasons, 'IDENTITY_ATTESTATION_REQUIRED');
    END IF;
    IF v_cfg.id_verification_requirement = 'MANDATORY_WITHOUT_AUDIENCE'
       AND NOT v_audience AND NOT v_identity THEN
      v_reasons := array_append(v_reasons, 'IDENTITY_ATTESTATION_REQUIRED');
    END IF;

    IF v_cfg.audience_required AND NOT v_audience THEN
      -- Phase 1: the audience gate IS the gate.
      v_reasons := array_append(v_reasons, 'FOLLOWER_THRESHOLD_NOT_MET');
    ELSIF NOT v_cfg.audience_required AND NOT v_audience AND NOT v_identity THEN
      -- Phase 2: at least one of the two paths (S7.4).
      v_reasons := array_append(v_reasons, 'NO_PATH_SATISFIED');
    END IF;

    v_outcome := CASE WHEN cardinality(v_reasons) = 0
                      THEN 'SATISFIED'::core.eligibility_outcome
                      ELSE 'NOT_SATISFIED'::core.eligibility_outcome END;
    v_path := CASE WHEN v_audience THEN 'AUDIENCE'::core.eligibility_path
                   WHEN v_identity THEN 'IDENTITY'::core.eligibility_path
                   ELSE 'AUDIENCE'::core.eligibility_path END;
  END IF;

  -- evaluated_at is WHEN this evaluation happened (clock_timestamp: strictly
  -- monotonic within a transaction, so "the latest evaluation" is always
  -- well-defined); p_at chose which configuration was read, which is a
  -- different fact and lives in config_version_id.
  INSERT INTO core.seller_eligibility_evaluation
    (id, seller_id, evaluated_at, config_version_id, path, outcome, reasons)
  VALUES (gen_random_uuid(), p_seller, clock_timestamp(), v_cfg.id, v_path, v_outcome, v_reasons)
  RETURNING * INTO v_row;
  -- (trg_enter_ladder fires on SATISFIED and puts the seller on the ladder
  -- at NEW - migration 05's dormant trigger, live since migration 08.)
  RETURN v_row;
END $function$
