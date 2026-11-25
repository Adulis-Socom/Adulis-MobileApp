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
 * Nothing here is an Order a Seller could act on as real: the rows are labelled
 * by the page's "Demonstration data" banner, and the transport serves no
 * payment, billing, payout, evidence, handoff, moderation or report path.
 */

/**
 * The row shape the Orders screen reads. It is declared here, not imported from
 * features/trade/types: that import closes a cycle through the market provider back to
 * api/client, which dependency-cruiser forbids. Conformance to the screen's own OrderRow is
 * checked at compile time by e2e-fixture/types.check.ts (part of `pnpm typecheck`).
 */
export interface FixtureOrderRow {
  readonly id: string;
  readonly state: 'CREATED';
  readonly total: { readonly amount_minor: number; readonly currency: string };
  readonly expires_at: string | null;
  readonly ready_at: string | null;
  readonly clock_stopped_at: string | null;
  readonly created_at: string;
  readonly line_count: number;
  readonly payment_sla_deadline: string | null;
}

/** Bump when the shape served changes; the e2e fixture project asserts it. */
export const FIXTURE_VERSION = '2026-11-24.1';

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

const IN_AN_HOUR = (): string => new Date(Date.now() + 60 * 60 * 1000).toISOString();

function order(id: string, lines: number, amountMinor: number): FixtureOrderRow {
  return {
    id,
    state: 'CREATED',
    total: { amount_minor: amountMinor, currency: 'ETB' },
    expires_at: IN_AN_HOUR(),
    ready_at: null,
    clock_stopped_at: null,
    created_at: '2026-11-24T08:00:00.000Z',
    line_count: lines,
    payment_sla_deadline: null,
  };
}

/** Disjoint by construction, so a cross-Seller leak is visible by id. */
export function fixtureOrders(sellerId: string): readonly FixtureOrderRow[] | null {
  if (sellerId === 'fx_seller_a') return [order('fx_order_a1', 1, 12000), order('fx_order_a2', 2, 34000)];
  if (sellerId === 'fx_seller_b') return [order('fx_order_b1', 3, 56000)];
  return null;
}
