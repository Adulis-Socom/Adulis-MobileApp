import { en } from '@adulis/locale/mobile';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { useUiStore } from '../state/ui-store';
import { bootstrapBody, installFakeApi, storefront, storefrontProduct, type Reply, type StorefrontProduct } from '../testing/fake-api';
import { resetSecureStore } from '../testing/secure-store-mock';

/**
 * The Product's own screen as a reader meets it: its photos, the states before there is anything
 * to show, and the Seller it names. Real route tree, fake API on the generated contract.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const HANDLE = 'seller-1';
const PATH = `/product/${HANDLE}/basket`;
const BASKET = `GET /v1/storefronts/${HANDLE}/products/basket`;
const ORIGIN = 'https://media.example.test';

let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
function serve(route: string, ...replies: Reply[]) {
  let i = 0;
  api.on(route, () => replies[Math.min(i++, replies.length - 1)]!);
}
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const withImages = (keys: string[], over: Partial<StorefrontProduct> = {}) =>
  storefrontProduct('basket', 'Woven basket', {
    images: keys.map((key, i) => ({ position: i + 1, thumb_key: `${key}/thumb.webp`, card_key: `${key}/card.webp`, full_key: `${key}/full.webp` })),
    ...over,
  });
const photos = () => screen.queryAllByTestId('product-photo');
const uris = () => photos().map((p) => (p.props.source as Array<{ uri: string }>)[0]?.uri);

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  api.on('GET /v1/bootstrap', () => ok(bootstrapBody({ media_public_origin: ORIGIN })));
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

describe('the Product photos', () => {
  it('are shown in the server order, each by its card key under the media origin, each named by its place and the Product', async () => {
    serve(BASKET, ok(withImages(['products/a', 'products/b', 'products/c'])));
    await renderRouter(APP_DIR, { initialUrl: PATH });
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    expect(uris()).toEqual([`${ORIGIN}/products/a/card.webp`, `${ORIGIN}/products/b/card.webp`, `${ORIGIN}/products/c/card.webp`]);
    expect(photos().map((p) => p.props.accessibilityLabel)).toEqual([
      'Photo 1 of 3 of Woven basket',
      'Photo 2 of 3 of Woven basket',
      'Photo 3 of 3 of Woven basket',
    ]);
  });

  it('leave out one that failed, number the rest again, and keep the others', async () => {
    serve(BASKET, ok(withImages(['products/a', 'products/b'])));
    await renderRouter(APP_DIR, { initialUrl: PATH });
    await screen.findByRole('header', { name: 'Woven basket' });
    await fireEvent(photos()[0]!, 'error', { nativeEvent: { error: 'network' } });
    expect(uris()).toEqual([`${ORIGIN}/products/b/card.webp`]);
    expect(photos()[0]?.props.accessibilityLabel).toBe('Photo 1 of 1 of Woven basket');
    expect(screen.queryByText(en['buyer.scene.photo_unavailable'])).not.toBeOnTheScreen();
  });

  it('say the photo is unavailable when every one failed, and try again when a new answer arrives', async () => {
    serve(BASKET, ok(withImages(['products/a'])), ok(withImages(['products/a'])));
    await renderRouter(APP_DIR, { initialUrl: PATH });
    await screen.findByRole('header', { name: 'Woven basket' });
    await fireEvent(photos()[0]!, 'error', { nativeEvent: { error: 'network' } });
    expect(photos()).toHaveLength(0);
    expect(screen.getByText(en['buyer.scene.photo_unavailable'])).toBeOnTheScreen();
    await act(() => (screen.getByTestId('product-detail').props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());
    await settle();
    expect(uris()).toEqual([`${ORIGIN}/products/a/card.webp`]);
    expect(screen.queryByText(en['buyer.scene.photo_unavailable'])).not.toBeOnTheScreen();
  });

  it('are not drawn, and the screen says so, when the Product has none or there is no media origin', async () => {
    serve(BASKET, ok(withImages([])));
    await renderRouter(APP_DIR, { initialUrl: PATH });
    await screen.findByRole('header', { name: 'Woven basket' });
    expect(photos()).toHaveLength(0);
    expect(screen.getByText(en['buyer.scene.photo_unavailable'])).toBeOnTheScreen();
  });

  it('are not drawn from an address built without the origin the server named', async () => {
    api.on('GET /v1/bootstrap', () => ok(bootstrapBody({ media_public_origin: '' })));
    serve(BASKET, ok(withImages(['products/a'])));
    await renderRouter(APP_DIR, { initialUrl: PATH });
    await screen.findByRole('header', { name: 'Woven basket' });
    expect(photos()).toHaveLength(0);
    expect(screen.getByText(en['buyer.scene.photo_unavailable'])).toBeOnTheScreen();
  });
});

describe('before there is a Product to show', () => {
  it('a slow read says it is loading, and shows neither a failure, a gone message nor any content', async () => {
    let release: (reply: Reply) => void = () => undefined;
    api.on(BASKET, () => new Promise<Reply>((resolve) => (release = resolve)));
    await renderRouter(APP_DIR, { initialUrl: PATH });
    expect(await screen.findByText(en['buyer.product.loading'])).toBeOnTheScreen();
    for (const text of [en['buyer.product.gone'], en['error.request.internal'], en['common.offline']]) {
      expect(screen.queryByText(text)).not.toBeOnTheScreen();
    }
    expect(screen.queryByRole('button', { name: en['common.retry'] })).not.toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Woven basket' })).not.toBeOnTheScreen();
    await act(async () => release(ok(storefrontProduct('basket', 'Woven basket'))));
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
  });

  it('a read that cannot reach the server says the Buyer is offline with a retry, never "no longer available"', async () => {
    api.on(BASKET, () => 'offline');
    await renderRouter(APP_DIR, { initialUrl: PATH });
    // The client tries a connectivity failure twice more before it says so.
    await settle();
    await act(() => jest.advanceTimersByTimeAsync(5000));
    expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.product.gone'])).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['common.retry'] })).toBeOnTheScreen();
  });
});

describe('the Seller the Product names', () => {
  it('is the Seller of the read: the store name as the link, and Ask the Seller; nothing about trust, rating or sales', async () => {
    serve(BASKET, ok(storefrontProduct('basket', 'Woven basket', { seller: { handle: HANDLE, store_name: 'Zeme Store' } })));
    api.on(`GET /v1/storefronts/${HANDLE}`, () => ok(storefront(HANDLE)));
    await renderRouter(APP_DIR, { initialUrl: PATH });
    expect(await screen.findByText('Sold by Zeme Store')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Sold by Zeme Store' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['buyer.chat.ask_about_product'] })).toBeOnTheScreen();
    // The Product read carries no Trust fact; none is drawn, and none is fetched to fill the gap.
    expect(screen.queryByText(/trust|established|trusted|handoff|rating|out of 5|sold\b.*\d|verified/i, { exact: false })).not.toBeOnTheScreen();
    expect(api.calls.filter((c) => c.path === `/v1/storefronts/${HANDLE}`)).toEqual([]);
  });

  it('shows no fulfilment or delivery wording: the Product read carries none', async () => {
    serve(BASKET, ok(storefrontProduct('basket', 'Woven basket')));
    await renderRouter(APP_DIR, { initialUrl: PATH });
    await screen.findByRole('header', { name: 'Woven basket' });
    expect(screen.queryByText(/deliver|collect|pick ?up|courier|ship|fulfil|arrive|days/i)).not.toBeOnTheScreen();
  });
});
