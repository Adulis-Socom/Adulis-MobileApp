import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ok, bad, CHECKS_DIR } from './_lib.mjs';

/**
 * Appendix C check 16 — NEW IN ADU-DB-01 v1.9. Defect D6.
 *
 * "Appendix A ⋈ pg_type: symmetric difference between this document's enum list
 *  and SELECT typname FROM pg_type WHERE typtype='e'. Expected: empty both ways.
 *  Guards: the catalogue cannot drift from the schema."
 *
 * WHY THIS REPLACED A NUMBER. Appendix A asserted a count in three successive
 * revisions and was wrong in all three — 54, then 54-listed-as-56, then 56,
 * against an enumeration of 66. v1.9's answer is not a fourth number:
 *
 *   "There is no asserted count in v1.9, and that is the fix. The authoritative
 *    inventory is whatever migration 1 creates, and check 16 asserts that this
 *    appendix and pg_type agree in both directions. A number in prose drifts
 *    because nothing checks it; a number produced by a query cannot."
 *
 * `_provenance` IS PROSE AND IS NOT READ (T9 S3.2, D-141). This check parses
 * `.types` and nothing else. That was already true and was never written
 * down, and the string had twice drifted from the data it sits beside -- it
 * asserted 230 values until T8 S7, and before that missed OPERATOR_ATTESTED.
 * The counts are now gone from it entirely rather than corrected, which is
 * this check's own doctrine turned on the file it reads: a number in prose
 * drifts because nothing checks it.
 *
 * TWO DEPARTURES FROM THE CHECK AS WRITTEN, both recorded in db/checks/README.md.
 *
 * 1. SCHEMA-QUALIFIED, NOT BARE `typname`. The query in Appendix C selects
 *    `typname` alone, and `platform` exists in BOTH `core` and `waitlist` —
 *    so the literal query reports a duplicate that is not one, and would mask a
 *    genuinely missing type behind a name that happens to exist elsewhere.
 *    Comparing `nspname.typname` is what the check means.
 *
 * 2. VALUES AS WELL AS NAMES. Appendix C compares the type LIST. A type whose
 *    name is right and whose values are wrong is the more likely defect and the
 *    harder one to see — `session_audience` losing CONSOLE would pass a
 *    name-only check. Names are the primary assertion and values are reported
 *    as a second, separately-named failure so the two are never confused.
 *
 * THE FIXTURE IS THE SPECIFICATION, NOT THE SCHEMA. It is transcribed from
 * Appendix A, so this compares the live database against the document. Reading
 * the catalogue out of the database and comparing it to itself would prove
 * nothing, which is the same point work order T1 section 6 makes about the
 * permission seed.
 *
 * Live at Tier 1: migration 1 creates every type, so this check is meaningful
 * from the first migration and stays meaningful forever.
 */
const FIXTURE = path.join(CHECKS_DIR, 'fixtures', 'appendix-a.json');

export default {
  id: 16,
  title: 'Appendix A and pg_type agree, both directions (D6)',
  source: 'ADU-DB-01 v1.9 Appendix C check 16',
  kind: 'database',
  liveAtTier: 1,
  expected: 'empty both ways',
  async run({ sql }) {
    const appendixA = JSON.parse(await readFile(FIXTURE, 'utf8')).types;

    const rows = await sql(
      `SELECT n.nspname || '.' || t.typname AS name,
              array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS values
         FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
         JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typtype = 'e'
        GROUP BY 1`,
    );

    const live = new Map(rows.map((r) => [r.name, r.values]));
    const documented = new Set(Object.keys(appendixA));

    // The symmetric difference the check names, in both directions.
    const missingFromSchema = [...documented].filter((n) => !live.has(n)).sort();
    const missingFromAppendix = [...live.keys()].filter((n) => !documented.has(n)).sort();

    if (missingFromSchema.length || missingFromAppendix.length) {
      const parts = [];
      if (missingFromSchema.length)
        parts.push(`in Appendix A, not in pg_type: ${missingFromSchema.join(', ')}`);
      if (missingFromAppendix.length)
        parts.push(`in pg_type, not in Appendix A: ${missingFromAppendix.join(', ')}`);
      return bad(parts.join(' · '));
    }

    // Departure 2: the values, once the names are known to agree.
    const valueMismatches = [];
    for (const [name, expected] of Object.entries(appendixA)) {
      const actual = live.get(name);
      if (expected.length !== actual.length || expected.some((v, i) => v !== actual[i])) {
        valueMismatches.push(`${name} [${actual.join(',')}] ≠ [${expected.join(',')}]`);
      }
    }
    if (valueMismatches.length) {
      return bad(`names agree, VALUES differ — ${valueMismatches.join(' · ')}`);
    }

    const values = rows.reduce((a, r) => a + r.values.length, 0);
    return ok(`${live.size} types, ${values} values, identical both ways`);
  },
};
