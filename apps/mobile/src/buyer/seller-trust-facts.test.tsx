import { en } from '@adulis/locale/mobile';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { useUiStore } from '../state/ui-store';
import { installFakeApi, problem, sellerScene, storefront, type Reply, type Storefront } from '../testing/fake-api';
import { claimsIn, renderedText } from '../testing/discovery-rules';
import { resetSecureStore } from '../testing/secure-store-mock';

/**
 * What the Seller profile says about the Seller on its own authority: identity and the public
 * facts the storefront read carries, the Trust facts only as the server states them, and nothing
 * the contract does not provide. Real route tree, fake API on the generated contract.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const HANDLE = 'seller-1';
const HEADER = `GET /v1/storefronts/${HANDLE}`;
const SCENES = `GET /v1/storefronts/${HANDLE}/scenes`;
const NO_REVIEWS = { count: 0, average_rating: null, basis_counts: { FINAL_HANDOFF: 0, VERIFIED_ORDER_FAILURE: 0 } };
const STATS = storefront(HANDLE).stats!;

let api: ReturnType<typeof installFakeApi>;
const ok = (body: unknown): Reply => ({ status: 200, body });
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const profile = (over: Partial<Storefront> = {}) => {
  api.on(HEADER, () => ok(storefront(HANDLE, over)));
};
const open = async () => {
  await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
  expect(await screen.findByRole('header', { name: 'Store 1' })).toBeOnTheScreen();
  await screen.findByLabelText('Scene: Seller scene 1');
};
const everything = () => renderedText(screen.getByTestId('seller-scenes')).join(' | ');

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  api.on(SCENES, () => ok({ data: [sellerScene(1)], next_cursor: null }));
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

describe('Trust facts', () => {
  it.each([
    ['NEW', 'Trust level: New'],
    ['ESTABLISHED', 'Trust level: Established'],
    ['TRUSTED', 'Trust level: Trusted'],
  ] as const)('the server\u2019s level %s is shown in words, and the handoff count exactly as sent', async (level, words) => {
    profile({ stats: { ...STATS, level, completed_handoff_count: 31 } });
    await open();
    expect(screen.getByText(words)).toBeOnTheScreen();
    expect(screen.getByText('Completed handoffs: 31')).toBeOnTheScreen();
  });

  it('a Seller with nothing completed says zero, which is the server\u2019s fact', async () => {
    profile({ stats: { ...STATS, level: 'NEW', completed_handoff_count: 0 } });
    await open();
    expect(screen.getByText('Completed handoffs: 0')).toBeOnTheScreen();
  });

  it('a Seller the server sends no stats for shows no level, no count and nothing that reads as a badge', async () => {
    profile({ stats: null, review_summary: NO_REVIEWS });
    await open();
    expect(screen.queryByText(/Trust level/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/handoffs/i)).not.toBeOnTheScreen();
    expect(claimsIn(renderedText(screen.getByTestId('seller-scenes')))).toEqual([]);
  });

  it('a level this version does not know is not drawn as a badge, and the count is still shown', async () => {
    profile({ stats: { ...STATS, level: 'PLATINUM' as never, completed_handoff_count: 5 } });
    await open();
    expect(screen.queryByText(/Trust level/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/platinum/i)).not.toBeOnTheScreen();
    expect(screen.getByText('Completed handoffs: 5')).toBeOnTheScreen();
  });

  it('rates, claim counts, missed windows and the Seller\u2019s status are never drawn, on the profile or in About', async () => {
    profile({
      status: 'BILLING_SUSPENDED',
      stats: {
        ...STATS,
        cancellation_rate: '0.0500',
        confirmation_rate: '0.9100',
        scan_completion_rate: '0.8800',
        unresolved_claim_count: 4,
        missed_confirmation_windows: 6,
      },
    });
    await open();
    const forbidden = /%|0\.05|0\.91|0\.88|cancel|confirm|scan|claim|missed|window|suspend|billing|closing|plan|tier|subscription/i;
    expect(everything()).not.toMatch(forbidden);
    await fireEvent.press(screen.getByTestId('seller-tab-about'));
    await screen.findByTestId('seller-about');
    expect(renderedText(screen.getByTestId('seller-about')).join(' | ')).not.toMatch(forbidden);
  });

  it('the rating is the server\u2019s average and count in words, never a bare score; no review means no score', async () => {
    profile({ review_summary: { count: 7, average_rating: 4.3, basis_counts: { FINAL_HANDOFF: 7, VERIFIED_ORDER_FAILURE: 0 } } });
    await open();
    expect(screen.getByText('Seller service: 4.3 out of 5 from 7 reviews')).toBeOnTheScreen();
  });

  it('shows no rating, sales count, badge or discount of its own when the server sent no review and no stats', async () => {
    profile({ stats: null, review_summary: NO_REVIEWS, description: null });
    await open();
    expect(screen.getByText(en['buyer.seller.no_reviews'])).toBeOnTheScreen();
    expect(everything()).not.toMatch(/\d\s*(sold|sales|orders|followers)|\u2605|stars?|verified|top|best|discount|% off/i);
  });
});

describe('contact and storefront facts', () => {
  it('the only way to reach the Seller is Message the Seller: no call, chat-app, follow or share control exists', async () => {
    profile();
    await open();
    expect(screen.getByRole('button', { name: en['buyer.chat.message_seller'] })).toBeOnTheScreen();
    for (const name of [/call/i, /phone/i, /whats ?app|telegram/i, /follow/i, /share/i, /report/i, /block/i, /visit/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeOnTheScreen();
      expect(screen.queryByRole('link', { name })).not.toBeOnTheScreen();
    }
  });

  it('About states open or closed from the server\u2019s derivation, each fulfilment method in words, and leaves out a method it cannot name', async () => {
    profile({
      availability: { is_open: false, reason: 'OUT_OF_HOURS', note: 'Back at nine' },
      fulfilment_methods: ['BUYER_COLLECTION', 'SELLER_DELIVERY', 'COURIER_DELIVERY', 'DRONE_DELIVERY' as never],
    });
    await open();
    await fireEvent.press(screen.getByTestId('seller-tab-about'));
    expect(await screen.findByText(en['buyer.seller.about.closed'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.seller.about.open'])).not.toBeOnTheScreen();
    for (const method of ['BUYER_COLLECTION', 'SELLER_DELIVERY', 'COURIER_DELIVERY'] as const) {
      expect(screen.getByText(en[`buyer.seller.about.fulfilment.${method}`])).toBeOnTheScreen();
    }
    expect(screen.queryByText(/drone/i)).not.toBeOnTheScreen();
    // The server's free-text note and reason code are not Buyer copy here.
    expect(screen.queryByText(/Back at nine|OUT_OF_HOURS/)).not.toBeOnTheScreen();
  });

  it('a Seller with no description, no availability and no fulfilment method shows only the facts it has', async () => {
    profile({ description: null, availability: null, fulfilment_methods: [] });
    await open();
    await fireEvent.press(screen.getByTestId('seller-tab-about'));
    expect(await screen.findByText(/^On Adulis since /)).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.seller.about.description'])).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.seller.about.open'])).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.seller.about.closed'])).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.seller.about.fulfilment'])).not.toBeOnTheScreen();
  });
});

describe('a Seller whose store sells nothing', () => {
  // Open by its weekly pattern (the server derives that from the hours alone) and with every method active.
  const TRADING_FACTS = {
    availability: { is_open: true, reason: 'SCHEDULE', note: null },
    fulfilment_methods: ['BUYER_COLLECTION', 'SELLER_DELIVERY', 'COURIER_DELIVERY'] as Storefront['fulfilment_methods'],
  };
  const openAbout = async () => {
    await open();
    await fireEvent.press(screen.getByTestId('seller-tab-about'));
    expect(await screen.findByText(/^On Adulis since /)).toBeOnTheScreen();
  };
  const aboutText = () => renderedText(screen.getByTestId('seller-about')).join(' | ');
  const NOT_TRADING_CLAIMS = () => {
    expect(screen.queryByText(en['buyer.seller.about.open'])).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.seller.about.closed'])).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.seller.about.fulfilment'])).not.toBeOnTheScreen();
    for (const method of ['BUYER_COLLECTION', 'SELLER_DELIVERY', 'COURIER_DELIVERY'] as const) {
      expect(screen.queryByText(en[`buyer.seller.about.fulfilment.${method}`])).not.toBeOnTheScreen();
    }
  };

  it.each(['CLOSING', 'BILLING_SUSPENDED'] as const)(
    '%s: About says neither that it is open nor closed nor how orders are received, names no status, and keeps the facts about the Seller',
    async (status) => {
      profile({ status, ...TRADING_FACTS });
      await openAbout();
      NOT_TRADING_CLAIMS();
      expect(aboutText()).not.toMatch(/suspend|billing|closing|plan|tier|subscription/i);
      expect(screen.getByText('Baskets woven in Addis Ababa.')).toBeOnTheScreen();
      // The header and About both state it (the server's level, not a claim that the store trades).
      expect(screen.getAllByText(`Trust level: ${en['buyer.seller.trust.ESTABLISHED']}`).length).toBeGreaterThan(0);
    },
  );

  it('a status this version does not know is treated as not trading: nothing is claimed', async () => {
    profile({ status: 'PAUSED' as never, ...TRADING_FACTS });
    await openAbout();
    NOT_TRADING_CLAIMS();
  });

  it('an active Seller keeps saying open, closed or nothing from the server\u2019s derivation, and its methods', async () => {
    profile({ status: 'ACTIVE', ...TRADING_FACTS });
    await openAbout();
    expect(screen.getByText(en['buyer.seller.about.open'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.seller.about.fulfilment'])).toBeOnTheScreen();
    for (const method of ['BUYER_COLLECTION', 'SELLER_DELIVERY', 'COURIER_DELIVERY'] as const) {
      expect(screen.getByText(en[`buyer.seller.about.fulfilment.${method}`])).toBeOnTheScreen();
    }
  });

  it('a Seller that is active and closed by its hours still says closed; with no availability it says nothing', async () => {
    profile({ status: 'ACTIVE', ...TRADING_FACTS, availability: { is_open: false, reason: 'OUT_OF_HOURS', note: null } });
    await openAbout();
    expect(screen.getByText(en['buyer.seller.about.closed'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.seller.about.open'])).not.toBeOnTheScreen();
  });

  it('a Seller that turns CLOSING at the next read stops saying it is open', async () => {
    let n = 0;
    api.on(HEADER, () => ok(storefront(HANDLE, { ...TRADING_FACTS, status: n++ === 0 ? 'ACTIVE' : 'CLOSING' })));
    await openAbout();
    expect(screen.getByText(en['buyer.seller.about.open'])).toBeOnTheScreen();
    await act(() => (screen.getByTestId('seller-about').props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());
    await settle();
    NOT_TRADING_CLAIMS();
  });
});

describe('the states of the profile', () => {
  it('a slow read says it is loading, and shows neither a failure nor a gone message nor any tab', async () => {
    let release: (reply: Reply) => void = () => undefined;
    api.on(HEADER, () => new Promise<Reply>((resolve) => (release = resolve)));
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    expect(await screen.findByText(en['buyer.seller.loading'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.seller.gone'])).not.toBeOnTheScreen();
    expect(screen.queryByText(en['error.request.internal'])).not.toBeOnTheScreen();
    expect(screen.queryByRole('tab')).not.toBeOnTheScreen();
    await act(async () => release(ok(storefront(HANDLE))));
    expect(await screen.findByRole('header', { name: 'Store 1' })).toBeOnTheScreen();
  });

  it('a failed read says so with a retry, never that the Seller is gone, and the retry shows the profile', async () => {
    let n = 0;
    api.on(HEADER, () => (n++ === 0 ? problem(500, 'INTERNAL', 'request') : ok(storefront(HANDLE))));
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.seller.gone'])).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByRole('header', { name: 'Store 1' })).toBeOnTheScreen();
    await settle();
  });

  it('a Seller with no Scenes and no Products says so in each tab', async () => {
    profile();
    api.on(SCENES, () => ok({ data: [], next_cursor: null }));
    api.on(`GET /v1/storefronts/${HANDLE}/products`, () => ok({ data: [], next_cursor: null }));
    api.on(`GET /v1/storefronts/${HANDLE}/reviews`, () => ok({ data: [], next_cursor: null }));
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    expect(await screen.findByText(en['buyer.seller.scenes.empty'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('seller-tab-products'));
    expect(await screen.findByText(en['buyer.seller.products.empty'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('seller-tab-reviews'));
    expect(await screen.findByText(en['buyer.seller.reviews.empty'])).toBeOnTheScreen();
  });
});
