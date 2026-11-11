import { en } from '@adulis/locale/mobile';
import type { components } from '@adulis/api-client';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert, Platform } from 'react-native';

import { useUiStore } from '../state/ui-store';
import {
  DEFAULT_COLLECTION_REF,
  GOOD_TOKEN,
  SIGNED_IN_CONTEXT,
  SIGN_IN_CODE,
  bootstrapBody,
  installFakeApi,
  problem,
  sellerProduct,
  sellerScene,
  shopProduct,
  storefront,
  storefrontProduct,
  type Recorded,
  type Reply,
  type ShopProduct,
} from '../testing/fake-api';
import { installFakeCollections } from '../testing/fake-collections';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * WO-009A: Save on discovery cards (Shop, Search, Seller Profile) on the real route tree, with
 * the in-memory Collections server on the API's rules. Numbers are the work order's S16 matrix;
 * 28-37 are the existing suites (saved, search, shop, seller-profile, for-you), still green.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

type S = components['schemas'];
const PHONE = '+251911234567';
const TOKEN_B = 'Fake_credential_for_tests_B123456789abcdefg';
const STATE = 'POST /v1/collections/saved-state:batch';

let api: ReturnType<typeof installFakeApi>;
let fc: ReturnType<typeof installFakeCollections>;
const ok = (body: unknown): Reply => ({ status: 200, body });
const signedIn = () => resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
const stateCalls = () => api.callsTo(STATE);
const targetsOf = (c: Recorded | undefined) => (c?.body?.targets ?? []) as Array<{ type: string; ref: string }>;
const adds = () => api.calls.filter((c) => c.method === 'POST' && /^\/v1\/collections\/[^/]+\/items$/.test(c.path));
const removes = () => api.calls.filter((c) => c.method === 'DELETE' && /\/items\//.test(c.path));
const card = (name: string) => screen.getByRole('togglebutton', { name: `Save ${name}` });
const findGuestCard = (name: string) => screen.findByRole('button', { name: `Save ${name}` });
const isOn = (el: { props: { accessibilityState?: { checked?: boolean } } }) => el.props.accessibilityState?.checked === true;
const isIdle = (el: { props: { accessibilityState?: { disabled?: boolean } } }) => el.props.accessibilityState?.disabled !== true;
const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });
const flush = async () => {
  for (let i = 0; i < 20; i++) await act(() => Promise.resolve());
};
const held = () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { gate, release };
};

const products = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => shopProduct(`item-${from + i}`, `Item ${from + i}`));
const target = (p: ShopProduct) => ({ type: 'PRODUCT_POST' as const, ref: p.id });
const BASKET = shopProduct('basket', 'Basket');
const MORNING: S['SearchSceneDto'] = {
  public_ref: sellerScene(1).public_ref,
  caption: 'Morning light',
  caption_truncated: false,
  image: sellerScene(1).image,
  seller: { handle: 'seller-1', store_name: 'Store 1' },
};

/** The Shop's pages, by cursor; a page of the Shop is the server's (limit 30 asked). */
function serveShop(...pages: ShopProduct[][]) {
  api.on('GET /v1/shop/products', (call) => {
    const n = call.query.cursor ? Number(call.query.cursor) : 0;
    return ok({ market_resolved: true, data: pages[n] ?? [], next_cursor: n + 1 < pages.length ? String(n + 1) : null });
  });
}
const openShop = async () => {
  await renderRouter(APP_DIR, { initialUrl: '/shop' });
  expect(await screen.findByText(en['buyer.shop.order'])).toBeOnTheScreen();
};
const endReached = (testID: string) => act(() => (screen.getByTestId(testID).props as { onEndReached: () => void }).onEndReached());
const pull = (testID: string) =>
  act(() => (screen.getByTestId(testID).props as { refreshControl: { props: { onRefresh: () => void } } }).refreshControl.props.onRefresh());

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  fc = installFakeCollections(api, { products: { [BASKET.id]: BASKET }, scenes: { [MORNING.public_ref]: MORNING } });
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

afterEach(() => {
  // 37: saving never touches commerce.
  expect(api.calls.filter((c) => /cart|order|checkout|payment|reservation/i.test(c.path))).toEqual([]);
});

describe('saved-state batching', () => {
  it('1, 2, 3. twenty cards are one batch; the next page one more; a Product already asked for is not asked again', async () => {
    signedIn();
    const first = products(1, 20);
    serveShop(first, [...products(21, 30), first[0]!]);
    await openShop();
    await waitFor(() => expect(stateCalls().length).toBeGreaterThanOrEqual(1));
    expect(targetsOf(stateCalls()[0])).toEqual(first.map(target));
    expect(stateCalls()[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);

    // The next page (the list may already have asked for it): exactly one more batch, its new items only.
    await endReached('shop-products');
    await waitFor(() => expect(api.callsTo('GET /v1/shop/products')).toHaveLength(2));
    await waitFor(() => expect(stateCalls()).toHaveLength(2));
    expect(targetsOf(stateCalls()[1])).toEqual(products(21, 30).map(target));
    const asked = stateCalls().flatMap(targetsOf).map((t) => t.ref);
    expect(new Set(asked).size).toBe(asked.length);
    await flush();
    expect(stateCalls()).toHaveLength(2);
  });

  it('4. a page of 70 Products is read in batches of at most 60', async () => {
    signedIn();
    serveShop(products(1, 70));
    await openShop();
    await waitFor(() => expect(stateCalls()).toHaveLength(2));
    expect(stateCalls().map((c) => targetsOf(c).length)).toEqual([60, 10]);
  });

  it('5. a guest reads no saved state, and Save explains, offers Sign in, and saves nothing', async () => {
    serveShop([BASKET]);
    const alert = jest.spyOn(Alert, 'alert');
    await openShop();
    await fireEvent.press(await findGuestCard('Basket'));
    expect(alert).toHaveBeenCalledWith(en['buyer.saved.signed_out'], en['buyer.save.card.sign_in'], expect.any(Array));
    const buttons = alert.mock.calls[0]![2]!;
    expect(buttons.map((b) => b.text)).toEqual([en['buyer.saved.cancel'], en['auth.sign_in']]);
    expect(buttons[0]?.style).toBe('cancel');
    expect(screen).toHavePathname('/shop');
    expect(api.calls.filter((c) => c.path.startsWith('/v1/collections'))).toEqual([]);
    expect(useUiStore.getState().pendingSave).toBeNull();
  });

  it('6. a re-render reads nothing again', async () => {
    signedIn();
    serveShop(products(1, 5));
    await openShop();
    await waitFor(() => expect(stateCalls()).toHaveLength(1));
    await act(async () => useUiStore.setState({ themePreference: 'dark' }));
    await act(async () => useUiStore.setState({ themePreference: 'light' }));
    await flush();
    expect(stateCalls()).toHaveLength(1);
  });

  it('7. a pull reads the page and its saved state again (another device saved meanwhile)', async () => {
    signedIn();
    serveShop([BASKET]);
    await openShop();
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    expect(isOn(card('Basket'))).toBe(false);
    fc.saveElsewhere(target(BASKET));
    await pull('shop-products');
    await waitFor(() => expect(stateCalls()).toHaveLength(2));
    await waitFor(() => expect(isOn(card('Basket'))).toBe(true));
  });

  it('a failed read offers Try again on the card, which reads the batch again', async () => {
    signedIn();
    serveShop([BASKET]);
    let fail = true;
    fc.intercept('state', () => (fail ? problem(500, 'INTERNAL', 'request') : undefined));
    await openShop();
    const retry = await screen.findByRole('button', { name: 'Could not check whether Basket is saved. Try again.' });
    fail = false;
    await fireEvent.press(retry);
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    expect(stateCalls()).toHaveLength(2);
  });
});

describe('Save on Shop cards', () => {
  it('8, 9, 11. saves only once the server accepts it, shows it in Saved, and Saved removes it', async () => {
    signedIn();
    serveShop([BASKET]);
    const gate = held();
    fc.intercept('add', async () => {
      await gate.gate;
      return undefined;
    });
    await openShop();
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    await fireEvent.press(card('Basket'));
    // In flight: busy, and never drawn as saved before the answer.
    const saving = await screen.findByRole('togglebutton', { name: 'Saving Basket' });
    expect(isOn(saving)).toBe(false);
    expect(saving.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await act(async () => gate.release());
    await waitFor(() => expect(isOn(card('Basket'))).toBe(true));
    expect(adds()[0]).toMatchObject({
      path: `/v1/collections/${DEFAULT_COLLECTION_REF}/items`,
      body: { target: target(BASKET), source_surface: 'SHOP' },
    });
    expect(adds()[0]?.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    // One request for one change: the answer is drawn in place, no batch is read again.
    expect(stateCalls()).toHaveLength(1);

    await fireEvent.press(bottomTab(en['buyer.tab.saved']));
    expect(await screen.findByText('Basket')).toBeOnTheScreen();
    await fireEvent.press(bottomTab(en['buyer.tab.shop']));

    await fireEvent.press(card('Basket'));
    await waitFor(() => expect(isOn(card('Basket'))).toBe(false));
    expect(removes()[0]?.path).toMatch(new RegExp(`^/v1/collections/${DEFAULT_COLLECTION_REF}/items/`));
    expect(fc.items).toEqual([]);
  });

  it('10. a Product only in a named Collection is not drawn as Saved; Save adds the Saved membership and keeps the named one', async () => {
    signedIn();
    const gifts = fc.named('Gifts');
    fc.saveElsewhere(target(BASKET), gifts);
    serveShop([BASKET]);
    await openShop();
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    expect(isOn(card('Basket'))).toBe(false);
    await fireEvent.press(card('Basket'));
    await waitFor(() => expect(isOn(card('Basket'))).toBe(true));
    expect(fc.items.map((i) => i.collection).sort()).toEqual([DEFAULT_COLLECTION_REF, gifts].sort());
    await fireEvent.press(card('Basket'));
    await waitFor(() => expect(isOn(card('Basket'))).toBe(false));
    expect(fc.items.map((i) => i.collection)).toEqual([gifts]);
  });

  it('16, 17. a Save tap never opens the Product; the tile still does', async () => {
    signedIn();
    serveShop([BASKET]);
    api.on('GET /v1/storefronts/seller-1/products/basket', () => ok(storefrontProduct('basket', 'Basket', { id: BASKET.id })));
    await openShop();
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    await fireEvent.press(card('Basket'));
    await waitFor(() => expect(isOn(card('Basket'))).toBe(true));
    expect(screen).toHavePathname('/shop');
    await fireEvent.press(screen.getByRole('button', { name: /^Basket, / }));
    await waitFor(() => expect(screen).toHavePathname('/product/seller-1/basket'));
    // Product Detail reads the same server state: Saved.
    expect(await screen.findByRole('button', { name: en['buyer.save.saved'] })).toBeOnTheScreen();
  });

  it('18. offline: says why, stays unsaved, and the next tap saves once', async () => {
    signedIn();
    serveShop([BASKET]);
    let answer: Reply | undefined = 'offline';
    fc.intercept('add', () => answer);
    const alert = jest.spyOn(Alert, 'alert');
    await openShop();
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    await fireEvent.press(card('Basket'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(en['buyer.save.failed'], expect.stringMatching(/./)));
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    expect(isOn(card('Basket'))).toBe(false);
    answer = undefined;
    await fireEvent.press(card('Basket'));
    await waitFor(() => expect(isOn(card('Basket'))).toBe(true));
    expect(fc.items).toHaveLength(1);
  });

  it('a failure is said once: a later Save on another card does not repeat it (review R1)', async () => {
    signedIn();
    const SCARF = shopProduct('scarf', 'Scarf');
    serveShop([BASKET, SCARF]);
    fc.intercept('add', (call) => ((call.body?.target as { ref: string }).ref === BASKET.id ? 'offline' : undefined));
    const alert = jest.spyOn(Alert, 'alert');
    await openShop();
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    await fireEvent.press(card('Basket'));
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    await fireEvent.press(card('Scarf'));
    await waitFor(() => expect(isOn(card('Scarf'))).toBe(true));
    await flush();
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('19. a refusal (no longer public) stays unsaved, says why, and reads that card again', async () => {
    signedIn();
    serveShop([BASKET]);
    const alert = jest.spyOn(Alert, 'alert');
    await openShop();
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    fc.hide(target(BASKET));
    await fireEvent.press(card('Basket'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(en['buyer.save.failed'], expect.stringMatching(/./)));
    await waitFor(() => expect(stateCalls()).toHaveLength(2));
    expect(isOn(card('Basket'))).toBe(false);
    expect(fc.items).toEqual([]);
  });

  it('20. a second tap while the first is in flight sends nothing', async () => {
    signedIn();
    serveShop([BASKET]);
    const gate = held();
    fc.intercept('add', async () => {
      await gate.gate;
      return undefined;
    });
    await openShop();
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    await fireEvent.press(card('Basket'));
    await fireEvent.press(await screen.findByRole('togglebutton', { name: 'Saving Basket' }));
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Saving Basket' }));
    await act(async () => gate.release());
    await waitFor(() => expect(isOn(card('Basket'))).toBe(true));
    expect(adds()).toHaveLength(1);
  });
});

describe('Save on Search and Seller Profile cards', () => {
  const serveSearch = () =>
    api.on('GET /v1/search', (call) => {
      const type = call.query.type ?? 'TOP';
      const items =
        type === 'PRODUCT_POST'
          ? [{ type: 'PRODUCT_POST', payload: BASKET }]
          : type === 'SCENE_POST'
            ? [{ type: 'SCENE_POST', payload: MORNING }]
            : [
                { type: 'SELLER', payload: { handle: 'seller-1', store_name: 'Store 1', trust_level: null } },
                { type: 'PRODUCT_POST', payload: BASKET },
                { type: 'SCENE_POST', payload: MORNING },
              ];
      return ok({ market_resolved: true, type, algorithm_version: 'lexical-trgm-v1', items, next_cursor: null });
    });
  const search = async (text: string) => {
    await renderRouter(APP_DIR, { initialUrl: '/search' });
    await fireEvent.changeText(await screen.findByLabelText(en['buyer.search.input']), text);
    await act(() => jest.advanceTimersByTimeAsync(1000));
  };

  it('12, 13. Search: Top rows save Products and Scenes (never a Seller); the Products and Scenes grids too', async () => {
    signedIn();
    serveSearch();
    await search('basket');
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    // One batch for the Top page: its Product and its Scene; the Seller is not a target.
    expect(targetsOf(stateCalls()[0])).toEqual([target(BASKET), { type: 'SCENE_POST', ref: MORNING.public_ref }]);
    expect(screen.queryByRole('togglebutton', { name: /Store 1/ })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('search-tab-PRODUCT_POST'));
    await waitFor(() => expect(stateCalls()).toHaveLength(2));
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    await fireEvent.press(card('Basket'));
    await waitFor(() => expect(isOn(card('Basket'))).toBe(true));
    expect(adds()[0]?.body).toEqual({ target: target(BASKET), source_surface: 'SEARCH' });

    await fireEvent.press(screen.getByTestId('search-tab-SCENE_POST'));
    await waitFor(() => expect(isIdle(card('Morning light'))).toBe(true));
    await fireEvent.press(card('Morning light'));
    await waitFor(() => expect(isOn(card('Morning light'))).toBe(true));
    expect(adds()[1]?.body).toEqual({ target: { type: 'SCENE_POST', ref: MORNING.public_ref }, source_surface: 'SEARCH' });
    expect(screen).toHavePathname('/search');
    // Search -> Save -> Saved.
    await act(() => router.navigate('/saved'));
    await fireEvent.press(await screen.findByTestId('filter-tab-SCENE_POST'));
    expect(await screen.findByText('Morning light')).toBeOnTheScreen();
  });

  it('14, 15. Seller Profile: Scene and Product cards save with the Seller Profile surface', async () => {
    signedIn();
    const scene = sellerScene(1);
    const product = sellerProduct('basket', 'Basket');
    api.on('GET /v1/storefronts/seller-1', () => ok(storefront('seller-1')));
    api.on('GET /v1/storefronts/seller-1/scenes', () => ok({ data: [scene], next_cursor: null }));
    api.on('GET /v1/storefronts/seller-1/products', () => ok({ data: [product], next_cursor: null }));
    await renderRouter(APP_DIR, { initialUrl: '/sellers/seller-1' });
    await waitFor(() => expect(isIdle(card(scene.caption))).toBe(true));
    await fireEvent.press(card(scene.caption));
    await waitFor(() => expect(isOn(card(scene.caption))).toBe(true));
    expect(adds()[0]?.body).toEqual({ target: { type: 'SCENE_POST', ref: scene.public_ref }, source_surface: 'SELLER_PROFILE' });

    await fireEvent.press(screen.getByRole('tab', { name: en['buyer.seller.tab.products'] }));
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));
    await fireEvent.press(card('Basket'));
    await waitFor(() => expect(isOn(card('Basket'))).toBe(true));
    expect(adds()[1]?.body).toEqual({ target: { type: 'PRODUCT_POST', ref: product.id }, source_surface: 'SELLER_PROFILE' });
    expect(screen).toHavePathname('/sellers/seller-1');
  });
});

describe('sessions', () => {
  const twoAccounts = () => {
    let verified = 0;
    api.on('POST /v1/auth/otp/verify', (call) =>
      call.body?.code === SIGN_IN_CODE
        ? ok({
            account_id: '0b6f1a3e-1111-4111-8111-11111111111b',
            audience: 'MOBILE',
            roles: [],
            expires_at: '2026-12-09T12:00:00.000Z',
            token: verified++ === 0 ? TOKEN_B : GOOD_TOKEN,
          })
        : problem(401, 'OTP_INVALID', 'auth'),
    );
    api.on('GET /v1/bootstrap', (call) => ok(bootstrapBody(call.headers.Authorization ? { account_context: SIGNED_IN_CONTEXT } : {})));
  };
  const signIn = async () => {
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), PHONE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), SIGN_IN_CODE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
  };

  it('21. a guest saves from a card: Sign in, back on the Product, saved in the new session only', async () => {
    serveShop([BASKET]);
    api.on('GET /v1/storefronts/seller-1/products/basket', () => ok(storefrontProduct('basket', 'Basket', { id: BASKET.id })));
    const alert = jest.spyOn(Alert, 'alert');
    await openShop();
    await fireEvent.press(await findGuestCard('Basket'));
    await act(async () => alert.mock.calls[0]![2]![1]!.onPress!());
    await waitFor(() => expect(screen).toHavePathname('/auth/sign-in'));
    expect(screen).toHaveSearchParams(expect.objectContaining({ returnTo: '/product/seller-1/basket', save: expect.stringMatching(/^[0-9a-f-]{36}$/) }));
    expect(adds()).toEqual([]);
    await signIn();
    await waitFor(() => expect(screen).toHavePathname('/product/seller-1/basket'));
    expect(await screen.findByRole('button', { name: en['buyer.save.saved'] })).toBeOnTheScreen();
    expect(adds()).toHaveLength(1);
    expect(adds()[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
    expect(adds()[0]?.body).toEqual({ target: target(BASKET), source_surface: 'SHOP' });
    // Back leaves the Product for the Shop it was saved from (review R2), not sign-in or the Product again.
    await act(() => router.back());
    await waitFor(() => expect(screen).toHavePathname('/shop'));
  });

  it('26, 27. a late batch answer for Account A never reaches the guest or Account B', async () => {
    twoAccounts();
    signedIn(); // Account A, restored
    serveShop([BASKET]);
    const gate = held();
    const asA = (c: Recorded) => c.headers.Authorization === `Bearer ${GOOD_TOKEN}`;
    // A has Basket saved; A's answer is held until after the switch.
    fc.intercept('state', async (call) => {
      if (!asA(call)) return undefined;
      await gate.gate;
      return ok({
        default_collection_ref: DEFAULT_COLLECTION_REF,
        items: [{ ...target(BASKET), saved: true, default_item_ref: '0c000000-0000-4000-8000-0000000000aa', memberships: [] }],
      });
    });
    await openShop();
    await waitFor(() => expect(stateCalls().filter(asA)).toHaveLength(1));

    await act(() => router.navigate('/account'));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await act(() => router.navigate('/shop'));
    expect(await findGuestCard('Basket')).toBeOnTheScreen(); // the guest's card: nothing private
    await act(() => router.navigate('/account'));
    await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
    await signIn(); // Account B
    await act(() => router.navigate('/shop'));
    await waitFor(() => expect(stateCalls().filter((c) => c.headers.Authorization === `Bearer ${TOKEN_B}`).length).toBeGreaterThanOrEqual(1));
    await waitFor(() => expect(isIdle(card('Basket'))).toBe(true));

    await act(async () => gate.release());
    await flush();
    expect(isOn(card('Basket'))).toBe(false); // B has nothing saved; A's answer is nowhere
    expect(adds()).toEqual([]);
  });
});
