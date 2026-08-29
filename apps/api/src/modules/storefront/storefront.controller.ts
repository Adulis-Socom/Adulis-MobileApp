import { Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
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

  private async sellerByHandle(
    trx: Transaction<Database>,
    handle: string,
  ): Promise<SellerRow> {
    const r = await sql<SellerRow>`
      SELECT id, market_id, store_name, handle, description, status
        FROM core.seller
       WHERE handle = ${handle}
         AND status::text = ANY(${VISIBLE_STATES})`.execute(trx);
    const seller = first(r.rows);
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
  @Public()
  @ApiOperation({ summary: 'Header, stats, trust level, availability — one round trip (S3.1).' })
  async storefront(@Req() req: LocalizedRequest, @Param('handle') handle: string): Promise<unknown> {
    return this.tx.run(req, async (trx) => {
      const seller = await this.sellerByHandle(trx, handle);
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
  @Public()
  @ApiOperation({ summary: "Seller's display order is the default (S7.5); lean by design (S14)." })
  async products(@Req() req: LocalizedRequest, @Param('handle') handle: string): Promise<unknown> {
    return this.tx.run(req, async (trx) => {
      const seller = await this.sellerByHandle(trx, handle);
      const r = await sql<Record<string, unknown>>`
        SELECT p.id, p.slug, p.name, p.base_price_minor, p.base_price_currency,
               p.display_order,
               (SELECT i.card_key FROM core.product_image i
                 WHERE i.product_id = p.id ORDER BY i.position LIMIT 1) AS image_key
          FROM core.product p
         WHERE p.seller_id = ${seller.id} AND p.published_at IS NOT NULL
         ORDER BY p.display_order, p.created_at
         LIMIT 100`.execute(trx);
      return { data: r.rows };
    });
  }

  @Get('storefronts/:handle/products/:slug')
  @Public()
  @ApiOperation({ summary: 'Structured attributes, variants, stock with confirmed_at.' })
  async product(
    @Req() req: LocalizedRequest,
    @Param('handle') handle: string,
    @Param('slug') slug: string,
  ): Promise<unknown> {
    // No UUID guard any more: a slug is free text within a seller, and the
    // scope check is the (seller_id, slug) lookup itself. An unknown slug
    // is the ordinary 404 below, which is also what a wrong-seller slug
    // gets -- a storefront must not confirm that a product exists
    // elsewhere.
    return this.tx.run(req, async (trx) => {
      const seller = await this.sellerByHandle(trx, handle);
      const p = await sql<{ id: string } & Record<string, unknown>>`
        SELECT p.id, p.slug, p.name, p.description, p.base_price_minor,
               p.base_price_currency, p.category_id
          FROM core.product p
         WHERE p.slug = ${slug} AND p.seller_id = ${seller.id}
           AND p.published_at IS NOT NULL`.execute(trx);
      const product = first(p.rows);
      if (!product) throw new AdulisException('NOT_FOUND');
      // Everything below keys on the resolved ID, not on the slug: the
      // slug addresses the product on the wire and the uuid joins it in
      // the database, which is exactly the split doctrine 5 asks for.
      const productId = product.id;
      const variants = await sql<Record<string, unknown>>`
        SELECT v.id, v.variant_key, v.price_minor, v.price_currency,
               v.stock_count, v.stock_confirmed_at, v.status
          FROM core.product_variant v
         WHERE v.product_id = ${productId} AND v.status = 'ACTIVE'
         ORDER BY v.variant_key`.execute(trx);
      const attributes = await sql<Record<string, unknown>>`
        SELECT ad.code AS attribute,
               coalesce(ao.code, pav.value_text,
                        pav.value_number::text, pav.value_boolean::text) AS value
          FROM core.product_attribute_value pav
          JOIN core.attribute_definition ad ON ad.id = pav.attribute_definition_id
          LEFT JOIN core.attribute_option ao ON ao.id = pav.value_option_id
         WHERE pav.product_id = ${productId}`.execute(trx);
      const images = await sql<Record<string, unknown>>`
        SELECT position, thumb_key, card_key, full_key
          FROM core.product_image WHERE product_id = ${productId}
         ORDER BY position`.execute(trx);
      await this.emit(trx, 'product_viewed', seller.market_id, seller.id, {
        product_id: productId,
      });
      return { ...product, variants: variants.rows, attributes: attributes.rows, images: images.rows };
    });
  }

  @Get('storefronts/:handle/search')
  @Public()
  @ApiOperation({ summary: 'Scope is one seller, always (S7.5).' })
  async search(
    @Req() req: LocalizedRequest,
    @Param('handle') handle: string,
    @Query('q') q?: string,
  ): Promise<unknown> {
    if (!q || q.length > 200) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'q' } });
    }
    return this.tx.run(req, async (trx) => {
      const seller = await this.sellerByHandle(trx, handle);
      const r = await sql<Record<string, unknown>>`
        SELECT p.id, p.name, p.base_price_minor, p.base_price_currency
          FROM core.product p
         WHERE p.seller_id = ${seller.id} AND p.published_at IS NOT NULL
           AND (p.name ILIKE '%' || ${q} || '%'
                OR p.description ILIKE '%' || ${q} || '%')
         ORDER BY p.display_order
         LIMIT 25`.execute(trx);
      await this.emit(trx, 'storefront_search_performed', seller.market_id, seller.id);
      return { data: r.rows };
    });
  }

  @Get('storefronts/:handle/reviews')
  @Public()
  @ApiOperation({ summary: 'Badge per review (S12); anonymised rows carry no buyer.' })
  async reviews(
    @Req() req: LocalizedRequest,
    @Param('handle') handle: string,
    @Query('cursor') cursor?: string,
  ): Promise<unknown> {
    return this.tx.run(req, async (trx) => {
      const seller = await this.sellerByHandle(trx, handle);
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
  @Public()
  @ApiOperation({ summary: 'Returns sellers only, capped, never suggests (S7.6).' })
  async lookup(@Req() req: LocalizedRequest, @Query('q') q?: string): Promise<unknown> {
    if (!q || q.length > 100) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'q' } });
    }
    return this.tx.run(req, async (trx) => {
      const r = await sql<Record<string, unknown>>`
        SELECT s.handle, s.store_name
          FROM core.seller s
         WHERE s.status::text = ANY(${VISIBLE_STATES})
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
  async resolve(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const body = resolveBody.parse(req.body);
    return this.tx.runIdempotent(req as LocalizedRequest, res, 200, async (trx) => {
      const canonical = await this.postLinks.resolve(body.url);
      if (!canonical) return { data: [] };
      const r = await sql<Record<string, unknown>>`
        SELECT p.id, p.slug, p.name, p.base_price_minor, p.base_price_currency,
               s.handle AS seller_handle
          FROM core.social_post sp
          JOIN core.product_social_post psp ON psp.social_post_id = sp.id
          JOIN core.product p ON p.id = psp.product_id
          JOIN core.seller s ON s.id = p.seller_id
         WHERE sp.canonical_post_id = ${canonical.canonicalPostId}
           AND p.published_at IS NOT NULL
           AND s.status::text = ANY(${VISIBLE_STATES})
         LIMIT 25`.execute(trx);
      return { data: r.rows };
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
