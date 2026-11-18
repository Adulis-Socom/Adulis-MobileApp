import type { components } from '@adulis/api-client';
import { en } from '@adulis/locale/mobile';

import { ApiError, type ApiClient } from '../api/client';
import { blockersOf, confirmedDeletion, parsePreview, parseTicket } from './account';
import { acceptedEscalation, acceptedMessage, conversationIdOf, parseConversationPage, parseMessagePage } from './chat';
import { parseNotificationPage } from './notifications';

/**
 * The generated contract's answers for chat, notifications and Account deletion, typed exactly as the
 * contract allows, fed to the boundary checks the screens use. The annotations are the compile-time
 * gate (the API client must return these types); the assertions say what each check keeps and what
 * it still refuses, because the types describe the server and not what arrived over the network.
 */
type S = components['schemas'];
type Answer<K extends keyof ApiClient> = Awaited<ReturnType<ApiClient[K]>>;

// Compile-time gate (pnpm typecheck): every method below answers its contract type, never `unknown`.
type Typed<T> = unknown extends T ? { answerIsUnknown: true } : true;
export const typedAnswers: [
  Typed<Answer<'openConversation'>>,
  Typed<Answer<'conversations'>>,
  Typed<Answer<'conversationMessages'>>,
  Typed<Answer<'sendMessage'>>,
  Typed<Answer<'escalateConversation'>>,
  Typed<Answer<'notifications'>>,
  Typed<Answer<'markNotificationRead'>>,
  Typed<Answer<'verifyDeletionOtp'>>,
  Typed<Answer<'deletionPreview'>>,
  Typed<Answer<'confirmDeletion'>>,
] = [true, true, true, true, true, true, true, true, true, true];

const ID = (n: number) => `0b6f1a3e-aaaa-4aaa-8aaa-${n.toString(16).padStart(12, '0')}`;
const AT = '2026-11-18T08:00:00.000Z';
const t = (key: keyof typeof en) => en[key];

describe('chat answers', () => {
  it('a conversation opened by the contract is accepted, and an id that is not a UUID is not', () => {
    const opened: Answer<'openConversation'> = { conversation_id: ID(1) } satisfies S['ConversationOpenedDto'];
    expect(conversationIdOf(opened)).toBe(ID(1));
    expect(() => conversationIdOf({ conversation_id: 'not-an-id' })).toThrow(ApiError);
    expect(() => conversationIdOf({})).toThrow(ApiError);
  });

  it('the Buyer conversation list keeps the fields the screen draws; the union may also hold a store row, which is dropped', () => {
    const buyer = { id: ID(2), seller_id: ID(3), store_name: 'Store 1', handle: 'seller-1', started_at: AT, last_message_at: AT } satisfies S['BuyerConversationDto'];
    const store = { id: ID(4), buyer_account_id: ID(5), started_at: AT, last_message_at: AT } satisfies S['SellerConversationDto'];
    const page: Answer<'conversations'> = { data: [buyer, store], next_cursor: null } satisfies S['ConversationPageDto'];
    expect(parseConversationPage(page)).toEqual({
      items: [{ id: ID(2), storeName: 'Store 1', handle: 'seller-1', lastMessageAt: AT }],
      nextCursor: null,
    });
  });

  it('the history keeps human rows by kind and a bot row by its template key, with the escalated mark', () => {
    const human = (n: number, kind: S['HumanMessageDto']['sender_kind'], overrides: Partial<S['HumanMessageDto']> = {}): S['HumanMessageDto'] => ({
      id: ID(n), sender_kind: kind, body: `text ${n}`, locale: 'en', sent_at: AT, read_at: null, product_id: null, order_id: null, ...overrides,
    });
    const bot = (n: number, path: S['BotMessageDto']['resolution_path']): S['BotMessageDto'] => ({
      id: ID(n), sender_kind: 'BOT', resolution_path: path, sent_at: AT, slots: {}, template_key: 'chat.bot.escalated',
    });
    const page: Answer<'conversationMessages'> = {
      data: [human(10, 'BUYER', { product_id: ID(99) }), human(11, 'SELLER'), human(12, 'TEAM_MEMBER', { order_id: ID(98) }), bot(13, 'ESCALATED'), bot(14, null)],
      next_cursor: AT,
    } satisfies S['MessagePageDto'];
    const { items, nextCursor } = parseMessagePage(page);
    expect(nextCursor).toBe(AT);
    expect(items.map((m) => [m.id, m.kind, m.body, m.templateKey, m.aboutProduct, m.aboutOrder, m.escalated])).toEqual([
      [ID(10), 'BUYER', 'text 10', null, true, false, false],
      [ID(11), 'SELLER', 'text 11', null, false, false, false],
      [ID(12), 'TEAM_MEMBER', 'text 12', null, false, true, false],
      [ID(13), 'BOT', null, 'chat.bot.escalated', false, false, true],
      [ID(14), 'BOT', null, 'chat.bot.escalated', false, false, false],
    ]);
  });

  it('a row the contract does not describe is dropped rather than attributed: an unknown sender, a bad id, a bot without a template', () => {
    const row = { id: ID(20), sender_kind: 'BUYER', body: 'hi', sent_at: AT };
    const { items } = parseMessagePage({
      data: [
        row,
        { ...row, id: ID(21), sender_kind: 'OPERATOR' },
        { ...row, id: 'not-an-id' },
        { ...row, id: ID(22), sent_at: 'yesterday' },
        { id: ID(23), sender_kind: 'BOT', sent_at: AT },
        { ...row, id: ID(24), body: null },
      ],
      next_cursor: null,
    });
    expect(items.map((m) => m.id)).toEqual([ID(20)]);
  });

  it('a send is accepted only with a message id, whatever else the body holds', () => {
    const sent: Answer<'sendMessage'> = { message_id: ID(30), bot: null } satisfies S['MessageSentDto'];
    expect(acceptedMessage(sent)).toBe(true);
    const withBot: Answer<'sendMessage'> = { message_id: ID(31), bot: { bot_message_id: ID(32), resolution_path: 'ESCALATED' } } satisfies S['MessageSentDto'];
    expect(acceptedMessage(withBot)).toBe(true);
    for (const body of [{ bot: null }, { message_id: 'x' }, null, 'ok', undefined]) expect(acceptedMessage(body)).toBe(false);
  });

  it('an escalation is confirmed only by escalated: true and the escalation message id', () => {
    const done: Answer<'escalateConversation'> = { escalated: true, bot_message_id: ID(40) } satisfies S['ConversationEscalatedDto'];
    expect(acceptedEscalation(done)).toBe(true);
    for (const body of [{}, { escalated: true }, { escalated: false, bot_message_id: ID(40) }, { escalated: true, bot_message_id: 'x' }, null, 'ok']) {
      expect(acceptedEscalation(body)).toBe(false);
    }
  });
});

describe('notification answers', () => {
  it('a page of the contract keeps its rows; a row without a template or a valid time is dropped', () => {
    const n = (id: number, overrides: Partial<S['NotificationDto']> = {}): S['NotificationDto'] => ({
      id: ID(id), locale: 'en', order_id: null, read_at: null, scheduled_for: AT, slots: {}, suppressible: true, template_key: 'notification.buyer.test', ...overrides,
    });
    const page: Answer<'notifications'> = { data: [n(50), n(51, { read_at: AT, suppressible: false, order_id: ID(97) })], next_cursor: AT } satisfies S['NotificationPageDto'];
    const parsed = parseNotificationPage(page);
    expect(parsed.items.map((x) => [x.id, x.readAt, x.suppressible, x.aboutOrder])).toEqual([
      [ID(50), null, true, false],
      [ID(51), AT, false, true],
    ]);
    expect(parseNotificationPage({ data: [{ ...n(52), template_key: undefined }, { ...n(53), scheduled_for: 'soon' }], next_cursor: null }).items).toEqual([]);
    expect(() => parseNotificationPage({ data: 'x', next_cursor: null })).toThrow(ApiError);
  });

  it('a mark-as-read answer is typed with its read time', () => {
    const read: Answer<'markNotificationRead'> = { read_at: AT } satisfies S['NotificationReadDto'];
    expect(read.read_at).toBe(AT);
  });
});

describe('Account deletion answers', () => {
  it('a ticket of the contract is accepted with the earlier of its expiry and fifteen minutes', () => {
    const issued: Answer<'verifyDeletionOtp'> = { ticket: ID(60), expires_at: '2026-11-18T08:30:00.000Z', scope: 'ACCOUNT_DELETION' } satisfies S['DeletionTicketDto'];
    const at = Date.parse(AT);
    expect(parseTicket(issued, at)).toEqual({ ticket: ID(60), deadline: at + 15 * 60 * 1000 });
    expect(() => parseTicket({ ...issued, scope: 'SIGN_IN' }, at)).toThrow(ApiError);
    expect(() => parseTicket({ ...issued, ticket: 'x' }, at)).toThrow(ApiError);
  });

  it('a preview of the contract renders effects and a blocker with its subject; a line the catalogue lacks withholds confirmation', () => {
    const preview: Answer<'deletionPreview'> = {
      effects: [{ code: 'IDENTITY_SCRUBBED', message_key: 'deletion.effect.identity_scrubbed' }],
      items: [{ code: 'OPEN_CLAIMS', message_key: 'deletion.blocker.open_claims', resolving_action: { kind: 'RESOLVE_CLAIMS' }, slots: { count: 2 }, subject: { id: ID(70), kind: 'SELLER' } }],
    } satisfies S['DeletionPreviewDto'];
    const rendered = parsePreview(t, preview);
    expect(rendered.incomplete).toBe(false);
    expect(rendered.blockers.map((b) => b.key)).toEqual(['deletion.blocker.open_claims']);
    expect(rendered.effects.map((e) => e.key)).toEqual(['deletion.effect.identity_scrubbed']);
    expect(parsePreview(t, { ...preview, effects: [{ code: 'NEW', message_key: 'deletion.effect.something_new' }] }).incomplete).toBe(true);
    expect(() => parsePreview(t, { effects: [] })).toThrow(ApiError);
    expect(blockersOf(t, new Error('x'))).toBeNull();
  });

  it('a deletion is confirmed only by deleted: true', () => {
    const done: Answer<'confirmDeletion'> = { deleted: true } satisfies S['DeletionConfirmedDto'];
    expect(confirmedDeletion(done)).toBe(true);
    for (const body of [{}, { deleted: 'true' }, { deleted: false }, null]) expect(confirmedDeletion(body)).toBe(false);
  });
});
