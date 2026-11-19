import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, installFakeApi } from '../testing/fake-api';
import { notificationRow as row, installInbox } from '../testing/fake-notifications';
import { TOKEN_KEY, memory, resetSecureStore } from '../testing/secure-store-mock';

/**
 * Links into the Buyer app on the real route tree, cold (the app starts on the link) and warm (it reaches a
 * running app): a link to a place the app does not have yet (an Order, a Claim, a checkout) opens Buyer Home
 * and sends nothing; a link to an Account-bound place under a credential the server has already ended shows
 * the guest prompt and sends nothing private; a link to a screen that is already open does not stack it again.
 * Real `adulis://` links from the operating system are not exercised here: these are the router's own paths.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const REF = '0b6f1a3e-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORDER = 'f5b00000-0000-4000-8000-000000000001';
const EXPIRED = 'Expired_credential_for_tests_0123456789abc';

let api: ReturnType<typeof installFakeApi>;
const signedIn = () => resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
const quiet = () => act(() => jest.advanceTimersByTimeAsync(1000));
const open = (path: string) => act(() => router.push(path as never));
const HOME_CALLS = ['GET /v1/bootstrap', 'GET /v1/fyp', 'POST /v1/devices'];
const unexpectedCalls = () =>
  api.calls.map((c) => `${c.method} ${c.path}`).filter((c) => !HOME_CALLS.includes(c));

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({
    activeMode: null,
    themePreference: 'system',
    locale: 'en',
    upgradeNoticeDismissed: false,
    pendingSave: null,
  });
});

afterEach(() => {
  expect(
    api.calls.filter((c) => /cart|order|checkout|payment|reservation|claim/i.test(c.path)),
  ).toEqual([]);
});

// Places the Buyer app does not have: an Order or Claim screen, a checkout, a cart, a Messages or Account path
// that goes deeper than the screens that exist.
const UNAVAILABLE = [
  `/orders/${ORDER}`,
  `/orders/${ORDER}/claim`,
  `/claims/${ORDER}`,
  '/checkout',
  '/cart',
  '/chat',
  `/notifications/${ORDER}`,
  '/account/sessions',
  '/account/settings',
];

describe.each([
  ['a signed-in Buyer', signedIn],
  ['a guest', () => resetSecureStore()],
])('%s following a link to a place the app does not have', (_who, start) => {
  it.each(UNAVAILABLE)(
    '%s opens Buyer Home and sends nothing it should not (cold)',
    async (path) => {
      start();
      await renderRouter(APP_DIR, { initialUrl: path });
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      expect(screen).toHavePathname('/home/for-you');
      await quiet();
      expect(unexpectedCalls()).toEqual([]);
    },
  );

  it.each(UNAVAILABLE)(
    '%s opens Buyer Home and sends nothing it should not (warm)',
    async (path) => {
      start();
      await renderRouter(APP_DIR, { initialUrl: '/home/for-you' });
      await screen.findByText(en['buyer.for_you.empty']);
      await open(path);
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      expect(screen).toHavePathname('/home/for-you');
      await quiet();
      expect(unexpectedCalls().filter((c) => /orders|claims|checkout|cart|chat\b/.test(c))).toEqual(
        [],
      );
    },
  );
});

const PRIVATE_PLACES = [
  ['/notifications', 'buyer.notifications.signed_out'],
  ['/messages', 'buyer.messages.signed_out'],
  [`/chat/${REF}`, 'buyer.messages.signed_out'],
  [`/collections/${REF}`, 'buyer.saved.signed_out'],
  ['/account/delete', 'buyer.you.signed_out'],
  ['/save-to', 'buyer.saved.signed_out'],
] as const;

describe('a link to an Account-bound place under a credential the server has already ended', () => {
  it.each(PRIVATE_PLACES)(
    '%s shows the guest prompt, forgets the credential and asks for nothing private',
    async (path, message) => {
      resetSecureStore({ [TOKEN_KEY]: EXPIRED });
      installInbox(api, {});
      await renderRouter(APP_DIR, { initialUrl: path });
      expect(await screen.findByText(en[message])).toBeOnTheScreen();
      await quiet();
      expect(memory.has(TOKEN_KEY)).toBe(false);
      // The only request that carried the dead credential is the one that found it dead.
      const withCredential = api.calls
        .filter((c) => c.headers.Authorization === `Bearer ${EXPIRED}`)
        .map((c) => `${c.method} ${c.path}`);
      expect(withCredential).toEqual(['GET /v1/bootstrap']);
      expect(
        api.calls.filter((c) =>
          /^\/v1\/(notifications|conversations|collections|auth\/sessions|deletion)/.test(c.path),
        ),
      ).toEqual([]);
    },
  );
});

describe('a link to a screen that is already open', () => {
  it('Notifications and Messages are each opened once, and Back returns to where the Buyer was', async () => {
    signedIn();
    installInbox(api, { [`Bearer ${GOOD_TOKEN}`]: [row(1)] });
    api.on('GET /v1/conversations', () => ({ status: 200, body: { data: [], next_cursor: null } }));
    await renderRouter(APP_DIR, { initialUrl: '/home/for-you' });
    await screen.findByText(en['buyer.for_you.empty']);
    await open('/notifications');
    await open('/notifications');
    await open('/messages');
    await open('/messages');
    await quiet();
    expect(
      screen.queryAllByText(en['buyer.notifications.unread'], { includeHiddenElements: true }),
    ).toHaveLength(1);
    expect(
      screen.queryAllByText(en['buyer.messages.empty'], { includeHiddenElements: true }),
    ).toHaveLength(1);
    await act(() => router.back());
    await act(() => router.back());
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    expect(screen).toHavePathname('/home/for-you');
  });

  it('a double tap on Messages from You opens one Messages screen', async () => {
    signedIn();
    api.on('GET /v1/conversations', () => ({ status: 200, body: { data: [], next_cursor: null } }));
    api.on('GET /v1/auth/sessions', () => ({ status: 200, body: { data: [] } }));
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    const messages = await screen.findAllByRole('button', { name: en['buyer.messages'] });
    await fireEvent.press(messages[0]!);
    await fireEvent.press(messages[0]!);
    await quiet();
    expect(
      screen.queryAllByText(en['buyer.messages.empty'], { includeHiddenElements: true }),
    ).toHaveLength(1);
    await act(() => router.back());
    expect(await screen.findByText(en['buyer.you.signed_in'])).toBeOnTheScreen();
  });

  it('a double tap on Sign in opens one Sign in screen, and Back returns to the prompt', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    const signIn = await screen.findByRole('button', { name: en['auth.sign_in'] });
    await fireEvent.press(signIn);
    await fireEvent.press(signIn);
    await quiet();
    expect(
      screen.queryAllByText(en['auth.sign_in.intro'], { includeHiddenElements: true }),
    ).toHaveLength(1);
    await act(() => router.back());
    expect(await screen.findByText(en['buyer.notifications.signed_out'])).toBeOnTheScreen();
  });
});
