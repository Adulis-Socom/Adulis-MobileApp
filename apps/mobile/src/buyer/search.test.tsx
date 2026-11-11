import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import type { SearchItem, SearchPage, SearchType } from '../api/client';
import { useUiStore } from '../state/ui-store';
import {
  GOOD_TOKEN,
  installFakeApi,
  problem,
  publicScene,
  sellerScene,
  shopProduct,
  storefront,
  storefrontProduct,
  type Reply,
} from '../testing/fake-api';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * WO-008: Marketplace Search on the real route tree against the fake API speaking the generated
 * contract -- opening from Home, debounced queries, the four tabs, opening each result type and
 * coming back to the same query, honest empty / short / error / no-Market states.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const SEARCH = 'GET /v1/search';
let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const calls = () => api.callsTo(SEARCH);

const product = (slug: string, name: string, handle = 'seller-1', available = true): SearchItem => ({
  type: 'PRODUCT_POST',
  payload: shopProduct(slug, name, handle, { available }),
});
const seller = (handle: string, store: string): SearchItem => ({
  type: 'SELLER',
  payload: { handle, store_name: store, trust_level: 'ESTABLISHED' },
});
const scene = (n: number, caption: string): SearchItem => {
  const s = sellerScene(n);
  return {
    type: 'SCENE_POST',
    payload: { public_ref: s.public_ref, caption, caption_truncated: false, image: s.image, seller: { handle: 'seller-1', store_name: 'Store 1' } },
  };
};
const page = (type: SearchType, items: SearchItem[], next: string | null = null, resolved = true): SearchPage => ({
  market_resolved: resolved,
  type,
  algorithm_version: 'lexical-trgm-v1',
  items: resolved ? items : [],
  next_cursor: next,
});
/** Answers by the request's type (and query): the server's contract, minus the database. */
function serveSearch(answer: (type: SearchType, q: string, cursor: string | undefined) => Reply | Promise<Reply>) {
  api.on(SEARCH, (call) => answer((call.query['type'] ?? 'TOP') as SearchType, call.query['q'] ?? '', call.query['cursor']));
}
const typeQuery = async (text: string) => {
  await fireEvent.changeText(screen.getByLabelText(en['buyer.search.input']), text);
  await settle();
};
const openSearch = async () => {
  const r = await renderRouter(APP_DIR, { initialUrl: '/search' });
  expect(await screen.findByText(en['buyer.search.hint'])).toBeOnTheScreen();
  return r;
};
const tab = (type: SearchType) => screen.getByTestId(`search-tab-${type}`);

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
});

describe('Marketplace Search', () => {
  it('29, 30, 41. opens from Home, waits for typing to settle, then shows Top results as a guest', async () => {
    serveSearch((type) => ok(page(type, [seller('addis-weaves', 'Addis Weaves'), product('basket', 'Woven basket'), scene(1, 'Morning light')])));
    api.on('GET /v1/fyp', () => ok({ feed_session_id: null, algorithm_version: null, items: [], next_cursor: null }));
    const r = await renderRouter(APP_DIR);
    await screen.findByText(en['buyer.for_you.empty']);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.search'] }));
    expect(await screen.findByLabelText(en['buyer.search.input'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/search');
    // Three keystrokes inside the debounce window: one request, for the settled text.
    const input = screen.getByLabelText(en['buyer.search.input']);
    await fireEvent.changeText(input, 'wo');
    await fireEvent.changeText(input, 'wov');
    await fireEvent.changeText(input, 'woven ');
    await settle();
    expect(await screen.findByLabelText('Addis Weaves, @addis-weaves')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Woven basket,/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Scene: Morning light')).toBeOnTheScreen();
    expect(screen.getByText('Trust level: Established')).toBeOnTheScreen();
    expect(calls()).toHaveLength(1);
    expect(calls()[0]?.query).toEqual({ q: 'woven', type: 'TOP' });
    expect(calls()[0]?.headers.Authorization).toBeUndefined();
  });

  it('31. the tabs read one type each, Products and Scenes as grids, each paging by its own cursor', async () => {
    serveSearch((type, _q, cursor) =>
      type === 'PRODUCT_POST'
        ? ok(cursor ? page(type, [product('stand', 'Basket stand')]) : page(type, [product('basket', 'Woven basket'), product('large', 'Woven basket large', 'seller-1', false)], 'p2'))
        : type === 'SCENE_POST'
          ? ok(page(type, [scene(1, 'Morning light')]))
          : type === 'SELLER'
            ? ok(page(type, [seller('basket-house', 'Basket House')]))
            : ok(page(type, [product('basket', 'Woven basket')])),
    );
    await openSearch();
    await typeQuery('basket');
    await screen.findByLabelText(/^Woven basket,/);
    await fireEvent.press(tab('PRODUCT_POST'));
    expect(tab('PRODUCT_POST')).toBeSelected();
    expect(await screen.findByLabelText(/^Woven basket large, .*Currently unavailable$/)).toBeOnTheScreen();
    expect(screen.getAllByRole('link', { name: 'Sold by Store seller-1' }).length).toBeGreaterThanOrEqual(2);
    await act(() => (screen.getByTestId('search-results-PRODUCT_POST').props as { onEndReached: () => void }).onEndReached());
    expect(await screen.findByLabelText(/^Basket stand,/)).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.list.end'])).toBeOnTheScreen();
    await fireEvent.press(tab('SCENE_POST'));
    expect(await screen.findByTestId('search-scene-tile')).toBeOnTheScreen();
    expect(screen.getByText('Scene by Store 1')).toBeOnTheScreen();
    await fireEvent.press(tab('SELLER'));
    expect(await screen.findByLabelText('Basket House, @basket-house')).toBeOnTheScreen();
    const asked = calls().map((c) => [c.query['type'], c.query['cursor'] ?? null, c.query['limit'] ?? null]);
    expect(asked).toEqual([
      ['TOP', null, null],
      ['PRODUCT_POST', null, '20'],
      ['PRODUCT_POST', 'p2', '20'],
      ['SCENE_POST', null, '20'],
      ['SELLER', null, '20'],
    ]);
  });

  it('32-37. a Product, a Seller and a Scene open their existing screens; Back returns to the same query and tab, not re-read', async () => {
    serveSearch((type) => ok(page(type, [seller('seller-1', 'Store 1'), product('basket', 'Woven basket'), scene(1, 'Morning light')])));
    api.on('GET /v1/storefronts/seller-1/products/basket', () => ok(storefrontProduct('basket', 'Woven basket')));
    api.on('GET /v1/storefronts/seller-1', () => ok(storefront('seller-1')));
    api.on('GET /v1/storefronts/seller-1/scenes', () => ok({ data: [], next_cursor: null }));
    api.on(`GET /v1/scene-posts/${sellerScene(1).public_ref}`, () => ok(publicScene(1, { caption: 'The whole caption' })));
    const r = await openSearch();
    await typeQuery('Woven basket');
    await fireEvent.press(await screen.findByLabelText(/^Woven basket,/));
    expect(await screen.findByText('About Woven basket')).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/product/seller-1/basket');
    await act(() => router.back());
    await settle();
    expect(await screen.findByLabelText(/^Woven basket,/)).toBeOnTheScreen();
    expect(screen.getByLabelText(en['buyer.search.input']).props.value).toBe('Woven basket');
    await fireEvent.press(screen.getByLabelText('Store 1, @seller-1'));
    expect(await screen.findByRole('header', { name: 'Store 1' })).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/sellers/seller-1');
    await act(() => router.back());
    await settle();
    await fireEvent.press(await screen.findByLabelText('Scene: Morning light'));
    expect(await screen.findByText('The whole caption')).toBeOnTheScreen();
    expect(r.getPathname()).toBe(`/scenes/${sellerScene(1).public_ref}`);
    await act(() => router.back());
    await settle();
    expect(await screen.findByLabelText(/^Woven basket,/)).toBeOnTheScreen();
    expect(tab('TOP')).toBeSelected();
    expect(calls()).toHaveLength(1);
  });

  it('a one-character query asks nothing and says why; clearing returns to the start', async () => {
    serveSearch((type) => ok(page(type, [])));
    await openSearch();
    await typeQuery('a');
    expect(screen.getByText(en['buyer.search.too_short'])).toBeOnTheScreen();
    expect(calls()).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.search.clear'] }));
    expect(screen.getByLabelText(en['buyer.search.input']).props.value).toBe('');
    expect(screen.getByText(en['buyer.search.hint'])).toBeOnTheScreen();
  });

  it('no results: an honest message with the query, and real ways back to Shop or Home', async () => {
    serveSearch((type) => ok(page(type, [])));
    api.on('GET /v1/shop/products', () => ok({ market_resolved: true, data: [], next_cursor: null }));
    const r = await openSearch();
    await typeQuery('zzqx');
    expect(await screen.findByText('No results for "zzqx".')).toBeOnTheScreen();
    // No invented suggestion, popular or recent query.
    expect(screen.queryByText(/popular|trending|recent|did you mean/i)).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.search.go_shop'] }));
    expect(await screen.findByText(en['buyer.shop.order'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/shop');
  });

  it('38. a failure says so with a retry, and the retry recovers', async () => {
    let fail = true;
    serveSearch((type) => (fail ? problem(500, 'INTERNAL', 'request') : ok(page(type, [product('basket', 'Woven basket')]))));
    await openSearch();
    await typeQuery('basket');
    const retry = await screen.findByRole('button', { name: en['common.retry'] });
    fail = false;
    await fireEvent.press(retry);
    expect(await screen.findByLabelText(/^Woven basket,/)).toBeOnTheScreen();
  });

  it('no Market: says so (never "no results") with a retry that places the device again', async () => {
    let resolved = false;
    serveSearch((type) => ok(page(type, [product('basket', 'Woven basket')], null, resolved)));
    await openSearch();
    await typeQuery('basket');
    expect(await screen.findByText(en['buyer.search.no_market'])).toBeOnTheScreen();
    expect(screen.queryByText(/No results/)).not.toBeOnTheScreen();
    const bootstraps = api.callsTo('GET /v1/bootstrap').length;
    resolved = true;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByLabelText(/^Woven basket,/)).toBeOnTheScreen();
    expect(api.callsTo('GET /v1/bootstrap').length).toBe(bootstraps + 1);
  });

  it("a slow answer to an earlier query never replaces the current query's results", async () => {
    let release: (reply: Reply) => void = () => undefined;
    serveSearch((type, q) =>
      q === 'baskets' ? new Promise<Reply>((resolve) => (release = resolve)) : ok(page(type, [product('cup', 'Clay cup')])),
    );
    await openSearch();
    await typeQuery('baskets');
    await typeQuery('cups');
    expect(await screen.findByLabelText(/^Clay cup,/)).toBeOnTheScreen();
    await act(async () => release(ok(page('TOP', [product('basket', 'Woven basket')]))));
    await settle();
    expect(screen.getByLabelText(/^Clay cup,/)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Woven basket,/)).not.toBeOnTheScreen();
  });

  it('42. signed in, Search presents the session (the Account Market)', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    serveSearch((type) => ok(page(type, [product('basket', 'Woven basket')])));
    await openSearch();
    await typeQuery('basket');
    await screen.findByLabelText(/^Woven basket,/);
    expect(calls()[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
  });

  it('45. makes no cart, order, payment or reservation request, and stores nothing about the query', async () => {
    serveSearch((type) => ok(page(type, [product('basket', 'Woven basket'), seller('seller-1', 'Store 1')])));
    await openSearch();
    await typeQuery('basket');
    await screen.findByLabelText(/^Woven basket,/);
    await fireEvent.press(tab('PRODUCT_POST'));
    await screen.findByLabelText(/^Woven basket,/);
    expect(api.calls.filter((c) => /\/v1\/(cart|orders?|payments?|reservations?|analytics)/.test(c.path))).toEqual([]);
    expect(api.calls.filter((c) => c.method !== 'GET' && c.path !== '/v1/devices')).toEqual([]);
  });
});
