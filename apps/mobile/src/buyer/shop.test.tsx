import { en } from '@adulis/locale/mobile';
import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { useUiStore } from '../state/ui-store';
import {
  GOOD_TOKEN,
  bootstrapBody,
  installFakeApi,
  problem,
  sellerScene,
  shopProduct,
  storefront,
  storefrontProduct,
  type Reply,
} from '../testing/fake-api';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * WO-007: the Buyer Shop tab -- real Market-wide Product browsing from GET /v1/shop/products, on
 * the real route tree against the fake API speaking the generated contract.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const SHOP = 'GET /v1/shop/products';
let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
function serve(route: string, ...replies: Reply[]) {
  let i = 0;
  api.on(route, () => replies[Math.min(i++, replies.length - 1)]!);
}
const calls = (route: string) => api.callsTo(route);
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });
const openShop = async () => {
  const r = await renderRouter(APP_DIR, { initialUrl: '/shop' });
  expect(await screen.findByText(en['buyer.shop.order'])).toBeOnTheScreen();
  return r;
};

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
});

describe('the Shop tab', () => {
  it('lists real Products of the Market with the honest order label, price span, availability and Seller', async () => {
    serve(
      SHOP,
      ok({
        market_resolved: true,
        data: [
          shopProduct('basket', 'Basket', 'seller-1', { price_min_minor: 90000, price_max_minor: 120000 }),
          shopProduct('scarf', 'Scarf', 'seller-2', { available: false, price_min_minor: null, price_max_minor: null, price_currency: null }),
        ],
        next_cursor: null,
      }),
    );
    api.on('GET /v1/bootstrap', () => ok(bootstrapBody({ media_public_origin: 'https://media.example.test' })));
    await openShop();
    expect(screen.getByRole('header', { name: en['buyer.tab.shop'] })).toBeOnTheScreen();
    expect(await screen.findByLabelText(/^Basket, ETB\s900\.00 – ETB\s1,200\.00, Available$/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Scarf, Currently unavailable')).toBeOnTheScreen();
    // The Seller line says what it is in words (ON-048): no underline, which recycled cells dropped.
    // Its visible words are its accessible name (label in name); the hint says where it goes.
    const sellerLink = screen.getByRole('link', { name: 'Sold by Store seller-2' });
    expect(sellerLink.props.accessibilityHint).toBe('View Store seller-2');
    expect(JSON.stringify(screen.getByText('Sold by Store seller-2').props.style)).not.toContain('underline');
    expect(screen.getByText(en['buyer.list.end'])).toBeOnTheScreen();
    // The card derivative (as on the Seller Profile), never the full image.
    expect(screen.getAllByTestId('product-photo')[0]?.props.source).toEqual([
      expect.objectContaining({ uri: 'https://media.example.test/products/basket/card.webp' }),
    ]);
    // No fake category, filter or sort control, and no query the Buyer did not choose.
    expect(calls(SHOP)[0]?.query).toEqual({ limit: '30' });
    for (const control of ['Fashion', 'Cosmetics', 'Electronics', 'Sort', 'Filter', 'Add to cart']) {
      expect(screen.queryByText(control)).not.toBeOnTheScreen();
    }
  });

  it('pages by the server cursor and says when it has everything', async () => {
    serve(
      SHOP,
      ok({ market_resolved: true, data: [shopProduct('a', 'Item A')], next_cursor: 'page-2' }),
      ok({ market_resolved: true, data: [shopProduct('b', 'Item B'), shopProduct('a', 'Item A')], next_cursor: null }),
    );
    await openShop();
    await screen.findByLabelText(/^Item A,/);
    await act(() => (screen.getByTestId('shop-products').props as { onEndReached: () => void }).onEndReached());
    expect(await screen.findByLabelText(/^Item B,/)).toBeOnTheScreen();
    // A repeat across a page boundary shows once.
    expect(screen.getAllByLabelText(/^Item A,/)).toHaveLength(1);
    expect(calls(SHOP).map((c) => c.query['cursor'])).toEqual([undefined, 'page-2']);
    expect(await screen.findByText(en['buyer.list.end'])).toBeOnTheScreen();
  });

  it('a Product opens the Product; its Seller line opens the Seller Profile; Back keeps the Shop as it was', async () => {
    serve(SHOP, ok({ market_resolved: true, data: [shopProduct('basket', 'Basket', 'seller-1')], next_cursor: null }));
    serve('GET /v1/storefronts/seller-1/products/basket', ok(storefrontProduct('basket', 'Basket')));
    serve('GET /v1/storefronts/seller-1', ok(storefront('seller-1')));
    serve('GET /v1/storefronts/seller-1/scenes', ok({ data: [sellerScene(1)], next_cursor: null }));
    const r = await openShop();
    await fireEvent.press(await screen.findByLabelText(/^Basket,/));
    expect(await screen.findByText('About Basket')).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/product/seller-1/basket');
    await act(() => router.back());
    await settle();
    await fireEvent.press(await screen.findByRole('link', { name: 'Sold by Store seller-1' }));
    expect(await screen.findByRole('header', { name: 'Store 1' })).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/sellers/seller-1');
    await act(() => router.back());
    await settle();
    expect(await screen.findByLabelText(/^Basket,/)).toBeOnTheScreen();
    // The tab stayed mounted: no re-read on the way back.
    expect(calls(SHOP)).toHaveLength(1);
  });

  it('an empty Market says so; a failure says so with a retry', async () => {
    serve(SHOP, problem(500, 'INTERNAL', 'request'), ok({ market_resolved: true, data: [], next_cursor: null }));
    await openShop();
    await fireEvent.press(await screen.findByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText(en['buyer.shop.empty'])).toBeOnTheScreen();
  });

  it('a new install reads the Shop only after the first bootstrap (which registers the device, its Market)', async () => {
    let release: (reply: Reply) => void = () => undefined;
    api.on('GET /v1/bootstrap', () => new Promise<Reply>((resolve) => (release = resolve)));
    serve(SHOP, ok({ market_resolved: true, data: [shopProduct('basket', 'Basket')], next_cursor: null }));
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    await settle();
    expect(calls(SHOP)).toHaveLength(0);
    await act(async () => release(ok(bootstrapBody())));
    expect(await screen.findByLabelText(/^Basket,/)).toBeOnTheScreen();
    expect(calls(SHOP)).toHaveLength(1);
  });

  it('signed in, the Shop read presents the session (the Account Market)', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    serve(SHOP, ok({ market_resolved: true, data: [shopProduct('basket', 'Basket')], next_cursor: null }));
    await openShop();
    await screen.findByLabelText(/^Basket,/);
    expect(calls(SHOP)[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
  });

  it('reached from the tab bar like any tab, and makes no cart, order or payment request', async () => {
    serve(SHOP, ok({ market_resolved: true, data: [shopProduct('basket', 'Basket')], next_cursor: null }));
    api.on('GET /v1/fyp', () => ok({ feed_session_id: null, algorithm_version: null, items: [], next_cursor: null }));
    await renderRouter(APP_DIR);
    await screen.findByText(en['buyer.for_you.empty']);
    await fireEvent.press(bottomTab(en['buyer.tab.shop']));
    expect(await screen.findByLabelText(/^Basket,/)).toBeOnTheScreen();
    expect(api.calls.filter((c) => /\/v1\/(cart|orders?|payments?|reservations?)/.test(c.path))).toEqual([]);
  });
});

describe('the Market behind the Shop (ON-043)', () => {
  const page = (...items: ReturnType<typeof shopProduct>[]) => ok({ market_resolved: true, data: items, next_cursor: null });

  it('no Market resolved: says so with a retry, never "No Products"; the retry places the device again', async () => {
    serve(SHOP, ok({ market_resolved: false, data: [], next_cursor: null }), page(shopProduct('basket', 'Basket')));
    await openShop();
    expect(await screen.findByText(en['buyer.shop.no_market'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.shop.empty'])).not.toBeOnTheScreen();
    const bootstraps = calls('GET /v1/bootstrap').length;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByLabelText(/^Basket,/)).toBeOnTheScreen();
    expect(calls('GET /v1/bootstrap').length).toBe(bootstraps + 1);
    expect(screen.queryByText(en['buyer.shop.no_market'])).not.toBeOnTheScreen();
  });

  it('a failed bootstrap reads nothing and offers a retry; the retry recovers', async () => {
    let fail = true;
    api.on('GET /v1/bootstrap', () => (fail ? problem(500, 'INTERNAL', 'request') : ok(bootstrapBody())));
    serve(SHOP, page(shopProduct('basket', 'Basket')));
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    const retry = await screen.findByRole('button', { name: en['common.retry'] });
    expect(calls(SHOP)).toHaveLength(0);
    expect(screen.queryByText(en['buyer.shop.empty'])).not.toBeOnTheScreen();
    fail = false;
    await fireEvent.press(retry);
    expect(await screen.findByLabelText(/^Basket,/)).toBeOnTheScreen();
    expect(calls(SHOP)).toHaveLength(1);
  });

  it('a failed device registration is the same: nothing read, a retry, and recovery', async () => {
    let fail = true;
    api.on('POST /v1/devices', () => (fail ? problem(500, 'INTERNAL', 'request') : { status: 201, body: {} }));
    serve(SHOP, page(shopProduct('basket', 'Basket')));
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    const retry = await screen.findByRole('button', { name: en['common.retry'] });
    expect(calls(SHOP)).toHaveLength(0);
    fail = false;
    await fireEvent.press(retry);
    expect(await screen.findByLabelText(/^Basket,/)).toBeOnTheScreen();
  });

  it('a device that starts offline: the paused bootstrap says offline, and the Shop loads by itself on reconnect', async () => {
    // A cold start reads the connection once (query-client.ts); this device reads "not connected".
    const network = jest
      .spyOn(jest.requireMock<typeof import('expo-network')>('expo-network'), 'getNetworkStateAsync')
      .mockResolvedValue({ isConnected: false } as Awaited<ReturnType<typeof import('expo-network').getNetworkStateAsync>>);
    onlineManager.setOnline(false);
    try {
      serve(SHOP, page(shopProduct('basket', 'Basket')));
      await renderRouter(APP_DIR, { initialUrl: '/shop' });
      expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: en['common.retry'] })).not.toBeOnTheScreen();
      expect(screen.queryByText(en['buyer.shop.empty'])).not.toBeOnTheScreen();
      expect(calls('GET /v1/bootstrap')).toHaveLength(0); // paused, not spent
      await act(async () => onlineManager.setOnline(true));
      expect(await screen.findByLabelText(/^Basket,/)).toBeOnTheScreen();
    } finally {
      network.mockRestore();
      onlineManager.setOnline(true);
    }
  });

  it('a pull while blocked re-places the device, like the retry', async () => {
    serve(SHOP, ok({ market_resolved: false, data: [], next_cursor: null }), page(shopProduct('basket', 'Basket')));
    await openShop();
    await screen.findByText(en['buyer.shop.no_market']);
    const bootstraps = calls('GET /v1/bootstrap').length;
    await act(() =>
      (screen.getByTestId('shop-products').props as { refreshControl: { props: { onRefresh: () => void } } }).refreshControl.props.onRefresh(),
    );
    expect(await screen.findByLabelText(/^Basket,/)).toBeOnTheScreen();
    expect(calls('GET /v1/bootstrap').length).toBe(bootstraps + 1);
  });

  it('offline: says offline, not "No Products"; once the connection returns the Shop loads', async () => {
    let offline = true;
    api.on('GET /v1/bootstrap', () => (offline ? 'offline' : ok(bootstrapBody())));
    serve(SHOP, page(shopProduct('basket', 'Basket')));
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    // The network retries twice before giving up.
    await act(() => jest.advanceTimersByTimeAsync(10_000));
    expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.shop.empty'])).not.toBeOnTheScreen();
    expect(calls(SHOP)).toHaveLength(0);
    offline = false;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByLabelText(/^Basket,/)).toBeOnTheScreen();
  });
});

describe('the shared public list (ON-040)', () => {
  const pull = () =>
    act(() =>
      (screen.getByTestId('shop-products').props as { refreshControl: { props: { onRefresh: () => void } } }).refreshControl.props.onRefresh(),
    );
  const endReached = () => act(() => (screen.getByTestId('shop-products').props as { onEndReached: () => void }).onEndReached());

  it('a failed next page keeps what is shown, says so under it, and retries that page only', async () => {
    serve(
      SHOP,
      ok({ market_resolved: true, data: [shopProduct('a', 'Item A')], next_cursor: 'page-2' }),
      problem(500, 'INTERNAL', 'request'),
      ok({ market_resolved: true, data: [shopProduct('b', 'Item B')], next_cursor: null }),
    );
    await openShop();
    await screen.findByLabelText(/^Item A,/);
    await endReached();
    expect(await screen.findByText(new RegExp(en['buyer.list.more_failed']))).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Item A,/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByLabelText(/^Item B,/)).toBeOnTheScreen();
    expect(calls(SHOP).map((c) => c.query['cursor'])).toEqual([undefined, 'page-2', 'page-2']);
  });

  it('a pull keeps the items on screen while it loads, then shows the new answer from the first page', async () => {
    let release: (reply: Reply) => void = () => undefined;
    let n = 0;
    api.on(SHOP, () =>
      n++ === 0
        ? ok({ market_resolved: true, data: [shopProduct('a', 'Item A')], next_cursor: null })
        : new Promise<Reply>((resolve) => (release = resolve)),
    );
    await openShop();
    await screen.findByLabelText(/^Item A,/);
    await pull();
    await settle();
    expect(screen.getByLabelText(/^Item A,/)).toBeOnTheScreen();
    await act(async () => release(ok({ market_resolved: true, data: [shopProduct('b', 'Item B')], next_cursor: null })));
    expect(await screen.findByLabelText(/^Item B,/)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Item A,/)).not.toBeOnTheScreen();
    expect(calls(SHOP)[1]?.query['cursor']).toBeUndefined();
  });

  it('a slow answer to an older pull never replaces the newer one', async () => {
    const pending: Array<(reply: Reply) => void> = [];
    let n = 0;
    api.on(SHOP, () =>
      n++ === 0
        ? ok({ market_resolved: true, data: [shopProduct('a', 'Item A')], next_cursor: null })
        : new Promise<Reply>((resolve) => pending.push(resolve)),
    );
    await openShop();
    await screen.findByLabelText(/^Item A,/);
    await pull();
    await settle();
    await pull();
    await settle();
    expect(pending).toHaveLength(2);
    await act(async () => pending[1]!(ok({ market_resolved: true, data: [shopProduct('new', 'Newer')], next_cursor: null })));
    expect(await screen.findByLabelText(/^Newer,/)).toBeOnTheScreen();
    await act(async () => pending[0]!(ok({ market_resolved: true, data: [shopProduct('old', 'Older')], next_cursor: null })));
    await settle();
    expect(screen.getByLabelText(/^Newer,/)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Older,/)).not.toBeOnTheScreen();
  });

  it('a session that ends mid-browse reads the list again as a guest, and nothing of the signed-in answer stays', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    api.on(SHOP, (call) =>
      call.headers.Authorization
        ? calls(SHOP).length === 1
          ? ok({ market_resolved: true, data: [shopProduct('mine', 'Account Market item')], next_cursor: null })
          : problem(401, 'SESSION_EXPIRED', 'auth')
        : ok({ market_resolved: true, data: [shopProduct('guest', 'Device Market item')], next_cursor: null }),
    );
    await openShop();
    await screen.findByLabelText(/^Account Market item,/);
    await pull();
    expect(await screen.findByLabelText(/^Device Market item,/)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Account Market item,/)).not.toBeOnTheScreen();
    expect(calls(SHOP).at(-1)?.headers.Authorization).toBeUndefined();
  });
});

describe('returning from the background', () => {
  let listeners: ((state: AppStateStatus) => void)[] = [];
  const goTo = (state: AppStateStatus) =>
    act(() => {
      for (const listener of [...listeners]) listener(state);
    });
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
      return { remove: () => (listeners = listeners.filter((l) => l !== listener)) } as ReturnType<
        typeof AppState.addEventListener
      >;
    });
  });

  it('a short stay keeps the list; after the interval it is read again and an unpublished Product is gone', async () => {
    serve(
      SHOP,
      ok({ market_resolved: true, data: [shopProduct('basket', 'Basket'), shopProduct('scarf', 'Scarf')], next_cursor: null }),
      ok({ market_resolved: true, data: [shopProduct('scarf', 'Scarf')], next_cursor: null }),
    );
    await openShop();
    await screen.findByLabelText(/^Basket,/);
    await goTo('background');
    await act(() => jest.advanceTimersByTimeAsync(60_000));
    await goTo('active');
    await settle();
    expect(calls(SHOP)).toHaveLength(1);
    await goTo('background');
    await act(() => jest.advanceTimersByTimeAsync(6 * 60_000));
    await goTo('active');
    await settle();
    expect(calls(SHOP)).toHaveLength(2);
    expect(await screen.findByLabelText(/^Scarf,/)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Basket,/)).not.toBeOnTheScreen();
  });
});
