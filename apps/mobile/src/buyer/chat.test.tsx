import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { useUiStore } from '../state/ui-store';
import {
  GOOD_TOKEN,
  SIGNED_IN_CONTEXT,
  SIGN_IN_CODE,
  bootstrapBody,
  installFakeApi,
  problem,
  storefront,
  storefrontProduct,
  type Recorded,
} from '../testing/fake-api';
import type { StorefrontProduct } from '../api/client';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * WO-013: Buyer messaging on the real route tree against an in-memory chat server on the API's
 * rules (one conversation per Buyer and Seller; 25 conversations and 50 messages a page, newest
 * first; text 1-4000; BOT rows as template keys). Numbers are the work order's section 34 matrix
 * (1-26); 24 and 25 (Dark, enlarged text) are native.
 *
 * WO-014: Product-context messaging (the "Product context" block, its section 19 matrix 1-40). The
 * server also holds a small public catalogue: a message's product_id must name a PUBLISHED Product
 * of the conversation's own Seller, or the send is a 404 (the API's rule).
 *
 * WO-015: the in-conversation Product selector (the "Select Product" block, its section 13 matrix
 * 1-25). The server lists each Seller's published Products page by page, as the API does.
 *
 * WO-016: messaging UX and reliability (the "Messaging UX and reliability" block): ON-164's
 * composer layout, ON-168's neutral refusal, the unconfirmed-send wording, and section 20.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const OTHER_TOKEN = 'Other_credential_for_tests_0123456789abcdef';
const UUID7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HANDLE = 'seller-1';
const SELLER_ID = storefront(HANDLE).seller_id;
const HANDLE_2 = 'seller-2';
const SELLER_2 = '0b6f1a3e-8888-4888-8888-888888888888';
const BASKET = storefrontProduct('basket', 'Woven basket');
const LAMP = storefrontProduct('lamp', 'Clay lamp', { id: '0b6f1a3e-4444-4444-8444-444444444444', available: false });
const VASE = storefrontProduct('vase', 'Glass vase', {
  id: '0b6f1a3e-5555-4555-8555-555555555555',
  seller: { handle: HANDLE_2, store_name: 'Store 2' },
});
const A = `Bearer ${GOOD_TOKEN}`;
const B = `Bearer ${OTHER_TOKEN}`;
let api: ReturnType<typeof installFakeApi>;
const signedIn = (token = GOOD_TOKEN) => resetSecureStore({ [TOKEN_KEY]: token });
const held = () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { gate, release };
};
const hex = (n: number) => n.toString(16).padStart(12, '0');
const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();

type Msg = { id: string; sender_kind: string; body?: string; template_key?: string; resolution_path?: string; sent_at: string; product_id?: string | null };
type Conv = { id: string; owner: string; seller_id: string; store_name: string; handle: string; last_message_at: string; messages: Msg[] };

/** The in-memory chat server. Conversations belong to a bearer; anything else is 404. */
function installChat() {
  const convs: Conv[] = [];
  let n = 0;
  const conv = (owner: string, seller = SELLER_ID, storeName = 'Store 1', handle = HANDLE, at = ago(60)): Conv => {
    const c = { id: `c0000000-0000-4000-8000-${hex(++n)}`, owner, seller_id: seller, store_name: storeName, handle, last_message_at: at, messages: [] };
    convs.push(c);
    return c;
  };
  const msg = (c: Conv, m: Omit<Msg, 'id'>) => {
    const full = { id: `d0000000-0000-4000-8000-${hex(++n)}`, ...m };
    c.messages.unshift(full);
    c.last_message_at = m.sent_at;
    return full;
  };
  const catalogue = new Map<string, { product: StorefrontProduct; seller: string; published: boolean }>();
  /** Publish a Product: its public read answers, and messages may be about it. */
  const publish = (product: StorefrontProduct) => {
    const entry = { product, seller: product.seller.handle === HANDLE_2 ? SELLER_2 : SELLER_ID, published: true };
    catalogue.set(product.id, entry);
    api.on(`GET /v1/storefronts/${product.seller.handle}/products/${product.slug}`, () =>
      entry.published ? { status: 200, body: product } : problem(404, 'NOT_FOUND', 'request'),
    );
    return { unpublish: () => (entry.published = false) };
  };
  /** A fault switch for the list's later pages (a server error, never a lost connection). */
  const faults = { laterPages: false };
  const listing = (sellerHandle: string) => (call: Recorded) => {
    const all = [...catalogue.values()].filter((e) => e.published && e.product.seller.handle === sellerHandle);
    const limit = Number(call.query.limit ?? 100);
    const start = call.query.cursor ? Number(call.query.cursor) : 0;
    const slice = all.slice(start, start + limit);
    return {
      status: 200,
      body: {
        data: slice.map(({ product: p }, i) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          base_price_minor: p.base_price_minor,
          base_price_currency: p.base_price_currency,
          price_min_minor: p.price_min_minor,
          price_max_minor: p.price_max_minor,
          price_currency: p.price_currency,
          available: p.available,
          display_order: start + i,
          image_key: null,
        })),
        next_cursor: start + limit < all.length ? String(start + limit) : null,
      },
    };
  };
  api.on(`GET /v1/storefronts/${HANDLE}/products`, listing(HANDLE));
  api.on(`GET /v1/storefronts/${HANDLE_2}/products`, listing(HANDLE_2));
  const mine = (call: Recorded) => convs.filter((c) => c.owner === call.headers.Authorization);
  const byPath = (call: Recorded) => mine(call).find((c) => call.path.startsWith(`/v1/conversations/${c.id}/`));
  api.on('POST /v1/conversations', (call) => {
    if (!call.headers.Authorization) return problem(401, 'SESSION_EXPIRED', 'auth');
    const seller = call.body?.seller_id;
    if (seller !== SELLER_ID && seller !== SELLER_2) return problem(404, 'NOT_FOUND', 'request');
    const found =
      mine(call).find((c) => c.seller_id === seller) ??
      (seller === SELLER_2 ? conv(call.headers.Authorization, SELLER_2, 'Store 2', HANDLE_2, new Date().toISOString()) : conv(call.headers.Authorization));
    return { status: 201, body: { conversation_id: found.id } };
  });
  api.on('GET /v1/conversations', (call) => {
    if (call.query.as !== 'buyer') return problem(400, 'SCOPE_PARAMETER_REQUIRED', 'request');
    if (call.query.cursor && faults.laterPages) return problem(500, 'INTERNAL', 'server');
    const list = mine(call).sort((x, y) => y.last_message_at.localeCompare(x.last_message_at));
    const start = call.query.cursor ? list.findIndex((c) => c.last_message_at < call.query.cursor!) : 0;
    const slice = start < 0 ? [] : list.slice(start, start + 25);
    return {
      status: 200,
      body: {
        data: slice.map(({ id, seller_id, store_name, handle, last_message_at }) => ({ id, seller_id, store_name, handle, started_at: last_message_at, last_message_at })),
        next_cursor: start >= 0 && start + 25 < list.length ? slice[slice.length - 1]!.last_message_at : null,
      },
    };
  });
  api.onPattern('GET', /^\/v1\/conversations\/[^/]+\/messages$/, (call) => {
    const c = byPath(call);
    if (!c) return problem(404, 'NOT_FOUND', 'request');
    const start = call.query.cursor ? c.messages.findIndex((m) => m.sent_at < call.query.cursor!) : 0;
    const slice = start < 0 ? [] : c.messages.slice(start, start + 50);
    return { status: 200, body: { data: slice, next_cursor: start >= 0 && start + 50 < c.messages.length ? slice[slice.length - 1]!.sent_at : null } };
  });
  api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, (call) => {
    const c = byPath(call);
    if (!c) return problem(404, 'NOT_FOUND', 'request');
    const text = call.body?.text;
    if (typeof text !== 'string' || text.length < 1 || text.length > 4000) return problem(400, 'VALIDATION_FAILED', 'request', { path: 'text' });
    const productId = call.body?.product_id;
    if (productId !== undefined) {
      const entry = typeof productId === 'string' ? catalogue.get(productId) : undefined;
      if (!entry || !entry.published || entry.seller !== c.seller_id) return problem(404, 'NOT_FOUND', 'request');
    }
    const m = msg(c, { sender_kind: 'BUYER', body: text, sent_at: new Date().toISOString(), product_id: (productId as string | undefined) ?? null });
    return { status: 201, body: { message_id: m.id, bot: null } };
  });
  api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/escalate$/, (call) => {
    const c = byPath(call);
    if (!c) return problem(404, 'NOT_FOUND', 'request');
    const m = msg(c, { sender_kind: 'BOT', template_key: 'chat.bot.escalated', resolution_path: 'ESCALATED', sent_at: new Date().toISOString() });
    return { status: 200, body: { escalated: true, bot_message_id: m.id } };
  });
  return { convs, conv, msg, publish, faults };
}

const sends = () => api.calls.filter((c) => c.method === 'POST' && /\/messages$/.test(c.path));
const composer = () => screen.getByLabelText(en['buyer.chat.composer']);
const sendButton = () => screen.getByRole('button', { name: en['buyer.chat.send'] });
/** While a send is unconfirmed the same button reads "Try sending again" (WO-016). */
const retryButton = () => screen.getByRole('button', { name: en['buyer.chat.retry_send'] });

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  api.on(`GET /v1/storefronts/${HANDLE}`, () => ({ status: 200, body: storefront(HANDLE) }));
  api.on(`GET /v1/storefronts/${HANDLE}/scenes`, () => ({ status: 200, body: { data: [], next_cursor: null } }));
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

afterEach(() => {
  // 26: messaging never touches commerce.
  expect(api.calls.filter((c) => /cart|order|checkout|payment|reservation/i.test(c.path))).toEqual([]);
});

describe('Conversations', () => {
  it('1. a guest sees why it needs an Account; Message Seller sends a guest to sign in', async () => {
    installChat();
    await renderRouter(APP_DIR, { initialUrl: '/messages' });
    expect(await screen.findByText(en['buyer.messages.signed_out'])).toBeOnTheScreen();
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.chat.message_seller'] }));
    expect(await screen.findByText(en['auth.sign_in.intro'])).toBeOnTheScreen();
    expect(api.callsTo('GET /v1/conversations')).toEqual([]);
    expect(api.callsTo('POST /v1/conversations')).toEqual([]);
  });

  it('2, 3. a signed-in Buyer sees only their own conversations (as=buyer); none says so', async () => {
    signedIn();
    const chat = installChat();
    await renderRouter(APP_DIR, { initialUrl: '/messages' });
    expect(await screen.findByText(en['buyer.messages.empty'])).toBeOnTheScreen();
    chat.conv(A, SELLER_ID, 'Store 1');
    chat.conv(B, SELLER_ID, 'Someone else\'s store');
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.messages.refresh'] }));
    expect(await screen.findByRole('button', { name: 'Store 1' })).toBeOnTheScreen();
    expect(screen.queryByText('Someone else\'s store')).toBeNull();
    const [first] = api.callsTo('GET /v1/conversations');
    expect(first?.query.as).toBe('buyer');
    expect(first?.headers.Authorization).toBe(A);
  });

  it('6. Load older conversations fetches the next page once', async () => {
    signedIn();
    const chat = installChat();
    for (let i = 0; i < 27; i++) chat.conv(A, SELLER_ID, `Store ${i + 1}`, `store-${i + 1}`, ago(100 + i));
    await renderRouter(APP_DIR, { initialUrl: '/messages' });
    await screen.findByRole('button', { name: 'Store 1' });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.messages.load_older'] }));
    await waitFor(() => expect(api.callsTo('GET /v1/conversations')).toHaveLength(2));
    // The list virtualises (only the first rows render in a test): the page and its cursor are the proof.
    expect(api.callsTo('GET /v1/conversations')[1]?.query.cursor).toBe(chat.convs[24]!.last_message_at);
    await waitFor(() => expect(screen.queryByRole('button', { name: en['buyer.messages.load_older'] })).toBeNull());
  });
});

describe('Message Seller', () => {
  it('4, 5. opens the conversation by the profile\'s seller_id, and opening again returns the same one', async () => {
    signedIn();
    const chat = installChat();
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.chat.message_seller'] }));
    expect(await screen.findByText(en['buyer.chat.empty'])).toBeOnTheScreen();
    const [open] = api.callsTo('POST /v1/conversations');
    expect(open?.body).toEqual({ seller_id: SELLER_ID });
    expect(open?.headers['Idempotency-Key']).toMatch(UUID7);
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.chat.message_seller'] }));
    await screen.findByText(en['buyer.chat.empty']);
    expect(chat.convs.filter((c) => c.owner === A)).toHaveLength(1);
  });

  it('a Seller the server does not find says the conversation could not be opened', async () => {
    signedIn();
    installChat();
    api.on('POST /v1/conversations', () => problem(404, 'NOT_FOUND', 'request'));
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.chat.message_seller'] }));
    expect(await screen.findByText(en['buyer.chat.open_failed'])).toBeOnTheScreen();
  });
});

describe('a conversation', () => {
  async function openConversation(setup?: (chat: ReturnType<typeof installChat>, c: Conv) => void) {
    signedIn();
    const chat = installChat();
    const c = chat.conv(A);
    setup?.(chat, c);
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}` });
    return { chat, c };
  }

  it('15, 16. every message names its sender; a bot answer is "Automated answer", never the Seller', async () => {
    await openConversation((chat, c) => {
      chat.msg(c, { sender_kind: 'BUYER', body: 'Is this in stock?', sent_at: ago(50) });
      chat.msg(c, { sender_kind: 'BOT', template_key: 'chat.bot.escalated', resolution_path: 'ESCALATED', sent_at: ago(40) });
      chat.msg(c, { sender_kind: 'SELLER', body: 'Yes, two left.', sent_at: ago(30) });
      chat.msg(c, { sender_kind: 'TEAM_MEMBER', body: 'I can hold one.', sent_at: ago(20) });
      chat.msg(c, { sender_kind: 'BOT', template_key: 'nlu.answer.delivery_times', resolution_path: 'KEYWORD', sent_at: ago(10) });
    });
    expect(await screen.findByText('Is this in stock?')).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.chat.sender.you'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.chat.sender.seller'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.chat.sender.team'])).toBeOnTheScreen();
    expect(screen.getAllByText(en['buyer.chat.sender.bot'])).toHaveLength(2);
    expect(screen.getByText(en['chat.bot.escalated'])).toBeOnTheScreen();
    // A bot template the catalogue cannot render is a neutral line, never its raw key.
    expect(screen.getByText(en['buyer.chat.bot_unavailable'])).toBeOnTheScreen();
    expect(screen.queryByText(/nlu\.answer/)).toBeNull();
  });

  it('7. Load earlier messages pages back once, from the 50th message', async () => {
    const { c } = await openConversation((chat, c) => {
      for (let i = 60; i >= 1; i--) chat.msg(c, { sender_kind: 'SELLER', body: `Line ${i}`, sent_at: ago(i * 10) });
    });
    expect(await screen.findByText('Line 1')).toBeOnTheScreen();
    const getMessages = () => api.calls.filter((call) => call.method === 'GET' && call.path.endsWith('/messages'));
    const firstPage = getMessages().length;
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.chat.load_earlier'] }));
    await waitFor(() => expect(getMessages().length).toBe(firstPage + 1));
    // The list virtualises (a test renders the first rows only): the request and its cursor are the proof.
    expect(getMessages().at(-1)?.query.cursor).toBe(c.messages[49]!.sent_at);
    await waitFor(() => expect(screen.queryByRole('button', { name: en['buyer.chat.load_earlier'] })).toBeNull());
  });

  it('8, 19, 20. plain text is sent under one key with no anchor, and shows once the server accepted it', async () => {
    await openConversation();
    await screen.findByText(en['buyer.chat.empty']);
    await fireEvent.changeText(composer(), 'Hello, do you deliver to Bole?');
    await fireEvent.press(sendButton());
    expect(await screen.findByText('Hello, do you deliver to Bole?')).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.chat.sender.you'])).toBeOnTheScreen();
    const [sent] = sends();
    expect(sent?.body).toEqual({ text: 'Hello, do you deliver to Bole?' });
    expect(sent?.headers['Idempotency-Key']).toMatch(UUID7);
    expect(composer().props.value).toBe('');
  });

  it('9, 10. an empty or over-long message cannot be sent', async () => {
    await openConversation();
    await screen.findByText(en['buyer.chat.empty']);
    expect(sendButton()).toBeDisabled();
    await fireEvent.changeText(composer(), '   ');
    expect(sendButton()).toBeDisabled();
    await fireEvent.changeText(composer(), 'x'.repeat(4001));
    expect(await screen.findByText('A message can be up to 4,000 characters.')).toBeOnTheScreen();
    expect(sendButton()).toBeDisabled();
    await fireEvent.press(sendButton());
    expect(sends()).toEqual([]);
  });

  it('11. a second press while sending sends nothing', async () => {
    const { gate, release } = held();
    const { chat, c } = await openConversation();
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, async (call) => {
      await gate;
      const m = chat.msg(c, { sender_kind: 'BUYER', body: String(call.body?.text), sent_at: new Date().toISOString() });
      return { status: 201, body: { message_id: m.id, bot: null } };
    });
    await screen.findByText(en['buyer.chat.empty']);
    await fireEvent.changeText(composer(), 'Once only');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['buyer.chat.sending'])).toBeOnTheScreen();
    await fireEvent.press(sendButton());
    expect(sends()).toHaveLength(1);
    await act(async () => release());
    expect(await screen.findByText('Once only')).toBeOnTheScreen();
  });

  it('12, 13. a message lost offline is not shown as sent and is "unconfirmed"; the draft stays and the retry reuses its key', async () => {
    const { chat, c } = await openConversation();
    let first = true;
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, (call) => {
      if (first) {
        first = false;
        return 'offline';
      }
      const m = chat.msg(c, { sender_kind: 'BUYER', body: String(call.body?.text), sent_at: new Date().toISOString() });
      return { status: 201, body: { message_id: m.id, bot: null } };
    });
    await screen.findByText(en['buyer.chat.empty']);
    await fireEvent.changeText(composer(), 'Are you open today?');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.not_sent'])).toBeNull();
    expect(screen.getByText(en['common.offline'])).toBeOnTheScreen();
    expect(composer().props.value).toBe('Are you open today?');
    expect(screen.queryByText(en['buyer.chat.sender.you'])).toBeNull();
    await fireEvent.press(retryButton());
    expect(await screen.findByText(en['buyer.chat.sender.you'])).toBeOnTheScreen();
    const keys = sends().map((s) => s.headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('14. a server refusal is not shown as sent, and the next attempt is a new intent', async () => {
    await openConversation();
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, () => problem(400, 'VALIDATION_FAILED', 'request', { path: 'text' }));
    await screen.findByText(en['buyer.chat.empty']);
    await fireEvent.changeText(composer(), 'Refused text');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['buyer.chat.not_sent'])).toBeOnTheScreen();
    await fireEvent.press(sendButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    expect(sends()[0]?.headers['Idempotency-Key']).not.toBe(sends()[1]?.headers['Idempotency-Key']);
  });

  it('17. Ask the Seller follows an automated answer, escalates once, and promises no response time', async () => {
    await openConversation((chat, c) => {
      chat.msg(c, { sender_kind: 'BUYER', body: 'Delivery times?', sent_at: ago(20) });
      chat.msg(c, { sender_kind: 'BOT', template_key: 'nlu.answer.delivery_times', resolution_path: 'KEYWORD', sent_at: ago(10) });
    });
    expect(await screen.findByText(en['buyer.chat.ask_seller_hint'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.ask_seller'] }));
    expect(await screen.findByText(en['chat.bot.escalated'])).toBeOnTheScreen();
    const [escalate] = api.calls.filter((call) => call.path.endsWith('/escalate'));
    expect(escalate?.headers['Idempotency-Key']).toMatch(UUID7);
    // The escalation itself is not an answer to escalate again.
    expect(screen.queryByRole('button', { name: en['buyer.chat.ask_seller'] })).toBeNull();
  });

  it('a question and its automated answer written at the same instant: the answer follows, and Ask the Seller is offered', async () => {
    const same = ago(10);
    await openConversation((chat, c) => {
      // The server's order for one sent_at is undefined: here the bot row comes first.
      chat.msg(c, { sender_kind: 'BOT', template_key: 'nlu.answer.delivery_times', resolution_path: 'KEYWORD', sent_at: same });
      chat.msg(c, { sender_kind: 'BUYER', body: 'Delivery times?', sent_at: same });
    });
    expect(await screen.findByText(en['buyer.chat.ask_seller_hint'])).toBeOnTheScreen();
  });

  it('a conversation with no automated answer offers no Ask the Seller', async () => {
    await openConversation((chat, c) => {
      chat.msg(c, { sender_kind: 'SELLER', body: 'Welcome!', sent_at: ago(10) });
    });
    await screen.findByText('Welcome!');
    expect(screen.queryByRole('button', { name: en['buyer.chat.ask_seller'] })).toBeNull();
  });

  it('18, 23. another Account\'s conversation, an unknown one, and a malformed reference are unavailable', async () => {
    signedIn();
    const chat = installChat();
    const theirs = chat.conv(B);
    await renderRouter(APP_DIR, { initialUrl: `/chat/${theirs.id}` });
    expect(await screen.findByText(en['buyer.chat.unavailable'])).toBeOnTheScreen();
    await renderRouter(APP_DIR, { initialUrl: '/chat/c0000000-0000-4000-8000-0000000000ff' });
    expect(await screen.findByText(en['buyer.chat.unavailable'])).toBeOnTheScreen();
    const before = api.calls.length;
    await renderRouter(APP_DIR, { initialUrl: '/chat/not-a-conversation' });
    expect(await screen.findByText(en['buyer.chat.unavailable'])).toBeOnTheScreen();
    expect(api.calls.slice(before).filter((c) => c.path.includes('/v1/conversations/'))).toEqual([]);
  });

  it('22. a messages answer that lands after sign-out is never shown, and the screen leaves', async () => {
    signedIn();
    const chat = installChat();
    const c = chat.conv(A);
    chat.msg(c, { sender_kind: 'SELLER', body: 'Private reply', sent_at: ago(10) });
    const { gate, release } = held();
    api.onPattern('GET', /^\/v1\/conversations\/[^/]+\/messages$/, async () => {
      await gate;
      return { status: 200, body: { data: c.messages, next_cursor: null } };
    });
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}` });
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    await act(async () => release());
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}` });
    expect(await screen.findByText(en['buyer.messages.signed_out'])).toBeOnTheScreen();
    expect(screen.queryByText('Private reply')).toBeNull();
  });

  it('21. another Account signing in sees only its own conversations', async () => {
    signedIn();
    api.on('GET /v1/bootstrap', (call) =>
      call.headers.Authorization ? { status: 200, body: bootstrapBody({ account_context: SIGNED_IN_CONTEXT }) } : { status: 200, body: bootstrapBody() },
    );
    api.on('POST /v1/auth/otp/verify', (call) =>
      call.body?.code === SIGN_IN_CODE
        ? { status: 200, body: { account_id: '0b6f1a3e-3333-4333-8333-333333333333', audience: 'MOBILE', roles: [], expires_at: '2026-12-09T12:00:00.000Z', token: OTHER_TOKEN } }
        : problem(401, 'OTP_INVALID', 'auth'),
    );
    const chat = installChat();
    chat.conv(A, SELLER_ID, 'First Account store');
    chat.conv(B, SELLER_ID, 'Second Account store');
    await renderRouter(APP_DIR, { initialUrl: '/messages' });
    expect(await screen.findByRole('button', { name: 'First Account store' })).toBeOnTheScreen();
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await renderRouter(APP_DIR, { initialUrl: '/messages' });
    await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), '+251911000002');
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), SIGN_IN_CODE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
    expect(await screen.findByRole('button', { name: 'Second Account store' })).toBeOnTheScreen();
    expect(screen.queryByText('First Account store')).toBeNull();
  });
});

describe('You', () => {
  it('Messages is reachable from You when signed in', async () => {
    signedIn();
    installChat();
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    const buttons = await screen.findAllByRole('button', { name: en['buyer.messages'] });
    await fireEvent.press(buttons[0]!);
    expect(await screen.findByText(en['buyer.messages.empty'])).toBeOnTheScreen();
  });
});

describe('Product-context messaging (WO-014)', () => {
  const ask = async () => fireEvent.press(await screen.findByRole('button', { name: en['buyer.chat.ask_about_product'] }));
  const context = () => within(screen.getByTestId('chat-product-context'));
  const productReads = (p: StorefrontProduct) => api.callsTo(`GET /v1/storefronts/${p.seller.handle}/products/${p.slug}`);
  const send = async (text: string) => {
    await fireEvent.changeText(composer(), text);
    await fireEvent.press(sendButton());
  };
  /** A signed-in Buyer on a Product's Ask Seller, then in its conversation with the context shown. */
  async function askFrom(product: StorefrontProduct, setup?: (chat: ReturnType<typeof installChat>) => void) {
    signedIn();
    const chat = installChat();
    chat.publish(product);
    setup?.(chat);
    await renderRouter(APP_DIR, { initialUrl: `/product/${product.seller.handle}/${product.slug}` });
    await ask();
    await screen.findByTestId('chat-product-context');
    return chat;
  }

  it('1, 2, 3. Ask Seller is on Product Detail; a guest is sent to sign in and nothing is created', async () => {
    installChat().publish(BASKET);
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/basket' });
    await ask();
    expect(await screen.findByText(en['auth.sign_in.intro'])).toBeOnTheScreen();
    expect(api.callsTo(`GET /v1/storefronts/${HANDLE}`)).toEqual([]);
    expect(api.callsTo('POST /v1/conversations')).toEqual([]);
    expect(sends()).toEqual([]);
  });

  it('4. a successful sign-in returns to the Product; nothing is opened or sent until the Buyer asks again', async () => {
    installChat().publish(BASKET);
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/basket' });
    await ask();
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), '+251911000001');
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), SIGN_IN_CODE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
    await waitFor(() => expect(screen).toHavePathname('/product/seller-1/basket'));
    expect(await screen.findByRole('button', { name: en['buyer.chat.ask_about_product'] })).toBeOnTheScreen();
    expect(api.callsTo('POST /v1/conversations')).toEqual([]);
    expect(sends()).toEqual([]);
  });

  it('5. a cancelled sign-in creates nothing', async () => {
    installChat().publish(BASKET);
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/basket' });
    await ask();
    await screen.findByLabelText(en['auth.phone.label']);
    await act(() => router.back());
    await waitFor(() => expect(screen).toHavePathname('/product/seller-1/basket'));
    expect(api.callsTo('POST /v1/conversations')).toEqual([]);
    expect(api.callsTo('GET /v1/conversations')).toEqual([]);
  });

  it('6, 8. the Seller is resolved by the public storefront read and the conversation opened by its seller_id', async () => {
    await askFrom(BASKET);
    const [resolve] = api.callsTo(`GET /v1/storefronts/${HANDLE}`);
    expect(resolve?.query.revalidate).toBe('true');
    const [open] = api.callsTo('POST /v1/conversations');
    expect(open?.body).toEqual({ seller_id: SELLER_ID });
    expect(open?.headers['Idempotency-Key']).toMatch(UUID7);
  });

  it.each([
    ['answers for another handle', storefront('seller-9')],
    ['names the handle as its id', storefront(HANDLE, { seller_id: HANDLE })],
  ])('7. a storefront read that %s is not used: nothing is opened', async (_, body) => {
    signedIn();
    installChat().publish(BASKET);
    api.on(`GET /v1/storefronts/${HANDLE}`, () => ({ status: 200, body }));
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/basket' });
    await ask();
    expect(await screen.findByText(en['buyer.chat.open_failed'])).toBeOnTheScreen();
    expect(api.callsTo('POST /v1/conversations')).toEqual([]);
  });

  it('9. two Products of one Seller go to one conversation, each message about its own Product', async () => {
    const chat = await askFrom(BASKET, (c) => c.publish(LAMP));
    await screen.findByText('Woven basket');
    await send('Is the basket handmade?');
    await screen.findByText('Is the basket handmade?');
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/lamp' });
    await ask();
    expect(await context().findByText('Clay lamp')).toBeOnTheScreen();
    await send('Will the lamp be back?');
    await screen.findByText('Will the lamp be back?');
    const own = chat.convs.filter((c) => c.owner === A);
    expect(own).toHaveLength(1);
    expect(own[0]!.messages.map((m) => m.product_id)).toEqual([LAMP.id, BASKET.id]);
  });

  it('10. Products of different Sellers do not share a conversation', async () => {
    const chat = await askFrom(BASKET, (c) => c.publish(VASE));
    api.on(`GET /v1/storefronts/${HANDLE_2}`, () => ({ status: 200, body: storefront(HANDLE_2, { seller_id: SELLER_2, store_name: 'Store 2' }) }));
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-2/vase' });
    await ask();
    expect(await context().findByText('Glass vase')).toBeOnTheScreen();
    const own = chat.convs.filter((c) => c.owner === A);
    expect(own.map((c) => c.seller_id).sort()).toEqual([SELLER_2, SELLER_ID].sort());
  });

  it('11, 13, 15, 16. the context shows the current read; the message carries product_id; the context clears and a follow-up has no anchor', async () => {
    await askFrom(LAMP);
    expect(await context().findByText('Clay lamp')).toBeOnTheScreen();
    expect(context().getByText(en['buyer.chat.context_title'])).toBeOnTheScreen();
    expect(context().getByText(en['buyer.product.unavailable'])).toBeOnTheScreen();
    expect(context().getByText(en['buyer.chat.context_note'])).toBeOnTheScreen();
    // No price, stock, discount or promise is drawn in the context.
    expect(context().queryByText(/ETB|in stock|discount|deliver/i)).toBeNull();
    await send('When will it be available?');
    expect(await screen.findByText('When will it be available?')).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.chat.about_product'])).toBeOnTheScreen();
    expect(screen.queryByTestId('chat-product-context')).toBeNull();
    await send('Thanks');
    await screen.findByText('Thanks');
    expect(sends().map((s) => s.body)).toEqual([{ text: 'When will it be available?', product_id: LAMP.id }, { text: 'Thanks' }]);
    // Product Detail's opening is the one view; every chat read is a technical re-read.
    expect(productReads(LAMP).slice(1).every((c) => c.query.revalidate === 'true')).toBe(true);
    expect(productReads(LAMP).length).toBeGreaterThanOrEqual(3);
  });

  it('12, 14. a removed context sends a message with no Product anchor', async () => {
    await askFrom(BASKET);
    await context().findByText('Woven basket');
    await fireEvent.press(context().getByRole('button', { name: en['buyer.chat.context_remove'] }));
    expect(screen.queryByTestId('chat-product-context')).toBeNull();
    await send('A general question');
    await screen.findByText('A general question');
    expect(sends()[0]?.body).toEqual({ text: 'A general question' });
  });

  it('17. the context stays with its conversation: opening it again, or another conversation, carries none', async () => {
    const chat = await askFrom(BASKET);
    await context().findByText('Woven basket');
    const [own] = chat.convs.filter((c) => c.owner === A);
    const other = chat.conv(A, SELLER_2, 'Store 2', HANDLE_2);
    await renderRouter(APP_DIR, { initialUrl: `/chat/${own!.id}` });
    await screen.findByText(en['buyer.chat.empty']);
    expect(screen.queryByTestId('chat-product-context')).toBeNull();
    await renderRouter(APP_DIR, { initialUrl: `/chat/${other.id}` });
    await screen.findByText(en['buyer.chat.empty']);
    expect(screen.queryByTestId('chat-product-context')).toBeNull();
  });

  it('18. a malformed Product reference is ignored; an unknown one shows the neutral unavailable state', async () => {
    signedIn();
    const chat = installChat();
    const c = chat.conv(A);
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}?productHandle=seller-1&productSlug=Bad%20Slug` });
    await screen.findByText(en['buyer.chat.empty']);
    expect(screen.queryByTestId('chat-product-context')).toBeNull();
    api.on('GET /v1/storefronts/seller-1/products/missing', () => problem(404, 'NOT_FOUND', 'request'));
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}?productHandle=seller-1&productSlug=missing` });
    await screen.findByTestId('chat-product-context');
    expect(await context().findByText(en['buyer.chat.context_gone'])).toBeOnTheScreen();
    await fireEvent.changeText(composer(), 'Hello');
    expect(sendButton()).toBeDisabled();
  });

  it('19. a Product of another Seller is never shown or attached; without it the message sends', async () => {
    signedIn();
    const chat = installChat();
    chat.publish(VASE);
    const c = chat.conv(A);
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}?productHandle=seller-2&productSlug=vase` });
    await screen.findByTestId('chat-product-context');
    expect(await context().findByText(en['buyer.chat.context_mismatch'])).toBeOnTheScreen();
    expect(screen.queryByText('Glass vase')).toBeNull();
    await fireEvent.changeText(composer(), 'Hello');
    expect(sendButton()).toBeDisabled();
    await fireEvent.press(context().getByRole('button', { name: en['buyer.chat.context_remove'] }));
    await fireEvent.press(sendButton());
    await screen.findByText('Hello');
    expect(sends().map((s) => s.body)).toEqual([{ text: 'Hello' }]);
  });

  it('20. a Product unpublished after it was shown: the send is refused before anything is sent, the name is gone, the draft stays', async () => {
    let shelf!: { unpublish: () => void };
    await askFrom(BASKET, (c) => (shelf = c.publish(BASKET)));
    await context().findByText('Woven basket');
    shelf.unpublish();
    await send('Still have it?');
    expect(await context().findByText(en['buyer.chat.context_gone'])).toBeOnTheScreen();
    expect(screen.queryByText('Woven basket')).toBeNull();
    expect(sends()).toEqual([]);
    expect(composer().props.value).toBe('Still have it?');
  });

  it('20, 28. a 404 at send time is not sent and says so neutrally; a current read decides whether the Product is gone (ON-168)', async () => {
    await askFrom(BASKET);
    await context().findByText('Woven basket');
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, () => problem(404, 'NOT_FOUND', 'request'));
    await send('Is it in stock?');
    expect(await screen.findByText(en['buyer.chat.not_found_anchored'])).toBeOnTheScreen();
    // The Product still reads as public: it is not called removed, and it stays attached.
    expect(context().getByText('Woven basket')).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.context_gone'])).toBeNull();
    expect(screen.queryByText(en['buyer.chat.sender.you'])).toBeNull();
    expect(composer().props.value).toBe('Is it in stock?');
  });

  it('21. a check that cannot reach the server sends nothing and is not called "removed"; checking again then sends', async () => {
    await askFrom(BASKET);
    await context().findByText('Woven basket');
    api.on('GET /v1/storefronts/seller-1/products/basket', () => 'offline');
    await send('Do you ship?');
    expect(await context().findByText(en['buyer.chat.context_unchecked'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.context_gone'])).toBeNull();
    expect(sends()).toEqual([]);
    api.on('GET /v1/storefronts/seller-1/products/basket', () => ({ status: 200, body: BASKET }));
    await fireEvent.press(context().getByRole('button', { name: en['common.retry'] }));
    await context().findByText('Woven basket');
    await fireEvent.press(sendButton());
    await screen.findByText('Do you ship?');
    expect(sends()[0]?.body).toEqual({ text: 'Do you ship?', product_id: BASKET.id });
  });

  it('22. a context read lost offline shows no Product details', async () => {
    signedIn();
    const chat = installChat();
    const c = chat.conv(A);
    api.on('GET /v1/storefronts/seller-1/products/basket', () => 'offline');
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}?productHandle=seller-1&productSlug=basket` });
    await screen.findByTestId('chat-product-context');
    expect(await context().findByText(en['buyer.chat.context_unchecked'], {}, { timeout: 10_000 })).toBeOnTheScreen();
    expect(screen.queryByText('Woven basket')).toBeNull();
    expect(screen.queryByText(en['buyer.product.available'])).toBeNull();
  });

  it('25. a second press while an anchored message is sending sends nothing', async () => {
    const { gate, release } = held();
    const chat = await askFrom(BASKET);
    await context().findByText('Woven basket');
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, async (call) => {
      await gate;
      const [own] = chat.convs.filter((c) => c.owner === A);
      const m = chat.msg(own!, { sender_kind: 'BUYER', body: String(call.body?.text), sent_at: new Date().toISOString(), product_id: BASKET.id });
      return { status: 201, body: { message_id: m.id, bot: null } };
    });
    await send('Once');
    expect(await screen.findByText(en['buyer.chat.sending'])).toBeOnTheScreen();
    await fireEvent.press(sendButton());
    expect(sends()).toHaveLength(1);
    await act(async () => release());
    expect(await screen.findByText('Once')).toBeOnTheScreen();
  });

  it('26, 29. an unconfirmed anchored send freezes its payload; the retry replays the same text, Product and key, and shows once', async () => {
    const chat = await askFrom(BASKET);
    await context().findByText('Woven basket');
    let first = true;
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, (call) => {
      const [own] = chat.convs.filter((c) => c.owner === A);
      // The first attempt is stored but its answer is lost; the replay returns the same message.
      const stored = own!.messages.find((m) => m.body === call.body?.text);
      const m = stored ?? chat.msg(own!, { sender_kind: 'BUYER', body: String(call.body?.text), sent_at: new Date().toISOString(), product_id: BASKET.id });
      if (first) {
        first = false;
        return 'offline';
      }
      return { status: 201, body: { message_id: m.id, bot: null } };
    });
    await send('Is it lined?');
    expect(await screen.findByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    expect(composer().props.editable).toBe(false);
    expect(context().getByRole('button', { name: en['buyer.chat.context_remove'] })).toBeDisabled();
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [a, b] = sends();
    expect(b?.headers['Idempotency-Key']).toBe(a?.headers['Idempotency-Key']);
    expect(b?.body).toEqual(a?.body);
    expect(a?.body).toEqual({ text: 'Is it lined?', product_id: BASKET.id });
    await waitFor(() => expect(screen.getAllByText('Is it lined?')).toHaveLength(1));
  });

  it('27. giving up an unconfirmed send and changing the Product is a new intent with a new key', async () => {
    await askFrom(BASKET);
    await context().findByText('Woven basket');
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, () => 'offline');
    await send('Lined?');
    await screen.findByText(en['buyer.chat.maybe_not_sent']);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.edit_unconfirmed'] }));
    expect(composer().props.editable).toBe(true);
    await fireEvent.press(context().getByRole('button', { name: en['buyer.chat.context_remove'] }));
    await fireEvent.press(sendButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [a, b] = sends();
    expect(a?.body).toEqual({ text: 'Lined?', product_id: BASKET.id });
    expect(b?.body).toEqual({ text: 'Lined?' });
    expect(b?.headers['Idempotency-Key']).not.toBe(a?.headers['Idempotency-Key']);
  });

  it('30. signing out while the Product is being checked sends nothing', async () => {
    const { gate, release } = held();
    await askFrom(BASKET);
    await context().findByText('Woven basket');
    api.on('GET /v1/storefronts/seller-1/products/basket', async () => {
      await gate;
      return { status: 200, body: BASKET };
    });
    await send('Pending question');
    // The same app (one session provider): a second renderRouter would be a second app.
    await act(() => router.push('/account'));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    await act(async () => release());
    expect(sends()).toEqual([]);
  });

  it('review M-1. a later page of the list that fails is not fetched again until Try again', async () => {
    signedIn();
    const chat = installChat();
    chat.publish(BASKET);
    // 25 newer conversations put this one on the second page.
    const target = chat.conv(A, SELLER_ID, 'Store 1', HANDLE, ago(10_000));
    for (let i = 0; i < 25; i++) chat.conv(A, SELLER_2, `Other ${i}`, `other-${i}`, ago(100 + i));
    chat.faults.laterPages = true;
    await renderRouter(APP_DIR, { initialUrl: `/chat/${target.id}?productHandle=seller-1&productSlug=basket` });
    await screen.findByTestId('chat-product-context');
    expect(await context().findByText(en['buyer.chat.context_unchecked'])).toBeOnTheScreen();
    const pages = api.callsTo('GET /v1/conversations').length;
    // Time passes (renderRouter runs on fake timers): a loop would have fetched again by now.
    await act(() => jest.advanceTimersByTimeAsync(5000));
    expect(api.callsTo('GET /v1/conversations')).toHaveLength(pages);
    expect(screen.queryByText('Woven basket')).toBeNull();
    chat.faults.laterPages = false;
    await fireEvent.press(context().getByRole('button', { name: en['common.retry'] }));
    expect(await context().findByText('Woven basket')).toBeOnTheScreen();
  });

  it('review L-2. an unconfirmed send whose Product now reads as another id sends nothing new', async () => {
    const chat = await askFrom(BASKET);
    await context().findByText('Woven basket');
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, () => 'offline');
    await send('Same basket?');
    await screen.findByText(en['buyer.chat.maybe_not_sent']);
    // The slug now names a re-created Product with a new id.
    const recreated = { ...BASKET, id: '0b6f1a3e-6666-4666-8666-666666666666' };
    chat.publish(recreated);
    await fireEvent.press(retryButton());
    expect(await context().findByText(en['buyer.chat.context_mismatch'])).toBeOnTheScreen();
    expect(sends()).toHaveLength(1);
    expect(screen.getByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    expect(composer().props.editable).toBe(false);
  });

  it('review L-3. entering the open conversation again with another Product replaces the context', async () => {
    const chat = await askFrom(BASKET, (c) => c.publish(LAMP));
    await context().findByText('Woven basket');
    const [own] = chat.convs.filter((c) => c.owner === A);
    await act(() => router.push({ pathname: '/chat/[conversationRef]', params: { conversationRef: own!.id, productHandle: 'seller-1', productSlug: 'lamp' } }));
    expect(await context().findByText('Clay lamp')).toBeOnTheScreen();
    expect(screen.queryByText('Woven basket')).toBeNull();
  });
});

describe('In-conversation Product selector (WO-015)', () => {
  const select = () => screen.getByRole('button', { name: en['buyer.chat.select_product'] });
  const change = () => screen.getByRole('button', { name: en['buyer.chat.change_product'] });
  const context = () => within(screen.getByTestId('chat-product-context'));
  const picker = () => screen.queryByTestId('chat-product-picker');
  const item = (p: StorefrontProduct, availability: string = en['buyer.product.available']) =>
    screen.findByRole('button', { name: `${p.name}, ${availability}` });
  const listCalls = (h = HANDLE) => api.callsTo(`GET /v1/storefronts/${h}/products`);
  const send = async (text: string) => {
    await fireEvent.changeText(composer(), text);
    await fireEvent.press(sendButton());
  };
  /** A signed-in Buyer in its conversation with seller-1 (opened from Messages: no context). */
  async function inConversation(setup?: (chat: ReturnType<typeof installChat>, c: Conv) => void, url?: (c: Conv) => string) {
    signedIn();
    const chat = installChat();
    const c = chat.conv(A);
    setup?.(chat, c);
    await renderRouter(APP_DIR, { initialUrl: url ? url(c) : `/chat/${c.id}` });
    await screen.findByText(en['buyer.chat.empty']);
    await waitFor(() => expect(screen.getByRole('button', { name: new RegExp(`^(${en['buyer.chat.select_product']}|${en['buyer.chat.change_product']})$`) })).toBeEnabled());
    return { chat, c };
  }
  const openPicker = async () => {
    await fireEvent.press(select());
    expect(await screen.findByText(en['buyer.chat.picker_title'])).toBeOnTheScreen();
  };

  it('1, 2, 3. Select Product opens the picker on this conversation Seller\'s Products; Cancel closes it with nothing attached', async () => {
    await inConversation((chat) => {
      chat.publish(BASKET);
      chat.publish(LAMP);
      chat.publish(VASE);
    });
    await openPicker();
    expect(screen.getByText('Products from Store 1')).toBeOnTheScreen();
    expect(await item(BASKET)).toBeOnTheScreen();
    expect(await item(LAMP, en['buyer.product.unavailable'])).toBeOnTheScreen();
    expect(screen.queryByText('Glass vase')).toBeNull();
    expect(listCalls()).toHaveLength(1);
    expect(listCalls(HANDLE_2)).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.picker_cancel'] }));
    await waitFor(() => expect(picker()).toBeNull());
    expect(screen.queryByTestId('chat-product-context')).toBeNull();
    expect(sends()).toEqual([]);
  });

  it('3. the list follows the conversation (the authenticated list), never a route parameter', async () => {
    await inConversation(
      (chat) => {
        chat.publish(BASKET);
        chat.publish(VASE);
      },
      (c) => `/chat/${c.id}?productHandle=seller-2&productSlug=vase`,
    );
    await fireEvent.press(context().getByRole('button', { name: en['buyer.chat.context_remove'] }));
    await openPicker();
    expect(await item(BASKET)).toBeOnTheScreen();
    expect(listCalls(HANDLE_2)).toEqual([]);
  });

  it('4, 5. the picker says it is loading, then that the Seller has no Products', async () => {
    const { gate, release } = held();
    await inConversation();
    api.on(`GET /v1/storefronts/${HANDLE}/products`, async () => {
      await gate;
      return { status: 200, body: { data: [], next_cursor: null } };
    });
    await openPicker();
    expect(await screen.findByText(en['buyer.chat.picker_loading'])).toBeOnTheScreen();
    await act(async () => release());
    expect(await screen.findByText(en['buyer.chat.picker_empty'])).toBeOnTheScreen();
  });

  it('6. the picker pages: the next page is read with the server\'s cursor, never everything at once', async () => {
    await inConversation((chat) => {
      for (let i = 1; i <= 35; i++) {
        chat.publish(storefrontProduct(`item-${i}`, `Item ${i}`, { id: `0b6f1a3e-7777-4777-8777-${hex(i)}` }));
      }
    });
    await openPicker();
    await screen.findByRole('button', { name: `Item 1, ${en['buyer.product.available']}` });
    expect(listCalls()).toHaveLength(1);
    expect(listCalls()[0]?.query.limit).toBe('30');
    await act(() => (screen.getByTestId('chat-product-picker').props as { onEndReached: () => void }).onEndReached());
    await waitFor(() => expect(listCalls()).toHaveLength(2));
    expect(listCalls()[1]?.query.cursor).toBe('30');
  });

  it('7, 8. a list lost offline says so, and Try again reads it', async () => {
    await inConversation((chat) => chat.publish(BASKET));
    let offline = true;
    const real = () => ({ status: 200, body: { data: [{ ...BASKET, display_order: 0, image_key: null }], next_cursor: null } });
    api.on(`GET /v1/storefronts/${HANDLE}/products`, () => (offline ? 'offline' : real()));
    await openPicker();
    await act(() => jest.advanceTimersByTimeAsync(10_000));
    expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
    offline = false;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await item(BASKET)).toBeOnTheScreen();
  });

  it('9, 12, 16, 17, 18. a chosen Product is attached (read and re-read), sent with the next message in the same conversation, then cleared', async () => {
    const { c } = await inConversation((chat) => chat.publish(BASKET));
    await fireEvent.changeText(composer(), 'Does it come in black?');
    await openPicker();
    await fireEvent.press(await item(BASKET));
    await waitFor(() => expect(picker()).toBeNull());
    expect(await context().findByText('Woven basket')).toBeOnTheScreen();
    // Nothing is sent by choosing, and the text stays as written.
    expect(sends()).toEqual([]);
    expect(composer().props.value).toBe('Does it come in black?');
    await fireEvent.press(sendButton());
    await screen.findByText(en['buyer.chat.about_product']);
    await send('And in white?');
    await screen.findByText('And in white?');
    expect(sends().map((x) => x.body)).toEqual([{ text: 'Does it come in black?', product_id: BASKET.id }, { text: 'And in white?' }]);
    expect(sends().every((x) => x.path === `/v1/conversations/${c.id}/messages`)).toBe(true);
    expect(api.callsTo('POST /v1/conversations')).toEqual([]);
    const reads = api.callsTo('GET /v1/storefronts/seller-1/products/basket');
    expect(reads.length).toBeGreaterThanOrEqual(2);
    expect(reads.every((r) => r.query.revalidate === 'true')).toBe(true);
  });

  it('10, 11. another Product replaces the first; Remove Product takes it away', async () => {
    await inConversation((chat) => {
      chat.publish(BASKET);
      chat.publish(LAMP);
    });
    await openPicker();
    await fireEvent.press(await item(BASKET));
    await context().findByText('Woven basket');
    await fireEvent.press(change());
    await fireEvent.press(await item(LAMP, en['buyer.product.unavailable']));
    expect(await context().findByText('Clay lamp')).toBeOnTheScreen();
    expect(screen.queryByText('Woven basket')).toBeNull();
    await fireEvent.press(context().getByRole('button', { name: en['buyer.chat.context_remove'] }));
    expect(screen.queryByTestId('chat-product-context')).toBeNull();
    expect(select()).toBeOnTheScreen();
    await send('Plain question');
    await screen.findByText('Plain question');
    expect(sends()[0]?.body).toEqual({ text: 'Plain question' });
  });

  it('13. a chosen Product unpublished before Send is refused and nothing is sent', async () => {
    let shelf!: { unpublish: () => void };
    await inConversation((chat) => (shelf = chat.publish(BASKET)));
    await openPicker();
    await fireEvent.press(await item(BASKET));
    await context().findByText('Woven basket');
    shelf.unpublish();
    await send('Still there?');
    expect(await context().findByText(en['buyer.chat.context_gone'])).toBeOnTheScreen();
    expect(sends()).toEqual([]);
  });

  it('14. a listed Product that reads as another Seller\'s is never shown or attached', async () => {
    await inConversation((chat) => chat.publish(BASKET));
    // An inconsistent list: it offers the vase, whose own read names seller-2.
    api.on(`GET /v1/storefronts/${HANDLE}/products`, () => ({
      status: 200,
      body: { data: [{ ...VASE, display_order: 0, image_key: null }], next_cursor: null },
    }));
    api.on('GET /v1/storefronts/seller-1/products/vase', () => ({ status: 200, body: VASE }));
    await openPicker();
    await fireEvent.press(await item(VASE));
    expect(await context().findByText(en['buyer.chat.context_mismatch'])).toBeOnTheScreen();
    expect(screen.queryByText('Glass vase')).toBeNull();
    await fireEvent.changeText(composer(), 'Hello');
    expect(sendButton()).toBeDisabled();
  });

  it('15. a listed Product that has left the Market shows the neutral unavailable state', async () => {
    await inConversation((chat) => {
      chat.publish(BASKET);
    });
    api.on('GET /v1/storefronts/seller-1/products/basket', () => problem(404, 'NOT_FOUND', 'request'));
    await openPicker();
    await fireEvent.press(await item(BASKET));
    expect(await context().findByText(en['buyer.chat.context_gone'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.product.available'])).toBeNull();
  });

  it('19. while a send is unconfirmed, the Product cannot be changed; giving it up allows a new one', async () => {
    await inConversation((chat) => {
      chat.publish(BASKET);
      chat.publish(LAMP);
    });
    await openPicker();
    await fireEvent.press(await item(BASKET));
    await context().findByText('Woven basket');
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, () => 'offline');
    await send('Lined?');
    await screen.findByText(en['buyer.chat.maybe_not_sent']);
    expect(change()).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.edit_unconfirmed'] }));
    expect(change()).toBeEnabled();
  });

  it('20, 21. signing out with the picker open closes it, drops the chosen Product, and the next Account sees none of it', async () => {
    const { gate, release } = held();
    const { c } = await inConversation((chat) => chat.publish(BASKET));
    await openPicker();
    await fireEvent.press(await item(BASKET));
    await context().findByText('Woven basket');
    api.on(`GET /v1/storefronts/${HANDLE}/products`, async () => {
      await gate;
      return { status: 200, body: { data: [], next_cursor: null } };
    });
    await fireEvent.press(change());
    await act(() => router.push('/account'));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    await act(async () => release());
    expect(picker()).toBeNull();
    // The second Account's session is valid (the default fake knows only the first credential).
    api.on('GET /v1/bootstrap', (call) =>
      call.headers.Authorization ? { status: 200, body: bootstrapBody({ account_context: SIGNED_IN_CONTEXT }) } : { status: 200, body: bootstrapBody() },
    );
    signedIn(OTHER_TOKEN);
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}` });
    expect(await screen.findByText(en['buyer.chat.unavailable'])).toBeOnTheScreen();
    expect(screen.queryByTestId('chat-product-context')).toBeNull();
    expect(screen.queryByText('Woven basket')).toBeNull();
  });

  it('22. a guest never reaches the picker or a Seller list', async () => {
    const chat = installChat();
    const c = chat.conv(A);
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}` });
    expect(await screen.findByText(en['buyer.messages.signed_out'])).toBeOnTheScreen();
    expect(listCalls()).toEqual([]);
  });

  it('a conversation beyond the first pages of the list: Product selection is off and says why; plain messages still send', async () => {
    signedIn();
    const chat = installChat();
    const target = chat.conv(A, SELLER_ID, 'Store 1', HANDLE, ago(100_000));
    for (let i = 0; i < 100; i++) chat.conv(A, SELLER_2, `Other ${i}`, `other-${i}`, ago(100 + i));
    await renderRouter(APP_DIR, { initialUrl: `/chat/${target.id}` });
    expect(await screen.findByText(en['buyer.chat.select_unavailable'])).toBeOnTheScreen();
    expect(select()).toBeDisabled();
    // Bounded: four pages of 25, never a walk through every page.
    expect(api.callsTo('GET /v1/conversations')).toHaveLength(4);
    await send('Plain still works');
    await screen.findByText('Plain still works');
    expect(sends()[0]?.body).toEqual({ text: 'Plain still works' });
  });

  it('a conversation list that fails: selection is off, and Try again reads the list again', async () => {
    signedIn();
    const chat = installChat();
    const c = chat.conv(A);
    let fail = true;
    api.on('GET /v1/conversations', () => (fail ? problem(500, 'INTERNAL', 'server') : { status: 200, body: { data: [{ id: c.id, seller_id: SELLER_ID, store_name: 'Store 1', handle: HANDLE, started_at: c.last_message_at, last_message_at: c.last_message_at }], next_cursor: null } }));
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}` });
    expect(await screen.findByText(en['buyer.chat.select_unavailable'])).toBeOnTheScreen();
    expect(select()).toBeDisabled();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    await waitFor(() => expect(select()).toBeEnabled());
  });

  it('review I-3. a listed Product with a malformed slug is never attached', async () => {
    await inConversation();
    api.on(`GET /v1/storefronts/${HANDLE}/products`, () => ({
      status: 200,
      body: { data: [{ ...BASKET, slug: 'Bad Slug', display_order: 0, image_key: null }], next_cursor: null },
    }));
    await openPicker();
    await fireEvent.press(await item(BASKET));
    await waitFor(() => expect(picker()).toBeNull());
    expect(screen.queryByTestId('chat-product-context')).toBeNull();
    expect(api.calls.filter((c) => c.path.includes('/products/Bad'))).toEqual([]);
  });

  it('review I-2. a malformed or unavailable conversation does not walk the list', async () => {
    signedIn();
    const chat = installChat();
    for (let i = 0; i < 30; i++) chat.conv(A, SELLER_2, `Other ${i}`, `other-${i}`, ago(100 + i));
    await renderRouter(APP_DIR, { initialUrl: '/chat/not-a-conversation' });
    expect(await screen.findByText(en['buyer.chat.unavailable'])).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(2000));
    expect(api.callsTo('GET /v1/conversations').length).toBeLessThanOrEqual(1);
  });
});

describe('Messaging UX and reliability (WO-016)', () => {
  const context = () => within(screen.getByTestId('chat-product-context'));
  const send = async (text: string) => {
    await fireEvent.changeText(composer(), text);
    await fireEvent.press(sendButton());
  };
  async function inConversation(setup?: (chat: ReturnType<typeof installChat>, c: Conv) => void, url?: (c: Conv) => string) {
    signedIn();
    const chat = installChat();
    const c = chat.conv(A);
    setup?.(chat, c);
    await renderRouter(APP_DIR, { initialUrl: url ? url(c) : `/chat/${c.id}` });
    await screen.findByText(en['buyer.chat.empty']);
    return { chat, c };
  }

  it('ON-164. the composer scrolls inside its own area; Send stays outside it, always reachable', async () => {
    await inConversation((chat) => chat.publish(BASKET), (c) => `/chat/${c.id}?productHandle=seller-1&productSlug=basket`);
    await context().findByText('Woven basket');
    const composerArea = within(screen.getByTestId('chat-composer'));
    expect(composerArea.getByTestId('chat-product-context')).toBeOnTheScreen();
    expect(composerArea.getByLabelText(en['buyer.chat.composer'])).toBeOnTheScreen();
    expect(composerArea.queryByRole('button', { name: en['buyer.chat.send'] })).toBeNull();
    expect(sendButton()).toBeOnTheScreen();
  });

  it('ON-168. a 404 on an anchored send, then a current read that answers 404: only then is the Product called gone', async () => {
    let shelf!: { unpublish: () => void };
    await inConversation((chat) => (shelf = chat.publish(BASKET)), (c) => `/chat/${c.id}?productHandle=seller-1&productSlug=basket`);
    await context().findByText('Woven basket');
    // The server refuses at send time (the check passed a moment before), then the Product is gone.
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, () => {
      shelf.unpublish();
      return problem(404, 'NOT_FOUND', 'request');
    });
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      await send('Still for sale?');
      expect(await screen.findByText(en['buyer.chat.not_found_anchored'])).toBeOnTheScreen();
      expect(await context().findByText(en['buyer.chat.context_gone'])).toBeOnTheScreen();
      expect(composer().props.value).toBe('Still for sale?');
      // Review L1: a screen reader hears what the screen shows.
      expect(announce).toHaveBeenCalledWith(en['buyer.chat.not_found_anchored']);
      expect(announce).not.toHaveBeenCalledWith(en['buyer.chat.not_found_plain']);
    } finally {
      announce.mockRestore();
    }
  });

  it('ON-168. a 404 on a plain send names no cause; a messages read that answers 404 then shows the conversation as not available', async () => {
    const { c } = await inConversation();
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, () => problem(404, 'NOT_FOUND', 'request'));
    await send('Hello?');
    expect(await screen.findByText(en['buyer.chat.not_found_plain'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.not_sent'])).toBeNull();
    // The conversation really is gone for this Buyer: a current read says so.
    api.onPattern('GET', /^\/v1\/conversations\/[^/]+\/messages$/, () => problem(404, 'NOT_FOUND', 'request'));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.refresh'] }));
    expect(await screen.findByText(en['buyer.chat.unavailable'])).toBeOnTheScreen();
    expect(sends().every((x) => x.path === `/v1/conversations/${c.id}/messages`)).toBe(true);
  });

  it('18. an unconfirmed send says it may already have been received, offers Try sending again and Edit the message instead, and is never "not sent"', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      await inConversation();
      api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, () => 'offline');
      await send('Are you open?');
      expect(await screen.findByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
      expect(screen.queryByText(en['buyer.chat.not_sent'])).toBeNull();
      expect(retryButton()).toBeEnabled();
      expect(screen.getByRole('button', { name: en['buyer.chat.edit_unconfirmed'] })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: en['buyer.chat.send'] })).toBeNull();
      expect(announce).toHaveBeenCalledWith(en['buyer.chat.maybe_not_sent']);
      await fireEvent.press(retryButton());
      await waitFor(() => expect(sends()).toHaveLength(2));
      expect(sends()[1]?.headers['Idempotency-Key']).toBe(sends()[0]?.headers['Idempotency-Key']);
      expect(sends()[1]?.body).toEqual(sends()[0]?.body);
    } finally {
      announce.mockRestore();
    }
  });

  it('20.7. a send that times out is unconfirmed (not failed), and keeps its key', async () => {
    await inConversation();
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, () => 'hang');
    await send('Slow network');
    await act(() => jest.advanceTimersByTimeAsync(11_000));
    expect(await screen.findByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.not_sent'])).toBeNull();
    expect(composer().props.editable).toBe(false);
  });

  it('20.1. signing out while a message is sending: the late answer changes nothing and the next Account sees nothing', async () => {
    const { gate, release } = held();
    const { chat, c } = await inConversation();
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, async (call) => {
      await gate;
      const m = chat.msg(c, { sender_kind: 'BUYER', body: String(call.body?.text), sent_at: new Date().toISOString() });
      return { status: 201, body: { message_id: m.id, bot: null } };
    });
    await send('In flight');
    await act(() => router.push('/account'));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    await act(async () => release());
    expect(sends()).toHaveLength(1);
    api.on('GET /v1/bootstrap', (call) =>
      call.headers.Authorization ? { status: 200, body: bootstrapBody({ account_context: SIGNED_IN_CONTEXT }) } : { status: 200, body: bootstrapBody() },
    );
    signedIn(OTHER_TOKEN);
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}` });
    expect(await screen.findByText(en['buyer.chat.unavailable'])).toBeOnTheScreen();
    expect(screen.queryByText('In flight')).toBeNull();
  });

  it('20.3, 20.5. a slow Seller list cancelled, and an unavailable one, attach nothing', async () => {
    const { gate, release } = held();
    await inConversation((chat) => chat.publish(BASKET));
    api.on(`GET /v1/storefronts/${HANDLE}/products`, async () => {
      await gate;
      return { status: 200, body: { data: [{ ...BASKET, display_order: 0, image_key: null }], next_cursor: null } };
    });
    await waitFor(() => expect(screen.getByRole('button', { name: en['buyer.chat.select_product'] })).toBeEnabled());
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.select_product'] }));
    await screen.findByText(en['buyer.chat.picker_loading']);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.picker_cancel'] }));
    await act(async () => release());
    expect(screen.queryByTestId('chat-product-picker')).toBeNull();
    expect(screen.queryByTestId('chat-product-context')).toBeNull();
    // The cancelled list is dropped on the next tick (gcTime 0); fake timers need the tick.
    await act(() => jest.advanceTimersByTimeAsync(10));
    api.on(`GET /v1/storefronts/${HANDLE}/products`, () => problem(404, 'NOT_FOUND', 'request'));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.select_product'] }));
    expect(await screen.findByRole('button', { name: en['common.retry'] })).toBeOnTheScreen();
    expect(screen.queryByTestId('chat-picker-item')).toBeNull();
  });
});
