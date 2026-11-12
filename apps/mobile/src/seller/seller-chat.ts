import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { ApiError, newIdempotencyKey } from '../api/client';
import type { BoundApi } from '../auth/session';
import { MESSAGE_MAX, acceptedMessage, messagesKey, rereadAfter, sendOutcome } from '../buyer/chat';
import { usePrivateApi } from '../buyer/saved';
import { SELLER_ID } from './seller-api';
import { SELLER } from './seller-context';

/**
 * Seller-side messaging (WO-021) on the existing Chat API, read and answered as the active store
 * (X-Adulis-Seller on every call, src/api/client.ts). Messages reuse the Buyer side's checked parser
 * (src/buyer/chat.ts); this file adds the store's conversation list and the reply intent.
 */

const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

export type StoreConversation = {
  id: string;
  /** Last activity (the server orders by it). Null if it is not a time. */
  lastMessageAt: string | null;
  startedAt: string | null;
};
export type StoreConversationPage = { data: StoreConversation[]; next_cursor: string | null };

/**
 * GET /v1/conversations?as=seller&seller_id= -> `{ data: [...], next_cursor }`. The store's rows carry
 * the conversation id, the Buyer's account id and two times (chat.conversation: started_at,
 * last_message_at). No Buyer name, photo or contact exists in the API, so none is shown, and the
 * Buyer's account id is not read at all (never a display label). No schema is published (W21-01): a
 * body that is not this shape is refused, a row without a valid id is dropped.
 */
export function parseStoreConversationPage(body: unknown): StoreConversationPage {
  const b = body as { data?: unknown; next_cursor?: unknown } | null;
  if (!b || !Array.isArray(b.data) || !(b.next_cursor === null || typeof b.next_cursor === 'string')) {
    throw new ApiError({ kind: 'unexpected', status: 200 });
  }
  const data: StoreConversation[] = [];
  for (const r of b.data as unknown[]) {
    if (!r || typeof r !== 'object') continue;
    const row = r as Record<string, unknown>;
    if (typeof row.id !== 'string' || !SELLER_ID.test(row.id)) continue;
    data.push({ id: row.id, lastMessageAt: isIso(row.last_message_at) ? row.last_message_at : null, startedAt: isIso(row.started_at) ? row.started_at : null });
  }
  return { data, next_cursor: b.next_cursor };
}

export const storeConversationsKey = (sellerId: string) => [SELLER, sellerId, 'conversations'] as const;

type Intent = { api: BoundApi; sellerId: string; conversationId: string; text: string; key: string };

/**
 * One reply at a time (the WO-013..016 model, store side):
 *
 * - The intent is the whole payload: session, store, conversation, text and its idempotency key. A
 *   retry of the same intent replays it under the same key (the server stores it at most once); any
 *   other payload is a new intent with a new key.
 * - Shown as sent only after the server accepts it (a message id in the answer); no queue, no
 *   optimistic message.
 * - The API's own refusal ends the intent; any other failure leaves the outcome unknown (the shared
 *   Chat rule, `sendOutcome` in src/buyer/chat.ts): the text is frozen until "Try sending again"
 *   (same key) or "Edit the message instead" (gives the intent up explicitly).
 * - The sender is never sent: the server derives owner or team member from the session and store.
 */
export function useStoreReply(sellerId: string, conversationId: string) {
  const qc = useQueryClient();
  const api = usePrivateApi();
  const [state, setState] = useState<'idle' | 'sending' | 'failed' | 'unknown'>('idle');
  const [error, setError] = useState<unknown>(null);
  const sending = useRef(false);
  const intent = useRef<Intent | null>(null);
  const frozen = state === 'unknown' && intent.current !== null;

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      if (!api || sending.current || text.length === 0 || text.length > MESSAGE_MAX) return false;
      if (!SELLER_ID.test(sellerId) || !SELLER_ID.test(conversationId)) return false;
      const held = intent.current;
      // An intent of another session, store or conversation is never replayed here.
      // The held session is compared by being current, not by object identity (review S21-06).
      const same = held !== null && held.api.isCurrent() && held.sellerId === sellerId && held.conversationId === conversationId;
      if (!same || held.text !== text) intent.current = { api, sellerId, conversationId, text, key: newIdempotencyKey() };
      const current = intent.current!;
      sending.current = true;
      setState('sending');
      setError(null);
      try {
        const body = await current.api.sendSellerMessage(current.sellerId, current.conversationId, current.text, current.key);
        // An acceptance without a readable message id may still have stored the reply: unknown (S21-03).
        if (!acceptedMessage(body)) throw new ApiError({ kind: 'unexpected', status: 201 });
        intent.current = null;
        if (!current.api.isCurrent()) return false;
        setState('idle');
        await qc.invalidateQueries({ queryKey: messagesKey({ as: 'seller', sellerId: current.sellerId }, current.conversationId) });
        void qc.invalidateQueries({ queryKey: storeConversationsKey(current.sellerId) });
        return true;
      } catch (failure) {
        const answered = sendOutcome(failure) === 'refused';
        if (answered) intent.current = null;
        if (!current.api.isCurrent()) return false;
        setError(failure);
        setState(answered ? 'failed' : 'unknown');
        // The message may have been stored, or the conversation may be gone: read it again (its own
        // read decides "not available"; a send refusal never does).
        if (rereadAfter(failure)) void qc.invalidateQueries({ queryKey: messagesKey({ as: 'seller', sellerId: current.sellerId }, current.conversationId) });
        return false;
      } finally {
        sending.current = false;
      }
    },
    [api, sellerId, conversationId, qc],
  );

  /** "Edit the message instead": the unconfirmed intent is given up; a new one gets a new key. */
  const abandon = useCallback(() => {
    if (sending.current) return;
    intent.current = null;
    setState('idle');
    setError(null);
  }, []);

  /** Editing after a definite refusal starts over (the refused intent has already ended). */
  const edited = useCallback(() => {
    setState((s) => (s === 'failed' ? 'idle' : s));
  }, []);

  return { state, error, frozen, send, abandon, edited };
}
