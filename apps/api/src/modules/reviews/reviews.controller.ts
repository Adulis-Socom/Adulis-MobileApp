import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { sql } from 'kysely';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';

/**
 * C7 — reviews (ADU-API-01 sections 12.4, 12.11; ADU-PRD-01 S12).
 *
 * Purchase-derived Review CREATION is deferred: it required a terminal legacy
 * Order and read its Reservation lines, both retired by migration 0063, and no
 * replacement eligibility is invented. What remains is the read. When reviews
 * were written: one per order, on a terminal order; the BADGE is not the
 * caller's to set — the migration-14 trigger derives it from the order's
 * own confirmation evidence, and there is no field here in which to send
 * one. Two ratings, always separate: seller quality on the review, item
 * quality per product. The seller surface is READ-ONLY — no seller-
 * writable column exists on a review (a load-bearing absence).
 */

const first = <T>(rows: readonly T[]): T | undefined => rows[0];

@Controller()
export class ReviewsController {
  constructor(private readonly tx: HandlerTransaction) {}

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
