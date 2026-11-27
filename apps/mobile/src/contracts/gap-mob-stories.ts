// PROVISIONAL, GAP-L2-02 (Buyer Story projection; SC-BE-05S is the authoritative backend owner). Working names, not an API.
// Public-only: no state, public flag, moderation, allowed actions, version or Seller-private field; no view count, viewer list,
// seen state, ranking, reply or reaction field; no discount, quota, text limit or duration. One neutral not-found answer covers
// expired, withdrawn, restricted, private-target and unknown, so a reason can never leak.
import type { MediaRef, SellerSummary } from './gap-mob-discovery';

export interface StoryTarget {
  readonly kind: 'PRODUCT' | 'SCENE';
  readonly ref: string;
  readonly label: string;
}

export interface StoryView {
  readonly storyRef: string;
  readonly publishedAt: string;
  /** Server-authored UTC instant. The client never extends it and never declares a Story expired on its own. */
  readonly expiresAt: string;
  /** Exactly one still photo. `alt` is the authored description when the server has one. */
  readonly photo: MediaRef;
  readonly text: string | null;
  /** Zero or one eligible same-Seller Product or Scene. No target means no call to action. */
  readonly target: StoryTarget | null;
}

export interface StoryGroup {
  readonly seller: SellerSummary;
}

export interface StoriesOps {
  'stories.row.get': { in: Readonly<Record<string, never>>; out: { groups: readonly StoryGroup[]; nextCursor: string | null } };
  'stories.group.get': { in: { sellerRef: string }; out: { seller: SellerSummary; stories: readonly StoryView[] } };
}
