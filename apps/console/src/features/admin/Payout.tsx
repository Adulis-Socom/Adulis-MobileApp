/**
 * features/admin/Payout.tsx -- SC-24 Payout (ADU-CON-03 v1.2 S12). THE
 * HIGHEST-VALUE TARGET IN THE SYSTEM (ADU-CON-01 S2).
 *
 * GET /v1/seller/payout {active, pending} -- only account_last4 exists in
 * core; the full number is boundary ciphertext and never returns. POST
 * requires step_up_challenge_id as a zod field, so the guard runs with
 * challengeRequired (the S8 "second door": trying first would buy a 400 for
 * a code the seller was never asked for). DELETE .../pending carries NO
 * step-up, DELIBERATELY -- reverting must always be easier than changing.
 *
 * THE FIVE FACTS render before the change control, always, never behind a
 * disclosure -- a seller reads them before starting something risky:
 * 24 hours, previous details stay in force, every Owner and Admin notified
 * unsuppressibly, existing orders unaffected, cancellable until activation.
 *
 * R21: the cancel control renders ONLY when a PENDING row exists. A console
 * must not offer to cancel something that does not exist; the PROMISE of
 * cancellability lives in the disclosure, the CONTROL beside the thing it
 * cancels. The two controls are peers -- .decision has no variant.
 *
 * The recovery/new-device lock is drawn PROACTIVELY (T15 Phase 4, S15.0c):
 * GET /v1/seller/payout now carries `reason` and `payout_locked_until`, so the
 * seller reads WHY the store is locked and WHEN it lifts before they touch the
 * change control -- not on a 409 after spending a step-up. The change control
 * renders disabled while locked (R20: the reason stated, the control kept),
 * and the 409's message remains the backstop if a lock lands mid-session. One
 * cause-neutral code with a reason slot (PAYOUT_LOCKED); only the sentence
 * differs, and that is the locale's job.
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
import { timeFormatter, fillTemplate } from '../../lib/intl';
import type { PayoutState, PayoutHistoryRow } from '../admin/types';

/**
 * The lock sentence per reason -- the same locale keys the 409 renders through,
 * so the proactive panel and the error speak one language (S15.0c). The reason
 * vocabulary is the server's DETAIL, verbatim.
 */
const LOCK_SENTENCE: Readonly<Record<string, string>> = {
  RECOVERY_COOLING: en['error.payout.payout_locked_recovery_cooling'],
  NEW_DEVICE: en['error.payout.payout_locked_new_device'],
  NO_TIMING_CONFIG: en['error.payout.payout_locked_no_timing_config'],
};

/**
 * The history outcome is a server enum; a seller reads a WORD, not a token
 * (S7: no server prose/codes on screen). Unknown values render as
 * themselves -- visible and greppable, the ITEM_LABEL rule.
 */
const OUTCOME_LABEL: Readonly<Record<string, string>> = {
  REQUESTED: en['console.admin.payout.outcome_requested'],
  ACTIVATED: en['console.admin.payout.outcome_activated'],
  CANCELLED: en['console.admin.payout.outcome_cancelled'],
};

export function Payout() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [payout, setPayout] = useState<PayoutState | null>(null);
  const [history, setHistory] = useState<readonly PayoutHistoryRow[]>([]);
  const [state, setState] = useState<UiState>('LOADING');
  const [formOpen, setFormOpen] = useState(false);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const changeKey = useIdempotencyKey();
  const { guard, modal } = useStepUp();

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const p = await api<PayoutState>(`/seller/payout`, { sellerId });
      setPayout(p);
      const h = await api<{ data: PayoutHistoryRow[] }>(`/seller/payout/history`, { sellerId });
      setHistory(h.data);
      setState('READY');
    } catch (e) {
      setState(e instanceof ApiError ? stateFromProblem(e.problem) : 'TRANSPORT_ERROR');
    }
  }, [sellerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = async () => {
    if (!sellerId) return;
    setFieldError(null);
    if (bankCode.trim().length < 2 || !/^\d{6,24}$/.test(accountNumber.trim()) || !accountName.trim()) {
      setFieldError(en['console.admin.payout.fields_required']);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      // challengeRequired: the body DECLARES step_up_challenge_id, so the
      // modal opens first and the action runs once, with the satisfied id.
      const r = await guard(
        'PAYOUT_CHANGE',
        undefined,
        (challengeId) =>
          api(`/seller/payout`, {
            method: 'POST',
            sellerId,
            idempotencyKey: changeKey.current(),
            body: {
              bank_code: bankCode.trim(),
              account_number: accountNumber.trim(),
              account_name: accountName.trim(),
              step_up_challenge_id: challengeId,
            },
          }),
        { challengeRequired: true },
      );
      if (r !== null) {
        // null is the seller cancelling the modal -- not an error, nothing
        // happened, nothing renders.
        changeKey.remint();
        setFormOpen(false);
        setBankCode('');
        setAccountNumber('');
        setAccountName('');
        void load();
      }
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const cancelPending = async () => {
    if (!sellerId) return;
    setBusy(true);
    setProblem(null);
    try {
      // NO step-up: reverting is easier than changing, by design.
      await api(`/seller/payout/pending`, { method: 'DELETE', sellerId });
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'NO_PERMISSION') return null;
  if (!payout) return <ScreenState state={state} onRetry={() => void load()} />;

  const fmt = market ? timeFormatter(market) : null;
  const when = (iso: string | null) => (iso && fmt ? fmt.format(new Date(iso)) : (iso ?? ''));

  return (
    <section aria-labelledby="payout-heading" data-screen="SC-24" className="payout">
      <h1 id="payout-heading">{en['console.admin.payout.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {state === 'TRANSPORT_ERROR' ? (
        <p className="problem" role="alert">
          {en['console.common.refetch_failed']}
        </p>
      ) : null}
      {fieldError ? (
        <p className="field-error" role="alert">
          {fieldError}
        </p>
      ) : null}

      <section aria-labelledby="current-heading" className="payout-current">
        <h2 id="current-heading">{en['console.admin.payout.current_heading']}</h2>
        {payout.active ? (
          <p>
            {fillTemplate(en['console.admin.payout.current_details'], {
              bank: payout.active.bank_code,
              last4: payout.active.account_last4,
            })}
          </p>
        ) : (
          <p className="empty" data-state="EMPTY">
            {en['console.admin.payout.none_yet']}
          </p>
        )}
      </section>

      {payout.pending ? (
        <section aria-labelledby="pending-heading" className="payout-pending blocked">
          <h2 id="pending-heading">{en['console.admin.payout.pending_heading']}</h2>
          <p>
            {fillTemplate(en['console.admin.payout.pending_details'], {
              bank: payout.pending.bank_code,
              last4: payout.pending.account_last4,
            })}
          </p>
          <p>
            <strong>
              {fillTemplate(en['console.admin.payout.activates_at'], {
                time: when(payout.pending.activates_at),
              })}
            </strong>
          </p>
        </section>
      ) : null}

      {/* THE PROACTIVE LOCK PANEL (T15 Phase 4): drawn from the GET's reason
          and lift, before the seller reaches for the control -- not on a 409. */}
      {payout.reason ? (
        <section className="payout-lock blocked" data-payout-lock={payout.reason}>
          {/* T18 Phase 4 RETIRED T17's first-set variant, which is the better
              outcome: rather than wording the accusation more kindly, 0047
              stopped the lock firing at all when there is no ACTIVE payout row
              to redirect. The server therefore never reports NEW_DEVICE to a
              seller who has nothing to change, so the branch that used to sit
              here was unreachable and its string is gone. What remains is the
              sentence for the case the lock was written for: a CHANGE from a
              device we have not seen. */}
          <p>{LOCK_SENTENCE[payout.reason] ?? en['error.payout.payout_locked']}</p>
          {payout.payout_locked_until ? (
            <p>
              <strong>
                {fillTemplate(en['console.admin.payout.locked_until'], {
                  time: when(payout.payout_locked_until),
                })}
              </strong>
            </p>
          ) : null}
        </section>
      ) : null}

      {/* THE FIVE FACTS -- before the control, never inside a disclosure. */}
      <section aria-labelledby="facts-heading" className="payout-facts">
        <h2 id="facts-heading">{en['console.admin.payout.before_heading']}</h2>
        <ul>
          <li>{en['console.admin.payout.fact_24h']}</li>
          <li>{en['console.admin.payout.fact_previous_stays']}</li>
          <li>{en['console.admin.payout.fact_notified']}</li>
          <li>{en['console.admin.payout.fact_orders_unaffected']}</li>
          <li>{en['console.admin.payout.fact_cancellable']}</li>
        </ul>
      </section>

      <div className="payout-actions">
        {/* D-155: the change control renders iff the server says this seller
            may change payout -- read, never inferred from having reached the
            screen (a role can read payout and not update it). */}
        {payout.allowed_actions.includes('seller.payout:update') ? (
          <button
            type="button"
            className="button decision"
            data-action="change-payout"
            // R20: rendered while locked, but DISABLED -- the write would 409,
            // and the lock panel above states why. The grant is present; the
            // state forbids it. (Cancelling a pending change is never locked.)
            disabled={busy || payout.reason !== null}
            aria-expanded={formOpen}
            onClick={() => setFormOpen((o) => !o)}
          >
            {en['console.admin.payout.change']}
          </button>
        ) : null}
        {/* R21: rendered ONLY beside a real pending row (server STATE), and
            only where the grant is present. Absent -- not disabled -- when
            there is nothing to cancel. */}
        {payout.pending && payout.allowed_actions.includes('seller.payout:update') ? (
          <button type="button" className="button decision" disabled={busy} onClick={() => void cancelPending()}>
            {en['console.admin.payout.cancel_pending']}
          </button>
        ) : null}
      </div>

      {/* The form is lock-gated like its toggle (pass M1): a lock landing
          mid-session via a refetch must not leave an armed form behind a
          disabled toggle -- the seller would spend a step-up SMS on the 409
          the panel above already explains. */}
      {formOpen && payout.reason === null ? (
        <div className="form-block payout-form">
          <label htmlFor="po-bank">{en['console.admin.payout.bank_code']}</label>
          <input id="po-bank" value={bankCode} onChange={(e) => setBankCode(e.target.value)} />
          <label htmlFor="po-number">{en['console.admin.payout.account_number']}</label>
          <input
            id="po-number"
            inputMode="numeric"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
          <label htmlFor="po-name">{en['console.admin.payout.account_name']}</label>
          <input id="po-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          <button type="button" className="button primary" disabled={busy} onClick={() => void change()}>
            {en['console.admin.payout.confirm_change']}
          </button>
        </div>
      ) : null}

      <section aria-labelledby="history-heading" className="payout-history">
        <h2 id="history-heading">{en['console.admin.payout.history_heading']}</h2>
        {history.length === 0 ? (
          <p className="empty" data-state="EMPTY">
            {en['console.admin.payout.history_empty']}
          </p>
        ) : (
          <ol>
            {history.map((h) => (
              <li key={h.id}>
                {fillTemplate(en['console.admin.payout.history_row'], {
                  time: when(h.occurred_at),
                  outcome: OUTCOME_LABEL[h.outcome] ?? h.outcome,
                  last4: h.new_last4 ?? h.previous_last4 ?? '',
                })}
              </li>
            ))}
          </ol>
        )}
      </section>

      {modal}
    </section>
  );
}
