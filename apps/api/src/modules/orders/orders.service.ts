import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../common/db/database.types';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import { assertPermission } from '../../common/auth/permission';
import { grantSet, allowedActions } from '../../common/auth/grant-set';
import { ORDER_BUCKETS, type OrderBucket } from './order-buckets';
import { AdulisException } from '../../common/errors/adulis-exception';
import type {
  AddCartLineBody,
  CreateOrderBody,
  PatchCartLineBody,
  RejectPaymentBody,
  ReportRefundBody,
} from './orders.schemas';

/**
 * C3 — the concurrency-critical group. Every state change is a named
 * database function riding the migration-09 guards; this file never
 * decides a transition, computes an expiry, or touches a stock count.
 *
 * THERE IS NO ACCEPT ACTION anywhere in it — reservations are never gated
 * on the seller (S9.4), and the absence is the contract.
 */

interface CartRow {
  id: string;
  seller_id: string | null;
  status: string;
}

@Injectable()
export class OrdersService {
  // ------------------------------------------------------------------- cart

  /**
   * The active cart for this caller: by account when authenticated, by
   * device before identity exists (C6 — the pre-identity endpoints are the
   * ones a buyer hits on the worst connection).
   */
  private async resolveCart(
    trx: Transaction<Database>,
    req: AuthedRequest,
    createIfMissing: boolean,
  ): Promise<CartRow | null> {
    const account = req.ctx?.accountId ?? null;
    const device = typeof req.headers['x-adulis-device'] === 'string'
      ? (req.headers['x-adulis-device'] as string)
      : null;
    if (!account && !device) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'X-Adulis-Device' } });
    }

    const existing = await sql<CartRow>`
      SELECT id, seller_id, status FROM core.cart
       WHERE status = 'ACTIVE'
         AND ((${account}::uuid IS NOT NULL AND buyer_account_id = ${account})
              OR (${account}::uuid IS NULL AND device_id = ${device}
                  AND buyer_account_id IS NULL))
       ORDER BY created_at DESC LIMIT 1`.execute(trx);
    if (existing.rows[0]) return existing.rows[0];
    if (!createIfMissing) return null;

    if (!device) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'X-Adulis-Device' } });
    }
    const r = await sql<CartRow>`
      INSERT INTO core.cart (id, device_id, buyer_account_id, market_id)
      SELECT ${randomUUID()}, ${device}, ${account}, d_m.market_id
        FROM (SELECT coalesce(
                (SELECT a.market_id FROM core.account a WHERE a.id = ${account}),
                (SELECT m.id FROM core.market m WHERE m.activation_state = 'ACTIVE'
                   ORDER BY m.created_at ASC LIMIT 1)
              ) AS market_id) d_m
      RETURNING id, seller_id, status`.execute(trx);
    const cart = r.rows[0];
    if (!cart) throw new AdulisException('INTERNAL');
    return cart;
  }

  /** GET /v1/cart — re-checks availability per line on every view (S8.2). */
  async getCart(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    const cart = await this.resolveCart(trx, req, false);
    if (!cart) return { cart_id: null, seller_id: null, lines: [] };

    await sql`
      UPDATE core.cart_line SET availability_checked_at = now()
       WHERE cart_id = ${cart.id}`.execute(trx);

    const lines = await sql<Record<string, unknown>>`
      SELECT cl.id, cl.variant_id, cl.quantity,
             v.price_minor AS current_price_minor,
             v.price_currency AS currency,
             p.name AS product_name,
             (v.stock_count >= cl.quantity
              AND coalesce(v.status, '') <> 'WITHDRAWN'
              AND p.visibility = 'PUBLISHED'
              AND s.status = 'ACTIVE') AS available,
             now() AS available_checked_at
        FROM core.cart_line cl
        JOIN core.product_variant v ON v.id = cl.variant_id
        JOIN core.product p ON p.id = v.product_id
        JOIN core.seller s ON s.id = cl.seller_id
       WHERE cl.cart_id = ${cart.id}
       ORDER BY cl.created_at`.execute(trx);

    return {
      cart_id: cart.id,
      seller_id: cart.seller_id,
      lines: lines.rows.map((l) => ({
        ...l,
        current_price: { amount_minor: Number(l['current_price_minor']), currency: l['currency'] },
      })),
    };
  }

  /** POST /v1/cart/lines — 409 CART_SELLER_CONFLICT on a second seller (S8.1). */
  async addLine(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: AddCartLineBody,
  ): Promise<unknown> {
    const cart = await this.resolveCart(trx, req, true);
    if (!cart) throw new AdulisException('INTERNAL');

    const variant = await sql<{ seller_id: string }>`
      SELECT seller_id FROM core.product_variant WHERE id = ${body.variant_id}`.execute(trx);
    const sellerId = variant.rows[0]?.seller_id;
    if (!sellerId) throw new AdulisException('NOT_FOUND');

    if (cart.seller_id === null) {
      await sql`UPDATE core.cart SET seller_id = ${sellerId}
                 WHERE id = ${cart.id}`.execute(trx);
    } else if (cart.seller_id !== sellerId) {
      // One order is for one store — the composite FK would refuse anyway;
      // answering before the constraint keeps the code specific.
      throw new AdulisException('CART_SELLER_CONFLICT');
    }

    const line = await sql<{ id: string }>`
      INSERT INTO core.cart_line (id, cart_id, seller_id, variant_id, quantity)
      VALUES (${randomUUID()}, ${cart.id}, ${sellerId}, ${body.variant_id}, ${body.quantity})
      RETURNING id`.execute(trx);
    return { line_id: line.rows[0]?.id, cart_id: cart.id };
  }

  async patchLine(
    trx: Transaction<Database>,
    req: AuthedRequest,
    lineId: string,
    body: PatchCartLineBody,
  ): Promise<unknown> {
    const cart = await this.resolveCart(trx, req, false);
    if (!cart) throw new AdulisException('NOT_FOUND');
    const r = await sql<{ id: string }>`
      UPDATE core.cart_line SET quantity = ${body.quantity}
       WHERE id = ${lineId} AND cart_id = ${cart.id}
       RETURNING id`.execute(trx);
    if (!r.rows[0]) throw new AdulisException('NOT_FOUND');
    return { updated: true };
  }

  async deleteLine(
    trx: Transaction<Database>,
    req: AuthedRequest,
    lineId: string,
  ): Promise<void> {
    const cart = await this.resolveCart(trx, req, false);
    if (!cart) throw new AdulisException('NOT_FOUND');
    const r = await sql<{ id: string }>`
      DELETE FROM core.cart_line
       WHERE id = ${lineId} AND cart_id = ${cart.id}
       RETURNING id`.execute(trx);
    if (!r.rows[0]) throw new AdulisException('NOT_FOUND');
    // An emptied cart forgets its seller, so the next line chooses freely.
    await sql`
      UPDATE core.cart SET seller_id = NULL
       WHERE id = ${cart.id}
         AND NOT EXISTS (SELECT 1 FROM core.cart_line WHERE cart_id = ${cart.id})`.execute(trx);
  }

  // ----------------------------------------------------------- buyer orders

  /**
   * POST /v1/orders — the cooldown gate first (a buyer inside a cooldown
   * places no hold on anyone's stock), then ONE call to fn_create_order:
   * whole-cart revalidation, stock decrement, snapshot and conversion in
   * one transaction, U0003 with complete items[] where anything changed.
   */
  async createOrder(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: CreateOrderBody,
  ): Promise<unknown> {
    const buyer = req.ctx?.accountId;
    if (!buyer) throw new AdulisException('SESSION_EXPIRED');

    const cart = await sql<{ seller_id: string | null }>`
      SELECT seller_id FROM core.cart
       WHERE id = ${body.cart_id} AND buyer_account_id = ${buyer}
         AND status = 'ACTIVE'`.execute(trx);
    if (!cart.rows[0]) throw new AdulisException('NOT_FOUND');
    if (!cart.rows[0].seller_id) throw new AdulisException('CART_EMPTY');

    await sql`SELECT core.fn_assert_no_cooldown(${buyer}, ${cart.rows[0].seller_id})`.execute(trx);

    const orderId = randomUUID();
    await sql`SELECT core.fn_create_order(
      ${body.cart_id}, ${buyer}, ${orderId},
      ${JSON.stringify(body.expected)}::jsonb)`.execute(trx);
    return this.orderCard(trx, orderId, buyer);
  }

  async listOrders(
    trx: Transaction<Database>,
    req: AuthedRequest,
    limit: number,
    cursor: string | undefined,
  ): Promise<unknown> {
    const buyer = req.ctx?.accountId;
    const r = await sql<Record<string, unknown> & { created_at: Date }>`
      SELECT o.id, o.state::text, o.total_minor, o.total_currency,
             o.expires_at, o.created_at, s.store_name, s.handle
        FROM core."order" o
        JOIN core.seller s ON s.id = o.seller_id
       WHERE o.buyer_account_id = ${buyer}
         AND (${cursor ?? null}::timestamptz IS NULL
              OR o.created_at < ${cursor ?? null}::timestamptz)
       ORDER BY o.created_at DESC
       LIMIT ${limit + 1}`.execute(trx);
    const page = r.rows.slice(0, limit);
    return {
      data: page.map((o) => ({
        ...o,
        // count(*) is bigint; node-pg hands bigint back as a STRING, and a
        // string reaching a client that renders "{n} items" prints it fine
        // and compares wrong. Narrowed here, at the one place that knows.
        line_count: Number(o['line_count']),
        total: { amount_minor: Number(o['total_minor']), currency: o['total_currency'] },
      })),
      has_more: r.rows.length > limit,
      next_cursor: r.rows.length > limit ? page[page.length - 1]?.created_at.toISOString() : null,
    };
  }

  /**
   * GET /v1/orders/{id} — the authoritative order card, re-read on every
   * view (A6). expires_at is an ABSOLUTE timestamp, never a duration: a
   * duration is stale the moment it is read at 2am.
   */
  async getOrder(trx: Transaction<Database>, req: AuthedRequest, orderId: string): Promise<unknown> {
    return this.orderCard(trx, orderId, req.ctx?.accountId as string);
  }

  private async orderCard(
    trx: Transaction<Database>,
    orderId: string,
    buyer: string,
  ): Promise<unknown> {
    const o = await sql<Record<string, unknown>>`
      SELECT o.id, o.state::text, o.total_minor, o.total_currency, o.expires_at,
             o.clock_stopped_at, o.created_at, o.seller_level_at_order::text,
             s.store_name, s.handle
        FROM core."order" o
        JOIN core.seller s ON s.id = o.seller_id
       WHERE o.id = ${orderId} AND o.buyer_account_id = ${buyer}`.execute(trx);
    const order = o.rows[0];
    if (!order) throw new AdulisException('NOT_FOUND');
    const lines = await sql<Record<string, unknown>>`
      SELECT r.id, r.variant_id, r.quantity, r.state::text,
             r.unit_price_minor, r.unit_price_currency,
             p.name AS product_name, v.variant_key
        FROM core.reservation r
        JOIN core.product_variant v ON v.id = r.variant_id
        JOIN core.product p ON p.id = v.product_id
       WHERE r.order_id = ${orderId}
       ORDER BY r.created_at`.execute(trx);
    const refunds = await sql<Record<string, unknown>>`
      SELECT rf.id, rf.reservation_id, rf.amount_minor, rf.amount_currency,
             rf.reported_by_seller_at, rf.acknowledged_by_buyer_at
        FROM core.refund rf
        JOIN core.reservation r ON r.id = rf.reservation_id
       WHERE r.order_id = ${orderId}`.execute(trx);
    return {
      ...order,
      total: { amount_minor: Number(order['total_minor']), currency: order['total_currency'] },
      lines: lines.rows.map((l) => ({
        ...l,
        unit_price: {
          amount_minor: Number(l['unit_price_minor']),
          currency: l['unit_price_currency'],
        },
      })),
      refunds: refunds.rows,
    };
  }

  async cancelLineAsBuyer(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
    reservationId: string,
  ): Promise<unknown> {
    await sql`SELECT core.fn_cancel_line(
      ${orderId}, ${reservationId}, ${req.ctx?.accountId}, false)`.execute(trx);
    return this.orderCard(trx, orderId, req.ctx?.accountId as string);
  }

  /** The convenience whole-order cancel: every remaining line, one transaction. */
  async cancelOrder(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
  ): Promise<unknown> {
    const lines = await sql<{ id: string }>`
      SELECT r.id FROM core.reservation r
        JOIN core."order" o ON o.id = r.order_id
       WHERE r.order_id = ${orderId} AND r.state = 'ACTIVE'
         AND o.buyer_account_id = ${req.ctx?.accountId}`.execute(trx);
    if (lines.rows.length === 0) throw new AdulisException('ORDER_ALREADY_TERMINAL');
    for (const line of lines.rows) {
      await sql`SELECT core.fn_cancel_line(
        ${orderId}, ${line.id}, ${req.ctx?.accountId}, false)`.execute(trx);
    }
    return this.orderCard(trx, orderId, req.ctx?.accountId as string);
  }

  async confirmReceipt(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
  ): Promise<unknown> {
    await sql`SELECT core.fn_confirm_receipt(${orderId}, ${req.ctx?.accountId})`.execute(trx);
    return this.orderCard(trx, orderId, req.ctx?.accountId as string);
  }

  async acknowledgeRefund(
    trx: Transaction<Database>,
    req: AuthedRequest,
    refundId: string,
  ): Promise<unknown> {
    await sql`SELECT core.fn_acknowledge_refund(${refundId}, ${req.ctx?.accountId})`.execute(trx);
    return { acknowledged: true };
  }

  // ---------------------------------------------------------- seller orders

  async listSellerOrders(
    trx: Transaction<Database>,
    req: AuthedRequest,
    limit: number,
    cursor: string | undefined,
    bucket?: OrderBucket,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.orders:read');
    // D-154: the bucket resolves to states HERE. The wire carries a bucket
    // name; the membership is the server's product decision (see
    // ORDER_BUCKETS), so a client can render tabs without owning the map.
    const bucketStates = bucket ? [...ORDER_BUCKETS[bucket]] : null;
    // SC-03 needs the line count and THE CLOCK THAT MATTERS IN THE CURRENT
    // STATE, and this query used to return neither -- only `expires_at`, the
    // reservation window, which is the WRONG clock for a PAYMENT_SUBMITTED
    // row. The 24h confirmation deadline lives on the open submission
    // (`sla_deadline`, written by financial.service on submit), so the row
    // cannot show it without this join and the screen cannot compute it: the
    // console has no window value and must not have one.
    const r = await sql<Record<string, unknown> & { created_at: Date }>`
      SELECT o.id, o.state::text, o.total_minor, o.total_currency,
             o.expires_at, o.ready_at, o.clock_stopped_at, o.created_at,
             (SELECT count(*) FROM core.reservation r WHERE r.order_id = o.id)
               AS line_count,
             (SELECT ps.sla_deadline
                FROM core.payment_submission ps
               WHERE ps.order_id = o.id AND ps.state = 'SUBMITTED'
               ORDER BY ps.submitted_at DESC LIMIT 1) AS payment_sla_deadline
        FROM core."order" o
       WHERE o.seller_id = ${req.ctx?.sellerId}
         AND (${bucketStates}::text[] IS NULL
              OR o.state::text = ANY(${bucketStates}::text[]))
         AND (${cursor ?? null}::timestamptz IS NULL
              OR o.created_at < ${cursor ?? null}::timestamptz)
       ORDER BY o.created_at DESC
       LIMIT ${limit + 1}`.execute(trx);
    const page = r.rows.slice(0, limit);
    return {
      data: page.map((o) => ({
        ...o,
        total: { amount_minor: Number(o['total_minor']), currency: o['total_currency'] },
      })),
      has_more: r.rows.length > limit,
      next_cursor: r.rows.length > limit ? page[page.length - 1]?.created_at.toISOString() : null,
    };
  }

  async getSellerOrder(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.orders:read');
    const o = await sql<Record<string, unknown>>`
      SELECT o.id, o.state::text, o.total_minor, o.total_currency, o.expires_at,
             o.ready_at, o.clock_stopped_at, o.created_at
        FROM core."order" o
       WHERE o.id = ${orderId} AND o.seller_id = ${req.ctx?.sellerId}`.execute(trx);
    const order = o.rows[0];
    if (!order) throw new AdulisException('NOT_FOUND');
    const lines = await sql<Record<string, unknown>>`
      SELECT r.id, r.variant_id, r.quantity, r.state::text,
             r.unit_price_minor, r.unit_price_currency, v.variant_key,
             p.name AS product_name
        FROM core.reservation r
        JOIN core.product_variant v ON v.id = r.variant_id
        JOIN core.product p ON p.id = v.product_id
       WHERE r.order_id = ${orderId}`.execute(trx);
    // `sla_deadline` added at T10 P5: it IS the confirmation window SC-04's
    // clock region renders in PAYMENT_SUBMITTED. Without it the screen has
    // only `expires_at` -- the reservation clock, which is irrelevant once
    // payment is submitted and actively misleading if displayed.
    const submissions = await sql<Record<string, unknown>>`
      SELECT id, submitted_at, state::text, decided_at, rejection_reason,
             sla_deadline
        FROM core.payment_submission
       WHERE order_id = ${orderId}
       ORDER BY submitted_at DESC`.execute(trx);
    /*
     * D-155 -- allowed_actions, per object, named by permission code. The
     * caller's grant set (role x surface, the E5 rendering-hint read)
     * INTERSECTED with what this order's CURRENT STATE admits. The state
     * predicates live here because this is the one place that already holds
     * the object; the console renders a control iff its code is present and
     * NEVER unions this with anything it worked out itself.
     */
    const st = String(order['state']);
    const hasOpenSubmission = submissions.rows.some((sub) => sub['state'] === 'SUBMITTED');
    const grants = await grantSet(trx, req);
    const actions = allowedActions(grants, {
      'seller.payment:confirm': st === 'PAYMENT_SUBMITTED' && hasOpenSubmission,
      'seller.payment_evidence:read': submissions.rows.length > 0,
      'seller.orders:respond': ['CREATED', 'NOTIFIED', 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED'].includes(st),
      'seller.order_ready:update':
        ['PAYMENT_CONFIRMED', 'HANDED_OFF'].includes(st) && order['ready_at'] == null,
      'seller.couriers:manage': ['PAYMENT_CONFIRMED', 'HANDED_OFF'].includes(st),
      'seller.handoff:custody_transfer': st === 'PAYMENT_CONFIRMED',
      'seller.handoff:read': st === 'PAYMENT_CONFIRMED' || st === 'HANDED_OFF',
      'seller.orders:reissue_instructions': ['PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED'].includes(st),
    });
    // SC-04 region 6, the append-only transition list, written by
    // trg_log_order_transition and protected by trg_append_only -- the
    // order's own history rather than a reconstruction.
    //
    // NOT THE ONLY READER, and this comment used to say it was (T11 Phase 7,
    // correcting D-159's false claim -- a wrong report gets fact-checked; a
    // wrong comment gets believed). Two readers predate this query:
    // claims.service.ts builds a claim's evidence bundle from this table
    // with nearly this SELECT, and jobs/e1-clock.ts reads it to decide which
    // PAYMENT_SUBMITTED orders have lapsed their confirmation window. Change
    // this table's columns, ordering, grants or filters and you are changing
    // THREE consumers, one of which decides expiry on the money path.
    const history = await sql<Record<string, unknown>>`
      SELECT from_state::text AS from_state, to_state::text AS to_state,
             reason, occurred_at
        FROM core.order_state_transition
       WHERE order_id = ${orderId}
       ORDER BY occurred_at ASC`.execute(trx);
    return {
      allowed_actions: actions,
      ...order,
      total: { amount_minor: Number(order['total_minor']), currency: order['total_currency'] },
      lines: lines.rows,
      payment_submissions: submissions.rows,
      history: history.rows,
    };
  }

  /** Idempotent by STATE, not only by key: a second call is a no-op. */
  async markReady(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.order_ready:update');
    const r = await sql<{ fn_mark_order_ready: Date }>`
      SELECT core.fn_mark_order_ready(
        ${orderId}, ${req.ctx?.accountId}, ${req.ctx?.sellerId})`.execute(trx);
    return { ready_at: r.rows[0]?.fn_mark_order_ready?.toISOString() };
  }

  async confirmPayment(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.payment:confirm');
    await sql`SELECT core.fn_confirm_payment(
      ${orderId}, ${req.ctx?.sellerId}, ${req.ctx?.accountId})`.execute(trx);
    return { state: 'PAYMENT_CONFIRMED' };
  }

  async rejectPayment(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
    body: RejectPaymentBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.payment:confirm');
    const r = await sql<{ fn_reject_payment: string }>`
      SELECT core.fn_reject_payment(
        ${orderId}, ${req.ctx?.sellerId}, ${req.ctx?.accountId},
        ${body.reason})`.execute(trx);
    return { outcome: r.rows[0]?.fn_reject_payment };
  }

  /** Surfaced as "Can't Fulfil". There is no accept action. */
  async cancelLineAsSeller(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
    reservationId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.orders:respond');
    await sql`SELECT core.fn_cancel_line(
      ${orderId}, ${reservationId}, ${req.ctx?.accountId}, true)`.execute(trx);
    return { cancelled: reservationId };
  }

  async reportRefund(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
    body: ReportRefundBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.refunds:report');
    const r = await sql<{ fn_report_refund: string }>`
      SELECT core.fn_report_refund(
        ${orderId}, ${body.reservation_id}, ${req.ctx?.sellerId},
        ${body.amount_minor}, ${body.currency})`.execute(trx);
    return { refund_id: r.rows[0]?.fn_report_refund };
  }
}
