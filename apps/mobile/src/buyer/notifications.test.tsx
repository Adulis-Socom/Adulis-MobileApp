import { en } from '@adulis/locale/mobile';
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
 * WO-012: the Buyer notification inbox on the real route tree. Numbers are the work order's
 * section 21 matrix (1-20); 19 and 20 (Dark, enlarged text) are native.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const OTHER_TOKEN = 'Other_credential_for_tests_0123456789abcdef';
const UUID7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let api: ReturnType<typeof installFakeApi>;
const signedIn = (token = GOOD_TOKEN) => resetSecureStore({ [TOKEN_KEY]: token });
const held = () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { gate, release };
};

const id = (n: number) => `0e000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const row = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: id(n),
  template_key: 'ORDER_AWAITING_PAYMENT_MORNING',
  locale: 'en',
  slots: {},
  order_id: null,
  suppressible: true,
  scheduled_for: hoursAgo(n),
  read_at: null as string | null,
  ...overrides,
});
const page = (data: unknown[], next_cursor: string | null = null): Reply => ({ status: 200, body: { data, next_cursor } });
const inboxCalls = () => api.callsTo('GET /v1/notifications');
const readCalls = () => api.calls.filter((c) => c.method === 'POST' && /^\/v1\/notifications\/[^/]+\/read$/.test(c.path));
const markButtons = () => screen.queryAllByRole('button', { name: en['buyer.notifications.mark_read'] });

/** A stateful inbox per bearer: GOOD_TOKEN's rows, OTHER_TOKEN's rows; reads set read_at once. */
function installInbox(rows: { [bearer: string]: ReturnType<typeof row>[] }) {
  api.on('GET /v1/notifications', (call: Recorded) => {
    const mine = rows[call.headers.Authorization ?? ''];
    if (!mine) return problem(401, 'SESSION_EXPIRED', 'auth');
    if (call.query.as !== 'buyer') return problem(400, 'SCOPE_PARAMETER_REQUIRED', 'request');
    const start = call.query.cursor ? mine.findIndex((r) => r.scheduled_for < call.query.cursor!) : 0;
    const slice = start < 0 ? [] : mine.slice(start, start + 25);
    const more = start >= 0 && start + 25 < mine.length;
    return page(slice, more ? slice[slice.length - 1]!.scheduled_for : null);
  });
  api.onPattern('POST', /^\/v1\/notifications\/[^/]+\/read$/, (call) => {
    const mine = rows[call.headers.Authorization ?? ''] ?? [];
    const target = mine.find((r) => call.path === `/v1/notifications/${r.id}/read`);
    if (!target) return problem(404, 'NOT_FOUND', 'request');
    target.read_at ??= new Date().toISOString();
    return { status: 200, body: { read_at: target.read_at } };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

afterEach(() => {
  // No commerce from a notification, ever.
  expect(api.calls.filter((c) => /cart|order|checkout|payment|reservation/i.test(c.path))).toEqual([]);
  // 18: the Account-wide read-all is never called from the Buyer inbox.
  expect(api.callsTo('POST /v1/notifications/read-all')).toEqual([]);
  // Push is out of scope: nothing registers a push token.
  expect(api.calls.filter((c) => /push|device-token|expo-token/i.test(c.path))).toEqual([]);
});

describe('the Buyer inbox', () => {
  it('1. a guest sees why it needs an Account and nothing is read', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    expect(await screen.findByText(en['buyer.notifications.signed_out'])).toBeOnTheScreen();
    expect(inboxCalls()).toEqual([]);
  });

  it('2, 4, 7. signed in: the Buyer-scoped inbox, Unread and Read in words, Recent and Older', async () => {
    signedIn();
    installInbox({ [`Bearer ${GOOD_TOKEN}`]: [row(1), row(2, { read_at: hoursAgo(1) }), row(24 * 10)] });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    expect(await screen.findByText(en['buyer.notifications.recent'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.notifications.older'])).toBeOnTheScreen();
    expect(screen.getAllByText(en['buyer.notifications.unread'])).toHaveLength(2);
    expect(screen.getAllByText(en['buyer.notifications.read_state'])).toHaveLength(1);
    expect(markButtons()).toHaveLength(2);
    const [first] = inboxCalls();
    expect(first?.query.as).toBe('buyer');
    expect(first?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
  });

  it('3. an empty inbox says so', async () => {
    signedIn();
    installInbox({ [`Bearer ${GOOD_TOKEN}`]: [] });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    expect(await screen.findByText(en['buyer.notifications.empty'])).toBeOnTheScreen();
  });

  it('5, 15, 17. a template without approved copy shows the generic sentence: no raw key, no link', async () => {
    signedIn();
    installInbox({
      [`Bearer ${GOOD_TOKEN}`]: [
        row(1, { template_key: 'SOME_FUTURE_TEMPLATE', slots: { url: 'https://evil.example/x', name: 'Ab' } }),
      ],
    });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    expect(await screen.findByText(en['buyer.notifications.generic'])).toBeOnTheScreen();
    expect(screen.queryByText(/SOME_FUTURE_TEMPLATE/)).toBeNull();
    expect(screen.queryByText(/evil\.example/)).toBeNull();
    // The only actions are Refresh and Mark as read: no row opens a destination.
    const buttons = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string | undefined);
    expect(buttons.filter((l) => l !== en['buyer.notifications.mark_read'] && l !== en['buyer.notifications.refresh'] && l !== en['buyer.tab.home'])).toEqual([]);
  });

  it('16. an Order-linked row says so and opens nothing; a malformed row is not shown', async () => {
    signedIn();
    installInbox({
      [`Bearer ${GOOD_TOKEN}`]: [
        row(1, { order_id: '0f000000-0000-4000-8000-000000000001' }),
        row(2, { id: 'not-a-uuid' }) as never,
        row(3, { scheduled_for: 'yesterday' }) as never,
      ],
    });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    expect(await screen.findByText(en['buyer.notifications.about_order'])).toBeOnTheScreen();
    expect(screen.getAllByText(en['buyer.notifications.generic'])).toHaveLength(1);
  });

  it('6. Load older appends the next page once, without duplicates', async () => {
    signedIn();
    const rows = Array.from({ length: 30 }, (_, i) => row(i + 1));
    installInbox({ [`Bearer ${GOOD_TOKEN}`]: rows });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await screen.findAllByText(en['buyer.notifications.unread']);
    expect(inboxCalls()).toHaveLength(1);
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.notifications.load_older'] }));
    await waitFor(() => expect(inboxCalls()).toHaveLength(2));
    expect(inboxCalls()[1]?.query.cursor).toBe(rows[24]!.scheduled_for);
    expect(await screen.findByText(en['buyer.list.end'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['buyer.notifications.load_older'] })).toBeNull();
  });

  it('8, 9. Mark as read sends one keyed request and shows the server\'s read state', async () => {
    signedIn();
    const { gate, release } = held();
    installInbox({ [`Bearer ${GOOD_TOKEN}`]: [row(1)] });
    const realRead = jest.fn();
    api.onPattern('POST', /^\/v1\/notifications\/[^/]+\/read$/, async () => {
      realRead();
      await gate;
      return { status: 200, body: { read_at: new Date().toISOString() } };
    });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.notifications.mark_read'] }));
    // A second press while the first is in flight sends nothing.
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.notifications.mark_read'] }));
    expect(realRead).toHaveBeenCalledTimes(1);
    await act(async () => release());
    expect(await screen.findByText(en['buyer.notifications.read_state'])).toBeOnTheScreen();
    expect(markButtons()).toHaveLength(0);
    expect(readCalls()[0]?.path).toBe(`/v1/notifications/${id(1)}/read`);
    expect(readCalls()[0]?.headers['Idempotency-Key']).toMatch(UUID7);
  });

  it('9, 14. a read lost offline is retried under the same key; a failure says so', async () => {
    signedIn();
    installInbox({ [`Bearer ${GOOD_TOKEN}`]: [row(1)] });
    let first = true;
    api.onPattern('POST', /^\/v1\/notifications\/[^/]+\/read$/, () => {
      if (first) {
        first = false;
        return 'offline';
      }
      return { status: 200, body: { read_at: new Date().toISOString() } };
    });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.notifications.mark_read'] }));
    expect(await screen.findByText(en['buyer.notifications.mark_read_failed'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.notifications.mark_read'] }));
    expect(await screen.findByText(en['buyer.notifications.read_state'])).toBeOnTheScreen();
    const keys = readCalls().map((c) => c.headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('14. an inbox that cannot load says so, and Try again recovers', async () => {
    signedIn();
    let reply: Reply = 'offline';
    api.on('GET /v1/notifications', () => reply);
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    expect(await screen.findByText(en['buyer.notifications.failed'], {}, { timeout: 10_000 })).toBeOnTheScreen();
    reply = page([row(1)]);
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText(en['buyer.notifications.unread'])).toBeOnTheScreen();
  });

  it('11. a session the server ended returns the screen to the guest prompt', async () => {
    signedIn('Expired_credential_for_tests_0123456789abc');
    api.on('GET /v1/bootstrap', () => ({ status: 200, body: bootstrapBody() }));
    installInbox({});
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    expect(await screen.findByText(en['buyer.notifications.signed_out'])).toBeOnTheScreen();
    expect(memory.has(TOKEN_KEY)).toBe(false);
  });

  it('13. an inbox page that lands after sign-out is never shown', async () => {
    signedIn();
    const { gate, release } = held();
    installInbox({ [`Bearer ${GOOD_TOKEN}`]: [row(1)] });
    api.on('GET /v1/notifications', async () => {
      await gate;
      return page([row(1)]);
    });
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    await act(async () => release());
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    expect(await screen.findByText(en['buyer.notifications.signed_out'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.notifications.unread'])).toBeNull();
  });

  it('10, 12. another Account signing in sees only its own notifications', async () => {
    signedIn();
    api.on('GET /v1/bootstrap', (call) =>
      call.headers.Authorization ? { status: 200, body: bootstrapBody({ account_context: SIGNED_IN_CONTEXT }) } : { status: 200, body: bootstrapBody() },
    );
    api.on('POST /v1/auth/otp/verify', (call) =>
      call.body?.code === SIGN_IN_CODE
        ? { status: 200, body: { account_id: '0b6f1a3e-3333-4333-8333-333333333333', audience: 'MOBILE', roles: [], expires_at: '2026-12-09T12:00:00.000Z', token: OTHER_TOKEN } }
        : problem(401, 'OTP_INVALID', 'auth'),
    );
    installInbox({
      [`Bearer ${GOOD_TOKEN}`]: [row(1), row(2), row(3)],
      [`Bearer ${OTHER_TOKEN}`]: [row(9, { read_at: hoursAgo(1) })],
    });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    expect(await screen.findAllByText(en['buyer.notifications.unread'])).toHaveLength(3);
    // Sign out (from You) and sign in as the other Account, returning to Notifications.
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), '+251911000002');
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), SIGN_IN_CODE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
    expect(await screen.findByText(en['buyer.notifications.read_state'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.notifications.unread'])).toBeNull();
    expect(inboxCalls().at(-1)?.headers.Authorization).toBe(`Bearer ${OTHER_TOKEN}`);
  });

  it('10. a notification the server does not find for this Account fails safely', async () => {
    signedIn();
    installInbox({ [`Bearer ${GOOD_TOKEN}`]: [row(1)] });
    api.onPattern('POST', /^\/v1\/notifications\/[^/]+\/read$/, () => problem(404, 'NOT_FOUND', 'request'));
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.notifications.mark_read'] }));
    expect(await screen.findByText(en['buyer.notifications.mark_read_failed'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.notifications.unread'])).toBeOnTheScreen();
  });
});
