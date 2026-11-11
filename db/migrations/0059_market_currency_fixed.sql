-- ============================================================================
-- 0059 -- A Market's currency is fixed once it has Products (WORK ORDER
--         WO-007A; founder decision ON-20261111-009; ADU-MKT-01 v3.3 S334,
--         ADU-CATINV-01 v3.3 S364; ADU-DB-01 v1.24)
--
-- Founder, 11 November 2026: "A Market's display currency becomes fixed once
-- Products exist in that Market. Ordinary administrative changes must be
-- rejected." There is no automatic conversion (0056 holds every Variant price
-- and Product seed in the Market currency), so a changed Market currency
-- would leave its whole catalogue unpriced. No API writes core.market's
-- currency; adulis_app holds table UPDATE (0002, "Full DML"), so the database
-- holds the rule.
--
-- RACE. A Product insert takes only FOR KEY SHARE on its Market (the FK), which
-- does not conflict with this UPDATE, and the 0056 guard reads the currency
-- unlocked. So the change takes SHARE on core.product first: it waits for any
-- in-flight Product write, then sees it; a Product write that starts after
-- waits for this transaction, and its 0056 guard then reads the new currency.
-- SHARE needs table-level UPDATE on core.product, which every role that can
-- UPDATE core.market holds (adulis_app, the owner), so the function runs as
-- the invoker.
--
-- A Market with no Product (initial setup) may still change. An exceptional
-- change for a Market with Products is a controlled, explicitly authorised
-- repricing procedure -- a reviewed forward migration -- never this path.
-- ============================================================================

-- Up Migration

CREATE FUNCTION core.fn_guard_market_currency_fixed() RETURNS trigger
LANGUAGE plpgsql SET search_path = core AS $fn$
BEGIN
  LOCK TABLE core.product IN SHARE MODE;
  IF EXISTS (SELECT 1 FROM core.product p WHERE p.market_id = NEW.id) THEN
    RAISE EXCEPTION 'Market % has Products; its display currency is fixed', NEW.id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'market_currency_fixed_with_products';
  END IF;
  RETURN NEW;
END $fn$;

COMMENT ON FUNCTION core.fn_guard_market_currency_fixed() IS
  'ON-20261111-009 (founder): a Market''s display_currency cannot change once any '
  'Product exists in it. No conversion; an exceptional change is a reviewed '
  'forward migration.';

CREATE TRIGGER trg_market_currency_fixed
  BEFORE UPDATE OF display_currency ON core.market
  FOR EACH ROW
  WHEN (OLD.display_currency IS DISTINCT FROM NEW.display_currency)
  EXECUTE FUNCTION core.fn_guard_market_currency_fixed();

ALTER FUNCTION core.fn_guard_market_currency_fixed() OWNER TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_guard_market_currency_fixed() FROM PUBLIC;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
