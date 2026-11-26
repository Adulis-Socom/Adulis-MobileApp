import { describe, expect, it } from 'vitest';
import { TransportError } from '../transport/port';
import { createWorld, DEMO_CODES, PERSONAS, type World } from './world';

function setup(): World {
  return createWorld({ now: () => Date.UTC(2026, 10, 27, 9, 0, 0), latencyMs: 0 });
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

describe('SC-FE-10 Insights: server projections with every metric state kept apart', () => {
  it('serves a real zero, a withheld, an unknown, an unavailable and an unsupported figure, each as itself', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const view = await world.handle('insights.get', {}, ALEM);
    const all = Object.fromEntries(view.sections.flatMap((s) => s.metrics).map((m) => [m.code, m.metric]));
    expect(all['SCENE_QUALIFIED_IMPRESSIONS']).toEqual({ state: 'VALUE', value: 1240 });
    expect(all['PRODUCT_TAG_OPENS']).toEqual({ state: 'VALUE', value: 0 });
    expect(all['PRODUCT_SAVES']).toEqual({ state: 'WITHHELD' });
    expect(all['STOREFRONT_VISITS']).toEqual({ state: 'UNKNOWN' });
    expect(all['AUTOMATED_ANSWERS']).toEqual({ state: 'UNAVAILABLE' });
    expect(all['PURCHASE_CONVERSION']).toEqual({ state: 'UNSUPPORTED' });
    expect(view.window.days).toBe(30);
    expect(view.timezone).toBe('Africa/Addis_Ababa');
    expect(view.sections.flatMap((s) => s.metrics).every((m) => m.definition_version >= 1)).toBe(true);
  });

  it('fabricates no financial or delivery figure anywhere', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const codes = (await world.handle('insights.get', {}, ALEM)).sections.flatMap((s) => s.metrics.map((m) => m.code)).join(' ');
    expect(codes).not.toMatch(/GMV|REVENUE|PAID|PAYMENT|ORDER|SETTLE|PAYOUT|REFUND|DELIVER/);
    const unsupported = (await world.handle('insights.get', {}, ALEM)).sections.find((s) => s.code === 'NOT_MEASURED');
    expect(unsupported?.metrics.every((m) => m.metric.state === 'UNSUPPORTED')).toBe(true);
  });

  it('says when a projection is stale', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_states');
    expect((await world.handle('insights.get', {}, { sellerId: 'fx_seller_iman' })).stale).toBe(true);
    expect((await world.handle('insights.get', {}, { sellerId: 'fx_seller_dawit' })).stale).toBe(false);
  });
});

describe('SC-FE-10 Insights: role scope and entitlement (AUTH-02 seller.analytics codes)', () => {
  it('the Analyst sees every section; the Campaign Manager sees no storefront and inquiry section', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_analyst');
    expect((await world.handle('insights.get', {}, ALEM)).sections.map((s) => s.code)).toEqual(['DISCOVERY', 'PRODUCTS', 'STOREFRONT', 'MESSAGING', 'NOT_MEASURED']);
    await signIn(world, 'fx_acct_campaign');
    expect((await world.handle('insights.get', {}, ALEM)).sections.map((s) => s.code)).toEqual(['DISCOVERY', 'PRODUCTS', 'MESSAGING', 'NOT_MEASURED']);
  });

  it('Sales Support and Inventory are denied; a Seller without the entitlement is denied too', async () => {
    const world = setup();
    for (const who of ['fx_acct_sales', 'fx_acct_inventory']) {
      await signIn(world, who);
      expect((await failure(world.handle('insights.get', {}, ALEM))).code).toBe('PERMISSION_DENIED');
    }
    await signIn(world, 'fx_acct_owner');
    expect((await failure(world.handle('insights.get', {}, { sellerId: 'fx_seller_biruk' }))).code).toBe('PERMISSION_DENIED');
  });
});

describe('SC-FE-10 Plan (Subscription Option B, RB25-D11): status only, nothing to buy', () => {
  it('reports that no plan is defined and which destinations are included, as the server decides', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const biruk = await world.handle('subscription.get', {}, { sellerId: 'fx_seller_biruk' });
    expect(biruk).toMatchObject({ plan_state: 'NONE_DEFINED', plan_label: null });
    expect(biruk.features.find((f) => f.key === 'insights')).toEqual({ key: 'insights', included: false });
    expect(biruk.features.find((f) => f.key === 'products')).toEqual({ key: 'products', included: true });
    expect(Object.keys(biruk).sort()).toEqual(['features', 'plan_label', 'plan_state', 'seller_id']);
  });

  it('is Owner and Admin only, like the rest of Settings', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_analyst');
    expect((await failure(world.handle('subscription.get', {}, ALEM))).code).toBe('PERMISSION_DENIED');
  });
});
