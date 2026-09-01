/**
 * features/trust/Analytics.tsx -- SC-12 Analytics (ADU-CON-03 v1.2 S10).
 *
 * GET /v1/seller/analytics/overview -- EVERY tier, five counts, 30-day
 * windows FIXED SERVER-SIDE. GET .../full -- entitlement-gated: the server
 * answers 409 TIER_LIMIT_REACHED when the tier's analytics_scope is null (or
 * no tier definition exists -- fail closed), and that answer IS the
 * NO_ENTITLEMENT rendering: the section stays visible, disabled, with the
 * unlock named (S3.5 -- "locked sections remain visible so sellers can
 * distinguish missing data from a plan entitlement").
 *
 * NO PERIOD PICKER (D-226): the wireframe drew 7/30/90-day options and the
 * work order names a 90-day window, but the wire accepts NO date parameters
 * -- every window is a hard-coded 30 days. A picker that changes nothing
 * teaches that controls are decorative; the fixed window is said in words
 * and the picker arrives with the wire.
 *
 * NO EXPORT CONTROL: POST .../export was deliberately not built (no worker,
 * no job table -- the API's own comment). Business's export is named as
 * owed, not wired to a 404.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { ScreenState } from '../../components/ScreenState';
import type { UiState, AdulisProblem } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import type { AnalyticsOverview, AnalyticsFull } from './types';

export function Analytics() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [full, setFull] = useState<AnalyticsFull | null>(null);
  const [fullLocked, setFullLocked] = useState(false);
  const [state, setState] = useState<UiState>('LOADING');
  const [loadProblem, setLoadProblem] = useState<AdulisProblem | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    setProblem(null);
    try {
      const o = await api<AnalyticsOverview>(`/seller/analytics/overview`, { sellerId });
      setOverview(o);
      try {
        const f = await api<AnalyticsFull>(`/seller/analytics/full`, { sellerId });
        setFull(f);
        setFullLocked(false);
      } catch (e) {
        // 409 TIER_LIMIT_REACHED is the entitlement answer, not an error:
        // the locked section renders. Anything else is a real failure.
        if (e instanceof ApiError && e.problem.code === 'TIER_LIMIT_REACHED') {
          setFull(null);
          setFullLocked(true);
        } else if (e instanceof ApiError && e.problem.status === 403) {
          // SALES_SUPPORT and INVENTORY hold basic:read and not full:read --
          // an absent permission renders NOTHING for the section (S3.4),
          // never a permission-denied banner on every visit.
          setFull(null);
          setFullLocked(false);
        } else if (e instanceof ApiError) {
          setProblem(e);
        }
      }
      setLoadProblem(null);
      setState('READY');
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

  if (state === 'NO_PERMISSION') return null;
  if (overview === null) {
    return (
      <ScreenState
        state={state}
        onRetry={() => void load()}
        {...(loadProblem ? { problem: loadProblem } : {})}
      />
    );
  }

  const noData =
    overview.products_published === 0 &&
    overview.orders_30d === 0 &&
    overview.active_reservations === 0 &&
    overview.completed_handoffs === 0 &&
    overview.followers === 0;

  return (
    <section aria-labelledby="analytics-heading" data-screen="SC-12" className="analytics">
      <h1 id="analytics-heading">{en['console.insights.analytics.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {state === 'TRANSPORT_ERROR' ? (
        <p className="problem" role="alert">
          {en['console.common.refetch_failed']}
        </p>
      ) : null}

      {noData ? (
        <div className="empty" data-state="EMPTY">
          <h3>{en['console.insights.analytics.empty_heading']}</h3>
          <p>{en['console.insights.analytics.empty_body']}</p>
        </div>
      ) : null}

      {/* The window is the SERVER's and fixed; a picker that changed nothing
          would be decorative (D-226). */}
      <p className="hint">{en['console.insights.analytics.window_note']}</p>

      <div className="kpi-tiles">
        <div className="kpi-tile">
          <span className="kpi-label">{en['console.insights.analytics.products_published']}</span>
          <span className="kpi-value">{overview.products_published}</span>
        </div>
        <div className="kpi-tile">
          <span className="kpi-label">{en['console.insights.analytics.orders_30d']}</span>
          <span className="kpi-value">{overview.orders_30d}</span>
        </div>
        <div className="kpi-tile">
          <span className="kpi-label">{en['console.insights.analytics.active_reservations']}</span>
          <span className="kpi-value">{overview.active_reservations}</span>
        </div>
        <div className="kpi-tile">
          <span className="kpi-label">{en['console.insights.analytics.completed_handoffs']}</span>
          <span className="kpi-value">{overview.completed_handoffs}</span>
        </div>
        <div className="kpi-tile">
          <span className="kpi-label">{en['console.insights.analytics.followers']}</span>
          <span className="kpi-value">{overview.followers}</span>
        </div>
      </div>

      {full ? (
        <section aria-labelledby="full-heading" className="analytics-full">
          <h2 id="full-heading">{en['console.insights.analytics.full_heading']}</h2>
          <div className="kpi-tiles">
            <div className="kpi-tile">
              <span className="kpi-label">{en['console.insights.analytics.storefront_views']}</span>
              <span className="kpi-value">{full.storefront_views_30d}</span>
            </div>
            <div className="kpi-tile">
              <span className="kpi-label">{en['console.insights.analytics.product_views']}</span>
              <span className="kpi-value">{full.product_views_30d}</span>
            </div>
            <div className="kpi-tile">
              <span className="kpi-label">{en['console.insights.analytics.reservations']}</span>
              <span className="kpi-value">{full.reservations_30d}</span>
            </div>
            <div className="kpi-tile">
              <span className="kpi-label">{en['console.insights.analytics.conversion']}</span>
              <span className="kpi-value">
                {full.view_to_reservation_rate === null
                  ? en['console.insights.analytics.rate_unavailable']
                  : `${(full.view_to_reservation_rate * 100).toFixed(1)}%`}
              </span>
            </div>
          </div>
        </section>
      ) : fullLocked ? (
        // S3.5: locked stays VISIBLE and disabled with the unlock named --
        // missing data and a plan entitlement must look different.
        <section aria-labelledby="locked-heading" className="analytics-full locked" data-state="NO_ENTITLEMENT">
          <h2 id="locked-heading">{en['console.insights.analytics.full_heading']}</h2>
          <p>{en['console.insights.analytics.full_locked']}</p>
          <button type="button" disabled>
            {en['console.insights.analytics.breakdown_view']}
          </button>
        </section>
      ) : null}

      {/* Export exists in no wire yet; Business's entitlement is named, the
          control is not faked at a 404 (D-226). */}
      <p className="hint">{en['console.insights.analytics.export_owed']}</p>
    </section>
  );
}
