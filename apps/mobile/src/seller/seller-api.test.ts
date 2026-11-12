import { ApiError } from '../api/client';
import { isRestricted, parseOrder, parseOrderPage, parseOverview, parseSellerList } from './seller-api';

/** WO-020: the Seller response boundary refuses what it cannot vouch for and invents nothing. */
const ID = 'aaaaaaaa-0000-4000-8000-00000000000a';
const ORDER = 'f5b00000-0000-4000-8000-000000000201';

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
  it('reads the counts and the window as sent; a bad count or window is null; nothing is computed', () => {
    expect(parseOverview({ products_published: 4, orders: 3, active_reservations: -1, completed_handoffs: 1.5, followers: '9', window: { from: '2026-10-13', to: '2026-11-12' } })).toEqual({
      productsPublished: 4,
      orders: 3,
      activeReservations: null,
      completedHandoffs: null,
      followers: null,
      window: { from: '2026-10-13', to: '2026-11-12' },
    });
    expect(parseOverview({ orders: 1, window: { from: 'yesterday', to: '2026-11-12' } }).window).toBeNull();
  });

  it('refuses a body with nothing it could show', () => {
    expect(() => parseOverview({ unexpected: true })).toThrow(ApiError);
    expect(() => parseOverview(null)).toThrow(ApiError);
  });
});

describe('parseOrderPage and parseOrder', () => {
  const o = { id: ORDER, state: 'CREATED', created_at: '2026-11-12T16:49:54.868Z', expires_at: null, ready_at: 'soon', line_count: '2', total: { amount_minor: 120000, currency: 'ETB' } };

  it('reads rows as sent (line_count as digits or a number), drops malformed rows, keeps the cursor opaque', () => {
    const page = parseOrderPage({ data: [o, { ...o, id: 'nope' }, { ...o, id: ORDER.replace('201', '202'), line_count: 3, total: { amount_minor: '1', currency: 'ETB' } }], has_more: true, next_cursor: '2026-11-12T16:49:54.865Z' });
    expect(page.next_cursor).toBe('2026-11-12T16:49:54.865Z');
    expect(page.data).toEqual([
      { id: ORDER, state: 'CREATED', createdAt: o.created_at, expiresAt: null, readyAt: null, total: { amountMinor: 120000, currency: 'ETB' }, lineCount: 2 },
      { id: ORDER.replace('201', '202'), state: 'CREATED', createdAt: o.created_at, expiresAt: null, readyAt: null, total: null, lineCount: 3 },
    ]);
    expect(() => parseOrderPage({ data: [] })).toThrow(ApiError);
  });

  it('a detail counts its lines and reads no payment data or actions', () => {
    const detail = parseOrder({ ...o, allowed_actions: ['seller.orders:respond'], lines: [{}, {}, {}], payment_submissions: [{ id: 'x' }], history: [] });
    expect(detail.lineCount).toBe(3);
    expect(Object.keys(detail).sort()).toEqual(['createdAt', 'expiresAt', 'id', 'lineCount', 'readyAt', 'state', 'total']);
    expect(() => parseOrder({ ...o, state: '' })).toThrow(ApiError);
  });
});
