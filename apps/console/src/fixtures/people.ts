import type { SellerRole } from '../contracts/gap-sc';
import type { AccountSession, MyInvitation, PreferenceCategory, PrivacyView, StepUpPurpose } from '../contracts/gap-sc-account';
import type { AssignableRole, ClosureView, MemberAction, TeamAction, TeamMember, TeamView } from '../contracts/gap-sc-team';
import { ASSIGNABLE_ROLES } from '../contracts/gap-sc-team';
import { TransportError, type CallContext } from '../transport/port';
import { conflict, denied, HOUR_MS, invalid, needCap, notFound, withIdempotency, type Authz, type Handlers, type Kit } from './kit';

/**
 * Fixture people: Seller teams, ownership transfer, Seller closure, and the signed-in Account's sessions, step-up, preferences, invitations and
 * privacy requests (GAP-SC-20, GAP-SC-21, SC-FE-11). DEVELOPMENT ONLY. Everything is an in-memory demonstration; NOTHING here deletes, closes,
 * unpublishes or transfers anything for real: requests are recorded and wait, as the designs leave their processing policy open.
 *
 * Rules the stand-in enforces (AUTH-02): Owner is derived and never assignable; an ACTIVE membership keeps at least one role; one ACTIVE or
 * SUSPENDED team slot per Account; invitations bind an existing Account by username; sensitive commands need a one-use step-up grant bound to
 * the Account, the purpose and the target; Admin cannot transfer ownership or close the Seller. RB25-D11: no payment, debt or collection
 * condition exists anywhere here.
 */
export interface PersonaMembership {
  id: string;
  sellerId: string;
  relationship: 'OWNER' | 'TEAM';
  roles: SellerRole[];
  standing: 'ACTIVE' | 'SUSPENDED';
  version: number;
}
export interface Persona {
  id: string;
  phone: string;
  display_name: string;
  username: string;
  memberships: PersonaMembership[];
}

export interface PeopleDeps {
  readonly kit: Kit;
  readonly personas: () => Persona[];
  /** The signed-in persona; throws AUTHENTICATION_REQUIRED without a session. */
  readonly current: () => Persona;
  readonly sellerName: (sellerId: string) => string | undefined;
  readonly codes: { readonly ok: string; readonly invalid: string; readonly expired: string };
}

type PeopleOps =
  | 'team.get' | 'team.invite' | 'team.invitation.withdraw' | 'team.roles.set' | 'team.member.suspend' | 'team.member.reinstate' | 'team.member.remove'
  | 'team.session.revoke' | 'ownership.transfer.start' | 'ownership.transfer.cancel' | 'seller.closure.get' | 'seller.closure.request' | 'seller.closure.cancel'
  | 'account.stepup.start' | 'account.stepup.verify' | 'account.sessions.get' | 'account.sessions.revoke' | 'account.sessions.revoke_others'
  | 'account.security.get' | 'account.preferences.get' | 'account.preferences.set' | 'account.invitations.get' | 'account.invitations.accept'
  | 'privacy.get' | 'privacy.export.request' | 'privacy.deletion.request' | 'privacy.deletion.cancel';
export interface People {
  readonly handlers: Handlers<PeopleOps>;
}

const STEP_UP_VALID_MS = 300_000; // demonstration value: AUTH-02 says only "short-lived"
const TRANSFER_DELAY_MS = 24 * HOUR_MS; // CONSOLE-02 S117
const CATEGORIES: readonly { code: string; suppressible: boolean }[] = [
  { code: 'SECURITY', suppressible: false },
  { code: 'TEAM_CHANGES', suppressible: true },
  { code: 'INBOX_MESSAGES', suppressible: true },
  { code: 'CATALOGUE_ALERTS', suppressible: true },
  { code: 'POLICY_NOTICES', suppressible: true },
];
const isAssignable = (r: string): r is AssignableRole => (ASSIGNABLE_ROLES as readonly string[]).includes(r);

interface Invite { id: string; sellerId: string; targetId: string; roles: AssignableRole[]; createdAt: number }
interface Challenge { personaId: string; purpose: StepUpPurpose; sellerId: string | null; expiresAt: number }
interface Grant { personaId: string; purpose: StepUpPurpose; sellerId: string | null; used: boolean }
interface Transfer { targetMembershipId: string; requestedAt: number }
interface PrivacyRec { export: 'NONE' | 'PREPARING'; deletion: PrivacyView['deletion']['state']; requestedAt: number | null }

export function createPeople(deps: PeopleDeps): People {
  const { kit } = deps;
  const invites: Invite[] = [];
  const challenges = new Map<string, Challenge>();
  const grants = new Map<string, Grant>();
  const transfers = new Map<string, Transfer>();
  const closures = new Map<string, number>();
  const revokedTeamSessions = new Set<string>();
  const accountSessions = new Map<string, AccountSession[]>();
  const prefs = new Map<string, Map<string, boolean>>();
  const privacy = new Map<string, PrivacyRec>();

  const persona = (id: string) => deps.personas().find((p) => p.id === id);
  const membershipsOf = (sellerId: string) =>
    deps.personas().flatMap((p) => p.memberships.filter((m) => m.sellerId === sellerId).map((m) => ({ p, m })));
  const teamSlotTaken = (p: Persona) => p.memberships.some((m) => m.relationship === 'TEAM');

  /** Consume a grant: it must exist, be unused, belong to this Account, and match the purpose and the target. One use only (AUTH S45-S48). */
  function spend(grant: string, personaId: string, purpose: StepUpPurpose, sellerId: string | null): void {
    const g = grants.get(grant);
    if (!g || g.used || g.personaId !== personaId || g.purpose !== purpose || g.sellerId !== sellerId) throw new TransportError('PERMISSION_DENIED', { detail: 'STEP_UP_REQUIRED' });
    g.used = true;
  }

  function memberView(a: Authz, p: Persona, m: PersonaMembership): TeamMember {
    const owner = m.relationship === 'OWNER';
    const actions: MemberAction[] = [];
    if (!owner && p.id !== a.accountId) {
      if (a.caps.has('team.roles_manage') && m.standing === 'ACTIVE') actions.push('CHANGE_ROLES');
      if (a.caps.has('team.remove')) actions.push(m.standing === 'ACTIVE' ? 'SUSPEND' : 'REINSTATE', 'REMOVE');
    }
    return {
      membership_id: m.id,
      display_name: p.display_name,
      relationship: m.relationship,
      roles: owner ? [] : m.roles.filter(isAssignable),
      standing: m.standing,
      version: m.version,
      is_you: p.id === a.accountId,
      allowed_actions: actions,
    };
  }
  function teamView(a: Authz): TeamView {
    const all = membershipsOf(a.sellerId);
    const t = transfers.get(a.sellerId);
    const target = t ? all.find((x) => x.m.id === t.targetMembershipId) : undefined;
    const actions: TeamAction[] = [
      ...(a.caps.has('team.invite') ? (['INVITE'] as const) : []),
      ...(a.caps.has('ownership.transfer') && !t ? (['TRANSFER_OWNERSHIP'] as const) : []),
      ...(a.caps.has('sessions.revoke') ? (['REVOKE_SESSIONS'] as const) : []),
    ];
    return {
      seller_id: a.sellerId,
      members: all.map(({ p, m }) => memberView(a, p, m)),
      invitations: invites
        .filter((i) => i.sellerId === a.sellerId)
        .map((i) => {
          const invitee = persona(i.targetId);
          return { invitation_id: i.id, target_label: invitee?.username ?? '', roles: i.roles, state: 'PENDING' as const, created_at: kit.iso(i.createdAt), eligibility: invitee && teamSlotTaken(invitee) ? ('IN_ANOTHER_TEAM' as const) : ('ELIGIBLE' as const) };
        }),
      // Seller-scoped session administration: each active team member's Console session in this Seller (demonstration devices).
      sessions: a.caps.has('sessions.read')
        ? all
            .filter(({ m }) => m.relationship === 'TEAM' && m.standing === 'ACTIVE' && !revokedTeamSessions.has(`${a.sellerId}|${m.id}`))
            .map(({ p, m }) => ({ session_id: `fx_tsess_${m.id}`, member_label: p.display_name, device_label: 'Browser on a computer (demonstration)', last_used_at: kit.iso(kit.now() - 2 * HOUR_MS) }))
        : null,
      transfer: t && target ? { state: 'PENDING', target_label: target.p.display_name, requested_at: kit.iso(t.requestedAt), activates_at: kit.iso(t.requestedAt + TRANSFER_DELAY_MS) } : null,
      allowed_actions: actions,
    };
  }
  function findMember(a: Authz, membershipId: string, version: number | null): { p: Persona; m: PersonaMembership } {
    const found = membershipsOf(a.sellerId).find((x) => x.m.id === membershipId);
    if (!found) throw notFound();
    if (found.m.relationship === 'OWNER' || found.p.id === a.accountId) throw denied();
    if (version !== null && found.m.version !== version) throw conflict();
    return found;
  }
  function closureView(a: Authz): ClosureView {
    const requested = closures.get(a.sellerId) ?? null;
    const blockers = transfers.has(a.sellerId) ? ['OWNERSHIP_TRANSFER_PENDING'] : [];
    const owner = a.caps.has('seller.close');
    return {
      seller_id: a.sellerId,
      seller_name: a.sellerName,
      state: requested === null ? 'OPEN' : 'CLOSURE_REQUESTED',
      requested_at: requested === null ? null : kit.iso(requested),
      consequences: ['UNPUBLISH_EVERYTHING', 'LEAVE_DISCOVERY', 'END_TEAM_ACCESS', 'KEEP_REQUIRED_HISTORY', 'KEEP_YOUR_ACCOUNT'],
      blockers,
      allowed_actions: !owner ? [] : requested === null ? (blockers.length === 0 ? ['REQUEST'] : []) : ['CANCEL'],
    };
  }

  function sessionsOf(p: Persona): AccountSession[] {
    let list = accountSessions.get(p.id);
    if (!list) {
      const ago = (h: number) => kit.iso(kit.now() - h * HOUR_MS);
      list = [
        { session_id: `fx_sess_${p.id}_1`, current: true, audience: 'CONSOLE', device_label: 'This browser', last_used_at: ago(0), approx_location: 'Addis Ababa (approximate)' },
        { session_id: `fx_sess_${p.id}_2`, current: false, audience: 'MOBILE', device_label: 'Adulis app on a phone (demonstration)', last_used_at: ago(20), approx_location: 'Adama (approximate)' },
        { session_id: `fx_sess_${p.id}_3`, current: false, audience: 'CONSOLE', device_label: 'Another browser (demonstration)', last_used_at: ago(70), approx_location: null },
      ];
      accountSessions.set(p.id, list);
    }
    return list;
  }
  function prefsView(p: Persona) {
    const mine = prefs.get(p.id) ?? new Map<string, boolean>();
    prefs.set(p.id, mine);
    const categories: PreferenceCategory[] = CATEGORIES.map((c) => ({ code: c.code, suppressible: c.suppressible, enabled: c.suppressible ? (mine.get(c.code) ?? true) : true }));
    return { provisional: true as const, categories };
  }
  function invitationsFor(p: Persona): MyInvitation[] {
    return invites
      .filter((i) => i.targetId === p.id)
      .map((i) => ({ invitation_id: i.id, seller_label: deps.sellerName(i.sellerId) ?? '', roles: i.roles, blocked: teamSlotTaken(p) ? ('SLOT_OCCUPIED' as const) : null }));
  }
  function privacyOf(p: Persona): PrivacyView {
    const rec: PrivacyRec = privacy.get(p.id) ?? { export: 'NONE', deletion: 'NONE', requestedAt: null };
    privacy.set(p.id, rec);
    const owned = p.memberships.filter((m) => m.relationship === 'OWNER').length;
    const team = p.memberships.some((m) => m.relationship === 'TEAM');
    const blockers = owned > 0 ? [{ code: 'OWNS_SELLERS', count: owned }] : [];
    return {
      export_state: rec.export,
      deletion: {
        state: rec.deletion,
        requested_at: rec.requestedAt === null ? null : kit.iso(rec.requestedAt),
        hold_reason: rec.deletion === 'WAITING_HOLD' ? 'POLICY_NOT_APPROVED' : null,
        consequences: ['SIGNED_OUT_EVERYWHERE', 'PERSONAL_DATA_REMOVED', ...(team ? ['TEAM_MEMBERSHIP_ENDS'] : [])],
        retained: ['SECURITY_AND_AUDIT_RECORDS', 'MESSAGES_SENT_FOR_A_SELLER', 'HISTORICAL_ACCOUNTING'],
        blockers,
        can_cancel: rec.deletion === 'WAITING_BLOCKER' || rec.deletion === 'WAITING_HOLD',
      },
    };
  }

  const team = (ctx: CallContext, cap = 'team.read'): Authz => {
    const a = kit.authz(ctx);
    needCap(a, cap);
    return a;
  };

  const handlers: People['handlers'] = {
    'team.get': (_i, ctx) => teamView(team(ctx)),
    'team.invite': ({ username, roles }, ctx) => {
      const a = team(ctx, 'team.invite');
      const errors: Record<string, string> = {};
      const wanted = [...new Set(roles)];
      if (wanted.length === 0 || !wanted.every(isAssignable)) errors['roles'] = 'ROLE_SET_EMPTY';
      const target = deps.personas().find((p) => p.username === username.trim().replace(/^@/, '').toLowerCase());
      if (username.trim() === '') errors['username'] = 'USERNAME_REQUIRED';
      else if (!target) errors['username'] = 'TEAM_INVITE_TARGET_NOT_FOUND';
      else if (target.memberships.some((m) => m.sellerId === a.sellerId) || invites.some((i) => i.sellerId === a.sellerId && i.targetId === target.id)) errors['username'] = 'TEAM_INVITE_ALREADY_RELATED';
      if (Object.keys(errors).length > 0 || !target) throw invalid(errors);
      invites.push({ id: kit.next('fx_inv'), sellerId: a.sellerId, targetId: target.id, roles: wanted, createdAt: kit.now() });
      return teamView(a);
    },
    'team.invitation.withdraw': ({ invitation_id }, ctx) => {
      const a = team(ctx, 'team.invite');
      const at = invites.findIndex((i) => i.id === invitation_id && i.sellerId === a.sellerId);
      if (at < 0) throw notFound();
      invites.splice(at, 1);
      return teamView(a);
    },
    'team.roles.set': ({ membership_id, version, roles }, ctx) => {
      const a = team(ctx, 'team.roles_manage');
      const { m } = findMember(a, membership_id, version);
      const wanted = [...new Set(roles)];
      // An ACTIVE membership never has zero roles: remove or suspend the person instead (AUTH S69, S113).
      if (wanted.length === 0 || !wanted.every(isAssignable)) throw invalid({ roles: 'ROLE_SET_EMPTY' });
      if (m.standing !== 'ACTIVE') throw conflict();
      m.roles = wanted;
      m.version += 1;
      return teamView(a);
    },
    'team.member.suspend': ({ membership_id, version }, ctx) => {
      const a = team(ctx, 'team.remove');
      const { m } = findMember(a, membership_id, version);
      if (m.standing !== 'ACTIVE') throw conflict();
      m.standing = 'SUSPENDED'; // no authority, the one team slot stays occupied (AUTH S72)
      m.version += 1;
      return teamView(a);
    },
    'team.member.reinstate': ({ membership_id, version }, ctx) => {
      const a = team(ctx, 'team.remove');
      const { m } = findMember(a, membership_id, version);
      if (m.standing !== 'SUSPENDED') throw conflict();
      m.standing = 'ACTIVE';
      m.version += 1;
      return teamView(a);
    },
    'team.member.remove': ({ membership_id, version }, ctx) => {
      const a = team(ctx, 'team.remove');
      const { p, m } = findMember(a, membership_id, version);
      // Terminal: authority ends on the next request and the slot is released; history keeps the person's attribution (PRV S33).
      p.memberships = p.memberships.filter((x) => x !== m);
      return teamView(a);
    },
    'team.session.revoke': ({ session_id }, ctx) => {
      const a = team(ctx, 'sessions.revoke');
      const found = membershipsOf(a.sellerId).find(({ m }) => `fx_tsess_${m.id}` === session_id);
      if (!found) throw notFound();
      revokedTeamSessions.add(`${a.sellerId}|${found.m.id}`);
      return teamView(a);
    },
    'ownership.transfer.start': ({ membership_id, step_up_grant }, ctx) => {
      const a = team(ctx, 'ownership.transfer');
      if (transfers.has(a.sellerId)) throw conflict();
      const { m } = findMember(a, membership_id, null);
      if (m.standing !== 'ACTIVE' || !m.roles.includes('ADMIN')) throw invalid({ target: 'TRANSFER_TARGET_NOT_ELIGIBLE' });
      spend(step_up_grant, a.accountId, 'TRANSFER_OWNERSHIP', a.sellerId);
      transfers.set(a.sellerId, { targetMembershipId: m.id, requestedAt: kit.now() });
      return teamView(a);
    },
    'ownership.transfer.cancel': (_i, ctx) => {
      const a = team(ctx, 'ownership.transfer');
      if (!transfers.delete(a.sellerId)) throw conflict();
      return teamView(a);
    },
    'seller.closure.get': (_i, ctx) => {
      const a = kit.authz(ctx);
      if (!a.reach('settings')) throw denied();
      return closureView(a);
    },
    'seller.closure.request': ({ step_up_grant, typed_name }, ctx) => {
      const a = team(ctx, 'seller.close');
      const view = closureView(a);
      if (!view.allowed_actions.includes('REQUEST')) throw conflict();
      if (typed_name.trim() !== a.sellerName) throw invalid({ typed_name: 'CLOSURE_NAME_MISMATCH' });
      spend(step_up_grant, a.accountId, 'CLOSE_SELLER', a.sellerId);
      closures.set(a.sellerId, kit.now());
      return closureView(a);
    },
    'seller.closure.cancel': (_i, ctx) => {
      const a = team(ctx, 'seller.close');
      if (!closures.delete(a.sellerId)) throw conflict();
      return closureView(a);
    },

    // ---- the signed-in Account ----------------------------------------------------------------------------------------
    'account.stepup.start': ({ purpose, seller_id }) => {
      const p = deps.current();
      // A Seller-bound purpose must name a Seller this Account owns; the label names exactly what the code will authorize.
      if (seller_id !== null && !p.memberships.some((m) => m.sellerId === seller_id && m.relationship === 'OWNER')) throw denied();
      const id = kit.next('fx_stepup');
      challenges.set(id, { personaId: p.id, purpose, sellerId: seller_id, expiresAt: kit.now() + STEP_UP_VALID_MS });
      return { challenge_id: id, purpose, target_label: seller_id === null ? 'your account' : (deps.sellerName(seller_id) ?? ''), expires_at: kit.iso(kit.now() + STEP_UP_VALID_MS) };
    },
    'account.stepup.verify': ({ challenge_id, code }) => {
      const p = deps.current();
      const c = challenges.get(challenge_id);
      if (!c || c.personaId !== p.id || kit.now() >= c.expiresAt || code === deps.codes.expired) {
        challenges.delete(challenge_id);
        throw new TransportError('OTP_EXPIRED');
      }
      if (code !== deps.codes.ok) throw new TransportError('OTP_INVALID');
      challenges.delete(challenge_id); // one challenge, one grant
      const grant = kit.next('fx_grant');
      grants.set(grant, { personaId: p.id, purpose: c.purpose, sellerId: c.sellerId, used: false });
      return { grant };
    },
    'account.sessions.get': () => ({ sessions: sessionsOf(deps.current()) }),
    'account.sessions.revoke': ({ session_id }) => {
      const p = deps.current();
      const list = sessionsOf(p);
      const s = list.find((x) => x.session_id === session_id);
      if (!s) throw notFound();
      if (s.current) throw invalid({ session: 'USE_SIGN_OUT_FOR_THIS_SESSION' });
      accountSessions.set(p.id, list.filter((x) => x !== s));
      return { sessions: sessionsOf(p) };
    },
    'account.sessions.revoke_others': ({ step_up_grant }) => {
      const p = deps.current();
      spend(step_up_grant, p.id, 'REVOKE_OTHER_SESSIONS', null);
      accountSessions.set(p.id, sessionsOf(p).filter((x) => x.current));
      return { sessions: sessionsOf(p) };
    },
    'account.security.get': () => {
      const p = deps.current();
      return { phone_masked: `${p.phone.slice(0, 4)} *** *** ${p.phone.slice(-2)}`, username: p.username };
    },
    'account.preferences.get': () => prefsView(deps.current()),
    'account.preferences.set': ({ code, enabled }) => {
      const p = deps.current();
      const c = CATEGORIES.find((x) => x.code === code);
      if (!c) throw invalid({ code: 'PREFERENCE_UNKNOWN' });
      if (!c.suppressible && !enabled) throw invalid({ [code]: 'NOTICE_NOT_SUPPRESSIBLE' });
      prefsView(p);
      prefs.get(p.id)?.set(code, enabled);
      return prefsView(p);
    },
    'account.invitations.get': () => ({ items: invitationsFor(deps.current()) }),
    'account.invitations.accept': ({ invitation_id }) => {
      const p = deps.current();
      const at = invites.findIndex((i) => i.id === invitation_id && i.targetId === p.id);
      const invite = invites[at];
      if (!invite) throw notFound();
      // The one team slot (AUTH S59-S60): a second invitation may wait, but cannot be accepted while the slot is held.
      if (teamSlotTaken(p)) throw invalid({ invitation: 'TEAM_SLOT_OCCUPIED' });
      invites.splice(at, 1);
      p.memberships.push({ id: kit.next('fx_mem'), sellerId: invite.sellerId, relationship: 'TEAM', roles: invite.roles, standing: 'ACTIVE', version: 1 });
      return { items: invitationsFor(p) };
    },
    'privacy.get': () => privacyOf(deps.current()),
    'privacy.export.request': ({ step_up_grant }) => {
      const p = deps.current();
      spend(step_up_grant, p.id, 'EXPORT_DATA', null);
      privacyOf(p);
      const rec = privacy.get(p.id);
      if (rec) rec.export = 'PREPARING';
      return privacyOf(p);
    },
    'privacy.deletion.request': ({ step_up_grant, typed_confirmation }) => {
      const p = deps.current();
      const before = privacyOf(p);
      if (before.deletion.can_cancel) throw conflict();
      if (typed_confirmation.trim() !== 'DELETE') throw invalid({ typed_confirmation: 'DELETION_CONFIRMATION_MISMATCH' });
      spend(step_up_grant, p.id, 'DELETE_ACCOUNT', null);
      const rec = privacy.get(p.id);
      if (rec) {
        // Owned Sellers block it (AUTH S140: ownership is never silently erased); otherwise it waits for the approved grace policy (PRV S71).
        rec.deletion = before.deletion.blockers.length > 0 ? 'WAITING_BLOCKER' : 'WAITING_HOLD';
        rec.requestedAt = kit.now();
      }
      return privacyOf(p);
    },
    'privacy.deletion.cancel': () => {
      const p = deps.current();
      const rec = privacy.get(p.id);
      if (!rec || !privacyOf(p).deletion.can_cancel) throw conflict();
      rec.deletion = 'CANCELLED';
      return privacyOf(p);
    },
  };
  return { handlers: withIdempotency(kit, handlers, { 'team.invite': { dest: 'settings', cap: 'team.invite' } }) };
}
