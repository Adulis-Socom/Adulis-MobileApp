/**
 * features/trade/StateBadge.tsx -- the resolved order state, as a person
 * reads it.
 *
 * `ready_at` IS A TIMESTAMP, NOT A STATE (ADU-DB-01 S12.6a, ADU-CON-03 S7).
 * That rule lives here because this is the component that would break it:
 * a badge reading "Ready" for an order whose state is PAYMENT_CONFIRMED
 * invents a tenth lifecycle stage, and every screen downstream then has to
 * decide what it means. Marked-ready renders as a FACT elsewhere on SC-04
 * ("Marked ready at 14:20"); it never appears here.
 *
 * An unknown state renders AS ITS CODE rather than as nothing or as a guess.
 * A new order state shipped by the server is a thing the seller must be able
 * to see, even ugly, and Home already sets this precedent for readiness rows.
 */
import { en } from '@adulis/locale';
import type { OrderState } from '../../lib/clock';

/**
 * Exported because SC-04's history region names the same states in plain
 * language, and the alternative it originally used -- building the message
 * key from the state string and casting the result -- defeats the key union
 * that makes a missing Amharic string a compile error. A state added to the
 * enum must break this object, in one place.
 */
export const ORDER_STATE_LABEL: Readonly<Record<OrderState, string>> = {
  CREATED: en['console.trade.state.created'],
  NOTIFIED: en['console.trade.state.notified'],
  PAYMENT_SUBMITTED: en['console.trade.state.payment_submitted'],
  PAYMENT_CONFIRMED: en['console.trade.state.payment_confirmed'],
  HANDED_OFF: en['console.trade.state.handed_off'],
  COMPLETED: en['console.trade.state.completed'],
  CANCELLED_BY_BUYER: en['console.trade.state.cancelled_by_buyer'],
  CANCELLED_BY_SELLER: en['console.trade.state.cancelled_by_seller'],
  EXPIRED_UNCLAIMED: en['console.trade.state.expired_unclaimed'],
};

export function StateBadge({ state }: { readonly state: OrderState }) {
  return (
    <span className="state-badge" data-badge={state}>
      {ORDER_STATE_LABEL[state] ?? state}
    </span>
  );
}
