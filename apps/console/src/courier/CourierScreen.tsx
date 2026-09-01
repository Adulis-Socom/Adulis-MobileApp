/**
 * courier/CourierScreen.tsx -- SC-C1 (ADU-CON-03 v1.2 S12). ONE SCREEN, for
 * a DIFFERENT USER: same deployment, same audience value, separate route
 * tree, NO seller navigation, no store context, no catalogue. Mobile layout
 * only -- a courier works from a phone at a doorway.
 *
 * GET /v1/courier/orders -- the list IS the assignments: row-level security
 * keyed on the COURIER actor role returns only currently assigned orders,
 * and access ends with the assignment. GET .../{id} adds the buyer's phone
 * and, ONLY once custody is accepted, the QR. POST .../custody-accept is
 * Event A, courier side -- runIdempotent, key minted on mount.
 *
 * R25 -- THE QR RENDERS ONLY AFTER CUSTODY IS ACCEPTED, and the enforcement
 * is the SERVER'S: before custody the payload is ABSENT from the wire, not
 * hidden by this client. Two states, and the difference is the point: a QR
 * visible before custody is a path to the buyer's scan happening while the
 * goods are still with the seller -- a completed handoff for an order
 * nobody has handed over. The object does not exist yet.
 *
 * A COURIER CAN NEVER PERFORM THE BUYER'S SCAN (the composite FK makes it
 * structurally impossible) and this screen offers no affordance that
 * suggests otherwise -- the line under the QR names WHO scans it.
 *
 * Named absences (D-228): the wire carries buyer_phone, not a name; no
 * pickup point and no handoff note ride the courier read (the seller's
 * fulfilment note is not joined). Each said on screen, none faked.
 */
import { useCallback, useEffect, useState } from 'react';
import { en } from '@adulis/locale';
import { api, ApiError } from '../api/client';
import { ProblemBanner } from '../components/Feedback';
import { ScreenState } from '../components/ScreenState';
import { useIdempotencyKey } from '../lib/idempotency';
import { useSession } from '../auth/session';
import { usePoll } from '../lib/poll';
import type { UiState, AdulisProblem } from '../lib/states';
import { stateFromProblem } from '../lib/states';
import { useMarketContext } from '../lib/market';
import { encodeHandoffToken, QrSvg, type QrToken } from '../lib/qr';

interface CourierOrderRow {
  readonly id: string;
  readonly state: string;
  readonly expires_at: string | null;
  readonly store_name: string;
}
interface CourierOrderDetail extends CourierOrderRow {
  readonly buyer_phone: string;
  readonly custody_accepted: boolean;
  readonly qr: QrToken | null;
}

/** Courier-voiced state words; unmapped values render as themselves. */
const STATE_LABEL: Readonly<Record<string, string>> = {
  CREATED: en['console.courier.state.not_ready'],
  NOTIFIED: en['console.courier.state.not_ready'],
  PAYMENT_SUBMITTED: en['console.courier.state.not_ready'],
  PAYMENT_CONFIRMED: en['console.courier.state.awaiting_pickup'],
  HANDED_OFF: en['console.courier.state.handed_off'],
  COMPLETED: en['console.courier.state.completed'],
};

export function CourierScreen() {
  const market = useMarketContext();
  const { signOut } = useSession();
  const [rows, setRows] = useState<readonly CourierOrderRow[] | null>(null);
  const [state, setState] = useState<UiState>('LOADING');
  const [loadProblem, setLoadProblem] = useState<AdulisProblem | null>(null);
  const [open, setOpen] = useState<CourierOrderDetail | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const custodyKey = useIdempotencyKey();

  const load = useCallback(async () => {
    setState((s) => (s === 'READY' || s === 'EMPTY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<{ data: CourierOrderRow[] }>(`/courier/orders`);
      setRows(r.data);
      setLoadProblem(null);
      setState(r.data.length === 0 ? 'EMPTY' : 'READY');
    } catch (e) {
      if (e instanceof ApiError) {
        setLoadProblem(e.problem);
        setState(stateFromProblem(e.problem));
      } else setState('TRANSPORT_ERROR');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  // An assignment can END while this screen is open (revocation kills the
  // row in the same transaction); the list must notice without a reload.
  usePoll(() => void load(), 30_000);

  const openOrder = async (id: string) => {
    setProblem(null);
    try {
      const d = await api<CourierOrderDetail>(`/courier/orders/${id}`);
      setOpen(d);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.problem.status === 404) {
          // The assignment ended under us: back to the list, refreshed.
          setOpen(null);
          void load();
        }
        setProblem(e);
      }
    }
  };

  const acceptCustody = async () => {
    if (!open) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(`/courier/orders/${open.id}/custody-accept`, {
        method: 'POST',
        idempotencyKey: custodyKey.current(),
      });
      custodyKey.remint();
      // Re-read: custody flips server-side and the QR arrives WITH the
      // detail, never assembled client-side.
      await openOrder(open.id);
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'NO_PERMISSION') return null;
  if (!market || rows === null) {
    return (
      <ScreenState
        state={state}
        onRetry={() => void load()}
        {...(loadProblem ? { problem: loadProblem } : {})}
      />
    );
  }

  return (
    <div className="courier-screen" data-screen="SC-C1">
      <header className="courier-header">
        <h1>{en['console.courier.heading']}</h1>
        <button type="button" onClick={() => void signOut()}>
          {en['common.signOut']}
        </button>
      </header>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {state !== 'READY' && state !== 'STALE' && state !== 'EMPTY' ? (
        loadProblem ? (
          <ProblemBanner problem={loadProblem} />
        ) : (
          <p className="problem" role="alert">
            {en['console.common.refetch_failed']}
          </p>
        )
      ) : null}

      {open ? (
        <section aria-labelledby="courier-order-heading" className="courier-order">
          <button
            type="button"
            className="button"
            onClick={() => {
              setOpen(null);
              void load();
            }}
          >
            {en['console.courier.back']}
          </button>
          <h2 id="courier-order-heading">{open.store_name}</h2>
          <p className="courier-ref">
            {en['console.courier.order_ref']} <code>{open.id.slice(0, 8)}</code>
          </p>
          <p className="courier-state">{STATE_LABEL[open.state] ?? open.state}</p>
          <p>
            {en['console.courier.buyer_phone']} <strong>{open.buyer_phone}</strong>
          </p>
          {/* D-228: the name and the collection details are not on this
              wire; the phone is what the server sends for the doorway call. */}
          <p className="hint">{en['console.courier.details_owed']}</p>

          {open.custody_accepted ? (
            <>
              {open.qr ? (
                <div className="courier-qr">
                  <QrSvg payload={encodeHandoffToken(open.qr)} />
                  {/* WHO scans it -- couriers read a QR on their own screen
                      as something THEY scan; the sentence prevents that. */}
                  <p className="callout">{en['console.courier.buyer_scans']}</p>
                </div>
              ) : (
                <p className="hint">{en['console.courier.qr_not_ready']}</p>
              )}
            </>
          ) : (
            <>
              {/* R25's first state: custody not accepted -- the QR is not
                  hidden, it DOES NOT EXIST YET, and the line says so. */}
              <p>{en['console.courier.qr_after_custody']}</p>
              <button
                type="button"
                className="button primary"
                disabled={busy}
                onClick={() => void acceptCustody()}
              >
                {en['console.courier.accept_custody']}
              </button>
            </>
          )}
        </section>
      ) : rows.length === 0 ? (
        <div className="empty" data-state="EMPTY">
          <h3>{en['console.courier.empty_heading']}</h3>
          <p>{en['console.courier.empty_body']}</p>
        </div>
      ) : (
        <ul className="courier-orders">
          {rows.map((o) => (
            <li key={o.id}>
              <button type="button" className="courier-order-row" onClick={() => void openOrder(o.id)}>
                <span className="courier-store">{o.store_name}</span>
                <span className="courier-ref"><code>{o.id.slice(0, 8)}</code></span>
                <span className="courier-state">{STATE_LABEL[o.state] ?? o.state}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
