import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, SIGNED_IN_CONTEXT, bootstrapBody, installFakeApi, problem, type Recorded, type Reply } from '../testing/fake-api';
import { TOKEN_KEY, memory, resetSecureStore } from '../testing/secure-store-mock';

/**
 * WO-021 Seller Companion messaging on the real route tree against an in-memory Chat server on the
 * rules the API states (chat.controller, core.fn_has_permission): every Seller-side call carries
 * X-Adulis-Seller; the list's seller_id must equal it; a store the Account does not hold is 404; a
 * role without seller.messages:* is 403; a conversation of another store is 404. The server, never
 * the client, decides the sender: owner (SELLER) or team member (TEAM_MEMBER) with the store header,
 * the Buyer without it. Numbers in the names are the work order's section 24-26 matrix (1-56).
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const A = { id: 'aaaaaaaa-0000-4000-8000-00000000000a', handle: 'store-a', store_name: 'Store A', status: 'ACTIVE', role: 'OWNER', created_at: '2026-11-01T08:00:00.000Z' };
const B = { id: 'bbbbbbbb-0000-4000-8000-00000000000b', handle: 'store-b', store_name: 'Store B', status: 'ACTIVE', role: 'SALES_SUPPORT', created_at: '2026-11-02T08:00:00.000Z' };
type Row = typeof A;
/** Another Account, the Buyer of most conversations. Its id must never be drawn. */
const BUYER_ACCOUNT = 'beefbeef-0000-4000-8000-0000000000be';
/** This Account's own id: in the same-Account case it is also the conversation's Buyer. */
const SELF_ACCOUNT = '5e1f5e1f-0000-4000-8000-0000000005e1';
const hex = (n: number) => n.toString(16).padStart(12, '0');
const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();
const ok = (body: unknown): Reply => ({ status: 200, body });
const held = () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { gate, release };
};

type Msg = { id: string; sender_kind: string; body?: string; template_key?: string; resolution_path?: string; sent_at: string; product_id?: string | null; order_id?: string | null };
type Conv = { id: string; seller: string; buyer: string; started_at: string; last_message_at: string; messages: Msg[] };

let api: ReturnType<typeof installFakeApi>;
const header = (c: Recorded) => c.headers['X-Adulis-Seller'];
const signedIn = () => resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const lists = () => api.callsTo('GET /v1/conversations');
const histories = () => api.calls.filter((c) => c.method === 'GET' && /^\/v1\/conversations\/[^/]+\/messages$/.test(c.path));
const sends = () => api.calls.filter((c) => c.method === 'POST' && /^\/v1\/conversations\/[^/]+\/messages$/.test(c.path));
const composer = () => screen.getByLabelText(en['seller.messages.composer']);
const sendButton = () => screen.getByRole('button', { name: en['buyer.chat.send'] });
const retryButton = () => screen.getByRole('button', { name: en['buyer.chat.retry_send'] });
const rows = () => screen.queryAllByTestId('seller-conversation');

type Server = { sellers?: Row[]; denied?: string[]; sendDenied?: string[] };
/** The Seller and Chat sides of the server for one test. */
function installServer({ sellers = [A], denied = [], sendDenied = [] }: Server = {}) {
  const state = { sellers, denied, sendDenied };
  const convs: Conv[] = [];
  const keys = new Map<string, string>();
  let n = 0;
  const conv = (seller: string, buyer = BUYER_ACCOUNT, at = ago(600)): Conv => {
    const c = { id: `c0000000-0000-4000-8000-${hex(++n)}`, seller, buyer, started_at: ago(3600), last_message_at: at, messages: [] };
    convs.push(c);
    return c;
  };
  const msg = (c: Conv, m: Omit<Msg, 'id'>) => {
    const full = { id: `d0000000-0000-4000-8000-${hex(++n)}`, ...m };
    c.messages.unshift(full);
    c.last_message_at = m.sent_at;
    return full;
  };
  const holds = (call: Recorded) => state.sellers.find((s) => s.id === header(call));
  const of = (call: Recorded) => convs.find((c) => call.path.startsWith(`/v1/conversations/${c.id}/`));

  api.on('GET /v1/bootstrap', (call) =>
    ok(bootstrapBody(call.headers.Authorization ? { account_context: { ...SIGNED_IN_CONTEXT, seller_companion: { available: true } } } : {})),
  );
  api.on('GET /v1/seller/list', (call) => (call.headers.Authorization ? ok({ data: state.sellers }) : problem(401, 'SESSION_EXPIRED', 'auth')));
  api.on('GET /v1/seller/analytics/overview', (call) => (holds(call) ? ok({ products_published: 1 }) : problem(404, 'NOT_FOUND', 'request')));
  api.on('GET /v1/conversations', (call) => {
    if (call.query.as === 'buyer') return ok({ data: [], next_cursor: null });
    if (call.query.as !== 'seller' || !call.query.seller_id || header(call) !== call.query.seller_id) return problem(400, 'SCOPE_PARAMETER_REQUIRED', 'request');
    if (!holds(call)) return problem(404, 'NOT_FOUND', 'request');
    if (state.denied.includes(header(call)!)) return problem(403, 'PERMISSION_DENIED', 'request');
    const mine = convs.filter((c) => c.seller === header(call)).sort((x, y) => y.last_message_at.localeCompare(x.last_message_at));
    const start = call.query.cursor ? Number(call.query.cursor) : 0;
    const next = start + 20 < mine.length ? String(start + 20) : null;
    const data = mine.slice(start, start + 20).map((c) => ({ id: c.id, buyer_account_id: c.buyer, started_at: c.started_at, last_message_at: c.last_message_at }));
    return ok({ data, next_cursor: next });
  });
  api.onPattern('GET', /^\/v1\/conversations\/[^/]+\/messages$/, (call) => {
    const c = of(call);
    if (header(call)) {
      if (!holds(call) || !c || c.seller !== header(call)) return problem(404, 'NOT_FOUND', 'request');
      if (state.denied.includes(header(call)!)) return problem(403, 'PERMISSION_DENIED', 'request');
    } else if (!c || c.buyer !== SELF_ACCOUNT) {
      return problem(404, 'NOT_FOUND', 'request');
    }
    const start = call.query.cursor ? Number(call.query.cursor) : 0;
    const next = start + 20 < c.messages.length ? String(start + 20) : null;
    return ok({ data: c.messages.slice(start, start + 20), next_cursor: next });
  });
  api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, (call) => {
    const c = of(call);
    const store = holds(call);
    let kind: string;
    if (header(call)) {
      if (!store || !c || c.seller !== store.id) return problem(404, 'NOT_FOUND', 'request');
      if (state.denied.includes(store.id) || state.sendDenied.includes(store.id)) return problem(403, 'PERMISSION_DENIED', 'request');
      kind = store.role === 'OWNER' ? 'SELLER' : 'TEAM_MEMBER';
    } else {
      if (!c || c.buyer !== SELF_ACCOUNT) return problem(404, 'NOT_FOUND', 'request');
      kind = 'BUYER';
    }
    const key = call.headers['Idempotency-Key'] ?? '';
    const replay = keys.get(key);
    if (replay) return { status: 201, body: { message_id: replay, bot: null } };
    const m = msg(c, { sender_kind: kind, body: String(call.body?.text), sent_at: new Date().toISOString() });
    keys.set(key, m.id);
    return { status: 201, body: { message_id: m.id, bot: null } };
  });
  return { state, convs, conv, msg };
}

/** Seller Home of the one store, then Messages. */
async function openMessages() {
  await renderRouter(APP_DIR, { initialUrl: '/seller' });
  await fireEvent.press(await screen.findByRole('button', { name: en['seller.messages.title'] }));
}
const openConversation = (c: Conv) => renderRouter(APP_DIR, { initialUrl: `/seller/messages/${c.id}` });

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

afterEach(() => {
  // 55: no conversation is ever created from Seller mode, and a reply never names its sender.
  expect(api.callsTo('POST /v1/conversations')).toEqual([]);
  for (const s of sends()) {
    expect(Object.keys(s.body ?? {})).toEqual(['text']);
    expect(header(s)).toBeDefined();
  }
  expect(api.calls.filter((c) => /\/escalate$/.test(c.path))).toEqual([]);
  // 56: no Order, payment, refund or reservation request, and no read-all.
  expect(api.calls.filter((c) => c.method !== 'GET' && /\/v1\/seller\//.test(c.path))).toEqual([]);
  expect(api.calls.filter((c) => /cart|checkout|payment|refund|reservation/i.test(c.path))).toEqual([]);
  expect(api.callsTo('POST /v1/notifications/read-all')).toEqual([]);
});

describe('Seller inbox', () => {
  it('1, 5, 16, 17, 18. the store\'s conversations: "Buyer conversation" and last activity; no Buyer id, profile or unread count', async () => {
    signedIn();
    const s = installServer();
    s.conv(A.id, BUYER_ACCOUNT, ago(300));
    s.conv(A.id, BUYER_ACCOUNT, ago(900));
    await openMessages();
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.getAllByText(en['seller.messages.conversation']).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/^Last activity /)).toHaveLength(2);
    expect(screen.getByText(en['seller.messages.note'])).toBeOnTheScreen();
    expect(screen.queryByText(new RegExp(BUYER_ACCOUNT))).toBeNull();
    expect(screen.queryByText(/beefbeef/)).toBeNull();
    expect(screen.queryByText(/unread/i)).toBeNull();
    // 20 (list): the scope and the header name the same store.
    expect(lists().every((c) => c.query.as === 'seller' && c.query.seller_id === A.id && header(c) === A.id)).toBe(true);
  });

  it('2. a guest cannot open Seller Messages: Buyer Home, and no Chat request', async () => {
    installServer();
    await renderRouter(APP_DIR, { initialUrl: '/seller/messages' });
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    await settle();
    expect(api.calls.filter((c) => c.path.startsWith('/v1/conversations'))).toEqual([]);
  });

  it('3. a Buyer-only Account cannot open Seller Messages: unavailable, no Chat request', async () => {
    signedIn();
    installServer();
    api.on('GET /v1/bootstrap', (call) =>
      ok(bootstrapBody(call.headers.Authorization ? { account_context: { ...SIGNED_IN_CONTEXT, seller_companion: { available: false } } } : {})),
    );
    await renderRouter(APP_DIR, { initialUrl: '/seller/messages' });
    expect(await screen.findByText(en['seller.gate.unavailable'])).toBeOnTheScreen();
    await settle();
    expect(api.calls.filter((c) => c.path.startsWith('/v1/conversations'))).toEqual([]);
  });

  it('4. no Seller relationship (an empty list) fails closed: no Messages, no Chat request', async () => {
    signedIn();
    installServer({ sellers: [] });
    await renderRouter(APP_DIR, { initialUrl: '/seller/messages' });
    expect(await screen.findByText(en['seller.chooser.empty'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['seller.messages.title'] })).toBeNull();
    await settle();
    expect(api.calls.filter((c) => c.path.startsWith('/v1/conversations'))).toEqual([]);
  });

  it('6, 7, 8, 17 (switch). store B\'s conversations replace store A\'s; A\'s conversation does not open under B; a late A answer is not shown', async () => {
    signedIn();
    const s = installServer({ sellers: [A, B] });
    const a1 = s.conv(A.id);
    s.msg(a1, { sender_kind: 'BUYER', body: 'Private to store A', sent_at: ago(100) });
    s.conv(B.id);
    s.conv(B.id);
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Store A, Owner, Open' }));
    await fireEvent.press(await screen.findByRole('button', { name: en['seller.messages.title'] }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    // Refresh with A's answer held; change to B before it lands.
    const { gate, release } = held();
    api.on('GET /v1/conversations', async (call) => {
      if (header(call) === A.id) await gate;
      const mine = s.convs.filter((c) => c.seller === header(call));
      return ok({ data: mine.map((c) => ({ id: c.id, buyer_account_id: c.buyer, started_at: c.started_at, last_message_at: c.last_message_at })), next_cursor: null });
    });
    await fireEvent.press(screen.getByRole('button', { name: en['seller.messages.refresh'] }));
    await act(() => router.back());
    await fireEvent.press(await screen.findByRole('button', { name: en['seller.home.change_store'] }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Store B, Sales support, Open' }));
    await fireEvent.press(await screen.findByRole('button', { name: en['seller.messages.title'] }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    await act(async () => release());
    await settle();
    expect(rows()).toHaveLength(2);
    expect(header(lists().at(-1)!)).toBe(B.id);
    // A's conversation, opened while B is the active store: refused by the server, shown as unavailable.
    await act(() => router.push(`/seller/messages/${a1.id}`));
    expect(await screen.findByText(en['seller.messages.gone'])).toBeOnTheScreen();
    expect(screen.queryByText('Private to store A')).toBeNull();
    expect(header(histories().at(-1)!)).toBe(B.id);
  });

  it('9, 10. older conversations load by cursor on request; Refresh reads the first page again', async () => {
    signedIn();
    const s = installServer();
    for (let i = 1; i <= 25; i++) s.conv(A.id, BUYER_ACCOUNT, ago(i * 60));
    await openMessages();
    await waitFor(() => expect(lists()).toHaveLength(1));
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.list.load_more'] }));
    await waitFor(() => expect(lists().map((c) => c.query.cursor)).toEqual([undefined, '20']));
    await fireEvent.press(screen.getByRole('button', { name: en['seller.messages.refresh'] }));
    await waitFor(() => expect(lists().length).toBeGreaterThanOrEqual(3));
    expect(lists().at(-1)!.query.cursor).toBeUndefined();
  });

  it('11. offline: says offline (never "no conversations"), then loads when the connection returns', async () => {
    signedIn();
    const s = installServer();
    s.conv(A.id);
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    await screen.findByRole('header', { name: 'Store A' });
    await act(async () => onlineManager.setOnline(false));
    try {
      await fireEvent.press(screen.getByRole('button', { name: en['seller.messages.title'] }));
      expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
      expect(screen.queryByText(en['seller.messages.empty'])).toBeNull();
    } finally {
      await act(async () => onlineManager.setOnline(true));
    }
    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it('12, 15. a server error and a malformed answer show a failure with Retry; a row without a valid id is dropped', async () => {
    signedIn();
    const s = installServer();
    const good = s.conv(A.id);
    let answer: 'error' | 'malformed' | 'mixed' = 'error';
    api.on('GET /v1/conversations', () =>
      answer === 'error'
        ? problem(500, 'INTERNAL', 'request')
        : answer === 'malformed'
          ? ok({ data: 'nope', next_cursor: null })
          : ok({ data: [{ id: 'not-an-id', last_message_at: ago(5) }, { id: good.id, buyer_account_id: BUYER_ACCOUNT, started_at: ago(50), last_message_at: ago(10) }], next_cursor: null }),
    );
    await openMessages();
    expect(await screen.findByText(en['error.request.internal'])).toBeOnTheScreen();
    answer = 'malformed';
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByRole('button', { name: en['common.retry'] })).toBeOnTheScreen();
    expect(rows()).toHaveLength(0);
    answer = 'mixed';
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it('13. a 403 says messaging is not available for this role; the session and the store stay', async () => {
    signedIn();
    installServer({ denied: [A.id] });
    await openMessages();
    expect(await screen.findByText(en['seller.messages.unavailable'])).toBeOnTheScreen();
    expect(memory.get(TOKEN_KEY)).toBe(GOOD_TOKEN);
    const listReads = api.callsTo('GET /v1/seller/list').length;
    await act(() => router.back());
    expect(await screen.findByRole('header', { name: 'Store A' })).toBeOnTheScreen();
    await settle();
    // A 403 is not a lost relationship: the store list is not read again for it.
    expect(api.callsTo('GET /v1/seller/list').length).toBe(listReads);
  });

  it('14. an expired session signs out and leaves Seller mode', async () => {
    signedIn();
    installServer();
    api.on('GET /v1/conversations', () => problem(401, 'SESSION_EXPIRED', 'auth'));
    await renderRouter(APP_DIR, { initialUrl: '/seller/messages' });
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    await waitFor(() => expect(memory.has(TOKEN_KEY)).toBe(false));
  });

  it('a 404 on the list is a lost store: the store selection ends and the list is read again', async () => {
    signedIn();
    installServer();
    let reads = 0;
    api.on('GET /v1/seller/list', () => ok({ data: reads++ === 0 ? [A] : [] }));
    api.on('GET /v1/conversations', () => problem(404, 'NOT_FOUND', 'request'));
    await renderRouter(APP_DIR, { initialUrl: '/seller/messages' });
    expect(await screen.findByText(en['seller.chooser.empty'])).toBeOnTheScreen();
    expect(reads).toBeGreaterThanOrEqual(2);
  });
});

describe('Seller conversation', () => {
  it('19-28. opens from the list with the store header; every sender named for the store; bot text from the catalogue only; anchors unnamed', async () => {
    signedIn();
    const s = installServer();
    const c = s.conv(A.id);
    s.msg(c, { sender_kind: 'BUYER', body: 'Is the basket in stock?', sent_at: ago(70), product_id: 'f0000000-0000-4000-8000-000000000001' });
    s.msg(c, { sender_kind: 'BOT', template_key: 'chat.bot.escalated', resolution_path: 'ESCALATED', sent_at: ago(60) });
    s.msg(c, { sender_kind: 'SELLER', body: 'Yes, two left.', sent_at: ago(50) });
    s.msg(c, { sender_kind: 'TEAM_MEMBER', body: 'I can hold one.', sent_at: ago(40) });
    s.msg(c, { sender_kind: 'BOT', template_key: 'nlu.answer.delivery_times', resolution_path: 'KEYWORD', sent_at: ago(30) });
    s.msg(c, { sender_kind: 'BUYER', body: 'Where is my order?', sent_at: ago(20), order_id: 'f0000000-0000-4000-8000-000000000002' });
    await openMessages();
    await waitFor(() => expect(rows()).toHaveLength(1));
    await fireEvent.press(rows()[0]!);
    expect(await screen.findByText('Is the basket in stock?')).toBeOnTheScreen();
    expect(histories().every((h) => header(h) === A.id)).toBe(true);
    expect(screen.getAllByText(en['seller.messages.sender.buyer'])).toHaveLength(2);
    expect(screen.getByText(en['seller.messages.sender.owner'])).toBeOnTheScreen();
    expect(screen.getByText(en['seller.messages.sender.team'])).toBeOnTheScreen();
    expect(screen.getAllByText(en['seller.messages.sender.bot'])).toHaveLength(2);
    expect(screen.getByText(en['chat.bot.escalated'])).toBeOnTheScreen();
    // 26: a template outside the catalogue is never shown raw.
    expect(screen.getByText(en['buyer.chat.bot_unavailable'])).toBeOnTheScreen();
    expect(screen.queryByText(/nlu\.answer/)).toBeNull();
    expect(screen.getByText(en['buyer.chat.about_product'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.chat.about_order'])).toBeOnTheScreen();
    expect(screen.queryByText(/f0000000/)).toBeNull();
    // The Buyer's own words are never relabelled as the store's.
    expect(screen.queryByText(en['buyer.chat.sender.you'])).toBeNull();
  });

  it('29. older messages load once, by cursor', async () => {
    signedIn();
    const s = installServer();
    const c = s.conv(A.id);
    for (let i = 30; i >= 1; i--) s.msg(c, { sender_kind: 'BUYER', body: `Line ${i}`, sent_at: ago(i * 10) });
    await openConversation(c);
    expect(await screen.findByText('Line 1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.load_earlier'] }));
    await waitFor(() => expect(histories().map((h) => h.query.cursor)).toContain('20'));
    await waitFor(() => expect(screen.queryByRole('button', { name: en['buyer.chat.load_earlier'] })).toBeNull());
    expect(histories().filter((h) => h.query.cursor === '20')).toHaveLength(1);
    expect(histories().every((h) => header(h) === A.id)).toBe(true);
  });

  it('30, 31. Refresh re-reads; polling every 30 seconds only while the conversation is on screen', async () => {
    signedIn();
    const s = installServer();
    const c = s.conv(A.id);
    s.msg(c, { sender_kind: 'BUYER', body: 'Hello', sent_at: ago(10) });
    await openMessages();
    await waitFor(() => expect(rows()).toHaveLength(1));
    await fireEvent.press(rows()[0]!);
    expect(await screen.findByText('Hello')).toBeOnTheScreen();
    const opened = histories().length;
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.refresh'] }));
    await waitFor(() => expect(histories().length).toBe(opened + 1));
    s.msg(c, { sender_kind: 'BUYER', body: 'Are you there?', sent_at: new Date().toISOString() });
    await act(() => jest.advanceTimersByTimeAsync(31_000));
    expect(await screen.findByText('Are you there?')).toBeOnTheScreen();
    expect(histories().length).toBe(opened + 2);
    // Back on the list (the conversation is unmounted): no more history reads.
    await act(() => router.back());
    await waitFor(() => expect(rows()).toHaveLength(1));
    const left = histories().length;
    await act(() => jest.advanceTimersByTimeAsync(95_000));
    expect(histories().length).toBe(left);
  });

  it('32. offline: says offline, never "not available"; loads when the connection returns', async () => {
    signedIn();
    const s = installServer();
    const c = s.conv(A.id);
    s.msg(c, { sender_kind: 'BUYER', body: 'Hello', sent_at: ago(10) });
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    await screen.findByRole('header', { name: 'Store A' });
    await act(async () => onlineManager.setOnline(false));
    try {
      await act(() => router.push(`/seller/messages/${c.id}`));
      expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
      expect(screen.queryByText(en['seller.messages.gone'])).toBeNull();
    } finally {
      await act(async () => onlineManager.setOnline(true));
    }
    expect(await screen.findByText('Hello')).toBeOnTheScreen();
  });

  it('33. a 403 on the history: unavailable for this role, no composer, no polling, no sign-out', async () => {
    signedIn();
    const s = installServer({ denied: [A.id] });
    const c = s.conv(A.id);
    await openConversation(c);
    expect(await screen.findByText(en['seller.messages.unavailable'])).toBeOnTheScreen();
    expect(screen.queryByLabelText(en['seller.messages.composer'])).toBeNull();
    const reads = histories().length;
    await act(() => jest.advanceTimersByTimeAsync(95_000));
    expect(histories().length).toBe(reads);
    expect(memory.get(TOKEN_KEY)).toBe(GOOD_TOKEN);
  });

  it('34, 36. an unknown conversation or another store\'s is "not available"; the store selection stays and polling stops', async () => {
    signedIn();
    const s = installServer({ sellers: [A, B] });
    const other = s.conv(B.id);
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Store A, Owner, Open' }));
    await screen.findByRole('header', { name: 'Store A' });
    const listReads = api.callsTo('GET /v1/seller/list').length;
    await act(() => router.push(`/seller/messages/${other.id}`));
    expect(await screen.findByText(en['seller.messages.gone'])).toBeOnTheScreen();
    expect(header(histories().at(-1)!)).toBe(A.id);
    const reads = histories().length;
    await act(() => jest.advanceTimersByTimeAsync(95_000));
    expect(histories().length).toBe(reads);
    // A conversation 404 never ends the store selection (refused() is the store's, not the chat's).
    expect(api.callsTo('GET /v1/seller/list').length).toBe(listReads);
    await act(() => router.back());
    expect(await screen.findByRole('header', { name: 'Store A' })).toBeOnTheScreen();
    // A malformed reference sends nothing.
    const before = histories().length;
    await act(() => router.push('/seller/messages/not-a-conversation'));
    expect(await screen.findByText(en['seller.messages.gone'])).toBeOnTheScreen();
    expect(histories().length).toBe(before);
  });

  it('35. a malformed history answer shows a failure with Retry, never messages', async () => {
    signedIn();
    const s = installServer();
    const c = s.conv(A.id);
    let broken = true;
    api.onPattern('GET', /^\/v1\/conversations\/[^/]+\/messages$/, () =>
      broken ? ok({ data: null }) : ok({ data: [{ id: 'd0000000-0000-4000-8000-0000000000aa', sender_kind: 'BUYER', body: 'Fixed', sent_at: ago(5) }], next_cursor: null }),
    );
    await openConversation(c);
    expect(await screen.findByText(en['seller.messages.failed'])).toBeOnTheScreen();
    broken = false;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText('Fixed')).toBeOnTheScreen();
  });
});

describe('Seller replies', () => {
  async function ready(server: Server = {}, buyer = BUYER_ACCOUNT) {
    signedIn();
    const s = installServer(server);
    const c = s.conv(A.id, buyer);
    s.msg(c, { sender_kind: 'BUYER', body: 'Do you deliver?', sent_at: ago(30) });
    await openConversation(c);
    expect(await screen.findByText('Do you deliver?')).toBeOnTheScreen();
    return { s, c };
  }

  it('37, 40, 41, 52. a plain-text reply: "Sending", then shown once accepted, as the Store owner; the body is the text only', async () => {
    const { s, c } = await ready();
    const { gate, release } = held();
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, async (call) => {
      await gate;
      const m = s.msg(c, { sender_kind: 'SELLER', body: String(call.body?.text), sent_at: new Date().toISOString() });
      return { status: 201, body: { message_id: m.id, bot: null } };
    });
    await fireEvent.changeText(composer(), '  Yes, to Bole on Fridays.  ');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['buyer.chat.sending'])).toBeOnTheScreen();
    expect(screen.queryByText('Yes, to Bole on Fridays.')).toBeNull();
    await act(async () => release());
    expect(await screen.findByText('Yes, to Bole on Fridays.')).toBeOnTheScreen();
    expect(screen.getByText(en['seller.messages.sender.owner'])).toBeOnTheScreen();
    expect(composer().props.value).toBe('');
    const [sent] = sends();
    expect(sent!.body).toEqual({ text: 'Yes, to Bole on Fridays.' });
    expect(header(sent!)).toBe(A.id);
    expect(sent!.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('38, 39. empty text and text over 4,000 characters cannot be sent', async () => {
    await ready();
    await fireEvent.changeText(composer(), '   ');
    expect(sendButton()).toBeDisabled();
    await fireEvent.changeText(composer(), 'x'.repeat(4001));
    expect(screen.getByText('A message can be up to 4,000 characters.')).toBeOnTheScreen();
    expect(sendButton()).toBeDisabled();
    await fireEvent.press(sendButton());
    expect(sends()).toEqual([]);
  });

  it('42. a 403 on send: "your role cannot send", the text stays, no sign-out; the next attempt is a new intent', async () => {
    await ready({ sendDenied: [A.id] });
    await fireEvent.changeText(composer(), 'Thanks!');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['seller.messages.send_unavailable'])).toBeOnTheScreen();
    expect(composer().props.value).toBe('Thanks!');
    expect(memory.get(TOKEN_KEY)).toBe(GOOD_TOKEN);
    await fireEvent.press(sendButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [k1, k2] = sends().map((x) => x.headers['Idempotency-Key']);
    expect(k1).not.toBe(k2);
  });

  it('42 (404). a send refused as not found: "not available right now", the store selection stays', async () => {
    const { s, c } = await ready();
    const listReads = api.callsTo('GET /v1/seller/list').length;
    // The conversation is moved away from the store between the read and the send.
    s.convs.splice(s.convs.indexOf(c), 1);
    await fireEvent.changeText(composer(), 'Hello?');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['seller.messages.send_gone'])).toBeOnTheScreen();
    expect(api.callsTo('GET /v1/seller/list').length).toBe(listReads);
  });

  it('43, 44, 45. a timeout is "may already have been received": text frozen, Try sending again replays the same key, stored once', async () => {
    const { c } = await ready();
    let first = true;
    const keys = new Map<string, string>();
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, (call) => {
      const key = call.headers['Idempotency-Key']!;
      if (!keys.has(key)) {
        c.messages.unshift({ id: 'd0000000-0000-4000-8000-0000000000f1', sender_kind: 'SELLER', body: String(call.body?.text), sent_at: new Date().toISOString() });
        keys.set(key, 'd0000000-0000-4000-8000-0000000000f1');
      }
      if (first) {
        first = false;
        return 'hang';
      }
      return { status: 201, body: { message_id: keys.get(key), bot: null } };
    });
    await fireEvent.changeText(composer(), 'On my way');
    await fireEvent.press(sendButton());
    await act(() => jest.advanceTimersByTimeAsync(11_000));
    expect(await screen.findByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['buyer.chat.edit_unconfirmed'] })).toBeOnTheScreen();
    expect(composer().props.editable).toBe(false);
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [k1, k2] = sends().map((x) => x.headers['Idempotency-Key']);
    expect(k1).toBe(k2);
    await waitFor(() => expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull());
    expect(screen.getAllByText('On my way')).toHaveLength(1);
  });

  it('46. a second press while sending sends nothing', async () => {
    await ready();
    const { gate, release } = held();
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, async () => {
      await gate;
      return { status: 201, body: { message_id: 'd0000000-0000-4000-8000-0000000000f2', bot: null } };
    });
    await fireEvent.changeText(composer(), 'Once');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['buyer.chat.sending'])).toBeOnTheScreen();
    await fireEvent.press(sendButton());
    expect(sends()).toHaveLength(1);
    await act(async () => release());
    await waitFor(() => expect(composer().props.value).toBe(''));
  });

  it('47, 48. "Edit the message instead" gives the unconfirmed intent up; the edited text is a new key', async () => {
    await ready();
    let first = true;
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, () => {
      if (first) {
        first = false;
        return 'offline';
      }
      return { status: 201, body: { message_id: 'd0000000-0000-4000-8000-0000000000f3', bot: null } };
    });
    await fireEvent.changeText(composer(), 'Draft one');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.chat.edit_unconfirmed'] }));
    expect(composer().props.editable).toBe(true);
    await fireEvent.changeText(composer(), 'Draft two');
    await fireEvent.press(sendButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [k1, k2] = sends().map((x) => x.headers['Idempotency-Key']);
    expect(k1).not.toBe(k2);
    expect(sends()[1]!.body).toEqual({ text: 'Draft two' });
  });

  it('17, 49. switching stores during an unconfirmed reply: nothing is sent as store B, and B never reuses A\'s key', async () => {
    signedIn();
    const s = installServer({ sellers: [A, B] });
    const a1 = s.conv(A.id);
    s.msg(a1, { sender_kind: 'BUYER', body: 'Question for A', sent_at: ago(30) });
    const b1 = s.conv(B.id);
    s.msg(b1, { sender_kind: 'BUYER', body: 'Question for B', sent_at: ago(30) });
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Store A, Owner, Open' }));
    await act(() => router.push(`/seller/messages/${a1.id}`));
    expect(await screen.findByText('Question for A')).toBeOnTheScreen();
    const handler = (call: Recorded) => (header(call) === A.id ? ('offline' as const) : { status: 201, body: { message_id: 'd0000000-0000-4000-8000-0000000000f4', bot: null } });
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, handler);
    await fireEvent.changeText(composer(), 'Same words');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    await act(() => router.back());
    await fireEvent.press(await screen.findByRole('button', { name: en['seller.home.change_store'] }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Store B, Sales support, Open' }));
    await act(() => router.push(`/seller/messages/${b1.id}`));
    expect(await screen.findByText('Question for B')).toBeOnTheScreen();
    // B's composer starts empty: A's unconfirmed text and intent stayed with A.
    expect(composer().props.value).toBe('');
    expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull();
    await fireEvent.changeText(composer(), 'Same words');
    await fireEvent.press(sendButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [toA, toB] = sends();
    expect(header(toA!)).toBe(A.id);
    expect(header(toB!)).toBe(B.id);
    expect(toB!.path).toContain(b1.id);
    expect(toB!.headers['Idempotency-Key']).not.toBe(toA!.headers['Idempotency-Key']);
  });

  it('50, 51. signing out during a send: the late answer changes nothing and the old Account\'s conversation is not reachable', async () => {
    const { c } = await ready();
    const { gate, release } = held();
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, async () => {
      await gate;
      return { status: 201, body: { message_id: 'd0000000-0000-4000-8000-0000000000f5', bot: null } };
    });
    await fireEvent.changeText(composer(), 'Late reply');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['buyer.chat.sending'])).toBeOnTheScreen();
    await act(() => router.navigate('/account'));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
    const before = api.calls.length;
    await act(async () => release());
    await settle();
    // No re-read of the conversation or the list for a session that has ended.
    expect(api.calls.slice(before).filter((x) => x.path.startsWith('/v1/conversations'))).toEqual([]);
    await act(() => router.push(`/seller/messages/${c.id}`));
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    expect(screen.queryByText('Do you deliver?')).toBeNull();
    expect(api.calls.slice(before).filter((x) => x.path.startsWith('/v1/conversations'))).toEqual([]);
  });

  it('53. a team member\'s reply is the server\'s TEAM_MEMBER, shown as "Store team member"', async () => {
    signedIn();
    const s = installServer({ sellers: [B] });
    const c = s.conv(B.id);
    s.msg(c, { sender_kind: 'BUYER', body: 'Hi team', sent_at: ago(30) });
    await openConversation(c);
    expect(await screen.findByText('Hi team')).toBeOnTheScreen();
    await fireEvent.changeText(composer(), 'Hello from the team');
    await fireEvent.press(sendButton());
    expect(await screen.findByText('Hello from the team')).toBeOnTheScreen();
    expect(screen.getByText(en['seller.messages.sender.team'])).toBeOnTheScreen();
    expect(s.convs[0]!.messages[0]!.sender_kind).toBe('TEAM_MEMBER');
  });

  it('54. same Account on both sides: history and reply carry the store header, so the reply is the store\'s, not the Buyer\'s', async () => {
    const { c } = await ready({}, SELF_ACCOUNT);
    await fireEvent.changeText(composer(), 'Answering as the store');
    await fireEvent.press(sendButton());
    expect(await screen.findByText('Answering as the store')).toBeOnTheScreen();
    expect(c.messages[0]!.sender_kind).toBe('SELLER');
    expect(screen.getByText(en['seller.messages.sender.owner'])).toBeOnTheScreen();
    expect(histories().every((h) => header(h) === A.id)).toBe(true);
    expect(sends().every((x) => header(x) === A.id)).toBe(true);
  });
});

describe('security review fixes (WO-021)', () => {
  it('S21-01, S21-02. a 403 with any code is "not available for your role"; a refused read is not repeated on reconnect', async () => {
    signedIn();
    const s = installServer();
    const c = s.conv(A.id);
    api.on('GET /v1/conversations', () => problem(403, 'STEP_UP_REQUIRED', 'auth'));
    api.onPattern('GET', /^\/v1\/conversations\/[^/]+\/messages$/, () => problem(403, 'STEP_UP_REQUIRED', 'auth'));
    await openMessages();
    expect(await screen.findByText(en['seller.messages.unavailable'])).toBeOnTheScreen();
    await act(() => router.push(`/seller/messages/${c.id}`));
    await waitFor(() => expect(screen.getAllByText(en['seller.messages.unavailable']).length).toBeGreaterThanOrEqual(1));
    expect(screen.queryByLabelText(en['seller.messages.composer'])).toBeNull();
    const reads = histories().length;
    await act(async () => onlineManager.setOnline(false));
    await act(async () => onlineManager.setOnline(true));
    await act(() => jest.advanceTimersByTimeAsync(95_000));
    expect(histories().length).toBe(reads);
    expect(memory.get(TOKEN_KEY)).toBe(GOOD_TOKEN);
  });

  it('S21-03. a gateway 5xx without the API\'s answer, and an acceptance without a message id, are "may already have been received"; the key is kept', async () => {
    signedIn();
    const s = installServer();
    const c = s.conv(A.id);
    s.msg(c, { sender_kind: 'BUYER', body: 'Still open?', sent_at: ago(30) });
    await openConversation(c);
    expect(await screen.findByText('Still open?')).toBeOnTheScreen();
    let attempt = 0;
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, (call) => {
      attempt++;
      if (attempt === 1) return { status: 504, body: undefined };
      if (attempt === 2) return { status: 201, body: {} };
      const m = s.msg(c, { sender_kind: 'SELLER', body: String(call.body?.text), sent_at: new Date().toISOString() });
      return { status: 201, body: { message_id: m.id, bot: null } };
    });
    await fireEvent.changeText(composer(), 'Open until six');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    expect(composer().props.editable).toBe(false);
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    expect(await screen.findByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    await fireEvent.press(retryButton());
    expect(await screen.findByText('Open until six')).toBeOnTheScreen();
    const keys = new Set(sends().map((x) => x.headers['Idempotency-Key']));
    expect(sends()).toHaveLength(3);
    expect(keys.size).toBe(1);
  });
});

/**
 * WO-022: the shared send-outcome rule on the store's side (section 22, 31-42) and the Seller
 * messaging presentation (section 23, 43-60).
 */
describe('WO-022 store replies on the shared outcome rule', () => {
  async function ready() {
    signedIn();
    const s = installServer();
    const c = s.conv(A.id);
    s.msg(c, { sender_kind: 'BUYER', body: 'Any news?', sent_at: ago(30) });
    await openConversation(c);
    expect(await screen.findByText('Any news?')).toBeOnTheScreen();
    return { s, c };
  }
  /** Stores each key once; the first answers (in order) are lost on the way back. */
  function storing(s: ReturnType<typeof installServer>, c: Conv, lost: Reply[]) {
    const stored = new Map<string, string>();
    let attempt = 0;
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, (call) => {
      if (header(call) !== A.id) return problem(404, 'NOT_FOUND', 'request');
      const key = call.headers['Idempotency-Key']!;
      if (!stored.has(key)) stored.set(key, s.msg(c, { sender_kind: 'SELLER', body: String(call.body?.text), sent_at: new Date().toISOString() }).id);
      return lost[attempt++] ?? { status: 201, body: { message_id: stored.get(key), bot: null } };
    });
  }

  it.each([
    ['502 with an HTML page', { status: 502, unreadable: true } as Reply],
    ['503 with an empty body', { status: 503 } as Reply],
    ['201 with unreadable JSON', { status: 201, unreadable: true } as Reply],
    ['413 from a gateway, not the API', { status: 413, unreadable: true } as Reply],
  ])('32-34. a %s is "may already have been received"; the retry keeps the key; stored once', async (_name, reply) => {
    const { s, c } = await ready();
    storing(s, c, [reply]);
    await fireEvent.changeText(composer(), 'Tomorrow at ten');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    expect(composer().props.editable).toBe(false);
    // The conversation is read again: the reply the server stored is visible while the outcome is unknown.
    expect(await screen.findByText('Tomorrow at ten')).toBeOnTheScreen();
    await fireEvent.press(retryButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [a, b] = sends();
    expect(b!.headers['Idempotency-Key']).toBe(a!.headers['Idempotency-Key']);
    expect(header(b!)).toBe(A.id);
    await waitFor(() => expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull());
    await waitFor(() => expect(composer().props.value).toBe(''));
    expect(screen.getAllByText('Tomorrow at ten')).toHaveLength(1);
  });

  it('31, 52. the API\'s own refusal stays definite on the store\'s side (a problem answer is "not sent", the next attempt a new key)', async () => {
    const { s, c } = await ready();
    storing(s, c, [problem(500, 'INTERNAL', 'request')]);
    await fireEvent.changeText(composer(), 'Noted');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['buyer.chat.not_sent'])).toBeOnTheScreen();
    await fireEvent.press(sendButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [a, b] = sends();
    expect(b!.headers['Idempotency-Key']).not.toBe(a!.headers['Idempotency-Key']);
  });

  it('36 (switching). a changed conversation in the route starts clean: the store\'s unconfirmed reply is never sent to the other conversation', async () => {
    const { s } = await ready();
    const other = s.conv(A.id);
    s.msg(other, { sender_kind: 'BUYER', body: 'Second Buyer', sent_at: ago(20) });
    api.onPattern('POST', /^\/v1\/conversations\/[^/]+\/messages$/, (call) =>
      call.path.includes(other.id) ? { status: 201, body: { message_id: 'd0000000-0000-4000-8000-0000000000f9', bot: null } } : 'offline',
    );
    await fireEvent.changeText(composer(), 'For the first Buyer');
    await fireEvent.press(sendButton());
    expect(await screen.findByText(en['buyer.chat.maybe_not_sent'])).toBeOnTheScreen();
    await act(() => router.setParams({ conversationId: other.id }));
    expect(await screen.findByText('Second Buyer')).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.chat.maybe_not_sent'])).toBeNull();
    expect(composer().props.value).toBe('');
    await fireEvent.changeText(composer(), 'For the second Buyer');
    await fireEvent.press(sendButton());
    await waitFor(() => expect(sends()).toHaveLength(2));
    const [a, b] = sends();
    expect(b!.path).toContain(other.id);
    expect(b!.body).toEqual({ text: 'For the second Buyer' });
    expect(b!.headers['Idempotency-Key']).not.toBe(a!.headers['Idempotency-Key']);
  });
});

describe('WO-022 Seller messaging presentation', () => {
  it('43, 59. the inbox names the active store (verified name and handle) as its header; each row reads both times', async () => {
    signedIn();
    const s = installServer();
    s.conv(A.id, BUYER_ACCOUNT, ago(300));
    await openMessages();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByRole('header', { name: 'Conversations for Store A (@store-a)' })).toBeOnTheScreen();
    expect(screen.getByText(/^Started /)).toBeOnTheScreen();
    const label = rows()[0]!.props.accessibilityLabel as string;
    expect(label).toMatch(/^Buyer conversation, Last activity .+, Started .+$/);
    expect(label).not.toMatch(/beefbeef/);
    expect(rows()[0]!.props.accessibilityHint).toBe(en['seller.messages.open']);
  });

  it('44. with several stores, the inbox and the composer name the store that is open', async () => {
    signedIn();
    const s = installServer({ sellers: [A, B] });
    const b1 = s.conv(B.id);
    s.msg(b1, { sender_kind: 'BUYER', body: 'Hello B', sent_at: ago(30) });
    await renderRouter(APP_DIR, { initialUrl: '/seller' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Store B, Sales support, Open' }));
    await fireEvent.press(await screen.findByRole('button', { name: en['seller.messages.title'] }));
    expect(await screen.findByRole('header', { name: 'Conversations for Store B (@store-b)' })).toBeOnTheScreen();
    expect(screen.queryByText(/Store A/)).toBeNull();
    await waitFor(() => expect(rows()).toHaveLength(1));
    await fireEvent.press(rows()[0]!);
    expect(await screen.findByText('Hello B')).toBeOnTheScreen();
    expect(screen.getByTestId('seller-replying-as')).toHaveTextContent('Replies are sent as Store B (@store-b).');
  });

  it('45, 46. loading, then the empty sentence, under the store header', async () => {
    signedIn();
    installServer();
    const { gate, release } = held();
    api.on('GET /v1/conversations', async () => {
      await gate;
      return ok({ data: [], next_cursor: null });
    });
    await openMessages();
    expect(await screen.findByText(en['seller.messages.loading'])).toBeOnTheScreen();
    expect(screen.getByTestId('seller-messages-store')).toBeOnTheScreen();
    await act(async () => release());
    expect(await screen.findByText(en['seller.messages.empty'])).toBeOnTheScreen();
  });

  it('53, 58. a long unbroken message is drawn whole (no truncation), and rows grow with the text instead of a fixed height', async () => {
    signedIn();
    const s = installServer();
    const c = s.conv(A.id);
    const long = `https://example.test/${'x'.repeat(3000)}`;
    s.msg(c, { sender_kind: 'BUYER', body: long, sent_at: ago(30) });
    await openMessages();
    await waitFor(() => expect(rows()).toHaveLength(1));
    const style = StyleSheet.flatten(rows()[0]!.props.style);
    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBeGreaterThan(0);
    await fireEvent.press(rows()[0]!);
    const body = await screen.findByText(long);
    expect(body.props.numberOfLines).toBeUndefined();
  });

  it('54, 60. the conversation keeps the store\'s attribution; after sign-out the inbox and its store line are gone', async () => {
    signedIn();
    const s = installServer();
    const c = s.conv(A.id);
    s.msg(c, { sender_kind: 'TEAM_MEMBER', body: 'Team here', sent_at: ago(30) });
    await openConversation(c);
    expect(await screen.findByText('Team here')).toBeOnTheScreen();
    expect(screen.getByText(en['seller.messages.sender.team'])).toBeOnTheScreen();
    expect(screen.getByTestId('seller-replying-as')).toHaveTextContent('Replies are sent as Store A (@store-a).');
    await act(() => router.navigate('/account'));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    await act(() => router.push('/seller/messages'));
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    expect(screen.queryByTestId('seller-messages-store')).toBeNull();
    expect(screen.queryByText('Team here')).toBeNull();
  });
});
