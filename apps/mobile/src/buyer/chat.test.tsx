import { en } from '@adulis/locale/mobile';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { useUiStore } from '../state/ui-store';
import {
  GOOD_TOKEN,
  SIGNED_IN_CONTEXT,
  SIGN_IN_CODE,
  bootstrapBody,
  installFakeApi,
  problem,
  storefront,
  type Recorded,
} from '../testing/fake-api';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * WO-013: Buyer messaging on the real route tree against an in-memory chat server on the API's
 * rules (one conversation per Buyer and Seller; 25 conversations and 50 messages a page, newest
 * first; text 1-4000; BOT rows as template keys). Numbers are the work order's section 34 matrix
 * (1-26); 24 and 25 (Dark, enlarged text) are native.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const OTHER_TOKEN = 'Other_credential_for_tests_0123456789abcdef';
const UUID7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HANDLE = 'seller-1';
const SELLER_ID = storefront(HANDLE).seller_id;
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
  const mine = (call: Recorded) => convs.filter((c) => c.owner === call.headers.Authorization);
  const byPath = (call: Recorded) => mine(call).find((c) => call.path.startsWith(`/v1/conversations/${c.id}/`));
  api.on('POST /v1/conversations', (call) => {
    if (!call.headers.Authorization) return problem(401, 'SESSION_EXPIRED', 'auth');
    if (call.body?.seller_id !== SELLER_ID) return problem(404, 'NOT_FOUND', 'request');
    const found = mine(call).find((c) => c.seller_id === call.body?.seller_id) ?? conv(call.headers.Authorization);
    return { status: 201, body: { conversation_id: found.id } };
  });
  api.on('GET /v1/conversations', (call) => {
    if (call.query.as !== 'buyer') return problem(400, 'SCOPE_PARAMETER_REQUIRED', 'request');
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
    const m = msg(c, { sender_kind: 'BUYER', body: text, sent_at: new Date().toISOString(), product_id: null });
    return { status: 201, body: { message_id: m.id, bot: null } };
  });
  api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/escalate$/, (call) => {
    const c = byPath(call);
    if (!c) return problem(404, 'NOT_FOUND', 'request');
    const m = msg(c, { sender_kind: 'BOT', template_key: 'chat.bot.escalated', resolution_path: 'ESCALATED', sent_at: new Date().toISOString() });
    return { status: 200, body: { escalated: true, bot_message_id: m.id } };
  });
  return { convs, conv, msg };
}

const sends = () => api.calls.filter((c) => c.method === 'POST' && /\/messages$/.test(c.path));
const composer = () => screen.getByLabelText(en['buyer.chat.composer']);
const sendButton = () => screen.getByRole('button', { name: en['buyer.chat.send'] });

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

  it('12, 13. a message lost offline is not shown as sent; the draft stays and the retry reuses its key', async () => {
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
    expect(await screen.findByText(en['buyer.chat.not_sent'])).toBeOnTheScreen();
    expect(screen.getByText(en['common.offline'])).toBeOnTheScreen();
    expect(composer().props.value).toBe('Are you open today?');
    expect(screen.queryByText(en['buyer.chat.sender.you'])).toBeNull();
    await fireEvent.press(sendButton());
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
