import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import { Public } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { AdulisException } from '../../common/errors/adulis-exception';
import { OrdersService } from './orders.service';
import { addCartLineBody, patchCartLineBody } from './orders.schemas';

/**
 * C3 — the cart (Checkout Option A: a real Cart that never submits). Order
 * creation, payment decisions, refunds and Reservation cancellation were
 * retired with the Reservation model (migration 0063); nothing here holds stock. Cart endpoints accept
 * X-Adulis-Device WITHOUT a session (C6): a buyer fills a cart before they
 * have committed to anything, on the worst connection they will ever have.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assertUuid = (v: string, path: string): void => {
  if (!UUID_RE.test(v)) {
    throw new AdulisException('VALIDATION_FAILED', { slots: { path } });
  }
};



@Controller()
export class OrdersController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly svc: OrdersService,
  ) {}

  // ------------------------------------------------------------------- cart

  @Public()
  @Get('cart')
  @ApiOperation({ summary: 'Re-checks availability per line on every view.' })
  async getCart(@Req() req: LocalizedRequest): Promise<unknown> {
    return this.tx.run(req, (trx) => this.svc.getCart(trx, req));
  }

  @Public()
  @Post('cart/lines')
  @ApiOperation({ summary: '409 CART_SELLER_CONFLICT on a second seller.' })
  async addLine(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = addCartLineBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) => this.svc.addLine(trx, req, body));
  }

  @Public()
  @Patch('cart/lines/:id')
  async patchLine(@Req() req: LocalizedRequest, @Param('id') id: string): Promise<unknown> {
    assertUuid(id, 'id');
    const body = patchCartLineBody.parse(req.body);
    return this.tx.run(req, (trx) => this.svc.patchLine(trx, req, id, body));
  }

  @Public()
  @Delete('cart/lines/:id')
  @HttpCode(204)
  async deleteLine(@Req() req: LocalizedRequest, @Param('id') id: string): Promise<void> {
    assertUuid(id, 'id');
    await this.tx.run(req, (trx) => this.svc.deleteLine(trx, req, id));
  }
}
