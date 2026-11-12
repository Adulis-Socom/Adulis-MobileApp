import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, AppState, Dimensions, type AppStateStatus } from 'react-native';

import { useUiStore } from '../state/ui-store';
import {
  GOOD_TOKEN,
  installFakeApi,
  problem,
  publicScene,
  sellerProduct,
  sellerReview,
  sellerScene,
  storefront,
  storefrontProduct,
  type Reply,
} from '../testing/fake-api';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * WO-006: the Buyer Seller Profile on the real route tree against the fake API speaking the
 * generated contract. Entry from Explore the Scene and from the Product; the four tabs in order;
 * every list paginated by the server's cursor; only what the server sends.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const HANDLE = 'seller-1';
const HEADER = `GET /v1/storefronts/${HANDLE}`;
const SCENES = `GET /v1/storefronts/${HANDLE}/scenes`;
const PRODUCTS = `GET /v1/storefronts/${HANDLE}/products`;
const REVIEWS = `GET /v1/storefronts/${HANDLE}/reviews`;

let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
const gone = (): Reply => problem(404, 'NOT_FOUND', 'request');
function serve(route: string, ...replies: Reply[]) {
  let i = 0;
  api.on(route, () => replies[Math.min(i++, replies.length - 1)]!);
}
const calls = (route: string) => api.callsTo(route);
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const tab = (name: string) => screen.getByRole('tab', { name });
const endReached = (testID: string) =>
  act(() => (screen.getByTestId(testID).props as { onEndReached: () => void }).onEndReached());

function serveProfile() {
  serve(HEADER, ok(storefront(HANDLE)));
  serve(SCENES, ok({ data: [sellerScene(1), sellerScene(2)], next_cursor: null }));
}
const openProfile = async () => {
  serveProfile();
  const r = await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
  expect(await screen.findByRole('header', { name: 'Store 1' })).toBeOnTheScreen();
  return r;
};

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
});

describe('the Seller Profile', () => {
  it('shows the real public header and opens on Scenes, in the canonical tab order', async () => {
    await openProfile();
    expect(screen.getByText('@seller-1')).toBeOnTheScreen();
    expect(screen.getByText('Trust level: Established')).toBeOnTheScreen();
    expect(screen.getByText('Completed handoffs: 12')).toBeOnTheScreen();
    expect(screen.getByText('Seller service: 4 out of 5 from 3 reviews')).toBeOnTheScreen();
    const tabs = screen.getAllByRole('tab').map((t) => (t.props as { testID: string }).testID);
    expect(tabs).toEqual(['seller-tab-scenes', 'seller-tab-products', 'seller-tab-reviews', 'seller-tab-about']);
    expect(tab(en['buyer.seller.tab.scenes'])).toBeSelected();
    expect(await screen.findByLabelText('Scene: Seller scene 1')).toBeOnTheScreen();
    // No rate is shown (no public denominator), and no invented action.
    expect(screen.queryByText(/0\.0000|%/)).not.toBeOnTheScreen();
    for (const action of ['Follow', 'Message', 'Share', 'Add to cart', 'Write a review']) {
      expect(screen.queryByRole('button', { name: action })).not.toBeOnTheScreen();
    }
  });

  it('a Seller with no review says so, never a score', async () => {
    serve(HEADER, ok(storefront(HANDLE, { review_summary: { count: 0, average_rating: null, basis_counts: { FINAL_HANDOFF: 0, VERIFIED_ORDER_FAILURE: 0 } } })));
    serve(SCENES, ok({ data: [], next_cursor: null }));
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    expect(await screen.findByText(en['buyer.seller.no_reviews'])).toBeOnTheScreen();
    expect(await screen.findByText(en['buyer.seller.scenes.empty'])).toBeOnTheScreen();
  });

  it('a Scene opens Explore the Scene; back on the profile the header and the list are read again', async () => {
    serve(HEADER, ok(storefront(HANDLE)));
    serve(
      SCENES,
      ok({ data: [sellerScene(1), sellerScene(2)], next_cursor: null }),
      // Scene 1 went PRIVATE while it was open.
      ok({ data: [sellerScene(2)], next_cursor: null }),
    );
    const r = await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    serve(`GET /v1/scene-posts/${sellerScene(1).public_ref}`, ok(publicScene(1, { caption: 'The whole caption' })));
    await fireEvent.press(await screen.findByLabelText('Scene: Seller scene 1'));
    expect(await screen.findByText('The whole caption')).toBeOnTheScreen();
    expect(r.getPathname()).toBe(`/scenes/${sellerScene(1).public_ref}`);
    await act(() => router.back());
    await settle();
    expect(await screen.findByLabelText('Scene: Seller scene 2')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Scene: Seller scene 1')).not.toBeOnTheScreen();
    expect(calls(SCENES)).toHaveLength(2);
    // The re-read is a revalidation, not a new Seller view.
    expect(calls(HEADER).map((c) => c.query['revalidate'])).toEqual([undefined, 'true']);
  });

  it('a pull on a list reads the header again too, as a revalidation', async () => {
    await openProfile();
    await screen.findByLabelText('Scene: Seller scene 1');
    await act(() =>
      (screen.getByTestId('seller-scenes').props as { refreshControl: { props: { onRefresh: () => void } } }).refreshControl.props.onRefresh(),
    );
    await settle();
    expect(calls(SCENES)).toHaveLength(2);
    expect(calls(HEADER).map((c) => c.query['revalidate'])).toEqual([undefined, 'true']);
  });

  it('Products: the server price span and availability, paged by the server cursor, opening the Product', async () => {
    const r = await openProfile();
    serve(
      PRODUCTS,
      ok({ data: [sellerProduct('basket', 'Basket', { price_min_minor: 90000, price_max_minor: 120000 })], next_cursor: 'page-2' }),
      ok({ data: [sellerProduct('scarf', 'Scarf', { available: false, price_min_minor: null, price_max_minor: null, price_currency: null })], next_cursor: null }),
    );
    await fireEvent.press(tab(en['buyer.seller.tab.products']));
    expect(await screen.findByLabelText(/^Basket, ETB\s900\.00 – ETB\s1,200\.00, Available$/)).toBeOnTheScreen();
    await endReached('seller-products');
    expect(await screen.findByLabelText('Scarf, Currently unavailable')).toBeOnTheScreen();
    expect(calls(PRODUCTS).map((c) => c.query['cursor'])).toEqual([undefined, 'page-2']);
    expect(await screen.findByText(en['buyer.list.end'])).toBeOnTheScreen();
    serve(`GET /v1/storefronts/${HANDLE}/products/basket`, ok(storefrontProduct('basket', 'Basket')));
    await fireEvent.press(screen.getByLabelText(/^Basket,/));
    expect(await screen.findByText('About Basket')).toBeOnTheScreen();
    expect(r.getPathname()).toBe(`/product/${HANDLE}/basket`);
  });

  it('Products: shown in the server order (available first); one sent again in the other group shows once (WO-007B)', async () => {
    await openProfile();
    const basket = sellerProduct('basket', 'Basket');
    serve(
      PRODUCTS,
      ok({ data: [basket, sellerProduct('cup', 'Cup')], next_cursor: 'page-2' }),
      // Basket turned unavailable between pages: the server sends it again in the unavailable group.
      ok({ data: [{ ...basket, available: false }, sellerProduct('scarf', 'Scarf', { available: false })], next_cursor: null }),
    );
    await fireEvent.press(tab(en['buyer.seller.tab.products']));
    await screen.findByLabelText(/^Basket,/);
    await endReached('seller-products');
    expect(await screen.findByLabelText(/^Scarf,/)).toBeOnTheScreen();
    expect(screen.getAllByLabelText(/^Basket,/)).toHaveLength(1);
    const order = screen.getAllByTestId('product-tile').map((t) => (t.props as { accessibilityLabel: string }).accessibilityLabel.split(',')[0]);
    expect(order).toEqual(['Basket', 'Cup', 'Scarf']);
    expect(calls(PRODUCTS).map((c) => c.query['cursor'])).toEqual([undefined, 'page-2']);
    // A pull reads from the first page again: the refresh reconciles availability.
    serve(PRODUCTS, ok({ data: [sellerProduct('cup', 'Cup'), { ...basket, available: false }], next_cursor: null }));
    await act(() =>
      (screen.getByTestId('seller-products').props as { refreshControl: { props: { onRefresh: () => void } } }).refreshControl.props.onRefresh(),
    );
    expect(await screen.findByLabelText('Basket, ETB 500.00, Currently unavailable')).toBeOnTheScreen();
    expect(calls(PRODUCTS).at(-1)?.query['cursor']).toBeUndefined();
  });

  it('Reviews: rating in words, the evidence basis in words, date, the service note', async () => {
    await openProfile();
    serve(REVIEWS, ok({ data: [sellerReview(1), sellerReview(2, { seller_rating: 3, evidence_basis: 'VERIFIED_ORDER_FAILURE', body: null })], next_cursor: null }));
    await fireEvent.press(tab(en['buyer.seller.tab.reviews']));
    expect(await screen.findByLabelText('Rated 5 out of 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Rated 3 out of 5')).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.review.basis.FINAL_HANDOFF'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.review.basis.VERIFIED_ORDER_FAILURE'])).toBeOnTheScreen();
    // No legacy tier wording survives (a badge was never proof: ON-033).
    for (const legacy of ['Verified handoff', 'Unverified', 'Claim upheld', 'Confirmed by the buyer']) {
      expect(screen.queryByText(legacy)).not.toBeOnTheScreen();
    }
    expect(screen.getByText(en['buyer.seller.reviews.note'])).toBeOnTheScreen();
    expect(screen.getByText('Review 1')).toBeOnTheScreen();
  });

  it('About: only genuine facts the server sent', async () => {
    await openProfile();
    await fireEvent.press(tab(en['buyer.seller.tab.about']));
    expect(await screen.findByText('Baskets woven in Addis Ababa.')).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.seller.about.open'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.seller.about.fulfilment.BUYER_COLLECTION'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.seller.about.fulfilment.SELLER_DELIVERY'])).not.toBeOnTheScreen();
    expect(screen.getByText(/^On Adulis since /)).toBeOnTheScreen();
  });

  it('a Seller that is not public (another Market, ambiguous, gone) says only the neutral message', async () => {
    serve(HEADER, gone());
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    expect(await screen.findByText(en['buyer.seller.gone'])).toBeOnTheScreen();
    expect(screen.queryByRole('tab')).not.toBeOnTheScreen();
  });

  it('a list that answers 404 after the header clears the whole profile', async () => {
    serve(HEADER, ok(storefront(HANDLE)));
    serve(SCENES, gone());
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    expect(await screen.findByText(en['buyer.seller.gone'])).toBeOnTheScreen();
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
  });

  it('a 404 on a LATER page clears the whole profile too: nothing earlier stays (ON-040)', async () => {
    serve(HEADER, ok(storefront(HANDLE)));
    // Page 2 is held open, so page 1 is seen on screen before the 404 lands.
    let release: (reply: Reply) => void = () => undefined;
    let n = 0;
    api.on(SCENES, () =>
      n++ === 0 ? ok({ data: [sellerScene(1)], next_cursor: 'page-2' }) : new Promise<Reply>((resolve) => (release = resolve)),
    );
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    await screen.findByLabelText('Scene: Seller scene 1');
    await act(() => (screen.getByTestId('seller-scenes').props as { onEndReached: () => void }).onEndReached());
    await settle();
    expect(screen.getByLabelText('Scene: Seller scene 1')).toBeOnTheScreen();
    await act(async () => release(gone()));
    expect(await screen.findByText(en['buyer.seller.gone'])).toBeOnTheScreen();
    expect(screen.queryByLabelText('Scene: Seller scene 1')).not.toBeOnTheScreen();
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
    expect(calls(SCENES).map((c) => c.query['cursor'])).toEqual([undefined, 'page-2']);
  });

  it('a malformed handle asks nothing', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/sellers/Bad.Handle' });
    expect(await screen.findByText(en['buyer.seller.gone'])).toBeOnTheScreen();
    await settle();
    expect(api.calls.filter((c) => c.path.startsWith('/v1/storefronts/'))).toHaveLength(0);
  });

  it('a failed list says so with a retry, under the header', async () => {
    serve(HEADER, ok(storefront(HANDLE)));
    serve(SCENES, problem(500, 'INTERNAL', 'request'), ok({ data: [sellerScene(1)], next_cursor: null }));
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    expect(await screen.findByRole('button', { name: en['common.retry'] })).toBeOnTheScreen();
    expect(screen.getByText('Store 1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByLabelText('Scene: Seller scene 1')).toBeOnTheScreen();
  });

  it('signed in, the Seller reads present the session (one Market with the feed)', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    await openProfile();
    await screen.findByLabelText('Scene: Seller scene 1');
    expect(calls(HEADER)[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
    expect(calls(SCENES)[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
  });
});

describe('entry points', () => {
  it('the Explore the Scene Seller header opens the Seller Profile', async () => {
    const ref = publicScene(1).public_ref;
    serve(`GET /v1/scene-posts/${ref}`, ok(publicScene(1, { seller: { handle: HANDLE, store_name: 'Store 1' } })));
    serveProfile();
    const r = await renderRouter(APP_DIR, { initialUrl: `/scenes/${ref}` });
    await fireEvent.press(await screen.findByTestId('scene-seller'));
    expect(await screen.findByRole('header', { name: 'Store 1' })).toBeOnTheScreen();
    expect(r.getPathname()).toBe(`/sellers/${HANDLE}`);
  });

  it('"Sold by" on a Product opens the Seller Profile', async () => {
    serve(`GET /v1/storefronts/${HANDLE}/products/basket`, ok(storefrontProduct('basket', 'Basket')));
    serveProfile();
    const r = await renderRouter(APP_DIR, { initialUrl: `/product/${HANDLE}/basket` });
    await fireEvent.press(await screen.findByTestId('product-seller'));
    expect(await screen.findByRole('header', { name: 'Store 1' })).toBeOnTheScreen();
    expect(r.getPathname()).toBe(`/sellers/${HANDLE}`);
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

  it('after the interval the profile and its list are read again; a Scene gone PRIVATE disappears', async () => {
    serve(HEADER, ok(storefront(HANDLE)));
    serve(
      SCENES,
      ok({ data: [sellerScene(1), sellerScene(2)], next_cursor: null }),
      ok({ data: [sellerScene(2)], next_cursor: null }),
    );
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    expect(await screen.findByLabelText('Scene: Seller scene 1')).toBeOnTheScreen();
    await goTo('background');
    await act(() => jest.advanceTimersByTimeAsync(6 * 60_000));
    await goTo('active');
    await settle();
    expect(calls(HEADER).length).toBeGreaterThanOrEqual(2);
    expect(calls(SCENES)).toHaveLength(2);
    expect(await screen.findByLabelText('Scene: Seller scene 2')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Scene: Seller scene 1')).not.toBeOnTheScreen();
  });
});

describe('WO-018 (A-006): screen-reader focus on tab changes', () => {
  // The element focus was sent to: a host instance, identified by the tab's testID.
  const focusedTab = (focus: jest.SpyInstance) =>
    (focus.mock.calls.at(-1)?.[0] as { props?: { testID?: string } } | undefined)?.props?.testID;

  it('a tab press moves focus to the newly selected tab (its list was remounted); opening the profile moves none', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => undefined);
    try {
      serve(PRODUCTS, ok({ data: [sellerProduct('basket', 'Basket')], next_cursor: null }));
      serve(REVIEWS, ok({ data: [], next_cursor: null }));
      await openProfile();
      await settle();
      expect(focus).not.toHaveBeenCalled();

      await fireEvent.press(tab(en['buyer.seller.tab.products']));
      await settle();
      expect(tab(en['buyer.seller.tab.products'])).toBeSelected();
      expect(focus).toHaveBeenCalledTimes(1);
      expect(focus.mock.calls[0]![1]).toBe('focus');
      expect(focusedTab(focus)).toBe('seller-tab-products');
      // The tab's content is there to continue into.
      expect(await screen.findByLabelText(/^Basket,/)).toBeOnTheScreen();

      await fireEvent.press(tab(en['buyer.seller.tab.reviews']));
      await settle();
      expect(focusedTab(focus)).toBe('seller-tab-reviews');
      expect(await screen.findByText(en['buyer.seller.reviews.empty'])).toBeOnTheScreen();

      await fireEvent.press(tab(en['buyer.seller.tab.about']));
      await settle();
      expect(focusedTab(focus)).toBe('seller-tab-about');
      expect(tab(en['buyer.seller.tab.about'])).toBeSelected();
      expect(focus).toHaveBeenCalledTimes(3);

      // Nothing else moves focus afterwards.
      await settle();
      expect(focus).toHaveBeenCalledTimes(3);
    } finally {
      focus.mockRestore();
    }
  });
});

describe('WO-018 (W18-13): tab labels at large text', () => {
  const WINDOW = Dimensions.get('window');
  const SCREEN = Dimensions.get('screen');
  const setFontScale = (fontScale: number) => Dimensions.set({ window: { ...WINDOW, fontScale }, screen: { ...SCREEN, fontScale } });
  afterEach(() => act(() => Dimensions.set({ window: WINDOW, screen: SCREEN })));

  it('equal-width tabs at ordinary sizes; from 130% each tab is as wide as its label and the row wraps (no word broken)', async () => {
    setFontScale(1);
    await openProfile();
    expect(tab(en['buyer.seller.tab.products'])).toHaveStyle({ flex: 1 });
    expect(screen.getByLabelText(en['buyer.seller.tabs'])).not.toHaveStyle({ flexWrap: 'wrap' });
    await act(async () => setFontScale(Math.fround(1.6)));
    expect(tab(en['buyer.seller.tab.products'])).toHaveStyle({ flexGrow: 1 });
    expect(tab(en['buyer.seller.tab.products'])).not.toHaveStyle({ flex: 1 });
    expect(screen.getByLabelText(en['buyer.seller.tabs'])).toHaveStyle({ flexWrap: 'wrap' });
    // Still one tablist with four tabs, the selected one marked.
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(tab(en['buyer.seller.tab.scenes'])).toBeSelected();
  });
});
