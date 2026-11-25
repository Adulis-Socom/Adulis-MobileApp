import { ApiError } from '../api/client';
import { isRestricted, parseOverview, parseSellerList } from './seller-api';

/** WO-020: the Seller response boundary refuses what it cannot vouch for and invents nothing. */
const ID = 'aaaaaaaa-0000-4000-8000-00000000000a';

describe('parseSellerList', () => {
  it('keeps valid rows once, drops DELETED, malformed and repeated ones; an empty list is an answer', () => {
    const row = { id: ID, handle: 'a', store_name: 'Store A', status: 'ACTIVE', role: 'OWNER' };
    expect(parseSellerList({ data: [row, row, { ...row, id: 'x' }, { ...row, id: ID.replace('a', 'b'), status: 'DELETED' }, null, { ...row, id: ID.replace('a', 'c'), store_name: '' }] })).toEqual([
      { id: ID, handle: 'a', storeName: 'Store A', status: 'ACTIVE', role: 'OWNER' },
    ]);
    expect(parseSellerList({ data: [] })).toEqual([]);
    expect(() => parseSellerList([row])).toThrow(ApiError);
    expect(() => parseSellerList({})).toThrow(ApiError);
  });

  it('treats every status but ACTIVE as restricted (shown as it is)', () => {
    expect(isRestricted('ACTIVE')).toBe(false);
    for (const s of ['DRAFT', 'CLOSING', 'SAFETY_SUSPENDED', 'SOMETHING_NEW']) expect(isRestricted(s)).toBe(true);
  });
});

describe('parseOverview', () => {
  it('reads the counts as sent; a bad count is null; nothing is computed', () => {
    expect(parseOverview({ products_published: 4, followers: '9', window: { from: '2026-10-13', to: '2026-11-12' } })).toEqual({
      productsPublished: 4,
      followers: null,
    });
    expect(parseOverview({ products_published: 1.5, followers: 2 })).toEqual({ productsPublished: null, followers: 2 });
  });

  it('refuses a body with nothing it could show', () => {
    expect(() => parseOverview({ unexpected: true })).toThrow(ApiError);
    expect(() => parseOverview(null)).toThrow(ApiError);
  });
});
