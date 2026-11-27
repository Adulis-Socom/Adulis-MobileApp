import type { DestinationKey } from '../contracts/gap-sc';
import type { InsightMetric, InsightSection, InsightsView, SubscriptionView } from '../contracts/gap-sc-insights';
import type { Metric } from '../contracts/gap-sc-metrics';
import { DAY_MS, denied, need, type Handlers, type Kit } from './kit';

/**
 * Fixture nonfinancial Insights and Subscription status (GAP-SC-19, SC-FE-10). DEVELOPMENT ONLY. Every figure is a fixed demonstration value
 * standing for a server projection; nothing is counted here and nothing is derived from Orders, which do not exist (D24-01). Alem shows every
 * metric state side by side: a real zero, a withheld small count, an unknown and an unavailable figure, and unsupported ones. Iman shows a stale
 * projection. A Seller that was never published has nothing to count, so its figures are real zeros.
 *
 * Role scope follows AUTH-02 Appendix C, as fixture capabilities: analytics.content_read / analytics.fyp_read (discovery), analytics.product_read
 * (Products), analytics.business_read (storefront and inquiries), analytics.chatbot_read (messaging). A section without its permission is absent.
 */
type InsightOps = 'insights.get' | 'subscription.get';
export interface Insights {
  readonly handlers: Handlers<InsightOps>;
}

const WINDOW_DAYS = 30; // demonstration value: ANL S81 leaves windows open
const v = (value: number): Metric => ({ state: 'VALUE', value });
const ALEM: Readonly<Record<string, Metric>> = {
  SCENE_QUALIFIED_IMPRESSIONS: v(1240),
  PRODUCT_TAG_OPENS: v(0),
  SCENE_SAVES: { state: 'WITHHELD' },
  PRODUCT_DETAIL_OPENS: v(318),
  PRODUCT_SAVES: { state: 'WITHHELD' },
  STOREFRONT_VISITS: { state: 'UNKNOWN' },
  INQUIRIES_STARTED: v(5),
  UNANSWERED_CONVERSATIONS: v(1),
  AUTOMATED_ANSWERS: { state: 'UNAVAILABLE' },
};
const SECTIONS: readonly { code: InsightSection; caps: readonly string[]; metrics: readonly string[] }[] = [
  { code: 'DISCOVERY', caps: ['analytics.content_read', 'analytics.fyp_read'], metrics: ['SCENE_QUALIFIED_IMPRESSIONS', 'PRODUCT_TAG_OPENS', 'SCENE_SAVES'] },
  { code: 'PRODUCTS', caps: ['analytics.product_read'], metrics: ['PRODUCT_DETAIL_OPENS', 'PRODUCT_SAVES'] },
  { code: 'STOREFRONT', caps: ['analytics.business_read'], metrics: ['STOREFRONT_VISITS', 'INQUIRIES_STARTED'] },
  { code: 'MESSAGING', caps: ['analytics.chatbot_read'], metrics: ['UNANSWERED_CONVERSATIONS', 'AUTOMATED_ANSWERS'] },
];
/** Measured nowhere in this release: they need real sales (ANL 24 November amendment). Always UNSUPPORTED, never zero. */
const NOT_MEASURED = ['CONVERSION_TO_SALE', 'COMPLETED_SALES'];
const ANALYTICS = SECTIONS.flatMap((s) => s.caps);

export function createInsights(kit: Kit, entitlementOff: (sellerId: string) => readonly DestinationKey[]): Insights {
  const handlers: Insights['handlers'] = {
    'insights.get': (_input, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'insights');
      if (!ANALYTICS.some((c) => a.caps.has(c))) throw denied();
      const figure = (code: string): Metric => (a.sellerId === 'fx_seller_alem' ? (ALEM[code] ?? { state: 'UNAVAILABLE' }) : v(0));
      const metric = (code: string): InsightMetric => ({ code, definition_version: 1, metric: figure(code) });
      const now = kit.now();
      const view: InsightsView = {
        seller_id: a.sellerId,
        window: { days: WINDOW_DAYS, from: kit.iso(now - WINDOW_DAYS * DAY_MS), to: kit.iso(now) },
        timezone: 'Africa/Addis_Ababa',
        as_of: kit.iso(now - (a.sellerId === 'fx_seller_iman' ? 3 * DAY_MS : 3_600_000)),
        stale: a.sellerId === 'fx_seller_iman',
        sections: [
          ...SECTIONS.filter((s) => s.caps.some((c) => a.caps.has(c))).map((s) => ({ code: s.code, metrics: s.metrics.map(metric) })),
          { code: 'NOT_MEASURED', metrics: NOT_MEASURED.map((code) => ({ code, definition_version: 1, metric: { state: 'UNSUPPORTED' } as const })) },
        ],
      };
      return view;
    },
    'subscription.get': (_input, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'settings');
      const off = entitlementOff(a.sellerId);
      const keys: DestinationKey[] = ['products', 'content', 'inbox', 'insights', 'store', 'trust'];
      // Option B: plans and status are retained as a seam, no plan is defined, and nothing can be bought (RB25-D11).
      const view: SubscriptionView = { seller_id: a.sellerId, plan_state: 'NONE_DEFINED', plan_label: null, features: keys.map((key) => ({ key, included: !off.includes(key) })) };
      return view;
    },
  };
  return { handlers };
}
