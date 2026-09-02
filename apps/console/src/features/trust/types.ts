/**
 * features/trust/types.ts -- LOCAL transcriptions of the analytics, reviews
 * and claims service shapes (the D-98 class; deleted when the contract
 * carries schemas).
 */

/**
 * GET /v1/seller/analytics/overview -- every tier. T15 Phase 4: takes an
 * inclusive [from, to] date window (default: the trailing 30 days) and echoes
 * the resolved window. The `_30d` field names are the wire's stable ids; the
 * counts cover whatever window was asked (window_from/window_to say which).
 */
export interface AnalyticsOverview {
  readonly products_published: number;
  readonly orders_30d: number;
  readonly active_reservations: number;
  readonly completed_handoffs: number;
  readonly followers: number;
  readonly window_from: string;
  readonly window_to: string;
}

/** GET /v1/seller/analytics/full -- entitlement-gated (409 TIER_LIMIT). */
export interface AnalyticsFull {
  readonly storefront_views_30d: number;
  readonly product_views_30d: number;
  readonly reservations_30d: number;
  readonly completed_30d: number;
  readonly window_from: string;
  readonly window_to: string;
  // numeric columns with no pg type parser: STRINGS on the wire (D-225's
  // bigint lesson); coerce with Number() at any render site.
  readonly confirmation_rate: number | string | null;
  readonly cancellation_rate: number | string | null;
  readonly scan_completion_rate: number | string | null;
  readonly unresolved_claim_count: number;
  readonly scope: string | null;
  readonly view_to_reservation_rate: number | null;
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

/** GET /v1/seller/claims rows; detail adds severity/evidence/viewer. */
export interface ClaimRow {
  readonly id: string;
  readonly order_id: string;
  readonly reservation_id: string | null;
  readonly trigger: string;
  readonly state:
    | 'AWAITING_SELLER_EVIDENCE'
    | 'AWAITING_BUYER_EVIDENCE'
    | 'AWAITING_BANK_TRACE'
    | 'UNDER_REVIEW'
    | 'RESOLVED';
  readonly remedy: string | null;
  readonly outcome: string | null;
  readonly opened_at: string;
  // NOT NULL at the schema; typed so, the defensive render guards stay cheap.
  readonly review_deadline: string;
}
export interface ClaimPage {
  readonly data: readonly ClaimRow[];
  readonly next_cursor: string | null;
}
export interface ClaimDetailRow extends ClaimRow {
  readonly severity: string | null;
  readonly outcome_reason: string | null;
  readonly decided_at: string | null;
  readonly viewer: 'BUYER' | 'SELLER';
  readonly evidence: readonly { kind: string; reference_id: string | null; attached_at: string }[];
}
