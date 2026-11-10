import { en } from '@adulis/locale/mobile';
import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { formatMinor } from '../i18n/i18n';
import { useUiStore } from '../state/ui-store';
import {
  GOOD_TOKEN,
  SIGN_IN_CODE,
  bootstrapBody,
  fypPage,
  fypUnit,
  installFakeApi,
  problem,
  publicScene,
  sceneProduct,
  storefrontProduct,
  type Reply,
} from '../testing/fake-api';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * WO-005: For You -> Explore the Scene -> a tagged Product -> View Product -> the Product,
 * on the real route tree against the fake API speaking the generated contract. The
 * Explorer's authority is GET /v1/scene-posts/{publicRef}, so the read's caption differs
 * from the feed unit's on purpose: what the Explorer shows must be the read's.
 */
const APP_DIR = 'src/app';

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const REF = fypUnit(1).public_ref;
const REF_2 = fypUnit(2).public_ref;
const SCENE = `GET /v1/scene-posts/${REF}`;
const SCENE_2 = `GET /v1/scene-posts/${REF_2}`;
const BASKET = 'GET /v1/storefronts/seller-1/products/woven-basket';
const SCARF = 'GET /v1/storefronts/seller-1/products/cotton-scarf';
const READ_CAPTION = 'The whole caption, as the Scene read gives it';

let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
const gone = (): Reply => problem(404, 'NOT_FOUND', 'request');
/** Serve these replies in order; the last one repeats. */
function serve(route: string, ...replies: Reply[]) {
  let i = 0;
  api.on(route, () => replies[Math.min(i++, replies.length - 1)]!);
}
/** A reply the test releases when it chooses: a response still in flight. */
function held() {
  let release: (reply: Reply) => void = () => undefined;
  const reply = new Promise<Reply>((resolve) => {
    release = resolve;
  });
  return { reply, release: (r: Reply) => act(async () => release(r)) };
}
const etb = (minor: number) => formatMinor('en', minor, 'ETB');
const calls = (route: string) => api.callsTo(route);
const sceneCalls = () => api.calls.filter((c) => c.path.startsWith('/v1/scene-posts/'));
const productCalls = () => api.calls.filter((c) => c.path.startsWith('/v1/storefronts/'));
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
/** Pull the screen's own RefreshControl (the scroll view received it as a prop). */
const pull = (testID: string) =>
  act(() => (screen.getByTestId(testID).props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());
const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });
const back = async () => {
  await act(() => router.back());
  await settle();
};

/**
 * A Scene with three tagged Products in the server's order, the second sold out. Prices are
 * the Variants' span; every base price is a different, never-shown seed (DB-01 C1).
 */
const price = (min: number, max = min) => ({ base_price_minor: 100, price_min_minor: min, price_max_minor: max });
const threeProducts = publicScene(1, {
  caption: READ_CAPTION,
  products: [
    sceneProduct(1, 'woven-basket', 'Woven basket', price(90000, 120000)),
    sceneProduct(2, 'cotton-scarf', 'Cotton scarf', { available: false, ...price(45050) }),
    sceneProduct(3, 'clay-jebena', 'Clay jebena', price(120000)),
  ],
});
const row = (name: string) => screen.getByRole('radio', { name: new RegExp(`^\\d\\. ${name},`) });
const PURCHASE_AND_ENGAGEMENT = [
  'Add to cart',
  'Buy now',
  'Checkout',
  'Order',
  'Save',
  'Share',
  'Like',
  'Reviews',
  'Ask Seller',
  'Follow',
];
function expectNoPurchaseOrEngagement() {
  for (const action of PURCHASE_AND_ENGAGEMENT) {
    expect(screen.queryByRole('button', { name: action })).not.toBeOnTheScreen();
  }
}

async function openFromFeed(units = [fypUnit(1)]) {
  api.on('GET /v1/fyp', () => ok(fypPage(units)));
  const r = await renderRouter(APP_DIR);
  await screen.findByText('Store 1');
  return r;
}
async function explore(index = 0) {
  await fireEvent.press(screen.getAllByRole('button', { name: en['buyer.scene.explore'] })[index]!);
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
});

describe('opening Explore the Scene (navigation)', () => {
  it('Explore the Scene opens /scenes/{public_ref} and reads the Scene once, as a guest request', async () => {
    serve(SCENE, ok(threeProducts));
    const r = await openFromFeed();
    await explore();
    expect(await screen.findByText(READ_CAPTION)).toBeOnTheScreen();
    expect(r.getPathname()).toBe(`/scenes/${REF}`);
    expect(calls(SCENE)).toHaveLength(1);
    expect(calls(SCENE)[0]?.headers.Authorization).toBeUndefined();
    // The read is the authority: the feed unit's caption is not what the Explorer shows.
    expect(screen.getByText('@seller-1')).toBeOnTheScreen();
    // Nothing per Product is fetched to draw the list (no N+1).
    expect(productCalls()).toHaveLength(0);
  });

  it('tapping the Scene photo opens the same Explorer', async () => {
    serve(SCENE, ok(threeProducts));
    const r = await openFromFeed();
    await fireEvent.press(screen.getByTestId('scene-photo-explore'));
    expect(await screen.findByText(READ_CAPTION)).toBeOnTheScreen();
    expect(r.getPathname()).toBe(`/scenes/${REF}`);
  });

  it('a double tap opens one Explorer, not two', async () => {
    serve(SCENE, ok(threeProducts));
    await openFromFeed();
    const button = screen.getByRole('button', { name: en['buyer.scene.explore'] });
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(await screen.findByText(READ_CAPTION)).toBeOnTheScreen();
    await settle();
    // Counting covered screens too: a second Explorer would sit, hidden, under the first.
    expect(screen.queryAllByText(READ_CAPTION, { includeHiddenElements: true })).toHaveLength(1);
    expect(calls(SCENE)).toHaveLength(1);
  });

  it('Back returns to For You as it was: the same cards, no new feed session', async () => {
    serve(SCENE, ok(threeProducts));
    const r = await openFromFeed([fypUnit(1), fypUnit(2)]);
    await explore();
    await screen.findByText(READ_CAPTION);
    await back();
    expect(await screen.findByText('Store 2', {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
    expect(calls('GET /v1/fyp')).toHaveLength(1);
  });

  it('opens cold from a link, with Home under it', async () => {
    serve(SCENE, ok(threeProducts));
    const r = await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    expect(await screen.findByText(READ_CAPTION)).toBeOnTheScreen();
    expect(r.getPathname()).toBe(`/scenes/${REF}`);
    await back();
    expect(await screen.findByText(en['buyer.for_you.empty'], {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
  });

  it('a malformed reference asks nothing and says only that the Scene is not available', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/scenes/..%2Fadmin' });
    expect(await screen.findByText(en['buyer.scene.gone'])).toBeOnTheScreen();
    await settle();
    expect(sceneCalls()).toHaveLength(0);
  });

  it('signed in, the Scene and Product reads still carry no bearer (one public answer)', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    serve(SCENE, ok(threeProducts));
    serve(BASKET, ok(storefrontProduct('woven-basket', 'Woven basket')));
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    await fireEvent.press(row('Woven basket'));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.product.view'] }));
    expect(await screen.findByText('About Woven basket')).toBeOnTheScreen();
    expect(calls(SCENE)[0]?.headers.Authorization).toBeUndefined();
    expect(calls(BASKET)[0]?.headers.Authorization).toBeUndefined();
  });
});

describe('signing in and out (lifecycle)', () => {
  it('signing in and out does not disturb Scene navigation: the reads stay public', async () => {
    serve(SCENE, ok(threeProducts));
    await openFromFeed();
    await explore();
    await screen.findByText(READ_CAPTION);
    await back();

    await fireEvent.press(bottomTab(en['buyer.tab.orders']));
    await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), '+251911234567');
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), SIGN_IN_CODE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
    await screen.findByText(en['buyer.orders.coming'], {}, { timeout: 5000 });
    await fireEvent.press(bottomTab(en['buyer.tab.home']));
    await screen.findByText('Store 1');
    await explore();
    expect(await screen.findByText(READ_CAPTION)).toBeOnTheScreen();
    await back();

    await fireEvent.press(bottomTab(en['buyer.tab.you']));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    await fireEvent.press(bottomTab(en['buyer.tab.home']));
    await screen.findByText('Store 1');
    await explore();
    expect(await screen.findByText(READ_CAPTION)).toBeOnTheScreen();

    expect(calls(SCENE)).toHaveLength(3);
    for (const call of calls(SCENE)) expect(call.headers.Authorization).toBeUndefined();
  });
});

describe('the tagged Products (Product exploration, hotspots)', () => {
  it('lists every tagged Product in the server order, numbered, priced, availability in words', async () => {
    serve(SCENE, ok(threeProducts));
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    expect(screen.getAllByRole('radio').map((n) => n.props.accessibilityLabel)).toEqual([
      `1. Woven basket, ${etb(90000)} – ${etb(120000)}`,
      `2. Cotton scarf, ${etb(45050)}, currently unavailable`,
      `3. Clay jebena, ${etb(120000)}`,
    ]);
    expect(screen.getByText(`${etb(90000)} – ${etb(120000)}`)).toBeOnTheScreen();
    // The base price is a creation seed, never a price shown to a Buyer.
    expect(screen.queryByText(etb(100))).not.toBeOnTheScreen();
    // Minor units become major units with the currency's own digits.
    expect(etb(45050)).toMatch(/450\.50/);
    expect(screen.getByText(en['buyer.product.unavailable'])).toBeOnTheScreen();
    expect(screen.getByText(etb(45050))).toBeOnTheScreen();
    expectNoPurchaseOrEngagement();
  });

  it('draws no hotspot: the contract has no geometry, so the list is the whole selection', async () => {
    serve(SCENE, ok(threeProducts));
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    expect(screen.queryAllByTestId(/hotspot/)).toHaveLength(0);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('one Product is selected at a time; only the selected one offers View Product', async () => {
    serve(SCENE, ok(threeProducts));
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    expect(screen.getByText(en['buyer.scene.choose'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['buyer.product.view'] })).not.toBeOnTheScreen();

    await fireEvent.press(row('Cotton scarf'));
    expect(row('Cotton scarf')).toBeChecked();
    expect(screen.getAllByRole('button', { name: en['buyer.product.view'] })).toHaveLength(1);
    expect(screen.queryByText(en['buyer.scene.choose'])).not.toBeOnTheScreen();

    await fireEvent.press(row('Clay jebena'));
    expect(row('Clay jebena')).toBeChecked();
    expect(row('Cotton scarf')).not.toBeChecked();
    expect(screen.getAllByRole('button', { name: en['buyer.product.view'] })).toHaveLength(1);
  });

  it('a Product with no ACTIVE Variant shows no price, and says it is unavailable', async () => {
    serve(
      SCENE,
      ok(
        publicScene(1, {
          caption: READ_CAPTION,
          products: [
            sceneProduct(1, 'woven-basket', 'Woven basket'),
            sceneProduct(2, 'old-lamp', 'Old lamp', {
              available: false,
              price_min_minor: null,
              price_max_minor: null,
              price_currency: null,
            }),
          ],
        }),
      ),
    );
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    expect(row('Old lamp').props.accessibilityLabel).toBe('2. Old lamp, currently unavailable');
    expect(screen.getAllByText(en['buyer.product.unavailable'])).toHaveLength(1);
  });

  it('a Scene with no listed Product says so', async () => {
    serve(SCENE, ok(publicScene(1, { caption: READ_CAPTION, products: [] })));
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    expect(await screen.findByText(en['buyer.scene.no_products'])).toBeOnTheScreen();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});

describe('View Product (Product detail)', () => {
  it('opens the Product by handle and slug; Back returns to the Explorer, revalidated, selection kept', async () => {
    serve(SCENE, ok(threeProducts));
    serve(
      BASKET,
      ok(
        storefrontProduct('woven-basket', 'Woven basket', {
          variants: [
            {
              id: '0b6f1a3e-4444-4444-8444-444444444444',
              variant_key: 'Large',
              price_minor: 95000,
              price_currency: 'ETB',
              stock_count: 0,
              stock_confirmed_at: null,
              status: 'ACTIVE',
            },
            {
              id: '0b6f1a3e-5555-4555-8555-555555555555',
              variant_key: 'Small',
              price_minor: 85000,
              price_currency: 'ETB',
              stock_count: 3,
              stock_confirmed_at: null,
              status: 'ACTIVE',
            },
          ],
        }),
      ),
    );
    const r = await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    await fireEvent.press(row('Woven basket'));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.product.view'] }));

    expect(await screen.findByText('About Woven basket')).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/product/seller-1/woven-basket');
    expect(calls(BASKET)).toHaveLength(1);
    expect(screen.getByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    // The Variants' span, not the base-price seed (80000).
    expect(screen.getByText(`${etb(85000)} – ${etb(95000)}`)).toBeOnTheScreen();
    expect(screen.queryByText(etb(80000))).not.toBeOnTheScreen();
    // The Product, and its one in-stock option.
    expect(screen.getAllByText(en['buyer.product.available'])).toHaveLength(2);
    expect(screen.getByText('Sold by Store 1')).toBeOnTheScreen();
    expect(screen.getByLabelText(`Large, ${etb(95000)}, Currently unavailable`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`Small, ${etb(85000)}, Available`)).toBeOnTheScreen();
    // No internal id is ever shown.
    expect(screen.queryByText(/0b6f1a3e/)).not.toBeOnTheScreen();
    expectNoPurchaseOrEngagement();

    await back();
    expect(await screen.findByText(READ_CAPTION, {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(r.getPathname()).toBe(`/scenes/${REF}`);
    expect(calls(SCENE)).toHaveLength(2);
    expect(row('Woven basket')).toBeChecked();
  });

  it('an unavailable Product opens, says "Currently unavailable", and offers nothing to buy', async () => {
    serve(SCENE, ok(threeProducts));
    serve(
      SCARF,
      ok(
        storefrontProduct('cotton-scarf', 'Cotton scarf', {
          available: false,
          variants: [
            {
              id: '0b6f1a3e-6666-4666-8666-666666666666',
              variant_key: 'Default',
              price_minor: 45050,
              price_currency: 'ETB',
              // In stock, but the Product is not available (a CLOSING Seller, say): neither is it.
              stock_count: 3,
              stock_confirmed_at: null,
              status: 'ACTIVE',
            },
          ],
        }),
      ),
    );
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    await fireEvent.press(row('Cotton scarf'));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.product.view'] }));
    expect(await screen.findByText('About Cotton scarf')).toBeOnTheScreen();
    expect(screen.getAllByText(en['buyer.product.unavailable']).length).toBeGreaterThan(0);
    expect(screen.queryByText(en['buyer.product.available'])).not.toBeOnTheScreen();
    expect(screen.getByLabelText(`Default, ${etb(45050)}, Currently unavailable`)).toBeOnTheScreen();
    expectNoPurchaseOrEngagement();
  });

  it('a Product that is no longer public says so, neutrally, with a way back', async () => {
    serve(SCENE, ok(threeProducts));
    serve(BASKET, gone());
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    await fireEvent.press(row('Woven basket'));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.product.view'] }));
    expect(await screen.findByText(en['buyer.product.gone'])).toBeOnTheScreen();
    expect(screen.queryByText('About Woven basket')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.scene.go_back'] }));
    expect(await screen.findByText(READ_CAPTION, {}, { timeout: 5000 })).toBeOnTheScreen();
  });

  it('a malformed handle or slug asks nothing', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/product/Bad.Handle/x' });
    expect(await screen.findByText(en['buyer.product.gone'])).toBeOnTheScreen();
    await settle();
    expect(productCalls()).toHaveLength(0);
  });

  it('a failed Product read shows the failure and a retry, never invented content', async () => {
    serve(BASKET, problem(500, 'INTERNAL', 'request'), ok(storefrontProduct('woven-basket', 'Woven basket')));
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/woven-basket' });
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText('About Woven basket')).toBeOnTheScreen();
  });
});

describe('privacy and lifecycle', () => {
  it('a Scene that is not public is one neutral message: no caption, Seller or reason', async () => {
    serve(SCENE, gone());
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    expect(await screen.findByText(en['buyer.scene.gone'])).toBeOnTheScreen();
    expect(en['buyer.scene.gone']).toBe('This Scene is no longer available.');
    expect(screen.queryByText(/Store 1|seller-1|caption/i)).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['buyer.scene.go_back'] })).toBeOnTheScreen();
  });

  it('a Scene that goes private while a Product is open is cleared on the way back', async () => {
    serve(SCENE, ok(threeProducts), gone());
    serve(BASKET, ok(storefrontProduct('woven-basket', 'Woven basket')));
    const r = await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    await fireEvent.press(row('Woven basket'));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.product.view'] }));
    await screen.findByText('About Woven basket');
    await back();
    expect(await screen.findByText(en['buyer.scene.gone'], {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(screen.queryByText(READ_CAPTION)).not.toBeOnTheScreen();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.scene.go_back'] }));
    await settle();
    expect(r.getPathname()).toBe('/home/for-you');
  });

  it('a pull revalidates; a 404 then clears the Scene rather than leaving it on screen', async () => {
    serve(SCENE, ok(threeProducts), gone());
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    await pull('scene-explorer');
    expect(await screen.findByText(en['buyer.scene.gone'])).toBeOnTheScreen();
    expect(screen.queryByText(READ_CAPTION)).not.toBeOnTheScreen();
    expect(calls(SCENE)).toHaveLength(2);
  });

  it('a revalidation shows the current Scene: a sold-out Product is relabelled', async () => {
    const soldOut = {
      ...threeProducts,
      products: threeProducts.products.map((p) =>
        p.slug === 'woven-basket' ? { ...p, available: false, price_min_minor: 95000, price_max_minor: 95000 } : p,
      ),
    };
    serve(SCENE, ok(threeProducts), ok(soldOut));
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    expect(screen.getAllByText(en['buyer.product.unavailable'])).toHaveLength(1);
    await pull('scene-explorer');
    await settle();
    expect(screen.getAllByText(en['buyer.product.unavailable'])).toHaveLength(2);
    // The new price and the new availability, both from the new answer.
    expect(row('Woven basket').props.accessibilityLabel).toBe(`1. Woven basket, ${etb(95000)}, currently unavailable`);
  });

  it('a failed revalidation shows the failure, never the previous answer', async () => {
    serve(SCENE, ok(threeProducts), problem(500, 'INTERNAL', 'request'));
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    await pull('scene-explorer');
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    expect(screen.queryByText(READ_CAPTION)).not.toBeOnTheScreen();
  });

  it('only the Buyer pull shows the pull spinner; a revalidation on return does not', async () => {
    const onReturn = held();
    const onPull = held();
    let n = 0;
    api.on(SCENE, () => [ok(threeProducts), onReturn.reply, onPull.reply][Math.min(n++, 2)]!);
    serve(BASKET, ok(storefrontProduct('woven-basket', 'Woven basket')));
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    await fireEvent.press(row('Woven basket'));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.product.view'] }));
    await screen.findByText('About Woven basket');
    await back();
    await screen.findByText(READ_CAPTION, {}, { timeout: 5000 });
    const refreshing = () =>
      (screen.getByTestId('scene-explorer').props.refreshControl as { props: { refreshing: boolean } }).props.refreshing;
    expect(calls(SCENE)).toHaveLength(2);
    expect(refreshing()).toBe(false);
    await onReturn.release(ok(threeProducts));
    await pull('scene-explorer');
    expect(refreshing()).toBe(true);
    await onPull.release(ok(threeProducts));
    expect(refreshing()).toBe(false);
  });

  it('a photo that failed is tried again when a new answer arrives', async () => {
    api.on('GET /v1/bootstrap', () => ok(bootstrapBody({ media_public_origin: 'https://media.example.test' })));
    serve(SCENE, ok(threeProducts));
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    const photo = await screen.findByTestId('scene-explorer-photo');
    expect(photo.props.source).toMatchObject([{ uri: 'https://media.example.test/scenes/1/card.webp' }]);
    await fireEvent(photo, 'error', { nativeEvent: { error: 'network' } });
    expect(screen.getByText(en['buyer.scene.photo_unavailable'])).toBeOnTheScreen();
    await pull('scene-explorer');
    await settle();
    expect(screen.getByTestId('scene-explorer-photo')).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.scene.photo_unavailable'])).not.toBeOnTheScreen();
  });

  it('offline on opening says so, then loads by itself when the connection returns', async () => {
    serve(SCENE, ok(threeProducts));
    try {
      await openFromFeed();
      // After startup: the app's own network listener sets the starting state.
      await act(async () => onlineManager.setOnline(false));
      await explore();
      expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
      expect(calls(SCENE)).toHaveLength(0);
      await act(async () => onlineManager.setOnline(true));
      expect(await screen.findByText(READ_CAPTION)).toBeOnTheScreen();
    } finally {
      await act(async () => onlineManager.setOnline(true));
    }
  });

  it('a late answer for one Scene never fills another', async () => {
    const first = held();
    api.on(SCENE, () => first.reply);
    serve(SCENE_2, ok(publicScene(2, { caption: 'Scene two, as read' })));
    await openFromFeed([fypUnit(1), fypUnit(2)]);
    await explore(0);
    expect(screen.getByText(en['buyer.scene.loading'])).toBeOnTheScreen();
    await back();
    await screen.findByText('Store 2', {}, { timeout: 5000 });
    await explore(1);
    expect(await screen.findByText('Scene two, as read')).toBeOnTheScreen();
    await first.release(ok(threeProducts));
    await settle();
    expect(screen.getByText('Scene two, as read')).toBeOnTheScreen();
    expect(screen.queryByText(READ_CAPTION)).not.toBeOnTheScreen();
  });
});

/**
 * Returning from the background (the WO-DISC-002A policy, reused): AppState is driven by
 * hand; renderRouter's fake timers move Date.now(). Development builds use the provisional
 * 5-minute interval.
 */
describe('returning from the background', () => {
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

  it('a short stay keeps the Scene and asks nothing', async () => {
    serve(SCENE, ok(threeProducts));
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    await away(1);
    await settle();
    expect(calls(SCENE)).toHaveLength(1);
    expect(screen.getByText(READ_CAPTION)).toBeOnTheScreen();
  });

  it('after the interval the Scene is withheld until read again, and a 404 then clears it', async () => {
    const next = held();
    let n = 0;
    api.on(SCENE, () => (n++ === 0 ? ok(threeProducts) : next.reply));
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    await away(6);
    expect(await screen.findByText(en['buyer.scene.loading'])).toBeOnTheScreen();
    expect(screen.queryByText(READ_CAPTION)).not.toBeOnTheScreen();
    await next.release(gone());
    expect(await screen.findByText(en['buyer.scene.gone'])).toBeOnTheScreen();
    expect(screen.queryByText(READ_CAPTION)).not.toBeOnTheScreen();
  });

  it('the selection survives the Explorer being withheld while a Product is open', async () => {
    serve(SCENE, ok(threeProducts));
    serve(BASKET, ok(storefrontProduct('woven-basket', 'Woven basket')));
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    await fireEvent.press(row('Woven basket'));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.product.view'] }));
    await screen.findByText('About Woven basket');
    await away(6);
    await settle();
    await back();
    expect(await screen.findByText(READ_CAPTION, {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(row('Woven basket')).toBeChecked();
  });

  it('an answer from before a withheld revalidation never lands in the new one', async () => {
    const old = held();
    let n = 0;
    api.on(SCENE, () => [ok(threeProducts), old.reply, gone()][Math.min(n++, 2)]!);
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${REF}` });
    await screen.findByText(READ_CAPTION);
    await pull('scene-explorer'); // in flight, held
    await away(6); // a new generation asks again, and hears 404
    expect(await screen.findByText(en['buyer.scene.gone'])).toBeOnTheScreen();
    await old.release(ok(threeProducts)); // the earlier request finally answers
    await settle();
    expect(screen.getByText(en['buyer.scene.gone'])).toBeOnTheScreen();
    expect(screen.queryByText(READ_CAPTION)).not.toBeOnTheScreen();
  });

  it('the open Product is revalidated the same way', async () => {
    serve(BASKET, ok(storefrontProduct('woven-basket', 'Woven basket')), gone());
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/woven-basket' });
    await screen.findByText('About Woven basket');
    await away(6);
    expect(await screen.findByText(en['buyer.product.gone'])).toBeOnTheScreen();
    expect(screen.queryByText('About Woven basket')).not.toBeOnTheScreen();
  });
});
