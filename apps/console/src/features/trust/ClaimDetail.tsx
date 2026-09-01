/**
 * features/trust/ClaimDetail.tsx -- SC-16 Claim detail (v1.2 S10).
 *
 * GET /v1/claims/{id} -- one endpoint serves both parties; the seller side
 * resolves through X-Adulis-Seller + seller.claims:read, so the api()
 * wrapper still sends the seller header though the path is unprefixed.
 *
 * Regions per S10: what happened (SYSTEM claims read as a STATEMENT OF
 * RECORDED FACT, not an accusation -- the sentence is on screen)  -  the
 * evidence attached AT CLAIM TIME, read-only, never assembled at review
 * time  -  the remedy available in the current state  -  deadline  -
 * history (the wire carries opened_at/decided_at; a fuller event list is
 * not exposed -- named, D-226).
 *
 * POST /v1/seller/claims/{id}/remedy { remedy: REFUND | FULFIL } --
 * runIdempotent (mount-minted key), NO step-up (the permission's
 * requires_step_up is false), refused with 409 ORDER_ALREADY_TERMINAL once
 * RESOLVED -- and this screen never offers it then: TERMINAL removes the
 * controls because the case has ended and only history remains.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { ScreenState } from '../../components/ScreenState';
import { useIdempotencyKey } from '../../lib/idempotency';
import type { UiState, AdulisProblem } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { useMarketContext } from '../../lib/market';
import { timeFormatter, fillTemplate } from '../../lib/intl';
import { TRIGGER_LABEL, CLAIM_STATE_LABEL } from './Claims';
import type { ClaimDetailRow } from './types';

/**
 * core.claim_evidence_kind (0001_foundation.sql), VERBATIM -- the C-7 pass's
 * B1: the first version of this map was written from memory, the e2e plant
 * copied the fiction, and every real claim would have rendered shouting
 * enums. Vocabularies are transcribed from the DDL, never recalled.
 */
const EVIDENCE_LABEL: Readonly<Record<string, string>> = {
  CHAT_HISTORY: en['console.claims.evidence.chat_history'],
  SCAN_RECORD: en['console.claims.evidence.scan_record'],
  PAYMENT_EVIDENCE: en['console.claims.evidence.payment'],
  BANK_RECORD: en['console.claims.evidence.bank_record'],
  STOCK_EVENTS: en['console.claims.evidence.stock_events'],
  ORDER_TRANSITIONS: en['console.claims.evidence.order_transitions'],
  SELLER_LEVEL_AT_ORDER: en['console.claims.evidence.level_at_order'],
  ACTING_TEAM_MEMBER: en['console.claims.evidence.acting_team_member'],
};

export function ClaimDetail() {
  const { sellerId, claimId } = useParams<{ sellerId: string; claimId: string }>();
  const market = useMarketContext();
  const [claim, setClaim] = useState<ClaimDetailRow | null>(null);
  const [state, setState] = useState<UiState>('LOADING');
  const [loadProblem, setLoadProblem] = useState<AdulisProblem | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [remedy, setRemedy] = useState<'REFUND' | 'FULFIL'>('FULFIL');
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const remedyKey = useIdempotencyKey();

  const load = useCallback(async () => {
    if (!sellerId || !claimId) return;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const c = await api<ClaimDetailRow>(`/claims/${claimId}`, { sellerId });
      setClaim(c);
      setLoadProblem(null);
      setState('READY');
    } catch (e) {
      if (e instanceof ApiError) {
        setLoadProblem(e.problem);
        setState(stateFromProblem(e.problem));
      } else setState('TRANSPORT_ERROR');
    }
  }, [sellerId, claimId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitRemedy = async () => {
    if (!sellerId || !claimId) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/claims/${claimId}/remedy`, {
        method: 'POST',
        sellerId,
        idempotencyKey: remedyKey.current(),
        body: { remedy },
      });
      remedyKey.remint();
      void load();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.problem.code === 'ORDER_ALREADY_TERMINAL') {
          // The case ended under us: say it about the CLAIM and refetch so
          // the controls leave with the state instead of sitting armed
          // beneath a banner about "the order".
          setFieldError(en['console.claims.detail.already_resolved']);
          void load();
        } else {
          setProblem(e);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  if (state === 'NO_PERMISSION') return null;
  if (claim === null) {
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
  const resolved = claim.state === 'RESOLVED';

  return (
    <section aria-labelledby="claim-heading" data-screen="SC-16" className="claim-detail">
      <h1 id="claim-heading">{en['console.claims.detail.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {fieldError ? (
        <p className="field-error" role="alert">
          {fieldError}
        </p>
      ) : null}
      {state === 'TRANSPORT_ERROR' ? (
        <p className="problem" role="alert">
          {en['console.common.refetch_failed']}
        </p>
      ) : null}

      {resolved ? (
        <span className="badge badge-resolved" data-state="TERMINAL">
          {en['console.claims.detail.resolved_badge']}
        </span>
      ) : null}

      <section aria-labelledby="what-heading" className="claim-what">
        <h2 id="what-heading">{en['console.claims.detail.what_happened_heading']}</h2>
        <p>{TRIGGER_LABEL[claim.trigger] ?? claim.trigger}</p>
        <p>
          {fillTemplate(en['console.claims.detail.opened_at'], { time: when(claim.opened_at) })}{' '}
          {CLAIM_STATE_LABEL[claim.state] ?? claim.state}
        </p>
        {/* SYSTEM claims are a statement of recorded fact, not an accusation. */}
        <p className="hint">{en['console.claims.detail.factual_note']}</p>
      </section>

      <section aria-labelledby="evidence-heading" className="claim-evidence readonly">
        <h2 id="evidence-heading">{en['console.claims.detail.evidence_heading']}</h2>
        {claim.evidence.length === 0 ? (
          <p className="hint">{en['console.claims.detail.evidence_none']}</p>
        ) : (
          <ul>
            {claim.evidence.map((ev, i) => (
              <li key={`${ev.kind}-${i}`}>
                {EVIDENCE_LABEL[ev.kind] ?? ev.kind} {'-'} {when(ev.attached_at)}
              </li>
            ))}
          </ul>
        )}
        {/* Read-only: attached from transaction records, never authored. */}
        <p className="hint">{en['console.claims.detail.evidence_readonly']}</p>
      </section>

      {!resolved && claim.viewer === 'SELLER' ? (
        <>
          {claim.review_deadline ? (
            <section aria-labelledby="deadline-heading" className="claim-deadline">
              <h2 id="deadline-heading">{en['console.claims.detail.deadline_heading']}</h2>
              <p>
                <strong>{when(claim.review_deadline)}</strong>
              </p>
            </section>
          ) : null}

          <fieldset className="claim-remedy">
            <legend>{en['console.claims.detail.remedy_legend']}</legend>
            <label htmlFor="remedy-refund">
              <input
                id="remedy-refund"
                type="radio"
                name="remedy"
                checked={remedy === 'REFUND'}
                onChange={() => setRemedy('REFUND')}
              />
              {en['console.claims.detail.remedy_refund']}
            </label>
            <label htmlFor="remedy-fulfil">
              <input
                id="remedy-fulfil"
                type="radio"
                name="remedy"
                checked={remedy === 'FULFIL'}
                onChange={() => setRemedy('FULFIL')}
              />
              {en['console.claims.detail.remedy_fulfil']}
            </label>
            {claim.remedy ? (
              <p className="hint">
                {fillTemplate(en['console.claims.detail.remedy_recorded'], {
                  remedy:
                    claim.remedy === 'REFUND'
                      ? en['console.claims.detail.remedy_refund']
                      : en['console.claims.detail.remedy_fulfil'],
                })}
              </p>
            ) : null}
            {/* The wireframe drew the radios without a submit -- a choice
                that cannot be recorded does nothing; the control completes
                the wire the endpoint provides (D-226 notes the delta). */}
            <button type="button" className="button primary" disabled={busy} onClick={() => void submitRemedy()}>
              {en['console.claims.detail.submit_remedy']}
            </button>
          </fieldset>
        </>
      ) : null}

      <section aria-labelledby="history-heading" className="claim-history">
        <h2 id="history-heading">{en['console.claims.detail.history_heading']}</h2>
        <ol>
          <li>{fillTemplate(en['console.claims.detail.opened_at'], { time: when(claim.opened_at) })}</li>
          {claim.decided_at ? (
            <li>
              <strong>
                {fillTemplate(en['console.claims.detail.decided_at'], {
                  time: when(claim.decided_at),
                })}
              </strong>
            </li>
          ) : null}
        </ol>
        {/* The full event trail is not on the wire -- named, not faked. */}
        <p className="hint">{en['console.claims.detail.history_owed']}</p>
      </section>
    </section>
  );
}
