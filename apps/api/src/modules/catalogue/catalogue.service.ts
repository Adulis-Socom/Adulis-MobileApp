import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../common/db/database.types';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import { assertPermission } from '../../common/auth/permission';
import { AdulisException } from '../../common/errors/adulis-exception';
import {
  MEDIA_STORAGE_ADAPTER,
  type MediaStorageAdapter,
} from './media-storage.adapter';
import { POST_LINK_ADAPTER, type PostLinkAdapter } from './post-link.adapter';
import type {
  AttributeValue,
  CreateProductBody,
  CreateVariantBody,
  ImageBody,
  ImageOrderBody,
  PatchProductBody,
  PatchVariantBody,
  SocialPostBody,
  StockBody,
  VideoBody,
} from './catalogue.schemas';

/**
 * C2 — catalogue, media and stock (ADU-API-01 v1.6 section 12.10).
 *
 * The three rules that shape everything here:
 *  - media never transits the API (signed URL out, HEAD-validated commit
 *    in, no `sharp`, no original anywhere);
 *  - stock never moves without an EVENT — the endpoint writes a
 *    stock_event and the trigger does the arithmetic, oversell being a
 *    transaction failure;
 *  - publish/unpublish are the named database functions, nothing else.
 */

const IMAGE_CAPS = {
  // Derivative byte caps. No document rules the numbers; generous bounds
  // that a phone-resized WebP sits far under, recorded here rather than
  // invisible.
  thumb: 256 * 1024,
  card: 1024 * 1024,
  full: 5 * 1024 * 1024,
} as const;
const VIDEO_CAP_BYTES = 50 * 1024 * 1024;

@Injectable()
export class CatalogueService {
  constructor(
    @Inject(MEDIA_STORAGE_ADAPTER) private readonly storage: MediaStorageAdapter,
    @Inject(POST_LINK_ADAPTER) private readonly links: PostLinkAdapter,
  ) {}

  // ---------------------------------------------------------------- products

  async createProduct(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: CreateProductBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.products:write');
    const id = randomUUID();
    await sql`
      INSERT INTO core.product
        (id, seller_id, market_id, name, description, category_id,
         base_price_minor, base_price_currency, visibility)
      SELECT ${id}, s.id, s.market_id, ${body.name}, ${body.description ?? null},
             ${body.category_id ?? null}, ${body.base_price_minor},
             ${body.base_price_currency}, 'DRAFT'
        FROM core.seller s WHERE s.id = ${req.ctx?.sellerId}`.execute(trx);
    if (body.attributes) {
      await this.writeProductAttributes(trx, id, body.attributes);
    }
    return { product_id: id, visibility: 'DRAFT' };
  }

  async listProducts(
    trx: Transaction<Database>,
    req: AuthedRequest,
    limit: number,
    cursor: string | undefined,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.products:read');

    /**
     * T22 Phase 4.1 -- SC-07 could not draw a grid because this list carried no
     * image reference at all.
     *
     * TRANSCRIBED, NOT DESIGNED: the storefront list already runs this exact
     * correlated subquery (storefront.controller.ts), and two lists of the same
     * products disagreeing about whether a product has a picture is the class
     * this repository keeps finding.
     *
     * THE CARD DERIVATIVE, AND ONLY IT. A list of forty products pulling three
     * derivatives each is 120 URLs to render forty thumbnails. Lowest position
     * is the primary image, by the same rule the storefront uses.
     *
     * The field is `image_key`, NOT `image_url`. The API returns bare keys and
     * /v1/bootstrap owns the origin -- and `*_url` is one of the three tokens
     * Appendix C check 1 polices. It adds no column and no migration, so it
     * cannot touch the `original_key` load-bearing absence: that absence
     * forbids a COLUMN naming the upload as received, and this is a projection
     * of an existing one.
     */
    const r = await sql<{
      id: string;
      name: string;
      visibility: string;
      base_price_minor: string;
      base_price_currency: string;
      display_order: number;
      created_at: Date;
      image_key: string | null;
    }>`
      SELECT p.id, p.name, p.visibility::text, p.base_price_minor,
             p.base_price_currency, p.display_order, p.created_at,
             -- the card derivative of the lowest-position image; see above
             (SELECT i.card_key FROM core.product_image i
               WHERE i.product_id = p.id ORDER BY i.position LIMIT 1) AS image_key
        FROM core.product p
       WHERE p.seller_id = ${req.ctx?.sellerId}
         AND (${cursor ?? null}::uuid IS NULL OR p.id > ${cursor ?? null}::uuid)
       ORDER BY p.id
       LIMIT ${limit + 1}`.execute(trx);
    const page = r.rows.slice(0, limit);

    /**
     * T22 Phase 4.2 -- THE CAP COUNTER, which ADU-CON-03 S8 specifies and no
     * endpoint could answer.
     *
     * "The product cap is the INTERSECTION of tier and level, and the counter
     * must say which one binds ... '10 of unlimited' is a bug report waiting to
     * be filed." `billing.fn_effective_limit` already computed the
     * intersection and threw both operands away one line after reading them,
     * and NO HTTP ENDPOINT CALLED IT for PRODUCT_COUNT at all -- so even the
     * collapsed number never reached the wire.
     *
     * It rides on the list rather than a new endpoint: S8 names the counter as
     * a REGION of this screen, the screen makes one request, `used` has to be a
     * server-side count because the list is paginated, and `seats` on the team
     * list already set the precedent for hanging a limit off a collection.
     */
    const lim = await sql<{ effective: Record<string, unknown> }>`
      SELECT billing.fn_effective_limit(${req.ctx?.sellerId}, 'PRODUCT_COUNT') AS effective`.execute(trx);
    const used = await sql<{ n: string }>`
      SELECT count(*)::int AS n FROM core.product
       WHERE seller_id = ${req.ctx?.sellerId} AND visibility = 'PUBLISHED'`.execute(trx);
    const eff = (lim.rows[0]?.effective ?? {}) as Record<string, unknown>;

    return {
      data: page.map((p) => ({
        id: p.id,
        name: p.name,
        visibility: p.visibility,
        base_price: { amount_minor: Number(p.base_price_minor), currency: p.base_price_currency },
        display_order: p.display_order,
        image_key: p.image_key,
      })),
      publication: {
        // `allowed:false` is the FAIL-CLOSED branch -- NO_TIER_DEFINITION or
        // NO_LADDER_CONFIG -- and it is NOT the same as "no cap is in force".
        // Collapsing the two would tell a seller who cannot publish at all that
        // nothing limits them, which is the opposite of the truth.
        resolved: eff['allowed'] === true,
        reason: eff['reason'] ?? null,
        used: Number(used.rows[0]?.n ?? 0),
        cap: eff['cap'] === null || eff['cap'] === undefined ? null : Number(eff['cap']),
        tier_cap: eff['tier_cap'] === null || eff['tier_cap'] === undefined ? null : Number(eff['tier_cap']),
        level_cap: eff['level_cap'] === null || eff['level_cap'] === undefined ? null : Number(eff['level_cap']),
        // TIER | LEVEL | BOTH | NONE. BOTH when the two operands are equal and
        // non-null, because naming one of them there would be a coin flip.
        binding: eff['binding'] ?? 'NONE',
        level: eff['level'] ?? null,
      },
      has_more: r.rows.length > limit,
      next_cursor: r.rows.length > limit ? page[page.length - 1]?.id : null,
    };
  }

  /** The editor's read: variants, attributes, media, social posts, state. */
  async getProduct(
    trx: Transaction<Database>,
    req: AuthedRequest,
    productId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.products:read');
    const p = await sql<Record<string, unknown>>`
      SELECT id, name, description, category_id, visibility::text,
             unpublished_reason::text, base_price_minor, base_price_currency,
             display_order, published_at
        FROM core.product
       WHERE id = ${productId} AND seller_id = ${req.ctx?.sellerId}`.execute(trx);
    const product = p.rows[0];
    if (!product) throw new AdulisException('NOT_FOUND');

    const variants = await sql<Record<string, unknown>>`
      SELECT id, variant_key, price_minor, price_currency, stock_count,
             stock_confirmed_at, status
        FROM core.product_variant WHERE product_id = ${productId}
       ORDER BY variant_key`.execute(trx);
    const images = await sql<Record<string, unknown>>`
      SELECT id, position, thumb_key, card_key, full_key
        FROM core.product_image WHERE product_id = ${productId}
       ORDER BY position`.execute(trx);
    const video = await sql<Record<string, unknown>>`
      SELECT key, duration_seconds, height_px, bytes
        FROM core.product_video WHERE product_id = ${productId}`.execute(trx);
    const attrs = await sql<Record<string, unknown>>`
      SELECT attribute_definition_id, value_text, value_number,
             value_option_id, value_boolean
        FROM core.product_attribute_value WHERE product_id = ${productId}`.execute(trx);
    const posts = await sql<Record<string, unknown>>`
      SELECT sp.platform::text, sp.canonical_post_id
        FROM core.product_social_post psp
        JOIN core.social_post sp ON sp.id = psp.social_post_id
       WHERE psp.product_id = ${productId}`.execute(trx);

    return {
      ...product,
      base_price: {
        amount_minor: Number(product['base_price_minor']),
        currency: product['base_price_currency'],
      },
      variants: variants.rows,
      images: images.rows,
      video: video.rows[0] ?? null,
      attributes: attrs.rows,
      social_posts: posts.rows,
    };
  }

  async patchProduct(
    trx: Transaction<Database>,
    req: AuthedRequest,
    productId: string,
    body: PatchProductBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.products:write');
    const r = await sql<{ id: string }>`
      UPDATE core.product
         SET name = coalesce(${body.name ?? null}, name),
             description = coalesce(${body.description ?? null}, description),
             category_id = coalesce(${body.category_id ?? null}, category_id),
             base_price_minor = coalesce(${body.base_price_minor ?? null}, base_price_minor),
             display_order = coalesce(${body.display_order ?? null}, display_order)
       WHERE id = ${productId} AND seller_id = ${req.ctx?.sellerId}
       RETURNING id`.execute(trx);
    if (!r.rows[0]) throw new AdulisException('NOT_FOUND');
    if (body.attributes) {
      await this.writeProductAttributes(trx, productId, body.attributes);
    }
    return { updated: true };
  }

  async publishProduct(
    trx: Transaction<Database>,
    req: AuthedRequest,
    productId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.products:publish');
    try {
      await sql`SELECT core.fn_publish_product(${productId}, ${req.ctx?.sellerId})`.execute(trx);
    } catch (e) {
      // The function raises ONE restrict_violation carrying every
      // unsatisfied item in DETAIL; here it becomes the documented 409
      // PUBLICATION_BLOCKED with items[] (the translator's generic 23001
      // reading cannot know this endpoint's code, so the handler does).
      const pg = e as { code?: string; detail?: string; message?: string };
      if (pg.code === '23001' && pg.detail) {
        const items = (JSON.parse(pg.detail) as Array<Record<string, unknown>>).map((i) => ({
          code: String(i['code']),
          message_key: `error.seller.${String(i['code']).toLowerCase()}`,
          slots: i,
        }));
        const top = items.some((i) => i.code !== 'PUBLICATION_BLOCKED')
          ? (items.find((i) => i.code !== 'PUBLICATION_BLOCKED')?.code as
              | 'TIER_LIMIT_REACHED'
              | 'LEVEL_LIMIT_REACHED')
          : 'PUBLICATION_BLOCKED';
        throw new AdulisException(top ?? 'PUBLICATION_BLOCKED', { items });
      }
      throw e;
    }
    return { visibility: 'PUBLISHED' };
  }

  async unpublishProduct(
    trx: Transaction<Database>,
    req: AuthedRequest,
    productId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.products:publish');
    await sql`SELECT core.fn_unpublish_product(
      ${productId}, ${req.ctx?.sellerId}, 'SELLER')`.execute(trx);
    return { visibility: 'UNPUBLISHED' };
  }

  async deleteProduct(
    trx: Transaction<Database>,
    req: AuthedRequest,
    productId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.products:write');
    const live = await sql<{ n: number }>`
      SELECT count(*)::int AS n
        FROM core.reservation r
        JOIN core.product_variant v ON v.id = r.variant_id
       WHERE v.product_id = ${productId} AND r.state = 'ACTIVE'`.execute(trx);
    if ((live.rows[0]?.n ?? 0) > 0) {
      throw new AdulisException('PRODUCT_HAS_ACTIVE_ORDERS');
    }
    try {
      await sql`DELETE FROM core.product_attribute_value WHERE product_id = ${productId}`.execute(trx);
      await sql`DELETE FROM core.variant_attribute_value WHERE variant_id IN
        (SELECT id FROM core.product_variant WHERE product_id = ${productId})`.execute(trx);
      await sql`DELETE FROM core.product_image WHERE product_id = ${productId}`.execute(trx);
      await sql`DELETE FROM core.product_video WHERE product_id = ${productId}`.execute(trx);
      await sql`DELETE FROM core.product_social_post WHERE product_id = ${productId}`.execute(trx);
      await sql`DELETE FROM core.product_variant
                 WHERE product_id = ${productId} AND seller_id = ${req.ctx?.sellerId}`.execute(trx);
      const r = await sql<{ id: string }>`
        DELETE FROM core.product
         WHERE id = ${productId} AND seller_id = ${req.ctx?.sellerId}
         RETURNING id`.execute(trx);
      if (!r.rows[0]) throw new AdulisException('NOT_FOUND');
    } catch (e) {
      // A historical order still references a variant: the FK refuses, and
      // the honest answer is the same 409 — the record must outlive the
      // product's storefront life. Unpublish is the path that always works.
      if ((e as { code?: string }).code === '23503') {
        throw new AdulisException('PRODUCT_HAS_ACTIVE_ORDERS', {
          slots: { reason: 'HISTORICAL_ORDERS_RETAIN_THE_RECORD' },
        });
      }
      throw e;
    }
    return { deleted: true };
  }

  // ---------------------------------------------------------------- variants

  async createVariant(
    trx: Transaction<Database>,
    req: AuthedRequest,
    productId: string,
    body: CreateVariantBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.products:write');
    const owner = await sql<{ id: string }>`
      SELECT id FROM core.product
       WHERE id = ${productId} AND seller_id = ${req.ctx?.sellerId}`.execute(trx);
    if (!owner.rows[0]) throw new AdulisException('NOT_FOUND');
    const id = randomUUID();
    await sql`
      INSERT INTO core.product_variant
        (id, product_id, seller_id, variant_key, price_minor, price_currency)
      VALUES (${id}, ${productId}, ${req.ctx?.sellerId}, ${body.variant_key},
              ${body.price_minor}, ${body.price_currency})`.execute(trx);
    if (body.attributes) {
      await this.writeVariantAttributes(trx, id, body.attributes);
    }
    return { variant_id: id };
  }

  async patchVariant(
    trx: Transaction<Database>,
    req: AuthedRequest,
    variantId: string,
    body: PatchVariantBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.products:write');
    const r = await sql<{ id: string }>`
      UPDATE core.product_variant
         SET price_minor = coalesce(${body.price_minor ?? null}, price_minor),
             status = coalesce(${body.status ?? null}, status)
       WHERE id = ${variantId} AND seller_id = ${req.ctx?.sellerId}
       RETURNING id`.execute(trx);
    if (!r.rows[0]) throw new AdulisException('NOT_FOUND');
    if (body.attributes) {
      await this.writeVariantAttributes(trx, variantId, body.attributes);
    }
    return { updated: true };
  }

  /** DELETE withdraws — VARIANT_WITHDRAWN already exists as a cart code. */
  async deleteVariant(
    trx: Transaction<Database>,
    req: AuthedRequest,
    variantId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.products:write');
    const live = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM core.reservation
       WHERE variant_id = ${variantId} AND state = 'ACTIVE'`.execute(trx);
    if ((live.rows[0]?.n ?? 0) > 0) {
      throw new AdulisException('VARIANT_HAS_ACTIVE_ORDERS');
    }
    const r = await sql<{ id: string }>`
      UPDATE core.product_variant SET status = 'WITHDRAWN'
       WHERE id = ${variantId} AND seller_id = ${req.ctx?.sellerId}
       RETURNING id`.execute(trx);
    if (!r.rows[0]) throw new AdulisException('NOT_FOUND');
    return { withdrawn: true };
  }

  // ------------------------------------------------------------------- media

  async handleImage(
    trx: Transaction<Database>,
    req: AuthedRequest,
    productId: string,
    body: ImageBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.media:write');
    const owner = await sql<{ id: string }>`
      SELECT id FROM core.product
       WHERE id = ${productId} AND seller_id = ${req.ctx?.sellerId}`.execute(trx);
    if (!owner.rows[0]) throw new AdulisException('NOT_FOUND');

    if (body.action === 'REQUEST_UPLOAD') {
      // THE PRE-MINT CAP CHECK (T20 S4). The structural cap -- UNIQUE
      // (product_id, position), positions 1..5 -- stops a sixth ROW at COMMIT.
      // It does NOT stop a sixth URL being minted, and a signed URL that can
      // never be committed is one that should never have existed: it invites a
      // client to resize, upload and then fail, and it is a presigned write
      // credential handed out for nothing. A presigned upload has two places to
      // check a cap and this is the one that is right -- before any bytes move.
      const count = await sql<{ n: number }>`
        SELECT count(*)::int AS n FROM core.product_image
         WHERE product_id = ${productId}`.execute(trx);
      if ((count.rows[0]?.n ?? 0) >= 5) {
        throw new AdulisException('VALIDATION_FAILED', {
          status: 409,
          slots: { reason: 'IMAGE_CAP_REACHED', max: 5 },
        });
      }
      // Server-minted keys: a commit can only name keys this API chose.
      // POSITION IS NOT IN THE KEY (T20 S4.4). It used to be --
      // products/{id}/img/{position}/{uuid}/ -- but reorder assigns final
      // positions directly (0048), so after the first reorder the path said
      // img/1/ for an image at position 3: a lying segment. Keys are opaque
      // (a randomUUID() segment is the only thing that must be unguessable),
      // nothing derives position from a key, and there are no production
      // objects, so dropping it is free and removes the lie.
      const base = `products/${productId}/img/${randomUUID()}`;
      const [thumb, card, full] = await Promise.all([
        this.storage.signPut(`${base}/thumb.webp`, 'image/webp', IMAGE_CAPS.thumb),
        this.storage.signPut(`${base}/card.webp`, 'image/webp', IMAGE_CAPS.card),
        this.storage.signPut(`${base}/full.webp`, 'image/webp', IMAGE_CAPS.full),
      ]);
      return { position: body.position, uploads: { thumb, card, full } };
    }

    // COMMIT — validate what actually landed before a row exists.
    for (const [kind, key, cap] of [
      ['thumb', body.thumb_key, IMAGE_CAPS.thumb],
      ['card', body.card_key, IMAGE_CAPS.card],
      ['full', body.full_key, IMAGE_CAPS.full],
    ] as const) {
      if (!key.startsWith(`products/${productId}/img/`)) {
        throw new AdulisException('VALIDATION_FAILED', { slots: { path: `${kind}_key` } });
      }
      const obj = await this.storage.inspect(key);
      if (!obj) {
        throw new AdulisException('VALIDATION_FAILED', {
          status: 409,
          slots: { reason: 'OBJECT_NOT_UPLOADED', which: kind },
        });
      }
      if (obj.bytes > cap) {
        throw new AdulisException('PAYLOAD_TOO_LARGE', {
          slots: { which: kind, max_bytes: cap, bytes: obj.bytes },
        });
      }
    }

    try {
      await sql`
        INSERT INTO core.product_image
          (id, product_id, position, thumb_key, card_key, full_key)
        VALUES (${randomUUID()}, ${productId}, ${body.position},
                ${body.thumb_key}, ${body.card_key}, ${body.full_key})`.execute(trx);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw new AdulisException('VALIDATION_FAILED', {
          status: 409,
          slots: { reason: 'POSITION_TAKEN', position: body.position },
        });
      }
      throw e;
    }
    return { position: body.position, committed: true };
  }

  async deleteImage(
    trx: Transaction<Database>,
    req: AuthedRequest,
    productId: string,
    position: number,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.media:write');
    const r = await sql<{ thumb_key: string; card_key: string; full_key: string }>`
      DELETE FROM core.product_image pi
       USING core.product p
       WHERE pi.product_id = p.id AND p.seller_id = ${req.ctx?.sellerId}
         AND pi.product_id = ${productId} AND pi.position = ${position}
       RETURNING pi.thumb_key, pi.card_key, pi.full_key`.execute(trx);
    const row = r.rows[0];
    if (!row) throw new AdulisException('NOT_FOUND');
    // A lifecycle row is a SCHEDULED PURGE (purge_after is NOT NULL by
    // schema): rows are written when an object leaves service, and the
    // daily media.lifecycle job collects what is due. 30 days' grace is a
    // recovery window, not a ruled value.
    for (const key of [row.thumb_key, row.card_key, row.full_key]) {
      await sql`
        INSERT INTO core.media_lifecycle (object_key, class, purge_after, reason)
        VALUES (${key}, 'INFREQUENT', now() + interval '30 days', 'IMAGE_DELETED')
        ON CONFLICT (object_key) DO UPDATE
          SET purge_after = EXCLUDED.purge_after, reason = EXCLUDED.reason`.execute(trx);
    }
    return null;
  }

  /** The whole ordering in one transaction, or it is a defect. */
  async reorderImages(
    trx: Transaction<Database>,
    req: AuthedRequest,
    productId: string,
    body: ImageOrderBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.media:write');
    const owner = await sql<{ id: string }>`
      SELECT p.id FROM core.product p
       WHERE p.id = ${productId} AND p.seller_id = ${req.ctx?.sellerId}`.execute(trx);
    if (!owner.rows[0]) throw new AdulisException('NOT_FOUND');

    /*
     * ONE PASS, FINAL POSITIONS, no parking. The previous shape parked rows at
     * 100, 101, ... to clear the UNIQUE range and could never work: position
     * carries CHECK (position BETWEEN 1 AND 5), so the first parking UPDATE
     * raised 23514. Migration 0048 makes the UNIQUE deferrable instead, so
     * every value written here is inside 1..5 at every step and uniqueness is
     * checked where it is actually required -- at COMMIT.
     *
     * VALIDATE BEFORE WRITING, and not only out of tidiness. A deferred unique
     * violation surfaces at COMMIT with no statement context, so a caller who
     * sends a duplicate id would otherwise receive an opaque 23505 from the end
     * of the transaction. Everything checkable is therefore checked first: the
     * ids must be distinct, and they must be exactly the images this product
     * has. A partial order is refused too -- reordering three of five images
     * would leave the other two holding positions the new order also claims,
     * and "the whole ordering in one transaction, or it is a defect" is this
     * endpoint's own rule.
     */
    const seen = new Set(body.order);
    if (seen.size !== body.order.length) {
      throw new AdulisException('VALIDATION_FAILED', {
        slots: { reason: 'DUPLICATE_IMAGE', path: 'order' },
      });
    }

    const existing = await sql<{ id: string }>`
      SELECT id FROM core.product_image
       WHERE product_id = ${productId}
       ORDER BY position`.execute(trx);
    const known = new Set(existing.rows.map((r) => r.id));

    for (const imageId of body.order) {
      if (!known.has(imageId)) {
        throw new AdulisException('VALIDATION_FAILED', {
          slots: { reason: 'UNKNOWN_IMAGE', image_id: imageId },
        });
      }
    }
    if (body.order.length !== known.size) {
      throw new AdulisException('VALIDATION_FAILED', {
        slots: { reason: 'PARTIAL_ORDER', expected: known.size, received: body.order.length },
      });
    }

    // Opt THIS transaction into deferred uniqueness. The constraint is
    // DEFERRABLE INITIALLY IMMEDIATE (0048), so every other writer keeps the
    // immediate, attributable 23505 that tells a seller POSITION_TAKEN; only
    // the reorder needs to pass through a state where two rows share a
    // position, and only until this transaction commits.
    await sql`SET CONSTRAINTS core.product_image_position DEFERRED`.execute(trx);

    let pos = 1;
    for (const imageId of body.order) {
      await sql`
        UPDATE core.product_image SET position = ${pos}
         WHERE id = ${imageId} AND product_id = ${productId}`.execute(trx);
      pos += 1;
    }
    return { order: body.order };
  }

  async handleVideo(
    trx: Transaction<Database>,
    req: AuthedRequest,
    productId: string,
    body: VideoBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.media:write');
    const owner = await sql<{ id: string }>`
      SELECT id FROM core.product
       WHERE id = ${productId} AND seller_id = ${req.ctx?.sellerId}`.execute(trx);
    if (!owner.rows[0]) throw new AdulisException('NOT_FOUND');

    if (body.action === 'REQUEST_UPLOAD') {
      const upload = await this.storage.signPut(
        `products/${productId}/video/${randomUUID()}.mp4`,
        'video/mp4',
        VIDEO_CAP_BYTES,
      );
      return { upload };
    }

    const obj = await this.storage.inspect(body.key);
    if (!obj) {
      throw new AdulisException('VALIDATION_FAILED', {
        status: 409,
        slots: { reason: 'OBJECT_NOT_UPLOADED' },
      });
    }
    if (obj.bytes > VIDEO_CAP_BYTES) {
      throw new AdulisException('PAYLOAD_TOO_LARGE', {
        slots: { max_bytes: VIDEO_CAP_BYTES, bytes: obj.bytes },
      });
    }
    await sql`
      INSERT INTO core.product_video (id, product_id, key, duration_seconds, height_px, bytes)
      VALUES (${randomUUID()}, ${productId}, ${body.key},
              ${body.duration_seconds}, ${body.height_px}, ${obj.bytes})
      ON CONFLICT (product_id) DO UPDATE SET
        key = EXCLUDED.key, duration_seconds = EXCLUDED.duration_seconds,
        height_px = EXCLUDED.height_px, bytes = EXCLUDED.bytes,
        uploaded_at = now()`.execute(trx);
    return { committed: true };
  }

  async deleteVideo(
    trx: Transaction<Database>,
    req: AuthedRequest,
    productId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.media:write');
    const r = await sql<{ key: string }>`
      DELETE FROM core.product_video pv
       USING core.product p
       WHERE pv.product_id = p.id AND p.seller_id = ${req.ctx?.sellerId}
         AND pv.product_id = ${productId}
       RETURNING pv.key`.execute(trx);
    if (!r.rows[0]) throw new AdulisException('NOT_FOUND');
    await sql`
      INSERT INTO core.media_lifecycle (object_key, class, purge_after, reason)
      VALUES (${r.rows[0].key}, 'INFREQUENT', now() + interval '30 days', 'VIDEO_DELETED')
      ON CONFLICT (object_key) DO UPDATE
        SET purge_after = EXCLUDED.purge_after, reason = EXCLUDED.reason`.execute(trx);
    return null;
  }

  // ------------------------------------------------------------ social posts

  async attachSocialPost(
    trx: Transaction<Database>,
    req: AuthedRequest,
    productId: string,
    body: SocialPostBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.products:write');
    const owner = await sql<{ id: string }>`
      SELECT id FROM core.product
       WHERE id = ${productId} AND seller_id = ${req.ctx?.sellerId}`.execute(trx);
    if (!owner.rows[0]) throw new AdulisException('NOT_FOUND');

    const canonical = await this.links.resolve(body.url);
    if (!canonical) {
      throw new AdulisException('VALIDATION_FAILED', {
        status: 422,
        slots: { reason: 'POST_LINK_UNRESOLVED' },
      });
    }

    const post = await sql<{ id: string }>`
      INSERT INTO core.social_post (id, platform, canonical_post_id, status)
      VALUES (${randomUUID()}, ${canonical.platform}, ${canonical.canonicalPostId}, 'LIVE')
      ON CONFLICT (platform, canonical_post_id)
      DO UPDATE SET status = core.social_post.status
      RETURNING id`.execute(trx);
    const postId = post.rows[0]?.id as string;

    // One post, many products — BY THE SAME SELLER (S9.6). A post another
    // seller has claimed is a moderation question, not a search result and
    // not an attach.
    const claimed = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM core.product_social_post
       WHERE social_post_id = ${postId} AND seller_id <> ${req.ctx?.sellerId}`.execute(trx);
    if ((claimed.rows[0]?.n ?? 0) > 0) {
      await sql`
        INSERT INTO core.moderation_queue_item (kind, target_kind, target_id)
        VALUES ('POST_LINK_CONFLICT', 'PRODUCT', ${productId})`.execute(trx);
      throw new AdulisException('VALIDATION_FAILED', {
        status: 409,
        slots: { reason: 'POST_LINK_CONFLICT' },
      });
    }

    await sql`
      INSERT INTO core.product_social_post (product_id, seller_id, social_post_id)
      VALUES (${productId}, ${req.ctx?.sellerId}, ${postId})
      ON CONFLICT DO NOTHING`.execute(trx);
    return {
      platform: canonical.platform,
      canonical_post_id: canonical.canonicalPostId,
    };
  }

  // ------------------------------------------------------------------- stock

  async writeStock(
    trx: Transaction<Database>,
    req: AuthedRequest,
    variantId: string,
    body: StockBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.stock:write');
    // Lock the variant row: an absolute count is a delta computed against
    // the count AS OF THIS TRANSACTION, and two concurrent sets must
    // serialise rather than both computing against the same snapshot.
    const v = await sql<{ stock_count: number }>`
      SELECT stock_count FROM core.product_variant
       WHERE id = ${variantId} AND seller_id = ${req.ctx?.sellerId}
       FOR UPDATE`.execute(trx);
    const row = v.rows[0];
    if (!row) throw new AdulisException('NOT_FOUND');

    const delta = body.delta ?? (body.count as number) - row.stock_count;
    if (delta === 0) {
      return { stock_count: row.stock_count, event: null };
    }
    const r = await sql<{ resulting_count: number; id: string }>`
      INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
      VALUES (${randomUUID()}, ${variantId}, ${req.ctx?.sellerId}, ${delta},
              ${delta > 0 ? 'RESTOCK' : 'SELLER_SET'})
      RETURNING id, resulting_count`.execute(trx);
    return {
      stock_count: r.rows[0]?.resulting_count,
      event: r.rows[0]?.id,
    };
  }

  async confirmStock(
    trx: Transaction<Database>,
    req: AuthedRequest,
    variantId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.stock:write');
    const r = await sql<{ stock_confirmed_at: Date }>`
      UPDATE core.product_variant SET stock_confirmed_at = now()
       WHERE id = ${variantId} AND seller_id = ${req.ctx?.sellerId}
       RETURNING stock_confirmed_at`.execute(trx);
    if (!r.rows[0]) throw new AdulisException('NOT_FOUND');
    return { stock_confirmed_at: r.rows[0].stock_confirmed_at.toISOString() };
  }

  /** The same evidence a claim attaches as STOCK_EVENTS. */
  async listStockEvents(
    trx: Transaction<Database>,
    req: AuthedRequest,
    variantId: string,
    limit: number,
    cursor: string | undefined,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.stock:read');
    const owner = await sql<{ id: string }>`
      SELECT id FROM core.product_variant
       WHERE id = ${variantId} AND seller_id = ${req.ctx?.sellerId}`.execute(trx);
    if (!owner.rows[0]) throw new AdulisException('NOT_FOUND');
    const r = await sql<{
      id: string;
      delta: number;
      reason: string;
      resulting_count: number;
      occurred_at: Date;
      order_id: string | null;
    }>`
      SELECT id, delta, reason::text, resulting_count, occurred_at, order_id
        FROM core.stock_event
       WHERE variant_id = ${variantId}
         AND (${cursor ?? null}::timestamptz IS NULL
              OR occurred_at < ${cursor ?? null}::timestamptz)
       ORDER BY occurred_at DESC
       LIMIT ${limit + 1}`.execute(trx);
    const page = r.rows.slice(0, limit);
    return {
      data: page.map((e) => ({ ...e, occurred_at: e.occurred_at.toISOString() })),
      has_more: r.rows.length > limit,
      next_cursor:
        r.rows.length > limit ? page[page.length - 1]?.occurred_at.toISOString() : null,
    };
  }

  // -------------------------------------------------------------- attributes

  private async writeProductAttributes(
    trx: Transaction<Database>,
    productId: string,
    attrs: readonly AttributeValue[],
  ): Promise<void> {
    for (const a of attrs) {
      await sql`
        INSERT INTO core.product_attribute_value
          (product_id, attribute_definition_id, value_text, value_number,
           value_option_id, value_boolean)
        VALUES (${productId}, ${a.attribute_definition_id}, ${a.value_text ?? null},
                ${a.value_number ?? null}, ${a.value_option_id ?? null},
                ${a.value_boolean ?? null})
        ON CONFLICT (product_id, attribute_definition_id) DO UPDATE SET
          value_text = EXCLUDED.value_text, value_number = EXCLUDED.value_number,
          value_option_id = EXCLUDED.value_option_id,
          value_boolean = EXCLUDED.value_boolean`.execute(trx);
    }
  }

  private async writeVariantAttributes(
    trx: Transaction<Database>,
    variantId: string,
    attrs: readonly AttributeValue[],
  ): Promise<void> {
    for (const a of attrs) {
      await sql`
        INSERT INTO core.variant_attribute_value
          (variant_id, attribute_definition_id, value_text, value_number,
           value_option_id, value_boolean)
        VALUES (${variantId}, ${a.attribute_definition_id}, ${a.value_text ?? null},
                ${a.value_number ?? null}, ${a.value_option_id ?? null},
                ${a.value_boolean ?? null})
        ON CONFLICT (variant_id, attribute_definition_id) DO UPDATE SET
          value_text = EXCLUDED.value_text, value_number = EXCLUDED.value_number,
          value_option_id = EXCLUDED.value_option_id,
          value_boolean = EXCLUDED.value_boolean`.execute(trx);
    }
  }
}
