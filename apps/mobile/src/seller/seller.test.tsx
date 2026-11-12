import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { createApiClient } from '../api/client';
import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, SIGNED_IN_CONTEXT, bootstrapBody, installFakeApi, problem, type Reply } from '../testing/fake-api';
import { TOKEN_KEY, memory, resetSecureStore } from '../testing/secure-store-mock';

/**
 * WO-020 Seller Companion on the real route tree against an in-memory server that applies the
 * scope rules the running API showed (WO-020 probe, 12 November 2026): X-Adulis-Seller required on
 * /v1/seller/* reads except the list (400), a store the Account does not hold is 404, and
 * as=seller needs the header to equal seller_id (400). Numbers in the names are the work order's
 * section 24 matrix.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const A = { id: 'aaaaaaaa-0000-4000-8000-00000000000a', handle: 'store-a', store_name: 'Store A', status: 'ACTIVE', role: 'OWNER', created_at: '2026-11-01T08:00:00.000Z' };
const B = { id: 'bbbbbbbb-0000-4000-8000-00000000000b', handle: 'store-b', store_name: 'Store B', status: 'SAFETY_SUSPENDED', role: 'ANALYST', created_at: '2026-11-02T08:00:00.000Z' };
type Row = typeof A;
const overview = (n: number) => ({
  products_published: n,
  orders: n + 1,
  active_reservations: n + 2,
  completed_handoffs: n + 3,
  followers: n + 4,
  window: { from: '2026-10-13', to: '2026-11-12' },
});
const order = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `f5b00000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  state: 'CREATED',
  total_minor: '0',
  total_currency: 'ETB',
  expires_at: '2026-11-14T16:49:54.868Z',
  ready_at: null,
  clock_stopped_at: null,
  created_at: '2026-11-12T16:49:54.868Z',
  line_count: '2',
  payment_sla_deadline: null,
  total: { amount_minor: 120000, currency: 'ETB' },
  ...overrides,
});
const notice = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `de800000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  template_key: 'NEW_DEVICE_SIGNIN',
  locale: 'en',
  slots: {},
  order_id: null,
  suppressible: false,
  scheduled_for: '2026-11-12T17:37:58.513Z',
  read_at: null,
  ...overrides,
});

let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
const sellerHeader = (c: { headers: Record<string, string> }) => c.headers['X-Adulis-Seller'];
const sellerCalls = () => api.calls.filter((c) => c.path.startsWith('/v1/seller'));
const signedIn = () => resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));

type Server = {
  available?: boolean | null;
  sellers?: Row[];
  overview?: Record<string, Reply | (() => Reply | Promise<Reply>)>;
  orders?: Record<string, Record<string, unknown[][]>>;
  notifications?: Record<string, unknown[][]>;
};
/** The Seller side of the server for one test. Pages: arrays of rows, the cursor is the page index. */
function installSeller({ available = true, sellers = [A], overview: views = {}, orders = {}, notifications = {} }: Server = {}) {
  const state = { sellers, available };
  api.on('GET /v1/bootstrap', (call) => {
    if (!call.headers.Authorization) return ok(bootstrapBody());
    if (call.headers.Authorization !== `Bearer ${GOOD_TOKEN}`) return problem(401, 'SESSION_EXPIRED', 'auth');
    const context = state.available === null ? null : { ...SIGNED_IN_CONTEXT, seller_companion: { available: state.available } };
    return ok(bootstrapBody({ account_context: context }));
  });
  const held = (call: { headers: Record<string, string> }) => state.sellers.some((s) => s.id === sellerHeader(call));
  api.on('GET /v1/seller/list', (call) => (call.headers.Authorization ? ok({ data: state.sellers }) : problem(401, 'SESSION_EXPIRED', 'auth')));
  api.on('GET /v1/seller/analytics/overview', async (call) => {
    if (!sellerHeader(call)) return problem(400, 'SELLER_CONTEXT_REQUIRED', 'request');
    if (!held(call)) return problem(404, 'NOT_FOUND', 'request');
    const view = views[sellerHeader(call)!] ?? ok(overview(4));
    return typeof view === 'function' ? view() : view;
  });
  const page = (pages: unknown[][] | undefined, cursor: string | undefined) => {
    const i = cursor ? Number(cursor) : 0;
    const rows = pages?.[i] ?? [];
    const next = pages && i + 1 < pages.length ? String(i + 1) : null;
    return { data: rows, has_more: next !== null, next_cursor: next };
  };
  api.on('GET /v1/seller/orders', (call) => {
    if (!sellerHeader(call)) return problem(400, 'SELLER_CONTEXT_REQUIRED', 'request');
    if (!held(call)) return problem(404, 'NOT_FOUND', 'request');
    return ok(page(orders[sellerHeader(call)!]?.[call.query.bucket ?? ''], call.query.cursor));
  });
  api.onPattern('GET', /^\/v1\/seller\/orders\/[^/]+$/, (call) => {
    if (!held(call)) return problem(404, 'NOT_FOUND', 'request');
    const id = call.path.split('/').pop();
    const all = Object.values(orders[sellerHeader(call)!] ?? {}).flat(2) as Array<{ id: string }>;
    const found = all.find((o) => o.id === id);
    return found ? ok({ allowed_actions: ['seller.orders:respond'], ...found, lines: [{}, {}], payment_submissions: [{ id: 'x' }], history: [] }) : problem(404, 'NOT_FOUND', 'request');
  });
  api.on('GET /v1/notifications', (call) => {
    if (call.query.as === 'buyer') return ok({ data: [notice(90, { template_key: 'BUYER_FIXTURE_NOTICE' })], next_cursor: null });
    if (call.query.as !== 'seller' || !call.query.seller_id || sellerHeader(call) !== call.query.seller_id) return problem(400, 'SCOPE_PARAMETER_REQUIRED', 'request');
    if (!held(call)) return problem(404, 'NOT_FOUND', 'request');
    const p = page(notifications[call.query.seller_id], call.query.cursor);
    return ok({ data: p.data, next_cursor: p.next_cursor });
  });
  api.onPattern('POST', /^\/v1\/notifications\/[^/]+\/read$/, () => ok({ read_at: '2026-11-12T18:00:00.000Z' }));
  return state;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

afterEach(() => {
  // 44, 45, 54: no Order, payment, refund, Cart or Account-wide read is ever sent from Seller mode.
  expect(api.calls.filter((c) => c.method !== 'GET' && /\/v1\/seller\//.test(c.path))).toEqual([]);
  expect(api.calls.filter((c) => /cart|checkout|payment|refund|reservation/i.test(c.path))).toEqual([]);
  expect(api.callsTo('POST /v1/notifications/read-all')).toEqual([]);
  // 53: no Courier request.
  expect(api.calls.filter((c) => /courier/i.test(c.path))).toEqual([]);
});

describe('Seller mode access (server-derived)', () => {
  it('1. a guest cannot enter: /seller lands on Buyer Home and no Seller request is made', async () => {
    installSeller();
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    expect(screen).toHavePathname('/home/for-you');
    expect(sellerCalls()).toEqual([]);
  });

  it('2, 9. a Buyer without Seller access: no Switch to Seller, and /seller fails closed (a leftover mode grants nothing)', async () => {
    signedIn();
    installSeller({ available: false });
    useUiStore.setState({ activeMode: 'seller' });
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    expect(await screen.findByText(en['buyer.you.signed_in'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['seller.mode.switch_to_seller'] })).not.toBeOnTheScreen();
    await act(() => router.push('/seller'));
    expect(await screen.findByText(en['seller.gate.unavailable'])).toBeOnTheScreen();
    await settle();
    expect(sellerCalls()).toEqual([]);
  });

  it('4. a bootstrap without account_context fails closed', async () => {
    signedIn();
    installSeller({ available: null });
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByText(en['seller.gate.unavailable'])).toBeOnTheScreen();
    expect(sellerCalls()).toEqual([]);
  });

  it('5. a server error is not a revoked relationship: it says so, keeps the session, and a retry gets in', async () => {
    signedIn();
    const state = installSeller();
    let down = true;
    api.on('GET /v1/bootstrap', () =>
      down ? problem(500, 'INTERNAL', 'request') : ok(bootstrapBody({ account_context: { ...SIGNED_IN_CONTEXT, seller_companion: { available: state.available === true } } })),
    );
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    expect(screen.queryByText(en['seller.gate.unavailable'])).not.toBeOnTheScreen();
    expect(memory.get(TOKEN_KEY)).toBe(GOOD_TOKEN);
    down = false;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByRole('header', { name: 'Store A' })).toBeOnTheScreen();
  });

  it('3, 6, 11. an authorized Account switches from You to its one store and back, on the same session', async () => {
    signedIn();
    installSeller();
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await fireEvent.press(await screen.findByRole('button', { name: en['seller.mode.switch_to_seller'] }));
    expect(await screen.findByRole('header', { name: 'Store A' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/seller');
    expect(useUiStore.getState().activeMode).toBe('seller');
    expect(screen.getByText('Your role: Owner')).toBeOnTheScreen();
    expect(screen.getByText('Store status: Open')).toBeOnTheScreen();
    // The list asks which stores there are: it carries no store header.
    expect(api.callsTo('GET /v1/seller/list').every((c) => sellerHeader(c) === undefined)).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: en['seller.mode.switch_to_buyer'] }));
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    expect(useUiStore.getState().activeMode).toBe('buyer');
    // One credential read at startup, none written or deleted: no new session for a mode.
    const tokenCalls = (fn: jest.Mock) => fn.mock.calls.filter(([key]) => key === TOKEN_KEY);
    expect(tokenCalls(jest.mocked(SecureStore.getItemAsync))).toHaveLength(1);
    expect(tokenCalls(jest.mocked(SecureStore.setItemAsync))).toHaveLength(0);
    expect(tokenCalls(jest.mocked(SecureStore.deleteItemAsync))).toHaveLength(0);
    // 30: Buyer requests never carry the store.
    expect(api.calls.filter((c) => !c.path.startsWith('/v1/seller') && c.query.as !== 'seller' && sellerHeader(c) !== undefined)).toEqual([]);
  });

  it('7, 19. sign-out leaves Seller mode, and a later visit reads nothing for the old Account', async () => {
    signedIn();
    installSeller();
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByRole('header', { name: 'Store A' })).toBeOnTheScreen();
    await act(() => router.navigate('/account'));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
    const before = sellerCalls().length;
    await act(() => router.push('/seller'));
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    await settle();
    expect(sellerCalls().length).toBe(before);
  });
});

describe('store selection', () => {
  it('12, 15, 20. several stores: a chooser with role and status; choosing B shows B, Change store returns', async () => {
    signedIn();
    installSeller({ sellers: [A, B], overview: { [A.id]: ok(overview(4)), [B.id]: ok(overview(10)) } });
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByText(en['seller.chooser.title'])).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Store A, Owner, Open' })).toBeOnTheScreen();
    expect(screen.getByText('@store-b')).toBeOnTheScreen(); // review F6: same-name stores tell apart
    await fireEvent.press(screen.getByRole('button', { name: 'Store B, Analyst, Suspended' }));
    expect(await screen.findByRole('header', { name: 'Store B' })).toBeOnTheScreen();
    expect(screen.getByText(en['seller.status.restricted'])).toBeOnTheScreen();
    expect(await screen.findByText('Published Products now: 10')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['seller.home.change_store'] }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Store A, Owner, Open' }));
    expect(await screen.findByText('Published Products now: 4')).toBeOnTheScreen();
    expect(screen.queryByText('Published Products now: 10')).not.toBeOnTheScreen();
    const overviews = api.callsTo('GET /v1/seller/analytics/overview').map(sellerHeader);
    expect(overviews).toEqual([B.id, A.id]);
  });

  it('13. no store: says so, invents none', async () => {
    signedIn();
    installSeller({ sellers: [] });
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByText(en['seller.chooser.empty'])).toBeOnTheScreen();
    expect(api.callsTo('GET /v1/seller/analytics/overview')).toEqual([]);
  });

  it('14, 17. a DELETED store and a row with an invalid id are not offered; the one valid store opens', async () => {
    signedIn();
    installSeller({ sellers: [A, { ...B, status: 'DELETED' }, { ...B, id: 'not-a-uuid', store_name: 'Broken' }] as Row[] });
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByRole('header', { name: 'Store A' })).toBeOnTheScreen();
    expect(screen.queryByText('Store B')).not.toBeOnTheScreen();
    expect(screen.queryByText('Broken')).not.toBeOnTheScreen();
    expect(api.calls.filter((c) => sellerHeader(c) !== undefined).every((c) => sellerHeader(c) === A.id)).toBe(true);
  });

  it('8, 16. a revoked relationship: a 404 on a store read drops the store and the list is read again', async () => {
    signedIn();
    installSeller({ sellers: [A] });
    // The list (and bootstrap) still name the store; the relationship was revoked just after.
    let lists = 0;
    api.on('GET /v1/seller/list', () => ok({ data: lists++ === 0 ? [A] : [] }));
    api.on('GET /v1/seller/analytics/overview', () => problem(404, 'NOT_FOUND', 'request'));
    const boots = () => api.callsTo('GET /v1/bootstrap').filter((c) => c.headers.Authorization).length;
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    const bootsBefore = boots();
    expect(await screen.findByText(en['seller.chooser.empty'])).toBeOnTheScreen();
    expect(lists).toBeGreaterThanOrEqual(2);
    expect(boots()).toBeGreaterThan(bootsBefore);
    expect(screen.queryByText('Store A')).not.toBeOnTheScreen();
  });

  it('17. the client refuses an invalid store id before anything is sent', async () => {
    const fetchMock = api.fetchMock;
    const client = createApiClient({ deviceId: async () => '0b6f1a3e-9999-4999-8999-999999999999', token: () => GOOD_TOKEN, onSessionEnded: () => undefined });
    await expect(client.sellerOverview('store-a')).rejects.toThrow('invalid seller context');
    await expect(client.sellerOrders('', 'active', null)).rejects.toThrow('invalid seller context');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('18. a list answer that lands after sign-out is never shown and sends nothing more', async () => {
    signedIn();
    installSeller();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    api.on('GET /v1/seller/list', async () => {
      await gate;
      return ok({ data: [A] });
    });
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByText(en['seller.chooser.loading'])).toBeOnTheScreen();
    await act(() => router.navigate('/account'));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
    await act(async () => release());
    await settle();
    expect(screen.queryByText('Store A')).not.toBeOnTheScreen();
    expect(api.callsTo('GET /v1/seller/analytics/overview')).toEqual([]);
  });
});

describe('basic overview', () => {
  it('21, 22, 23, 28. the server\'s counts, Published Products as a current total, Orders with its window; nothing else', async () => {
    signedIn();
    installSeller();
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByText('Published Products now: 4')).toBeOnTheScreen();
    expect(screen.getByText(/^Orders from Oct 13, 2026 to Nov 12, 2026: 5$/)).toBeOnTheScreen();
    expect(screen.getByText('Active reservations: 6')).toBeOnTheScreen();
    expect(screen.getByText('Completed handoffs: 7')).toBeOnTheScreen();
    expect(screen.getByText('Followers: 8')).toBeOnTheScreen();
    expect(screen.queryByText(/revenue|profit|conversion|ETB/i)).not.toBeOnTheScreen();
    const [call] = api.callsTo('GET /v1/seller/analytics/overview');
    expect(sellerHeader(call!)).toBe(A.id);
  });

  it('24. a missing count is not shown, and Orders without a window is not claimed', async () => {
    signedIn();
    installSeller({ overview: { [A.id]: ok({ products_published: 2, orders: 9, followers: 'many' }) } });
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByText('Published Products now: 2')).toBeOnTheScreen();
    expect(screen.queryByText(/Orders from/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/Followers/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/undefined|NaN|null/)).not.toBeOnTheScreen();
  });

  it('25. a 403 says the overview is not available for this role, and the store stays open', async () => {
    signedIn();
    installSeller({ overview: { [A.id]: problem(403, 'PERMISSION_DENIED', 'auth') } });
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByText(en['seller.overview.unavailable'])).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Store A' })).toBeOnTheScreen();
  });

  it('26, 27. a server failure and a malformed answer show a failure and a retry; offline says offline; never numbers', async () => {
    signedIn();
    let reply: Reply = problem(500, 'INTERNAL', 'request');
    installSeller({ overview: { [A.id]: () => reply } });
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByText(`${en['seller.overview.failed']} ${en['error.request.internal']}`)).toBeOnTheScreen();
    reply = ok({ unexpected: true });
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText(new RegExp(`^${en['seller.overview.failed']} `))).toBeOnTheScreen();
    expect(screen.queryByText(/Published Products now/)).not.toBeOnTheScreen();
    // Offline (after startup, so the app has started): the retry waits and says offline.
    await act(async () => onlineManager.setOnline(false));
    try {
      await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
      expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
      expect(screen.queryByText(/Published Products now/)).not.toBeOnTheScreen();
    } finally {
      await act(async () => onlineManager.setOnline(true));
    }
  });
});

describe('store notifications', () => {
  it('29, 33, 38. the store\'s inbox (as=seller with the matching header), a neutral sentence for an unknown template, Mark as read', async () => {
    signedIn();
    installSeller({ notifications: { [A.id]: [[notice(1, { order_id: 'f5b00000-0000-4000-8000-000000000201', suppressible: true })]] } });
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    await fireEvent.press(await screen.findByRole('button', { name: en['seller.notifications.title'] }));
    expect(await screen.findByText(en['seller.notifications.generic'])).toBeOnTheScreen();
    expect(screen.getByText(en['seller.notifications.about_order'])).toBeOnTheScreen();
    expect(screen.queryByText('NEW_DEVICE_SIGNIN')).not.toBeOnTheScreen();
    const [read] = api.callsTo('GET /v1/notifications');
    expect(read!.query).toMatchObject({ as: 'seller', seller_id: A.id });
    expect(sellerHeader(read!)).toBe(A.id);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.notifications.mark_read'] }));
    expect(await screen.findByText(en['buyer.notifications.read_state'])).toBeOnTheScreen();
    const marks = api.calls.filter((c) => c.method === 'POST' && /\/read$/.test(c.path));
    expect(marks).toHaveLength(1);
    expect(marks[0]!.headers['Idempotency-Key']).toEqual(expect.any(String));
  });

  it('30. the Buyer inbox stays the Buyer\'s: as=buyer, no store header, none of the store\'s rows', async () => {
    signedIn();
    installSeller({ notifications: { [A.id]: [[notice(1)]] } });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    expect(await screen.findByText(en['buyer.notifications.generic'])).toBeOnTheScreen();
    expect(screen.queryByText(en['seller.notifications.generic'])).not.toBeOnTheScreen();
    const reads = api.callsTo('GET /v1/notifications');
    expect(reads.every((c) => c.query.as === 'buyer' && sellerHeader(c) === undefined)).toBe(true);
  });

  it('31, 32, 37. switching stores replaces the inbox; older pages load on request; a late page for the old store is not shown', async () => {
    signedIn();
    installSeller({
      sellers: [A, B],
      notifications: { [A.id]: [[notice(1)], [notice(2, { read_at: '2026-11-10T08:00:00.000Z' })]], [B.id]: [[notice(3, { read_at: '2026-11-11T08:00:00.000Z' })]] },
    });
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Store A, Owner, Open' }));
    await fireEvent.press(await screen.findByRole('button', { name: en['seller.notifications.title'] }));
    expect(await screen.findByText(en['buyer.notifications.unread'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.notifications.load_older'] }));
    expect(await screen.findByText(en['buyer.notifications.read_state'])).toBeOnTheScreen();
    expect(api.callsTo('GET /v1/notifications').map((c) => c.query.cursor)).toEqual([undefined, '1']);
    // Back to Home, change to Store B: B's inbox only.
    await act(() => router.back());
    await fireEvent.press(await screen.findByRole('button', { name: en['seller.home.change_store'] }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Store B, Analyst, Suspended' }));
    await fireEvent.press(await screen.findByRole('button', { name: en['seller.notifications.title'] }));
    await settle();
    expect(screen.queryByText(en['buyer.notifications.unread'])).not.toBeOnTheScreen();
    expect(screen.getAllByText(en['buyer.notifications.read_state'])).toHaveLength(1);
    expect(sellerHeader(api.callsTo('GET /v1/notifications').at(-1)!)).toBe(B.id);
  });

  it('34, 35. a second tap while marking sends nothing; offline keeps the key for the retry', async () => {
    signedIn();
    installSeller({ notifications: { [A.id]: [[notice(1, { suppressible: true })]] } });
    let calls = 0;
    api.onPattern('POST', /^\/v1\/notifications\/[^/]+\/read$/, () => (calls++ === 0 ? 'offline' : ok({ read_at: '2026-11-12T18:00:00.000Z' })));
    await renderRouter(APP_DIR, { initialUrl: '/seller/notifications' });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.notifications.mark_read'] }));
    expect(await screen.findByText(en['buyer.notifications.mark_read_failed'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.notifications.mark_read'] }));
    expect(await screen.findByText(en['buyer.notifications.read_state'])).toBeOnTheScreen();
    const keys = api.calls.filter((c) => c.method === 'POST' && /\/read$/.test(c.path)).map((c) => c.headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('36. an expired session in the store inbox signs out and leaves Seller mode', async () => {
    signedIn();
    installSeller();
    api.on('GET /v1/notifications', () => problem(401, 'SESSION_EXPIRED', 'auth'));
    await renderRouter(APP_DIR, { initialUrl: '/seller/notifications' });
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    await waitFor(() => expect(memory.has(TOKEN_KEY)).toBe(false));
  });
});

describe('security review fixes', () => {
  it('F2. a protected store notice (non-suppressible) offers no Mark as read and points to the Seller Console', async () => {
    signedIn();
    installSeller({ notifications: { [A.id]: [[notice(1, { template_key: 'PAYOUT_CHANGE_REQUESTED', slots: { bank_code: 'CBE', account_last4: '6789' } })]] } });
    await renderRouter(APP_DIR, { initialUrl: '/seller/notifications' });
    expect(await screen.findByText(en['seller.notifications.protected'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['buyer.notifications.mark_read'] })).not.toBeOnTheScreen();
    expect(screen.queryByText(/6789|CBE/)).not.toBeOnTheScreen();
  });

  it('F1. one store whose reads keep answering 404 while the list still names it: a bounded number of requests', async () => {
    signedIn();
    installSeller({ sellers: [A] });
    api.on('GET /v1/seller/analytics/overview', () => problem(404, 'NOT_FOUND', 'request'));
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    expect(await screen.findByText(new RegExp(`^${en['seller.overview.failed']}`))).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(10_000));
    expect(api.callsTo('GET /v1/seller/analytics/overview').length).toBeLessThanOrEqual(2);
    expect(api.callsTo('GET /v1/seller/list').length).toBeLessThanOrEqual(3);
  });
});

describe('read-only Orders', () => {
  it('40, 41, 43, 44. the server\'s buckets, its states, Load more by cursor, and no action on any Order', async () => {
    signedIn();
    // Active's first page is taller than the Jest viewport, so nothing loads until Load more.
    const activeFirst = Array.from({ length: 20 }, (_, i) => order(300 + i));
    installSeller({
      orders: {
        [A.id]: {
          needs_action: [[order(201, { state: 'PAYMENT_SUBMITTED' }), order(204, { state: 'SOMETHING_NEW' })]],
          active: [activeFirst, [order(203)]],
        },
      },
    });
    await renderRouter(APP_DIR, { initialUrl: '/seller/orders' });
    expect(await screen.findByText(en['seller.orders.read_only'])).toBeOnTheScreen();
    expect(await screen.findByText('Payment submitted by the Buyer')).toBeOnTheScreen();
    // A state this version does not know is shown neutrally, never guessed.
    expect(screen.getByText(en['seller.order.state.other'])).toBeOnTheScreen();
    expect(api.callsTo('GET /v1/seller/orders')[0]!.query).toMatchObject({ bucket: 'needs_action', limit: '20' });
    await fireEvent.press(screen.getByTestId('filter-tab-active'));
    expect((await screen.findAllByText('Created')).length).toBeGreaterThan(0);
    // Only the Active bucket's Orders: the other bucket's are gone.
    expect(screen.queryByText('Payment submitted by the Buyer')).not.toBeOnTheScreen();
    expect(screen.getAllByText('Total: ETB 1,200.00').length).toBeGreaterThan(0);
    await settle();
    expect(api.callsTo('GET /v1/seller/orders')).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.list.load_more'] }));
    await waitFor(() => expect(api.callsTo('GET /v1/seller/orders')).toHaveLength(3));
    expect(api.callsTo('GET /v1/seller/orders').map((c) => [c.query.bucket, c.query.cursor])).toEqual([
      ['needs_action', undefined],
      ['active', undefined],
      ['active', '1'],
    ]);
    for (const action of [/confirm/i, /ready/i, /cancel/i, /refund/i, /payment received/i]) {
      expect(screen.queryByRole('button', { name: action })).not.toBeOnTheScreen();
    }
  });

  it('42, 44. an Order\'s detail: state, total, product count; no payment data and no action', async () => {
    signedIn();
    installSeller({ orders: { [A.id]: { needs_action: [[order(201, { state: 'PAYMENT_CONFIRMED', ready_at: '2026-11-13T09:00:00.000Z' })]] } } });
    await renderRouter(APP_DIR, { initialUrl: '/seller/orders' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Payment confirmed, Placed/ }));
    expect(await screen.findByRole('header', { name: 'Status: Payment confirmed' })).toBeOnTheScreen();
    expect(screen.getByText('Products in this Order: 2')).toBeOnTheScreen();
    expect(screen.getByText(/^Ready /)).toBeOnTheScreen();
    expect(screen.queryByText(/payment submission|evidence/i)).not.toBeOnTheScreen();
    expect(screen.queryAllByRole('button').filter((b) => /confirm|ready|cancel|refund|reject/i.test(String(b.props.accessibilityLabel)))).toEqual([]);
  });

  it('46. an Order of another store is not shown under this one (the server answers 404)', async () => {
    signedIn();
    installSeller({ orders: { [A.id]: { needs_action: [[order(201)]] } } });
    await renderRouter(APP_DIR, { initialUrl: '/seller/orders/f5b00000-0000-4000-8000-000000000999' });
    expect(await screen.findByText(en['seller.order.gone'])).toBeOnTheScreen();
    await renderRouter(APP_DIR, { initialUrl: '/seller/orders/not-an-id' });
    expect(await screen.findByText(en['seller.order.gone'])).toBeOnTheScreen();
  });

  it('47. a 403 says Orders are not available for this role', async () => {
    signedIn();
    installSeller();
    api.on('GET /v1/seller/orders', () => problem(403, 'PERMISSION_DENIED', 'auth'));
    await renderRouter(APP_DIR, { initialUrl: '/seller/orders' });
    expect(await screen.findByText(en['seller.orders.unavailable'])).toBeOnTheScreen();
  });

  it('49. the Buyer tabs still work after a visit to Seller mode', async () => {
    signedIn();
    installSeller();
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    await fireEvent.press(await screen.findByRole('button', { name: en['seller.mode.switch_to_buyer'] }));
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    await fireEvent.press(bottomTab(en['buyer.tab.you']));
    expect(await screen.findByRole('button', { name: en['seller.mode.switch_to_seller'] })).toBeOnTheScreen();
  });
});
