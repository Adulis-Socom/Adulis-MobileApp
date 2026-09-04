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
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
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

/**
 * One presigned PUT: where to send the bytes, and the key the COMMIT must name.
 * `url` is short-lived (fifteen minutes) and is never stored.
 */
// No type annotation and no `as const`: SchemaObject lives behind a deep path
// into @nestjs/swagger/dist, which dependency-cruiser refuses as unresolvable
// (rightly -- it is a package internal), and `as const` makes `required`
// readonly, which the decorator's own type rejects. A plain literal is both.
const SIGNED_UPLOAD = {
  type: 'object',
  required: ['url', 'key'],
  properties: {
    url: { type: 'string', format: 'uri' },
    key: { type: 'string' },
  },
};

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

  /**
   * T22 Phase 4 -- THE RESPONSE IS DESCRIBED NOW, for D-98's reason.
   *
   * SC-07 needed two things this list did not carry: an image reference (it
   * could not draw a grid) and the resolved product cap (it could not say
   * which limit binds). Both are added here, and both are DESCRIBED, because
   * an undescribed response generates no type and the console then types the
   * shape locally -- "which means a wire-shape change here compiles clean over
   * there and fails in front of a seller", in the words of the sibling comment
   * below that made the same fix for the image bodies.
   */
  @Get('seller/products')
  @ApiOperation({
    summary: 'The seller list. Carries the card image key and the resolved publication cap.',
  })
  @ApiResponse({
    status: 200,
    description:
      'A cursor page of products, plus `publication` -- the resolved product cap and WHICH ' +
      'limit produced it. ADU-CON-03 S8: the cap is the intersection of tier and level and the ' +
      'counter must say which one binds, because "10 of unlimited" is a bug report waiting to ' +
      'be filed. `binding` is TIER, LEVEL, BOTH or NONE; a null `cap` is NONE and the screen ' +
      'must never render it as the word "unlimited".',
    schema: {
      type: 'object',
      required: ['data', 'publication', 'has_more', 'next_cursor'],
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'name', 'visibility', 'base_price', 'display_order', 'image_key'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              visibility: { type: 'string' },
              base_price: {
                type: 'object',
                required: ['amount_minor', 'currency'],
                properties: {
                  amount_minor: { type: 'integer' },
                  currency: { type: 'string' },
                },
              },
              display_order: { type: 'integer' },
              image_key: {
                type: 'string',
                nullable: true,
                description:
                  'The CARD derivative of the lowest-position image, or null when the product ' +
                  'has none. A bare key: /v1/bootstrap owns the origin.',
              },
            },
          },
        },
        publication: {
          type: 'object',
          required: ['resolved', 'used', 'cap', 'tier_cap', 'level_cap', 'binding', 'level'],
          properties: {
            resolved: {
              type: 'boolean',
              description:
                'False when the limit could not be resolved at all (NO_TIER_DEFINITION / ' +
                'NO_LADDER_CONFIG). NOT the same as "no cap in force": a seller whose limit ' +
                'cannot be resolved cannot publish.',
            },
            reason: { type: 'string', nullable: true },
            used: { type: 'integer', description: 'PUBLISHED products, counted server-side.' },
            cap: { type: 'integer', nullable: true },
            tier_cap: { type: 'integer', nullable: true },
            level_cap: { type: 'integer', nullable: true },
            binding: { type: 'string', enum: ['TIER', 'LEVEL', 'BOTH', 'NONE'] },
            level: { type: 'string', nullable: true },
          },
        },
        has_more: { type: 'boolean' },
        next_cursor: { type: 'string', format: 'uuid', nullable: true },
      },
    },
  })
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

  /**
   * THE SCHEMAS ARE ON THE OPERATION NOW (T20 S4, D-98's class).
   *
   * These bodies are parsed by zod and were described to the contract by
   * nothing at all, so `contracts/openapi.json` carried a path with no request
   * schema and `schema.d.ts` generated no type for it. The console did what the
   * console always does when the generated type is missing: it typed the shape
   * LOCALLY -- which means a wire-shape change here compiles clean over there
   * and fails in front of a seller holding a photograph.
   *
   * Transcribed from `imageBody` in catalogue.schemas.ts, not designed. If the
   * two ever disagree the zod schema governs, because it is the one that
   * actually refuses a request; this is the description of it.
   */
  @Post('seller/products/:id/images')
  @ApiOperation({ summary: 'Signed upload then commit \u2014 one catalogued path, two actions.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    description:
      'REQUEST_UPLOAD signs the three derivative PUTs; COMMIT registers what landed. ' +
      'The keys are server-minted at signing, so a commit can only name keys this API chose.',
    schema: {
      oneOf: [
        {
          type: 'object',
          required: ['action', 'position'],
          properties: {
            action: { type: 'string', enum: ['REQUEST_UPLOAD'] },
            position: { type: 'integer', minimum: 1, maximum: 5 },
          },
        },
        {
          type: 'object',
          required: ['action', 'position', 'thumb_key', 'card_key', 'full_key'],
          properties: {
            action: { type: 'string', enum: ['COMMIT'] },
            position: { type: 'integer', minimum: 1, maximum: 5 },
            thumb_key: { type: 'string', minLength: 1, maxLength: 300 },
            card_key: { type: 'string', minLength: 1, maxLength: 300 },
            full_key: { type: 'string', minLength: 1, maxLength: 300 },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'REQUEST_UPLOAD: three presigned PUTs, each with the key the commit must name.',
    schema: {
      type: 'object',
      required: ['uploads'],
      properties: {
        // INLINED, not a $ref. Nothing registers a SignedUpload component, and
        // a $ref to a component that does not exist generates a contract whose
        // types resolve to `unknown` -- worse than no schema, because it looks
        // described.
        uploads: {
          type: 'object',
          required: ['thumb', 'card', 'full'],
          properties: {
            thumb: SIGNED_UPLOAD,
            card: SIGNED_UPLOAD,
            full: SIGNED_UPLOAD,
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'COMMIT: the image row is registered.' })
  @ApiResponse({
    status: 409,
    description:
      'slots.reason is IMAGE_CAP_REACHED (checked BEFORE signing), ' +
      'OBJECT_NOT_UPLOADED, or POSITION_TAKEN.',
  })
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
  @ApiOperation({ summary: 'Removes one image and schedules the objects for purge.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'position', schema: { type: 'integer', minimum: 1, maximum: 5 } })
  @ApiResponse({ status: 204, description: 'Removed.' })
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
  @ApiOperation({
    summary:
      'The WHOLE ordering in one request \u2014 UNIQUE (product_id, position) makes a ' +
      'two-step swap a constraint violation, so this is one transaction or a defect.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    description: 'Every image id, in the order they should appear. Partial orderings are refused.',
    schema: {
      type: 'object',
      required: ['order'],
      properties: {
        order: {
          type: 'array',
          minItems: 1,
          maxItems: 5,
          items: { type: 'string', format: 'uuid' },
        },
      },
    },
  })
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
