-- ============================================================================
-- 0062 -- Catalogue category taxonomy: the three founder-approved top-level
--         categories (WORK ORDER WO-010; founder decision ON-20261111-049;
--         ADU-CATINV-01 v3.3 S40, ADU-MOB-02 v4.3 S399, ADU-SRC-01 v3.2 S8;
--         ADU-DB-01 v1.27)
--
-- Founder (WO-007A, confirmed WO-010): the initial top-level commerce
-- categories for the Ethiopia launch are Fashion, Cosmetics and Electronics.
-- Nothing below them is approved: no subcategory, attribute definition,
-- classification, membership rule (Locally Made, Discounts, New Drops),
-- popularity or paid placement.
--
-- CATINV-01 S40: "Category identity is stable; localized labels are
-- presentation. Category changes require migration/versioning discipline."
-- So:
--   * core.category gains label_key (a locale catalogue key, never prose --
--     the attribute_definition.label_key rule) and display_order. Both are
--     nullable/defaulted so rows that predate this migration stay valid; a
--     category without a label key is never listed publicly (it cannot be
--     presented in any locale).
--   * The three categories are inserted with fixed ids, so every environment
--     has the same identity. Idempotent: an existing code is left as it is.
--   * Availability stays per Market (core.category_market_availability). No
--     Market is enabled here: Markets are created by the operator
--     (ops/runbooks/activate-market.md), not by migrations, and the launch
--     Market's enablement is that runbook's category step. The dev seed enables
--     its fixture Market.
--
-- PRODUCT CLASSIFICATION. A Product's category must be a presentable category
-- (a label key) available in the Product's own Market when it is assigned
-- (WO-010 S10). The database holds the rule (adulis_app writes core.product
-- directly): checked on insert and when category_id or market_id changes, so
-- editing a Product whose category was later disabled in its Market still works.
-- Uncategorised Products (category_id NULL) are untouched and stay in the
-- unfiltered Shop. Known limit: availability is read without a lock, so a
-- disable committing concurrently with an assignment reads as "disabled after
-- assignment" (the Product keeps it), as 0056 documents for its own guard.
-- ============================================================================

-- Up Migration

ALTER TABLE core.category
  ADD COLUMN label_key text NULL,
  ADD COLUMN display_order int NOT NULL DEFAULT 0;

COMMENT ON COLUMN core.category.label_key IS
  'A locale catalogue key (e.g. catalogue.category.fashion), never rendered prose '
  '(ADU-CATINV-01 S40: localized labels are presentation). NULL: not presentable, '
  'never listed by GET /v1/categories.';
COMMENT ON COLUMN core.category.display_order IS
  'Deterministic presentation order among siblings (ascending, then code).';

INSERT INTO core.category (id, parent_id, code, label_key, display_order) VALUES
  ('ca7e0000-0000-4000-8000-000000000001', NULL, 'FASHION', 'catalogue.category.fashion', 10),
  ('ca7e0000-0000-4000-8000-000000000002', NULL, 'COSMETICS', 'catalogue.category.cosmetics', 20),
  ('ca7e0000-0000-4000-8000-000000000003', NULL, 'ELECTRONICS', 'catalogue.category.electronics', 30)
ON CONFLICT (code) DO NOTHING;

-- Enabled-in-Market lookups (the public list and the classification guard).
CREATE INDEX idx_category_market_availability_market
  ON core.category_market_availability (market_id) WHERE is_available;

-- Category-filtered Shop and Search: the Market's PUBLISHED Products of one
-- category in Shop order.
CREATE INDEX idx_product_market_category_published
  ON core.product (market_id, category_id, published_at DESC, id DESC)
  WHERE category_id IS NOT NULL AND visibility = 'PUBLISHED';

CREATE FUNCTION core.fn_guard_product_category_available() RETURNS trigger
LANGUAGE plpgsql SET search_path = core AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM core.category_market_availability a
      JOIN core.category c ON c.id = a.category_id
     WHERE a.category_id = NEW.category_id AND a.market_id = NEW.market_id AND a.is_available
       AND c.label_key IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Category % is not available in Market %', NEW.category_id, NEW.market_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'product_category_available';
  END IF;
  RETURN NEW;
END $fn$;

COMMENT ON FUNCTION core.fn_guard_product_category_available() IS
  'WO-010 S10: a Product may be assigned only a presentable category (label_key) that is '
  'available in the Product''s Market (core.category_market_availability.is_available). '
  'Checked on insert and when category_id or market_id changes; NULL is always allowed.';

CREATE TRIGGER trg_product_category_available_insert
  BEFORE INSERT ON core.product
  FOR EACH ROW
  WHEN (NEW.category_id IS NOT NULL)
  EXECUTE FUNCTION core.fn_guard_product_category_available();

CREATE TRIGGER trg_product_category_available_update
  BEFORE UPDATE OF category_id, market_id ON core.product
  FOR EACH ROW
  WHEN (NEW.category_id IS NOT NULL
        AND (NEW.category_id IS DISTINCT FROM OLD.category_id OR NEW.market_id IS DISTINCT FROM OLD.market_id))
  EXECUTE FUNCTION core.fn_guard_product_category_available();

ALTER FUNCTION core.fn_guard_product_category_available() OWNER TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_guard_product_category_available() FROM PUBLIC;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
