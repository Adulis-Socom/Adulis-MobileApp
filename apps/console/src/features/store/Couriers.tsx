/**
 * features/store/Couriers.tsx -- SC-23 Couriers (ADU-CON-03 v1.2 S11).
 *
 * GET / POST / DELETE /v1/seller/couriers. The endpoint v1.2 S17 still lists
 * as "Owed -- D-157" EXISTS and is real (couriers.controller.ts); what it
 * returns is narrower than the wireframe drew: { id, phone, invited_at,
 * claimed_at } -- claimed_at non-null IS the claimed marker, and pending
 * invites sit in the same list. No name, no assignment count, no last
 * activity, and -- sharpest -- no account_id, though courier ASSIGNMENT
 * (SC-04) requires courier_account_id in its body. Every one of those
 * absences is named on screen and registered (D-224); none is faked.
 *
 * Invite is by phone; the courier authenticates with THEIR OWN OTP, never
 * shared credentials, and the invite form says so. There is deliberately no
 * duplicate-invite error and no unknown-phone error (G1.8, the
 * registration-oracle closure) -- the same 201 either way, so this screen
 * never claims to know whether a number has an account.
 *
 * Revoking ends access IMMEDIATELY, including orders the courier held
 * (assignment-scoped visibility) -- the warning renders BEFORE the confirm,
 * as a two-step control.
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
import { timeFormatter } from '../../lib/intl';
import type { CourierRow } from './types';

export function Couriers() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [rows, setRows] = useState<readonly CourierRow[] | null>(null);
  const [state, setState] = useState<UiState>('LOADING');
  const [loadProblem, setLoadProblem] = useState<AdulisProblem | null>(null);
  const [phone, setPhone] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inviteKey = useIdempotencyKey();

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' || s === 'EMPTY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<{ data: CourierRow[] }>(`/seller/couriers`, { sellerId });
      setRows(r.data);
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

  const invite = async () => {
    if (!sellerId) return;
    setFieldError(null);
    if (!phone.trim()) {
      setFieldError(en['console.store.couriers.phone_required']);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/couriers`, {
        method: 'POST',
        sellerId,
        idempotencyKey: inviteKey.current(),
        body: { phone: phone.trim() },
      });
      inviteKey.remint();
      setPhone('');
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!sellerId) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/couriers/${id}`, { method: 'DELETE', sellerId });
      setConfirming(null);
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
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
    <section aria-labelledby="couriers-heading" data-screen="SC-23" className="couriers">
      <h1 id="couriers-heading">{en['console.store.couriers.heading']}</h1>

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

      <section aria-labelledby="invite-heading" className="invite">
        <h2 id="invite-heading">{en['console.store.couriers.invite_heading']}</h2>
        <label htmlFor="courier-phone">{en['console.store.couriers.phone']}</label>
        <input
          id="courier-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {/* Their own OTP, never shared credentials (S11). */}
        <p className="hint">{en['console.store.couriers.own_code']}</p>
        <button type="button" className="button primary" disabled={busy} onClick={() => void invite()}>
          {en['console.store.couriers.send_invitation']}
        </button>
      </section>

      {rows.length === 0 ? (
        <div className="empty" data-state="EMPTY">
          <h3>{en['console.store.couriers.empty_heading']}</h3>
          <p>{en['console.store.couriers.empty_body']}</p>
        </div>
      ) : (
        <>
          <ul className="courier-list">
            {rows?.map((r) => (
              <li key={r.id} className="courier-row">
                <span className="courier-phone">{r.phone}</span>
                <span className={`badge badge-${r.claimed_at ? 'claimed' : 'pending'}`}>
                  {r.claimed_at
                    ? en['console.store.couriers.claimed']
                    : en['console.store.couriers.pending']}
                </span>
                <span className="courier-invited">
                  {fmt ? fmt.format(new Date(r.invited_at)) : r.invited_at}
                </span>
                {confirming === r.id ? (
                  <span className="confirm-remove">
                    {/* The consequence, stated BEFORE the second tap. */}
                    <span className="warn">{en['console.store.couriers.remove_warning']}</span>
                    <button type="button" className="button" disabled={busy} onClick={() => void remove(r.id)}>
                      {en['console.store.couriers.remove_confirm']}
                    </button>
                    <button type="button" className="button" onClick={() => setConfirming(null)}>
                      {en['console.store.couriers.remove_cancel']}
                    </button>
                  </span>
                ) : (
                  <button type="button" className="button" onClick={() => setConfirming(r.id)}>
                    {en['console.store.couriers.remove']}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {/* D-224: what the wireframe drew and the wire cannot carry --
              name, assignment count, last activity -- named, not faked. */}
          <p className="hint">{en['console.store.couriers.columns_owed']}</p>
        </>
      )}
    </section>
  );
}
