-- ============================================================================
-- 0056 -- Scene/Catalogue eligibility consistency, Variant currency and
--         Product/Seller Market integrity
--         (WORK ORDER WO-CAT-001A; OVN-087, OVN-088, OVN-090;
--          overnight batch of 11 November 2026)
--
-- ONE ITEM-LEVEL RULE. WO-CAT-001 gave every public Catalogue read one
-- projection (apps/api/src/modules/catalogue/public-projection.ts): a Product
-- is sellable when it is PUBLISHED and has an ACTIVE Variant in stock PRICED IN
-- ITS MARKET'S CURRENCY (fn_create_order refuses any other: "no fx source").
-- core.v_scene_product_availability -- the Scene domain's one derivation, read by
-- publish, re-evaluation, the public Scene gate and the For You feed -- lacked
-- the currency term. It gains it here, so the two agree item by item. Seller and
-- Market status stay where 0054 put them: separate gates in
-- core.fn_scene_post_reevaluate (v_gates_ok) and core.v_scene_post_public, with
-- their own re-evaluation triggers. No publication, revision, tagging or
-- restoration rule changes.
--
-- The new input is re-evaluated like the others: a Variant's price_currency
-- (now a trigger column) and a Market's display_currency (added to the Market
-- gate trigger, which notes every published Scene of that Market).
--
-- CURRENCY INTEGRITY (OVN-088; MKT-01 S334 "that Market's allowed transaction
-- currency", CATINV-01 S364 "Current Seller Market determines the allowed
-- currency context"). A Variant's price_currency and a Product's seed
-- base_price_currency must be the Product's Market display currency. Enforced on
-- INSERT and on any UPDATE of those columns (or of the Product link); existing
-- rows are not rewritten -- no conversion, no cleanup. Audit before this
-- migration (11 Nov, adulis_gates and the developer database, read-only): zero
-- non-Market currencies.
--
-- MARKET INTEGRITY (OVN-090). A Product's market_id is its Seller's: a composite
-- foreign key to core.seller (id, market_id), whose unique index
-- seller_id_market already exists. Audit: zero contradictions; the constraint is
-- validated now.
-- ============================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. The Scene availability derivation gains the Market-currency term (OVN-087)
-- ---------------------------------------------------------------------------
-- Same columns, same order: CREATE OR REPLACE keeps every grant. `in_stock` keeps its meaning
-- (an ACTIVE Variant has stock); only `available` gains the currency term, so a Seller's view
-- can show "in stock, but not sellable" truthfully.
CREATE OR REPLACE VIEW core.v_scene_product_availability AS
SELECT p.id AS product_id,
       p.seller_id,
       p.market_id,
       (p.visibility = 'PUBLISHED') AS published,
       EXISTS (SELECT 1 FROM core.product_variant v
                WHERE v.product_id = p.id AND v.status = 'ACTIVE' AND v.stock_count > 0)
         AS in_stock,
       (p.visibility = 'PUBLISHED'
        AND EXISTS (SELECT 1 FROM core.product_variant v
                      JOIN core.market m ON m.id = p.market_id
                     WHERE v.product_id = p.id AND v.status = 'ACTIVE' AND v.stock_count > 0
                       AND v.price_currency = m.display_currency))
         AS available
  FROM core.product p;

COMMENT ON VIEW core.v_scene_product_availability IS
  'The single Scene derivation of item-level Product availability from canonical '
  'Catalogue/Inventory columns: PUBLISHED, and an ACTIVE Variant in stock priced in '
  'the Product''s Market currency (fn_create_order''s per-line purchasability; the '
  'public Catalogue projection''s item-level rule). Seller and Market status are '
  'separate gates. Stores nothing; there is no Scene-local stock.';

-- ---------------------------------------------------------------------------
-- 2. Re-evaluation on the new input
-- ---------------------------------------------------------------------------
DROP TRIGGER trg_scene_note_variant_update ON core.product_variant;
DROP TRIGGER trg_scene_reevaluate_variant_update ON core.product_variant;

CREATE TRIGGER trg_scene_note_variant_update
  AFTER UPDATE OF stock_count, status, product_id, price_currency ON core.product_variant
  FOR EACH ROW
  WHEN (OLD.stock_count IS DISTINCT FROM NEW.stock_count
        OR OLD.status IS DISTINCT FROM NEW.status
        OR OLD.product_id IS DISTINCT FROM NEW.product_id
        OR OLD.price_currency IS DISTINCT FROM NEW.price_currency)
  EXECUTE FUNCTION core.fn_scene_note_product_change();
CREATE CONSTRAINT TRIGGER trg_scene_reevaluate_variant_update
  AFTER UPDATE OF stock_count, status, product_id, price_currency ON core.product_variant
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.stock_count IS DISTINCT FROM NEW.stock_count
        OR OLD.status IS DISTINCT FROM NEW.status
        OR OLD.product_id IS DISTINCT FROM NEW.product_id
        OR OLD.price_currency IS DISTINCT FROM NEW.price_currency)
  EXECUTE FUNCTION core.fn_scene_reevaluate_noted();

DROP TRIGGER trg_scene_note_market_activation ON core.market;
DROP TRIGGER trg_scene_reevaluate_market_activation ON core.market;

CREATE TRIGGER trg_scene_note_market_activation
  AFTER UPDATE OF activation_state, display_currency ON core.market
  FOR EACH ROW
  WHEN (OLD.activation_state IS DISTINCT FROM NEW.activation_state
        OR OLD.display_currency IS DISTINCT FROM NEW.display_currency)
  EXECUTE FUNCTION core.fn_scene_note_gate_change();
CREATE CONSTRAINT TRIGGER trg_scene_reevaluate_market_activation
  AFTER UPDATE OF activation_state, display_currency ON core.market
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.activation_state IS DISTINCT FROM NEW.activation_state
        OR OLD.display_currency IS DISTINCT FROM NEW.display_currency)
  EXECUTE FUNCTION core.fn_scene_reevaluate_noted();

-- ---------------------------------------------------------------------------
-- 3. Currency integrity (OVN-088)
-- ---------------------------------------------------------------------------
-- 23514 check_violation naming variant_price_in_market_currency or
-- product_seed_in_market_currency: the API maps it to VALIDATION_FAILED on price_currency /
-- base_price_currency (pg-error-translator). Known limit: the Market's currency is read
-- unlocked, so a write racing an operator's currency change can commit in the old currency.
CREATE FUNCTION core.fn_guard_market_currency() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_currency core.currency_code;
BEGIN
  IF TG_TABLE_NAME = 'product_variant' THEN
    SELECT m.display_currency INTO v_currency
      FROM core.product p JOIN core.market m ON m.id = p.market_id
     WHERE p.id = NEW.product_id;
    IF v_currency IS NOT NULL AND NEW.price_currency <> v_currency THEN
      RAISE EXCEPTION 'price_currency % is not the Market currency %', NEW.price_currency, v_currency
        USING ERRCODE = 'check_violation', CONSTRAINT = 'variant_price_in_market_currency';
    END IF;
  ELSE
    SELECT m.display_currency INTO v_currency FROM core.market m WHERE m.id = NEW.market_id;
    IF v_currency IS NOT NULL AND NEW.base_price_currency <> v_currency THEN
      RAISE EXCEPTION 'base_price_currency % is not the Market currency %', NEW.base_price_currency, v_currency
        USING ERRCODE = 'check_violation', CONSTRAINT = 'product_seed_in_market_currency';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

COMMENT ON FUNCTION core.fn_guard_market_currency() IS
  'OVN-088: a Variant price and a Product seed are in the Product''s Market display '
  'currency (MKT-01 S334, CATINV-01 S364). Checked on write only; no conversion.';

CREATE TRIGGER trg_guard_variant_currency
  BEFORE INSERT OR UPDATE OF price_currency, product_id ON core.product_variant
  FOR EACH ROW EXECUTE FUNCTION core.fn_guard_market_currency();
CREATE TRIGGER trg_guard_product_currency
  BEFORE INSERT OR UPDATE OF base_price_currency, market_id ON core.product
  FOR EACH ROW EXECUTE FUNCTION core.fn_guard_market_currency();

ALTER FUNCTION core.fn_guard_market_currency() OWNER TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_guard_market_currency() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 4. Product/Seller Market integrity (OVN-090)
-- ---------------------------------------------------------------------------
ALTER TABLE core.product
  ADD CONSTRAINT product_market_is_seller_market
  FOREIGN KEY (seller_id, market_id) REFERENCES core.seller (id, market_id);

-- ---------------------------------------------------------------------------
-- 5. Catch-up: re-evaluate every published Scene once under the new rule
-- ---------------------------------------------------------------------------
-- Public reads are already right (the gate evaluates at read time); this keeps the stored
-- visibility, and so the Seller's view, right too. A no-op where nothing changed (the audit
-- found no non-Market currency).
SELECT core.fn_scene_post_reevaluate_products(
  '{}'::uuid[], ARRAY(SELECT id FROM core.scene_post WHERE publication_state = 'PUBLISHED'));

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
