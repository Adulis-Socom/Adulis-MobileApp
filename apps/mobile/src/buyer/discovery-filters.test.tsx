import { en } from '@adulis/locale/mobile';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { createApiClient } from '../api/client';
import { useUiStore } from '../state/ui-store';
import { claimsIn, renderedText } from '../testing/discovery-rules';
import { installFakeApi, shopProduct, type Reply } from '../testing/fake-api';
import { resetSecureStore } from '../testing/secure-store-mock';
import { productionSources, repoFile } from '../testing/source-scan';

/**
 * The supported-filter matrix as tests: the controls Shop and Search show are exactly the
 * ones the generated contract supports (a category, the result type, paging), the client sends
 * only parameters the contract declares, and nothing is sorted, filtered, ranked or claimed on the
 * device. If the contract gains a sort or a filter, the first test fails and forces a decision.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

type Parameter = { name: string; in: string; required?: boolean; schema?: { enum?: string[] } };
type Contract = { paths: Record<string, { get?: { parameters?: Parameter[] } }> };
const contract = JSON.parse(repoFile('contracts/openapi.json')) as Contract;
const parameters = (path: string) => contract.paths[path]?.get?.parameters ?? [];
const queryNames = (path: string) => parameters(path).filter((p) => p.in === 'query').map((p) => p.name).sort();

describe('what the contract supports', () => {
  it('the Shop list takes a cursor, a page size and a category, and nothing to sort, filter or pick a Market by', () => {
    expect(queryNames('/v1/shop/products')).toEqual(['category', 'cursor', 'limit']);
    expect(parameters('/v1/shop/products').filter((p) => p.in !== 'query')).toEqual([]);
  });

  it('Search takes the query, a result type, a cursor, a page size and a category, and nothing else', () => {
    expect(queryNames('/v1/search')).toEqual(['category', 'cursor', 'limit', 'q', 'type']);
    expect(parameters('/v1/search').find((p) => p.name === 'type')?.schema?.enum).toEqual(['TOP', 'PRODUCT_POST', 'SELLER', 'SCENE_POST']);
    expect(parameters('/v1/search').filter((p) => p.in !== 'query')).toEqual([]);
  });

  it('the category list takes no parameter: the Market is the server\'s', () => {
    expect(parameters('/v1/categories')).toEqual([]);
  });
});

describe('what the client sends', () => {
  let api: ReturnType<typeof installFakeApi>;
  beforeEach(() => {
    resetSecureStore();
    api = installFakeApi();
    const empty: Reply = { status: 200, body: { market_resolved: true, type: 'TOP', algorithm_version: 'x', items: [], data: [], next_cursor: null } };
    api.on('GET /v1/shop/products', () => empty);
    api.on('GET /v1/search', () => empty);
  });
  const client = () => createApiClient({ deviceId: async () => 'device-1', token: () => null, onSessionEnded: () => undefined });

  it('only parameters the contract declares, for every Shop and Search read', async () => {
    const c = client();
    await c.shopProducts(null);
    await c.shopProducts('cursor-1', 'FASHION');
    for (const type of ['TOP', 'PRODUCT_POST', 'SELLER', 'SCENE_POST'] as const) {
      await c.search('basket', type, type === 'TOP' ? null : 'cursor-1', 'FASHION');
    }
    await c.categories();
    for (const route of ['GET /v1/shop/products', 'GET /v1/search', 'GET /v1/categories']) {
      const allowed = new Set(queryNames(route.slice(4)));
      for (const call of api.callsTo(route)) for (const name of Object.keys(call.query)) expect(allowed.has(name)).toBe(true);
    }
  });

  it('a category is sent to the Shop and to Search Products only; Top, Sellers and Scenes never carry one', async () => {
    const c = client();
    await c.shopProducts(null, 'FASHION');
    for (const type of ['TOP', 'PRODUCT_POST', 'SELLER', 'SCENE_POST'] as const) await c.search('basket', type, null, 'FASHION');
    expect(api.callsTo('GET /v1/shop/products')[0]?.query['category']).toBe('FASHION');
    const byType = Object.fromEntries(api.callsTo('GET /v1/search').map((call) => [call.query['type'], call.query['category']]));
    expect(byType).toEqual({ TOP: undefined, PRODUCT_POST: 'FASHION', SELLER: undefined, SCENE_POST: undefined });
  });
});

describe('what the screens show', () => {
  let api: ReturnType<typeof installFakeApi>;
  const categories = [
    { id: 'ca7e0000-0000-4000-8000-000000000001', code: 'FASHION', parent_id: null, label_key: 'catalogue.category.fashion', display_order: 10 },
    { id: 'ca7e0000-0000-4000-8000-000000000003', code: 'ELECTRONICS', parent_id: null, label_key: 'catalogue.category.electronics', display_order: 30 },
  ];
  /** Widgets a filter or a sort would be built from: none of them exists on a discovery screen. */
  const WIDGETS = ['switch', 'checkbox', 'radio', 'radiogroup', 'combobox', 'spinbutton', 'adjustable', 'menu', 'menuitem'] as const;
  const noWidgets = () => {
    for (const role of WIDGETS) expect(screen.queryAllByRole(role)).toEqual([]);
  };
  beforeEach(() => {
    jest.clearAllMocks();
    resetSecureStore();
    api = installFakeApi();
    api.on('GET /v1/categories', () => ({ status: 200, body: { market_resolved: true, data: categories } }));
    useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
  });

  it('the Shop: the server order label and the server categories -- no sort, filter, price, availability or Market control, and no claim', async () => {
    api.on('GET /v1/shop/products', () => ({
      status: 200,
      body: { market_resolved: true, data: [shopProduct('mug', 'Plain mug'), shopProduct('cup', 'Clay cup', 'seller-2', { available: false })], next_cursor: null },
    }));
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    await screen.findByLabelText(/^Plain mug,/);
    await screen.findByTestId('category-tab-FASHION');
    expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(['All Products', 'Fashion', 'Electronics']);
    expect(screen.getByText(en['buyer.shop.order'])).toBeOnTheScreen();
    noWidgets();
    expect(claimsIn(renderedText(screen.getByTestId('shop-products')))).toEqual([]);
    const shown = renderedText(screen.getByTestId('shop-products')).join(' | ');
    for (const word of ['Sort', 'Filter', 'Price', 'Available only', 'Nearby', 'Discounts', 'Locally Made', 'New Drops', 'Market']) {
      expect(shown).not.toContain(word);
    }
  });

  it('Search: the four result types, a category row on Products only -- no sort, filter, price, availability or Market control, and no claim', async () => {
    api.on('GET /v1/search', (call) => ({
      status: 200,
      body: {
        market_resolved: true,
        type: call.query['type'] ?? 'TOP',
        algorithm_version: 'lexical-trgm-v1',
        items: [{ type: 'PRODUCT_POST', payload: shopProduct('mug', 'Plain mug') }],
        next_cursor: null,
      },
    }));
    await renderRouter(APP_DIR, { initialUrl: '/search' });
    await fireEvent.changeText(await screen.findByLabelText(en['buyer.search.input']), 'mug');
    await act(() => jest.advanceTimersByTimeAsync(1000));
    await screen.findByLabelText(/^Plain mug,/);
    expect(screen.getAllByRole('tab').map((t) => t.props.testID)).toEqual(['search-tab-TOP', 'search-tab-PRODUCT_POST', 'search-tab-SCENE_POST', 'search-tab-SELLER']);
    expect(screen.queryByTestId('category-tabs')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('search-tab-PRODUCT_POST'));
    await screen.findByTestId('category-tab-FASHION');
    expect(screen.getAllByRole('tab').map((t) => t.props.testID)).toEqual([
      'search-tab-TOP',
      'search-tab-PRODUCT_POST',
      'search-tab-SCENE_POST',
      'search-tab-SELLER',
      'category-tab-ALL',
      'category-tab-FASHION',
      'category-tab-ELECTRONICS',
    ]);
    noWidgets();
    expect(claimsIn(renderedText(screen.getByTestId('search-results-PRODUCT_POST')))).toEqual([]);
    const shown = renderedText(screen.getByTestId('search-results-PRODUCT_POST')).join(' | ');
    for (const word of ['Sort', 'Filter', 'Price', 'Available only', 'Nearby', 'Discounts', 'Locally Made', 'Market']) {
      expect(shown).not.toContain(word);
    }
  });
});

describe('what the code and the catalogue contain', () => {
  const NAMESPACE = /^(buyer\.shop\.|buyer\.search|catalogue\.category\.)/;
  const keys = Object.keys(en).filter((key) => NAMESPACE.test(key));

  it('no Shop, Search or category string names a sort, a filter, a price control, Nearby, a discount or a Market switch, or makes a claim', () => {
    expect(keys.length).toBeGreaterThan(20);
    const named = keys.filter((key) => /sort|filter|price|nearby|discount|locally|switch|country/i.test(key));
    expect(named).toEqual([]);
    const claiming = keys.filter((key) => claimsIn([(en as Record<string, string>)[key]!]).length > 0);
    expect(claiming).toEqual([]);
  });

  it('the discovery screens never sort, reverse or re-rank what the server sent, and read no Market from the device', () => {
    const files = productionSources('buyer', 'app').filter((f) => /^(buyer\/(SearchResults|categories|public-list)\.tsx?|app\/\(buyer\)\/(\(tabs\)\/shop|search)\.tsx)$/.test(f.file));
    expect(files.map((f) => f.file).sort()).toEqual(['app/(buyer)/(tabs)/shop.tsx', 'app/(buyer)/search.tsx', 'buyer/SearchResults.tsx', 'buyer/categories.tsx', 'buyer/public-list.ts']);
    const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const { file, text } of files) {
      expect({ file, hit: /\.(sort|toSorted|reverse|toReversed)\(|localeCompare|orderBy|sortBy/.test(code(text)) }).toEqual({ file, hit: false });
      expect({ file, hit: /market_id|marketId|country|setMarket|expo-localization|getLocales|expo-location/i.test(code(text)) }).toEqual({ file, hit: false });
    }
  });

  it('the contract still declares no sort, price, availability, Market or discount parameter anywhere in discovery', () => {
    const declared = ['/v1/shop/products', '/v1/search', '/v1/categories'].flatMap((path) => parameters(path).map((p) => p.name));
    expect(declared.filter((name) => /sort|order|price|avail|market|country|discount|nearby|location/i.test(name))).toEqual([]);
  });
});
