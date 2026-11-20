import { keyConflict, keyUsable, waitBeforeRetryMs } from '../../api/mutation';
import { findLine, type CartSet, type LineId } from './model';
import { apiOwnProblem } from './outcome';

/**
 * What one failed attempt of a cart edit proves.
 *
 *   refused  the API itself rejected the request before anything was stored
 *   gone     the API itself says the line is not in this cart (for a removal, that is the goal)
 *   unknown  no proof either way; `replay`: the same request under the same key may be sent again
 */
export type EditJudgement =
  | Readonly<{ outcome: 'refused'; code: string | null }>
  | Readonly<{ outcome: 'gone' }>
  | Readonly<{ outcome: 'unknown'; replay: boolean; holdMs: number | null }>;

/**
 * Judge one failed attempt of a cart edit, at `now`, for the intent that began at `intent.startedAt`.
 *
 * Only the API's own problem answer proves anything: a 5xx proves nothing (the connection can drop after
 * the commit), nor does a rate limit, a proxy's page, a lost connection or an unreadable answer. A 409 is
 * never a known refusal here (no edit has a documented one), and a key conflict says the key was already
 * used, so the first attempt may be stored. `attempts` counts the requests already sent under the key: on a
 * replay a refusal says nothing about the first request, so only a 400 or a 413 still proves it.
 */
export function judgeEdit(
  failure: unknown,
  intent: { startedAt: number; attempts: number },
  now: number,
): EditJudgement {
  const holdMs = waitBeforeRetryMs(failure);
  if (keyConflict(failure)) return { outcome: 'unknown', replay: false, holdMs };
  const own = apiOwnProblem(failure);
  if (own !== null) {
    const { status, code } = own;
    if (status === 404 && code === 'NOT_FOUND') return { outcome: 'gone' };
    if (status >= 400 && status < 500 && status !== 409 && status !== 429) {
      if (intent.attempts < 2 || status === 400 || status === 413) {
        return { outcome: 'refused', code };
      }
    }
  }
  return { outcome: 'unknown', replay: keyUsable(intent, now), holdMs };
}

/** What a verified answer says about an edit. NOT_A_BASIS: it says nothing (see `reconcileEdit`). */
export type Reconciled = 'SATISFIED' | 'LINE_GONE' | 'NOT_SHOWN' | 'NOT_A_BASIS';

/** The part of an edit intent a verified answer is compared with. */
export type ReconcileTarget = Readonly<{ lineId: LineId; startedAt: number }> &
  (Readonly<{ kind: 'SET_QUANTITY'; quantity: number }> | Readonly<{ kind: 'REMOVE' }>);

/**
 * What a verified answer says about an edit whose outcome is not known: reading, never replaying.
 * A quantity edit is SATISFIED when the line shows that quantity, and LINE_GONE when the line is not
 * there; a removal is SATISFIED when the line is not there. Anything else is NOT_SHOWN: a late commit is
 * still possible, so the edit stays unknown. An answer that is not verified, that belongs to another
 * scope, or that arrived before the edit began is NOT_A_BASIS.
 */
export function reconcileEdit(
  intent: ReconcileTarget,
  basis: Readonly<{ carts: CartSet; receivedAt: number; verified: boolean; epoch: number }>,
  intentEpoch: number,
): Reconciled {
  if (!basis.verified || basis.epoch !== intentEpoch || basis.receivedAt < intent.startedAt) {
    return 'NOT_A_BASIS';
  }
  const line = findLine(basis.carts, intent.lineId);
  if (line === null) return intent.kind === 'REMOVE' ? 'SATISFIED' : 'LINE_GONE';
  return intent.kind === 'SET_QUANTITY' && line.quantity === intent.quantity
    ? 'SATISFIED'
    : 'NOT_SHOWN';
}
