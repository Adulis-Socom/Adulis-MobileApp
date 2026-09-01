/**
 * lib/qr.tsx -- the ONE encoding and the ONE renderer for the handoff QR.
 * Lived in features/trade/HandoffQr.tsx (SC-06) through C-4; C-8 moved it
 * here when SC-C1 needed the SAME payload on the courier surface -- the
 * alternative was a second copy of an INTERIM format, and a format kept in
 * two places diverges exactly when a scanner is pointed at it.
 *
 * THE PAYLOAD SERIALISATION IS UNSPECIFIED. D-156. The endpoint returns four
 * fields and no document says how they become a string; the Companion has to
 * parse whatever this produces, so the format IS a contract and this file is
 * not entitled to author one. `encodeHandoffToken` is an INTERIM encoding,
 * one exported function so the ruling changes one line. Field order is fixed
 * so the string is deterministic.
 *
 * The QR renders as SVG rects built in JSX -- never a generated markup
 * string into dangerouslySetInnerHTML on the origin where payout details
 * change, and never a canvas (a save affordance wearing another name).
 * Error correction M, quiet zone 4, pure black on pure white and NOT
 * theme-aware: an inverted QR does not scan on many readers, and a doorway
 * in the dark is exactly when this is used.
 */
import qrcode from 'qrcode-generator';
import { en } from '@adulis/locale';

/** The four signed fields (ADU-API-01 S12.6); the scanner stamps its own time. */
export interface QrToken {
  readonly order_ref: string;
  readonly nonce: string;
  readonly signing_key_version: number;
  readonly signature: string;
}

/** INTERIM (D-156). One function, one line to change when the format is ruled. */
export function encodeHandoffToken(t: QrToken): string {
  return JSON.stringify({ o: t.order_ref, n: t.nonce, k: t.signing_key_version, s: t.signature });
}

export function QrSvg({ payload }: { readonly payload: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  const size = n + quiet * 2;
  const cells: React.ReactElement[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) {
        cells.push(<rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width={1} height={1} />);
      }
    }
  }
  return (
    <svg
      className="handoff-qr"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={en['console.trade.qr.alt']}
      shapeRendering="crispEdges"
    >
      <rect x={0} y={0} width={size} height={size} fill="#ffffff" />
      <g fill="#000000">{cells}</g>
    </svg>
  );
}
