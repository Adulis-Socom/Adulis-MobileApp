-- ============================================================================
-- 0060 -- Marketplace Search caption index (WORK ORDER WO-008; ADU-SRC-01 v3.2
--         S11 Scene Post Search, S16 PostgreSQL + pg_trgm; ADU-DB-01 v1.25)
--
-- GET /v1/search matches a Scene's current published caption with ILIKE and
-- the pg_trgm word-similarity operator. Product names and Seller handles and
-- store names already carry trigram indexes (idx_product_name_trgm,
-- idx_seller_handle_trgm, idx_seller_store_name_trgm); captions did not, so a
-- caption match scanned every revision. This GIN index serves those
-- operators. It covers every revision row (the public gate,
-- core.v_scene_post_public, still decides which one is current and PUBLIC).
-- No table, column, constraint, grant or function changes.
-- ============================================================================

-- Up Migration

CREATE INDEX idx_scene_revision_caption_trgm
  ON core.scene_post_revision USING gin (caption gin_trgm_ops);

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
