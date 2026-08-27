import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { AdulisException } from '../../common/errors/adulis-exception';
import { CatalogueService } from './catalogue.service';
import {
  createProductBody,
  createVariantBody,
  imageBody,
  imageOrderBody,
  patchProductBody,
  patchVariantBody,
  socialPostBody,
  stockBody,
  videoBody,
} from './catalogue.schemas';

/** C2 — catalogue, media and stock (ADU-API-01 v1.6 section 12.10). */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(v: string, path: string): void {
  if (!UUID_RE.test(v)) {
    throw new AdulisException('VALIDATION_FAILED', { slots: { path } });
  }
}

@Controller()
export class CatalogueController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly svc: CatalogueService,
  ) {}

  @Post('seller/products')
  async createProduct(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = createProductBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) =>
      this.svc.createProduct(trx, req, body),
    );
  }

  @Get('seller/products')
  async listProducts(
    @Req() req: LocalizedRequest,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ): Promise<unknown> {
    if (cursor !== undefined) assertUuid(cursor, 'cursor');
    const limit = Math.min(Math.max(Number(limitRaw ?? 20) || 20, 1), 50);
    return this.tx.run(req, (trx) => this.svc.listProducts(trx, req, limit, cursor));
  }

  @Get('seller/products/:id')
  @ApiOperation({ summary: "The editor's read: variants, attributes, media, posts, state." })
  async getProduct(@Req() req: LocalizedRequest, @Param('id') id: string): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.run(req, (trx) => this.svc.getProduct(trx, req, id));
  }

  @Patch('seller/products/:id')
  async patchProduct(@Req() req: LocalizedRequest, @Param('id') id: string): Promise<unknown> {
    assertUuid(id, 'id');
    const body = patchProductBody.parse(req.body);
    return this.tx.run(req, (trx) => this.svc.patchProduct(trx, req, id, body));
  }

  @Post('seller/products/:id/publish')
  @ApiOperation({ summary: '409 with readiness items[] where blocked.' })
  async publishProduct(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.runIdempotent(req, res, 200, (trx) =>
      this.svc.publishProduct(trx, req, id),
    );
  }

  @Post('seller/products/:id/unpublish')
  @ApiOperation({ summary: 'Removes from the storefront; keeps the row.' })
  async unpublishProduct(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.runIdempotent(req, res, 200, (trx) =>
      this.svc.unpublishProduct(trx, req, id),
    );
  }

  @Delete('seller/products/:id')
  @ApiOperation({ summary: '409 PRODUCT_HAS_ACTIVE_ORDERS where any reservation is live.' })
  async deleteProduct(@Req() req: LocalizedRequest, @Param('id') id: string): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.run(req, (trx) => this.svc.deleteProduct(trx, req, id));
  }

  @Post('seller/products/:id/variants')
  async createVariant(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = createVariantBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) =>
      this.svc.createVariant(trx, req, id, body),
    );
  }

  @Patch('seller/variants/:id')
  async patchVariant(@Req() req: LocalizedRequest, @Param('id') id: string): Promise<unknown> {
    assertUuid(id, 'id');
    const body = patchVariantBody.parse(req.body);
    return this.tx.run(req, (trx) => this.svc.patchVariant(trx, req, id, body));
  }

  @Delete('seller/variants/:id')
  @ApiOperation({ summary: 'Withdraws — VARIANT_WITHDRAWN exists as a cart code for this.' })
  async deleteVariant(@Req() req: LocalizedRequest, @Param('id') id: string): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.run(req, (trx) => this.svc.deleteVariant(trx, req, id));
  }

  @Post('seller/products/:id/images')
  @ApiOperation({ summary: 'Signed upload then commit — one catalogued path, two actions.' })
  async images(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = imageBody.parse(req.body);
    return this.tx.runIdempotent(req, res, body.action === 'COMMIT' ? 201 : 200, (trx) =>
      this.svc.handleImage(trx, req, id, body),
    );
  }

  @Delete('seller/products/:id/images/:position')
  @HttpCode(204)
  async deleteImage(
    @Req() req: LocalizedRequest,
    @Param('id') id: string,
    @Param('position') positionRaw: string,
  ): Promise<void> {
    assertUuid(id, 'id');
    const position = Number(positionRaw);
    if (!Number.isInteger(position) || position < 1 || position > 5) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'position' } });
    }
    await this.tx.run(req, (trx) => this.svc.deleteImage(trx, req, id, position));
  }

  @Put('seller/products/:id/images/order')
  @ApiOperation({ summary: 'The WHOLE ordering in one request — one transaction or a defect.' })
  async reorderImages(
    @Req() req: LocalizedRequest,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = imageOrderBody.parse(req.body);
    return this.tx.run(req, (trx) => this.svc.reorderImages(trx, req, id, body));
  }

  @Post('seller/products/:id/video')
  async video(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = videoBody.parse(req.body);
    return this.tx.runIdempotent(req, res, body.action === 'COMMIT' ? 201 : 200, (trx) =>
      this.svc.handleVideo(trx, req, id, body),
    );
  }

  @Delete('seller/products/:id/video')
  @HttpCode(204)
  async deleteVideo(@Req() req: LocalizedRequest, @Param('id') id: string): Promise<void> {
    assertUuid(id, 'id');
    await this.tx.run(req, (trx) => this.svc.deleteVideo(trx, req, id));
  }

  @Post('seller/products/:id/social-posts')
  @ApiOperation({ summary: 'Canonical id resolved server-side; never the URL string.' })
  async attachSocialPost(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = socialPostBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) =>
      this.svc.attachSocialPost(trx, req, id, body),
    );
  }

  @Post('seller/variants/:id/stock')
  @ApiOperation({ summary: 'Writes a StockEvent. Never a direct count set.' })
  async writeStock(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const body = stockBody.parse(req.body);
    return this.tx.runIdempotent(req, res, 201, (trx) =>
      this.svc.writeStock(trx, req, id, body),
    );
  }

  @Post('seller/variants/:id/confirm-stock')
  @ApiOperation({ summary: 'Resets stock_confirmed_at (S13.3).' })
  async confirmStock(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    return this.tx.runIdempotent(req, res, 200, (trx) =>
      this.svc.confirmStock(trx, req, id),
    );
  }

  @Get('seller/variants/:id/stock-events')
  async listStockEvents(
    @Req() req: LocalizedRequest,
    @Param('id') id: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ): Promise<unknown> {
    assertUuid(id, 'id');
    const limit = Math.min(Math.max(Number(limitRaw ?? 20) || 20, 1), 50);
    return this.tx.run(req, (trx) => this.svc.listStockEvents(trx, req, id, limit, cursor));
  }
}
