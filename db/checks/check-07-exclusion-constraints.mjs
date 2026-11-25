import { ok, bad } from './_lib.mjs';

/**
 * Appendix C check 7 — configs never overlap; no Reservation hold survives.
 *
 * Guards ADU-DB-01 v1.8 sections 4 and 12.1. One exclusion constraint per versioned
 * configuration table (at least 7). Until migration 0063 there was an eighth, on
 * core.reservation (no duplicate live hold); the founder retired the Reservation model
 * before launch (2026-11-25), so the check now also fails if that table reappears.
 * btree_gist stays a hard hosting requirement (section 3.1) for the configuration ranges.
 */
export default {
  id: 7,
  title: 'EXCLUDE USING gist present (>= 7), none on a retired Reservation',
  source: 'ADU-DB-01 v1.8 sections 4, 12.1',
  kind: 'database',
  liveAtTier: 2,
  expected: '>= 7',
  async run({ sql }) {
    const rows = await sql(`
      SELECT n.nspname || '.' || c.relname AS t, k.conname
        FROM pg_constraint k
        JOIN pg_class     c ON c.oid = k.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE k.contype = 'x'
       ORDER BY 1`);
    // Migration 0063 retired the Reservation, and its duplicate-hold exclusion with it: no
    // live hold can exist to duplicate. The configuration tables keep theirs (never overlap).
    const hasReservation = rows.some((r) => r.t === 'core.reservation');
    if (rows.length >= 7 && !hasReservation) return ok(`${rows.length} configuration exclusion constraints`);
    return bad(
      `${rows.length} exclusion constraint(s)` +
        (hasReservation ? ', and core.reservation still exists (retired by 0063)' : ''),
    );
  },
};
