import { Controller, Get, HttpCode, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
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
 * C8 — notifications (ADU-API-01 v1.6 section 12.14).
 *
 * The list takes the R10 scope rule: one account is buyer and seller at
 * once, and an unscoped list interleaves the two lives. The split is by
 * the notification's own subject — an order-linked row belongs to the
 * side of the order the recipient stands on; the seller-class templates
 * (enqueued by database triggers) are the seller side's unlinked rows.
 *
 * INVARIANT — a notification with suppressible = false is not togglable:
 * the PATCH refuses with 422 rather than silently accepting and ignoring,
 * or a seller believes they turned off something that keeps arriving.
 */

/** The classes the DATABASE enqueues unsuppressibly (migrations 16, 22).
 *  The same predicate, spelled in SQL, splits the seller-side unlinked
 *  rows in the list queries below. */
const UNSUPPRESSIBLE = (key: string): boolean =>
  key === 'NEW_DEVICE_SIGNIN' || key.startsWith('PAYOUT_CHANGE');

const preferencesBody = z.object({
  preferences: z
    .array(z.object({ template_key: z.string().max(120), enabled: z.boolean() }))
    .min(1)
    .max(50),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const first = <T>(rows: readonly T[]): T | undefined => rows[0];

@Controller()
export class NotificationsController {
  constructor(private readonly tx: HandlerTransaction) {}

  @Get('notifications')
  @ApiOperation({ summary: '?as=buyer or ?as=seller&seller_id= required — the 12.7 rule.' })
  async list(
    @Req() req: AuthedRequest,
    @Query('as') scope?: string,
    @Query('seller_id') sellerParam?: string,
    @Query('cursor') cursor?: string,
  ): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      const accountId = req.ctx?.accountId as string;
      const limit = 25;
      if (scope === 'buyer') {
        const r = await sql<Record<string, unknown> & { scheduled_for: Date }>`
          SELECT n.id, n.template_key, n.locale, n.slots, n.order_id,
                 n.suppressible, n.scheduled_for, n.read_at
            FROM core.notification n
            LEFT JOIN core."order" o ON o.id = n.order_id
           WHERE n.recipient_account_id = ${accountId}
             AND (n.order_id IS NULL OR o.buyer_account_id = ${accountId})
             AND NOT (n.order_id IS NULL AND
                      (n.template_key = 'NEW_DEVICE_SIGNIN'
                       OR n.template_key LIKE 'PAYOUT_CHANGE%'
                       OR n.template_key = 'notification.chat.escalated'))
             AND (${cursor ?? null}::timestamptz IS NULL
                  OR n.scheduled_for < ${cursor ?? null}::timestamptz)
           ORDER BY n.scheduled_for DESC
           LIMIT ${limit + 1}`.execute(trx);
        return this.page(r.rows, limit);
      }
      if (scope === 'seller') {
        const sellerId = req.ctx?.sellerId as string | null;
        if (!sellerParam || sellerParam !== sellerId) {
          throw new AdulisException('SCOPE_PARAMETER_REQUIRED');
        }
        await sql`
          SELECT core.fn_has_permission(${accountId}, ${sellerId},
            'seller.notifications:read',
            ${(req.ctx?.audience as string) ?? ''}::core.session_audience)`.execute(trx);
        const r = await sql<Record<string, unknown> & { scheduled_for: Date }>`
          SELECT n.id, n.template_key, n.locale, n.slots, n.order_id,
                 n.suppressible, n.scheduled_for, n.read_at
            FROM core.notification n
            LEFT JOIN core."order" o ON o.id = n.order_id
           WHERE n.recipient_account_id = ${accountId}
             AND ((n.order_id IS NOT NULL AND o.seller_id = ${sellerId})
                  OR (n.order_id IS NULL AND
                      (n.template_key = 'NEW_DEVICE_SIGNIN'
                       OR n.template_key LIKE 'PAYOUT_CHANGE%'
                       OR n.template_key = 'notification.chat.escalated')))
             AND (${cursor ?? null}::timestamptz IS NULL
                  OR n.scheduled_for < ${cursor ?? null}::timestamptz)
           ORDER BY n.scheduled_for DESC
           LIMIT ${limit + 1}`.execute(trx);
        return this.page(r.rows, limit);
      }
      throw new AdulisException('SCOPE_PARAMETER_REQUIRED');
    });
  }

  private page(rows: (Record<string, unknown> & { scheduled_for: Date })[], limit: number): unknown {
    const data = rows.slice(0, limit);
    return {
      data,
      next_cursor:
        rows.length > limit ? data[data.length - 1]?.scheduled_for.toISOString() : null,
    };
  }

  @Post('notifications/:id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Read state syncs across surfaces — one list, two clients.' })
  async markRead(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    if (!UUID_RE.test(id)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'id' } });
    }
    return this.tx.runIdempotent(req as LocalizedRequest, res, 200, async (trx) => {
      const r = await sql<{ read_at: Date }>`
        UPDATE core.notification
           SET read_at = coalesce(read_at, now())
         WHERE id = ${id} AND recipient_account_id = ${req.ctx?.accountId ?? ''}
         RETURNING read_at`.execute(trx);
      const row = first(r.rows);
      if (!row) throw new AdulisException('NOT_FOUND');
      return { read_at: row.read_at };
    });
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  async readAll(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    return this.tx.runIdempotent(req as LocalizedRequest, res, 200, async (trx) => {
      const r = await sql`
        UPDATE core.notification SET read_at = now()
         WHERE recipient_account_id = ${req.ctx?.accountId ?? ''}
           AND read_at IS NULL`.execute(trx);
      return { marked: Number(r.numAffectedRows ?? 0) };
    });
  }

  @Get('seller/notification-preferences')
  async getPreferences(@Req() req: AuthedRequest): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      const { accountId, sellerId } = await this.assertPrefs(trx, req, 'seller.notifications:read');
      const r = await sql<Record<string, unknown>>`
        SELECT template_key, enabled, updated_at
          FROM core.notification_preference
         WHERE seller_id = ${sellerId} AND account_id = ${accountId}
         ORDER BY template_key`.execute(trx);
      return { preferences: r.rows };
    });
  }

  /** PATCH is idempotent by shape (an upsert of named keys); no key demanded. */
  @Patch('seller/notification-preferences')
  @ApiOperation({ summary: 'suppressible=false is not togglable: 422, never a silent accept.' })
  async patchPreferences(@Req() req: AuthedRequest): Promise<unknown> {
    const body = preferencesBody.parse(req.body);
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      const { accountId, sellerId } = await this.assertPrefs(
        trx, req, 'seller.notifications.preferences:write');
      for (const p of body.preferences) {
        if (!p.enabled && UNSUPPRESSIBLE(p.template_key)) {
          throw new AdulisException('VALIDATION_FAILED', {
            status: 422,
            slots: { path: 'preferences', template_key: p.template_key, reason: 'NOT_SUPPRESSIBLE' },
          });
        }
      }
      for (const p of body.preferences) {
        await sql`
          INSERT INTO core.notification_preference
            (seller_id, account_id, template_key, enabled)
          VALUES (${sellerId}, ${accountId}, ${p.template_key}, ${p.enabled})
          ON CONFLICT (seller_id, account_id, template_key)
          DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`.execute(trx);
      }
      return { updated: body.preferences.length };
    });
  }

  private async assertPrefs(
    trx: Transaction<Database>,
    req: AuthedRequest,
    permission: string,
  ): Promise<{ accountId: string; sellerId: string }> {
    const accountId = req.ctx?.accountId as string;
    const sellerId = req.ctx?.sellerId as string;
    await sql`
      SELECT core.fn_has_permission(${accountId}, ${sellerId}, ${permission},
        ${(req.ctx?.audience as string) ?? ''}::core.session_audience)`.execute(trx);
    return { accountId, sellerId };
  }
}
