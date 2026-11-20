import {
  asLineId,
  asSellerKey,
  asVariantId,
  type CartLine,
  type CartSet,
  type SellerCart,
  type ServerItem,
} from '../cart/model';
import type { CartViewState, Freshness } from '../cart/view-state';

/** Small builders for the tests of the cart code. Everything here is visibly fake. */
export const V1 = asVariantId('de000000-0000-4000-8000-000000000001');
export const V2 = asVariantId('de000000-0000-4000-8000-000000000002');
export const V3 = asVariantId('de000000-0000-4000-8000-000000000003');

export const line = (id: string, over: Partial<CartLine> = {}): CartLine => ({
  lineId: asLineId(id),
  variantId: V1,
  quantity: 2,
  name: 'Demo item',
  option: null,
  productSlug: 'demo-item',
  imageKey: null,
  unitPrice: { amountMinor: 1000, currency: 'ETB' },
  previousUnitPrice: null,
  availableQuantity: null,
  issues: [],
  ...over,
});

export const sellerCart = (
  lines: CartLine[],
  over: Partial<SellerCart> = {},
  key = 'seller-a',
): SellerCart => ({
  key: asSellerKey(key),
  handle: 'demo-seller',
  storeName: 'Demo Seller',
  lines,
  subtotal: null,
  ...over,
});

export const cartSet = (...carts: SellerCart[]): CartSet => ({ carts, checkedAt: null });

export const serverItem = (over: Partial<ServerItem> = {}): ServerItem => ({
  code: 'PRICE_CHANGED',
  variantId: V1,
  requested: null,
  available: null,
  wasMinor: 900,
  nowMinor: 1000,
  currency: 'ETB',
  ...over,
});

export const VERIFIED: Freshness = { kind: 'VERIFIED' };
export const UNVERIFIED: Freshness = { kind: 'UNVERIFIED', why: 'failed', error: null };

/** A LISTED view as the cart hook would give it for this answer. */
export const listed = (
  carts: CartSet,
  freshness: Freshness = VERIFIED,
  receivedAt = 1_000,
): CartViewState => ({ kind: 'LISTED', carts, freshness, provenance: 'FIXTURE', receivedAt });
