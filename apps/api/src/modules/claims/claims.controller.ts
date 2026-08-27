import { Controller, Get, HttpCode, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { AdulisException } from '../../common/errors/adulis-exception';
import { ClaimsService } from './claims.service';

/** C7 — claims (ADU-API-01 v1.6 section 12.4; X15). */

const openBody = z.object({
  order_id: z.uuid(),
  reservation_id: z.uuid().optional(),
  trigger: z.enum([
    'SLA_BREACH',
    'STOCK_NOT_UPDATED',
    'GOODS_NOT_RECEIVED',
    'NOT_AS_DESCRIBED',
    'REFUND_NOT_DELIVERED',
  ]),
});

const evidenceBody = z.object({
  kind: z.literal('BANK_RECORD'),
  reference_id: z.uuid(),
});

const remedyBody = z.object({ remedy: z.enum(['REFUND', 'FULFIL']) });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assertUuid = (v: string, path: string): void => {
  if (!UUID_RE.test(v)) {
    throw new AdulisException('VALIDATION_FAILED', { slots: { path } });
  }
};

@Controller()
export class ClaimsController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly svc: ClaimsService,
  ) {}

  @Post('claims')
  @ApiOperation({ summary: 'Buyer opens; the evidence bundle attaches by trigger at open.' })
  async open(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = openBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 201, (trx) =>
      this.svc.openClaim(trx, req, body),
    );
  }

  @Get('claims')
  async listBuyer(@Req() req: AuthedRequest, @Query('cursor') cursor?: string): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, (trx) =>
      this.svc.listBuyer(trx, req, cursor),
    );
  }

  @Get('seller/claims')
  @ApiOperation({ summary: 'Seller-scoped; GET /v1/claims is buyer-shaped.' })
  async listSeller(@Req() req: AuthedRequest, @Query('cursor') cursor?: string): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, (trx) =>
      this.svc.listSeller(trx, req, cursor),
    );
  }

  @Get('claims/:id')
  async read(@Req() req: AuthedRequest, @Param('id') id: string): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.run(req as LocalizedRequest, (trx) => this.svc.read(trx, req, id));
  }

  @Post('claims/:id/evidence')
  @ApiOperation({ summary: 'The bank record: a single transaction, not a statement (X15).' })
  async evidence(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = evidenceBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 201, (trx) =>
      this.svc.attachEvidence(trx, req, id, body.reference_id),
    );
  }

  @Post('claims/:id/evidence-export')
  @HttpCode(200)
  @ApiOperation({ summary: "The buyer's own transaction; nothing about who the seller is (X15)." })
  async export(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.runIdempotent(req as LocalizedRequest, res, 200, (trx) =>
      this.svc.evidenceExport(trx, req, id),
    );
  }

  @Post('seller/claims/:id/remedy')
  @HttpCode(200)
  @ApiOperation({ summary: "REFUND or FULFIL — the seller's choice (X15)." })
  async remedy(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = remedyBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 200, (trx) =>
      this.svc.remedy(trx, req, id, body.remedy),
    );
  }
}
