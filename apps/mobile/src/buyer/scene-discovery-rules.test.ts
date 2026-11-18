import { en } from '@adulis/locale/mobile';

import { claimsIn } from '../testing/discovery-rules';

/**
 * The discovery rules that are about what the code and the catalogue contain, not what a
 * render shows: no claim of popularity, trust or conversion in any For You or Scene string,
 * no engagement string, and nothing positioned over a photo or typed as another unit.
 */
// The mobile tsconfig carries no Node typings, so the two calls the scan needs are described here.
declare const __dirname: string;
const fs = jest.requireActual<{ readFileSync(file: string, encoding: 'utf8'): string }>('node:fs');
const path = jest.requireActual<{ join(...parts: string[]): string }>('node:path');
const code = (file: string) =>
  fs
    .readFileSync(path.join(__dirname, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const NAMESPACE = /^buyer\.(for_you|scene)\./;
const ENGAGEMENT = /\b(like|hide|share|follow|report|not interested)\b/i;
/** The keys of a catalogue that claim something the server did not send, or offer engagement. */
const claimingKeys = (catalogue: Record<string, string>) =>
  Object.entries(catalogue)
    .filter(([key]) => NAMESPACE.test(key))
    .filter(([key, text]) => claimsIn([text]).length > 0 || ENGAGEMENT.test(text) || ENGAGEMENT.test(key.replace(/[._]/g, ' ')))
    .map(([key]) => key);

describe('the claim detector', () => {
  it('flags popularity, trust and conversion wording, and leaves the labels the screens use alone', () => {
    const claims = ['Trending now', '1.2k views', '4.8 stars', 'Verified seller', 'Only 3 left', '20% off', 'Buy now', 'Best seller', '35 people bought this', 'Selling fast'];
    expect(claimsIn(claims)).toEqual(claims);
    const labels = ['View Product', 'Explore the Scene', 'Tagged Products', 'Currently unavailable', 'Woven basket', 'Save', '+2 more', 'Scene by Store 1', 'Products in this Scene'];
    expect(claimsIn(labels)).toEqual([]);
  });

  it('is applied to a catalogue by key, so one added string is named', () => {
    const doctored = { ...en, 'buyer.for_you.trending': 'Trending now', 'buyer.scene.like': 'Like this Scene' } as Record<string, string>;
    expect(claimingKeys(doctored)).toEqual(['buyer.for_you.trending', 'buyer.scene.like']);
  });
});

describe('the For You and Scene catalogue', () => {
  it('has strings, and none claims popularity, trust, conversion or engagement', () => {
    const keys = Object.keys(en).filter((key) => NAMESPACE.test(key));
    expect(keys.length).toBeGreaterThan(20); // the scan reads the namespaces
    expect(claimingKeys(en as Record<string, string>)).toEqual([]);
  });
});

describe('the For You and Scene sources', () => {
  const FILES = ['ForYouFeed.tsx', 'for-you-feed.ts', 'SceneCard.tsx', 'SceneExplorer.tsx'];

  it('position nothing over a photo and draw no hotspot or marker', () => {
    for (const file of FILES) {
      const source = code(file);
      expect({ file, absolute: /position:\s*['"]absolute['"]/.test(source) }).toEqual({ file, absolute: false });
      expect({ file, named: /hotspot|marker/i.test(source) }).toEqual({ file, named: false });
    }
    expect(code('SceneCard.tsx')).toMatch(/Image/); // the scan reads the card
  });

  it('name one kind of feed unit: the Scene Post', () => {
    const units = FILES.flatMap((file) => [...code(file).matchAll(/['"]([A-Z]+(?:_[A-Z]+)*_(?:POST|VIDEO|AD))['"]/g)].map((match) => match[1]));
    expect([...new Set(units)]).toEqual(['SCENE_POST']);
  });
});
