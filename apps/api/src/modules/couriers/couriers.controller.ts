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
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { phone } from '../auth/auth.schemas';

/**
 * C6 — seller couriers (ADU-API-01 v1.7 section 12.11): invite by phone,
 * the courier authenticates with their own OTP, and revocation ends
 * assignment-scoped access immediately — the RLS policy reads live
 * assignments, and this endpoint ends them in the same transaction as the
 * revocation, so there is no window in which a revoked courier still sees
 * an order.
 *
 * G1.8 — THE INVITE NO LONGER BRANCHES ON WHETHER THE PHONE HAS AN ACCOUNT.
 *
 * It used to look the number up and raise NOT_FOUND when it found nothing,
 * which made every seller account a registration oracle: anyone could test
 * arbitrary phone numbers for Adulis membership, one invite at a time.
 * ADU-AUTH-01 v2.5 S19 generalises the rule — no response distinguishes an
 * identity that exists from one that does not.
 *
 * "Byte-identical bodies" is necessary and NOT sufficient, and the shape
 * below is chosen for the rest of it:
 *
 *  - **The same statements run either way.** The claim is an
 *    INSERT ... SELECT that inserts one row or none, and the stamp is an
 *    UPDATE ... FROM that touches one row or none. Neither branch takes a
 *    round trip the other does not, so there is no gratuitous timing
 *    channel — only the cost of one heap insert.
 *  - **Both branches COMMIT**, so both write an idempotency record. The old
 *    404 path rolled back and wrote none, which let a caller distinguish
 *    the two with a second request carrying the same key, whatever the
 *    first body said.
 *  - **The duplicate-invite 409 is gone.** Re-inviting used to hit
 *    seller_courier_live and surface as VALIDATION_FAILED with the
 *    constraint name in slots — a third distinguishable outcome, and a leak
 *    of an internal name. The upsert absorbs it.
 *
 * THE INVITE IS NOW THE PRIMARY RECORD, and its id is what this endpoint
 * returns and what DELETE takes. One id namespace, not two: a seller's
 * mental model is "I invited this phone, and I revoke that invite", and
 * whether the invite has been claimed is not something the caller should
 * infer from the shape of an identifier.
 *
 * T6-B S2 -- AND THE ORACLE IS RATE-LIMITED, because closing it on shape
 * alone still leaves it open on volume. A seller who cannot tell one number
 * from another in a single response can still walk a range and read the
 * answer off `claimed_at` in the list, ten thousand numbers a night. Ten
 * invites per hour per seller makes that cost real without touching a
 * legitimate seller, who invites a courier now and then.
 *
 * INVARIANT -- AN INVITE TO A NUMBER WITH NO ACCOUNT SENDS NOTHING. No SMS,
 * no message of any kind. An invitation SMS would hand the oracle back
 * immediately: the sender learns nothing from the response, and the OWNER OF
 * THE NUMBER learns that somebody typed it into Adulis. It would also make
 * the endpoint a free SMS cannon aimed at any number in the country. The
 * courier learns they were invited when they next open the app, because the
 * claim happens at their own sign-in. Asserted in
 * apps/api/test/t6-courier-invite-oracle.spec.ts -- exactly the thing a
 * later well-meaning change breaks.
 */

const inviteBody = z.object({ phone });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const first = <T>(rows: readonly T[]): T | undefined => rows[0];

@Controller()
export class CouriersController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly rateLimit: RateLimitService,
  ) {}

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
      // Invites, pending and claimed alike. The seller typed the number, so
      // returning it discloses nothing they did not supply — and a pending
      // invite has to be visible, or the seller cannot tell an invitation
      // that is waiting from a number they mistyped.
      const r = await sql<Record<string, unknown>>`
        SELECT i.id, i.phone, i.invited_at, i.claimed_at
          FROM core.seller_courier_invite i
         WHERE i.seller_id = ${sellerId} AND i.revoked_at IS NULL
         ORDER BY i.invited_at`.execute(trx);
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
      const { accountId, sellerId } = await this.assertPermission(trx, req);

      // T6-B S2 -- ten per hour, per SELLER, not per account: an oracle run
      // from three Admin sessions on one store is one oracle. Inside the
      // closure so an idempotent replay burns no budget (the otp-request
      // precedent), and RateLimitService writes on its own connection, so
      // the count survives a rolled-back handler and cannot be reset by
      // failing on purpose.
      //
      // subject_kind = 'ACCOUNT' CARRYING A SELLER ID, and that is a seam
      // rather than a mistake: core.rate_limit_subject_kind has no SELLER
      // value, and Appendix C check 16 compares the enum against ADU-DB-01
      // Appendix A in both directions, so adding one is a document
      // amendment, not a migration. The primary key is
      // (subject_kind, subject_id, bucket_key, window_start), so a distinct
      // bucket_key makes a collision with a real account bucket impossible.
      // Registered (D-72): Appendix A owes a SELLER value.
      await this.rateLimit.consume('ACCOUNT', sellerId, {
        bucketKey: 'seller-courier-invite',
        windowSeconds: 3600,
        max: 10,
      });

      // 1. The invite, always. ON CONFLICT also revives a revoked invite,
      //    which is the only way to re-invite a phone at all: S6.3a's
      //    UNIQUE is TOTAL where the neighbouring seller_courier's is
      //    partial on revoked_at, so the row never leaves (register D-67).
      const invite = await sql<{ id: string }>`
        INSERT INTO core.seller_courier_invite
          (id, seller_id, phone, invited_by_account_id)
        VALUES (${randomUUID()}, ${sellerId}, ${body.phone}, ${accountId})
        ON CONFLICT (seller_id, phone) DO UPDATE
          SET invited_at = now(),
              invited_by_account_id = EXCLUDED.invited_by_account_id,
              revoked_at = NULL
        RETURNING id`.execute(trx);
      const id = (first(invite.rows) as { id: string }).id;

      // 2. Claim it now if that phone is already someone. INSERT ... SELECT
      //    inserts ONE row or NONE — the branch is inside the statement, so
      //    both cases cost the same round trip.
      await sql`
        INSERT INTO core.seller_courier (id, seller_id, account_id)
        SELECT gen_random_uuid(), ${sellerId}, a.id
          FROM core.account a
         WHERE a.phone_e164 = ${body.phone} AND a.status = 'ACTIVE'
        ON CONFLICT (seller_id, account_id) WHERE revoked_at IS NULL
        DO NOTHING`.execute(trx);

      // 3. And stamp the invite, again in one statement whichever way it
      //    goes. An unclaimed invite surfaces when that person signs in.
      await sql`
        UPDATE core.seller_courier_invite i
           SET claimed_at = now(), claimed_by_account_id = a.id
          FROM core.account a
         WHERE i.id = ${id} AND i.claimed_at IS NULL
           AND a.phone_e164 = i.phone AND a.status = 'ACTIVE'`.execute(trx);

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
      // The id is the INVITE's, which is what POST returned. One namespace.
      const revoked = await sql<{ phone: string }>`
        UPDATE core.seller_courier_invite SET revoked_at = now()
         WHERE id = ${id} AND seller_id = ${sellerId} AND revoked_at IS NULL
         RETURNING phone`.execute(trx);
      const row = first(revoked.rows);
      if (!row) throw new AdulisException('NOT_FOUND');
      // Whatever the invite produced goes with it. A pending invite has no
      // courier row, and then this updates nothing — the same statement.
      const ended = await sql<{ account_id: string }>`
        UPDATE core.seller_courier sc SET revoked_at = now()
          FROM core.account a
         WHERE a.phone_e164 = ${row.phone} AND sc.account_id = a.id
           AND sc.seller_id = ${sellerId} AND sc.revoked_at IS NULL
        RETURNING sc.account_id`.execute(trx);
      // Same transaction: no live assignment survives the revocation.
      const accounts = ended.rows.map((r) => r.account_id);
      if (accounts.length > 0) {
        await sql`
          UPDATE core.order_courier_assignment a SET ended_at = now()
            FROM core."order" o
           WHERE o.id = a.order_id AND o.seller_id = ${sellerId}
             AND a.courier_account_id = ANY(${sql.val(accounts)}::uuid[])
             AND a.ended_at IS NULL`.execute(trx);
      }
    });
  }
}
