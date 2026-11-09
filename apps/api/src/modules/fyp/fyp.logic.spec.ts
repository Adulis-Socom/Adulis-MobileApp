import {
  capSellerRuns,
  captionExcerpt,
  cursorSecretMatches,
  decodeCursor,
  encodeCursor,
  newCursorSecret,
  newSeed,
  pageLimit,
  parseFypConfig,
  rankRecent,
  type RankCandidate,
} from './fyp.logic';

const BASELINE = {
  sources: { RECENT: { budget: 60 } },
  page: { default_limit: 10, max_limit: 24 },
  session: { ttl_seconds: 3600, max_items: 500 },
  tie_break: 'SEEDED_HASH',
  diversity: { seller_adjacency_max: null },
};

const c = (id: string, sellerId: string, iso: string): RankCandidate => ({
  id,
  sellerId,
  publishedAt: new Date(iso),
});

describe('parseFypConfig', () => {
  it('accepts the technical baseline seeded by migration 0055', () => {
    expect(parseFypConfig(BASELINE)).toEqual(BASELINE);
  });

  it.each([
    ['an unexecutable source', { ...BASELINE, sources: { RECENT: { budget: 60 }, TRENDING: { budget: 10 } } }],
    ['an unknown key', { ...BASELINE, weights: { recency: 1 } }],
    ['default above max', { ...BASELINE, page: { default_limit: 30, max_limit: 24 } }],
    ['a non-integer bound', { ...BASELINE, session: { ttl_seconds: 1.5, max_items: 500 } }],
    ['another tie-break', { ...BASELINE, tie_break: 'RANDOM' }],
    ['not an object', 'RECENT'],
  ])('fails closed on %s', (_label, raw) => {
    expect(parseFypConfig(raw)).toBeNull();
  });
});

describe('pageLimit', () => {
  const cfg = parseFypConfig(BASELINE)!;
  it.each([
    [undefined, 10],
    ['5', 5],
    ['0', 1],
    ['-3', 1],
    ['999', 24],
    ['abc', 10],
  ])('limit=%s -> %s', (raw, want) => {
    expect(pageLimit(raw, cfg)).toBe(want);
  });
});

describe('rankRecent', () => {
  const cands = [
    c('a', 's1', '2026-11-01T10:00:00Z'),
    c('b', 's2', '2026-11-03T10:00:00Z'),
    c('c', 's1', '2026-11-02T10:00:00Z'),
    c('d', 's3', '2026-11-02T10:00:00Z'),
    c('e', 's2', '2026-11-02T10:00:00Z'),
  ];

  it('orders newest first', () => {
    const ids = rankRecent(cands, '42').map((x) => x.id);
    expect(ids[0]).toBe('b');
    expect(ids[4]).toBe('a');
  });

  it('is deterministic for one seed and independent of input order', () => {
    const one = rankRecent(cands, '42').map((x) => x.id);
    expect(rankRecent([...cands].reverse(), '42').map((x) => x.id)).toEqual(one);
  });

  it('breaks equal times by the seed, so seeds can differ only inside a tie', () => {
    const orders = new Set(
      Array.from({ length: 40 }, (_, i) =>
        rankRecent(cands, String(i))
          .map((x) => x.id)
          .join(''),
      ),
    );
    for (const o of orders) expect(o).toMatch(/^b[cde]{3}a$/);
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('capSellerRuns', () => {
  const ranked = [
    c('1', 'A', '2026-11-05T00:00:00Z'),
    c('2', 'A', '2026-11-04T00:00:00Z'),
    c('3', 'A', '2026-11-03T00:00:00Z'),
    c('4', 'B', '2026-11-02T00:00:00Z'),
    c('5', 'A', '2026-11-01T00:00:00Z'),
  ];

  it('is the identity when off (null)', () => {
    expect(capSellerRuns(ranked, null)).toEqual(ranked);
  });

  it('breaks a run longer than the cap with the next other Seller', () => {
    expect(capSellerRuns(ranked, 2).map((x) => x.id)).toEqual(['1', '2', '4', '3', '5']);
  });

  it('counts the run carried from the previous page', () => {
    expect(capSellerRuns(ranked, 2, ['A', 'A']).map((x) => x.id)).toEqual(['4', '1', '2', '3', '5']);
  });

  it('never withholds content when only the capped Seller remains', () => {
    const onlyA = ranked.filter((x) => x.sellerId === 'A');
    expect(capSellerRuns(onlyA, 1).map((x) => x.id)).toEqual(['1', '2', '3', '5']);
  });
});

describe('captionExcerpt', () => {
  it('keeps a short caption whole', () => {
    expect(captionExcerpt('ሰላም Adulis', 300)).toEqual({ text: 'ሰላም Adulis', truncated: false });
  });

  it('cuts on graphemes, never inside a combined emoji', () => {
    const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
    const r = captionExcerpt(`ab${family}cd`, 3);
    expect(r).toEqual({ text: `ab${family}`, truncated: true });
  });
});

describe('cursor', () => {
  const session = '0190a3c4-1111-7222-8333-444455556666';

  it('round-trips and validates its secret in constant time', () => {
    const { secret, hash } = newCursorSecret();
    const raw = encodeCursor({ sessionId: session, offset: 10, secret });
    expect(decodeCursor(raw)).toEqual({ sessionId: session, offset: 10, secret });
    expect(cursorSecretMatches(secret, hash)).toBe(true);
    expect(cursorSecretMatches(newCursorSecret().secret, hash)).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['another version', `v2.${session}.0.${'a'.repeat(43)}`],
    ['a non-uuid session', `v1.not-a-session.0.${'a'.repeat(43)}`],
    ['a leading-zero offset', `v1.${session}.01.${'a'.repeat(43)}`],
    ['a negative offset', `v1.${session}.-1.${'a'.repeat(43)}`],
    ['a short secret', `v1.${session}.0.${'a'.repeat(42)}`],
    ['trailing data', `v1.${session}.0.${'a'.repeat(43)}.x`],
  ])('refuses %s', (_label, raw) => {
    expect(decodeCursor(raw)).toBeNull();
  });

  it('seeds are non-negative bigint strings', () => {
    for (let i = 0; i < 20; i++) expect(newSeed()).toMatch(/^[0-9]{1,19}$/);
  });
});
