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
 * C6 — billing (ADU-API-01 v1.7 section 12.12, R4).
 *
 * The whole group is CONSOLE-only, and that is enforced BELOW the
 * endpoint: seller.subscription:update carries surfaces = {CONSOLE} in
 * core.permission, so a MOBILE session gets fn_has_permission's U0001 —
 * 403, never a redirect, because a redirect is itself a link to an
 * external purchase mechanism and the exact thing an App Store reviewer
 * is looking for.
 *
 * G1.7 — THE INTENT IS A ROW NOW, AND THIS FILE STOPPED DECIDING THINGS.
 *
 * v1.6's version computed the price in JavaScript, inserted a
 * billing.collection_record directly, and returned. Three consequences,
 * all of which the ruling names:
 *
 *   - every call with a fresh Idempotency-Key opened ANOTHER record, all
 *     indistinguishable, all owed money against;
 *   - no path ever wrote reconciled_at, so subscription.collect_reminder
 *     matched forever and SMSed every seven days in perpetuity;
 *   - the "intent" existed only in the URL, so nothing carried the tier,
 *     the term, the quoted rate or a clock.
 *
 * All of that now lives in billing.fn_open_purchase_intent and
 * billing.fn_reconcile_purchase. This controller parses, calls one named
 * function, and shapes the envelope.
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

      // The LIVE intent, if there is one. A seller who opened a quote and
      // closed the tab has no other way to find out what they were asked to
      // transfer, and inventing a second intent to find out is exactly the
      // duplicate the one-open index now forbids. Expiry is read here, not
      // swept: a row past its 24 hours is simply not live.
      const i = await sql<Record<string, unknown>>`
        SELECT pi.id AS intent_id, pi.collection_record_id, pi.tier, pi.term,
               pi.amount_minor, pi.currency, pi.expires_at,
               cr.marked_transferred_at
          FROM billing.purchase_intent pi
          JOIN billing.subscription s ON s.id = pi.subscription_id
          JOIN billing.collection_record cr ON cr.id = pi.collection_record_id
         WHERE s.seller_id = ${sellerId}
           AND pi.reconciled_at IS NULL AND pi.cancelled_at IS NULL
           AND pi.expires_at > now()`.execute(trx);

      // A7 (ADU-API-01 v1.9 S1 item 12 / D-225): the POST minted a transfer
      // `reference` and the GET dropped it, so a seller who closed the tab had
      // the collection id but not the string to write on the bank transfer --
      // the exact person this read exists for. Derived here identically to the
      // POST (billing/purchase-intent below), so the console renders it rather
      // than recomputing a business fact it must not own.
      const intentRow = first(i.rows);
      return {
        subscription: first(r.rows) ?? null,
        intent: intentRow
          ? {
              ...intentRow,
              reference: `ADU-SUB-${String(intentRow['collection_record_id'])
                .slice(0, 8)
                .toUpperCase()}`,
            }
          : null,
      };
    });
  }

  @Post('billing/purchase-intent')
  @ApiOperation({ summary: 'Opens a 24-hour intent at the locked rate; step-up SUBSCRIPTION_CHANGE.' })
  async purchaseIntent(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = purchaseIntentBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 201, async (trx) => {
      // NO assertPermission HERE, and that is not an omission. The named
      // function's first statement is fn_has_permission and its second is
      // fn_assert_step_up; calling them twice would make the endpoint the
      // place the rules live again, and a second call site is a second
      // place to forget one.
      const r = await sql<{
        intent_id: string;
        collection_record_id: string;
        amount_minor: string;
        currency: string;
        expires_at: Date;
        tier: string;
        term: string;
      }>`
        SELECT * FROM billing.fn_open_purchase_intent(
          ${req.ctx?.sellerId}, ${req.ctx?.accountId},
          ${(req.ctx?.audience as string) ?? ''}::core.session_audience,
          ${body.tier}::billing.subscription_tier,
          ${body.term}::billing.subscription_term,
          ${body.step_up_challenge_id})`.execute(trx);
      const row = first(r.rows);
      if (!row) throw new AdulisException('INTERNAL');

      return {
        intent_id: row.intent_id,
        collection_record_id: row.collection_record_id,
        amount_minor: Number(row.amount_minor),
        currency: row.currency,
        reference: `ADU-SUB-${row.collection_record_id.slice(0, 8).toUpperCase()}`,
        tier: row.tier,
        term: row.term,
        expires_at: row.expires_at,
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
      // THE STATE GUARD v1.6 DID NOT HAVE. The old UPDATE stamped any row
      // the seller owned, reconciled or not, and coalesce() returned 200 as
      // if nothing were odd — so a seller could assert a transfer against a
      // record an operator had already closed, and no surface said so.
      const r = await sql<{ marked_transferred_at: Date }>`
        UPDATE billing.collection_record cr
           SET marked_transferred_at = coalesce(cr.marked_transferred_at, now())
          FROM billing.subscription s
         WHERE cr.id = ${body.collection_record_id}
           AND s.id = cr.subscription_id AND s.seller_id = ${sellerId}
           AND cr.reconciled_at IS NULL AND cr.voided_at IS NULL
         RETURNING cr.marked_transferred_at`.execute(trx);
      const row = first(r.rows);
      if (row) return { marked_transferred_at: row.marked_transferred_at };

      // Zero rows is two different facts, and they earn different answers:
      // a record that is not this seller's must not be confirmed to exist
      // (404, S19); one that is theirs and closed is a conflict they can
      // act on.
      const own = await sql<{ id: string }>`
        SELECT cr.id FROM billing.collection_record cr
          JOIN billing.subscription s ON s.id = cr.subscription_id
         WHERE cr.id = ${body.collection_record_id}
           AND s.seller_id = ${sellerId}`.execute(trx);
      if (!first(own.rows)) throw new AdulisException('NOT_FOUND');
      throw new AdulisException('VALIDATION_FAILED', {
        status: 409,
        slots: { reason: 'COLLECTION_RECORD_CLOSED' },
      });
    });
  }
}
