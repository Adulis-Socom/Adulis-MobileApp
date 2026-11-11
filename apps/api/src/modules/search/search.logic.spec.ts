import { AdulisException } from '../../common/errors/adulis-exception';
import { cursorBinding, escapeLike, likePatterns, mergeTop, normalizeQuery, type Ranked } from './search.logic';

const reason = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as AdulisException & { slots?: Record<string, unknown> }).slots?.['reason'] ?? 'no-reason';
  }
  return 'no-throw';
};

describe('Marketplace Search query normalisation (SRC-01 S14)', () => {
  it('normalises Unicode, removes control characters, collapses whitespace, keeps punctuation and Amharic', () => {
    expect(normalizeQuery('  Ｗｏｖｅｎ\u0000\t basket  ').text).toBe('Woven basket');
    expect(normalizeQuery('ቡና  ስኒ').text).toBe('ቡና ስኒ');
    expect(normalizeQuery('100% cotton_tee').text).toBe('100% cotton_tee');
    expect(normalizeQuery('A&B (2-pack)').text).toBe('A&B (2-pack)');
  });

  it('refuses empty, too short and too long queries with a reason', () => {
    expect(reason(() => normalizeQuery(undefined))).toBe('QUERY_REQUIRED');
    expect(reason(() => normalizeQuery('   '))).toBe('QUERY_TOO_SHORT');
    expect(reason(() => normalizeQuery('a'))).toBe('QUERY_TOO_SHORT');
    expect(reason(() => normalizeQuery('x'.repeat(101)))).toBe('QUERY_TOO_LONG');
    expect(reason(() => normalizeQuery('x'.repeat(401)))).toBe('QUERY_TOO_LONG');
    // Nothing to match on: punctuation or symbols alone.
    expect(reason(() => normalizeQuery('!!'))).toBe('QUERY_NO_TERMS');
    expect(reason(() => normalizeQuery('%%%'))).toBe('QUERY_NO_TERMS');
    expect(reason(() => normalizeQuery('\u{1F600}\u{1F600}'))).toBe('QUERY_NO_TERMS');
    // Two Amharic characters are a real word (ቡና, "coffee").
    expect(normalizeQuery('ቡና').long).toBe(false);
  });

  it('only from three characters are substring and fuzzy matches used', () => {
    expect(normalizeQuery('ab').long).toBe(false);
    expect(normalizeQuery('abc').long).toBe(true);
  });

  it('escapes LIKE metacharacters so a query is literal', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
    expect(likePatterns('50%').contains).toBe('%50\\%%');
    expect(normalizeQuery('@twin-store').handle).toBe('twin-store');
    // A Seller handle is matched with patterns of the handle, not of "@handle".
    expect(likePatterns(normalizeQuery('@addis').handle).prefix).toBe('addis%');
  });
});

describe('cursor binding', () => {
  const q = (s: string) => normalizeQuery(s);
  const m = '0e080000-0000-4000-8000-000000000001';
  it('is stable for a query, case-insensitive, and different for another query, type or Market', () => {
    const base = cursorBinding('PRODUCT_POST', m, q('Basket'));
    expect(base).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(cursorBinding('PRODUCT_POST', m, q('basket'))).toBe(base);
    expect(cursorBinding('PRODUCT_POST', m, q('baskets'))).not.toBe(base);
    expect(cursorBinding('SELLER', m, q('Basket'))).not.toBe(base);
    expect(cursorBinding('PRODUCT_POST', '0e080000-0000-4000-8000-000000000002', q('Basket'))).not.toBe(base);
  });
});

describe('Top assembly (SRC-01 S7)', () => {
  const r = (type: Ranked<string>['type'], band: number, rank: number): Ranked<string> => ({ type, band, rank, item: `${type}:${band}:${rank}` });
  it('merges by band, then Seller, Product, Scene, then rank, capping each type', () => {
    const products = [0, 1, 2, 3, 4, 5, 6].map((i) => r('PRODUCT_POST', i < 2 ? 0 : 2, i));
    const sellers = [r('SELLER', 0, 0), r('SELLER', 3, 1), r('SELLER', 3, 2), r('SELLER', 3, 3)];
    const scenes = [r('SCENE_POST', 1, 0)];
    const top = mergeTop([products, sellers, scenes]);
    expect(top.slice(0, 4)).toEqual(['SELLER:0:0', 'PRODUCT_POST:0:0', 'PRODUCT_POST:0:1', 'SCENE_POST:1:0']);
    expect(top.filter((t) => t.startsWith('PRODUCT_POST'))).toHaveLength(6);
    expect(top.filter((t) => t.startsWith('SELLER'))).toHaveLength(3);
    expect(top).toHaveLength(10);
    expect(mergeTop([[], [], []])).toEqual([]);
  });
});
