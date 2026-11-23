import { en } from '@adulis/locale/mobile';
import { onlineManager } from '@tanstack/react-query';
import { render, screen as rntlScreen } from '@testing-library/react-native';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';

import type { CollectionItem } from '../api/client';
import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, installFakeApi, shopProduct, type Reply } from '../testing/fake-api';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';
import { SavedItemCard } from './SavedItemCard';

/**
 * BUY-09 (B25-005): Load more on the other paged lists says "offline" beside the control, as For You
 * does (for-you.test.tsx): no spinner, no end sentence, no extra request, the page arrives on reconnect.
 * Plus the Saved card trusts `state`, and the Saved screens never touch Cart.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));

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

describe('Load more while offline: the Shop (a PublicListView list)', () => {
  const first = () => Array.from({ length: 20 }, (_, i) => shopProduct(`p${i}`, `Item ${i}`));
  const page = (data: unknown[], next_cursor: string | null) =>
    ok({ market_resolved: true, data, next_cursor });

  it('says offline beside Load more, keeps the button, spends no request, and the page arrives on reconnect', async () => {
    let n = 0;
    api.on('GET /v1/shop/products', () =>
      n++ === 0 ? page(first(), 'page-2') : page([shopProduct('z', 'Item Z')], null),
    );
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    await screen.findByLabelText(/^Item 0,/);
    await settle();
    expect(screen.queryByTestId('load-more-offline')).not.toBeOnTheScreen(); // online: nothing extra
    await act(async () => onlineManager.setOnline(false));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.list.load_more'] }));
    await settle();
    const offline = await screen.findByTestId('load-more-offline');
    expect(offline).toHaveTextContent(en['common.offline']);
    expect(
      within(screen.getByTestId('load-more-footer')).getByTestId('load-more-offline'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['buyer.list.load_more'] })).toBeEnabled();
    expect(screen.queryByText(en['buyer.list.loading_more'])).not.toBeOnTheScreen(); // does not spin
    expect(screen.queryByText(en['buyer.list.end'])).not.toBeOnTheScreen();
    expect(api.callsTo('GET /v1/shop/products')).toHaveLength(1); // paused, not spent
    await act(async () => onlineManager.setOnline(true));
    expect(await screen.findByText(en['buyer.list.end'])).toBeOnTheScreen();
    expect(screen.queryByTestId('load-more-offline')).not.toBeOnTheScreen();
    expect(api.callsTo('GET /v1/shop/products').map((c) => c.query['cursor'])).toEqual([
      undefined,
      'page-2',
    ]);
  });
});

describe('Load more while offline: Notifications (Load older)', () => {
  const id = (n: number) => `0e000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
  const row = (n: number) => ({
    id: id(n),
    template_key: 'ORDER_AWAITING_PAYMENT_MORNING',
    locale: 'en',
    slots: {},
    order_id: null,
    suppressible: true,
    scheduled_for: new Date(Date.now() - n * 3600_000).toISOString(),
    read_at: null as string | null,
  });

  it('says offline beside Load older, keeps the button, and the page arrives on reconnect', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    const rows = Array.from({ length: 30 }, (_, i) => row(i + 1));
    api.on('GET /v1/notifications', (call) => {
      const start = call.query.cursor
        ? rows.findIndex((r) => r.scheduled_for < call.query.cursor!)
        : 0;
      const slice = rows.slice(start, start + 25);
      const more = start + 25 < rows.length;
      return ok({ data: slice, next_cursor: more ? slice[slice.length - 1]!.scheduled_for : null });
    });
    await renderRouter(APP_DIR, { initialUrl: '/notifications' });
    await screen.findAllByText(en['buyer.notifications.unread']);
    expect(screen.queryByTestId('load-more-offline')).not.toBeOnTheScreen();
    await act(async () => onlineManager.setOnline(false));
    await fireEvent.press(
      await screen.findByRole('button', { name: en['buyer.notifications.load_older'] }),
    );
    await settle();
    expect(await screen.findByTestId('load-more-offline')).toHaveTextContent(en['common.offline']);
    expect(
      screen.getByRole('button', { name: en['buyer.notifications.load_older'] }),
    ).toBeEnabled();
    expect(screen.queryByText(en['buyer.list.end'])).not.toBeOnTheScreen();
    expect(api.callsTo('GET /v1/notifications')).toHaveLength(1);
    await act(async () => onlineManager.setOnline(true));
    expect(await screen.findByText(en['buyer.list.end'])).toBeOnTheScreen();
    expect(screen.queryByTestId('load-more-offline')).not.toBeOnTheScreen();
  });
});

describe('SavedItemCard trusts the resolved state, not the nullable fields (design S40)', () => {
  const secret = shopProduct('lamp', 'Secret lamp', 'seller-1');
  const item = (over: Partial<CollectionItem>) =>
    ({
      ref: 'item-1',
      collection_ref: 'c-1',
      target_type: 'PRODUCT_POST',
      state: 'UNAVAILABLE',
      saved_at: '2026-11-11T08:00:00.000000Z',
      product: secret,
      scene: null,
      ...over,
    }) as unknown as CollectionItem;

  it('an UNAVAILABLE item draws one neutral sentence even when a contradictory payload carries a Product', async () => {
    await render(<SavedItemCard item={item({})} onRemove={() => undefined} />);
    expect(rntlScreen.queryByText(/Secret lamp/)).not.toBeOnTheScreen();
    expect(rntlScreen.queryByLabelText(/Secret lamp/)).not.toBeOnTheScreen();
    expect(rntlScreen.getByText(en['buyer.saved.product_unavailable'])).toBeOnTheScreen();
    // Remove still works, and its label names nothing.
    expect(rntlScreen.getByLabelText(en['buyer.collection.remove_unavailable'])).toBeOnTheScreen();
  });

  it('the same for a Scene', async () => {
    const scene = { caption: 'Secret scene' };
    await render(
      <SavedItemCard
        item={item({ target_type: 'SCENE_POST', product: null, scene: scene as never })}
      />,
    );
    expect(rntlScreen.queryByText(/Secret scene/)).not.toBeOnTheScreen();
    expect(rntlScreen.getByText(en['buyer.saved.scene_unavailable'])).toBeOnTheScreen();
  });
});

describe('Saved never touches Cart (BUY-09)', () => {
  it('opening Saved and removing nothing sends no request whose path mentions the cart', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    await settle();
    expect(api.calls.length).toBeGreaterThan(0);
    expect(api.calls.filter((c) => /cart/i.test(c.path))).toEqual([]);
  });
});
