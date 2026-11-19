import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';

import { formatMinor } from '../i18n/i18n';
import { useUiStore } from '../state/ui-store';
import { installFakeApi, problem, storefront, storefrontProduct, type Reply, type StorefrontProduct } from '../testing/fake-api';
import { renderedText } from '../testing/discovery-rules';
import { resetSecureStore } from '../testing/secure-store-mock';

/**
 * Choosing an option on the Product (the machine in product-variants.ts) through the real route
 * tree: only an option the server offers now can be chosen; the choice shows that option's own
 * price; every new answer (a pull, a return from another screen, the background interval) is
 * checked against it; a read that fails or is withheld takes the choice with it.
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
/** The Product as the server answers it; the span is the Variants', as the server works it out. */
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
function serve(route: string, ...replies: Reply[]) {
  let i = 0;
  api.on(route, () => replies[Math.min(i++, replies.length - 1)]!);
}
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const pull = async () => {
  await act(() => (screen.getByTestId('product-detail').props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());
  await settle();
};
const choice = (key: string, state: string, minor = key === 'Small' ? 85000 : 95000) =>
  screen.getByRole('radio', { name: `${key}, ${etb(minor)}, ${state}` });
const headline = () => screen.queryByTestId('product-price')?.props.children as string | undefined;
const open = async () => {
  await renderRouter(APP_DIR, { initialUrl: PATH });
  expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
};
const AVAILABLE = en['buyer.product.available'];
const UNAVAILABLE = en['buyer.product.unavailable'];

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  api.on(`GET /v1/storefronts/${HANDLE}`, () => ok(storefront(HANDLE)));
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

afterEach(() => {
  // Choosing an option never reaches commerce.
  expect(api.calls.filter((c) => /cart|order|checkout|payment|reservation/i.test(c.path))).toEqual([]);
});

describe('the options on the Product', () => {
  it('are a group of choices with none chosen at the opening, and the server span as the price', async () => {
    serve(BASKET, ok(BOTH()));
    await open();
    expect(screen.getByTestId('product-options').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
    expect(headline()).toBe(`${etb(85000)} \u2013 ${etb(95000)}`);
  });

  it('choosing an available option checks it and shows its own price; choosing another moves the check', async () => {
    serve(BASKET, ok(BOTH()));
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    expect(choice('Small', AVAILABLE)).toBeChecked();
    expect(choice('Large', AVAILABLE)).not.toBeChecked();
    expect(headline()).toBe(etb(85000));
    await fireEvent.press(choice('Large', AVAILABLE));
    expect(choice('Large', AVAILABLE)).toBeChecked();
    expect(choice('Small', AVAILABLE)).not.toBeChecked();
    expect(headline()).toBe(etb(95000));
  });

  it('an option the server says is unavailable is disabled; pressing it chooses nothing and keeps an earlier choice', async () => {
    serve(BASKET, ok(basket([option(SMALL), option(LARGE, { available: false })])));
    await open();
    expect(choice('Large', UNAVAILABLE)).toBeDisabled();
    await fireEvent.press(choice('Large', UNAVAILABLE));
    expect(choice('Large', UNAVAILABLE)).not.toBeChecked();
    expect(headline()).toBe(`${etb(85000)} \u2013 ${etb(95000)}`);
    await fireEvent.press(choice('Small', AVAILABLE));
    await fireEvent.press(choice('Large', UNAVAILABLE));
    expect(choice('Small', AVAILABLE)).toBeChecked();
    expect(choice('Large', UNAVAILABLE)).not.toBeChecked();
  });

  it('are all unavailable when the Product is, even if an option says it is available: nothing can be chosen', async () => {
    serve(BASKET, ok(basket([option(SMALL), option(LARGE)], { available: false })));
    await open();
    for (const key of ['Small', 'Large']) {
      expect(choice(key, UNAVAILABLE)).toBeDisabled();
      await fireEvent.press(choice(key, UNAVAILABLE));
      expect(choice(key, UNAVAILABLE)).not.toBeChecked();
    }
    expect(screen.queryByText(AVAILABLE)).not.toBeOnTheScreen();
  });

  it('show a price in the option\u2019s own currency when it is chosen, and no span where the server gives none', async () => {
    const usd = formatMinor('en', 1000, 'USD');
    serve(
      BASKET,
      ok(basket([option(SMALL), option(LARGE, { price_minor: 1000, price_currency: 'USD' })], { price_min_minor: null, price_max_minor: null, price_currency: null })),
    );
    await open();
    expect(headline()).toBeUndefined();
    await fireEvent.press(screen.getByRole('radio', { name: `Large, ${usd}, ${AVAILABLE}` }));
    expect(headline()).toBe(usd);
  });

  it('are absent, with the span and no choice, when the Product lists none', async () => {
    serve(BASKET, ok(basket([], { available: false, price_min_minor: null, price_max_minor: null, price_currency: null })));
    await open();
    expect(screen.queryByTestId('product-options')).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.product.options'])).not.toBeOnTheScreen();
    expect(headline()).toBeUndefined();
    expect(screen.getByText(UNAVAILABLE)).toBeOnTheScreen();
  });

  it('keep the same names for a screen reader: label, price and availability in words, with the checked state', async () => {
    serve(BASKET, ok(basket([option(SMALL), option(LARGE, { available: false })])));
    await open();
    const small = choice('Small', AVAILABLE);
    expect(small.props.accessibilityLabel).toBe(`Small, ${etb(85000)}, Available`);
    await fireEvent.press(small);
    expect(choice('Small', AVAILABLE).props.accessibilityState).toMatchObject({ checked: true, disabled: false });
    expect(choice('Large', UNAVAILABLE, 95000).props.accessibilityState).toMatchObject({ checked: false, disabled: true });
  });
});

describe('a new answer from the server', () => {
  it('shows the chosen option\u2019s new price and keeps the choice while the option is still offered', async () => {
    serve(BASKET, ok(BOTH()), ok(basket([option(SMALL, { price_minor: 90000 }), option(LARGE)])));
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    expect(headline()).toBe(etb(85000));
    await pull();
    expect(choice('Small', AVAILABLE, 90000)).toBeChecked();
    expect(headline()).toBe(etb(90000));
    expect(screen.queryByText(etb(85000))).not.toBeOnTheScreen();
  });

  it('drops the choice when the option sold out: it is unavailable and unchecked, the headline is the span again, and an answer that offers it again does not check it', async () => {
    serve(
      BASKET,
      ok(BOTH()),
      ok(basket([option(SMALL, { available: false, stock_count: 0 }), option(LARGE)])),
      ok(BOTH()),
    );
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    await pull();
    expect(choice('Small', UNAVAILABLE)).toBeDisabled();
    expect(choice('Small', UNAVAILABLE)).not.toBeChecked();
    expect(headline()).toBe(`${etb(85000)} \u2013 ${etb(95000)}`);
    await pull();
    expect(choice('Small', AVAILABLE)).not.toBeChecked();
    expect(headline()).toBe(`${etb(85000)} \u2013 ${etb(95000)}`);
  });

  it('drops the choice when the option is no longer listed, and leaves the other options alone', async () => {
    serve(BASKET, ok(BOTH()), ok(basket([option(LARGE)])));
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    await pull();
    expect(screen.queryByRole('radio', { name: /^Small,/ })).not.toBeOnTheScreen();
    expect(choice('Large', AVAILABLE)).not.toBeChecked();
    expect(headline()).toBe(etb(95000));
  });

  it('drops the choice when the whole Product became unavailable', async () => {
    serve(BASKET, ok(BOTH()), ok(basket([option(SMALL, { available: false }), option(LARGE, { available: false })], { available: false })));
    await open();
    await fireEvent.press(choice('Large', AVAILABLE));
    await pull();
    for (const key of ['Small', 'Large']) {
      expect(choice(key, UNAVAILABLE)).toBeDisabled();
      expect(choice(key, UNAVAILABLE)).not.toBeChecked();
    }
  });

  it('keeps a choice the answer still offers when only another option changed', async () => {
    serve(BASKET, ok(BOTH()), ok(basket([option(SMALL), option(LARGE, { available: false })])));
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    await pull();
    expect(choice('Small', AVAILABLE)).toBeChecked();
    expect(choice('Large', UNAVAILABLE)).toBeDisabled();
  });

  it('a failed read takes the choice with it, says so with a retry, and the retried answer starts with none chosen', async () => {
    serve(BASKET, ok(BOTH()), problem(500, 'INTERNAL', 'request'), ok(BOTH()));
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    await pull();
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
    expect(headline()).toBe(`${etb(85000)} \u2013 ${etb(95000)}`);
  });

  it('a Product that is no longer public clears the options and the choice', async () => {
    serve(BASKET, ok(BOTH()), problem(404, 'NOT_FOUND', 'request'));
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    await pull();
    expect(await screen.findByText(en['buyer.product.gone'])).toBeOnTheScreen();
    expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
    expect(screen.queryByText('Woven basket')).not.toBeOnTheScreen();
  });
});

describe('the notice when a chosen option is dropped', () => {
  const notice = () => screen.queryByText(en['buyer.product.option_dropped']);

  it('is not shown at the opening, after a choice, or while the choice is still offered', async () => {
    serve(BASKET, ok(BOTH()), ok(basket([option(SMALL), option(LARGE, { available: false })])));
    await open();
    expect(notice()).not.toBeOnTheScreen();
    await fireEvent.press(choice('Small', AVAILABLE));
    expect(notice()).not.toBeOnTheScreen();
    await pull();
    expect(choice('Small', AVAILABLE)).toBeChecked();
    expect(notice()).not.toBeOnTheScreen();
  });

  it('says so when the option the Buyer chose sold out, is announced once, stays while an answer offers it again, and goes when the Buyer chooses', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      serve(BASKET, ok(BOTH()), ok(basket([option(SMALL, { available: false, stock_count: 0 }), option(LARGE)])), ok(BOTH()));
      await open();
      await fireEvent.press(choice('Small', AVAILABLE));
      await pull();
      expect(notice()).toBeOnTheScreen();
      expect(choice('Small', UNAVAILABLE)).not.toBeChecked();
      expect(announce.mock.calls.filter(([text]) => text === en['buyer.product.option_dropped'])).toHaveLength(1);
      // An answer that offers it again does not revive the choice, and the notice still tells the Buyer why.
      await pull();
      expect(choice('Small', AVAILABLE)).not.toBeChecked();
      expect(notice()).toBeOnTheScreen();
      expect(announce.mock.calls.filter(([text]) => text === en['buyer.product.option_dropped'])).toHaveLength(1);
      await fireEvent.press(choice('Large', AVAILABLE));
      expect(choice('Large', AVAILABLE)).toBeChecked();
      expect(notice()).not.toBeOnTheScreen();
    } finally {
      announce.mockRestore();
    }
  });

  it('says so when the option is no longer listed', async () => {
    serve(BASKET, ok(BOTH()), ok(basket([option(LARGE)])));
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    await pull();
    expect(notice()).toBeOnTheScreen();
  });

  it('says nothing while no option can be chosen (the whole Product became unavailable), and says it once an option can be', async () => {
    serve(
      BASKET,
      ok(BOTH()),
      ok(basket([option(SMALL, { available: false }), option(LARGE, { available: false })], { available: false })),
      ok(BOTH()),
    );
    await open();
    await fireEvent.press(choice('Large', AVAILABLE));
    await pull();
    // Every option is disabled and the Product says it is unavailable: "choose an option again" could not be followed.
    expect(choice('Large', UNAVAILABLE)).toBeDisabled();
    expect(choice('Large', UNAVAILABLE)).not.toBeChecked();
    expect(notice()).not.toBeOnTheScreen();
    // The choice was still dropped: once an answer offers an option again, the Buyer is told why none is selected.
    await pull();
    expect(choice('Large', AVAILABLE)).not.toBeChecked();
    expect(notice()).toBeOnTheScreen();
  });

  it('is gone with the content when the read fails, and is not on the retried answer', async () => {
    serve(BASKET, ok(BOTH()), ok(basket([option(LARGE)])), problem(500, 'INTERNAL', 'request'), ok(BOTH()));
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    await pull();
    expect(notice()).toBeOnTheScreen();
    await pull();
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    expect(notice()).not.toBeOnTheScreen();
  });
});

describe('moving away and coming back', () => {
  it('Back from the Seller finds an option sold out meanwhile: the choice is dropped and the option cannot be chosen', async () => {
    serve(BASKET, ok(BOTH()), ok(basket([option(SMALL, { available: false }), option(LARGE)])));
    api.on(`GET /v1/storefronts/${HANDLE}/scenes`, () => ok({ data: [], next_cursor: null }));
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    await fireEvent.press(screen.getByTestId('product-seller'));
    await screen.findByRole('header', { name: 'Store 1' });
    await act(() => router.back());
    await settle();
    expect(choice('Small', UNAVAILABLE)).toBeDisabled();
    expect(choice('Small', UNAVAILABLE)).not.toBeChecked();
    expect(headline()).toBe(`${etb(85000)} \u2013 ${etb(95000)}`);
  });

  it('reopening the Product starts with no choice', async () => {
    serve(BASKET, ok(BOTH()));
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    await act(() => router.back());
    await settle();
    await act(() => router.push(PATH as never));
    await settle();
    expect(await screen.findByRole('header', { name: 'Woven basket' })).toBeOnTheScreen();
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
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

    it('the Product is withheld until the server answers again, and the old choice is not on the new answer', async () => {
      let release: (reply: Reply) => void = () => undefined;
      let n = 0;
      api.on(BASKET, () => (n++ === 0 ? ok(BOTH()) : new Promise<Reply>((resolve) => (release = resolve))));
      await open();
      await fireEvent.press(choice('Small', AVAILABLE));
      await goTo('background');
      await act(() => jest.advanceTimersByTimeAsync(6 * 60_000));
      await goTo('active');
      await settle();
      // The second read is still on its way: nothing of the earlier answer or choice is shown.
      expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: 'Woven basket' })).not.toBeOnTheScreen();
      await act(async () => release(ok(basket([option(SMALL, { available: false }), option(LARGE)]))));
      await settle();
      expect(choice('Small', UNAVAILABLE)).not.toBeChecked();
      expect(choice('Large', AVAILABLE)).not.toBeChecked();
    });
  });
});

describe('what the Product never says on its own', () => {
  it('shows no stock count, no stock time and no scarcity wording, whatever the answer carries besides the flags', async () => {
    serve(
      BASKET,
      ok(basket([option(SMALL, { stock_count: 7, stock_confirmed_at: '2026-11-09T12:00:00.000Z' }), option(LARGE, { stock_count: 42 })])),
    );
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    const texts = renderedText(screen.getByTestId('product-detail')).join(' | ');
    expect(texts).not.toMatch(/\b(7|42)\b/);
    expect(texts).not.toMatch(/stock|left|only|few|last one|confirmed|2026|9 Nov|Nov 9/i);
  });

  it('offers nothing to buy, even with an option chosen', async () => {
    serve(BASKET, ok(BOTH()));
    await open();
    await fireEvent.press(choice('Small', AVAILABLE));
    for (const action of ['Add to cart', 'Buy now', 'Checkout', 'Order', 'Order now', 'Buy', 'Reserve']) {
      expect(screen.queryByRole('button', { name: action })).not.toBeOnTheScreen();
    }
    expect(screen.queryByText(/delivery|ships|arrives|discount|% off|sale|rating|reviews?\b|verified|trusted/i)).not.toBeOnTheScreen();
  });
});
