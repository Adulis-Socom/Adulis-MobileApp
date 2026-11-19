import { en } from '@adulis/locale/mobile';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, SIGNED_IN_CONTEXT, SIGN_IN_CODE, bootstrapBody, installFakeApi, problem } from '../testing/fake-api';
import { hoursAgo, installInbox, notificationId, notificationPage, notificationRow as row } from '../testing/fake-notifications';
import { TOKEN_B, afterSignOut, asB, naming, open, switchToB } from '../testing/saved-accounts';
import { TOKEN_KEY, memory, resetSecureStore } from '../testing/secure-store-mock';

/**
 * Private notification and Account state when the session changes, on the real route tree: Account switching
 * with a screen kept in the stack, a read still in flight at the switch, a session the server ends, and a
 * deletion flow left open. Two Accounts share one device; the fake server answers each bearer with its own
 * data, so a request made under the wrong credential, or a row of the first Account drawn for the second,
 * shows in the recorded calls and in the whole rendered tree (screens hidden under others included).
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const A = `Bearer ${GOOD_TOKEN}`;
const B = `Bearer ${TOKEN_B}`;
let api: ReturnType<typeof installFakeApi>;
const signedIn = () => resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
const held = () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { gate, release };
};
const readCalls = () => api.calls.filter((c) => c.method === 'POST' && /^\/v1\/notifications\/[^/]+\/read$/.test(c.path));

// The whole rendered tree, screens hidden under others and header titles included: a text query skips those.
type Json = string | { props?: Record<string, unknown>; children?: Json[] | null } | null;
const everything = () => {
  const out: string[] = [];
  const walk = (node: Json | Json[]) => {
    if (node === null) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === 'string') return void out.push(node);
    for (const value of Object.values(node.props ?? {})) if (typeof value === 'string') out.push(value);
    walk(node.children ?? null);
  };
  walk(screen.toJSON() as Json | Json[]);
  return out.join(' | ');
};

// The first Account's rows are old and name an Order; the second Account's are recent and name none, so a row
// of the first drawn for the second shows as its time and its "about one of your orders" line.
const A_TIME = '2025-03-07T10:30:00.000Z';
const A_DATE = new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(A_TIME));
const A_ROWS = () => [1, 2, 3].map((n) => row(n, { id: notificationId(100 + n), scheduled_for: new Date(Date.parse(A_TIME) - n * 60_000).toISOString(), order_id: '0f000000-0000-4000-8000-0000000000a1' }));

function installAccounts(rows: Parameters<typeof installInbox>[1]) {
  api.on('GET /v1/bootstrap', (call) => ({ status: 200, body: bootstrapBody(call.headers.Authorization ? { account_context: SIGNED_IN_CONTEXT } : {}) }));
  api.on('POST /v1/auth/otp/verify', (call) =>
    call.body?.code === SIGN_IN_CODE
      ? { status: 200, body: { account_id: '0b6f1a3e-1111-4111-8111-11111111111b', audience: 'MOBILE', roles: [], expires_at: '2026-12-09T12:00:00.000Z', token: TOKEN_B } }
      : problem(401, 'OTP_INVALID', 'auth'),
  );
  installInbox(api, rows);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

afterEach(() => {
  expect(api.calls.filter((c) => /cart|order|checkout|payment|reservation|push|device-token|expo-token/i.test(c.path))).toEqual([]);
  expect(api.callsTo('POST /v1/notifications/read-all')).toEqual([]);
});

describe('Notifications kept in the stack when the Account changes', () => {
  it('draw nothing of the first Account for the second, and nothing is asked under the first credential again', async () => {
    signedIn();
    installAccounts({ [A]: A_ROWS(), [B]: [row(9, { id: notificationId(900), read_at: hoursAgo(1) })] });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    expect(await screen.findAllByText(en['buyer.notifications.unread'])).toHaveLength(3);
    expect(screen.getAllByText(en['buyer.notifications.about_order'])).toHaveLength(3);
    expect(everything()).toContain(A_DATE);
    await switchToB();
    await open('/notifications');
    expect(await screen.findByText(en['buyer.notifications.read_state'])).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(1000));
    // Nothing of the first Account anywhere in the tree: not its unread rows, its Order line or its times.
    const tree = everything();
    expect(tree).not.toContain(en['buyer.notifications.about_order']);
    expect(tree).not.toContain(A_DATE);
    expect(screen.queryByText(en['buyer.notifications.unread'])).toBeNull();
    // Every request after the sign-out was the second Account's own.
    const after = afterSignOut(api).filter((c) => c.headers.Authorization !== undefined);
    expect(after.filter((c) => c.headers.Authorization === A)).toEqual([]);
    expect(after.filter((c) => naming(notificationId(101))(c))).toEqual([]);
    expect(api.callsTo('GET /v1/notifications').at(-1)?.headers.Authorization).toBe(B);
  });

  it('a read still in flight at the switch changes nothing for the second Account, even for a row with the same id', async () => {
    signedIn();
    const shared = notificationId(500);
    installAccounts({ [A]: [row(1, { id: shared })], [B]: [row(1, { id: shared })] });
    const { gate, release } = held();
    api.onPattern('POST', /^\/v1\/notifications\/[^/]+\/read$/, async (call) => {
      expect(call.headers.Authorization).toBe(A);
      await gate;
      return { status: 200, body: { read_at: new Date().toISOString() } };
    });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.notifications.mark_read'] }));
    await waitFor(() => expect(readCalls()).toHaveLength(1));
    await switchToB();
    await open('/notifications');
    expect(await screen.findByRole('button', { name: en['buyer.notifications.mark_read'] })).toBeOnTheScreen();
    // The first Account's answer lands now.
    await act(async () => release());
    await act(() => jest.advanceTimersByTimeAsync(2000));
    expect(screen.getByText(en['buyer.notifications.unread'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.notifications.read_state'])).toBeNull();
    expect(readCalls()).toHaveLength(1);
    expect(api.calls.filter((c) => asB(c) && c.method === 'POST' && c.path.includes('/notifications/'))).toEqual([]);
  });
});

describe('a session the server ends while the inbox is open', () => {
  it('ending it on a Mark as read leaves no row on screen and a guest prompt', async () => {
    signedIn();
    installInbox(api, { [A]: [row(1), row(2)] });
    api.onPattern('POST', /^\/v1\/notifications\/[^/]+\/read$/, () => problem(401, 'SESSION_EXPIRED', 'auth'));
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await fireEvent.press((await screen.findAllByRole('button', { name: en['buyer.notifications.mark_read'] }))[0]!);
    expect(await screen.findByText(en['buyer.notifications.signed_out'])).toBeOnTheScreen();
    expect(everything()).not.toContain(en['buyer.notifications.unread']);
    expect(memory.has(TOKEN_KEY)).toBe(false);
  });

  it('a revoked session on a refresh leaves no row on screen and a guest prompt', async () => {
    signedIn();
    installInbox(api, { [A]: [row(1)] });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await screen.findByText(en['buyer.notifications.unread']);
    api.on('GET /v1/notifications', () => problem(401, 'SESSION_REVOKED', 'auth'));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.notifications.refresh'] }));
    expect(await screen.findByText(en['buyer.notifications.signed_out'])).toBeOnTheScreen();
    expect(everything()).not.toContain(en['buyer.notifications.unread']);
    expect(memory.has(TOKEN_KEY)).toBe(false);
  });

  it('signing out leaves nothing of the inbox in the tree, including the screen kept under You', async () => {
    signedIn();
    installInbox(api, { [A]: A_ROWS() });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await screen.findAllByText(en['buyer.notifications.unread']);
    await open('/account');
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    const tree = everything();
    expect(tree).not.toContain(en['buyer.notifications.unread']);
    expect(tree).not.toContain(en['buyer.notifications.about_order']);
    expect(tree).not.toContain(A_DATE);
  });
});

describe('Delete Account left open when the Account changes', () => {
  it('asks for nothing under the second Account and leaves for You when it is shown again', async () => {
    signedIn();
    installAccounts({ [A]: [], [B]: [] });
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.you.delete'] }));
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.delete.continue'] }));
    expect(await screen.findByText(en['buyer.delete.phone_intro'])).toBeOnTheScreen();
    await switchToB();
    await open('/account/delete');
    await act(() => jest.advanceTimersByTimeAsync(1000));
    expect(everything()).not.toContain(en['buyer.delete.phone_intro']);
    expect(screen.queryByText(en['buyer.delete.intro'])).toBeNull();
    expect(screen).toHavePathname('/account');
    expect(api.calls.filter((c) => c.path.startsWith('/v1/deletion/'))).toEqual([]);
  });
});

describe('notifications of a page that lands late', () => {
  it('an inbox page for the first Account that lands after the second Account signed in is never drawn', async () => {
    signedIn();
    installAccounts({ [A]: A_ROWS(), [B]: [row(9, { id: notificationId(900), read_at: hoursAgo(1) })] });
    const { gate, release } = held();
    api.on('GET /v1/notifications', async (call) => {
      if (call.headers.Authorization === A) {
        await gate;
        return notificationPage(A_ROWS());
      }
      return notificationPage([row(9, { id: notificationId(900), read_at: hoursAgo(1) })]);
    });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await waitFor(() => expect(api.callsTo('GET /v1/notifications')).toHaveLength(1));
    await switchToB();
    await open('/notifications');
    await screen.findByText(en['buyer.notifications.read_state']);
    await act(async () => release());
    await act(() => jest.advanceTimersByTimeAsync(2000));
    expect(everything()).not.toContain(en['buyer.notifications.about_order']);
    expect(screen.queryByText(en['buyer.notifications.unread'])).toBeNull();
  });
});
