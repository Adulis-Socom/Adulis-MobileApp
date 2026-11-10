import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/**
 * The pure parts of For You (ADU-REC-01 v3.2; WO-DISC-002): the algorithm
 * configuration, the deterministic ranking, the Seller-run cap, the caption
 * excerpt and the continuation cursor. No I/O, so each is unit-tested alone
 * (fyp.logic.spec.ts).
 */

// ------------------------------------------------------------ configuration

const int = (min: number, max: number) => z.number().int().min(min).max(max);

/**
 * S45: weights, thresholds, caps and budgets live in an immutable version row
 * (core.fyp_algorithm_version.config). Strict: a source this repository cannot
 * execute (anything but RECENT today) or an unknown key makes the version
 * unservable -- fail closed, never a silently ignored setting. Every number is
 * a technical bound chosen by the version row, not a product rule.
 */
export const fypConfigSchema = z
  .object({
    sources: z.object({ RECENT: z.object({ budget: int(1, 500) }).strict() }).strict(),
    page: z
      .object({ default_limit: int(1, 50), max_limit: int(1, 50) })
      .strict()
      .refine((p) => p.default_limit <= p.max_limit, { message: 'default_limit above max_limit' }),
    session: z.object({ ttl_seconds: int(60, 86_400), max_items: int(1, 5_000) }).strict(),
    tie_break: z.literal('SEEDED_HASH'),
    // REC-INV-19 concentration control. null = off: no approved threshold exists.
    diversity: z.object({ seller_adjacency_max: int(1, 50).nullable() }).strict(),
  })
  .strict();
export type FypConfig = z.infer<typeof fypConfigSchema>;

export function parseFypConfig(raw: unknown): FypConfig | null {
  const r = fypConfigSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** The page size for a request: the version's default, clamped to its bound. */
export function pageLimit(raw: string | undefined, cfg: FypConfig): number {
  const n = raw === undefined ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), cfg.page.max_limit) : cfg.page.default_limit;
}

// ------------------------------------------------------------------ ranking

export interface RankCandidate {
  id: string;
  sellerId: string;
  publishedAt: Date;
}

/** The session-seeded tie-break key of one Scene (S46-S47). */
export function tieKey(seed: string, sceneId: string): string {
  return createHash('sha256').update(`${seed}:${sceneId}`).digest('hex');
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The RECENT source's deterministic order: newest publication first; equal
 * times by the session-seeded hash, then by id. One seed and one candidate set
 * always give one order. No popularity, affinity or quality term: none exists.
 */
export function rankRecent<T extends RankCandidate>(candidates: readonly T[], seed: string): T[] {
  return candidates
    .map((c) => ({ c, t: c.publishedAt.getTime(), k: tieKey(seed, c.id) }))
    .sort((a, b) => b.t - a.t || cmp(a.k, b.k) || cmp(a.c.id, b.c.id))
    .map((x) => x.c);
}

/**
 * Seller-run cap (REC-INV-19; ADULIS-KB "ten consecutive Scenes from one
 * Seller"): no run longer than `max` from one Seller while another candidate
 * can break it, otherwise rank order. `tail` is the session's latest served
 * Sellers, newest last, so the cap holds across pages. When only the capped
 * Seller remains, its Scenes still serve in rank order: the cap reorders, it
 * never withholds eligible content. null = off.
 */
export function capSellerRuns<T extends RankCandidate>(
  ranked: readonly T[],
  max: number | null,
  tail: readonly string[] = [],
): T[] {
  if (max === null) return [...ranked];
  const pool = [...ranked];
  const recent = [...tail];
  const out: T[] = [];
  const runOf = (seller: string) => {
    let n = 0;
    for (let i = recent.length - 1; i >= 0 && recent[i] === seller; i--) n++;
    return n;
  };
  while (pool.length > 0) {
    const i = Math.max(0, pool.findIndex((c) => runOf(c.sellerId) < max));
    const [c] = pool.splice(i, 1);
    out.push(c!);
    recent.push(c!.sellerId);
  }
  return out;
}

// ------------------------------------------------------------------ caption

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** S13 "required caption or bounded excerpt": cut on a grapheme, never inside one. */
export function captionExcerpt(caption: string, max: number): { text: string; truncated: boolean } {
  const parts = Array.from(graphemes.segment(caption), (s) => s.segment);
  return parts.length <= max
    ? { text: caption, truncated: false }
    : { text: parts.slice(0, max).join('').trimEnd(), truncated: true };
}

// ------------------------------------------------------------------- cursor

/**
 * The continuation (S53): `v1.<session>.<offset>.<secret>`. Opaque to clients.
 *
 * - The secret is 32 random bytes; only its SHA-256 is stored
 *   (core.fyp_session.cursor_secret_hash), compared in constant time. A
 *   changed session id or secret matches nothing.
 * - The offset is the number of units already delivered before this page. It
 *   needs no MAC: whoever holds the secret may re-read their own session's
 *   served units (a retried page replays its exact served units), and an offset
 *   beyond what was served is refused.
 * - Expiry, the subject, the Market and the algorithm version are checked
 *   against the session row on every use, never trusted from the cursor.
 */
const CURSOR_RE =
  /^v1\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(0|[1-9][0-9]{0,4})\.([A-Za-z0-9_-]{43})$/;

export interface FypCursor {
  sessionId: string;
  offset: number;
  secret: string;
}

export const encodeCursor = (c: FypCursor): string => `v1.${c.sessionId}.${c.offset}.${c.secret}`;

export function decodeCursor(raw: string): FypCursor | null {
  const m = CURSOR_RE.exec(raw);
  return m ? { sessionId: m[1]!, offset: Number(m[2]), secret: m[3]! } : null;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest();

export function newCursorSecret(): { secret: string; hash: Buffer } {
  const secret = randomBytes(32).toString('base64url');
  return { secret, hash: sha256(secret) };
}

export function cursorSecretMatches(secret: string, storedHash: Buffer): boolean {
  const h = sha256(secret);
  return h.length === storedHash.length && timingSafeEqual(h, storedHash);
}

/** A session seed: 63 random bits, as the decimal string Postgres bigint returns. */
export const newSeed = (): string => (randomBytes(8).readBigUInt64BE() >> 1n).toString();
