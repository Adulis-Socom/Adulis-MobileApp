/**
 * features/conversation/Thread.tsx -- SC-21 Conversation (v1.2 S9).
 *
 * GET /v1/conversations/{id}/messages (keyset, newest first -- rendered
 * oldest-first, the way a person reads a thread) and POST .../messages.
 *
 * WHERE THE CHATBOT ANSWERED, THE MESSAGE IS MARKED AS SUCH -- a BOT row
 * carries template_key (a catalogue key, never prose) and resolution_path;
 * ESCALATED is the one escalation signal on the wire, and it renders as its
 * own line, since escalation is why the thread reached the seller at all.
 *
 * THE COMPOSER SENDS MANUAL TEXT ONLY. No generative assistance, no
 * suggested replies (S9: the deterministic chatbot is the ruled design and a
 * suggestion feature is the rejected LLM arriving through the side door).
 * The POST is runIdempotent -- the key is minted on mount and reminted on
 * success (the C-6 A1 class, transcribed from the start this time).
 *
 * D-73 -- THE ANCHOR RIDES THE MESSAGE, not the thread. This composer sends
 * anchorless text (legal; at most one of product_id/order_id may ride, and a
 * seller reply needs neither). The PINNED ORDER CARD derives from the most
 * recent order_id any loaded message carries -- there is no conversation-
 * level order on the wire, deliberately (D-73's whole point), so the pin is
 * a display of what the thread itself said, and absent when it said nothing.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { en, type MessageKey } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { ScreenState } from '../../components/ScreenState';
import { useIdempotencyKey } from '../../lib/idempotency';
import type { UiState, AdulisProblem } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { useMarketContext } from '../../lib/market';
import { timeFormatter } from '../../lib/intl';
import { usePoll } from '../../lib/poll';
import type { MessagePage, MessageRow } from './types';

function botText(m: MessageRow): string {
  const catalogue = en as Record<string, string>;
  const key = m.template_key ?? '';
  return catalogue[key as MessageKey] ?? key;
}

const SENDER_LABEL: Readonly<Record<string, string>> = {
  BUYER: en['console.inbox.thread.buyer'],
  SELLER: en['console.inbox.thread.seller'],
  TEAM_MEMBER: en['console.inbox.thread.seller'],
  BOT: en['console.inbox.thread.assistant'],
};

export function Thread() {
  const { sellerId, conversationId } = useParams<{ sellerId: string; conversationId: string }>();
  const market = useMarketContext();
  const [messages, setMessages] = useState<readonly MessageRow[] | null>(null);
  const [state, setState] = useState<UiState>('LOADING');
  const [loadProblem, setLoadProblem] = useState<AdulisProblem | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const sendKey = useIdempotencyKey();

  const load = useCallback(async () => {
    if (!sellerId || !conversationId) return;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<MessagePage>(`/conversations/${conversationId}/messages`, { sellerId });
      // The wire is newest-first; a thread reads oldest-first.
      setMessages([...r.data].reverse());
      setLoadProblem(null);
      setState('READY');
    } catch (e) {
      if (e instanceof ApiError) {
        setLoadProblem(e.problem);
        setState(stateFromProblem(e.problem));
      } else setState('TRANSPORT_ERROR');
    }
  }, [sellerId, conversationId]);

  useEffect(() => {
    void load();
  }, [load]);
  usePoll(() => void load(), 30_000);

  const send = async () => {
    if (!sellerId || !conversationId || !text.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        sellerId,
        idempotencyKey: sendKey.current(),
        body: { text: text.trim() },
      });
      sendKey.remint();
      setText('');
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'NO_PERMISSION') return null;
  if (messages === null) {
    return (
      <ScreenState
        state={state}
        onRetry={() => void load()}
        {...(loadProblem ? { problem: loadProblem } : {})}
      />
    );
  }

  const fmt = market ? timeFormatter(market) : null;
  const when = (iso: string) => (fmt ? fmt.format(new Date(iso)) : iso);
  // The pin: the most recent order any loaded message anchored (D-73 -- the
  // thread has no order of its own; its messages do).
  const pinnedOrder = [...messages].reverse().find((m) => m.order_id)?.order_id ?? null;

  return (
    <section aria-labelledby="thread-heading" data-screen="SC-21" className="thread">
      <h1 id="thread-heading">{en['console.inbox.thread.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {state === 'TRANSPORT_ERROR' ? (
        <p className="problem" role="alert">
          {en['console.common.refetch_failed']}
        </p>
      ) : null}

      {pinnedOrder ? (
        <div className="pinned-order callout">
          <span>{en['console.inbox.thread.order_context']}</span>
          <Link to={`/s/${sellerId}/orders/${pinnedOrder}`}>
            {en['console.inbox.thread.open_order']}
          </Link>
        </div>
      ) : null}

      <ol className="message-list">
        {messages.map((m) => (
          <li
            key={m.id}
            className={`message message-${m.sender_kind.toLowerCase()}`}
            data-sender={m.sender_kind}
          >
            <span className="message-sender">{SENDER_LABEL[m.sender_kind] ?? m.sender_kind}</span>
            <span className="message-time">{when(m.sent_at)}</span>
            {m.sender_kind === 'BOT' ? (
              <>
                <p className="message-body">{botText(m)}</p>
                {m.resolution_path === 'ESCALATED' ? (
                  // Escalation is WHY this thread reached the seller.
                  <p className="message-escalated warn">{en['console.inbox.thread.escalated']}</p>
                ) : null}
              </>
            ) : (
              <p className="message-body">{m.body}</p>
            )}
          </li>
        ))}
      </ol>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="seller-message">{en['console.inbox.thread.message_label']}</label>
        <textarea
          id="seller-message"
          placeholder={en['console.inbox.thread.placeholder']}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
        />
        {/* Manual replies only -- no suggestions, no drafting (S9). */}
        <button type="submit" className="button primary" disabled={busy || !text.trim()}>
          {en['console.inbox.thread.send']}
        </button>
      </form>
    </section>
  );
}
