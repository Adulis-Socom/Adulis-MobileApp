// DEVELOPMENT ONLY. The deterministic Story world (M01-R06): two Sellers, in the server's order (most recent Seller update first,
// chronological inside a Seller). Publication and expiry are fixed SERVER instants taken once from the fixture clock when the
// world is built, so repeated reads never move them. What a read returns is decided at read time against the same clock: a Story
// past its expiry, a withdrawn or restricted Seller, or a Story whose linked content became private is simply absent, and a
// group with nothing left is the single neutral NOT_FOUND.
import type { SellerSummary } from '../contracts/gap-mob-discovery';
import type { StoryGroup, StoryView } from '../contracts/gap-mob-stories';
import { FIXTURE_IDS } from './ids';

const alem: SellerSummary = { sellerRef: FIXTURE_IDS.seller, storeName: 'Demo Store Alem' };
const bete: SellerSummary = { sellerRef: 'fx_seller_demo_bete', storeName: 'Demo Store Bete' };
const HOUR_MS = 60 * 60 * 1000;

export const STORY_GROUPS: readonly StoryGroup[] = [{ seller: bete }, { seller: alem }];

export function createStoryWorld(now: () => number) {
  let stories: Record<string, StoryView[]> = {};
  const unavailableSellers = new Set<string>(); // withdrawn, expired early or restricted: one answer for every reason
  const privateTargets = new Set<string>(); // linked content that stopped being public suppresses its Story
  const build = () => {
    const base = now();
    const at = (hours: number) => new Date(base + hours * HOUR_MS).toISOString();
    const story = (n: number, seller: SellerSummary, expiresInHours: number, text: string | null, target: StoryView['target']): StoryView => ({
      storyRef: `fx_story_demo_${n}`,
      publishedAt: at(expiresInHours - 24),
      expiresAt: at(expiresInHours),
      photo: { ref: `fx_media_demo_story${n}`, aspect: 3 / 4, alt: `Story from ${seller.storeName}` },
      text,
      target,
    });
    stories = {
      // Story 1 expires in 23 hours; story 2 in 2 hours (so a test can cross its expiry while the viewer is open).
      [alem.sellerRef]: [
        story(1, alem, 23, 'Fresh stock of baskets today.', { kind: 'PRODUCT', ref: 'fx_product_demo_1', label: 'Woven basket' }),
        story(2, alem, 2, null, null), // photo only, no link: no call to action
      ],
      [bete.sellerRef]: [story(3, bete, 20, 'New scarves on the line.', { kind: 'SCENE', ref: 'fx_scene_demo_2', label: 'Scarves on a line' })],
    };
  };
  build();

  const live = (sellerRef: string): StoryView[] =>
    unavailableSellers.has(sellerRef) ? [] : (stories[sellerRef] ?? []).filter((s) => Date.parse(s.expiresAt) > now() && (s.target === null || !privateTargets.has(s.target.ref)));

  return {
    group(sellerRef: string): { seller: SellerSummary; stories: StoryView[] } | null {
      const seller = [alem, bete].find((s) => s.sellerRef === sellerRef);
      const remaining = live(sellerRef);
      return seller === undefined || remaining.length === 0 ? null : { seller, stories: remaining };
    },
    row: (): StoryGroup[] => STORY_GROUPS.filter((g) => live(g.seller.sellerRef).length > 0),
    makeUnavailable: (sellerRef: string) => void unavailableSellers.add(sellerRef),
    makeTargetPrivate: (ref: string) => void privateTargets.add(ref),
    reset() {
      unavailableSellers.clear();
      privateTargets.clear();
      build();
    },
  };
}
