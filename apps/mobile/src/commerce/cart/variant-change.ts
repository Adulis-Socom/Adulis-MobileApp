import type { StorefrontProduct } from '../../api/client';
import { toEditInput, type EditState } from './edit';
import { toAddIntent, type AddIntentInput, type AddState } from './intent';
import { findLine, type CartSet, type LineId } from './model';
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
 * Whether the line the add was ACCEPTED with now holds the new option. This is the only evidence that lets a
 * change go on to remove the old line: a line for the same option that was already in the cart says nothing
 * about this add, so "some line has the option" is never enough.
 */
export const addedLineHoldsOption = (
  carts: CartSet,
  plan: VariantChangePlan,
  addedLineId: LineId,
): boolean =>
  addedLineId !== plan.oldLineId && findLine(carts, addedLineId)?.variantId === plan.add.variantId;

/**
 * Where one change stands.
 *
 *   ADDING    the new option is being added; nothing else can happen yet
 *   STALLED   the add is unknown: the old line is NOT removed, and nothing continues on its own
 *   ADDED     the add was accepted, with this line id; a read made after it must show THAT line
 *             holding the new option before anything else happens
 *   REMOVING  that read showed it: the old line is being removed (`begun`: its removal has started)
 *   PARTIAL   the removal did not complete or was given up on: both lines remain, and the Buyer decides
 *   DONE      the old line is gone
 *   ABORTED   the add did not happen, or the read after it does not show the added line: nothing was removed
 *
 * The old line is removed by nothing here: REMOVING only says that, and only after an accepted add whose own
 * line a later read shows. Every state can be left: a change that waits on the Buyer by Dismiss, ADDED and
 * REMOVING by Dismiss into PARTIAL (nothing is removed unconfirmed and nothing is stranded), ADDING by the
 * add machine settling.
 */
export type ChangeState =
  | Readonly<{ kind: 'IDLE' }>
  | Readonly<{ kind: 'ADDING'; plan: VariantChangePlan }>
  | Readonly<{ kind: 'STALLED'; plan: VariantChangePlan }>
  | Readonly<{ kind: 'ADDED'; plan: VariantChangePlan; lineId: LineId }>
  | Readonly<{ kind: 'REMOVING'; plan: VariantChangePlan; begun: boolean }>
  | Readonly<{ kind: 'PARTIAL'; plan: VariantChangePlan }>
  | Readonly<{ kind: 'DONE'; plan: VariantChangePlan }>
  | Readonly<{ kind: 'ABORTED'; plan: VariantChangePlan }>;

export const IDLE_CHANGE: ChangeState = { kind: 'IDLE' };

export type ChangeEvent =
  | Readonly<{ type: 'BEGIN'; plan: VariantChangePlan }>
  /** The add leg's state, as the add machine reports it (an accepted add carries its line id). */
  | Readonly<{ type: 'ADD'; add: AddState }>
  /** A read made AFTER the add was accepted: whether the added line holds the new option (`addedLineHoldsOption`). */
  | Readonly<{ type: 'READ_AFTER_ADD'; holdsAdded: boolean }>
  /** The removal of the old line has been started as an edit. */
  | Readonly<{ type: 'REMOVE_BEGUN' }>
  /** The remove leg's state, as the edit machine reports it. */
  | Readonly<{ type: 'REMOVE'; edit: EditState['kind'] }>
  | Readonly<{ type: 'DISMISS' }>;

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
      const { add } = event;
      if (
        add.kind === 'REFUSED' ||
        add.kind === 'REFUSED_RELOAD' ||
        add.kind === 'OFFLINE_NOT_SENT'
      ) {
        return { kind: 'ABORTED', plan };
      }
      if (add.kind === 'UNKNOWN' || add.kind === 'UNRESOLVED') {
        return state.kind === 'STALLED' ? state : { kind: 'STALLED', plan };
      }
      // Only an accepted add moves on, from ADDING and from a stall the Buyer cleared by trying again.
      return add.kind === 'ADDED' ? { kind: 'ADDED', plan, lineId: add.lineId } : state;
    }
    case 'READ_AFTER_ADD':
      if (state.kind !== 'ADDED') return state;
      return event.holdsAdded
        ? { kind: 'REMOVING', plan: state.plan, begun: false }
        : { kind: 'ABORTED', plan: state.plan };
    case 'REMOVE_BEGUN':
      return state.kind === 'REMOVING' && !state.begun ? { ...state, begun: true } : state;
    case 'REMOVE': {
      if (state.kind !== 'REMOVING' && state.kind !== 'PARTIAL') return state;
      const { plan } = state;
      if (event.edit === 'CONFIRMED' || event.edit === 'LINE_GONE') return { kind: 'DONE', plan };
      if (state.kind !== 'REMOVING') return state;
      // The removal did not happen or ended without proof: nothing was removed unconfirmed, both lines stay.
      // IDLE counts only once the removal has begun (before that it is simply the edit not started yet).
      const ended =
        event.edit === 'REFUSED' ||
        event.edit === 'UNKNOWN' ||
        event.edit === 'UNRESOLVED' ||
        event.edit === 'OFFLINE_NOT_SENT' ||
        (event.edit === 'IDLE' && state.begun);
      return ended ? { kind: 'PARTIAL', plan } : state;
    }
    case 'DISMISS':
      if (state.kind === 'ADDING') return state;
      if (state.kind === 'ADDED' || state.kind === 'REMOVING')
        return { kind: 'PARTIAL', plan: state.plan };
      return IDLE_CHANGE;
  }
}
