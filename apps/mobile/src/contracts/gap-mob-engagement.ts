// PROVISIONAL, GAP-L2-02 (engagement writes; owner unconfirmed, FD-07). Working names, not an API. Every write carries the
// DESIRED state (not a toggle), so a replay is safe. Writes are server-confirmed: the UI shows a pending state, then the server's
// state; it never flips optimistically (optimistic Like/Follow awaits decision DK-01).
//
// What is deliberately NOT here: any Like or Save or Follow count, public or private; any "liked by" list; Product Like (Likes
// apply to Scenes only); comments; share targets (the public link owner is unresolved, GAP-L2-05); Report, Not Interested, Hide
// and Block scopes (undefined by backend policy); Collection item membership writes (a later slice).
import type { ProductTile, SceneCardUnit } from './gap-mob-discovery';

export interface SceneEngagement {
  readonly liked: boolean;
  readonly saved: boolean;
}
export interface ProductEngagement {
  readonly saved: boolean;
}
export interface SellerEngagement {
  readonly following: boolean;
}

export interface EngagementState {
  readonly scenes: Readonly<Record<string, SceneEngagement>>;
  readonly products: Readonly<Record<string, ProductEngagement>>;
  readonly sellers: Readonly<Record<string, SellerEngagement>>;
}

export interface Collection {
  readonly collectionRef: string;
  readonly name: string;
}

/** A Collection member as written: what kind it is and its ref. */
export interface CollectionItemRef {
  readonly kind: 'SCENE_POST' | 'PRODUCT_POST';
  readonly ref: string;
}

/**
 * A Collection member as read. A member that stopped being public (withdrawn, private, gone) is UNAVAILABLE and carries no
 * name, store, caption or picture, whatever it once was: only what is needed to remove it.
 */
export type CollectionItem =
  | { readonly kind: 'SCENE_POST'; readonly scene: SceneCardUnit }
  | { readonly kind: 'PRODUCT_POST'; readonly product: ProductTile }
  | { readonly kind: 'UNAVAILABLE'; readonly item: CollectionItemRef };

export interface EngagementOps {
  'engagement.state.get': { in: { sceneRefs: readonly string[]; productRefs: readonly string[]; sellerRefs: readonly string[] }; out: EngagementState };
  'scene.like.set': { in: { sceneRef: string; liked: boolean }; out: SceneEngagement };
  'scene.save.set': { in: { sceneRef: string; saved: boolean }; out: SceneEngagement };
  'product.save.set': { in: { productRef: string; saved: boolean }; out: ProductEngagement };
  'seller.follow.set': { in: { sellerRef: string; following: boolean }; out: SellerEngagement };
  'saved.list.get': { in: Readonly<Record<string, never>>; out: { scenes: readonly SceneCardUnit[]; products: readonly ProductTile[] } };
  'collections.list.get': { in: Readonly<Record<string, never>>; out: { collections: readonly Collection[] } };
  'collection.create': { in: { name: string }; out: { collection: Collection } };
  'collection.get': { in: { collectionRef: string }; out: { collection: Collection; items: readonly CollectionItem[] } };
  'collection.rename': { in: { collectionRef: string; name: string }; out: { collection: Collection } };
  'collection.delete': { in: { collectionRef: string }; out: Readonly<Record<string, never>> };
  'collection.item.add': { in: { collectionRef: string; item: CollectionItemRef }; out: { item: CollectionItemRef } };
  'collection.item.remove': { in: { collectionRef: string; item: CollectionItemRef }; out: { item: CollectionItemRef } };
}
