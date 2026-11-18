import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AppState, type AppStateStatus } from 'react-native';

import { formatMinor } from '../i18n/i18n';
import { useUiStore } from '../state/ui-store';
import {
  DEFAULT_COLLECTION_REF,
  GOOD_TOKEN,
  SIGNED_IN_CONTEXT,
  SIGN_IN_CODE,
  bootstrapBody,
  fypUnit,
  installFakeApi,
  problem,
  publicScene,
  sellerProduct,
  sellerScene,
  storefront,
  storefrontProduct,
  type Recorded,
  type Reply,
} from '../testing/fake-api';
import { TOKEN_KEY, memory, resetSecureStore } from '../testing/secure-store-mock';

/**
 * The Product and the Seller profile as the Buyer moves between them (Seller -> Product ->
 * Seller, Scene -> Product, Product -> messaging), how they are reached cold as a guest or by an
 * unusable link, and what a retained screen asks for when the Account changes. Real route tree,
 * fake API on the generated contract.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const HANDLE = 'seller-1';
const PRODUCT_PATH = `/product/${HANDLE}/basket`;
const HEADER = `GET /v1/storefronts/${HANDLE}`;
const SCENES = `GET /v1/storefronts/${HANDLE}/scenes`;
const PRODUCTS = `GET /v1/storefronts/${HANDLE}/products`;
const BASKET = `GET /v1/storefronts/${HANDLE}/products/basket`;
const OTHER_TOKEN = 'Other_credential_for_tests_0123456789abcdef';
const A = `Bearer ${GOOD_TOKEN}`;
const B = `Bearer ${OTHER_TOKEN}`;
const CONVERSATION = 'c0000000-0000-4000-8000-000000000001';
const SELLER_ID = storefront(HANDLE).seller_id;
const etb = (minor: number) => formatMinor('en', minor, 'ETB');

let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
const gone = (): Reply => problem(404, 'NOT_FOUND', 'request');
/** Serve these replies in order; the last one repeats. */
function serve(route: string, ...replies: Reply[]) {
  let i = 0;
  api.on(route, () => replies[Math.min(i++, replies.length - 1)]!);
}
const calls = (route: string) => api.callsTo(route);
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const open = (path: string) => act(() => router.push(path as never));
const back = async () => {
  await act(() => router.back());
  await settle();
};
const signedIn = (token = GOOD_TOKEN) => resetSecureStore({ [TOKEN_KEY]: token });
const variant = (id: string, key: string, minor: number, available = true) => ({
  id,
  variant_key: key,
  price_minor: minor,
  price_currency: 'ETB',
  stock_count: available ? 3 : 0,
  stock_confirmed_at: null,
  status: 'ACTIVE',
  available,
});
/** Every request that is not a technical one (device registration, bootstrap). */
const isPrivateRead = (c: Recorded) => /^\/v1\/(collections|conversations|notifications|account)/.test(c.path);

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  api.on(HEADER, () => ok(storefront(HANDLE)));
  api.on(SCENES, () => ok({ data: [sellerScene(1), sellerScene(2)], next_cursor: null }));
  api.on(BASKET, () => ok(storefrontProduct('basket', 'Woven basket')));
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

describe('moving between the Seller profile, the Product and the Scene', () => {
  it('Seller profile -> Product opens the Product by the profile handle and the Product slug; Back is the profile, read again', async () => {
    serve(PRODUCTS, ok({ data: [sellerProduct('basket', 'Woven basket')], next_cursor: null }));
    const r = await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    await fireEvent.press(await screen.findByTestId('seller-tab-products'));
    await fireEvent.press(await screen.findByTestId('product-tile'));
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    expect(r.getPathname()).toBe(PRODUCT_PATH);
    await back();
    expect(r.getPathname()).toBe(`/sellers/${HANDLE}`);
    expect(await screen.findByTestId('product-tile')).toBeOnTheScreen();
    // Back on the profile: the header and the visible list are asked again, both as revalidations.
    expect(calls(HEADER).map((c) => c.query['revalidate'])).toEqual([undefined, 'true']);
    expect(calls(PRODUCTS)).toHaveLength(2);
  });

  it('Product -> Seller opens the Seller of that Product; Back is the Product, read again as a revalidation', async () => {
    const r = await renderRouter(APP_DIR, { initialUrl: PRODUCT_PATH });
    await fireEvent.press(await screen.findByTestId('product-seller'));
    expect(await screen.findByRole('header', { name: 'Store 1' })).toBeOnTheScreen();
    expect(r.getPathname()).toBe(`/sellers/${HANDLE}`);
    await back();
    expect(r.getPathname()).toBe(PRODUCT_PATH);
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    expect(calls(BASKET).map((c) => c.query['revalidate'])).toEqual([undefined, 'true']);
  });

  it('Back from the Seller shows the Product as it is now: a sold-out option and a new price replace the earlier answer', async () => {
    const small = '0b6f1a3e-5555-4555-8555-555555555555';
    const large = '0b6f1a3e-6666-4666-8666-666666666666';
    serve(
      BASKET,
      ok(storefrontProduct('basket', 'Woven basket', { price_min_minor: 85000, price_max_minor: 95000, variants: [variant(small, 'Small', 85000), variant(large, 'Large', 95000)] })),
      ok(storefrontProduct('basket', 'Woven basket', { price_min_minor: 90000, price_max_minor: 95000, variants: [variant(small, 'Small', 90000, false), variant(large, 'Large', 95000)] })),
    );
    await renderRouter(APP_DIR, { initialUrl: PRODUCT_PATH });
    expect(await screen.findByLabelText(`Small, ${etb(85000)}, Available`)).toBeOnTheScreen();
    await fireEvent.press(await screen.findByTestId('product-seller'));
    await screen.findByRole('header', { name: 'Store 1' });
    await back();
    expect(await screen.findByLabelText(`Small, ${etb(90000)}, Currently unavailable`)).toBeOnTheScreen();
    expect(screen.getByText(`${etb(90000)} \u2013 ${etb(95000)}`)).toBeOnTheScreen();
    expect(screen.queryByLabelText(`Small, ${etb(85000)}, Available`)).not.toBeOnTheScreen();
  });

  it('Scene -> Product opens the tagged Product of that Scene\u2019s Seller; Back is the Scene', async () => {
    const ref = fypUnit(1).public_ref;
    api.on(`GET /v1/scene-posts/${ref}`, () => ok(publicScene(1, { seller: { handle: HANDLE, store_name: 'Store 1' }, products: [{ position: 1, slug: 'basket', name: 'Woven basket', base_price_minor: 1, base_price_currency: 'ETB', price_min_minor: 80000, price_max_minor: 80000, price_currency: 'ETB', image_key: null, available: true }] })));
    const r = await renderRouter(APP_DIR, { initialUrl: `/scenes/${ref}` });
    await fireEvent.press(await screen.findByRole('radio', { name: /^1\. Woven basket,/ }));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.product.view'] }));
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    expect(r.getPathname()).toBe(PRODUCT_PATH);
    await back();
    expect(r.getPathname()).toBe(`/scenes/${ref}`);
  });

  it('a Seller Scene opens Explore the Scene, whose Product opens the Product: three screens, then Back, Back', async () => {
    const ref = sellerScene(1).public_ref;
    api.on(`GET /v1/scene-posts/${ref}`, () => ok(publicScene(1, { seller: { handle: HANDLE, store_name: 'Store 1' }, products: [{ position: 1, slug: 'basket', name: 'Woven basket', base_price_minor: 1, base_price_currency: 'ETB', price_min_minor: 80000, price_max_minor: 80000, price_currency: 'ETB', image_key: null, available: true }] })));
    const r = await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    await fireEvent.press(await screen.findByLabelText('Scene: Seller scene 1'));
    await fireEvent.press(await screen.findByRole('radio', { name: /^1\. Woven basket,/ }));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.product.view'] }));
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    await back();
    expect(r.getPathname()).toBe(`/scenes/${ref}`);
    await back();
    expect(r.getPathname()).toBe(`/sellers/${HANDLE}`);
  });

  it('Product -> Ask the Seller about this Product opens the one conversation by the Seller\u2019s id; Back is the Product', async () => {
    signedIn();
    api.on('POST /v1/conversations', () => ({ status: 201, body: { conversation_id: CONVERSATION } }));
    api.onPattern('GET', /^\/v1\/conversations\/[^/]+\/messages$/, () => ok({ data: [], next_cursor: null }));
    api.on('GET /v1/conversations', () => ok({ data: [], next_cursor: null }));
    const r = await renderRouter(APP_DIR, { initialUrl: PRODUCT_PATH });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.chat.ask_about_product'] }));
    await waitFor(() => expect(r.getPathname()).toBe(`/chat/${CONVERSATION}`));
    expect(calls('POST /v1/conversations')[0]?.body).toEqual({ seller_id: SELLER_ID });
    await back();
    expect(r.getPathname()).toBe(PRODUCT_PATH);
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
  });
});

describe('a link opened cold', () => {
  it('a guest reaches a Product by its link, asks for nothing private and sends no credential; Back is Home', async () => {
    const r = await renderRouter(APP_DIR, { initialUrl: PRODUCT_PATH });
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    await settle();
    expect(api.calls.filter(isPrivateRead)).toEqual([]);
    expect(api.calls.filter((c) => c.headers.Authorization !== undefined)).toEqual([]);
    await back();
    expect(r.getPathname()).toBe('/home/for-you');
  });

  it('a guest reaches a Seller profile by its link, asks for nothing private and sends no credential; Back is Home', async () => {
    const r = await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    expect(await screen.findByRole('header', { name: 'Store 1' })).toBeOnTheScreen();
    await screen.findByLabelText('Scene: Seller scene 1');
    await settle();
    expect(api.calls.filter(isPrivateRead)).toEqual([]);
    expect(api.calls.filter((c) => c.headers.Authorization !== undefined)).toEqual([]);
    await back();
    expect(r.getPathname()).toBe('/home/for-you');
  });

  it.each([
    ['a Product the server does not serve (private, removed or never public)', PRODUCT_PATH, en['buyer.product.gone'], BASKET],
    ['a Seller the server does not serve', `/sellers/${HANDLE}`, en['buyer.seller.gone'], HEADER],
  ])('%s is one neutral message with a way out, and nothing of it', async (_what, path, message, route) => {
    api.on(route, () => gone());
    const r = await renderRouter(APP_DIR, { initialUrl: path });
    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(screen.queryByText(/Store 1|Woven basket|private|removed/i)).not.toBeOnTheScreen();
    expect(api.calls.filter((c) => c.headers.Authorization !== undefined)).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.scene.go_back'] }));
    await settle();
    expect(r.getPathname()).toBe('/home/for-you');
  });

  it.each([
    ['an upper-case handle', '/product/Seller-1/basket', en['buyer.product.gone']],
    ['an encoded slash', '/product/seller-1/a%2Fb', en['buyer.product.gone']],
    ['an over-long slug', `/product/seller-1/${'a'.repeat(121)}`, en['buyer.product.gone']],
    ['a Seller handle with a dot', '/sellers/seller.1', en['buyer.seller.gone']],
    ['a Seller handle with an encoded slash', '/sellers/a%2Fb', en['buyer.seller.gone']],
  ])('%s asks the server nothing and says only that it is not available', async (_what, path, message) => {
    await renderRouter(APP_DIR, { initialUrl: path });
    expect(await screen.findByText(message)).toBeOnTheScreen();
    await settle();
    expect(api.calls.filter((c) => c.path.startsWith('/v1/storefronts/'))).toEqual([]);
  });

  it.each([
    ['a Product link with no slug', `/product/${HANDLE}`],
    ['a Product link with an extra segment', `/product/${HANDLE}/basket/extra`],
    ['a Seller link with no handle', '/sellers'],
    ['a Seller link with an extra segment', `/sellers/${HANDLE}/extra`],
    ['a Product link whose slug is a dot segment', '/product/seller-1/..'],
  ])('%s never reaches a Product or a Seller: it goes to Buyer Home and asks nothing', async (_what, path) => {
    const r = await renderRouter(APP_DIR, { initialUrl: path });
    expect(await screen.findByText(en['buyer.for_you.empty'], {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
    expect(api.calls.filter((c) => c.path.startsWith('/v1/storefronts/'))).toEqual([]);
  });
});

describe('the Account changes while a Product or a Seller profile is kept in the stack', () => {
  const SAVED_STATE = 'POST /v1/collections/saved-state:batch';
  const A_ITEM = 'a0000000-0000-4000-8000-00000000a001';
  /** While set, the second Account's saved-state answers wait for it. */
  let hold: Promise<void> | null = null;
  beforeEach(() => {
    hold = null;
  });
  /** Two Accounts. The first has the Product saved; the second does not. */
  function accounts() {
    signedIn();
    api.on('GET /v1/bootstrap', (call) => (call.headers.Authorization ? ok(bootstrapBody({ account_context: SIGNED_IN_CONTEXT })) : ok(bootstrapBody())));
    api.on('POST /v1/auth/otp/verify', (call) =>
      call.body?.code === SIGN_IN_CODE
        ? ok({ account_id: '0b6f1a3e-3333-4333-8333-333333333333', audience: 'MOBILE', roles: [], expires_at: '2026-12-09T12:00:00.000Z', token: OTHER_TOKEN })
        : problem(401, 'OTP_INVALID', 'auth'),
    );
    api.on(SAVED_STATE, async (call) => {
      const targets = (call.body?.targets ?? []) as Array<{ type: string; ref: string }>;
      const first = call.headers.Authorization === A;
      if (!first && hold) await hold;
      return ok({
        default_collection_ref: DEFAULT_COLLECTION_REF,
        items: targets.map((t) => ({ ...t, saved: first, default_item_ref: first ? A_ITEM : null, memberships: first ? [{ collection_ref: DEFAULT_COLLECTION_REF, item_ref: A_ITEM }] : [] })),
      });
    });
    api.on('POST /v1/conversations', (call) => (call.headers.Authorization ? { status: 201, body: { conversation_id: CONVERSATION } } : problem(401, 'SESSION_EXPIRED', 'auth')));
    api.onPattern('GET', /^\/v1\/conversations\/[^/]+\/messages$/, () => ok({ data: [], next_cursor: null }));
    api.on('GET /v1/conversations', () => ok({ data: [], next_cursor: null }));
  }
  /** From the open screen: push You over it (it stays in the stack), sign out, sign in as the second Account. */
  async function switchAccount() {
    await open('/account');
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), '+251911000002');
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), SIGN_IN_CODE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
    await waitFor(() => expect(memory.get(TOKEN_KEY)).toBe(OTHER_TOKEN));
  }
  const afterSignOut = () => {
    const at = api.calls.findIndex((c) => c.path === '/v1/auth/logout');
    expect(at).toBeGreaterThanOrEqual(0);
    return api.calls.slice(at + 1);
  };
  const mentions = (needle: string) => (c: Recorded) => c.path.includes(needle) || JSON.stringify(c.query).includes(needle) || JSON.stringify(c.body ?? {}).includes(needle);

  it('a kept Product shows the second Account\u2019s Save state, never the first Account\u2019s, and nothing under the second credential names the first Account\u2019s Save', async () => {
    accounts();
    let release!: () => void;
    await renderRouter(APP_DIR, { initialUrl: PRODUCT_PATH });
    expect(await screen.findByRole('button', { name: en['buyer.save.saved'] })).toBeOnTheScreen();
    // The second Account's answer is on its way when the Buyer looks at the kept Product.
    hold = new Promise<void>((resolve) => (release = resolve));
    await switchAccount();
    await settle();
    await open(PRODUCT_PATH);
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    // Until it lands nothing says Saved, and nothing can be saved or removed on the strength of the first Account's state.
    expect(screen.queryByRole('button', { name: en['buyer.save.saved'] })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['buyer.save.save'] })).toBeDisabled();
    await act(async () => release());
    await settle();
    const later = afterSignOut();
    expect(later.filter(mentions(A_ITEM))).toEqual([]);
    expect(later.filter((c) => c.headers.Authorization !== undefined).every((c) => c.headers.Authorization === B)).toBe(true);
    // The second Account's view of it.
    expect(await screen.findByRole('button', { name: en['buyer.save.save'] })).toBeEnabled();
    expect(screen.queryByRole('button', { name: en['buyer.save.saved'] })).not.toBeOnTheScreen();
    expect(afterSignOut().filter(mentions(A_ITEM))).toEqual([]);
  });

  it('a kept Seller profile opens the conversation for the second Account under its own credential', async () => {
    accounts();
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    await screen.findByRole('button', { name: en['buyer.chat.message_seller'] });
    await switchAccount();
    await settle();
    expect(afterSignOut().filter(isPrivateRead).filter((c) => c.headers.Authorization === A)).toEqual([]);
    await open(`/sellers/${HANDLE}`);
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.chat.message_seller'] }));
    await waitFor(() => expect(calls('POST /v1/conversations')).toHaveLength(1));
    expect(calls('POST /v1/conversations')[0]?.headers.Authorization).toBe(B);
    expect(calls('POST /v1/conversations')[0]?.body).toEqual({ seller_id: SELLER_ID });
  });

  it('an unconfirmed Ask the Seller of the first Account is not repeated under the second Account\u2019s credential or its idempotency key', async () => {
    accounts();
    let first = true;
    api.on('POST /v1/conversations', (call) => {
      if (first && call.headers.Authorization === A) {
        first = false;
        return 'offline';
      }
      return call.headers.Authorization ? { status: 201, body: { conversation_id: CONVERSATION } } : problem(401, 'SESSION_EXPIRED', 'auth');
    });
    await renderRouter(APP_DIR, { initialUrl: PRODUCT_PATH });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.chat.ask_about_product'] }));
    await waitFor(() => expect(calls('POST /v1/conversations')).toHaveLength(1));
    await settle();
    await switchAccount();
    await settle();
    await open(PRODUCT_PATH);
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.chat.ask_about_product'] }));
    await waitFor(() => expect(calls('POST /v1/conversations')).toHaveLength(2));
    const [one, two] = calls('POST /v1/conversations');
    expect(one?.headers.Authorization).toBe(A);
    expect(two?.headers.Authorization).toBe(B);
    expect(two?.headers['Idempotency-Key']).not.toBe(one?.headers['Idempotency-Key']);
  });
});

describe('returning from the background', () => {
  let listeners: ((state: AppStateStatus) => void)[] = [];
  let appState: jest.SpyInstance | undefined;
  let original: ((...args: never[]) => unknown) | undefined;
  const goTo = (state: AppStateStatus) =>
    act(() => {
      for (const listener of [...listeners]) listener(state);
    });
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

  it('after the interval the Product is withheld until the server answers again, and a Product gone private stays gone', async () => {
    serve(BASKET, ok(storefrontProduct('basket', 'Woven basket')), gone());
    await renderRouter(APP_DIR, { initialUrl: PRODUCT_PATH });
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    await goTo('background');
    await act(() => jest.advanceTimersByTimeAsync(6 * 60_000));
    await goTo('active');
    await settle();
    expect(await screen.findByText(en['buyer.product.gone'])).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Woven basket' })).not.toBeOnTheScreen();
  });
});
