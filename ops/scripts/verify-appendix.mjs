#!/usr/bin/env node
/**
 * ops/scripts/verify-appendix.mjs -- gate `appendix`.
 *
 * WHY IT EXISTS, in ADU-DB-01 v1.13's own words: "Three revisions running,
 * this document announced an appendix correction and did not perform it --
 * v1.10 withdrew a block and left it, v1.11 said so, v1.12 declared Appendix B
 * reconciled and named none of the three tables it claimed to have added.
 * EVERY ONE STAYED GREEN, because nothing checks the appendices." Checks 14
 * and 16 read `db/checks/fixtures/` and `pg_type`; neither has ever read the
 * document.
 *
 * This gate reads the document, and compares it BOTH WAYS against the thing
 * each appendix says it was generated from:
 *
 *   Appendix A  <->  db/checks/fixtures/appendix-a.json  (its stated source,
 *                    and the form check 16 executes)
 *   Appendix B  <->  pg_class, partitions excluded       (its stated source:
 *                    "GENERATED from pg_class across the nine schemas holding
 *                    tables, partitions excluded")
 *
 * [!] APPENDIX B NAMES A FIXTURE THAT DOES NOT EXIST (D-150). It says "the
 * full per-table list lives in db/checks/fixtures/ and is compared against
 * this section by verify:appendix" -- and that directory holds only
 * appendix-a.json and deferred-values.json. WORK ORDER T10 S2 rules this case
 * in advance: the fixture wins and the difference is a register entry. So the
 * gate reads the database, which is what Appendix B says generated it, and
 * the missing enumeration is recorded rather than invented. Writing a fixture
 * to satisfy a sentence would be creating the evidence the sentence claims.
 *
 * WHAT IT COMPARES, and what it deliberately does not. Appendix A lists TYPES
 * and says so -- "The fixture carries every value; this list carries every
 * type" -- so the values are check 16's business and this gate compares the
 * type sets. Appendix B carries counts and five named exceptions rather than
 * 114 names, for the reason the document gives: reproducing them "would be a
 * fourth copy of a fact that has already drifted three times".
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/*
 * THE INSTALLED REVISION, RESOLVED -- NOT PINNED (T24, D-304).
 *
 * This line named v1.16 literally, so installing v1.19 turned the gate red
 * with "the installed document is missing" -- a gate reporting a defect in the
 * document set when the only thing wrong was its own hardcoded filename.
 *
 * The same failure the GOVERNED list in verify-docs-ascii.mjs had before T22
 * gave it a directory comparator, and the same one ADU-DB-01 keeps registering
 * about itself: a fact written in two places drifts at the next revision.
 *
 * Newest ADU-DB-01 at the top of docs/, compared numerically so v1_10 beats
 * v1_9. docs/superseded/ is not searched, which is what makes "newest on disk"
 * mean "installed".
 */
const revOf = (base) => {
  const m = /_v(\d+)_(\d+)/.exec(base);
  return m ? Number(m[1]) * 1000 + Number(m[2]) : -1;
};
const dbDocs = readdirSync(path.join(root, 'docs'))
  .filter((f) => f.startsWith('ADU-DB-01_') && f.endsWith('.md'))
  .sort((a, b) => revOf(b) - revOf(a));
if (dbDocs.length === 0) {
  console.error('FAIL  no ADU-DB-01 revision is installed at the top of docs/.');
  process.exit(1);
}
const DOC = path.join(root, 'docs', dbDocs[0]);
const DOC_REV = /_v(\d+)_(\d+)/.exec(dbDocs[0]);
const DOC_LABEL = DOC_REV ? `v${DOC_REV[1]}.${DOC_REV[2]}` : dbDocs[0];
const FIXTURE = path.join(root, 'db', 'checks', 'fixtures', 'appendix-a.json');

/** The nine schemas that hold tables. The tenth, `jobs`, is graphile-worker's. */
const SCHEMAS = [
  'core', 'verification', 'financial', 'chat', 'nlu',
  'billing', 'ledger', 'analytics', 'waitlist',
];

let failures = 0;
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => {
  failures += 1;
  console.error(`  FAIL  ${m}`);
};

console.log(`\nADU-DB-01 ${DOC_LABEL} -- the appendices agree with what generated them\n`);

if (!existsSync(DOC)) {
  console.error(`FAIL  ${path.relative(root, DOC)} is missing. This gate reads the installed document.`);
  process.exit(1);
}
const doc = readFileSync(DOC, 'utf8');
const section = (from, to) => {
  const a = doc.indexOf(from);
  const b = doc.indexOf(to);
  if (a < 0 || b < 0 || b < a) return null;
  return doc.slice(a, b);
};

/* -- Appendix A: the type catalogue, both directions ---------------------- */
const appA = section('## Appendix A', '## Appendix B');
if (!appA) {
  fail('Appendix A not found in the document');
} else {
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const fixtureTypes = new Set(Object.keys(fixture.types));

  // `core` types are printed bare; every other schema qualifies its own.
  const coreBlock = appA.slice(appA.indexOf('**`core`**'), appA.indexOf('**Other schemas**'));
  const otherBlock = appA.slice(appA.indexOf('**Other schemas**'), appA.indexOf('**The fixture carries'));
  const docTypes = new Set([
    ...[...coreBlock.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]).filter((n) => n !== 'core').map((n) => `core.${n}`),
    ...[...otherBlock.matchAll(/`([a-z_]+\.[a-z_]+)`/g)].map((m) => m[1]),
  ]);

  const inDocOnly = [...docTypes].filter((t) => !fixtureTypes.has(t)).sort();
  const inFixtureOnly = [...fixtureTypes].filter((t) => !docTypes.has(t)).sort();

  if (inDocOnly.length) {
    fail(`Appendix A lists ${inDocOnly.length} type(s) the fixture does not: ${inDocOnly.join(', ')}`);
  }
  if (inFixtureOnly.length) {
    fail(`the fixture holds ${inFixtureOnly.length} type(s) Appendix A does not list: ${inFixtureOnly.join(', ')}`);
  }
  if (!inDocOnly.length && !inFixtureOnly.length) {
    pass(`Appendix A and the fixture agree on all ${docTypes.size} enum types, both directions`);
  }
}

/* -- Appendix B: the table manifest, against pg_class --------------------- */
const appB = section('## Appendix B', '## Appendix C');
const CONNECTION = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
if (!appB) {
  fail('Appendix B not found in the document');
} else if (!CONNECTION) {
  fail('DATABASE_URL_MIGRATE is not set; Appendix B is compared against the live schema');
} else {
  const client = new pg.Client({ connectionString: CONNECTION });
  await client.connect();
  // Partitions excluded, exactly as Appendix B states its own generation.
  const live = await client.query(
    `SELECT n.nspname AS schema, count(*)::int AS n
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ANY($1::text[])
        AND c.relkind IN ('r', 'p') AND NOT c.relispartition
      GROUP BY n.nspname`,
    [SCHEMAS],
  );
  const pinned = await client.query(
    `SELECT n.nspname || '.' || c.relname AS t
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p') AND NOT c.relispartition
        AND n.nspname || '.' || c.relname = ANY($1::text[])`,
    [[
      'core.category_market_availability',
      'core.notification_preference',
      'core.seller_courier_invite',
      'billing.purchase_intent',
      'core.seller_ownership_transfer',
    ]],
  );
  await client.end();

  const liveBySchema = Object.fromEntries(live.rows.map((r) => [r.schema, r.n]));
  const liveTotal = live.rows.reduce((s, r) => s + r.n, 0);

  /*
   * Per-schema rows: | `core` | **90** |
   *
   * WHITESPACE-TOLERANT, and that is a fix rather than a loosening (T13; the
   * adversarial pass on #45 found the same edge from the other side). The
   * first version demanded exactly one space around each pipe, so a
   * COLUMN-ALIGNED markdown table -- `| \`core\`         | **90** |`, which is
   * ordinary markdown and what both the founder's document and
   * generate-appendix.mjs emit -- parsed as ZERO rows, and the gate then
   * reported "Appendix B has no row for schema core" about a document that
   * has one. A parser that rejects valid markdown makes the gate wrong about
   * the document instead of the document wrong about the database, which is
   * the failure this gate exists to prevent, inverted.
   */
  const docBySchema = Object.fromEntries(
    [...appB.matchAll(/^\|\s*`([a-z_]+)`\s*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|$/gm)].map((m) => [
      m[1],
      Number(m[2]),
    ]),
  );
  const totalMatch = appB.match(/\*\*(\d+) tables\.\*\*/);
  const docTotal = totalMatch ? Number(totalMatch[1]) : null;

  for (const s of SCHEMAS) {
    const d = docBySchema[s];
    const l = liveBySchema[s] ?? 0;
    if (d === undefined) fail(`Appendix B has no row for schema \`${s}\`; the database holds ${l} table(s) there`);
    else if (d !== l) fail(`Appendix B says \`${s}\` holds ${d}; the database holds ${l}`);
  }
  const strays = Object.keys(docBySchema).filter((s) => !SCHEMAS.includes(s));
  if (strays.length) fail(`Appendix B lists schema(s) outside the nine: ${strays.join(', ')}`);

  if (docTotal === null) {
    fail('Appendix B states no total; the sentence "**N tables.**" is what this gate reads');
  } else if (docTotal !== liveTotal) {
    fail(`Appendix B states ${docTotal} tables; the database holds ${liveTotal}`);
  }

  // The document's own arithmetic: the per-schema rows must sum to the total
  // it prints. v1.12's core heading read 84 above a list of 85, which is the
  // failure generating the appendix was supposed to remove -- so it is checked
  // rather than assumed.
  const docSum = Object.values(docBySchema).reduce((a, b) => a + b, 0);
  if (docTotal !== null && docSum !== docTotal) {
    fail(`Appendix B's per-schema rows sum to ${docSum} and its total says ${docTotal}`);
  }

  if (pinned.rows.length !== 5) {
    const found = new Set(pinned.rows.map((r) => r.t));
    fail(
      `Appendix B flags five body-over-manifest tables and ${pinned.rows.length} exist: missing ` +
        ['core.category_market_availability', 'core.notification_preference', 'core.seller_courier_invite',
          'billing.purchase_intent', 'core.seller_ownership_transfer'].filter((t) => !found.has(t)).join(', '),
    );
  }

  if (failures === 0) {
    pass(`Appendix B and the database agree: ${docTotal} tables across ${SCHEMAS.length} schemas, per-schema and in total`);
    pass('the five body-over-manifest tables Appendix B flags all exist');
  }
}

if (failures > 0) {
  console.error(
    `\nFAIL  ${failures} disagreement(s). The FIXTURE AND THE DATABASE WIN, and the difference is a\n` +
      '      register entry -- ADU-DB-01 v1.13 S0.1 and WORK ORDER T10 S2. Do not edit the\n' +
      '      appendix to match a green check; the appendices are generated, and a hand\n' +
      '      correction here is the defect this gate exists to make impossible.\n',
  );
  process.exit(1);
}
console.log('\nPASS  Appendix A and Appendix B agree with what generated them.\n');
