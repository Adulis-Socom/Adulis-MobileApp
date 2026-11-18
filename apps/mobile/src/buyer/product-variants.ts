import type { StorefrontProduct } from '../api/client';

/**
 * Which option of a Product the Buyer has chosen, as a two-state machine over the server's
 * current projection of that Product. Nothing here knows a price, a
 * stock count or a delivery promise: every fact it reads is one the server sent in the
 * answer on screen.
 *
 *   NONE      no option is chosen (the opening, after a drop)
 *   SELECTED  `id` names an option of the CURRENT answer that is available now
 *
 *   any      --SELECT(id)-->  SELECTED(id)   only if the answer lists `id` and it is available
 *   any      --SELECT(id)-->  unchanged      otherwise (an unavailable or unknown option is refused)
 *   SELECTED --PROJECT-->     SELECTED       the answer still lists it and it is still available
 *   SELECTED --PROJECT-->     NONE           it is gone, unavailable, or the Product is unavailable
 *   NONE     --PROJECT-->     NONE
 *
 * PROJECT happens whenever a new answer is on screen, so a selection never outlives the
 * server's say-so, and one that was dropped is not revived by a later answer that lists the
 * option as available again: the Buyer chooses again. A read that is withheld or fails removes
 * the content (and this state with it): there is no selection without a current answer.
 */
export type Variant = StorefrontProduct['variants'][number];

export type VariantState = { kind: 'NONE' } | { kind: 'SELECTED'; id: string };
export type VariantEvent = { type: 'SELECT'; id: string } | { type: 'PROJECT' };

export const NO_VARIANT: VariantState = { kind: 'NONE' };

/**
 * Whether the Buyer may choose this option now: the server says the option can be bought AND
 * the Product itself is available. The option flag alone is not trusted to override the
 * Product's (the contract says it is never true while the Product is not; a client that
 * believed a contradiction would offer what the server will not sell).
 */
export const isSelectable = (product: Pick<StorefrontProduct, 'available'>, variant: Pick<Variant, 'available'>): boolean =>
  product.available && variant.available;

/** The chosen option of this answer, or null: never an option the answer does not offer now. */
export function chosenVariant(state: VariantState, product: StorefrontProduct): Variant | null {
  if (state.kind !== 'SELECTED') return null;
  const variant = product.variants.find((v) => v.id === state.id);
  return variant && isSelectable(product, variant) ? variant : null;
}

/** The next state; the same object when nothing changes, so a caller can tell. */
export function transition(state: VariantState, event: VariantEvent, product: StorefrontProduct): VariantState {
  if (event.type === 'PROJECT') return state.kind === 'SELECTED' && chosenVariant(state, product) === null ? NO_VARIANT : state;
  const next: VariantState = { kind: 'SELECTED', id: event.id };
  if (chosenVariant(next, product) === null) return state;
  return state.kind === 'SELECTED' && state.id === event.id ? state : next;
}
