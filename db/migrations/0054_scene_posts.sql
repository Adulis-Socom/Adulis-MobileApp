-- ============================================================================
-- 0054 -- Scene Posts: root, revisions, Product tags, transitions, and the
--         availability-driven PUBLIC / PRIVATE visibility
--         (WORK ORDER WO-DISC-001; ADU-SCN-01 v3.2 S7, S14-S17, S23, S26-S29,
--          S32-S33, S46-S47, S54; POST_OCT13 R-02; register DSC-1)
--
-- A Scene Post is Seller-owned content that tags one or more of the SAME
-- Seller's Products. It is not a Product and creates no Order. Buyer-facing
-- copy says "Scene" (R-01); the schema keeps the canonical name.
--
-- TWO DIMENSIONS, NEVER ONE BOOLEAN (S14). publication_state is the Seller's
-- lifecycle intent (DRAFT / PUBLISHED / ARCHIVED); visibility is the current
-- Buyer exposure (PUBLIC / PRIVATE) with a typed reason. Losing the last
-- available tagged Product keeps PUBLISHED and turns PRIVATE; restoring one
-- turns it PUBLIC again with no republish (S29, R-02). ARCHIVED is in the
-- vocabulary so a later archive command needs no schema change; nothing here
-- writes it.
--
-- REVISIONS (S17). The root points at its current published revision and at
-- most one WORKING revision. Published revisions are immutable; editing a
-- published Scene clones it into a new WORKING revision, and the next publish
-- freezes that and moves the pointer. Caption, image and tags belong to the
-- revision; Product price and stock never do (S9).
--
-- ONE AVAILABILITY DERIVATION. core.v_scene_product_availability reads the
-- canonical Product and Variant columns -- the same purchasability
-- fn_create_order applies per line (0028: product PUBLISHED, Variant ACTIVE,
-- stock_count > 0) -- and stores nothing. It is the one place the rule lives
-- for Scenes; publish, re-evaluation and the public view all read it.
--
-- RE-EVALUATION RUNS IN THE TRANSACTION THAT CHANGES AVAILABILITY. There is no
-- transactional outbox in this system (register WRK-3) and the worker engine
-- is an open founder decision (K-3), so the design's
-- inventory.changed -> consumer -> Content path (S29) is realised inside the
-- database: an AFTER trigger on core.product_variant and core.product notes
-- each Product whose availability inputs a transaction changes, and a DEFERRED
-- constraint trigger re-evaluates every affected Scene once, at COMMIT.
-- Catalogue and Inventory code is unchanged and never writes Scene state; the
-- functions are Content's. After any transaction completes, no PUBLISHED +
-- PUBLIC Scene has zero available tagged Products.
--
-- EVERY changed Product is noted, tagged or not: a tag added by another
-- transaction while this one is open must still be found at COMMIT. Tag writers
-- and the COMMIT-time re-evaluation meet on a per-Product advisory lock
-- (fn_scene_tag_lock): writers take it shared before they tag, re-evaluation
-- takes it exclusive before it looks for affected Scenes. A tag committed first
-- is seen by re-evaluation's fresh query; a tag written later waits for the
-- commit, and its publish then sees the committed stock.
--
-- LOCK ORDER, so commerce is never deadlocked by a Scene. Every path takes its
-- Product-side locks first and Scene locks last: a commerce transaction holds
-- its Variant/Product row locks, then at COMMIT the Product advisory locks in
-- id order, then the Scene locks in id order. Draft edits take the advisory
-- locks (shared) before their one Scene lock; publish takes one Scene lock. No
-- Scene path takes a Product or Variant lock a commerce write conflicts with
-- (a tag INSERT's FK takes KEY SHARE on core.product, which stock and
-- visibility updates do not conflict with). Re-evaluation also locks Scenes
-- whose WORKING revision tags the Product, which serialises it with a
-- concurrent first publish: whichever commits second re-reads the other's
-- committed state (S54).
--
-- ENUM-SHAPED TEXT. The four state vocabularies are text with CHECK
-- constraints rather than new enum types, so this migration does not widen
-- ADU-DB-01 Appendix A ahead of the revision that must add these four tables
-- to Appendix B (WO-DISC-001 record, section 22).
-- ============================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- core.scene_post -- the stable root (S46)
-- ---------------------------------------------------------------------------
CREATE TABLE core.scene_post (
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 128 random bits, base64url: a public reference that is neither the
  -- internal id nor enumerable (S34, Appendix C).
  public_ref                     text NOT NULL DEFAULT rtrim(translate(
                                   encode(uuid_send(gen_random_uuid()), 'base64'),
                                   '+/', '-_'), '='),
  seller_id                      uuid NOT NULL,
  market_id                      uuid NOT NULL,
  publication_state              text NOT NULL DEFAULT 'DRAFT',
  visibility                     text NOT NULL DEFAULT 'PRIVATE',
  visibility_reason              text NULL,
  current_published_revision_id  uuid NULL,
  working_revision_id            uuid NULL,
  -- Optimistic concurrency for draft edits and publish (S18): If-Match names it.
  edit_version                   int NOT NULL DEFAULT 1,
  -- One step per publication or visibility transition (the event aggregate
  -- revision of scene_post.published / scene_post.visibility_changed).
  lifecycle_version              int NOT NULL DEFAULT 0,
  published_at                   timestamptz NULL,
  visibility_changed_at          timestamptz NULL,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT scene_post_public_ref_unique UNIQUE (public_ref),
  CONSTRAINT scene_post_public_ref_format CHECK (public_ref ~ '^[A-Za-z0-9_-]{22}$'),
  CONSTRAINT scene_post_id_seller UNIQUE (id, seller_id),
  -- The Market is the Seller's own (S30): the composite FK makes any other
  -- value unrepresentable.
  CONSTRAINT scene_post_seller_market FOREIGN KEY (seller_id, market_id)
    REFERENCES core.seller (id, market_id),
  CONSTRAINT scene_post_publication_state
    CHECK (publication_state IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT scene_post_visibility CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
  CONSTRAINT scene_post_visibility_reason CHECK (visibility_reason IN
    ('ALL_TAGGED_PRODUCTS_UNAVAILABLE', 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK')),
  CONSTRAINT scene_post_public_is_published CHECK (
    visibility = 'PRIVATE' OR (publication_state = 'PUBLISHED' AND visibility_reason IS NULL)),
  CONSTRAINT scene_post_reason_is_published_private CHECK (
    visibility_reason IS NULL OR (publication_state = 'PUBLISHED' AND visibility = 'PRIVATE')),
  CONSTRAINT scene_post_draft_never_published CHECK (
    (publication_state = 'DRAFT') = (current_published_revision_id IS NULL)),
  CONSTRAINT scene_post_draft_has_working_revision CHECK (
    publication_state <> 'DRAFT' OR working_revision_id IS NOT NULL),
  CONSTRAINT scene_post_published_at CHECK (
    (publication_state = 'DRAFT') = (published_at IS NULL)),
  CONSTRAINT scene_post_versions CHECK (edit_version >= 1 AND lifecycle_version >= 0)
);

CREATE INDEX idx_scene_post_seller
  ON core.scene_post (seller_id, publication_state, published_at DESC);
CREATE INDEX idx_scene_post_market_public
  ON core.scene_post (market_id, publication_state, visibility, published_at DESC);

COMMENT ON TABLE core.scene_post IS
  'ADU-SCN-01 v3.2 S46: the stable Scene root. publication_state (Seller '
  'intent) and visibility (current Buyer exposure, typed reason) are separate '
  'dimensions (S14). Lifecycle columns are written only by the Content '
  'functions in migration 0054 (fn_guard_scene_post).';

-- ---------------------------------------------------------------------------
-- core.scene_post_revision -- caption, image, author; immutable once published
-- ---------------------------------------------------------------------------
CREATE TABLE core.scene_post_revision (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_post_id            uuid NOT NULL,
  seller_id                uuid NOT NULL,
  version                  int NOT NULL,
  status                   text NOT NULL DEFAULT 'WORKING',
  caption                  text NULL,
  -- Server-minted object keys under scenes/{public_ref}/img/, never URLs
  -- (the product_image convention; check 1). The public origin comes from
  -- /v1/bootstrap.
  image_thumb_key          text NULL,
  image_card_key           text NULL,
  image_full_key           text NULL,
  author_account_id        uuid NOT NULL REFERENCES core.account (id),
  published_at             timestamptz NULL,
  published_by_account_id  uuid NULL REFERENCES core.account (id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT scene_post_revision_scene FOREIGN KEY (scene_post_id, seller_id)
    REFERENCES core.scene_post (id, seller_id),
  CONSTRAINT scene_post_revision_version UNIQUE (scene_post_id, version),
  CONSTRAINT scene_post_revision_id_scene UNIQUE (id, scene_post_id),
  CONSTRAINT scene_post_revision_id_seller UNIQUE (id, seller_id),
  CONSTRAINT scene_post_revision_version_positive CHECK (version >= 1),
  CONSTRAINT scene_post_revision_status CHECK (status IN ('WORKING', 'PUBLISHED')),
  CONSTRAINT scene_post_revision_published CHECK (
    (status = 'PUBLISHED') = (published_at IS NOT NULL AND published_by_account_id IS NOT NULL)),
  -- The design bounds the caption without a number (S20); 5000 is the
  -- repository's existing bound for Product description text.
  CONSTRAINT scene_post_revision_caption_bound CHECK (
    caption IS NULL OR char_length(caption) <= 5000),
  CONSTRAINT scene_post_revision_image_whole CHECK (
    num_nulls(image_thumb_key, image_card_key, image_full_key) IN (0, 3))
);

-- "at most one working revision" (S46/S47).
CREATE UNIQUE INDEX scene_post_revision_one_working
  ON core.scene_post_revision (scene_post_id) WHERE status = 'WORKING';

ALTER TABLE core.scene_post
  ADD CONSTRAINT scene_post_current_published_revision
    FOREIGN KEY (current_published_revision_id, id)
    REFERENCES core.scene_post_revision (id, scene_post_id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT scene_post_working_revision
    FOREIGN KEY (working_revision_id, id)
    REFERENCES core.scene_post_revision (id, scene_post_id) DEFERRABLE INITIALLY DEFERRED;

COMMENT ON TABLE core.scene_post_revision IS
  'ADU-SCN-01 v3.2 S17/S46: caption, image keys and author of one revision. '
  'A PUBLISHED revision is immutable (fn_guard_scene_post_revision); Product '
  'price and stock never belong to a revision.';

-- ---------------------------------------------------------------------------
-- core.scene_post_product -- revision -> Product tags (S23, S25, S46)
-- ---------------------------------------------------------------------------
CREATE TABLE core.scene_post_product (
  revision_id  uuid NOT NULL,
  seller_id    uuid NOT NULL,
  product_id   uuid NOT NULL,
  position     smallint NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT scene_post_product_pkey PRIMARY KEY (revision_id, product_id),
  CONSTRAINT scene_post_product_position UNIQUE (revision_id, position),
  CONSTRAINT scene_post_product_position_positive CHECK (position >= 1),
  CONSTRAINT scene_post_product_revision FOREIGN KEY (revision_id, seller_id)
    REFERENCES core.scene_post_revision (id, seller_id),
  -- SAME-SELLER IS STRUCTURAL (S25, SCN-INV-04): a tag row can only name a
  -- Product of the revision's own Seller. Not ON DELETE: a tagged Product is
  -- retained evidence and is withdrawn (unpublished), not destroyed (CATINV).
  CONSTRAINT scene_post_product_same_seller FOREIGN KEY (product_id, seller_id)
    REFERENCES core.product (id, seller_id)
);

-- Product -> Scene lookups for re-evaluation (S47).
CREATE INDEX idx_scene_post_product_product ON core.scene_post_product (product_id);

COMMENT ON TABLE core.scene_post_product IS
  'ADU-SCN-01 v3.2 S23: explicit revision -> Product tags with presentation '
  'order only. Same-Seller by composite FK; tags of a PUBLISHED revision are '
  'immutable. Current Product facts are composed at read time.';

-- ---------------------------------------------------------------------------
-- core.scene_post_transition -- lifecycle and visibility history (S46)
-- ---------------------------------------------------------------------------
CREATE TABLE core.scene_post_transition (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_post_id           uuid NOT NULL,
  seller_id               uuid NOT NULL,
  lifecycle_version       int NOT NULL,
  from_publication_state  text NOT NULL,
  to_publication_state    text NOT NULL,
  from_visibility         text NOT NULL,
  to_visibility           text NOT NULL,
  reason                  text NULL,
  revision_id             uuid NULL,
  -- NULL: the system re-evaluated availability; no Account acted.
  actor_account_id        uuid NULL REFERENCES core.account (id),
  decided_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT scene_post_transition_scene FOREIGN KEY (scene_post_id, seller_id)
    REFERENCES core.scene_post (id, seller_id),
  CONSTRAINT scene_post_transition_revision FOREIGN KEY (revision_id, scene_post_id)
    REFERENCES core.scene_post_revision (id, scene_post_id),
  -- Exactly one fact per lifecycle step: a re-run cannot write a second.
  CONSTRAINT scene_post_transition_once UNIQUE (scene_post_id, lifecycle_version),
  CONSTRAINT scene_post_transition_states CHECK (
    from_publication_state IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')
    AND to_publication_state IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')
    AND from_visibility IN ('PUBLIC', 'PRIVATE')
    AND to_visibility IN ('PUBLIC', 'PRIVATE')),
  CONSTRAINT scene_post_transition_reason CHECK (reason IN
    ('ALL_TAGGED_PRODUCTS_UNAVAILABLE', 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK'))
);

CREATE INDEX idx_scene_post_transition_scene
  ON core.scene_post_transition (scene_post_id, lifecycle_version);

COMMENT ON TABLE core.scene_post_transition IS
  'ADU-SCN-01 v3.2 S46: one row per publication or visibility transition '
  '(the durable scene_post.published / scene_post.visibility_changed fact, '
  'until an outbox exists: register WRK-3). Written only by the Content '
  'functions; adulis_app holds SELECT alone, which is stricter than '
  'append-only (check 5).';

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------
-- Lifecycle columns move only inside the Content functions below, which run as
-- adulis_migrate (SECURITY DEFINER). The application role can create a DRAFT
-- and edit drafts; it cannot publish, privatise or restore by UPDATE.
CREATE FUNCTION core.fn_scene_lifecycle_writer() RETURNS boolean
LANGUAGE sql STABLE SET search_path = core AS $fn$
  SELECT current_user = 'adulis_migrate'
      OR coalesce((SELECT rolsuper FROM pg_roles WHERE rolname = current_user), false)
$fn$;

CREATE FUNCTION core.fn_guard_scene_post() RETURNS trigger
LANGUAGE plpgsql SET search_path = core AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT core.fn_scene_lifecycle_writer() AND (
         NEW.publication_state <> 'DRAFT' OR NEW.visibility <> 'PRIVATE'
         OR NEW.visibility_reason IS NOT NULL OR NEW.current_published_revision_id IS NOT NULL
         OR NEW.lifecycle_version <> 0 OR NEW.published_at IS NOT NULL
         OR NEW.visibility_changed_at IS NOT NULL) THEN
      RAISE EXCEPTION 'a Scene is created as a private DRAFT'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- Identity and ownership are write-once for everyone (S11).
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.public_ref IS DISTINCT FROM OLD.public_ref
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.market_id IS DISTINCT FROM OLD.market_id THEN
    RAISE EXCEPTION 'scene_post identity, Seller and Market are write-once'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NOT core.fn_scene_lifecycle_writer() AND (
       NEW.publication_state IS DISTINCT FROM OLD.publication_state
       OR NEW.visibility IS DISTINCT FROM OLD.visibility
       OR NEW.visibility_reason IS DISTINCT FROM OLD.visibility_reason
       OR NEW.current_published_revision_id IS DISTINCT FROM OLD.current_published_revision_id
       OR NEW.lifecycle_version IS DISTINCT FROM OLD.lifecycle_version
       OR NEW.published_at IS DISTINCT FROM OLD.published_at
       OR NEW.visibility_changed_at IS DISTINCT FROM OLD.visibility_changed_at) THEN
    RAISE EXCEPTION 'Scene lifecycle columns are written only by the Content functions'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_guard_scene_post
  BEFORE INSERT OR UPDATE ON core.scene_post
  FOR EACH ROW EXECUTE FUNCTION core.fn_guard_scene_post();

CREATE FUNCTION core.fn_guard_scene_post_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = core AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'WORKING' AND NOT core.fn_scene_lifecycle_writer() THEN
      RAISE EXCEPTION 'a revision is created WORKING' USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'a published Scene revision is immutable' USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.scene_post_id IS DISTINCT FROM OLD.scene_post_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id OR NEW.version IS DISTINCT FROM OLD.version THEN
    RAISE EXCEPTION 'revision identity is write-once' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT core.fn_scene_lifecycle_writer() THEN
    RAISE EXCEPTION 'a revision is frozen only by publication' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER trg_guard_scene_post_revision
  BEFORE INSERT OR UPDATE OR DELETE ON core.scene_post_revision
  FOR EACH ROW EXECUTE FUNCTION core.fn_guard_scene_post_revision();

CREATE FUNCTION core.fn_guard_scene_post_product() RETURNS trigger
LANGUAGE plpgsql SET search_path = core AS $fn$
BEGIN
  -- FOR SHARE: a publish freezing this revision concurrently is waited for, so
  -- a tag can never slip into a revision as it becomes immutable.
  IF EXISTS (SELECT 1 FROM core.scene_post_revision r
              WHERE r.id IN (CASE WHEN TG_OP = 'INSERT' THEN NEW.revision_id ELSE OLD.revision_id END,
                             CASE WHEN TG_OP = 'UPDATE' THEN NEW.revision_id END)
                AND r.status = 'PUBLISHED'
                FOR SHARE) THEN
    RAISE EXCEPTION 'the tags of a published Scene revision are immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $fn$;

CREATE TRIGGER trg_guard_scene_post_product
  BEFORE INSERT OR UPDATE OR DELETE ON core.scene_post_product
  FOR EACH ROW EXECUTE FUNCTION core.fn_guard_scene_post_product();

-- ---------------------------------------------------------------------------
-- The one availability derivation (S26, CATINV S198)
-- ---------------------------------------------------------------------------
-- published  -- the Product is public commerce (visibility PUBLISHED; withdrawn,
--               restricted and moderation-unpublished Products are UNPUBLISHED)
-- in_stock   -- at least one ACTIVE Variant with sellable stock
-- available  -- both: "a currently purchasable in-stock Variant and not
--               withdrawn/restricted" (S1, S26)
CREATE VIEW core.v_scene_product_availability AS
SELECT p.id AS product_id,
       p.seller_id,
       p.market_id,
       (p.visibility = 'PUBLISHED') AS published,
       EXISTS (SELECT 1 FROM core.product_variant v
                WHERE v.product_id = p.id AND v.status = 'ACTIVE' AND v.stock_count > 0)
         AS in_stock,
       (p.visibility = 'PUBLISHED'
        AND EXISTS (SELECT 1 FROM core.product_variant v
                     WHERE v.product_id = p.id AND v.status = 'ACTIVE' AND v.stock_count > 0))
         AS available
  FROM core.product p;

COMMENT ON VIEW core.v_scene_product_availability IS
  'The single Scene derivation of Product availability from canonical '
  'Catalogue/Inventory columns (fn_create_order''s per-line purchasability). '
  'Stores nothing; there is no Scene-local stock.';

-- ---------------------------------------------------------------------------
-- Re-evaluation: ONE canonical path (S29, S54; WO-DISC-001 S17)
-- ---------------------------------------------------------------------------
-- Deterministic and idempotent: it reads the current published revision's tags
-- against current availability, and writes only on a real change. Only a
-- PUBLISHED Scene that is PUBLIC, or PRIVATE for an availability reason, is
-- touched, so restoration never undoes an independent private state.
-- Restoration also requires every other current gate (S27, S41, SCN-INV-08):
-- a suspended Seller or an inactive Market keeps the Scene PRIVATE, and the
-- Seller or Market change that clears the gate re-evaluates it (triggers below).
CREATE FUNCTION core.fn_scene_post_reevaluate(p_scene uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_scene       core.scene_post;
  v_tags        int;
  v_available   int;
  v_eligible    int;
  v_reason      text;
  v_to          text;
  v_transition  uuid;
  v_gates_ok    boolean;
BEGIN
  SELECT * INTO v_scene FROM core.scene_post WHERE id = p_scene FOR UPDATE;
  IF NOT FOUND OR v_scene.publication_state <> 'PUBLISHED' THEN
    RETURN 'UNCHANGED';
  END IF;

  -- A fresh statement after the lock: it sees every transaction that
  -- committed while this one waited.
  SELECT count(*),
         count(*) FILTER (WHERE a.available AND a.market_id = v_scene.market_id),
         count(*) FILTER (WHERE a.published AND a.market_id = v_scene.market_id)
    INTO v_tags, v_available, v_eligible
    FROM core.scene_post_product t
    JOIN core.v_scene_product_availability a ON a.product_id = t.product_id
   WHERE t.revision_id = v_scene.current_published_revision_id;

  SELECT s.status = 'ACTIVE' AND m.activation_state = 'ACTIVE' INTO v_gates_ok
    FROM core.seller s JOIN core.market m ON m.id = s.market_id
   WHERE s.id = v_scene.seller_id;

  -- The stock-specific reason when every tag is otherwise eligible and only
  -- stock is missing (S1); the general one otherwise.
  v_reason := CASE WHEN v_tags > 0 AND v_eligible = v_tags
                   THEN 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK'
                   ELSE 'ALL_TAGGED_PRODUCTS_UNAVAILABLE' END;

  IF v_available >= 1 AND v_scene.visibility = 'PRIVATE' AND v_gates_ok
     AND v_scene.visibility_reason IN
       ('ALL_TAGGED_PRODUCTS_UNAVAILABLE', 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK') THEN
    v_to := 'PUBLIC';
    v_reason := NULL;
  ELSIF v_available = 0 AND v_scene.visibility = 'PUBLIC' THEN
    v_to := 'PRIVATE';
  ELSIF v_available = 0 AND v_scene.visibility = 'PRIVATE'
        AND v_scene.visibility_reason IN ('ALL_TAGGED_PRODUCTS_UNAVAILABLE', 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK')
        AND v_scene.visibility_reason <> v_reason THEN
    -- Still private, for a different availability cause: keep the label true.
    UPDATE core.scene_post SET visibility_reason = v_reason, updated_at = now()
     WHERE id = p_scene;
    RETURN 'REASON_UPDATED';
  ELSE
    RETURN 'UNCHANGED';
  END IF;

  UPDATE core.scene_post
     SET visibility = v_to,
         visibility_reason = v_reason,
         lifecycle_version = lifecycle_version + 1,
         visibility_changed_at = now(),
         updated_at = now()
   WHERE id = p_scene;

  INSERT INTO core.scene_post_transition
    (scene_post_id, seller_id, lifecycle_version, from_publication_state,
     to_publication_state, from_visibility, to_visibility, reason, revision_id)
  VALUES (p_scene, v_scene.seller_id, v_scene.lifecycle_version + 1, 'PUBLISHED',
          'PUBLISHED', v_scene.visibility, v_to,
          coalesce(v_reason, v_scene.visibility_reason),
          v_scene.current_published_revision_id)
  RETURNING id INTO v_transition;

  -- The Seller advisory notice (S29; NOTIF-01 SCENE_BECAME_PRIVATE /
  -- SCENE_BECAME_PUBLIC; in-app, no push provider). A notice failure never
  -- rolls back the canonical transition.
  BEGIN
    INSERT INTO core.notification
      (recipient_account_id, channel, template_key, locale, slots, suppressible)
    SELECT s.owner_account_id, 'IN_APP',
           CASE v_to WHEN 'PRIVATE' THEN 'SCENE_BECAME_PRIVATE' ELSE 'SCENE_BECAME_PUBLIC' END,
           m.default_locale::text,
           jsonb_build_object(
             'scene_post_id', p_scene,
             'public_ref', v_scene.public_ref,
             'seller_id', v_scene.seller_id,
             'reason', coalesce(v_reason, v_scene.visibility_reason),
             'transition_id', v_transition,
             'lifecycle_version', v_scene.lifecycle_version + 1),
           true
      FROM core.seller s
      JOIN core.market m ON m.id = s.market_id
     WHERE s.id = v_scene.seller_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'scene % visibility notice not written: %', p_scene, SQLERRM;
  END;

  RETURN v_to;
END $fn$;

-- Every Scene any of whose revisions tags one of the Products, plus the Scenes
-- noted directly (Seller and Market gate changes), locked once and in id
-- order, then re-evaluated. The match uses only rows a concurrent publish does
-- not change (the Scene id and the tag rows), never the moving revision
-- pointers: after a lock wait READ COMMITTED re-checks the locked row against
-- the join rows it first read, and a pointer predicate could then drop the
-- Scene. Over-matching is harmless: re-evaluation re-reads after the lock.
CREATE FUNCTION core.fn_scene_post_reevaluate_products(
  p_products uuid[], p_scenes uuid[] DEFAULT '{}')
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_scene uuid;
  v_n     int := 0;
BEGIN
  FOR v_scene IN
    SELECT sp.id
      FROM core.scene_post sp
     WHERE sp.id IN (SELECT r.scene_post_id
                       FROM core.scene_post_product t
                       JOIN core.scene_post_revision r ON r.id = t.revision_id
                      WHERE t.product_id = ANY (p_products))
        OR sp.id = ANY (p_scenes)
     ORDER BY sp.id
       FOR UPDATE OF sp
  LOOP
    PERFORM core.fn_scene_post_reevaluate(v_scene);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $fn$;

-- The per-Product advisory lock where tag writers and COMMIT-time
-- re-evaluation meet (header). Shared for writers, exclusive for
-- re-evaluation; always in Product id order; released at transaction end.
CREATE FUNCTION core.fn_scene_tag_lock(p_products uuid[], p_exclusive boolean)
RETURNS void
LANGUAGE plpgsql SET search_path = core AS $fn$
DECLARE
  v_product uuid;
BEGIN
  FOR v_product IN SELECT DISTINCT x FROM unnest(p_products) AS x ORDER BY x LOOP
    IF p_exclusive THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('core.scene_post_product:' || v_product::text, 0));
    ELSE
      PERFORM pg_advisory_xact_lock_shared(hashtextextended('core.scene_post_product:' || v_product::text, 0));
    END IF;
  END LOOP;
END $fn$;

-- Collector: note each Product whose availability inputs changed, once.
CREATE FUNCTION core.fn_scene_note_product_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_noted    text := coalesce(current_setting('adulis.scene_reevaluate', true), '');
  v_products uuid[];
  v_product  uuid;
BEGIN
  -- Separate branches: a record field is resolved only where it is read, and
  -- core.product has no product_id while core.product_variant has no
  -- visibility. The product triggers fire on UPDATE and DELETE, so OLD exists.
  IF TG_TABLE_NAME = 'product' THEN
    v_products := ARRAY[OLD.id];
  ELSIF TG_OP = 'INSERT' THEN
    v_products := ARRAY[NEW.product_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_products := ARRAY[OLD.product_id];
  ELSE
    v_products := ARRAY[OLD.product_id, NEW.product_id];
  END IF;
  FOREACH v_product IN ARRAY v_products LOOP
    IF position(v_product::text IN v_noted) = 0 THEN
      v_noted := v_noted || v_product::text || ',';
    END IF;
  END LOOP;
  PERFORM set_config('adulis.scene_reevaluate', v_noted, true);
  RETURN NULL;
END $fn$;

-- Processor: at COMMIT, the first firing locks the noted Products, then
-- re-evaluates every affected Scene, and clears the note; later firings in the
-- same transaction find it empty. Anything that is not a uuid is ignored.
CREATE FUNCTION core.fn_scene_reevaluate_noted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_noted    text := coalesce(current_setting('adulis.scene_reevaluate', true), '');
  v_scenes   text := coalesce(current_setting('adulis.scene_reevaluate_scenes', true), '');
  v_uuid     constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_products uuid[];
BEGIN
  IF v_noted <> '' OR v_scenes <> '' THEN
    PERFORM set_config('adulis.scene_reevaluate', '', true);
    PERFORM set_config('adulis.scene_reevaluate_scenes', '', true);
    v_products := ARRAY(
      SELECT DISTINCT x::uuid FROM unnest(string_to_array(v_noted, ',')) AS x WHERE x ~ v_uuid);
    PERFORM core.fn_scene_tag_lock(v_products, true);
    -- A separate statement after the locks: it sees every tag committed before them.
    PERFORM core.fn_scene_post_reevaluate_products(v_products, ARRAY(
      SELECT DISTINCT x::uuid FROM unnest(string_to_array(v_scenes, ',')) AS x WHERE x ~ v_uuid));
  END IF;
  RETURN NULL;
END $fn$;

-- Seller and Market gate changes: note that Seller's (or Market's) published
-- Scenes, so a gate that clears lets restoration happen, inside the same one
-- COMMIT sweep as everything else.
CREATE FUNCTION core.fn_scene_note_gate_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_noted text := coalesce(current_setting('adulis.scene_reevaluate_scenes', true), '');
  v_scene uuid;
BEGIN
  FOR v_scene IN
    SELECT sp.id FROM core.scene_post sp
     WHERE sp.publication_state = 'PUBLISHED'
       AND (CASE TG_TABLE_NAME WHEN 'seller' THEN sp.seller_id ELSE sp.market_id END) = NEW.id
  LOOP
    IF position(v_scene::text IN v_noted) = 0 THEN
      v_noted := v_noted || v_scene::text || ',';
    END IF;
  END LOOP;
  PERFORM set_config('adulis.scene_reevaluate_scenes', v_noted, true);
  RETURN NULL;
END $fn$;

-- UPDATE triggers fire only on a real change of an availability input, so a
-- price edit that rewrites status with its own value notes nothing.
CREATE TRIGGER trg_scene_note_variant_write
  AFTER INSERT OR DELETE ON core.product_variant
  FOR EACH ROW EXECUTE FUNCTION core.fn_scene_note_product_change();
CREATE TRIGGER trg_scene_note_variant_update
  AFTER UPDATE OF stock_count, status, product_id ON core.product_variant
  FOR EACH ROW
  WHEN (OLD.stock_count IS DISTINCT FROM NEW.stock_count
        OR OLD.status IS DISTINCT FROM NEW.status
        OR OLD.product_id IS DISTINCT FROM NEW.product_id)
  EXECUTE FUNCTION core.fn_scene_note_product_change();
CREATE CONSTRAINT TRIGGER trg_scene_reevaluate_variant_write
  AFTER INSERT OR DELETE ON core.product_variant
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION core.fn_scene_reevaluate_noted();
CREATE CONSTRAINT TRIGGER trg_scene_reevaluate_variant_update
  AFTER UPDATE OF stock_count, status, product_id ON core.product_variant
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.stock_count IS DISTINCT FROM NEW.stock_count
        OR OLD.status IS DISTINCT FROM NEW.status
        OR OLD.product_id IS DISTINCT FROM NEW.product_id)
  EXECUTE FUNCTION core.fn_scene_reevaluate_noted();

CREATE TRIGGER trg_scene_note_product_delete
  AFTER DELETE ON core.product
  FOR EACH ROW EXECUTE FUNCTION core.fn_scene_note_product_change();
CREATE TRIGGER trg_scene_note_product_update
  AFTER UPDATE OF visibility, market_id ON core.product
  FOR EACH ROW
  WHEN (OLD.visibility IS DISTINCT FROM NEW.visibility
        OR OLD.market_id IS DISTINCT FROM NEW.market_id)
  EXECUTE FUNCTION core.fn_scene_note_product_change();
CREATE CONSTRAINT TRIGGER trg_scene_reevaluate_product_delete
  AFTER DELETE ON core.product
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION core.fn_scene_reevaluate_noted();
CREATE CONSTRAINT TRIGGER trg_scene_reevaluate_product_update
  AFTER UPDATE OF visibility, market_id ON core.product
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.visibility IS DISTINCT FROM NEW.visibility
        OR OLD.market_id IS DISTINCT FROM NEW.market_id)
  EXECUTE FUNCTION core.fn_scene_reevaluate_noted();

CREATE TRIGGER trg_scene_note_seller_status
  AFTER UPDATE OF status ON core.seller
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION core.fn_scene_note_gate_change();
CREATE CONSTRAINT TRIGGER trg_scene_reevaluate_seller_status
  AFTER UPDATE OF status ON core.seller
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION core.fn_scene_reevaluate_noted();

CREATE TRIGGER trg_scene_note_market_activation
  AFTER UPDATE OF activation_state ON core.market
  FOR EACH ROW WHEN (OLD.activation_state IS DISTINCT FROM NEW.activation_state)
  EXECUTE FUNCTION core.fn_scene_note_gate_change();
CREATE CONSTRAINT TRIGGER trg_scene_reevaluate_market_activation
  AFTER UPDATE OF activation_state ON core.market
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (OLD.activation_state IS DISTINCT FROM NEW.activation_state)
  EXECUTE FUNCTION core.fn_scene_reevaluate_noted();

-- ---------------------------------------------------------------------------
-- Publication (S27, S32, S33): one transaction, every gate recomputed
-- ---------------------------------------------------------------------------
-- The caller has authorised the Account and checked If-Match under the same
-- row lock. Blockers are raised together as ONE restrict_violation whose
-- DETAIL lists every unsatisfied item -- the fn_publish_product shape, so the
-- API answers 409 PUBLICATION_BLOCKED with items[].
CREATE FUNCTION core.fn_scene_post_publish(p_scene uuid, p_seller uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $fn$
DECLARE
  v_scene     core.scene_post;
  v_revision  core.scene_post_revision;
  v_items     jsonb := '[]'::jsonb;
  v_tags      int;
  v_available int;
  v_seller    core.seller_status;
  v_market    core.market_activation_state;
BEGIN
  SELECT * INTO v_scene FROM core.scene_post
   WHERE id = p_scene AND seller_id = p_seller FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';
  END IF;
  IF v_scene.working_revision_id IS NULL OR v_scene.publication_state = 'ARCHIVED' THEN
    RAISE EXCEPTION 'nothing to publish'
      USING ERRCODE = 'restrict_violation',
            DETAIL = jsonb_build_object('reason', 'NO_WORKING_REVISION')::text;
  END IF;

  SELECT * INTO v_revision FROM core.scene_post_revision
   WHERE id = v_scene.working_revision_id FOR UPDATE;

  IF btrim(coalesce(v_revision.caption, '')) = '' THEN
    v_items := v_items || jsonb_build_object('code', 'PUBLICATION_BLOCKED', 'item', 'CAPTION_REQUIRED');
  END IF;
  IF v_revision.image_full_key IS NULL THEN
    v_items := v_items || jsonb_build_object('code', 'PUBLICATION_BLOCKED', 'item', 'MEDIA_MISSING');
  END IF;

  SELECT count(*), count(*) FILTER (WHERE a.available AND a.market_id = v_scene.market_id)
    INTO v_tags, v_available
    FROM core.scene_post_product t
    JOIN core.v_scene_product_availability a ON a.product_id = t.product_id
   WHERE t.revision_id = v_revision.id;

  IF v_tags = 0 THEN
    v_items := v_items || jsonb_build_object('code', 'PUBLICATION_BLOCKED', 'item', 'PRODUCT_TAG_REQUIRED');
  ELSE
    v_items := v_items || coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'code', 'PUBLICATION_BLOCKED',
               'item', CASE WHEN a.market_id <> v_scene.market_id
                            THEN 'PRODUCT_MARKET_MISMATCH' ELSE 'PRODUCT_NOT_ELIGIBLE' END,
               'product_id', t.product_id) ORDER BY t.position)
        FROM core.scene_post_product t
        JOIN core.v_scene_product_availability a ON a.product_id = t.product_id
       WHERE t.revision_id = v_revision.id
         AND (a.market_id <> v_scene.market_id OR NOT a.published)), '[]'::jsonb);
    IF v_available = 0 THEN
      v_items := v_items || jsonb_build_object('code', 'PUBLICATION_BLOCKED', 'item', 'NO_AVAILABLE_TAGGED_PRODUCT');
    END IF;
  END IF;

  -- A Scene never makes a Seller public (WO-DISC-001 S24): only a Seller that
  -- is already public commerce may publish one. Readiness is not duplicated.
  SELECT s.status, m.activation_state INTO v_seller, v_market
    FROM core.seller s JOIN core.market m ON m.id = s.market_id
   WHERE s.id = p_seller;
  IF v_seller <> 'ACTIVE' THEN
    v_items := v_items || jsonb_build_object('code', 'PUBLICATION_BLOCKED', 'item', 'SELLER_NOT_PUBLIC_ELIGIBLE');
  END IF;
  IF v_market <> 'ACTIVE' THEN
    v_items := v_items || jsonb_build_object('code', 'PUBLICATION_BLOCKED', 'item', 'MARKET_NOT_ACTIVE');
  END IF;

  IF jsonb_array_length(v_items) > 0 THEN
    RAISE EXCEPTION 'scene publication blocked'
      USING ERRCODE = 'restrict_violation', DETAIL = v_items::text;
  END IF;

  UPDATE core.scene_post_revision
     SET status = 'PUBLISHED', published_at = now(), published_by_account_id = p_actor,
         updated_at = now()
   WHERE id = v_revision.id;

  UPDATE core.scene_post
     SET publication_state = 'PUBLISHED',
         visibility = 'PUBLIC',
         visibility_reason = NULL,
         current_published_revision_id = v_revision.id,
         working_revision_id = NULL,
         published_at = coalesce(published_at, now()),
         visibility_changed_at = CASE WHEN visibility = 'PUBLIC' THEN visibility_changed_at ELSE now() END,
         lifecycle_version = lifecycle_version + 1,
         edit_version = edit_version + 1,
         updated_at = now()
   WHERE id = p_scene;

  INSERT INTO core.scene_post_transition
    (scene_post_id, seller_id, lifecycle_version, from_publication_state,
     to_publication_state, from_visibility, to_visibility, reason, revision_id,
     actor_account_id)
  VALUES (p_scene, p_seller, v_scene.lifecycle_version + 1, v_scene.publication_state,
          'PUBLISHED', v_scene.visibility, 'PUBLIC', NULL, v_revision.id, p_actor);

  RETURN jsonb_build_object(
    'publication_state', 'PUBLISHED',
    'visibility', 'PUBLIC',
    'published_revision_version', v_revision.version,
    'lifecycle_version', v_scene.lifecycle_version + 1,
    'edit_version', v_scene.edit_version + 1);
END $fn$;

-- ---------------------------------------------------------------------------
-- The central public read gate (S8, S21, S27, S35; WO-DISC-001 S8)
-- ---------------------------------------------------------------------------
-- Every Buyer-facing Scene read selects from this view and from nothing else.
-- It re-derives availability at read time (S21: a stored bit never authorises
-- on its own) and applies the Seller and Market gates. Moderation has no Scene
-- enforcement state yet; when it does, its gate joins here.
CREATE VIEW core.v_scene_post_public AS
SELECT sp.id,
       sp.public_ref,
       sp.seller_id,
       sp.market_id,
       sp.published_at,
       r.id       AS revision_id,
       r.version  AS revision_version,
       r.caption,
       r.image_thumb_key,
       r.image_card_key,
       r.image_full_key,
       s.handle   AS seller_handle,
       s.store_name AS seller_store_name
  FROM core.scene_post sp
  JOIN core.scene_post_revision r ON r.id = sp.current_published_revision_id
  JOIN core.seller s ON s.id = sp.seller_id
  JOIN core.market m ON m.id = sp.market_id
 WHERE sp.publication_state = 'PUBLISHED'
   AND sp.visibility = 'PUBLIC'
   AND s.status = 'ACTIVE'
   AND m.activation_state = 'ACTIVE'
   AND btrim(coalesce(r.caption, '')) <> ''
   AND r.image_full_key IS NOT NULL
   AND EXISTS (SELECT 1
                 FROM core.scene_post_product t
                 JOIN core.v_scene_product_availability a ON a.product_id = t.product_id
                WHERE t.revision_id = r.id
                  AND a.available AND a.market_id = sp.market_id);

COMMENT ON VIEW core.v_scene_post_public IS
  'ADU-SCN-01 v3.2 S21/S35: the one Buyer-facing Scene read gate. PUBLISHED + '
  'PUBLIC, Seller ACTIVE, Market ACTIVE, caption and image present, and at '
  'least one tagged Product available NOW. PRIVATE Scenes never pass.';

-- ---------------------------------------------------------------------------
-- Ownership and grants (the 0018/0020 function pattern; 0025, 0026)
-- ---------------------------------------------------------------------------
ALTER FUNCTION core.fn_scene_lifecycle_writer() OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_scene_tag_lock(uuid[], boolean) OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_scene_post_reevaluate(uuid) OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_scene_post_reevaluate_products(uuid[], uuid[]) OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_scene_note_gate_change() OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_scene_note_product_change() OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_scene_reevaluate_noted() OWNER TO adulis_migrate;
ALTER FUNCTION core.fn_scene_post_publish(uuid, uuid, uuid) OWNER TO adulis_migrate;

REVOKE ALL ON FUNCTION core.fn_scene_lifecycle_writer() FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_scene_tag_lock(uuid[], boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_scene_post_reevaluate(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_scene_post_reevaluate_products(uuid[], uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_scene_note_gate_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_scene_note_product_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_scene_reevaluate_noted() FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_scene_post_publish(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_guard_scene_post() FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_guard_scene_post_revision() FROM PUBLIC;
REVOKE ALL ON FUNCTION core.fn_guard_scene_post_product() FROM PUBLIC;

-- The guards call the writer test as whichever role writes the row.
GRANT EXECUTE ON FUNCTION core.fn_scene_lifecycle_writer() TO adulis_app, adulis_jobs;
GRANT EXECUTE ON FUNCTION core.fn_scene_post_publish(uuid, uuid, uuid) TO adulis_app;
-- Tag writers take the shared lock before they tag (ScenesService).
GRANT EXECUTE ON FUNCTION core.fn_scene_tag_lock(uuid[], boolean) TO adulis_app;

GRANT SELECT, INSERT, UPDATE ON core.scene_post TO adulis_app;
GRANT SELECT, INSERT, UPDATE ON core.scene_post_revision TO adulis_app;
GRANT SELECT, INSERT, DELETE ON core.scene_post_product TO adulis_app;
GRANT SELECT ON core.scene_post_transition TO adulis_app;
GRANT SELECT ON core.v_scene_product_availability, core.v_scene_post_public TO adulis_app;

GRANT SELECT ON core.scene_post, core.scene_post_revision, core.scene_post_product,
                core.scene_post_transition, core.v_scene_product_availability,
                core.v_scene_post_public TO adulis_readonly;

-- What the SECURITY DEFINER bodies and the two views read and write.
GRANT SELECT, UPDATE ON core.scene_post TO adulis_migrate;
GRANT SELECT, UPDATE ON core.scene_post_revision TO adulis_migrate;
GRANT SELECT ON core.scene_post_product TO adulis_migrate;
GRANT SELECT, INSERT ON core.scene_post_transition TO adulis_migrate;
GRANT SELECT ON core.product, core.product_variant, core.seller, core.market TO adulis_migrate;
GRANT SELECT ON core.v_scene_product_availability, core.v_scene_post_public TO adulis_migrate;
GRANT INSERT ON core.notification TO adulis_migrate;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'This migration is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
