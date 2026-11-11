-- ============================================================================
-- 0061 -- Private Buyer Collections (WORK ORDER WO-009; ADU-SRC-01 v3.2
--         S18-S22, S25-S27; ADU-MOB-02 v4.3 S39-S42; ADU-PRV-01 v3.3 S36;
--         ADU-DPIA-01 v1.1 PA-08; ADU-DB-01 v1.26)
--
-- Two tables. core.collection: one Account's private Collections, at most one
-- of kind DEFAULT (the "Saved" Collection, identified by kind and never by a
-- name: it stores none, and the client localises its label). core.collection_item:
-- one typed membership, exactly one of a Product Post (core.product) or a whole
-- Scene Post (core.scene_post), unique per Collection and target, so a repeated
-- Save is one row.
--
-- Provenance (S20) is optional, server-derived and never an access path:
--   * a Product saved from a Scene records the originating Scene and the
--     revision it was tagged in. SRC-01 S19 names a product_tag_id; no
--     surrogate tag id exists (0054: a tag IS (revision_id, product_id)), so
--     the tag is the composite FK collection_item_origin_tag, and the
--     database refuses a Scene/tag relationship that never existed;
--   * a whole Scene records the revision current when it was saved.
-- Losing a referenced revision or tag degrades provenance to NULL (column-list
-- ON DELETE SET NULL, PostgreSQL 15+); it never blocks a Seller edit.
--
-- Targets cascade: a Seller may hard-delete a never-ordered, untagged Product
-- (catalogue.service deleteProduct), and a membership must not refuse that.
-- Unpublished, restricted, out-of-stock and PRIVATE targets keep their
-- membership; the API resolves them now, through the current public gates.
--
-- SRC-01 S19's optional deleted_at is not created: deleting a Collection is a
-- hard delete (no retention for deleted private names is approved; PRV-01
-- S36 minimisation). kind and source_surface are text + CHECK (the enum
-- catalogue is unchanged at 71).
--
-- fn_delete_account: CREATE OR REPLACE of the live 0055 body (extracted with
-- pg_get_functiondef and compared; the D-62 method), adding exactly one
-- statement, the Collection purge. Owner and grants are restated as 0055 did.
-- Nothing is granted to adulis_readonly: Collections are owner-only
-- (DPIA-01 PA-08).
-- ============================================================================

-- Up Migration

CREATE TABLE core.collection (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Always the authenticated Account (S18); never client input.
  owner_account_id  uuid NOT NULL REFERENCES core.account (id),
  kind              text NOT NULL,
  name              text NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT collection_kind CHECK (kind IN ('DEFAULT', 'USER_CREATED')),
  -- DEFAULT carries no name (S21: never identified by its display name). A
  -- user-created name is trimmed, 1-60 characters, without control characters.
  CONSTRAINT collection_name CHECK (
    (kind = 'DEFAULT' AND name IS NULL)
    OR (kind = 'USER_CREATED' AND name IS NOT NULL
        AND name = btrim(name) AND char_length(name) BETWEEN 1 AND 60
        AND name !~ '[[:cntrl:]]')),
  CONSTRAINT collection_updated CHECK (updated_at >= created_at)
);

-- At most one DEFAULT per Account; the lazy creation's ON CONFLICT target.
CREATE UNIQUE INDEX uq_collection_default ON core.collection (owner_account_id)
  WHERE kind = 'DEFAULT';
CREATE INDEX idx_collection_owner ON core.collection (owner_account_id, created_at, id);

COMMENT ON TABLE core.collection IS
  'ADU-SRC-01 v3.2 S18/S19/S21: one Account''s private Collection. kind DEFAULT '
  '(at most one, unnamed, not deletable) or USER_CREATED (named). Owner-only; '
  'purged by fn_delete_account. No public, shared, collaborative or ordered state.';

CREATE TABLE core.collection_item (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id                   uuid NOT NULL REFERENCES core.collection (id) ON DELETE CASCADE,
  product_post_id                 uuid NULL REFERENCES core.product (id) ON DELETE CASCADE,
  scene_post_id                   uuid NULL REFERENCES core.scene_post (id) ON DELETE CASCADE,
  originating_scene_post_id       uuid NULL REFERENCES core.scene_post (id),
  originating_scene_revision_id   uuid NULL,
  scene_revision_seen_at_save_id  uuid NULL,
  source_surface                  text NOT NULL,
  created_at                      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT collection_item_one_target CHECK (num_nonnulls(product_post_id, scene_post_id) = 1),
  CONSTRAINT collection_item_source CHECK (source_surface IN (
    'PRODUCT_DETAIL', 'SCENE_EXPLORER', 'SEARCH', 'SHOP', 'SELLER_PROFILE', 'FOR_YOU', 'SAVED')),
  -- Scene-origin provenance belongs to a Product membership; a revision implies its Scene.
  CONSTRAINT collection_item_origin_product CHECK (
    originating_scene_post_id IS NULL OR product_post_id IS NOT NULL),
  CONSTRAINT collection_item_origin_scene CHECK (
    originating_scene_revision_id IS NULL OR originating_scene_post_id IS NOT NULL),
  CONSTRAINT collection_item_seen_scene CHECK (
    scene_revision_seen_at_save_id IS NULL OR scene_post_id IS NOT NULL),
  -- The originating revision is a revision OF the originating Scene ...
  CONSTRAINT collection_item_origin_revision
    FOREIGN KEY (originating_scene_revision_id, originating_scene_post_id)
    REFERENCES core.scene_post_revision (id, scene_post_id)
    ON DELETE SET NULL (originating_scene_revision_id),
  -- ... and that revision tagged THIS Product (the tag identity, SRC-01 S19 product_tag_id).
  CONSTRAINT collection_item_origin_tag
    FOREIGN KEY (originating_scene_revision_id, product_post_id)
    REFERENCES core.scene_post_product (revision_id, product_id)
    ON DELETE SET NULL (originating_scene_revision_id),
  -- The revision seen at save is a revision of the saved Scene.
  CONSTRAINT collection_item_seen_revision
    FOREIGN KEY (scene_revision_seen_at_save_id, scene_post_id)
    REFERENCES core.scene_post_revision (id, scene_post_id)
    ON DELETE SET NULL (scene_revision_seen_at_save_id)
);

-- One membership per Collection and target: a repeated Save is idempotent.
CREATE UNIQUE INDEX uq_collection_item_product ON core.collection_item (collection_id, product_post_id)
  WHERE product_post_id IS NOT NULL;
CREATE UNIQUE INDEX uq_collection_item_scene ON core.collection_item (collection_id, scene_post_id)
  WHERE scene_post_id IS NOT NULL;
-- Items newest first with a stable id tie-break (S19).
CREATE INDEX idx_collection_item_recent ON core.collection_item (collection_id, created_at DESC, id DESC);
-- The referential actions' lookups: a Product delete, a Scene delete, a tag rewrite of a
-- WORKING revision (scenes.service deletes and rewrites its tags), a revision delete.
CREATE INDEX idx_collection_item_product ON core.collection_item (product_post_id)
  WHERE product_post_id IS NOT NULL;
CREATE INDEX idx_collection_item_scene ON core.collection_item (scene_post_id)
  WHERE scene_post_id IS NOT NULL;
CREATE INDEX idx_collection_item_origin_tag ON core.collection_item (originating_scene_revision_id, product_post_id)
  WHERE originating_scene_revision_id IS NOT NULL;
CREATE INDEX idx_collection_item_origin_scene ON core.collection_item (originating_scene_post_id)
  WHERE originating_scene_post_id IS NOT NULL;
CREATE INDEX idx_collection_item_seen_revision ON core.collection_item (scene_revision_seen_at_save_id, scene_post_id)
  WHERE scene_revision_seen_at_save_id IS NOT NULL;

COMMENT ON TABLE core.collection_item IS
  'ADU-SRC-01 v3.2 S19/S20: one typed membership (exactly one Product Post or '
  'whole Scene Post) with optional server-derived provenance. Never freezes a '
  'price, holds stock, stores media or authorises access to a historical revision.';

CREATE OR REPLACE FUNCTION core.fn_delete_account(p_account_id uuid, p_otp_challenge_id uuid, p_phone_hash bytea)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core'
AS $function$
DECLARE
  v_account core.account;
  v_seller  record;
  v_res     record;
  v_money   int;
  v_cooling interval;
BEGIN
  SELECT * INTO v_account FROM core.account
   WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND OR v_account.status = 'SCRUBBED' THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;

  -- The ticket: a consumed deletion challenge for THIS phone, still fresh.
  IF NOT EXISTS (
    SELECT 1 FROM core.otp_challenge c
     WHERE c.id = p_otp_challenge_id
       AND c.purpose = 'ACCOUNT_DELETION'
       AND c.phone_e164 = v_account.phone_e164
       AND c.consumed_at IS NOT NULL
       AND c.consumed_at > now() - interval '15 minutes'
  ) THEN
    RAISE EXCEPTION 'deletion ticket invalid' USING ERRCODE = 'U0001';
  END IF;

  -- Owned sellers: each must clear its S16.9 blockers, then each is deleted
  -- with the full effects, including its phone-reuse block.
  FOR v_seller IN
    SELECT id, market_id FROM core.seller
     WHERE owner_account_id = p_account_id AND status <> 'DELETED'
  LOOP
    IF EXISTS (SELECT 1 FROM core.fn_deletion_blockers(v_seller.id)) THEN
      RAISE EXCEPTION 'deletion blocked' USING ERRCODE = '23001';
    END IF;
  END LOOP;

  -- Buyer-side money gate (DECIDED, see header): an order whose payment is
  -- submitted or confirmed cannot be settled against a scrubbed account.
  SELECT count(*)::int INTO v_money
    FROM core."order" o
   WHERE o.buyer_account_id = p_account_id
     AND o.state IN ('PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED');
  IF v_money > 0 THEN
    RAISE EXCEPTION 'deletion blocked' USING ERRCODE = '23001';
  END IF;

  FOR v_seller IN
    SELECT id, market_id FROM core.seller
     WHERE owner_account_id = p_account_id AND status <> 'DELETED'
  LOOP
    PERFORM core.fn_delete_seller_effects(v_seller.id);
    SELECT tc.deleted_number_cooling_period INTO v_cooling
      FROM core.timing_config tc
     WHERE tc.market_id = v_seller.market_id AND tc.effective @> now();
    IF v_cooling IS NULL THEN
      RAISE EXCEPTION 'timing configuration absent for market %',
        v_seller.market_id USING ERRCODE = 'restrict_violation';
    END IF;
    INSERT INTO core.phone_reuse_block (phone_hash, market_id, blocked_until)
    VALUES (p_phone_hash, v_seller.market_id, now() + v_cooling)
    ON CONFLICT (phone_hash, market_id) DO UPDATE
       SET blocked_until = greatest(core.phone_reuse_block.blocked_until,
                                    EXCLUDED.blocked_until);
  END LOOP;

  -- Active reservations released (PRD section 21): the buyer-cancel path,
  -- reused, so the stock release, the order transition and the counters all
  -- happen exactly as they do for an ordinary cancellation. Only pre-payment
  -- orders reach here - the money gate above excluded the rest.
  FOR v_res IN
    SELECT r.id AS reservation_id, r.order_id
      FROM core.reservation r
      JOIN core."order" o ON o.id = r.order_id
     WHERE o.buyer_account_id = p_account_id AND r.state = 'ACTIVE'
       AND o.state IN ('CREATED', 'NOTIFIED')
  LOOP
    PERFORM core.fn_cancel_line(
      v_res.order_id, v_res.reservation_id, p_account_id, false);
  END LOOP;

  -- Sessions die with the status flip: authentication reads account status
  -- on every request and refuses anything but ACTIVE. Explicit revocation
  -- as well, so the sessions surface shows the truth immediately.
  UPDATE core.session SET revoked_at = now()
   WHERE account_id = p_account_id AND revoked_at IS NULL;
  -- T7 S3.4 (ADU-RUL-02 via D-64's residual): account_device rows are
  -- REMOVED, not stamped. A remembered-device row is a standing credential
  -- for an identity that no longer exists -- worse than the wedge D-64
  -- fixed, because that failed loudly in a log and this outlives its
  -- account silently. The session FK is unhooked first:
  -- core.session.account_device_id references these rows with NO ON DELETE
  -- action, and revoked session rows are retained, so a bare DELETE would
  -- raise 23503 for any account that ever remembered a CONSOLE device.
  -- Filtered by the REFERENCING column, not session.account_id -- the
  -- constraint does not guarantee the referencing session belongs to this
  -- account.
  UPDATE core.session SET account_device_id = NULL
   WHERE account_device_id IN (SELECT ad.id FROM core.account_device ad
                                WHERE ad.account_id = p_account_id);
  DELETE FROM core.account_device WHERE account_id = p_account_id;
  -- For You (0055): an Account's feed sessions are recommendation-personal
  -- data (ADU-PRV-01 S7 "ACCOUNT_DELETION_COMPLETED -> purge person
  -- profile/link"). Its served impressions go with them (ON DELETE CASCADE).
  DELETE FROM core.fyp_session WHERE account_id = p_account_id;
  -- Collections (0061): private preference data (ADU-PRV-01 v3.3 S36,
  -- PRV-INV-020): the Account's Collection rows and private names; their
  -- memberships go with them (ON DELETE CASCADE). Canonical Products and
  -- Scenes are untouched.
  DELETE FROM core.collection WHERE owner_account_id = p_account_id;

  -- Reviews this account wrote: anonymised, never deleted.
  UPDATE core.review
     SET buyer_account_id = NULL,
         anonymised_at = coalesce(anonymised_at, now())
   WHERE buyer_account_id = p_account_id;

  -- Identity scrubbed. The tombstone phone (header) satisfies core.e164,
  -- stays unique, and frees the real number. person survives (section 6.2).
  UPDATE core.account
     SET phone_e164 = '+999' || lpad(
           ((('x' || substr(replace(id::text, '-', ''), 1, 12))::bit(48)::bigint)
            % 1000000000000)::text, 12, '0'),
         status = 'SCRUBBED',
         scrubbed_at = now(),
         age_declared_over_18 = NULL,
         age_declared_at = NULL
   WHERE id = p_account_id;

  -- Devices: unbound, so the purge in section 11 treats them as anonymous.
  UPDATE core.device SET account_id = NULL, push_token = NULL
   WHERE account_id = p_account_id;
END $function$;

ALTER FUNCTION core.fn_delete_account(uuid, uuid, bytea) OWNER TO adulis_migrate;
REVOKE ALL ON FUNCTION core.fn_delete_account(uuid, uuid, bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.fn_delete_account(uuid, uuid, bytea) TO adulis_app;
-- The definer's one new need: DELETE with a WHERE reads the row, so SELECT too;
-- the memberships cascade.
GRANT SELECT, DELETE ON core.collection, core.collection_item TO adulis_migrate;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, DELETE ON core.collection TO adulis_app;
GRANT UPDATE (name, updated_at) ON core.collection TO adulis_app;
GRANT SELECT, INSERT, DELETE ON core.collection_item TO adulis_app;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
