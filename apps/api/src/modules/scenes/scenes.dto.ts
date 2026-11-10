import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * OpenAPI shapes for the Scene Post contracts (WO-DISC-001 S37). Wire names
 * keep the canonical "scene post"; Buyer-facing copy says "Scene" (R-01).
 * Seller management and public representations are separate types, so no
 * management field can reach a public response by sharing a class.
 */

const PUBLICATION_STATES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const VISIBILITIES = ['PUBLIC', 'PRIVATE'];
const VISIBILITY_REASONS = ['ALL_TAGGED_PRODUCTS_UNAVAILABLE', 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK'];

export class ScenePostImageDto {
  @ApiProperty({ description: 'Object key; resolve against bootstrap media_public_origin.' })
  thumb_key!: string;
  @ApiProperty() card_key!: string;
  @ApiProperty() full_key!: string;
}

// ---------------------------------------------------------------- requests

export class CreateScenePostBodyDto {
  @ApiPropertyOptional({ maxLength: 5000 }) caption?: string;
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: 40,
    description: 'Products of the same Seller, in presentation order.',
  })
  product_ids?: string[];
}

export class PatchScenePostDraftBodyDto {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 5000 }) caption?: string | null;
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: 40,
    description: 'Replaces every tag of the working revision, in presentation order.',
  })
  product_ids?: string[];
  @ApiPropertyOptional({
    type: ScenePostImageDto,
    nullable: true,
    description: 'Keys from POST .../image-uploads, after the bytes were PUT.',
  })
  image?: ScenePostImageDto | null;
}

export class SignedUploadDto {
  @ApiProperty({ format: 'uri', description: 'Short-lived presigned PUT; never stored.' }) url!: string;
  @ApiProperty() key!: string;
  @ApiProperty({ format: 'date-time' }) expires_at!: string;
}

export class ScenePostImageUploadsDto {
  @ApiProperty() thumb!: SignedUploadDto;
  @ApiProperty() card!: SignedUploadDto;
  @ApiProperty() full!: SignedUploadDto;
}

export class ScenePostImageUploadResponseDto {
  @ApiProperty({ type: ScenePostImageUploadsDto }) uploads!: ScenePostImageUploadsDto;
}

// --------------------------------------------------------- Seller management

export class ScenePostTagDto {
  @ApiProperty({ format: 'uuid' }) product_id!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) position!: number;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'The Product is public commerce (PUBLISHED).' }) published!: boolean;
  @ApiProperty({ description: 'At least one ACTIVE Variant has sellable stock.' }) in_stock!: boolean;
  @ApiProperty({ description: 'published AND in_stock: counts toward Scene visibility.' })
  available!: boolean;
}

export class ScenePostRevisionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) version!: number;
  @ApiProperty({ enum: ['WORKING', 'PUBLISHED'] }) status!: 'WORKING' | 'PUBLISHED';
  @ApiProperty({ type: String, nullable: true }) caption!: string | null;
  @ApiProperty({ type: ScenePostImageDto, nullable: true }) image!: ScenePostImageDto | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) published_at!: string | null;
  @ApiProperty({ type: [ScenePostTagDto] }) products!: ScenePostTagDto[];
  @ApiProperty({ type: 'integer', minimum: 0 }) tagged_product_count!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) available_tagged_product_count!: number;
}

export class SellerScenePostDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ description: 'Stable public reference: /v1/scene-posts/{public_ref}.' })
  public_ref!: string;
  @ApiProperty({ enum: PUBLICATION_STATES }) publication_state!: string;
  @ApiProperty({ enum: VISIBILITIES }) visibility!: string;
  @ApiProperty({
    enum: VISIBILITY_REASONS,
    nullable: true,
    description: 'Why a published Scene is PRIVATE. Management only; never public.',
  })
  visibility_reason!: string | null;
  @ApiProperty({
    description:
      'True when PRIVATE only for availability: it returns to PUBLIC by itself as soon as one tagged Product is available.',
  })
  restores_automatically!: boolean;
  @ApiProperty({ description: 'Whether a Buyer can open it right now (every public gate).' })
  effective_public!: boolean;
  @ApiProperty({ type: 'integer', minimum: 1, description: 'Send as If-Match to edit or publish.' })
  edit_version!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) lifecycle_version!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) published_at!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  visibility_changed_at!: string | null;
  @ApiProperty({ format: 'date-time' }) created_at!: string;
  @ApiProperty({ format: 'date-time' }) updated_at!: string;
  @ApiProperty({ type: ScenePostRevisionDto, nullable: true })
  published_revision!: ScenePostRevisionDto | null;
  @ApiProperty({ type: ScenePostRevisionDto, nullable: true })
  working_revision!: ScenePostRevisionDto | null;
}

export class SellerScenePostSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() public_ref!: string;
  @ApiProperty({ enum: PUBLICATION_STATES }) publication_state!: string;
  @ApiProperty({ enum: VISIBILITIES }) visibility!: string;
  @ApiProperty({ enum: VISIBILITY_REASONS, nullable: true }) visibility_reason!: string | null;
  @ApiProperty({ type: 'integer', minimum: 1 }) edit_version!: number;
  @ApiProperty({ type: String, nullable: true, description: 'Working caption, else published.' })
  caption!: string | null;
  @ApiProperty({ type: String, nullable: true }) card_image_key!: string | null;
  @ApiProperty({ type: 'integer', minimum: 0, description: 'Tags of the published revision.' })
  tagged_product_count!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) available_tagged_product_count!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) published_at!: string | null;
  @ApiProperty({ format: 'date-time' }) updated_at!: string;
}

export class SellerScenePostPageDto {
  @ApiProperty({ type: [SellerScenePostSummaryDto] }) data!: SellerScenePostSummaryDto[];
  @ApiProperty() has_more!: boolean;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) next_cursor!: string | null;
}

// ------------------------------------------------------------------ public

export class PublicSceneSellerDto {
  @ApiProperty() handle!: string;
  @ApiProperty() store_name!: string;
}

export class PublicSceneProductDto {
  @ApiProperty({ type: 'integer', minimum: 1 }) position!: number;
  @ApiProperty({ description: 'Product route: /v1/storefronts/{handle}/products/{slug}.' })
  slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: "The Product's creation seed, not a price (DB-01 C1). Kept for compatibility; show price_min_minor..price_max_minor.",
  })
  base_price_minor!: number;
  @ApiProperty() base_price_currency!: string;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    nullable: true,
    description: "Lowest current price among the Product's ACTIVE Variants (price lives on the Variant). Null: no ACTIVE Variant.",
  })
  price_min_minor!: number | null;
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    nullable: true,
    description: 'Highest current ACTIVE Variant price; equal to price_min_minor when every Variant costs the same.',
  })
  price_max_minor!: number | null;
  @ApiProperty({ type: String, nullable: true, description: 'Currency of the Variant prices.' })
  price_currency!: string | null;
  @ApiProperty({ type: String, nullable: true }) image_key!: string | null;
  @ApiProperty({ description: 'False: show "Currently unavailable" and no purchase action.' })
  available!: boolean;
}

export class PublicScenePostDto {
  @ApiProperty() public_ref!: string;
  @ApiProperty({ format: 'date-time' }) published_at!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) revision_version!: number;
  @ApiProperty() caption!: string;
  @ApiProperty({ type: ScenePostImageDto }) image!: ScenePostImageDto;
  @ApiProperty({ type: PublicSceneSellerDto }) seller!: PublicSceneSellerDto;
  @ApiProperty({
    type: [PublicSceneProductDto],
    description: 'Public tagged Products in presentation order; at least one is available.',
  })
  products!: PublicSceneProductDto[];
}
