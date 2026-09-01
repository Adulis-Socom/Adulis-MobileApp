/**
 * features/conversation/Inbox.tsx -- SC-20 Inbox (ADU-CON-03 v1.2 S9).
 *
 * GET /v1/conversations?as=seller&seller_id=... -- THE SCOPE PARAMETER IS
 * NOT OPTIONAL (R10): one account holds buyer and seller roles, and an
 * unscoped list interleaves a seller's business with their own shopping.
 * The server refuses a mismatch with SCOPE_PARAMETER_REQUIRED.
 *
 * WHAT THE WIRE CARRIES IS FOUR FIELDS -- id, buyer_account_id, started_at,
 * last_message_at. The wireframe drew buyer names, previews, unread badges,
 * linked orders and an unanswered filter; NONE of that rides the seller arm
 * (the buyer arm gets store_name+handle -- the D-153 asymmetry), and the DB
 * view's unanswered_count is never selected. Each absence is named ON SCREEN
 * (D-226) and nothing is faked: a row is "a buyer" plus the time of the last
 * message, which is truthfully everything this console knows.
 *
 * Polling: 30s while visible, paused when hidden (usePoll -- the rule is
 * S9's, the ~26%-of-origin-traffic number is ADU-CON-02-A1's).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { ScreenState } from '../../components/ScreenState';
import type { UiState, AdulisProblem } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { useMarketContext } from '../../lib/market';
import { timeFormatter } from '../../lib/intl';
import { usePoll } from '../../lib/poll';
import type { ConversationPage, ConversationRow } from './types';

export function Inbox() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [rows, setRows] = useState<readonly ConversationRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<UiState>('LOADING');
  const [loadProblem, setLoadProblem] = useState<AdulisProblem | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' || s === 'EMPTY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<ConversationPage>(`/conversations?as=seller&seller_id=${sellerId}`, {
        sellerId,
      });
      setRows(r.data);
      setNextCursor(r.next_cursor);
      setLoadProblem(null);
      setState(r.data.length === 0 ? 'EMPTY' : 'READY');
    } catch (e) {
      if (e instanceof ApiError) {
        setLoadProblem(e.problem);
        setState(stateFromProblem(e.problem));
      } else setState('TRANSPORT_ERROR');
    }
  }, [sellerId]);

  useEffect(() => {
    void load();
  }, [load]);
  usePoll(() => void load(), 30_000);

  const loadMore = async () => {
    if (!sellerId || !nextCursor) return;
    setProblem(null);
    try {
      const r = await api<ConversationPage>(
        `/conversations?as=seller&seller_id=${sellerId}&cursor=${encodeURIComponent(nextCursor)}`,
        { sellerId },
      );
      setRows((prev) => [...(prev ?? []), ...r.data]);
      setNextCursor(r.next_cursor);
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    }
  };

  if (state === 'NO_PERMISSION') return null;
  if (rows === null) {
    return (
      <ScreenState
        state={state}
        onRetry={() => void load()}
        {...(loadProblem ? { problem: loadProblem } : {})}
      />
    );
  }

  const fmt = market ? timeFormatter(market) : null;

  return (
    <section aria-labelledby="inbox-heading" data-screen="SC-20" className="inbox">
      <h1 id="inbox-heading">{en['console.inbox.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {state === 'TRANSPORT_ERROR' ? (
        <p className="problem" role="alert">
          {en['console.common.refetch_failed']}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="empty" data-state="EMPTY">
          <h3>{en['console.inbox.empty_heading']}</h3>
          <p>{en['console.inbox.empty_body']}</p>
          <Link className="button primary" to={`/s/${sellerId}/orders`}>
            {en['console.inbox.view_orders']}
          </Link>
        </div>
      ) : (
        <>
          {/* D-226: names, previews, unread markers, linked orders and the
              unanswered filter are what the wire does not carry -- said once,
              above the list, where the seller will look for them. */}
          <p className="hint">{en['console.inbox.columns_owed']}</p>
          <ul className="conversation-list">
            {rows.map((c) => (
              <li key={c.id} className="conversation-row">
                <Link to={`/s/${sellerId}/inbox/${c.id}`}>
                  <span className="conversation-buyer">{en['console.inbox.a_buyer']}</span>
                  <span className="conversation-time">
                    {fmt ? fmt.format(new Date(c.last_message_at)) : c.last_message_at}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {nextCursor ? (
            <button type="button" className="button" onClick={() => void loadMore()}>
              {en['console.inbox.load_more']}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
