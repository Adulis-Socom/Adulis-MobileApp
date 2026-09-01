/**
 * features/trust/Claims.tsx -- SC-15 Claims list (v1.2 S10).
 *
 * GET /v1/seller/claims. THE EMPTY CLAIMS LIST IS GOOD NEWS AND READS THAT
 * WAY (S14: no action offered -- having no claims is a positive condition,
 * not a problem to fix). Open claims show their deadline inline, because
 * missing a response window changes the seller's operational outcome.
 *
 * Triggers and states are server enums; a seller reads WORDS (the
 * ITEM_LABEL rule -- unknown values render as themselves, never dropped).
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
import { timeFormatter, fillTemplate } from '../../lib/intl';
import type { ClaimPage, ClaimRow } from './types';

export const TRIGGER_LABEL: Readonly<Record<string, string>> = {
  SLA_BREACH: en['console.claims.trigger.sla_breach'],
  STOCK_NOT_UPDATED: en['console.claims.trigger.stock_not_updated'],
  GOODS_NOT_RECEIVED: en['console.claims.trigger.goods_not_received'],
  NOT_AS_DESCRIBED: en['console.claims.trigger.not_as_described'],
  REFUND_NOT_DELIVERED: en['console.claims.trigger.refund_not_delivered'],
};
export const CLAIM_STATE_LABEL: Readonly<Record<string, string>> = {
  AWAITING_SELLER_EVIDENCE: en['console.claims.state.awaiting_seller'],
  AWAITING_BUYER_EVIDENCE: en['console.claims.state.awaiting_buyer'],
  AWAITING_BANK_TRACE: en['console.claims.state.awaiting_bank'],
  UNDER_REVIEW: en['console.claims.state.under_review'],
  RESOLVED: en['console.claims.state.resolved'],
};

export function Claims() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [rows, setRows] = useState<readonly ClaimRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<UiState>('LOADING');
  const [loadProblem, setLoadProblem] = useState<AdulisProblem | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' || s === 'EMPTY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<ClaimPage>(`/seller/claims`, { sellerId });
      setProblem(null);
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

  const loadMore = async () => {
    if (!sellerId || !nextCursor) return;
    setProblem(null);
    try {
      const r = await api<ClaimPage>(`/seller/claims?cursor=${encodeURIComponent(nextCursor)}`, {
        sellerId,
      });
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
  const when = (iso: string | null) => (iso && fmt ? fmt.format(new Date(iso)) : (iso ?? ''));

  return (
    <section aria-labelledby="claims-heading" data-screen="SC-15" className="claims">
      <h1 id="claims-heading">{en['console.claims.list.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {state === 'TRANSPORT_ERROR' ? (
        <p className="problem" role="alert">
          {en['console.common.refetch_failed']}
        </p>
      ) : null}

      {rows.length === 0 ? (
        // Good news, no action -- deliberately (S14).
        <div className="empty" data-state="EMPTY">
          <h3>{en['console.claims.list.empty_heading']}</h3>
          <p>{en['console.claims.list.empty_body']}</p>
        </div>
      ) : (
        <>
          <ul className="claim-list">
            {rows.map((c) => (
              <li key={c.id} className="claim-card">
                <span className={`badge badge-${c.state === 'RESOLVED' ? 'resolved' : 'open'}`}>
                  {CLAIM_STATE_LABEL[c.state] ?? c.state}
                </span>
                <span className="claim-trigger">{TRIGGER_LABEL[c.trigger] ?? c.trigger}</span>
                <span className="claim-deadline">
                  {c.state === 'AWAITING_SELLER_EVIDENCE'
                    ? fillTemplate(en['console.claims.list.respond_by'], {
                        time: when(c.review_deadline),
                      })
                    : fillTemplate(en['console.claims.list.resolved_at'], {
                        time: when(c.opened_at),
                      })}
                </span>
                <Link to={`/s/${sellerId}/claims/${c.id}`}>
                  {c.state === 'RESOLVED'
                    ? en['console.claims.list.view_history']
                    : en['console.claims.list.open_claim']}
                </Link>
              </li>
            ))}
          </ul>
          {nextCursor ? (
            <button type="button" className="button" onClick={() => void loadMore()}>
              {en['console.claims.list.load_more']}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
