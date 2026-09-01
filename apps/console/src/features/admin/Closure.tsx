/**
 * features/admin/Closure.tsx -- SC-29 Closure and deletion (v1.2 S12, G1.3).
 *
 * TWO DISTINCT THINGS, AND THE SCREEN MUST NOT BLUR THEM. Closing is
 * REVERSIBLE: POST /v1/seller/closure stops new obligations and unpublishes;
 * DELETE reopens. Deletion is NOT, and is blocked while obligations exist.
 *
 * G1.3: closure stays available while deletion is blocked -- the blocked
 * seller's escape hatch (and D-75 records the one gap: closure requires
 * ACTIVE, so a SUSPENDED seller cannot take it; the 409 ILLEGAL_TRANSITION
 * renders rather than hiding).
 *
 * BLOCKERS RENDER FROM items[] -- EVERY ONE, never the first (S12), each as
 * its MESSAGE with what clears it. GET .../deletion/blockers is 200 always
 * ("a state, not a failure"); POST /v1/seller/deletion refuses with the same
 * items[] on 409 DELETION_BLOCKED. Deletion is step-up SELLER_DELETION,
 * challengeRequired, and Owner-only at the server.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { en, type MessageKey } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { ScreenState } from '../../components/ScreenState';
import { useIdempotencyKey } from '../../lib/idempotency';
import { useStepUp } from '../../auth/useStepUp';
import type { UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import type { DeletionBlocker } from './types';

/** message_key via the catalogue, visible-key fallback -- never a raw code. */
function blockerText(b: DeletionBlocker): string {
  const catalogue = en as Record<string, string>;
  return catalogue[b.message_key as MessageKey] ?? b.message_key;
}

export function Closure() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [blockers, setBlockers] = useState<readonly DeletionBlocker[] | null>(null);
  const [closed, setClosed] = useState<boolean | null>(null);
  const [state, setState] = useState<UiState>('LOADING');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const closeKey = useIdempotencyKey();
  const deleteKey = useIdempotencyKey();
  const { guard, modal } = useStepUp();

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<{ items: DeletionBlocker[] }>(`/seller/deletion/blockers`, { sellerId });
      setBlockers(r.items);
      setState('READY');
    } catch (e) {
      // A non-owner cannot read deletion blockers (owner-only) -- the
      // deletion region renders nothing for them, but CLOSING must survive:
      // G1.3's separation is exactly for the seller who cannot delete.
      if (e instanceof ApiError && e.problem.status === 403) {
        setBlockers(null);
        setState('READY');
      } else {
        setState(e instanceof ApiError ? stateFromProblem(e.problem) : 'TRANSPORT_ERROR');
      }
    }
  }, [sellerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const close = async () => {
    if (!sellerId) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/closure`, { method: 'POST', sellerId, idempotencyKey: closeKey.current() });
      closeKey.remint();
      setClosed(true);
      setConfirmingClose(false);
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const reopen = async () => {
    if (!sellerId) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/closure`, { method: 'DELETE', sellerId });
      setClosed(false);
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!sellerId) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await guard(
        'SELLER_DELETION',
        undefined,
        (challengeId) =>
          api(`/seller/deletion`, {
            method: 'POST',
            sellerId,
            idempotencyKey: deleteKey.current(),
            body: { step_up_challenge_id: challengeId },
          }),
        { challengeRequired: true },
      );
      if (r !== null) {
        // TERMINAL: the seller no longer exists. Nothing here refetches --
        // every subsequent call would 403 about a store that is gone.
        setDeleted(true);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        // 409 DELETION_BLOCKED carries the same items[]; render them where
        // the GET's list renders, freshly.
        if (e.problem.items && e.problem.items.length > 0) {
          setBlockers(e.problem.items as DeletionBlocker[]);
        } else {
          setProblem(e);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  // No NO_PERMISSION gate: the one load is the blockers GET, whose 403
  // (non-owner) deliberately maps to READY-without-the-deletion-region
  // above. Closure's own permission failures arrive on the POST, as banners.
  if (deleted) {
    return (
      <section aria-labelledby="closure-heading" data-screen="SC-29" className="closure">
        <h1 id="closure-heading">{en['console.admin.closure.heading']}</h1>
        <div data-state="TERMINAL">
          <p>{en['console.admin.closure.deleted_terminal']}</p>
        </div>
      </section>
    );
  }
  if (state !== 'READY' && state !== 'STALE') {
    return <ScreenState state={state} onRetry={() => void load()} />;
  }

  return (
    <section aria-labelledby="closure-heading" data-screen="SC-29" className="closure">
      <h1 id="closure-heading">{en['console.admin.closure.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}

      <section aria-labelledby="close-heading" className="close-store">
        <h2 id="close-heading">{en['console.admin.closure.close_heading']}</h2>
        {closed === null ? (
          <p className="hint">{en['console.admin.closure.status_owed']}</p>
        ) : null}
        {closed ? (
          <>
            <span className="badge badge-closed">{en['console.admin.closure.closed_badge']}</span>
            <p>{en['console.admin.closure.closed_body']}</p>
            <button type="button" className="button primary" disabled={busy} onClick={() => void reopen()}>
              {en['console.admin.closure.reopen']}
            </button>
          </>
        ) : (
          <>
            {/* REVERSIBLE, and the copy says so before the control. */}
            <p>{en['console.admin.closure.close_body']}</p>
            {confirmingClose ? (
              <>
                <p className="warn">{en['console.admin.closure.close_confirm_body']}</p>
                <button type="button" className="button" disabled={busy} onClick={() => void close()}>
                  {en['console.admin.closure.close_confirm']}
                </button>
                <button type="button" className="button" onClick={() => setConfirmingClose(false)}>
                  {en['console.admin.closure.close_cancel']}
                </button>
              </>
            ) : (
              <button type="button" className="button" onClick={() => setConfirmingClose(true)}>
                {en['console.admin.closure.close']}
              </button>
            )}
          </>
        )}
      </section>

      {blockers !== null ? (
        <section aria-labelledby="delete-heading" className="delete-account">
          <h2 id="delete-heading">{en['console.admin.closure.delete_heading']}</h2>
          {/* PERMANENT, stated first. */}
          <p>{en['console.admin.closure.delete_body']}</p>

          {blockers.length > 0 ? (
            <div className="problem" role="alert" data-state="CONFLICT">
              <h3>{en['console.admin.closure.blocked_heading']}</h3>
              {/* EVERY blocker, as its message -- G1.3's "names its clearing
                  action" lives in the message_key's own sentence. */}
              <ul>
                {blockers.map((b, i) => (
                  <li key={`${b.code}-${i}`}>{blockerText(b)}</li>
                ))}
              </ul>
              {/* Closure stays available while this list stands (G1.3). */}
              <p className="hint">{en['console.admin.closure.close_instead']}</p>
            </div>
          ) : (
            <button type="button" className="button" disabled={busy} onClick={() => void del()}>
              {en['console.admin.closure.delete']}
            </button>
          )}
        </section>
      ) : null}

      {modal}
    </section>
  );
}
