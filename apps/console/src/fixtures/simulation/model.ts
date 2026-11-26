/**
 * SC-FE-07 -- the internal Order EXPERIENCE simulation (Option A + C of the 24 November layer; development only).
 *
 * What this is: a synthetic, in-memory walk through how an Order would be looked at and prepared. It is NOT an Order system.
 * There is no payment, no stock hold or deduction, no Courier assignment, no Handoff, no delivery tracking and no refund, and
 * no state that implies one. The designs name those states (ORDER-01 S57-S59); the simulation deliberately has NONE of them,
 * because every fulfilment state in the design follows a payment that this release does not have (D24-01). Only the three
 * preparation buckets exist: Needs action, Preparing, Ready.
 *
 * It lives under src/fixtures/, so it is reached only through the build-time fixture door and is absent from a release build.
 * Nothing here reads or writes a Seller, Product or stock fact; nothing here is reachable from a real Seller's data.
 */

export type SimBucket = 'NEEDS_ACTION' | 'PREPARING' | 'READY';
export type SimMode = 'BUYER_COLLECTION' | 'SELLER_DELIVERY' | 'COURIER_DELIVERY';
/** Roles from AUTH-02 that the simulation can be viewed as. CAMPAIGN_MANAGER holds no Order permission at all, like ANALYST. */
export type SimRole = 'OWNER' | 'ADMIN' | 'SALES_SUPPORT' | 'INVENTORY' | 'ANALYST';
export type SimAction = 'START_PREPARING' | 'MARK_READY';

export interface SimLine {
  readonly title: string;
  readonly variant: string;
  readonly quantity: number;
}

export interface SimOrder {
  /** Reserved synthetic prefix, never a real Order reference. */
  readonly id: string;
  /** A write whose version is not the current one is refused, as the design's stale-write rule says (CONSOLE-02 S28). */
  readonly version: number;
  readonly bucket: SimBucket;
  readonly mode: SimMode;
  readonly buyerLabel: string;
  /** Minutes before the demonstration page opened. The page turns this into a Market-local time; the model keeps no clock. */
  readonly createdMinutesAgo: number;
  readonly lines: readonly SimLine[];
}

export const SIM_BUCKETS: readonly SimBucket[] = ['NEEDS_ACTION', 'PREPARING', 'READY'];

/** AUTH-02 S88-S91 as the digest records them: Sales Support reads only; Inventory, Admin and Owner prepare; Analyst has nothing. */
const CAN_READ: ReadonlySet<SimRole> = new Set(['OWNER', 'ADMIN', 'SALES_SUPPORT', 'INVENTORY']);
const CAN_PREPARE: ReadonlySet<SimRole> = new Set(['OWNER', 'ADMIN', 'INVENTORY']);

export const canRead = (role: SimRole): boolean => CAN_READ.has(role);
export const canPrepare = (role: SimRole): boolean => CAN_PREPARE.has(role);

/** The actions the "server" lists for this Order and role. The page never infers an action from a status word. */
export function allowedActions(role: SimRole, order: SimOrder): readonly SimAction[] {
  if (!canPrepare(role)) return [];
  if (order.bucket === 'NEEDS_ACTION') return ['START_PREPARING'];
  if (order.bucket === 'PREPARING') return ['MARK_READY'];
  return [];
}

export class SimConflict extends Error {
  constructor() {
    super('SIM_CONFLICT');
  }
}
export class SimRefused extends Error {
  constructor(readonly reason: 'NOT_ALLOWED' | 'NOT_FOUND') {
    super(reason);
  }
}

const NEXT: Record<SimAction, SimBucket> = { START_PREPARING: 'PREPARING', MARK_READY: 'READY' };

/** Apply one action as the simulated server would: authorization first, then the version, then the transition. */
export function apply(orders: readonly SimOrder[], role: SimRole, id: string, version: number, action: SimAction): readonly SimOrder[] {
  const order = orders.find((o) => o.id === id);
  if (!order) throw new SimRefused('NOT_FOUND');
  // The role is checked first, then the version, THEN whether the step still applies: an Order that has moved on since this screen
  // read it is a stale write (CONSOLE-02 S28), not a forbidden one, and the Seller must be told to reload.
  if (!canPrepare(role)) throw new SimRefused('NOT_ALLOWED');
  if (order.version !== version) throw new SimConflict();
  if (!allowedActions(role, order).includes(action)) throw new SimRefused('NOT_ALLOWED');
  return orders.map((o) => (o.id === id ? { ...o, version: o.version + 1, bucket: NEXT[action] } : o));
}

/** "Someone else changed this Order": moves the Order on at the server so the Seller's next write is stale. Synthetic only. */
export function changeElsewhere(orders: readonly SimOrder[], id: string): readonly SimOrder[] {
  return orders.map((o) => (o.id === id ? { ...o, version: o.version + 1, bucket: o.bucket === 'NEEDS_ACTION' ? 'PREPARING' : o.bucket } : o));
}

export function seed(): readonly SimOrder[] {
  return [
    { id: 'fx_sim_ord_001', version: 1, bucket: 'NEEDS_ACTION', mode: 'BUYER_COLLECTION', buyerLabel: 'Demonstration buyer A', createdMinutesAgo: 12, lines: [{ title: 'Linen wrap dress', variant: 'Black / S', quantity: 1 }] },
    { id: 'fx_sim_ord_002', version: 1, bucket: 'NEEDS_ACTION', mode: 'SELLER_DELIVERY', buyerLabel: 'Demonstration buyer B', createdMinutesAgo: 45, lines: [{ title: 'Canvas backpack', variant: 'Olive', quantity: 2 }, { title: 'Wool scarf', variant: 'Grey', quantity: 1 }] },
    { id: 'fx_sim_ord_003', version: 1, bucket: 'PREPARING', mode: 'COURIER_DELIVERY', buyerLabel: 'Demonstration buyer C', createdMinutesAgo: 180, lines: [{ title: 'Cotton shirt dress', variant: 'Blue / M', quantity: 1 }] },
    { id: 'fx_sim_ord_004', version: 1, bucket: 'READY', mode: 'BUYER_COLLECTION', buyerLabel: 'Demonstration buyer D', createdMinutesAgo: 1500, lines: [{ title: 'Linen wrap dress', variant: 'Red / S', quantity: 1 }] },
  ];
}

/** Every bucket this module can ever produce. A test asserts none of them is a payment, handoff, delivery or refund state. */
export const ALL_STATE_NAMES: readonly string[] = [...SIM_BUCKETS];
