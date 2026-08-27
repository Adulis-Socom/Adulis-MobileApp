import { Controller, Delete, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { AdulisException } from '../../common/errors/adulis-exception';
import { FinancialService } from './financial.service';
import { evidenceBody, payoutChangeBody, reissueBody } from './financial.schemas';

/** C4 — payment instructions, evidence, payout (ADU-API-01 §12.5, §12.11). */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assertUuid = (v: string, path: string): void => {
  if (!UUID_RE.test(v)) {
    throw new AdulisException('VALIDATION_FAILED', { slots: { path } });
  }
};

@Controller()
export class FinancialController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly svc: FinancialService,
  ) {}

  @Get('orders/:id/payment-instructions')
  @ApiOperation({
    summary: 'The C3 disclosure path: one function call, decrypted here, never cached.',
  })
  async paymentInstructions(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    // This response must never enter a shared cache (§12.5).
    res.setHeader('Cache-Control', 'private, no-store');
    return this.svc.paymentInstructions(req, id);
  }

  @Post('orders/:id/payment-evidence')
  @ApiOperation({ summary: 'Upload via signed URL, then commit — R18 frames at rest.' })
  async evidence(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = evidenceBody.parse(req.body);
    return this.tx.runIdempotent(req, res, body.action === 'COMMIT' ? 201 : 200, (trx) =>
      body.action === 'COMMIT'
        ? this.svc.commitEvidence(trx, req, id, body.key)
        : this.svc.requestEvidenceUpload(trx, req, id),
    );
  }

  @Get('seller/orders/:id/payment-evidence')
  @ApiOperation({
    summary: 'Logged access, derived role, streamed with constant memory, never cached.',
  })
  async sellerEvidence(
    @Req() req: LocalizedRequest,
    @Res() res: Response,
    @Param('id') id: string,
  ): Promise<void> {
    assertUuid(id, 'id');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'application/octet-stream');
    await this.svc.streamEvidence(req, id, (chunk) => res.write(chunk));
    res.end();
  }

  @Get('seller/payout')
  async getPayout(@Req() req: LocalizedRequest): Promise<unknown> {
    return this.tx.run(req, (trx) => this.svc.getPayout(trx, req));
  }

  @Post('seller/payout')
  @ApiOperation({ summary: 'Enters PENDING; activates after the delay. Step-up in the body.' })
  async requestPayoutChange(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = payoutChangeBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) =>
      this.svc.requestPayoutChange(trx, req, body),
    );
  }

  @Delete('seller/payout/pending')
  @HttpCode(204)
  @ApiOperation({ summary: 'No step-up — reverting is easier than changing.' })
  async cancelPayoutChange(@Req() req: LocalizedRequest): Promise<void> {
    await this.tx.run(req, (trx) => this.svc.cancelPayoutChange(trx, req));
  }

  @Get('seller/payout/history')
  async payoutHistory(@Req() req: LocalizedRequest): Promise<unknown> {
    return this.tx.run(req, (trx) => this.svc.payoutHistory(trx, req));
  }

  @Post('seller/orders/:id/reissue-instructions')
  @ApiOperation({ summary: 'Single order only. No bulk endpoint exists (S8.5).' })
  async reissue(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = reissueBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) =>
      this.svc.reissueInstructions(trx, req, id, body.step_up_challenge_id),
    );
  }
}
