import { en } from '@adulis/locale/mobile';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, installFakeApi, type Reply } from '../testing/fake-api';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * The You tab's Account, Preferences and Security sections on the real route tree: what each control does
 * with the server (preferences are device settings and call nothing; Security shows what the server says
 * about the Account's sessions and keeps Sign out reachable whatever it says).
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

let api: ReturnType<typeof installFakeApi>;
const signedIn = () => resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
const sessionCalls = () => api.callsTo('GET /v1/auth/sessions');
const session = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  audience: 'MOBILE',
  first_seen_at: '2026-11-10T09:00:00.000Z',
  last_activity_at: '2026-11-12T08:30:00.000Z',
  approx_location: null,
  expires_at: '2026-12-10T09:00:00.000Z',
  device_platform: 'ANDROID',
  remembered_label: null,
  remembered_device_id: null,
  remembered: false,
  current: false,
  ...overrides,
});
const CURRENT = session('5e000000-0000-4000-8000-00000000000a', { current: true });
const OTHER = session('5e000000-0000-4000-8000-00000000000b', {
  audience: 'CONSOLE',
  device_platform: 'WEB',
});
const list = (data: unknown): Reply => ({ status: 200, body: { data } });

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
  expect(api.calls.filter((c) => /cart|order|checkout|payment|reservation/i.test(c.path))).toEqual(
    [],
  );
});

describe('Preferences are device settings', () => {
  it('Appearance and Language send nothing to the server, signed in or not', async () => {
    signedIn();
    api.on('GET /v1/auth/sessions', () => list([CURRENT]));
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await screen.findByText(en['buyer.you.session.current']);
    const before = api.calls.length;
    await fireEvent.press(screen.getByRole('radio', { name: en['buyer.you.appearance.dark'] }));
    await fireEvent.press(screen.getByRole('radio', { name: en['buyer.you.appearance.system'] }));
    await fireEvent.press(screen.getByRole('radio', { name: en['buyer.you.language.am'] }));
    expect(useUiStore.getState().locale).toBe('am');
    expect(api.calls.slice(before)).toEqual([]);
    // No preference endpoint exists for a Buyer: nothing on the screen reads or writes one.
    expect(api.calls.filter((c) => /preference|settings/i.test(c.path))).toEqual([]);
  });
});

describe('Signed-in sessions', () => {
  it('a session the server sent with an unreadable time is left out, and the rest of You and Sign out still work', async () => {
    signedIn();
    api.on('GET /v1/auth/sessions', () =>
      list([
        CURRENT,
        session('5e000000-0000-4000-8000-00000000000c', { last_activity_at: 'yesterday' }),
        null,
      ]),
    );
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    expect(await screen.findByText(en['buyer.you.session.current'])).toBeOnTheScreen();
    expect(screen.getAllByText(/^Last active /)).toHaveLength(1);
    expect(screen.getByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['buyer.you.delete'] })).toBeOnTheScreen();
  });

  it('a session whose optional place is absent or not text is kept, without a place', async () => {
    signedIn();
    const { approx_location: _omitted, ...noPlace } = CURRENT;
    api.on('GET /v1/auth/sessions', () =>
      list([
        noPlace,
        session('5e000000-0000-4000-8000-00000000000d', {
          approx_location: 42,
          device_platform: 'IOS',
        }),
      ]),
    );
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    // This device and the other session both show; neither says "No signed-in sessions were found."
    expect(await screen.findByText(en['buyer.you.session.current'])).toBeOnTheScreen();
    expect(screen.getAllByText(/^Last active /)).toHaveLength(2);
    expect(screen.getByText(en['buyer.you.session.platform.ios'])).toBeOnTheScreen();
    expect(screen.queryByText(/^Approximate location: /)).toBeNull();
    expect(screen.queryByText(en['buyer.you.sessions.empty'])).toBeNull();
  });

  it('only the boolean true marks This device', async () => {
    signedIn();
    api.on('GET /v1/auth/sessions', () =>
      list([
        CURRENT,
        session('5e000000-0000-4000-8000-00000000000e', {
          current: 'false',
          device_platform: 'IOS',
        }),
      ]),
    );
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await screen.findByText(en['buyer.you.session.platform.ios']);
    expect(screen.getAllByText(en['buyer.you.session.current'])).toHaveLength(1);
  });

  it('an answer whose every row is unreadable is a failed read, not an empty list', async () => {
    signedIn();
    api.on('GET /v1/auth/sessions', () =>
      list([
        session('5e000000-0000-4000-8000-00000000000f', {
          first_seen_at: 'never',
          last_activity_at: 'never',
        }),
      ]),
    );
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    expect(await screen.findByText(en['buyer.you.sessions.failed'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.you.sessions.empty'])).toBeNull();
    expect(screen.getByRole('button', { name: en['common.retry'] })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
  });

  it('a list the server sent empty is the empty list', async () => {
    signedIn();
    api.on('GET /v1/auth/sessions', () => list([]));
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    expect(await screen.findByText(en['buyer.you.sessions.empty'])).toBeOnTheScreen();
  });

  it('an answer that is not a list of sessions is a failed read, and Sign out is still there', async () => {
    signedIn();
    api.on('GET /v1/auth/sessions', () => list('none'));
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    expect(await screen.findByText(en['buyer.you.sessions.failed'])).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
  });

  it('a Refresh that fails says so and keeps the sessions it has', async () => {
    signedIn();
    let reply: Reply = list([CURRENT, OTHER]);
    api.on('GET /v1/auth/sessions', () => reply);
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await screen.findByText(en['buyer.you.session.surface.console']);
    reply = 'offline';
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.you.sessions.refresh'] }));
    expect(
      await screen.findByText(en['buyer.you.sessions.failed'], {}, { timeout: 10_000 }),
    ).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.you.session.surface.console'])).toBeOnTheScreen();
    expect(sessionCalls().length).toBeGreaterThan(1);
    // Try again reads them once more and the failure goes.
    reply = list([CURRENT]);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.you.sessions.refresh'] }));
    await waitFor(() => expect(screen.queryByText(en['buyer.you.sessions.failed'])).toBeNull());
    expect(screen.queryByText(en['buyer.you.session.surface.console'])).toBeNull();
    expect(screen.getByText(en['buyer.you.session.current'])).toBeOnTheScreen();
  });
});
