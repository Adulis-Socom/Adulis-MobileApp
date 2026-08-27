import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
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
import { phone } from '../auth/auth.schemas';

/**
 * C6 — seller couriers (ADU-API-01 v1.6 section 12.11): invite by phone,
 * the courier authenticates with their own OTP, and revocation ends
 * assignment-scoped access immediately — the RLS policy reads live
 * assignments, and this endpoint ends them in the same transaction as the
 * revocation, so there is no window in which a revoked courier still sees
 * an order.
 */

const inviteBody = z.object({ phone });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const first = <T>(rows: readonly T[]): T | undefined => rows[0];

@Controller()
export class CouriersController {
  constructor(private readonly tx: HandlerTransaction) {}

  private async assertPermission(
    trx: Transaction<Database>,
    req: AuthedRequest,
  ): Promise<{ accountId: string; sellerId: string }> {
    const accountId = req.ctx?.accountId as string;
    const sellerId = req.ctx?.sellerId as string;
    await sql`
      SELECT core.fn_has_permission(${accountId}, ${sellerId},
        'seller.couriers:manage',
        ${(req.ctx?.audience as string) ?? ''}::core.session_audience)`.execute(trx);
    return { accountId, sellerId };
  }

  @Get('seller/couriers')
  async list(@Req() req: AuthedRequest): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      const { sellerId } = await this.assertPermission(trx, req);
      const r = await sql<Record<string, unknown>>`
        SELECT sc.id, sc.invited_at, a.phone_e164 AS phone
          FROM core.seller_courier sc
          JOIN core.account a ON a.id = sc.account_id
         WHERE sc.seller_id = ${sellerId} AND sc.revoked_at IS NULL
         ORDER BY sc.invited_at`.execute(trx);
      return { data: r.rows };
    });
  }

  @Post('seller/couriers')
  @ApiOperation({ summary: 'Invite by phone; the courier signs in with their own OTP.' })
  async invite(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = inviteBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 201, async (trx) => {
      const { sellerId } = await this.assertPermission(trx, req);
      const invitee = await sql<{ id: string }>`
        SELECT id FROM core.account
         WHERE phone_e164 = ${body.phone} AND status = 'ACTIVE'`.execute(trx);
      const account = first(invitee.rows);
      if (!account) throw new AdulisException('NOT_FOUND');
      const id = randomUUID();
      await sql`
        INSERT INTO core.seller_courier (id, seller_id, account_id)
        VALUES (${id}, ${sellerId}, ${account.id})`.execute(trx);
      return { id };
    });
  }

  @Delete('seller/couriers/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoking ends assignment-scoped access immediately.' })
  async revoke(@Req() req: AuthedRequest, @Param('id') id: string): Promise<void> {
    if (!UUID_RE.test(id)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'id' } });
    }
    await this.tx.run(req as LocalizedRequest, async (trx) => {
      const { sellerId } = await this.assertPermission(trx, req);
      const revoked = await sql<{ account_id: string }>`
        UPDATE core.seller_courier SET revoked_at = now()
         WHERE id = ${id} AND seller_id = ${sellerId} AND revoked_at IS NULL
         RETURNING account_id`.execute(trx);
      const row = first(revoked.rows);
      if (!row) throw new AdulisException('NOT_FOUND');
      // Same transaction: no live assignment survives the revocation.
      await sql`
        UPDATE core.order_courier_assignment a SET ended_at = now()
          FROM core."order" o
         WHERE o.id = a.order_id AND o.seller_id = ${sellerId}
           AND a.courier_account_id = ${row.account_id}
           AND a.ended_at IS NULL`.execute(trx);
    });
  }
}
