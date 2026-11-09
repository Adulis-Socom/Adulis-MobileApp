import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import {
  ApiDefaultResponse,
  ApiExtraModels,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/auth/auth.guard';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import { PROBLEM_RESPONSE, ProblemDto } from '../../common/errors/problem.dto';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { FypPageDto } from './fyp.dto';
import { FypService } from './fyp.service';

/**
 * The Buyer Home For You feed (ADU-REC-01 v3.2 S12; WO-DISC-002). Public:
 * guests browse by registered device, a bearer browses as its Account.
 */
@Controller()
@ApiExtraModels(ProblemDto)
export class FypController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly svc: FypService,
  ) {}

  @Get('fyp')
  @Public()
  @ApiOperation({
    summary:
      'For You: Scene units only, ranked by the active algorithm version. Without ?cursor= a new feed session starts; with it the session continues. ' +
      'A bad cursor is 400 VALIDATION_FAILED with slots.reason CURSOR_INVALID; an ended session (expired, version retired, Market changed) slots.reason CURSOR_EXPIRED: start a new session.',
  })
  @ApiHeader({
    name: 'X-Adulis-Device',
    required: false,
    description:
      'App guests: the registered device id (required without a bearer). Browsers are identified by cookie instead.',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'The next_cursor of the previous page, unchanged.',
    schema: { type: 'string', maxLength: 128 },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Units per page; clamped to the algorithm version bound.',
    schema: { type: 'integer', minimum: 1, maximum: 24 },
  })
  @ApiOkResponse({ type: FypPageDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async feed(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<FypPageDto> {
    // Scene data bypasses shared caches: eligibility is decided per delivery.
    res.setHeader('Cache-Control', 'no-store');
    return this.tx.run(req, (trx) => this.svc.feed(trx, req, cursor, limit));
  }
}
