import type { SimAction, SimBucket, SimMode, SimRole } from './model';

/**
 * Copy for the Order simulation. It lives HERE and not in the shared console catalogue on purpose: that catalogue ships in every
 * release build and its hygiene test bans the words an Order screen needs. This module is reachable only from a fixture build, the
 * release scan proves it is absent from a release build, and it is English only (a development demonstration is not translated).
 * Whole sentences, ASCII, no payment, refund, revenue or delivery-progress wording.
 */
export const SIM_MARKER = 'ADULIS_ORDER_SIMULATION_MARKER_2c91';

export const COPY = {
  title: 'Order experience demonstration',
  notice: 'Everything on this page is synthetic. No Order, stock, money or delivery exists, and nothing here can reach a real Seller.',
  scope: 'It shows only how an Order would be looked at and prepared. Payment, handover and delivery are not part of this demonstration.',
  controls: 'Demonstration controls',
  role: 'View as',
  screenState: 'Screen state',
  reset: 'Start the demonstration again',
  listLabel: 'Synthetic Orders',
  open: 'Open',
  detail: 'Order detail',
  pick: 'Choose an Order to see it here.',
  reference: 'Reference',
  buyer: 'Buyer',
  created: 'Created',
  method: 'How the Buyer receives it',
  status: 'Status',
  lines: 'Items',
  quantity: 'Quantity',
  empty: 'There are no Orders in this part of the list.',
  loadingLabel: 'Loading Orders',
  errorTitle: 'We could not load the Orders',
  errorBody: 'Nothing was changed. This is a demonstration of a failed request, not an empty list.',
  retry: 'Try again',
  noAccessTitle: 'This role cannot see Orders',
  noAccessBody: 'Orders are shown only to roles that hold the Order permission. This is what a role without it would find.',
  readOnly: 'This role can look at Orders but cannot prepare them.',
  staleTitle: 'This Order has changed',
  stale: 'This Order was changed somewhere else, so your action was not applied. Reload to see its current state.',
  reload: 'Reload this Order',
  changeElsewhere: 'Simulate a change made elsewhere',
  actionDone: 'Done in the simulation. No stock, payment or delivery was affected.',
  noMoreSteps: 'The demonstration ends here. There is no further step to take.',
} as const;

export const BUCKET_LABEL: Record<SimBucket, string> = { NEEDS_ACTION: 'Needs action', PREPARING: 'Preparing', READY: 'Ready' };
export const MODE_LABEL: Record<SimMode, string> = { BUYER_COLLECTION: 'Buyer Collection', SELLER_DELIVERY: 'Seller Delivery', COURIER_DELIVERY: 'Courier Delivery' };
export const ROLE_LABEL: Record<SimRole, string> = { OWNER: 'Owner', ADMIN: 'Admin', SALES_SUPPORT: 'Sales Support', INVENTORY: 'Inventory', ANALYST: 'Analyst' };
export const ACTION_LABEL: Record<SimAction, string> = { START_PREPARING: 'Start preparing', MARK_READY: 'Mark ready' };
export const STATE_LABEL = { normal: 'Normal', loading: 'Loading', empty: 'Empty', error: 'Request failed' } as const;
