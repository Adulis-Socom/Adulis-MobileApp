import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../common/db/database.types';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import { AdulisException } from '../../common/errors/adulis-exception';
import { deviceHeader } from '../../common/http/cookies';
import type { AddCartLineBody, PatchCartLineBody } from './orders.schemas';

/**
 * C3 — the cart only (Checkout Option A). It reads availability and never
 * holds, reserves or decrements stock; Order creation and the Reservation
 * lifecycle were retired by migration 0063 and nothing replaces them here.
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
    const device = deviceHeader(req.headers['x-adulis-device']);
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
}
