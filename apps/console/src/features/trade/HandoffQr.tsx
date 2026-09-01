/**
 * features/trade/HandoffQr.tsx -- SC-06, modal over SC-04.
 * GET /v1/seller/orders/{id}/qr - seller.handoff:read.
 *
 * ==========================================================================
 * WHAT THE QR IS FOR, IN ONE SENTENCE THE SCREEN ALSO SAYS
 * ==========================================================================
 * The BUYER scans it, at the doorway. The scan writes
 * PAYMENT_CONFIRMED -> HANDED_OFF and lets them leave a review. Sellers
 * reliably read a QR on their own screen as something THEY scan, so the line
 * naming who scans it is not decoration.
 *
 * ==========================================================================
 * WHY THIS SCREEN IS REACHABLE ONLY AFTER PAYMENT_CONFIRMED
 * ==========================================================================
 * R20 gates the whole handoff region, and S7 gives Show QR a stronger reason
 * than the other two controls: "no legal transition exists from
 * PAYMENT_SUBMITTED -- so a QR presented earlier either fails on scan or
 * completes an order nobody has paid for. The token should not be issuable
 * before the payment is confirmed."
 *
 * The server agrees and is the enforcement: `getQr` throws
 * ORDER_NOT_READYABLE when no token row exists, and a token row exists only
 * from PAYMENT_CONFIRMED. SC-04 disabling the control is the SECOND line of
 * defence, not the only one.
 *
 * ==========================================================================
 * THE PAYLOAD SERIALISATION IS UNSPECIFIED. D-156.
 * ==========================================================================
 * The endpoint returns four fields. NO DOCUMENT SAYS HOW THEY ARE ENCODED
 * INTO THE QR -- not ADU-CON-03, not ADU-API-01 S12.6, not ADU-PRD-01 S648
 * ("the QR encodes a signed offline token", which names the contents and not
 * the format). The buyer's Companion has to parse whatever this produces, so
 * the format IS a contract and this file is not entitled to author one.
 *
 * `encodeHandoffToken` (lib/qr.tsx since C-8) is therefore an INTERIM encoding, isolated in
 * one exported function so the ruling changes one line. It is compact JSON of
 * exactly the three fields the endpoint returns that the scanner cannot
 * derive -- `signed_at` is deliberately absent because the SCANNER stamps it
 * (handoff.schemas.ts: epoch milliseconds read at scan time). Registered, and
 * the register entry asks for the ruling rather than announcing a decision.
 *
 * ==========================================================================
 * NO OFFLINE CACHE (ADU-CON-02 S8)
 * ==========================================================================
 * The console holds no authenticated data; the service worker precaches the
 * app shell and treats /v1/* as NetworkOnly. Offline QR is the Companion's
 * job. Opened without a connection this says so plainly and points at the
 * app rather than showing a stale token.
 */
import { useEffect, useState } from 'react';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import { stateFromProblem, type UiState } from '../../lib/states';
import type { QrToken } from './types';
import { encodeHandoffToken, QrSvg } from '../../lib/qr';
// The encoding and the SVG renderer moved to lib/qr.tsx at C-8 (SC-C1 needs
// the SAME interim D-156 format); this file re-exports the encoder so its
// existing importers and the register's citation stay true.
export { encodeHandoffToken } from '../../lib/qr';

interface Props {
  readonly sellerId: string;
  readonly orderId: string;
  readonly onClose: () => void;
}

export function HandoffQr({ sellerId, orderId, onClose }: Props) {
  const [state, setState] = useState<UiState>('LOADING');
  const [token, setToken] = useState<QrToken | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  useEffect(() => {
    if (offline) return;
    let cancelled = false;
    (async () => {
      try {
        const t = await api<QrToken>(`/seller/orders/${orderId}/qr`, { sellerId });
        if (cancelled) return;
        setToken(t);
        setState('READY');
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError) {
          setProblem(e);
          setState(stateFromProblem(e.problem));
        } else {
          setProblem(null);
          setState('TRANSPORT_ERROR');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, sellerId, offline]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="qr-title" className="modal qr">
        <h2 id="qr-title">{en['console.trade.qr.title']}</h2>

        {offline ? (
          // Plainly, and pointing at the app. NOT a cached token.
          <p className="offline" data-offline="true">
            {en['console.trade.qr.offline']}
          </p>
        ) : (
          <ScreenState state={state} {...(problem ? { problem: problem.problem } : {})}>
            {token ? <QrSvg payload={encodeHandoffToken(token)} /> : null}
            {/* WHO scans it, and what happens when they do. */}
            <p className="qr-explain">{en['console.trade.qr.explain']}</p>
          </ScreenState>
        )}

        <button type="button" className="modal-close" onClick={onClose}>
          {en['console.trade.qr.close']}
        </button>
      </div>
    </div>
  );
}
