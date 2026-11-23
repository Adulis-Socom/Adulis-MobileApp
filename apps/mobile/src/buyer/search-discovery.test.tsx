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
 * How Marketplace Search behaves when typing, taps, answers, the connection, the clock and
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
const page = (type: SearchType, items: SearchItem[], next: string | null = null): Reply =>
  ok({ market_resolved: true, type, algorithm_version: 'lexical-trgm-v1', items, next_cursor: next } satisfies SearchPage);
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
    // At once, before any typing delay could hide a list that is still mounted.
    expect(screen.getByText(en['buyer.search.hint'])).toBeOnTheScreen();
    await act(async () => held.resolve(page('TOP', [product('basket', 'Woven basket')])));
    expect(screen.queryByLabelText(label('Woven basket'))).not.toBeOnTheScreen();
    await settle();
    expect(screen.getByText(en['buyer.search.hint'])).toBeOnTheScreen();
    expect(screen.queryByLabelText(label('Woven basket'))).not.toBeOnTheScreen();
  });

  it('while the first answer is on its way it says Searching, never "No results"; the answer replaces it', async () => {
    const held = deferred();
    serve(() => held.promise);
    await openSearch();
    await typeQuery('basket');
    expect(screen.getByText(en['buyer.search.loading'])).toBeOnTheScreen();
    expect(screen.queryByText(/No results/)).not.toBeOnTheScreen();
    await act(async () => held.resolve(page('TOP', [product('basket', 'Woven basket')])));
    expect(await screen.findByLabelText(label('Woven basket'))).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.search.loading'])).not.toBeOnTheScreen();
  });

  it('leaving Search while the answer is on its way: the late answer is not kept, and opening Search again asks again', async () => {
    const held = deferred();
    let asked = 0;
    serve(({ type }) => (asked++ === 0 ? held.promise : page(type, [product('basket', 'Woven basket')])));
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
      await act(async () => held.resolve(page('TOP', [product('stale', 'Stale answer')])));
      await settle();
      expect(screen.getByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      expect(screen.queryByLabelText(label('Stale answer'))).not.toBeOnTheScreen();
      // Search opened again is a new screen: the answer that landed late was not kept for it.
      await fireEvent.press(screen.getByRole('button', { name: en['buyer.search'] }));
      await typeQuery('basket');
      expect(await screen.findByLabelText(label('Woven basket'))).toBeOnTheScreen();
      expect(screen.queryByLabelText(label('Stale answer'))).not.toBeOnTheScreen();
      expect(calls()).toHaveLength(2);
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

describe('the order of results', () => {
  it('says how results are ordered once there are results, on every tab, and never as popularity, Trust, payment or personal', async () => {
    serve(({ type }) =>
      page(type, type === 'SELLER' ? [seller('seller-1', 'Store 1')] : type === 'SCENE_POST' ? [scene(1, 'Seller scene 1')] : [product('mug', 'Plain mug')]),
    );
    await openSearch();
    await typeQuery('mug');
    expect(await screen.findByText(en['buyer.search.order'])).toBeOnTheScreen();
    for (const type of ['PRODUCT_POST', 'SCENE_POST', 'SELLER'] as const) {
      await fireEvent.press(tab(type));
      expect(await screen.findByText(en['buyer.search.order'])).toBeOnTheScreen();
    }
    expect(en['buyer.search.order']).not.toMatch(/popular|best|top|trust|sponsor|paid|personal|recommend|for you/i);
  });

  it('is not drawn where there are no results: an empty answer, a refusal or a query that is too short', async () => {
    serve(({ q }) => (q === 'zzzz' ? page('TOP', []) : problem(400, 'VALIDATION_FAILED', 'request', { path: 'q', reason: 'QUERY_NO_TERMS' })));
    await openSearch();
    await typeQuery('zzzz');
    expect(await screen.findByText(new RegExp('^No results'))).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.search.order'])).not.toBeOnTheScreen();
    await typeQuery('!!');
    expect(await screen.findByText(en['buyer.search.no_terms'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.search.order'])).not.toBeOnTheScreen();
    await typeQuery('z');
    expect(await screen.findByText(en['buyer.search.too_short'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.search.order'])).not.toBeOnTheScreen();
  });
});

describe('a query the server would always refuse', () => {
  const NO_TERMS = () => screen.getByText(en['buyer.search.no_terms']);

  it.each([['exclamation marks', '!!'], ['percent signs', '%%%'], ['dots', '...'], ['two emoji', '\u{1F600}\u{1F600}']])(
    '%s: the reason is said at once, nothing is sent, and there is no Try again',
    async (_name, text) => {
      serve(({ type }) => page(type, [product('basket', 'Woven basket')]));
      await openSearch();
      await typeQuery(text);
      expect(NO_TERMS()).toBeOnTheScreen();
      expect(calls()).toHaveLength(0);
      expect(screen.queryByRole('button', { name: en['common.retry'] })).not.toBeOnTheScreen();
      expect(screen.queryByText(en['buyer.search.too_short'])).not.toBeOnTheScreen();
    },
  );

  it('one character is too short, whatever it is; two with a letter or a digit are sent', async () => {
    serve(({ type }) => page(type, [product('basket', 'Woven basket')]));
    await openSearch();
    await typeQuery('!');
    expect(screen.getByText(en['buyer.search.too_short'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.search.no_terms'])).not.toBeOnTheScreen();
    expect(calls()).toHaveLength(0);
    await typeQuery('a!');
    await screen.findByLabelText(label('Woven basket'));
    expect(calls()).toHaveLength(1);
    expect(calls()[0]?.query['q']).toBe('a!');
  });

  it('is judged as the server judges it: after NFKC, a character that folds to letters is sent, one that folds to dots is not', async () => {
    serve(({ type }) => page(type, [product('basket', 'Woven basket')]));
    await openSearch();
    // U+FB03 folds to "ffi" and U+2100 to "a/c": each is long enough and has letters on the server.
    for (const text of ['\uFB03', '\u2100']) {
      await typeQuery(text);
      await screen.findByLabelText(label('Woven basket'));
    }
    expect(calls().map((c) => c.query['q'])).toEqual(['\uFB03', '\u2100']);
    // U+2026 folds to "...": no term.
    await typeQuery('\u2026');
    expect(NO_TERMS()).toBeOnTheScreen();
    expect(calls()).toHaveLength(2);
  });

  it('leaves as soon as the text has a term: the reason goes, one request is made for the new text, nothing for the old', async () => {
    serve(({ type }) => page(type, [product('basket', 'Woven basket')]));
    await openSearch();
    await typeQuery('!!');
    expect(NO_TERMS()).toBeOnTheScreen();
    await typeQuery('mug');
    await screen.findByLabelText(label('Woven basket'));
    expect(screen.queryByText(en['buyer.search.no_terms'])).not.toBeOnTheScreen();
    expect(calls().map((c) => c.query['q'])).toEqual(['mug']);
  });

  // What the server counts as a letter or a digit, written as escapes so the test carries the characters it names.
  it.each([
    ['an Ethiopic word', '\u1260\u1293'],
    ['Ethiopic digits', '\u1369\u136A'],
    ['digits only', '12'],
    ['full-width digits (they fold to 12)', '\uFF11\uFF12'],
  ])('%s is sent: it has a letter or a digit as the server counts them', async (_name, text) => {
    serve(({ type }) => page(type, [product('basket', 'Woven basket')]));
    await openSearch();
    await typeQuery(text);
    await screen.findByLabelText(label('Woven basket'));
    expect(calls()).toHaveLength(1);
    expect(calls()[0]?.query['q']).toBe(text);
    expect(screen.queryByText(en['buyer.search.no_terms'])).not.toBeOnTheScreen();
  });

  // The server refuses each of these (search.logic.ts: fold, length first, then the term check); none is sent.
  it.each([
    ['two zero-width spaces (not white space, no term)', '\u200B\u200B', 'buyer.search.no_terms'],
    ['a letter and its combining accent (one character after the fold)', 'e\u0301', 'buyer.search.too_short'],
    ['no-break spaces only (white space: nothing typed)', '\u00A0\u00A0', 'buyer.search.hint'],
  ] as const)('%s: the reason is said, nothing is sent', async (_name, text, key) => {
    serve(({ type }) => page(type, [product('basket', 'Woven basket')]));
    await openSearch();
    await typeQuery(text);
    expect(screen.getByText(en[key])).toBeOnTheScreen();
    expect(calls()).toHaveLength(0);
  });

  describe('where this runtime cannot normalise the text', () => {
    const original = String.prototype.normalize;
    afterEach(() => {
      Object.defineProperty(String.prototype, 'normalize', { value: original, configurable: true, writable: true });
    });

    it.each([
      ['is missing', undefined],
      [
        'throws',
        () => {
          throw new RangeError('The normalization form should be one of NFC, NFD, NFKC, NFKD.');
        },
      ],
    ])('a normalize that %s: the guard steps aside, so the query is sent and the server decides', async (_name, replacement) => {
      serve(() => problem(400, 'VALIDATION_FAILED', 'request', { path: 'q', reason: 'QUERY_NO_TERMS' }));
      await openSearch();
      Object.defineProperty(String.prototype, 'normalize', { value: replacement, configurable: true, writable: true });
      await typeQuery('!!');
      expect(calls()).toHaveLength(1);
      // The server's own named refusal is still said, with no Try again.
      expect(await screen.findByText(en['buyer.search.no_terms'])).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: en['common.retry'] })).not.toBeOnTheScreen();
    });

    // B24-017: only the no-terms case was covered. The too-long guard needs the folded length, so without a fold it
    // steps aside and the server decides; the too-short guard falls back to the typed length and still applies.
    it.each([
      ['is missing', undefined],
      [
        'throws',
        () => {
          throw new RangeError('The normalization form should be one of NFC, NFD, NFKC, NFKD.');
        },
      ],
    ])('a normalize that %s: a query over the length cap is sent (the server decides), and one under the floor is still not', async (_name, replacement) => {
      serve(() => problem(400, 'VALIDATION_FAILED', 'request', { path: 'q', reason: 'QUERY_TOO_LONG' }));
      await openSearch();
      Object.defineProperty(String.prototype, 'normalize', { value: replacement, configurable: true, writable: true });
      await typeQuery('x'.repeat(101));
      expect(calls()).toHaveLength(1);
      expect(await screen.findByText(en['buyer.search.too_long'])).toBeOnTheScreen(); // the server's own refusal, named
      await typeQuery('a');
      expect(screen.getByText(en['buyer.search.too_short'])).toBeOnTheScreen();
      expect(calls()).toHaveLength(1); // nothing new was sent for the one-character text
    });
  });
});

describe('answers that fail', () => {
  it('a query the server refuses for having no letter or digit shows its reason, offers no Try again that could not help, and is not retried by itself', async () => {
    // "ab" is a query the app sends: only the server's own answer reaches this path.
    serve(() => problem(400, 'VALIDATION_FAILED', 'request', { path: 'q', reason: 'QUERY_NO_TERMS' }));
    await openSearch();
    await typeQuery('ab');
    // The server names the reason (no letter or digit), so the sentence says what to change.
    expect(await screen.findByText(en['buyer.search.no_terms'])).toBeOnTheScreen();
    expect(screen.queryByText(en['error.request.validation_failed'])).not.toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(30_000));
    expect(calls()).toHaveLength(1);
    expect(screen.queryByTestId('search-product')).not.toBeOnTheScreen();
    expect(screen.queryByText(/No results/)).not.toBeOnTheScreen();
    // The same query would be refused again, so no Try again is offered.
    expect(screen.queryByRole('button', { name: en['common.retry'] })).not.toBeOnTheScreen();
  });

  it('only the reason the server names changes the sentence: any other refusal keeps the generic one, with its Try again', async () => {
    // QUERY_TOO_LONG used to be this example; it now has its own sentence (BUY-06A), so another reason stands in.
    serve(() => problem(400, 'VALIDATION_FAILED', 'request', { path: 'q', reason: 'QUERY_REQUIRED' }));
    await openSearch();
    await typeQuery('mug');
    expect(await screen.findByText(en['error.request.validation_failed'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.search.no_terms'])).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    await act(async () => undefined);
    expect(calls()).toHaveLength(2);
  });

  it('a server QUERY_TOO_SHORT refusal (BUY-06B, B24-016) says the minimum, offers no Try again that could not help, and is not retried by itself', async () => {
    serve(() => problem(400, 'VALIDATION_FAILED', 'request', { path: 'q', reason: 'QUERY_TOO_SHORT' }));
    await openSearch();
    await typeQuery('mug');
    expect(await screen.findByText(en['buyer.search.too_short'])).toBeOnTheScreen();
    expect(screen.queryByText(en['error.request.validation_failed'])).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['common.retry'] })).not.toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(30_000));
    expect(calls()).toHaveLength(1);
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

  it('Top is a bounded set: it never says that is everything, while a tab says it at its real end', async () => {
    serve(({ type }) => page(type, [product('basket', 'Woven basket'), seller('basket-house', 'Basket House')]));
    await openSearch();
    await typeQuery('basket');
    await screen.findByLabelText(label('Woven basket'));
    expect(screen.queryByText(en['buyer.list.end'])).not.toBeOnTheScreen();
    expect(screen.queryByTestId('load-more')).not.toBeOnTheScreen();
    await fireEvent.press(tab('PRODUCT_POST'));
    await screen.findByLabelText(label('Woven basket'));
    expect(screen.getByText(en['buyer.list.end'])).toBeOnTheScreen();
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

describe('a query that is too long once normalised (BUY-06A, B23-006)', () => {
  const TOO_LONG = () => screen.getByText(en['buyer.search.too_long']);
  // U+FDFA folds to 18 characters under NFKC, so six of them are 6 typed characters and 108 on the server.
  const LONG_AFTER_FOLD = 'ﷺ'.repeat(6);

  it('is said at once, nothing is sent, and there is no Try again that cannot help', async () => {
    serve(({ type }) => page(type, [product('basket', 'Woven basket')]));
    await openSearch();
    expect([...LONG_AFTER_FOLD.normalize('NFKC')]).toHaveLength(108);
    await typeQuery(LONG_AFTER_FOLD);
    expect(TOO_LONG()).toBeOnTheScreen();
    expect(calls()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: en['common.retry'] })).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.search.too_short'])).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.search.no_terms'])).not.toBeOnTheScreen();
  });

  it('exactly the limit after normalisation is sent; one more is not, and a shorter edit searches again', async () => {
    serve(({ type }) => page(type, [product('basket', 'Woven basket')]));
    await openSearch();
    const atLimit = `${'ﷺ'.repeat(5)}${'a'.repeat(10)}`; // 90 + 10 = 100
    await typeQuery(atLimit);
    await screen.findByLabelText(label('Woven basket'));
    expect(calls()).toHaveLength(1);
    await typeQuery(`${atLimit}a`); // 101
    expect(TOO_LONG()).toBeOnTheScreen();
    expect(calls()).toHaveLength(1);
    await typeQuery('ﷺﷺ');
    await screen.findByLabelText(label('Woven basket'));
    expect(screen.queryByText(en['buyer.search.too_long'])).not.toBeOnTheScreen();
    expect(calls()).toHaveLength(2);
  });

  it('counts characters, not UTF-16 units: 97 characters that are 103 units are sent', async () => {
    serve(({ type }) => page(type, [product('basket', 'Woven basket')]));
    await openSearch();
    // Five U+FDFA fold to 90, six emoji are 6 characters but 12 units, one letter: 97 characters, 103 units.
    const text = `${'ﷺ'.repeat(5)}${'😀'.repeat(6)}a`;
    expect([...text.normalize('NFKC')]).toHaveLength(97);
    expect(text.normalize('NFKC').length).toBe(103);
    await typeQuery(text);
    await screen.findByLabelText(label('Woven basket'));
    expect(screen.queryByText(en['buyer.search.too_long'])).not.toBeOnTheScreen();
    expect(calls()).toHaveLength(1);
  });

  it('the server stays the authority: a refusal for length the device could not foresee is named, with no Try again', async () => {
    serve(() => problem(400, 'VALIDATION_FAILED', 'request', { path: 'q', reason: 'QUERY_TOO_LONG' }));
    await openSearch();
    await typeQuery('basket');
    expect(await screen.findByText(en['buyer.search.too_long'])).toBeOnTheScreen();
    expect(screen.queryByText(en['error.request.validation_failed'])).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['common.retry'] })).not.toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(30_000));
    expect(calls()).toHaveLength(1);
  });
});
