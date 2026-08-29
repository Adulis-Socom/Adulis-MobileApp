import { Controller, Delete, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { sql } from 'kysely';
import { z } from 'zod';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { AdulisException } from '../../common/errors/adulis-exception';

/**
 * C6 — ownership transfer (ADU-API-01 v1.7 section 12.12, G1.6), with
 * AMENDMENT A1 to ADU-RUL-01.
 *
 * "It had an endpoint, a permission and a function, and no rules;
 * ADU-RUL-01 supplies them." It also, until now, had no endpoint, no
 * function and no table — only the permission (`seller.ownership:transfer`,
 * OWNER-only, `requires_step_up`) and the `OWNERSHIP_TRANSFER` step-up
 * action, both waiting since migration 06.
 *
 * Three routes and one shape: every one of them calls a named function and
 * does nothing else of consequence. The rules — who may receive, the 24-hour
 * delay, the blocking conditions, the four-part activation — are all in
 * migration 0034, because an invariant enforced in a NestJS service is an
 * invariant a second endpoint can bypass.
 *
 * WHY DELETE HAS NO PERMISSION CHECK, AND THAT IS THE POINT.
 * `seller.ownership:transfer` is granted to OWNER alone. The RECIPIENT is an
 * Admin, and T6-B S1.2 rules that either party may cancel — the recipient's
 * cancel is a DECLINE, because "a person who is notified of something they
 * cannot refuse has been informed, not consulted." Widening the matrix so an
 * Admin could pass the gate would hand every Admin the power to START a
 * transfer, which is the one power Admin is defined not to have. So the gate
 * is `fn_cancel_ownership_transfer`'s own derivation: you may cancel a
 * transfer you are a party to, and a non-party gets U0002 — a 404 — because
 * a stranger must not learn a transfer exists (S19/S21). Same shape as
 * G1.1's identity-verification endpoint, for the same reason.
 */

const requestBody = z.object({
  /**
   * The RECIPIENT'S MEMBERSHIP, not their account. "Not an arbitrary phone
   * number -- the recipient must already be known to the store", and a
   * membership id is the only identifier that cannot name a stranger. It is
   * also what the console holds: GET /v1/seller/team returns
   * seller_team_member.id and no account ids.
   */
  to_member_id: z.uuid(),
  /**
   * A1.2 -- the outgoing owner keeps NOTHING by default. They may nominate a
   * residual role here, from any role EXCEPT ADMIN, which is "excluded for
   * exactly one reason: it holds payout". OWNER is unrepresentable twice
   * over: not in this enum, and forbidden by team_member_is_never_owner.
   */
  residual_role: z
    .enum(['SALES_SUPPORT', 'INVENTORY', 'ANALYST', 'CAMPAIGN_MANAGER'])
    .optional(),
  step_up_challenge_id: z.uuid(),
});

const cancelBody = z.object({ reason: z.string().max(200).optional() }).optional();

@Controller()
export class OwnershipController {
  constructor(private readonly tx: HandlerTransaction) {}

  /**
   * GET /v1/seller/ownership-transfer — the pending transfer, to whichever
   * party is asking. Anyone else gets `{ transfer: null }`: the same answer
   * as "there is none", because the two must not be distinguishable.
   */
  @Get('seller/ownership-transfer')
  @ApiOperation({ summary: 'The pending transfer, visible to its two parties only.' })
  async pending(@Req() req: AuthedRequest): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      const accountId = req.ctx?.accountId as string;
      const r = await sql<Record<string, unknown>>`
        SELECT t.id, t.from_account_id = ${accountId} AS i_am_the_owner,
               t.residual_role, t.requested_at, t.activates_at
          FROM core.seller_ownership_transfer t
         WHERE t.seller_id = ${req.ctx?.sellerId}
           AND t.activated_at IS NULL AND t.cancelled_at IS NULL
           AND ${accountId} IN (t.from_account_id, t.to_account_id)`.execute(trx);
      return { transfer: r.rows[0] ?? null };
    });
  }

  @Post('seller/ownership-transfer')
  @ApiOperation({
    summary: 'Owner only, step-up OWNERSHIP_TRANSFER. Activates after 24 hours.',
  })
  async request(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = requestBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 201, async (trx) => {
      const r = await sql<{ transfer_id: string; activates_at: Date }>`
        SELECT * FROM core.fn_request_ownership_transfer(
          ${req.ctx?.sellerId}, ${req.ctx?.accountId},
          ${(req.ctx?.audience as string) ?? ''}::core.session_audience,
          ${body.to_member_id},
          ${body.residual_role ?? null}::core.team_role,
          ${body.step_up_challenge_id})`.execute(trx);
      const row = r.rows[0];
      if (!row) throw new AdulisException('INTERNAL');
      return {
        transfer_id: row.transfer_id,
        activates_at: row.activates_at,
        residual_role: body.residual_role ?? null,
      };
    });
  }

  /** DELETE — the outgoing owner cancels; the recipient DECLINES. Same row. */
  @Delete('seller/ownership-transfer')
  @HttpCode(204)
  @ApiOperation({ summary: 'Either party ends it: the owner cancels, the recipient declines.' })
  async cancel(@Req() req: AuthedRequest): Promise<void> {
    const body = cancelBody.parse(req.body);
    await this.tx.run(req as LocalizedRequest, async (trx) => {
      await sql`
        SELECT core.fn_cancel_ownership_transfer(
          ${req.ctx?.sellerId}, ${req.ctx?.accountId},
          ${body?.reason ?? null})`.execute(trx);
    });
  }
}
