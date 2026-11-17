import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

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
const ORDER = 'f5b00000-0000-4000-8000-000000000001';
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

/** A guest's session may only ever talk to these: registering the install, bootstrap, public Home. */
const GUEST_CALLS = ['GET /v1/bootstrap', 'GET /v1/fyp', 'POST /v1/devices'];
function expectGuestOnly() {
  expect(api.calls.filter((c) => c.headers.Authorization !== undefined)).toEqual([]);
  expect(api.calls.map((c) => `${c.method} ${c.path}`).filter((c) => !GUEST_CALLS.includes(c))).toEqual([]);
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
