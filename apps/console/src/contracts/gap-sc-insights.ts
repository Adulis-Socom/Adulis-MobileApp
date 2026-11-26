import type { Metric } from './gap-sc-metrics';

/**
 * PROVISIONAL fixture contract GAP-SC-19: nonfinancial Insights and Subscription status (SC-FE-10). NOT the API contract.
 * Sources: ANL-01 v3.3 S28-S39, S50-S56 with its 24 November amendment (count verified discovery, catalogue and messaging actions only; no
 * purchase, GMV, paid conversion, Story reaction or settlement figure); CONSOLE-02 v4.3 S19, S22, S83-S89, S130; AUTH-02 v3.3 Appendix B and C
 * (seller.analytics:* codes); RB25-D11 and the master work order "Subscription B: plans/status/entitlements retained, purchase disabled".
 *
 * Every figure is a server projection with its definition version, window, Market timezone and freshness; the Console computes none. A
 * section the account may not see is absent from the answer, not empty. Metric codes and windows are demonstration values: ANL S81 leaves
 * windows and populations open.
 *
 * Subscription: no plan, price, trial, renewal rule or status vocabulary is defined anywhere (D3 gap), so the contract carries only what is
 * known: whether a plan is assigned (none is) and, per destination, whether it is included for this Seller, which the server already
 * decides. There is no purchase, upgrade, transfer or billing operation, and none is needed.
 */
export type InsightSection = 'DISCOVERY' | 'PRODUCTS' | 'STOREFRONT' | 'MESSAGING' | 'NOT_MEASURED';

export interface InsightMetric {
  readonly code: string;
  readonly definition_version: number;
  readonly metric: Metric;
}

export interface InsightsView {
  readonly seller_id: string;
  readonly window: { readonly days: number; readonly from: string; readonly to: string };
  readonly timezone: string;
  /** When the projection was last brought up to date (ANL-INV-025). */
  readonly as_of: string;
  /** ANALYTICS_PROJECTION_STALE: the figures are older than the projection's own target; shown, and said so. */
  readonly stale: boolean;
  readonly sections: readonly { readonly code: InsightSection; readonly metrics: readonly InsightMetric[] }[];
}

/** Option B: no plan is defined yet. ASSIGNED exists for the seam (CONSOLE S130) and is never served by this fixture. */
export type PlanState = 'NONE_DEFINED' | 'ASSIGNED';
export interface SubscriptionView {
  readonly seller_id: string;
  readonly plan_state: PlanState;
  readonly plan_label: string | null;
  /** Per destination key (a DestinationKey; typed as text to keep the contracts acyclic): included for this Seller or not, the same fact as NO_ENTITLEMENT. */
  readonly features: readonly { readonly key: string; readonly included: boolean }[];
}

export interface InsightsOperations {
  readonly 'insights.get': { in: Record<string, never>; out: InsightsView };
  readonly 'subscription.get': { in: Record<string, never>; out: SubscriptionView };
}
