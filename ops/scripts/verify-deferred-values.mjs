#!/usr/bin/env node
/**
 * `pnpm verify:deferred-values` -- ADU-VAL-01 v1.2 S0.3, made executable.
 *
 * "Three forms, one source, and something compares them" -- the S16.6
 * pattern that caught the collapsed permission matrix:
 *
 *   1. S1.1's table in the register           (for a human)
 *   2. db/checks/fixtures/deferred-values.json (for a machine)
 *   3. the live schema                         (what is actually true)
 *
 * This script asserts 1 == 2 both directions, then asserts against 3 that
 * every nullable_required column EXISTS and IS NULLABLE. ADU-RUL-02 (via
 * T7 S5): "every column in S1.1 is nullable, and its consumer fails closed
 * on NULL" -- a NOT NULL column holding an OPEN value is not a deferral,
 * it is a forced invention with a later deadline (D-61 was exactly that,
 * for four work orders).
 *
 * WHERE THE LIST AND THE SCHEMA DISAGREE, THE SCHEMA WINS (v1.1 S0.3's own
 * rule): a fixture column missing from the schema FAILS this gate loudly
 * -- the fix is a register entry and a v1.2 correction, never a silent
 * edit here. Type agreement is REPORTED, not failed: information_schema
 * spells types differently (int -> integer, vector(N) -> USER-DEFINED),
 * and the register has been wrong about its own schema three times --
 * a red type row is a prompt to register, not a broken build.
 *
 * The reverse direction -- "a nullable config column absent from S1.1" --
 * CANNOT be automated (nothing intrinsic marks a column deferred) and
 * stays a review question at each reissue, per S0.3. No heuristic here,
 * deliberately.
 *
 * NOT a db/checks/check-*.mjs: db-check.mjs counts those files and exits 2
 * on any count but sixteen -- Appendix C is a governed set. This is a gate
 * in ops/scripts, run from the one list (ops/scripts/gates.mjs).
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

const CONNECTION = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL;
if (!CONNECTION) {
  console.error('FAIL  DATABASE_URL_MIGRATE / DATABASE_URL is not set.');
  process.exit(2);
}

/**
 * THE PINNED COUNT, and it is the difference between a comparator and a gate.
 *
 * This script asserted that S1.1 and the fixture AGREE. It did not assert what
 * they agree ABOUT -- so deleting a column from both forms left fifteen rows
 * agreeing perfectly, and the gate printed "PASS ... all 15 rows, both
 * directions" and exited 0. Two forms that shrink together agree beautifully.
 * Measured, not supposed: removing core.ladder_config.established_min_handoffs
 * from S1.1 and from deferred-values.json gave a green run (T8-C S1).
 *
 * That is D-121's class -- a rule whose membership lives in something a person
 * edits directly -- and the fix is the same: pin the number where neither form
 * can reach it, beside what fixes it.
 *
 * FOURTEEN, AND IT WAS SIXTEEN UNTIL v1.2. ADU-VAL-01 v1.2 S1.1 enumerates
 * fourteen columns, all on core.ladder_config -- Groups A and C.
 *
 * v1.1 carried two more, and v1.2 removes both because NEITHER WAS A
 * NULLABILITY QUESTION:
 *
 *   eligibility_config.follower_threshold -- NULL there is a DECIDED value
 *   ("this market sets no bar") and the consumer fails OPEN on it. D-92,
 *   ruled in T9 S3.1 and built in migration 0041. A column where NULL carries
 *   meaning cannot also be a deferral marker: the two readings are
 *   indistinguishable in the data and only the document can tell them apart.
 *
 *   nlu.intent_phrase.embedding -- the deferral is the vector DIMENSION, a
 *   TYPE question. Still OPEN, in v1.2 S1.4, and out of the machine-read
 *   table.
 *
 * THE PIN MOVED ON ITS FIRST DAY, AND THAT IS THE PIN WORKING. A gate that
 * compares two forms cannot ask whether either is right; pinning a count
 * forces someone to say what the count IS, and saying it out loud is what
 * exposed two rows that never belonged (ADU-VAL-01 v1.2 S0.2).
 *
 * A fifteenth row means a value was deferred and this gate had not heard; a
 * thirteenth means one was decided or dropped. Either way the register owes a
 * reissue that says so, and the number moves in the same commit as the
 * sentence that moved it.
 */
const EXPECTED_ROWS = 14;

let failures = 0;
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => { failures += 1; console.error(`  FAIL  ${m}`); };
const note = (m) => console.log(`  NOTE  ${m}`);

// ---- form 2: the fixture --------------------------------------------------
const fixture = JSON.parse(
  await readFile(path.join(root, 'db', 'checks', 'fixtures', 'deferred-values.json'), 'utf8'),
);
const fx = fixture.columns;

// ---- form 1: S1.1's table, parsed from the governed register --------------
const registerPath = path.join(
  root, 'docs', 'registers', 'ADU-VAL-01_Deferred_Value_Decisions_Register_v1_2.md',
);
const register = await readFile(registerPath, 'utf8');
const rowRe = /^\| (\d+) \| `([a-z_]+)\.([a-z_]+)` \| `([a-z_]+)` \| ([^|]+) \| ([^|]+) \|$/gm;
const docRows = [...register.matchAll(rowRe)].map(([, n, schema, table, column, type, group]) => ({
  n: Number(n), schema, table, column, type: type.trim(), group: group.trim(),
}));

if (docRows.length === 0) {
  fail('parsed zero rows from S1.1 -- the table format or the parser moved.');
} else if (docRows.length !== EXPECTED_ROWS) {
  fail(
    `S1.1 lists ${docRows.length} columns; this gate is pinned to ${EXPECTED_ROWS}. ` +
      'A row leaving S1.1 is a deferred value decided, dropped or lost -- none of ' +
      'which the agreement checks below can see, because they compare the two forms ' +
      'against each other. If the reissue is real, move the pin in the same commit.',
  );
} else {
  pass(`S1.1 parsed: ${docRows.length} rows (pinned at ${EXPECTED_ROWS})`);
}

if (fx.length !== EXPECTED_ROWS) {
  fail(
    `the fixture holds ${fx.length} columns; this gate is pinned to ${EXPECTED_ROWS}. ` +
      'Both forms shrinking together is the failure this pin exists for.',
  );
} else {
  pass(`fixture holds ${fx.length} columns (pinned at ${EXPECTED_ROWS})`);
}

// ---- 1 == 2, both directions ----------------------------------------------
const key = (r) => `${r.schema}.${r.table}.${r.column}`;
const docByKey = new Map(docRows.map((r) => [key(r), r]));
const fxByKey = new Map(fx.map((r) => [key(r), r]));

for (const r of docRows) {
  const f = fxByKey.get(key(r));
  if (!f) { fail(`S1.1 row ${r.n} (${key(r)}) is absent from the fixture`); continue; }
  if (f.n !== r.n) fail(`${key(r)}: row number ${f.n} in fixture, ${r.n} in S1.1`);
  if (f.type !== r.type) fail(`${key(r)}: type '${f.type}' in fixture, '${r.type}' in S1.1`);
  if (f.group !== r.group) fail(`${key(r)}: group '${f.group}' in fixture, '${r.group}' in S1.1`);
}
for (const f of fx) {
  if (!docByKey.has(key(f))) fail(`fixture row ${f.n} (${key(f)}) is absent from S1.1`);
  // The enforcement bit itself is register-determined, never fixture-determined:
  // S1.1's note rules rows 1-15 nullable ("Rows 1-14 must all be nullable";
  // row 15 already is) and row 16 "not a nullability question" (S1.4 -- the
  // deferral is the vector DIMENSION). A silent flip of nullable_required in
  // the fixture must be a red gate, not a silently skipped assertion.
  const expected = f.n !== 16;
  if (f.nullable_required !== expected) {
    fail(`fixture row ${f.n} (${key(f)}): nullable_required=${f.nullable_required}, ` +
      `but S1.1's note rules ${expected} -- the register wins`);
  }
}
if (failures === 0) pass(`fixture and S1.1 agree on all ${fx.length} rows, both directions`);

// ---- form 3: the live schema ----------------------------------------------
const client = new pg.Client({ connectionString: CONNECTION });
await client.connect();

const TYPE_SPELLINGS = {
  int: (c) => c.data_type === 'integer',
  interval: (c) => c.data_type === 'interval',
  'numeric(3,2)': (c) => c.data_type === 'numeric' && c.numeric_precision === 3 && c.numeric_scale === 2,
  'numeric(5,4)': (c) => c.data_type === 'numeric' && c.numeric_precision === 5 && c.numeric_scale === 4,
  'vector(N)': (c) => c.data_type === 'USER-DEFINED' && c.udt_name === 'vector',
};

for (const f of fx) {
  const r = await client.query(
    `SELECT data_type, udt_name, is_nullable, numeric_precision, numeric_scale
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [f.schema, f.table, f.column],
  );
  const col = r.rows[0];
  if (!col) {
    fail(`${key(f)} does not exist in the live schema -- the schema wins: register it, correct v1.2`);
    continue;
  }
  if (f.nullable_required) {
    if (col.is_nullable === 'YES') pass(`${key(f)} is nullable`);
    else fail(`${key(f)} is NOT NULL -- ADU-RUL-02 violated: this OPEN value cannot be deferred`);
  } else {
    note(`${key(f)} exempt from the nullability rule (S1.4: the deferral is the dimension)`);
  }
  const matcher = TYPE_SPELLINGS[f.type];
  if (matcher && !matcher(col)) {
    note(`${key(f)}: S1.1 prints '${f.type}', schema has ${col.data_type}` +
      (col.numeric_precision ? `(${col.numeric_precision},${col.numeric_scale})` : '') +
      ' -- the schema wins; a v1.2 correction is owed');
  }
}

await client.end();

if (failures > 0) {
  console.error(`\nFAIL  ${failures} disagreement(s). The schema wins; the fix is a register entry`);
  console.error('      and an ADU-VAL-01 reissue -- never a silent edit to either form.');
  process.exit(1);
}
console.log('\nPASS  three forms agree: S1.1, the fixture, and the live schema.');
