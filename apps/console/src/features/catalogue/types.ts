/**
 * features/catalogue/types.ts -- the shapes GET /v1/seller/products and
 * GET /v1/seller/products/{id} actually return, typed LOCALLY.
 *
 * The catalogue endpoints carry no response schema in contracts/openapi.json
 * (the API's Swagger decorators declare none -- the D-98 class the trade
 * feature's types.ts also names). So these are transcribed from the SERVICE
 * that answers them (catalogue.service.ts), and marked as local. When the
 * contract gains schemas these are deleted in favour of the generated ones,
 * not reconciled.
 */
export interface Money {
  readonly amount_minor: number;
  readonly currency: string;
}

/** GET /v1/seller/products -- one row. */
export interface ProductRow {
  readonly id: string;
  readonly name: string;
  readonly visibility: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  readonly base_price: Money;
  readonly display_order: number;
}

export interface ProductPage {
  readonly data: readonly ProductRow[];
  readonly has_more: boolean;
  readonly next_cursor: string | null;
}

/** A variant as GET /v1/seller/products/{id} returns it. */
export interface Variant {
  readonly id: string;
  readonly variant_key: string;
  readonly price_minor: string;
  readonly price_currency: string;
  readonly stock_count: number;
  readonly stock_confirmed_at: string | null;
  readonly status: 'ACTIVE' | 'WITHDRAWN';
}

export interface ProductImage {
  readonly id: string;
  readonly position: number;
  readonly thumb_key: string;
  readonly card_key: string;
  readonly full_key: string;
}

export interface ProductVideo {
  readonly key: string;
  readonly duration_seconds: number;
  readonly height_px: number;
  readonly bytes: number;
}

/** GET /v1/seller/products/{id} -- the editor's read. */
export interface ProductDetail {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly category_id: string | null;
  readonly visibility: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  readonly unpublished_reason: string | null;
  readonly base_price: Money;
  readonly display_order: number;
  readonly published_at: string | null;
  readonly variants: readonly Variant[];
  readonly images: readonly ProductImage[];
  readonly video: ProductVideo | null;
  readonly social_posts: ReadonlyArray<{ platform: string; canonical_post_id: string }>;
}

/** GET /v1/seller/variants/{id}/stock-events -- one row. */
export interface StockEvent {
  readonly id: string;
  readonly delta: number;
  readonly reason: string;
  readonly resulting_count: number;
  readonly occurred_at: string;
}

export interface StockEventPage {
  readonly data: readonly StockEvent[];
  readonly has_more: boolean;
  readonly next_cursor: string | null;
}
