-- ============================================================================
-- 0057 -- Shop browsing index (WORK ORDER WO-007; ADU-MOB-02 v4.3 S32 Shop,
--         ADU-CATINV-01 v3.3 S406 cursor pagination; overnight batch of
--         11 November 2026)
--
-- GET /v1/shop/products lists the requester Market's PUBLISHED Products, newest
-- first publication, keyset-paginated on (published_at, id). Without an index
-- that read scans and sorts every Product row of every Market on each page. This
-- partial index serves the filter and the order directly; it holds only
-- PUBLISHED rows, so it stays small. No table, column, constraint, grant or
-- function changes.
-- ============================================================================

-- Up Migration

CREATE INDEX idx_product_shop
  ON core.product (market_id, published_at DESC, id DESC)
  WHERE visibility = 'PUBLISHED';

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
