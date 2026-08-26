import { ok, bad } from './_lib.mjs';

/**
 * Appendix C check 5 — append-only means the grant says so.
 *
 * Guards ADU-DB-01 v1.8 section 4 and Appendix B. Every append-only table carries
 * BOTH mechanisms: a `trg_append_only` trigger that raises, and
 * `REVOKE UPDATE, DELETE` from the application role. Two mechanisms "because the
 * first is invisible in a migration diff and the second is invisible in a
 * permissions audit".
 *
 * Expected 22 each, on the same tables. v1.7 added `operator_grant` as the 22nd.
 *
 * Appendix B warns that this figure "read 16 in v1.1 and v1.2 and was wrong both
 * times", and that a wrong number here disarms the check that verifies every
 * append-only table is actually append-only. So the check compares the two SETS,
 * not just the two counts: 22 triggers and 22 revokes on different tables would
 * satisfy a count comparison and mean nothing.
 *
 * Live at Tier 2, when the full manifest exists.
 */
export default {
  id: 5,
  title: 'Append-only: 22 triggers and 22 REVOKEs, same tables',
  source: 'ADU-DB-01 v1.8 section 4, Appendix B',
  kind: 'database',
  liveAtTier: 2,
  expected: '22 each, identical table sets',
  async run({ sql }) {
    const trig = await sql(`
      SELECT n.nspname || '.' || c.relname AS t
        FROM pg_trigger g
        JOIN pg_class     c ON c.oid = g.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE g.tgname = 'trg_append_only' AND NOT g.tgisinternal
       ORDER BY 1`);
    const revoked = await sql(`
      SELECT n.nspname || '.' || c.relname AS t
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind = 'r'
         AND n.nspname IN ('core','verification','financial','chat','nlu','billing','ledger','analytics','waitlist')
         AND NOT has_table_privilege('adulis_app', c.oid, 'UPDATE')
         AND NOT has_table_privilege('adulis_app', c.oid, 'DELETE')
       ORDER BY 1`);
    const T = new Set(trig.map((r) => r.t));
    const R = new Set(revoked.map((r) => r.t));
    const onlyT = [...T].filter((t) => !R.has(t));
    const onlyR = [...R].filter((t) => !T.has(t));
    if (T.size === 22 && R.size === 22 && onlyT.length === 0 && onlyR.length === 0) {
      return ok('22 triggers, 22 REVOKEs, identical sets');
    }
    return bad(
      `triggers=${T.size} revoked=${R.size}` +
        (onlyT.length ? ` | trigger-without-REVOKE: ${onlyT.join(', ')}` : '') +
        (onlyR.length ? ` | REVOKE-without-trigger: ${onlyR.join(', ')}` : ''),
    );
  },
};
