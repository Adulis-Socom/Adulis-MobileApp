import { en } from '@adulis/locale/mobile';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Platform } from 'react-native';

import { useUiStore } from '../state/ui-store';
import {
  GOOD_TOKEN,
  bootstrapBody,
  fypPage,
  fypUnit,
  installFakeApi,
  problem,
  type Reply,
} from '../testing/fake-api';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * WO-004A: Buyer Home's For You on the real route tree, against the fake API that speaks
 * the generated /v1/fyp contract. FlashList's Jest setup gives it a 900dp viewport and
 * 100dp rows, so a short feed reaches its end at once and the screen asks for the next
 * page by itself - the behaviour of a real phone whose cards do not fill the screen.
 * Pages are therefore served per cursor, not in call order.
 */
const APP_DIR = 'src/app';

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const FEED = 'GET /v1/fyp';
let api: ReturnType<typeof installFakeApi>;

/** Serve these replies in order; the last one repeats. */
function serve(...replies: Reply[]) {
  let i = 0;
  api.on(FEED, () => replies[Math.min(i++, replies.length - 1)]!);
}
/** Serve by cursor ('' = a new session); each cursor's replies in order, the last repeating. */
function serveByCursor(routes: Record<string, Reply[]>) {
  const seen: Record<string, number> = {};
  api.on(FEED, (call) => {
    const cursor = call.query.cursor ?? '';
    const replies = routes[cursor] ?? [problem(400, 'VALIDATION_FAILED', 'request', { reason: 'CURSOR_INVALID' })];
    const i = seen[cursor] ?? 0;
    seen[cursor] = i + 1;
    return replies[Math.min(i, replies.length - 1)]!;
  });
}
const ok = (body: unknown): Reply => ({ status: 200, body });
const feedCalls = () => api.callsTo(FEED);
// FlashList's Animated scroll view does not mount its RefreshControl under Jest; the
// element the list host received is the screen's own, so pull it.
const pullToRefresh = () =>
  act(() => (screen.getByTestId('for-you-list').props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());
/** Let any request the screen would make on its own happen (renderRouter runs fake timers), then count. */
const settledCalls = async () => {
  await act(() => jest.advanceTimersByTimeAsync(1000));
  return feedCalls();
};
const tab = (name: string) => screen.getByRole('tab', { name });
const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
});

describe('For You feed', () => {
  it('replaces the placeholder with real Scenes for a guest, sending no subject of its own', async () => {
    serve(ok(fypPage([fypUnit(1), fypUnit(2)])));
    await renderRouter(APP_DIR);
    expect(await screen.findByText('Store 1')).toBeOnTheScreen();
    expect(screen.getByText('Scene caption 1')).toBeOnTheScreen();
    expect(screen.getByText('Store 2')).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.home.for_you.coming'])).not.toBeOnTheScreen();

    const [first] = feedCalls();
    expect(first?.query).toEqual({});
    expect(first?.headers.Authorization).toBeUndefined();
    expect(first?.headers['X-Adulis-Device']).toMatch(/^[0-9a-f-]{36}$/);
    // The end of a feed with no next_cursor says so.
    expect(screen.getByText(en['buyer.for_you.end'])).toBeOnTheScreen();
  });

  it('draws Scene units only, each once, and no engagement control', async () => {
    const foreign = { ...fypUnit(9), type: 'PRODUCT_POST' };
    serve(ok({ ...fypPage([fypUnit(1), fypUnit(2)]), items: [fypUnit(1), foreign, fypUnit(2), fypUnit(1)] }));
    await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    expect(screen.getAllByText(/^Store \d$/).map((n) => n.props.children)).toEqual(['Store 1', 'Store 2']);
    expect(screen.queryByText('Store 9')).not.toBeOnTheScreen();
    for (const action of ['Like', 'Save', 'Share', 'Follow', 'Report', 'Not interested', 'Hide', 'Explore the Scene', 'Reviews', 'More options']) {
      expect(screen.queryByRole('button', { name: action })).not.toBeOnTheScreen();
    }
  });

  it('reads each card as one stop: Seller, caption, tags with availability in words', async () => {
    serve(
      ok(
        fypPage([
          fypUnit(1, {
            products: [
              { position: 1, slug: 'a', name: 'Basket', available: true },
              { position: 2, slug: 'b', name: 'Scarf', available: false },
              { position: 3, slug: 'c', name: 'Jebena', available: true },
              { position: 4, slug: 'd', name: 'Lantern', available: true },
            ],
          }),
        ]),
      ),
    );
    await renderRouter(APP_DIR);
    expect(await screen.findByText(`Scarf (${en['buyer.for_you.product_unavailable']})`)).toBeOnTheScreen();
    expect(screen.getByText('+1 more')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Scene by Store 1. Scene caption 1. Photo unavailable. Tagged Products: Basket, Scarf (Currently unavailable), Jebena, Lantern',
      ),
    ).toBeOnTheScreen();
  });

  it('shows the photo from the bootstrap media origin, and a labelled fallback when it fails', async () => {
    api.on('GET /v1/bootstrap', () => ok(bootstrapBody({ media_public_origin: 'https://media.example.test' })));
    serve(ok(fypPage([fypUnit(1)])));
    await renderRouter(APP_DIR);
    const photo = await screen.findByTestId('scene-photo');
    expect(photo.props.source).toEqual([expect.objectContaining({ uri: 'https://media.example.test/scenes/1/card.webp' })]);
    expect(screen.queryByText(en['buyer.for_you.photo_unavailable'])).not.toBeOnTheScreen();
    await fireEvent(photo, 'error', { nativeEvent: { error: 'decode failed' } });
    expect(await screen.findByText(en['buyer.for_you.photo_unavailable'])).toBeOnTheScreen();
    expect(screen.queryByTestId('scene-photo')).not.toBeOnTheScreen();
  });

  it('says so when the feed is empty, and Refresh asks again for a new session', async () => {
    await renderRouter(APP_DIR);
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    serve(ok(fypPage([fypUnit(5)])));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.for_you.refresh'] }));
    expect(await screen.findByText('Store 5')).toBeOnTheScreen();
    expect(feedCalls().map((c) => c.query)).toEqual([{}, {}]);
  });

  it('shows a server failure as a message and a retry, never content', async () => {
    serve(problem(500, 'INTERNAL', 'request'), ok(fypPage([fypUnit(1)])));
    await renderRouter(APP_DIR);
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText('Store 1')).toBeOnTheScreen();
  });

  it('tells an offline Buyer they are offline', async () => {
    serve('offline');
    await renderRouter(APP_DIR);
    // Connectivity failures retry twice on their own before the screen gives up.
    expect(await screen.findByText(en['common.offline'], {}, { timeout: 10_000 })).toBeOnTheScreen();
  });

  it('pages only through next_cursor, one request per page, without duplicate cards', async () => {
    serveByCursor({
      '': [ok(fypPage([fypUnit(1), fypUnit(2)], 'cursor-A'))],
      'cursor-A': [ok(fypPage([fypUnit(2, { position: 3 }), fypUnit(3)], null))],
    });
    await renderRouter(APP_DIR);
    expect(await screen.findByText('Store 3')).toBeOnTheScreen();
    expect(screen.getAllByText('Store 2')).toHaveLength(1);
    expect(screen.getByText(en['buyer.for_you.end'])).toBeOnTheScreen();
    // Past the end, the list reaching its end again asks nothing.
    expect((await settledCalls()).map((c) => c.query)).toEqual([{}, { cursor: 'cursor-A' }]);
  });

  it('keeps the cards when a next page fails, never retries it unasked, and retries on request', async () => {
    serveByCursor({
      '': [ok(fypPage([fypUnit(1)], 'cursor-A'))],
      'cursor-A': [problem(500, 'INTERNAL', 'request'), ok(fypPage([fypUnit(2)]))],
    });
    await renderRouter(APP_DIR);
    expect(await screen.findByText(new RegExp(en['buyer.for_you.more_failed']))).toBeOnTheScreen();
    expect(screen.getByText('Store 1')).toBeOnTheScreen();
    expect(await settledCalls()).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText('Store 2')).toBeOnTheScreen();
    expect(feedCalls().map((c) => c.query)).toEqual([{}, { cursor: 'cursor-A' }, { cursor: 'cursor-A' }]);
  });

  it('drops the ended session\'s cards and offers a fresh feed when the server ends it', async () => {
    serveByCursor({
      '': [ok(fypPage([fypUnit(1)], 'cursor-A')), ok(fypPage([fypUnit(7)]))],
      'cursor-A': [problem(400, 'VALIDATION_FAILED', 'request', { path: 'cursor', reason: 'CURSOR_EXPIRED' })],
    });
    await renderRouter(APP_DIR);
    expect(await screen.findByText(en['buyer.for_you.session_ended'])).toBeOnTheScreen();
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.for_you.refresh'] }));
    expect(await screen.findByText('Store 7')).toBeOnTheScreen();
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
    expect((await settledCalls()).map((c) => c.query)).toEqual([{}, { cursor: 'cursor-A' }, {}]);
  });

  it('pull-to-refresh starts a new session and continues only the new one', async () => {
    serveByCursor({
      '': [ok(fypPage([fypUnit(1)], 'old-cursor', 'session-old')), ok(fypPage([fypUnit(4)], 'new-cursor', 'session-new'))],
      'old-cursor': [ok(fypPage([fypUnit(2)]))],
      'new-cursor': [ok(fypPage([fypUnit(5)]))],
    });
    await renderRouter(APP_DIR);
    await screen.findByText('Store 2');
    await pullToRefresh();
    expect(await screen.findByText('Store 5')).toBeOnTheScreen();
    expect(screen.getByText('Store 4')).toBeOnTheScreen();
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
    expect(screen.queryByText('Store 2')).not.toBeOnTheScreen();
    expect((await settledCalls()).map((c) => c.query)).toEqual([{}, { cursor: 'old-cursor' }, {}, { cursor: 'new-cursor' }]);
  });

  it('a refresh that fails never falls back to the old session', async () => {
    serve(ok(fypPage([fypUnit(1)])), problem(500, 'INTERNAL', 'request'), ok(fypPage([fypUnit(2)])));
    await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    await pullToRefresh();
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText('Store 2')).toBeOnTheScreen();
    expect(feedCalls().map((c) => c.query)).toEqual([{}, {}, {}]);
  });

  it('is the Account feed when signed in, and a new guest session after sign-out', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    api.on(FEED, (call) =>
      ok(fypPage([call.headers.Authorization ? fypUnit(1, { seller: { handle: 'a', store_name: 'Account pick' } }) : fypUnit(2)])),
    );
    await renderRouter(APP_DIR);
    expect(await screen.findByText('Account pick')).toBeOnTheScreen();
    expect(feedCalls().at(-1)?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);

    await fireEvent.press(bottomTab(en['buyer.tab.you']));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    await fireEvent.press(bottomTab(en['buyer.tab.home']));
    expect(await screen.findByText('Store 2')).toBeOnTheScreen();
    const last = feedCalls().at(-1);
    expect(last?.headers.Authorization).toBeUndefined();
    expect(last?.query).toEqual({});
  });

  it('leaves the other four channels as honest placeholders that never read the feed', async () => {
    serve(ok(fypPage([fypUnit(1)])));
    await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    for (const [label, coming] of [
      ['buyer.home.channel.following', 'buyer.home.following.coming'],
      ['buyer.home.channel.nearby', 'buyer.home.nearby.coming'],
      ['buyer.home.channel.discounts', 'buyer.home.discounts.coming'],
      ['buyer.home.channel.locally_made', 'buyer.home.locally_made.coming'],
    ] as const) {
      await fireEvent.press(tab(en[label]));
      expect(await screen.findByText(en[coming])).toBeOnTheScreen();
    }
    await waitFor(() => expect(feedCalls()).toHaveLength(1));
  });
});
