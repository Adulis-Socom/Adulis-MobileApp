import { en } from '@adulis/locale/mobile';
import { colorModes } from '@adulis/tokens';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { useUiStore } from '../../state/ui-store';
import { productionSources } from '../../testing/source-scan';
import { LINE_ISSUES, type LineIssue } from '../cart/model';
import { renderWithCommerce } from '../testing/harness';
import { cartSet, line, listed, sellerCart, UNVERIFIED, V2 } from '../testing/builders';
import { DEMO_DEVICE, createFixtureWorld } from '../testing/fixture/adapter';
import { A_BOWL, A_SHIRT_SMALL, B_LAMP, B_MUG } from '../testing/fixture/scenarios';
import { LINE_ISSUE_KEY } from './cart-copy';
import { CartView, InternalCart } from './CartView';

jest.mock('expo-secure-store', () => jest.requireActual('../../testing/secure-store-mock'));

/**
 * BUY-12A: the internal fixture Cart, drawn. Pure presentation first (every state with built views), then the same screen
 * against the fixture world (the simulator plays the server and is labelled a fixture on every answer), a release build,
 * and an Account change. The screen draws what the commerce code derives and offers one action: ask again.
 */
const noop = () => undefined;
const GUEST = { actor: `DEVICE:${DEMO_DEVICE}` };
const buttons = () => screen.queryAllByRole('button').map((b) => String((b.props as { accessibilityLabel?: string }).accessibilityLabel ?? ''));

beforeEach(() => {
  useUiStore.setState({ themePreference: 'light', locale: 'en' });
});

describe('the drawn cart (pure presentation)', () => {
  it('draws each Seller cart on its own, with its own server subtotal, and never a combined total', async () => {
    const view = listed(
      cartSet(
        sellerCart([line('l1', { name: 'Demo shirt', option: 'size=s', quantity: 2 })], { storeName: 'Demo Seller A', subtotal: { amountMinor: 240000, currency: 'ETB' } }, 'a'),
        sellerCart([line('l2', { name: 'Demo mug', quantity: 1 })], { storeName: 'Demo Seller B', subtotal: { amountMinor: 30000, currency: 'ETB' } }, 'b'),
      ),
    );
    await render(<CartView view={view} onRefresh={noop} />);
    expect(screen.getByText('Demo Seller A')).toBeOnTheScreen();
    expect(screen.getByText('Demo Seller B')).toBeOnTheScreen();
    expect(screen.getByTestId('seller-cart-a')).toHaveTextContent('Demo shirt', { exact: false });
    expect(screen.getByTestId('seller-cart-a')).not.toHaveTextContent('Demo mug', { exact: false });
    expect(screen.getByTestId('subtotal-a')).toHaveTextContent('2,400.00', { exact: false });
    expect(screen.getByTestId('subtotal-b')).toHaveTextContent('300.00', { exact: false });
    expect(screen.queryByText(/2,700/)).not.toBeOnTheScreen(); // no combined figure of any kind
    expect(screen.queryByText(/^Total/)).not.toBeOnTheScreen();
  });

  it('draws Product, option, quantity and the server price of a line, and the title and fixture marker', async () => {
    await render(<CartView view={listed(cartSet(sellerCart([line('l1', { name: 'Demo shirt', option: 'size=s', quantity: 3, unitPrice: { amountMinor: 120000, currency: 'ETB' } })])))} onRefresh={noop} />);
    expect(screen.getByText(en['buyer.cart.title'])).toBeOnTheScreen();
    expect(screen.getByTestId('cart-fixture-marker')).toHaveTextContent(en['buyer.cart.fixture_marker']);
    expect(screen.getByText('Demo shirt')).toBeOnTheScreen();
    expect(screen.getByText('size=s')).toBeOnTheScreen();
    expect(screen.getByText('Quantity 3')).toBeOnTheScreen();
    expect(screen.getByText(/1,200\.00.*each/)).toBeOnTheScreen();
  });

  it('draws no price for a line the server gave none, and no marker for an answer that is not a fixture', async () => {
    const view = { ...listed(cartSet(sellerCart([line('l1', { unitPrice: null })]))), provenance: 'SERVER' as const };
    await render(<CartView view={view} onRefresh={noop} />);
    expect(screen.queryByText(/each/)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('cart-fixture-marker')).not.toBeOnTheScreen();
  });

  it('says the cart is empty only of an answer that can be vouched for', async () => {
    const { unmount } = await render(<CartView view={listed(cartSet())} onRefresh={noop} />);
    expect(screen.getByText(en['buyer.cart.empty'])).toBeOnTheScreen();
    await unmount();
    await render(<CartView view={listed(cartSet(), UNVERIFIED)} onRefresh={noop} />);
    expect(screen.queryByText(en['buyer.cart.empty'])).not.toBeOnTheScreen();
    expect(screen.getByText(en['buyer.cart.unverified_failed'])).toBeOnTheScreen();
  });

  it('a Seller cart with no lines says so, once the answer can be vouched for', async () => {
    await render(<CartView view={listed(cartSet(sellerCart([], { storeName: 'Demo Seller A' }, 'a'), sellerCart([line('l1')], {}, 'b')))} onRefresh={noop} />);
    expect(screen.getByText(en['buyer.cart.seller_empty'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.cart.empty'])).not.toBeOnTheScreen();
  });

  const reachable = LINE_ISSUES.filter((i) => i !== 'UNAVAILABLE');
  it.each(reachable)('says %s in the catalogue words, and nothing the model does not define', async (issue: LineIssue) => {
    await render(<CartView view={listed(cartSet(sellerCart([line('l1', { issues: [issue] })])))} onRefresh={noop} />);
    expect(screen.getByText(en[LINE_ISSUE_KEY[issue]])).toBeOnTheScreen();
  });

  it('keeps one catalogue sentence per reason the model defines, and no more', async () => {
    expect(Object.keys(LINE_ISSUE_KEY).sort()).toEqual([...LINE_ISSUES].sort());
  });

  it('shows the server count for too few available, and the previous price for a changed one, and only then', async () => {
    const view = listed(
      cartSet(
        sellerCart([
          line('l1', { issues: ['INSUFFICIENT_STOCK'], availableQuantity: 2 }),
          line('l2', { variantId: V2, issues: ['PRICE_CHANGED'], previousUnitPrice: { amountMinor: 900, currency: 'ETB' }, unitPrice: { amountMinor: 1100, currency: 'ETB' } }),
          line('l3', { issues: ['SOLD_OUT'], availableQuantity: 0 }),
        ]),
      ),
    );
    await render(<CartView view={view} onRefresh={noop} />);
    expect(screen.getByText('2 available')).toBeOnTheScreen();
    expect(screen.queryByText('0 available')).not.toBeOnTheScreen();
    expect(screen.getByText(/Previous price.*9\.00/)).toBeOnTheScreen();
    expect(screen.getByText(/11\.00.*each/)).toBeOnTheScreen();
  });

  it('offers one action for a line problem, to ask the server again, and no control that changes or buys', async () => {
    const onRefresh = jest.fn();
    await render(<CartView view={listed(cartSet(sellerCart([line('l1', { issues: ['SOLD_OUT'] })])))} onRefresh={onRefresh} />);
    expect(buttons()).toEqual([en['buyer.cart.refresh']]);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.cart.refresh'] }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    for (const word of ['checkout', 'buy', 'pay', 'remove', 'delete', 'accept', 'quantity +', 'increase', 'decrease']) {
      expect(screen.queryByRole('button', { name: new RegExp(word, 'i') })).not.toBeOnTheScreen();
    }
    expect(screen.queryByRole('adjustable')).not.toBeOnTheScreen();
  });

  it('draws no price, reason or subtotal from an answer it cannot vouch for, and says why, with Check again', async () => {
    const view = listed(
      cartSet(sellerCart([line('l1', { issues: ['SOLD_OUT'], name: 'Demo shirt' })], { subtotal: { amountMinor: 5000, currency: 'ETB' } })),
      { kind: 'UNVERIFIED', why: 'offline', error: null },
    );
    await render(<CartView view={view} onRefresh={noop} />);
    expect(screen.getByText(en['buyer.cart.unverified_offline'])).toBeOnTheScreen();
    expect(screen.getByText('Demo shirt')).toBeOnTheScreen(); // what the line is, not facts about it
    expect(screen.queryByText(en['buyer.cart.issue.SOLD_OUT'])).not.toBeOnTheScreen();
    expect(screen.queryByText(/each/)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('subtotal-seller-a')).not.toBeOnTheScreen();
    expect(buttons()).toEqual([en['buyer.cart.refresh']]);
  });

  it('keeps drawing the last answer while a new one is on its way, and says it is checking', async () => {
    await render(<CartView view={listed(cartSet(sellerCart([line('l1', { name: 'Demo shirt' })])), { kind: 'REVALIDATING' })} onRefresh={noop} />);
    expect(screen.getByText(en['buyer.cart.checking'])).toBeOnTheScreen();
    expect(screen.getByText('Demo shirt')).toBeOnTheScreen();
    expect(screen.getByText(/each/)).toBeOnTheScreen();
  });

  it('draws the other states: not available, loading, loading offline, and an error with Try again', async () => {
    const onRefresh = jest.fn();
    const { rerender } = await render(<CartView view={{ kind: 'DISABLED', reason: 'ADAPTER_DISABLED' }} onRefresh={onRefresh} />);
    expect(screen.getByText(en['buyer.cart.unavailable'])).toBeOnTheScreen();
    await rerender(<CartView view={{ kind: 'LOADING', waitingForConnection: false }} onRefresh={onRefresh} />);
    expect(screen.getByText(en['buyer.cart.loading'])).toBeOnTheScreen();
    await rerender(<CartView view={{ kind: 'LOADING', waitingForConnection: true }} onRefresh={onRefresh} />);
    expect(screen.getByText(en['common.offline'])).toBeOnTheScreen();
    await rerender(<CartView view={{ kind: 'ERROR', error: new Error('x') }} onRefresh={onRefresh} />);
    expect(screen.getByText(new RegExp(en['buyer.cart.error']))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('reads each line as one stop, and marks the cart and each Seller as headings', async () => {
    await render(<CartView view={listed(cartSet(sellerCart([line('l1', { name: 'Demo shirt', option: 'size=s', quantity: 2, issues: ['SOLD_OUT'] })], { storeName: 'Demo Seller A' })))} onRefresh={noop} />);
    const stop = screen.getByTestId('cart-line-l1');
    const label = String(stop.props.accessibilityLabel);
    expect(stop.props.accessible).toBe(true);
    for (const part of ['Demo shirt', 'size=s', 'Quantity 2', en['buyer.cart.issue.SOLD_OUT']]) expect(label).toContain(part);
    expect(screen.getAllByRole('header').map((h) => String(h.props.children))).toEqual([en['buyer.cart.title'], 'Demo Seller A']);
  });

  it.each(['light', 'dark'] as const)('uses the %s theme semantic colours for a line problem', async (mode) => {
    useUiStore.setState({ themePreference: mode });
    await render(<CartView view={listed(cartSet(sellerCart([line('l1', { issues: ['SOLD_OUT'] })])))} onRefresh={noop} />);
    const style = StyleSheet.flatten(screen.getByText(en['buyer.cart.issue.SOLD_OUT']).props.style) as { color?: string };
    expect(style.color).toBe(colorModes[mode].danger);
  });
});

describe('the same screen against the fixture world', () => {
  it('draws two Sellers, each with its own lines, the fixture prices, and the marker', async () => {
    const world = createFixtureWorld();
    world.server.sellerCarts = 'MULTI'; // an assumption of the simulator: the contract describes one Seller per cart
    await world.server.addLine(GUEST, { variantId: A_SHIRT_SMALL, quantity: 2, idempotencyKey: 'a1' });
    await world.server.addLine(GUEST, { variantId: B_MUG, quantity: 1, idempotencyKey: 'b1' });
    await renderWithCommerce(<InternalCart />, { adapter: world.adapter });
    expect(await screen.findByText('Demo Seller A')).toBeOnTheScreen();
    expect(screen.getByText('Demo Seller B')).toBeOnTheScreen();
    expect(screen.getByText('Demo shirt')).toBeOnTheScreen();
    expect(screen.getByText('Demo mug')).toBeOnTheScreen();
    expect(screen.getByText(/1,200\.00.*each/)).toBeOnTheScreen();
    expect(screen.getByText(/300\.00.*each/)).toBeOnTheScreen();
    expect(screen.getByTestId('cart-fixture-marker')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^seller-cart-/)).toHaveLength(2);
    expect(buttons()).toEqual([]); // clean carts offer nothing to press
  });

  it('draws a sold-out, a withdrawn and a too-few line from the server, after Check again', async () => {
    const world = createFixtureWorld();
    world.server.sellerCarts = 'MULTI';
    await world.server.addLine(GUEST, { variantId: B_LAMP, quantity: 1, idempotencyKey: 'l1' });
    await world.server.addLine(GUEST, { variantId: A_BOWL, quantity: 3, idempotencyKey: 'b1' });
    await world.server.addLine(GUEST, { variantId: A_SHIRT_SMALL, quantity: 1, idempotencyKey: 's1' });
    await renderWithCommerce(<InternalCart />, { adapter: world.adapter });
    await screen.findByText('Demo lamp');
    expect(screen.queryByText(en['buyer.cart.issue.SOLD_OUT'])).not.toBeOnTheScreen();
    world.server.setQuantityAvailable(B_LAMP, 0);
    world.server.setQuantityAvailable(A_BOWL, 2);
    world.server.setVariantStatus(A_SHIRT_SMALL, 'WITHDRAWN');
    // A clean cart offers no button; the line problems arrive with the next answer (a pull asks again).
    const list = screen.getByTestId('fixture-cart');
    await act(async () => (list.props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());
    expect(await screen.findByText(en['buyer.cart.issue.SOLD_OUT'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.cart.issue.INSUFFICIENT_STOCK'])).toBeOnTheScreen();
    expect(screen.getByText('2 available')).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.cart.issue.VARIANT_WITHDRAWN'])).toBeOnTheScreen();
    expect(buttons()).toEqual([en['buyer.cart.refresh']]);
  });

  it('shows no fixture Cart in a release build, and sends nothing: the disabled adapter is served', async () => {
    const world = createFixtureWorld();
    await world.server.addLine(GUEST, { variantId: A_BOWL, quantity: 1, idempotencyKey: 'b1' });
    const before = world.server.calls.length;
    await renderWithCommerce(<InternalCart />, { adapter: world.adapter, build: 'disabled', dev: true });
    expect(await screen.findByText(en['buyer.cart.unavailable'])).toBeOnTheScreen();
    expect(screen.queryByText('Demo bowl')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('cart-fixture-marker')).not.toBeOnTheScreen();
    expect(world.server.calls.length).toBe(before);
    expect(buttons()).toEqual([]);
  });

  it('shows no fixture Cart in a release run even when the build allows fixtures', async () => {
    const world = createFixtureWorld();
    await world.server.addLine(GUEST, { variantId: A_BOWL, quantity: 1, idempotencyKey: 'b1' });
    const before = world.server.calls.length;
    await renderWithCommerce(<InternalCart />, { adapter: world.adapter, build: 'fixture', dev: false });
    expect(await screen.findByText(en['buyer.cart.unavailable'])).toBeOnTheScreen();
    expect(world.server.calls.length).toBe(before);
  });

  it('shows another Account its own cart, never the first Account\'s lines, after a sign-out and sign-in', async () => {
    const world = createFixtureWorld();
    world.asAccount('A');
    await world.server.addLine({ actor: 'ACCOUNT:A' }, { variantId: A_SHIRT_SMALL, quantity: 2, idempotencyKey: 'seed-a' });
    await world.server.addLine({ actor: 'ACCOUNT:B' }, { variantId: A_BOWL, quantity: 1, idempotencyKey: 'seed-b' });
    const { session } = await renderWithCommerce(<InternalCart />, { adapter: world.adapter, token: 'token-a' });
    expect(await screen.findByText('Demo shirt')).toBeOnTheScreen();
    world.asGuest();
    await act(() => session.current!.clearSession());
    world.asAccount('B');
    await act(() => session.current!.signIn('token-b'));
    expect(await screen.findByText('Demo bowl')).toBeOnTheScreen();
    expect(screen.queryByText('Demo shirt')).not.toBeOnTheScreen();
  });

  it('offers no way to buy or change anything even with every kind of problem on screen', async () => {
    const world = createFixtureWorld();
    world.server.sellerCarts = 'MULTI';
    world.server.reportPriceChanges = true;
    await world.server.addLine(GUEST, { variantId: A_SHIRT_SMALL, quantity: 1, idempotencyKey: 's1' });
    await world.server.addLine(GUEST, { variantId: B_LAMP, quantity: 1, idempotencyKey: 'l1' });
    await renderWithCommerce(<InternalCart />, { adapter: world.adapter });
    await screen.findByText('Demo shirt');
    world.server.setPrice(A_SHIRT_SMALL, 99000);
    world.server.setQuantityAvailable(B_LAMP, 0);
    const list = screen.getByTestId('fixture-cart');
    await act(async () => (list.props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());
    expect(await screen.findByText(en['buyer.cart.issue.PRICE_CHANGED'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.cart.issue.SOLD_OUT'])).toBeOnTheScreen();
    expect(screen.getByText(/Previous price.*1,200\.00/)).toBeOnTheScreen();
    expect(buttons()).toEqual([en['buyer.cart.refresh']]); // no accept, remove, quantity or purchase control
    const sent = world.server.calls.filter((c) => c.op !== 'getCarts');
    expect(sent.map((c) => c.op)).toEqual(['addLine', 'addLine']); // drawing sent nothing but reads
  });

});

describe('review findings (BUY-12A)', () => {
  it('draws the previous price, the count and the Seller-empty line from no answer it cannot vouch for', async () => {
    const view = listed(
      cartSet(
        sellerCart(
          [
            line('l1', { issues: ['INSUFFICIENT_STOCK'], availableQuantity: 2 }),
            line('l2', { variantId: V2, issues: ['PRICE_CHANGED'], previousUnitPrice: { amountMinor: 900, currency: 'ETB' }, unitPrice: { amountMinor: 1100, currency: 'ETB' } }),
          ],
          {},
          'a',
        ),
        sellerCart([], { storeName: 'Demo Seller B' }, 'b'),
      ),
      { kind: 'UNVERIFIED', why: 'failed', error: null },
    );
    await render(<CartView view={view} onRefresh={noop} />);
    expect(screen.queryByText(/Previous price/)).not.toBeOnTheScreen();
    expect(screen.queryByText('2 available')).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.cart.seller_empty'])).not.toBeOnTheScreen();
    expect(screen.queryByText(/each/)).not.toBeOnTheScreen();
  });

  it('says each reason in its own words, by name, for every reason the model defines', () => {
    for (const issue of LINE_ISSUES) expect(LINE_ISSUE_KEY[issue]).toBe(`buyer.cart.issue.${issue}`);
    expect(en['buyer.cart.issue.NO_LONGER_PUBLISHED']).not.toBe(en['buyer.cart.issue.UNKNOWN']);
  });

  it('says why an unverified cart is hidden, in the words for each of the three reasons', async () => {
    for (const why of ['offline', 'failed', 'checking'] as const) {
      const { unmount } = await render(<CartView view={listed(cartSet(sellerCart([line('l1')])), { kind: 'UNVERIFIED', why, error: null })} onRefresh={noop} />);
      expect(screen.getByText(en[`buyer.cart.unverified_${why}`])).toBeOnTheScreen();
      await unmount();
    }
  });

  it('keeps two Seller carts that share a key apart, without a duplicate-key warning', async () => {
    const warn = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const view = listed(cartSet(sellerCart([line('l1', { name: 'First' })], { storeName: 'Same key' }, 'dup'), sellerCart([line('l2', { name: 'Second' })], { storeName: 'Same key' }, 'dup')));
      await render(<CartView view={view} onRefresh={noop} />);
      expect(screen.getByText('First')).toBeOnTheScreen();
      expect(screen.getByText('Second')).toBeOnTheScreen();
      expect(warn.mock.calls.filter(([m]) => /same key/i.test(String(m)))).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it('says an empty cart is empty only once the answer is verified: not while a new one is awaited', async () => {
    const { unmount } = await render(<CartView view={listed(cartSet(), { kind: 'REVALIDATING' })} onRefresh={noop} />);
    expect(screen.queryByText(en['buyer.cart.empty'])).not.toBeOnTheScreen();
    expect(screen.getByText(en['buyer.cart.checking'])).toBeOnTheScreen();
    await unmount();
    await render(<CartView view={listed(cartSet(sellerCart([], { storeName: 'Demo Seller A' }, 'a')), { kind: 'REVALIDATING' })} onRefresh={noop} />);
    expect(screen.queryByText(en['buyer.cart.seller_empty'])).not.toBeOnTheScreen();
  });

  it('shows the pull spinner only while a new answer is awaited', async () => {
    const refreshing = () => (screen.getByTestId('fixture-cart').props.refreshControl as { props: { refreshing: boolean } }).props.refreshing;
    const { rerender } = await render(<CartView view={listed(cartSet(sellerCart([line('l1')])), { kind: 'REVALIDATING' })} onRefresh={noop} />);
    expect(refreshing()).toBe(true);
    await rerender(<CartView view={listed(cartSet(sellerCart([line('l1')])))} onRefresh={noop} />);
    expect(refreshing()).toBe(false);
  });

  it('draws two reasons of one line in the model\'s precedence, whatever order they arrived in', async () => {
    await render(<CartView view={listed(cartSet(sellerCart([line('l1', { issues: ['PRICE_CHANGED', 'SOLD_OUT'] })])))} onRefresh={noop} />);
    const label = String(screen.getByTestId('cart-line-l1').props.accessibilityLabel);
    expect(label.indexOf(en['buyer.cart.issue.SOLD_OUT'])).toBeLessThan(label.indexOf(en['buyer.cart.issue.PRICE_CHANGED']));
  });

  it('keeps the fixture marker outside the scrolling content, so a long cart cannot scroll it away', async () => {
    await render(<CartView view={listed(cartSet(sellerCart([line('l1')])))} onRefresh={noop} />);
    expect(screen.getByTestId('cart-fixture-marker')).toBeOnTheScreen();
    expect(within(screen.getByTestId('fixture-cart')).queryByTestId('cart-fixture-marker')).not.toBeOnTheScreen();
  });
});

describe('the Cart UI stays inside the development boundary (BUY-12A)', () => {
  const ui = productionSources('commerce/ui');
  const comments = /\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm;
  const code = (text: string) => text.replace(comments, '');

  it('reads only the carts: it imports no hook or store that adds, edits or removes a line', () => {
    expect(ui.length).toBeGreaterThanOrEqual(2);
    const FORBIDDEN = /edit-hooks|edit-store|intent-store|variant-change|\buseAddToCart\b|\buseCartEdit\b|\bsetQuantity\b|\bremoveLine\b|\baddLine\b/;
    expect(ui.filter((f) => FORBIDDEN.test(code(f.text))).map((f) => f.file)).toEqual([]);
    expect(FORBIDDEN.test('import { useCartEdit } from "../cart/edit-hooks"')).toBe(true);
  });

  it('has no purchase wording or control in its code', () => {
    const WORDS = /\b(checkout|buyNow|payNow|placeOrder|acceptPrice|priceChangeRef)\b/i;
    expect(ui.filter((f) => WORDS.test(code(f.text))).map((f) => f.file)).toEqual([]);
    expect(WORDS.test('const checkout = () => undefined')).toBe(true);
  });

  it('is named by no route and by nothing outside the commerce folder', () => {
    const NAME = /\b(InternalCart|CartView)\b/;
    const outside = productionSources('app', 'buyer', 'components', 'auth', 'api', 'i18n', 'theme', 'seller', 'modes', 'providers', 'state', 'device', 'storage').filter((f) => NAME.test(code(f.text)));
    expect(outside.map((f) => f.file)).toEqual([]);
    expect(NAME.test('<InternalCart />')).toBe(true);
  });

  it('computes no amount: no arithmetic on a price or a quantity anywhere in it', () => {
    const MATH = /(unitPrice|amountMinor|subtotal|previousUnitPrice)[\w.?]*\s*[-+*/]\s*[\w(]|[\w)]\s*[*/]\s*(quantity|line\.quantity)\b|\.reduce\(/;
    expect(ui.filter((f) => MATH.test(code(f.text))).map((f) => f.file)).toEqual([]);
    expect(MATH.test('const total = line.unitPrice.amountMinor * line.quantity')).toBe(true);
    expect(MATH.test('lines.reduce((n, l) => n + l.quantity, 0)')).toBe(true);
  });
});

afterEach(async () => {
  await waitFor(() => undefined);
});
