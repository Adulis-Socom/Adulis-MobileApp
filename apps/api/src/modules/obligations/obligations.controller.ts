import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { assertPermission } from '../../common/auth/permission';

/**
 * GET /v1/seller/obligations -- ADU-API-01 v1.10 S12.12b. WHAT NEEDS ME.
 *
 * THE SERVER OWNS THE OBLIGATION SET: "needs me" is a set of situations
 * across several objects, and which situations belong is a product decision
 * a console must not make. An obligation is a thing where SILENCE COSTS YOU.
 *
 * The set is EMPTY today, truthfully. Its three kinds -- a payment awaiting
 * confirmation, a claim awaiting the seller, an order not ready -- all
 * derived from the legacy order and Reservation flow that was retired
 * (founder pre-launch authorization, migration 0063), and nothing can create
 * one again. A new kind joins this list only from an approved design, with
 * the shape the console already renders: { kind, object_kind, object_id,
 * deadline, consequence_key }.
 *
 * The door stays seller.store:read (CONSOLE-only surface; a stranger is 404
 * via U0002), so the empty answer is still only given to the seller's team.
 */
@Controller()
export class ObligationsController {
  constructor(private readonly tx: HandlerTransaction) {}

  @Get('seller/obligations')
  @ApiOperation({ summary: 'What the seller owes, with deadlines. The server owns the set (S12.12b).' })
  async list(@Req() req: AuthedRequest): Promise<unknown> {
    return this.tx.run(req as LocalizedRequest, async (trx) => {
      await assertPermission(trx, req, 'seller.store:read');
      return { data: [] };
    });
  }
}
