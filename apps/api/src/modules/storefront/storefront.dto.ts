import { ApiProperty } from '@nestjs/swagger';

/**
 * GET /v1/storefronts/{handle}/products/{slug} -- the public Product read (WO-005).
 *
 * The route returned these fields with no schema, so the generated client had no
 * type for them. This DTO documents them as they are, plus two additive fields:
 * `available` (the Catalogue derivation, core.v_scene_product_availability --
 * Product PUBLISHED and an ACTIVE Variant in stock -- AND an ACTIVE Seller, the
 * gates fn_create_order applies) and `seller` (the public identity of the Seller
 * in the URL). The price is the Variants' (`variants[].price_minor`):
 * base_price_minor is the creation seed, not a price (DB-01 C1). Money is
 * integer minor units, as on every other public read. The internal ids stay for
 * compatibility and for future Cart lines; none of them is ever a URL segment
 * (the Product is addressed by handle + slug).
 */

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
}

export class StorefrontProductAttributeDto {
  @ApiProperty({ description: 'Attribute definition code.' }) attribute!: string;
  @ApiProperty({ type: String, nullable: true, description: 'Option code, or the typed value as text.' })
  value!: string | null;
}

export class StorefrontProductImageDto {
  @ApiProperty({ type: 'integer', minimum: 1 }) position!: number;
  @ApiProperty({ description: 'Object key; resolve against bootstrap media_public_origin.' })
  thumb_key!: string;
  @ApiProperty() card_key!: string;
  @ApiProperty() full_key!: string;
}

export class StorefrontProductDto {
  @ApiProperty({ format: 'uuid', description: 'Internal identity; the Product is addressed by handle + slug.' })
  id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'The creation seed, not a price (DB-01 C1). The prices are variants[].price_minor.',
  })
  base_price_minor!: number;
  @ApiProperty() base_price_currency!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) category_id!: string | null;
  @ApiProperty({
    description:
      'False: show "Currently unavailable" and no purchase action. Product PUBLISHED, an ACTIVE Variant in stock and an ACTIVE Seller, read now.',
  })
  available!: boolean;
  @ApiProperty({ type: StorefrontProductSellerDto }) seller!: StorefrontProductSellerDto;
  @ApiProperty({ type: [StorefrontProductVariantDto] }) variants!: StorefrontProductVariantDto[];
  @ApiProperty({ type: [StorefrontProductAttributeDto] }) attributes!: StorefrontProductAttributeDto[];
  @ApiProperty({ type: [StorefrontProductImageDto], description: 'In presentation order.' })
  images!: StorefrontProductImageDto[];
}
