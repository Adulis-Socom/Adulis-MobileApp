import { ok, bad } from './_lib.mjs';

/**
 * Appendix C check 14 — manifest agreement. 109 tables.
 *
 * "Check 14 is the cheapest and catches the most. A count that is high means
 * something was invented; a count that is low means something was skipped. Either
 * way it is one query, and it runs before anyone reads a migration."
 *
 * The figure moved 105 -> 108 in v1.7 (`operator_grant`, `seller_fulfilment_method`,
 * `account_device`) and 108 -> 109 in v1.8 (`seller_availability_override`, R27).
 *
 * VERIFIED AGAINST THE MANIFEST. Appendix B of v1.8 enumerates 84 `core` +
 * `verification` 2 + `financial` 3 + `chat` 3 + `nlu` 6 + `billing` 6 +
 * `ledger` 2 + `analytics` 2 + `waitlist` 1 = 109 named tables, with no
 * duplicates. The stated total and the enumeration agree exactly — unlike the
 * enum-type count, which does not (see the Tier 1 report).
 *
 * Partitions are excluded: `analytics.event` is one table in the manifest and its
 * monthly partitions are not additional tables. `relkind='r'` with
 * `relispartition = false` counts the parent and skips the children.
 *
 * Live at Tier 2, when all fifteen migrations have run.
 */
const SCHEMAS = [
  'core',
  'verification',
  'financial',
  'chat',
  'nlu',
  'billing',
  'ledger',
  'analytics',
  'waitlist',
];
const EXPECTED = 109;

export default {
  id: 14,
  title: `Table manifest agreement (${EXPECTED})`,
  source: 'ADU-DB-01 v1.8 Appendix B',
  kind: 'database',
  liveAtTier: 2,
  expected: String(EXPECTED),
  async run({ sql }) {
    const rows = await sql(
      `SELECT n.nspname AS schema, count(*)::int AS n
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ANY($1::text[])
          AND c.relkind IN ('r','p')
          AND NOT c.relispartition
        GROUP BY 1 ORDER BY 1`,
      [SCHEMAS],
    );
    const total = rows.reduce((a, r) => a + r.n, 0);
    const breakdown = rows.map((r) => `${r.schema}=${r.n}`).join(' ');
    return total === EXPECTED
      ? ok(`${total} tables (${breakdown})`)
      : bad(`${total} tables, expected ${EXPECTED} — ${breakdown}`);
  },
};
