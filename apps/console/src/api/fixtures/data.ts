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
  readonly state: 'CREATED' | 'PAYMENT_SUBMITTED';
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

function order(
  id: string,
  lines: number,
  amountMinor: number,
  state: FixtureOrderRow['state'] = 'CREATED',
): FixtureOrderRow {
  return {
    id,
    state,
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
  if (sellerId === 'fx_seller_a') return [
      order('fx_order_a1', 1, 12000),
      order('fx_order_a2', 2, 34000),
      // Legacy payment state, drawn on purpose: the Console must show no payment action for it.
      order('fx_order_a3', 1, 56000, 'PAYMENT_SUBMITTED'),
    ];
  if (sellerId === 'fx_seller_b') return [order('fx_order_b1', 3, 56000)];
  return null;
}

/**
 * Order detail (SC-SAFE-01). `fx_order_a3` carries an OPEN payment submission and the full set of
 * handoff permission codes on purpose: the containment tests assert the Console still offers no
 * payment decision, evidence, reissue, Mark Ready, courier assignment, custody transfer or QR.
 */
export function fixtureOrderDetail(sellerId: string, orderId: string): Record<string, unknown> | null {
  const row = fixtureOrders(sellerId)?.find((o) => o.id === orderId);
  if (!row) return null;
  const submitted = row.state === 'PAYMENT_SUBMITTED';
  const later = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    ...row,
    lines: [
      {
        id: `${row.id}_l1`,
        variant_id: 'fx_variant_1',
        quantity: 1,
        state: 'ACTIVE',
        unit_price_minor: row.total.amount_minor,
        unit_price_currency: row.total.currency,
        variant_key: 'default',
        product_name: 'Fixture product',
      },
    ],
    payment_submissions: submitted
      ? [{ id: 'fx_sub_1', submitted_at: row.created_at, state: 'SUBMITTED', decided_at: null, rejection_reason: null, sla_deadline: later }]
      : [],
    history: [{ from_state: 'CREATED', to_state: row.state, reason: null, occurred_at: row.created_at }],
    allowed_actions: [
      'seller.order_ready:update',
      'seller.handoff:read',
      'seller.handoff:custody_transfer',
      'seller.couriers:manage',
    ],
  };
}

/** Readiness (SC-SAFE-01): the server still lists payout details; the Console must not ask for them. */
export const FIXTURE_READINESS = {
  items: [
    { code: 'STORE_PROFILE', kind: 'READINESS_ITEM', satisfied: true },
    { code: 'PAYOUT_DETAILS', kind: 'READINESS_ITEM', satisfied: false, resolving_action: { kind: 'ADD_PAYOUT_DETAILS' } },
    { code: 'AT_LEAST_ONE_PRODUCT', kind: 'READINESS_ITEM', satisfied: false, resolving_action: { kind: 'ADD_A_PRODUCT' } },
  ],
} as const;

/** Obligations of deferred workflows (SC-SAFE-01): the Console must not show them. */
export function fixtureObligations(): Record<string, unknown> {
  const deadline = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  return {
    data: [
      { kind: 'PAYMENT_AWAITING_CONFIRMATION', object_kind: 'ORDER', object_id: 'fx_order_a3', deadline, consequence_key: 'obligation.fixture.consequence' },
      { kind: 'CLAIM_AWAITING_SELLER', object_kind: 'CLAIM', object_id: 'fx_claim_1', deadline, consequence_key: 'obligation.fixture.consequence' },
    ],
  };
}

/** Subscription (SC-SAFE-01): an ACTIVE plan and a stale OPEN purchase intent the Console must not draw. */
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
    intent: {
      intent_id: 'fx_intent_1',
      collection_record_id: 'fx_collection_1',
      tier: 'VERIFIED_PRO',
      term: 'MONTHLY',
      amount_minor: 99900,
      currency: 'ETB',
      expires_at: later,
      reference: 'FX-REFERENCE-123',
      marked_transferred_at: null,
    },
  };
}
