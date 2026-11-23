import { en } from '@adulis/locale/mobile';
import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AppState, type AppStateStatus } from 'react-native';

import { formatMinor } from '../i18n/i18n';
import { useUiStore } from '../state/ui-store';
import { installFakeApi, problem, storefront, storefrontProduct, type Reply, type StorefrontProduct } from '../testing/fake-api';
import { renderedText } from '../testing/discovery-rules';
import { resetSecureStore } from '../testing/secure-store-mock';

/**
 * A Product that is read again (on returning from the Seller, on a pull) and whose read fails or
 * waits for a connection. The earlier answer stays: the name, the description, the Seller link, Save
 * and Ask the Seller. What the earlier answer said about price, availability and options can no
 * longer be vouched for, so none of it is drawn, and the Buyer is told why with a way to try again.
 * A 404 is still the neutral "no longer available" screen, and a return from the background past
 * the interval still withholds everything.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const HANDLE = 'seller-1';
const PATH = `/product/${HANDLE}/basket`;
const BASKET = `GET /v1/storefronts/${HANDLE}/products/basket`;
const SMALL = '0b6f1a3e-5555-4555-8555-555555555555';
const LARGE = '0b6f1a3e-6666-4666-8666-666666666666';
const etb = (minor: number) => formatMinor('en', minor, 'ETB');
const FAILED = en['error.request.internal'];
const AVAILABLE = en['buyer.product.available'];
const UNAVAILABLE = en['buyer.product.unavailable'];

type Variant = StorefrontProduct['variants'][number];
const option = (id: string, over: Partial<Variant> = {}): Variant => ({
  id,
  variant_key: id === SMALL ? 'Small' : 'Large',
  price_minor: id === SMALL ? 85000 : 95000,
  price_currency: 'ETB',
  stock_count: 3,
  stock_confirmed_at: null,
  status: 'ACTIVE',
  available: true,
  ...over,
});
const basket = (variants: Variant[], over: Partial<StorefrontProduct> = {}) => {
  const prices = variants.map((v) => v.price_minor);
  return storefrontProduct('basket', 'Woven basket', {
    variants,
    price_min_minor: prices.length ? Math.min(...prices) : null,
    price_max_minor: prices.length ? Math.max(...prices) : null,
    ...over,
  });
};
const BOTH = () => basket([option(SMALL), option(LARGE)]);

let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
function serve(...replies: Reply[]) {
  let i = 0;
  api.on(BASKET, () => replies[Math.min(i++, replies.length - 1)]!);
}
const reads = () => api.callsTo(BASKET).length;
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const pull = async () => {
  await act(() => (screen.getByTestId('product-detail').props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());
  await settle();
};
const choice = (key: string, state: string, minor = key === 'Small' ? 85000 : 95000) =>
  screen.getByRole('radio', { name: `${key}, ${etb(minor)}, ${state}` });
const headline = () => screen.queryByTestId('product-price')?.props.children as string | undefined;
const heading = () => screen.queryByRole('header', { name: 'Woven basket' });
const retry = () => screen.queryByRole('button', { name: en['common.retry'] });
const open = async () => {
  await renderRouter(APP_DIR, { initialUrl: PATH });
  expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
};
const toSellerAndBack = async () => {
  await fireEvent.press(screen.getByTestId('product-seller'));
  await screen.findByRole('header', { name: 'Store 1' });
  await act(() => router.back());
  await settle();
};
/** What the earlier answer may still say: the parts of the Product that are not time-sensitive. */
const keptParts = () => {
  expect(heading()).toBeOnTheScreen();
  expect(screen.getByText('About Woven basket')).toBeOnTheScreen();
  expect(screen.getByTestId('product-seller')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: en['buyer.chat.ask_about_product'] })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: en['buyer.save.save'] })).toBeOnTheScreen();
};
/** What it can no longer vouch for: price, availability and every option, chosen or not. */
const withheldParts = () => {
  expect(screen.queryByTestId('product-price')).not.toBeOnTheScreen();
  expect(screen.queryByText(AVAILABLE)).not.toBeOnTheScreen();
  expect(screen.queryByText(UNAVAILABLE)).not.toBeOnTheScreen();
  expect(screen.queryByTestId('product-options')).not.toBeOnTheScreen();
  expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
};

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  api.on(`GET /v1/storefronts/${HANDLE}`, () => ok(storefront(HANDLE)));
  api.on(`GET /v1/storefronts/${HANDLE}/scenes`, () => ok({ data: [], next_cursor: null }));
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

afterEach(() => {
  onlineManager.setOnline(true);
  // Nothing here reaches commerce.
  expect(api.calls.filter((c) => /cart|order|checkout|payment|reservation/i.test(c.path))).toEqual([]);
});

describe('a re-read that fails keeps the Product and withholds what it cannot vouch for', () => {
  it('on returning from the Seller: the name, description, Seller, Save and Ask stay; price, availability and options go; the failure is said with Try again', async () => {
    serve(ok(BOTH()), problem(500, 'INTERNAL', 'request'));
    await open();
    await toSellerAndBack();
    expect(reads()).toBe(2);
    keptParts();
    withheldParts();
    expect(screen.getByText(FAILED)).toBeOnTheScreen();
    expect(retry()).toBeOnTheScreen();
  });

  it('on a pull: the same', async () => {
    serve(ok(BOTH()), problem(500, 'INTERNAL', 'request'));
    await open();
    await pull();
    keptParts();
    withheldParts();
    expect(screen.getByText(FAILED)).toBeOnTheScreen();
    expect(retry()).toBeOnTheScreen();
  });

  it('a lost connection says it was the connection', async () => {
    serve(ok(BOTH()), 'offline');
    await open();
    await pull();
    // The network failure is retried twice (1 s, then 2 s) before it is reported.
    await act(() => jest.advanceTimersByTimeAsync(10_000));
    keptParts();
    withheldParts();
    expect(screen.getByText(en['common.offline'])).toBeOnTheScreen();
  });

  it('says nothing is verified: no stock count, no scarcity or purchase wording, no commerce request, while the Product is kept', async () => {
    serve(ok(basket([option(SMALL, { stock_count: 7 }), option(LARGE, { stock_count: 42 })])), problem(500, 'INTERNAL', 'request'));
    await open();
    await pull();
    keptParts();
    const texts = renderedText(screen.getByTestId('product-detail')).join(' | ');
    expect(texts).not.toMatch(/\b(7|42)\b/);
    expect(texts).not.toMatch(/stock|left|only|few|last one|confirmed|delivery|discount|rating|verified|trusted/i);
    for (const action of ['Add to cart', 'Buy now', 'Checkout', 'Order', 'Buy', 'Reserve']) {
      expect(screen.queryByRole('button', { name: action })).not.toBeOnTheScreen();
    }
  });

  it('Save and Ask the Seller stay usable while the Product is kept', async () => {
    serve(ok(BOTH()), problem(500, 'INTERNAL', 'request'));
    await open();
    await pull();
    expect(screen.getByRole('button', { name: en['buyer.chat.ask_about_product'] })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.save.save'] }));
    expect(await screen.findByText(en['buyer.save.sign_in'])).toBeOnTheScreen();
  });

  it('a first read that fails is still the error screen with Try again, and Try again shows the Product (nothing was kept)', async () => {
    serve(problem(500, 'INTERNAL', 'request'), ok(BOTH()));
    await renderRouter(APP_DIR, { initialUrl: PATH });
    expect(await screen.findByText(FAILED)).toBeOnTheScreen();
    expect(heading()).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    expect(headline()).toBe(`${etb(85000)} \u2013 ${etb(95000)}`);
  });
});

describe('a Product that is no longer public', () => {
  it('on returning from the Seller a 404 is the neutral screen: nothing of the Product stays, and there is nothing to retry', async () => {
    serve(ok(BOTH()), problem(404, 'NOT_FOUND', 'request'));
    await open();
    await toSellerAndBack();
    expect(await screen.findByText(en['buyer.product.gone'])).toBeOnTheScreen();
    expect(heading()).not.toBeOnTheScreen();
    expect(screen.queryByText('About Woven basket')).not.toBeOnTheScreen();
    withheldParts();
    expect(retry()).not.toBeOnTheScreen();
  });

  it('a 404 after a failure is the neutral screen too', async () => {
    serve(ok(BOTH()), problem(500, 'INTERNAL', 'request'), problem(404, 'NOT_FOUND', 'request'));
    await open();
    await pull();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    await settle();
    expect(await screen.findByText(en['buyer.product.gone'])).toBeOnTheScreen();
    expect(heading()).not.toBeOnTheScreen();
  });

  // Something is pushed over the gone screen and popped, so the screen is shown again and reads again.
  const showAgain = async () => {
    await act(() => router.push(`/sellers/${HANDLE}` as never));
    await screen.findByRole('header', { name: 'Store 1' });
    await act(() => router.back());
    await settle();
  };

  it('once gone, a later failure to read does not bring the Product back: only a success does', async () => {
    serve(ok(BOTH()), problem(404, 'NOT_FOUND', 'request'), problem(500, 'INTERNAL', 'request'));
    await open();
    await toSellerAndBack();
    expect(await screen.findByText(en['buyer.product.gone'])).toBeOnTheScreen();
    await showAgain();
    expect(reads()).toBe(3);
    expect(screen.getByText(en['buyer.product.gone'])).toBeOnTheScreen();
    expect(heading()).not.toBeOnTheScreen();
    expect(screen.queryByText('About Woven basket')).not.toBeOnTheScreen();
    expect(screen.queryByText(FAILED)).not.toBeOnTheScreen();
    withheldParts();
  });

  it('a success after a 404 brings the Product back, with its own price and options', async () => {
    serve(ok(BOTH()), problem(404, 'NOT_FOUND', 'request'), ok(basket([option(SMALL, { price_minor: 70000 }), option(LARGE)])));
    await open();
    await toSellerAndBack();
    expect(await screen.findByText(en['buyer.product.gone'])).toBeOnTheScreen();
    await showAgain();
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.product.gone'])).not.toBeOnTheScreen();
    expect(headline()).toBe(`${etb(70000)} \u2013 ${etb(95000)}`);
    expect(choice('Small', AVAILABLE, 70000)).toBeEnabled();
  });

  it('after a 404 and a success the 404 no longer stands: a later failure keeps the Product like any other', async () => {
    serve(
      ok(BOTH()),
      problem(404, 'NOT_FOUND', 'request'),
      ok(basket([option(SMALL, { price_minor: 70000 }), option(LARGE)])),
      problem(500, 'INTERNAL', 'request'),
    );
    await open();
    await toSellerAndBack();
    expect(await screen.findByText(en['buyer.product.gone'])).toBeOnTheScreen();
    await showAgain();
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    await showAgain();
    expect(reads()).toBe(4);
    expect(screen.queryByText(en['buyer.product.gone'])).not.toBeOnTheScreen();
    keptParts();
    withheldParts();
    expect(screen.getByText(FAILED)).toBeOnTheScreen();
    expect(retry()).toBeOnTheScreen();
  });
});

describe('a re-read that waits for a connection', () => {
  it('keeps the old answer withheld after the connection returns, until the NEW answer has arrived', async () => {
    let n = 0;
    let release: (reply: Reply) => void = () => undefined;
    api.on(BASKET, () => {
      n += 1;
      return n === 1 ? ok(BOTH()) : new Promise<Reply>((resolve) => (release = resolve));
    });
    await open();
    await fireEvent.press(screen.getByTestId('product-seller'));
    await screen.findByRole('header', { name: 'Store 1' });
    await act(async () => onlineManager.setOnline(false));
    await act(() => router.back());
    await settle();
    withheldParts();
    expect(screen.getByText(en['common.offline'])).toBeOnTheScreen();
    // The connection returns: the read resumes and is on its way. The earlier answer is not drawn again.
    await act(async () => onlineManager.setOnline(true));
    await settle();
    expect(reads()).toBe(2);
    keptParts();
    withheldParts();
    expect(screen.queryByText(en['common.offline'])).not.toBeOnTheScreen();
    expect(screen.getByText(en['buyer.product.loading'])).toBeOnTheScreen();
    expect(retry()).not.toBeOnTheScreen();
    await act(async () => release(ok(basket([option(SMALL, { price_minor: 70000 }), option(LARGE)]))));
    await settle();
    expect(headline()).toBe(`${etb(70000)} \u2013 ${etb(95000)}`);
    expect(choice('Small', AVAILABLE, 70000)).toBeEnabled();
    expect(screen.queryByText(en['buyer.product.loading'])).not.toBeOnTheScreen();
  });


  it('says the Buyer is offline, withholds price and options, offers no Try again, and shows the new answer when the connection returns', async () => {
    serve(ok(BOTH()), ok(basket([option(SMALL, { price_minor: 70000 }), option(LARGE)])));
    await open();
    await fireEvent.press(screen.getByTestId('product-seller'));
    await screen.findByRole('header', { name: 'Store 1' });
    await act(async () => onlineManager.setOnline(false));
    await act(() => router.back());
    await settle();
    keptParts();
    withheldParts();
    expect(screen.getByText(en['common.offline'])).toBeOnTheScreen();
    expect(retry()).not.toBeOnTheScreen();
    expect(reads()).toBe(1);
    await act(async () => onlineManager.setOnline(true));
    await settle();
    expect(reads()).toBe(2);
    expect(headline()).toBe(`${etb(70000)} \u2013 ${etb(95000)}`);
    expect(screen.queryByText(en['common.offline'])).not.toBeOnTheScreen();
    expect(choice('Small', AVAILABLE, 70000)).toBeEnabled();
  });
});

describe('a pull while offline, after a failed re-read (BUY-05A, B23-010, B23-011)', () => {
  const refreshing = () =>
    (screen.getByTestId('product-detail').props.refreshControl as { props: { refreshing: boolean } }).props.refreshing;

  it('stops the spinner while the pull waits for a connection, and does not turn it on again by itself on reconnect', async () => {
    serve(ok(BOTH()), problem(500, 'INTERNAL', 'request'), ok(basket([option(SMALL, { price_minor: 70000 }), option(LARGE)])));
    await open();
    await pull();
    expect(screen.getByText(FAILED)).toBeOnTheScreen();
    await act(async () => onlineManager.setOnline(false));
    await pull();
    // Nothing can progress: the Buyer is told so and the spinner is not left turning.
    expect(screen.getByText(en['common.offline'])).toBeOnTheScreen();
    expect(refreshing()).toBe(false);
    withheldParts();
    expect(reads()).toBe(2); // paused, not spent
    await act(async () => onlineManager.setOnline(true));
    // The paused read resumes by itself; that is not a gesture, so no pull spinner.
    expect(refreshing()).toBe(false);
    await settle();
    expect(reads()).toBe(3);
    expect(headline()).toBe(`${etb(70000)} – ${etb(95000)}`);
    expect(refreshing()).toBe(false);
  });
});

describe('Try again', () => {
  it('is off while the read is on its way, keeps the same state on a second failure, and shows the new answer on success', async () => {
    let n = 0;
    let release: (reply: Reply) => void = () => undefined;
    api.on(BASKET, () => {
      n += 1;
      if (n === 1) return ok(BOTH());
      if (n === 2) return problem(500, 'INTERNAL', 'request');
      if (n === 3) return new Promise<Reply>((resolve) => (release = resolve));
      return ok(basket([option(SMALL, { price_minor: 70000 }), option(LARGE)]));
    });
    await open();
    await pull();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    await settle();
    expect(reads()).toBe(3);
    expect(screen.getByRole('button', { name: en['common.retry'] })).toBeDisabled();
    // The retry is on its way: the earlier answer is still not drawn, and the failure is still said.
    keptParts();
    withheldParts();
    expect(screen.getByText(FAILED)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(reads()).toBe(3);
    await act(async () => release(problem(500, 'INTERNAL', 'request')));
    await settle();
    keptParts();
    withheldParts();
    expect(screen.getByText(FAILED)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['common.retry'] })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    await settle();
    expect(reads()).toBe(4);
    expect(headline()).toBe(`${etb(70000)} \u2013 ${etb(95000)}`);
    expect(screen.queryByText(FAILED)).not.toBeOnTheScreen();
    expect(retry()).not.toBeOnTheScreen();
    expect(choice('Small', AVAILABLE, 70000)).toBeEnabled();
  });
});

describe('the option the Buyer chose', () => {
  const notice = () => screen.queryByText(en['buyer.product.option_dropped']);

  it('is cleared while the Product cannot be verified, without saying the option became unavailable, and is not back after recovery', async () => {
    serve(ok(BOTH()), problem(500, 'INTERNAL', 'request'), ok(BOTH()));
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    expect(choice('Small', AVAILABLE)).toBeChecked();
    await pull();
    keptParts();
    withheldParts();
    expect(notice()).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    await settle();
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
    expect(headline()).toBe(`${etb(85000)} \u2013 ${etb(95000)}`);
    expect(notice()).not.toBeOnTheScreen();
  });

  it('a drop the server made earlier is not reported again after a failure and a recovery', async () => {
    serve(ok(BOTH()), ok(basket([option(LARGE)])), problem(500, 'INTERNAL', 'request'), problem(500, 'INTERNAL', 'request'), ok(BOTH()));
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    await pull();
    expect(notice()).toBeOnTheScreen();
    await pull();
    keptParts();
    expect(notice()).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    await settle();
    keptParts();
    expect(screen.getByText(FAILED)).toBeOnTheScreen();
    expect(notice()).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    await settle();
    expect(notice()).not.toBeOnTheScreen();
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
  });

  it('after recovery an option that sold out meanwhile is disabled and never looks choosable, and one still offered can be chosen', async () => {
    serve(ok(BOTH()), problem(500, 'INTERNAL', 'request'), ok(basket([option(SMALL, { available: false }), option(LARGE)])));
    await open();
    await pull();
    keptParts();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    await settle();
    expect(choice('Small', UNAVAILABLE)).toBeDisabled();
    expect(choice('Small', UNAVAILABLE)).not.toBeChecked();
    await fireEvent.press(choice('Large', AVAILABLE));
    expect(choice('Large', AVAILABLE)).toBeChecked();
  });
});

describe('after the background interval', () => {
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

  it('a Product kept after a failed re-read is withheld like any other, the read is repeated, and a failure of THAT read is the error screen', async () => {
    let n = 0;
    let release: (reply: Reply) => void = () => undefined;
    api.on(BASKET, () => {
      n += 1;
      if (n === 1) return ok(BOTH());
      if (n === 2) return problem(500, 'INTERNAL', 'request');
      return new Promise<Reply>((resolve) => (release = resolve));
    });
    await open();
    await pull();
    keptParts();
    await goTo('background');
    await act(() => jest.advanceTimersByTimeAsync(6 * 60_000));
    await goTo('active');
    await settle();
    // The kept answer is not shown past the interval: nothing of it, and a new read is on its way.
    expect(reads()).toBe(3);
    expect(heading()).not.toBeOnTheScreen();
    expect(screen.queryByText('About Woven basket')).not.toBeOnTheScreen();
    await act(async () => release(problem(500, 'INTERNAL', 'request')));
    await settle();
    expect(await screen.findByText(FAILED)).toBeOnTheScreen();
    expect(heading()).not.toBeOnTheScreen();
    expect(screen.queryByText('About Woven basket')).not.toBeOnTheScreen();
  });

  it('the Seller profile did not ask for this: a failed re-read is its error screen, and the background interval does not start a read behind it', async () => {
    const HEADER = `GET /v1/storefronts/${HANDLE}`;
    let n = 0;
    api.on(HEADER, () => (n++ === 1 ? problem(500, 'INTERNAL', 'request') : ok(storefront(HANDLE))));
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    expect(await screen.findByRole('header', { name: 'Store 1' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('seller-tab-about'));
    await screen.findByTestId('seller-about');
    await act(() => (screen.getByTestId('seller-about').props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());
    await settle();
    expect(await screen.findByText(FAILED)).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Store 1' })).not.toBeOnTheScreen();
    const calls = () => api.callsTo(HEADER).length;
    expect(calls()).toBe(2);
    await goTo('background');
    await act(() => jest.advanceTimersByTimeAsync(6 * 60_000));
    await goTo('active');
    await settle();
    expect(calls()).toBe(2);
    expect(screen.getByText(FAILED)).toBeOnTheScreen();
  });
});
