// PROVISIONAL, GAP-L2-02 (discovery read contracts; owner unconfirmed, FD-07). Working names, not an API: when the owner order
// publishes the generated contract these types are replaced by the generated ones and a conformance check replaces the hand shapes.
//
// What is deliberately NOT in any shape (REC-01 S43-S45, MOB-02, the unresolved-requirements table): no ranking score, weight,
// candidate source, algorithm version; no Nearby basis or distance; no Locally Made eligibility; no discount, percent-off or
// original price; no stock count; no Like count; no handoff count or rate; no Review summary. Availability is words from the
// server (`available`), and the order of every list is the server's.
//
// Identity is by opaque ref (the handle/slug route naming is an open SPEC_CONFLICT, FD-26 / GAP-L2-05).

export type ChannelKey = 'FOR_YOU' | 'FOLLOWING' | 'NEARBY' | 'DISCOUNTS' | 'LOCALLY_MADE';
export type ChannelState = 'AVAILABLE' | 'NOT_AVAILABLE' | 'SIGN_IN_REQUIRED';
export interface Channel {
  readonly key: ChannelKey;
  readonly state: ChannelState;
}

/** Every `*Ref` here resolves through ONE media seam; a missing origin is a neutral placeholder, never a guessed URL. */
export interface MediaRef {
  readonly ref: string;
  /** Intrinsic width over height, so a hotspot can be placed inside the rendered `contain` rectangle. */
  readonly aspect: number;
  /** Words for a screen reader. */
  readonly alt: string;
}

export interface SellerSummary {
  readonly sellerRef: string;
  readonly storeName: string;
}

export type TrustLevel = 'NEW' | 'REBUILDING' | 'ESTABLISHED' | 'TRUSTED';

export interface Money {
  /** Minor units and an ISO currency code from the server. Formatting is the client's (Intl); arithmetic never is. */
  readonly minor: number;
  readonly currency: string;
}

export interface ProductTile {
  readonly productRef: string;
  readonly seller: SellerSummary;
  readonly name: string;
  readonly priceMin: Money;
  readonly priceMax: Money;
  readonly available: boolean;
  readonly image: MediaRef | null;
}

export interface SceneTag {
  readonly position: number;
  readonly productRef: string;
  readonly name: string;
  readonly available: boolean;
  /** Normalised 0..1 within the image. Absent on a Scene that carries no hotspot data (the list still works). */
  readonly hotspot: { readonly x: number; readonly y: number } | null;
  readonly priceMin: Money | null;
  readonly priceMax: Money | null;
}

export interface SceneCardUnit {
  /** Closed: For You and Following carry Scene Posts only. An unknown type is skipped by the client backstop. */
  readonly type: 'SCENE_POST';
  readonly sceneRef: string;
  readonly caption: string;
  readonly seller: SellerSummary;
  readonly image: MediaRef;
  readonly tags: readonly SceneTag[];
}

export interface PublicScene extends SceneCardUnit {
  readonly publishedAt: string;
  readonly trustLevel: TrustLevel | null;
  /** Same Seller only. */
  readonly related: readonly SceneCardUnit[];
}

export interface ProductVariant {
  readonly variantRef: string;
  readonly label: string;
  readonly price: Money;
  readonly available: boolean;
}

export interface ProductDetail extends ProductTile {
  readonly description: string;
  readonly trustLevel: TrustLevel | null;
  readonly variants: readonly ProductVariant[];
}

export interface SellerProfile {
  readonly sellerRef: string;
  readonly storeName: string;
  readonly description: string;
  readonly trustLevel: TrustLevel | null;
  /** An explicit server fact: the client does not derive it from a status. */
  readonly isOpen: boolean | null;
}

export type SearchType = 'TOP' | 'PRODUCT_POST' | 'SCENE_POST' | 'SELLER';
export type SearchItem =
  | { readonly kind: 'PRODUCT_POST'; readonly product: ProductTile }
  | { readonly kind: 'SCENE_POST'; readonly scene: SceneCardUnit }
  | { readonly kind: 'SELLER'; readonly seller: SellerSummary };

export type MarketState = 'RESOLVED' | 'UNRESOLVED';
interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface Category {
  readonly code: string;
  readonly label: string;
}

export interface DiscoveryOps {
  'home.channels.get': { in: Readonly<Record<string, never>>; out: { channels: readonly Channel[] } };
  'feed.forYou.page': { in: { cursor: string | null }; out: Page<SceneCardUnit> };
  'feed.following.page': { in: { cursor: string | null }; out: Page<SceneCardUnit> };
  'scene.get': { in: { sceneRef: string }; out: { scene: PublicScene } };
  'search.query': { in: { q: string; type: SearchType; cursor: string | null }; out: Page<SearchItem> & { type: SearchType; marketState: MarketState } };
  'shop.products.page': { in: { cursor: string | null; category: string | null }; out: Page<ProductTile> & { marketState: MarketState } };
  'categories.list': { in: Readonly<Record<string, never>>; out: { items: readonly Category[] } };
  'product.get': { in: { productRef: string }; out: { product: ProductDetail } };
  'seller.get': { in: { sellerRef: string }; out: { seller: SellerProfile } };
  'seller.scenes.page': { in: { sellerRef: string; cursor: string | null }; out: Page<SceneCardUnit> };
  'seller.products.page': { in: { sellerRef: string; cursor: string | null }; out: Page<ProductTile> };
}
