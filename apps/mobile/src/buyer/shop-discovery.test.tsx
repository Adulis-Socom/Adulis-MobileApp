import { en } from '@adulis/locale/mobile';
import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';

import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, installFakeApi, problem, shopProduct, type Reply, type ShopProduct } from '../testing/fake-api';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * BUY-06: how the Shop and its category tabs behave when the network, the clock, the Account or
 * the Buyer's own taps do not arrive in the tidy order -- on the real route tree against the fake
 * API speaking the generated contract. The server filters and orders; the app only asks and draws.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const SHOP = 'GET /v1/shop/products';
const CATEGORIES = [
  { id: 'ca7e0000-0000-4000-8000-000000000001', code: 'FASHION', parent_id: null, label_key: 'catalogue.category.fashion', display_order: 10 },
  { id: 'ca7e0000-0000-4000-8000-000000000002', code: 'COSMETICS', parent_id: null, label_key: 'catalogue.category.cosmetics', display_order: 20 },
];
const GUEST_CATEGORIES = [
  { id: 'ca7e0000-0000-4000-8000-000000000003', code: 'ELECTRONICS', parent_id: null, label_key: 'catalogue.category.electronics', display_order: 30 },
];
const MUG = shopProduct('mug', 'Plain mug');
const SCARF = shopProduct('scarf', 'Silk scarf');
const BALM = shopProduct('balm', 'Rose lip balm');

let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
const page = (data: ShopProduct[], next_cursor: string | null = null): Reply => ok({ market_resolved: true, data, next_cursor });
const calls = () => api.callsTo(SHOP);
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const tab = (code: string) => screen.getByTestId(`category-tab-${code}`);
const label = (name: string) => new RegExp(`^${name},`);
const deferred = () => {
  let resolve!: (reply: Reply) => void;
  const promise = new Promise<Reply>((r) => (resolve = r));
  return { promise, resolve };
};
const openShop = async () => {
  const r = await renderRouter(APP_DIR, { initialUrl: '/shop' });
  expect(await screen.findByText(en['buyer.shop.order'])).toBeOnTheScreen();
  return r;
};
const list = () => screen.getByTestId('shop-products').props as { onEndReached: () => void; refreshControl: { props: { onRefresh: () => void } } };
const pull = () => act(() => list().refreshControl.props.onRefresh());
const endReached = () => act(() => list().onEndReached());
/** A first page taller than the list's Jest viewport: nothing loads until the Buyer asks. */
const tall = (prefix = 'p') => Array.from({ length: 20 }, (_, i) => shopProduct(`${prefix}${i}`, `Item ${prefix}${i}`));

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  api.on('GET /v1/categories', () => ok({ market_resolved: true, data: CATEGORIES }));
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

describe('Shop categories out of order', () => {
  it('a slow answer for a category the Buyer has left never lands in the list they are on', async () => {
    const fashion = deferred();
    api.on(SHOP, (call) => (call.query.category === 'FASHION' ? fashion.promise : call.query.category === 'COSMETICS' ? page([BALM]) : page([MUG])));
    await openShop();
    await screen.findByLabelText(label('Plain mug'));
    await fireEvent.press(tab('FASHION'));
    await settle();
    expect(calls().at(-1)?.query['category']).toBe('FASHION');
    await fireEvent.press(tab('COSMETICS'));
    expect(await screen.findByLabelText(label('Rose lip balm'))).toBeOnTheScreen();
    await act(async () => fashion.resolve(page([SCARF])));
    await settle();
    expect(screen.queryByLabelText(label('Silk scarf'))).not.toBeOnTheScreen();
    expect(screen.getByLabelText(label('Rose lip balm'))).toBeOnTheScreen();
    expect(tab('COSMETICS')).toBeSelected();
  });

  it('a next page still loading for one list never joins the list the Buyer moved to, which starts at its first page', async () => {
    const second = deferred();
    api.on(SHOP, (call) => (call.query.category === 'FASHION' ? page([SCARF]) : call.query.cursor ? second.promise : page(tall(), 'all-2')));
    await openShop();
    await screen.findByLabelText(label('Item p0'));
    await endReached();
    await settle();
    expect(calls().map((c) => [c.query['category'] ?? null, c.query['cursor'] ?? null])).toEqual([[null, null], [null, 'all-2']]);
    await fireEvent.press(tab('FASHION'));
    expect(await screen.findByLabelText(label('Silk scarf'))).toBeOnTheScreen();
    await act(async () => second.resolve(page([shopProduct('late', 'Late item')])));
    await settle();
    expect(screen.queryByLabelText(label('Late item'))).not.toBeOnTheScreen();
    expect(screen.getByLabelText(label('Silk scarf'))).toBeOnTheScreen();
    // The Fashion list never carried All's cursor.
    expect(calls().filter((c) => c.query['category'] === 'FASHION').map((c) => c.query['cursor'])).toEqual([undefined]);
    // Back on All the list starts again from its first page.
    await fireEvent.press(tab('ALL'));
    await screen.findByLabelText(label('Item p0'));
    expect(calls().at(-1)?.query).toEqual({ limit: '30' });
  });
});

describe('a category list that cannot be read', () => {
  it('says so under the tabs, keeps the tabs, and Try again reads that category and nothing else', async () => {
    let failing = true;
    api.on(SHOP, (call) => (call.query.category === 'FASHION' ? (failing ? problem(500, 'INTERNAL', 'request') : page([SCARF])) : page([MUG])));
    await openShop();
    await screen.findByLabelText(label('Plain mug'));
    await fireEvent.press(tab('FASHION'));
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    // The Buyer is never locked into the failed category: the tabs stay, and the empty sentence is not claimed.
    expect(tab('ALL')).toBeOnTheScreen();
    expect(tab('FASHION')).toBeSelected();
    expect(screen.queryByText(en['buyer.shop.category_empty'])).not.toBeOnTheScreen();
    failing = false;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByLabelText(label('Silk scarf'))).toBeOnTheScreen();
    expect(calls().slice(-2).map((c) => c.query['category'])).toEqual(['FASHION', 'FASHION']);
    expect(screen.queryByText(en['error.request.internal'])).not.toBeOnTheScreen();
  });

  it('after a failed category, All Products still lists', async () => {
    api.on(SHOP, (call) => (call.query.category === 'FASHION' ? problem(500, 'INTERNAL', 'request') : page([MUG])));
    await openShop();
    await screen.findByLabelText(label('Plain mug'));
    await fireEvent.press(tab('FASHION'));
    await screen.findByText(en['error.request.internal']);
    await fireEvent.press(tab('ALL'));
    expect(await screen.findByLabelText(label('Plain mug'))).toBeOnTheScreen();
    expect(screen.queryByText(en['error.request.internal'])).not.toBeOnTheScreen();
  });

  it('offline after the Shop loaded: a category says offline (never empty) and loads by itself when the connection returns', async () => {
    api.on(SHOP, (call) => (call.query.category === 'FASHION' ? page([SCARF]) : page([MUG])));
    await openShop();
    await screen.findByLabelText(label('Plain mug'));
    try {
      await act(async () => onlineManager.setOnline(false));
      await fireEvent.press(tab('FASHION'));
      await settle();
      expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
      expect(screen.queryByText(en['buyer.shop.category_empty'])).not.toBeOnTheScreen();
      expect(calls().filter((c) => c.query['category'] === 'FASHION')).toHaveLength(0);
      await act(async () => onlineManager.setOnline(true));
      expect(await screen.findByLabelText(label('Silk scarf'))).toBeOnTheScreen();
      expect(screen.queryByText(en['common.offline'])).not.toBeOnTheScreen();
    } finally {
      onlineManager.setOnline(true);
    }
  });
});

describe('a Market that cannot be found, with a category chosen', () => {
  it('says no Market with a retry, never an empty category', async () => {
    let resolved = false;
    api.on(SHOP, (call) =>
      call.query.category === 'FASHION'
        ? resolved
          ? page([SCARF])
          : ok({ market_resolved: false, data: [], next_cursor: null })
        : page([MUG]),
    );
    await openShop();
    await screen.findByLabelText(label('Plain mug'));
    await fireEvent.press(tab('FASHION'));
    expect(await screen.findByText(en['buyer.shop.no_market'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.shop.category_empty'])).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.shop.empty'])).not.toBeOnTheScreen();
    resolved = true;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByLabelText(label('Silk scarf'))).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.shop.no_market'])).not.toBeOnTheScreen();
  });
});

describe('a pull and the background on a filtered list', () => {
  it('a pull reads the chosen category from its first page again, with the categories', async () => {
    let n = 0;
    api.on(SHOP, (call) => (call.query.category === 'FASHION' ? page(n++ === 0 ? [SCARF] : [shopProduct('shirt', 'Linen shirt')]) : page([MUG])));
    await openShop();
    await screen.findByLabelText(label('Plain mug'));
    await fireEvent.press(tab('FASHION'));
    await screen.findByLabelText(label('Silk scarf'));
    const reads = api.callsTo('GET /v1/categories').length;
    await pull();
    expect(await screen.findByLabelText(label('Linen shirt'))).toBeOnTheScreen();
    expect(screen.queryByLabelText(label('Silk scarf'))).not.toBeOnTheScreen();
    expect(calls().at(-1)?.query).toEqual({ limit: '30', category: 'FASHION' });
    expect(tab('FASHION')).toBeSelected();
    await waitFor(() => expect(api.callsTo('GET /v1/categories').length).toBeGreaterThan(reads));
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

    it('after the interval the chosen category is read again from its first page and the choice is kept; an unpublished Product is gone', async () => {
      let n = 0;
      api.on(SHOP, (call) =>
        call.query.category === 'FASHION' ? page(n++ === 0 ? [SCARF, shopProduct('shirt', 'Linen shirt')] : [SCARF]) : page([MUG]),
      );
      await openShop();
      await screen.findByLabelText(label('Plain mug'));
      await fireEvent.press(tab('FASHION'));
      await screen.findByLabelText(label('Linen shirt'));
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
      expect(calls().at(-1)?.query).toEqual({ limit: '30', category: 'FASHION' });
      expect(await screen.findByLabelText(label('Silk scarf'))).toBeOnTheScreen();
      expect(screen.queryByLabelText(label('Linen shirt'))).not.toBeOnTheScreen();
      expect(tab('FASHION')).toBeSelected();
    });
  });
});

describe('the Account changes while a category is chosen', () => {
  it('the guest Market replaces the Account Market: its own categories, its own list, nothing of the Account answer', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    let expired = false;
    api.on('GET /v1/categories', (call) => ok({ market_resolved: true, data: call.headers.Authorization ? CATEGORIES : GUEST_CATEGORIES }));
    api.on(SHOP, (call) => {
      if (call.headers.Authorization) return expired ? problem(401, 'SESSION_EXPIRED', 'auth') : page(call.query.category === 'COSMETICS' ? [BALM] : [MUG]);
      // The guest's Market does not offer Cosmetics: the governed refusal.
      return call.query.category ? problem(400, 'VALIDATION_FAILED', 'request', { path: 'category' }) : page([shopProduct('guest', 'Device Market item')]);
    });
    await openShop();
    await screen.findByLabelText(label('Plain mug'));
    await fireEvent.press(tab('COSMETICS'));
    await screen.findByLabelText(label('Rose lip balm'));
    expired = true;
    await pull();
    expect(await screen.findByLabelText(label('Device Market item'))).toBeOnTheScreen();
    await waitFor(() => expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(['All Products', 'Electronics']));
    expect(tab('ALL')).toBeSelected();
    expect(screen.queryByLabelText(label('Rose lip balm'))).not.toBeOnTheScreen();
    expect(screen.queryByTestId('category-tab-COSMETICS')).not.toBeOnTheScreen();
    expect(calls().at(-1)?.headers.Authorization).toBeUndefined();
    expect(calls().at(-1)?.query['category']).toBeUndefined();
  });
});

describe('pages that repeat what is shown', () => {
  let announce: jest.SpyInstance;
  beforeEach(() => {
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  });
  afterEach(() => announce.mockRestore());

  it('a page of repeats adds nothing, says nothing, and Load more still reaches the next cursor', async () => {
    const first = tall();
    const pages: Record<string, Reply> = {
      first: page(first, 'p-2'),
      'p-2': page([first[0]!, first[1]!], 'p-3'),
      'p-3': page([shopProduct('new', 'Brand new item')], null),
    };
    api.on(SHOP, (call) => pages[call.query.cursor ?? 'first']!);
    await openShop();
    await screen.findByLabelText(label('Item p0'));
    await settle();
    const more = () => screen.getByRole('button', { name: en['buyer.list.load_more'] });
    await fireEvent.press(more());
    await waitFor(() => expect(calls()).toHaveLength(2));
    await settle();
    // Nothing new arrived: the button is still offered, enabled, with no "loaded more" sentence.
    expect(more()).toBeEnabled();
    expect(screen.queryByText(en['buyer.list.end'])).not.toBeOnTheScreen();
    expect(announce).not.toHaveBeenCalledWith(expect.stringMatching(/^Loaded/));
    await fireEvent.press(more());
    expect(await screen.findByText(en['buyer.list.end'])).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Loaded 1 more, just above.');
    expect(calls().map((c) => c.query['cursor'])).toEqual([undefined, 'p-2', 'p-3']);
  });
});

describe('Search from the Shop', () => {
  it('the Shop offers Search by name; it opens Search, and Back returns to the same Shop without reading it again', async () => {
    api.on(SHOP, () => page([MUG]));
    const r = await openShop();
    await screen.findByLabelText(label('Plain mug'));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.search'] }));
    expect(await screen.findByLabelText(en['buyer.search.input'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/search');
    await act(() => router.back());
    await settle();
    expect(r.getPathname()).toBe('/shop');
    expect(screen.getByLabelText(label('Plain mug'))).toBeOnTheScreen();
    expect(tab('ALL')).toBeSelected();
    expect(calls()).toHaveLength(1);
  });
});
