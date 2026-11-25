import { ApiError } from '../api/client';

/**
 * The Seller Companion's response boundary (WO-020). The contract publishes no response schema for
 * GET /v1/seller/list or /v1/seller/analytics/overview (contract gap, WO-020 capability matrix),
 * so each body is checked here against the shape the running API returned on 12 November 2026
 * (WO-020 probe). A body that is not that shape is refused (shown as a failure, never guessed at);
 * a row that is not is dropped. Fields the screens do not use are not read.
 */

export const SELLER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  /** The API does not say whether it follows the window (contract gap). */
  followers: number | null;
};

const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);

/**
 * GET /v1/seller/analytics/overview -> `{ products_published, followers, window }`, resolved numbers
 * only (ADU-API-01 S12.13). The window is not read: no count shown here follows it. A missing or
 * malformed count is null and is not shown; nothing is computed on the device.
 */
export function parseOverview(body: unknown): Overview {
  if (!isRecord(body)) throw unexpected();
  const overview: Overview = {
    productsPublished: count(body.products_published),
    followers: count(body.followers),
  };
  // Nothing the screen could show: not an overview.
  if (Object.values(overview).every((v) => v === null)) throw unexpected();
  return overview;
}
