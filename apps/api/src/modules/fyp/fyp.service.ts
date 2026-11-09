import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import type { Database } from '../../common/db/database.types';
import { nodeEnv } from '../../common/env';
import { AdulisException } from '../../common/errors/adulis-exception';
import { requestingDevice } from '../../common/http/cookies';
import { createLogger } from '../../common/logging';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import type { FypPageDto, ScenePostFeedUnitDto } from './fyp.dto';
import {
  capSellerRuns,
  captionExcerpt,
  cursorSecretMatches,
  decodeCursor,
  encodeCursor,
  newCursorSecret,
  newSeed,
  pageLimit,
  parseFypConfig,
  rankRecent,
  type FypConfig,
} from './fyp.logic';

/**
 * GET /v1/fyp (ADU-REC-01 v3.2; WO-DISC-002): the Buyer Home For You feed.
 *
 * WHAT IS REAL. One candidate source, RECENT, over the one public read gate
 * (core.v_scene_post_public, migration 0054). Every other REC-01 S19 source
 * needs data this repository does not hold (no interests, follows, affinity,
 * engagement or trending signal), so none is pretended (register WO-DISC-002).
 *
 * SAFETY OUTRANKS SESSION CONSISTENCY (S25-S29, S54). The gate is re-read for
 * the exact page at response time; a Scene that went PRIVATE, lost its Seller
 * or changed revision since an earlier page is dropped, never served from
 * session state. Sessions hold no eligibility.
 *
 * THE SUBJECT IS SERVER-DERIVED (S11, S86): the authenticated Account, or for
 * a guest the registered device (founder batch decision, 10 November 2026).
 * No request field names a subject, a Market or a target. The Market is the
 * Account's, or the device's bootstrap Market.
 */

const log = createLogger();

/** S13 bounded excerpt. The design gives no number; a feed card shows one line. */
const CAPTION_EXCERPT = 300;
/**
 * Write limiters per subject per hour, not product rules: session starts, and
 * newly served pages (each writes impressions; replays write nothing). Counted
 * in the request transaction (see RateLimitService.consume).
 */
const SESSION_START_LIMIT = { bucketKey: 'fyp.session', windowSeconds: 3600, max: 120 } as const;
const PAGE_LIMIT = { bucketKey: 'fyp.page', windowSeconds: 3600, max: 600 } as const;

type Subject =
  | { kind: 'ACCOUNT'; id: string; marketId: string | null }
  | { kind: 'DEVICE'; id: string; marketId: string | null };

interface ActiveVersion {
  id: string;
  cfg: FypConfig;
}

interface Picked {
  sceneId: string;
  sellerId: string;
  source: 'RECENT';
}

interface PublicScene {
  id: string;
  seller_id: string;
  revision_id: string;
  public_ref: string;
  revision_version: number;
  published_at: Date;
  caption: string;
  image_thumb_key: string;
  image_card_key: string;
  seller_handle: string;
  seller_store_name: string;
}

const NOTHING: FypPageDto = { feed_session_id: null, algorithm_version: null, items: [], next_cursor: null };

const cursorInvalid = () =>
  new AdulisException('VALIDATION_FAILED', { slots: { path: 'cursor', reason: 'CURSOR_INVALID' } });
const cursorExpired = () =>
  new AdulisException('VALIDATION_FAILED', { slots: { path: 'cursor', reason: 'CURSOR_EXPIRED' } });

@Injectable()
export class FypService {
  constructor(private readonly rateLimit: RateLimitService) {}

  async feed(
    trx: Transaction<Database>,
    req: AuthedRequest,
    rawCursor: string | undefined,
    rawLimit: string | undefined,
  ): Promise<FypPageDto> {
    const subject = await this.subject(trx, req);
    if (rawCursor !== undefined) return this.continueSession(trx, subject, rawCursor, rawLimit);
    if (subject.marketId === null) return NOTHING;

    const version = await this.activeVersion(trx);
    if (!version) return NOTHING;
    await this.rateLimit.consume(subject.kind, subject.id, SESSION_START_LIMIT, trx);

    const limit = pageLimit(rawLimit, version.cfg);
    const seed = newSeed();
    const sessionId = randomUUID();
    const picked = await this.pick(trx, sessionId, subject.marketId, seed, version.cfg, Math.min(limit, version.cfg.session.max_items), []);
    const scenes = await this.publicScenes(trx, picked.items.map((p) => p.sceneId), subject.marketId);
    const served = picked.items.filter((p) => scenes.has(p.sceneId));
    // Nothing eligible: no session row (only the limiter's counter was written).
    if (served.length === 0) return { ...NOTHING, algorithm_version: version.id };

    const { secret, hash } = newCursorSecret();
    await sql`
      INSERT INTO core.fyp_session
        (id, subject_kind, account_id, device_id, market_id, algorithm_version, seed,
         cursor_secret_hash, expires_at)
      VALUES (${sessionId}, ${subject.kind},
              ${subject.kind === 'ACCOUNT' ? subject.id : null},
              ${subject.kind === 'DEVICE' ? subject.id : null},
              ${subject.marketId}, ${version.id}, ${seed}, ${hash},
              now() + make_interval(secs => ${version.cfg.session.ttl_seconds}))`.execute(trx);

    const items = await this.record(trx, sessionId, version.id, 0, served, scenes, subject.marketId);
    const more = picked.more && items.length < version.cfg.session.max_items;
    return {
      feed_session_id: sessionId,
      algorithm_version: version.id,
      items,
      next_cursor: more ? encodeCursor({ sessionId, offset: items.length, secret }) : null,
    };
  }

  // ------------------------------------------------------------ continuation

  private async continueSession(
    trx: Transaction<Database>,
    subject: Subject,
    rawCursor: string,
    rawLimit: string | undefined,
  ): Promise<FypPageDto> {
    const cur = decodeCursor(rawCursor);
    if (!cur) throw cursorInvalid();

    // Read and verify WITHOUT a lock first: a caller who only knows a session
    // id (it travels in telemetry) must not be able to hold the owner's lock.
    const s = (
      await sql<{
        subject_kind: string;
        account_id: string | null;
        device_id: string | null;
        market_id: string;
        algorithm_version: string;
        seed: string;
        cursor_secret_hash: Buffer;
        expired: boolean;
        config: unknown;
        version_active: boolean;
        production_approved: boolean;
      }>`
        SELECT s.subject_kind, s.account_id, s.device_id, s.market_id, s.algorithm_version,
               s.seed, s.cursor_secret_hash, s.expires_at <= now() AS expired,
               v.config, v.status = 'ACTIVE' AS version_active, v.production_approved
          FROM core.fyp_session s
          JOIN core.fyp_algorithm_version v ON v.id = s.algorithm_version
         WHERE s.id = ${cur.sessionId}`.execute(trx)
    ).rows[0];

    // Unknown, forged, or another subject's session: one answer for all three.
    const owner = s && (s.subject_kind === 'ACCOUNT' ? s.account_id : s.device_id);
    if (!s || s.subject_kind !== subject.kind || owner !== subject.id) throw cursorInvalid();
    if (!cursorSecretMatches(cur.secret, s.cursor_secret_hash)) throw cursorInvalid();

    // Verified: now lock, so concurrent pages of one session serialise and two
    // pages can never claim the same positions or the same Scene. served_count
    // is re-read under the lock.
    const servedCount = (
      await sql<{ served_count: number }>`
        SELECT served_count FROM core.fyp_session WHERE id = ${cur.sessionId} FOR UPDATE`.execute(trx)
    ).rows[0]!.served_count;
    if (cur.offset > servedCount) throw cursorInvalid();

    // A session ends when it expires, when its version is retired (the kill
    // switch, ADU-OBS-01) or no longer may serve here, or when the subject's
    // Market changed. The client starts a new session.
    const cfg = parseFypConfig(s.config);
    if (
      s.expired ||
      !s.version_active ||
      !cfg ||
      (nodeEnv() === 'production' && !s.production_approved) ||
      s.market_id !== subject.marketId
    ) {
      throw cursorExpired();
    }

    const limit = pageLimit(rawLimit, cfg);
    const base = { feed_session_id: cur.sessionId, algorithm_version: s.algorithm_version };
    if (cur.offset < servedCount) {
      return { ...base, ...(await this.replay(trx, cur.sessionId, cur.offset, limit, servedCount, s.market_id, cfg, cur.secret)) };
    }

    const room = cfg.session.max_items - servedCount;
    if (room <= 0) return { ...base, items: [], next_cursor: null };
    await this.rateLimit.consume(subject.kind, subject.id, PAGE_LIMIT, trx);
    const tail = cfg.diversity.seller_adjacency_max === null ? [] : await this.sellerTail(trx, cur.sessionId, cfg.diversity.seller_adjacency_max);
    const picked = await this.pick(trx, cur.sessionId, s.market_id, s.seed, cfg, Math.min(limit, room), tail);
    const scenes = await this.publicScenes(trx, picked.items.map((p) => p.sceneId), s.market_id);
    const served = picked.items.filter((p) => scenes.has(p.sceneId));
    const items = await this.record(trx, cur.sessionId, s.algorithm_version, servedCount, served, scenes, s.market_id);
    const offset = servedCount + items.length;
    const more = picked.more && offset < cfg.session.max_items;
    return { ...base, items, next_cursor: more ? encodeCursor({ sessionId: cur.sessionId, offset, secret: cur.secret }) : null };
  }

  /**
   * A retried or re-read page: the impressions already served after `offset`,
   * re-checked against the gate now. A Scene that is no longer public, or whose
   * public revision is no longer the served one, is dropped -- the impression
   * stays on record but the content is not re-delivered.
   */
  private async replay(
    trx: Transaction<Database>,
    sessionId: string,
    offset: number,
    limit: number,
    servedCount: number,
    marketId: string,
    cfg: FypConfig,
    secret: string,
  ): Promise<Pick<FypPageDto, 'items' | 'next_cursor'>> {
    const rows = (
      await sql<{ id: string; position: number; candidate_source: string; scene_post_id: string; revision_id: string }>`
        SELECT id, position, candidate_source, scene_post_id, revision_id
          FROM core.fyp_impression
         WHERE session_id = ${sessionId} AND position > ${offset} AND position <= ${offset + limit}
         ORDER BY position`.execute(trx)
    ).rows;
    const scenes = await this.publicScenes(trx, rows.map((r) => r.scene_post_id), marketId);
    const products = await this.products(trx, [...scenes.values()].map((p) => p.revision_id), marketId);
    const items = rows.flatMap((r) => {
      const p = scenes.get(r.scene_post_id);
      return p && p.revision_id === r.revision_id ? [unit(r.id, r.position, r.candidate_source, p, products)] : [];
    });
    const next = offset + rows.length;
    const more = next < servedCount || servedCount < cfg.session.max_items;
    return { items, next_cursor: more ? encodeCursor({ sessionId, offset: next, secret }) : null };
  }

  // ---------------------------------------------------------------- serving

  /**
   * RECENT candidates not yet served in this session (S52: no Scene twice),
   * ranked deterministically, capped by Seller run when configured, cut to
   * the page. `more` says whether eligible candidates remain beyond it.
   */
  private async pick(
    trx: Transaction<Database>,
    sessionId: string,
    marketId: string,
    seed: string,
    cfg: FypConfig,
    n: number,
    tail: string[],
  ): Promise<{ items: Picked[]; more: boolean }> {
    const budget = cfg.sources.RECENT.budget;
    const rows = (
      await sql<{ id: string; seller_id: string; published_at: Date }>`
        SELECT v.id, v.seller_id, v.published_at
          FROM core.v_scene_post_public v
         WHERE v.market_id = ${marketId}
           AND NOT EXISTS (SELECT 1 FROM core.fyp_impression i
                            WHERE i.session_id = ${sessionId} AND i.scene_post_id = v.id)
         ORDER BY v.published_at DESC, v.id
         LIMIT ${budget}`.execute(trx)
    ).rows;
    const ranked = capSellerRuns(
      rankRecent(rows.map((r) => ({ id: r.id, sellerId: r.seller_id, publishedAt: r.published_at })), seed),
      cfg.diversity.seller_adjacency_max,
      tail,
    );
    const items = ranked.slice(0, n).map((c) => ({ sceneId: c.id, sellerId: c.sellerId, source: 'RECENT' as const }));
    return { items, more: ranked.length > items.length || rows.length === budget };
  }

  /** Insert the served impressions (positions after `offset`) and advance the session. */
  private async record(
    trx: Transaction<Database>,
    sessionId: string,
    version: string,
    offset: number,
    served: Picked[],
    scenes: Map<string, PublicScene>,
    marketId: string,
  ): Promise<ScenePostFeedUnitDto[]> {
    if (served.length === 0) return [];
    const ids = served.map(() => randomUUID());
    const rows = served.map((p, i) => ({
      id: ids[i]!,
      session_id: sessionId,
      scene_post_id: p.sceneId,
      revision_id: scenes.get(p.sceneId)!.revision_id,
      algorithm_version: version,
      position: offset + i + 1,
      candidate_source: p.source,
    }));
    await trx.insertInto('core.fyp_impression').values(rows).execute();
    await sql`
      UPDATE core.fyp_session
         SET served_count = ${offset + served.length}, last_served_at = now()
       WHERE id = ${sessionId}`.execute(trx);

    const products = await this.products(trx, rows.map((r) => r.revision_id), marketId);
    return rows.map((r) => unit(r.id, r.position, r.candidate_source, scenes.get(r.scene_post_id)!, products));
  }

  /** The public gate, read now, for exactly these Scenes. */
  private async publicScenes(
    trx: Transaction<Database>,
    ids: string[],
    marketId: string,
  ): Promise<Map<string, PublicScene>> {
    if (ids.length === 0) return new Map();
    const r = await sql<PublicScene>`
      SELECT id, seller_id, revision_id, public_ref, revision_version, published_at, caption,
             image_thumb_key, image_card_key, seller_handle, seller_store_name
        FROM core.v_scene_post_public
       WHERE id = ANY(${sql.val(ids)}::uuid[]) AND market_id = ${marketId}`.execute(trx);
    return new Map(r.rows.map((p) => [p.id, p]));
  }

  /** Public tag summaries for every unit of the page, in one query (the public-detail rule). */
  private async products(
    trx: Transaction<Database>,
    revisionIds: string[],
    marketId: string,
  ): Promise<Map<string, ScenePostFeedUnitDto['products']>> {
    const out = new Map<string, ScenePostFeedUnitDto['products']>();
    if (revisionIds.length === 0) return out;
    const r = await sql<{ revision_id: string; position: number; slug: string; name: string; available: boolean }>`
      SELECT t.revision_id, t.position, p.slug, p.name, a.available
        FROM core.scene_post_product t
        JOIN core.product p ON p.id = t.product_id
        JOIN core.v_scene_product_availability a ON a.product_id = t.product_id
       WHERE t.revision_id = ANY(${sql.val(revisionIds)}::uuid[])
         AND a.published AND p.market_id = ${marketId}
       ORDER BY t.revision_id, t.position`.execute(trx);
    for (const { revision_id, ...tag } of r.rows) {
      const list = out.get(revision_id) ?? [];
      list.push(tag);
      out.set(revision_id, list);
    }
    return out;
  }

  /** The Sellers of the session's latest served units, oldest first, for the run cap. */
  private async sellerTail(trx: Transaction<Database>, sessionId: string, n: number): Promise<string[]> {
    const r = await sql<{ seller_id: string }>`
      SELECT sp.seller_id
        FROM core.fyp_impression i JOIN core.scene_post sp ON sp.id = i.scene_post_id
       WHERE i.session_id = ${sessionId}
       ORDER BY i.position DESC
       LIMIT ${n}`.execute(trx);
    return r.rows.map((x) => x.seller_id).reverse();
  }

  // ------------------------------------------------------------ subject, version

  private async subject(trx: Transaction<Database>, req: AuthedRequest): Promise<Subject> {
    const accountId = req.ctx?.accountId ?? null;
    if (accountId) {
      // FOR KEY SHARE: an account deletion (fn_delete_account locks the row
      // FOR UPDATE) waits for this request, then purges what it wrote; a
      // deletion that committed first leaves no ACTIVE row, so nothing serves.
      const r = await sql<{ market_id: string | null }>`
        SELECT m.id AS market_id
          FROM core.account a
          LEFT JOIN core.market m ON m.id = a.market_id AND m.activation_state = 'ACTIVE'
         WHERE a.id = ${accountId} AND a.status = 'ACTIVE'
           FOR KEY SHARE OF a`.execute(trx);
      return { kind: 'ACCOUNT', id: accountId, marketId: r.rows[0]?.market_id ?? null };
    }
    const header = requestingDevice(req.headers);
    if (!header) throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'X-Adulis-Device' } });
    // The id as the database spells it: one subject however the client cases
    // the header (one rate-limit bucket, one session owner).
    const r = await sql<{ id: string; market_id: string | null }>`
      SELECT d.id, m.id AS market_id
        FROM core.device d
        LEFT JOIN core.market m ON m.id = d.market_id AND m.activation_state = 'ACTIVE'
       WHERE d.id = ${header}`.execute(trx);
    const device = r.rows[0];
    // An unregistered device is not a subject: same answer as no device.
    if (!device) throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'X-Adulis-Device' } });
    return { kind: 'DEVICE', id: device.id, marketId: device.market_id };
  }

  /**
   * The version that starts new sessions. Production serves only a version
   * the founder approved (production_approved); the technical baseline is not.
   * A malformed configuration serves nothing and says so in the log.
   */
  private async activeVersion(trx: Transaction<Database>): Promise<ActiveVersion | null> {
    const v = (
      await sql<{ id: string; config: unknown; production_approved: boolean }>`
        SELECT id, config, production_approved
          FROM core.fyp_algorithm_version WHERE status = 'ACTIVE'`.execute(trx)
    ).rows[0];
    if (!v || (nodeEnv() === 'production' && !v.production_approved)) return null;
    const cfg = parseFypConfig(v.config);
    if (!cfg) {
      log.error({ msg: 'fyp: active algorithm version has an invalid configuration', errorCode: 'FYP_CONFIG_INVALID' });
      return null;
    }
    return { id: v.id, cfg };
  }
}

function unit(
  impressionId: string,
  position: number,
  source: string,
  p: PublicScene,
  products: Map<string, ScenePostFeedUnitDto['products']>,
): ScenePostFeedUnitDto {
  const caption = captionExcerpt(p.caption, CAPTION_EXCERPT);
  return {
    type: 'SCENE_POST',
    impression_id: impressionId,
    position,
    candidate_source: source,
    public_ref: p.public_ref,
    revision_version: p.revision_version,
    published_at: p.published_at.toISOString(),
    caption: caption.text,
    caption_truncated: caption.truncated,
    image: { thumb_key: p.image_thumb_key, card_key: p.image_card_key },
    seller: { handle: p.seller_handle, store_name: p.seller_store_name },
    products: products.get(p.revision_id) ?? [],
  };
}
