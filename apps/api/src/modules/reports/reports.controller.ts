import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { z } from 'zod';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';

/**
 * C8 — reports (ADU-API-01 v1.6 section 12.15; ADU-PRD-01 S18).
 *
 * Any surface, any authenticated actor; the 0024 trigger routes every
 * report into the moderation queue for operator review.
 *
 * INVARIANT — reporting a review is not disputing it: nothing here hides
 * a review, delays publication, notifies the seller, or marks anything
 * pending. A seller can never prevent a review from publishing, and this
 * path must not become the mechanism by which they do.
 *
 * D-44 — THE EDGE MAPPING IS GONE, and the wire adopts the enum's spelling.
 *
 * v1.6 spelled two of the five differently from the shipped type (STORE for
 * STOREFRONT, ACCOUNT for SELLER) and this controller translated between
 * them. ADU-API-01 v1.7 S12.15 withdraws that: "the enum is frozen and
 * shipped; this document is not the authority on its spelling ... a
 * translation layer between a document and a shipped type is a place for a
 * THIRD spelling to appear."
 *
 * So `subject_kind` is now exactly core.report_target_kind's five values.
 * That is a wire change rather than an additive one, and it is the change
 * the contract asks for: the mapping existed only to paper over a document
 * that has since corrected itself.
 */

const reportBody = z.object({
  subject_kind: z.enum(['PRODUCT', 'REVIEW', 'MESSAGE', 'SELLER', 'STOREFRONT']),
  subject_id: z.uuid(),
  reason: z.string().min(1).max(80),
  detail: z.string().max(2000).optional(),
});

@Controller()
export class ReportsController {
  constructor(private readonly tx: HandlerTransaction) {}

  @Post('reports')
  @ApiOperation({ summary: 'Any surface, any authenticated actor; the queue trigger routes it.' })
  async create(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = reportBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 201, async (trx) => {
      const id = randomUUID();
      await sql`
        INSERT INTO core.content_report
          (id, reporter_account_id, target_kind, target_id, reason_code, body)
        VALUES (${id}, ${req.ctx?.accountId ?? null},
                ${body.subject_kind}::core.report_target_kind,
                ${body.subject_id}, ${body.reason}, ${body.detail ?? null})`.execute(trx);
      return { report_id: id };
    });
  }

  @Get('reports/mine')
  @ApiOperation({ summary: "The reporter's own reports and their outcomes." })
  async mine(@Req() req: AuthedRequest): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      const r = await sql<Record<string, unknown>>`
        SELECT id, target_kind, target_id, reason_code, reported_at, resolved_at
          FROM core.content_report
         WHERE reporter_account_id = ${req.ctx?.accountId ?? ''}
         ORDER BY reported_at DESC
         LIMIT 100`.execute(trx);
      return { data: r.rows };
    });
  }
}
