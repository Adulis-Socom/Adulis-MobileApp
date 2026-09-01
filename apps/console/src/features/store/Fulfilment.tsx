/**
 * features/store/Fulfilment.tsx -- SC-18 Fulfilment (ADU-CON-03 v1.2 S11).
 *
 * GET / PUT /v1/seller/fulfilment-methods. Three methods, at least one active
 * (ADU-DB-01 S13.0); the server refuses an all-off set with 422
 * FULFILMENT_METHOD_REQUIRED, and this screen ALSO refuses it client-side
 * with the same sentence, because the rule applies to the set and the seller
 * should read it beside the fieldset, not only in a banner.
 *
 * Each method carries a handoff_note in the seller's own words, and the note
 * is labelled as BUYER-VISIBLE BEFORE RESERVATION -- the label is the rule
 * (S11: "shown to buyers before they commit stock, and the field label says
 * so").
 *
 * NO FEE FIELD, deliberately: ADU-PRD-01 S25 leaves the delivery fee open,
 * the schema has no column, and a field here would create an expectation the
 * back end cannot honour.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { ScreenState } from '../../components/ScreenState';
import type { UiState, AdulisProblem } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import type { FulfilmentMethod, FulfilmentMethodCode } from './types';

const METHODS: readonly { code: FulfilmentMethodCode; label: string }[] = [
  { code: 'BUYER_COLLECTION', label: en['console.store.fulfilment.buyer_collects'] },
  { code: 'SELLER_DELIVERY', label: en['console.store.fulfilment.seller_delivers'] },
  { code: 'COURIER_DELIVERY', label: en['console.store.fulfilment.courier_delivers'] },
];

interface Draft {
  is_active: boolean;
  handoff_note: string;
}

export function Fulfilment() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [state, setState] = useState<UiState>('LOADING');
  const [loaded, setLoaded] = useState(false);
  const [loadProblem, setLoadProblem] = useState<AdulisProblem | null>(null);
  const [draft, setDraft] = useState<Record<FulfilmentMethodCode, Draft>>({
    BUYER_COLLECTION: { is_active: false, handoff_note: '' },
    SELLER_DELIVERY: { is_active: false, handoff_note: '' },
    COURIER_DELIVERY: { is_active: false, handoff_note: '' },
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<{ methods: FulfilmentMethod[] }>(`/seller/fulfilment-methods`, { sellerId });
      setDraft((d) => {
        const next = { ...d };
        for (const m of r.methods) {
          next[m.method] = { is_active: m.is_active, handoff_note: m.handoff_note ?? '' };
        }
        return next;
      });
      setLoaded(true);
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

  const save = async () => {
    if (!sellerId) return;
    setFieldError(null);
    setSaved(false);
    const methods = METHODS.map((m) => ({
      method: m.code,
      is_active: draft[m.code].is_active,
      ...(draft[m.code].handoff_note.trim() ? { handoff_note: draft[m.code].handoff_note.trim() } : {}),
    }));
    // The server's 422 sentence, read beside the set before the wire is spent.
    if (!methods.some((m) => m.is_active)) {
      setFieldError(en['console.store.fulfilment.at_least_one']);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/fulfilment-methods`, { method: 'PUT', sellerId, body: { methods } });
      setSaved(true);
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'NO_PERMISSION') return null;
  if (!loaded && state !== 'READY' && state !== 'STALE') {
    return (
      <ScreenState
        state={state}
        onRetry={() => void load()}
        {...(loadProblem ? { problem: loadProblem } : {})}
      />
    );
  }

  return (
    <section aria-labelledby="fulfilment-heading" data-screen="SC-18" className="fulfilment">
      <h1 id="fulfilment-heading">{en['console.store.fulfilment.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {loaded && state === 'TRANSPORT_ERROR' ? (
        <p className="problem" role="alert">
          {en['console.common.refetch_failed']}
        </p>
      ) : null}
      {fieldError ? (
        <p className="field-error" role="alert">
          {fieldError}
        </p>
      ) : null}
      {saved ? <p className="callout">{en['console.store.fulfilment.saved']}</p> : null}

      <fieldset>
        <legend>{en['console.store.fulfilment.legend']}</legend>
        {METHODS.map((m) => (
          <div key={m.code} className="fulfilment-method">
            <label htmlFor={`fm-${m.code}`}>
              <input
                id={`fm-${m.code}`}
                type="checkbox"
                checked={draft[m.code].is_active}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [m.code]: { ...d[m.code], is_active: e.target.checked } }))
                }
              />
              {m.label}
            </label>
            {/* The label IS the rule: these words become a pre-reservation
                expectation, and the seller must know that before typing. */}
            <label htmlFor={`fm-note-${m.code}`} className="note-label">
              {en['console.store.fulfilment.note_label']}
            </label>
            <textarea
              id={`fm-note-${m.code}`}
              maxLength={500}
              value={draft[m.code].handoff_note}
              onChange={(e) =>
                setDraft((d) => ({ ...d, [m.code]: { ...d[m.code], handoff_note: e.target.value } }))
              }
            />
          </div>
        ))}
      </fieldset>

      <button type="button" className="button primary" disabled={busy} onClick={() => void save()}>
        {en['console.store.fulfilment.save']}
      </button>
    </section>
  );
}
