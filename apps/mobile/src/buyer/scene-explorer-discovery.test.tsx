import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { extractExpoPathFromURL } from 'expo-router/build/fork/extractPathFromURL';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import appConfig from '../../app.json';
import { useUiStore } from '../state/ui-store';
import { claimsIn, elementsUnder, overlaysIn, renderedText } from '../testing/discovery-rules';
import {
  fypPage,
  fypUnit,
  installFakeApi,
  problem,
  publicScene,
  sceneProduct,
  storefrontProduct,
  type PublicScene,
  type Reply,
} from '../testing/fake-api';
import { resetSecureStore } from '../testing/secure-store-mock';

/**
 * Explore the Scene: how it opens (from a card, cold, from a link), what it does when the
 * server stops serving a Scene or one of its Products, its own loading, failure and retry
 * states, whose Seller and Product pages it opens, and what it will and will not draw or
 * say. The real route tree against the fake API. Complements scene-explorer.test.tsx.
 */
const APP_DIR = 'src/app';

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const REF = fypUnit(1).public_ref;
const SCENE = `GET /v1/scene-posts/${REF}`;
const CAPTION = 'The whole caption, as the Scene read gives it';

let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
const gone = (): Reply => problem(404, 'NOT_FOUND', 'request');
/** Serve these replies in order; the last one repeats. */
function serve(route: string, ...replies: Reply[]) {
  let i = 0;
  api.on(route, () => replies[Math.min(i++, replies.length - 1)]!);
}
/** A reply the test releases when it chooses: a response still in flight. */
const held = () => {
  let release: (reply: Reply) => void = () => undefined;
  const reply = new Promise<Reply>((resolve) => {
    release = resolve;
  });
  return { reply, release: (r: Reply) => act(async () => release(r)) };
};
const calls = (route: string) => api.callsTo(route);
const sceneCalls = () => api.calls.filter((c) => c.path.startsWith('/v1/scene-posts/'));
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const back = async () => {
  await act(() => router.back());
  await settle();
};
const pull = () =>
  act(() => (screen.getByTestId('scene-explorer').props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());
const row = (name: string) => screen.getByRole('radio', { name: new RegExp(`^\\d\\. ${name},`) });
const goBack = () => screen.getByRole('button', { name: en['buyer.scene.go_back'] });

const price = (min: number) => ({ base_price_minor: 100, price_min_minor: min, price_max_minor: min });
const threeProducts = publicScene(1, {
  caption: CAPTION,
  products: [
    sceneProduct(1, 'woven-basket', 'Woven basket', price(90000)),
    sceneProduct(2, 'cotton-scarf', 'Cotton scarf', { available: false, ...price(45050) }),
    sceneProduct(3, 'clay-jebena', 'Clay jebena', price(120000)),
  ],
});
const openCold = (ref: string = REF) => renderRouter(APP_DIR, { initialUrl: `/scenes/${ref}` });

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
});

describe('opening a Scene cold', () => {
  it('a link in the app\'s own scheme reaches the Scene for a guest, with Home under it for Back', async () => {
    const { scheme } = appConfig.expo;
    expect(scheme).toBe('adulis');
    // The path Expo Router takes from the link: the host of the link is the first segment.
    const path = extractExpoPathFromURL([], `${scheme}://scenes/${REF}`);
    expect(path).toBe(`scenes/${REF}`);

    serve(SCENE, ok(threeProducts));
    const r = await renderRouter(APP_DIR, { initialUrl: `/${path}` });
    expect(await screen.findByText(CAPTION)).toBeOnTheScreen();
    expect(r.getPathname()).toBe(`/scenes/${REF}`);
    expect(calls(SCENE)).toHaveLength(1);
    expect(calls(SCENE)[0]?.headers.Authorization).toBeUndefined();
    await back();
    expect(await screen.findByText(en['buyer.for_you.empty'], {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
  });

  it.each([
    ['a reference the server no longer serves', REF, 1],
    ['a well-formed reference no Scene has', 'AAAAAAAAAAAAAAAAAAAAAA', 1],
    ['a malformed reference', '..%2Fadmin', 0],
  ])('a cold link with %s says the Scene is not available, shows nothing of it, and Go back reaches Home', async (_label, ref, asks) => {
    serve(SCENE, gone());
    const r = await openCold(ref);
    expect(await screen.findByText(en['buyer.scene.gone'])).toBeOnTheScreen();
    await settle();
    expect(sceneCalls()).toHaveLength(asks);
    expect(sceneCalls().every((c) => c.headers.Authorization === undefined)).toBe(true);
    expect(screen.queryByText(CAPTION)).not.toBeOnTheScreen();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);

    await fireEvent.press(goBack());
    expect(await screen.findByText(en['buyer.for_you.empty'], {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
  });

  it.each([
    ['no reference', '/scenes'],
    ['an extra segment', `/scenes/${REF}/extra`],
  ])('a link with %s goes to Buyer Home and asks nothing', async (_label, url) => {
    const r = await renderRouter(APP_DIR, { initialUrl: url });
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
    await settle();
    expect(sceneCalls()).toHaveLength(0);
  });
});

describe('a Scene opened from a card, and read again', () => {
  it('is read again on every opening: once the server stops serving it, the card opens the neutral message, not the earlier answer', async () => {
    serve(SCENE, ok(threeProducts), gone());
    api.on('GET /v1/fyp', () => ok(fypPage([fypUnit(1), fypUnit(2)])));
    await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    const explore = async () => {
      await fireEvent.press(screen.getAllByRole('button', { name: en['buyer.scene.explore'] })[0]!);
      await settle();
    };
    await explore();
    expect(await screen.findByText(CAPTION)).toBeOnTheScreen();
    await back();
    await screen.findByText('Store 2', {}, { timeout: 5000 });

    await explore();
    expect(await screen.findByText(en['buyer.scene.gone'])).toBeOnTheScreen();
    expect(calls(SCENE)).toHaveLength(2);
    // Nothing of the earlier answer, and nothing of the feed's card, stands in for it.
    for (const stale of [CAPTION, 'Store 1', 'Scene caption 1', 'Woven basket']) {
      expect(screen.queryByText(stale)).not.toBeOnTheScreen();
    }
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});

describe('the tagged Products, read again', () => {
  it('a Product that is no longer tagged leaves the selection, and its preview and View Product go with it', async () => {
    const without: PublicScene = { ...threeProducts, products: threeProducts.products.filter((p) => p.slug !== 'woven-basket') };
    serve(SCENE, ok(threeProducts), ok(without));
    await openCold();
    await screen.findByText(CAPTION);
    await fireEvent.press(row('Woven basket'));
    expect(screen.getByRole('button', { name: en['buyer.product.view'] })).toBeOnTheScreen();

    await pull();
    await settle();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByText('Woven basket')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['buyer.product.view'] })).not.toBeOnTheScreen();
    expect(screen.getByText(en['buyer.scene.choose'])).toBeOnTheScreen();
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
  });

  it('a Product tagged in another order is renumbered, and the selection stays on the same Product', async () => {
    const [basket, scarf, jebena] = threeProducts.products;
    const reordered: PublicScene = { ...threeProducts, products: [{ ...jebena!, position: 1 }, { ...basket!, position: 2 }, { ...scarf!, position: 3 }] };
    serve(SCENE, ok(threeProducts), ok(reordered));
    await openCold();
    await screen.findByText(CAPTION);
    await fireEvent.press(row('Woven basket'));
    expect(row('Woven basket').props.accessibilityLabel).toMatch(/^1\. /);

    await pull();
    await settle();
    expect(row('Woven basket').props.accessibilityLabel).toMatch(/^2\. /);
    expect(row('Woven basket')).toBeChecked();
    expect(row('Clay jebena')).not.toBeChecked();
    expect(screen.getAllByRole('button', { name: en['buyer.product.view'] })).toHaveLength(1);
  });
});

describe('the Explorer\'s own states', () => {
  it('a failed first read says so with a Retry and shows nothing of the Scene, then Retry shows it', async () => {
    serve(SCENE, problem(500, 'INTERNAL', 'request'), ok(threeProducts));
    await openCold();
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    expect(screen.queryByText(CAPTION)).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.scene.gone'])).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText(CAPTION)).toBeOnTheScreen();
    expect(screen.queryByText(en['error.request.internal'])).not.toBeOnTheScreen();
    expect(calls(SCENE)).toHaveLength(2);
  });

  it('a slow read shows that it is loading, never gone, a failure or an empty Scene, then the Scene', async () => {
    const slow = held();
    api.on(SCENE, () => slow.reply);
    await openCold();
    await waitFor(() => expect(calls(SCENE)).toHaveLength(1));
    await settle();
    expect(screen.getByText(en['buyer.scene.loading'])).toBeOnTheScreen();
    for (const absent of [en['buyer.scene.gone'], en['buyer.scene.no_products'], en['common.offline'], en['common.timeout'], en['error.request.internal']]) {
      expect(screen.queryByText(absent)).not.toBeOnTheScreen();
    }
    expect(screen.queryByRole('button', { name: en['common.retry'] })).not.toBeOnTheScreen();
    await slow.release(ok(threeProducts));
    expect(await screen.findByText(CAPTION)).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.scene.loading'])).not.toBeOnTheScreen();
  });

  it('with no media origin it draws no photo and says the photo is unavailable', async () => {
    serve(SCENE, ok(threeProducts));
    await openCold();
    await screen.findByText(CAPTION);
    expect(screen.queryByTestId('scene-explorer-photo')).not.toBeOnTheScreen();
    expect(screen.getByText(en['buyer.scene.photo_unavailable'])).toBeOnTheScreen();
  });
});

describe('the Seller and the Product it opens', () => {
  it('names the Scene\'s Seller and opens their profile; View Product opens the Product of that same Seller', async () => {
    const seller = { handle: 'zeme-store', store_name: 'Zeme Crafts' };
    serve(SCENE, ok(publicScene(1, { caption: CAPTION, seller, products: [sceneProduct(1, 'woven-basket', 'Woven basket')] })));
    const BASKET = 'GET /v1/storefronts/zeme-store/products/woven-basket';
    serve(BASKET, ok(storefrontProduct('woven-basket', 'Woven basket')));
    const r = await openCold();
    await screen.findByText(CAPTION);
    expect(screen.getByText('Zeme Crafts')).toBeOnTheScreen();
    expect(screen.getByText('@zeme-store')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('scene-seller'));
    await settle();
    expect(r.getPathname()).toBe('/sellers/zeme-store');
    await back();
    expect(await screen.findByText(CAPTION, {}, { timeout: 5000 })).toBeOnTheScreen();

    await fireEvent.press(row('Woven basket'));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.product.view'] }));
    expect(await screen.findByText('About Woven basket')).toBeOnTheScreen();
    // The Scene's own reference travels with it, so the Save is attributed to this Scene.
    expect(r.getPathname()).toBe('/product/zeme-store/woven-basket');
    expect(r.getSearchParams()).toMatchObject({ from: REF });
    expect(calls(BASKET)).toHaveLength(1);
  });
});

describe('what the Explorer will not draw or say', () => {
  it('a photo and its list carry no hotspot, marker or overlay, whatever extra fields the Products arrive with', async () => {
    const stray = threeProducts.products.map((p, i) => ({ ...p, x: 0.2 * (i + 1), y: 0.3, hotspot: { x: 0.2, y: 0.3 } }));
    serve(SCENE, ok({ ...threeProducts, products: stray }));
    await openCold();
    await screen.findByText(CAPTION);
    await fireEvent.press(row('Woven basket'));
    const explorer = elementsUnder('scene-explorer');
    expect(explorer.length).toBeGreaterThan(20); // the scan reads the whole Explorer
    expect(overlaysIn(explorer)).toEqual([]);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('states only what the server sent: no popularity, trust or conversion claim, nothing to buy, no engagement control', async () => {
    serve(SCENE, ok(threeProducts));
    await openCold();
    await screen.findByText(CAPTION);
    await fireEvent.press(row('Cotton scarf'));
    const texts = renderedText(screen.getByTestId('scene-explorer'));
    expect(texts.length).toBeGreaterThan(10); // the scan reads the Explorer
    expect(claimsIn(texts)).toEqual([]);
    for (const action of ['Like', 'Hide', 'Share', 'Follow', 'Add to cart', 'Buy now', 'Checkout', 'Order']) {
      expect(screen.queryByRole('button', { name: action })).not.toBeOnTheScreen();
    }
  });
});
