import { en } from '@adulis/locale/mobile';
import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import type { FypUnit } from '../api/client';
import { useUiStore } from '../state/ui-store';
import { claimsIn, elementsUnder, overlaysIn, renderedText } from '../testing/discovery-rules';
import {
  bootstrapBody,
  fypPage,
  fypUnit,
  installFakeApi,
  problem,
  publicScene,
  type Reply,
} from '../testing/fake-api';
import { resetSecureStore } from '../testing/secure-store-mock';

/**
 * What the For You feed does when pages repeat or run dry, when the Buyer leaves and comes
 * back, when the network is slow or gone, when a photo fails, and what it will and will not
 * say about a Scene. The real route tree against the fake API; pages are served per cursor.
 * Complements for-you.test.tsx. FlashList draws only the rows near the top under Jest, so a
 * feed whose cards must all be seen is kept short (it then pages itself to the end), and a
 * tall one is driven by Load more and judged by its footer.
 */
const APP_DIR = 'src/app';

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
// FlashList collapses cards that share a key when it draws them, so a Scene listed twice would
// never show in the rendered text: the list's own data is recorded here and judged instead.
jest.mock('@shopify/flash-list', () => {
  const actual = jest.requireActual('@shopify/flash-list');
  const react = jest.requireActual('react');
  const recorded = { data: [] as unknown[] };
  return {
    ...actual,
    recorded,
    FlashList: (props: { data?: readonly unknown[]; testID?: string }) => {
      if (props.testID === 'for-you-list') recorded.data = [...(props.data ?? [])];
      return react.createElement(actual.FlashList, props);
    },
  };
});
jest.setTimeout(60_000);

const FEED = 'GET /v1/fyp';
let api: ReturnType<typeof installFakeApi>;

const ok = (body: unknown): Reply => ({ status: 200, body });
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
/** A reply the test releases when it chooses: a response still in flight. */
const held = () => {
  let release: (reply: Reply) => void = () => undefined;
  const reply = new Promise<Reply>((resolve) => {
    release = resolve;
  });
  return { reply, release: (r: Reply) => act(async () => release(r)) };
};
const feedCalls = () => api.callsTo(FEED);
const queries = () => feedCalls().map((c) => c.query);
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });
const channel = (name: string) => screen.getByRole('tab', { name });
const pullToRefresh = () =>
  act(() => (screen.getByTestId('for-you-list').props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());
const flashList = () => jest.requireMock('@shopify/flash-list') as { recorded: { data: FypUnit[] } };
/** The Scenes the list was given, in order: what it would draw if it drew them all. */
const listed = () => flashList().recorded.data.map((unit) => unit.public_ref);
const refsOf = (...numbers: number[]) => numbers.map((n) => fypUnit(n).public_ref);
const tallRefs = (...extra: number[]) => [...firstPage.map((unit) => unit.public_ref), ...refsOf(...extra)];
/** The Scene cards drawn, in order (the short feeds draw them all). */
const stores = () => screen.queryAllByText(/^Store \d+$/).map((node) => node.props.children as string);
const loadMoreButton = () => screen.getByRole('button', { name: en['buyer.for_you.load_more'] });
const pressLoadMore = async () => {
  await fireEvent.press(loadMoreButton());
  await settle();
};
const retryButton = () => screen.getByRole('button', { name: en['common.retry'] });
/** Taller than FlashList's Jest viewport, so nothing more loads until the Buyer asks. */
const firstPage = Array.from({ length: 20 }, (_, i) => fypUnit(i + 1, { position: i + 1 }));
const nextPage = (...numbers: number[]) => numbers.map((n, i) => fypUnit(n, { position: 21 + i }));
const openTallFeed = async () => {
  const r = await renderRouter(APP_DIR);
  await screen.findByText('Store 1');
  await settle();
  return r;
};

beforeEach(() => {
  flashList().recorded.data = [];
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
});

describe('paging a feed whose pages repeat or run dry', () => {
  it('a short feed pages through a page of repeats and an empty page to the end, listing each Scene once', async () => {
    serveByCursor({
      '': [ok(fypPage([fypUnit(1), fypUnit(2), fypUnit(3)], 'cursor-A'))],
      // Only Scenes already shown, then an empty page that still names a cursor, then one new Scene.
      'cursor-A': [ok(fypPage([fypUnit(2, { position: 4 }), fypUnit(1, { position: 5 })], 'cursor-B'))],
      'cursor-B': [ok(fypPage([], 'cursor-C'))],
      'cursor-C': [ok(fypPage([fypUnit(4, { position: 6 })], null))],
    });
    await renderRouter(APP_DIR);
    expect(await screen.findByText('Store 4')).toBeOnTheScreen();
    await settle();
    expect(listed()).toEqual(refsOf(1, 2, 3, 4));
    expect(stores()).toEqual(['Store 1', 'Store 2', 'Store 3', 'Store 4']);
    expect(screen.getByText(en['buyer.for_you.end'])).toBeOnTheScreen();
    expect(queries()).toEqual([{}, { cursor: 'cursor-A' }, { cursor: 'cursor-B' }, { cursor: 'cursor-C' }]);
  });

  it('a tall feed whose next page adds nothing, or is empty, is not ended by it: Load more stays and follows each cursor', async () => {
    serveByCursor({
      '': [ok(fypPage(firstPage, 'cursor-A'))],
      'cursor-A': [ok(fypPage([fypUnit(1, { position: 21 }), fypUnit(2, { position: 22 })], 'cursor-B'))],
      'cursor-B': [ok(fypPage([], 'cursor-C'))],
      'cursor-C': [ok(fypPage(nextPage(21), null))],
    });
    await openTallFeed();
    for (const cursor of ['cursor-A', 'cursor-B']) {
      await pressLoadMore();
      expect(feedCalls().at(-1)?.query).toEqual({ cursor });
      expect(screen.queryByText(en['buyer.for_you.end'])).not.toBeOnTheScreen();
      expect(loadMoreButton()).toBeEnabled();
      expect(listed()).toEqual(tallRefs());
    }
    await pressLoadMore();
    expect(await screen.findByText(en['buyer.for_you.end'])).toBeOnTheScreen();
    expect(listed()).toEqual(tallRefs(21));
    expect(queries()).toEqual([{}, { cursor: 'cursor-A' }, { cursor: 'cursor-B' }, { cursor: 'cursor-C' }]);
  });

  it('an empty last page ends the feed with the cards kept, no error and no empty-feed message', async () => {
    serveByCursor({
      '': [ok(fypPage(firstPage, 'cursor-A'))],
      'cursor-A': [ok(fypPage([], null))],
    });
    await openTallFeed();
    await pressLoadMore();
    expect(await screen.findByText(en['buyer.for_you.end'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['buyer.for_you.load_more'] })).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.for_you.empty'])).not.toBeOnTheScreen();
    expect(screen.queryByText(new RegExp(en['buyer.for_you.more_failed']))).not.toBeOnTheScreen();
    expect(listed()).toEqual(tallRefs());
    expect(screen.getByText('Store 1')).toBeOnTheScreen();
    await settle();
    expect(queries()).toEqual([{}, { cursor: 'cursor-A' }]);
  });

  it('a retry that fails again keeps the cards and offers Try again on the same cursor, until it works', async () => {
    serveByCursor({
      '': [ok(fypPage(firstPage, 'cursor-A'))],
      'cursor-A': [problem(500, 'INTERNAL', 'request'), problem(500, 'INTERNAL', 'request'), ok(fypPage(nextPage(21), null))],
    });
    await openTallFeed();
    const failed = new RegExp(en['buyer.for_you.more_failed']);
    await pressLoadMore();
    expect(await screen.findByText(failed)).toBeOnTheScreen();
    await fireEvent.press(retryButton());
    await settle();
    // The same failure again: the cards and the way to try again are both still there.
    expect(await screen.findByText(failed)).toBeOnTheScreen();
    expect(listed()).toEqual(tallRefs());
    expect(retryButton()).toBeEnabled();
    await fireEvent.press(retryButton());
    expect(await screen.findByText(en['buyer.for_you.end'])).toBeOnTheScreen();
    expect(listed()).toEqual(tallRefs(21));
    expect(queries()).toEqual([{}, { cursor: 'cursor-A' }, { cursor: 'cursor-A' }, { cursor: 'cursor-A' }]);
  });

  it('a next page the network cannot reach says the Buyer is offline, keeps the cards, and Retry then works', async () => {
    // Connectivity failures are tried three times before the screen gives up.
    serveByCursor({
      '': [ok(fypPage(firstPage, 'cursor-A'))],
      'cursor-A': ['offline', 'offline', 'offline', ok(fypPage(nextPage(21), null))],
    });
    await openTallFeed();
    await fireEvent.press(loadMoreButton());
    expect(
      await screen.findByText(`${en['buyer.for_you.more_failed']} ${en['common.offline']}`, {}, { timeout: 10_000 }),
    ).toBeOnTheScreen();
    expect(listed()).toEqual(tallRefs());
    await fireEvent.press(retryButton());
    expect(await screen.findByText(en['buyer.for_you.end'])).toBeOnTheScreen();
    expect(listed()).toEqual(tallRefs(21));
    expect(queries()).toHaveLength(5);
  });

  it('a next page requested while the device is offline waits, and is asked for once, when the connection returns', async () => {
    serveByCursor({
      '': [ok(fypPage(firstPage, 'cursor-A'))],
      'cursor-A': [ok(fypPage(nextPage(21), null))],
    });
    await openTallFeed();
    try {
      await act(async () => onlineManager.setOnline(false));
      await fireEvent.press(loadMoreButton());
      await settle();
      expect(feedCalls()).toHaveLength(1); // paused, not spent
      expect(screen.queryByText(en['buyer.for_you.end'])).not.toBeOnTheScreen();
      expect(listed()).toEqual(tallRefs());
      await act(async () => onlineManager.setOnline(true));
      expect(await screen.findByText(en['buyer.for_you.end'])).toBeOnTheScreen();
      await settle();
      expect(listed()).toEqual(tallRefs(21));
      expect(queries()).toEqual([{}, { cursor: 'cursor-A' }]);
    } finally {
      await act(async () => onlineManager.setOnline(true));
    }
  });

  it('a refreshed session that serves a Scene the old one had lists it once, and the old session\'s other Scenes are gone', async () => {
    serveByCursor({
      '': [
        ok(fypPage([fypUnit(1), fypUnit(2)], 'cursor-A')),
        ok(fypPage([fypUnit(2, { position: 1 }), fypUnit(3, { position: 2 })], 'cursor-B')),
      ],
      'cursor-A': [ok(fypPage([fypUnit(3, { position: 3 })], null))],
      // The new session repeats Scene 3 itself.
      'cursor-B': [ok(fypPage([fypUnit(3, { position: 3 }), fypUnit(4, { position: 4 })], null))],
    });
    await renderRouter(APP_DIR);
    await screen.findByText('Store 3');
    expect(listed()).toEqual(refsOf(1, 2, 3));
    await pullToRefresh();
    expect(await screen.findByText('Store 4')).toBeOnTheScreen();
    await settle();
    expect(listed()).toEqual(refsOf(2, 3, 4));
    expect(stores()).toEqual(['Store 2', 'Store 3', 'Store 4']);
    expect(queries()).toEqual([{}, { cursor: 'cursor-A' }, {}, { cursor: 'cursor-B' }]);
  });
});

describe('leaving For You and coming back', () => {
  const scenePath = `GET /v1/scene-posts/${fypUnit(1).public_ref}`;

  it('Back from a Scene keeps every page that was loaded and starts no new feed session', async () => {
    serveByCursor({
      '': [ok(fypPage(firstPage, 'cursor-A'))],
      'cursor-A': [ok(fypPage(nextPage(21, 22), null))],
    });
    api.on(scenePath, () => ok(publicScene(1, { caption: 'The Scene, as read' })));
    const r = await openTallFeed();
    await pressLoadMore();
    await screen.findByText(en['buyer.for_you.end']);

    await fireEvent.press(screen.getAllByRole('button', { name: en['buyer.scene.explore'] })[0]!);
    expect(await screen.findByText('The Scene, as read')).toBeOnTheScreen();
    await act(() => router.back());
    await settle();

    // Both pages are still loaded: the end of the second one, not Load more, closes the list.
    expect(await screen.findByText(en['buyer.for_you.end'], {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
    expect(screen.queryByRole('button', { name: en['buyer.for_you.load_more'] })).not.toBeOnTheScreen();
    expect(listed()).toEqual(tallRefs(21, 22));
    expect(screen.getByText('Store 1')).toBeOnTheScreen();
    expect(queries()).toEqual([{}, { cursor: 'cursor-A' }]);
  });

  it('another channel, another tab and back keep the loaded pages and start no new feed session', async () => {
    serveByCursor({
      '': [ok(fypPage(firstPage, 'cursor-A'))],
      'cursor-A': [ok(fypPage(nextPage(21), null))],
    });
    await openTallFeed();
    await pressLoadMore();
    await screen.findByText(en['buyer.for_you.end']);

    await fireEvent.press(channel(en['buyer.home.channel.nearby']));
    expect(await screen.findByText(en['buyer.home.nearby.coming'])).toBeOnTheScreen();
    await fireEvent.press(channel(en['buyer.home.channel.for_you']));
    expect(await screen.findByText(en['buyer.for_you.end'])).toBeOnTheScreen();

    await fireEvent.press(bottomTab(en['buyer.tab.shop']));
    expect(await screen.findByText(en['buyer.shop.order'])).toBeOnTheScreen();
    await fireEvent.press(bottomTab(en['buyer.tab.home']));
    expect(await screen.findByText(en['buyer.for_you.end'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['buyer.for_you.load_more'] })).not.toBeOnTheScreen();
    expect(listed()).toEqual(tallRefs(21));
    expect(screen.getByText('Store 1')).toBeOnTheScreen();
    expect(queries()).toEqual([{}, { cursor: 'cursor-A' }]);
  });
});

describe('a slow or unreachable feed', () => {
  it('a slow first page shows that it is loading, never the empty or an error state, then the Scenes', async () => {
    const first = held();
    api.on(FEED, () => first.reply);
    await renderRouter(APP_DIR);
    await waitFor(() => expect(feedCalls()).toHaveLength(1));
    await settle();
    expect(screen.getByText(en['buyer.for_you.loading'])).toBeOnTheScreen();
    for (const absent of [en['buyer.for_you.empty'], en['common.offline'], en['common.timeout'], en['error.request.internal']]) {
      expect(screen.queryByText(absent)).not.toBeOnTheScreen();
    }
    expect(screen.queryByRole('button', { name: en['common.retry'] })).not.toBeOnTheScreen();
    await first.release(ok(fypPage([fypUnit(1)])));
    expect(await screen.findByText('Store 1')).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.for_you.loading'])).not.toBeOnTheScreen();
  });

  it('a feed that does not answer in time says so with a Retry, never an empty feed, and Retry loads the Scenes', async () => {
    let n = 0;
    api.on(FEED, () => (n++ < 3 ? 'hang' : ok(fypPage([fypUnit(1)]))));
    await renderRouter(APP_DIR);
    // Ten seconds per attempt, three attempts, with a pause between them.
    expect(await screen.findByText(en['common.timeout'], {}, { timeout: 60_000 })).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.for_you.empty'])).not.toBeOnTheScreen();
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
    await fireEvent.press(retryButton());
    expect(await screen.findByText('Store 1')).toBeOnTheScreen();
    expect(screen.queryByText(en['common.timeout'])).not.toBeOnTheScreen();
  });
});

describe('photos', () => {
  it('one failed photo leaves the other cards\' photos alone, and its card still opens the Scene by the picture', async () => {
    api.on('GET /v1/bootstrap', () => ok(bootstrapBody({ media_public_origin: 'https://media.example.test' })));
    api.on(FEED, () => ok(fypPage([fypUnit(1), fypUnit(2)])));
    const r = await renderRouter(APP_DIR);
    await screen.findByText('Store 2');
    const [failing] = await screen.findAllByTestId('scene-photo');
    await fireEvent(failing!, 'error', { nativeEvent: { error: 'decode failed' } });
    expect(await screen.findAllByText(en['buyer.for_you.photo_unavailable'])).toHaveLength(1);
    const remaining = screen.getAllByTestId('scene-photo');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.props.source).toEqual([expect.objectContaining({ uri: 'https://media.example.test/scenes/2/card.webp' })]);
    await fireEvent.press(screen.getAllByTestId('scene-photo-explore')[0]!);
    await settle();
    expect(r.getPathname()).toBe(`/scenes/${fypUnit(1).public_ref}`);
  });

  it('a photo carries no hotspot, marker or overlay, whatever extra fields a tagged Product arrives with', async () => {
    api.on('GET /v1/bootstrap', () => ok(bootstrapBody({ media_public_origin: 'https://media.example.test' })));
    const tagged = fypUnit(1, { products: [{ position: 1, slug: 'a', name: 'Basket', available: true, x: 0.4, y: 0.6 } as never] });
    api.on(FEED, () => ok(fypPage([tagged])));
    await renderRouter(APP_DIR);
    await screen.findByTestId('scene-photo');
    const photoArea = elementsUnder('scene-photo-explore');
    expect(photoArea.length).toBeGreaterThan(1); // the scan reads the area: the pressable and the photo
    expect(overlaysIn(photoArea)).toEqual([]);
  });

  it('with no media origin no photo is drawn and every card says its photo is unavailable', async () => {
    api.on(FEED, () => ok(fypPage([fypUnit(1), fypUnit(2)])));
    await renderRouter(APP_DIR);
    await screen.findByText('Store 2');
    expect(screen.queryAllByTestId('scene-photo')).toHaveLength(0);
    expect(screen.getAllByText(en['buyer.for_you.photo_unavailable'])).toHaveLength(2);
  });
});

describe('only Scenes, and only what the server sent', () => {
  it('a unit of any other type, on any page, is not drawn', async () => {
    const foreign = (type: string | undefined, n: number) => ({ ...fypUnit(n), type }) as unknown as FypUnit;
    serveByCursor({
      '': [ok(fypPage([fypUnit(1), foreign('PRODUCT_POST', 9), foreign('SELLER_VIDEO', 8), foreign(undefined, 7)], 'cursor-A'))],
      'cursor-A': [ok(fypPage([foreign('VIDEO', 6), foreign('', 5), fypUnit(2, { position: 3 })], null))],
    });
    await renderRouter(APP_DIR);
    expect(await screen.findByText('Store 2')).toBeOnTheScreen();
    await settle();
    expect(listed()).toEqual(refsOf(1, 2));
    expect(stores()).toEqual(['Store 1', 'Store 2']);
    for (const n of [5, 6, 7, 8, 9]) expect(screen.queryByText(new RegExp(`Item ${n}`))).not.toBeOnTheScreen();
  });

  it('a card states only what the server sent: no popularity, trust or conversion claim, no engagement or purchase control', async () => {
    api.on(FEED, () =>
      ok(
        fypPage([
          fypUnit(1, {
            products: [
              { position: 1, slug: 'a', name: 'Basket', available: true },
              { position: 2, slug: 'b', name: 'Scarf', available: false },
            ],
          }),
          fypUnit(2),
        ]),
      ),
    );
    await renderRouter(APP_DIR);
    await screen.findByText('Store 2');
    const texts = renderedText(screen.getByTestId('for-you-list'));
    expect(texts.length).toBeGreaterThan(8); // the scan reads the cards
    expect(claimsIn(texts)).toEqual([]);
    for (const action of ['Like', 'Hide', 'Share', 'Follow', 'Add to cart', 'Buy now']) {
      expect(screen.queryByRole('button', { name: action })).not.toBeOnTheScreen();
    }
  });
});

/**
 * Returning from the background with a Scene open (ADU-MOB-02 S185): AppState is driven by
 * hand; renderRouter's fake timers move Date.now(). Development builds use the provisional
 * 5-minute interval.
 */
describe('a Scene that goes private while the app is away', () => {
  let listeners: ((state: AppStateStatus) => void)[] = [];
  const goTo = (state: AppStateStatus) =>
    act(() => {
      for (const listener of [...listeners]) listener(state);
    });
  const away = async (minutes: number) => {
    await goTo('background');
    await act(() => jest.advanceTimersByTimeAsync(minutes * 60_000));
    await goTo('active');
  };
  // The preset mocks AppState.addEventListener: put its own implementation back after.
  let appState: jest.SpyInstance | undefined;
  let original: ((...args: never[]) => unknown) | undefined;
  afterEach(() => {
    if (appState && original) appState.mockImplementation(original);
  });
  beforeEach(() => {
    listeners = [];
    appState = jest.spyOn(AppState, 'addEventListener');
    original = appState.getMockImplementation();
    appState.mockImplementation((type, listener) => {
      if (type === 'change') listeners.push(listener as (state: AppStateStatus) => void);
      return {
        remove: () => {
          listeners = listeners.filter((l) => l !== listener);
        },
      } as ReturnType<typeof AppState.addEventListener>;
    });
  });

  it('the open Explorer says the Scene is not available once the server answers so, and the feed session that replaces the old one no longer lists it', async () => {
    const reads = [ok(publicScene(1, { caption: 'The Scene, as read' })), problem(404, 'NOT_FOUND', 'request')];
    let sceneReads = 0;
    api.on(`GET /v1/scene-posts/${fypUnit(1).public_ref}`, () => reads[Math.min(sceneReads++, 1)]!);
    const sessions = [fypPage([fypUnit(1), fypUnit(2)]), fypPage([fypUnit(2)])];
    let feedReads = 0;
    api.on(FEED, () => ok(sessions[Math.min(feedReads++, 1)]));
    const r = await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    await fireEvent.press(screen.getAllByRole('button', { name: en['buyer.scene.explore'] })[0]!);
    expect(await screen.findByText('The Scene, as read')).toBeOnTheScreen();

    await away(6);
    await settle();
    expect(await screen.findByText(en['buyer.scene.gone'])).toBeOnTheScreen();
    expect(screen.queryByText('The Scene, as read')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: en['buyer.scene.go_back'] }));
    await settle();
    expect(await screen.findByText('Store 2', {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
    expect(listed()).toEqual(refsOf(2));
    expect(stores()).toEqual(['Store 2']);
    // One new feed session, started with no cursor: the old one was not continued.
    expect(queries()).toEqual([{}, {}]);
  });
});
