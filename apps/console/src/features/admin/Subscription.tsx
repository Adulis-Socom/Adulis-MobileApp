/**
 * features/admin/Subscription.tsx -- SC-26 Subscription (v1.2 S12). CONSOLE
 * ONLY: the endpoints' permission carries surface {CONSOLE}, and a mobile
 * session gets a plain 403 -- no price, tier name or billing link exists in
 * the mobile bundle (ADU-API-01 S4.1).
 *
 * GET /v1/billing/subscription returns {subscription, intent}. BETA is a
 * subscription STATE, rendered as its own branch with the end date and THE
 * COMMERCIAL POSITION STATED IN ADVANCE: the chatbot is included during the
 * beta and becomes a paid capability afterwards (PRD S16.10 -- a seller who
 * learns this at conversion churns and is right to).
 *
 * The comparison table TRANSCRIBES ADU-PRD-01 S16.1 -- products 10/unlimited,
 * chatbot None/Top 10/All/All + custom flows, team on Business only ("Yes,
 * RBAC" appears on no other row). Prices are the founder's numbers from the
 * same table.
 *
 * Purchase: POST /v1/billing/purchase-intent (step-up SUBSCRIPTION_CHANGE,
 * challengeRequired; idempotent POST, key minted on mount). The response IS
 * the payment instructions -- amount, reference, expiry -- and marking the
 * transfer done is POST /v1/billing/mark-transferred. Nothing here asserts
 * the payment is genuine; the operator confirms receipt out of band.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { ScreenState } from '../../components/ScreenState';
import { useIdempotencyKey } from '../../lib/idempotency';
import { useStepUp } from '../../auth/useStepUp';
import type { UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { useMarketContext } from '../../lib/market';
import { timeFormatter, formatMinor, fillTemplate } from '../../lib/intl';
import type { SubscriptionState, IntentCreated } from './types';

const TIERS = ['LISTED', 'ASSISTED', 'VERIFIED_PRO', 'BUSINESS'] as const;
const TERMS = ['MONTHLY', 'QUARTERLY', 'ANNUAL'] as const;

export function Subscription() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [sub, setSub] = useState<SubscriptionState | null>(null);
  const [state, setState] = useState<UiState>('LOADING');
  const [tier, setTier] = useState<(typeof TIERS)[number]>('ASSISTED');
  const [term, setTerm] = useState<(typeof TERMS)[number]>('MONTHLY');
  const [intent, setIntent] = useState<IntentCreated | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const intentKey = useIdempotencyKey();
  const markKey = useIdempotencyKey();
  const { guard, modal } = useStepUp();

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

  const purchase = async () => {
    if (!sellerId) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await guard(
        'SUBSCRIPTION_CHANGE',
        tier,
        (challengeId) =>
          api<IntentCreated>(`/billing/purchase-intent`, {
            method: 'POST',
            sellerId,
            idempotencyKey: intentKey.current(),
            body: { tier, term, step_up_challenge_id: challengeId },
          }),
        { challengeRequired: true },
      );
      if (r !== null) {
        intentKey.remint();
        setIntent(r);
        void load();
      }
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const markTransferred = async (collectionRecordId: string) => {
    if (!sellerId) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(`/billing/mark-transferred`, {
        method: 'POST',
        sellerId,
        idempotencyKey: markKey.current(),
        body: { collection_record_id: collectionRecordId },
      });
      markKey.remint();
      setIntent(null);
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'NO_PERMISSION') return null;
  if (!sub) return <ScreenState state={state} onRetry={() => void load()} />;

  const fmt = market ? timeFormatter(market) : null;
  const when = (iso: string | null) => (iso && fmt ? fmt.format(new Date(iso)) : (iso ?? ''));
  const s = sub.subscription;
  const openIntent = sub.intent;

  return (
    <section aria-labelledby="subscription-heading" data-screen="SC-26" className="subscription">
      <h1 id="subscription-heading">{en['console.admin.subscription.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
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
        {openIntent && !intent ? (
          <div className="blocked">
            <p>
              {fillTemplate(en['console.admin.subscription.intent_open'], {
                tier: openIntent.tier,
                amount: market ? formatMinor(market, Number(openIntent.amount_minor)) : String(openIntent.amount_minor),
                time: when(openIntent.expires_at),
              })}
            </p>
            {/* A7 CLOSED (T15 Phase 4): the GET carries the reference the POST
                minted, so a seller who closed the tab reads it back here. */}
            <p data-reference={openIntent.reference}>
              <strong>
                {fillTemplate(en['console.admin.subscription.reference_line'], {
                  reference: openIntent.reference,
                })}
              </strong>
            </p>
            {!openIntent.marked_transferred_at ? (
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => void markTransferred(openIntent.collection_record_id)}
              >
                {en['console.admin.subscription.mark_transferred']}
              </button>
            ) : (
              <p className="hint">{en['console.admin.subscription.awaiting_confirmation']}</p>
            )}
          </div>
        ) : null}

        {intent ? (
          <div className="callout payment-instructions">
            <h3>{en['console.admin.subscription.instructions_heading']}</h3>
            <p>
              {fillTemplate(en['console.admin.subscription.instructions'], {
                amount: market ? formatMinor(market, intent.amount_minor) : String(intent.amount_minor),
                reference: intent.reference,
                time: when(intent.expires_at),
              })}
            </p>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void markTransferred(intent.collection_record_id)}
            >
              {en['console.admin.subscription.mark_transferred']}
            </button>
          </div>
        ) : (
          <div className="form-block">
            <label htmlFor="sub-tier">{en['console.admin.subscription.pick_tier']}</label>
            <select id="sub-tier" value={tier} onChange={(e) => setTier(e.target.value as (typeof TIERS)[number])}>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label htmlFor="sub-term">{en['console.admin.subscription.pick_term']}</label>
            <select id="sub-term" value={term} onChange={(e) => setTerm(e.target.value as (typeof TERMS)[number])}>
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button type="button" className="button primary" disabled={busy} onClick={() => void purchase()}>
              {en['console.admin.subscription.view_instructions']}
            </button>
          </div>
        )}
      </section>

      {modal}
    </section>
  );
}
