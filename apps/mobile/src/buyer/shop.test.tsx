import { en } from '@adulis/locale/mobile';
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
    expect(screen.getByLabelText('View Store seller-2')).toBeOnTheScreen();
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
      ok({ data: [shopProduct('a', 'Item A')], next_cursor: 'page-2' }),
      ok({ data: [shopProduct('b', 'Item B'), shopProduct('a', 'Item A')], next_cursor: null }),
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
    serve(SHOP, ok({ data: [shopProduct('basket', 'Basket', 'seller-1')], next_cursor: null }));
    serve('GET /v1/storefronts/seller-1/products/basket', ok(storefrontProduct('basket', 'Basket')));
    serve('GET /v1/storefronts/seller-1', ok(storefront('seller-1')));
    serve('GET /v1/storefronts/seller-1/scenes', ok({ data: [sellerScene(1)], next_cursor: null }));
    const r = await openShop();
    await fireEvent.press(await screen.findByLabelText(/^Basket,/));
    expect(await screen.findByText('About Basket')).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/product/seller-1/basket');
    await act(() => router.back());
    await settle();
    await fireEvent.press(await screen.findByLabelText('View Store seller-1'));
    expect(await screen.findByRole('header', { name: 'Store 1' })).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/sellers/seller-1');
    await act(() => router.back());
    await settle();
    expect(await screen.findByLabelText(/^Basket,/)).toBeOnTheScreen();
    // The tab stayed mounted: no re-read on the way back.
    expect(calls(SHOP)).toHaveLength(1);
  });

  it('an empty Market says so; a failure says so with a retry', async () => {
    serve(SHOP, problem(500, 'INTERNAL', 'request'), ok({ data: [], next_cursor: null }));
    await openShop();
    await fireEvent.press(await screen.findByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText(en['buyer.shop.empty'])).toBeOnTheScreen();
  });

  it('a new install reads the Shop only after the first bootstrap (which registers the device, its Market)', async () => {
    let release: (reply: Reply) => void = () => undefined;
    api.on('GET /v1/bootstrap', () => new Promise<Reply>((resolve) => (release = resolve)));
    serve(SHOP, ok({ data: [shopProduct('basket', 'Basket')], next_cursor: null }));
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    await settle();
    expect(calls(SHOP)).toHaveLength(0);
    await act(async () => release(ok(bootstrapBody())));
    expect(await screen.findByLabelText(/^Basket,/)).toBeOnTheScreen();
    expect(calls(SHOP)).toHaveLength(1);
  });

  it('signed in, the Shop read presents the session (the Account Market)', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    serve(SHOP, ok({ data: [shopProduct('basket', 'Basket')], next_cursor: null }));
    await openShop();
    await screen.findByLabelText(/^Basket,/);
    expect(calls(SHOP)[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
  });

  it('reached from the tab bar like any tab, and makes no cart, order or payment request', async () => {
    serve(SHOP, ok({ data: [shopProduct('basket', 'Basket')], next_cursor: null }));
    api.on('GET /v1/fyp', () => ok({ feed_session_id: null, algorithm_version: null, items: [], next_cursor: null }));
    await renderRouter(APP_DIR);
    await screen.findByText(en['buyer.for_you.empty']);
    await fireEvent.press(bottomTab(en['buyer.tab.shop']));
    expect(await screen.findByLabelText(/^Basket,/)).toBeOnTheScreen();
    expect(api.calls.filter((c) => /\/v1\/(cart|orders?|payments?|reservations?)/.test(c.path))).toEqual([]);
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
      ok({ data: [shopProduct('basket', 'Basket'), shopProduct('scarf', 'Scarf')], next_cursor: null }),
      ok({ data: [shopProduct('scarf', 'Scarf')], next_cursor: null }),
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
