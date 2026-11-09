import { ApiError, type FypPage } from '../api/client';
import { fypPage, fypUnit } from '../testing/fake-api';
import { feedSessionEnded, feedUnits, mediaUrl } from './for-you-feed';

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
