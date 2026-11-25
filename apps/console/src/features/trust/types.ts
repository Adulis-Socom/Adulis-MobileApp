/**
 * features/trust/types.ts -- LOCAL transcriptions of the analytics and
 * reviews service shapes (the D-98 class; deleted when the contract
 * carries schemas).
 */

/** The resolved window, echoed once per response (v1.10 S12.13). */
export interface AnalyticsWindow {
  readonly from: string;
  readonly to: string;
}

/**
 * GET /v1/seller/analytics/overview -- every tier. Takes an inclusive
 * [from, to] date window (default: the trailing 30 days). v1.10: the window
 * is a property of the RESPONSE (`window: {from, to}`), and the fields carry
 * no suffix -- a field named `orders_30d` returning ninety days is a name
 * that lies (D-232).
 */
export interface AnalyticsOverview {
  readonly products_published: number;
  readonly followers: number;
  readonly window: AnalyticsWindow;
}

/** GET /v1/seller/analytics/full -- entitlement-gated (409 TIER_LIMIT). */
export interface AnalyticsFull {
  readonly storefront_views: number;
  readonly product_views: number;
  readonly window: AnalyticsWindow;
  readonly scope: string | null;
}

/** GET /v1/seller/reviews rows. */
export interface ReviewRow {
  readonly id: string;
  readonly order_id: string;
  readonly seller_rating: number;
  readonly body: string | null;
  readonly badge: string | null;
  readonly published_at: string;
  readonly anonymised: boolean;
  readonly item_ratings: readonly { product_id: string; rating: number }[];
}
export interface ReviewPage {
  readonly data: readonly ReviewRow[];
  readonly next_cursor: string | null;
}
