import type { MobileMessageKey } from '@adulis/locale/mobile';
import { useInfiniteQuery } from '@tanstack/react-query';

import { ApiError, isTransient, problemCode, type ApiFailure } from '../api/client';
import { fillSlots } from '../api/messages';
import { useSession } from '../auth/session';
import { hasMessage } from '../i18n/i18n';
import { SELLER } from '../seller/seller-context';
import { keepIfCurrent } from './saved';

/**
 * Buyer messaging (WO-013): the supported subset of the existing Chat API (ADU-CHAT-01 v3.3 is
 * not built in full; docs/mobile/WO-013-CHAT-CONTRACT-GAPS.md). Server state only, bound to the
 * session on screen (a late answer for an earlier session is refused) and cleared with the whole
 * cache by clearSession. The API publishes no schemas, so every answer is checked here; a row that
 * is not one (or whose sender cannot be attributed) is not shown.
 */

export const MESSAGE_MAX = 4000; // the server's limit (chat.controller: text max 4000)
export const CONVERSATIONS = 'buyer-conversations';
export const MESSAGES = 'conversation-messages';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const retry = (failures: number, error: unknown) => isTransient(error) && failures < 2;
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const contractFailure = () => new ApiError({ kind: 'unexpected', status: 200 });

export const isConversationRef = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** Whose side reads a conversation (WO-021): the Buyer's, or one store's (every request names it). */
export type ChatScope = { as: 'buyer' } | { as: 'seller'; sellerId: string };
const BUYER_SIDE: ChatScope = { as: 'buyer' };
/** A store's conversations live under that store's key only, never the Buyer's. */
export const messagesKey = (scope: ChatScope, ref: string) =>
  scope.as === 'buyer' ? [MESSAGES, ref] : [SELLER, scope.sellerId, 'conversation', ref];
/** Any 403 problem: on a store's side it means this role (or surface) may not use the inbox (WO-021 review S21-01). */
export const isForbidden = (error: unknown) => error instanceof ApiError && error.failure.kind === 'problem' && error.failure.status === 403;
/**
 * A refusal that a re-read cannot change, so nothing re-reads on it: the Buyer side stops on
 * NOT_FOUND (WO-013, unchanged); a store's side also on any 400 or 403 (WO-021 review S21-01, S21-07).
 */
const isFinal = (scope: ChatScope, error: unknown) =>
  problemCode(error) === 'NOT_FOUND' ||
  (scope.as === 'seller' && error instanceof ApiError && error.failure.kind === 'problem' && (error.failure.status === 400 || error.failure.status === 403));
type Settled = { state: { error: unknown } };

export type Conversation = { id: string; storeName: string; handle: string; lastMessageAt: string };
export type SenderKind = 'BUYER' | 'SELLER' | 'TEAM_MEMBER' | 'BOT';
export type ChatMessage = {
  id: string;
  kind: SenderKind;
  /** A human message's text, exactly as sent. */
  body: string | null;
  /** A bot message's template key (never prose; rendered from the catalogue or not at all). */
  templateKey: string | null;
  sentAt: string;
  aboutProduct: boolean;
  aboutOrder: boolean;
  /** The bot's own escalation turn (not an answer the Buyer can escalate). */
  escalated: boolean;
};
type Page<T> = { items: T[]; nextCursor: string | null };

function page<T>(body: unknown, row: (r: Record<string, unknown>) => T | null): Page<T> {
  const b = body as { data?: unknown; next_cursor?: unknown } | null;
  if (!b || !Array.isArray(b.data) || !(b.next_cursor === null || typeof b.next_cursor === 'string')) throw contractFailure();
  return {
    items: b.data.map((r) => (r && typeof r === 'object' ? row(r as Record<string, unknown>) : null)).filter((x): x is T => x !== null),
    nextCursor: b.next_cursor,
  };
}

export const parseConversationPage = (body: unknown) =>
  page<Conversation>(body, (r) =>
    typeof r.id === 'string' && UUID.test(r.id) && typeof r.store_name === 'string' && typeof r.handle === 'string' && isIso(r.last_message_at)
      ? { id: r.id, storeName: r.store_name, handle: r.handle, lastMessageAt: r.last_message_at }
      : null,
  );

const KINDS: readonly SenderKind[] = ['BUYER', 'SELLER', 'TEAM_MEMBER', 'BOT'];

export const parseMessagePage = (body: unknown) =>
  page<ChatMessage>(body, (r) => {
    const kind = r.sender_kind as SenderKind;
    if (typeof r.id !== 'string' || !UUID.test(r.id) || !KINDS.includes(kind) || !isIso(r.sent_at)) return null;
    if (kind === 'BOT') {
      if (typeof r.template_key !== 'string') return null;
      return {
        id: r.id,
        kind,
        body: null,
        templateKey: r.template_key,
        sentAt: r.sent_at,
        aboutProduct: false,
        aboutOrder: false,
        escalated: r.resolution_path === 'ESCALATED',
      };
    }
    if (typeof r.body !== 'string') return null;
    return {
      id: r.id,
      kind,
      body: r.body,
      templateKey: null,
      sentAt: r.sent_at,
      aboutProduct: typeof r.product_id === 'string',
      aboutOrder: typeof r.order_id === 'string',
      escalated: false,
    };
  });

/** POST /v1/conversations' answer: `{ conversation_id }`. */
export function conversationIdOf(body: unknown): string {
  const id = (body as { conversation_id?: unknown } | null)?.conversation_id;
  if (!isConversationRef(id)) throw contractFailure();
  return id;
}

/** POST .../messages' answer: `{ message_id, bot }`. Accepted only with a message id. */
export function acceptedMessage(body: unknown): boolean {
  return isConversationRef((body as { message_id?: unknown } | null)?.message_id);
}

/**
 * What a message send that did not return an accepted message proves (WO-022; review S21-03), for
 * the Buyer's messages and a store's replies alike:
 *
 * - `refused`: the API answered with its own problem: the contract's envelope (ProblemDto's required
 *   `title_key`, `request_id`, `retryable`, and a `status` equal to the HTTP status), any status. A
 *   gateway's `{ code }` alone is not one (review S22-01). The outcome is
 *   known: the message was not stored, or the server keeps that refusal against the key, which a
 *   replay would only repeat. The intent ends; the next attempt gets a new key.
 * - `unknown`: anything else. That covers a lost connection, a timeout, a gateway's answer without
 *   the API's problem body (a 502/503/504 page, an empty body), and a 201 whose body cannot be read
 *   or names no message (thrown as `unexpected 201` by the caller). The message may have been
 *   stored, so the intent (text, Product, conversation, key) is kept for a replay or an explicit
 *   "edit instead".
 *
 * Chat sends only: every other mutation keeps the shared `wasAnswered`.
 */
export function sendOutcome(failure: unknown): 'refused' | 'unknown' {
  return failure instanceof ApiError && isApiProblem(failure.failure) ? 'refused' : 'unknown';
}

function isApiProblem(f: ApiFailure): boolean {
  if (f.kind !== 'problem') return false;
  const p = f.problem as { title_key?: unknown; request_id?: unknown; retryable?: unknown; status?: unknown };
  return typeof p.title_key === 'string' && typeof p.request_id === 'string' && typeof p.retryable === 'boolean' && p.status === f.status;
}

/**
 * Whether to read the conversation again after a failed send: always when the outcome is unknown,
 * and after a refusal that may still sit beside a stored message (a 5xx or a conflict on the key)
 * or that may mean the conversation is gone (404). The re-read shows what the server holds before
 * the person sends anything new (review S22-01).
 */
export function rereadAfter(failure: unknown): boolean {
  if (sendOutcome(failure) === 'unknown') return true;
  const f = (failure as ApiError).failure as Extract<ApiFailure, { kind: 'problem' }>;
  return f.status >= 500 || f.status === 409 || f.problem.code === 'NOT_FOUND';
}

/** The only catalogue namespace a bot message may render from (CHATBOT-01: no model prose). */
const BOT_TEMPLATES = 'chat.bot.';

/**
 * A bot message's sentence: its catalogue sentence when the template key is a chat.bot.* key with
 * every slot present; otherwise the neutral unavailable sentence. A raw template key, a seller-
 * written resource the app has no catalogue entry for, or a sentence with holes is never shown.
 */
export function botText(t: (key: MobileMessageKey) => string, m: ChatMessage): string {
  const key = m.templateKey;
  if (key !== null && key.startsWith(BOT_TEMPLATES) && hasMessage(key)) {
    const filled = fillSlots(t(key), {});
    if (filled) return filled;
  }
  return t('buyer.chat.bot_unavailable');
}

/**
 * The server writes a Buyer message and its automated answer in one transaction, so both carry the
 * same sent_at and the server's order between them is undefined (ON-20261111-153). Newest first,
 * an automated answer sorts before the human message it shares a time with, so it is drawn after
 * the question it answers.
 */
const newestFirst = (a: ChatMessage, b: ChatMessage) =>
  b.sentAt.localeCompare(a.sentAt) || (a.kind === 'BOT' ? 0 : 1) - (b.kind === 'BOT' ? 0 : 1);

/**
 * The automated answer the Buyer may escalate: the newest group of messages (one sent_at) holds an
 * answer and no escalation. Null otherwise.
 */
export function escalatableAnswer(items: readonly ChatMessage[]): ChatMessage | null {
  const newest = items[0]?.sentAt;
  const group = items.filter((m) => m.sentAt === newest && m.kind === 'BOT');
  const escalated = group.some((m) => m.escalated || m.templateKey === 'chat.bot.escalated');
  return escalated ? null : (group[0] ?? null);
}

/** De-duplicated, in the order given (pages are cut by timestamp). */
function unique<T extends { id: string }>(pages: Page<T>[] | undefined): T[] {
  const seen = new Set<string>();
  return (pages ?? []).flatMap((p) => p.items).filter((x) => !seen.has(x.id) && seen.add(x.id));
}

const nextOf = <T>(last: Page<T>, _all: Page<T>[], lastParam: string | null) =>
  last.nextCursor !== null && last.nextCursor !== lastParam ? last.nextCursor : null;

/** The Buyer's conversations, newest activity first. Older pages load only when asked. */
export function useConversations() {
  const { session, boundApi } = useSession();
  const token = session.status === 'signedIn' ? session.token : null;
  const query = useInfiniteQuery({
    queryKey: [CONVERSATIONS],
    queryFn: async ({ pageParam }: { pageParam: string | null }) =>
      parseConversationPage(await keepIfCurrent(boundApi(token!), (api) => api.conversations(pageParam))),
    initialPageParam: null as string | null,
    getNextPageParam: nextOf<Conversation>,
    enabled: token !== null,
    retry,
  });
  return { ...query, items: unique(query.data?.pages) };
}

/**
 * One conversation's messages, NEWEST FIRST (the server's order; the screen draws them bottom-up).
 * While the screen is focused and the app is in the foreground it re-reads every 30 seconds (the
 * design's bounded foreground polling); nothing runs in the background. WO-021: `scope` reads it as
 * one store (X-Adulis-Seller on every request, the store's own cache entry, kept only while shown).
 */
export function useConversationMessages(conversationRef: string | null, focused: boolean, scope: ChatScope = BUYER_SIDE) {
  const { session, boundApi } = useSession();
  const token = session.status === 'signedIn' ? session.token : null;
  const query = useInfiniteQuery({
    queryKey: messagesKey(scope, conversationRef ?? ''),
    queryFn: async ({ pageParam }: { pageParam: string | null }) =>
      parseMessagePage(
        await keepIfCurrent(boundApi(token!), (api) =>
          scope.as === 'buyer'
            ? api.conversationMessages(conversationRef!, pageParam)
            : api.sellerConversationMessages(scope.sellerId, conversationRef!, pageParam),
        ),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: nextOf<ChatMessage>,
    enabled: token !== null && conversationRef !== null,
    // Not on a conversation the server says is not available, or that this side may not read.
    refetchInterval: (q) => (focused && !isFinal(scope, q.state.error) ? 30_000 : false),
    // A store's refused read is not repeated on return to the foreground or on reconnect either (S21-02).
    ...(scope.as === 'seller'
      ? { gcTime: 0, refetchOnWindowFocus: (q: Settled) => !isFinal(scope, q.state.error), refetchOnReconnect: (q: Settled) => !isFinal(scope, q.state.error) }
      : null),
    retry,
  });
  return { ...query, items: unique(query.data?.pages).sort(newestFirst) };
}
