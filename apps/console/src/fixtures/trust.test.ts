import { describe, expect, it } from 'vitest';
import { TransportError } from '../transport/port';
import { createWorld, DEMO_CODES, PERSONAS, type World } from './world';

function setup(): { world: World } {
  const clock = Date.UTC(2026, 10, 26, 9, 0, 0);
  return { world: createWorld({ now: () => clock, latencyMs: 0 }) };
}
async function signIn(world: World, personaId: string): Promise<void> {
  const phone = PERSONAS.find((p) => p.id === personaId)?.phone ?? '';
  const challenge = await world.handle('auth.otp.start', { phone }, {});
  await world.handle('auth.otp.verify', { challenge_id: challenge.challenge_id, code: DEMO_CODES.ok }, {});
}
async function failure(promise: Promise<unknown>): Promise<TransportError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TransportError) return error;
    throw error;
  }
  throw new Error('expected a TransportError, the call succeeded');
}
const ALEM = { sellerId: 'fx_seller_alem' };
const BIRUK = { sellerId: 'fx_seller_biruk' };

describe('SC-FE-09 fixture standing: the level is whatever the server holds', () => {
  it('serves each demonstration level, and never an evaluation time for a Seller that was never evaluated', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    expect(await world.handle('standing.get', {}, ALEM)).toMatchObject({ level: 'ESTABLISHED' });
    expect((await world.handle('standing.get', {}, ALEM)).evaluated_at).not.toBeNull();
    expect(await world.handle('standing.get', {}, BIRUK)).toMatchObject({ level: 'NEW', evaluated_at: null });
    await signIn(world, 'fx_acct_states');
    expect(await world.handle('standing.get', {}, { sellerId: 'fx_seller_iman' })).toMatchObject({ level: 'REBUILDING' });
  });
  it('carries no score, percentage, threshold, count of transactions or progress', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    expect(Object.keys(await world.handle('standing.get', {}, ALEM)).sort()).toEqual(['evaluated_at', 'level', 'seller_id']);
  });
});

describe('SC-FE-09 fixture reviews: two dimensions, never combined, never altered', () => {
  it('aggregates each dimension on its own and offers no overall rating or average', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const s = await world.handle('reviews.summary.get', {}, ALEM);
    expect(s.product).toEqual({ dimension: 'PRODUCT', count: 7, distribution: { '1': 1, '2': 1, '3': 1, '4': 1, '5': 3 } });
    expect(s.seller_service).toEqual({ dimension: 'SELLER_SERVICE', count: 4, distribution: { '1': 0, '2': 1, '3': 0, '4': 1, '5': 2 } });
    expect(Object.keys(s).sort()).toEqual(['product', 'seller_id', 'seller_service']);
    expect(JSON.stringify(s)).not.toMatch(/average|overall|combined|score/i);
  });
  it('pages newest first, keeps the dimensions apart, and labels a Product review with its Product only', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const p1 = await world.handle('reviews.list', { dimension: 'PRODUCT', cursor: null }, ALEM);
    expect(p1.items.map((r) => r.id)).toEqual(['fx_rev_alem_1', 'fx_rev_alem_2', 'fx_rev_alem_3']);
    expect(p1.items[0]?.product_label).toBe('Linen wrap dress');
    const p2 = await world.handle('reviews.list', { dimension: 'PRODUCT', cursor: p1.next_cursor }, ALEM);
    const p3 = await world.handle('reviews.list', { dimension: 'PRODUCT', cursor: p2.next_cursor }, ALEM);
    expect([...p1.items, ...p2.items, ...p3.items]).toHaveLength(7);
    expect(p3.next_cursor).toBeNull();
    const service = await world.handle('reviews.list', { dimension: 'SELLER_SERVICE', cursor: null }, ALEM);
    expect(service.items.every((r) => r.dimension === 'SELLER_SERVICE' && r.product_label === null)).toBe(true);
  });
  it('shows an empty state for a Seller with no reviews, not an error', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const s = await world.handle('reviews.summary.get', {}, BIRUK);
    expect(s.product.count).toBe(0);
    expect((await world.handle('reviews.list', { dimension: 'PRODUCT', cursor: null }, BIRUK)).items).toEqual([]);
  });
  it('implies no purchase: no proof, reference, badge or reply, in the contract or the data', async () => {
    const { world } = setup();
    await signIn(world, 'fx_acct_owner');
    const all = [...(await world.handle('reviews.list', { dimension: 'PRODUCT', cursor: null }, ALEM)).items, ...(await world.handle('reviews.list', { dimension: 'SELLER_SERVICE', cursor: null }, ALEM)).items];
    for (const r of all) expect(Object.keys(r).sort()).toEqual(['dimension', 'id', 'product_label', 'stars', 'text', 'written_at']);
    expect(JSON.stringify(all)).not.toMatch(/verified|purchase|receipt|order/i);
    expect(all.every((r) => r.id.startsWith('fx_rev_'))).toBe(true);
  });
});

describe('SC-FE-09 fixture permissions (AUTH-02: trust for four roles, reviews for three)', () => {
  it('lets Owner, Admin and Sales Support read both; Inventory the level only', async () => {
    const { world } = setup();
    for (const who of ['fx_acct_owner', 'fx_acct_admin', 'fx_acct_sales']) {
      await signIn(world, who);
      await world.handle('standing.get', {}, ALEM);
      await world.handle('reviews.summary.get', {}, ALEM);
    }
    await signIn(world, 'fx_acct_inventory');
    await world.handle('standing.get', {}, ALEM);
    expect((await failure(world.handle('reviews.summary.get', {}, ALEM))).code).toBe('PERMISSION_DENIED');
    expect((await failure(world.handle('reviews.list', { dimension: 'PRODUCT', cursor: null }, ALEM))).code).toBe('PERMISSION_DENIED');
  });
  it('denies Analyst and Campaign Manager everything', async () => {
    const { world } = setup();
    for (const who of ['fx_acct_analyst', 'fx_acct_campaign']) {
      await signIn(world, who);
      for (const call of [world.handle('standing.get', {}, ALEM), world.handle('reviews.summary.get', {}, ALEM)]) expect((await failure(call)).code).toBe('PERMISSION_DENIED');
    }
  });
  it('has no write at all: every Trust and Review operation is a read', () => {
    const { world } = setup();
    expect(Object.keys(world.hooks)).not.toContain('writeReview');
  });
});
