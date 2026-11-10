import { AdulisException } from '../errors/adulis-exception';

/**
 * Keyset cursors for public lists (WO-006, WO-007): the last row's ordering key, opaque to
 * clients (base64url JSON of a tuple). Never a SQL fragment and never trusted: decodeCursor
 * checks the exact shape and answers anything else with 400 VALIDATION_FAILED, reason
 * CURSOR_INVALID, as the For You cursor does.
 *
 * - `timestamp`: a timestamptz at FULL precision, as Postgres renders it in UTC (see
 *   CURSOR_TS). A JavaScript Date keeps only milliseconds, and a truncated key skips the rows
 *   inside that millisecond at a page boundary.
 * - `ref` / `slug`: the public tiebreakers (a Scene public_ref, a Product slug), so no internal
 *   UUID travels in a list URL (doctrine 5). `uuid` only where the id is already public.
 */
export type CursorPart = 'timestamp' | 'uuid' | 'int' | 'ref' | 'slug';

/** to_char format (bound as a parameter) rendering a timestamptz for a cursor: UTC, microseconds. */
export const CURSOR_TS = 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"';

const PATTERNS: Record<Exclude<CursorPart, 'int'>, RegExp> = {
  timestamp: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  ref: /^[A-Za-z0-9_-]{22}$/,
  slug: /^[a-z0-9][a-z0-9-]{0,119}$/,
};

export function encodeCursor(values: ReadonlyArray<string | number>): string {
  return Buffer.from(JSON.stringify(values), 'utf8').toString('base64url');
}

const invalid = () =>
  new AdulisException('VALIDATION_FAILED', { slots: { path: 'cursor', reason: 'CURSOR_INVALID' } });

/** The tuple in `shape`, or null for no cursor (the first page). */
export function decodeCursor(raw: string | undefined, shape: readonly CursorPart[]): Array<string | number> | null {
  if (raw === undefined || raw === '') return null;
  if (raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw invalid();
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  if (!Array.isArray(parsed) || parsed.length !== shape.length) throw invalid();
  return parsed.map((value: unknown, i) => {
    const kind = shape[i]!;
    if (kind === 'int') {
      // int columns: anything outside int4 would make Postgres refuse the cast (a 500).
      if (typeof value === 'number' && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647) {
        return value;
      }
      throw invalid();
    }
    if (typeof value === 'string' && PATTERNS[kind].test(value)) {
      if (kind !== 'timestamp' || isRealInstant(value)) return value;
    }
    throw invalid();
  });
}

/**
 * A real calendar instant Postgres accepts. V8's Date.parse rolls impossible dates over
 * (2026-02-30 becomes March 2), so the value must survive a round trip unchanged; year 0 does
 * not exist in timestamptz.
 */
function isRealInstant(value: string): boolean {
  const ms = Date.parse(value);
  if (Number.isNaN(ms) || value.startsWith('0000')) return false;
  return new Date(ms).toISOString().slice(0, 23) === value.slice(0, 23);
}

/** A page size from the query: an integer in [1, max], else the default. Out of range is 400. */
export function pageLimit(raw: string | undefined, fallback: number, max: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'limit' } });
  }
  return n;
}
