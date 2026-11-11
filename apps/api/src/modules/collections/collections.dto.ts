import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SearchSceneDto } from '../search/search.dto';
import { ShopProductDto } from '../storefront/storefront.dto';
import { NAME_MAX, SAVED_STATE_MAX, SOURCE_SURFACES, TARGET_TYPES, type TargetType } from './collections.logic';

/** Private Buyer Collections (ADU-SRC-01 v3.2 S18-S22). Owner-only; every response is no-store. */

export class CollectionDto {
  @ApiProperty({ format: 'uuid', description: 'Opaque Collection ref.' }) ref!: string;
  @ApiProperty({ enum: ['DEFAULT', 'USER_CREATED'], description: 'DEFAULT: the one server-recognised Saved Collection; it cannot be renamed or deleted.' })
  kind!: 'DEFAULT' | 'USER_CREATED';
  @ApiProperty({ type: String, nullable: true, description: 'null for DEFAULT: show the localised "Saved" label (never stored).' })
  name!: string | null;
  @ApiProperty({ type: 'integer', minimum: 0, description: 'Product memberships, available or not.' }) product_count!: number;
  @ApiProperty({ type: 'integer', minimum: 0, description: 'Whole-Scene memberships, available or not.' }) scene_count!: number;
  @ApiProperty({ format: 'date-time' }) created_at!: string;
  @ApiProperty({ format: 'date-time', description: 'Last rename or membership change.' }) updated_at!: string;
}

export class CollectionPageDto {
  @ApiProperty({ format: 'uuid', description: 'The DEFAULT Collection (created on first need).' }) default_collection_ref!: string;
  @ApiProperty({ type: [CollectionDto], description: 'DEFAULT first, then oldest first.' }) data!: CollectionDto[];
  @ApiProperty({ type: String, nullable: true, description: 'Opaque; null at the end.' }) next_cursor!: string | null;
}

export class CollectionItemDto {
  @ApiProperty({ format: 'uuid', description: 'Membership ref: DELETE /v1/collections/{collectionRef}/items/{itemRef}.' }) ref!: string;
  @ApiProperty({ format: 'uuid' }) collection_ref!: string;
  @ApiProperty({ enum: TARGET_TYPES }) target_type!: TargetType;
  @ApiProperty({
    enum: ['VISIBLE', 'UNAVAILABLE'],
    description:
      'Resolved now, through the current public gates. UNAVAILABLE (unpublished, restricted, deleted, PRIVATE, another Market): show the neutral "no longer available" text; product and scene are null and no reason is given.',
  })
  state!: 'VISIBLE' | 'UNAVAILABLE';
  @ApiProperty({ format: 'date-time' }) saved_at!: string;
  @ApiProperty({ type: ShopProductDto, nullable: true, description: 'Current price span and stock (available=false: out of stock, still saved).' })
  product!: ShopProductDto | null;
  @ApiProperty({ type: SearchSceneDto, nullable: true, description: 'The current PUBLIC revision, never the revision seen at save.' })
  scene!: SearchSceneDto | null;
}

export class CollectionDetailDto {
  @ApiProperty({ type: CollectionDto }) collection!: CollectionDto;
  @ApiProperty({ type: [CollectionItemDto], description: 'Newest first.' }) data!: CollectionItemDto[];
  @ApiProperty({ type: String, nullable: true, description: 'Opaque; null at the end.' }) next_cursor!: string | null;
}

export class SavedItemPageDto {
  @ApiProperty({ type: [CollectionItemDto], description: 'Each target once (its most recent membership), newest first.' })
  data!: CollectionItemDto[];
  @ApiProperty({ type: String, nullable: true, description: 'Opaque; null at the end.' }) next_cursor!: string | null;
}

export class CollectionTargetDto {
  @ApiProperty({ enum: TARGET_TYPES }) type!: TargetType;
  @ApiProperty({ description: 'PRODUCT_POST: the Product id from a public payload (uuid). SCENE_POST: the Scene public_ref.' })
  ref!: string;
}

export class CollectionNameBodyDto {
  @ApiProperty({ maxLength: NAME_MAX, description: 'Trimmed, whitespace runs collapsed; 1-60 characters.' }) name!: string;
}

export class AddItemContextDto {
  @ApiProperty({ description: 'The Scene the Product was opened from; recorded only if its current PUBLIC revision tags the Product.' })
  scene_ref!: string;
}

export class AddCollectionItemBodyDto {
  @ApiProperty({ type: CollectionTargetDto }) target!: CollectionTargetDto;
  @ApiProperty({ enum: SOURCE_SURFACES }) source_surface!: (typeof SOURCE_SURFACES)[number];
  @ApiPropertyOptional({ type: AddItemContextDto }) context?: AddItemContextDto;
}

export class SavedStateBodyDto {
  @ApiProperty({ type: [CollectionTargetDto], minItems: 1, maxItems: SAVED_STATE_MAX }) targets!: CollectionTargetDto[];
}

export class SavedMembershipDto {
  @ApiProperty({ format: 'uuid' }) collection_ref!: string;
  @ApiProperty({ format: 'uuid' }) item_ref!: string;
}

export class SavedStateItemDto {
  @ApiProperty({ enum: TARGET_TYPES }) type!: TargetType;
  @ApiProperty() ref!: string;
  @ApiProperty({ description: 'In the DEFAULT Collection: the one-tap Save state.' }) saved!: boolean;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'The DEFAULT membership, to remove it.' })
  default_item_ref!: string | null;
  @ApiProperty({ type: [SavedMembershipDto], description: 'Every Collection of the caller holding the target.' })
  memberships!: SavedMembershipDto[];
}

export class SavedStateDto {
  @ApiProperty({ format: 'uuid' }) default_collection_ref!: string;
  @ApiProperty({ type: [SavedStateItemDto], description: 'One per requested target, in request order.' }) items!: SavedStateItemDto[];
}
