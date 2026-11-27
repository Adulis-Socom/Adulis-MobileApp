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

export interface EngagementOps {
  'engagement.state.get': { in: { sceneRefs: readonly string[]; productRefs: readonly string[]; sellerRefs: readonly string[] }; out: EngagementState };
  'scene.like.set': { in: { sceneRef: string; liked: boolean }; out: SceneEngagement };
  'scene.save.set': { in: { sceneRef: string; saved: boolean }; out: SceneEngagement };
  'product.save.set': { in: { productRef: string; saved: boolean }; out: ProductEngagement };
  'seller.follow.set': { in: { sellerRef: string; following: boolean }; out: SellerEngagement };
  'saved.list.get': { in: Readonly<Record<string, never>>; out: { scenes: readonly SceneCardUnit[]; products: readonly ProductTile[] } };
  'collections.list.get': { in: Readonly<Record<string, never>>; out: { collections: readonly Collection[] } };
  'collection.create': { in: { name: string }; out: { collection: Collection } };
}
