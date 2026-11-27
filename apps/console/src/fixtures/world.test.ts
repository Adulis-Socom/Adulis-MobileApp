import { describe, expect, it } from 'vitest';
import type { OpId } from '../contracts/gap-sc';
import { TransportError } from '../transport/port';
import { BLOCKED_CODE, createWorld, DEMO_CODES, PERSONAS, type World } from './world';

const phoneOf = (id: string): string => {
  const found = PERSONAS.find((p) => p.id === id);
  if (!found) throw new Error(`no persona ${id}`);
  return found.phone;
};

function fresh(): World {
  return createWorld({ now: () => Date.now(), latencyMs: 0 });
}

async function signIn(world: World, personaId: string): Promise<void> {
  const challenge = await world.handle('auth.otp.start', { phone: phoneOf(personaId) }, {});
  const result = await world.handle('auth.otp.verify', { challenge_id: challenge.challenge_id, code: DEMO_CODES.ok }, {});
  expect(result.result).toBe('SIGNED_IN');
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

describe('fixture world: GOV-06 release-boundary behaviour', () => {
  it('RN-3: an unserved or prohibited operation is refused and carries the blocked code', async () => {
    const world = fresh();
    for (const op of ['payments.confirm', 'payout.update', 'order.accept', 'reservation.create', 'trust.advance', 'nonsense.op']) {
      try {
        await world.handle(op as OpId, {} as never, {});
        throw new Error(`${op} was served`);
      } catch (error) {
        expect(error).toBeInstanceOf(TransportError);
        expect((error as TransportError).code).toBe('REFUSED');
        expect((error as TransportError).detail).toBe(BLOCKED_CODE);
      }
    }
  });

  it('every identifier it hands out is synthetic (reserved fx_ prefix)', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_owner');
    const ctx = await world.handle('account.context.get', {}, {});
    const ids = [ctx.account.id, ...ctx.memberships.map((m) => m.seller.id)];
    expect(ids.length).toBeGreaterThan(3);
    for (const id of ids) expect(id.startsWith('fx_')).toBe(true);
  });
});

describe('fixture world: authentication outcomes (GAP-SC-01)', () => {
  it('signs in with the demonstration code and reports every failure distinctly', async () => {
    const world = fresh();
    const c = await world.handle('auth.otp.start', { phone: phoneOf('fx_acct_owner') }, {});
    expect(await code(world.handle('auth.otp.verify', { challenge_id: c.challenge_id, code: DEMO_CODES.invalid }, {}))).toBe('OTP_INVALID');
    expect(await code(world.handle('auth.otp.verify', { challenge_id: c.challenge_id, code: DEMO_CODES.rateLimited }, {}))).toBe('RATE_LIMITED');
    expect(await code(world.handle('auth.otp.verify', { challenge_id: c.challenge_id, code: DEMO_CODES.expired }, {}))).toBe('OTP_EXPIRED');
    // once expired, the server says so and allows a resend: the Console never decides this from its own clock
    expect((await world.handle('auth.otp.status', { challenge_id: c.challenge_id }, {})).state).toBe('EXPIRED');
  });

  it('resend is refused until the server deadline and then invalidates the old code', async () => {
    let now = 1_000_000;
    const world = createWorld({ now: () => now, latencyMs: 0 });
    const c = await world.handle('auth.otp.start', { phone: phoneOf('fx_acct_owner') }, {});
    expect(await code(world.handle('auth.otp.resend', { challenge_id: c.challenge_id }, {}))).toBe('RATE_LIMITED');
    now += 5_000;
    expect((await world.handle('auth.otp.status', { challenge_id: c.challenge_id }, {})).resend_allowed).toBe(true);
    const next = await world.handle('auth.otp.resend', { challenge_id: c.challenge_id }, {});
    expect(next.challenge_id).not.toBe(c.challenge_id);
    expect(await code(world.handle('auth.otp.verify', { challenge_id: c.challenge_id, code: DEMO_CODES.ok }, {}))).toBe('OTP_EXPIRED');
  });

  it('a new number needs both declarations, and a missing one is refused uniformly', async () => {
    const world = fresh();
    const c = await world.handle('auth.otp.start', { phone: '+251911999888' }, {});
    const verified = await world.handle('auth.otp.verify', { challenge_id: c.challenge_id, code: DEMO_CODES.ok }, {});
    expect(verified.result).toBe('DECLARATIONS_REQUIRED');
    const version = verified.result === 'DECLARATIONS_REQUIRED' ? verified.policy_version : '';
    expect(await code(world.handle('auth.declarations.accept', { adult_declaration: true, policy_accepted: false, policy_version: version }, {}))).toBe('VALIDATION_FAILED');
    expect(await code(world.handle('auth.declarations.accept', { adult_declaration: false, policy_accepted: true, policy_version: version }, {}))).toBe('VALIDATION_FAILED');
    expect(await code(world.handle('auth.declarations.accept', { adult_declaration: true, policy_accepted: true, policy_version: version }, {}))).toBe('OK');
    expect((await world.handle('account.context.get', {}, {})).memberships).toHaveLength(0);
  });

  it('recovery answers the same for every number (no account enumeration)', async () => {
    const world = fresh();
    expect(await world.handle('auth.recovery.start', { phone: phoneOf('fx_acct_owner') }, {})).toEqual(await world.handle('auth.recovery.start', { phone: '+251911000111' }, {}));
  });

  it('without a session every account read is AUTHENTICATION_REQUIRED, and a revoked session ends the same way', async () => {
    const world = fresh();
    expect(await code(world.handle('account.context.get', {}, {}))).toBe('AUTHENTICATION_REQUIRED');
    await signIn(world, 'fx_acct_owner');
    world.hooks.revokeSession();
    expect(await code(world.handle('account.context.get', {}, {}))).toBe('AUTHENTICATION_REQUIRED');
  });
});

describe('fixture world: Seller isolation (RN-4, GAP-SC-02)', () => {
  it('a Seller that is not yours and a Seller that does not exist are indistinguishable', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_owner');
    expect(await code(world.handle('seller.home.get', {}, { sellerId: 'fx_seller_dawit' }))).toBe('PERMISSION_DENIED');
    expect(await code(world.handle('seller.home.get', {}, { sellerId: 'fx_seller_nobody' }))).toBe('PERMISSION_DENIED');
  });

  it('every Seller-scoped answer echoes its own Seller and carries no other Seller data', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_owner');
    const names = { fx_seller_alem: 'Alem Textiles', fx_seller_biruk: 'Biruk Shoes', fx_seller_chaltu: 'Chaltu Crafts' } as const;
    for (const id of Object.keys(names) as (keyof typeof names)[]) {
      const bodies = JSON.stringify([
        await world.handle('seller.home.get', {}, { sellerId: id }),
        await world.handle('seller.readiness.get', {}, { sellerId: id }),
        await world.handle('notifications.list', {}, { sellerId: id }),
        await world.handle('seller.eligibility.get', {}, { sellerId: id }),
        await world.handle('seller.access.get', {}, { sellerId: id }),
      ]);
      for (const other of Object.keys(names)) {
        if (other !== id) expect(bodies).not.toContain(other);
      }
      expect((await world.handle('market.context.get', {}, { sellerId: id })).seller_id).toBe(id);
    }
  });

  it('a Seller-scoped operation without a Seller is refused', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_owner');
    expect(await code(world.handle('seller.home.get', {}, {}))).toBe('REFUSED');
  });
});

describe('fixture world: capabilities, roles and entitlements (server decides)', () => {
  it('role views differ and missing permission removes the destination entirely', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_sales');
    const access = await world.handle('seller.access.get', {}, { sellerId: 'fx_seller_alem' });
    expect(access.destinations.map((d) => d.key)).toEqual(['home', 'inbox', 'trust']); // AUTH-02: Sales Support holds seller.trust:read
    const brief = await world.handle('seller.home.get', {}, { sellerId: 'fx_seller_alem' });
    expect(brief.role_view).toBe('SALES_SUPPORT');
    expect(brief.areas.map((a) => a.key)).not.toContain('PRODUCTS');
  });

  it('combined roles union their destinations and areas', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_multirole');
    const access = await world.handle('seller.access.get', {}, { sellerId: 'fx_seller_alem' });
    expect(access.destinations.map((d) => d.key)).toEqual(['home', 'products', 'inbox', 'trust']);
  });

  it('missing entitlement is reported as NO_ENTITLEMENT, not removed', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_owner');
    const access = await world.handle('seller.access.get', {}, { sellerId: 'fx_seller_biruk' });
    expect(access.destinations.find((d) => d.key === 'insights')?.access).toBe('NO_ENTITLEMENT');
  });

  it('a team member without the capability sees the resolving action as denied, and cannot start admission', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_inv_biruk');
    const readiness = await world.handle('seller.readiness.get', {}, { sellerId: 'fx_seller_biruk' });
    const eligibility = readiness.items.find((i) => i.code === 'ELIGIBILITY_SATISFIED');
    expect(eligibility?.resolving_action?.denied).toBe('NO_PERMISSION');
    expect(await code(world.handle('seller.social.start', { platform: 'TIKTOK', handle: '@x.y' }, { sellerId: 'fx_seller_biruk' }))).toBe('PERMISSION_DENIED');
  });

  it('a capability change is visible on the next ask', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_owner');
    const before = await world.handle('seller.access.get', {}, { sellerId: 'fx_seller_alem' });
    expect(before.destinations.map((d) => d.key)).toContain('products');
    world.hooks.revokeDestination('fx_seller_alem', 'products');
    world.hooks.revokeCapability('fx_seller_alem', 'readiness.resolve');
    const after = await world.handle('seller.access.get', {}, { sellerId: 'fx_seller_alem' });
    expect(after.destinations.map((d) => d.key)).not.toContain('products');
    expect(after.capabilities).not.toContain('readiness.resolve');
  });

  it('a safety-suspended Seller keeps Home, read-only Trust and Settings, says why, and holds no write capability (P-70)', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_states');
    const access = await world.handle('seller.access.get', {}, { sellerId: 'fx_seller_gelila' });
    expect(access.destinations.map((d) => d.key)).toEqual(['home', 'trust', 'settings']);
    expect([...access.capabilities].sort()).toEqual(['notifications.view', 'reviews.read', 'trust.read']);
    expect(access.restriction).not.toBeNull();
  });

  it('answers a request sent under a session that has since ended as unauthenticated, and leaves the new session alone', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_owner');
    world.hooks.delayNext('seller.home.get', 30);
    const late = world.handle('seller.home.get', {}, { sellerId: 'fx_seller_alem' }).then(
      () => 'ok',
      (e: unknown) => (e instanceof TransportError ? e.code : 'other'),
    );
    await world.handle('auth.session.end', {}, {});
    await signIn(world, 'fx_acct_owner');
    expect(await late).toBe('AUTHENTICATION_REQUIRED');
    // The current session is untouched by the obsolete request's failure.
    expect((await world.handle('account.context.get', {}, {})).account.id).toBe('fx_acct_owner');
  });
});

describe('fixture world: readiness, admission and Seller creation', () => {
  it('covers incomplete, partial, complete, missing company data, pending, refused and unavailable', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_states');
    const ready = async (id: string) => world.handle('seller.readiness.get', {}, { sellerId: id });
    expect((await ready('fx_seller_dawit')).ready).toBe(true);
    const eden = await ready('fx_seller_eden');
    expect(eden.ready).toBe(false);
    expect(eden.items.find((i) => i.code === 'COMPANY_DETAILS')?.reason_codes).toContain('COMPANY_DETAILS_INCOMPLETE');
    expect(eden.items.find((i) => i.code === 'ELIGIBILITY_SATISFIED')?.workflow_state).toBe('WAITING_FOR_DM_REVIEW');
    const fana = await world.handle('seller.eligibility.get', {}, { sellerId: 'fx_seller_fana' });
    expect(fana.outcome).toBe('NOT_SATISFIED');
    expect(fana.workflow_state).toBeNull();
    expect(await code(ready('fx_seller_hana'))).toBe('UNAVAILABLE');
  });

  it('starting social verification persists, so onboarding resumes where it stopped', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_owner');
    const before = await world.handle('seller.eligibility.get', {}, { sellerId: 'fx_seller_biruk' });
    expect(before.workflow_state).toBe('NEEDS_SELLER_ACTION');
    const started = await world.handle('seller.social.start', { platform: 'TIKTOK', handle: 'biruk.shoes' }, { sellerId: 'fx_seller_biruk' });
    expect(started.seller_id).toBe('fx_seller_biruk');
    await world.handle('auth.session.end', {}, {});
    await signIn(world, 'fx_acct_owner');
    const after = await world.handle('seller.eligibility.get', {}, { sellerId: 'fx_seller_biruk' });
    expect(after.outcome).toBe('PENDING');
    expect(after.social_accounts[0]?.handle).toBe('@biruk.shoes');
  });

  it('creating a Seller is idempotent for one key and validates the handle', async () => {
    const world = fresh();
    const c = await world.handle('auth.otp.start', { phone: phoneOf('fx_acct_new') }, {});
    const verified = await world.handle('auth.otp.verify', { challenge_id: c.challenge_id, code: DEMO_CODES.ok }, {});
    expect(verified.result).toBe('DECLARATIONS_REQUIRED');
    await world.handle('auth.declarations.accept', { adult_declaration: true, policy_accepted: true, policy_version: 'fx_age_policy_1' }, {});
    const input = { market_id: 'fx_market_ethiopia', seller_type: 'INDIVIDUAL' as const, display_name: 'Zed Store', handle: 'zed.store' };
    const first = await world.handle('seller.create', input, { idempotencyKey: 'k1' });
    const again = await world.handle('seller.create', input, { idempotencyKey: 'k1' });
    expect(again.id).toBe(first.id);
    expect(first.status).toBe('DRAFT');
    expect((await world.handle('account.context.get', {}, {})).memberships).toHaveLength(1);
    try {
      await world.handle('seller.create', { ...input, handle: 'alem' }, { idempotencyKey: 'k2' });
      throw new Error('a taken handle was accepted');
    } catch (error) {
      expect((error as TransportError).fields['handle']).toBe('HANDLE_TAKEN');
    }
  });

  it('the Home brief invents no business figure: unbuilt areas are DEFERRED, never a count', async () => {
    const world = fresh();
    await signIn(world, 'fx_acct_owner');
    const brief = await world.handle('seller.home.get', {}, { sellerId: 'fx_seller_alem' });
    const built = ['NOTIFICATIONS', 'PRODUCTS', 'INVENTORY', 'SCENES', 'STORIES', 'INBOX'];
    expect(brief.areas.filter((a) => !built.includes(a.key)).every((a) => a.state !== 'AVAILABLE')).toBe(true);
    expect(brief.areas.filter((a) => built.includes(a.key)).every((a) => a.state === 'AVAILABLE')).toBe(true);
    expect(JSON.stringify(brief)).not.toMatch(/revenue|gmv|payment|paid|order|delivery/i);
  });
});
