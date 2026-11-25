/**
 * features/admin/Subscription.tsx -- SC-26 Subscription (v1.2 S12). CONSOLE
 * ONLY: the endpoints' permission carries surface {CONSOLE}, and a mobile
 * session gets a plain 403 -- no price, tier name or billing link exists in
 * the mobile bundle (ADU-API-01 S4.1).
 *
 * SUBSCRIPTION OPTION B (B02-D01, 25 November 2026). This screen keeps the
 * architecture that is not a payment: GET /v1/billing/subscription's
 * server-resolved status, the BETA branch with its end date and the commercial
 * position stated in advance (PRD S16.10), and the plan comparison. It no
 * longer purchases. The purchase intent, the bank-transfer instructions and
 * "mark transferred" are removed from the screen, not hidden: the code that
 * called POST /v1/billing/purchase-intent and /v1/billing/mark-transferred is
 * gone from this component, so there is no control to reach and no request
 * this screen can make. Entitlements are resolved by the server; nothing here
 * can activate one.
 *
 * The comparison table TRANSCRIBES ADU-PRD-01 S16.1 -- products 10/unlimited,
 * chatbot None/Top 10/All/All + custom flows, team on Business only. It states
 * no price: the founder has not decided pricing, so none is shown.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { DeferredNote } from '../../components/Deferred';
import { ScreenState } from '../../components/ScreenState';
import type { UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { useMarketContext } from '../../lib/market';
import { timeFormatter, fillTemplate } from '../../lib/intl';
import type { SubscriptionState } from './types';

export function Subscription() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [sub, setSub] = useState<SubscriptionState | null>(null);
  const [state, setState] = useState<UiState>('LOADING');

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<SubscriptionState>(`/billing/subscription`, { sellerId });
      setSub(r);
      setState('READY');
    } catch (e) {
      setState(e instanceof ApiError ? stateFromProblem(e.problem) : 'TRANSPORT_ERROR');
    }
  }, [sellerId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === 'NO_PERMISSION') return null;
  if (!sub) return <ScreenState state={state} onRetry={() => void load()} />;

  const fmt = market ? timeFormatter(market) : null;
  const when = (iso: string | null) => (iso && fmt ? fmt.format(new Date(iso)) : (iso ?? ''));
  const s = sub.subscription;

  return (
    <section aria-labelledby="subscription-heading" data-screen="SC-26" className="subscription">
      <h1 id="subscription-heading">{en['console.admin.subscription.heading']}</h1>

      {state === 'TRANSPORT_ERROR' ? (
        <p className="problem" role="alert">
          {en['console.common.refetch_failed']}
        </p>
      ) : null}

      {s?.state === 'BETA' ? (
        <section aria-labelledby="beta-heading" className="beta">
          <span className="badge badge-beta">{en['console.admin.subscription.beta_badge']}</span>
          <h2 id="beta-heading">{en['console.admin.subscription.beta_heading']}</h2>
          <p>{en['console.admin.subscription.beta_never_silent']}</p>
          {s.current_period_end ? (
            <p>
              {fillTemplate(en['console.admin.subscription.beta_ends'], {
                time: when(s.current_period_end),
              })}
            </p>
          ) : null}
          {/* PRD S16.10: the post-beta chatbot boundary, stated IN ADVANCE. */}
          <p className="callout">{en['console.admin.subscription.beta_chatbot_position']}</p>
        </section>
      ) : s ? (
        <section aria-labelledby="current-heading" className="current-plan">
          <h2 id="current-heading">{en['console.admin.subscription.current_heading']}</h2>
          <p>
            <strong>{s.tier}</strong> {'·'} {s.state}
          </p>
          {s.current_period_end ? (
            <p>
              {fillTemplate(en['console.admin.subscription.renews'], {
                time: when(s.current_period_end),
              })}
            </p>
          ) : null}
        </section>
      ) : (
        <p className="empty" data-state="EMPTY">
          {en['console.admin.subscription.none']}
        </p>
      )}

      <section aria-labelledby="compare-heading" className="compare-plans">
        <h2 id="compare-heading">{en['console.admin.subscription.compare_heading']}</h2>
        <div className="table-scroll">
          {/* ADU-PRD-01 S16.1, transcribed -- not designed here. */}
          <table>
            <thead>
              <tr>
                <th scope="col">{en['console.admin.subscription.col_plan']}</th>
                <th scope="col">{en['console.admin.subscription.col_products']}</th>
                <th scope="col">{en['console.admin.subscription.col_chatbot']}</th>
                <th scope="col">{en['console.admin.subscription.col_team']}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Listed</th>
                <td>10</td>
                <td>{en['console.admin.subscription.not_included']}</td>
                <td>{en['console.admin.subscription.not_included']}</td>
              </tr>
              <tr>
                <th scope="row">Assisted</th>
                <td>{en['console.admin.subscription.unlimited']}</td>
                <td>{en['console.admin.subscription.chatbot_top10']}</td>
                <td>{en['console.admin.subscription.not_included']}</td>
              </tr>
              <tr>
                <th scope="row">Verified Pro</th>
                <td>{en['console.admin.subscription.unlimited']}</td>
                <td>{en['console.admin.subscription.chatbot_all']}</td>
                <td>{en['console.admin.subscription.not_included']}</td>
              </tr>
              <tr>
                <th scope="row">Business</th>
                <td>{en['console.admin.subscription.unlimited']}</td>
                <td>{en['console.admin.subscription.chatbot_custom']}</td>
                <td>{en['console.admin.subscription.team_rbac']}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="purchase-heading" className="purchase">
        <h2 id="purchase-heading">{en['console.admin.subscription.purchase_heading']}</h2>
        <DeferredNote what="purchase" />
      </section>
    </section>
  );
}
