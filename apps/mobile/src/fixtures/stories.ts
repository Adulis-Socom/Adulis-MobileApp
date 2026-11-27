// DEVELOPMENT ONLY. The deterministic Story world: two Sellers with Stories, in the server's order (most recent Seller update
// first, chronological inside a Seller). Expiry is a server-authored instant 24 hours after the request, so a fixture Story is
// never "already expired" under a real clock; the app still never decides expiry itself. `expire(sellerRef)` lets a test play
// the server withdrawing or expiring a Seller's Stories.
import type { SellerSummary } from '../contracts/gap-mob-discovery';
import type { StoryGroup, StoryView } from '../contracts/gap-mob-stories';
import { FIXTURE_IDS } from './ids';

const alem: SellerSummary = { sellerRef: FIXTURE_IDS.seller, storeName: 'Demo Store Alem' };
const bete: SellerSummary = { sellerRef: 'fx_seller_demo_bete', storeName: 'Demo Store Bete' };

const DAY_MS = 24 * 60 * 60 * 1000;
const story = (n: number, sellerName: string, text: string | null, target: StoryView['target']): StoryView => ({
  storyRef: `fx_story_demo_${n}`,
  publishedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: new Date(Date.now() + DAY_MS).toISOString(),
  photo: { ref: `fx_media_demo_story${n}`, aspect: 3 / 4, alt: `Story from ${sellerName}` },
  text,
  target,
});

const make = () => ({
  [alem.sellerRef]: [
    story(1, alem.storeName, 'Fresh stock of baskets today.', { kind: 'PRODUCT', ref: 'fx_product_demo_1', label: 'Woven basket' }),
    story(2, alem.storeName, null, null), // photo only, no link: no call to action
  ],
  [bete.sellerRef]: [story(3, bete.storeName, 'New scarves on the line.', { kind: 'SCENE', ref: 'fx_scene_demo_2', label: 'Scarves on a line' })],
});

export const STORY_GROUPS: readonly StoryGroup[] = [{ seller: bete }, { seller: alem }];

export function storiesOf(sellerRef: string, expired: ReadonlySet<string>): { seller: SellerSummary; stories: StoryView[] } | null {
  const seller = [alem, bete].find((s) => s.sellerRef === sellerRef);
  const stories = (make() as Record<string, StoryView[]>)[sellerRef];
  if (seller === undefined || stories === undefined || expired.has(sellerRef)) return null; // one neutral answer for every reason
  return { seller, stories };
}

export const rowGroups = (expired: ReadonlySet<string>): StoryGroup[] => STORY_GROUPS.filter((g) => !expired.has(g.seller.sellerRef));
