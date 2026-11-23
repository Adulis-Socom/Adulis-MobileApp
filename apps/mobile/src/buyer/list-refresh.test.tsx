import { en } from '@adulis/locale/mobile';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { useUiStore } from '../state/ui-store';
import {
  installFakeApi,
  problem,
  sellerProduct,
  sellerScene,
  shopProduct,
  storefront,
  type Reply,
} from '../testing/fake-api';
import { resetSecureStore } from '../testing/secure-store-mock';

/**
 * BUY-05C: a pull is a NEW query (a new generation) that shows the previous items while it loads. For that
 * time the footer must describe the pull, never claim the list has ended: the new query has no next page yet,
 * so the old footer drew the end sentence under items that are about to be replaced (BUY-09 review finding).
 * Shop stands for the shared PublicListView.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const SHOP = 'GET /v1/shop/products';
let api: ReturnType<typeof installFakeApi>;
const page = (data: unknown[], next_cursor: string | null): Reply => ({
  status: 200,
  body: { market_resolved: true, data, next_cursor },
});
const first = (prefix = 'Item') =>
  Array.from({ length: 20 }, (_, i) => shopProduct(`${prefix}${i}`, `${prefix} ${i}`));
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const pull = () =>
  act(() =>
    (
      screen.getByTestId('shop-products').props as {
        refreshControl: { props: { onRefresh: () => void } };
      }
    ).refreshControl.props.onRefresh(),
  );
const ended = () => screen.queryByText(en['buyer.list.end']);
const openShop = async () => {
  await renderRouter(APP_DIR, { initialUrl: '/shop' });
  await screen.findByLabelText(/^Item 0,/);
  await settle();
};
/** Replies in order; the last one repeats. A held reply is a promise the test answers. */
function script(...replies: Array<Reply | Promise<Reply>>) {
  let n = 0;
  api.on(SHOP, () => replies[Math.min(n++, replies.length - 1)] as Reply);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({
    activeMode: null,
    themePreference: 'system',
    locale: 'en',
    upgradeNoticeDismissed: false,
  });
});
afterEach(() => {
  onlineManager.setOnline(true);
});

describe('a pull on a list that has another page (the footer describes the pull, not the end)', () => {
  it('while offline: keeps the items, says offline at the foot, never says the list ended, spends no request', async () => {
    script(page(first(), 'page-2'), page(first('New'), 'page-2'));
    await openShop();
    expect(screen.getByRole('button', { name: en['buyer.list.load_more'] })).toBeOnTheScreen();
    await act(async () => onlineManager.setOnline(false));
    await pull();
    await settle();
    expect(screen.getByLabelText(/^Item 0,/)).toBeOnTheScreen(); // the items the Buyer was reading stay
    expect(ended()).not.toBeOnTheScreen(); // the bug: the end sentence under items about to be replaced
    expect(await screen.findByTestId('list-refresh-offline')).toHaveTextContent(
      en['common.offline'],
    );
    expect(screen.queryByTestId('load-more-offline')).not.toBeOnTheScreen(); // that one speaks of the NEXT page
    expect(api.callsTo(SHOP)).toHaveLength(1); // paused, not spent
  });

  it('reconnecting resumes the pull: the new items arrive and the footer is the new list own (Load more, not the end)', async () => {
    script(page(first(), 'page-2'), page(first('New'), 'page-2'));
    await openShop();
    await act(async () => onlineManager.setOnline(false));
    await pull();
    await settle();
    await screen.findByTestId('list-refresh-offline');
    await act(async () => onlineManager.setOnline(true));
    expect(await screen.findByLabelText(/^New 0,/)).toBeOnTheScreen();
    expect(screen.queryByTestId('list-refresh-offline')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Item 0,/)).not.toBeOnTheScreen();
    expect(ended()).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['buyer.list.load_more'] })).toBeOnTheScreen();
    expect(api.callsTo(SHOP)).toHaveLength(2);
  });

  it('online and in flight: the footer says nothing about the end until the answer arrives', async () => {
    let answer!: (r: Reply) => void;
    const held = new Promise<Reply>((r) => (answer = r));
    script(page(first(), 'page-2'), held as unknown as Reply);
    await openShop();
    await pull();
    await settle();
    expect(screen.getByLabelText(/^Item 0,/)).toBeOnTheScreen();
    expect(ended()).not.toBeOnTheScreen();
    expect(screen.queryByTestId('list-refresh-offline')).not.toBeOnTheScreen(); // online: no offline claim
    await act(async () => answer(page([shopProduct('z', 'Item Z')], null)));
    expect(await screen.findByText(en['buyer.list.end'])).toBeOnTheScreen(); // the new list really is complete
  });

  it('two pulls in a row while offline are one pending refresh, with no duplicates after reconnect', async () => {
    script(page(first(), 'page-2'), page(first('New'), null));
    await openShop();
    await act(async () => onlineManager.setOnline(false));
    await pull();
    await pull();
    await settle();
    expect(ended()).not.toBeOnTheScreen();
    expect(screen.getAllByTestId('list-refresh-offline')).toHaveLength(1);
    await act(async () => onlineManager.setOnline(true));
    expect(await screen.findByLabelText(/^New 0,/)).toBeOnTheScreen();
    expect(await screen.findByText(en['buyer.list.end'])).toBeOnTheScreen();
    expect(screen.queryAllByLabelText(/^New 0,/)).toHaveLength(1);
  });

  it('a refresh that fails shows the failure with Try again, and no footer claims anything', async () => {
    script(page(first(), 'page-2'), problem(500, 'INTERNAL', 'request'), page(first('New'), null));
    await openShop();
    await pull();
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Item 0,/)).not.toBeOnTheScreen();
    expect(ended()).not.toBeOnTheScreen();
    expect(screen.queryByTestId('list-refresh-offline')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByLabelText(/^New 0,/)).toBeOnTheScreen();
  });
});

describe('a pull on a complete list', () => {
  it('while offline: no end sentence for the stale answer, the offline line instead', async () => {
    script(page(first(), null), page(first('New'), null));
    await openShop();
    expect(await screen.findByText(en['buyer.list.end'])).toBeOnTheScreen();
    await act(async () => onlineManager.setOnline(false));
    await pull();
    await settle();
    expect(ended()).not.toBeOnTheScreen();
    expect(await screen.findByTestId('list-refresh-offline')).toBeOnTheScreen();
    await act(async () => onlineManager.setOnline(true));
    expect(await screen.findByLabelText(/^New 0,/)).toBeOnTheScreen();
    expect(await screen.findByText(en['buyer.list.end'])).toBeOnTheScreen();
  });
});

describe('Load more offline is unchanged by the pull states', () => {
  it('a next-page request paused offline still speaks beside Load more, and not as a refresh', async () => {
    script(page(first(), 'page-2'), page([shopProduct('z', 'Item Z')], null));
    await openShop();
    await act(async () => onlineManager.setOnline(false));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.list.load_more'] }));
    await settle();
    expect(await screen.findByTestId('load-more-offline')).toBeOnTheScreen();
    expect(screen.queryByTestId('list-refresh-offline')).not.toBeOnTheScreen();
  });
});

describe('the same footer on the Seller Products list (another PublicListView screen)', () => {
  it('an offline pull keeps the products, says offline, and never says the list ended', async () => {
    const PRODUCTS = 'GET /v1/storefronts/seller-1/products';
    api.on('GET /v1/storefronts/seller-1', () => ({ status: 200, body: storefront('seller-1') }));
    api.on('GET /v1/storefronts/seller-1/scenes', () => ({
      status: 200,
      body: { data: [sellerScene(1)], next_cursor: null },
    }));
    const many = () => Array.from({ length: 20 }, (_, i) => sellerProduct(`p${i}`, `Thing ${i}`));
    api.on(PRODUCTS, () => ({ status: 200, body: { data: many(), next_cursor: 'page-2' } }));
    await renderRouter(APP_DIR, { initialUrl: '/sellers/seller-1' });
    await screen.findByRole('header', { name: 'Store 1' });
    await fireEvent.press(screen.getByRole('tab', { name: en['buyer.seller.tab.products'] }));
    await screen.findByLabelText(/^Thing 0,/);
    await settle();
    await act(async () => onlineManager.setOnline(false));
    await act(() =>
      (
        screen.getByTestId('seller-products').props as {
          refreshControl: { props: { onRefresh: () => void } };
        }
      ).refreshControl.props.onRefresh(),
    );
    await settle();
    expect(screen.getByLabelText(/^Thing 0,/)).toBeOnTheScreen();
    expect(ended()).not.toBeOnTheScreen();
    expect(await screen.findByTestId('list-refresh-offline')).toBeOnTheScreen();
  });
});

describe('the pending-pull offline line is a status the Buyer hears (BUY-04C)', () => {
  it('is announced once when it appears, and is not also a live region', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      script(page(first(), 'page-2'), page(first('New'), 'page-2'));
      await openShop();
      await act(async () => onlineManager.setOnline(false));
      await pull();
      await settle();
      const line = await screen.findByTestId('list-refresh-offline');
      expect(announce.mock.calls.filter(([text]) => text === en['common.offline'])).toHaveLength(1);
      expect(screen.getByText(en['common.offline']).props.accessibilityLiveRegion).toBeUndefined();
      expect(line).toBeOnTheScreen();
    } finally {
      announce.mockRestore();
    }
  });
});

describe('one announcement where the screen already says offline (BUY-04C review)', () => {
  it('Seller Profile products: an offline pull is announced once (the header says it; the foot stays plain)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      api.on('GET /v1/storefronts/seller-1', () => ({ status: 200, body: storefront('seller-1') }));
      api.on('GET /v1/storefronts/seller-1/scenes', () => ({ status: 200, body: { data: [sellerScene(1)], next_cursor: null } }));
      api.on('GET /v1/storefronts/seller-1/products', () => ({
        status: 200,
        body: { data: Array.from({ length: 20 }, (_, i) => sellerProduct(`p${i}`, `Thing ${i}`)), next_cursor: 'page-2' },
      }));
      await renderRouter(APP_DIR, { initialUrl: '/sellers/seller-1' });
      await screen.findByRole('header', { name: 'Store 1' });
      await fireEvent.press(screen.getByRole('tab', { name: en['buyer.seller.tab.products'] }));
      await screen.findByLabelText(/^Thing 0,/);
      await settle();
      await act(async () => onlineManager.setOnline(false));
      await act(() =>
        (screen.getByTestId('seller-products').props as { refreshControl: { props: { onRefresh: () => void } } }).refreshControl.props.onRefresh(),
      );
      await settle();
      await screen.findByTestId('list-refresh-offline');
      expect(announce.mock.calls.filter(([text]) => text === en['common.offline'])).toHaveLength(1);
    } finally {
      announce.mockRestore();
    }
  });
});
