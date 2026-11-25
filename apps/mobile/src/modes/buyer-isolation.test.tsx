import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { useUiStore } from '../state/ui-store';
import {
  GOOD_TOKEN,
  SIGNED_IN_CONTEXT,
  SIGN_IN_CODE,
  bootstrapBody,
  installFakeApi,
  problem,
  type Recorded,
  type Reply,
} from '../testing/fake-api';
import { TOKEN_KEY, memory, resetSecureStore } from '../testing/secure-store-mock';

/**
 * Buyer-only isolation on the real route tree: what a guest, a Buyer without Seller access and a
 * Buyer who switches Accounts can reach, whether the app starts on a link (cold) or the link
 * reaches an app that is already running (warm). The server is the in-memory fake API; every
 * request it receives is recorded, so "nothing was sent" is asserted, not assumed.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const REF = '0b6f1a3e-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_TOKEN = 'Other_credential_for_tests_0123456789abcdef';
const A = `Bearer ${GOOD_TOKEN}`;
const B = `Bearer ${OTHER_TOKEN}`;
const PHONE = '+251911234567';

const devGlobal = globalThis as unknown as { __DEV__: boolean };

/** Run a test as a release build: __DEV__ is false, as it is in a production bundle. */
async function asRelease(body: () => Promise<void>) {
  const dev = devGlobal.__DEV__;
  devGlobal.__DEV__ = false;
  try {
    await body();
  } finally {
    devGlobal.__DEV__ = dev;
  }
}

let api: ReturnType<typeof installFakeApi>;
const signedIn = (token = GOOD_TOKEN) => resetSecureStore({ [TOKEN_KEY]: token });
const ok = (body: unknown): Reply => ({ status: 200, body });
/** Lets effects and requests that are about to start start, so "nothing was sent" is not a race. */
const quiet = () => act(() => jest.advanceTimersByTimeAsync(1000));
const sellerCalls = () => api.calls.filter((c) => c.path.startsWith('/v1/seller'));
const sellerScoped = (c: Recorded) => c.headers['X-Adulis-Seller'] !== undefined || c.query.as === 'seller';
/** A link into the app: it opens at once when the app starts on it, and later when it is running. */
const open = (path: string) => act(() => router.push(path as never));

/** All a session on Buyer Home needs: registering the install, bootstrap (with or without a session), the public feed. */
const HOME_CALLS = ['GET /v1/bootstrap', 'GET /v1/fyp', 'POST /v1/devices'];
/** Every request since the `from`th that is not one of those, whatever its path is called. */
const unexpectedCalls = (from = 0) => api.calls.slice(from).map((c) => `${c.method} ${c.path}`).filter((c) => !HOME_CALLS.includes(c));
function expectGuestOnly() {
  expect(api.calls.filter((c) => c.headers.Authorization !== undefined)).toEqual([]);
  expect(unexpectedCalls()).toEqual([]);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

// Where a guest ends up for each Account-bound destination: the prompt on the screen itself, or the
// screen the destination hands a guest back to.
const PRIVATE = [
  ['/orders', 'buyer.orders.signed_out', '/orders'],
  ['/saved', 'buyer.saved.signed_out', '/saved'],
  ['/account', 'buyer.you.signed_out', '/account'],
  ['/messages', 'buyer.messages.signed_out', '/messages'],
  ['/notifications', 'buyer.notifications.signed_out', '/notifications'],
  ['/account/delete', 'buyer.you.signed_out', '/account'],
  [`/chat/${REF}`, 'buyer.messages.signed_out', '/messages'],
  ['/save-to', 'buyer.saved.signed_out', '/save-to'],
  [`/collections/${REF}`, 'buyer.saved.signed_out', `/collections/${REF}`],
] as const;

describe('a guest on an Account-bound route', () => {
  it.each(PRIVATE)('%s opened cold shows a sign-in prompt and sends nothing authenticated', async (path, message, lands) => {
    await renderRouter(APP_DIR, { initialUrl: path });
    expect(await screen.findByText(en[message])).toBeOnTheScreen();
    expect(screen).toHavePathname(lands);
    await quiet();
    expectGuestOnly();
  });

  it.each(PRIVATE)('%s arriving as a link into a running app does the same', async (path, message, lands) => {
    await renderRouter(APP_DIR, { initialUrl: '/home/for-you' });
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    await open(path);
    expect(await screen.findByText(en[message])).toBeOnTheScreen();
    expect(screen).toHavePathname(lands);
    await quiet();
    expectGuestOnly();
  });

  it('never starts a sign-in by itself, and never stores a credential', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/messages' });
    expect(await screen.findByText(en['buyer.messages.signed_out'])).toBeOnTheScreen();
    await quiet();
    expect(api.callsTo('POST /v1/auth/otp/request')).toEqual([]);
    expect(memory.has(TOKEN_KEY)).toBe(false);
  });
});

// A store the Account would see if the Seller gate ever let a request through.
const STORE = { id: 'aaaaaaaa-0000-4000-8000-00000000000a', handle: 'store-a', store_name: 'Store A', status: 'ACTIVE', role: 'OWNER', created_at: '2026-11-01T08:00:00.000Z' };
// The second Account's own store, with a different id.
const STORE_B = { id: 'bbbbbbbb-0000-4000-8000-00000000000b', handle: 'store-b', store_name: 'Store B', status: 'ACTIVE', role: 'OWNER', created_at: '2026-11-02T08:00:00.000Z' };

/** The server's side of one Account: whether it may use the Seller Companion, whether Courier is on. */
function installAccount({ seller, courier = false }: { seller: boolean; courier?: boolean }) {
  api.on('GET /v1/bootstrap', (call) => {
    if (!call.headers.Authorization) return ok(bootstrapBody());
    return ok(bootstrapBody({ account_context: { ...SIGNED_IN_CONTEXT, seller_companion: { available: seller }, courier: { available: courier } } }));
  });
  api.on('GET /v1/seller/list', () => ok({ data: [STORE] }));
  api.on('GET /v1/conversations', () => ok({ data: [], next_cursor: null }));
  api.on('GET /v1/notifications', () => ok({ data: [], next_cursor: null }));
}

function expectNoSellerTraffic() {
  expect(sellerCalls()).toEqual([]);
  expect(api.calls.filter(sellerScoped)).toEqual([]);
  expect(screen.queryByText(STORE.store_name)).not.toBeOnTheScreen();
  expect(screen.queryByText(en['seller.title'])).not.toBeOnTheScreen();
  expect(useUiStore.getState().activeMode).not.toBe('seller');
}

const SELLER_ROUTES = ['/seller', '/seller/messages', `/seller/messages/${REF}`, '/seller/notifications'];
const HIDDEN_ROUTES = ['/courier', '/dev', '/_sitemap'];

describe('a guest on a Seller, Courier or diagnostics route, on a release build', () => {
  const ROUTES = [...SELLER_ROUTES, ...HIDDEN_ROUTES];
  // The server would serve a store to anyone who asked, so a request from a guest would show.
  beforeEach(() => installAccount({ seller: true, courier: true }));

  it.each(ROUTES)('%s opened cold lands on Buyer Home and sends nothing authenticated', (path) =>
    asRelease(async () => {
      await renderRouter(APP_DIR, { initialUrl: path });
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      expect(screen).toHavePathname('/home/for-you');
      await quiet();
      expectGuestOnly();
      expectNoSellerTraffic();
    }),
  );

  it.each(ROUTES)('%s arriving as a link into a running app does the same', (path) =>
    asRelease(async () => {
      await renderRouter(APP_DIR, { initialUrl: '/home/for-you' });
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      await open(path);
      // Home was already on screen, so let the redirect finish before looking at where the link ended.
      await quiet();
      expect(screen).toHavePathname('/home/for-you');
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      expectGuestOnly();
      expectNoSellerTraffic();
    }),
  );
});

describe('a signed-in Buyer without Seller access, on a release build', () => {
  beforeEach(() => {
    signedIn();
    installAccount({ seller: false });
  });

  it.each(SELLER_ROUTES)('%s opened cold fails closed: no Seller screen and no Seller request', (path) =>
    asRelease(async () => {
      await renderRouter(APP_DIR, { initialUrl: path });
      expect(await screen.findByText(en['seller.gate.unavailable'])).toBeOnTheScreen();
      await quiet();
      expectNoSellerTraffic();
    }),
  );

  it.each(SELLER_ROUTES)('%s arriving as a link into a running app fails closed too', (path) =>
    asRelease(async () => {
      await renderRouter(APP_DIR, { initialUrl: '/account' });
      expect(await screen.findByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
      await open(path);
      expect(await screen.findByText(en['seller.gate.unavailable'])).toBeOnTheScreen();
      await quiet();
      expectNoSellerTraffic();
    }),
  );

  it('offers no way into Seller mode from You, and a leftover active mode does not add one', () =>
    asRelease(async () => {
      useUiStore.setState({ activeMode: 'seller' });
      await renderRouter(APP_DIR, { initialUrl: '/account' });
      expect(await screen.findByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: en['seller.mode.switch_to_seller'] })).not.toBeOnTheScreen();
      expect(screen.queryByText(/Seller Companion|Courier|Developer diagnostics/)).not.toBeOnTheScreen();
      await quiet();
      expectNoSellerTraffic();
    }));

  it('leaves the gate to Buyer Home with Switch to Buyer, and the Buyer tabs keep working', () =>
    asRelease(async () => {
      await renderRouter(APP_DIR, { initialUrl: '/seller/messages' });
      await fireEvent.press(await screen.findByRole('button', { name: en['seller.mode.switch_to_buyer'] }));
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      expect(screen).toHavePathname('/home/for-you');
      expect(useUiStore.getState().activeMode).toBe('buyer');
      expectNoSellerTraffic();
    }));

  it.each(HIDDEN_ROUTES)('%s lands on Buyer Home even when the server also says Courier is available', (path) =>
    asRelease(async () => {
      installAccount({ seller: false, courier: true });
      await renderRouter(APP_DIR, { initialUrl: path });
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      expect(screen).toHavePathname('/home/for-you');
      expect(screen.queryByText(/foundation ready|Developer diagnostics/)).not.toBeOnTheScreen();
      expect(useUiStore.getState().activeMode).toBe('buyer');
      // Nothing was asked of any API for the hidden screen, whatever its path would be called.
      await quiet();
      expect(unexpectedCalls()).toEqual([]);
    }),
  );

  it.each(HIDDEN_ROUTES)('%s arriving as a link into a running app lands on Buyer Home too', (path) =>
    asRelease(async () => {
      await renderRouter(APP_DIR, { initialUrl: '/account' });
      expect(await screen.findByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
      await quiet();
      const before = api.calls.length;
      await open(path);
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      expect(screen).toHavePathname('/home/for-you');
      expect(screen.queryByText(/foundation ready|Developer diagnostics/)).not.toBeOnTheScreen();
      await quiet();
      expect(unexpectedCalls(before)).toEqual([]);
    }),
  );
});

describe('a signed-in Buyer with Seller access, on a release build', () => {
  beforeEach(() => {
    signedIn();
    installAccount({ seller: true, courier: true });
  });

  it('still reaches the nested Seller routes, every request scoped to its store, and never Courier or diagnostics', () =>
    asRelease(async () => {
      await renderRouter(APP_DIR, { initialUrl: '/seller/messages' });
      expect(await screen.findByText(en['seller.messages.note'])).toBeOnTheScreen();
      await open('/seller/notifications');
      await waitFor(() => expect(api.callsTo('GET /v1/notifications').length).toBeGreaterThan(0));

      expect(useUiStore.getState().activeMode).toBe('seller');
      // The list asks which stores there are; every other Seller read names the one store it was read for.
      const scoped = api.calls.filter((c) => sellerScoped(c) || (c.path.startsWith('/v1/seller') && c.path !== '/v1/seller/list'));
      expect(scoped.length).toBeGreaterThan(0);
      for (const call of scoped) expect(call.headers['X-Adulis-Seller']).toBe(STORE.id);

      await quiet();
      const before = api.calls.length;
      await open('/courier');
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      await open('/dev');
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      expect(screen.queryByText(/foundation ready|Developer diagnostics/)).not.toBeOnTheScreen();
      await quiet();
      expect(unexpectedCalls(before)).toEqual([]);
    }));

  it('shows Switch to Seller on You, and no Courier control', () =>
    asRelease(async () => {
      await renderRouter(APP_DIR, { initialUrl: '/account' });
      expect(await screen.findByRole('button', { name: en['seller.mode.switch_to_seller'] })).toBeOnTheScreen();
      expect(screen.queryByText(/Courier|Developer diagnostics/)).not.toBeOnTheScreen();
    }));
});

describe('a link that asks sign-in to return somewhere else', () => {
  it.each(['/seller', '/seller/orders', '/courier', '/dev', '/account/delete', `/chat/${REF}`, 'https://evil.example'])(
    'returnTo=%s sends a signed-in Buyer to You, never there',
    (target) =>
      asRelease(async () => {
        signedIn();
        installAccount({ seller: true });
        await renderRouter(APP_DIR, { initialUrl: `/auth/sign-in?returnTo=${encodeURIComponent(target)}` });
        expect(await screen.findByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
        expect(screen).toHavePathname('/account');
        await quiet();
        expectNoSellerTraffic();
        expect(api.calls.filter((c) => c.path.startsWith('/v1/conversations'))).toEqual([]);
      }),
  );

  it('an unsafe returnTo on Verify is dropped for a signed-in Buyer as well', () =>
    asRelease(async () => {
      signedIn();
      installAccount({ seller: true });
      await renderRouter(APP_DIR, { initialUrl: `/auth/verify?phone=${encodeURIComponent(PHONE)}&returnTo=%2Fseller` });
      expect(await screen.findByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
      expect(screen).toHavePathname('/account');
      expectNoSellerTraffic();
    }));
});

/** On the sign-in screen: the phone, then Send code. Leaves the code entry open. */
async function requestCode() {
  await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), PHONE);
  await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
  await screen.findByLabelText(en['auth.code.label']);
}

/** On the code entry: the code, then Verify. */
async function enterCode() {
  await fireEvent.changeText(screen.getByLabelText(en['auth.code.label']), SIGN_IN_CODE);
  await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
}

describe('a guest who signs in from a link that names a return destination', () => {
  // A destination that is not allow-listed ends on You; an allow-listed one is followed. The Seller,
  // Courier, diagnostics, Delete Account and conversation routes the links name are never opened.
  const CASES = [
    ['/seller', '/account'],
    ['/seller/orders', '/account'],
    ['/courier', '/account'],
    ['/dev', '/account'],
    ['/account/delete', '/account'],
    [`/chat/${REF}`, '/account'],
    ['https://evil.example', '/account'],
    ['/saved', '/saved'],
    ['/orders', '/orders'],
  ] as const;
  const landing = (lands: (typeof CASES)[number][1]) =>
    lands === '/saved'
      ? screen.findByText(en['buyer.saved.private'])
      : lands === '/orders'
        ? screen.findByText(en['buyer.orders.coming'])
        : screen.findByRole('button', { name: en['common.signOut'] });

  it.each(CASES)('returnTo=%s ends on %s, with no Seller or conversation request', (target, lands) =>
    asRelease(async () => {
      installAccount({ seller: true, courier: true });
      await renderRouter(APP_DIR, { initialUrl: `/auth/sign-in?returnTo=${encodeURIComponent(target)}` });
      await requestCode();
      // The code screen is handed the checked destination, never the link's own value.
      expect(screen).toHaveSearchParams({ phone: PHONE, returnTo: lands });
      await enterCode();
      expect(await landing(lands)).toBeOnTheScreen();
      expect(screen).toHavePathname(lands);
      await quiet();
      expectNoSellerTraffic();
      expect(api.calls.filter((c) => c.path.startsWith('/v1/conversations'))).toEqual([]);
    }),
  );

  it('a link that rewrites the destination of the open code screen is checked again when sign-in finishes', () =>
    asRelease(async () => {
      installAccount({ seller: true });
      await renderRouter(APP_DIR, { initialUrl: '/auth/sign-in' });
      await requestCode();
      await act(() => router.setParams({ returnTo: '/seller/orders' }));
      expect(screen).toHaveSearchParams({ phone: PHONE, returnTo: '/seller/orders' });
      await enterCode();
      expect(await screen.findByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
      expect(screen).toHavePathname('/account');
      await quiet();
      expectNoSellerTraffic();
    }));
});

const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });

const CONVERSATION_ID = 'c0000000-0000-4000-8000-000000000001';
const SELLER_ID = '0b6f1a3e-9999-4999-8999-999999999999';
const TIMES = { created_at: '2026-11-11T08:00:00.000000Z', updated_at: '2026-11-11T08:00:00.000000Z' };

/**
 * Two Accounts that share one device, one after the other. Each has its own named Collection and
 * conversation; the first may hold a store. A bearer the server does not know is a dead session.
 */
function installTwoAccounts({ firstHasStore = false, secondHasStore = false }: { firstHasStore?: boolean; secondHasStore?: boolean } = {}) {
  const accounts: Record<string, { collection: string; store: string; seller: boolean; sellerStore: typeof STORE }> = {
    [A]: { collection: 'Only A', store: 'First Account store', seller: firstHasStore, sellerStore: STORE },
    [B]: { collection: 'Only B', store: 'Second Account store', seller: secondHasStore, sellerStore: STORE_B },
  };
  const dead = { value: false };
  const mine = (call: Recorded) => (dead.value ? undefined : accounts[call.headers.Authorization ?? '']);
  const refuse = (call: Recorded): Reply | null => (call.headers.Authorization && !mine(call) ? problem(401, 'SESSION_REVOKED', 'auth') : null);
  const asAccount = (read: (account: (typeof accounts)[string], call: Recorded) => Reply) => (call: Recorded) => {
    const account = mine(call);
    if (account) return read(account, call);
    return refuse(call) ?? problem(401, 'SESSION_EXPIRED', 'auth');
  };
  api.on('GET /v1/bootstrap', (call) => {
    if (!call.headers.Authorization) return ok(bootstrapBody());
    const account = mine(call);
    if (!account) return problem(401, 'SESSION_REVOKED', 'auth');
    return ok(bootstrapBody({ account_context: { ...SIGNED_IN_CONTEXT, seller_companion: { available: account.seller } } }));
  });
  api.on(
    'GET /v1/collections',
    asAccount((account) =>
      ok({
        default_collection_ref: '0c000000-0000-4000-8000-000000000001',
        data: [
          { ref: '0c000000-0000-4000-8000-000000000001', kind: 'DEFAULT', name: null, product_count: 0, scene_count: 0, ...TIMES },
          { ref: '0c000000-0000-4000-8000-000000000002', kind: 'USER_CREATED', name: account.collection, product_count: 0, scene_count: 0, ...TIMES },
        ],
        next_cursor: null,
      }),
    ),
  );
  api.on('GET /v1/collections/saves', asAccount(() => ok({ data: [], next_cursor: null })));
  api.on(
    'GET /v1/conversations',
    // Like the server: a store the Account does not hold is a 404.
    asAccount((account, call) =>
      call.query.as === 'seller' && call.headers['X-Adulis-Seller'] !== account.sellerStore.id ? problem(404, 'NOT_FOUND', 'request') : ok({
        data: [{ id: CONVERSATION_ID, seller_id: SELLER_ID, store_name: account.store, handle: 'seller-1', started_at: '2026-11-11T08:00:00.000Z', last_message_at: '2026-11-11T09:00:00.000Z' }],
        next_cursor: null,
      }),
    ),
  );
  api.on('GET /v1/seller/list', asAccount((account) => (account.seller ? ok({ data: [account.sellerStore] }) : problem(403, 'PERMISSION_DENIED', 'auth'))));
  api.on('GET /v1/notifications', asAccount(() => ok({ data: [], next_cursor: null })));
  api.on('POST /v1/auth/otp/verify', (call) =>
    call.body?.code === SIGN_IN_CODE
      ? ok({ account_id: '0b6f1a3e-3333-4333-8333-333333333333', audience: 'MOBILE', roles: [], expires_at: '2026-12-09T12:00:00.000Z', token: OTHER_TOKEN })
      : problem(401, 'OTP_INVALID', 'auth'),
  );
  return {
    /** The server ends the first Account's session (revoked elsewhere): every authenticated call is refused. */
    endSessions: () => {
      dead.value = true;
    },
  };
}

/** From a guest prompt: Sign in, the second Account's phone and code. Returns to where the prompt came from. */
async function signInAsSecondAccount() {
  await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
  await requestCode();
  await enterCode();
}

/** The requests made after the one that signed the first Account out. */
function afterSignOut() {
  const at = api.calls.findIndex((c) => c.path === '/v1/auth/logout');
  expect(at).toBeGreaterThanOrEqual(0);
  return api.calls.slice(at + 1);
}

describe('signing out', () => {
  it('turns the tabs and the Messages list opened earlier into their guest state, and Back reveals nothing of the Account through them', () =>
    asRelease(async () => {
      signedIn();
      installTwoAccounts();
      await renderRouter(APP_DIR, { initialUrl: '/saved' });
      expect(await screen.findByText('Only A')).toBeOnTheScreen();
      await fireEvent.press(bottomTab(en['buyer.tab.you']));
      await fireEvent.press(await screen.findByRole('button', { name: en['buyer.messages'] }));
      expect(await screen.findByRole('button', { name: 'First Account store' })).toBeOnTheScreen();
      // Another link to You while Messages is open: Messages stays in the stack beneath it.
      await open('/account');
      await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
      expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
      expect(memory.has(TOKEN_KEY)).toBe(false);
      // Back from a tab goes to Home first, then pops the second You, which reveals Messages.
      await act(() => router.back());
      await act(() => router.back());
      expect(await screen.findByText(en['buyer.messages.signed_out'], {}, { timeout: 5000 })).toBeOnTheScreen();
      expect(screen.queryByText('First Account store')).not.toBeOnTheScreen();
      await act(() => router.back());
      await fireEvent.press(bottomTab(en['buyer.tab.saved']));
      expect(await screen.findByText(en['buyer.saved.signed_out'])).toBeOnTheScreen();
      expect(screen.queryByText('Only A')).not.toBeOnTheScreen();
      await fireEvent.press(bottomTab(en['buyer.tab.orders']));
      expect(await screen.findByText(en['buyer.orders.signed_out'])).toBeOnTheScreen();
      await quiet();
      // Nothing was asked for the Account after it left: no bearer, no private read.
      expect(afterSignOut().filter((c) => c.headers.Authorization !== undefined)).toEqual([]);
      expect(afterSignOut().filter((c) => /collections|conversations|notifications|sessions|seller/.test(c.path))).toEqual([]);
    }));

  it('resets a mode and a pending intent left in the UI state', () =>
    asRelease(async () => {
      signedIn();
      installTwoAccounts();
      await renderRouter(APP_DIR, { initialUrl: '/account' });
      expect(await screen.findByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
      await act(async () => {
        useUiStore.setState({
          activeMode: 'seller',
          pendingSave: { nonce: '0b6f1a3e-2222-4222-8222-222222222222', target: { type: 'PRODUCT_POST', ref: REF }, surface: 'PRODUCT_DETAIL', sceneRef: null },
        });
      });
      await fireEvent.press(screen.getByRole('button', { name: en['common.signOut'] }));
      expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
      expect(useUiStore.getState().activeMode).toBeNull();
      expect(useUiStore.getState().pendingSave).toBeNull();
    }));
});

describe('a different Account on the same device', () => {
  it('sees none of the first Account data, and none of its requests carry the first credential', () =>
    asRelease(async () => {
      signedIn();
      installTwoAccounts();
      await renderRouter(APP_DIR, { initialUrl: '/saved' });
      expect(await screen.findByText('Only A')).toBeOnTheScreen();
      await fireEvent.press(bottomTab(en['buyer.tab.you']));
      await fireEvent.press(await screen.findByRole('button', { name: en['buyer.messages'] }));
      expect(await screen.findByRole('button', { name: 'First Account store' })).toBeOnTheScreen();
      await act(() => router.back());
      await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
      expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();

      // The second Account signs in from Saved and lands back on it.
      await fireEvent.press(bottomTab(en['buyer.tab.saved']));
      await signInAsSecondAccount();
      expect(await screen.findByText('Only B')).toBeOnTheScreen();
      expect(screen.queryByText('Only A')).not.toBeOnTheScreen();
      expect(memory.get(TOKEN_KEY)).toBe(OTHER_TOKEN);

      await fireEvent.press(bottomTab(en['buyer.tab.you']));
      await fireEvent.press(await screen.findByRole('button', { name: en['buyer.messages'] }));
      expect(await screen.findByRole('button', { name: 'Second Account store' })).toBeOnTheScreen();
      expect(screen.queryByText('First Account store')).not.toBeOnTheScreen();
      await quiet();

      const later = afterSignOut().filter((c) => c.headers.Authorization !== undefined);
      expect(later.length).toBeGreaterThan(0);
      expect(later.every((c) => c.headers.Authorization === B)).toBe(true);
    }));

  it('an Account without Seller access that signs in after one with a store gets the closed gate and no Seller request', () =>
    asRelease(async () => {
      signedIn();
      installTwoAccounts({ firstHasStore: true });
      await renderRouter(APP_DIR, { initialUrl: '/seller/messages' });
      expect(await screen.findByText(en['seller.messages.note'])).toBeOnTheScreen();
      expect(useUiStore.getState().activeMode).toBe('seller');
      await open('/account');
      await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
      expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
      const sellerBefore = sellerCalls().length;

      await signInAsSecondAccount();
      expect(await screen.findByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
      expect(screen).toHavePathname('/account');
      expect(screen.queryByRole('button', { name: en['seller.mode.switch_to_seller'] })).not.toBeOnTheScreen();
      expect(useUiStore.getState().activeMode).not.toBe('seller');

      await open('/seller/messages');
      expect(await screen.findByText(en['seller.gate.unavailable'])).toBeOnTheScreen();
      await quiet();
      expect(screen.queryByText(en['seller.messages.note'])).not.toBeOnTheScreen();
      expect(screen.queryByText(STORE.store_name)).not.toBeOnTheScreen();
      expect(sellerCalls().length).toBe(sellerBefore);
      expect(afterSignOut().filter(sellerScoped)).toEqual([]);
    }));

  it('an Account with its own store reads only that store: nothing after the switch names the first Account store', () =>
    asRelease(async () => {
      signedIn();
      installTwoAccounts({ firstHasStore: true, secondHasStore: true });
      await renderRouter(APP_DIR, { initialUrl: '/seller/messages' });
      expect(await screen.findByText(en['seller.messages.note'])).toBeOnTheScreen();
      // The first Account really did read its own store, so the check below can see a leak.
      expect(api.calls.some((c) => c.headers['X-Adulis-Seller'] === STORE.id)).toBe(true);
      await open('/account');
      await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
      expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();

      await signInAsSecondAccount();
      expect(await screen.findByRole('button', { name: en['seller.mode.switch_to_seller'] })).toBeOnTheScreen();
      await open('/seller/messages');
      expect(await screen.findByText(en['seller.messages.note'])).toBeOnTheScreen();
      await open('/seller/notifications');
      await quiet();

      const later = afterSignOut();
      expect(later.filter((c) => JSON.stringify([c.path, c.query, c.headers]).includes(STORE.id))).toEqual([]);
      const reads = later.filter((c) => (c.path.startsWith('/v1/seller') && c.path !== '/v1/seller/list') || c.query.as === 'seller');
      expect(reads.length).toBeGreaterThan(0);
      for (const call of reads) expect(call.headers['X-Adulis-Seller']).toBe(STORE_B.id);
      expect(later.filter((c) => c.headers.Authorization !== undefined).every((c) => c.headers.Authorization === B)).toBe(true);
    }));
});

describe('a session the server ended', () => {
  it('resumed from the background: Seller mode is left, the credential is removed, and no Seller data stays', () =>
    asRelease(async () => {
      let listeners: Array<(state: AppStateStatus) => void> = [];
      const spy = jest.spyOn(AppState, 'addEventListener');
      const original = spy.getMockImplementation();
      spy.mockImplementation((type, listener) => {
        if (type === 'change') listeners.push(listener as (state: AppStateStatus) => void);
        return { remove: () => (listeners = listeners.filter((l) => l !== listener)) } as ReturnType<typeof AppState.addEventListener>;
      });
      try {
        signedIn();
        const server = installTwoAccounts({ firstHasStore: true });
        await renderRouter(APP_DIR, { initialUrl: '/seller/messages' });
        expect(await screen.findByText(en['seller.messages.note'])).toBeOnTheScreen();

        // Revoked elsewhere while the app was in the background; it asks again when it returns.
        server.endSessions();
        await act(async () => listeners.forEach((l) => l('background')));
        await act(() => jest.advanceTimersByTimeAsync(6 * 60_000));
        await act(async () => listeners.forEach((l) => l('active')));

        expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
        expect(screen).toHavePathname('/home/for-you');
        expect(memory.has(TOKEN_KEY)).toBe(false);
        expect(screen.queryByText(en['seller.messages.note'])).not.toBeOnTheScreen();
        expect(useUiStore.getState().activeMode).not.toBe('seller');
        const sellerAfter = sellerCalls().length;
        await quiet();
        expect(sellerCalls().length).toBe(sellerAfter);
      } finally {
        if (original) spy.mockImplementation(original);
      }
    }));

  const GUEST_PROMPTS = [
    ['/messages', 'buyer.messages.signed_out'],
    [`/chat/${REF}`, 'buyer.messages.signed_out'],
    ['/notifications', 'buyer.notifications.signed_out'],
    ['/saved', 'buyer.saved.signed_out'],
    ['/account/delete', 'buyer.you.signed_out'],
  ] as const;

  it.each(GUEST_PROMPTS)('a stored credential the server has ended: %s opens the guest state and the dead credential reaches only bootstrap', (path, message) =>
    asRelease(async () => {
      signedIn();
      installTwoAccounts().endSessions();
      await renderRouter(APP_DIR, { initialUrl: path });
      expect(await screen.findByText(en[message])).toBeOnTheScreen();
      await quiet();
      expect(memory.has(TOKEN_KEY)).toBe(false);
      const withDeadCredential = api.calls.filter((c) => c.headers.Authorization === A);
      expect(withDeadCredential.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /v1/bootstrap']);
    }),
  );

  it('a stored credential the server has ended: a Seller link opens Buyer Home and no Seller request is made', () =>
    asRelease(async () => {
      signedIn();
      installTwoAccounts({ firstHasStore: true }).endSessions();
      await renderRouter(APP_DIR, { initialUrl: '/seller/messages' });
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      await quiet();
      expect(sellerCalls()).toEqual([]);
      expect(api.calls.filter((c) => c.headers.Authorization === A).map((c) => c.path)).toEqual(['/v1/bootstrap']);
    }));
});
