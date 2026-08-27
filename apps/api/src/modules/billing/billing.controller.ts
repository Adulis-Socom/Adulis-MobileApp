import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
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
 * C6 — billing (ADU-API-01 v1.6 section 12.12, R4).
 *
 * The whole group is CONSOLE-only, and that is enforced BELOW the
 * endpoint: seller.subscription:update carries surfaces = {CONSOLE} in
 * core.permission, so a MOBILE session gets fn_has_permission's U0001 —
 * 403, never a redirect, because a redirect is itself a link to an
 * external purchase mechanism and the exact thing an App Store reviewer
 * is looking for.
 *
 * Collection is a manual bank transfer behind the provider-agnostic
 * billing.collection_record (S16.7): purchase-intent computes the price
 * from the market's schedule and opens a record; mark-transferred stamps
 * the seller's own assertion; reconciliation is operator work outside
 * this contract.
 */

const purchaseIntentBody = z.object({
  tier: z.enum(['LISTED', 'ASSISTED', 'VERIFIED_PRO', 'BUSINESS']),
  term: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
  step_up_challenge_id: z.uuid(),
});

const markTransferredBody = z.object({ collection_record_id: z.uuid() });

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

  @Post('billing/purchase-intent')
  @ApiOperation({ summary: 'Step-up SUBSCRIPTION_CHANGE; opens a collection record at the scheduled price.' })
  async purchaseIntent(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = purchaseIntentBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 201, async (trx) => {
      const { accountId, sellerId } = await this.assertPermission(trx, req);
      await sql`
        SELECT core.fn_assert_step_up(${body.step_up_challenge_id},
          ${accountId}, 'SUBSCRIPTION_CHANGE')`.execute(trx);

      const sub = await sql<{ id: string }>`
        SELECT id FROM billing.subscription
         WHERE seller_id = ${sellerId}`.execute(trx);
      const subscription = first(sub.rows);
      // No subscription row is no purchase anchor: the beta cohort is
      // provisioned with one, and the self-serve path from nothing is not
      // written in any document (recorded).
      if (!subscription) throw new AdulisException('NOT_FOUND');

      const price = await sql<{
        price_minor: string;
        currency: string;
        prepay_quarterly_discount: string;
        prepay_annual_discount: string;
      }>`
        SELECT ps.price_minor::text AS price_minor, ps.currency,
               ps.prepay_quarterly_discount::text AS prepay_quarterly_discount,
               ps.prepay_annual_discount::text AS prepay_annual_discount
          FROM billing.price_schedule ps
          JOIN core.seller s ON s.market_id = ps.market_id
         WHERE s.id = ${sellerId} AND ps.tier = ${body.tier}::billing.subscription_tier
           AND ps.effective @> now()`.execute(trx);
      const schedule = first(price.rows);
      // A tier with no scheduled price in this market cannot be bought —
      // fail closed, the ladder precedent.
      if (!schedule) throw new AdulisException('NOT_FOUND');

      const months = body.term === 'ANNUAL' ? 12 : body.term === 'QUARTERLY' ? 3 : 1;
      const discount =
        body.term === 'ANNUAL'
          ? Number(schedule.prepay_annual_discount)
          : body.term === 'QUARTERLY'
            ? Number(schedule.prepay_quarterly_discount)
            : 0;
      const amountMinor = Math.round(
        Number(schedule.price_minor) * months * (1 - discount),
      );

      const id = randomUUID();
      await sql`
        INSERT INTO billing.collection_record
          (id, subscription_id, amount_minor, currency, provider_kind)
        VALUES (${id}, ${subscription.id}, ${amountMinor}, ${schedule.currency},
                'BANK_TRANSFER')`.execute(trx);
      return {
        collection_record_id: id,
        amount_minor: amountMinor,
        currency: schedule.currency,
        reference: `ADU-SUB-${id.slice(0, 8).toUpperCase()}`,
        tier: body.tier,
        term: body.term,
      };
    });
  }

  @Post('billing/mark-transferred')
  @HttpCode(200)
  @ApiOperation({ summary: "The seller's own assertion; reconciliation is operator work." })
  async markTransferred(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = markTransferredBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 200, async (trx) => {
      const { sellerId } = await this.assertPermission(trx, req);
      const r = await sql<{ marked_transferred_at: Date }>`
        UPDATE billing.collection_record cr
           SET marked_transferred_at = coalesce(cr.marked_transferred_at, now())
          FROM billing.subscription s
         WHERE cr.id = ${body.collection_record_id}
           AND s.id = cr.subscription_id AND s.seller_id = ${sellerId}
         RETURNING cr.marked_transferred_at`.execute(trx);
      const row = first(r.rows);
      if (!row) throw new AdulisException('NOT_FOUND');
      return { marked_transferred_at: row.marked_transferred_at };
    });
  }
}
