/**
 * api/fixtures/data.ts -- the versioned, typed fixture data (SC-FE-01).
 *
 * DEVELOPMENT ONLY, AND ABSENT FROM RELEASE BUILDS. This module is reached only
 * through the dynamic import in api/client.ts, which sits behind
 * `import.meta.env.DEV`; a production build removes both (the fixture project's
 * `no-fixture-in-build` test builds with the flag set and scans the output).
 *
 * Every id carries the `fx_` prefix so a fixture row is recognisable by id. (A live-transport
 * refusal of `fx_` seller ids is a proposed later test, N7 in 06_SAFE_FIXTURE_AND_COMMERCE_BOUNDARY.)
 *
 * The rows are labelled by the page's "Demonstration data" banner, and the transport serves no
 * payment, billing, payout, evidence, handoff, moderation or report path. The Order rows this
 * file carried went with the Reservation retirement (2026-11-25); the per-Seller rows are
 * Products now.
 */

/**
 * The row shape the Products screen reads, declared here rather than imported from
 * features/catalogue/types so the fixture module imports nothing from a feature. Conformance to
 * the screen's own ProductRow is checked at compile time by e2e-fixture/types.check.ts (part of
 * `pnpm typecheck`).
 */
export interface FixtureProductRow {
  readonly id: string;
  readonly name: string;
  readonly visibility: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  readonly base_price: { readonly amount_minor: number; readonly currency: string };
  readonly display_order: number;
  readonly image_key: string | null;
}

/** Bump when the shape served changes; the e2e fixture project asserts it. */
export const FIXTURE_VERSION = '2026-11-25.1';

/** A string no release bundle may contain. Scanned by e2e-fixture/no-fixture-in-build. */
export const FIXTURE_MARKER = 'ADULIS_FIXTURE_TRANSPORT_V1';

export interface FixtureSeller {
  readonly id: string;
  readonly handle: string;
  readonly store_name: string;
  readonly status: string;
  readonly role: string;
}

export const FIXTURE_SELLERS: readonly FixtureSeller[] = [
  { id: 'fx_seller_a', handle: 'fx-alpha', store_name: 'Fixture Alpha Store', status: 'ACTIVE', role: 'OWNER' },
  { id: 'fx_seller_b', handle: 'fx-beta', store_name: 'Fixture Beta Store', status: 'ACTIVE', role: 'OWNER' },
];

function product(id: string, name: string, amountMinor: number, position: number): FixtureProductRow {
  return {
    id,
    name,
    visibility: 'PUBLISHED',
    base_price: { amount_minor: amountMinor, currency: 'ETB' },
    display_order: position,
    image_key: null,
  };
}

/** Disjoint by construction, so a cross-Seller leak is visible by id. */
export function fixtureProducts(sellerId: string): readonly FixtureProductRow[] | null {
  if (sellerId === 'fx_seller_a') return [
      product('fx_product_a1', 'Fixture Alpha Scarf', 12000, 0),
      product('fx_product_a2', 'Fixture Alpha Basket', 34000, 1),
    ];
  if (sellerId === 'fx_seller_b') return [product('fx_product_b1', 'Fixture Beta Jebena', 56000, 0)];
  return null;
}

/** Readiness: the server's own codes (fn_publication_readiness after migration 0063). */
export const FIXTURE_READINESS = {
  items: [
    { code: 'STORE_PROFILE', kind: 'READINESS_ITEM', satisfied: true },
    { code: 'AT_LEAST_ONE_PRODUCT', kind: 'READINESS_ITEM', satisfied: false, resolving_action: { kind: 'ADD_A_PRODUCT' } },
  ],
} as const;

/** GET /v1/seller/obligations always answers an empty list since the Reservation retirement. */
export const FIXTURE_OBLIGATIONS = { data: [] } as const;

/** Subscription: an ACTIVE plan; the GET carries `subscription` only. */
export function fixtureSubscription(): Record<string, unknown> {
  const later = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    subscription: {
      state: 'ACTIVE',
      tier: 'ASSISTED',
      term: 'MONTHLY',
      trial_ends_at: null,
      current_period_start: '2026-11-01T00:00:00.000Z',
      current_period_end: later,
      locked_rate_minor: null,
      locked_rate_currency: null,
    },
  };
}
