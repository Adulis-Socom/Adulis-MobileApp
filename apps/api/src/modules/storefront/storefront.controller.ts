import { Controller, Get, Header, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiDefaultResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PROBLEM_RESPONSE } from '../../common/errors/problem.dto';
import {
  PostLinkProductListDto,
  StorefrontProductDto,
  StorefrontProductListDto,
  StorefrontSearchResultListDto,
} from './storefront.dto';
import type { Response } from 'express';
import { Inject } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import { z } from 'zod';
import { HandlerTransaction } from '../../common/db/handler-transaction';
import { Public, type AuthedRequest } from '../../common/auth/auth.guard';
import type { LocalizedRequest } from '../../common/http/locale.middleware';
import type { Database } from '../../common/db/database.types';
import { AdulisException } from '../../common/errors/adulis-exception';
import { POST_LINK_ADAPTER, type PostLinkAdapter } from '../catalogue/post-link.adapter';
import { requesterMarket } from './requester-market';
import {
  minorUnits,
  priceFields,
  productAvailable,
  productTrades,
  publicPrice,
  variantSellable,
} from '../catalogue/public-projection';

/**
 * C8 — the public, anonymous group (ADU-API-01 v1.6 section 12.1).
 *
 * INVARIANT — the storefront response carries trust level and completed
 * handoff count AS PAGE CONTENT, one round trip. The first response stays
 * lean (S14: under 40KB uncompressed) — ids, names, prices, one image key.
 *
 * INVARIANT — no reserve endpoint is reachable without a session, so the
 * web client cannot offer the action even by mistake.
 *
 * The product path parameter is the SLUG, since G1.9 gave core.product the
 * column doctrine 5 always required: "no internal UUID appears in any public
 * URL ... a UUIDv7 is time-ordered, so a UUID in a public URL leaks signup
 * order and admits walking the space." It was served by id from C2 until
 * T6 (register D-43), because the contract named {slug} and the column did
 * not exist.
 *
 * The list and search routes still RETURN p.id alongside the slug. That is
 * deliberate and additive: the id is what an authenticated client uses to
 * add a line to a cart, and doctrine 5 governs URLs rather than payloads.
 *
 * Storefront and product views are SERVER-emitted analytics events
 * (storefront_viewed, product_viewed) — a crashed client loses nothing,
 * and 12.13's view numbers resolve from rows a client cannot forge.
 */

const resolveBody = z.object({ url: z.string().max(2048) });

/** A storefront exists while its seller is publicly live. */
const VISIBLE_STATES = ['ACTIVE', 'CLOSING', 'BILLING_SUSPENDED'];

const first = <T>(rows: readonly T[]): T | undefined => rows[0];

/** A public Product summary as the projection reads it (bigint money arrives as text). */
interface ProductSummaryRow {
  id: string;
  slug: string;
  name: string;
  base_price_minor: string;
  base_price_currency: string;
  price_min_minor: string | null;
  price_max_minor: string | null;
  price_currency: string | null;
  available: boolean;
}

/** The fields list, search and post-link resolution share, money as JSON integers. */
const summary = (row: ProductSummaryRow) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  base_price_minor: minorUnits(row.base_price_minor),
  base_price_currency: row.base_price_currency,
  ...priceFields(row),
  available: row.available,
});

interface SellerRow {
  id: string;
  market_id: string;
  store_name: string;
  handle: string;
  description: string | null;
  status: string;
}

@Controller()
export class StorefrontController {
  constructor(
    private readonly tx: HandlerTransaction,
    @Inject(POST_LINK_ADAPTER) private readonly postLinks: PostLinkAdapter,
  ) {}

  /**
   * The Seller a public handle names, MARKET-SAFE (WO-CAT-001; OVN-016, OVN-077). Handles are
   * unique per Market only, so the handle is resolved inside the requester's Market
   * (requesterMarket: the Account's, else the registered device's, read from the database).
   * With no Market evidence the handle resolves only when exactly ONE ACTIVE Market has it;
   * two candidates are ambiguous and get the same neutral 404 as an unknown handle -- never
   * the first matching row. The Seller's Market must be ACTIVE (DB-01 :3092: every Market
   * resolution reads activation_state = 'ACTIVE'), as the public Scene view already requires.
   */
  private async sellerByHandle(
    trx: Transaction<Database>,
    req: AuthedRequest,
    handle: string,
  ): Promise<SellerRow> {
    const market = await requesterMarket(trx, req);
    const r = await sql<SellerRow>`
      SELECT s.id, s.market_id, s.store_name, s.handle, s.description, s.status
        FROM core.seller s
        JOIN core.market m ON m.id = s.market_id
       WHERE s.handle = ${handle}
         AND s.status::text = ANY(${VISIBLE_STATES})
         AND m.activation_state = 'ACTIVE'
         AND (${market}::uuid IS NULL OR s.market_id = ${market}::uuid)
       LIMIT 2`.execute(trx);
    const seller = r.rows.length === 1 ? r.rows[0] : undefined;
    if (!seller) throw new AdulisException('NOT_FOUND');
    return seller;
  }

  /**
   * S20 — eligibility_path is NOT NULL on every seller-scoped event, and it
   * comes from the seller's latest evaluation (a seller reaches a public
   * storefront only through one). A seller somehow without one gets the
   * event UNATTRIBUTED rather than a fabricated path.
   */
  private async emit(
    trx: Transaction<Database>,
    name: string,
    marketId: string,
    sellerId: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await sql`
      INSERT INTO analytics.event
        (market_id, name, version, seller_id, eligibility_path, payload)
      SELECT ${marketId}, ${name}, 1,
             CASE WHEN e.path IS NULL THEN NULL ELSE ${sellerId}::uuid END,
             e.path,
             ${JSON.stringify(payload)}::jsonb
        FROM (SELECT (SELECT ev.path FROM core.seller_eligibility_evaluation ev
                       WHERE ev.seller_id = ${sellerId}
                       ORDER BY ev.evaluated_at DESC LIMIT 1) AS path) e`.execute(trx);
  }

  @Get('storefronts/:handle')
  // The answer depends on the requester's Market (and is read now): never shared-cached.
  @Header('Cache-Control', 'no-store')
  @Public()
  @ApiOperation({ summary: 'Header, stats, trust level, availability — one round trip (S3.1).' })
  async storefront(@Req() req: LocalizedRequest, @Param('handle') handle: string): Promise<unknown> {
    return this.tx.run(req, async (trx) => {
      const seller = await this.sellerByHandle(trx, req, handle);
      const stats = await sql<Record<string, unknown>>`
        SELECT ps.level, ps.completed_handoff_count, ps.cancellation_rate,
               ps.confirmation_rate, ps.scan_completion_rate,
               ps.unresolved_claim_count, ps.missed_confirmation_windows
          FROM core.seller_public_stats ps
         WHERE ps.seller_id = ${seller.id}`.execute(trx);
      const availability = await sql<{ is_open: boolean; reason: string; note: string | null }>`
        SELECT * FROM core.fn_seller_availability_state(${seller.id}, now())`.execute(trx);
      await this.emit(trx, 'storefront_viewed', seller.market_id, seller.id);
      return {
        seller_id: seller.id,
        store_name: seller.store_name,
        handle: seller.handle,
        description: seller.description,
        status: seller.status,
        stats: first(stats.rows) ?? null,
        availability: first(availability.rows) ?? null,
      };
    });
  }

  @Get('storefronts/:handle/products')
  // The answer depends on the requester's Market (and is read now): never shared-cached.
  @Header('Cache-Control', 'no-store')
  @Public()
  @ApiOperation({
    summary:
      "Seller's display order is the default (S7.5); lean by design (S14). Prices are the ACTIVE Variants' span; unavailable Products stay listed with available=false.",
  })
  @ApiParam({ name: 'handle', description: 'The Seller public handle.' })
  @ApiOkResponse({ type: StorefrontProductListDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async products(
    @Req() req: LocalizedRequest,
    @Param('handle') handle: string,
  ): Promise<StorefrontProductListDto> {
    return this.tx.run(req, async (trx) => {
      const seller = await this.sellerByHandle(trx, req, handle);
      const r = await sql<ProductSummaryRow & { display_order: number; image_key: string | null }>`
        SELECT p.id, p.slug, p.name, p.base_price_minor, p.base_price_currency,
               p.display_order,
               (SELECT i.card_key FROM core.product_image i
                 WHERE i.product_id = p.id ORDER BY i.position LIMIT 1) AS image_key,
               pp.price_min_minor, pp.price_max_minor, pp.price_currency,
               ${productAvailable} AS available
          FROM core.product p
          JOIN core.seller s ON s.id = p.seller_id
          JOIN core.market m ON m.id = p.market_id
         CROSS JOIN ${publicPrice}
         WHERE p.seller_id = ${seller.id} AND p.visibility = 'PUBLISHED'
         ORDER BY p.display_order, p.created_at
         LIMIT 100`.execute(trx);
      return { data: r.rows.map((row) => ({ ...summary(row), display_order: row.display_order, image_key: row.image_key })) };
    });
  }

  @Get('storefronts/:handle/products/:slug')
  @Public()
  @ApiOperation({
    summary:
      'Structured attributes, variants, stock with confirmed_at. Only a PUBLISHED Product of a visible Seller; anything else is the same 404.',
  })
  @ApiParam({ name: 'handle', description: 'The Seller public handle.' })
  @ApiParam({ name: 'slug', description: 'The Product slug within that Seller.' })
  @ApiQuery({
    name: 'revalidate',
    required: false,
    enum: ['true'],
    description:
      'true: a technical re-read of a Product already on screen (a pull, a return from the background), not a new opening; the server then records no product_viewed (founder ruling OVN-073). It can only withhold the event, never create one. Omit it for an opening.',
  })
  @ApiOkResponse({ type: StorefrontProductDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async product(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('handle') handle: string,
    @Param('slug') slug: string,
    @Query('revalidate') revalidate?: string,
  ): Promise<StorefrontProductDto> {
    // Price, stock and availability are read per delivery; nothing may cache them.
    res.setHeader('Cache-Control', 'no-store');
    // No UUID guard any more: a slug is free text within a seller, and the
    // scope check is the (seller_id, slug) lookup itself. An unknown slug
    // is the ordinary 404 below, which is also what a wrong-seller slug
    // gets -- a storefront must not confirm that a product exists
    // elsewhere.
    //
    // PUBLICATION IS `visibility`, NOT `published_at` (OVN-011, WO-005).
    // fn_unpublish_product sets visibility UNPUBLISHED and keeps published_at
    // (the first-publication record), so filtering on published_at left an
    // unpublished Product on every public read. visibility = 'PUBLISHED' is the
    // rule fn_create_order and core.v_scene_product_availability already apply.
    return this.tx.run(req, async (trx) => {
      const seller = await this.sellerByHandle(trx, req, handle);
      const p = await sql<
        ProductSummaryRow & { description: string | null; category_id: string | null }
      >`
        SELECT p.id, p.slug, p.name, p.description, p.base_price_minor,
               p.base_price_currency, p.category_id,
               pp.price_min_minor, pp.price_max_minor, pp.price_currency,
               ${productAvailable} AS available
          FROM core.product p
          JOIN core.seller s ON s.id = p.seller_id
          JOIN core.market m ON m.id = p.market_id
         CROSS JOIN ${publicPrice}
         WHERE p.slug = ${slug} AND p.seller_id = ${seller.id}
           AND p.visibility = 'PUBLISHED'`.execute(trx);
      const product = first(p.rows);
      if (!product) throw new AdulisException('NOT_FOUND');
      // Everything below keys on the resolved ID, not on the slug: the
      // slug addresses the product on the wire and the uuid joins it in
      // the database, which is exactly the split doctrine 5 asks for.
      const productId = product.id;
      // Per-Variant sellability from the same projection as the Product's `available`, so an
      // option is never available while its Product is not (OVN-074).
      const variants = await sql<{
        id: string;
        variant_key: string;
        price_minor: string;
        price_currency: string;
        stock_count: number;
        stock_confirmed_at: Date | null;
        status: string;
        available: boolean;
      }>`
        SELECT v.id, v.variant_key, v.price_minor, v.price_currency,
               v.stock_count, v.stock_confirmed_at, v.status,
               (${productTrades} AND ${variantSellable}) AS available
          FROM core.product_variant v
          JOIN core.product p ON p.id = v.product_id
          JOIN core.seller s ON s.id = p.seller_id
          JOIN core.market m ON m.id = p.market_id
         WHERE v.product_id = ${productId} AND v.status = 'ACTIVE'
         ORDER BY v.variant_key`.execute(trx);
      // Codes stay for compatibility; the governed label references (OVN-075) ride beside
      // them. A label key is a locale catalogue key, never prose (0007): a client shows an
      // attribute only when its catalogue holds the key, so a code is never Buyer copy.
      const attributes = await sql<{
        attribute: string;
        label_key: string;
        data_type: 'TEXT' | 'NUMBER' | 'ENUM' | 'BOOLEAN';
        unit: string | null;
        value: string | null;
        value_label_key: string | null;
      }>`
        SELECT ad.code AS attribute, ad.label_key, ad.data_type, ad.unit,
               coalesce(ao.code, pav.value_text,
                        pav.value_number::text, pav.value_boolean::text) AS value,
               ao.label_key AS value_label_key
          FROM core.product_attribute_value pav
          JOIN core.attribute_definition ad ON ad.id = pav.attribute_definition_id
          LEFT JOIN core.attribute_option ao ON ao.id = pav.value_option_id
         WHERE pav.product_id = ${productId}
         ORDER BY ad.code`.execute(trx);
      const images = await sql<{ position: number; thumb_key: string; card_key: string; full_key: string }>`
        SELECT position, thumb_key, card_key, full_key
          FROM core.product_image WHERE product_id = ${productId}
         ORDER BY position`.execute(trx);
      // product_viewed counts Product OPENINGS (OVN-073, founder-approved principle): a read
      // the client declares a technical revalidation records nothing. The declaration can
      // only lower the count, so trusting it adds no forgery the plain GET did not already
      // allow; it is not a de-duplicated unique-visit measure (that needs ANL-01's gated
      // product_post_opened, its client_event_id and a privacy basis -- DPIA PA-23).
      if (revalidate !== 'true') {
        await this.emit(trx, 'product_viewed', seller.market_id, seller.id, {
          product_id: productId,
        });
      }
      return {
        // `available` is the projection's: a CLOSING or BILLING_SUSPENDED storefront stays
        // visible (VISIBLE_STATES) but sells nothing, as fn_create_order requires.
        ...summary(product),
        description: product.description,
        category_id: product.category_id,
        seller: { handle: seller.handle, store_name: seller.store_name },
        variants: variants.rows.map((v) => ({
          ...v,
          price_minor: minorUnits(v.price_minor),
          stock_confirmed_at: v.stock_confirmed_at ? v.stock_confirmed_at.toISOString() : null,
        })),
        attributes: attributes.rows,
        images: images.rows,
      };
    });
  }

  @Get('storefronts/:handle/search')
  // The answer depends on the requester's Market (and is read now): never shared-cached.
  @Header('Cache-Control', 'no-store')
  @Public()
  @ApiOperation({
    summary:
      'Scope is one seller, always (S7.5). Not Marketplace Search. Prices are the ACTIVE Variants\' span, as on the list.',
  })
  @ApiParam({ name: 'handle', description: 'The Seller public handle.' })
  @ApiQuery({ name: 'q', required: true, description: '1-200 characters; matched in name and description.' })
  @ApiOkResponse({ type: StorefrontSearchResultListDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async search(
    @Req() req: LocalizedRequest,
    @Param('handle') handle: string,
    @Query('q') q?: string,
  ): Promise<StorefrontSearchResultListDto> {
    if (!q || q.length > 200) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'q' } });
    }
    return this.tx.run(req, async (trx) => {
      const seller = await this.sellerByHandle(trx, req, handle);
      const r = await sql<ProductSummaryRow>`
        SELECT p.id, p.slug, p.name, p.base_price_minor, p.base_price_currency,
               pp.price_min_minor, pp.price_max_minor, pp.price_currency,
               ${productAvailable} AS available
          FROM core.product p
          JOIN core.seller s ON s.id = p.seller_id
          JOIN core.market m ON m.id = p.market_id
         CROSS JOIN ${publicPrice}
         WHERE p.seller_id = ${seller.id} AND p.visibility = 'PUBLISHED'
           AND (p.name ILIKE '%' || ${q} || '%'
                OR p.description ILIKE '%' || ${q} || '%')
         ORDER BY p.display_order
         LIMIT 25`.execute(trx);
      await this.emit(trx, 'storefront_search_performed', seller.market_id, seller.id);
      return { data: r.rows.map(summary) };
    });
  }

  @Get('storefronts/:handle/reviews')
  // The answer depends on the requester's Market (and is read now): never shared-cached.
  @Header('Cache-Control', 'no-store')
  @Public()
  @ApiOperation({ summary: 'Badge per review (S12); anonymised rows carry no buyer.' })
  async reviews(
    @Req() req: LocalizedRequest,
    @Param('handle') handle: string,
    @Query('cursor') cursor?: string,
  ): Promise<unknown> {
    return this.tx.run(req, async (trx) => {
      const seller = await this.sellerByHandle(trx, req, handle);
      const limit = 25;
      const r = await sql<Record<string, unknown> & { published_at: Date }>`
        SELECT rv.id, rv.seller_rating, rv.body, rv.badge, rv.published_at
          FROM core.review rv
         WHERE rv.seller_id = ${seller.id}
           AND (${cursor ?? null}::timestamptz IS NULL
                OR rv.published_at < ${cursor ?? null}::timestamptz)
         ORDER BY rv.published_at DESC
         LIMIT ${limit + 1}`.execute(trx);
      const data = r.rows.slice(0, limit);
      return {
        data,
        next_cursor:
          r.rows.length > limit ? data[data.length - 1]?.published_at.toISOString() : null,
      };
    });
  }

  @Get('sellers/lookup')
  // The answer depends on the requester's Market (and is read now): never shared-cached.
  @Header('Cache-Control', 'no-store')
  @Public()
  @ApiOperation({ summary: 'Returns sellers only, capped, never suggests (S7.6).' })
  async lookup(@Req() req: LocalizedRequest, @Query('q') q?: string): Promise<unknown> {
    if (!q || q.length > 100) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'q' } });
    }
    return this.tx.run(req, async (trx) => {
      const market = await requesterMarket(trx, req);
      const r = await sql<Record<string, unknown>>`
        SELECT s.handle, s.store_name
          FROM core.seller s
          JOIN core.market m ON m.id = s.market_id
         WHERE s.status::text = ANY(${VISIBLE_STATES})
           AND m.activation_state = 'ACTIVE'
           AND (${market}::uuid IS NULL OR s.market_id = ${market}::uuid)
           AND (s.handle ILIKE ${q} || '%' OR s.store_name ILIKE ${q} || '%')
         ORDER BY s.store_name
         LIMIT 10`.execute(trx);
      return { data: r.rows };
    });
  }

  /**
   * Returns a LIST — one post commonly features several products
   * (S7.5.1). The canonical id comes from the adapter; unresolved and
   * conflicting links are their own analytics events.
   */
  @Post('post-links/resolve')
  @Public()
  @ApiOperation({
    summary:
      'A post link to the LIST of published Products it features (S7.5.1), priced like the list. Idempotency-Key required.',
  })
  @ApiOkResponse({ type: PostLinkProductListDto })
  @ApiDefaultResponse(PROBLEM_RESPONSE)
  async resolve(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PostLinkProductListDto> {
    const body = resolveBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 200, async (trx) => {
      const canonical = await this.postLinks.resolve(body.url);
      if (!canonical) return { data: [] };
      // One post may feature Products of Sellers in different Markets: only the requester's
      // Market's, when it is known; never an inactive Market's.
      const market = await requesterMarket(trx, req);
      const r = await sql<ProductSummaryRow & { seller_handle: string }>`
        SELECT p.id, p.slug, p.name, p.base_price_minor, p.base_price_currency,
               pp.price_min_minor, pp.price_max_minor, pp.price_currency,
               ${productAvailable} AS available,
               s.handle AS seller_handle
          FROM core.social_post sp
          JOIN core.product_social_post psp ON psp.social_post_id = sp.id
          JOIN core.product p ON p.id = psp.product_id
          JOIN core.seller s ON s.id = p.seller_id
          JOIN core.market m ON m.id = p.market_id
         CROSS JOIN ${publicPrice}
         WHERE sp.canonical_post_id = ${canonical.canonicalPostId}
           AND p.visibility = 'PUBLISHED'
           AND s.status::text = ANY(${VISIBLE_STATES})
           AND m.activation_state = 'ACTIVE'
           AND (${market}::uuid IS NULL OR p.market_id = ${market}::uuid)
         ORDER BY p.id
         LIMIT 25`.execute(trx);
      return { data: r.rows.map((row) => ({ ...summary(row), seller_handle: row.seller_handle })) };
    });
  }

  @Get('categories')
  @Public()
  async categories(@Req() req: LocalizedRequest): Promise<unknown> {
    return this.tx.run(req, async (trx) => {
      const r = await sql<Record<string, unknown>>`
        SELECT c.id, c.code, c.parent_id
          FROM core.category c
         ORDER BY c.code`.execute(trx);
      return { data: r.rows };
    });
  }
}
