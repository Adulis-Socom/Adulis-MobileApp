import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiDefaultResponse, ApiOkResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { sql, type Transaction } from 'kysely';
import { Public, type AuthedRequest } from '../../common/auth/auth.guard';
import type { Database } from '../../common/db/database.types';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import { setWordSimilarityThreshold } from '../../common/db/request-context';
import { AdulisException } from '../../common/errors/adulis-exception';
import { PROBLEM_RESPONSE } from '../../common/errors/problem.dto';
import { requestingDevice } from '../../common/http/cookies';
import { decodeCursor, encodeCursor, pageLimit, type CursorPart } from '../../common/http/cursor';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { minorUnits, priceFields, productAvailable, publicPrice } from '../catalogue/public-projection';
import { captionExcerpt } from '../fyp/fyp.logic';
import { VISIBLE_STATES } from '../storefront/public-seller';
import { requesterMarket } from '../storefront/requester-market';
import { SEARCH_TYPES, SearchResponseDto, type SearchItem, type SearchType } from './search.dto';
import {
  cursorBinding,
  likePatterns,
  mergeTop,
  normalizeQuery,
  SEARCH_ALGORITHM_VERSION,
  TOP_CAPS,
  WORD_SIMILARITY,
  type NormalizedQuery,
  type Ranked,
} from './search.logic';

/**
 * GET /v1/search -- Marketplace Search (ADU-SRC-01 v3.2; WORK ORDER WO-008): Product Posts,
 * Sellers and Scene Posts of the requester's Market, PostgreSQL + pg_trgm.
 *
 * - **Market:** requesterMarket (the Account's, else the registered device's; ACTIVE only), never
 *   a query parameter (S6: an explicit switch needs a server-approved activated-Market contract,
 *   which does not exist yet). No Market evidence: an empty answer that says so.
 * - **Eligibility before ranking (S12):** Products PUBLISHED of a publicly visible Seller in an
 *   ACTIVE Market (unavailable ones stay, S9); Sellers publicly visible; Scenes only through the
 *   canonical gate core.v_scene_post_public (current PUBLIC published revision, ACTIVE Seller and
 *   Market, an available tagged Product). Each statement applies the gate before its ORDER BY.
 * - **No tracking (S23, WO-008 S18):** no query, session or result is stored or logged; the only
 *   write is the existing rate-limit counter, keyed by Account or registered device, never by query
 *   text -- and charged only once a Market is resolved, so a request that can find nothing writes
 *   nothing (an unregistered or absent device has no Market).
 */
const SCENE_CAPTION_EXCERPT = 140;
const RATE = { bucketKey: 'marketplace-search', windowSeconds: 60, max: 60 } as const;

const SHAPES: Record<Exclude<SearchType, 'TOP'>, readonly CursorPart[]> = {
  PRODUCT_POST: ['ref', 'int', 'bit', 'int', 'uuid'],
  SELLER: ['ref', 'int', 'int', 'uuid'],
  SCENE_POST: ['ref', 'int', 'int', 'ref'],
};

/** The lexical band of one column for one matched text (see search.logic): patterns come from that text. */
const band = (column: ReturnType<typeof sql.ref>, q: NormalizedQuery, text: string) => {
  const like = likePatterns(text);
  return sql<number | null>`
  CASE WHEN lower(${column}) = lower(${text}) THEN 0
       WHEN ${column} ILIKE ${like.prefix} ESCAPE '\\' OR ${column} ILIKE ${like.wordPrefix} ESCAPE '\\' THEN 1
       WHEN ${q.long} AND ${column} ILIKE ${like.contains} ESCAPE '\\' THEN 2
       WHEN ${q.long} AND ${text} <% ${column} THEN 3 END`;
};

/** The index-served candidate predicate of one column (trigram GIN serves ILIKE and <%). */
const candidate = (column: ReturnType<typeof sql.ref>, q: NormalizedQuery, text: string) => {
  const like = likePatterns(text);
  return q.long
    ? sql<boolean>`(${column} ILIKE ${like.contains} ESCAPE '\\' OR ${text} <% ${column})`
    : sql<boolean>`(${column} ILIKE ${like.prefix} ESCAPE '\\' OR ${column} ILIKE ${like.wordPrefix} ESCAPE '\\')`;
};

const invalidCursor = () => new AdulisException('VALIDATION_FAILED', { slots: { path: 'cursor', reason: 'CURSOR_INVALID' } });

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  base_price_minor: string;
  base_price_currency: string;
  price_min_minor: string | null;
  price_max_minor: string | null;
  price_currency: string | null;
  available: boolean;
  phase: number;
  seller_handle: string;
  seller_store_name: string;
  band: number;
  inv_sim: number;
}
interface SellerRow {
  id: string;
  handle: string;
  store_name: string;
  trust_level: 'NEW' | 'ESTABLISHED' | 'TRUSTED' | null;
  band: number;
  inv_sim: number;
}
interface SceneRow {
  public_ref: string;
  caption: string;
  image_thumb_key: string;
  image_card_key: string;
  seller_handle: string;
  seller_store_name: string;
  band: number;
  inv_sim: number;
}

@Controller()
export class SearchController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get('search')
  @Public()
  @ApiOperation({
    summary:
      "Marketplace Search: Product Posts, Sellers and Scene Posts of the requester's Market (never a parameter). type=TOP (default) is a bounded mixed set; a single type is cursor-paginated. Lexical (exact, prefix, substring, pg_trgm fuzzy); available Products before relevant unavailable ones. Nothing is stored or logged.",
  })
  @ApiQuery({ name: 'q', required: true, description: '2-100 characters after Unicode (NFKC) and whitespace normalisation.' })
  @ApiQuery({ name: 'type', required: false, enum: SEARCH_TYPES, description: 'Default TOP.' })
  @ApiQuery({ name: 'cursor', required: false, description: 'next_cursor of the previous page of the same query and type (opaque).' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size for a single type, 1-50 (default 20). Ignored for TOP.' })
  @ApiOkResponse({ type: SearchResponseDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async search(
    @Req() req: LocalizedRequest & AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Query('q') rawQuery?: string,
    @Query('type') typeRaw?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<SearchResponseDto> {
    // Results depend on the requester's Market and current eligibility: never shared-cached.
    res.setHeader('Cache-Control', 'no-store');
    const q = normalizeQuery(typeof rawQuery === 'string' ? rawQuery : undefined);
    const type = (typeRaw ?? 'TOP') as SearchType;
    if (!SEARCH_TYPES.includes(type)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'type' } });
    }
    if (type === 'TOP' && cursor) throw invalidCursor();
    const after = type === 'TOP' ? null : decodeCursor(cursor, SHAPES[type]);
    const limit = type === 'TOP' ? 0 : pageLimit(limitRaw, 20, 50);

    return this.tx.run(req, async (trx) => {
      // Market first: with none (no device, an unregistered one, an inactive Market) there is
      // nothing to search, and nothing is written -- not even a rate-limit counter.
      const market = await requesterMarket(trx, req);
      const empty = { market_resolved: market !== null, type, algorithm_version: SEARCH_ALGORITHM_VERSION, items: [], next_cursor: null };
      if (market === null) return empty;
      // A resolved Market means a signed-in Account or a registered device: charge that subject.
      const accountId = req.ctx?.accountId ?? null;
      const device = requestingDevice(req.headers);
      if (accountId) await this.rateLimit.consume('ACCOUNT', accountId, RATE, trx);
      else if (device) await this.rateLimit.consume('DEVICE', device, RATE, trx);
      if (after && after[0] !== cursorBinding(type, market, q)) throw invalidCursor();

      // The fuzzy threshold, for this transaction only (pg_trgm default 0.6 misses one-letter typos in short words).
      await setWordSimilarityThreshold(trx, WORD_SIMILARITY);

      if (type === 'TOP') {
        const [products, sellers, scenes] = [
          await this.products(trx, market, q, null, TOP_CAPS.PRODUCT_POST),
          await this.sellers(trx, market, q, null, TOP_CAPS.SELLER),
          await this.scenes(trx, market, q, null, TOP_CAPS.SCENE_POST),
        ];
        return { ...empty, items: mergeTop<SearchItem>([products.ranked, sellers.ranked, scenes.ranked]) };
      }
      const page =
        type === 'PRODUCT_POST'
          ? await this.products(trx, market, q, after, limit)
          : type === 'SELLER'
            ? await this.sellers(trx, market, q, after, limit)
            : await this.scenes(trx, market, q, after, limit);
      return {
        ...empty,
        items: page.ranked.map((r) => r.item),
        next_cursor: page.next ? encodeCursor([cursorBinding(type, market, q), ...page.next]) : null,
      };
    });
  }

  private async products(trx: Transaction<Database>, market: string, q: NormalizedQuery, after: Array<string | number> | null, limit: number) {
    const name = sql.ref('p.name');
    const r = await sql<ProductRow>`
      SELECT c.* FROM (
        SELECT p.id, p.slug, p.name, p.base_price_minor, p.base_price_currency,
               pp.price_min_minor, pp.price_max_minor, pp.price_currency,
               ${productAvailable} AS available,
               CASE WHEN ${productAvailable} THEN 0 ELSE 1 END AS phase,
               s.handle AS seller_handle, s.store_name AS seller_store_name,
               ${band(name, q, q.text)} AS band,
               (1000 - round(similarity(p.name, ${q.text}) * 1000))::int AS inv_sim
          FROM core.product p
          JOIN core.seller s ON s.id = p.seller_id
          JOIN core.market m ON m.id = p.market_id
         CROSS JOIN ${publicPrice}
         WHERE p.market_id = ${market}::uuid
           AND p.visibility = 'PUBLISHED' AND p.published_at IS NOT NULL
           AND s.status::text = ANY(${VISIBLE_STATES})
           AND m.activation_state = 'ACTIVE'
           AND ${candidate(name, q, q.text)}
      ) c
       WHERE c.band IS NOT NULL
         AND (${after === null}
              OR (c.band, c.phase, c.inv_sim, c.id)
                 > (${after?.[1] ?? 0}::int, ${after?.[2] ?? 0}::int, ${after?.[3] ?? 0}::int, ${after?.[4] ?? null}::uuid))
       ORDER BY c.band, c.phase, c.inv_sim, c.id
       LIMIT ${limit + 1}`.execute(trx);
    const rows = r.rows.slice(0, limit);
    const images = await sql<{ product_id: string; card_key: string }>`
      SELECT DISTINCT ON (i.product_id) i.product_id, i.card_key
        FROM core.product_image i
       WHERE i.product_id = ANY(${rows.map((x) => x.id)}::uuid[])
       ORDER BY i.product_id, i.position`.execute(trx);
    const imageOf = new Map(images.rows.map((i) => [i.product_id, i.card_key]));
    const last = rows[rows.length - 1];
    return {
      ranked: rows.map(
        (x, rank): Ranked<SearchItem> => ({
          type: 'PRODUCT_POST',
          band: x.band,
          rank,
          item: {
            type: 'PRODUCT_POST',
            payload: {
              id: x.id,
              slug: x.slug,
              name: x.name,
              base_price_minor: minorUnits(x.base_price_minor),
              base_price_currency: x.base_price_currency,
              ...priceFields(x),
              available: x.available,
              seller: { handle: x.seller_handle, store_name: x.seller_store_name },
              image_key: imageOf.get(x.id) ?? null,
            },
          },
        }),
      ),
      next: r.rows.length > limit && last ? [last.band, last.phase, last.inv_sim, last.id] : null,
    };
  }

  private async sellers(trx: Transaction<Database>, market: string, q: NormalizedQuery, after: Array<string | number> | null, limit: number) {
    const handle = sql.ref('s.handle');
    const store = sql.ref('s.store_name');
    const r = await sql<SellerRow>`
      SELECT c.* FROM (
        SELECT s.id, s.handle, s.store_name, ps.level::text AS trust_level,
               LEAST(${band(handle, q, q.handle)}, ${band(store, q, q.text)}) AS band,
               (1000 - round(GREATEST(similarity(s.handle, ${q.handle}), similarity(s.store_name, ${q.text})) * 1000))::int AS inv_sim
          FROM core.seller s
          JOIN core.market m ON m.id = s.market_id
          LEFT JOIN core.seller_public_stats ps ON ps.seller_id = s.id
         WHERE s.market_id = ${market}::uuid
           AND s.status::text = ANY(${VISIBLE_STATES})
           AND m.activation_state = 'ACTIVE'
           AND (${candidate(handle, q, q.handle)} OR ${candidate(store, q, q.text)})
      ) c
       WHERE c.band IS NOT NULL
         AND (${after === null}
              OR (c.band, c.inv_sim, c.id) > (${after?.[1] ?? 0}::int, ${after?.[2] ?? 0}::int, ${after?.[3] ?? null}::uuid))
       ORDER BY c.band, c.inv_sim, c.id
       LIMIT ${limit + 1}`.execute(trx);
    const rows = r.rows.slice(0, limit);
    const last = rows[rows.length - 1];
    return {
      ranked: rows.map(
        (x, rank): Ranked<SearchItem> => ({
          type: 'SELLER',
          band: x.band,
          rank,
          item: { type: 'SELLER', payload: { handle: x.handle, store_name: x.store_name, trust_level: x.trust_level } },
        }),
      ),
      next: r.rows.length > limit && last ? [last.band, last.inv_sim, last.id] : null,
    };
  }

  private async scenes(trx: Transaction<Database>, market: string, q: NormalizedQuery, after: Array<string | number> | null, limit: number) {
    const caption = sql.ref('v.caption');
    const tagName = sql.ref('tp.name');
    // Candidates as a UNION, so each branch can use its own trigram index (an OR with a correlated
    // EXISTS cannot): Scenes whose current caption matches, and -- from 3 characters -- Scenes
    // whose current revision tags a PUBLISHED Product whose name matches. A tagged Product's name
    // is secondary context (S11): alone it admits a Scene at the fuzzy band.
    const tagged = q.long
      ? sql`UNION
            SELECT v.public_ref, true AS via_tag
              FROM core.product tp
              JOIN core.scene_post_product t ON t.product_id = tp.id
              JOIN core.v_scene_post_public v ON v.revision_id = t.revision_id
             WHERE tp.market_id = ${market}::uuid AND tp.visibility = 'PUBLISHED'
               AND v.market_id = ${market}::uuid
               AND ${candidate(tagName, q, q.text)}`
      : sql``;
    const r = await sql<SceneRow>`
      WITH cand AS (
        SELECT v.public_ref, false AS via_tag
          FROM core.v_scene_post_public v
         WHERE v.market_id = ${market}::uuid
           AND ${candidate(caption, q, q.text)}
        ${tagged}
      )
      SELECT c.* FROM (
        SELECT v.public_ref, v.caption, v.image_thumb_key, v.image_card_key,
               v.seller_handle, v.seller_store_name,
               coalesce(${band(caption, q, q.text)}, CASE WHEN m.via_tag THEN 3 END) AS band,
               (1000 - round(similarity(v.caption, ${q.text}) * 1000))::int AS inv_sim
          FROM (SELECT public_ref, bool_or(via_tag) AS via_tag FROM cand GROUP BY public_ref) m
          JOIN core.v_scene_post_public v ON v.public_ref = m.public_ref
      ) c
       WHERE c.band IS NOT NULL
         AND (${after === null}
              OR (c.band, c.inv_sim, c.public_ref) > (${after?.[1] ?? 0}::int, ${after?.[2] ?? 0}::int, ${after?.[3] ?? ''}::text))
       ORDER BY c.band, c.inv_sim, c.public_ref
       LIMIT ${limit + 1}`.execute(trx);
    const rows = r.rows.slice(0, limit);
    const last = rows[rows.length - 1];
    return {
      ranked: rows.map((x, rank): Ranked<SearchItem> => {
        const excerpt = captionExcerpt(x.caption, SCENE_CAPTION_EXCERPT);
        return {
          type: 'SCENE_POST',
          band: x.band,
          rank,
          item: {
            type: 'SCENE_POST',
            payload: {
              public_ref: x.public_ref,
              caption: excerpt.text,
              caption_truncated: excerpt.truncated,
              image: { thumb_key: x.image_thumb_key, card_key: x.image_card_key },
              seller: { handle: x.seller_handle, store_name: x.seller_store_name },
            },
          },
        };
      }),
      next: r.rows.length > limit && last ? [last.band, last.inv_sim, last.public_ref] : null,
    };
  }
}
