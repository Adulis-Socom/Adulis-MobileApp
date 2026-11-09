import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../common/db/database.types';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import { assertPermission } from '../../common/auth/permission';
import { AdulisException } from '../../common/errors/adulis-exception';
import { IMAGE_CAPS } from '../catalogue/catalogue.service';
import { MEDIA_STORAGE_ADAPTER, type MediaStorageAdapter } from '../catalogue/media-storage.adapter';
import type { CreateScenePostBody, PatchScenePostDraftBody } from './scenes.schemas';

/**
 * Scene Posts (ADU-SCN-01 v3.2; WO-DISC-001). Content owns the Scene;
 * Catalogue/Inventory own whether a Product can be bought. Publication and
 * every visibility transition are the database functions of migration 0054;
 * this service authorises, validates references and composes reads.
 *
 * TEMPORARY PERMISSION MAPPING (WO-DISC-001 S23). ADU-SCN-01 S13 names the
 * seller.scene_posts:* family, held by OWNER, ADMIN and CAMPAIGN_MANAGER on
 * the Console. Those codes are not in the executable catalogue (42 codes,
 * pinned by four gates; WO-API-001C is pending). Every Scene management call
 * therefore requires BOTH seller.media:write (OWNER, ADMIN, INVENTORY,
 * CAMPAIGN_MANAGER) AND seller.broadcasts:send (OWNER, ADMIN,
 * CAMPAIGN_MANAGER). Both are CONSOLE-only, and their intersection is exactly
 * the design's role set: nothing is broadened, and a Seller Companion session
 * is refused by the database (S12).
 */

const PUBLIC_REF_RE = /^[A-Za-z0-9_-]{22}$/;
const AVAILABILITY_REASONS = ['ALL_TAGGED_PRODUCTS_UNAVAILABLE', 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK'];

interface SceneRow {
  id: string;
  public_ref: string;
  publication_state: string;
  visibility: string;
  visibility_reason: string | null;
  current_published_revision_id: string | null;
  working_revision_id: string | null;
  edit_version: number;
  lifecycle_version: number;
  published_at: Date | null;
  visibility_changed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface RevisionRow {
  id: string;
  version: number;
  status: 'WORKING' | 'PUBLISHED';
  caption: string | null;
  image_thumb_key: string | null;
  image_card_key: string | null;
  image_full_key: string | null;
  published_at: Date | null;
}

export interface TagRow {
  product_id: string;
  position: number;
  name: string;
  published: boolean;
  in_stock: boolean;
  available: boolean;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

@Injectable()
export class ScenesService {
  constructor(@Inject(MEDIA_STORAGE_ADAPTER) private readonly storage: MediaStorageAdapter) {}

  // ------------------------------------------------------------ Seller writes

  async create(trx: Transaction<Database>, req: AuthedRequest, body: CreateScenePostBody) {
    const { sellerId, accountId } = await this.authorize(trx, req);
    const productIds = this.distinct(body.product_ids ?? []);
    await this.lockTagProducts(trx, productIds);
    await this.assertOwnProducts(trx, sellerId, productIds);

    const sceneId = randomUUID();
    const revisionId = randomUUID();
    // Seller and Market are server-derived (S11, S30); the client names neither.
    await sql`
      INSERT INTO core.scene_post (id, seller_id, market_id, working_revision_id)
      SELECT ${sceneId}, s.id, s.market_id, ${revisionId}
        FROM core.seller s WHERE s.id = ${sellerId}`.execute(trx);
    await sql`
      INSERT INTO core.scene_post_revision
        (id, scene_post_id, seller_id, version, caption, author_account_id)
      VALUES (${revisionId}, ${sceneId}, ${sellerId}, 1, ${body.caption ?? null}, ${accountId})`.execute(trx);
    await this.writeTags(trx, revisionId, sellerId, productIds);
    return this.sellerView(trx, sellerId, sceneId);
  }

  async patchDraft(
    trx: Transaction<Database>,
    req: AuthedRequest,
    sceneId: string,
    ifMatch: string | undefined,
    body: PatchScenePostDraftBody,
  ) {
    const { sellerId, accountId } = await this.authorize(trx, req);
    // Storage I/O and the Product-side locks come BEFORE the Scene row lock:
    // a commerce COMMIT may wait for that lock, so it is held only briefly and
    // always after Product-side locks (migration 0054, lock order).
    if (body.image) {
      await this.verifyImage(await this.ownPublicRef(trx, sellerId, sceneId), body.image);
    }
    const productIds = body.product_ids === undefined ? undefined : this.distinct(body.product_ids);
    if (productIds) await this.lockTagProducts(trx, productIds);
    const scene = await this.lockOwn(trx, sellerId, sceneId);
    this.checkIfMatch(ifMatch, scene.edit_version);

    let revisionId = scene.working_revision_id;
    if (!revisionId) {
      // First edit of a published Scene: clone the published revision into a
      // new WORKING one; the published revision is never touched (S17, S19).
      revisionId = randomUUID();
      await sql`
        INSERT INTO core.scene_post_revision
          (id, scene_post_id, seller_id, version, caption, image_thumb_key,
           image_card_key, image_full_key, author_account_id)
        SELECT ${revisionId}, r.scene_post_id, r.seller_id,
               (SELECT max(x.version) + 1 FROM core.scene_post_revision x
                 WHERE x.scene_post_id = r.scene_post_id),
               r.caption, r.image_thumb_key, r.image_card_key, r.image_full_key, ${accountId}
          FROM core.scene_post_revision r
         WHERE r.id = ${scene.current_published_revision_id}`.execute(trx);
      await sql`
        INSERT INTO core.scene_post_product (revision_id, seller_id, product_id, position)
        SELECT ${revisionId}, t.seller_id, t.product_id, t.position
          FROM core.scene_post_product t
         WHERE t.revision_id = ${scene.current_published_revision_id}`.execute(trx);
    }

    if (body.caption !== undefined) {
      await sql`UPDATE core.scene_post_revision SET caption = ${body.caption}
                 WHERE id = ${revisionId}`.execute(trx);
    }
    if (body.image !== undefined) {
      await sql`
        UPDATE core.scene_post_revision
           SET image_thumb_key = ${body.image?.thumb_key ?? null},
               image_card_key = ${body.image?.card_key ?? null},
               image_full_key = ${body.image?.full_key ?? null}
         WHERE id = ${revisionId}`.execute(trx);
    }
    if (productIds) {
      await this.assertOwnProducts(trx, sellerId, productIds);
      await sql`DELETE FROM core.scene_post_product WHERE revision_id = ${revisionId}`.execute(trx);
      await this.writeTags(trx, revisionId, sellerId, productIds);
    }
    await sql`
      UPDATE core.scene_post_revision SET author_account_id = ${accountId}, updated_at = now()
       WHERE id = ${revisionId}`.execute(trx);
    await sql`
      UPDATE core.scene_post
         SET working_revision_id = ${revisionId}, edit_version = edit_version + 1, updated_at = now()
       WHERE id = ${sceneId}`.execute(trx);
    return this.sellerView(trx, sellerId, sceneId);
  }

  /** Server-minted keys for the three image derivatives (the product_image flow). */
  async requestImageUpload(trx: Transaction<Database>, req: AuthedRequest, sceneId: string) {
    const { sellerId } = await this.authorize(trx, req);
    // Keyed by the PUBLIC reference: the keys are served publicly, and the
    // internal id never needs to leave management responses (S73). No row
    // lock: signing is storage I/O, and public_ref is write-once.
    const base = `scenes/${await this.ownPublicRef(trx, sellerId, sceneId)}/img/${randomUUID()}`;
    const [thumb, card, full] = await Promise.all([
      this.storage.signPut(`${base}/thumb.webp`, 'image/webp', IMAGE_CAPS.thumb),
      this.storage.signPut(`${base}/card.webp`, 'image/webp', IMAGE_CAPS.card),
      this.storage.signPut(`${base}/full.webp`, 'image/webp', IMAGE_CAPS.full),
    ]);
    return { uploads: { thumb, card, full } };
  }

  async publish(
    trx: Transaction<Database>,
    req: AuthedRequest,
    sceneId: string,
    ifMatch: string | undefined,
  ) {
    const { sellerId, accountId } = await this.authorize(trx, req);
    const scene = await this.lockOwn(trx, sellerId, sceneId);
    // Publishing exactly what the Seller reviewed: a newer edit is a conflict.
    this.checkIfMatch(ifMatch, scene.edit_version);
    try {
      await sql`SELECT core.fn_scene_post_publish(${sceneId}, ${sellerId}, ${accountId})`.execute(trx);
    } catch (e) {
      const pg = e as { code?: string; detail?: string };
      let detail: unknown;
      try {
        detail = pg.code === '23001' && pg.detail ? JSON.parse(pg.detail) : undefined;
      } catch {
        detail = undefined; // not this function's DETAIL: rethrow the original below
      }
      if (detail !== undefined && detail !== null && typeof detail === 'object') {
        if (Array.isArray(detail)) {
          // Every unsatisfied gate at once (S32), in the fn_publish_product
          // shape: the design's blocker name travels in slots.item.
          const items = (detail as Array<Record<string, unknown>>).map((i) => ({
            code: 'PUBLICATION_BLOCKED',
            message_key: 'error.seller.publication_blocked',
            slots: i,
          }));
          throw new AdulisException('PUBLICATION_BLOCKED', { items });
        }
        throw new AdulisException('VALIDATION_FAILED', {
          status: 409,
          slots: detail as Record<string, unknown>,
        });
      }
      throw e;
    }
    return this.sellerView(trx, sellerId, sceneId);
  }

  // ------------------------------------------------------------- Seller reads

  async list(
    trx: Transaction<Database>,
    req: AuthedRequest,
    cursor: string | undefined,
    limit: number,
  ) {
    const { sellerId } = await this.authorize(trx, req);
    const rows = await sql<{
      id: string;
      public_ref: string;
      publication_state: string;
      visibility: string;
      visibility_reason: string | null;
      edit_version: number;
      caption: string | null;
      card_image_key: string | null;
      tagged_product_count: number;
      available_tagged_product_count: number;
      published_at: Date | null;
      updated_at: Date;
    }>`
      SELECT sp.id, sp.public_ref, sp.publication_state, sp.visibility, sp.visibility_reason,
             sp.edit_version, coalesce(w.caption, p.caption) AS caption,
             coalesce(w.image_card_key, p.image_card_key) AS card_image_key,
             (SELECT count(*)::int FROM core.scene_post_product t
               WHERE t.revision_id = sp.current_published_revision_id) AS tagged_product_count,
             (SELECT count(*)::int FROM core.scene_post_product t
                JOIN core.v_scene_product_availability a ON a.product_id = t.product_id
               WHERE t.revision_id = sp.current_published_revision_id
                 AND a.available AND a.market_id = sp.market_id) AS available_tagged_product_count,
             sp.published_at, sp.updated_at
        FROM core.scene_post sp
        LEFT JOIN core.scene_post_revision w ON w.id = sp.working_revision_id
        LEFT JOIN core.scene_post_revision p ON p.id = sp.current_published_revision_id
       WHERE sp.seller_id = ${sellerId}
         AND (${cursor ?? null}::uuid IS NULL OR sp.id > ${cursor ?? null}::uuid)
       ORDER BY sp.id
       LIMIT ${limit + 1}`.execute(trx);
    const page = rows.rows.slice(0, limit);
    return {
      data: page.map((r) => ({
        ...r,
        published_at: iso(r.published_at),
        updated_at: r.updated_at.toISOString(),
      })),
      has_more: rows.rows.length > limit,
      next_cursor: rows.rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async detail(trx: Transaction<Database>, req: AuthedRequest, sceneId: string) {
    const { sellerId } = await this.authorize(trx, req);
    return this.sellerView(trx, sellerId, sceneId);
  }

  // ------------------------------------------------------------- public read

  /**
   * GET /v1/scene-posts/{publicRef}. Reads ONLY core.v_scene_post_public, the
   * central gate (S21, S35): a PRIVATE, draft, archived, out-of-gate or
   * unknown Scene is the same bare 404, with no caption, image, tag or reason.
   */
  async publicDetail(trx: Transaction<Database>, publicRef: string) {
    if (!PUBLIC_REF_RE.test(publicRef)) throw new AdulisException('NOT_FOUND');
    const r = await sql<{
      revision_id: string;
      market_id: string;
      public_ref: string;
      published_at: Date;
      revision_version: number;
      caption: string;
      image_thumb_key: string;
      image_card_key: string;
      image_full_key: string;
      seller_handle: string;
      seller_store_name: string;
    }>`
      SELECT revision_id, market_id, public_ref, published_at, revision_version, caption,
             image_thumb_key, image_card_key, image_full_key, seller_handle, seller_store_name
        FROM core.v_scene_post_public
       WHERE public_ref = ${publicRef}`.execute(trx);
    const scene = r.rows[0];
    if (!scene) throw new AdulisException('NOT_FOUND');

    // Public tags only: a Product that is not public commerce is omitted, an
    // out-of-stock one stays with available=false ("Currently unavailable").
    const products = await sql<{
      position: number;
      slug: string;
      name: string;
      base_price_minor: string;
      base_price_currency: string;
      image_key: string | null;
      available: boolean;
    }>`
      SELECT t.position, p.slug, p.name, p.base_price_minor, p.base_price_currency,
             (SELECT i.card_key FROM core.product_image i
               WHERE i.product_id = p.id ORDER BY i.position LIMIT 1) AS image_key,
             a.available
        FROM core.scene_post_product t
        JOIN core.product p ON p.id = t.product_id
        JOIN core.v_scene_product_availability a ON a.product_id = t.product_id
       WHERE t.revision_id = ${scene.revision_id}
         AND a.published AND p.market_id = ${scene.market_id}
       ORDER BY t.position`.execute(trx);

    return {
      public_ref: scene.public_ref,
      published_at: scene.published_at.toISOString(),
      revision_version: scene.revision_version,
      caption: scene.caption,
      image: {
        thumb_key: scene.image_thumb_key,
        card_key: scene.image_card_key,
        full_key: scene.image_full_key,
      },
      seller: { handle: scene.seller_handle, store_name: scene.seller_store_name },
      products: products.rows.map((p) => ({ ...p, base_price_minor: Number(p.base_price_minor) })),
    };
  }

  // ---------------------------------------------------------------- helpers

  private async authorize(trx: Transaction<Database>, req: AuthedRequest) {
    await assertPermission(trx, req, 'seller.media:write');
    await assertPermission(trx, req, 'seller.broadcasts:send');
    const sellerId = req.ctx?.sellerId;
    const accountId = req.ctx?.accountId;
    if (!sellerId || !accountId) throw new AdulisException('INTERNAL');
    return { sellerId, accountId };
  }

  /** The Seller's own Scene, row-locked: edits and publish are serialised (S54). */
  private async lockOwn(trx: Transaction<Database>, sellerId: string, sceneId: string) {
    const r = await sql<SceneRow>`
      SELECT * FROM core.scene_post
       WHERE id = ${sceneId} AND seller_id = ${sellerId} FOR UPDATE`.execute(trx);
    const scene = r.rows[0];
    // Another Seller's Scene and a missing one are the same 404 (S51).
    if (!scene) throw new AdulisException('NOT_FOUND');
    return scene;
  }

  /** The Seller's own Scene's write-once public_ref, read without a lock (storage paths). */
  private async ownPublicRef(trx: Transaction<Database>, sellerId: string, sceneId: string) {
    const r = await sql<{ public_ref: string }>`
      SELECT public_ref FROM core.scene_post
       WHERE id = ${sceneId} AND seller_id = ${sellerId}`.execute(trx);
    if (!r.rows[0]) throw new AdulisException('NOT_FOUND');
    return r.rows[0].public_ref;
  }

  /** If-Match carries edit_version as an ETag: "<n>". Optimistic concurrency (S18). */
  private checkIfMatch(header: string | undefined, current: number): void {
    if (!header) throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'If-Match' } });
    const presented = header.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
    if (presented !== String(current)) {
      throw new AdulisException('VALIDATION_FAILED', {
        status: 409,
        slots: { reason: 'STALE_REVISION', current_version: current },
      });
    }
  }

  /**
   * The shared side of the per-Product advisory lock that COMMIT-time
   * re-evaluation takes exclusively (core.fn_scene_tag_lock): a tag written
   * while a stock change is still open waits for that change to commit.
   */
  private async lockTagProducts(trx: Transaction<Database>, productIds: readonly string[]) {
    if (productIds.length === 0) return;
    await sql`SELECT core.fn_scene_tag_lock(${[...productIds]}::uuid[], false)`.execute(trx);
  }

  private distinct(ids: readonly string[]): string[] {
    const lower = ids.map((id) => id.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      // One Product appears once per revision (S46: unique revision/Product).
      throw new AdulisException('VALIDATION_FAILED', {
        slots: { path: 'product_ids', reason: 'DUPLICATE_PRODUCT' },
      });
    }
    return lower;
  }

  /**
   * Every tag must name a Product of this Seller in this Seller's Market
   * (S25: verified at tag time and again at publish). A missing Product and
   * another Seller's Product are the same bare 404, so a tag request cannot
   * probe another catalogue. The composite FK makes a cross-Seller row
   * unrepresentable even if this check were skipped.
   */
  private async assertOwnProducts(
    trx: Transaction<Database>,
    sellerId: string,
    productIds: readonly string[],
  ): Promise<void> {
    if (productIds.length === 0) return;
    const r = await sql<{ n: number }>`
      SELECT count(*)::int AS n
        FROM core.product p JOIN core.seller s ON s.id = p.seller_id
       WHERE p.id = ANY (${[...productIds]}::uuid[])
         AND p.seller_id = ${sellerId} AND p.market_id = s.market_id`.execute(trx);
    if ((r.rows[0]?.n ?? 0) !== productIds.length) throw new AdulisException('NOT_FOUND');
  }

  private async writeTags(
    trx: Transaction<Database>,
    revisionId: string,
    sellerId: string,
    productIds: readonly string[],
  ): Promise<void> {
    if (productIds.length === 0) return;
    await sql`
      INSERT INTO core.scene_post_product (revision_id, seller_id, product_id, position)
      SELECT ${revisionId}, ${sellerId}, x.product_id, x.position
        FROM unnest(${[...productIds]}::uuid[]) WITH ORDINALITY AS x(product_id, position)`.execute(trx);
  }

  /** What actually landed in storage, under this Scene's own prefix (the product_image COMMIT). */
  private async verifyImage(
    publicRef: string,
    image: { thumb_key: string; card_key: string; full_key: string },
  ): Promise<void> {
    // Exactly the shape image-uploads mints: this Scene's prefix, ONE upload id
    // for all three, and each file in its own slot. No traversal, no swapping.
    const prefix = `scenes/${publicRef}/img/`;
    const candidate = image.full_key.startsWith(prefix)
      ? image.full_key.slice(prefix.length, -'/full.webp'.length)
      : '';
    const batch = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(candidate)
      ? candidate
      : undefined;
    const keys = [
      ['thumb', image.thumb_key, IMAGE_CAPS.thumb],
      ['card', image.card_key, IMAGE_CAPS.card],
      ['full', image.full_key, IMAGE_CAPS.full],
    ] as const;
    // Every shape first, so a malformed request never reaches storage.
    for (const [kind, key] of keys) {
      if (!batch || key !== `scenes/${publicRef}/img/${batch}/${kind}.webp`) {
        throw new AdulisException('VALIDATION_FAILED', { slots: { path: `image.${kind}_key` } });
      }
    }
    for (const [kind, key, cap] of keys) {
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
  }

  /** The Seller management representation (S36, CONSOLE S1100-1102). */
  private async sellerView(trx: Transaction<Database>, sellerId: string, sceneId: string) {
    const r = await sql<SceneRow & { effective_public: boolean }>`
      SELECT sp.*, EXISTS (SELECT 1 FROM core.v_scene_post_public v WHERE v.id = sp.id)
               AS effective_public
        FROM core.scene_post sp
       WHERE sp.id = ${sceneId} AND sp.seller_id = ${sellerId}`.execute(trx);
    const scene = r.rows[0];
    if (!scene) throw new AdulisException('NOT_FOUND');
    return {
      id: scene.id,
      public_ref: scene.public_ref,
      publication_state: scene.publication_state,
      visibility: scene.visibility,
      visibility_reason: scene.visibility_reason,
      restores_automatically:
        scene.visibility === 'PRIVATE' &&
        AVAILABILITY_REASONS.includes(scene.visibility_reason ?? ''),
      effective_public: scene.effective_public,
      edit_version: scene.edit_version,
      lifecycle_version: scene.lifecycle_version,
      published_at: iso(scene.published_at),
      visibility_changed_at: iso(scene.visibility_changed_at),
      created_at: scene.created_at.toISOString(),
      updated_at: scene.updated_at.toISOString(),
      published_revision: await this.revisionView(trx, scene.current_published_revision_id),
      working_revision: await this.revisionView(trx, scene.working_revision_id),
    };
  }

  private async revisionView(trx: Transaction<Database>, revisionId: string | null) {
    if (!revisionId) return null;
    const r = await sql<RevisionRow>`
      SELECT id, version, status, caption, image_thumb_key, image_card_key, image_full_key,
             published_at
        FROM core.scene_post_revision WHERE id = ${revisionId}`.execute(trx);
    const rev = r.rows[0];
    if (!rev) return null;
    const tags = await sql<TagRow>`
      SELECT t.product_id, t.position, p.name, a.published,
             a.in_stock, (a.available AND a.market_id = sp.market_id) AS available
        FROM core.scene_post_product t
        JOIN core.scene_post_revision r ON r.id = t.revision_id
        JOIN core.scene_post sp ON sp.id = r.scene_post_id
        JOIN core.product p ON p.id = t.product_id
        JOIN core.v_scene_product_availability a ON a.product_id = t.product_id
       WHERE t.revision_id = ${revisionId}
       ORDER BY t.position`.execute(trx);
    return {
      id: rev.id,
      version: rev.version,
      status: rev.status,
      caption: rev.caption,
      image: rev.image_full_key
        ? {
            thumb_key: rev.image_thumb_key as string,
            card_key: rev.image_card_key as string,
            full_key: rev.image_full_key,
          }
        : null,
      published_at: iso(rev.published_at),
      products: tags.rows,
      tagged_product_count: tags.rows.length,
      available_tagged_product_count: tags.rows.filter((t) => t.available).length,
    };
  }
}
