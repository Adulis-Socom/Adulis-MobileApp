import { applyDecorators, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiDefaultResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import { AdulisException } from '../../common/errors/adulis-exception';
import { PROBLEM_RESPONSE } from '../../common/errors/problem.dto';
import { decodeCursor, pageLimit, type CursorPart } from '../../common/http/cursor';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import {
  AddCollectionItemBodyDto,
  CollectionDetailDto,
  CollectionDto,
  CollectionItemDto,
  CollectionNameBodyDto,
  CollectionPageDto,
  SavedItemPageDto,
  SavedStateBodyDto,
  SavedStateDto,
} from './collections.dto';
import { addItemBody, assertRef, ITEM_FILTERS, nameBody, normalizeName, parseFilter, savedStateBody } from './collections.logic';
import { CollectionsService } from './collections.service';

const IDEMPOTENCY_KEY_HEADER = { name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } } as const;
const COLLECTION_REF = { name: 'collectionRef', format: 'uuid', description: 'One of the caller\'s Collections; any other ref is 404.' };
const ITEM_REF = { name: 'itemRef', format: 'uuid' };
const COLLECTION_CURSOR: readonly CursorPart[] = ['int', 'timestamp', 'uuid'];
const ITEM_CURSOR: readonly CursorPart[] = ['timestamp', 'uuid'];
const ITEM_QUERIES = applyDecorators(
  ApiQuery({ name: 'type', required: false, enum: ITEM_FILTERS }),
  ApiQuery({ name: 'cursor', required: false, schema: { type: 'string' } }),
  ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 50 } }),
);

/** The authenticated Account; never a client-supplied owner (S18). Guests never reach here (no @Public). */
function owner(req: AuthedRequest): string {
  const accountId = req.ctx?.accountId;
  if (!accountId) throw new AdulisException('SESSION_EXPIRED');
  return accountId;
}

/**
 * Private Buyer Collections (ADU-SRC-01 v3.2 S18-S22, S26-S27; ADU-MOB-02 v4.3 S39-S42).
 * Authenticated only; the owner is the session's Account whatever mode the app is in, and
 * X-Adulis-Seller decides nothing here. Responses are private and never cached.
 */
@Controller()
@ApiBearerAuth('bearer')
export class CollectionsController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly svc: CollectionsService,
  ) {}

  @Get('collections')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: "The caller's Collections, DEFAULT first (created on first need), with membership counts." })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string' } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 50 } })
  @ApiOkResponse({ type: CollectionPageDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async list(@Req() req: LocalizedRequest, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const accountId = owner(req);
    const after = decodeCursor(cursor, COLLECTION_CURSOR);
    const n = pageLimit(limit, 50, 50);
    return this.tx.run(req, (trx) => this.svc.list(trx, accountId, after, n));
  }

  @Post('collections')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Create a named private Collection.' })
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiBody({ type: CollectionNameBodyDto })
  @ApiCreatedResponse({ type: CollectionDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async create(@Req() req: LocalizedRequest, @Res({ passthrough: true }) res: Response) {
    const accountId = owner(req);
    const name = normalizeName(nameBody.parse(req.body ?? {}).name);
    return this.tx.runIdempotent(req, res, 201, (trx) => this.svc.create(trx, accountId, name));
  }

  // Declared before collections/:collectionRef so the literal path wins.
  @Get('collections/saves')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Recent Saves across every Collection: each target once, newest first; filter by type.' })
  @ITEM_QUERIES
  @ApiOkResponse({ type: SavedItemPageDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async saves(@Req() req: LocalizedRequest, @Query('type') type?: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const accountId = owner(req);
    const filter = parseFilter(type);
    const after = decodeCursor(cursor, ITEM_CURSOR);
    const n = pageLimit(limit, 30, 50);
    return this.tx.run(req, (trx) => this.svc.saves(trx, req, accountId, filter, after, n));
  }

  @Post('collections/saved-state\\:batch')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Saved state for up to 60 typed targets in one request (a read; no Idempotency-Key).' })
  @ApiBody({ type: SavedStateBodyDto })
  @ApiOkResponse({ type: SavedStateDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async savedState(@Req() req: LocalizedRequest) {
    const accountId = owner(req);
    const { targets } = savedStateBody.parse(req.body ?? {});
    return this.tx.run(req, (trx) => this.svc.savedState(trx, accountId, targets));
  }

  @Get('collections/:collectionRef')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'One Collection and its items, newest first, resolved through the current public gates.' })
  @ApiParam(COLLECTION_REF)
  @ITEM_QUERIES
  @ApiOkResponse({ type: CollectionDetailDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async detail(
    @Req() req: LocalizedRequest,
    @Param('collectionRef') ref: string,
    @Query('type') type?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const accountId = owner(req);
    assertRef(ref);
    const filter = parseFilter(type);
    const after = decodeCursor(cursor, ITEM_CURSOR);
    const n = pageLimit(limit, 30, 50);
    return this.tx.run(req, (trx) => this.svc.detail(trx, req, accountId, ref, filter, after, n));
  }

  @Patch('collections/:collectionRef')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Rename a named Collection (DEFAULT cannot be renamed).' })
  @ApiParam(COLLECTION_REF)
  @ApiBody({ type: CollectionNameBodyDto })
  @ApiOkResponse({ type: CollectionDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async rename(@Req() req: LocalizedRequest, @Param('collectionRef') ref: string) {
    const accountId = owner(req);
    assertRef(ref);
    const name = normalizeName(nameBody.parse(req.body ?? {}).name);
    return this.tx.run(req, (trx) => this.svc.rename(trx, accountId, ref, name));
  }

  @Delete('collections/:collectionRef')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a named Collection and its memberships (DEFAULT cannot be deleted). Saved objects are untouched.' })
  @ApiParam(COLLECTION_REF)
  @ApiNoContentResponse()
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async remove(@Req() req: LocalizedRequest, @Param('collectionRef') ref: string): Promise<void> {
    const accountId = owner(req);
    assertRef(ref);
    await this.tx.run(req, (trx) => this.svc.remove(trx, accountId, ref));
  }

  @Post('collections/:collectionRef/items')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Save a Product Post or whole Scene Post; a repeated Save returns the existing membership.' })
  @ApiParam(COLLECTION_REF)
  @ApiHeader(IDEMPOTENCY_KEY_HEADER)
  @ApiBody({ type: AddCollectionItemBodyDto })
  @ApiCreatedResponse({ type: CollectionItemDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async addItem(@Req() req: LocalizedRequest, @Res({ passthrough: true }) res: Response, @Param('collectionRef') ref: string) {
    const accountId = owner(req);
    assertRef(ref);
    const body = addItemBody.parse(req.body ?? {});
    return this.tx.runIdempotent(req, res, 201, (trx) => this.svc.addItem(trx, req, accountId, ref, body));
  }

  @Delete('collections/:collectionRef/items/:itemRef')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove one membership; removing an absent one succeeds.' })
  @ApiParam(COLLECTION_REF)
  @ApiParam(ITEM_REF)
  @ApiNoContentResponse()
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async removeItem(@Req() req: LocalizedRequest, @Param('collectionRef') ref: string, @Param('itemRef') itemRef: string): Promise<void> {
    const accountId = owner(req);
    assertRef(ref);
    assertRef(itemRef);
    await this.tx.run(req, (trx) => this.svc.removeItem(trx, accountId, ref, itemRef));
  }
}
