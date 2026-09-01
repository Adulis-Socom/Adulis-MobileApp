#!/usr/bin/env node
/**
 * ops/scripts/generate-appendix.mjs -- the appendices, FROM THE DATABASE.
 *
 * "The appendices are no longer written by hand" (T7 Phase 2, and T13 S1
 * again). Three revisions of ADU-DB-01 announced an appendix correction and
 * did not perform it, and every one stayed green because checks 14 and 16
 * read the fixtures and NOTHING READ THE DOCUMENT -- which is what
 * verify:appendix now closes.
 *
 * The chain has a direction and this script is the first link:
 *
 *     DATABASE  ->  db/checks/fixtures/appendix-a.json  ->  the document
 *
 * So a schema change moves the fixture (this script, --write), and the
 * document is then written FROM the fixture. It never runs the other way:
 * editing the fixture to match a stale document is the defect verify:appendix
 * exists to make impossible, and T13 S1 says so in as many words.
 *
 *   pnpm generate:appendix           print Appendix A and B, for the report
 *   pnpm generate:appendix --write   also rewrite appendix-a.json from pg_type
 *
 * Requires DATABASE_URL_MIGRATE (read-only use; it needs to see every schema).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = path.join(root, 'db', 'checks', 'fixtures', 'appendix-a.json');
const WRITE = process.argv.includes('--write');

const CONNECTION = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL;
if (!CONNECTION) {
  console.error('FAIL  DATABASE_URL_MIGRATE is not set.');
  process.exit(2);
}

const SCHEMAS = [
  'core', 'chat', 'verification', 'financial', 'nlu',
  'billing', 'ledger', 'analytics', 'waitlist',
];

const client = new pg.Client({ connectionString: CONNECTION });
await client.connect();

/*
 * Appendix A: every enum type and its values, in schema then name order.
 *
 * THE ::text CAST IS LOAD-BEARING. pg_enum.enumlabel has type "name", so
 * array_agg without it yields name[], which node-pg does not parse -- it
 * hands back the literal string '{A,B,C}' and every downstream .join and
 * .length then operates on a string instead of an array. Check 16 caught
 * exactly that on this script's first run ("expected.join is not a
 * function"), which is the same class as T10's fk.child_cols bug. (The
 * explanation lives here rather than inside the SQL because a backtick in a
 * SQL comment terminates the template literal -- which is how the SECOND
 * version of this file failed.)
 */
const types = await client.query(
  `SELECT n.nspname AS schema, t.typname AS name,
          array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS values
     FROM pg_type t
     JOIN pg_namespace n ON n.oid = t.typnamespace
     JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = ANY($1)
    GROUP BY n.nspname, t.typname
    ORDER BY n.nspname, t.typname`,
  [SCHEMAS],
);

/* -- Appendix B: every table, partitions excluded (a partitioned table is
      ONE table in the manifest -- check 14's own rule). ------------------- */
const tables = await client.query(
  `SELECT n.nspname AS schema, c.relname AS name
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ANY($1)
      AND c.relkind IN ('r', 'p')
      AND NOT EXISTS (SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid)
    ORDER BY n.nspname, c.relname`,
  [SCHEMAS],
);
await client.end();

const qualified = (r) => `${r.schema}.${r.name}`;

/* ---------------------------------------------------------------- the fixture */
if (WRITE) {
  const existing = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const next = {
    _provenance: existing._provenance,
    types: Object.fromEntries(types.rows.map((r) => [qualified(r), r.values])),
    ...(existing._conflicts ? { _conflicts: existing._conflicts } : {}),
  };
  writeFileSync(FIXTURE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  const before = Object.keys(existing.types).length;
  const after = Object.keys(next.types).length;
  console.error(`appendix-a.json: ${before} -> ${after} types, from pg_type\n`);
}

/* ------------------------------------------------------- the printable form */
const byNs = new Map();
for (const r of types.rows) {
  if (!byNs.has(r.schema)) byNs.set(r.schema, []);
  byNs.get(r.schema).push(r);
}

const out = [];
out.push('## Appendix A -- Enum catalogue');
out.push('');
out.push(`**GENERATED from \`db/checks/fixtures/appendix-a.json\`** -- the form check 16 executes -- **never written by hand.**`);
out.push('');
out.push(`**There is no asserted count. The check is the count.** \`verify:appendix\` compares this section against the fixture in both directions.`);
out.push('');
out.push(`**\`core\`** -- ${byNs.get('core').map((r) => `\`${r.name}\``).join(' - ')}`);
out.push('');
const others = [...byNs.entries()].filter(([ns]) => ns !== 'core');
out.push(
  `**Other schemas** -- ${others
    .flatMap(([ns, rs]) => rs.map((r) => `\`${ns}.${r.name}\``))
    .join(' - ')}`,
);
out.push('');
out.push('**The fixture carries every value; this list carries every type.** For values, read the fixture -- it is what check 16 executes, and a second transcription here would be another copy of a fact.');
out.push('');
out.push('## Appendix B -- Table manifest');
out.push('');
out.push(`**GENERATED from \`pg_class\`.** Partitions are excluded: a partitioned table is ONE table here, which is check 14's own rule.`);
out.push('');
const byNsT = new Map();
for (const r of tables.rows) {
  if (!byNsT.has(r.schema)) byNsT.set(r.schema, []);
  byNsT.get(r.schema).push(r.name);
}
for (const ns of SCHEMAS) {
  const rs = byNsT.get(ns);
  if (!rs) continue;
  out.push(`**\`${ns}\`** (${rs.length}) -- ${rs.map((n) => `\`${n}\``).join(' - ')}`);
  out.push('');
}
out.push(`**Total: ${tables.rows.length} tables, ${types.rows.length} enum types.**`);

console.log(out.join('\n'));
