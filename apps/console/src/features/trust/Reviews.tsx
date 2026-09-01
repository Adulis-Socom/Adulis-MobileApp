/**
 * features/trust/Reviews.tsx -- SC-14 Reviews (v1.2 S10).
 *
 * GET /v1/seller/reviews, and NOTHING ELSE EXISTS: no reply, no hide, no
 * dispute, no report-this-review -- the schema has no seller-writable column
 * on review, the API has no such route, and this screen has NO AFFORDANCE.
 * The forbidden list IS the design; a control here would be the load-bearing
 * absence "completed".
 *
 * The empty state explains the QR gate -- reviews unlock when a buyer scans
 * at handoff -- which is also the honest explanation of why reviews are
 * scarce and trustworthy.
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
import type { ReviewPage, ReviewRow } from './types';

export function Reviews() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [rows, setRows] = useState<readonly ReviewRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<UiState>('LOADING');
  const [loadProblem, setLoadProblem] = useState<AdulisProblem | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' || s === 'EMPTY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<ReviewPage>(`/seller/reviews`, { sellerId });
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
      const r = await api<ReviewPage>(
        `/seller/reviews?cursor=${encodeURIComponent(nextCursor)}`,
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
    <section aria-labelledby="reviews-heading" data-screen="SC-14" className="reviews">
      <h1 id="reviews-heading">{en['console.insights.reviews.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {state === 'TRANSPORT_ERROR' ? (
        <p className="problem" role="alert">
          {en['console.common.refetch_failed']}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="empty" data-state="EMPTY">
          <h3>{en['console.insights.reviews.empty_heading']}</h3>
          <p>{en['console.insights.reviews.empty_body']}</p>
          <Link className="button primary" to={`/s/${sellerId}/orders`}>
            {en['console.insights.reviews.open_orders']}
          </Link>
        </div>
      ) : (
        <>
          <ul className="review-list">
            {rows.map((r) => (
              <li key={r.id} className="review-card">
                <span className="review-rating">
                  {fillTemplate(en['console.insights.reviews.rating'], {
                    n: String(r.seller_rating),
                  })}
                </span>
                {r.badge ? <span className="badge badge-review">{r.badge}</span> : null}
                <Link to={`/s/${sellerId}/orders/${r.order_id}`} className="review-order">
                  {en['console.insights.reviews.open_order']}
                </Link>
                <span className="review-date">
                  {fmt ? fmt.format(new Date(r.published_at)) : r.published_at}
                </span>
                {r.item_ratings.length > 0 ? (
                  <span className="review-items">
                    {fillTemplate(en['console.insights.reviews.item_ratings'], {
                      n: String(r.item_ratings.length),
                    })}
                  </span>
                ) : null}
                {r.body ? <p className="review-body">{r.body}</p> : null}
              </li>
            ))}
          </ul>
          {nextCursor ? (
            <button type="button" className="button" onClick={() => void loadMore()}>
              {en['console.insights.reviews.load_more']}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
