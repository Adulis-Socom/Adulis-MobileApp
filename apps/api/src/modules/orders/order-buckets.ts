/**
 * D-154 -- THE BUCKET MEMBERSHIP LIVES HERE AND NOWHERE ELSE. "Needs action"
 * is a SET of states and the set is a product decision the server owns; a
 * client filtering states would be that decision wearing a filter's clothes.
 * The memberships, from ADU-CON-03 SC-03 and SC-01's daily brief:
 *  - needs_action: the seller owes a move -- a payment decision
 *    (PAYMENT_SUBMITTED) or a handoff (PAYMENT_CONFIRMED).
 *  - active: every non-terminal state.
 *  - completed: COMPLETED.
 *  - cancelled: the contract's own plainest case -- CANCELLED_BY_BUYER,
 *    CANCELLED_BY_SELLER and EXPIRED_UNCLAIMED. Three states, one tab.
 * Buckets deliberately OVERLAP (needs_action is a subset of active); they
 * are tabs, not a partition.
 *
 * Its own module so both the controller (validate the name) and the service
 * (resolve to states) read it without importing each other -- the
 * no-circular rule.
 */
export const ORDER_BUCKETS = {
  needs_action: ['PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED'],
  active: ['CREATED', 'NOTIFIED', 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED', 'HANDED_OFF'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED_BY_BUYER', 'CANCELLED_BY_SELLER', 'EXPIRED_UNCLAIMED'],
} as const;
export type OrderBucket = keyof typeof ORDER_BUCKETS;
