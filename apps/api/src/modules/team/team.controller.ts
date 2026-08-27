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
import { z } from 'zod';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { AdulisException } from '../../common/errors/adulis-exception';
import { phone } from '../auth/auth.schemas';
import { TeamService } from './team.service';

/** C6 — team (ADU-API-01 v1.6 section 12.12). Step-up TEAM_CHANGE on writes. */

const inviteBody = z.object({
  phone,
  // OWNER is unrepresentable: the CHECK forbids it below and the enum here.
  role: z.enum(['ADMIN', 'SALES_SUPPORT', 'INVENTORY', 'ANALYST', 'CAMPAIGN_MANAGER']),
  step_up_challenge_id: z.uuid(),
});

const revokeBody = z.object({ step_up_challenge_id: z.uuid() });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class TeamController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly svc: TeamService,
  ) {}

  @Get('seller/team')
  @ApiOperation({ summary: 'Business tier; Owner/Admin only (seller.staff:admin).' })
  async list(@Req() req: AuthedRequest): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, (trx) => this.svc.list(trx, req));
  }

  @Post('seller/team')
  @ApiOperation({ summary: 'Invite by phone; the member signs in with their own OTP.' })
  async invite(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = inviteBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 201, (trx) =>
      this.svc.invite(trx, req, body),
    );
  }

  @Delete('seller/team/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revokes on the next request (R28); the account is untouched.' })
  async revoke(@Req() req: AuthedRequest, @Param('id') id: string): Promise<void> {
    if (!UUID_RE.test(id)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'id' } });
    }
    const body = revokeBody.parse(req.body);
    await this.tx.run(req as LocalizedRequest, (trx) =>
      this.svc.revoke(trx, req, id, body.step_up_challenge_id),
    );
  }
}
