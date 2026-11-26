import { describe, expect, it } from 'vitest';
import type { StepUpPurpose } from '../contracts/gap-sc-account';
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
async function grant(world: World, purpose: StepUpPurpose, sellerId: string | null): Promise<string> {
  const c = await world.handle('account.stepup.start', { purpose, seller_id: sellerId }, {});
  return (await world.handle('account.stepup.verify', { challenge_id: c.challenge_id, code: DEMO_CODES.ok }, {})).grant;
}
const ALEM = { sellerId: 'fx_seller_alem' };
const member = async (world: World, name: string) => {
  const m = (await world.handle('team.get', {}, ALEM)).members.find((x) => x.display_name.startsWith(name));
  if (!m) throw new Error(`no member ${name}`);
  return m;
};

describe('SC-FE-11 team: the permission matrix (AUTH-02 R-12)', () => {
  it('Owner and Admin manage the team; no other role reads it', async () => {
    const world = setup();
    for (const who of ['fx_acct_owner', 'fx_acct_admin']) {
      await signIn(world, who);
      expect((await world.handle('team.get', {}, ALEM)).allowed_actions).toContain('INVITE');
    }
    for (const who of ['fx_acct_sales', 'fx_acct_inventory', 'fx_acct_analyst', 'fx_acct_campaign']) {
      await signIn(world, who);
      expect((await failure(world.handle('team.get', {}, ALEM))).code).toBe('PERMISSION_DENIED');
    }
  });

  it('the Owner is derived: no role, no actions on them, and nobody can be made Owner', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_admin');
    const owner = (await world.handle('team.get', {}, ALEM)).members.find((m) => m.relationship === 'OWNER');
    expect(owner).toMatchObject({ roles: [], allowed_actions: [] });
    const target = await member(world, 'Saba');
    const e = await failure(world.handle('team.roles.set', { membership_id: target.membership_id, version: target.version, roles: ['OWNER' as never] }, ALEM));
    expect(e.fields).toEqual({ roles: 'ROLE_SET_EMPTY' });
    expect((await failure(world.handle('team.roles.set', { membership_id: owner?.membership_id ?? '', version: 1, roles: ['ADMIN'] }, ALEM))).code).toBe('PERMISSION_DENIED');
  });

  it('roles are a union, version-checked, and an active member never has zero roles', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const saba = await member(world, 'Saba');
    expect((await failure(world.handle('team.roles.set', { membership_id: saba.membership_id, version: saba.version, roles: [] }, ALEM))).fields).toEqual({ roles: 'ROLE_SET_EMPTY' });
    await world.handle('team.roles.set', { membership_id: saba.membership_id, version: saba.version, roles: ['SALES_SUPPORT', 'ANALYST'] }, ALEM);
    expect((await failure(world.handle('team.roles.set', { membership_id: saba.membership_id, version: saba.version, roles: ['INVENTORY'] }, ALEM))).code).toBe('CONFLICT');
    await signIn(world, 'fx_acct_sales');
    const access = await world.handle('seller.access.get', {}, ALEM);
    expect(access.destinations.map((d) => d.key)).toEqual(expect.arrayContaining(['inbox', 'insights']));
    expect(access.capabilities).not.toContain('ownership.transfer');
  });

  it('an Admin can never transfer ownership or close the Seller, whatever else they hold', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_admin');
    const view = await world.handle('team.get', {}, ALEM);
    expect(view.allowed_actions).not.toContain('TRANSFER_OWNERSHIP');
    expect((await failure(world.handle('ownership.transfer.start', { membership_id: 'x', step_up_grant: 'x' }, ALEM))).code).toBe('PERMISSION_DENIED');
    expect((await failure(world.handle('seller.closure.request', { step_up_grant: 'x', typed_name: 'Alem Textiles' }, ALEM))).code).toBe('PERMISSION_DENIED');
    expect((await world.handle('seller.closure.get', {}, ALEM)).allowed_actions).toEqual([]);
  });
});

describe('SC-FE-11 team: invitations, the one team slot, suspension and removal', () => {
  it('invites an existing Account by username; an unknown username is refused; nobody learns another Seller', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    expect((await failure(world.handle('team.invite', { username: 'nobody', roles: ['ANALYST'] }, ALEM))).fields).toEqual({ username: 'TEAM_INVITE_TARGET_NOT_FOUND' });
    expect((await failure(world.handle('team.invite', { username: 'hana', roles: [] }, ALEM))).fields).toEqual({ roles: 'ROLE_SET_EMPTY' });
    const view = await world.handle('team.invite', { username: 'ibsa', roles: ['ANALYST'] }, ALEM);
    const pending = view.invitations.find((i) => i.target_label === 'ibsa');
    expect(pending).toMatchObject({ state: 'PENDING', eligibility: 'IN_ANOTHER_TEAM' });
    expect(JSON.stringify(pending)).not.toMatch(/biruk/i);
  });

  it('a second invitation may wait, but cannot be accepted while the slot is held; acceptance activates atomically', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    await world.handle('team.invite', { username: 'ibsa', roles: ['ANALYST'] }, ALEM);
    await world.handle('team.invite', { username: 'hana', roles: ['ANALYST', 'SALES_SUPPORT'] }, ALEM);
    await signIn(world, 'fx_acct_inv_biruk');
    const mine = await world.handle('account.invitations.get', {}, {});
    expect(mine.items[0]).toMatchObject({ seller_label: 'Alem Textiles', blocked: 'SLOT_OCCUPIED' });
    expect((await failure(world.handle('account.invitations.accept', { invitation_id: mine.items[0]?.invitation_id ?? '' }, {}))).fields).toEqual({ invitation: 'TEAM_SLOT_OCCUPIED' });
    await signIn(world, 'fx_acct_free');
    const hana = await world.handle('account.invitations.get', {}, {});
    await world.handle('account.invitations.accept', { invitation_id: hana.items[0]?.invitation_id ?? '' }, {});
    const context = await world.handle('account.context.get', {}, {});
    expect(context.memberships.map((m) => [m.seller.id, [...m.roles]])).toEqual([['fx_seller_alem', ['ANALYST', 'SALES_SUPPORT']]]);
  });

  it('suspension removes all authority on the next request and keeps the slot; removal releases it', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const ino = await member(world, 'Ino');
    await world.handle('team.member.suspend', { membership_id: ino.membership_id, version: ino.version }, ALEM);
    await signIn(world, 'fx_acct_inventory');
    expect((await failure(world.handle('products.list', { query: '', filter: 'ALL', cursor: null }, ALEM))).code).toBe('PERMISSION_DENIED');
    expect((await world.handle('account.context.get', {}, {})).memberships).toHaveLength(0);
    await signIn(world, 'fx_acct_owner');
    await world.handle('team.invite', { username: 'ino', roles: ['ANALYST'] }, { sellerId: 'fx_seller_biruk' });
    await signIn(world, 'fx_acct_inventory');
    expect((await world.handle('account.invitations.get', {}, {})).items[0]?.blocked).toBe('SLOT_OCCUPIED');
    await signIn(world, 'fx_acct_owner');
    const suspended = await member(world, 'Ino');
    await world.handle('team.member.remove', { membership_id: suspended.membership_id, version: suspended.version }, ALEM);
    await signIn(world, 'fx_acct_inventory');
    expect((await world.handle('account.invitations.get', {}, {})).items[0]?.blocked).toBeNull();
  });

  it('a member cannot act on themselves, and team sessions can be signed out of this Seller', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_admin');
    const me = (await world.handle('team.get', {}, ALEM)).members.find((m) => m.is_you);
    expect(me?.allowed_actions).toEqual([]);
    const sessions = (await world.handle('team.get', {}, ALEM)).sessions ?? [];
    const first = sessions[0];
    const after = await world.handle('team.session.revoke', { session_id: first?.session_id ?? '' }, ALEM);
    expect(after.sessions?.map((s) => s.session_id)).not.toContain(first?.session_id);
  });
});

describe('SC-FE-11 step-up: purpose-bound, target-bound, one use', () => {
  it('a grant works once, only for its purpose and its Seller', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const abel = await member(world, 'Abel');
    const wrongPurpose = await grant(world, 'CLOSE_SELLER', 'fx_seller_alem');
    expect((await failure(world.handle('ownership.transfer.start', { membership_id: abel.membership_id, step_up_grant: wrongPurpose }, ALEM))).detail).toBe('STEP_UP_REQUIRED');
    const wrongSeller = await grant(world, 'TRANSFER_OWNERSHIP', 'fx_seller_biruk');
    expect((await failure(world.handle('ownership.transfer.start', { membership_id: abel.membership_id, step_up_grant: wrongSeller }, ALEM))).detail).toBe('STEP_UP_REQUIRED');
    const good = await grant(world, 'TRANSFER_OWNERSHIP', 'fx_seller_alem');
    const view = await world.handle('ownership.transfer.start', { membership_id: abel.membership_id, step_up_grant: good }, ALEM);
    expect(view.transfer).toMatchObject({ state: 'PENDING', target_label: 'Abel (demonstration)', activates_at: '2026-11-28T09:00:00.000Z' });
    await world.handle('ownership.transfer.cancel', {}, ALEM);
    expect((await failure(world.handle('ownership.transfer.start', { membership_id: abel.membership_id, step_up_grant: good }, ALEM))).detail).toBe('STEP_UP_REQUIRED');
  });

  it('refuses a wrong or expired code, and a Seller the account does not own', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const c = await world.handle('account.stepup.start', { purpose: 'CLOSE_SELLER', seller_id: 'fx_seller_alem' }, {});
    expect(c.target_label).toBe('Alem Textiles');
    expect((await failure(world.handle('account.stepup.verify', { challenge_id: c.challenge_id, code: DEMO_CODES.invalid }, {}))).code).toBe('OTP_INVALID');
    expect((await failure(world.handle('account.stepup.verify', { challenge_id: c.challenge_id, code: DEMO_CODES.expired }, {}))).code).toBe('OTP_EXPIRED');
    expect((await failure(world.handle('account.stepup.start', { purpose: 'CLOSE_SELLER', seller_id: 'fx_seller_dawit' }, {}))).code).toBe('PERMISSION_DENIED');
  });

  it('only an active Admin can receive ownership', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const saba = await member(world, 'Saba');
    const g = await grant(world, 'TRANSFER_OWNERSHIP', 'fx_seller_alem');
    expect((await failure(world.handle('ownership.transfer.start', { membership_id: saba.membership_id, step_up_grant: g }, ALEM))).fields).toEqual({ target: 'TRANSFER_TARGET_NOT_ELIGIBLE' });
  });
});

describe('SC-FE-11 closure (RB25-D11: debt-free)', () => {
  it('needs the exact name and fresh proof, records a cancellable request, and is blocked only by a pending transfer', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const open = await world.handle('seller.closure.get', {}, ALEM);
    expect(open).toMatchObject({ state: 'OPEN', blockers: [], allowed_actions: ['REQUEST'] });
    expect(JSON.stringify(open)).not.toMatch(/PAY|DEBT|OWED|BALANCE/);
    const g = await grant(world, 'CLOSE_SELLER', 'fx_seller_alem');
    expect((await failure(world.handle('seller.closure.request', { step_up_grant: g, typed_name: 'alem textiles' }, ALEM))).fields).toEqual({ typed_name: 'CLOSURE_NAME_MISMATCH' });
    const requested = await world.handle('seller.closure.request', { step_up_grant: g, typed_name: 'Alem Textiles' }, ALEM);
    expect(requested).toMatchObject({ state: 'CLOSURE_REQUESTED', allowed_actions: ['CANCEL'] });
    // Nothing was actually closed: the catalogue is still there.
    expect((await world.handle('products.list', { query: '', filter: 'ALL', cursor: null }, ALEM)).items.length).toBeGreaterThan(0);
    expect((await world.handle('seller.closure.cancel', {}, ALEM)).state).toBe('OPEN');
    const abel = await member(world, 'Abel');
    await world.handle('ownership.transfer.start', { membership_id: abel.membership_id, step_up_grant: await grant(world, 'TRANSFER_OWNERSHIP', 'fx_seller_alem') }, ALEM);
    expect(await world.handle('seller.closure.get', {}, ALEM)).toMatchObject({ blockers: ['OWNERSHIP_TRANSFER_PENDING'], allowed_actions: [] });
  });
});

describe('SC-FE-11 account: sessions, preferences, privacy and deletion', () => {
  it('revokes one other session freely, all others only with fresh proof, and never the current one by revocation', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const all = (await world.handle('account.sessions.get', {}, {})).sessions;
    const current = all.find((s) => s.current);
    expect((await failure(world.handle('account.sessions.revoke', { session_id: current?.session_id ?? '' }, {}))).fields).toEqual({ session: 'USE_SIGN_OUT_FOR_THIS_SESSION' });
    const left = await world.handle('account.sessions.revoke', { session_id: all.find((s) => !s.current)?.session_id ?? '' }, {});
    expect(left.sessions).toHaveLength(2);
    expect((await failure(world.handle('account.sessions.revoke_others', { step_up_grant: 'none' }, {}))).detail).toBe('STEP_UP_REQUIRED');
    const only = await world.handle('account.sessions.revoke_others', { step_up_grant: await grant(world, 'REVOKE_OTHER_SESSIONS', null) }, {});
    expect(only.sessions.map((s) => s.current)).toEqual([true]);
  });

  it('keeps security notices on: they cannot be turned off; the others can', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    expect((await failure(world.handle('account.preferences.set', { code: 'SECURITY', enabled: false }, {}))).fields).toEqual({ SECURITY: 'NOTICE_NOT_SUPPRESSIBLE' });
    const next = await world.handle('account.preferences.set', { code: 'TEAM_CHANGES', enabled: false }, {});
    expect(next.categories.find((c) => c.code === 'TEAM_CHANGES')?.enabled).toBe(false);
    expect(next.categories.find((c) => c.code === 'SECURITY')).toMatchObject({ enabled: true, suppressible: false });
  });

  it('an Owner of Sellers is told ownership blocks deletion; nothing is deleted and the request can be cancelled', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const before = await world.handle('privacy.get', {}, {});
    expect(before.deletion.blockers).toEqual([{ code: 'OWNS_SELLERS', count: 4 }]);
    expect(JSON.stringify(before)).not.toMatch(/PAY|DEBT|OWED|BALANCE/);
    const g = await grant(world, 'DELETE_ACCOUNT', null);
    expect((await failure(world.handle('privacy.deletion.request', { step_up_grant: g, typed_confirmation: 'delete' }, {}))).fields).toEqual({ typed_confirmation: 'DELETION_CONFIRMATION_MISMATCH' });
    const waiting = await world.handle('privacy.deletion.request', { step_up_grant: g, typed_confirmation: 'DELETE' }, {});
    expect(waiting.deletion).toMatchObject({ state: 'WAITING_BLOCKER', can_cancel: true });
    expect((await world.handle('account.context.get', {}, {})).memberships.length).toBe(4); // still there
    expect((await world.handle('privacy.deletion.cancel', {}, {})).deletion.state).toBe('CANCELLED');
  });

  it('an Account with nothing blocking waits for the approved grace policy, never deleted; a data copy is prepared, never emailed', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_free');
    const waiting = await world.handle('privacy.deletion.request', { step_up_grant: await grant(world, 'DELETE_ACCOUNT', null), typed_confirmation: 'DELETE' }, {});
    expect(waiting.deletion).toMatchObject({ state: 'WAITING_HOLD', hold_reason: 'POLICY_NOT_APPROVED', blockers: [] });
    expect((await world.handle('account.security.get', {}, {})).username).toBe('hana');
    const exported = await world.handle('privacy.export.request', { step_up_grant: await grant(world, 'EXPORT_DATA', null) }, {});
    expect(exported.export_state).toBe('PREPARING');
  });
});
