import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import { Public } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { AdulisException } from '../../common/errors/adulis-exception';
import { ORDER_BUCKETS, type OrderBucket } from './order-buckets';
import { OrdersService } from './orders.service';
import {
  addCartLineBody,
  createOrderBody,
  patchCartLineBody,
  rejectPaymentBody,
  reportRefundBody,
} from './orders.schemas';

/**
 * C3 — cart, orders, payment decisions. Cart endpoints accept
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

  // ----------------------------------------------------------- buyer orders

  @Post('orders')
  @ApiOperation({
    summary: 'Whole-cart revalidation in one transaction; 409 with complete items[].',
  })
  async createOrder(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = createOrderBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) => this.svc.createOrder(trx, req, body));
  }

  @Get('orders')
  async listOrders(
    @Req() req: LocalizedRequest,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ): Promise<unknown> {
    const limit = Math.min(Math.max(Number(limitRaw ?? 20) || 20, 1), 50);
    return this.tx.run(req, (trx) => this.svc.listOrders(trx, req, limit, cursor));
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'The authoritative order card; expires_at is a time, never a duration.' })
  async getOrder(@Req() req: LocalizedRequest, @Param('id') id: string): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.run(req, (trx) => this.svc.getOrder(trx, req, id));
  }

  @Post('orders/:id/reservations/:rid/cancel')
  async cancelLine(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
    @Param('rid') rid: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    assertUuid(rid, 'rid');
    return this.tx.runIdempotent(req, res, 200, (trx) =>
      this.svc.cancelLineAsBuyer(trx, req, id, rid),
    );
  }

  @Post('orders/:id/cancel')
  @ApiOperation({ summary: 'Convenience: cancels every remaining line.' })
  async cancelOrder(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.runIdempotent(req, res, 200, (trx) => this.svc.cancelOrder(trx, req, id));
  }

  @Post('orders/:id/confirm-receipt')
  @ApiOperation({ summary: 'The tapped tier — medium weight, no level.' })
  async confirmReceipt(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.runIdempotent(req, res, 200, (trx) =>
      this.svc.confirmReceipt(trx, req, id),
    );
  }

  @Post('orders/:id/refunds/:rid/acknowledge')
  @ApiOperation({ summary: 'Explicit buyer action, never inferred.' })
  async acknowledgeRefund(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
    @Param('rid') rid: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    assertUuid(rid, 'rid');
    return this.tx.runIdempotent(req, res, 200, (trx) =>
      this.svc.acknowledgeRefund(trx, req, rid),
    );
  }

  // ---------------------------------------------------------- seller orders

  @Get('seller/orders')
  @ApiOperation({ summary: 'bucket membership is the SERVER\'s (D-154).' })
  async listSellerOrders(
    @Req() req: LocalizedRequest,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
    @Query('bucket') bucket?: string,
  ): Promise<unknown> {
    const limit = Math.min(Math.max(Number(limitRaw ?? 20) || 20, 1), 50);
    if (bucket !== undefined && !(bucket in ORDER_BUCKETS)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'bucket' } });
    }
    return this.tx.run(req, (trx) =>
      this.svc.listSellerOrders(trx, req, limit, cursor, bucket as OrderBucket | undefined),
    );
  }

  @Get('seller/orders/:id')
  async getSellerOrder(@Req() req: LocalizedRequest, @Param('id') id: string): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.run(req, (trx) => this.svc.getSellerOrder(trx, req, id));
  }

  @Post('seller/orders/:id/ready')
  @ApiOperation({ summary: 'Idempotent by state, not only by key. 409 before PAYMENT_CONFIRMED.' })
  async markReady(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.runIdempotent(req, res, 200, (trx) => this.svc.markReady(trx, req, id));
  }

  @Post('seller/orders/:id/payment/confirm')
  @ApiOperation({ summary: '"Confirm Payment Received", never "Accept Payment".' })
  async confirmPayment(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.runIdempotent(req, res, 200, (trx) =>
      this.svc.confirmPayment(trx, req, id),
    );
  }

  @Post('seller/orders/:id/payment/reject')
  @ApiOperation({ summary: 'First rejection opens a 12-hour retry window; the second ends the order.' })
  async rejectPayment(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = rejectPaymentBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 200, (trx) =>
      this.svc.rejectPayment(trx, req, id, body),
    );
  }

  @Post('seller/orders/:id/reservations/:rid/cancel')
  @ApiOperation({ summary: '"Can\'t Fulfil". There is no accept action.' })
  async cancelLineAsSeller(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
    @Param('rid') rid: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    assertUuid(rid, 'rid');
    return this.tx.runIdempotent(req, res, 200, (trx) =>
      this.svc.cancelLineAsSeller(trx, req, id, rid),
    );
  }

  @Post('seller/orders/:id/refunds')
  @ApiOperation({ summary: 'Seller reports; buyer acknowledges separately.' })
  async reportRefund(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = reportRefundBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) =>
      this.svc.reportRefund(trx, req, id, body),
    );
  }
}
