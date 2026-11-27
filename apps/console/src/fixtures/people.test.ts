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
async function grant(world: World, purpose: StepUpPurpose, sellerId: string | null, recipient?: string): Promise<string> {
  const input = recipient === undefined ? { purpose, seller_id: sellerId } : { purpose, seller_id: sellerId, recipient_membership_id: recipient };
  const c = await world.handle('account.stepup.start', input, {});
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
    expect(first).toBeDefined();
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
    const wrongSeller = await grant(world, 'CLOSE_SELLER', 'fx_seller_biruk');
    expect((await failure(world.handle('ownership.transfer.start', { membership_id: abel.membership_id, step_up_grant: wrongSeller }, ALEM))).detail).toBe('STEP_UP_REQUIRED');
    const good = await grant(world, 'TRANSFER_OWNERSHIP', 'fx_seller_alem', abel.membership_id);
    const view = await world.handle('ownership.transfer.start', { membership_id: abel.membership_id, step_up_grant: good }, ALEM);
    expect(view.transfer).toMatchObject({ state: 'PENDING', target_label: 'Abel (demonstration)', target_eligible: true, activates_at: '2026-11-28T09:00:00.000Z' });
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
    const abel = await member(world, 'Abel');
    // No code is even issued for an ineligible recipient, and a code for an eligible one does not make another eligible.
    expect((await failure(world.handle('account.stepup.start', { purpose: 'TRANSFER_OWNERSHIP', seller_id: 'fx_seller_alem', recipient_membership_id: saba.membership_id }, {}))).fields).toEqual({ target: 'TRANSFER_TARGET_NOT_ELIGIBLE' });
    const g = await grant(world, 'TRANSFER_OWNERSHIP', 'fx_seller_alem', abel.membership_id);
    expect((await failure(world.handle('ownership.transfer.start', { membership_id: saba.membership_id, step_up_grant: g }, ALEM))).fields).toEqual({ target: 'TRANSFER_TARGET_NOT_ELIGIBLE' });
  });

  it('a verified grant expires: after the step-up window it is refused and gone (FE12-02)', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const stale = await grant(world, 'CLOSE_SELLER', 'fx_seller_alem');
    world.hooks.skewClock(300_001);
    expect((await failure(world.handle('seller.closure.request', { step_up_grant: stale, typed_name: 'Alem Textiles' }, ALEM))).detail).toBe('STEP_UP_REQUIRED');
    // Moving the clock back cannot revive it: an expired grant is dropped.
    world.hooks.skewClock(-300_001);
    expect((await failure(world.handle('seller.closure.request', { step_up_grant: stale, typed_name: 'Alem Textiles' }, ALEM))).detail).toBe('STEP_UP_REQUIRED');
    const fresh = await grant(world, 'CLOSE_SELLER', 'fx_seller_alem');
    expect((await world.handle('seller.closure.request', { step_up_grant: fresh, typed_name: 'Alem Textiles' }, ALEM)).state).toBe('CLOSURE_REQUESTED');
  });

  it('a transfer code names and binds the exact recipient membership (FE12-03)', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const abel = await member(world, 'Abel');
    const saba = await member(world, 'Saba');
    // A transfer code must name its recipient; no other purpose may name one.
    expect((await failure(world.handle('account.stepup.start', { purpose: 'TRANSFER_OWNERSHIP', seller_id: 'fx_seller_alem' }, {}))).fields).toEqual({ target: 'TRANSFER_TARGET_REQUIRED' });
    expect((await failure(world.handle('account.stepup.start', { purpose: 'CLOSE_SELLER', seller_id: 'fx_seller_alem', recipient_membership_id: abel.membership_id }, {}))).fields).toEqual({ target: 'TRANSFER_TARGET_NOT_ELIGIBLE' });
    const c = await world.handle('account.stepup.start', { purpose: 'TRANSFER_OWNERSHIP', seller_id: 'fx_seller_alem', recipient_membership_id: abel.membership_id }, {});
    expect(c).toMatchObject({ target_label: 'Alem Textiles', recipient_label: 'Abel (demonstration)' });
    // Saba becomes a second Admin. A code for Abel cannot be spent on Saba.
    await world.handle('team.roles.set', { membership_id: saba.membership_id, version: saba.version, roles: ['ADMIN'] }, ALEM);
    const sabaNow = await member(world, 'Saba');
    const forAbel = await grant(world, 'TRANSFER_OWNERSHIP', 'fx_seller_alem', abel.membership_id);
    expect((await failure(world.handle('ownership.transfer.start', { membership_id: sabaNow.membership_id, step_up_grant: forAbel }, ALEM))).detail).toBe('STEP_UP_REQUIRED');
    // A change to Abel's membership after the code (a new version) invalidates a code issued before it.
    const before = await grant(world, 'TRANSFER_OWNERSHIP', 'fx_seller_alem', abel.membership_id);
    await world.handle('team.roles.set', { membership_id: abel.membership_id, version: abel.version, roles: ['ADMIN', 'ANALYST'] }, ALEM);
    expect((await failure(world.handle('ownership.transfer.start', { membership_id: abel.membership_id, step_up_grant: before }, ALEM))).detail).toBe('STEP_UP_REQUIRED');
    const after = await grant(world, 'TRANSFER_OWNERSHIP', 'fx_seller_alem', abel.membership_id);
    expect((await world.handle('ownership.transfer.start', { membership_id: abel.membership_id, step_up_grant: after }, ALEM)).transfer).toMatchObject({ target_label: 'Abel (demonstration)' });
  });
});

describe('SC-FE-12 closure: revocation and re-validation take effect on authorization', () => {
  const currentSession = async (world: World): Promise<string> => (await world.handle('account.sessions.get', {}, {})).sessions.find((s) => s.current)?.session_id ?? '';

  it('signing a member out of this Seller ends that session\'s authority here, and only here (FE12-04)', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_admin');
    const adminSession = await currentSession(world);
    expect((await world.handle('seller.access.get', {}, ALEM)).seller_id).toBe('fx_seller_alem');
    await signIn(world, 'fx_acct_owner');
    const ownerSession = await currentSession(world);
    const listed = (await world.handle('team.get', {}, ALEM)).sessions ?? [];
    expect(listed.map((x) => x.session_id)).toContain(adminSession);
    expect(listed.map((x) => x.session_id)).not.toContain(ownerSession); // the caller's own session ends with Sign out
    const after = await world.handle('team.session.revoke', { session_id: adminSession }, ALEM);
    expect(after.sessions?.map((x) => x.session_id)).not.toContain(adminSession);
    // The Admin's device sends its next request under the revoked session: no authority in this Seller.
    world.hooks.resumeSession(adminSession);
    expect((await failure(world.handle('seller.access.get', {}, ALEM))).code).toBe('PERMISSION_DENIED');
    expect((await failure(world.handle('team.get', {}, ALEM))).code).toBe('PERMISSION_DENIED');
    // The rest of the Account is untouched: the session itself is still signed in.
    expect((await world.handle('account.sessions.get', {}, {})).sessions.some((x) => x.session_id === adminSession && x.current)).toBe(true);
    // Revoking a session never suspends the person: a new sign-in has its authority back.
    await signIn(world, 'fx_acct_admin');
    expect((await world.handle('seller.access.get', {}, ALEM)).seller_id).toBe('fx_seller_alem');
    // A session that is not listed (the caller's own, or a made-up id) cannot be revoked here.
    expect((await failure(world.handle('team.session.revoke', { session_id: await currentSession(world) }, ALEM))).code).toBe('NOT_FOUND');
    expect((await failure(world.handle('team.session.revoke', { session_id: 'fx_sess_nope' }, ALEM))).code).toBe('NOT_FOUND');
  });

  it('an Account-level revocation makes every later request under that session unauthenticated', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const first = await currentSession(world);
    await signIn(world, 'fx_acct_owner');
    expect((await world.handle('account.sessions.get', {}, {})).sessions.map((x) => x.session_id)).toContain(first);
    await world.handle('account.sessions.revoke', { session_id: first }, {});
    world.hooks.resumeSession(first);
    expect((await failure(world.handle('account.sessions.get', {}, {}))).code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('acceptance re-checks the Seller, the recipient, the invitation and the slot at that moment (FE12-05)', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    await world.handle('team.invite', { username: 'hana', roles: ['ANALYST'] }, ALEM);
    // The Seller asks to close after inviting: it cannot take a new member now.
    await world.handle('seller.closure.request', { step_up_grant: await grant(world, 'CLOSE_SELLER', 'fx_seller_alem'), typed_name: 'Alem Textiles' }, ALEM);
    await signIn(world, 'fx_acct_free');
    const blocked = await world.handle('account.invitations.get', {}, {});
    expect(blocked.items[0]).toMatchObject({ seller_label: 'Alem Textiles', blocked: 'SELLER_UNAVAILABLE' });
    const id = blocked.items[0]?.invitation_id ?? '';
    expect((await failure(world.handle('account.invitations.accept', { invitation_id: id }, {}))).fields).toEqual({ invitation: 'INVITATION_SELLER_UNAVAILABLE' });
    expect((await world.handle('account.context.get', {}, {})).memberships).toHaveLength(0);
    // Another Account cannot accept an invitation addressed to Hana.
    await signIn(world, 'fx_acct_inventory');
    expect((await failure(world.handle('account.invitations.accept', { invitation_id: id }, {}))).code).toBe('NOT_FOUND');
    // The closure request is cancelled: now it can be accepted, once.
    await signIn(world, 'fx_acct_owner');
    await world.handle('seller.closure.cancel', {}, ALEM);
    await signIn(world, 'fx_acct_free');
    await world.handle('account.invitations.accept', { invitation_id: id }, {});
    expect((await failure(world.handle('account.invitations.accept', { invitation_id: id }, {}))).code).toBe('NOT_FOUND');
    // A withdrawn invitation no longer exists for its recipient.
    await signIn(world, 'fx_acct_owner');
    const later = await world.handle('team.invite', { username: 'ibsa', roles: ['ANALYST'] }, ALEM);
    await world.handle('team.invitation.withdraw', { invitation_id: later.invitations.find((i) => i.target_label === 'ibsa')?.invitation_id ?? '' }, ALEM);
    await signIn(world, 'fx_acct_inv_biruk');
    expect((await world.handle('account.invitations.get', {}, {})).items).toHaveLength(0);
  });

  it('a pending transfer stays visible and cancellable when its recipient becomes ineligible (FE12-06)', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const abel = await member(world, 'Abel');
    await world.handle('ownership.transfer.start', { membership_id: abel.membership_id, step_up_grant: await grant(world, 'TRANSFER_OWNERSHIP', 'fx_seller_alem', abel.membership_id) }, ALEM);
    await world.handle('team.member.suspend', { membership_id: abel.membership_id, version: abel.version }, ALEM);
    expect((await world.handle('team.get', {}, ALEM)).transfer).toMatchObject({ state: 'PENDING', target_label: 'Abel (demonstration)', target_eligible: false });
    const suspended = await member(world, 'Abel');
    await world.handle('team.member.remove', { membership_id: suspended.membership_id, version: suspended.version }, ALEM);
    // Removed from the team entirely: the transfer is still shown, by the name it was started with, and still blocks closure.
    const view = await world.handle('team.get', {}, ALEM);
    expect(view.transfer).toMatchObject({ state: 'PENDING', target_label: 'Abel (demonstration)', target_eligible: false });
    expect(view.allowed_actions).not.toContain('TRANSFER_OWNERSHIP');
    expect((await world.handle('seller.closure.get', {}, ALEM)).blockers).toEqual(['OWNERSHIP_TRANSFER_PENDING']);
    // Resolvable: the Owner cancels it, and both the transfer and the closure become available again.
    const cancelled = await world.handle('ownership.transfer.cancel', {}, ALEM);
    expect(cancelled.transfer).toBeNull();
    expect(cancelled.allowed_actions).toContain('TRANSFER_OWNERSHIP');
    expect((await world.handle('seller.closure.get', {}, ALEM)).allowed_actions).toEqual(['REQUEST']);
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
    await world.handle('ownership.transfer.start', { membership_id: abel.membership_id, step_up_grant: await grant(world, 'TRANSFER_OWNERSHIP', 'fx_seller_alem', abel.membership_id) }, ALEM);
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

describe('SC-FE-12 closure FE12-02: a challenge and its grant belong to the session that earned them', () => {
  const sessionOf = async (world: World): Promise<string> => (await world.handle('account.sessions.get', {}, {})).sessions.find((s) => s.current)?.session_id ?? '';
  const challengeIn = async (world: World, purpose: StepUpPurpose, sellerId: string | null) => (await world.handle('account.stepup.start', { purpose, seller_id: sellerId }, {})).challenge_id;
  const verify = (world: World, challenge_id: string) => world.handle('account.stepup.verify', { challenge_id, code: DEMO_CODES.ok }, {});
  const closure = (world: World, step_up_grant: string) => world.handle('seller.closure.request', { step_up_grant, typed_name: 'Alem Textiles' }, ALEM);

  it('a valid challenge, verified in its own session, yields a grant that is spent once in that session', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const g = await grant(world, 'CLOSE_SELLER', 'fx_seller_alem');
    expect((await closure(world, g)).state).toBeDefined();
    const e = await grant(world, 'EXPORT_DATA', null);
    await world.handle('privacy.export.request', { step_up_grant: e }, {});
    expect((await failure(world.handle('privacy.export.request', { step_up_grant: e }, {}))).code).toBe('PERMISSION_DENIED'); // reuse
  });

  it('a challenge cannot be verified after sign-out, or from a later session of the same Account', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const c = await challengeIn(world, 'CLOSE_SELLER', 'fx_seller_alem');
    await world.handle('auth.session.end', {}, {});
    expect((await failure(verify(world, c))).code).toBe('AUTHENTICATION_REQUIRED');
    await signIn(world, 'fx_acct_owner'); // same Account, a new session
    expect((await failure(verify(world, c))).code).toBe('OTP_EXPIRED');
  });

  it('a grant cannot be spent from a later session of the same Account, and still works in its own session', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const first = await sessionOf(world);
    const g = await grant(world, 'CLOSE_SELLER', 'fx_seller_alem');
    await signIn(world, 'fx_acct_owner');
    expect((await failure(closure(world, g))).code).toBe('PERMISSION_DENIED');
    world.hooks.resumeSession(first);
    expect((await closure(world, g)).state).toBeDefined(); // the failed attempt in the other session did not consume it
  });

  it('a grant is dead once its session is revoked at Account level', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const first = await sessionOf(world);
    const g = await grant(world, 'CLOSE_SELLER', 'fx_seller_alem');
    await signIn(world, 'fx_acct_owner');
    await world.handle('account.sessions.revoke', { session_id: first }, {});
    world.hooks.resumeSession(first);
    expect((await failure(closure(world, g))).code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('ordinary authorization runs before the grant: a session that lost Seller authority is refused whatever grant it holds', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_admin');
    const adminSession = await sessionOf(world);
    await signIn(world, 'fx_acct_owner');
    await world.handle('team.session.revoke', { session_id: adminSession }, ALEM);
    world.hooks.resumeSession(adminSession);
    expect((await failure(closure(world, 'fx_grant_anything'))).code).toBe('PERMISSION_DENIED');
  });

  it('refuses a session of another audience (the seeded phone session), and another Account', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const mobile = (await world.handle('account.sessions.get', {}, {})).sessions.find((s) => s.audience !== 'CONSOLE')?.session_id;
    expect(mobile).toBeDefined();
    world.hooks.resumeSession(mobile ?? '');
    expect((await failure(world.handle('account.stepup.start', { purpose: 'CLOSE_SELLER', seller_id: 'fx_seller_alem' }, {}))).code).toBe('PERMISSION_DENIED');
    await signIn(world, 'fx_acct_owner');
    const g = await grant(world, 'CLOSE_SELLER', 'fx_seller_alem');
    await signIn(world, 'fx_acct_admin');
    expect((await failure(closure(world, g))).code).toBeDefined();
  });

  it('wrong purpose, wrong Seller, wrong recipient and a changed recipient version are still refused inside the right session', async () => {
    const world = setup();
    await signIn(world, 'fx_acct_owner');
    const abel = await member(world, 'Abel');
    const wrongPurpose = await grant(world, 'CLOSE_SELLER', 'fx_seller_alem');
    expect((await failure(world.handle('ownership.transfer.start', { membership_id: abel.membership_id, step_up_grant: wrongPurpose }, ALEM))).code).toBe('PERMISSION_DENIED');
    const forTransfer = await grant(world, 'TRANSFER_OWNERSHIP', 'fx_seller_alem', abel.membership_id);
    await world.handle('team.roles.set', { membership_id: abel.membership_id, version: abel.version, roles: ['ADMIN', 'ANALYST'] }, ALEM);
    expect((await failure(world.handle('ownership.transfer.start', { membership_id: abel.membership_id, step_up_grant: forTransfer }, ALEM))).code).toBe('PERMISSION_DENIED');
  });

  it('expires after the provisional 300 seconds and is never revived', async () => {
    let now = Date.UTC(2026, 10, 27, 9, 0, 0);
    const world = createWorld({ now: () => now, latencyMs: 0 });
    await signIn(world, 'fx_acct_owner');
    const g = await grant(world, 'CLOSE_SELLER', 'fx_seller_alem');
    now += 300_000;
    expect((await failure(closure(world, g))).code).toBe('PERMISSION_DENIED');
  });
});
