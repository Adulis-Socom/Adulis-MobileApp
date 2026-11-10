import { ApiError } from '../api/client';
import { isGone, isPathName, isPublicRef } from './public-read';

describe('route parameters (WO-005)', () => {
  it('a Scene reference is the server public_ref shape, nothing else', () => {
    expect(isPublicRef('scene-ref-000000000001')).toBe(true);
    expect(isPublicRef('AbCdEfGhIjKlMnOpQrStU_')).toBe(true);
    for (const bad of ['', 'short', 'scene-ref-0000000000012', '../scene-ref-00000000', 'scene/ref/00000000000', ['scene-ref-000000000001'], undefined]) {
      expect(isPublicRef(bad)).toBe(false);
    }
  });

  it('a handle or slug can never become a dot segment, a slash or an encoded path', () => {
    for (const good of ['seller-1', 'woven-basket', 'product-2', 'abc-']) expect(isPathName(good)).toBe(true);
    for (const bad of ['', '.', '..', 'a/b', 'a%2Fb', 'Bad.Handle', 'UPPER', '-lead', 'a b', ['seller-1'], undefined]) {
      expect(isPathName(bad)).toBe(false);
    }
  });

  it('only the server own 404 means gone', () => {
    const problem = (status: number) =>
      new ApiError({ kind: 'problem', status, problem: { type: 'about:blank', title_key: 'x', status, code: 'NOT_FOUND', request_id: 'r', retryable: false } });
    expect(isGone(problem(404))).toBe(true);
    expect(isGone(problem(500))).toBe(false);
    expect(isGone(new ApiError({ kind: 'unexpected', status: 404 }))).toBe(false);
    expect(isGone(new ApiError({ kind: 'offline' }))).toBe(false);
  });
});
