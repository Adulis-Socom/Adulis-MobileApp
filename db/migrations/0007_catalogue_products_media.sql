-- ===========================================================================
-- MIGRATION 06 - CATEGORIES, ATTRIBUTES, PRODUCTS, VARIANTS, MEDIA, SOCIAL POSTS
--
-- Source: ADU-DB-01 v1.10 section 28 item 6. Transcribed from sections 9.1
-- through 9.6.
--
-- Twelve tables. None append-only. This migration carries three of the eleven
-- LOAD-BEARING ABSENCES of doctrine 11, and they are the reason to read it:
--
--   * core.product_image has NO original_key. "Uploaded originals are resized
--     on receipt and discarded" (section 9.5) - and the absence of a column is
--     a stronger guarantee than a deletion job. Appendix C check 1.
--   * There is no rendition table, because Adulis runs no server-side
--     transcoding pipeline in V1 (section 9.5).
--   * core.product.base_price_minor is a SEED, never a price (C1). Nothing
--     reads it but the variant-creation path. Appendix C check 3.
--
-- The file is 0007_ because node-pg-migrate orders by filename and migration
-- 05 is split across 0005 and 0006. Document numbering and file numbering
-- diverge by one from here on; every header states which document migration it
-- is.
-- ===========================================================================

-- Up Migration

-- ---------------------------------------------------------------------------
-- 1. core.category (section 9.1)
--
-- "id, parent, code, per-market availability. Launch set: fashion and
-- clothing, cosmetics, electronics (ADU-00 Launch Scope)."
--
-- NOT SEEDED. The launch set is named in ADU-00 rather than here, and section
-- 28 does not list a category seed in any migration. Reported.
-- ---------------------------------------------------------------------------
CREATE TABLE core.category (
  id         uuid PRIMARY KEY,
  parent_id  uuid NULL REFERENCES core.category(id),
  code       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- "per-market availability" - a category may exist and not be offered in a
-- market, which is what makes a new market configuration rather than code
-- (doctrine 6, section 19).
CREATE TABLE core.category_market_availability (
  category_id uuid NOT NULL REFERENCES core.category(id),
  market_id   uuid NOT NULL REFERENCES core.market(id),
  is_available boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (category_id, market_id)
);

COMMENT ON TABLE core.category_market_availability IS
  'Section 9.1 gives core.category "per-market availability" and does not say '
  'whether that is a column or a table. A column cannot express it: a category '
  'is one row and availability differs per market, so the relation is '
  'many-to-many. THIS TABLE IS NOT IN APPENDIX B, and it therefore moves check '
  '14 off 109. Reported rather than folded into core.category as an array, '
  'because an array of market ids is a foreign key the database cannot check.';

-- ---------------------------------------------------------------------------
-- 2. Structured attributes (section 9.1)
--
-- "Two layers, because section 7 uses attributes for two different jobs:
-- product-level descriptive attributes make the chatbot free (section 15.1
-- layer 0), and variant-defining attributes are what distinguishes one variant
-- from another."
-- ---------------------------------------------------------------------------
CREATE TABLE core.attribute_definition (
  id                  uuid PRIMARY KEY,
  category_id         uuid NOT NULL REFERENCES core.category(id),
  code                text NOT NULL,
  label_key           text NOT NULL,
  data_type           core.attribute_data_type NOT NULL,
  unit                text NULL,
  is_variant_defining boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attribute_definition_code_per_category UNIQUE (category_id, code),
  -- The anchor for variant_attribute_value's composite FK, which is what makes
  -- "only variant-defining definitions may carry a variant value" structural.
  CONSTRAINT attribute_definition_id_variant_defining UNIQUE (id, is_variant_defining)
);

COMMENT ON COLUMN core.attribute_definition.label_key IS
  'A locale catalogue key, never rendered prose. Section 23.1 makes translated '
  'strings per-locale resources assembled from named slots; an attribute label '
  'stored as English text is that invariant broken in the schema.';

CREATE TABLE core.attribute_option (
  id                      uuid PRIMARY KEY,
  attribute_definition_id uuid NOT NULL REFERENCES core.attribute_definition(id),
  code                    text NOT NULL,
  label_key               text NOT NULL,
  display_order           int NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attribute_option_code_per_definition UNIQUE (attribute_definition_id, code)
);

COMMENT ON TABLE core.attribute_option IS
  'Section 9.1 - permitted values for ENUM attributes. A lookup table rather '
  'than a Postgres enum, per section 4: enums are for closed sets that change '
  'with a MIGRATION, lookup tables for sets that change with CONFIGURATION, and '
  'a seller adding a colour must not require a deploy.';

-- ---------------------------------------------------------------------------
-- 3. core.product (section 9.2)
-- ---------------------------------------------------------------------------
CREATE TABLE core.product (
  id                   uuid PRIMARY KEY,
  seller_id            uuid NOT NULL REFERENCES core.seller(id),
  market_id            uuid NOT NULL REFERENCES core.market(id),
  name                 text NOT NULL,
  description          text NULL,
  category_id          uuid NULL REFERENCES core.category(id),
  display_order        int NOT NULL DEFAULT 0,
  visibility           core.product_visibility NOT NULL DEFAULT 'DRAFT',
  base_price_minor     bigint NOT NULL CHECK (base_price_minor >= 0),
  base_price_currency  core.currency_code NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  published_at         timestamptz NULL,
  unpublished_reason   core.unpublished_reason NULL,

  -- "UNIQUE (id, seller_id) - the anchor for every composite FK below."
  CONSTRAINT product_id_seller UNIQUE (id, seller_id),

  -- INVARIANT (section 9.2) - on downgrade, products above the limit are
  -- UNPUBLISHED, never deleted. unpublished_reason records which of the four
  -- causes applied, "so that the seller's own choice and a system action are
  -- distinguishable".
  CONSTRAINT unpublished_reason_only_when_unpublished CHECK (
    unpublished_reason IS NULL OR visibility = 'UNPUBLISHED'
  )
);

CREATE INDEX idx_product_storefront ON core.product (seller_id, visibility, display_order);
CREATE INDEX idx_product_name_trgm  ON core.product USING gin (name gin_trgm_ops);

COMMENT ON COLUMN core.product.base_price_minor IS
  'C1 - A SEED VALUE, NOT A PRICE. It is copied into a new variant at creation '
  'and read by nothing else: no order, reservation, cart line or storefront '
  'render reads it. "A grep for base_price outside the variant-creation '
  'function should return nothing, which is check 3 in Appendix C." Price lives '
  'on core.product_variant, because a seller must be able to charge more for XL '
  'than for S - in fashion, cosmetics and electronics, the three launch '
  'categories.';

CREATE TABLE core.product_attribute_value (
  product_id              uuid NOT NULL REFERENCES core.product(id) ON DELETE CASCADE,
  attribute_definition_id uuid NOT NULL REFERENCES core.attribute_definition(id),
  value_text              text NULL,
  value_number            numeric NULL,
  value_option_id         uuid NULL REFERENCES core.attribute_option(id),
  value_boolean           boolean NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, attribute_definition_id)
);

COMMENT ON TABLE core.product_attribute_value IS
  'Product-level descriptive attributes. FOUR TYPED VALUE COLUMNS RATHER THAN '
  'ONE text: core.attribute_data_type is TEXT, NUMBER, ENUM or BOOLEAN, and a '
  'single text column would make "size 40" and "size forty" the same fact to '
  'the database and different facts to the chatbot. Which column is populated '
  'follows the definition''s data_type. Section 9.1 does not name these '
  'columns; reported.';

-- ---------------------------------------------------------------------------
-- 4. core.product_variant (section 9.3)
-- ---------------------------------------------------------------------------
CREATE TABLE core.product_variant (
  id                 uuid PRIMARY KEY,
  product_id         uuid NOT NULL REFERENCES core.product(id),
  seller_id          uuid NOT NULL,          -- denormalised for the composite FK
  price_minor        bigint NOT NULL CHECK (price_minor >= 0),
  price_currency     core.currency_code NOT NULL,
  stock_count        int NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
  stock_confirmed_at timestamptz NULL,
  variant_key        text NOT NULL,
  status             text NOT NULL DEFAULT 'ACTIVE',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- The denormalised seller_id is only safe if it cannot disagree with the
  -- product's. This is what makes it true rather than assumed.
  CONSTRAINT variant_product_seller
    FOREIGN KEY (product_id, seller_id) REFERENCES core.product (id, seller_id),

  -- "UNIQUE (product_id, variant_key) where variant_key is the canonical
  -- sorted serialisation of the variant's defining attribute values... Two
  -- variants of one product cannot carry the same attribute combination - a
  -- data-entry error that otherwise surfaces as a buyer reserving the wrong
  -- thing."
  CONSTRAINT variant_key_per_product UNIQUE (product_id, variant_key),

  -- Composite FK anchors (section 9.3).
  CONSTRAINT variant_id_seller  UNIQUE (id, seller_id),
  CONSTRAINT variant_id_product UNIQUE (id, product_id)
);

CREATE INDEX idx_variant_by_product ON core.product_variant (product_id)
  INCLUDE (stock_count, stock_confirmed_at, price_minor);

COMMENT ON COLUMN core.product_variant.stock_count IS
  'NOT WRITABLE. Section 10.1: maintained exclusively by the AFTER INSERT '
  'trigger on core.stock_event, with a BEFORE UPDATE guard on this table that '
  'raises if the value changed and the change did not come from that trigger. '
  'Both arrive in migration 07. CHECK (stock_count >= 0) then makes '
  'over-selling a TRANSACTION FAILURE rather than a negative number.';

COMMENT ON COLUMN core.product_variant.variant_key IS
  'The canonical sorted serialisation of the variant''s defining attribute '
  'values, "written by a trigger" (section 9.3). THE TRIGGER IS NOT BUILT: the '
  'serialisation format is named and never specified, and two implementations '
  'that sort or separate differently produce different keys for one variant. '
  'Written by the application until v1.11 states the format. Reported.';

CREATE TABLE core.variant_attribute_value (
  variant_id              uuid NOT NULL REFERENCES core.product_variant(id) ON DELETE CASCADE,
  attribute_definition_id uuid NOT NULL,
  is_variant_defining     boolean NOT NULL DEFAULT true,
  value_text              text NULL,
  value_number            numeric NULL,
  value_option_id         uuid NULL REFERENCES core.attribute_option(id),
  value_boolean           boolean NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, attribute_definition_id),

  -- INVARIANT (section 9.1) - "only definitions with is_variant_defining =
  -- true, enforced by a composite FK". The local column is pinned true by the
  -- CHECK; the composite FK makes the definition agree.
  CONSTRAINT variant_value_is_variant_defining CHECK (is_variant_defining),
  CONSTRAINT variant_value_definition_is_variant_defining
    FOREIGN KEY (attribute_definition_id, is_variant_defining)
    REFERENCES core.attribute_definition (id, is_variant_defining)
);

-- ---------------------------------------------------------------------------
-- 5. Media (section 9.5)
-- ---------------------------------------------------------------------------
CREATE TABLE core.product_image (
  id          uuid PRIMARY KEY,
  product_id  uuid NOT NULL REFERENCES core.product(id) ON DELETE CASCADE,
  position    int NOT NULL CHECK (position BETWEEN 1 AND 5),
  thumb_key   text NOT NULL,
  card_key    text NOT NULL,
  full_key    text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  -- "UNIQUE (product_id, position) caps images at five (section 7.4) as a
  -- STRUCTURAL FACT" - five positions, five rows, no counting logic anywhere.
  CONSTRAINT product_image_position UNIQUE (product_id, position)
);

-- Appendix C check 1 forbids the three column names that would mean an original
-- was kept. They are deliberately NOT written into the COMMENT ON below: a
-- COMMENT body is a string literal and therefore executable text, so the check
-- harness keeps it - correctly, because dynamic DDL can hide in a literal. Only
-- `--` comments are stripped. This is the same trap check 15 hit in Tier 1, one
-- level down: a grep-enforced invariant is tripped by the prose that explains
-- it, and the fix is to explain it where the grep does not look.
--
-- The invariant, in full: section 9.5 requires that uploaded originals are
-- resized on receipt and discarded, and the guarantee is the ABSENCE of a
-- column to hold one - a stronger guarantee than a deletion job, and the same
-- reasoning that keeps an image column off verification.identity_attestation.
-- The three keys on this table are derivative renditions.
COMMENT ON TABLE core.product_image IS
  'INVARIANT (section 9.5) - uploaded originals are resized on receipt and '
  'DISCARDED, and the guarantee is that this table has nowhere to put one. '
  'The three keys here are derivative renditions. Adding a column for the '
  'upload as received would remove the guarantee silently, which is what '
  'Appendix C check 1 exists to catch - see the note above it for why that '
  'check cannot be explained inside this string.';

CREATE TABLE core.product_video (
  id               uuid PRIMARY KEY,
  product_id       uuid NOT NULL UNIQUE REFERENCES core.product(id) ON DELETE CASCADE,
  key              text NOT NULL,
  duration_seconds int NOT NULL CHECK (duration_seconds <= 30),
  height_px        int NOT NULL CHECK (height_px <= 480),
  bytes            bigint NOT NULL CHECK (bytes >= 0),
  uploaded_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.product_video IS
  'INVARIANT (section 9.5) - Adulis runs NO server-side transcoding pipeline in '
  'V1. No rendition table, no transcode job type. "A single progressive-download '
  'rendition, which is one row" - and product_id UNIQUE is what makes it one '
  'clip per product rather than a convention.';

CREATE TABLE core.media_lifecycle (
  object_key  text PRIMARY KEY,
  class       core.media_class NOT NULL,
  purge_after timestamptz NOT NULL,
  reason      text NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_lifecycle_due ON core.media_lifecycle (purge_after);

COMMENT ON TABLE core.media_lifecycle IS
  'INVARIANT (section 9.5) - media has a lifecycle policy. "Storage that only '
  'ever grows is a cost curve, not a bug - which is why it needs a table rather '
  'than good intentions." The media.lifecycle job (section 24) reads it daily.';

-- ---------------------------------------------------------------------------
-- 6. Social posts (section 9.6)
-- ---------------------------------------------------------------------------
CREATE TABLE core.social_post (
  id                uuid PRIMARY KEY,
  platform          core.platform NOT NULL,
  canonical_post_id text NOT NULL,
  status            core.social_post_status NOT NULL DEFAULT 'UNKNOWN',
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_post_canonical UNIQUE (platform, canonical_post_id)
);

COMMENT ON TABLE core.social_post IS
  'Matching is on canonical_post_id, NEVER the URL string. "Shortened and '
  'redirecting URLs are resolved before matching - TikTok share links are '
  'usually shortened, and matching the raw string fails most of the time. The '
  'service performs the redirect chain; the database stores only the canonical '
  'result." status is set by the social_post.availability_check job; what '
  'happens to a product whose post disappears is ADU-VAL-01 item 3.12 and is '
  'deliberately open - the schema is neutral because it is a policy on this '
  'column rather than a migration.';

CREATE TABLE core.product_social_post (
  product_id     uuid NOT NULL,
  seller_id      uuid NOT NULL,
  social_post_id uuid NOT NULL REFERENCES core.social_post(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, social_post_id),
  -- The seller on the link must be the seller on the product, or "a pasted
  -- post link resolves only within the seller who tagged it" is a service
  -- check rather than a fact.
  CONSTRAINT product_social_post_product_seller
    FOREIGN KEY (product_id, seller_id) REFERENCES core.product (id, seller_id)
);

CREATE INDEX idx_product_social_post_by_post ON core.product_social_post (social_post_id);

COMMENT ON TABLE core.product_social_post IS
  'INVARIANT (section 9.6) - one post link may be attached to MANY products by '
  'the same seller. "It is a join table, so it cannot assume otherwise." '
  'INVARIANT - a pasted post link resolves only within the seller who tagged '
  'it: where more than one distinct seller has claimed a post the resolution '
  'function returns NOTHING and queues a POST_LINK_CONFLICT moderation item. '
  '"A reseller using someone else''s content is a moderation question, not a '
  'search result." The resolution function itself is not built - see the note '
  'at the end of this migration.';

-- ---------------------------------------------------------------------------
-- 7. FOUR FUNCTIONS SECTION 9 NAMES AND DOES NOT DEFINE
--
-- Section 9.4 gives fn_publication_readiness a signature and elides its body
-- (`AS $$ ... $$`). fn_publish_product, the storefront search function and the
-- post-link resolution function are named in prose with no signature at all.
--
--   core.fn_publication_readiness(p_seller_id uuid)
--       RETURNS TABLE (item text, satisfied boolean, resolving_action text)
--   core.fn_publish_product(...)          - calls billing.fn_effective_limit
--   storefront search                     - takes a seller_id, no cross-seller path
--   post-link resolution                  - returns nothing on a cross-seller conflict
--
-- NONE IS BUILT. Work order T2 section 4 rule 2: transcribe, do not design.
-- fn_publish_product additionally depends on billing.fn_effective_limit, which
-- section 18.3 also elides and which migration 14 creates. The nine readiness
-- items are enumerated in ADU-API-01 v1.6 section 7.1a, so the RESULT SET is
-- specified even though the query is not - which is what makes this a gap worth
-- reporting rather than an open design question.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  core.category,
  core.category_market_availability,
  core.attribute_definition,
  core.attribute_option,
  core.product,
  core.product_attribute_value,
  core.product_variant,
  core.variant_attribute_value,
  core.product_image,
  core.product_video,
  core.media_lifecycle,
  core.social_post,
  core.product_social_post
TO adulis_app;

GRANT SELECT ON
  core.category,
  core.category_market_availability,
  core.attribute_definition,
  core.attribute_option,
  core.product,
  core.product_attribute_value,
  core.product_variant,
  core.variant_attribute_value,
  core.product_image,
  core.product_video,
  core.media_lifecycle,
  core.social_post,
  core.product_social_post
TO adulis_readonly;

-- Down Migration

DO $down$
BEGIN
  RAISE EXCEPTION
    'Migration 06 is not reversible. Roll forward with a new migration.'
    USING ERRCODE = 'restrict_violation';
END $down$;
