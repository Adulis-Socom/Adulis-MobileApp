import { ApiError } from '../api/client';

/**
 * The Seller Companion's response boundary (WO-020). The contract publishes no response schema for
 * GET /v1/seller/list, /v1/seller/analytics/overview or /v1/seller/orders[/{id}] (contract gap,
 * WO-020 capability matrix), so each body is checked here against the shape the running API
 * returned on 12 November 2026 (WO-020 probe). A body that is not that shape is refused (shown as
 * a failure, never guessed at); a row that is not is dropped. Fields the screens do not use are
 * not read: no payment submission, no allowed action, no history is taken from an Order.
 */

export const SELLER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const unexpected = () => new ApiError({ kind: 'unexpected', status: 200 });

export type SellerRow = {
  id: string;
  handle: string;
  storeName: string;
  /** The server's status, as sent (DRAFT, ACTIVE, CLOSING, ..._SUSPENDED); presentation maps it. */
  status: string;
  /** The Account's relationship role, as sent (OWNER, ADMIN, ...). */
  role: string;
};

/**
 * GET /v1/seller/list -> `{ data: [{ id, handle, store_name, status, role, created_at }] }`. The server
 * already leaves DELETED stores out (D-243); one that arrives anyway is dropped here too, as is a
 * repeated id. An empty list is a valid answer (no relationship), never an error.
 */
export function parseSellerList(body: unknown): SellerRow[] {
  if (!isRecord(body) || !Array.isArray(body.data)) throw unexpected();
  const seen = new Set<string>();
  const rows: SellerRow[] = [];
  for (const r of body.data) {
    if (!isRecord(r)) continue;
    const { id, handle, store_name: storeName, status, role } = r;
    if (typeof id !== 'string' || !SELLER_ID.test(id) || seen.has(id)) continue;
    if (typeof handle !== 'string' || typeof storeName !== 'string' || storeName === '') continue;
    if (typeof status !== 'string' || status === 'DELETED' || typeof role !== 'string') continue;
    seen.add(id);
    rows.push({ id, handle, storeName, status, role });
  }
  return rows;
}

/** A store that is not plainly open: its status is shown as it is, never as "open". */
export const isRestricted = (status: string) => status !== 'ACTIVE';

export type Overview = {
  /** Current total (does not follow the window; verified by probe). */
  productsPublished: number | null;
  /** Counted within `window` (verified by probe). */
  orders: number | null;
  /** The next three: the API does not say whether they follow the window (contract gap). */
  activeReservations: number | null;
  completedHandoffs: number | null;
  followers: number | null;
  window: { from: string; to: string } | null;
};

const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);
const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/**
 * GET /v1/seller/analytics/overview -> `{ products_published, orders, active_reservations,
 * completed_handoffs, followers, window: { from, to } }`, resolved numbers only (ADU-API-01 S12.13).
 * A missing or malformed count is null and is not shown; nothing is computed on the device.
 */
export function parseOverview(body: unknown): Overview {
  if (!isRecord(body)) throw unexpected();
  const w = isRecord(body.window) ? { from: day(body.window.from), to: day(body.window.to) } : null;
  const overview: Overview = {
    productsPublished: count(body.products_published),
    orders: count(body.orders),
    activeReservations: count(body.active_reservations),
    completedHandoffs: count(body.completed_handoffs),
    followers: count(body.followers),
    window: w && w.from && w.to ? { from: w.from, to: w.to } : null,
  };
  // Nothing the screen could show: not an overview.
  if (Object.values(overview).every((v) => v === null)) throw unexpected();
  return overview;
}

export const BUCKETS = ['needs_action', 'active', 'completed', 'cancelled'] as const;
export type Bucket = (typeof BUCKETS)[number];

export type Money = { amountMinor: number; currency: string };
export type OrderRow = {
  id: string;
  /** The server's state, as sent; never inferred from timestamps. */
  state: string;
  createdAt: string;
  expiresAt: string | null;
  readyAt: string | null;
  total: Money | null;
  lineCount: number | null;
};
export type OrderPage = { data: OrderRow[]; next_cursor: string | null };

function money(v: unknown): Money | null {
  if (!isRecord(v)) return null;
  const { amount_minor: amountMinor, currency } = v;
  return typeof amountMinor === 'number' && Number.isInteger(amountMinor) && typeof currency === 'string' && /^[A-Z]{3}$/.test(currency)
    ? { amountMinor, currency }
    : null;
}
const optionalIso = (v: unknown) => (isIso(v) ? v : null);

function orderBase(r: unknown) {
  if (!isRecord(r)) return null;
  const { id, state, created_at: createdAt } = r;
  if (typeof id !== 'string' || !SELLER_ID.test(id) || typeof state !== 'string' || state === '' || !isIso(createdAt)) return null;
  return { r, id, state, createdAt, expiresAt: optionalIso(r.expires_at), readyAt: optionalIso(r.ready_at), total: money(r.total) };
}

/**
 * GET /v1/seller/orders -> `{ data: [...], has_more, next_cursor }`; next_cursor is opaque (sent back
 * as is). `line_count` arrives as a string of digits.
 */
export function parseOrderPage(body: unknown): OrderPage {
  if (!isRecord(body) || !Array.isArray(body.data) || !(body.next_cursor === null || typeof body.next_cursor === 'string')) {
    throw unexpected();
  }
  const data: OrderRow[] = [];
  for (const raw of body.data) {
    const o = orderBase(raw);
    if (!o) continue;
    const lc = o.r.line_count;
    const lineCount = typeof lc === 'string' && /^\d+$/.test(lc) ? Number(lc) : typeof lc === 'number' && Number.isInteger(lc) ? lc : null;
    data.push({ id: o.id, state: o.state, createdAt: o.createdAt, expiresAt: o.expiresAt, readyAt: o.readyAt, total: o.total, lineCount });
  }
  return { data, next_cursor: body.next_cursor };
}

/**
 * GET /v1/seller/orders/{id}: the same fields, and `lines` (counted, not rendered: the line shape was
 * not observable in the review data). allowed_actions, payment_submissions and history are not read.
 */
export function parseOrder(body: unknown): OrderRow {
  const o = orderBase(body);
  if (!o) throw unexpected();
  return {
    id: o.id,
    state: o.state,
    createdAt: o.createdAt,
    expiresAt: o.expiresAt,
    readyAt: o.readyAt,
    total: o.total,
    lineCount: Array.isArray(o.r.lines) ? o.r.lines.length : null,
  };
}
