import type {
  AccountContext,
  BriefAlert,
  BriefArea,
  BriefObligation,
  DestinationAccess,
  DestinationKey,
  Eligibility,
  HomeBrief,
  Membership,
  NotificationItem,
  OpId,
  OpInput,
  OpOutput,
  OtpChallenge,
  Readiness,
  ReadinessItem,
  RoleView,
  SellerAccess,
  SellerRole,
  SellerSummary,
  SocialAccountState,
} from '../contracts/gap-sc';
import { TransportError, type CallContext } from '../transport/port';
import { createAutomation } from './automation';
import { createCatalogue } from './catalogue';
import { createContent } from './content';
import { createInbox } from './inbox';
import { createInsights } from './insights';
import { createPeople, type Persona, type PersonaMembership } from './people';
import { createStore } from './store';
import { createTrust } from './trust';
import type { Authz, Kit } from './kit';

/**
 * The fixture world: synthetic Sellers, accounts and a server-like resolver (GOV-06). DEVELOPMENT ONLY: this module
 * is reachable solely through the build-time-guarded dynamic import in transport/select.ts.
 *
 * It stands in for a backend that does not exist (GAP-SC-01..07). It demonstrates intended FRONTEND behaviour; it is
 * not backend enforcement and proves nothing about authorization. Every identifier is synthetic and carries the
 * reserved `fx_` prefix; no credential here is real. Writes exist only for the operations a named work order
 * (SC-FE-02) added with their own test: auth.*, seller.create, seller.social.start, seller.eligibility.recheck.
 */
export const FIXTURE_VERSION = 'fixture-sc-1';
/** Release-scan markers (RN-1): none of these may appear in a release build. */
export const FIXTURE_MARKER = 'ADULIS_FIXTURE_MODULE_MARKER_7f3a';
export const BLOCKED_CODE = 'FIXTURE_BLOCKED';
export const BANNER_SENTENCE = 'Demonstration data. Nothing here is real.';

/** The demonstration one-time codes. They exist only here and are shown to the person using the demonstration. */
export const DEMO_CODES = { ok: '246810', invalid: '111111', expired: '222222', rateLimited: '333333' } as const;
const RESEND_AFTER_MS = 2000; // demonstration value only: the real duration is an open decision
const OTP_VALID_MS = 300_000; // the AUTH-02 S16 default, used for demonstration
const RATE_LIMIT_RETRY_MS = 30_000; // demonstration value only
const DEFAULT_LATENCY_MS = 150;

const PROHIBITED = /payment|payout|handoff|moderation|report|evidence|claim|trust|order|reservation/i;

interface SellerRecord {
  summary: SellerSummary;
  eligibility: Omit<Eligibility, 'seller_id' | 'policy_version'>;
  store: boolean;
  fulfilment: boolean;
  product: boolean;
  companyDetails: boolean;
  readinessFails: boolean;
  entitlementOff: DestinationKey[];
  alerts: Record<RoleView, BriefAlert[]>;
  obligations: BriefObligation[];
  notifications: NotificationItem[];
}


export const PERSONAS: readonly { id: string; phone: string; label: string }[] = [
  { id: 'fx_acct_owner', phone: '+251900000001', label: 'Owner of four stores (Alem, Biruk, Chaltu, Kidist)' },
  { id: 'fx_acct_states', phone: '+251900000002', label: 'Owner of stores in other states (Dawit to Iman)' },
  { id: 'fx_acct_admin', phone: '+251900000011', label: 'Admin at Alem Textiles' },
  { id: 'fx_acct_sales', phone: '+251900000012', label: 'Sales Support at Alem Textiles' },
  { id: 'fx_acct_inventory', phone: '+251900000013', label: 'Inventory at Alem Textiles' },
  { id: 'fx_acct_analyst', phone: '+251900000014', label: 'Analyst at Alem Textiles' },
  { id: 'fx_acct_campaign', phone: '+251900000015', label: 'Campaign Manager at Alem Textiles' },
  { id: 'fx_acct_multirole', phone: '+251900000016', label: 'Inventory and Sales Support at Alem Textiles' },
  { id: 'fx_acct_inv_biruk', phone: '+251900000017', label: 'Inventory at Biruk Shoes (draft store)' },
  { id: 'fx_acct_mixed', phone: '+251900000018', label: 'Owner of Lemlem Linen and Inventory at Alem Textiles' },
  { id: 'fx_acct_free', phone: '+251900000019', label: 'Account with no Seller yet, username hana (to receive an invitation)' },
  { id: 'fx_acct_new', phone: '+251900000003', label: 'New account (no stores yet; any other number behaves the same)' },
];

const NONE: Record<RoleView, BriefAlert[]> = { OWNER_ADMIN: [], SALES_SUPPORT: [], INVENTORY: [], ANALYST: [], CAMPAIGN_MANAGER: [] };
const T0 = Date.UTC(2026, 10, 25, 9, 0, 0);
const at = (minutesAgo: number): string => new Date(T0 - minutesAgo * 60_000).toISOString();

function seller(
  id: string,
  display_name: string,
  status: SellerSummary['status'],
  publication: SellerSummary['publication'],
  overrides: Partial<SellerRecord> & { type?: SellerSummary['seller_type'] } = {},
): SellerRecord {
  const { type, ...rest } = overrides;
  return {
    summary: { id, display_name, seller_type: type ?? 'INDIVIDUAL', status, publication },
    eligibility: { outcome: 'NOT_SATISFIED', workflow_state: 'NEEDS_SELLER_ACTION', reason_codes: ['SOCIAL_ACCOUNT_REQUIRED'], social_accounts: [] },
    store: false,
    fulfilment: false,
    product: false,
    companyDetails: false,
    readinessFails: false,
    entitlementOff: [],
    alerts: NONE,
    obligations: [],
    notifications: [
      { id: `${id}_n1`, kind: 'ADMISSION_UPDATE', created_at: at(90), read: false },
      { id: `${id}_n2`, kind: 'READINESS_CHANGED', created_at: at(600), read: true },
    ],
    ...rest,
  };
}

const verifiedTikTok = (handle: string): SocialAccountState[] => [{ platform: 'TIKTOK', handle, control: 'VERIFIED' }];
const SATISFIED = { outcome: 'SATISFIED', workflow_state: null, reason_codes: [] } as const;

function initialSellers(): Record<string, SellerRecord> {
  const all = [
    seller('fx_seller_alem', 'Alem Textiles', 'ACTIVE', 'PUBLISHED', {
      eligibility: { ...SATISFIED, social_accounts: verifiedTikTok('@alem.textiles') },
      store: true, fulfilment: true, product: true, companyDetails: true,
      alerts: { ...NONE, OWNER_ADMIN: [{ code: 'POLICY_RECHECK_PENDING', severity: 'INFO', occurred_at: at(300) }] },
      obligations: [{ code: 'ACCEPT_UPDATED_POLICY', due_at: new Date(T0 + 14 * 86_400_000).toISOString() }],
      notifications: [
        { id: 'fx_seller_alem_n1', kind: 'ADMISSION_UPDATE', created_at: at(45), read: false },
        { id: 'fx_seller_alem_n2', kind: 'POLICY_NOTICE', created_at: at(300), read: false },
        { id: 'fx_seller_alem_n3', kind: 'SECURITY_NEW_SESSION', created_at: at(2000), read: true },
      ],
    }),
    seller('fx_seller_biruk', 'Biruk Shoes', 'DRAFT', 'NEVER_PUBLISHED', { entitlementOff: ['insights'] }),
    seller('fx_seller_kidist', 'Kidist Cosmetics', 'DRAFT', 'NEVER_PUBLISHED'),
    seller('fx_seller_chaltu', 'Chaltu Crafts', 'DRAFT', 'NEVER_PUBLISHED', {
      eligibility: { ...SATISFIED, social_accounts: verifiedTikTok('@chaltu.crafts') },
      store: true,
    }),
    seller('fx_seller_dawit', 'Dawit Leather', 'DRAFT', 'NEVER_PUBLISHED', {
      eligibility: { ...SATISFIED, social_accounts: verifiedTikTok('@dawit.leather') },
      store: true, fulfilment: true, product: true, companyDetails: true,
    }),
    seller('fx_seller_eden', 'Eden Foods PLC', 'DRAFT', 'NEVER_PUBLISHED', {
      type: 'COMPANY',
      eligibility: { outcome: 'PENDING', workflow_state: 'WAITING_FOR_DM_REVIEW', reason_codes: [], social_accounts: [{ platform: 'INSTAGRAM', handle: '@eden.foods', control: 'PENDING' }] },
    }),
    seller('fx_seller_fana', 'Fana Fashion', 'DRAFT', 'NEVER_PUBLISHED', {
      eligibility: { outcome: 'NOT_SATISFIED', workflow_state: null, reason_codes: ['SOCIAL_BUSINESS_PRESENCE_NOT_ESTABLISHED'], social_accounts: verifiedTikTok('@fana.fashion') },
    }),
    seller('fx_seller_gelila', 'Gelila Spices', 'SUSPENDED', 'UNPUBLISHED', {
      eligibility: { ...SATISFIED, social_accounts: verifiedTikTok('@gelila.spices') },
      store: true, fulfilment: true, product: true, companyDetails: true,
      alerts: { ...NONE, OWNER_ADMIN: [{ code: 'SELLER_RESTRICTED', severity: 'WARN', occurred_at: at(120) }] },
    }),
    seller('fx_seller_lemlem', 'Lemlem Linen', 'DRAFT', 'NEVER_PUBLISHED'),
    seller('fx_seller_hana', 'Hana Home Goods', 'DRAFT', 'NEVER_PUBLISHED', { readinessFails: true }),
    seller('fx_seller_iman', 'Iman Jewellery', 'ACTIVE', 'UNPUBLISHED', {
      eligibility: { ...SATISFIED, social_accounts: verifiedTikTok('@iman.jewellery') },
      store: true, fulfilment: true, product: true, companyDetails: true,
      alerts: { ...NONE, OWNER_ADMIN: [{ code: 'STOREFRONT_UNPUBLISHED', severity: 'INFO', occurred_at: at(500) }] },
    }),
  ];
  return Object.fromEntries(all.map((s) => [s.summary.id, s] as const));
}

function initialPersonas(): Persona[] {
  let n = 0;
  const mem = (sellerId: string, relationship: 'OWNER' | 'TEAM', roles: SellerRole[]): PersonaMembership => ({ id: `fx_mem_${(n += 1)}`, sellerId, relationship, roles, standing: 'ACTIVE', version: 1 });
  const own = (sellerId: string) => mem(sellerId, 'OWNER', ['OWNER']);
  const team = (sellerId: string, roles: SellerRole[]) => mem(sellerId, 'TEAM', roles);
  // Usernames are how a team invitation names an EXISTING Account (AUTH S64); they are demonstration handles.
  const base = (id: string, display_name: string, memberships: Persona['memberships']): Persona => ({
    id, display_name, username: display_name.split(' ')[0]?.toLowerCase() ?? id, phone: PERSONAS.find((p) => p.id === id)?.phone ?? '', memberships,
  });
  return [
    base('fx_acct_owner', 'Amina (demonstration)', [own('fx_seller_alem'), own('fx_seller_biruk'), own('fx_seller_chaltu'), own('fx_seller_kidist')]),
    base('fx_acct_states', 'Selam (demonstration)', ['dawit', 'eden', 'fana', 'gelila', 'hana', 'iman'].map((n) => own(`fx_seller_${n}`))),
    base('fx_acct_admin', 'Abel (demonstration)', [team('fx_seller_alem', ['ADMIN'])]),
    base('fx_acct_sales', 'Saba (demonstration)', [team('fx_seller_alem', ['SALES_SUPPORT'])]),
    base('fx_acct_inventory', 'Ino (demonstration)', [team('fx_seller_alem', ['INVENTORY'])]),
    base('fx_acct_analyst', 'Anan (demonstration)', [team('fx_seller_alem', ['ANALYST'])]),
    base('fx_acct_campaign', 'Cala (demonstration)', [team('fx_seller_alem', ['CAMPAIGN_MANAGER'])]),
    base('fx_acct_multirole', 'Mulu (demonstration)', [team('fx_seller_alem', ['INVENTORY', 'SALES_SUPPORT'])]),
    base('fx_acct_mixed', 'Mimi (demonstration)', [own('fx_seller_lemlem'), team('fx_seller_alem', ['INVENTORY'])]),
    base('fx_acct_inv_biruk', 'Ibsa (demonstration)', [team('fx_seller_biruk', ['INVENTORY'])]),
    base('fx_acct_free', 'Hana (demonstration)', []),
  ];
}

// ---- the server-like resolvers (the fixture plays the backend; the Console renders what these return) -------------
const ALL_DEST: DestinationKey[] = ['home', 'products', 'content', 'inbox', 'insights', 'store', 'trust', 'settings'];
const ROLE_DEST: Record<SellerRole, DestinationKey[]> = {
  OWNER: ALL_DEST,
  ADMIN: ALL_DEST,
  SALES_SUPPORT: ['home', 'inbox', 'trust'],
  INVENTORY: ['home', 'products', 'trust'],
  ANALYST: ['home', 'insights'],
  CAMPAIGN_MANAGER: ['home', 'content', 'products', 'insights'],
};
const MANAGER_ROLES: SellerRole[] = ['OWNER', 'ADMIN'];
/** Capabilities a manager holds beyond the admission ones, and what the other roles hold (CATINV S110, CONSOLE-02 S17). */
/** Scripted assistance, AUTH-02 Appendix C: seller.chatbot:read, :configure, :test, :analytics_read. No feedback-submission code exists, so none is granted. */
const CHATBOT_ALL = ['chatbot.read', 'chatbot.configure', 'chatbot.test', 'chatbot.analytics_read'];
/** AUTH-02 Appendix B analytics family: Owner, Admin and Analyst hold all seven; the Campaign Manager holds five (no business or inventory read). */
const ANALYTICS_ALL = ['business_read', 'product_read', 'content_read', 'fyp_read', 'inventory_read', 'chatbot_read', 'quality_read'].map((c) => `analytics.${c}`);
const ANALYTICS_CAMPAIGN = ['chatbot_read', 'content_read', 'fyp_read', 'product_read', 'quality_read'].map((c) => `analytics.${c}`);
/** AUTH-02 team and security families: Owner and Admin only. */
const TEAM_CAPS = ['team.read', 'team.invite', 'team.roles_manage', 'team.remove', 'sessions.read', 'sessions.revoke'];
const WRITE_CAPS = ['catalogue.write', 'inventory.write', 'content.write', 'store.manage', 'couriers.manage', 'inbox.read', 'inbox.reply', 'trust.read', 'reviews.read', ...CHATBOT_ALL, ...ANALYTICS_ALL, ...TEAM_CAPS];
const ROLE_CAPS: Record<SellerRole, string[]> = {
  OWNER: WRITE_CAPS,
  ADMIN: WRITE_CAPS,
  SALES_SUPPORT: ['inbox.read', 'inbox.reply', 'trust.read', 'reviews.read', 'chatbot.read'],
  INVENTORY: ['catalogue.write', 'inventory.write', 'trust.read'],
  ANALYST: ANALYTICS_ALL,
  CAMPAIGN_MANAGER: ['content.write', ...CHATBOT_ALL, ...ANALYTICS_CAMPAIGN],
};
/** Brief areas whose work order is built (SC-FE-04 Products and Inventory, SC-FE-05 Scenes, SC-FE-05S Stories, SC-FE-08 Inbox, SC-FE-10 Insights and Settings: plan). The rest stay DEFERRED. */
const BUILT_AREAS = new Set(['PRODUCTS', 'INVENTORY', 'SCENES', 'STORIES', 'INBOX', 'INSIGHTS', 'SETTINGS']);
const VIEW_PRIORITY: [SellerRole, RoleView][] = [
  ['OWNER', 'OWNER_ADMIN'], ['ADMIN', 'OWNER_ADMIN'], ['SALES_SUPPORT', 'SALES_SUPPORT'],
  ['INVENTORY', 'INVENTORY'], ['CAMPAIGN_MANAGER', 'CAMPAIGN_MANAGER'], ['ANALYST', 'ANALYST'],
];
const AREAS_BY_VIEW: Record<RoleView, string[]> = {
  OWNER_ADMIN: ['PRODUCTS', 'SCENES', 'STORIES', 'INBOX', 'INSIGHTS', 'NOTIFICATIONS', 'SETTINGS'],
  SALES_SUPPORT: ['INBOX', 'NOTIFICATIONS'],
  INVENTORY: ['PRODUCTS', 'INVENTORY', 'NOTIFICATIONS'],
  ANALYST: ['INSIGHTS', 'NOTIFICATIONS'],
  CAMPAIGN_MANAGER: ['SCENES', 'STORIES', 'INSIGHTS', 'NOTIFICATIONS'],
};
const AREA_DEST: Record<string, DestinationKey | null> = {
  PRODUCTS: 'products', INVENTORY: 'products', SCENES: 'content', STORIES: 'content', INBOX: 'inbox', INSIGHTS: 'insights', SETTINGS: 'settings', NOTIFICATIONS: null,
};

export interface WorldOptions {
  readonly now: () => number;
  /** Per-Seller extra latency in ms, so tests can make one Seller's response arrive late. */
  readonly delays?: Readonly<Record<string, number>>;
  /** Base latency per call (default 150ms). Tests pass 0. */
  readonly latencyMs?: number;
}

interface Challenge { phone: string; startedAt: number; expiresAt: number; resendAt: number; expired: boolean }

export interface World {
  handle<K extends OpId>(op: K, input: OpInput<K>, ctx: CallContext): Promise<OpOutput<K>>;
  readonly hooks: {
    revokeDestination(sellerId: string, key: DestinationKey): void;
    revokeCapability(sellerId: string, capability: string): void;
    /** Take a destination out of the Seller's plan: the account keeps its permission, the destination becomes NO_ENTITLEMENT. */
    withdrawEntitlement(sellerId: string, key: DestinationKey): void;
    revokeSession(): void;
    /** Make the next `times` calls of `op` fail with `code` (an outcome the Console must not guess its way past). */
    failNext(op: string, code: TransportError['code'], times?: number): void;
    /** Make the next `times` calls of `op` take `ms` longer to answer: a deterministic pending request for race tests. */
    delayNext(op: string, ms: number, times?: number): void;
    /** Remove the signed-in account's relationship with a Seller, as if it left the team mid-session. */
    revokeMembership(sellerId: string): void;
    /** Every call received, with the idempotency key it carried (null for none): tests read retry identity from it. */
    callLog(): readonly { op: string; sellerId: string | null; key: string | null }[];
    /** Put a Product under restriction, as an Operator decision would. Development only. */
    restrictProduct(sellerId: string, productId: string): boolean;
    /** Move the fixture server's clock forward by `ms`. Development only: the real server owns time. */
    skewClock(ms: number): void;
    /** A Buyer message arrives in a conversation now, unseen by the Console (read high-water tests). */
    buyerMessage(sellerId: string, conversationId: string, body: string): boolean;
  };
}

export function createWorld(options: WorldOptions): World {
  const sellers = initialSellers();
  const personas = initialPersonas();
  const challenges = new Map<string, Challenge>();
  const created = new Map<string, SellerSummary>();
  const revokedDest = new Map<string, Set<DestinationKey>>();
  const revokedCaps = new Map<string, Set<string>>();
  const log: { op: string; sellerId: string | null; key: string | null }[] = [];
  const failures = new Map<string, { code: TransportError['code']; times: number }>();
  const slowOps = new Map<string, { ms: number; times: number }>();
  let session: string | null = null;
  let pendingNew: string | null = null;
  let sessionRevoked = false;
  // Each sign-in issues a new session (a new cookie in a real server). A request sent under an earlier one is answered as unauthenticated.
  let sessionToken = 0;
  let counter = 0;
  const iso = (ms: number): string => new Date(ms).toISOString();
  // Fixture-only clock skew (hook below): lets a test move past a Story's 24-hour lifetime without waiting.
  let skew = 0;
  const nowMs = (): number => options.now() + skew;

  function persona(): Persona {
    if (session === null || sessionRevoked) {
      session = null;
      throw new TransportError('AUTHENTICATION_REQUIRED');
    }
    const found = personas.find((p) => p.id === session);
    if (!found) throw new TransportError('AUTHENTICATION_REQUIRED');
    return found;
  }

  function membership(p: Persona, sellerId: string): { m: Persona['memberships'][number]; s: SellerRecord } {
    // A SUSPENDED membership grants no Seller authority at all (AUTH S72): it is the same answer as no membership.
    const m = p.memberships.find((x) => x.sellerId === sellerId && x.standing === 'ACTIVE');
    const s = sellers[sellerId];
    // Same answer whether the Seller does not exist or is not yours: existence is never disclosed.
    if (!m || !s) throw new TransportError('PERMISSION_DENIED');
    return { m, s };
  }

  function accessFor(m: Persona['memberships'][number], s: SellerRecord): SellerAccess {
    const id = s.summary.id;
    const roles = m.roles;
    let dests = new Set<DestinationKey>(roles.flatMap((r) => ROLE_DEST[r]));
    let caps = new Set<string>(['notifications.view']);
    for (const r of roles) for (const c of ROLE_CAPS[r]) caps.add(c);
    if (roles.some((r) => MANAGER_ROLES.includes(r))) caps.add('readiness.resolve').add('admission.manage');
    // AUTH-02 R-12: ownership transfer and Seller closure are Owner-only, never reachable by a role union.
    if (m.relationship === 'OWNER') caps.add('ownership.transfer').add('seller.close');
    if (s.summary.status === 'SUSPENDED') {
      // Seller Safety Suspension blocks forward-looking commerce and content (MOD S29): no publication, no discovery, no Inbox, no writes.
      // It preserves "required historical access" (P-70): read-only Trust and eligible historical Reviews, for the roles that already hold
      // seller.trust:read and seller.reviews:read (AUTH-02). Nothing else is restored.
      const kept: DestinationKey[] = ['home', 'trust', 'settings'];
      dests = new Set<DestinationKey>(kept.filter((d) => dests.has(d)));
      caps = new Set(['notifications.view', ...['trust.read', 'reviews.read'].filter((c) => caps.has(c))]);
    }
    for (const d of revokedDest.get(id) ?? []) dests.delete(d);
    for (const c of revokedCaps.get(id) ?? []) caps.delete(c);
    const destinations: DestinationAccess[] = ALL_DEST.filter((d) => dests.has(d)).map((key) => ({
      key,
      access: s.entitlementOff.includes(key) ? 'NO_ENTITLEMENT' : 'GRANTED',
    }));
    return {
      seller_id: id,
      seller_status: s.summary.status,
      capabilities: [...caps],
      destinations,
      restriction: s.summary.status === 'SUSPENDED' ? { reason_code: 'UNDER_REVIEW' } : null,
    };
  }

  const eligibilityOf = (s: SellerRecord): Eligibility => ({ seller_id: s.summary.id, policy_version: 'fx_policy_1', ...s.eligibility });

  function readinessOf(s: SellerRecord, caps: readonly string[]): Readiness {
    const e = s.eligibility;
    const canResolve = caps.includes('readiness.resolve');
    // Resolved from the data the Console can change, never from a stored flag: publishing the first Product satisfies it.
    const product = catalogue.hasPublishedProduct(s.summary.id);
    const profile = store.profileComplete(s.summary.id);
    const fulfilment = store.fulfilmentConfigured(s.summary.id);
    const companyOk = store.companyComplete(s.summary.id);
    const act = (kind: string): ReadinessItem['resolving_action'] => ({ kind, denied: canResolve ? null : 'NO_PERMISSION' });
    const items: ReadinessItem[] = [
      { code: 'ACCOUNT_CREATED', satisfied: true, workflow_state: null, reason_codes: [], resolving_action: null },
      { code: 'SELLER_TYPE_DECLARED', satisfied: true, workflow_state: null, reason_codes: [], resolving_action: null },
      {
        code: 'ELIGIBILITY_SATISFIED',
        satisfied: e.outcome === 'SATISFIED',
        workflow_state: e.workflow_state,
        reason_codes: e.reason_codes,
        resolving_action: e.outcome === 'NOT_SATISFIED' && e.workflow_state === 'NEEDS_SELLER_ACTION' ? act('CONNECT_SOCIAL_ACCOUNT') : null,
      },
    ];
    if (s.summary.seller_type === 'COMPANY') {
      items.push({
        code: 'COMPANY_DETAILS',
        satisfied: companyOk,
        workflow_state: null,
        reason_codes: companyOk ? [] : ['COMPANY_DETAILS_INCOMPLETE'],
        resolving_action: companyOk ? null : act('EDIT_COMPANY_DETAILS'),
      });
    }
    items.push(
      { code: 'STORE_PROFILE', satisfied: profile, workflow_state: null, reason_codes: profile ? [] : ['STORE_PROFILE_INCOMPLETE'], resolving_action: profile ? null : act('EDIT_STORE_PROFILE') },
      { code: 'FULFILMENT_CONFIG', satisfied: fulfilment, workflow_state: null, reason_codes: fulfilment ? [] : ['FULFILMENT_REQUIRED'], resolving_action: fulfilment ? null : act('CONFIGURE_FULFILMENT') },
      { code: 'AT_LEAST_ONE_PRODUCT', satisfied: product, workflow_state: null, reason_codes: product ? [] : ['PRODUCT_REQUIRED'], resolving_action: product ? null : act('ADD_PRODUCT') },
    );
    return { seller_id: s.summary.id, ready: items.every((i) => i.satisfied), policy_version: 'fx_policy_1', items };
  }

  function viewFor(roles: readonly SellerRole[]): RoleView {
    for (const [role, view] of VIEW_PRIORITY) if (roles.includes(role)) return view;
    return 'OWNER_ADMIN';
  }

  function briefOf(m: Persona['memberships'][number], s: SellerRecord, access: SellerAccess): HomeBrief {
    const view = viewFor(m.roles);
    const keys = new Set<string>();
    for (const r of m.roles) for (const k of AREAS_BY_VIEW[viewFor([r])]) keys.add(k);
    const areas: BriefArea[] = [...keys]
      .filter((k) => {
        const d = AREA_DEST[k];
        return d === null || d === undefined || access.destinations.some((x) => x.key === d);
      })
      .map((key) => {
        const d = AREA_DEST[key];
        const entitled = d === null || d === undefined || access.destinations.find((x) => x.key === d)?.access === 'GRANTED';
        return { key, state: !entitled ? 'NO_ENTITLEMENT' : key === 'NOTIFICATIONS' || BUILT_AREAS.has(key) ? 'AVAILABLE' : 'DEFERRED' };
      });
    const isManager = view === 'OWNER_ADMIN';
    return {
      seller_id: s.summary.id,
      mode: s.summary.status === 'ACTIVE' || s.summary.status === 'SUSPENDED' ? 'OPERATING_BRIEF' : 'READINESS_HUB',
      role_view: view,
      areas,
      alerts: s.alerts[view],
      obligations: isManager ? s.obligations : [],
    };
  }

  async function delay(sellerId: string | null): Promise<void> {
    const ms = (options.latencyMs ?? DEFAULT_LATENCY_MS) + (sellerId ? (options.delays?.[sellerId] ?? 0) : 0);
    // Deliberately NOT abort-aware: a response that arrives after the caller has moved on is exactly the late
    // response the Console's scoped data hook must discard (RN-4).
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  function newChallenge(phone: string): OtpChallenge {
    const id = `fx_otp_${++counter}`;
    const t = nowMs();
    challenges.set(id, { phone, startedAt: t, expiresAt: t + OTP_VALID_MS, resendAt: t + RESEND_AFTER_MS, expired: false });
    return { challenge_id: id, server_time: iso(t), expires_at: iso(t + OTP_VALID_MS), resend_available_at: iso(t + RESEND_AFTER_MS) };
  }
  function challengeOf(id: string): Challenge {
    const c = challenges.get(id);
    if (!c) throw new TransportError('OTP_EXPIRED');
    return c;
  }
  const digits = (v: string): string => v.replace(/[^\d+]/g, '');

  const kit: Kit = {
    now: nowMs,
    iso,
    next: (prefix) => `${prefix}_${++counter}`,
    flags: (id) => {
      const r = sellers[id];
      return { name: r?.summary.display_name ?? '', product: r?.product ?? false, store: r?.store ?? false, fulfilment: r?.fulfilment ?? false, company: r?.summary.seller_type === 'COMPANY', companyDetails: r?.companyDetails ?? false };
    },
    authz: (ctx): Authz => {
      const who = persona();
      const { m, s } = membership(who, sellerIdOf(ctx));
      const access = accessFor(m, s);
      return {
        accountId: who.id,
        isOwner: m.relationship === 'OWNER',
        sellerId: s.summary.id,
        sellerName: s.summary.display_name,
        caps: new Set(access.capabilities),
        reach: (dest) => access.destinations.some((d) => d.key === dest && d.access === 'GRANTED'),
      };
    },
  };
  const catalogue = createCatalogue(kit);
  const content = createContent(kit, catalogue);
  const store = createStore(kit);
  const inbox = createInbox(kit, catalogue, content);
  const trust = createTrust(kit, catalogue);
  const automation = createAutomation(kit, catalogue);
  const insights = createInsights(kit, (id) => sellers[id]?.entitlementOff ?? []);
  const people = createPeople({ kit, personas: () => personas, current: persona, sellerName: (id) => sellers[id]?.summary.display_name, codes: DEMO_CODES });

  type H = { [K in OpId]: (input: OpInput<K>, ctx: CallContext) => OpOutput<K> };
  const handlers: H = {
    ...catalogue.handlers,
    ...content.handlers,
    ...store.handlers,
    ...inbox.handlers,
    ...trust.handlers,
    ...automation.handlers,
    ...insights.handlers,
    ...people.handlers,
    'auth.otp.start': ({ phone }) => {
      if (!/^\+?\d{9,15}$/.test(digits(phone))) throw new TransportError('VALIDATION_FAILED', { fields: { phone: 'PHONE_INVALID' } });
      return newChallenge(digits(phone));
    },
    'auth.otp.status': ({ challenge_id }) => {
      const c = challengeOf(challenge_id);
      const t = nowMs();
      const expired = c.expired || t >= c.expiresAt;
      return {
        state: expired ? 'EXPIRED' : 'PENDING',
        server_time: iso(t), expires_at: iso(c.expiresAt), resend_available_at: iso(c.resendAt),
        resend_allowed: t >= c.resendAt,
      };
    },
    'auth.otp.resend': ({ challenge_id }) => {
      const c = challengeOf(challenge_id);
      if (nowMs() < c.resendAt) throw new TransportError('RATE_LIMITED', { retryAt: iso(c.resendAt) });
      challenges.delete(challenge_id);
      return newChallenge(c.phone);
    },
    'auth.otp.verify': ({ challenge_id, code }) => {
      const c = challengeOf(challenge_id);
      if (code === DEMO_CODES.rateLimited) throw new TransportError('RATE_LIMITED', { retryAt: iso(nowMs() + RATE_LIMIT_RETRY_MS) });
      if (c.expired || nowMs() >= c.expiresAt || code === DEMO_CODES.expired) {
        c.expired = true;
        throw new TransportError('OTP_EXPIRED');
      }
      if (code !== DEMO_CODES.ok) throw new TransportError('OTP_INVALID');
      const known = personas.find((p) => p.phone === c.phone);
      challenges.delete(challenge_id);
      sessionRevoked = false;
      if (known) {
        session = known.id;
        sessionToken += 1;
        return { result: 'SIGNED_IN' };
      }
      pendingNew = c.phone;
      return { result: 'DECLARATIONS_REQUIRED', policy_version: 'fx_age_policy_1' };
    },
    'auth.declarations.accept': ({ adult_declaration, policy_accepted }) => {
      // Missing or false is denied uniformly (AUTH-02 S24): the response never says which one was missing.
      if (pendingNew === null || !adult_declaration || !policy_accepted) throw new TransportError('VALIDATION_FAILED', { fields: { declarations: 'DECLARATIONS_REQUIRED' } });
      const p: Persona = { id: `fx_acct_new_${++counter}`, phone: pendingNew, display_name: 'New account (demonstration)', username: `new${counter}`, memberships: [] };
      personas.push(p);
      pendingNew = null;
      session = p.id;
      sessionToken += 1;
      return { result: 'SIGNED_IN' };
    },
    // Enumeration resistance (AUTH-02 S22): the same answer for every number.
    'auth.recovery.start': () => ({ result: 'RECORDED' }),
    'auth.session.end': () => {
      session = null;
      return { result: 'ENDED' };
    },
    'account.context.get': (): AccountContext => {
      const p = persona();
      const memberships: Membership[] = p.memberships.filter((m) => m.standing === 'ACTIVE').flatMap((m) => {
        const s = sellers[m.sellerId];
        return s ? [{ seller: s.summary, relationship: m.relationship, roles: m.roles }] : [];
      });
      return { account: { id: p.id, display_name: p.display_name }, memberships };
    },
    'seller.access.get': (_i, ctx) => {
      const { m, s } = membership(persona(), sellerIdOf(ctx));
      return accessFor(m, s);
    },
    'seller.create': (input, ctx) => {
      const p = persona();
      const key = ctx.idempotencyKey;
      if (key) {
        const prior = created.get(key);
        if (prior) return prior;
      }
      const taken = Object.values(sellers).some((s) => s.summary.display_name.toLowerCase().startsWith(input.handle.toLowerCase()));
      const fields: Record<string, string> = {};
      if (input.display_name.trim() === '') fields['display_name'] = 'REQUIRED';
      if (!/^[a-z0-9._]{3,30}$/.test(input.handle)) fields['handle'] = 'HANDLE_INVALID';
      else if (taken) fields['handle'] = 'HANDLE_TAKEN';
      if (Object.keys(fields).length > 0) throw new TransportError('VALIDATION_FAILED', { fields });
      const id = `fx_seller_new_${++counter}`;
      const record = seller(id, input.display_name.trim(), 'DRAFT', 'NEVER_PUBLISHED', { type: input.seller_type });
      sellers[id] = record;
      p.memberships.push({ id: `fx_mem_new_${id}`, sellerId: id, relationship: 'OWNER', roles: ['OWNER'], standing: 'ACTIVE', version: 1 });
      if (key) created.set(key, record.summary);
      return record.summary;
    },
    'seller.eligibility.get': (_i, ctx) => eligibilityOf(membership(persona(), sellerIdOf(ctx)).s),
    'seller.eligibility.recheck': (_i, ctx) => {
      const { m, s } = membership(persona(), sellerIdOf(ctx));
      if (!accessFor(m, s).capabilities.includes('admission.manage')) throw new TransportError('PERMISSION_DENIED');
      return eligibilityOf(s);
    },
    'seller.social.start': ({ platform, handle }, ctx) => {
      const { m, s } = membership(persona(), sellerIdOf(ctx));
      if (!accessFor(m, s).capabilities.includes('admission.manage')) throw new TransportError('PERMISSION_DENIED');
      if (!/^@?[A-Za-z0-9._]{2,30}$/.test(handle)) throw new TransportError('VALIDATION_FAILED', { fields: { handle: 'HANDLE_INVALID' } });
      const clean = handle.startsWith('@') ? handle : `@${handle}`;
      s.eligibility = {
        outcome: 'PENDING',
        workflow_state: 'WAITING_FOR_DM_REVIEW',
        reason_codes: [],
        social_accounts: [{ platform, handle: clean, control: 'PENDING' }],
      };
      return { seller_id: s.summary.id, platform, official_account_handle: platform === 'TIKTOK' ? '@adulis.official' : '@adulis.official.shop', code_sent_to: 'your verified phone', expires_at: iso(nowMs() + OTP_VALID_MS) };
    },
    'seller.readiness.get': (_i, ctx) => {
      const { m, s } = membership(persona(), sellerIdOf(ctx));
      if (s.readinessFails) throw new TransportError('UNAVAILABLE');
      return readinessOf(s, accessFor(m, s).capabilities);
    },
    'seller.home.get': (_i, ctx) => {
      const { m, s } = membership(persona(), sellerIdOf(ctx));
      return briefOf(m, s, accessFor(m, s));
    },
    'notifications.list': (_i, ctx) => {
      const { m, s } = membership(persona(), sellerIdOf(ctx));
      if (!accessFor(m, s).capabilities.includes('notifications.view')) throw new TransportError('PERMISSION_DENIED');
      return { seller_id: s.summary.id, unread_count: s.notifications.filter((n) => !n.read).length, items: s.notifications };
    },
    'market.onboarding.get': () => {
      persona();
      return { market_id: 'fx_market_ethiopia', country: 'Ethiopia', timezone: 'Africa/Addis_Ababa' };
    },
    'market.context.get': (_i, ctx) => {
      const { s } = membership(persona(), sellerIdOf(ctx));
      return { seller_id: s.summary.id, market_id: 'fx_market_ethiopia', country: 'Ethiopia', timezone: 'Africa/Addis_Ababa' };
    },
  };
  function sellerIdOf(ctx: CallContext): string {
    if (!ctx.sellerId) throw new TransportError('REFUSED', { detail: BLOCKED_CODE });
    return ctx.sellerId;
  }

  return {
    async handle<K extends OpId>(op: K, input: OpInput<K>, ctx: CallContext): Promise<OpOutput<K>> {
      // Fail closed (RN-3): an operation the fixture does not serve, or one on the prohibited list, is refused.
      if (PROHIBITED.test(op) || !Object.hasOwn(handlers, op)) throw new TransportError('REFUSED', { detail: BLOCKED_CODE });
      log.push({ op, sellerId: ctx.sellerId ?? null, key: ctx.idempotencyKey ?? null });
      const sentWith = sessionToken;
      await delay(ctx.sellerId ?? null);
      const slow = slowOps.get(op);
      if (slow && slow.times > 0) {
        slow.times -= 1;
        await new Promise<void>((resolve) => setTimeout(resolve, slow.ms));
      }
      const planned = failures.get(op);
      if (planned && planned.times > 0) {
        planned.times -= 1;
        throw new TransportError(planned.code);
      }
      if (sessionRevoked && !op.startsWith('auth.')) {
        session = null;
        throw new TransportError('AUTHENTICATION_REQUIRED');
      }
      // Sent with a session that has since ended (signed out and in again): that cookie is no longer valid. The current session is untouched.
      if (sentWith !== sessionToken && !op.startsWith('auth.')) throw new TransportError('AUTHENTICATION_REQUIRED');
      return (handlers[op] as (i: OpInput<K>, c: CallContext) => OpOutput<K>)(input, ctx);
    },
    hooks: {
      revokeDestination(sellerId, key) {
        revokedDest.set(sellerId, (revokedDest.get(sellerId) ?? new Set()).add(key));
      },
      revokeCapability(sellerId, capability) {
        revokedCaps.set(sellerId, (revokedCaps.get(sellerId) ?? new Set()).add(capability));
      },
      withdrawEntitlement(sellerId, key) {
        const record = sellers[sellerId];
        if (record && !record.entitlementOff.includes(key)) record.entitlementOff.push(key);
      },
      revokeSession() {
        sessionRevoked = true;
      },
      failNext(op, code, times = 1) {
        failures.set(op, { code, times });
      },
      delayNext(op, ms, times = 1) {
        slowOps.set(op, { ms, times });
      },
      revokeMembership(sellerId) {
        const who = personas.find((p) => p.id === session);
        if (who) who.memberships = who.memberships.filter((m) => m.sellerId !== sellerId);
      },
      callLog: () => log,
      skewClock(ms) {
        skew += ms;
      },
      restrictProduct: (sellerId, productId) => catalogue.restrict(sellerId, productId),
      buyerMessage: (sellerId, conversationId, body) => inbox.arrive(sellerId, conversationId, body),
    },
  };
}
