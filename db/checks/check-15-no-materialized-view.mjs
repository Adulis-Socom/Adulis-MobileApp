import { grepMigrations, ok, bad } from './_lib.mjs';

/**
 * Appendix C check 15 — no MATERIALIZED VIEW anywhere. Ruling R16.
 *
 * Guards ADU-DB-01 v1.8 section 8.3. v1.6 described `seller_public_stats` as
 * "materialized and refreshed on relevant writes", and an agent reading that
 * reaches for `CREATE MATERIALIZED VIEW` — under which every refresh
 * re-aggregates EVERY seller's entire history to update one seller's row.
 * O(total) work per event, degrading from roughly five thousand sellers and
 * untenable near thirty thousand (ADU-CON-02-A1 rung 3). The failure is the
 * shape, not the constant.
 *
 * This is a PROHIBITION, so it is live from the first migration rather than from
 * the tier that creates the table: the phrase must never appear, and the cheapest
 * time to catch it is the commit that introduces it.
 */
export default {
  id: 15,
  title: 'No CREATE MATERIALIZED VIEW (R16)',
  source: 'ADU-DB-01 v1.8 section 8.3 / ADU-CON-02-A1 section 4.1',
  kind: 'grep',
  liveAtTier: 1,
  expected: '0 occurrences',
  run({ migrations }) {
    const hits = grepMigrations(migrations, /MATERIALIZED\s+VIEW/i);
    return hits.length === 0
      ? ok('0 occurrences')
      : bad(`FORBIDDEN PHRASE PRESENT: ${hits.slice(0, 3).join(' | ')}`);
  },
};
