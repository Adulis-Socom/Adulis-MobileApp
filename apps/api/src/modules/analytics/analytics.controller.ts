import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { sql, type Transaction } from 'kysely';
import { z } from 'zod';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import type { Database } from '../../common/db/database.types';
import { AdulisException } from '../../common/errors/adulis-exception';

/**
 * C8 — seller analytics (12.13) and client events (12.16).
 *
 * INVARIANT — analytics responses carry RESOLVED NUMBERS, never raw event
 * rows: two clients aggregating events compute business state differently.
 * Entitlement is resolved by billing.fn_effective_limit at read time —
 * beta sellers receive the Assisted set, never the Free set (S16.10).
 *
 * POST /v1/seller/analytics/export is NOT built: it is an async job
 * writing to R2, the worker process does not exist yet, and no job table
 * exists to hand back a handle from (registered).
 *
 * /v1/events: a closed allow-list of TWO client-observed events (S11).
 * Everything else is server-emitted from inside the function that caused
 * it; an unknown name is 422, never a silent accept.
 */

const CLIENT_EVENTS: Record<string, string> = {
  NotificationOpened: 'notification_opened',
  PaymentInstructionsViewed: 'payment_instructions_viewed',
};

const eventBody = z.object({
  event_name: z.string().max(80),
  order_id: z.uuid().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const first = <T>(rows: readonly T[]): T | undefined => rows[0];

@Controller()
export class AnalyticsController {
  constructor(private readonly tx: HandlerTransaction) {}

  @Get('seller/analytics/overview')
  @ApiOperation({ summary: 'Essential counts. Every tier, including Free and Beta.' })
  async overview(@Req() req: AuthedRequest): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      const sellerId = await this.assertRead(trx, req, 'seller.analytics.basic:read');
      const r = await sql<Record<string, unknown>>`
        SELECT
          (SELECT count(*)::int FROM core.product p
            WHERE p.seller_id = ${sellerId} AND p.published_at IS NOT NULL)
            AS products_published,
          (SELECT count(*)::int FROM core."order" o
            WHERE o.seller_id = ${sellerId}
              AND o.created_at > now() - interval '30 days') AS orders_30d,
          (SELECT count(*)::int FROM core.reservation r2
            WHERE r2.seller_id = ${sellerId} AND r2.state = 'ACTIVE')
            AS active_reservations,
          coalesce(ps.completed_handoff_count, 0) AS completed_handoffs,
          (SELECT count(*)::int FROM core.follow f
            WHERE f.seller_id = ${sellerId} AND f.state = 'FOLLOWING') AS followers
          FROM (SELECT 1) x
          LEFT JOIN core.seller_public_stats ps ON ps.seller_id = ${sellerId}`.execute(trx);
      return first(r.rows);
    });
  }

  @Get('seller/analytics/full')
  @ApiOperation({ summary: 'Views, reservations, conversion, funnel — entitlement-gated at read time.' })
  async full(@Req() req: AuthedRequest): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      const sellerId = await this.assertRead(trx, req, 'seller.analytics.full:read');
      const scope = await sql<{ limit: { allowed: boolean; scope: string | null } }>`
        SELECT billing.fn_effective_limit(${sellerId}, 'ANALYTICS_SCOPE') AS "limit"`.execute(trx);
      const limit = first(scope.rows)?.limit;
      if (!limit?.allowed) throw new AdulisException('TIER_LIMIT_REACHED');

      const r = await sql<Record<string, unknown>>`
        SELECT
          (SELECT count(*)::int FROM analytics.event e
            WHERE e.seller_id = ${sellerId} AND e.name = 'storefront_viewed'
              AND e.occurred_at > now() - interval '30 days') AS storefront_views_30d,
          (SELECT count(*)::int FROM analytics.event e
            WHERE e.seller_id = ${sellerId} AND e.name = 'product_viewed'
              AND e.occurred_at > now() - interval '30 days') AS product_views_30d,
          (SELECT count(*)::int FROM core.reservation r2
            WHERE r2.seller_id = ${sellerId}
              AND r2.created_at > now() - interval '30 days') AS reservations_30d,
          (SELECT count(*)::int FROM core."order" o
            WHERE o.seller_id = ${sellerId} AND o.state = 'COMPLETED'
              AND o.created_at > now() - interval '30 days') AS completed_30d,
          ps.confirmation_rate, ps.cancellation_rate, ps.scan_completion_rate,
          ps.unresolved_claim_count
          FROM (SELECT 1) x
          LEFT JOIN core.seller_public_stats ps ON ps.seller_id = ${sellerId}`.execute(trx);
      const row = first(r.rows) as Record<string, unknown>;
      const views = Number(row['product_views_30d'] ?? 0);
      const reservations = Number(row['reservations_30d'] ?? 0);
      return {
        ...row,
        scope: limit.scope,
        // Resolved here, not by the client: two clients would differ.
        view_to_reservation_rate: views > 0 ? reservations / views : null,
      };
    });
  }

  private async assertRead(
    trx: Transaction<Database>,
    req: AuthedRequest,
    permission: string,
  ): Promise<string> {
    const accountId = req.ctx?.accountId as string;
    const sellerId = req.ctx?.sellerId as string;
    await sql`
      SELECT core.fn_has_permission(${accountId}, ${sellerId}, ${permission},
        ${(req.ctx?.audience as string) ?? ''}::core.session_audience)`.execute(trx);
    return sellerId;
  }

  @Post('events')
  @HttpCode(202)
  @ApiOperation({ summary: 'The closed allow-list of two client-observed events (S11).' })
  async postEvent(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = eventBody.parse(req.body);
    const name = CLIENT_EVENTS[body.event_name];
    if (!name) {
      // 422, never a silent accept: an events endpoint that accepts
      // anything is an events table that means nothing.
      throw new AdulisException('VALIDATION_FAILED', {
        status: 422,
        slots: { path: 'event_name' },
      });
    }
    return this.tx.runIdempotent(req as LocalizedRequest, res, 202, async (trx) => {
      const accountId = req.ctx?.accountId as string;
      await sql`
        INSERT INTO analytics.event
          (market_id, name, version, actor_account_id, order_id, payload)
        SELECT a.market_id, ${name}, 1, ${accountId}, ${body.order_id ?? null},
               ${JSON.stringify(body.payload ?? {})}::jsonb
          FROM core.account a WHERE a.id = ${accountId}`.execute(trx);
      return {};
    });
  }
}
