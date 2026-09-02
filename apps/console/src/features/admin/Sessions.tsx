/**
 * features/admin/Sessions.tsx -- SC-27 Sessions and devices (v1.2 S12).
 *
 * GET /v1/auth/sessions -- ONE list; a remembered device (R17) is a session
 * row with `remembered` true, its label, and (T15 Phase 4) the id of the
 * account_device to forget. The screen renders the two REGIONS the spec asks
 * for, both derived from the one list.
 *
 * THREE ACTIONS, AND THEY ARE DISTINCT: DELETE /v1/auth/sessions/{id} ends one
 * session (NO step-up); POST .../revoke-others ends all others (step-up
 * REVOKE_ALL_SESSIONS, challengeRequired); and DELETE
 * /v1/auth/remembered-devices/{id} (T15 Phase 4) FORGETS a device ALONE --
 * the session stays live, it just loses R17's extended lifetime. Removing the
 * remembered flag and signing out are no longer the same act.
 *
 * NEVER EMPTY: the current session is always listed (S14), so there is no
 * empty state to design and rendering one would be a bug.
 */
import { useCallback, useEffect, useState } from 'react';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { ScreenState } from '../../components/ScreenState';
import { useStepUp } from '../../auth/useStepUp';
import type { UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { useMarketContext } from '../../lib/market';
import { timeFormatter } from '../../lib/intl';
import type { SessionRow } from './types';

export function Sessions() {
  const market = useMarketContext();
  const [rows, setRows] = useState<readonly SessionRow[] | null>(null);
  const [state, setState] = useState<UiState>('LOADING');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const { guard, modal } = useStepUp();

  const load = useCallback(async () => {
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<{ data: SessionRow[] }>(`/auth/sessions`);
      setRows(r.data);
      setState('READY');
    } catch (e) {
      setState(e instanceof ApiError ? stateFromProblem(e.problem) : 'TRANSPORT_ERROR');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revokeOne = async (id: string) => {
    setBusy(true);
    setProblem(null);
    try {
      await api(`/auth/sessions/${id}`, { method: 'DELETE' });
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Forget a remembered device ALONE (T15 Phase 4): the session stays live and
   * signed in; it simply stops being remembered, so its next renewal gets the
   * ordinary lifetime instead of R17's seven days. No step-up -- like a single
   * sign-out, this reduces standing access rather than extending it.
   */
  const forgetDevice = async (accountDeviceId: string) => {
    setBusy(true);
    setProblem(null);
    try {
      await api(`/auth/remembered-devices/${accountDeviceId}`, { method: 'DELETE' });
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const revokeOthers = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await guard(
        'REVOKE_ALL_SESSIONS',
        undefined,
        (challengeId) =>
          api(`/auth/sessions/revoke-others`, {
            method: 'POST',
            body: { step_up_challenge_id: challengeId },
          }),
        { challengeRequired: true },
      );
      if (r !== null) void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'NO_PERMISSION') return null;
  if (!rows) return <ScreenState state={state} onRetry={() => void load()} />;

  const fmt = market ? timeFormatter(market) : null;
  const when = (iso: string) => (fmt ? fmt.format(new Date(iso)) : iso);
  const remembered = rows.filter((r) => r.remembered);

  return (
    <section aria-labelledby="sessions-heading" data-screen="SC-27" className="sessions">
      <h1 id="sessions-heading">{en['console.admin.sessions.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {state === 'TRANSPORT_ERROR' ? (
        <p className="problem" role="alert">
          {en['console.common.refetch_failed']}
        </p>
      ) : null}

      <section aria-labelledby="signed-in-heading" className="session-list">
        <h2 id="signed-in-heading">{en['console.admin.sessions.signed_in_heading']}</h2>
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="session-row">
              <span className="session-device">
                {r.remembered_label ?? r.device_platform ?? r.audience}
              </span>
              <span className="session-last-used">{when(r.last_activity_at)}</span>
              <span className="session-location">{r.approx_location ?? ''}</span>
              {r.current ? (
                <span className="badge badge-current">{en['console.admin.sessions.this_session']}</span>
              ) : (
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => void revokeOne(r.id)}
                >
                  {en['console.admin.sessions.sign_out_row']}
                </button>
              )}
            </li>
          ))}
        </ul>
        <button type="button" className="button" disabled={busy} onClick={() => void revokeOthers()}>
          {en['console.admin.sessions.sign_out_others']}
        </button>
      </section>

      <section aria-labelledby="remembered-heading" className="remembered-devices">
        <h2 id="remembered-heading">{en['console.admin.sessions.remembered_heading']}</h2>
        {/* The consequence, stated where the control sits (T15 Phase 4):
            forgetting keeps the session signed in -- it is NOT a sign-out. */}
        <p className="callout">{en['console.admin.sessions.remembered_consequence']}</p>
        {remembered.length === 0 ? (
          <p className="hint">{en['console.admin.sessions.remembered_none_visible']}</p>
        ) : (
          <ul>
            {remembered.map((r) => (
              <li key={r.id} className="session-row" data-remembered-device={r.remembered_device_id}>
                <span className="session-device">{r.remembered_label ?? r.device_platform ?? ''}</span>
                <span className="session-last-used">{when(r.last_activity_at)}</span>
                {r.remembered_device_id ? (
                  <button
                    type="button"
                    className="button"
                    data-action="forget-device"
                    disabled={busy}
                    onClick={() => void forgetDevice(r.remembered_device_id as string)}
                  >
                    {en['console.admin.sessions.forget_device']}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {modal}
    </section>
  );
}
