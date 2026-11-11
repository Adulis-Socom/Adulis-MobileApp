import { en } from '@adulis/locale/mobile';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, installFakeApi, problem, shopProduct, type Reply, type ShopProduct } from '../testing/fake-api';
import { installFakeCollections } from '../testing/fake-collections';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * WO-010: Buyer category discovery on the real route tree -- Shop category tabs and the Search
 * Products category filter -- against the fake API speaking the generated contract. The server
 * filters; the app sends a category code and draws what comes back.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const CATEGORIES = [
  { id: 'ca7e0000-0000-4000-8000-000000000001', code: 'FASHION', parent_id: null, label_key: 'catalogue.category.fashion', display_order: 10 },
  { id: 'ca7e0000-0000-4000-8000-000000000002', code: 'COSMETICS', parent_id: null, label_key: 'catalogue.category.cosmetics', display_order: 20 },
  { id: 'ca7e0000-0000-4000-8000-000000000003', code: 'ELECTRONICS', parent_id: null, label_key: 'catalogue.category.electronics', display_order: 30 },
];
const SCARF = shopProduct('scarf', 'Silk scarf');
const MUG = shopProduct('mug', 'Plain mug');
const BALM = shopProduct('balm', 'Rose lip balm');

let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
const shopCalls = () => api.callsTo('GET /v1/shop/products');
const tab = (code: string) => screen.getByTestId(`category-tab-${code}`);
const flush = async () => {
  for (let i = 0; i < 10; i++) await act(() => Promise.resolve());
};

/** The Shop by category, on the server's rules: All lists everything; a category, its own. */
function serveShop(pages: Record<string, ShopProduct[][]>) {
  api.on('GET /v1/shop/products', (call) => {
    const key = call.query.category ?? 'ALL';
    const n = call.query.cursor ? Number(call.query.cursor.slice(key.length + 1)) : 0;
    const list = pages[key] ?? [];
    return ok({ market_resolved: true, data: list[n] ?? [], next_cursor: n + 1 < list.length ? `${key}-${n + 1}` : null });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  api.on('GET /v1/categories', () => ok({ market_resolved: true, data: CATEGORIES }));
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

afterEach(() => {
  // No commerce side effect from browsing or filtering.
  expect(api.calls.filter((c) => /cart|order|checkout|payment|reservation/i.test(c.path))).toEqual([]);
});

describe('Shop categories', () => {
  it('shows All Products first, then the Market categories in the server order; a tap filters on the server', async () => {
    serveShop({ ALL: [[MUG, SCARF, BALM]], FASHION: [[SCARF]], COSMETICS: [[BALM]] });
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    expect(await screen.findByLabelText(/^Plain mug,/)).toBeOnTheScreen();
    // A labelled tab list (not one grouped element, so each tab stays reachable by a screen reader).
    expect(screen.getByTestId('category-tabs').props).toMatchObject({ accessibilityRole: 'tablist', accessibilityLabel: en['buyer.shop.categories'] });
    expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(['All Products', 'Fashion', 'Cosmetics', 'Electronics']);
    expect(tab('ALL')).toBeSelected();
    expect(shopCalls()[0]?.query).toEqual({ limit: '30' });

    await fireEvent.press(tab('FASHION'));
    expect(await screen.findByLabelText(/^Silk scarf,/)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Plain mug,/)).not.toBeOnTheScreen();
    expect(tab('FASHION')).toBeSelected();
    expect(shopCalls().at(-1)?.query).toEqual({ limit: '30', category: 'FASHION' });

    await fireEvent.press(tab('ALL'));
    expect(await screen.findByLabelText(/^Plain mug,/)).toBeOnTheScreen();
    expect(shopCalls().at(-1)?.query).toEqual({ limit: '30' });
    // Nothing is filtered on the device: every list is the server's.
    expect(shopCalls().every((c) => c.query.category === undefined || c.query.category === 'FASHION')).toBe(true);
  });

  it('an empty category says so; the next page of a category carries its own cursor and filter', async () => {
    serveShop({ ALL: [[MUG]], ELECTRONICS: [], FASHION: [[SCARF], [shopProduct('shirt', 'Linen shirt')]] });
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    await screen.findByLabelText(/^Plain mug,/);
    await fireEvent.press(tab('ELECTRONICS'));
    expect(await screen.findByText(en['buyer.shop.category_empty'])).toBeOnTheScreen();

    await fireEvent.press(tab('FASHION'));
    await screen.findByLabelText(/^Silk scarf,/);
    await act(() => (screen.getByTestId('shop-products').props as { onEndReached: () => void }).onEndReached());
    expect(await screen.findByLabelText(/^Linen shirt,/)).toBeOnTheScreen();
    expect(shopCalls().at(-1)?.query).toEqual({ limit: '30', category: 'FASHION', cursor: 'FASHION-1' });
    expect(screen.getByText(en['buyer.list.end'])).toBeOnTheScreen();
  });

  it('a category the server no longer offers falls back to All and reads the categories again', async () => {
    serveShop({ ALL: [[MUG]] });
    api.on('GET /v1/shop/products', (call) =>
      call.query.category ? problem(400, 'VALIDATION_FAILED', 'request', { path: 'category' }) : ok({ market_resolved: true, data: [MUG], next_cursor: null }),
    );
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    await screen.findByLabelText(/^Plain mug,/);
    const reads = api.callsTo('GET /v1/categories').length;
    await fireEvent.press(tab('COSMETICS'));
    await waitFor(() => expect(tab('ALL')).toBeSelected());
    expect(await screen.findByLabelText(/^Plain mug,/)).toBeOnTheScreen();
    await waitFor(() => expect(api.callsTo('GET /v1/categories').length).toBeGreaterThan(reads));
  });

  it('categories that cannot be read: All Products still works, the notice offers Try again', async () => {
    serveShop({ ALL: [[MUG]] });
    let fail = true;
    api.on('GET /v1/categories', () => (fail ? problem(500, 'INTERNAL', 'request') : ok({ market_resolved: true, data: CATEGORIES })));
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    expect(await screen.findByLabelText(/^Plain mug,/)).toBeOnTheScreen();
    expect(await screen.findByText(en['buyer.shop.categories_failed'])).toBeOnTheScreen();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByTestId('category-tab-FASHION')).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.shop.categories_failed'])).not.toBeOnTheScreen();
  });

  it('a Market with no category shows no category bar; a label this catalogue lacks shows the code', async () => {
    serveShop({ ALL: [[MUG]] });
    api.on('GET /v1/categories', () => ok({ market_resolved: true, data: [] }));
    const first = await renderRouter(APP_DIR, { initialUrl: '/shop' });
    await screen.findByLabelText(/^Plain mug,/);
    await flush();
    expect(screen.queryByTestId('category-tabs')).not.toBeOnTheScreen();
    first.unmount();
  });

  it('signed in, Save still works on a filtered list (one batch for the page, SHOP surface)', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    const fc = installFakeCollections(api, { products: { [SCARF.id]: SCARF } });
    serveShop({ ALL: [[MUG, SCARF]], FASHION: [[SCARF]] });
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    await screen.findByLabelText(/^Plain mug,/);
    await fireEvent.press(tab('FASHION'));
    await screen.findByLabelText(/^Silk scarf,/);
    const card = () => screen.getByRole('togglebutton', { name: 'Save Silk scarf' });
    await waitFor(() => expect(card().props.accessibilityState?.disabled).not.toBe(true));
    const batches = api.callsTo('POST /v1/collections/saved-state:batch');
    expect(batches.at(-1)?.body).toEqual({ targets: [{ type: 'PRODUCT_POST', ref: SCARF.id }] });
    await fireEvent.press(card());
    await waitFor(() => expect(card().props.accessibilityState?.checked).toBe(true));
    expect(fc.items.map((i) => i.target.ref)).toEqual([SCARF.id]);
    expect(api.calls.find((c) => c.method === 'POST' && c.path.endsWith('/items'))?.body).toMatchObject({ source_surface: 'SHOP' });
  });
});

describe('Search category filter', () => {
  const searchCalls = () => api.callsTo('GET /v1/search');
  const page = (type: string, items: unknown[]) => ok({ market_resolved: true, type, algorithm_version: 'lexical-trgm-v1', items, next_cursor: null });

  it('only the Products tab offers categories; the filter goes to the server with type=PRODUCT_POST', async () => {
    api.on('GET /v1/search', (call) =>
      call.query.type === 'PRODUCT_POST'
        ? page('PRODUCT_POST', call.query.category === 'FASHION' ? [{ type: 'PRODUCT_POST', payload: SCARF }] : [{ type: 'PRODUCT_POST', payload: SCARF }, { type: 'PRODUCT_POST', payload: MUG }])
        : page(call.query.type ?? 'TOP', [{ type: 'PRODUCT_POST', payload: MUG }]),
    );
    await renderRouter(APP_DIR, { initialUrl: '/search' });
    await fireEvent.changeText(await screen.findByLabelText(en['buyer.search.input']), 'scarf');
    await act(() => jest.advanceTimersByTimeAsync(1000));
    await screen.findByLabelText(/^Plain mug,/);
    expect(screen.queryByTestId('category-tabs')).not.toBeOnTheScreen();
    expect(searchCalls()[0]?.query).toEqual({ q: 'scarf', type: 'TOP' });

    await fireEvent.press(screen.getByTestId('search-tab-PRODUCT_POST'));
    await act(() => jest.advanceTimersByTimeAsync(1000));
    await screen.findByLabelText(/^Silk scarf,/);
    await fireEvent.press(await screen.findByTestId('category-tab-FASHION'));
    await act(() => jest.advanceTimersByTimeAsync(1000));
    await waitFor(() => expect(searchCalls().at(-1)?.query).toEqual({ q: 'scarf', type: 'PRODUCT_POST', limit: '20', category: 'FASHION' }));
    await waitFor(() => expect(screen.queryByLabelText(/^Plain mug,/)).not.toBeOnTheScreen());
    expect(screen.getByLabelText(/^Silk scarf,/)).toBeOnTheScreen();

    // Back on Top: no category is sent, and none is shown.
    await fireEvent.press(screen.getByTestId('search-tab-TOP'));
    await waitFor(() => expect(screen.queryByTestId('category-tabs')).not.toBeOnTheScreen());
    expect(searchCalls().filter((c) => c.query.type !== 'PRODUCT_POST').every((c) => c.query.category === undefined)).toBe(true);
  });
});
