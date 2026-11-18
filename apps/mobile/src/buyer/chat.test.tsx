import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { KEY_SAFE_MS } from '../api/mutation';
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
  type Reply,
} from '../testing/fake-api';
import type { StorefrontProduct } from '../api/client';
import { TOKEN_KEY, memory, resetSecureStore } from '../testing/secure-store-mock';

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

  it('a lost answer when opening a conversation: tapping again uses the same key and ends in the one conversation, never a second thread', async () => {
    signedIn();
    const chat = installChat();
    let lost = true;
    api.on('POST /v1/conversations', (call) => {
      const found = chat.convs.find((c) => c.owner === call.headers.Authorization && c.seller_id === call.body?.seller_id) ?? chat.conv(call.headers.Authorization!);
      if (lost) {
        lost = false;
        return 'offline';
      }
      return { status: 201, body: { conversation_id: found.id } };
    });
    await renderRouter(APP_DIR, { initialUrl: `/sellers/${HANDLE}` });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.chat.message_seller'] }));
    expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.message_seller'] }));
    expect(await screen.findByText(en['buyer.chat.empty'])).toBeOnTheScreen();
    const opens = api.callsTo('POST /v1/conversations');
    expect(opens).toHaveLength(2);
    expect(opens[1]?.headers['Idempotency-Key']).toBe(opens[0]?.headers['Idempotency-Key']);
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

describe('Buyer frontend stabilization (WO-017)', () => {
  it('A-001. a conversation list that fails is announced, not only drawn', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      signedIn();
      installChat();
      api.on('GET /v1/conversations', () => problem(500, 'INTERNAL', 'server'));
      await renderRouter(APP_DIR, { initialUrl: '/messages' });
      expect(await screen.findByText(en['buyer.messages.failed'])).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith(en['buyer.messages.failed']);
    } finally {
      announce.mockRestore();
    }
  });

  it('A-002. a private list waiting for a connection says offline, never an endless Loading', async () => {
    signedIn();
    installChat();
    try {
      // The app starts online; the connection drops; then the Buyer opens Messages.
      await renderRouter(APP_DIR, { initialUrl: '/account' });
      await screen.findByRole('button', { name: en['common.signOut'] });
      await act(async () => onlineManager.setOnline(false));
      await act(() => router.push('/messages'));
      expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
      expect(screen.queryByText(en['common.loading'])).toBeNull();
    } finally {
      await act(async () => onlineManager.setOnline(true));
    }
  });
});

/**
 * WO-022 Workstream A: the Buyer's uncertain sends (review S21-03 on the Buyer side). Only the API's
 * own problem answer proves a message was not stored; anything else that is not an accepted message
 * leaves the outcome unknown and keeps the whole intent (text, Product, conversation, key). The
 * numbers are the work order's section 21 matrix.
 */
describe('Uncertain-send reliability (WO-022)', () => {
  const context = () => within(screen.getByTestId('chat-product-context'));
  const maybe = () => screen.findByText(en['buyer.chat.maybe_not_sent']);
  const send = async (text: string) => {
    await fireEvent.changeText(composer(), text);
    await fireEvent.press(sendButton());
  };
  /**
   * The API storing each key once (the first attempt reaches the database) while the first answers
   * are lost on the way back (`lost`, in order); later attempts get the stored message.
   */
  /** The API's own problem answer (its envelope carries request_id): a refusal, which stores nothing. */
  const refuses = (r: Reply | undefined) => typeof r === 'object' && typeof (r.body as { request_id?: unknown } | undefined)?.request_id === 'string';
  function storing(chat: ReturnType<typeof installChat>, lost: Reply[]) {
    const stored = new Map<string, string>();
    let attempt = 0;
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, (call) => {
      const c = chat.convs.find((x) => call.path.startsWith(`/v1/conversations/${x.id}/`));
      if (!c) return problem(404, 'NOT_FOUND', 'request');
      const key = call.headers['Idempotency-Key']!;
      const reply = lost[attempt++];
      if (!refuses(reply) && !stored.has(key)) {
        const productId = (call.body?.product_id as string | undefined) ?? null;
        stored.set(key, chat.msg(c, { sender_kind: 'BUYER', body: String(call.body?.text), sent_at: new Date().toISOString(), product_id: productId }).id);
      }
      return reply ?? { status: 201, body: { message_id: stored.get(key), bot: null } };
    });
  }
  async function open() {
    signedIn();
    const chat = installChat();
    const c = chat.conv(A);
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}` });
    await screen.findByText(en['buyer.chat.empty']);
    return { chat, c };
  }
  async function askFrom(product: StorefrontProduct) {
    signedIn();
    const chat = installChat();
    const listing = chat.publish(product);
    await renderRouter(APP_DIR, { initialUrl: `/product/${product.seller.handle}/${product.slug}` });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.chat.ask_about_product'] }));
    await context().findByText(product.name);
    return { chat, listing };
  }

  it('1, 2, 27. an accepted message (a server message id) is shown once, only after acceptance', async () => {
    const { chat } = await open();
    storing(chat, []);
    await send('Hello');
    expect(await screen.findByText('Hello')).toBeOnTheScreen();
    expect(composer().props.value).toBe('');
    expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull();
    expect(sends()).toHaveLength(1);
  });

  it.each([
    ['502 with an HTML page', { status: 502, unreadable: true } as Reply],
    ['503 with an empty body', { status: 503 } as Reply],
    ['504 with JSON that is not the API problem', { status: 504, body: { message: 'Gateway Timeout' } } as Reply],
    // Review S22-01: a code alone (an intermediary's JSON) is not the API's problem envelope.
    ['502 with JSON carrying only a code', { status: 502, body: { code: 'BAD_GATEWAY' } } as Reply],
  ])('5-7, 11, 12, 14, 15, 30. a gateway %s is "may already have been received"; the retry replays text, conversation, Account and key; shown once', async (_name, reply) => {
    const { chat } = await open();
    storing(chat, [reply]);
    await send('Do you ship to Adama?');
    expect(await maybe()).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.not_sent'])).toBeNull();
    expect(composer().props.editable).toBe(false);
    // 30: the conversation is read again after the uncertain answer (the message may be there).
    const post = api.calls.findIndex((x) => x.method === 'POST' && /\/messages$/.test(x.path));
    await waitFor(() => expect(api.calls.slice(post + 1).some((x) => x.method === 'GET' && /\/messages$/.test(x.path))).toBe(true));
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [a, b] = sends();
    expect(b!.headers['Idempotency-Key']).toBe(a!.headers['Idempotency-Key']);
    expect(a!.headers['Idempotency-Key']).toMatch(UUID7);
    expect(b!.body).toEqual({ text: 'Do you ship to Adama?' });
    expect(b!.body).toEqual(a!.body);
    expect(b!.path).toBe(a!.path);
    expect(b!.headers.Authorization).toBe(a!.headers.Authorization);
    await waitFor(() => expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull());
    expect(screen.getAllByText('Do you ship to Adama?')).toHaveLength(1);
  });

  it.each([
    ['unreadable JSON', { status: 201, unreadable: true } as Reply],
    ['no message id', { status: 201, body: { bot: null } } as Reply],
  ])('8, 9, 27, 28. an acceptance with %s is neither sent nor failed: unknown, nothing is sent again by itself, the retry keeps the key', async (_name, reply) => {
    const { chat } = await open();
    storing(chat, [reply]);
    await send('Is it handmade?');
    expect(await maybe()).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.not_sent'])).toBeNull();
    // 28: no queue and no background retry, however long the screen stays open.
    await act(() => jest.advanceTimersByTimeAsync(120_000));
    expect(sends()).toHaveLength(1);
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [a, b] = sends();
    expect(b!.headers['Idempotency-Key']).toBe(a!.headers['Idempotency-Key']);
    await waitFor(() => expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull());
    expect(screen.getAllByText('Is it handmade?')).toHaveLength(1);
  });

  // Changed: a 5xx with the API's own problem body used to be "not sent" with a new key. It proves
  // nothing (a connection lost at the commit answers 503 after the message was stored), so it is unknown.
  it('10. the API\'s own 5xx problem is unknown, not "not sent": the draft and key are kept and the replay is the same message', async () => {
    const { chat, c } = await open();
    storing(chat, [problem(500, 'INTERNAL', 'request')]);
    await send('Open on Sunday?');
    expect(await maybe()).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.not_sent'])).toBeNull();
    // The conversation is read again before anything else is sent.
    const post = api.calls.findIndex((x) => x.method === 'POST' && /\/messages$/.test(x.path));
    await waitFor(() => expect(api.calls.slice(post + 1).some((x) => x.method === 'GET' && /\/messages$/.test(x.path))).toBe(true));
    expect(composer().props.value).toBe('Open on Sunday?');
    expect(composer().props.editable).toBe(false);
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [a, b] = sends();
    expect(b!.headers['Idempotency-Key']).toBe(a!.headers['Idempotency-Key']);
    await waitFor(() => expect(c.messages.filter((m) => m.body === 'Open on Sunday?')).toHaveLength(1));
  });

  it('17, 18. after a gateway loss, "Edit the message instead" gives the intent up; the edited text is a new key', async () => {
    const { chat } = await open();
    storing(chat, [{ status: 504, unreadable: true }]);
    await send('First words');
    await maybe();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.edit_unconfirmed'] }));
    expect(composer().props.editable).toBe(true);
    await send('Second words');
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [a, b] = sends();
    expect(b!.headers['Idempotency-Key']).not.toBe(a!.headers['Idempotency-Key']);
    expect(b!.body).toEqual({ text: 'Second words' });
  });

  it('13, 19, 20. an anchored send lost at a gateway: the Product cannot be changed or removed; the retry carries the same Product, text and key', async () => {
    const { chat } = await askFrom(BASKET);
    chat.publish(LAMP);
    storing(chat, [{ status: 502, unreadable: true }]);
    await send('Is it lined?');
    expect(await maybe()).toBeOnTheScreen();
    expect(context().getByRole('button', { name: en['buyer.chat.context_remove'] })).toBeDisabled();
    expect(screen.getByRole('button', { name: en['buyer.chat.change_product'] })).toBeDisabled();
    // Entering again with another Product (a link) does not replace a frozen payload's Product.
    await act(() => router.setParams({ productHandle: 'seller-1', productSlug: 'lamp' }));
    await act(() => jest.advanceTimersByTimeAsync(500));
    expect(context().getByText('Woven basket')).toBeOnTheScreen();
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [a, b] = sends();
    expect(a!.body).toEqual({ text: 'Is it lined?', product_id: BASKET.id });
    expect(b!.body).toEqual(a!.body);
    expect(b!.headers['Idempotency-Key']).toBe(a!.headers['Idempotency-Key']);
  });

  it('21. a Product unpublished between the attempt and its retry: nothing is sent, the outcome stays unknown, the anchor is not dropped', async () => {
    const { chat, listing } = await askFrom(BASKET);
    storing(chat, [{ status: 503 }]);
    await send('Still available?');
    await maybe();
    listing.unpublish();
    await fireEvent.press(retryButton());
    expect(await context().findByText(en['buyer.chat.context_gone'])).toBeOnTheScreen();
    expect(sends()).toHaveLength(1);
    expect(screen.getByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    expect(composer().props.editable).toBe(false);
    // Removing the Product needs the unconfirmed send to be given up first.
    expect(context().getByRole('button', { name: en['buyer.chat.context_remove'] })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.edit_unconfirmed'] }));
    expect(context().getByRole('button', { name: en['buyer.chat.context_remove'] })).toBeEnabled();
    expect(sends()).toHaveLength(1);
  });

  it('22. the Product check lost offline during a retry: nothing is sent and the outcome stays unknown; once checked, the retry is the same intent', async () => {
    const { chat } = await askFrom(BASKET);
    storing(chat, ['offline']);
    await send('Lined?');
    await maybe();
    api.on('GET /v1/storefronts/seller-1/products/basket', () => 'offline');
    await fireEvent.press(retryButton());
    expect(await context().findByText(en['buyer.chat.context_unchecked'])).toBeOnTheScreen();
    expect(sends()).toHaveLength(1);
    expect(screen.getByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    api.on('GET /v1/storefronts/seller-1/products/basket', () => ({ status: 200, body: BASKET }));
    await fireEvent.press(context().getByRole('button', { name: en['common.retry'] }));
    expect(await context().findByText('Woven basket')).toBeOnTheScreen();
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [a, b] = sends();
    expect(b!.body).toEqual({ text: 'Lined?', product_id: BASKET.id });
    expect(b!.headers['Idempotency-Key']).toBe(a!.headers['Idempotency-Key']);
  });

  it('8 (switching). a changed conversation reference starts clean: the unconfirmed intent is never sent to the other conversation', async () => {
    const { chat } = await open();
    const other = chat.conv(A, SELLER_2, 'Store 2', HANDLE_2);
    storing(chat, ['offline']);
    await send('For store one');
    await maybe();
    await act(() => router.setParams({ conversationRef: other.id }));
    await waitFor(() => expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull());
    expect(composer().props.value).toBe('');
    expect(composer().props.editable).toBe(true);
    await send('For store two');
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [a, b] = sends();
    expect(b!.path).toContain(other.id);
    expect(b!.body).toEqual({ text: 'For store two' });
    expect(b!.headers['Idempotency-Key']).not.toBe(a!.headers['Idempotency-Key']);
  });

  it('26. closing the conversation drops the unconfirmed intent (nothing persisted); reopening starts clean and shows what the server stored', async () => {
    const { chat, c } = await open();
    storing(chat, [{ status: 504 }]);
    await send('Are you there?');
    await maybe();
    await act(() => router.replace('/messages'));
    await act(() => router.push(`/chat/${c.id}`));
    expect(await screen.findByText('Are you there?')).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull();
    expect(composer().props.value).toBe('');
    expect(sends()).toHaveLength(1);
  });

  it('23. an expired session during a send ends the session; the intent is not retried', async () => {
    const { chat } = await open();
    storing(chat, [problem(401, 'SESSION_EXPIRED', 'auth')]);
    await send('Late question');
    await waitFor(() => expect(memory.has(TOKEN_KEY)).toBe(false));
    await act(() => jest.advanceTimersByTimeAsync(60_000));
    expect(sends()).toHaveLength(1);
  });

  it('29. an uncertain outcome is announced, not only drawn', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      const { chat } = await open();
      storing(chat, [{ status: 502, unreadable: true }]);
      await send('Hello?');
      await maybe();
      expect(announce).toHaveBeenCalledWith(en['buyer.chat.maybe_not_sent']);
      expect(announce).not.toHaveBeenCalledWith(en['buyer.chat.not_sent']);
    } finally {
      announce.mockRestore();
    }
  });
});

/**
 * Who a message is attributed to: only the server's own sender kind decides, an automated message is
 * drawn from the catalogue and never as a person, and a sender this version does not know is not
 * drawn under any label.
 */
describe('Message provenance', () => {
  async function history(setup: (chat: ReturnType<typeof installChat>, c: Conv) => void) {
    signedIn();
    const chat = installChat();
    const c = chat.conv(A);
    setup(chat, c);
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}` });
    return { chat, c };
  }

  it('a sender kind this version does not know (for example a future operator) is not drawn and takes neither the Seller nor the Automated label', async () => {
    await history((chat, c) => {
      chat.msg(c, { sender_kind: 'BUYER', body: 'My question', sent_at: ago(30) });
      chat.msg(c, { sender_kind: 'OPERATOR', body: 'Operator note', sent_at: ago(20) });
      chat.msg(c, { sender_kind: 'SELLER', body: 'Seller line', sent_at: ago(10) });
    });
    expect(await screen.findByText('Seller line')).toBeOnTheScreen();
    expect(screen.getByText('My question')).toBeOnTheScreen();
    expect(screen.queryByText('Operator note')).toBeNull();
    expect(screen.getAllByText(en['buyer.chat.sender.seller'])).toHaveLength(1);
    expect(screen.getAllByText(en['buyer.chat.sender.you'])).toHaveLength(1);
    expect(screen.queryByText(en['buyer.chat.sender.bot'])).toBeNull();
    expect(screen.queryByText(en['buyer.chat.sender.team'])).toBeNull();
  });

  it('an automated message is drawn only from the catalogue, whatever text its row also carries, and is never labelled as a person', async () => {
    await history((chat, c) => {
      chat.msg(c, { sender_kind: 'BOT', template_key: 'chat.bot.escalated', body: 'The Seller promises a full refund', resolution_path: 'ESCALATED', sent_at: ago(20) });
      chat.msg(c, { sender_kind: 'BOT', template_key: 'seller.written.reply', body: 'Free delivery for you', resolution_path: 'KEYWORD', sent_at: ago(10) });
    });
    expect(await screen.findByText(en['chat.bot.escalated'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.chat.bot_unavailable'])).toBeOnTheScreen();
    expect(screen.queryByText('The Seller promises a full refund')).toBeNull();
    expect(screen.queryByText('Free delivery for you')).toBeNull();
    expect(screen.getAllByText(en['buyer.chat.sender.bot'])).toHaveLength(2);
    expect(screen.queryByText(en['buyer.chat.sender.seller'])).toBeNull();
    expect(screen.queryByText(en['buyer.chat.sender.team'])).toBeNull();
  });

  it('a human message that reads like an automated one is still the person it is attributed to', async () => {
    await history((chat, c) => {
      chat.msg(c, { sender_kind: 'SELLER', body: en['chat.bot.escalated'], sent_at: ago(20) });
      chat.msg(c, { sender_kind: 'TEAM_MEMBER', body: 'I can hold one.', sent_at: ago(10) });
    });
    expect(await screen.findByText('I can hold one.')).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.sender.bot'])).toBeNull();
    expect(screen.getAllByText(en['buyer.chat.sender.seller'])).toHaveLength(1);
    expect(screen.getAllByText(en['buyer.chat.sender.team'])).toHaveLength(1);
  });
});

/**
 * A conversation left open (kept in the navigation stack under another screen) when the Account
 * changes. Account A's thread must neither ask for anything nor keep anything once Account B has
 * signed in: no request names A's conversation under B's credential, none is made at all by the old
 * screen, a late answer for A is never drawn, and A's draft and unconfirmed send go with the screen.
 * The server here answers A's conversation for ANY credential, so a request that is made would visibly
 * leak: the tests never rely on the server saying 404.
 */
describe('Account change while a conversation is open', () => {
  const open = (path: string) => act(() => router.push(path as never));
  const quiet = () => act(() => jest.advanceTimersByTimeAsync(1000));
  const MESSAGES = /^\/v1\/conversations\/[^/]+\/messages$/;

  /** Two Accounts, A signed in; the first has one conversation with a private reply. */
  function accounts() {
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
    const theirs = chat.conv(A, SELLER_ID, 'First Account store');
    chat.msg(theirs, { sender_kind: 'SELLER', body: 'First Account private reply', sent_at: ago(10) });
    chat.conv(B, SELLER_ID, 'Second Account store');
    // A server that answers the first Account's history to whoever asks.
    api.onPattern('GET', MESSAGES, () => ({ status: 200, body: { data: theirs.messages, next_cursor: null } }));
    return { chat, theirs };
  }
  /** From the open thread: push You over it (the thread stays in the stack), sign out, sign in as the second Account. */
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
  /** Every request since the first Account's sign-out request. */
  function afterSignOut() {
    const at = api.calls.findIndex((c) => c.path === '/v1/auth/logout');
    expect(at).toBeGreaterThanOrEqual(0);
    return api.calls.slice(at + 1);
  }
  const naming = (id: string) => (c: Recorded) => c.path.includes(id) || JSON.stringify(c.query).includes(id);

  it("a thread kept in the stack asks for nothing under the second Account, and returning to it lands on that Account's Messages", async () => {
    const { theirs } = accounts();
    await renderRouter(APP_DIR, { initialUrl: `/chat/${theirs.id}` });
    expect(await screen.findByText('First Account private reply')).toBeOnTheScreen();
    await switchAccount();
    await quiet();
    const later = afterSignOut();
    expect(later.filter(naming(theirs.id))).toEqual([]);
    // Everything asked for after the switch carries the second Account's credential, nothing the first's.
    expect(later.filter((c) => c.headers.Authorization !== undefined).every((c) => c.headers.Authorization === B)).toBe(true);
    expect(screen.queryByText('First Account private reply')).toBeNull();
    // Back to the retained thread: it leaves for Messages and shows only the second Account's conversations.
    await open(`/chat/${theirs.id}`);
    expect(await screen.findByRole('button', { name: 'Second Account store' })).toBeOnTheScreen();
    expect(screen.queryByText('First Account store')).toBeNull();
    expect(screen.queryByText('First Account private reply')).toBeNull();
    await quiet();
    expect(afterSignOut().filter(naming(theirs.id))).toEqual([]);
  });

  it('a history answer for the first Account that lands after the second one signed in is never drawn or asked for again', async () => {
    const { theirs } = accounts();
    const { gate, release } = held();
    api.onPattern('GET', MESSAGES, async () => {
      await gate;
      return { status: 200, body: { data: theirs.messages, next_cursor: null } };
    });
    await renderRouter(APP_DIR, { initialUrl: `/chat/${theirs.id}` });
    await waitFor(() => expect(api.calls.some(naming(theirs.id))).toBe(true));
    await switchAccount();
    await act(async () => release());
    await quiet();
    expect(screen.queryByText('First Account private reply')).toBeNull();
    await open(`/chat/${theirs.id}`);
    expect(await screen.findByRole('button', { name: 'Second Account store' })).toBeOnTheScreen();
    expect(screen.queryByText('First Account private reply')).toBeNull();
    await quiet();
    expect(afterSignOut().filter(naming(theirs.id))).toEqual([]);
  });

  it.each([
    ['accepted', { status: 201, body: { message_id: 'd0000000-0000-4000-8000-0000000000aa', bot: null } } as Reply],
    ['lost (a gateway page)', { status: 502, unreadable: true } as Reply],
  ])('a send still in flight for the first Account when the second signs in: one request, nothing shown or sent again (%s)', async (_name, late) => {
    const { theirs } = accounts();
    const { gate, release } = held();
    api.onPattern('POST', MESSAGES, async () => {
      await gate;
      return late;
    });
    await renderRouter(APP_DIR, { initialUrl: `/chat/${theirs.id}` });
    await screen.findByText('First Account private reply');
    await fireEvent.changeText(composer(), 'First Account draft');
    await fireEvent.press(sendButton());
    await waitFor(() => expect(sends()).toHaveLength(1));
    await switchAccount();
    await act(async () => release());
    await quiet();
    expect(sends()).toHaveLength(1);
    expect(sends()[0]?.headers.Authorization).toBe(A);
    expect(screen.queryByText('First Account draft')).toBeNull();
    await open(`/chat/${theirs.id}`);
    expect(await screen.findByRole('button', { name: 'Second Account store' })).toBeOnTheScreen();
    expect(screen.queryByLabelText(en['buyer.chat.composer'])).toBeNull();
    expect(screen.queryByText('First Account draft')).toBeNull();
    expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull();
    await act(() => jest.advanceTimersByTimeAsync(120_000));
    expect(sends()).toHaveLength(1);
    expect(afterSignOut().filter(naming(theirs.id))).toEqual([]);
  });

  it('a send waiting on its Product check when the second Account signs in sends nothing, under either credential', async () => {
    const { chat, theirs } = accounts();
    chat.publish(BASKET);
    const { gate, release } = held();
    let hold = false;
    api.on(`GET /v1/storefronts/${HANDLE}/products/basket`, async () => {
      if (hold) await gate;
      return { status: 200, body: BASKET };
    });
    await renderRouter(APP_DIR, { initialUrl: `/product/${HANDLE}/basket` });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.chat.ask_about_product'] }));
    await screen.findByTestId('chat-product-context');
    await within(screen.getByTestId('chat-product-context')).findByText(BASKET.name);
    await fireEvent.changeText(composer(), 'About the basket');
    hold = true;
    await fireEvent.press(sendButton());
    await waitFor(() => expect(api.callsTo(`GET /v1/storefronts/${HANDLE}/products/basket`).length).toBeGreaterThanOrEqual(2));
    await switchAccount();
    await act(async () => release());
    await quiet();
    expect(sends()).toEqual([]);
    expect(afterSignOut().filter(naming(theirs.id))).toEqual([]);
  });

  it('an unconfirmed send of the first Account is not offered to the second: the retained screen leaves with its draft and key', async () => {
    const { chat, theirs } = accounts();
    api.onPattern('POST', MESSAGES, () => ({ status: 502, unreadable: true }));
    await renderRouter(APP_DIR, { initialUrl: `/chat/${theirs.id}` });
    await screen.findByText('First Account private reply');
    await fireEvent.changeText(composer(), 'Unconfirmed first draft');
    await fireEvent.press(sendButton());
    await screen.findByText(en['buyer.chat.maybe_not_sent']);
    await switchAccount();
    await open(`/chat/${theirs.id}`);
    expect(await screen.findByRole('button', { name: 'Second Account store' })).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.retry_send'])).toBeNull();
    expect(screen.queryByText('Unconfirmed first draft')).toBeNull();
    await quiet();
    expect(sends()).toHaveLength(1);
    expect(afterSignOut().filter(naming(theirs.id))).toEqual([]);
    expect(chat.convs.find((c) => c.id === theirs.id)?.messages.some((m) => m.body === 'Unconfirmed first draft')).toBe(false);
  });
});

/**
 * Message send reconciliation against an in-memory API that keeps the real idempotency rules: the
 * message and its record are stored together; a retry with the same key and body gets the stored
 * answer; the same key with another body, or after the record's 24 hours, is a 409; a refusal stores
 * nothing. Answers can be lost after the server committed (`lose`), refused before it did (`refuse`),
 * or committed after the client gave up (`commitAfterMs`).
 */
describe('Message send reconciliation', () => {
  const MESSAGES_PATH = /^\/v1\/conversations\/[^/]+\/messages$/;
  const ESCALATE_PATH = /^\/v1\/conversations\/[^/]+\/escalate$/;
  const DAY = 24 * 3600_000;
  type Fault = { refuse: Reply } | { lose: Reply } | { commitAfterMs: number };
  type Chat = ReturnType<typeof installChat>;
  const gatewayPage: Reply = { status: 502, unreadable: true };
  const wait = (seconds: number) => `Too many requests. Try again in ${seconds} seconds.`;

  function idempotent(chat: Chat, script: Array<Fault | undefined> = []) {
    const records = new Map<string, { hash: string; id: string; at: number }>();
    let attempt = 0;
    let replays = 0;
    api.onPattern('POST', MESSAGES_PATH, (call) => {
      const c = chat.convs.find((x) => call.path.startsWith(`/v1/conversations/${x.id}/`));
      if (!c) return problem(404, 'NOT_FOUND', 'request');
      const key = call.headers['Idempotency-Key']!;
      const hash = JSON.stringify(call.body);
      const fault = script[attempt++];
      if (fault && 'refuse' in fault) return fault.refuse;
      const record = records.get(key);
      if (record && (record.hash !== hash || Date.now() - record.at >= DAY)) return problem(409, 'IDEMPOTENCY_KEY_REUSED', 'request');
      const commit = () => {
        const existing = records.get(key);
        if (existing) return existing;
        const m = chat.msg(c, { sender_kind: 'BUYER', body: String(call.body?.text), sent_at: new Date().toISOString(), product_id: (call.body?.product_id as string | undefined) ?? null });
        const made = { hash, id: m.id, at: Date.now() };
        records.set(key, made);
        return made;
      };
      if (fault && 'commitAfterMs' in fault) {
        setTimeout(commit, fault.commitAfterMs);
        return 'hang';
      }
      if (record) replays++;
      const made = commit();
      const reply: Reply = { status: 201, body: { message_id: made.id, bot: null }, ...(record ? { headers: { 'X-Adulis-Idempotent-Replay': 'true' } } : {}) };
      return fault && 'lose' in fault ? fault.lose : reply;
    });
    return { replays: () => replays };
  }

  /** The escalation endpoint with the same rules: one stored escalation per key. */
  function idempotentEscalate(chat: Chat, script: Array<Fault | undefined> = []) {
    const records = new Map<string, string>();
    let attempt = 0;
    api.onPattern('POST', ESCALATE_PATH, (call) => {
      const c = chat.convs.find((x) => call.path.startsWith(`/v1/conversations/${x.id}/`));
      if (!c) return problem(404, 'NOT_FOUND', 'request');
      const key = call.headers['Idempotency-Key']!;
      const fault = script[attempt++];
      if (fault && 'refuse' in fault) return fault.refuse;
      let id = records.get(key);
      if (!id) {
        id = chat.msg(c, { sender_kind: 'BOT', template_key: 'chat.bot.escalated', resolution_path: 'ESCALATED', sent_at: new Date().toISOString() }).id;
        records.set(key, id);
      }
      return fault && 'lose' in fault ? fault.lose : { status: 200, body: { escalated: true, bot_message_id: id } };
    });
  }

  const stored = (chat: Chat, text: string) => chat.convs.flatMap((c) => c.messages).filter((m) => m.body === text);
  const escalations = (chat: Chat) => chat.convs.flatMap((c) => c.messages).filter((m) => m.template_key === 'chat.bot.escalated');
  const escalateCalls = () => api.calls.filter((c) => c.method === 'POST' && ESCALATE_PATH.test(c.path));
  const keys = (calls: Recorded[] = sends()) => calls.map((c) => c.headers['Idempotency-Key']);
  const maybe = () => screen.findByText(en['buyer.chat.maybe_not_sent']);
  const edit = () => screen.getByRole('button', { name: en['buyer.chat.edit_unconfirmed'] });
  const typeAndSend = async (text: string) => {
    await fireEvent.changeText(composer(), text);
    await fireEvent.press(sendButton());
  };
  const advance = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
  const getsAfter = (post: Recorded) => api.calls.slice(api.calls.indexOf(post) + 1).filter((c) => c.method === 'GET' && MESSAGES_PATH.test(c.path));

  async function open() {
    signedIn();
    const chat = installChat();
    const c = chat.conv(A);
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}` });
    await screen.findByText(en['buyer.chat.empty']);
    return { chat, c };
  }

  it.each([
    ['a timeout', 'hang' as Reply],
    ['a lost connection', 'offline' as Reply],
    ['a gateway page', gatewayPage],
  ])('%s after the server stored the message: the retry carries the same key, the server answers with the stored message, exactly one message exists', async (_name, lost) => {
    const { chat } = await open();
    const server = idempotent(chat, [{ lose: lost }]);
    await typeAndSend('Hello there');
    await advance(10_000);
    expect(await maybe()).toBeOnTheScreen();
    expect(stored(chat, 'Hello there')).toHaveLength(1);
    await fireEvent.press(retryButton());
    await waitFor(() => expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull());
    expect(sends()).toHaveLength(2);
    expect(keys()[1]).toBe(keys()[0]);
    expect(server.replays()).toBe(1);
    expect(stored(chat, 'Hello there')).toHaveLength(1);
    expect(screen.getAllByText('Hello there')).toHaveLength(1);
    expect(composer().props.value).toBe('');
  });

  // The presses go to a disabled control, which delivers none: this holds the control, not the handler's own guard.
  it('repeated taps on the disabled control while the replay is in flight send one request', async () => {
    const { chat } = await open();
    idempotent(chat, [{ lose: 'offline' }, { lose: 'hang' }]);
    await typeAndSend('Tap tap');
    await maybe();
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    // While it is in flight the primary control reads Send again, and is off.
    for (let i = 0; i < 4; i++) await fireEvent.press(sendButton());
    expect(sends()).toHaveLength(2);
    expect(stored(chat, 'Tap tap')).toHaveLength(1);
  });

  // The server answers 409 to a same-key retry only once the key's 24 hour record has expired, and the
  // client never replays a key that old: the 409 is scripted here to hold the client's reaction to it.
  it('a 409 on a replay (scripted: the server gives it only for a key past its record) is not "not sent": the replay is withdrawn, the conversation is read again, and only an explicit new message is offered', async () => {
    const { chat } = await open();
    idempotent(chat, [{ lose: gatewayPage }, { refuse: problem(409, 'IDEMPOTENCY_KEY_REUSED', 'request') }]);
    await typeAndSend('Is it in stock?');
    await maybe();
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: en['buyer.chat.retry_send'] })).toBeNull());
    expect(screen.queryByText(en['buyer.chat.not_sent'])).toBeNull();
    expect(screen.getByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['buyer.chat.send'] })).toBeNull();
    expect(composer().props.editable).toBe(false);
    // What the server holds is read again; the message the first attempt stored is there to see.
    await waitFor(() => expect(getsAfter(sends()[1]!).length).toBeGreaterThan(0));
    expect(await screen.findByText('Is it in stock?')).toBeOnTheScreen();
    // Nothing more is sent by itself, however long the screen stays open.
    await advance(120_000);
    expect(sends()).toHaveLength(2);
    // Editing is an explicit new message under a new key.
    await fireEvent.press(edit());
    expect(composer().props.editable).toBe(true);
    await fireEvent.press(sendButton());
    await waitFor(() => expect(sends()).toHaveLength(3));
    expect(keys()[2]).not.toBe(keys()[0]);
  });

  it('a 409 on the first attempt (a key collision) is the same: unknown, no replay button', async () => {
    const { chat } = await open();
    idempotent(chat, [{ refuse: problem(409, 'IDEMPOTENCY_KEY_REUSED', 'request') }]);
    await typeAndSend('Collision');
    expect(await maybe()).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.not_sent'])).toBeNull();
    expect(screen.queryByRole('button', { name: en['buyer.chat.retry_send'] })).toBeNull();
    expect(edit()).toBeOnTheScreen();
    expect(sends()).toHaveLength(1);
  });

  // Changed: the API's own 429 used to be "not sent" with a new key after the wait. A rate limit is not a
  // rejection of the message, so it is unknown and the same key is used again after the wait.
  it("the API's own 429 with a wait: unknown, and the controls stay off until the wait is over; taps on the disabled control send nothing; then the same key is used again", async () => {
    const { chat } = await open();
    idempotent(chat, [{ refuse: { ...problem(429, 'RATE_LIMITED', 'request', { retry_after_seconds: 30 }), headers: { 'Retry-After': '30' } } }]);
    await typeAndSend('Do you deliver?');
    expect(await maybe()).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.not_sent'])).toBeNull();
    expect(screen.getAllByText(wait(30))).toHaveLength(1);
    expect(retryButton()).toBeDisabled();
    // The conversation is read again, as after any unconfirmed attempt.
    await waitFor(() => expect(getsAfter(sends()[0]!).length).toBeGreaterThan(0));
    for (let i = 0; i < 4; i++) await fireEvent.press(retryButton());
    await advance(29_000);
    expect(retryButton()).toBeDisabled();
    expect(sends()).toHaveLength(1);
    await advance(1_000);
    await waitFor(() => expect(retryButton()).toBeEnabled());
    expect(screen.queryByText(wait(30))).toBeNull();
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    expect(keys()[1]).toBe(keys()[0]);
    expect(stored(chat, 'Do you deliver?')).toHaveLength(1);
  });

  // Changed: a 5xx with the API's own problem body used to be "not sent" with a new key. The model server
  // stores the message BEFORE it fails (a connection lost at the commit answers 503 after the commit), so
  // a new key would have stored it twice.
  it.each([
    ['a 500 problem after the server stored the message', { lose: problem(500, 'INTERNAL', 'request') } as Fault, 0, 1],
    ['a 503 problem with its wait (database unavailable) after the server stored the message', { lose: { ...problem(503, 'INTERNAL', 'request', { retry_after_seconds: 5 }), headers: { 'Retry-After': '5' } } } as Fault, 5, 1],
    ['a 500 problem before the server stored anything', { refuse: problem(500, 'INTERNAL', 'request') } as Fault, 0, 0],
  ])('%s: unknown, not "not sent"; the retry carries the same key and exactly one message exists', async (_name, fault, waitSeconds, replays) => {
    const { chat } = await open();
    const server = idempotent(chat, [fault]);
    await typeAndSend('Five hundred');
    expect(await maybe()).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.not_sent'])).toBeNull();
    expect(composer().props.editable).toBe(false);
    if (waitSeconds > 0) {
      expect(retryButton()).toBeDisabled();
      await advance(waitSeconds * 1000);
      await waitFor(() => expect(retryButton()).toBeEnabled());
    }
    await fireEvent.press(retryButton());
    await waitFor(() => expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull());
    expect(sends()).toHaveLength(2);
    expect(keys()[1]).toBe(keys()[0]);
    expect(server.replays()).toBe(replays);
    expect(stored(chat, 'Five hundred')).toHaveLength(1);
  });

  it('a 503 that only a gateway answered, with Retry-After: unknown and held; after the wait the replay carries the same key and gets the stored message', async () => {
    const { chat } = await open();
    const server = idempotent(chat, [{ lose: { status: 503, unreadable: true, headers: { 'Retry-After': '20' } } }]);
    await typeAndSend('Gateway says wait');
    expect(await maybe()).toBeOnTheScreen();
    expect(screen.getByText(wait(20))).toBeOnTheScreen();
    expect(retryButton()).toBeDisabled();
    await fireEvent.press(retryButton());
    await advance(19_000);
    expect(sends()).toHaveLength(1);
    await advance(1_000);
    await waitFor(() => expect(retryButton()).toBeEnabled());
    await fireEvent.press(retryButton());
    await waitFor(() => expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull());
    expect(sends()).toHaveLength(2);
    expect(keys()[1]).toBe(keys()[0]);
    expect(server.replays()).toBe(1);
    expect(stored(chat, 'Gateway says wait')).toHaveLength(1);
  });

  it('a wait the server asked for is announced, once', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      const { chat } = await open();
      idempotent(chat, [{ refuse: { status: 503, unreadable: true, headers: { 'Retry-After': '5' } } }]);
      await typeAndSend('Announce the wait');
      await maybe();
      expect(announce.mock.calls.filter(([text]) => text === wait(5))).toHaveLength(1);
    } finally {
      announce.mockRestore();
    }
  });

  it('a key a minute short of its safe age is still replayed; at the safe age nothing is sent and only an explicit new message is offered', async () => {
    const { chat } = await open();
    idempotent(chat, [{ lose: gatewayPage }, { lose: gatewayPage }]);
    await typeAndSend('Old key');
    await maybe();
    const started = Date.now();
    jest.setSystemTime(started + KEY_SAFE_MS - 60_000);
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    expect(keys()[1]).toBe(keys()[0]);
    await maybe();
    // The second answer was lost too; now the key reaches its safe age.
    jest.setSystemTime(started + KEY_SAFE_MS);
    await fireEvent.press(retryButton());
    // Long enough for a request, had one been made, to reach the server.
    await advance(1000);
    await waitFor(() => expect(screen.queryByRole('button', { name: en['buyer.chat.retry_send'] })).toBeNull());
    expect(sends()).toHaveLength(2);
    expect(screen.getByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    expect(composer().props.editable).toBe(false);
    expect(edit()).toBeOnTheScreen();
    await fireEvent.press(edit());
    await fireEvent.press(sendButton());
    await waitFor(() => expect(sends()).toHaveLength(3));
    expect(keys()[2]).not.toBe(keys()[0]);
  });

  it('an unconfirmed send is announced when it happens, not again at every refresh of the conversation', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      const { chat } = await open();
      idempotent(chat, [{ lose: gatewayPage }]);
      await typeAndSend('Announce once');
      await maybe();
      expect(announce.mock.calls.filter(([text]) => text === en['buyer.chat.maybe_not_sent'])).toHaveLength(1);
      // Two refreshes of the history (the 30 second poll) change nothing about the message.
      await advance(65_000);
      expect(announce.mock.calls.filter(([text]) => text === en['buyer.chat.maybe_not_sent'])).toHaveLength(1);
    } finally {
      announce.mockRestore();
    }
  });

  it('a key withdrawn at the press is announced, since nothing else about the screen changes', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      const { chat } = await open();
      idempotent(chat, [{ lose: gatewayPage }]);
      await typeAndSend('Announce the withdrawal');
      await maybe();
      announce.mockClear();
      jest.setSystemTime(Date.now() + KEY_SAFE_MS);
      await fireEvent.press(retryButton());
      await advance(1000);
      expect(announce.mock.calls.filter(([text]) => text === en['buyer.chat.maybe_not_sent'])).toHaveLength(1);
      expect(sends()).toHaveLength(1);
    } finally {
      announce.mockRestore();
    }
  });

  it('a key older than a day is never sent again, even to a server that would answer 409', async () => {
    const { chat } = await open();
    idempotent(chat, [{ lose: 'offline' }]);
    await typeAndSend('A day later');
    await maybe();
    jest.setSystemTime(Date.now() + DAY + 60_000);
    await fireEvent.press(retryButton());
    // Long enough for a request, had one been made, to reach the server.
    await advance(1000);
    expect(sends()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: en['buyer.chat.retry_send'] })).toBeNull();
    expect(screen.queryByText(en['buyer.chat.not_sent'])).toBeNull();
  });

  it('a server that stores the message after the client gave up: the poll shows it, the replay returns the same message, and one message exists', async () => {
    const { chat } = await open();
    const server = idempotent(chat, [{ commitAfterMs: 15_000 }]);
    await typeAndSend('Slow server');
    await advance(10_000);
    expect(await maybe()).toBeOnTheScreen();
    expect(stored(chat, 'Slow server')).toHaveLength(0);
    for (let i = 0; i < 9 && screen.queryByText('Slow server') === null; i++) await advance(10_000);
    // The stored message is on screen while the composer still says it may not have arrived.
    expect(await screen.findByText('Slow server')).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    expect(composer().props.editable).toBe(false);
    expect(sends()).toHaveLength(1);
    await fireEvent.press(retryButton());
    await waitFor(() => expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull());
    expect(sends()).toHaveLength(2);
    expect(keys()[1]).toBe(keys()[0]);
    expect(server.replays()).toBe(1);
    expect(stored(chat, 'Slow server')).toHaveLength(1);
    expect(screen.getAllByText('Slow server')).toHaveLength(1);
  });

  describe('Ask the Seller', () => {
    async function openAnswered() {
      signedIn();
      const chat = installChat();
      const c = chat.conv(A);
      chat.msg(c, { sender_kind: 'BUYER', body: 'Delivery times?', sent_at: ago(20) });
      chat.msg(c, { sender_kind: 'BOT', template_key: 'nlu.answer.delivery_times', resolution_path: 'KEYWORD', sent_at: ago(10) });
      await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}` });
      await screen.findByText(en['buyer.chat.ask_seller_hint']);
      return chat;
    }
    const ask = () => screen.getByRole('button', { name: en['buyer.chat.ask_seller'] });

    it('a lost answer after the server escalated: the conversation is read again, shows the escalation, and Ask the Seller is gone: no second escalation', async () => {
      const chat = await openAnswered();
      idempotentEscalate(chat, [{ lose: gatewayPage }]);
      await fireEvent.press(ask());
      expect(await screen.findByText(en['chat.bot.escalated'])).toBeOnTheScreen();
      await waitFor(() => expect(screen.queryByRole('button', { name: en['buyer.chat.ask_seller'] })).toBeNull());
      expect(escalateCalls()).toHaveLength(1);
      expect(escalations(chat)).toHaveLength(1);
    });

    it('an answer that is not the escalation confirmation is unconfirmed: the same key is used again and the server stores one escalation', async () => {
      const chat = await openAnswered();
      idempotentEscalate(chat, [{ refuse: gatewayPage }]);
      await fireEvent.press(ask());
      expect(await screen.findByText(en['buyer.chat.ask_failed'])).toBeOnTheScreen();
      await fireEvent.press(ask());
      expect(await screen.findByText(en['chat.bot.escalated'])).toBeOnTheScreen();
      expect(keys(escalateCalls())[1]).toBe(keys(escalateCalls())[0]);
      expect(escalations(chat)).toHaveLength(1);
    });

    it('a 200 that does not confirm the escalation is not taken as done: it is unconfirmed, and the same key is used again', async () => {
      const chat = await openAnswered();
      idempotentEscalate(chat, [{ refuse: { status: 200, body: {} } }]);
      await fireEvent.press(ask());
      expect(await screen.findByText(en['buyer.chat.ask_failed'])).toBeOnTheScreen();
      expect(escalations(chat)).toHaveLength(0);
      await fireEvent.press(ask());
      expect(await screen.findByText(en['chat.bot.escalated'])).toBeOnTheScreen();
      expect(keys(escalateCalls())[1]).toBe(keys(escalateCalls())[0]);
      expect(escalations(chat)).toHaveLength(1);
    });

    it('a 200 that does not confirm the escalation, after the server stored it: the conversation shows the escalation and Ask the Seller is gone', async () => {
      const chat = await openAnswered();
      idempotentEscalate(chat, [{ lose: { status: 200, body: {} } }]);
      await fireEvent.press(ask());
      expect(await screen.findByText(en['chat.bot.escalated'])).toBeOnTheScreen();
      await waitFor(() => expect(screen.queryByRole('button', { name: en['buyer.chat.ask_seller'] })).toBeNull());
      expect(escalateCalls()).toHaveLength(1);
      expect(escalations(chat)).toHaveLength(1);
    });

    it('a 409 ends the key: the conversation decides whether the question was passed on, and a second escalation is not sent over a stored one', async () => {
      const chat = await openAnswered();
      idempotentEscalate(chat, [{ lose: problem(409, 'IDEMPOTENCY_KEY_REUSED', 'request') }]);
      await fireEvent.press(ask());
      expect(await screen.findByText(en['chat.bot.escalated'])).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: en['buyer.chat.ask_seller'] })).toBeNull();
      expect(escalateCalls()).toHaveLength(1);
    });

    it('a 409 with nothing stored: the next Ask the Seller is a new request under a new key', async () => {
      const chat = await openAnswered();
      idempotentEscalate(chat, [{ refuse: problem(409, 'IDEMPOTENCY_KEY_REUSED', 'request') }]);
      await fireEvent.press(ask());
      expect(await screen.findByText(en['buyer.chat.ask_failed'])).toBeOnTheScreen();
      await waitFor(() => expect(ask()).toBeEnabled());
      await fireEvent.press(ask());
      expect(await screen.findByText(en['chat.bot.escalated'])).toBeOnTheScreen();
      expect(keys(escalateCalls())[1]).not.toBe(keys(escalateCalls())[0]);
      expect(escalations(chat)).toHaveLength(1);
    });

    it('a 429 with a wait holds Ask the Seller; after it the same key is used again', async () => {
      const chat = await openAnswered();
      idempotentEscalate(chat, [{ refuse: { status: 429, unreadable: true, headers: { 'Retry-After': '15' } } }]);
      await fireEvent.press(ask());
      expect(await screen.findByText(wait(15))).toBeOnTheScreen();
      expect(ask()).toBeDisabled();
      await fireEvent.press(ask());
      await advance(14_000);
      expect(escalateCalls()).toHaveLength(1);
      await advance(1_000);
      await waitFor(() => expect(ask()).toBeEnabled());
      await fireEvent.press(ask());
      expect(await screen.findByText(en['chat.bot.escalated'])).toBeOnTheScreen();
      expect(keys(escalateCalls())[1]).toBe(keys(escalateCalls())[0]);
      expect(escalations(chat)).toHaveLength(1);
    });
  });

  // The retry reaches the server before the first request commits (the client gave up at 10 s, the
  // server commits at 15 s): the model server commits once per key, as the real one does through its
  // unique collision, so the later commit finds the record and stores nothing more.
  it('a retry that reaches the server before its twin commits is the same message: one message exists', async () => {
    const { chat } = await open();
    idempotent(chat, [{ commitAfterMs: 15_000 }]);
    await typeAndSend('Racing twins');
    await advance(10_000);
    await maybe();
    await advance(1_000);
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    await waitFor(() => expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull());
    await advance(10_000);
    expect(keys()[1]).toBe(keys()[0]);
    expect(stored(chat, 'Racing twins')).toHaveLength(1);
    expect(screen.getAllByText('Racing twins')).toHaveLength(1);
  });

  // Keep this test last in the file: a second app in one test leaves the harness unusable for the tests after it.
  it('nothing of an unconfirmed send is kept on the device: a restarted app has no draft and no key, and the stored message comes from the server', async () => {
    const { chat, c } = await open();
    idempotent(chat, [{ lose: 'offline' }]);
    await typeAndSend('Before the restart');
    await maybe();
    const key = keys()[0]!;
    // Nothing the person wrote and no idempotency key is in the device's secure storage.
    for (const value of memory.values()) {
      expect(String(value)).not.toContain('Before the restart');
      expect(String(value)).not.toContain(key);
    }
    screen.unmount();
    await renderRouter(APP_DIR, { initialUrl: `/chat/${c.id}` });
    expect(await screen.findByText('Before the restart')).toBeOnTheScreen();
    expect(composer().props.value).toBe('');
    expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull();
    expect(screen.queryByRole('button', { name: en['buyer.chat.retry_send'] })).toBeNull();
    // The server's message is shown once and nothing was sent by the restart.
    expect(screen.getAllByText('Before the restart')).toHaveLength(1);
    expect(sends()).toHaveLength(1);
  });
});
