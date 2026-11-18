import { en } from '@adulis/locale/mobile';
import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AppState, type AppStateStatus } from 'react-native';

import type { SearchItem, SearchPage, SearchType } from '../api/client';
import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, installFakeApi, problem, sellerScene, shopProduct, type Reply } from '../testing/fake-api';
import * as secureStore from '../testing/secure-store-mock';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * BUY-06: how Marketplace Search behaves when typing, taps, answers, the connection, the clock and
 * the Account do not arrive in the tidy order -- on the real route tree against the fake API
 * speaking the generated contract. Every result type the server returns stays visible; nothing is
 * drawn that the server did not send.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
// FlashList draws only the rows near the top under Jest and collapses rows that share a key, so a
// result listed twice would never show in the rendered text: each results list's own data is
// recorded here and judged instead.
jest.mock('@shopify/flash-list', () => {
  const actual = jest.requireActual('@shopify/flash-list');
  const react = jest.requireActual('react');
  const recorded: Record<string, unknown[]> = {};
  return {
    ...actual,
    recorded,
    FlashList: (props: { data?: readonly unknown[]; testID?: string }) => {
      if (props.testID?.startsWith('search-results-')) recorded[props.testID] = [...(props.data ?? [])];
      return react.createElement(actual.FlashList, props);
    },
  };
});
jest.setTimeout(60_000);

const SEARCH = 'GET /v1/search';
const CATEGORIES = [
  { id: 'ca7e0000-0000-4000-8000-000000000001', code: 'FASHION', parent_id: null, label_key: 'catalogue.category.fashion', display_order: 10 },
  { id: 'ca7e0000-0000-4000-8000-000000000002', code: 'COSMETICS', parent_id: null, label_key: 'catalogue.category.cosmetics', display_order: 20 },
];

let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const calls = () => api.callsTo(SEARCH);
const deferred = () => {
  let resolve!: (reply: Reply) => void;
  const promise = new Promise<Reply>((r) => (resolve = r));
  return { promise, resolve };
};

const product = (slug: string, name: string, handle = 'seller-1'): SearchItem => ({ type: 'PRODUCT_POST', payload: shopProduct(slug, name, handle) });
const seller = (handle: string, store: string): SearchItem => ({ type: 'SELLER', payload: { handle, store_name: store, trust_level: 'ESTABLISHED' } });
const scene = (n: number, caption: string): SearchItem => {
  const s = sellerScene(n);
  return { type: 'SCENE_POST', payload: { public_ref: s.public_ref, caption, caption_truncated: false, image: s.image, seller: { handle: 'seller-1', store_name: 'Store 1' } } };
};
const page = (type: SearchType, items: SearchItem[], next: string | null = null, resolved = true): Reply =>
  ok({ market_resolved: resolved, type, algorithm_version: 'lexical-trgm-v1', items: resolved ? items : [], next_cursor: next } satisfies SearchPage);
type Ask = { type: SearchType; q: string; cursor: string | undefined; category: string | undefined; authorized: boolean };
function serve(answer: (ask: Ask) => Reply | Promise<Reply>) {
  api.on(SEARCH, (call) =>
    answer({
      type: (call.query['type'] ?? 'TOP') as SearchType,
      q: call.query['q'] ?? '',
      cursor: call.query['cursor'],
      category: call.query['category'],
      authorized: call.headers.Authorization !== undefined,
    }),
  );
}
const input = () => screen.getByLabelText(en['buyer.search.input']);
const typeQuery = async (text: string) => {
  await fireEvent.changeText(input(), text);
  await settle();
};
const openSearch = async () => {
  await renderRouter(APP_DIR, { initialUrl: '/search' });
  expect(await screen.findByText(en['buyer.search.hint'])).toBeOnTheScreen();
};
const tab = (type: SearchType) => screen.getByTestId(`search-tab-${type}`);
const results = (type: SearchType) => screen.getByTestId(`search-results-${type}`).props as { onEndReached: () => void; refreshControl: { props: { onRefresh: () => void } } };
const listData = (type: SearchType) => (jest.requireMock<{ recorded: Record<string, SearchItem[]> }>('@shopify/flash-list').recorded[`search-results-${type}`] ?? []);
const label = (name: string) => new RegExp(`^${name},`);

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  api.on('GET /v1/categories', () => ok({ market_resolved: true, data: CATEGORIES }));
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

describe('typing and submitting', () => {
  it('Search asks at once and only once: the settled text sends nothing again', async () => {
    serve(({ type }) => page(type, [product('basket', 'Woven basket')]));
    await openSearch();
    await fireEvent.changeText(input(), 'basket');
    await fireEvent(input(), 'submitEditing');
    await act(async () => undefined);
    expect(calls()).toHaveLength(1);
    expect(calls()[0]?.query).toEqual({ q: 'basket', type: 'TOP' });
    await settle();
    expect(calls()).toHaveLength(1);
    expect(await screen.findByLabelText(label('Woven basket'))).toBeOnTheScreen();
  });

  it('a query of spaces asks nothing and keeps the start hint', async () => {
    serve(({ type }) => page(type, []));
    await openSearch();
    await typeQuery('    ');
    expect(calls()).toHaveLength(0);
    expect(screen.getByText(en['buyer.search.hint'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.search.too_short'])).not.toBeOnTheScreen();
  });

  it('the field takes no more than the 100 characters the server accepts', async () => {
    serve(({ type }) => page(type, []));
    await openSearch();
    expect(input().props.maxLength).toBe(100);
  });

  it('a query shortened below the minimum replaces the results with the reason and asks nothing for it', async () => {
    serve(({ type }) => page(type, [product('basket', 'Woven basket')]));
    await openSearch();
    await typeQuery('basket');
    await screen.findByLabelText(label('Woven basket'));
    await typeQuery('b');
    expect(screen.getByText(en['buyer.search.too_short'])).toBeOnTheScreen();
    expect(screen.queryByLabelText(label('Woven basket'))).not.toBeOnTheScreen();
    expect(calls()).toHaveLength(1);
  });

  it('clearing the field while the answer is still on its way: the late answer never appears', async () => {
    const held = deferred();
    serve(() => held.promise);
    await openSearch();
    await typeQuery('basket');
    expect(calls()).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.search.clear'] }));
    await act(async () => held.resolve(page('TOP', [product('basket', 'Woven basket')])));
    await settle();
    expect(screen.getByText(en['buyer.search.hint'])).toBeOnTheScreen();
    expect(screen.queryByLabelText(label('Woven basket'))).not.toBeOnTheScreen();
  });

  it('leaving Search while the answer is on its way: the late answer changes nothing and nothing breaks', async () => {
    const held = deferred();
    serve(() => held.promise);
    api.on('GET /v1/fyp', () => ok({ feed_session_id: null, algorithm_version: null, items: [], next_cursor: null }));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const r = await renderRouter(APP_DIR);
      await screen.findByText(en['buyer.for_you.empty']);
      await fireEvent.press(screen.getByRole('button', { name: en['buyer.search'] }));
      await fireEvent.changeText(await screen.findByLabelText(en['buyer.search.input']), 'basket');
      await settle();
      expect(calls()).toHaveLength(1);
      await act(() => router.back());
      await settle();
      expect(r.getPathname()).toBe('/home/for-you');
      await act(async () => held.resolve(page('TOP', [product('basket', 'Woven basket')])));
      await settle();
      expect(screen.getByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      expect(screen.queryByLabelText(label('Woven basket'))).not.toBeOnTheScreen();
      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });
});

describe('tabs and categories out of order', () => {
  it('a tab left before its answer arrives: the late answer never lands in the tab the Buyer is on, and coming back asks again', async () => {
    const products = deferred();
    serve(({ type }) =>
      type === 'PRODUCT_POST' ? products.promise : type === 'SELLER' ? page(type, [seller('basket-house', 'Basket House')]) : page(type, [scene(1, 'Morning light')]),
    );
    await openSearch();
    await typeQuery('basket');
    await screen.findByLabelText(/^Scene: Morning light,/);
    await fireEvent.press(tab('PRODUCT_POST'));
    await settle();
    await fireEvent.press(tab('SELLER'));
    expect(await screen.findByLabelText(/^Basket House, @basket-house/)).toBeOnTheScreen();
    await act(async () => products.resolve(page('PRODUCT_POST', [product('basket', 'Woven basket')])));
    await settle();
    expect(screen.queryByLabelText(label('Woven basket'))).not.toBeOnTheScreen();
    expect(tab('SELLER')).toBeSelected();
    // Coming back is a new read, not the stale answer.
    await fireEvent.press(tab('PRODUCT_POST'));
    await settle();
    expect(calls().filter((c) => c.query['type'] === 'PRODUCT_POST')).toHaveLength(2);
  });

  it('a category left before its answer arrives: the late answer never lands, and the new category starts at its first page', async () => {
    const fashion = deferred();
    serve(({ type, category, cursor }) =>
      category === 'FASHION'
        ? fashion.promise
        : category === 'COSMETICS'
          ? page(type, [product('balm', 'Rose lip balm')])
          : page(type, [product('mug', 'Plain mug'), product('scarf', 'Silk scarf')], cursor ? null : 'all-2'),
    );
    await openSearch();
    await typeQuery('rose');
    await fireEvent.press(tab('PRODUCT_POST'));
    await screen.findByLabelText(label('Plain mug'));
    await fireEvent.press(await screen.findByTestId('category-tab-FASHION'));
    await settle();
    await fireEvent.press(screen.getByTestId('category-tab-COSMETICS'));
    expect(await screen.findByLabelText(label('Rose lip balm'))).toBeOnTheScreen();
    await act(async () => fashion.resolve(page('PRODUCT_POST', [product('shirt', 'Linen shirt')])));
    await settle();
    expect(screen.queryByLabelText(label('Linen shirt'))).not.toBeOnTheScreen();
    expect(screen.queryByLabelText(label('Plain mug'))).not.toBeOnTheScreen();
    // No category request carries the cursor of the unfiltered list.
    expect(calls().filter((c) => c.query['category'] !== undefined).map((c) => c.query['cursor'])).toEqual([undefined, undefined]);
  });

  it('a category the server refuses returns the tab to All and asks again for the categories, without retrying the refusal', async () => {
    serve(({ type, category }) =>
      category ? problem(400, 'VALIDATION_FAILED', 'request', { path: 'category' }) : page(type, [product('mug', 'Plain mug')]),
    );
    await openSearch();
    await typeQuery('mug');
    await fireEvent.press(tab('PRODUCT_POST'));
    await screen.findByLabelText(label('Plain mug'));
    const reads = api.callsTo('GET /v1/categories').length;
    await fireEvent.press(await screen.findByTestId('category-tab-COSMETICS'));
    await waitFor(() => expect(screen.getByTestId('category-tab-ALL')).toBeSelected());
    expect(await screen.findByLabelText(label('Plain mug'))).toBeOnTheScreen();
    await waitFor(() => expect(api.callsTo('GET /v1/categories').length).toBeGreaterThan(reads));
    await settle();
    expect(calls().filter((c) => c.query['category'] === 'COSMETICS')).toHaveLength(1);
  });
});

describe('answers that fail', () => {
  it('a query the server refuses shows no results and is not retried by itself', async () => {
    serve(() => problem(400, 'VALIDATION_FAILED', 'request', { path: 'q', reason: 'QUERY_NO_TERMS' }));
    await openSearch();
    await typeQuery('!!');
    expect(await screen.findByText(en['error.request.validation_failed'])).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(30_000));
    expect(calls()).toHaveLength(1);
    expect(screen.queryByTestId('search-product')).not.toBeOnTheScreen();
    expect(screen.queryByText(/No results/)).not.toBeOnTheScreen();
  });

  it('rate limited: says when to try again, and Try again asks once more', async () => {
    let limited = true;
    serve(({ type }) => (limited ? problem(429, 'RATE_LIMITED', 'request', { retry_after_seconds: 12 }) : page(type, [product('basket', 'Woven basket')])));
    await openSearch();
    await typeQuery('basket');
    expect(await screen.findByText('Too many requests. Try again in 12 seconds.')).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(30_000));
    expect(calls()).toHaveLength(1);
    limited = false;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByLabelText(label('Woven basket'))).toBeOnTheScreen();
    expect(calls()).toHaveLength(2);
  });

  it('a failed next page keeps the results, says so, and Try again asks for the same cursor', async () => {
    let n = 0;
    serve(({ type, cursor }) =>
      !cursor ? page(type, [product('a', 'Item A')], 'p2') : n++ === 0 ? problem(500, 'INTERNAL', 'request') : page(type, [product('b', 'Item B')]),
    );
    await openSearch();
    await typeQuery('item');
    await fireEvent.press(tab('PRODUCT_POST'));
    await screen.findByLabelText(label('Item A'));
    await act(() => results('PRODUCT_POST').onEndReached());
    expect(await screen.findByText(new RegExp(en['buyer.list.more_failed']))).toBeOnTheScreen();
    expect(screen.getByLabelText(label('Item A'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByLabelText(label('Item B'))).toBeOnTheScreen();
    expect(calls().filter((c) => c.query['type'] === 'PRODUCT_POST').map((c) => c.query['cursor'])).toEqual([undefined, 'p2', 'p2']);
  });

  it('a query typed offline says offline and loads by itself when the connection returns', async () => {
    serve(({ type }) => page(type, [product('basket', 'Woven basket')]));
    await openSearch();
    try {
      await act(async () => onlineManager.setOnline(false));
      await typeQuery('basket');
      expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
      expect(screen.queryByText(/No results/)).not.toBeOnTheScreen();
      expect(calls()).toHaveLength(0);
      await act(async () => onlineManager.setOnline(true));
      expect(await screen.findByLabelText(label('Woven basket'))).toBeOnTheScreen();
      expect(calls()).toHaveLength(1);
    } finally {
      onlineManager.setOnline(true);
    }
  });
});

describe('a page that repeats what is shown', () => {
  it('lists each Product once and follows the cursor to the end', async () => {
    serve(({ type, cursor }) =>
      cursor ? page(type, [product('b', 'Item B'), product('c', 'Item C')]) : page(type, [product('a', 'Item A'), product('b', 'Item B')], 'p2'),
    );
    await openSearch();
    await typeQuery('item');
    await fireEvent.press(tab('PRODUCT_POST'));
    await screen.findByLabelText(label('Item A'));
    await act(() => results('PRODUCT_POST').onEndReached());
    await screen.findByText(en['buyer.list.end']);
    expect(listData('PRODUCT_POST').map((i) => (i.type === 'PRODUCT_POST' ? i.payload.slug : i.type))).toEqual(['a', 'b', 'c']);
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
  beforeEach(() => {
    listeners = [];
    appState = jest.spyOn(AppState, 'addEventListener');
    original = appState.getMockImplementation();
    appState.mockImplementation((type, listener) => {
      if (type === 'change') listeners.push(listener as (state: AppStateStatus) => void);
      return { remove: () => (listeners = listeners.filter((l) => l !== listener)) } as ReturnType<typeof AppState.addEventListener>;
    });
  });
  afterEach(() => {
    if (appState && original) appState.mockImplementation(original);
  });

  it('a short stay keeps the results; after the interval the same query and tab are read again and an unpublished Product is gone', async () => {
    let productReads = 0;
    serve(({ type }) =>
      page(type, type === 'PRODUCT_POST' && productReads++ > 0 ? [product('cup', 'Clay cup')] : [product('basket', 'Woven basket'), product('cup', 'Clay cup')]),
    );
    await openSearch();
    await typeQuery('cup');
    await fireEvent.press(tab('PRODUCT_POST'));
    await screen.findByLabelText(label('Woven basket'));
    const before = calls().length;
    await goTo('background');
    await act(() => jest.advanceTimersByTimeAsync(60_000));
    await goTo('active');
    await settle();
    expect(calls()).toHaveLength(before);
    await goTo('background');
    await act(() => jest.advanceTimersByTimeAsync(6 * 60_000));
    await goTo('active');
    await settle();
    expect(calls()).toHaveLength(before + 1);
    expect(calls().at(-1)?.query).toEqual({ q: 'cup', type: 'PRODUCT_POST', limit: '20' });
    expect(await screen.findByLabelText(label('Clay cup'))).toBeOnTheScreen();
    expect(screen.queryByLabelText(label('Woven basket'))).not.toBeOnTheScreen();
    expect(tab('PRODUCT_POST')).toBeSelected();
    expect(input().props.value).toBe('cup');
  });
});

describe('the Account changes while results are shown', () => {
  it('the guest Market replaces the Account Market: nothing of the Account answer stays', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    let expired = false;
    serve(({ type, authorized }) =>
      authorized
        ? expired
          ? problem(401, 'SESSION_EXPIRED', 'auth')
          : page(type, [product('mine', 'Account Market item')])
        : page(type, [product('theirs', 'Device Market item')]),
    );
    await openSearch();
    await typeQuery('market');
    await screen.findByLabelText(label('Account Market item'));
    expired = true;
    await act(() => results('TOP').refreshControl.props.onRefresh());
    expect(await screen.findByLabelText(label('Device Market item'))).toBeOnTheScreen();
    expect(screen.queryByLabelText(label('Account Market item'))).not.toBeOnTheScreen();
    expect(calls().at(-1)?.headers.Authorization).toBeUndefined();
  });
});

describe('result types', () => {
  it('Top lists every type the server returned in the server order, never regrouped or dropped', async () => {
    const served = [scene(1, 'Morning light'), product('basket', 'Woven basket'), seller('basket-house', 'Basket House'), product('cup', 'Clay cup'), scene(2, 'Evening light'), seller('cup-house', 'Cup House')];
    serve(({ type }) => page(type, served));
    await openSearch();
    await typeQuery('house');
    await screen.findByLabelText(label('Woven basket'));
    expect(listData('TOP').map((i) => i.type)).toEqual(['SCENE_POST', 'PRODUCT_POST', 'SELLER', 'PRODUCT_POST', 'SCENE_POST', 'SELLER']);
    expect(screen.getAllByTestId('search-product')).toHaveLength(2);
    expect(screen.getAllByTestId('search-seller')).toHaveLength(2);
    expect(screen.getAllByTestId('search-scene')).toHaveLength(2);
  });

  it('a result type this app does not know is not drawn and does not break the list', async () => {
    const unknown = { type: 'COLLECTION', payload: { ref: 'c1', name: 'A collection' } } as unknown as SearchItem;
    serve(({ type }) => page(type, [unknown, product('basket', 'Woven basket'), unknown, seller('basket-house', 'Basket House')]));
    await openSearch();
    await typeQuery('basket');
    expect(await screen.findByLabelText(label('Woven basket'))).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Basket House, @basket-house/)).toBeOnTheScreen();
    expect(screen.queryByText('A collection')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('search-scene')).not.toBeOnTheScreen();
  });

  it('a query with no results says so with the query and invents no suggestion', async () => {
    serve(({ type }) => page(type, []));
    await openSearch();
    await typeQuery('zzqx');
    expect(await screen.findByText('No results for "zzqx".')).toBeOnTheScreen();
    expect(screen.queryByText(/popular|trending|recent|did you mean|try searching/i)).not.toBeOnTheScreen();
  });
});

describe('what Search keeps', () => {
  it('stores nothing about the query on the device', async () => {
    serve(({ type }) => page(type, [product('basket', 'Woven basket')]));
    await openSearch();
    await typeQuery('basket');
    await screen.findByLabelText(label('Woven basket'));
    await fireEvent.press(tab('PRODUCT_POST'));
    await screen.findByLabelText(label('Woven basket'));
    for (const [key, value] of secureStore.memory) expect(`${key} ${value}`).not.toContain('basket');
    for (const [key, value] of secureStore.setItemAsync.mock.calls) expect(`${key} ${value}`).not.toContain('basket');
    expect(JSON.stringify(useUiStore.getState())).not.toContain('basket');
  });
});
