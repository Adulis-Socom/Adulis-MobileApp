-- ===========================================================================
-- MIGRATION 16 (post-catalogue roll-forward) - ELIGIBILITY, READINESS,
-- EFFECTIVE LIMITS, PUBLICATION
--
-- The document's fifteen migrations are complete (0001-0017). This file
-- discharges four function bodies the documents DESCRIBE and elide
-- (register D-07), required by Phase C group C1:
--
--   core.fn_evaluate_eligibility      ADU-DB-01 v1.10 S7.4, S4.1/S4.2
--   core.fn_publication_readiness     S9.4 (nine items - see D-21)
--   core.fn_publish_product           S9.4, S16.5
--   billing.fn_effective_limit        S18.3 - now derivable, see below
--   verification.has_attestation      the narrow existence probe the two
--                                     core functions need (same doctrine as
--                                     id_hash_matches: a check that crosses
--                                     the boundary returns no identity data)
--
-- WHY fn_effective_limit LEAVES ITS PARKING SPOT. D-07 parked it because
-- "the level-unlock inputs are not ruled". Rereading with the full schema
-- built: they are. ladder_config carries level caps ONLY for NEW
-- (new_level_product_cap, new_level_transaction_cap_minor) - S5.5's sixteen
-- columns admit no higher-level cap, so ESTABLISHED and TRUSTED are
-- level-uncapped by construction; broadcast's level gate is ruled by name
-- (S16.1: Trusted); the tier side is billing.tier_definition. The
-- intersection is therefore fully derivable from ruled columns. A missing
-- tier_definition ROW fails closed (the ladder precedent: a deliberate
-- value deferral makes the capability unreachable, never universally
-- reachable); a PRESENT row with product_cap NULL means unlimited (S18.4's
-- own BETA row rules that reading).
--
-- Register D-21: ADU-DB-01 v1.10 S9.4 says "the ten items in S4.6's table";
-- ADU-API-01 v1.6 S7.1a enumerates NINE and explains the tenth's removal
-- (R7c: ACTIVE_HOURS - availability is informational, zero windows valid, a
-- gate that never fails is worse than no gate). The later, wire-governing
-- document wins; nine are built.
--
-- Register D-22: S9.4 prints fn_publication_readiness as LANGUAGE sql
-- STABLE and, one paragraph later, requires it to EMIT
-- seller_publication_blocked whenever evaluation fails. A STABLE sql
-- function cannot write. The invariant outranks the signature annotation
-- (the event "cannot be reconstructed later"); built as plpgsql VOLATILE.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. verification.has_attestation - the existence probe
-- ---------------------------------------------------------------------------
CREATE FUNCTION verification.has_attestation(p_person_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = verification AS $$
  SELECT EXISTS (SELECT 1 FROM verification.identity_attestation
                  WHERE person_id = p_person_id);
$$;

COMMENT ON FUNCTION verification.has_attestation(uuid) IS
  'S13.2 doctrine: a boundary check that returns NO identity data - one '
  'boolean, no name, no id type, nothing to log because nothing is '
  'disclosed. Eligibility (S7.4) and readiness (S9.4) both need exactly '
  'this and nothing more; reads that disclose go through read_attestation '
  'and its access log, and only those.';

ALTER FUNCTION verification.has_attestation(uuid) OWNER TO adulis_verification;
REVOKE ALL ON FUNCTION verification.has_attestation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verification.has_attestation(uuid)
  TO adulis_app, adulis_migrate, adulis_jobs;

-- ---------------------------------------------------------------------------
-- 2. The attested person for a seller. INDIVIDUAL: the seller's own person
--    row. COMPANY: the representative - the attestation attaches to the
--    natural person, never the company (S7.1, S4.3).
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_seller_attestation_person(p_seller uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = core AS $$
  SELECT CASE s.entity_type
           WHEN 'COMPANY' THEN scd.representative_person_id
           ELSE s.person_id
         END
    FROM core.seller s
    LEFT JOIN core.seller_company_detail scd ON scd.seller_id = s.id
   WHERE s.id = p_seller;
$$;

-- ---------------------------------------------------------------------------
-- 3. core.fn_evaluate_eligibility (S7.4, S4.1, S4.2)
--
-- The rules service: one function reading eligibility_config at the given
-- instant, writing one append-only evaluation row. Phase 2 is
-- audience_required = false in a NEW CONFIGURATION ROW, never a code
-- change - which is why every rule below reads a column.
--
-- FAIL CLOSED: no configuration in force -> NOT_SATISFIED with the reason
-- on the row. The ladder precedent exactly - a deferred value must make
-- eligibility unreachable, never universally reachable.
--
-- The path recorded is the one that satisfied (S4.1's cohorts: the
-- Phase 2 evidence that cannot be reconstructed later). Audience is
-- preferred where both hold, because the audience gate is the Phase 1
-- product and the identity path is its Phase 2 relaxation.
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_evaluate_eligibility(
  p_seller uuid,
  p_at timestamptz DEFAULT now()
) RETURNS core.seller_eligibility_evaluation
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
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
    v_audience := coalesce(v_best >= v_cfg.follower_threshold, false);

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
END $fn$;

-- ---------------------------------------------------------------------------
-- 4. billing.fn_effective_limit (S16.5, S18.3)
--
-- THE intersection of tier entitlement and trust level - one function,
-- called by every capability gate. It READS the level and never writes it:
-- payment never buys a badge or a level (S13.1), and there is no path in
-- the other direction, by construction.
--
-- Tier resolution: the seller's subscription row; a seller with none is on
-- the free tier (LISTED). The BETA STATE carries its own definition row
-- (S18.4) - beta sellers are never rendered as Free, because that would
-- corrupt the evidence every launch decision rests on.
-- ---------------------------------------------------------------------------
CREATE FUNCTION billing.fn_effective_limit(p_seller_id uuid, p_capability text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = billing, core AS $fn$
DECLARE
  v_sub   billing.subscription;
  v_def   billing.tier_definition;
  v_level core.trust_level;
  v_cap   int;
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
      -- lesser of tier cap and level cap; only NEW carries a level cap
      -- (S5.5 admits no higher-level one).
      SELECT least(
               v_def.product_cap,
               CASE WHEN v_level = 'NEW'
                    THEN (SELECT lc.new_level_product_cap
                            FROM core.ladder_config lc
                            JOIN core.seller s ON s.market_id = lc.market_id
                           WHERE s.id = p_seller_id AND lc.effective @> now())
               END)
        INTO v_cap;
      -- A NEW seller in a market with no ladder config: fail closed.
      IF v_level = 'NEW' AND v_cap IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'NO_LADDER_CONFIG');
      END IF;
      RETURN jsonb_build_object('allowed', true, 'cap', v_cap);

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

-- ---------------------------------------------------------------------------
-- 5. core.fn_publication_readiness (S9.4; items per ADU-API-01 v1.6 S7.1a)
--
-- ONE resolved state, computed server-side; the client renders rows and
-- computes nothing. Emits seller_publication_blocked WITH its reasons
-- whenever evaluation fails - from inside the function, so the funnel
-- data cannot be lost to a code path that forgot to log (S4.6 calls this
-- a measurement problem as much as a UX one).
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_publication_readiness(p_seller_id uuid)
RETURNS TABLE (item text, satisfied boolean, resolving_action text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_seller   core.seller;
  v_eval     core.seller_eligibility_evaluation;
  v_idreq    boolean;
  v_person   uuid;
  v_items    jsonb := '[]';
  v_blocked  text[] := '{}';
  r          record;
BEGIN
  SELECT * INTO v_seller FROM core.seller WHERE id = p_seller_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;

  SELECT e.* INTO v_eval
    FROM core.seller_eligibility_evaluation e
   WHERE e.seller_id = p_seller_id
   ORDER BY e.evaluated_at DESC LIMIT 1;

  SELECT ic.identity_required INTO v_idreq
    FROM core.identity_config ic
   WHERE ic.market_id = v_seller.market_id AND ic.effective @> now();

  v_person := core.fn_seller_attestation_person(p_seller_id);

  -- The nine items, in the ratified order. IDENTITY_VERIFIED is satisfied
  -- when an attestation exists OR when the market does not require one AND
  -- the seller's path is not IDENTITY - the identity path holds a full
  -- attestation before the first listing goes live, no grace period, no
  -- bypass column (S4.2/S7.4). Absent identity_config fails closed to
  -- "required".
  FOR r IN
    SELECT * FROM (VALUES
      ('ACCOUNT_CREATED',
        true,
        'NONE'),
      ('SELLER_TYPE_DECLARED',
        v_seller.entity_type IS NOT NULL,
        'DECLARE_SELLER_TYPE'),
      ('ELIGIBILITY_SATISFIED',
        coalesce(v_eval.outcome = 'SATISFIED', false),
        'COMPLETE_ELIGIBILITY'),
      ('IDENTITY_VERIFIED',
        (v_person IS NOT NULL AND verification.has_attestation(v_person))
          OR (NOT coalesce(v_idreq, true)
              AND coalesce(v_eval.path <> 'IDENTITY', true)),
        'COMPLETE_IDENTITY_VERIFICATION'),
      ('COMPANY_DETAILS',
        v_seller.entity_type <> 'COMPANY'
          OR EXISTS (SELECT 1 FROM core.seller_company_detail d
                      WHERE d.seller_id = p_seller_id),
        'PROVIDE_COMPANY_DETAILS'),
      ('STORE_PROFILE',
        nullif(trim(v_seller.store_name), '') IS NOT NULL
          AND nullif(trim(coalesce(v_seller.description, '')), '') IS NOT NULL
          AND v_seller.category_id IS NOT NULL,
        'COMPLETE_STORE_PROFILE'),
      ('PAYOUT_DETAILS',
        EXISTS (SELECT 1 FROM core.payout_details pd
                 WHERE pd.seller_id = p_seller_id
                   AND pd.state IN ('PENDING', 'ACTIVE')),
        'ADD_PAYOUT_DETAILS'),
      ('FULFILMENT_CONFIG',
        EXISTS (SELECT 1 FROM core.seller_fulfilment_method fm
                 WHERE fm.seller_id = p_seller_id AND fm.is_active),
        'ADD_FULFILMENT_METHOD'),
      ('AT_LEAST_ONE_PRODUCT',
        EXISTS (SELECT 1 FROM core.product p WHERE p.seller_id = p_seller_id),
        'ADD_A_PRODUCT')
    ) AS t(item, satisfied, resolving_action)
  LOOP
    IF NOT r.satisfied THEN
      v_blocked := array_append(v_blocked, r.item);
    END IF;
    item := r.item;
    satisfied := r.satisfied;
    resolving_action := CASE WHEN r.satisfied THEN NULL ELSE r.resolving_action END;
    RETURN NEXT;
  END LOOP;

  -- The funnel event (S4.6/S9.4). Register D-21a: eligibility_path is a
  -- NOT NULL cohort column on every seller-scoped event, and a seller with
  -- no evaluation yet HAS no path - that event travels without seller_id,
  -- carrying the seller in the payload, rather than inventing a cohort.
  IF cardinality(v_blocked) > 0 THEN
    INSERT INTO analytics.event
      (name, version, market_id, seller_id, eligibility_path, seller_level,
       seller_type, payload)
    VALUES
      ('seller_publication_blocked', 1, v_seller.market_id,
       CASE WHEN v_eval.path IS NOT NULL THEN p_seller_id END,
       v_eval.path,
       (SELECT level FROM core.seller_level_state WHERE seller_id = p_seller_id),
       v_seller.entity_type::text,
       jsonb_build_object('reasons', to_jsonb(v_blocked),
                          'seller', p_seller_id));
  END IF;
END $fn$;

-- ---------------------------------------------------------------------------
-- 6. core.fn_publish_product (S9.4, S16.5, S7)
--
-- Readiness minus AT_LEAST_ONE_PRODUCT (the product being published is the
-- product), then the effective product-count limit, then the publish.
-- Blocked -> ONE raise carrying every unsatisfied item in DETAIL (the API
-- serves 409 PUBLICATION_BLOCKED with items[], section 7's completeness
-- rule).
-- ---------------------------------------------------------------------------
CREATE FUNCTION core.fn_publish_product(p_product uuid, p_seller uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_product   core.product;
  v_blocked   jsonb;
  v_limit     jsonb;
  v_published int;
BEGIN
  SELECT * INTO v_product FROM core.product
   WHERE id = p_product AND seller_id = p_seller;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'code', 'PUBLICATION_BLOCKED',
           'item', pr.item,
           'resolving_action', pr.resolving_action))
    INTO v_blocked
    FROM core.fn_publication_readiness(p_seller) pr
   WHERE NOT pr.satisfied AND pr.item <> 'AT_LEAST_ONE_PRODUCT';

  IF v_blocked IS NOT NULL THEN
    RAISE EXCEPTION 'publication blocked'
      USING ERRCODE = 'restrict_violation', DETAIL = v_blocked::text;
  END IF;

  v_limit := billing.fn_effective_limit(p_seller, 'PRODUCT_COUNT');
  IF NOT coalesce((v_limit ->> 'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'publication limit unavailable'
      USING ERRCODE = 'restrict_violation',
            DETAIL = jsonb_build_array(jsonb_build_object(
              'code', 'TIER_LIMIT_REACHED',
              'reason', v_limit ->> 'reason'))::text;
  END IF;
  IF (v_limit ->> 'cap') IS NOT NULL THEN
    SELECT count(*) INTO v_published
      FROM core.product p
     WHERE p.seller_id = p_seller AND p.visibility = 'PUBLISHED'
       AND p.id <> p_product;
    IF v_published >= (v_limit ->> 'cap')::int THEN
      RAISE EXCEPTION 'publication limit reached'
        USING ERRCODE = 'restrict_violation',
              DETAIL = jsonb_build_array(jsonb_build_object(
                'code', 'LEVEL_LIMIT_REACHED',
                'cap', (v_limit ->> 'cap')::int,
                'published', v_published))::text;
    END IF;
  END IF;

  UPDATE core.product
     SET visibility = 'PUBLISHED', published_at = coalesce(published_at, now())
   WHERE id = p_product;

  UPDATE core.seller
     SET published_at = coalesce(published_at, now()),
         status = CASE WHEN status = 'DRAFT' THEN 'ACTIVE' ELSE status END
   WHERE id = p_seller;
END $fn$;

-- ---------------------------------------------------------------------------
-- 7. Ownership and grants
-- ---------------------------------------------------------------------------
ALTER FUNCTION core.fn_seller_attestation_person(uuid)       OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_evaluate_eligibility(uuid, timestamptz) OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_publication_readiness(uuid)           OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_publish_product(uuid, uuid)           OWNER TO adulis_migrate;
ALTER FUNCTION billing.fn_effective_limit(uuid, text)        OWNER TO adulis_migrate;

REVOKE ALL ON FUNCTION core.fn_seller_attestation_person(uuid)         FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_evaluate_eligibility(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_publication_readiness(uuid)             FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_publish_product(uuid, uuid)             FROM PUBLIC;
REVOKE ALL ON FUNCTION billing.fn_effective_limit(uuid, text)          FROM PUBLIC;

GRANT EXECUTE ON FUNCTION core.fn_evaluate_eligibility(uuid, timestamptz)
  TO adulis_app, adulis_jobs;
GRANT EXECUTE ON FUNCTION core.fn_publication_readiness(uuid) TO adulis_app;
GRANT EXECUTE ON FUNCTION core.fn_publish_product(uuid, uuid) TO adulis_app;
GRANT EXECUTE ON FUNCTION billing.fn_effective_limit(uuid, text)
  TO adulis_app, adulis_jobs;
GRANT EXECUTE ON FUNCTION core.fn_seller_attestation_person(uuid) TO adulis_app;

-- the definer bodies read and write these as adulis_migrate
GRANT SELECT ON core.eligibility_config, core.identity_config,
                core.seller_social_account, core.seller_company_detail,
                core.seller_fulfilment_method, core.product
  TO adulis_migrate;
GRANT SELECT, INSERT ON core.seller_eligibility_evaluation TO adulis_migrate;
GRANT INSERT ON analytics.event TO adulis_migrate;
GRANT USAGE ON SCHEMA analytics TO adulis_migrate;
GRANT UPDATE (visibility, published_at) ON core.product TO adulis_migrate;
GRANT UPDATE (published_at, status) ON core.seller TO adulis_migrate;
GRANT SELECT ON billing.subscription, billing.tier_definition TO adulis_migrate;
GRANT EXECUTE ON FUNCTION verification.has_attestation(uuid) TO adulis_migrate;
-- EXECUTE without USAGE is a door with no corridor - the run's recurring
-- grant class, found by smoke again. USAGE conveys namespace visibility
-- and no data access (check 10's own header proves it).
GRANT USAGE ON SCHEMA verification TO adulis_migrate;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
