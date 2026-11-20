import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, installFakeApi, type Reply } from '../testing/fake-api';
import {
  installInbox,
  notificationPage,
  notificationRow as row,
} from '../testing/fake-notifications';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';
import { productionSources, repoFile } from '../testing/source-scan';

/**
 * The Buyer inbox's navigation and its states on the real route tree. The inbox informs and opens nothing:
 * the API names no destination (a template, slots and at most an Order that has no Buyer screen yet), so no
 * row may be a link, and nothing a row carries may steer the app anywhere. The inbox also keeps what the
 * server last said: a refresh that was already on its way never undoes a read, and a failed refresh or older
 * page says so instead of leaving the list as if nothing had been asked.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const MINE = `Bearer ${GOOD_TOKEN}`;
let api: ReturnType<typeof installFakeApi>;
const signedIn = () => resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
const held = () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { gate, release };
};
const inboxCalls = () => api.callsTo('GET /v1/notifications');
const markButtons = () =>
  screen.queryAllByRole('button', { name: en['buyer.notifications.mark_read'] });

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
  // A notification never reaches commerce, a Seller, or a push registration.
  expect(
    api.calls.filter((c) =>
      /cart|order|checkout|payment|reservation|push|device-token|expo-token/i.test(c.path),
    ),
  ).toEqual([]);
  expect(api.callsTo('POST /v1/notifications/read-all')).toEqual([]);
});

describe('a row opens nothing', () => {
  const TRAPS = {
    order: { order_id: '0f000000-0000-4000-8000-000000000001' },
    conversation: { slots: { conversation_id: 'c0000000-0000-4000-8000-000000000001' } },
    product: {
      slots: {
        product_handle: 'some-store',
        product_slug: 'a-product',
        url: 'adulis://product/some-store/a-product',
      },
    },
    scene: {
      slots: { scene_ref: 'scene-ref-000000000001', href: '/scenes/scene-ref-000000000001' },
    },
    foreign: { slots: { destination: 'https://evil.example/open', route: '/seller/orders' } },
  } as const;

  it.each(Object.entries(TRAPS))(
    'pressing a row that carries %s data goes nowhere and asks for nothing',
    async (_name, overrides) => {
      signedIn();
      installInbox(api, {
        [MINE]: [row(1, { template_key: 'SOME_FUTURE_TEMPLATE', ...overrides })],
      });
      const r = await renderRouter(APP_DIR, { initialUrl: '/notifications' });
      const sentence = await screen.findByText(en['buyer.notifications.generic']);
      const before = api.calls.length;
      await fireEvent.press(sentence);
      await fireEvent.press(screen.getByText(en['buyer.notifications.unread']));
      await act(() => jest.advanceTimersByTimeAsync(1000));
      expect(r.getPathname()).toBe('/notifications');
      expect(api.calls.length).toBe(before);
      // The only controls are Refresh and Mark as read: nothing on a row is a link.
      const labels = screen
        .getAllByRole('button')
        .map((b) => b.props.accessibilityLabel as string | undefined);
      expect(
        labels.filter(
          (l) =>
            l !== en['buyer.notifications.mark_read'] &&
            l !== en['buyer.notifications.refresh'] &&
            l !== en['buyer.tab.home'],
        ),
      ).toEqual([]);
      expect(screen.queryByText(/evil\.example|some-store|scene-ref/)).toBeNull();
    },
  );

  it('a double tap on the bell opens one Notifications screen, and Back returns to Home', async () => {
    signedIn();
    installInbox(api, { [MINE]: [row(1)] });
    const r = await renderRouter(APP_DIR, { initialUrl: '/home/for-you' });
    await screen.findByText(en['buyer.for_you.empty']);
    const bell = screen.getByRole('button', { name: en['buyer.notifications'] });
    await fireEvent.press(bell);
    await fireEvent.press(bell);
    expect(await screen.findByText(en['buyer.notifications.unread'])).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(1000));
    // Counting covered screens too: a second inbox would sit, hidden, under the first.
    expect(
      screen.queryAllByText(en['buyer.notifications.unread'], { includeHiddenElements: true }),
    ).toHaveLength(1);
    await act(() => router.back());
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
  });

  it('a link to Notifications that reaches the running inbox does not stack a second one', async () => {
    signedIn();
    installInbox(api, { [MINE]: [row(1)] });
    const r = await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await screen.findByText(en['buyer.notifications.unread']);
    await act(() => router.push('/notifications' as never));
    await act(() => router.push('/notifications' as never));
    await act(() => jest.advanceTimersByTimeAsync(1000));
    expect(
      screen.queryAllByText(en['buyer.notifications.unread'], { includeHiddenElements: true }),
    ).toHaveLength(1);
    await act(() => router.back());
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
  });
});

describe('the inbox keeps what the server last said', () => {
  const rows30 = Array.from({ length: 30 }, (_, i) => row(i + 1));

  it('a refresh that was already on its way never undoes a read', async () => {
    signedIn();
    const rows = [row(1)];
    installInbox(api, { [MINE]: rows });
    const { gate, release } = held();
    let gets = 0;
    api.on('GET /v1/notifications', async () => {
      gets += 1;
      // What the server held when this read was asked, whatever happens before the answer arrives.
      const snapshot = rows.map((r) => ({ ...r }));
      if (gets === 2) await gate;
      return notificationPage(snapshot);
    });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await screen.findByText(en['buyer.notifications.unread']);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.notifications.refresh'] }));
    await waitFor(() => expect(inboxCalls()).toHaveLength(2));
    await fireEvent.press(
      screen.getByRole('button', { name: en['buyer.notifications.mark_read'] }),
    );
    expect(await screen.findByText(en['buyer.notifications.read_state'])).toBeOnTheScreen();
    // The refresh's answer was cut before the read: it lands late.
    await act(async () => release());
    await act(() => jest.advanceTimersByTimeAsync(2000));
    expect(screen.getByText(en['buyer.notifications.read_state'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.notifications.unread'])).toBeNull();
    expect(markButtons()).toHaveLength(0);
  });

  it('a failed refresh says so and keeps the rows', async () => {
    signedIn();
    let reply: Reply = notificationPage([row(1)]);
    api.on('GET /v1/notifications', () => reply);
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await screen.findByText(en['buyer.notifications.unread']);
    reply = 'offline';
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.notifications.refresh'] }));
    expect(
      await screen.findByText(
        new RegExp(en['buyer.notifications.failed']),
        {},
        { timeout: 10_000 },
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.notifications.unread'])).toBeOnTheScreen();
  });

  it('an older page that cannot be loaded says so, keeps the rows, and Try again loads it', async () => {
    signedIn();
    const first = rows30.slice(0, 25);
    let older: Reply = 'offline';
    api.on('GET /v1/notifications', (call) =>
      call.query.cursor ? older : notificationPage(first, first[24]!.scheduled_for),
    );
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await fireEvent.press(
      await screen.findByRole('button', { name: en['buyer.notifications.load_older'] }),
    );
    expect(
      await screen.findByText(new RegExp(en['buyer.list.more_failed']), {}, { timeout: 10_000 }),
    ).toBeOnTheScreen();
    expect(markButtons().length).toBeGreaterThan(0);
    older = notificationPage(rows30.slice(25));
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText(en['buyer.list.end'])).toBeOnTheScreen();
    expect(screen.queryByText(new RegExp(en['buyer.list.more_failed']))).toBeNull();
  });
});

describe('a failure the Buyer has not seen resolved stays on screen', () => {
  const failed = new RegExp(en['buyer.notifications.failed']);

  it('an empty inbox whose refresh fails says so once', async () => {
    signedIn();
    let reply: Reply = notificationPage([]);
    api.on('GET /v1/notifications', () => reply);
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await screen.findByText(en['buyer.notifications.empty']);
    reply = 'offline';
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.notifications.refresh'] }));
    expect(await screen.findByText(failed, {}, { timeout: 10_000 })).toBeOnTheScreen();
    expect(screen.getAllByText(failed)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: en['common.retry'] })).toHaveLength(1);
  });

  it('a read of another notification does not clear a failed refresh, and a good refresh does', async () => {
    signedIn();
    const rows = [row(1), row(2)];
    installInbox(api, { [MINE]: rows });
    let reply: Reply | null = null;
    const server = () => notificationPage(rows.map((r) => ({ ...r })));
    api.on('GET /v1/notifications', () => reply ?? server());
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await screen.findAllByText(en['buyer.notifications.unread']);
    reply = 'offline';
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.notifications.refresh'] }));
    expect(await screen.findByText(failed, {}, { timeout: 10_000 })).toBeOnTheScreen();
    await fireEvent.press(
      screen.getAllByRole('button', { name: en['buyer.notifications.mark_read'] })[0]!,
    );
    expect(await screen.findByText(en['buyer.notifications.read_state'])).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(1000));
    // The refresh has still not succeeded: its failure is still said.
    expect(screen.getByText(failed)).toBeOnTheScreen();
    reply = null;
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.notifications.refresh'] }));
    await waitFor(() => expect(screen.queryByText(failed)).toBeNull());
    expect(screen.getAllByText(en['buyer.notifications.unread'])).toHaveLength(1);
  });

  it('a read does not clear a failed older page: Try again is still offered', async () => {
    signedIn();
    const all = Array.from({ length: 30 }, (_, i) => row(i + 1));
    installInbox(api, { [MINE]: all });
    let older: Reply | null = 'offline';
    api.on('GET /v1/notifications', (call) => {
      if (!call.query.cursor)
        return notificationPage(
          all.slice(0, 25).map((r) => ({ ...r })),
          all[24]!.scheduled_for,
        );
      return older ?? notificationPage(all.slice(25).map((r) => ({ ...r })));
    });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await fireEvent.press(
      await screen.findByRole('button', { name: en['buyer.notifications.load_older'] }),
    );
    expect(
      await screen.findByText(new RegExp(en['buyer.list.more_failed']), {}, { timeout: 10_000 }),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getAllByRole('button', { name: en['buyer.notifications.mark_read'] })[0]!,
    );
    await screen.findByText(en['buyer.notifications.read_state']);
    await act(() => jest.advanceTimersByTimeAsync(1000));
    expect(screen.getByText(new RegExp(en['buyer.list.more_failed']))).toBeOnTheScreen();
    older = null;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText(en['buyer.list.end'])).toBeOnTheScreen();
  });

  // The limit, pinned: a Load older that is on its way when a read lands is cancelled (its page was cut from the
  // rows before the read and would draw them Unread again), so the Buyer asks again. The read is kept, nothing is
  // drawn twice, and the footer offers Load older again.
  it('a Load older already on its way when a read lands is asked for again by the Buyer, and the read is kept', async () => {
    signedIn();
    const all = Array.from({ length: 30 }, (_, i) => row(i + 1));
    installInbox(api, { [MINE]: all });
    const { gate, release } = held();
    let olderCalls = 0;
    api.on('GET /v1/notifications', async (call) => {
      if (!call.query.cursor)
        return notificationPage(
          all.slice(0, 25).map((r) => ({ ...r })),
          all[24]!.scheduled_for,
        );
      olderCalls += 1;
      const page = all.slice(25).map((r) => ({ ...r }));
      if (olderCalls === 1) await gate;
      return notificationPage(page);
    });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await fireEvent.press(
      await screen.findByRole('button', { name: en['buyer.notifications.load_older'] }),
    );
    await waitFor(() => expect(olderCalls).toBe(1));
    await fireEvent.press(
      screen.getAllByRole('button', { name: en['buyer.notifications.mark_read'] })[0]!,
    );
    expect(await screen.findByText(en['buyer.notifications.read_state'])).toBeOnTheScreen();
    await act(async () => release());
    await act(() => jest.advanceTimersByTimeAsync(2000));
    expect(screen.getAllByText(en['buyer.notifications.read_state'])).toHaveLength(1);
    await fireEvent.press(
      await screen.findByRole('button', { name: en['buyer.notifications.load_older'] }),
    );
    expect(await screen.findByText(en['buyer.list.end'])).toBeOnTheScreen();
    expect(screen.getAllByText(en['buyer.notifications.read_state'])).toHaveLength(1);
  });
});

describe('push notifications are not part of the Buyer app yet', () => {
  it('no source asks for a notification permission or reads, sends or registers a push token, and no push module is bundled', () => {
    const files = productionSources(
      'api',
      'app',
      'auth',
      'buyer',
      'components',
      'device',
      'modes',
      'providers',
      'seller',
      'state',
      'storage',
    );
    expect(files.length).toBeGreaterThan(80);
    const push =
      /expo-notifications|requestPermissionsAsync|POST_NOTIFICATIONS|getExpoPushTokenAsync|getDevicePushTokenAsync|push_token|notification_permission|\/v1\/devices\/\{id\}/;
    expect(files.filter(({ text }) => push.test(text)).map(({ file }) => file)).toEqual([]);
    expect(repoFile('apps/mobile/package.json')).not.toMatch(/expo-notifications/);
    expect(repoFile('apps/mobile/app.json')).not.toMatch(/expo-notifications|POST_NOTIFICATIONS/);
  });
});

describe('the contract names no destination for a notification', () => {
  it('a notification has the fields the inbox reads and no route, resource or link, so a row cannot be a destination', () => {
    const spec = JSON.parse(repoFile('contracts/openapi.json')) as {
      components: { schemas: Record<string, { properties?: Record<string, unknown> }> };
    };
    const fields = Object.keys(spec.components.schemas['NotificationDto']?.properties ?? {}).sort();
    // A new field here (a typed destination, a resource reference) needs the navigation design and its review first.
    expect(fields).toEqual([
      'id',
      'locale',
      'order_id',
      'read_at',
      'scheduled_for',
      'slots',
      'suppressible',
      'template_key',
    ]);
  });
});
