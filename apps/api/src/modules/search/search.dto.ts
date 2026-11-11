import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { SellerSceneImageDto, ShopProductDto, ShopProductSellerDto } from '../storefront/storefront.dto';

/**
 * GET /v1/search (ADU-SRC-01 v3.2 S7, S22): typed result items, `{ type, payload }`, one item
 * shape per canonical type so a generated client narrows on `type` without a cast.
 */
export const SEARCH_TYPES = ['TOP', 'PRODUCT_POST', 'SELLER', 'SCENE_POST'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export class SearchSellerDto {
  @ApiProperty({ description: 'Seller route: /v1/storefronts/{handle}.' }) handle!: string;
  @ApiProperty() store_name!: string;
  @ApiProperty({ type: String, enum: ['NEW', 'ESTABLISHED', 'TRUSTED'], nullable: true, description: 'Public Trust level, when the Seller has one.' })
  trust_level!: 'NEW' | 'ESTABLISHED' | 'TRUSTED' | null;
}

export class SearchSceneDto {
  @ApiProperty({ description: 'Scene route: /v1/scene-posts/{publicRef}.' }) public_ref!: string;
  @ApiProperty({ description: 'Caption excerpt (140 graphemes).' }) caption!: string;
  @ApiProperty() caption_truncated!: boolean;
  @ApiProperty({ type: SellerSceneImageDto }) image!: SellerSceneImageDto;
  @ApiProperty({ type: ShopProductSellerDto }) seller!: ShopProductSellerDto;
}

export class SearchProductItemDto {
  @ApiProperty({ enum: ['PRODUCT_POST'] }) type!: 'PRODUCT_POST';
  @ApiProperty({ type: ShopProductDto, description: 'Current public price span and availability from the Catalogue projection.' })
  payload!: ShopProductDto;
}

export class SearchSellerItemDto {
  @ApiProperty({ enum: ['SELLER'] }) type!: 'SELLER';
  @ApiProperty({ type: SearchSellerDto }) payload!: SearchSellerDto;
}

export class SearchSceneItemDto {
  @ApiProperty({ enum: ['SCENE_POST'] }) type!: 'SCENE_POST';
  @ApiProperty({ type: SearchSceneDto }) payload!: SearchSceneDto;
}

export type SearchItem = SearchProductItemDto | SearchSellerItemDto | SearchSceneItemDto;

@ApiExtraModels(SearchProductItemDto, SearchSellerItemDto, SearchSceneItemDto)
export class SearchResponseDto {
  @ApiProperty({
    description:
      'false: the request carries no ACTIVE-Market evidence, so nothing was searched (items is empty because no Market could be chosen).',
  })
  market_resolved!: boolean;
  @ApiProperty({ enum: SEARCH_TYPES, description: 'TOP: a bounded mixed set, never paginated; otherwise one result type, cursor-paginated.' })
  type!: SearchType;
  @ApiProperty({ description: 'The launch lexical ranking configuration that produced this page.' })
  algorithm_version!: string;
  @ApiProperty({
    type: 'array',
    items: { oneOf: [{ $ref: getSchemaPath(SearchProductItemDto) }, { $ref: getSchemaPath(SearchSellerItemDto) }, { $ref: getSchemaPath(SearchSceneItemDto) }] },
  })
  items!: SearchItem[];
  @ApiProperty({ type: String, nullable: true, description: 'Opaque; bound to this query, type and Market; null at the end (always null for TOP).' })
  next_cursor!: string | null;
}
