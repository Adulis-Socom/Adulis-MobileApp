import { Injectable } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { Database } from '../../common/db/database.types';
import { AdulisException } from '../../common/errors/adulis-exception';
import { CURSOR_TS, encodeCursor } from '../../common/http/cursor';
import { minorUnits, priceFields, productAvailable, publicPrice } from '../catalogue/public-projection';
import { captionExcerpt } from '../fyp/fyp.logic';
import { VISIBLE_STATES } from '../storefront/public-seller';
import { requesterMarket } from '../storefront/requester-market';
import type { CollectionDto, CollectionItemDto, SavedStateItemDto } from './collections.dto';
import type { AddItemBody, ItemFilter, Target } from './collections.logic';

type Cursor = Array<string | number> | null;
type CollectionRow = {
  id: string;
  kind: 'DEFAULT' | 'USER_CREATED';
  name: string | null;
  product_count: number;
  scene_count: number;
  rank: number;
  created_at: string;
  updated_at: string;
};
type ItemRow = {
  id: string;
  collection_id: string;
  product_post_id: string | null;
  scene_post_id: string | null;
  created_at: string;
};
type ProductRow = {
  id: string;
  slug: string;
  name: string;
  base_price_minor: string;
  base_price_currency: string;
  price_min_minor: string | null;
  price_max_minor: string | null;
  price_currency: string | null;
  available: boolean;
  seller_handle: string;
  seller_store_name: string;
  image_key: string | null;
};
type SceneRow = {
  id: string;
  public_ref: string;
  caption: string;
  image_thumb_key: string;
  image_card_key: string;
  seller_handle: string;
  seller_store_name: string;
};

const SCENE_CAPTION_EXCERPT = 140;

/** The public Product gate of Shop and Search: PUBLISHED, Seller visible, Market ACTIVE, in this Market. */
const productVisibleIn = (market: string) => sql`
  p.market_id = ${market}::uuid
  AND p.visibility = 'PUBLISHED' AND p.published_at IS NOT NULL
  AND s.status::text = ANY(${VISIBLE_STATES})
  AND m.activation_state = 'ACTIVE'`;

const filterOn = (filter: ItemFilter) => sql`(
  ${filter} = 'ALL'
  OR (${filter} = 'PRODUCT_POST' AND ci.product_post_id IS NOT NULL)
  OR (${filter} = 'SCENE_POST' AND ci.scene_post_id IS NOT NULL))`;

const ts = (column: string) => sql`to_char(${sql.ref(column)} AT TIME ZONE 'UTC', ${CURSOR_TS})`;

/**
 * Private Buyer Collections (ADU-SRC-01 v3.2 S18-S22). The owner is always the authenticated
 * Account (S18): every statement is scoped by it, and a Collection of another Account answers
 * exactly as a nonexistent one (404, S26). Saved targets are resolved NOW through the current
 * public gates (S20): a membership never authorises a hidden Product or a PRIVATE Scene.
 */
@Injectable()
export class CollectionsService {
  /** The one DEFAULT Collection, created on first need. Concurrency-safe: the partial unique index decides. */
  async ensureDefault(trx: Transaction<Database>, accountId: string): Promise<string> {
    await sql`
      INSERT INTO core.collection (owner_account_id, kind) VALUES (${accountId}, 'DEFAULT')
      ON CONFLICT (owner_account_id) WHERE kind = 'DEFAULT' DO NOTHING`.execute(trx);
    // READ COMMITTED: this statement sees a concurrent twin's committed row.
    const r = await sql<{ id: string }>`
      SELECT id FROM core.collection WHERE owner_account_id = ${accountId} AND kind = 'DEFAULT'`.execute(trx);
    if (!r.rows[0]) throw new AdulisException('INTERNAL');
    return r.rows[0].id;
  }

  private async collections(trx: Transaction<Database>, accountId: string, only: string | null, after: Cursor, limit: number) {
    const r = await sql<CollectionRow>`
      SELECT c.id, c.kind, c.name,
             CASE WHEN c.kind = 'DEFAULT' THEN 0 ELSE 1 END AS rank,
             ${ts('c.created_at')} AS created_at, ${ts('c.updated_at')} AS updated_at,
             (SELECT count(*)::int FROM core.collection_item ci
               WHERE ci.collection_id = c.id AND ci.product_post_id IS NOT NULL) AS product_count,
             (SELECT count(*)::int FROM core.collection_item ci
               WHERE ci.collection_id = c.id AND ci.scene_post_id IS NOT NULL) AS scene_count
        FROM core.collection c
       WHERE c.owner_account_id = ${accountId}
         AND (${only}::uuid IS NULL OR c.id = ${only}::uuid)
         AND (${after === null}
              OR (CASE WHEN c.kind = 'DEFAULT' THEN 0 ELSE 1 END, c.created_at, c.id)
                 > (${after?.[0] ?? 0}::int, ${after?.[1] ?? null}::timestamptz, ${after?.[2] ?? null}::uuid))
       ORDER BY rank, c.created_at, c.id
       LIMIT ${limit + 1}`.execute(trx);
    return r.rows;
  }

  private toCollection(row: CollectionRow): CollectionDto {
    return {
      ref: row.id,
      kind: row.kind,
      name: row.name,
      product_count: row.product_count,
      scene_count: row.scene_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /** The caller's Collection, or 404 -- whether it is another Account's or does not exist. */
  async owned(trx: Transaction<Database>, accountId: string, ref: string): Promise<CollectionRow> {
    const row = (await this.collections(trx, accountId, ref, null, 1))[0];
    if (!row) throw new AdulisException('NOT_FOUND');
    return row;
  }

  async list(trx: Transaction<Database>, accountId: string, after: Cursor, limit: number) {
    const defaultRef = await this.ensureDefault(trx, accountId);
    const rows = await this.collections(trx, accountId, null, after, limit);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      default_collection_ref: defaultRef,
      data: page.map((row) => this.toCollection(row)),
      next_cursor: rows.length > limit && last ? encodeCursor([last.rank, last.created_at, last.id]) : null,
    };
  }

  async create(trx: Transaction<Database>, accountId: string, name: string): Promise<CollectionDto> {
    const r = await sql<{ id: string }>`
      INSERT INTO core.collection (owner_account_id, kind, name)
      VALUES (${accountId}, 'USER_CREATED', ${name}) RETURNING id`.execute(trx);
    return this.toCollection(await this.owned(trx, accountId, r.rows[0]!.id));
  }

  async rename(trx: Transaction<Database>, accountId: string, ref: string, name: string): Promise<CollectionDto> {
    const row = await this.owned(trx, accountId, ref);
    // DEFAULT has no stored name (S21). No dedicated code exists in the closed taxonomy (ON-20261111-089).
    if (row.kind === 'DEFAULT') throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'collectionRef' } });
    await sql`
      UPDATE core.collection SET name = ${name}, updated_at = now()
       WHERE id = ${ref} AND owner_account_id = ${accountId}`.execute(trx);
    return this.toCollection(await this.owned(trx, accountId, ref));
  }

  /** A hard delete: the Collection, its private name and its memberships (cascade). Saved objects are untouched. */
  async remove(trx: Transaction<Database>, accountId: string, ref: string): Promise<void> {
    const row = await this.owned(trx, accountId, ref);
    if (row.kind === 'DEFAULT') throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'collectionRef' } });
    await sql`DELETE FROM core.collection WHERE id = ${ref} AND owner_account_id = ${accountId}`.execute(trx);
  }

  async detail(trx: Transaction<Database>, req: AuthedRequest, accountId: string, ref: string, filter: ItemFilter, after: Cursor, limit: number) {
    const collection = this.toCollection(await this.owned(trx, accountId, ref));
    const r = await sql<ItemRow>`
      SELECT ci.id, ci.collection_id, ci.product_post_id, ci.scene_post_id, ${ts('ci.created_at')} AS created_at
        FROM core.collection_item ci
       WHERE ci.collection_id = ${ref} AND ${filterOn(filter)}
         AND (${after === null} OR (ci.created_at, ci.id) < (${after?.[0] ?? null}::timestamptz, ${after?.[1] ?? null}::uuid))
       ORDER BY ci.created_at DESC, ci.id DESC
       LIMIT ${limit + 1}`.execute(trx);
    return { collection, ...(await this.page(trx, req, r.rows, limit)) };
  }

  /** Recent Saves / Saved Products / Saved Scenes: every target once, at its most recent membership. */
  async saves(trx: Transaction<Database>, req: AuthedRequest, accountId: string, filter: ItemFilter, after: Cursor, limit: number) {
    const r = await sql<ItemRow>`
      SELECT d.id, d.collection_id, d.product_post_id, d.scene_post_id, ${ts('d.created_at')} AS created_at
        FROM (SELECT DISTINCT ON (ci.product_post_id, ci.scene_post_id)
                     ci.id, ci.collection_id, ci.product_post_id, ci.scene_post_id, ci.created_at
                FROM core.collection c
                JOIN core.collection_item ci ON ci.collection_id = c.id
               WHERE c.owner_account_id = ${accountId} AND ${filterOn(filter)}
               ORDER BY ci.product_post_id, ci.scene_post_id, ci.created_at DESC, ci.id DESC) d
       WHERE (${after === null} OR (d.created_at, d.id) < (${after?.[0] ?? null}::timestamptz, ${after?.[1] ?? null}::uuid))
       ORDER BY d.created_at DESC, d.id DESC
       LIMIT ${limit + 1}`.execute(trx);
    return this.page(trx, req, r.rows, limit);
  }

  private async page(trx: Transaction<Database>, req: AuthedRequest, rows: ItemRow[], limit: number) {
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      data: await this.resolve(trx, await requesterMarket(trx, req), page),
      next_cursor: rows.length > limit && last ? encodeCursor([last.created_at, last.id]) : null,
    };
  }

  /**
   * Current public state for a page of memberships: one statement per target type, whatever the
   * page size. Anything not visible now -- or with no resolvable Market -- is UNAVAILABLE with no
   * detail at all (S20: no historical caption, image, tag or reason).
   */
  private async resolve(trx: Transaction<Database>, market: string | null, rows: ItemRow[]): Promise<CollectionItemDto[]> {
    const productIds = rows.flatMap((x) => (x.product_post_id ? [x.product_post_id] : []));
    const sceneIds = rows.flatMap((x) => (x.scene_post_id ? [x.scene_post_id] : []));
    const products =
      market && productIds.length
        ? await sql<ProductRow>`
            SELECT p.id, p.slug, p.name, p.base_price_minor, p.base_price_currency,
                   pp.price_min_minor, pp.price_max_minor, pp.price_currency,
                   ${productAvailable} AS available,
                   s.handle AS seller_handle, s.store_name AS seller_store_name,
                   (SELECT i.card_key FROM core.product_image i
                     WHERE i.product_id = p.id ORDER BY i.position LIMIT 1) AS image_key
              FROM core.product p
              JOIN core.seller s ON s.id = p.seller_id
              JOIN core.market m ON m.id = p.market_id
             CROSS JOIN ${publicPrice}
             WHERE p.id = ANY(${productIds}::uuid[]) AND ${productVisibleIn(market)}`.execute(trx)
        : { rows: [] };
    const scenes =
      market && sceneIds.length
        ? await sql<SceneRow>`
            SELECT v.id, v.public_ref, v.caption, v.image_thumb_key, v.image_card_key,
                   v.seller_handle, v.seller_store_name
              FROM core.v_scene_post_public v
             WHERE v.id = ANY(${sceneIds}::uuid[]) AND v.market_id = ${market}::uuid`.execute(trx)
        : { rows: [] };
    const productOf = new Map(products.rows.map((x) => [x.id, x]));
    const sceneOf = new Map(scenes.rows.map((x) => [x.id, x]));

    return rows.map((x) => {
      const p = x.product_post_id ? productOf.get(x.product_post_id) : undefined;
      const s = x.scene_post_id ? sceneOf.get(x.scene_post_id) : undefined;
      const excerpt = s ? captionExcerpt(s.caption, SCENE_CAPTION_EXCERPT) : null;
      return {
        ref: x.id,
        collection_ref: x.collection_id,
        target_type: x.product_post_id ? 'PRODUCT_POST' : 'SCENE_POST',
        state: p || s ? 'VISIBLE' : 'UNAVAILABLE',
        saved_at: x.created_at,
        product: p
          ? {
              id: p.id,
              slug: p.slug,
              name: p.name,
              base_price_minor: minorUnits(p.base_price_minor),
              base_price_currency: p.base_price_currency,
              ...priceFields(p),
              available: p.available,
              seller: { handle: p.seller_handle, store_name: p.seller_store_name },
              image_key: p.image_key,
            }
          : null,
        scene:
          s && excerpt
            ? {
                public_ref: s.public_ref,
                caption: excerpt.text,
                caption_truncated: excerpt.truncated,
                image: { thumb_key: s.image_thumb_key, card_key: s.image_card_key },
                seller: { handle: s.seller_handle, store_name: s.seller_store_name },
              }
            : null,
      };
    });
  }

  /**
   * Save one target into one of the caller's Collections. The target must be visible NOW in the
   * caller's Market (S26 "resolve public target server-side"); a hidden one answers exactly as a
   * nonexistent one. A repeated Save returns the existing membership (S19).
   */
  async addItem(trx: Transaction<Database>, req: AuthedRequest, accountId: string, ref: string, body: AddItemBody): Promise<CollectionItemDto> {
    await this.owned(trx, accountId, ref);
    const market = await requesterMarket(trx, req);
    if (!market) throw new AdulisException('NOT_FOUND');
    const { target } = body;

    if (target.type === 'PRODUCT_POST') {
      const product = await sql<{ id: string }>`
        SELECT p.id FROM core.product p
          JOIN core.seller s ON s.id = p.seller_id
          JOIN core.market m ON m.id = p.market_id
         WHERE p.id = ${target.ref}::uuid AND ${productVisibleIn(market)}`.execute(trx);
      if (!product.rows[0]) throw new AdulisException('NOT_FOUND');
      // Provenance only from a Scene whose CURRENT public revision tags this Product; else none.
      const origin = body.context
        ? (
            await sql<{ id: string; revision_id: string }>`
              SELECT v.id, v.revision_id FROM core.v_scene_post_public v
                JOIN core.scene_post_product t ON t.revision_id = v.revision_id AND t.product_id = ${target.ref}::uuid
               WHERE v.public_ref = ${body.context.scene_ref} AND v.market_id = ${market}::uuid`.execute(trx)
          ).rows[0]
        : undefined;
      await this.touchIfInserted(
        trx,
        ref,
        await sql`
          INSERT INTO core.collection_item
                 (collection_id, product_post_id, originating_scene_post_id, originating_scene_revision_id, source_surface)
          VALUES (${ref}, ${target.ref}::uuid, ${origin?.id ?? null}::uuid, ${origin?.revision_id ?? null}::uuid, ${body.source_surface})
          ON CONFLICT (collection_id, product_post_id) WHERE product_post_id IS NOT NULL DO NOTHING
          RETURNING id`.execute(trx),
      );
    } else {
      const scene = (
        await sql<{ id: string; revision_id: string }>`
          SELECT v.id, v.revision_id FROM core.v_scene_post_public v
           WHERE v.public_ref = ${target.ref} AND v.market_id = ${market}::uuid`.execute(trx)
      ).rows[0];
      if (!scene) throw new AdulisException('NOT_FOUND');
      await this.touchIfInserted(
        trx,
        ref,
        await sql`
          INSERT INTO core.collection_item (collection_id, scene_post_id, scene_revision_seen_at_save_id, source_surface)
          VALUES (${ref}, ${scene.id}::uuid, ${scene.revision_id}::uuid, ${body.source_surface})
          ON CONFLICT (collection_id, scene_post_id) WHERE scene_post_id IS NOT NULL DO NOTHING
          RETURNING id`.execute(trx),
      );
    }

    const row = await sql<ItemRow>`
      SELECT ci.id, ci.collection_id, ci.product_post_id, ci.scene_post_id, ${ts('ci.created_at')} AS created_at
        FROM core.collection_item ci
        LEFT JOIN core.scene_post sp ON sp.id = ci.scene_post_id
       WHERE ci.collection_id = ${ref}
         AND (ci.product_post_id = ${target.type === 'PRODUCT_POST' ? target.ref : null}::uuid
              OR sp.public_ref = ${target.type === 'SCENE_POST' ? target.ref : null})`.execute(trx);
    return (await this.resolve(trx, market, row.rows))[0]!;
  }

  private async touchIfInserted(trx: Transaction<Database>, ref: string, inserted: { rows: unknown[] }) {
    if (inserted.rows.length) await sql`UPDATE core.collection SET updated_at = now() WHERE id = ${ref}`.execute(trx);
  }

  /** Idempotent: removing an absent membership of an owned Collection succeeds (S19). */
  async removeItem(trx: Transaction<Database>, accountId: string, ref: string, itemRef: string): Promise<void> {
    await this.owned(trx, accountId, ref);
    const r = await sql`DELETE FROM core.collection_item WHERE id = ${itemRef} AND collection_id = ${ref} RETURNING id`.execute(trx);
    if (r.rows.length) await sql`UPDATE core.collection SET updated_at = now() WHERE id = ${ref}`.execute(trx);
  }

  /**
   * Typed batch membership (S22): two statements for up to 60 targets, so no card ever asks
   * alone. Reports only the caller's own memberships; an unknown or hidden ref is simply not saved.
   */
  async savedState(trx: Transaction<Database>, accountId: string, targets: Target[]) {
    const defaultRef = await this.ensureDefault(trx, accountId);
    const productRefs = targets.flatMap((t) => (t.type === 'PRODUCT_POST' ? [t.ref.toLowerCase()] : []));
    const sceneRefs = targets.flatMap((t) => (t.type === 'SCENE_POST' ? [t.ref] : []));
    const r = await sql<{ id: string; collection_id: string; kind: string; target: string; type: string }>`
      SELECT ci.id, ci.collection_id, c.kind, ci.product_post_id::text AS target, 'PRODUCT_POST' AS type
        FROM core.collection c JOIN core.collection_item ci ON ci.collection_id = c.id
       WHERE c.owner_account_id = ${accountId} AND ci.product_post_id = ANY(${productRefs}::uuid[])
      UNION ALL
      SELECT ci.id, ci.collection_id, c.kind, sp.public_ref, 'SCENE_POST'
        FROM core.collection c JOIN core.collection_item ci ON ci.collection_id = c.id
        JOIN core.scene_post sp ON sp.id = ci.scene_post_id
       WHERE c.owner_account_id = ${accountId} AND sp.public_ref = ANY(${sceneRefs}::text[])`.execute(trx);
    const items: SavedStateItemDto[] = targets.map((t) => {
      const key = t.type === 'PRODUCT_POST' ? t.ref.toLowerCase() : t.ref;
      const held = r.rows.filter((m) => m.type === t.type && m.target === key);
      const inDefault = held.find((m) => m.kind === 'DEFAULT');
      return {
        type: t.type,
        ref: t.ref,
        saved: inDefault !== undefined,
        default_item_ref: inDefault?.id ?? null,
        memberships: held.map((m) => ({ collection_ref: m.collection_id, item_ref: m.id })),
      };
    });
    return { default_collection_ref: defaultRef, items };
  }
}
