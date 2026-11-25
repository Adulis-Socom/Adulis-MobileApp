import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { sql, type Transaction } from 'kysely';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import type { Database } from '../../common/db/database.types';

/**
 * C6 — billing (ADU-API-01 v1.7 section 12.12, R4), Subscription Option B.
 *
 * The whole group is CONSOLE-only, and that is enforced BELOW the
 * endpoint: seller.subscription:update carries surfaces = {CONSOLE} in
 * core.permission, so a MOBILE session gets fn_has_permission's U0001 —
 * 403, never a redirect, because a redirect is itself a link to an
 * external purchase mechanism and the exact thing an App Store reviewer
 * is looking for.
 *
 * Plans, status and entitlement resolution stay. Purchasing and manual
 * payment collection were retired (founder pre-launch authorization,
 * migration 0063): no purchase intent, no transfer reference, no
 * "I have transferred" assertion and no collection reminder exist, and the
 * read below carries no payment instruction.
 */

const first = <T>(rows: readonly T[]): T | undefined => rows[0];

@Controller()
export class BillingController {
  constructor(private readonly tx: HandlerTransaction) {}

  private async assertPermission(
    trx: Transaction<Database>,
    req: AuthedRequest,
  ): Promise<{ accountId: string; sellerId: string }> {
    const accountId = req.ctx?.accountId as string;
    const sellerId = req.ctx?.sellerId as string;
    await sql`
      SELECT core.fn_has_permission(${accountId}, ${sellerId},
        'seller.subscription:update',
        ${(req.ctx?.audience as string) ?? ''}::core.session_audience)`.execute(trx);
    return { accountId, sellerId };
  }

  @Get('billing/subscription')
  @ApiOperation({ summary: 'CONSOLE only by permission surface — 403 to MOBILE, never a redirect (R4).' })
  async subscription(@Req() req: AuthedRequest): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      const { sellerId } = await this.assertPermission(trx, req);
      const r = await sql<Record<string, unknown>>`
        SELECT s.state, s.tier, s.term, s.trial_ends_at,
               s.current_period_start, s.current_period_end,
               s.locked_rate_minor, s.locked_rate_currency
          FROM billing.subscription s
         WHERE s.seller_id = ${sellerId}`.execute(trx);
      return { subscription: first(r.rows) ?? null };
    });
  }
}
