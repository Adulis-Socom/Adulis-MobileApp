import { Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { sql, type Transaction } from 'kysely';
import { z } from 'zod';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import type { Database } from '../../common/db/database.types';
import { AdulisException } from '../../common/errors/adulis-exception';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ADU-API-01 v1.10 S12.13: the analytics reads take an inclusive `[from, to]`
 * of ISO calendar dates, defaulting to the trailing 30 days. The window is a
 * property of the RESPONSE -- `window: {from, to}` once, suffix-free fields --
 * because a field named `orders_30d` returning ninety days is a name that
 * lies. Validated at the edge, then passed as two nullable bounds the SQL
 * resolves in one CTE (`win`), so a caller cannot smuggle anything but a date
 * and the default is expressed once.
 */
interface Window {
  readonly from: string | null;
  readonly to: string | null;
}
function parseWindow(from?: string, to?: string): Window {
  for (const [v, path] of [
    [from, 'from'],
    [to, 'to'],
  ] as const) {
    if (v !== undefined && !ISO_DATE.test(v)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path } });
    }
  }
  if (from !== undefined && to !== undefined && from > to) {
    throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'from', reason: 'AFTER_TO' } });
  }
  return { from: from ?? null, to: to ?? null };
}

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
  @ApiOperation({ summary: 'Essential counts over a date window. Every tier, including Free and Beta.' })
  async overview(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<unknown> {
    const win = parseWindow(from, to);
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      const sellerId = await this.assertRead(trx, req, 'seller.analytics.basic:read');
      const r = await sql<Record<string, unknown>>`
        WITH win AS (
          SELECT
            CASE
              WHEN ${win.from}::text IS NOT NULL THEN ${win.from}::date::timestamptz
              -- A lone upper bound means a trailing 30-day window ENDING at to,
              -- not one ending today: defaulting lo to now()-30d there would
              -- leave lo > hi for any past to -- a silent empty window with an
              -- incoherent echo (window_from after window_to). Pass fix m1.
              WHEN ${win.to}::text IS NOT NULL THEN (${win.to}::date - interval '30 days')::timestamptz
              ELSE now() - interval '30 days'
            END AS lo,
            CASE WHEN ${win.to}::text IS NULL THEN now()
                 ELSE (${win.to}::date + interval '1 day')::timestamptz END AS hi
        )
        SELECT
          (SELECT count(*)::int FROM core.product p
            WHERE p.seller_id = ${sellerId} AND p.published_at IS NOT NULL)
            AS products_published,
          (SELECT count(*)::int FROM core."order" o, win
            WHERE o.seller_id = ${sellerId}
              AND o.created_at >= win.lo AND o.created_at < win.hi) AS orders,
          (SELECT count(*)::int FROM core.reservation r2
            WHERE r2.seller_id = ${sellerId} AND r2.state = 'ACTIVE')
            AS active_reservations,
          coalesce(ps.completed_handoff_count, 0) AS completed_handoffs,
          (SELECT count(*)::int FROM core.follow f
            WHERE f.seller_id = ${sellerId} AND f.state = 'FOLLOWING') AS followers,
          (SELECT to_char(lo, 'YYYY-MM-DD') FROM win) AS window_from,
          (SELECT to_char(hi - interval '1 second', 'YYYY-MM-DD') FROM win) AS window_to
          FROM (SELECT 1) x
          LEFT JOIN core.seller_public_stats ps ON ps.seller_id = ${sellerId}`.execute(trx);
      // v1.10 S12.13: the window is a property of the RESPONSE, not of each
      // field -- `window: {from, to}` once, and the fields carry no suffix. A
      // field named `orders_30d` returning ninety days is a name that lies.
      const row = first(r.rows) as Record<string, unknown>;
      const { window_from, window_to, ...counts } = row;
      return { ...counts, window: { from: window_from, to: window_to } };
    });
  }

  @Get('seller/analytics/full')
  @ApiOperation({ summary: 'Views, reservations, conversion, funnel over a window — entitlement-gated.' })
  async full(
    @Req() req: AuthedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<unknown> {
    const win = parseWindow(from, to);
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      const sellerId = await this.assertRead(trx, req, 'seller.analytics.full:read');
      const scope = await sql<{ limit: { allowed: boolean; scope: string | null } }>`
        SELECT billing.fn_effective_limit(${sellerId}, 'ANALYTICS_SCOPE') AS "limit"`.execute(trx);
      const limit = first(scope.rows)?.limit;
      if (!limit?.allowed) throw new AdulisException('TIER_LIMIT_REACHED');

      const r = await sql<Record<string, unknown>>`
        WITH win AS (
          SELECT
            CASE
              WHEN ${win.from}::text IS NOT NULL THEN ${win.from}::date::timestamptz
              -- A lone upper bound means a trailing 30-day window ENDING at to,
              -- not one ending today: defaulting lo to now()-30d there would
              -- leave lo > hi for any past to -- a silent empty window with an
              -- incoherent echo (window_from after window_to). Pass fix m1.
              WHEN ${win.to}::text IS NOT NULL THEN (${win.to}::date - interval '30 days')::timestamptz
              ELSE now() - interval '30 days'
            END AS lo,
            CASE WHEN ${win.to}::text IS NULL THEN now()
                 ELSE (${win.to}::date + interval '1 day')::timestamptz END AS hi
        )
        SELECT
          (SELECT count(*)::int FROM analytics.event e, win
            WHERE e.seller_id = ${sellerId} AND e.name = 'storefront_viewed'
              AND e.occurred_at >= win.lo AND e.occurred_at < win.hi) AS storefront_views,
          (SELECT count(*)::int FROM analytics.event e, win
            WHERE e.seller_id = ${sellerId} AND e.name = 'product_viewed'
              AND e.occurred_at >= win.lo AND e.occurred_at < win.hi) AS product_views,
          (SELECT count(*)::int FROM core.reservation r2, win
            WHERE r2.seller_id = ${sellerId}
              AND r2.created_at >= win.lo AND r2.created_at < win.hi) AS reservations,
          (SELECT count(*)::int FROM core."order" o, win
            WHERE o.seller_id = ${sellerId} AND o.state = 'COMPLETED'
              AND o.created_at >= win.lo AND o.created_at < win.hi) AS completed,
          ps.confirmation_rate, ps.cancellation_rate, ps.scan_completion_rate,
          ps.unresolved_claim_count,
          (SELECT to_char(lo, 'YYYY-MM-DD') FROM win) AS window_from,
          (SELECT to_char(hi - interval '1 second', 'YYYY-MM-DD') FROM win) AS window_to
          FROM (SELECT 1) x
          LEFT JOIN core.seller_public_stats ps ON ps.seller_id = ${sellerId}`.execute(trx);
      const row = first(r.rows) as Record<string, unknown>;
      const views = Number(row['product_views'] ?? 0);
      const reservations = Number(row['reservations'] ?? 0);
      // v1.10 S12.13: one `window: {from, to}` on the response; no suffixes.
      const { window_from, window_to, ...fields } = row;
      return {
        ...fields,
        window: { from: window_from, to: window_to },
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
