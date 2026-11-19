import type { StorefrontProduct } from '../../api/client';
import { keyUsable } from '../../api/mutation';
import { isSelectable } from '../../buyer/product-variants';
import { asVariantId, type LineId, type VariantId } from './model';
import type { AddJudgement } from './outcome';

/**
 * What the Buyer decided to add, and the one idempotency key that decision owns. The body and the key
 * are fixed when the intent is made: a retry sends the same request under the same key.
 */
export type AddIntent = Readonly<{
  variantId: VariantId;
  quantity: number;
  key: string;
  /** When the first request under this key was (or will be) sent, in ms. The key's age counts from here. */
  startedAt: number;
  /** Requests already sent under the key. */
  attempts: number;
}>;

/**
 * Where one add stands.
 *
 *   IDLE              nothing pending; `earlierUnconfirmed` says an earlier add of this option ended unconfirmed
 *   OFFLINE_NOT_SENT  the device was known to be offline: nothing was sent, nothing is queued
 *   SENDING           a request is in flight
 *   ADDED             the server accepted it (the line is drawn only once the carts are read again)
 *   REFUSED           the API itself refused it; nothing was stored
 *   REFUSED_RELOAD    a known refusal that says the carts changed: read them again
 *   UNKNOWN           no proof either way; the same key may be sent again (`holdUntil`: a wait the server asked for)
 *   UNRESOLVED        no proof and the key can no longer be sent: the Buyer reads the carts and decides
 */
export type AddState =
  | Readonly<{ kind: 'IDLE'; earlierUnconfirmed: boolean }>
  | Readonly<{ kind: 'OFFLINE_NOT_SENT'; intent: AddIntent }>
  | Readonly<{ kind: 'SENDING'; intent: AddIntent }>
  | Readonly<{ kind: 'ADDED'; intent: AddIntent; lineId: LineId }>
  | Readonly<{ kind: 'REFUSED'; intent: AddIntent; code: string | null }>
  | Readonly<{ kind: 'REFUSED_RELOAD'; intent: AddIntent; code: string | null }>
  | Readonly<{ kind: 'UNKNOWN'; intent: AddIntent; holdUntil: number | null; offlineNotice: boolean }>
  | Readonly<{ kind: 'UNRESOLVED'; intent: AddIntent }>;

export const IDLE: AddState = { kind: 'IDLE', earlierUnconfirmed: false };
export const IDLE_UNCONFIRMED: AddState = { kind: 'IDLE', earlierUnconfirmed: true };

export type AddEvent =
  | Readonly<{ type: 'BEGIN'; variantId: VariantId; quantity: number; key: string; now: number; online: boolean }>
  | Readonly<{ type: 'ACCEPTED'; lineId: LineId }>
  | Readonly<{ type: 'FAILED'; judgement: AddJudgement; now: number }>
  | Readonly<{ type: 'RETRY'; now: number; online: boolean }>
  | Readonly<{ type: 'DISMISS' }>;

/** Whether an add is in progress or waiting on the Buyer: a new BEGIN for the same option joins it. */
export const isPending = (state: AddState): boolean =>
  state.kind === 'SENDING' || state.kind === 'UNKNOWN' || state.kind === 'OFFLINE_NOT_SENT';

/**
 * The next state. The same object comes back when nothing changes, so a caller can tell. Pure: the key
 * and the time are given, never made here.
 */
export function reduceAdd(state: AddState, event: AddEvent): AddState {
  switch (event.type) {
    case 'BEGIN': {
      // A second tap on an add that is pending is the same decision, not a new one.
      if (isPending(state)) return state;
      const intent: AddIntent = {
        variantId: event.variantId,
        quantity: event.quantity,
        key: event.key,
        startedAt: event.now,
        attempts: event.online ? 1 : 0,
      };
      return event.online ? { kind: 'SENDING', intent } : { kind: 'OFFLINE_NOT_SENT', intent };
    }
    case 'ACCEPTED':
      return state.kind === 'SENDING' ? { kind: 'ADDED', intent: state.intent, lineId: event.lineId } : state;
    case 'FAILED': {
      if (state.kind !== 'SENDING') return state;
      const { judgement, now } = event;
      if (judgement.outcome === 'refused') {
        return judgement.reload
          ? { kind: 'REFUSED_RELOAD', intent: state.intent, code: judgement.code }
          : { kind: 'REFUSED', intent: state.intent, code: judgement.code };
      }
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
    case 'DISMISS':
      if (state.kind === 'UNKNOWN' || state.kind === 'UNRESOLVED') return IDLE_UNCONFIRMED;
      if (state.kind === 'SENDING' || state.kind === 'IDLE') return state;
      return IDLE;
  }
}

export type AddIntentInput = Readonly<{ variantId: VariantId; quantity: number }>;

/**
 * What an add may name, from the public Product answer on screen: only an option that answer offers and
 * that the server says can be bought now (the existing selectable-option rule), and a positive whole
 * quantity. There is no ceiling here: the most the server will take is the server's to refuse.
 */
export function toAddIntent(product: StorefrontProduct, variantId: string, quantity: number): AddIntentInput | null {
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  const variant = product.variants.find((v) => v.id === variantId);
  if (!variant || !isSelectable(product, variant)) return null;
  return { variantId: asVariantId(variant.id), quantity };
}
