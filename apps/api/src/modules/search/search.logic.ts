import { createHash } from 'node:crypto';
import { AdulisException } from '../../common/errors/adulis-exception';
import type { SearchType } from './search.dto';

/**
 * Marketplace Search launch configuration (ADU-SRC-01 v3.2 S12-S16), versioned so a change is
 * visible in every response. Lexical only: no personalisation, popularity, paid boost or ML.
 *
 * Bands, the cross-type normaliser for Top (S7: raw trigram scores are not comparable across
 * types; bands are): 0 exact, 1 prefix or word prefix, 2 substring, 3 fuzzy (pg_trgm word
 * similarity >= WORD_SIMILARITY). Bands 2 and 3 apply only from FUZZY_MIN_LENGTH characters, so a
 * very short query uses stricter logic (S15). Within a band: Products available before
 * unavailable (S9), then trigram similarity, then a stable public key.
 */
export const SEARCH_ALGORITHM_VERSION = 'lexical-trgm-v1';
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 100;
export const FUZZY_MIN_LENGTH = 3;
export const WORD_SIMILARITY = '0.5';
/** Top: a bounded mixed set (S7), at most this many of each type. */
export const TOP_CAPS = { SELLER: 3, PRODUCT_POST: 6, SCENE_POST: 3 } as const;
/** Within one band, Top lists an exact Seller first (S7: exact handle/name matches stay strong). */
const TOP_TYPE_ORDER = { SELLER: 0, PRODUCT_POST: 1, SCENE_POST: 2 } as const;

export interface NormalizedQuery {
  /** NFKC, control characters removed, whitespace collapsed and trimmed; punctuation kept. */
  text: string;
  /** The same without one leading "@", for Seller handles. */
  handle: string;
  /** Long enough for substring and fuzzy matching. */
  long: boolean;
}

const invalid = (reason: string) => new AdulisException('VALIDATION_FAILED', { slots: { path: 'q', reason } });

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** LIKE patterns of one matched text (%, _ and backslash escaped; ESCAPE backslash), built from that text. */
export function likePatterns(text: string) {
  const escaped = escapeLike(text);
  return { prefix: `${escaped}%`, wordPrefix: `% ${escaped}%`, contains: `%${escaped}%` };
}

export function normalizeQuery(raw: string | undefined): NormalizedQuery {
  if (raw === undefined) throw invalid('QUERY_REQUIRED');
  // Bound the work before normalising: NFKC can expand, and a URL query has no other cap.
  if (raw.length > MAX_QUERY_LENGTH * 4) throw invalid('QUERY_TOO_LONG');
  const text = raw
    .normalize('NFKC')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  const length = [...text].length;
  if (length < MIN_QUERY_LENGTH) throw invalid('QUERY_TOO_SHORT');
  if (length > MAX_QUERY_LENGTH) throw invalid('QUERY_TOO_LONG');
  // Punctuation or symbols alone give the trigram index nothing to narrow on: refused.
  if (!/[\p{L}\p{N}]/u.test(text)) throw invalid('QUERY_NO_TERMS');
  return {
    text,
    handle: text.startsWith('@') && length > 1 ? text.slice(1) : text,
    long: length >= FUZZY_MIN_LENGTH,
  };
}

/**
 * Ties a cursor to its query, type and Market (WO-008 S15): a cursor carried to another query,
 * tab or Market is refused rather than silently paging someone else's results. 16 bytes of
 * SHA-256, base64url (22 characters, the cursor `ref` shape). Case-folded as matching is.
 */
export function cursorBinding(type: SearchType, marketId: string, q: NormalizedQuery): string {
  return createHash('sha256').update(`${SEARCH_ALGORITHM_VERSION}\u0000${type}\u0000${marketId}\u0000${q.text.toLowerCase()}`).digest('base64url').slice(0, 22);
}

export interface Ranked<T> {
  type: keyof typeof TOP_TYPE_ORDER;
  band: number;
  rank: number;
  item: T;
}

/** Top: each family ranked on its own, then merged by band, type order, rank -- deterministic. */
export function mergeTop<T>(families: ReadonlyArray<ReadonlyArray<Ranked<T>>>): T[] {
  return families
    .flatMap((f) => f.slice(0, f[0] ? TOP_CAPS[f[0].type] : 0))
    .sort((a, b) => a.band - b.band || TOP_TYPE_ORDER[a.type] - TOP_TYPE_ORDER[b.type] || a.rank - b.rank)
    .map((r) => r.item);
}
