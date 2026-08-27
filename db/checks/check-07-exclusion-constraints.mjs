import { ok, bad } from './_lib.mjs';

/**
 * Appendix C check 7 — duplicate reservations impossible; configs never overlap.
 *
 * Guards ADU-DB-01 v1.8 sections 4 and 12.1. Expected at least 8: one per
 * versioned configuration table, plus one on `reservation`. v1.5 dropped the
 * figure from a higher number because availability stopped being versioned.
 *
 * The reservation constraint is the one that matters most:
 *
 *     EXCLUDE USING gist (seller_id WITH =, buyer_account_id WITH =,
 *                         variant_id WITH =, active_window WITH &&)
 *       WHERE (state = 'ACTIVE')
 *
 * ADU-PRD-01 says "unique constraint", and a plain unique constraint cannot
 * express a time window. This is why `btree_gist` is a hard hosting requirement
 * (section 3.1) rather than a preference.
 *
 * Live at Tier 2: the configuration exclusions land in migration 2, but
 * `reservation` is migration 9, so the >= 8 figure is only meaningful then.
 */
export default {
  id: 7,
  title: 'EXCLUDE USING gist present (>= 8)',
  source: 'ADU-DB-01 v1.8 sections 4, 12.1',
  kind: 'database',
  liveAtTier: 2,
  expected: '>= 8',
  async run({ sql }) {
    const rows = await sql(`
      SELECT n.nspname || '.' || c.relname AS t, k.conname
        FROM pg_constraint k
        JOIN pg_class     c ON c.oid = k.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE k.contype = 'x'
       ORDER BY 1`);
    const hasReservation = rows.some((r) => r.t === 'core.reservation');
    if (rows.length >= 8 && hasReservation) return ok(`${rows.length} exclusion constraints, incl. core.reservation`);
    return bad(
      `${rows.length} exclusion constraint(s)` +
        (hasReservation ? '' : ', and none on core.reservation'),
    );
  },
};
