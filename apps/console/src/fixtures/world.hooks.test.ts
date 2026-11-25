import { describe, expect, it } from 'vitest';
import { TransportError } from '../transport/port';
import { createWorld, DEMO_CODES, PERSONAS, type World } from './world';

const phoneOf = (id: string): string => PERSONAS.find((p) => p.id === id)?.phone ?? '';
const fresh = (): World => createWorld({ now: () => Date.now(), latencyMs: 0 });

async function signIn(world: World, id: string): Promise<void> {
  const c = await world.handle('auth.otp.start', { phone: phoneOf(id) }, {});
  await world.handle('auth.otp.verify', { challenge_id: c.challenge_id, code: DEMO_CODES.ok }, {});
}
async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TransportError) return error.code;
    throw error;
  }
  return 'OK';
}

describe('fixture world: the hooks the fail-closed tests rely on', () => {
  it('failNext fails exactly the next N calls of one operation and then recovers', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_owner');
    world.hooks.failNext('seller.access.get', 'NETWORK', 2);
    expect(await code(world.handle('seller.access.get', {}, { sellerId: 'fx_seller_alem' }))).toBe('NETWORK');
    expect(await code(world.handle('seller.access.get', {}, { sellerId: 'fx_seller_alem' }))).toBe('NETWORK');
    expect(await code(world.handle('seller.access.get', {}, { sellerId: 'fx_seller_alem' }))).toBe('OK');
    // other operations were never affected
    expect(await code(world.handle('seller.home.get', {}, { sellerId: 'fx_seller_alem' }))).toBe('OK');
  });

  it('revokeMembership removes only the signed-in account relationship, and every Seller call then reads as not-yours', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_owner');
    world.hooks.revokeMembership('fx_seller_alem');
    expect(await code(world.handle('seller.access.get', {}, { sellerId: 'fx_seller_alem' }))).toBe('PERMISSION_DENIED');
    expect((await world.handle('account.context.get', {}, {})).memberships.map((m) => m.seller.id)).not.toContain('fx_seller_alem');
    expect(await code(world.handle('seller.access.get', {}, { sellerId: 'fx_seller_biruk' }))).toBe('OK');
  });

  it('notifications follow the notifications.view capability, like the destination they feed', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_owner');
    expect(await code(world.handle('notifications.list', {}, { sellerId: 'fx_seller_alem' }))).toBe('OK');
    world.hooks.revokeCapability('fx_seller_alem', 'notifications.view');
    expect(await code(world.handle('notifications.list', {}, { sellerId: 'fx_seller_alem' }))).toBe('PERMISSION_DENIED');
  });

  it('a mixed account has different roles at different Sellers, and the capabilities do not carry over', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_mixed');
    const owner = await world.handle('seller.access.get', {}, { sellerId: 'fx_seller_lemlem' });
    const inventory = await world.handle('seller.access.get', {}, { sellerId: 'fx_seller_alem' });
    expect(owner.destinations).toHaveLength(8);
    expect(owner.capabilities).toContain('readiness.resolve');
    expect(inventory.destinations.map((d) => d.key)).toEqual(['home', 'products']);
    expect(inventory.capabilities).not.toContain('readiness.resolve');
  });
});
