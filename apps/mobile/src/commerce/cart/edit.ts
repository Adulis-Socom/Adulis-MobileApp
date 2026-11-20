import { keyUsable } from '../../api/mutation';
import type { EditJudgement, Reconciled } from './edit-outcome';
import { findLine, type LineId } from './model';
import type { CartViewState } from './view-state';

export type EditKind = 'SET_QUANTITY' | 'REMOVE';

/** What the Buyer asked for on one line. A quantity is absolute and only ever part of a quantity edit. */
export type EditTarget =
  | Readonly<{ kind: 'SET_QUANTITY'; lineId: LineId; quantity: number }>
  | Readonly<{ kind: 'REMOVE'; lineId: LineId }>;

/**
 * One edit the Buyer decided on, and the one idempotency key that decision owns. The body and the key are
 * fixed when the intent is made: a retry sends the same request under the same key.
 */
export type EditIntent = EditTarget &
  Readonly<{
    key: string;
    /** When the first request under this key was (or will be) sent, in ms. The key's age counts from here. */
    startedAt: number;
    /** Requests already sent under the key. */
    attempts: number;
  }>;

/**
 * Where one line's edit stands.
 *
 *   IDLE              nothing pending
 *   OFFLINE_NOT_SENT  the device was known to be offline: nothing was sent, nothing is queued
 *   SENDING           a request is in flight
 *   APPLIED           the server accepted it; nothing is claimed until a read made after that shows it
 *   REFUSED           the API itself refused it; nothing was stored
 *   LINE_GONE         the line is not in this cart (the API said so, or a read shows it)
 *   UNKNOWN           no proof either way; the same key may be sent again (`holdUntil`: a wait the server asked for)
 *   UNRESOLVED        no proof and the key can no longer be sent: the Buyer reads the carts and decides, and no
 *                     new edit of this line begins until it is dismissed
 *   CONFIRMED         a verified read shows the result
 *
 * Dismiss ends an edit that waits on the Buyer. Dismissing an UNKNOWN or UNRESOLVED one RELEASES its key: the
 * next edit of the line is a new intent with a new key, started only by the Buyer (the same rule as an add).
 * The server takes no key on these operations today, so the dismissed request, if it did reach the server,
 * may still land after a newer one; the mark the store keeps on the line says so. An edit that is SENDING or
 * APPLIED has no Dismiss: it settles on its own, or by the connection returning or the session changing.
 */
export type EditState =
  | Readonly<{ kind: 'IDLE' }>
  | Readonly<{ kind: 'OFFLINE_NOT_SENT'; intent: EditIntent }>
  | Readonly<{ kind: 'SENDING'; intent: EditIntent }>
  | Readonly<{ kind: 'APPLIED'; intent: EditIntent }>
  | Readonly<{ kind: 'REFUSED'; intent: EditIntent; code: string | null }>
  | Readonly<{ kind: 'LINE_GONE'; intent: EditIntent }>
  | Readonly<{
      kind: 'UNKNOWN';
      intent: EditIntent;
      holdUntil: number | null;
      offlineNotice: boolean;
    }>
  | Readonly<{ kind: 'UNRESOLVED'; intent: EditIntent }>
  | Readonly<{ kind: 'CONFIRMED'; intent: EditIntent }>;

export const IDLE_EDIT: EditState = { kind: 'IDLE' };

export type EditEvent =
  | Readonly<{ type: 'BEGIN'; target: EditTarget; key: string; now: number; online: boolean }>
  | Readonly<{ type: 'ACCEPTED' }>
  | Readonly<{ type: 'FAILED'; judgement: EditJudgement; now: number }>
  | Readonly<{ type: 'RETRY'; now: number; online: boolean }>
  | Readonly<{ type: 'READ'; verdict: Reconciled }>
  | Readonly<{ type: 'DISMISS' }>;

/** Whether an edit is in progress or waiting on the Buyer: a new BEGIN for the same line joins it. */
export const isPendingEdit = (state: EditState): boolean =>
  state.kind === 'SENDING' ||
  state.kind === 'APPLIED' ||
  state.kind === 'UNKNOWN' ||
  state.kind === 'OFFLINE_NOT_SENT';

/** Whether two targets are the same decision: the same kind, and for a quantity edit the same quantity. */
export const sameTarget = (a: EditTarget, b: EditTarget): boolean =>
  a.kind === b.kind &&
  a.lineId === b.lineId &&
  (a.kind !== 'SET_QUANTITY' || (b.kind === 'SET_QUANTITY' && a.quantity === b.quantity));

/**
 * The next state. The same object comes back when nothing changes, so a caller can tell. Pure: the key
 * and the time are given, never made here.
 */
export function reduceEdit(state: EditState, event: EditEvent): EditState {
  switch (event.type) {
    case 'BEGIN': {
      // A second tap on an edit that is pending is the same decision. One that could not be resolved may be
      // stored, and its key is the only evidence of it: it stays until the Buyer dismisses it.
      if (isPendingEdit(state) || state.kind === 'UNRESOLVED') return state;
      const intent: EditIntent = {
        ...event.target,
        key: event.key,
        startedAt: event.now,
        attempts: event.online ? 1 : 0,
      };
      return event.online ? { kind: 'SENDING', intent } : { kind: 'OFFLINE_NOT_SENT', intent };
    }
    case 'ACCEPTED':
      return state.kind === 'SENDING' ? { kind: 'APPLIED', intent: state.intent } : state;
    case 'FAILED': {
      if (state.kind !== 'SENDING') return state;
      const { judgement, now } = event;
      if (judgement.outcome === 'refused') {
        return { kind: 'REFUSED', intent: state.intent, code: judgement.code };
      }
      if (judgement.outcome === 'gone') return { kind: 'LINE_GONE', intent: state.intent };
      if (!judgement.replay) return { kind: 'UNRESOLVED', intent: state.intent };
      const holdUntil = judgement.holdMs === null ? null : now + judgement.holdMs;
      return { kind: 'UNKNOWN', intent: state.intent, holdUntil, offlineNotice: false };
    }
    case 'RETRY': {
      if (state.kind === 'OFFLINE_NOT_SENT') {
        if (!event.online) return state;
        // Nothing was sent before: the key's age starts with this first request.
        return { kind: 'SENDING', intent: { ...state.intent, startedAt: event.now, attempts: 1 } };
      }
      if (state.kind !== 'UNKNOWN') return state;
      if (!event.online) return state.offlineNotice ? state : { ...state, offlineNotice: true };
      if (state.holdUntil !== null && event.now < state.holdUntil) return state;
      if (!keyUsable(state.intent, event.now)) return { kind: 'UNRESOLVED', intent: state.intent };
      return { kind: 'SENDING', intent: { ...state.intent, attempts: state.intent.attempts + 1 } };
    }
    case 'READ': {
      // A read decides only an edit whose result is not drawn yet: it never revives a finished one.
      if (state.kind !== 'UNKNOWN' && state.kind !== 'UNRESOLVED' && state.kind !== 'APPLIED') {
        return state;
      }
      if (event.verdict === 'SATISFIED') return { kind: 'CONFIRMED', intent: state.intent };
      if (event.verdict === 'LINE_GONE') return { kind: 'LINE_GONE', intent: state.intent };
      // An accepted edit that no read confirms ends without a claim; an unknown one stays unknown.
      return state.kind === 'APPLIED' ? IDLE_EDIT : state;
    }
    case 'DISMISS':
      if (state.kind === 'SENDING' || state.kind === 'APPLIED' || state.kind === 'IDLE')
        return state;
      return IDLE_EDIT;
  }
}

/**
 * A quantity typed by the Buyer as a positive whole number written with the digits 0 to 9 and nothing else,
 * or null. Zero is not a quantity (a removal is its own action), and there is no ceiling here: the most
 * the server will take is the server's to refuse.
 */
export function parseQuantity(text: string): number | null {
  if (!/^[0-9]+$/.test(text)) return null;
  const quantity = Number(text);
  return Number.isSafeInteger(quantity) && quantity >= 1 ? quantity : null;
}

export type EditInputFailure =
  'UNAVAILABLE' | 'NOT_VERIFIED' | 'LINE_ABSENT' | 'INVALID_QUANTITY' | 'UNCHANGED';

export type EditInput =
  Readonly<{ ok: true; target: EditTarget }> | Readonly<{ ok: false; reason: EditInputFailure }>;

/**
 * What an edit may name, from the cart answer on screen: only a line of a VERIFIED answer, and for a
 * quantity edit a positive whole quantity that is not the one the server already shows. The only place a
 * quantity becomes a request.
 */
export function toEditInput(
  view: CartViewState,
  lineId: LineId,
  kind: EditKind,
  quantity?: number,
): EditInput {
  if (view.kind === 'DISABLED') return { ok: false, reason: 'UNAVAILABLE' };
  if (view.kind !== 'LISTED' || view.freshness.kind === 'UNVERIFIED') {
    return { ok: false, reason: 'NOT_VERIFIED' };
  }
  const line = findLine(view.carts, lineId);
  if (line === null) return { ok: false, reason: 'LINE_ABSENT' };
  if (kind === 'REMOVE') return { ok: true, target: { kind: 'REMOVE', lineId } };
  if (quantity === undefined || !Number.isSafeInteger(quantity) || quantity < 1) {
    return { ok: false, reason: 'INVALID_QUANTITY' };
  }
  if (quantity === line.quantity) return { ok: false, reason: 'UNCHANGED' };
  return { ok: true, target: { kind: 'SET_QUANTITY', lineId, quantity } };
}
