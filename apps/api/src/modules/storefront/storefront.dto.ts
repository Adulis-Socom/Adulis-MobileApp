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

/** GET /v1/storefronts/{handle}/products: at most 100 PUBLISHED Products, unavailable ones included. */
export class StorefrontProductListDto {
  @ApiProperty({ type: [StorefrontProductListItemDto] }) data!: StorefrontProductListItemDto[];
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
