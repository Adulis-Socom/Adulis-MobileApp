/**
 * features/trust/Analytics.tsx -- SC-12 Analytics (ADU-CON-03 v1.2 S10).
 *
 * GET /v1/seller/analytics/overview -- EVERY tier, five counts, over the
 * chosen [from, to] window (default: the trailing 30 days). GET .../full --
 * entitlement-gated: the server
 * answers 409 TIER_LIMIT_REACHED when the tier's analytics_scope is null (or
 * no tier definition exists -- fail closed), and that answer IS the
 * NO_ENTITLEMENT rendering: the section stays visible, disabled, with the
 * unlock named (S3.5 -- "locked sections remain visible so sellers can
 * distinguish missing data from a plan entitlement").
 *
 * THE PERIOD PICKER IS REAL NOW (T15 Phase 4): the wire takes an inclusive
 * [from, to] of ISO dates on both reads, so the 7/30/90-day options the
 * wireframe drew actually change the answer. The resolved window comes back
 * once (`window: {from, to}`, v1.10 S12.13) and renders as the caption -- the server's own
 * statement of what the numbers cover, never a client assumption.
 *
 * NO EXPORT CONTROL: POST .../export was deliberately not built (no worker,
 * no job table -- the API's own comment). Business's export is named as
 * owed, not wired to a 404. That keep is deliberate.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { ScreenState } from '../../components/ScreenState';
import type { UiState, AdulisProblem } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { fillTemplate } from '../../lib/intl';
import type { AnalyticsOverview, AnalyticsFull } from './types';

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

export function Analytics() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [full, setFull] = useState<AnalyticsFull | null>(null);
  const [fullLocked, setFullLocked] = useState(false);
  const [state, setState] = useState<UiState>('LOADING');
  const [loadProblem, setLoadProblem] = useState<AdulisProblem | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [period, setPeriod] = useState<Period>(30);
  // Two quick period clicks race; only the latest load may commit (the C-7
  // generation-counter lesson, D-227).
  const loadGen = useRef(0);

  const load = useCallback(async (days: Period) => {
    if (!sellerId) return;
    const gen = ++loadGen.current;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    setProblem(null);
    // A trailing window of N days: `from` rides the wire, `to` defaults to
    // now server-side. A date for a FILTER is a query parameter, not business
    // state -- the numbers themselves stay the server's.
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const q = `?from=${from}`;
    try {
      const o = await api<AnalyticsOverview>(`/seller/analytics/overview${q}`, { sellerId });
      if (gen !== loadGen.current) return;
      setOverview(o);
      try {
        const f = await api<AnalyticsFull>(`/seller/analytics/full${q}`, { sellerId });
        if (gen !== loadGen.current) return;
        setFull(f);
        setFullLocked(false);
      } catch (e) {
        // Guarded like the success path (pass M5): a STALE generation's
        // failure must not banner over, or erase the failure of, the load
        // that owns the screen.
        if (gen !== loadGen.current) return;
        // Whatever the failure, the PREVIOUS window's full tiles must not
        // keep rendering under this window's caption (pass M6).
        setFull(null);
        // 409 TIER_LIMIT_REACHED is the entitlement answer, not an error:
        // the locked section renders. Anything else is a real failure.
        if (e instanceof ApiError && e.problem.code === 'TIER_LIMIT_REACHED') {
          setFullLocked(true);
        } else if (e instanceof ApiError && e.problem.status === 403) {
          // SALES_SUPPORT and INVENTORY hold basic:read and not full:read --
          // an absent permission renders NOTHING for the section (S3.4),
          // never a permission-denied banner on every visit.
          setFullLocked(false);
        } else if (e instanceof ApiError) {
          setProblem(e);
        }
      }
      if (gen !== loadGen.current) return;
      setLoadProblem(null);
      setState('READY');
    } catch (e) {
      if (gen !== loadGen.current) return;
      if (e instanceof ApiError) {
        setLoadProblem(e.problem);
        setState(stateFromProblem(e.problem));
      } else setState('TRANSPORT_ERROR');
    }
  }, [sellerId]);

  useEffect(() => {
    void load(period);
  }, [load, period]);

  if (state === 'NO_PERMISSION') return null;
  if (overview === null) {
    return (
      <ScreenState
        state={state}
        onRetry={() => void load(period)}
        {...(loadProblem ? { problem: loadProblem } : {})}
      />
    );
  }

  // The account-empty teach fires only on the DEFAULT window (the Phase 3
  // empty-bucket lesson): a 7-day view zeroing the one windowed tile must not
  // tell a seller with history "No analytics yet".
  const noData =
    overview.products_published === 0 &&
    overview.orders === 0 &&
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

      {noData && period === 30 ? (
        <div className="empty" data-state="EMPTY">
          <h3>{en['console.insights.analytics.empty_heading']}</h3>
          <p>{en['console.insights.analytics.empty_body']}</p>
        </div>
      ) : null}

      {/* THE PERIOD PICKER (T15 Phase 4): each option re-fetches with a real
          date window, and the caption below is the SERVER's echo of the
          window it resolved -- never a client's assumption about coverage. */}
      <div className="filter-row" role="group" aria-label={en['console.insights.analytics.period_label']}>
        {PERIODS.map((d) => (
          <button
            key={d}
            type="button"
            className={period === d ? 'filter active' : 'filter'}
            data-period={d}
            aria-pressed={period === d}
            onClick={() => setPeriod(d)}
          >
            {d === 7
              ? en['console.insights.analytics.period_7']
              : d === 30
                ? en['console.insights.analytics.period_30']
                : en['console.insights.analytics.period_90']}
          </button>
        ))}
      </div>
      <p className="hint" data-window>
        {fillTemplate(en['console.insights.analytics.window_showing'], {
          from: overview.window.from,
          to: overview.window.to,
        })}
      </p>

      <div className="kpi-tiles">
        <div className="kpi-tile">
          <span className="kpi-label">{en['console.insights.analytics.products_published']}</span>
          <span className="kpi-value">{overview.products_published}</span>
        </div>
        <div className="kpi-tile">
          <span className="kpi-label">{en['console.insights.analytics.orders']}</span>
          <span className="kpi-value">{overview.orders}</span>
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
              <span className="kpi-value">{full.storefront_views}</span>
            </div>
            <div className="kpi-tile">
              <span className="kpi-label">{en['console.insights.analytics.product_views']}</span>
              <span className="kpi-value">{full.product_views}</span>
            </div>
            <div className="kpi-tile">
              <span className="kpi-label">{en['console.insights.analytics.reservations']}</span>
              <span className="kpi-value">{full.reservations}</span>
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

      {/*
       * NO EXPORT SENTENCE (T23 Phase 3). It advertised a paid feature
       * ("Business") on a screen where it cannot be bought, and the plan
       * comparison does not sell it either -- so it named a price to a seller
       * with no way to pay it. Either sell it or say nothing.
       *
       * D-226's rule is untouched and is why there is still no control here:
       * an export exists in no wire, and a button faked at a 404 is worse than
       * an absence. The absence stays; the advertisement goes.
       */}
    </section>
  );
}
