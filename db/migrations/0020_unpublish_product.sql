-- ===========================================================================
-- core.fn_unpublish_product - the named function behind
-- POST /v1/seller/products/{id}/unpublish (ADU-API-01 v1.6 sections 12.10,
-- 13; ADU-DB-01 S9). Another D-07 body discharged for Phase C group C2.
--
-- Removes the product from the storefront and KEEPS THE ROW - required on
-- tier downgrade and by seller choice (S7), and the reason travels as a
-- ratified enum so a downgrade sweep and a seller's own act stay
-- distinguishable in the record.
--
-- Idempotent by state: unpublishing an already-unpublished product updates
-- the reason and nothing else; unpublishing a DRAFT is a no-op on
-- visibility (a draft was never on the storefront to remove).
-- ===========================================================================

-- Up Migration

CREATE FUNCTION core.fn_unpublish_product(
  p_product uuid,
  p_seller  uuid,
  p_reason  core.unpublished_reason
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE v_visibility core.product_visibility;
BEGIN
  SELECT visibility INTO v_visibility
    FROM core.product
   WHERE id = p_product AND seller_id = p_seller;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;

  IF v_visibility = 'PUBLISHED' THEN
    UPDATE core.product
       SET visibility = 'UNPUBLISHED', unpublished_reason = p_reason
     WHERE id = p_product;
  ELSIF v_visibility = 'UNPUBLISHED' THEN
    UPDATE core.product SET unpublished_reason = p_reason
     WHERE id = p_product;
  END IF;
END $fn$;

ALTER FUNCTION core.fn_unpublish_product(uuid, uuid, core.unpublished_reason)
  OWNER TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_unpublish_product(uuid, uuid, core.unpublished_reason)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.fn_unpublish_product(uuid, uuid, core.unpublished_reason)
  TO adulis_app, adulis_jobs;
GRANT UPDATE (visibility, unpublished_reason) ON core.product TO adulis_migrate;

-- ---------------------------------------------------------------------------
-- ROLL-FORWARD of fn_publish_product (0018, merged - never edited): the
-- publish UPDATE must CLEAR unpublished_reason, or the
-- unpublished_reason_only_when_unpublished CHECK refuses every republish.
-- Found by the C2 gate suite: unpublish then publish was a 500.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.fn_publish_product(p_product uuid, p_seller uuid)
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
     SET visibility = 'PUBLISHED',
         published_at = coalesce(published_at, now()),
         unpublished_reason = NULL
   WHERE id = p_product;

  UPDATE core.seller
     SET published_at = coalesce(published_at, now()),
         status = CASE WHEN status = 'DRAFT' THEN 'ACTIVE' ELSE status END
   WHERE id = p_seller;
END $fn$;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
