import type { StorefrontProduct } from '../../api/client';
import { toEditInput, type EditState } from './edit';
import { toAddIntent, type AddIntentInput, type AddState } from './intent';
import type { LineId } from './model';
import type { CartViewState } from './view-state';

/**
 * Changing the option of a line is two operations the cart has, not one it lacks: ADD the new option first,
 * and REMOVE the old line second, only after a read made after the add holds the new option. Remove then add
 * is never used (a lost add would lose the line). The pair is not atomic and may end with both lines.
 */
export type VariantChangePlan = Readonly<{ oldLineId: LineId; add: AddIntentInput }>;

export type VariantChangeRefusal =
  | 'UNAVAILABLE'
  | 'NOT_VERIFIED'
  | 'LINE_ABSENT'
  | 'NO_PRODUCT_LINK'
  | 'PRODUCT_MISMATCH'
  | 'SAME_VARIANT'
  | 'INVALID_QUANTITY'
  | 'NOT_SELECTABLE';

/**
 * What a change may name: a line of a verified answer that carries its Product and its Seller's handle, the
 * public Product answer on screen for that very Product, and an option that answer offers and that the
 * server says can be bought now, different from the line's own, with a positive whole quantity.
 */
export function planVariantChange(
  view: CartViewState,
  product: StorefrontProduct,
  lineId: LineId,
  toVariantId: string,
  quantity: number,
):
  | Readonly<{ ok: true; plan: VariantChangePlan }>
  | Readonly<{ ok: false; reason: VariantChangeRefusal }> {
  const editable = toEditInput(view, lineId, 'REMOVE');
  if (!editable.ok) {
    // A removal can fail to be named for these three reasons only.
    const reason = editable.reason;
    return {
      ok: false,
      reason: reason === 'UNAVAILABLE' || reason === 'LINE_ABSENT' ? reason : 'NOT_VERIFIED',
    };
  }
  if (view.kind !== 'LISTED') return { ok: false, reason: 'NOT_VERIFIED' };
  const cart = view.carts.carts.find((c) => c.lines.some((l) => l.lineId === lineId));
  const line = cart?.lines.find((l) => l.lineId === lineId);
  if (!cart || !line) return { ok: false, reason: 'LINE_ABSENT' };
  if (line.productSlug === null || cart.handle === null) {
    return { ok: false, reason: 'NO_PRODUCT_LINK' };
  }
  if (product.slug !== line.productSlug || product.seller.handle !== cart.handle) {
    return { ok: false, reason: 'PRODUCT_MISMATCH' };
  }
  if (line.variantId === toVariantId) return { ok: false, reason: 'SAME_VARIANT' };
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return { ok: false, reason: 'INVALID_QUANTITY' };
  }
  const add = toAddIntent(product, toVariantId, quantity);
  if (add === null) return { ok: false, reason: 'NOT_SELECTABLE' };
  return { ok: true, plan: { oldLineId: lineId, add } };
}

/**
 * Where one change stands.
 *
 *   ADDING    the new option is being added
 *   STALLED   the add is unknown: the old line is NOT removed, and nothing continues on its own
 *   REMOVING  a read made after the add holds the new option: the old line is being removed
 *   PARTIAL   the removal did not complete: both lines remain, and the Buyer decides
 *   DONE      the old line is gone
 *   ABORTED   the add did not happen, or a read after it does not hold the new option: nothing was removed
 */
export type ChangeState =
  | Readonly<{ kind: 'IDLE' }>
  | Readonly<{ kind: 'ADDING'; plan: VariantChangePlan }>
  | Readonly<{ kind: 'STALLED'; plan: VariantChangePlan }>
  | Readonly<{ kind: 'REMOVING'; plan: VariantChangePlan }>
  | Readonly<{ kind: 'PARTIAL'; plan: VariantChangePlan }>
  | Readonly<{ kind: 'DONE'; plan: VariantChangePlan }>
  | Readonly<{ kind: 'ABORTED'; plan: VariantChangePlan }>;

export const IDLE_CHANGE: ChangeState = { kind: 'IDLE' };

export type ChangeEvent =
  | Readonly<{ type: 'BEGIN'; plan: VariantChangePlan }>
  /** The add leg's state, as the add machine reports it. */
  | Readonly<{ type: 'ADD'; add: AddState['kind'] }>
  /** A read made AFTER the add was accepted: whether it holds a line for the new option. */
  | Readonly<{ type: 'READ_AFTER_ADD'; holdsNew: boolean }>
  /** The remove leg's state, as the edit machine reports it. */
  | Readonly<{ type: 'REMOVE'; edit: EditState['kind'] }>
  | Readonly<{ type: 'DISMISS' }>;

const inFlight = (state: ChangeState): boolean =>
  state.kind === 'ADDING' || state.kind === 'REMOVING';

/** The next state. The same object comes back when nothing changes, so a caller can tell. Pure. */
export function reduceChange(state: ChangeState, event: ChangeEvent): ChangeState {
  switch (event.type) {
    case 'BEGIN':
      // One decision at a time: a change that is running or waiting on the Buyer is not replaced.
      return state.kind === 'IDLE' || state.kind === 'DONE' || state.kind === 'ABORTED'
        ? { kind: 'ADDING', plan: event.plan }
        : state;
    case 'ADD': {
      if (state.kind !== 'ADDING' && state.kind !== 'STALLED') return state;
      const { plan } = state;
      if (
        event.add === 'REFUSED' ||
        event.add === 'REFUSED_RELOAD' ||
        event.add === 'OFFLINE_NOT_SENT'
      ) {
        return { kind: 'ABORTED', plan };
      }
      if (event.add === 'UNKNOWN' || event.add === 'UNRESOLVED') {
        return state.kind === 'STALLED' ? state : { kind: 'STALLED', plan };
      }
      // An add that was unknown and is now accepted (the Buyer tried again) goes on as if it never stalled.
      return event.add === 'ADDED' && state.kind === 'STALLED' ? { kind: 'ADDING', plan } : state;
    }
    case 'READ_AFTER_ADD':
      if (state.kind !== 'ADDING') return state;
      return event.holdsNew
        ? { kind: 'REMOVING', plan: state.plan }
        : { kind: 'ABORTED', plan: state.plan };
    case 'REMOVE': {
      if (state.kind !== 'REMOVING' && state.kind !== 'PARTIAL') return state;
      const { plan } = state;
      if (event.edit === 'CONFIRMED' || event.edit === 'LINE_GONE') return { kind: 'DONE', plan };
      if (state.kind === 'REMOVING') {
        if (event.edit === 'REFUSED' || event.edit === 'UNKNOWN' || event.edit === 'UNRESOLVED') {
          return { kind: 'PARTIAL', plan };
        }
      }
      return state;
    }
    case 'DISMISS':
      return inFlight(state) ? state : IDLE_CHANGE;
  }
}
