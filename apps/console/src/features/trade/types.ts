/**
 * features/trade/types.ts -- the trade wire shapes, TYPED LOCALLY AND MARKED
 * AS SUCH, exactly as api/client.ts types the auth operations.
 *
 * `contracts/openapi.json` carries the eleven `/v1/seller/orders*` paths and
 * NO RESPONSE SCHEMAS for any of them -- the API's Swagger decorators declare
 * no bodies, which is register D-98's finding still standing at T10. So
 * `@adulis/api-client`'s generated `schema.d.ts` has nothing to import here,
 * and hand-authoring a duplicate DTO is the alternative the rule forbids.
 *
 * These interfaces are therefore a TRANSCRIPTION OF WHAT THE SERVER SENDS,
 * read off orders.service.ts, and they are deleted -- not reconciled -- when
 * the contract gains schemas. Anything below that the API stops sending
 * becomes `undefined` at runtime with no compile error, which is precisely
 * the cost D-98 records and why this comment is here rather than nowhere.
 */

import type { OrderState } from '../../lib/clock';

/** GET /v1/seller/orders -- one row. */
export interface OrderRow {
  readonly id: string;
  readonly state: OrderState;
  readonly total: { readonly amount_minor: number; readonly currency: string };
  readonly expires_at: string | null;
  readonly ready_at: string | null;
  readonly clock_stopped_at: string | null;
  readonly created_at: string;
  readonly line_count: number;
  /** The open submission's 24h deadline. Null unless one is open. */
  readonly payment_sla_deadline: string | null;
}

export interface OrderPage {
  readonly data: readonly OrderRow[];
  readonly has_more: boolean;
  /** CURSOR, never an offset (ADU-CON-03 S7). */
  readonly next_cursor: string | null;
}

export interface OrderLine {
  readonly id: string;
  readonly variant_id: string;
  readonly quantity: number;
  readonly state: string;
  readonly unit_price_minor: number | string;
  readonly unit_price_currency: string;
  readonly variant_key: string;
  readonly product_name: string;
}

export interface PaymentSubmission {
  readonly id: string;
  readonly submitted_at: string;
  readonly state: 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';
  readonly decided_at: string | null;
  readonly rejection_reason: string | null;
  readonly sla_deadline: string | null;
}

/** core.order_state_transition, append-only. SC-04 region 6. */
export interface Transition {
  readonly from_state: OrderState;
  readonly to_state: OrderState;
  readonly reason: string | null;
  readonly occurred_at: string;
}

/** GET /v1/seller/orders/{id}. */
export interface OrderDetail {
  readonly id: string;
  readonly state: OrderState;
  readonly total: { readonly amount_minor: number; readonly currency: string };
  readonly expires_at: string | null;
  readonly ready_at: string | null;
  readonly clock_stopped_at: string | null;
  readonly created_at: string;
  readonly lines: readonly OrderLine[];
  readonly payment_submissions: readonly PaymentSubmission[];
  readonly history: readonly Transition[];
  /** D-155: the server's answer to what this seller may do to THIS order,
   *  named by permission code. The console renders a control iff its code
   *  is present, and never unions this with a guess of its own. */
  readonly allowed_actions: readonly string[];
}

/** GET /v1/seller/couriers row (D-224.4): a claimed row carries account_id;
 *  a pending invite carries null and is not assignable. */
export interface SellerCourierRow {
  readonly id: string;
  readonly phone: string;
  readonly invited_at: string;
  readonly claimed_at: string | null;
  readonly account_id: string | null;
}

/** GET /v1/seller/orders/{id}/qr. */
export type { QrToken } from '../../lib/qr';

/**
 * The detail response carries every submission; the CLOCK cares only about an
 * open one. Kept beside the shapes rather than in either screen, because SC-03
 * gets this from the server (`payment_sla_deadline`) and SC-04 has to derive
 * the same thing from the list it was sent -- and the two must agree.
 */
export function openSubmission(d: OrderDetail): PaymentSubmission | null {
  return d.payment_submissions.find((s) => s.state === 'SUBMITTED') ?? null;
}

/**
 * States in which the order's lifecycle has ended: ScreenState's TERMINAL,
 * "history, no actions" (ADU-CON-03 S3). Named here so SC-04 does not carry
 * a list of state strings inline.
 */
const ENDED: ReadonlySet<string> = new Set<OrderState>([
  'COMPLETED',
  'CANCELLED_BY_BUYER',
  'CANCELLED_BY_SELLER',
  'EXPIRED_UNCLAIMED',
]);

export function isTerminal(state: OrderState): boolean {
  return ENDED.has(state);
}
