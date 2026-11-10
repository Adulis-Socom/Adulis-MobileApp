import { ApiProperty } from '@nestjs/swagger';

/**
 * The public Catalogue reads (WO-005, WO-CAT-001). Every price and availability field
 * below comes from ONE projection (modules/catalogue/public-projection.ts), so the
 * Product detail, the Storefront list, Seller-scoped search, post-link resolution and
 * Scene tags agree:
 *
 * - price_min_minor / price_max_minor / price_currency: the lowest and highest price
 *   among the Product's ACTIVE Variants (price lives on the Variant, CATINV-01 :364),
 *   in stock or not (founder ruling OVN-072). Null when there is no ACTIVE Variant or
 *   the ACTIVE Variants are not all priced in the Market's currency: no current price,
 *   never a fallback. Show one amount when min = max, else "min - max".
 * - base_price_minor / base_price_currency: the creation seed (DB-01 C1), NEVER a price.
 *   Kept for compatibility only.
 * - available: the Product is PUBLISHED, its Seller and Market are ACTIVE, and at least
 *   one ACTIVE Variant is in stock and priced in the Market's currency, read now.
 *
 * Money is integer minor units. Internal ids stay for compatibility and future Cart
 * lines; none is ever a URL segment (a Product is addressed by handle + slug).
 */

const SEED = 'The creation seed, NEVER a price (DB-01 C1); kept for compatibility. Show price_min_minor..price_max_minor.';
const PRICE_MIN = "Lowest current price among the Product's ACTIVE Variants (in stock or not). Null: no current price (no ACTIVE Variant, or not all priced in the Market's currency).";
const PRICE_MAX = 'Highest current ACTIVE Variant price; equal to price_min_minor when every ACTIVE Variant costs the same.';
const AVAILABLE = 'False: show "Currently unavailable" and no purchase action. PUBLISHED, Seller and Market ACTIVE, and an ACTIVE Variant in stock in the Market currency, read now.';

/** The fields every public Product summary carries. */
export class PublicProductSummaryDto {
  @ApiProperty({ format: 'uuid', description: 'Internal identity (future Cart lines); never a URL segment.' })
  id!: string;
  @ApiProperty({ description: 'Product route: /v1/storefronts/{handle}/products/{slug}.' }) slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: 'integer', minimum: 0, description: SEED }) base_price_minor!: number;
  @ApiProperty({ description: 'Currency of the seed.' }) base_price_currency!: string;
  @ApiProperty({ type: 'integer', minimum: 0, nullable: true, description: PRICE_MIN })
  price_min_minor!: number | null;
  @ApiProperty({ type: 'integer', minimum: 0, nullable: true, description: PRICE_MAX })
  price_max_minor!: number | null;
  @ApiProperty({ type: String, nullable: true, description: 'ISO currency of the price span; null with it.' })
  price_currency!: string | null;
  @ApiProperty({ description: AVAILABLE }) available!: boolean;
}

export class StorefrontProductListItemDto extends PublicProductSummaryDto {
  @ApiProperty({ type: 'integer', description: "The Seller's display order (the list's order)." })
  display_order!: number;
  @ApiProperty({ type: String, nullable: true, description: 'First image card key; resolve against bootstrap media_public_origin.' })
  image_key!: string | null;
}

/** GET /v1/storefronts/{handle}/products: PUBLISHED Products in the Seller's order, unavailable ones included, a page at a time. */
export class StorefrontProductListDto {
  @ApiProperty({ type: [StorefrontProductListItemDto] }) data!: StorefrontProductListItemDto[];
  @ApiProperty({ type: String, nullable: true, description: 'Opaque; pass as `cursor` for the next page. Null: the end.' })
  next_cursor!: string | null;
}

/** GET /v1/storefronts/{handle}/search: at most 25, one Seller only. */
export class StorefrontSearchResultListDto {
  @ApiProperty({ type: [PublicProductSummaryDto] }) data!: PublicProductSummaryDto[];
}

export class PostLinkProductDto extends PublicProductSummaryDto {
  @ApiProperty({ description: 'The owning Seller handle (the Product route).' }) seller_handle!: string;
}

/** POST /v1/post-links/resolve: at most 25; an unknown link is an empty list. */
export class PostLinkProductListDto {
  @ApiProperty({ type: [PostLinkProductDto] }) data!: PostLinkProductDto[];
}

/** GET /v1/storefronts/{handle}/products/{slug}. */

export class StorefrontProductSellerDto {
  @ApiProperty() handle!: string;
  @ApiProperty() store_name!: string;
}

export class StorefrontProductVariantDto {
  @ApiProperty({ format: 'uuid', description: 'Variant identity (future Cart lines); never a URL segment.' })
  id!: string;
  @ApiProperty() variant_key!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) price_minor!: number;
  @ApiProperty() price_currency!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) stock_count!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) stock_confirmed_at!: string | null;
  @ApiProperty({ description: 'Only ACTIVE Variants are listed.' }) status!: string;
  @ApiProperty({
    description:
      'This option can be bought now: the Product is available-eligible (PUBLISHED, Seller and Market ACTIVE) and this Variant is ACTIVE, in stock and priced in the Market currency. Never true while the Product is unavailable. Show it; do not derive it from stock_count.',
  })
  available!: boolean;
}

/**
 * One descriptive attribute (OVN-075). `attribute` and `value` are CODES (machine
 * identifiers), never Buyer copy; the governed display references are the locale catalogue
 * keys `label_key` and, for an ENUM, `value_label_key`. A client renders an attribute only
 * when its catalogue resolves the keys it needs, and omits it otherwise.
 */
export class StorefrontProductAttributeDto {
  @ApiProperty({ description: 'Attribute definition code (machine identifier, not copy).' }) attribute!: string;
  @ApiProperty({ description: "Locale catalogue key of the attribute's display name." }) label_key!: string;
  @ApiProperty({ enum: ['TEXT', 'NUMBER', 'ENUM', 'BOOLEAN'], description: 'Which typed value `value` carries.' })
  data_type!: 'TEXT' | 'NUMBER' | 'ENUM' | 'BOOLEAN';
  @ApiProperty({ type: String, nullable: true, description: 'Unit code for a NUMBER (machine identifier), else null.' })
  unit!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'ENUM: the option code. TEXT: the Seller-authored text. NUMBER/BOOLEAN: the value as text.',
  })
  value!: string | null;
  @ApiProperty({ type: String, nullable: true, description: "ENUM only: locale catalogue key of the option's display name." })
  value_label_key!: string | null;
}

export class StorefrontProductImageDto {
  @ApiProperty({ type: 'integer', minimum: 1 }) position!: number;
  @ApiProperty({ description: 'Object key; resolve against bootstrap media_public_origin.' })
  thumb_key!: string;
  @ApiProperty() card_key!: string;
  @ApiProperty() full_key!: string;
}

export class StorefrontProductDto extends PublicProductSummaryDto {
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) category_id!: string | null;
  @ApiProperty({ type: StorefrontProductSellerDto }) seller!: StorefrontProductSellerDto;
  @ApiProperty({ type: [StorefrontProductVariantDto] }) variants!: StorefrontProductVariantDto[];
  @ApiProperty({ type: [StorefrontProductAttributeDto] }) attributes!: StorefrontProductAttributeDto[];
  @ApiProperty({ type: [StorefrontProductImageDto], description: 'In presentation order.' })
  images!: StorefrontProductImageDto[];
}

// ---------------------------------------------------------------- WO-006 Seller Profile

export class StorefrontStatsDto {
  @ApiProperty({ enum: ['NEW', 'ESTABLISHED', 'TRUSTED'], description: 'Public Trust level (core.trust_level).' })
  level!: 'NEW' | 'ESTABLISHED' | 'TRUSTED';
  @ApiProperty({ type: 'integer' }) completed_handoff_count!: number;
  @ApiProperty({ type: String, nullable: true, description: 'Decimal fraction as text, or null. No denominator is exposed: do not present as a percentage claim.' })
  cancellation_rate!: string | null;
  @ApiProperty({ type: String, nullable: true }) confirmation_rate!: string | null;
  @ApiProperty({ type: String, nullable: true }) scan_completion_rate!: string | null;
  @ApiProperty({ type: 'integer' }) unresolved_claim_count!: number;
  @ApiProperty({ type: 'integer' }) missed_confirmation_windows!: number;
}

export class StorefrontAvailabilityDto {
  @ApiProperty({ description: "Whether the Seller is open now (the server's derivation; never computed by a client)." })
  is_open!: boolean;
  @ApiProperty({ description: 'Reason code of the derivation.' }) reason!: string;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
}

export class ReviewBadgeCountsDto {
  @ApiProperty({ type: 'integer' }) CLAIM_UPHELD!: number;
  @ApiProperty({ type: 'integer' }) VERIFIED_HANDOFF!: number;
  @ApiProperty({ type: 'integer' }) CONFIRMED_BY_BUYER!: number;
  @ApiProperty({ type: 'integer' }) UNVERIFIED!: number;
}

export class ReviewSummaryDto {
  @ApiProperty({ type: 'integer', description: 'Seller-service reviews.' }) count!: number;
  @ApiProperty({ type: Number, nullable: true, description: 'Arithmetic mean of seller_rating (1-5), rounded once to 1 decimal; null with no review. Show as is.' })
  average_rating!: number | null;
  @ApiProperty({ type: ReviewBadgeCountsDto, description: 'Counts by the stored review badge (evidence tier).' })
  badge_counts!: ReviewBadgeCountsDto;
}

/** GET /v1/storefronts/{handle}: the public Seller, one round trip (S3.1). */
export class StorefrontDto {
  @ApiProperty({ format: 'uuid', description: 'Internal identity; the Seller is addressed by handle.' }) seller_id!: string;
  @ApiProperty() store_name!: string;
  @ApiProperty() handle!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'CLOSING', 'BILLING_SUSPENDED'] }) status!: string;
  @ApiProperty({ description: 'Date the Seller joined Adulis (YYYY-MM-DD, UTC).' }) member_since!: string;
  @ApiProperty({ type: StorefrontStatsDto, nullable: true }) stats!: StorefrontStatsDto | null;
  @ApiProperty({ type: StorefrontAvailabilityDto, nullable: true }) availability!: StorefrontAvailabilityDto | null;
  @ApiProperty({ type: ReviewSummaryDto }) review_summary!: ReviewSummaryDto;
  @ApiProperty({
    type: [String],
    enum: ['BUYER_COLLECTION', 'SELLER_DELIVERY', 'COURIER_DELIVERY'],
    description: 'Active fulfilment methods, as codes (render with catalogue labels).',
  })
  fulfilment_methods!: string[];
}

export class SellerSceneImageDto {
  @ApiProperty() thumb_key!: string;
  @ApiProperty() card_key!: string;
}

export class SellerSceneDto {
  @ApiProperty({ description: 'Scene route: /v1/scene-posts/{publicRef}.' }) public_ref!: string;
  @ApiProperty({ format: 'date-time' }) published_at!: string;
  @ApiProperty({ description: 'Caption excerpt (140 graphemes).' }) caption!: string;
  @ApiProperty() caption_truncated!: boolean;
  @ApiProperty({ type: SellerSceneImageDto }) image!: SellerSceneImageDto;
}

/** GET /v1/storefronts/{handle}/scenes. */
export class SellerSceneListDto {
  @ApiProperty({ type: [SellerSceneDto] }) data!: SellerSceneDto[];
  @ApiProperty({ type: String, nullable: true, description: 'Opaque; null at the end.' }) next_cursor!: string | null;
}

export class StorefrontReviewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 5, description: 'Seller service, 1-5.' }) seller_rating!: number;
  @ApiProperty({ type: String, nullable: true }) body!: string | null;
  @ApiProperty({ enum: ['CLAIM_UPHELD', 'VERIFIED_HANDOFF', 'CONFIRMED_BY_BUYER', 'UNVERIFIED'], description: 'Evidence basis (S12).' })
  badge!: string;
  @ApiProperty({ format: 'date-time' }) published_at!: string;
}

/** GET /v1/storefronts/{handle}/reviews. */
export class StorefrontReviewListDto {
  @ApiProperty({ type: [StorefrontReviewDto] }) data!: StorefrontReviewDto[];
  @ApiProperty({ type: String, nullable: true, description: 'Opaque; null at the end.' }) next_cursor!: string | null;
}
