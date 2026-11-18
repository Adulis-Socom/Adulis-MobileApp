import { ApiError, type FypPage } from '../api/client';
import { fypPage, fypUnit } from '../testing/fake-api';
import {
  FOREGROUND_REVALIDATE_AFTER_MS,
  feedSessionEnded,
  feedUnits,
  freshnessIntervalMs,
  mediaUrl,
  needsForegroundRevalidation,
  noWithdrawals,
  withdrawFrom,
  withdrawnIn,
} from './for-you-feed';

describe('needsForegroundRevalidation (WO-DISC-002A, ADU-MOB-02 S185)', () => {
  const at = 1_000_000;
  const five = 5 * 60_000;
  it.each([
    ['cards checked before a long enough background', { now: at + five, oldestReceivedAt: at - 1, thresholdMs: five }, true],
    ['a background shorter than the interval', { now: at + five - 1, oldestReceivedAt: at - 1, thresholdMs: five }, false],
    // A page that lands just after the app is backgrounded ages from its arrival, not never.
    ['cards that arrived in the background, less than the interval ago', { now: at + five, oldestReceivedAt: at + 1, thresholdMs: five }, false],
    ['cards that arrived in the background, the interval ago', { now: at + 1 + five, oldestReceivedAt: at + 1, thresholdMs: five }, true],
    ['nothing loaded yet', { now: at + five, oldestReceivedAt: undefined, thresholdMs: five }, false],
    ['a clock that went backwards: stale (fail closed)', { now: at - 60_000, oldestReceivedAt: at - 120_000, thresholdMs: five }, true],
    ['the release policy: any return from the background', { now: at, oldestReceivedAt: at - 1, thresholdMs: 0 }, true],
    ['the release policy, even for cards that arrived in the background', { now: at + 1, oldestReceivedAt: at + 1, thresholdMs: 0 }, true],
  ])('%s', (_label, args, expected) => {
    expect(needsForegroundRevalidation({ backgroundedAt: at, ...args })).toBe(expected);
  });

  it('is 5 provisional minutes in development and 0 -- fail closed -- in a release build', () => {
    expect(freshnessIntervalMs(true)).toBe(five);
    expect(freshnessIntervalMs(false)).toBe(0);
    expect(FOREGROUND_REVALIDATE_AFTER_MS).toBe(freshnessIntervalMs(__DEV__));
  });
});

const problem = (code: string, slots?: Record<string, unknown>) =>
  new ApiError({
    kind: 'problem',
    status: 400,
    problem: { type: 'about:blank', title_key: 'x', status: 400, code, request_id: 't', retryable: false, slots } as never,
  });

describe('feedUnits', () => {
  it('keeps every page in order and each Scene once, at its first position', () => {
    const pages = [fypPage([fypUnit(1), fypUnit(2)], 'c1'), fypPage([fypUnit(2, { position: 3 }), fypUnit(3)])];
    expect(feedUnits(pages).map((u) => [u.public_ref, u.position])).toEqual([
      [fypUnit(1).public_ref, 1],
      [fypUnit(2).public_ref, 2],
      [fypUnit(3).public_ref, 3],
    ]);
  });

  it('skips a unit type this build does not know', () => {
    const foreign = { ...fypUnit(9), type: 'PRODUCT_POST' } as unknown as FypPage['items'][number];
    expect(feedUnits([fypPage([fypUnit(1), foreign])]).map((u) => u.public_ref)).toEqual([fypUnit(1).public_ref]);
  });

  it('is empty before anything loaded', () => {
    expect(feedUnits(undefined)).toEqual([]);
  });

  it('leaves a withdrawn Scene out wherever it appears and touches nothing else', () => {
    const pages = [
      fypPage([fypUnit(1), fypUnit(2), fypUnit(3)], 'c1'),
      fypPage([fypUnit(2, { position: 4 }), fypUnit(4)], 'c2'),
    ];
    const withdrawn = new Set([fypUnit(2).public_ref]);
    expect(feedUnits(pages, withdrawn).map((u) => u.public_ref)).toEqual(
      [1, 3, 4].map((n) => fypUnit(n).public_ref),
    );
    // The pages themselves still carry it, and their cursors, as served.
    expect(pages.map((p) => p.next_cursor)).toEqual(['c1', 'c2']);
    expect(pages[0]!.items).toHaveLength(3);
  });
});

describe('the record of withdrawn Scenes', () => {
  const ref = (n: number) => fypUnit(n).public_ref;

  it('hides a Scene only from the session it was found for, and gathers several for that session', () => {
    const session = {};
    const record = withdrawFrom(withdrawFrom(noWithdrawals, session, ref(1)), session, ref(2));
    expect([...(withdrawnIn(record, session) ?? [])]).toEqual([ref(1), ref(2)]);
    // Another session, with an identical first page or not, is not this one.
    expect(withdrawnIn(record, {})).toBeUndefined();
    expect(withdrawnIn(record, undefined)).toBeUndefined();
  });

  it('holds one session, however many go by: a newer session replaces it, and nothing loaded records nothing', () => {
    let record = noWithdrawals;
    for (let n = 1; n <= 1000; n++) record = withdrawFrom(record, {}, ref(n));
    expect(record.refs.size).toBe(1);
    expect(withdrawFrom(noWithdrawals, undefined, ref(1))).toBe(noWithdrawals);
    const first = {};
    const kept = withdrawFrom(noWithdrawals, first, ref(1));
    // A repeat for the session already held adds no entry.
    expect(withdrawFrom(kept, first, ref(1)).refs.size).toBe(1);
    expect(withdrawnIn(withdrawFrom(kept, {}, ref(2)), first)).toBeUndefined();
  });

  it('a record made for a session that is no longer shown says nothing about the next one, even after the key is reused', () => {
    // The same feed key can name a new server session (sign out, sign in): only the first page tells them apart.
    const earlier = fypPage([fypUnit(1)], null);
    const later = fypPage([fypUnit(1)], null);
    expect(earlier).toEqual(later);
    const record = withdrawFrom(noWithdrawals, earlier, ref(1));
    expect(withdrawnIn(record, earlier)?.has(ref(1))).toBe(true);
    expect(withdrawnIn(record, later)).toBeUndefined();
  });
});

describe('feedSessionEnded', () => {
  it.each([
    [problem('VALIDATION_FAILED', { path: 'cursor', reason: 'CURSOR_EXPIRED' }), true],
    [problem('VALIDATION_FAILED', { path: 'cursor', reason: 'CURSOR_INVALID' }), true],
    [problem('VALIDATION_FAILED', { path: 'X-Adulis-Device' }), false],
    [problem('RATE_LIMITED'), false],
    [new ApiError({ kind: 'offline' }), false],
    [new Error('boom'), false],
  ])('%#', (error, ended) => {
    expect(feedSessionEnded(error)).toBe(ended);
  });
});

describe('mediaUrl', () => {
  it('joins the bootstrap origin and the object key', () => {
    expect(mediaUrl('https://media.example.test', 'scenes/a/card.webp')).toBe('https://media.example.test/scenes/a/card.webp');
    expect(mediaUrl('https://media.example.test/bucket/', 'k.webp')).toBe('https://media.example.test/bucket/k.webp');
  });

  it.each([
    ['no origin', '', 'k.webp'],
    ['an undefined origin', undefined, 'k.webp'],
    ['a non-http origin', 'javascript:alert(1)', 'k.webp'],
    ['an origin with a query', 'https://m.example.test/?x=1', 'k.webp'],
    ['a parent segment', 'https://m.example.test', 'scenes/../secret'],
    ['a scheme in the key', 'https://m.example.test', 'https://evil.test/x.webp'],
    ['an absolute key', 'https://m.example.test', '/etc/passwd'],
    ['a protocol-relative key', 'https://m.example.test', 'a//evil.test'],
    ['userinfo in the origin', 'https://media.adulis.et@evil.example', 'k.webp'],
    ['a backslash in the origin', 'https://media.adulis.et\\@evil.example', 'k.webp'],
  ])('refuses %s', (_label, origin, key) => {
    expect(mediaUrl(origin, key)).toBeNull();
  });
});
