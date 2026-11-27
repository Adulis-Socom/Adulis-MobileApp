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
  /** The id of the session the current request was sent under (null when signed out). */
  readonly currentSession: () => string | null;
  readonly sellerName: (sellerId: string) => string | undefined;
  /** Whether the Seller can take a new team member now: it exists and is not suspended (a closure request is checked here). */
  readonly sellerOpenToMembers: (sellerId: string) => boolean;
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
  /** A sign-in: records a new live session for the persona and returns its id. */
  openSession(personaId: string): string;
  /** A sign-out: the session ends and is never valid again. */
  endSession(sessionId: string): void;
  /** False once the session was ended or revoked: a request under it is unauthenticated. */
  sessionLive(sessionId: string): boolean;
  /** True once the session was signed out of this Seller (team.session.revoke): no Seller authority under it (FE12-04). */
  sellerAccessRevoked(sessionId: string, sellerId: string): boolean;
  /** The persona a recorded session belongs to (test hook support). */
  sessionPersona(sessionId: string): string | null;
}

const STEP_UP_VALID_MS = 300_000; // PROVISIONAL demonstration value: AUTH-02 says only "short-lived"; no production duration is approved (P-4)
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
/** The exact recipient membership a transfer grant is for: id AND version, so a role change after the code invalidates it (FE12-03). */
interface Recipient { membershipId: string; version: number }
/** Both are bound to the ORIGINATING session and its audience as well as the Account (AUTH-02 S47, FE12-02): a later session of the same Account cannot adopt them. */
interface Challenge { personaId: string; sessionId: string; audience: AccountSession['audience']; purpose: StepUpPurpose; sellerId: string | null; recipient: Recipient | null; expiresAt: number }
interface Grant { personaId: string; sessionId: string; audience: AccountSession['audience']; purpose: StepUpPurpose; sellerId: string | null; recipient: Recipient | null; used: boolean; expiresAt: number }
interface Transfer { targetMembershipId: string; targetLabel: string; requestedAt: number }
/** One live sign-in. Account-level revocation ends it; Seller-level revocation removes its authority in one Seller only (FE12-04). */
interface SessionRec {
  id: string;
  personaId: string;
  audience: AccountSession['audience'];
  device: string;
  location: string | null;
  lastUsed: number;
  ended: boolean;
  sellerRevoked: Set<string>;
}
interface PrivacyRec { export: 'NONE' | 'PREPARING'; deletion: PrivacyView['deletion']['state']; requestedAt: number | null }

export function createPeople(deps: PeopleDeps): People {
  const { kit } = deps;
  const invites: Invite[] = [];
  const challenges = new Map<string, Challenge>();
  const grants = new Map<string, Grant>();
  const transfers = new Map<string, Transfer>();
  const closures = new Map<string, number>();
  const sessions = new Map<string, SessionRec>();
  const seededSessions = new Set<string>();
  const prefs = new Map<string, Map<string, boolean>>();
  const privacy = new Map<string, PrivacyRec>();

  const persona = (id: string) => deps.personas().find((p) => p.id === id);
  /** The live session this request was sent under, or undefined (never a second session authority: it reads the one session table). */
  const sessionHere = (): SessionRec | undefined => {
    const id = deps.currentSession();
    const rec = id === null ? undefined : sessions.get(id);
    return rec && !rec.ended ? rec : undefined;
  };
  const membershipsOf = (sellerId: string) =>
    deps.personas().flatMap((p) => p.memberships.filter((m) => m.sellerId === sellerId).map((m) => ({ p, m })));
  const teamSlotTaken = (p: Persona) => p.memberships.some((m) => m.relationship === 'TEAM');

  /**
   * Consume a grant: it must exist, be unused and unexpired, belong to this Account AND to the live session that earned it (same audience, and
   * still holding authority in the Seller), and match the purpose, the Seller and (for a transfer) the exact recipient membership. One use only
   * (AUTH S45-S48). An expired grant is dropped, never revived (FE12-02). Normal authorization runs BEFORE this, so a grant never restores a
   * revoked capability or revoked Seller authority.
   */
  function spend(grant: string, personaId: string, purpose: StepUpPurpose, sellerId: string | null, recipient: Recipient | null = null): void {
    const g = grants.get(grant);
    const expired = g !== undefined && kit.now() >= g.expiresAt;
    if (expired) grants.delete(grant);
    const bound = g?.recipient ?? null;
    const recipientOk = recipient === null ? bound === null : bound !== null && bound.membershipId === recipient.membershipId && bound.version === recipient.version;
    const here = deps.currentSession();
    const sess = here === null ? undefined : sessions.get(here);
    const sessionOk = !!g && !!sess && !sess.ended && g.sessionId === sess.id && g.audience === sess.audience && !(sellerId !== null && sess.sellerRevoked.has(sellerId));
    if (!g || expired || g.used || !sessionOk || g.personaId !== personaId || g.purpose !== purpose || g.sellerId !== sellerId || !recipientOk) {
      throw new TransportError('PERMISSION_DENIED', { detail: 'STEP_UP_REQUIRED' });
    }
    g.used = true;
  }
  /** An eligible ownership recipient: an ACTIVE team member of this Seller holding Admin (CONSOLE S117). */
  const eligibleRecipient = (m: PersonaMembership | undefined): m is PersonaMembership => !!m && m.relationship === 'TEAM' && m.standing === 'ACTIVE' && m.roles.includes('ADMIN');

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
    const here = deps.currentSession();
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
      // Seller-scoped session administration: the live Console sessions of active team members that still hold authority in this Seller.
      // The session this request came from is not listed: it ends with Sign out (FE12-04).
      sessions: a.caps.has('sessions.read')
        ? all
            .filter(({ m }) => m.relationship === 'TEAM' && m.standing === 'ACTIVE')
            .flatMap(({ p }) =>
              liveSessionsOf(p.id)
                .filter((x) => x.audience === 'CONSOLE' && x.id !== here && !x.sellerRevoked.has(a.sellerId))
                .map((x) => ({ session_id: x.id, member_label: p.display_name, device_label: x.device, last_used_at: kit.iso(x.lastUsed) })),
            )
        : null,
      // A pending transfer stays visible, and cancellable, even when its recipient is no longer eligible or no longer on the team (FE12-06).
      transfer: t
        ? {
            state: 'PENDING',
            target_label: target?.p.display_name ?? t.targetLabel,
            target_eligible: eligibleRecipient(target?.m),
            requested_at: kit.iso(t.requestedAt),
            activates_at: kit.iso(t.requestedAt + TRANSFER_DELAY_MS),
          }
        : null,
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

  // Every persona starts with two demonstration sessions on other devices; each sign-in adds a real one.
  function seedSessions(personaId: string): void {
    if (seededSessions.has(personaId)) return;
    seededSessions.add(personaId);
    const add = (n: number, audience: SessionRec['audience'], device: string, hoursAgo: number, location: string | null) => {
      const id = `fx_sess_${personaId}_${n}`;
      sessions.set(id, { id, personaId, audience, device, location, lastUsed: kit.now() - hoursAgo * HOUR_MS, ended: false, sellerRevoked: new Set() });
    };
    add(2, 'MOBILE', 'Adulis app on a phone (demonstration)', 20, 'Adama (approximate)');
    add(3, 'CONSOLE', 'Another browser (demonstration)', 70, null);
  }
  function liveSessionsOf(personaId: string): SessionRec[] {
    seedSessions(personaId);
    return [...sessions.values()].filter((x) => x.personaId === personaId && !x.ended);
  }
  function sessionsOf(p: Persona): AccountSession[] {
    const here = deps.currentSession();
    return liveSessionsOf(p.id)
      .map((x) => ({
        session_id: x.id,
        current: x.id === here,
        audience: x.audience,
        device_label: x.id === here ? 'This browser' : x.device,
        last_used_at: kit.iso(x.id === here ? kit.now() : x.lastUsed),
        approx_location: x.location,
      }))
      .sort((l, r) => Number(r.current) - Number(l.current));
  }
  function prefsView(p: Persona) {
    const mine = prefs.get(p.id) ?? new Map<string, boolean>();
    prefs.set(p.id, mine);
    const categories: PreferenceCategory[] = CATEGORIES.map((c) => ({ code: c.code, suppressible: c.suppressible, enabled: c.suppressible ? (mine.get(c.code) ?? true) : true }));
    return { provisional: true as const, categories };
  }
  const sellerTakesMembers = (sellerId: string): boolean => deps.sellerOpenToMembers(sellerId) && !closures.has(sellerId);
  function invitationsFor(p: Persona): MyInvitation[] {
    return invites
      .filter((i) => i.targetId === p.id)
      .map((i) => ({
        invitation_id: i.id,
        seller_label: deps.sellerName(i.sellerId) ?? '',
        roles: i.roles,
        blocked: !sellerTakesMembers(i.sellerId) ? ('SELLER_UNAVAILABLE' as const) : teamSlotTaken(p) ? ('SLOT_OCCUPIED' as const) : null,
      }));
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
      // Only a listed session: a live Console session of an active team member of THIS Seller, never the caller's own.
      const rec = sessions.get(session_id);
      if (!rec || !(teamView(a).sessions ?? []).some((x) => x.session_id === session_id)) throw notFound();
      // Authority in this Seller ends for every later request under that session; the rest of the Account is untouched (FE12-04).
      rec.sellerRevoked.add(a.sellerId);
      return teamView(a);
    },
    'ownership.transfer.start': ({ membership_id, step_up_grant }, ctx) => {
      const a = team(ctx, 'ownership.transfer');
      if (transfers.has(a.sellerId)) throw conflict();
      const { p, m } = findMember(a, membership_id, null);
      if (!eligibleRecipient(m)) throw invalid({ target: 'TRANSFER_TARGET_NOT_ELIGIBLE' });
      // The code was for THIS membership at THIS version: another recipient, or the same one after a role change, needs a new code (FE12-03).
      spend(step_up_grant, a.accountId, 'TRANSFER_OWNERSHIP', a.sellerId, { membershipId: m.id, version: m.version });
      transfers.set(a.sellerId, { targetMembershipId: m.id, targetLabel: p.display_name, requestedAt: kit.now() });
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
    'account.stepup.start': ({ purpose, seller_id, recipient_membership_id }) => {
      const p = deps.current();
      const sess = sessionHere();
      // Sensitive actions are Console workflows: only a live Console session may ask for the code (no cross-surface capability is invented).
      if (!sess || sess.audience !== 'CONSOLE') throw denied();
      // A Seller-bound purpose must name a Seller this Account owns; the label names exactly what the code will authorize.
      if (seller_id !== null && !p.memberships.some((m) => m.sellerId === seller_id && m.relationship === 'OWNER')) throw denied();
      // A transfer code is for one named, eligible recipient (FE12-03); no other purpose takes one.
      let recipient: { rec: Recipient; label: string } | null = null;
      if (purpose === 'TRANSFER_OWNERSHIP') {
        if (seller_id === null || recipient_membership_id === undefined) throw invalid({ target: 'TRANSFER_TARGET_REQUIRED' });
        const found = membershipsOf(seller_id).find((x) => x.m.id === recipient_membership_id);
        if (!found || !eligibleRecipient(found.m)) throw invalid({ target: 'TRANSFER_TARGET_NOT_ELIGIBLE' });
        recipient = { rec: { membershipId: found.m.id, version: found.m.version }, label: found.p.display_name };
      } else if (recipient_membership_id !== undefined) throw invalid({ target: 'TRANSFER_TARGET_NOT_ELIGIBLE' });
      const id = kit.next('fx_stepup');
      challenges.set(id, { personaId: p.id, sessionId: sess.id, audience: sess.audience, purpose, sellerId: seller_id, recipient: recipient?.rec ?? null, expiresAt: kit.now() + STEP_UP_VALID_MS });
      return {
        challenge_id: id,
        purpose,
        target_label: seller_id === null ? 'your account' : (deps.sellerName(seller_id) ?? ''),
        recipient_label: recipient?.label ?? null,
        expires_at: kit.iso(kit.now() + STEP_UP_VALID_MS),
      };
    },
    'account.stepup.verify': ({ challenge_id, code }) => {
      const p = deps.current();
      const c = challenges.get(challenge_id);
      const sess = sessionHere();
      // A challenge belongs to the session that started it: from any other session it is simply not there (the same generic answer, nothing revealed).
      if (!c || !sess || c.sessionId !== sess.id || c.audience !== sess.audience) throw new TransportError('OTP_EXPIRED');
      if (c.personaId !== p.id || kit.now() >= c.expiresAt || code === deps.codes.expired) {
        challenges.delete(challenge_id);
        throw new TransportError('OTP_EXPIRED');
      }
      if (code !== deps.codes.ok) throw new TransportError('OTP_INVALID');
      challenges.delete(challenge_id); // one challenge, one grant
      const grant = kit.next('fx_grant');
      // The grant is short-lived too (FE12-02): it must be spent within the same window, or a new code is needed.
      grants.set(grant, { personaId: p.id, sessionId: c.sessionId, audience: c.audience, purpose: c.purpose, sellerId: c.sellerId, recipient: c.recipient, used: false, expiresAt: kit.now() + STEP_UP_VALID_MS });
      return { grant };
    },
    'account.sessions.get': () => ({ sessions: sessionsOf(deps.current()) }),
    'account.sessions.revoke': ({ session_id }) => {
      const p = deps.current();
      const list = sessionsOf(p);
      const s = list.find((x) => x.session_id === session_id);
      if (!s) throw notFound();
      if (s.current) throw invalid({ session: 'USE_SIGN_OUT_FOR_THIS_SESSION' });
      const rec = sessions.get(s.session_id);
      if (rec) rec.ended = true; // every later request under it is unauthenticated
      return { sessions: sessionsOf(p) };
    },
    'account.sessions.revoke_others': ({ step_up_grant }) => {
      const p = deps.current();
      spend(step_up_grant, p.id, 'REVOKE_OTHER_SESSIONS', null);
      const here = deps.currentSession();
      for (const rec of liveSessionsOf(p.id)) if (rec.id !== here) rec.ended = true;
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
      // Everything is checked again at acceptance, against the state NOW, not as it was when the invitation was sent (FE12-05).
      // Recipient identity and invitation state: a pending invitation addressed to THIS Account (a withdrawn one no longer exists).
      const at = invites.findIndex((i) => i.id === invitation_id && i.targetId === p.id);
      const invite = invites[at];
      if (!invite) throw notFound();
      // Seller eligibility: it still exists, is not suspended, and has no closure request.
      if (!sellerTakesMembers(invite.sellerId)) throw invalid({ invitation: 'INVITATION_SELLER_UNAVAILABLE' });
      // Roles: still a non-empty set of assignable roles (never Owner).
      const roles = [...new Set(invite.roles)];
      if (roles.length === 0 || !roles.every(isAssignable)) throw invalid({ invitation: 'INVITATION_NO_LONGER_VALID' });
      // Membership availability: not already related to this Seller, and the one team slot (AUTH S59-S60) is free.
      if (p.memberships.some((m) => m.sellerId === invite.sellerId)) throw invalid({ invitation: 'INVITATION_NO_LONGER_VALID' });
      if (teamSlotTaken(p)) throw invalid({ invitation: 'TEAM_SLOT_OCCUPIED' });
      invites.splice(at, 1);
      p.memberships.push({ id: kit.next('fx_mem'), sellerId: invite.sellerId, relationship: 'TEAM', roles, standing: 'ACTIVE', version: 1 });
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
  return {
    handlers: withIdempotency(kit, handlers, { 'team.invite': { dest: 'settings', cap: 'team.invite' } }),
    openSession(personaId) {
      seedSessions(personaId);
      const id = kit.next('fx_sess');
      sessions.set(id, { id, personaId, audience: 'CONSOLE', device: 'A browser on a computer (demonstration)', location: 'Addis Ababa (approximate)', lastUsed: kit.now(), ended: false, sellerRevoked: new Set() });
      return id;
    },
    endSession(sessionId) {
      const rec = sessions.get(sessionId);
      if (rec) rec.ended = true;
    },
    sessionLive: (sessionId) => sessions.get(sessionId)?.ended === false,
    sellerAccessRevoked: (sessionId, sellerId) => sessions.get(sessionId)?.sellerRevoked.has(sellerId) ?? false,
    sessionPersona: (sessionId) => sessions.get(sessionId)?.personaId ?? null,
  };
}
