import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import { IdempotencyService, hashRequest } from '../../common/idempotency/idempotency';
import { Public, type AuthedRequest } from '../../common/auth/auth.guard';
import { AdulisException } from '../../common/errors/adulis-exception';
import { RateLimitService, subjectHash } from '../../common/rate-limit/rate-limit.service';
import { resolveKey } from '../../common/crypto/aead';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { OtpService } from '../auth/otp.service';
import { SMS_ADAPTER, type SmsAdapter, type SmsMessage } from '../auth/sms.adapter';
import {
  deletionConfirmBody,
  deletionOtpRequestBody,
  deletionOtpVerifyBody,
} from '../auth/auth.schemas';
import { z } from 'zod';
import { DeletionService, type TicketAccount } from './deletion.service';

/**
 * C6 — account deletion from the web (12.18) and seller deletion/closure
 * (12.12).
 *
 * The web flow's credential is a TICKET, not a session (ADU-AUTH-01 S11):
 * `Authorization: Ticket <id>`, fifteen minutes, accepted by exactly the
 * endpoints in this controller and nothing else — a ticket any other
 * endpoint accepts is a session, whatever it is called. The OTP that mints
 * it can never mint a session (trigger, migration 03).
 */

const sellerDeletionBody = z.object({ step_up_challenge_id: z.uuid() });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const hashKey = (): string =>
  resolveKey(process.env['IDENTITY_HASH_KEY_V1'], 'RATE_LIMIT').toString('hex');

@Controller()
export class DeletionController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly idempotency: IdempotencyService,
    private readonly rateLimit: RateLimitService,
    private readonly otp: OtpService,
    private readonly svc: DeletionService,
    @Inject(SMS_ADAPTER) private readonly sms: SmsAdapter,
  ) {}

  /** The ticket carrier. Bearer is refused here: this is not a sign-in. */
  private ticketId(req: LocalizedRequest): string {
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Ticket ')) {
      throw new AdulisException('SESSION_EXPIRED');
    }
    const id = header.slice('Ticket '.length).trim();
    if (!UUID_RE.test(id)) throw new AdulisException('SESSION_EXPIRED');
    return id;
  }

  @Post('deletion/otp/request')
  @Public()
  @HttpCode(202)
  @ApiOperation({ summary: 'purpose ACCOUNT_DELETION; the SMS names the action (4.4).' })
  async otpRequest(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = deletionOtpRequestBody.parse(req.body);
    let toSend: SmsMessage | null = null;
    const result = await this.tx.runIdempotent(req, res, 202, async (trx) => {
      await this.rateLimit.consume('PHONE_HASH', subjectHash(body.phone, hashKey()), {
        bucketKey: 'deletion-otp-request',
        windowSeconds: 3600,
        max: 3,
      });
      const issued = await this.otp.issueChallenge(trx, {
        phone: body.phone,
        purpose: 'ACCOUNT_DELETION',
        templateKey: 'sms.otp.account_deletion',
      });
      toSend = issued.sms;
      return {};
    });
    if (toSend) await this.sms.send(toSend);
    return result;
  }

  /**
   * Returns a deletion ticket, not a session: no cookie is set, no bearer
   * is issued, and the response says what the ticket is for.
   */
  @Post('deletion/otp/verify')
  @Public()
  @HttpCode(200)
  async otpVerify(@Req() req: LocalizedRequest): Promise<unknown> {
    const body = deletionOtpVerifyBody.parse(req.body);
    return this.tx.run(req, async (trx) => {
      const challenge = await this.otp.verifyCode(trx, {
        phone: body.phone,
        purpose: 'ACCOUNT_DELETION',
        code: body.code,
      });
      return {
        ticket: challenge.id,
        expires_at: new Date(Date.now() + 15 * 60 * 1000),
        scope: 'ACCOUNT_DELETION',
      };
    });
  }

  @Get('deletion/preview')
  @Public()
  @ApiOperation({ summary: 'Blockers as items[] and what deletion does, before confirm.' })
  async preview(@Req() req: LocalizedRequest): Promise<unknown> {
    const ticket = this.ticketId(req);
    return this.tx.run(req, async (trx) => {
      const account = await this.svc.ticketAccount(trx, ticket);
      return this.svc.preview(trx, account);
    });
  }

  @Post('deletion/confirm')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Requires explicit acknowledgement; irreversible.' })
  async confirm(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    deletionConfirmBody.parse(req.body);
    const ticket = this.ticketId(req);
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key === '') {
      throw new AdulisException('IDEMPOTENCY_KEY_MISSING');
    }

    // Manual idempotency: the actor is the ticket's account, resolved
    // before the handler transaction — the web page holds no session and
    // registers no device.
    let account: TicketAccount | null = null;
    await this.tx.run(req, async (trx) => {
      account = await this.svc.ticketAccount(trx, ticket);
    });
    if (!account) throw new AdulisException('SESSION_EXPIRED');
    const resolved: TicketAccount = account;
    const actor = { kind: 'ACCOUNT' as const, id: resolved.accountId };
    const endpoint = `${req.method} ${req.path}`;
    const requestHash = hashRequest(req.method, req.path, req.body);

    const replay = await this.idempotency.check(key, actor, endpoint, requestHash);
    if (replay) {
      res.setHeader('X-Adulis-Idempotent-Replay', 'true');
      return replay.body;
    }

    let purge: (() => Promise<void>) | null = null;
    const result = await this.tx.run(req, async (trx) => {
      const outcome = await this.svc.confirmAccountDeletion(trx, resolved);
      purge = outcome.purge;
      const body = { deleted: true };
      await this.idempotency.record(trx, key, actor, endpoint, requestHash, {
        status: 200,
        body,
      });
      return body;
    });
    // After the core commit: the ciphertext purge on the financial
    // connection. The core rows are already PURGED, so nothing can read
    // what a crash here would leave behind (section 24 sweep, reported).
    if (purge !== null) await (purge as () => Promise<void>)();
    return result;
  }

  // ---- 12.12: the seller-scoped deletion group -------------------------

  @Get('seller/deletion/blockers')
  @ApiOperation({ summary: '200 with items[] — a state, not a failure (S16.9).' })
  async sellerBlockers(@Req() req: AuthedRequest): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, (trx) =>
      this.svc.sellerBlockers(trx, req),
    );
  }

  @Post('seller/deletion')
  @HttpCode(200)
  @ApiOperation({ summary: 'Owner only; step-up SELLER_DELETION; blockers give the 409 its items[].' })
  async deleteSeller(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = sellerDeletionBody.parse(req.body);
    let purge: (() => Promise<void>) | null = null;
    const result = await this.tx.runIdempotent(
      req as LocalizedRequest,
      res,
      200,
      async (trx) => {
        const outcome = await this.svc.deleteSeller(trx, req, body.step_up_challenge_id);
        purge = outcome.purge;
        return { deleted: true };
      },
    );
    if (purge !== null) await (purge as () => Promise<void>)();
    return result;
  }

  @Post('seller/closure')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enters CLOSING: new reservations stop, existing orders operable.' })
  async enterClosure(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    return this.tx.runIdempotent(req as LocalizedRequest, res, 200, (trx) =>
      this.svc.enterClosure(trx, req),
    );
  }

  @Delete('seller/closure')
  @HttpCode(204)
  @ApiOperation({ summary: 'Returns to ACTIVE. Reversible by design.' })
  async leaveClosure(@Req() req: AuthedRequest): Promise<void> {
    await this.tx.run(req as LocalizedRequest, (trx) => this.svc.leaveClosure(trx, req));
  }
}
