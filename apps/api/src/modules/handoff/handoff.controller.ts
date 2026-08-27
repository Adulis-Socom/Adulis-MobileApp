import { Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import { ActorRole } from '../../common/auth/auth.guard';
import { IdempotencyService, hashRequest } from '../../common/idempotency/idempotency';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { AdulisException } from '../../common/errors/adulis-exception';
import { HandoffService } from './handoff.service';
import { handoffSyncBody } from './handoff.schemas';

/** C5 — handoff and courier (ADU-API-01 §12.6, §12.17). */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assertUuid = (v: string, path: string): void => {
  if (!UUID_RE.test(v)) {
    throw new AdulisException('VALIDATION_FAILED', { slots: { path } });
  }
};

const courierAssignmentBody = z.object({ courier_account_id: z.uuid() });
const custodyTransferBody = z.object({ courier_account_id: z.uuid() });

@Controller()
export class HandoffController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly idempotency: IdempotencyService,
    private readonly svc: HandoffService,
  ) {}

  /**
   * The batch sync CANNOT ride runIdempotent: each item settles in its OWN
   * transaction (a rollback on item three must not take items one and two
   * with it — 12.6.1), so the whole-batch idempotency record is read
   * before and written after, and a crash mid-batch simply reprocesses:
   * the per-nonce replay semantics make that safe, which is why they
   * exist.
   */
  @Post('handoffs/sync')
  @HttpCode(200)
  @ApiOperation({ summary: 'Batch, per-item outcomes, never fails as a unit. 200 whenever well-formed.' })
  async sync(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = handoffSyncBody.parse(req.body);
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key === '') {
      throw new AdulisException('IDEMPOTENCY_KEY_MISSING');
    }
    const actor = { kind: 'ACCOUNT' as const, id: req.ctx?.accountId ?? '' };
    if (!actor.id) throw new AdulisException('SESSION_EXPIRED');
    const endpoint = `${req.method} ${req.path}`;
    const requestHash = hashRequest(req.method, req.path, req.body);

    const replay = await this.idempotency.check(key, actor, endpoint, requestHash);
    if (replay) {
      res.setHeader('X-Adulis-Idempotent-Replay', 'true');
      return replay.body;
    }

    const result = await this.svc.sync(req, body.scans);

    await this.tx.run(req, (trx) =>
      this.idempotency.record(trx, key, actor, endpoint, requestHash, {
        status: 200,
        body: result,
      }),
    );
    return result;
  }

  @Get('seller/orders/:id/qr')
  @ApiOperation({ summary: '409 ORDER_NOT_READYABLE before PAYMENT_CONFIRMED (R20).' })
  async qr(@Req() req: LocalizedRequest, @Param('id') id: string): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.run(req, (trx) => this.svc.getQr(trx, req, id));
  }

  @Post('seller/orders/:id/custody-transfer')
  @ApiOperation({ summary: 'Event A, seller side. Never completes an order.' })
  async custodyTransfer(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = custodyTransferBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 200, (trx) =>
      this.svc.custodyTransfer(trx, req, id, body.courier_account_id),
    );
  }

  @Post('seller/orders/:id/courier-assignment')
  async assignCourier(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = courierAssignmentBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) =>
      this.svc.assignCourier(trx, req, id, body.courier_account_id),
    );
  }

  @Get('courier/orders')
  @ActorRole('COURIER')
  @ApiOperation({ summary: 'Currently assigned orders only — by row-level security.' })
  async courierOrders(@Req() req: LocalizedRequest): Promise<unknown> {
    return this.tx.run(req, (trx) => this.svc.courierOrders(trx, req));
  }

  @Get('courier/orders/:id')
  @ActorRole('COURIER')
  @ApiOperation({ summary: 'The QR is present only once custody has been accepted (R25).' })
  async courierOrder(@Req() req: LocalizedRequest, @Param('id') id: string): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.run(req, (trx) => this.svc.courierOrder(trx, req, id));
  }

  @Post('courier/orders/:id/custody-accept')
  @ActorRole('COURIER')
  @ApiOperation({ summary: 'Event A, courier side.' })
  async custodyAccept(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.runIdempotent(req, res, 200, (trx) =>
      this.svc.custodyAccept(trx, req, id),
    );
  }
}
