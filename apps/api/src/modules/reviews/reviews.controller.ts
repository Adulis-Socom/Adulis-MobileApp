import { Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import { z } from 'zod';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import type { Database } from '../../common/db/database.types';
import { AdulisException } from '../../common/errors/adulis-exception';

/**
 * C7 — reviews (ADU-API-01 sections 12.4, 12.11; ADU-PRD-01 S12).
 *
 * One review per order, on a terminal order; the BADGE is not the
 * caller's to set — the migration-14 trigger derives it from the order's
 * own confirmation evidence, and there is no field here in which to send
 * one. Two ratings, always separate: seller quality on the review, item
 * quality per product. The seller surface is READ-ONLY — no seller-
 * writable column exists on a review (a load-bearing absence).
 */

const reviewBody = z.object({
  seller_rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).optional(),
  item_ratings: z
    .array(z.object({ product_id: z.uuid(), rating: z.number().int().min(1).max(5) }))
    .max(20)
    .optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TERMINAL = ['COMPLETED', 'CANCELLED_BY_BUYER', 'CANCELLED_BY_SELLER', 'EXPIRED_UNCLAIMED'];

const first = <T>(rows: readonly T[]): T | undefined => rows[0];

@Controller()
export class ReviewsController {
  constructor(private readonly tx: HandlerTransaction) {}

  @Post('orders/:id/review')
  @ApiOperation({ summary: 'One per order, terminal orders only; the badge is derived, never sent.' })
  async create(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    if (!UUID_RE.test(id)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'id' } });
    }
    const body = reviewBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 201, (trx) =>
      this.createReview(trx, req, id, body),
    );
  }

  private async createReview(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
    body: z.infer<typeof reviewBody>,
  ): Promise<unknown> {
    const buyer = req.ctx?.accountId as string;
    const order = await sql<{ id: string; seller_id: string; state: string }>`
      SELECT id, seller_id, state::text AS state FROM core."order"
       WHERE id = ${orderId} AND buyer_account_id = ${buyer}`.execute(trx);
    const o = first(order.rows);
    if (!o) throw new AdulisException('NOT_FOUND');
    if (!TERMINAL.includes(o.state)) {
      throw new AdulisException('VALIDATION_FAILED', {
        status: 409,
        slots: { reason: 'ORDER_NOT_TERMINAL', state: o.state },
      });
    }

    // Item ratings attach only to products this order actually carried.
    const items = body.item_ratings ?? [];
    if (items.length > 0) {
      const owned = await sql<{ product_id: string }>`
        SELECT DISTINCT pv.product_id
          FROM core.reservation r
          JOIN core.product_variant pv ON pv.id = r.variant_id
         WHERE r.order_id = ${orderId}`.execute(trx);
      const allowed = new Set(owned.rows.map((x) => x.product_id));
      for (const item of items) {
        if (!allowed.has(item.product_id)) {
          throw new AdulisException('VALIDATION_FAILED', {
            slots: { path: 'item_ratings', product_id: item.product_id },
          });
        }
      }
    }

    try {
      const reviewId = randomUUID();
      const r = await sql<{ badge: string }>`
        INSERT INTO core.review (id, order_id, buyer_account_id, seller_id, seller_rating, body)
        VALUES (${reviewId}, ${orderId}, ${buyer}, ${o.seller_id},
                ${body.seller_rating}, ${body.body ?? null})
        RETURNING badge::text AS badge`.execute(trx);
      for (const item of items) {
        await sql`
          INSERT INTO core.review_item_rating (id, review_id, product_id, rating)
          VALUES (${randomUUID()}, ${reviewId}, ${item.product_id}, ${item.rating})`.execute(trx);
      }
      return { review_id: reviewId, badge: first(r.rows)?.badge };
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw new AdulisException('IDEMPOTENCY_KEY_REUSED', {
          status: 409,
          slots: { constraint: 'review_order_id_key' },
        });
      }
      throw e;
    }
  }

  @Get('seller/reviews')
  @ApiOperation({ summary: 'Read-only — there is no field a seller can write on a review.' })
  async sellerReviews(
    @Req() req: AuthedRequest,
    @Query('cursor') cursor?: string,
  ): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      const accountId = req.ctx?.accountId as string;
      const sellerId = req.ctx?.sellerId as string;
      await sql`
        SELECT core.fn_has_permission(${accountId}, ${sellerId},
          'seller.reviews:read',
          ${(req.ctx?.audience as string) ?? ''}::core.session_audience)`.execute(trx);
      const limit = 25;
      const r = await sql<Record<string, unknown> & { published_at: Date }>`
        SELECT rv.id, rv.order_id, rv.seller_rating, rv.body, rv.badge,
               rv.published_at, rv.anonymised_at IS NOT NULL AS anonymised,
               coalesce(
                 (SELECT jsonb_agg(jsonb_build_object(
                           'product_id', ir.product_id, 'rating', ir.rating))
                    FROM core.review_item_rating ir WHERE ir.review_id = rv.id),
                 '[]'::jsonb) AS item_ratings
          FROM core.review rv
         WHERE rv.seller_id = ${sellerId}
           AND (${cursor ?? null}::timestamptz IS NULL
                OR rv.published_at < ${cursor ?? null}::timestamptz)
         ORDER BY rv.published_at DESC
         LIMIT ${limit + 1}`.execute(trx);
      const data = r.rows.slice(0, limit);
      return {
        data,
        next_cursor:
          r.rows.length > limit ? data[data.length - 1]?.published_at.toISOString() : null,
      };
    });
  }
}
