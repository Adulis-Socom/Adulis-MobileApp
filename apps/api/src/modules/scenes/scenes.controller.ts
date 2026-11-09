import { Controller, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiDefaultResponse,
  ApiExtraModels,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/auth/auth.guard';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import { AdulisException } from '../../common/errors/adulis-exception';
import { PROBLEM_RESPONSE, ProblemDto } from '../../common/errors/problem.dto';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import {
  CreateScenePostBodyDto,
  PatchScenePostDraftBodyDto,
  PublicScenePostDto,
  ScenePostImageUploadResponseDto,
  SellerScenePostDto,
  SellerScenePostPageDto,
} from './scenes.dto';
import { createScenePostBody, patchScenePostDraftBody } from './scenes.schemas';
import { ScenesService } from './scenes.service';

/**
 * Scene Posts (ADU-SCN-01 v3.2 S45; WO-DISC-001 S20-S22). Seller management
 * under /v1/seller/scene-posts (Console, Seller context, the temporary
 * permission mapping in ScenesService); the public read under
 * /v1/scene-posts/{publicRef}. No archive, restore or delete command yet:
 * WO-DISC-001 S20 asks for create, edit, tag, publish and read.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELLER_HEADER = {
  name: 'X-Adulis-Seller',
  required: true,
  description: 'The Seller context (ADU-API-01 S4.2).',
  schema: { type: 'string', format: 'uuid' },
} as const;
const IDEMPOTENCY_KEY_HEADER = {
  name: 'Idempotency-Key',
  required: true,
  schema: { type: 'string', format: 'uuid' },
} as const;
const IF_MATCH_HEADER = {
  name: 'If-Match',
  required: true,
  description:
    'The Scene edit_version as an ETag, e.g. "3". A newer edit answers 409 VALIDATION_FAILED with slots.reason STALE_REVISION.',
  schema: { type: 'string' },
} as const;
const SCENE_ID = { name: 'id', format: 'uuid', description: 'The Scene id (management only).' };

const setEtag = (res: Response, view: { edit_version: number }) =>
  res.setHeader('ETag', `"${view.edit_version}"`);

/** Read directly, not via @Headers: that decorator would document a second, undescribed If-Match. */
const ifMatchOf = (req: LocalizedRequest): string | undefined => {
  const v = req.headers['if-match'];
  return Array.isArray(v) ? v[0] : v;
};

function assertUuid(value: string): void {
  if (!UUID_RE.test(value)) throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'id' } });
}

@Controller()
@ApiExtraModels(ProblemDto)
export class ScenesController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly svc: ScenesService,
  ) {}

  @Post('seller/scene-posts')
  @ApiOperation({
    summary: 'Create a private DRAFT Scene. Seller and Market are server-derived.',
  })
  @ApiCookieAuth('cookie')
  @ApiHeader(SELLER_HEADER)
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiBody({ type: CreateScenePostBodyDto })
  @ApiCreatedResponse({ type: SellerScenePostDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async create(@Req() req: LocalizedRequest, @Res({ passthrough: true }) res: Response) {
    const body = createScenePostBody.parse(req.body ?? {});
    const view = await this.tx.runIdempotent(req, res, 201, (trx) => this.svc.create(trx, req, body));
    setEtag(res, view);
    return view;
  }

  @Get('seller/scene-posts')
  @ApiOperation({ summary: "The Seller's own Scenes, any state, cursor-paginated." })
  @ApiCookieAuth('cookie')
  @ApiHeader(SELLER_HEADER)
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 50 } })
  @ApiOkResponse({ type: SellerScenePostPageDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async list(
    @Req() req: LocalizedRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    if (cursor !== undefined && !UUID_RE.test(cursor)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'cursor' } });
    }
    const n = Math.min(Math.max(Number.parseInt(limit ?? '20', 10) || 20, 1), 50);
    return this.tx.run(req, (trx) => this.svc.list(trx, req, cursor, n));
  }

  @Get('seller/scene-posts/:id')
  @ApiOperation({
    summary: 'Management view: state, Private reason, restoration, revisions, tag availability.',
  })
  @ApiCookieAuth('cookie')
  @ApiHeader(SELLER_HEADER)
  @ApiParam(SCENE_ID)
  @ApiOkResponse({ type: SellerScenePostDto, description: 'ETag carries edit_version.' })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async detail(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ) {
    assertUuid(id);
    const view = await this.tx.run(req, (trx) => this.svc.detail(trx, req, id));
    setEtag(res, view);
    return view;
  }

  @Patch('seller/scene-posts/:id/draft')
  @ApiOperation({
    summary:
      'Edit the working revision (caption, image, tags). A published Scene is cloned into a new working revision; the published one never changes.',
  })
  @ApiCookieAuth('cookie')
  @ApiHeader(SELLER_HEADER)
  @ApiHeader(IF_MATCH_HEADER)
  @ApiParam(SCENE_ID)
  @ApiBody({ type: PatchScenePostDraftBodyDto })
  @ApiOkResponse({ type: SellerScenePostDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async patchDraft(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ) {
    assertUuid(id);
    const body = patchScenePostDraftBody.parse(req.body ?? {});
    const view = await this.tx.run(req, (trx) =>
      this.svc.patchDraft(trx, req, id, ifMatchOf(req), body),
    );
    setEtag(res, view);
    return view;
  }

  @Post('seller/scene-posts/:id/image-uploads')
  @ApiOperation({
    summary:
      'Presigned PUTs for the three image derivatives under this Scene. Attach the keys with PATCH .../draft.',
  })
  @ApiCookieAuth('cookie')
  @ApiHeader(SELLER_HEADER)
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiParam(SCENE_ID)
  @ApiOkResponse({ type: ScenePostImageUploadResponseDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async imageUploads(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ) {
    assertUuid(id);
    return this.tx.runIdempotent(req, res, 200, (trx) => this.svc.requestImageUpload(trx, req, id));
  }

  @Post('seller/scene-posts/:id/publish')
  @ApiOperation({
    summary:
      'Publish the working revision. Every gate is recomputed; a blocked publish is 409 PUBLICATION_BLOCKED with every item (slots.item: PRODUCT_TAG_REQUIRED, NO_AVAILABLE_TAGGED_PRODUCT, ...).',
  })
  @ApiCookieAuth('cookie')
  @ApiHeader(SELLER_HEADER)
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiHeader(IF_MATCH_HEADER)
  @ApiParam(SCENE_ID)
  @ApiOkResponse({ type: SellerScenePostDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async publish(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
  ) {
    assertUuid(id);
    const view = await this.tx.runIdempotent(req, res, 200, (trx) =>
      this.svc.publish(trx, req, id, ifMatchOf(req)),
    );
    setEtag(res, view);
    return view;
  }

  @Get('scene-posts/:publicRef')
  @Public()
  @ApiOperation({
    summary:
      'A public Scene, only while every public gate passes now. PRIVATE, draft and unknown are the same 404.',
  })
  @ApiParam({ name: 'publicRef', description: 'The Scene public_ref (22 characters).' })
  @ApiOkResponse({ type: PublicScenePostDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async publicDetail(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('publicRef') publicRef: string,
  ) {
    // Scene data bypasses shared caches: eligibility is decided per delivery (S48).
    res.setHeader('Cache-Control', 'no-store');
    return this.tx.run(req, (trx) => this.svc.publicDetail(trx, publicRef));
  }
}
