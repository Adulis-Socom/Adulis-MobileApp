import { ApiProperty } from '@nestjs/swagger';

/** POST /v1/seller/products. */
export class ProductCreatedDto {
  @ApiProperty({ format: 'uuid' }) product_id!: string;
  @ApiProperty({ enum: ['DRAFT'] }) visibility!: 'DRAFT';
}

/** POST /v1/seller/products/{id}/publish. */
export class ProductPublishedDto {
  @ApiProperty({ enum: ['PUBLISHED'] }) visibility!: 'PUBLISHED';
}

/** POST /v1/seller/products/{id}/unpublish. */
export class ProductUnpublishedDto {
  @ApiProperty({ enum: ['UNPUBLISHED'] }) visibility!: 'UNPUBLISHED';
}

/** DELETE /v1/seller/products/{id}. */
export class ProductDeletedDto {
  @ApiProperty({ enum: [true] }) deleted!: true;
}

/** POST /v1/seller/products/{id}/variants. */
export class VariantCreatedDto {
  @ApiProperty({ format: 'uuid' }) variant_id!: string;
}

/** DELETE /v1/seller/variants/{id}. */
export class VariantWithdrawnDto {
  @ApiProperty({ enum: [true] }) withdrawn!: true;
}

/** PUT /v1/seller/products/{id}/images/order. */
export class ImageOrderDto {
  @ApiProperty({ type: [String], description: 'The image ids in their new order, as sent.' }) order!: string[];
}

/** POST /v1/seller/products/{id}/social-posts. */
export class SocialPostAttachedDto {
  @ApiProperty({ description: 'The platform the link resolved to.' }) platform!: string;
  @ApiProperty({ description: 'The platform\'s own id of the post.' }) canonical_post_id!: string;
}

/** POST /v1/seller/variants/{id}/stock: the count after the change, and the event that made it. */
export class StockWrittenDto {
  @ApiProperty({ type: 'integer' }) stock_count!: number;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'The stock event written; null when the count was already the one asked for.' }) event!: string | null;
}

/** POST /v1/seller/variants/{id}/confirm-stock. */
export class StockConfirmedDto {
  @ApiProperty({ format: 'date-time' }) stock_confirmed_at!: string;
}

export class StockEventDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: 'integer' }) delta!: number;
  @ApiProperty({ description: 'Why the count changed, e.g. RESTOCK or SELLER_SET.' }) reason!: string;
  @ApiProperty({ type: 'integer', nullable: true, description: 'The count after this event.' }) resulting_count!: number | null;
  @ApiProperty({ format: 'date-time' }) occurred_at!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) order_id!: string | null;
}

/** GET /v1/seller/variants/{id}/stock-events, newest first. */
export class StockEventPageDto {
  @ApiProperty({ type: [StockEventDto] }) data!: StockEventDto[];
  @ApiProperty() has_more!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Pass as `cursor` for the next page; null on the last page.' }) next_cursor!: string | null;
}
