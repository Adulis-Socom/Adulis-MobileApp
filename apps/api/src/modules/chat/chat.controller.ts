import { Controller, Get, HttpCode, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { AdulisException } from '../../common/errors/adulis-exception';
import { ChatService } from './chat.service';

/** C7 — chat (ADU-API-01 v1.7 section 12.7). */

/**
 * D-66 via T7 S3.1 -- THE ANCHOR MOVED TO THE MESSAGE. Opening a
 * conversation is back to the pre-G1.10 shape: a thread is a relationship,
 * and what a QUESTION is about rides the send path, per message. The wire
 * cardinality there is AT MOST ONE (never both), matching the database's
 * message_one_anchor CHECK; an anchorless message stays legal because a
 * follow-up ("thanks!") is about nothing, and the assistant honestly
 * escalates where it cannot resolve.
 */
const openBody = z.object({ seller_id: z.uuid() });

const messageBody = z
  .object({
    text: z.string().min(1).max(4000).optional(),
    chip_id: z.uuid().optional(),
    product_id: z.uuid().optional(),
    order_id: z.uuid().optional(),
  })
  .refine((b) => (b.text === undefined) !== (b.chip_id === undefined), {
    message: 'exactly one of text or chip_id',
  })
  .refine((b) => b.product_id === undefined || b.order_id === undefined, {
    message: 'at most one of product_id or order_id',
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assertUuid = (v: string, path: string): void => {
  if (!UUID_RE.test(v)) {
    throw new AdulisException('VALIDATION_FAILED', { slots: { path } });
  }
};

@Controller()
export class ChatController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly svc: ChatService,
  ) {}

  /** 12.7; anchorless again since D-66 (T7). Idempotent by the pair's UNIQUE. */
  @Post('conversations')
  @ApiOperation({
    summary: 'Create-or-return the one conversation per buyer-seller pair.',
  })
  async open(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = openBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 201, (trx) =>
      this.svc.openConversation(trx, req, body.seller_id),
    );
  }

  @Get('conversations')
  @ApiOperation({ summary: '?as=buyer or ?as=seller&seller_id= is REQUIRED — R10, no default.' })
  async list(
    @Req() req: AuthedRequest,
    @Query('as') scope?: string,
    @Query('seller_id') sellerId?: string,
    @Query('cursor') cursor?: string,
  ): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, (trx) =>
      this.svc.list(trx, req, scope, sellerId, cursor),
    );
  }

  @Get('conversations/:id/messages')
  async messages(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.run(req as LocalizedRequest, (trx) =>
      this.svc.messages(trx, req, id, cursor),
    );
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'text or chip_id, optionally anchored on product_id or order_id; the bot replies with template_key and slots, never prose.' })
  async postMessage(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = messageBody.parse(req.body);
    const locale = (req as LocalizedRequest).locale ?? 'en';
    return this.tx.runIdempotent(req as LocalizedRequest, res, 201, (trx) =>
      this.svc.postMessage(trx, req, id, body, locale),
    );
  }

  @Post('conversations/:id/escalate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Free escalation — S15.1 layer 5 on request.' })
  async escalate(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.runIdempotent(req as LocalizedRequest, res, 200, (trx) =>
      this.svc.escalate(trx, req, id),
    );
  }
}
