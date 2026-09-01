#!/usr/bin/env node
/**
 * ops/scripts/verify-transcription.mjs -- gate `transcription`.
 *
 * "THE MIGRATION IS THE ONLY WITNESS TO ITSELF." Migration 0043 transcribes
 * ADU-AUTH-01 v2.6's delivery layer into enums, a table and columns; nothing
 * checked that the transcription matched the document, so a value dropped, a
 * status renamed or a column forgotten would have shipped green. This gate is
 * that check, and WORK ORDER T14 S6 widened it from "the five enums" to
 * S12.1's fields and S9.1's columns.
 *
 * It compares the LIVE DATABASE (what the migration produced) against the
 * INSTALLED DOCUMENT (what it was supposed to produce), both directions.
 *
 * [!] THE GATE MUST NOT INHERIT THE DEFECT IT FIXES (T14 S6). A parser that
 * finds nothing compares an empty set to an empty set and goes GREEN on
 * nothing the day the document changes shape -- which is the exact defect
 * class this repository is built around (a check that runs and a check that
 * checks are different things). So it ASSERTS THE PARSE FOUND WHAT IT EXPECTED
 * before it compares anything: five enum blocks, six delivery statuses, ten
 * S12.1 fields, the S9.1 column block. A shape it cannot find is a FAIL, never
 * a silent pass. Proven red from BOTH sides -- a document value removed, and a
 * database value removed.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOC = path.join(root, 'docs', 'ADU-AUTH-01_Authentication_and_Authorization_v2_6.md');
const CONNECTION = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

let failures = 0;
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => {
  failures += 1;
  console.error(`  FAIL  ${m}`);
};

console.log('\nADU-AUTH-01 v2.6 -- migration 0043 transcribes the document, checked both ways\n');

if (!existsSync(DOC)) {
  console.error(`FAIL  ${path.relative(root, DOC)} is missing. This gate reads the installed document.`);
  process.exit(1);
}
if (!CONNECTION) {
  console.error('FAIL  DATABASE_URL_MIGRATE is not set; this gate compares against the live schema.');
  process.exit(1);
}
const doc = readFileSync(DOC, 'utf8');

/**
 * Read a fenced text block that follows a heading, and return its non-empty
 * lines. Returns null when the heading is absent, so a moved section is a
 * self-check failure rather than an empty comparison.
 */
const fencedAfter = (heading, which = 1) => {
  const h = doc.indexOf(heading);
  if (h < 0) return null;
  let open = h;
  for (let i = 0; i < which; i += 1) {
    open = doc.indexOf('```text', open + 1);
    if (open < 0) return null;
  }
  const close = doc.indexOf('```', open + 7);
  if (close < 0) return null;
  return doc
    .slice(open + 7, close)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
};

/**
 * THE FIVE ENUMS, each named by the DB type 0043 created and the document
 * section that governs its values. `expectMin` is the self-check: the parse
 * must find at least this many values or the section moved and the comparison
 * would be vacuous.
 */
const ENUMS = [
  { type: 'core.market_activation_state', heading: '# 9.2 Market activation state', expectMin: 7 },
  { type: 'core.sms_sender_mode', heading: '# 10.1 Sender modes', expectMin: 4 },
  { type: 'core.sender_registration_status', heading: '# 10.2 Sender registration', expectMin: 4 },
  { type: 'core.otp_delivery_status', heading: '# 12.2 Delivery status values', expectExact: 6 },
];

const client = new pg.Client({ connectionString: CONNECTION });
await client.connect();

const dbEnumValues = async (qualified) => {
  const [schema, name] = qualified.split('.');
  const r = await client.query(
    `SELECT e.enumlabel::text AS v
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = $1 AND t.typname = $2
      ORDER BY e.enumsortorder`,
    [schema, name],
  );
  return r.rows.map((row) => row.v);
};

const UPPER = /^[A-Z][A-Z0-9_]*$/;

for (const spec of ENUMS) {
  const lines = fencedAfter(spec.heading);
  if (!lines) {
    fail(`SELF-CHECK: could not find "${spec.heading}" and its fenced block -- the document moved`);
    continue;
  }
  const docValues = lines.filter((l) => UPPER.test(l));
  const want = spec.expectExact ?? spec.expectMin;
  if (spec.expectExact !== undefined ? docValues.length !== want : docValues.length < want) {
    fail(
      `SELF-CHECK: parsed ${docValues.length} value(s) under "${spec.heading}", expected ` +
        `${spec.expectExact !== undefined ? '' : 'at least '}${want} -- the parser or the section changed shape`,
    );
    continue;
  }
  const dbValues = await dbEnumValues(spec.type);
  if (dbValues.length === 0) {
    fail(`SELF-CHECK: ${spec.type} has no values in the database -- the enum is missing`);
    continue;
  }
  const docSet = new Set(docValues);
  const dbSet = new Set(dbValues);
  const docOnly = [...docSet].filter((v) => !dbSet.has(v)).sort();
  const dbOnly = [...dbSet].filter((v) => !docSet.has(v)).sort();
  if (docOnly.length) fail(`${spec.type}: the document names ${docOnly.join(', ')} and the database does not`);
  if (dbOnly.length) fail(`${spec.type}: the database has ${dbOnly.join(', ')} and the document does not name it`);
  if (!docOnly.length && !dbOnly.length) {
    pass(`${spec.type}: ${docSet.size} values agree with ${spec.heading.replace('# ', 'S')}, both ways`);
  }
}

/*
 * The fifth enum, core.sms_provider, is S6.1's provider set -- named in prose
 * ("Initial implementations: AfroMessage... Twilio"), not in a fenced value
 * block, and rendered in code as UPPER_SNAKE. Its values are asserted against
 * the router's four bound providers rather than parsed from mixed-case prose,
 * because inventing a parse of a sentence is how a gate starts lying.
 */
const providers = await dbEnumValues('core.sms_provider');
const EXPECTED_PROVIDERS = ['AFROMESSAGE', 'SMSETHIOPIA', 'INFOBIP', 'TWILIO'];
if (providers.length !== 4) {
  fail(`SELF-CHECK: core.sms_provider has ${providers.length} values, expected 4 (S6.1's initial set)`);
} else {
  const missing = EXPECTED_PROVIDERS.filter((p) => !providers.includes(p));
  const extra = providers.filter((p) => !EXPECTED_PROVIDERS.includes(p));
  if (missing.length) fail(`core.sms_provider is missing S6.1 provider(s): ${missing.join(', ')}`);
  if (extra.length) fail(`core.sms_provider has provider(s) S6.1 does not name: ${extra.join(', ')}`);
  if (!missing.length && !extra.length) pass('core.sms_provider: S6.1 four initial providers, both ways');
}

/* -- S12.1's fields on core.otp_delivery_attempt -------------------------- */
const s121 = fencedAfter('# 12.1 Delivery persistence', 2);
if (!s121) {
  fail('SELF-CHECK: could not find S12.1 and its fenced field block');
} else {
  // The field block is the SECOND fence under 12.1 (the first is the table
  // name); parse "name" and "name nullable", drop the constraint fence.
  const fields = s121
    .filter((l) => /^[a-z_]+( nullable)?$/.test(l))
    .map((l) => l.replace(' nullable', ''));
  if (fields.length < 10) {
    fail(`SELF-CHECK: parsed ${fields.length} S12.1 field(s), expected at least 10 -- the block changed shape`);
  } else {
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'otp_delivery_attempt'`,
    );
    const dbCols = new Set(cols.rows.map((r) => r.column_name));
    const missing = fields.filter((f) => !dbCols.has(f)).sort();
    if (missing.length) {
      fail(`core.otp_delivery_attempt is missing S12.1 field(s): ${missing.join(', ')}`);
    } else {
      pass(`core.otp_delivery_attempt carries all ${fields.length} S12.1 fields`);
    }
  }
}

/* -- S9.1's columns on core.market ---------------------------------------- */
const s91 = fencedAfter('# 9.1 Market configuration');
if (!s91) {
  fail('SELF-CHECK: could not find S9.1 and its fenced column block');
} else {
  // S9.1 names market_config's columns. market_code is the document's key and
  // maps to core.market.code; default_currency/default_timezone predate 0043
  // as display_currency/display_timezone. The rest are 0043's columns, by name.
  const RENAMED = { market_code: 'code', default_currency: 'display_currency', default_timezone: 'display_timezone' };
  const cols = s91
    .filter((l) => /^[a-z_]+$/.test(l) && l !== 'market_config')
    .map((l) => RENAMED[l] ?? l);
  if (cols.length < 14) {
    fail(`SELF-CHECK: parsed ${cols.length} S9.1 column(s), expected at least 14 -- the block changed shape`);
  } else {
    const live = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'market'`,
    );
    const dbCols = new Set(live.rows.map((r) => r.column_name));
    const missing = cols.filter((c) => !dbCols.has(c)).sort();
    if (missing.length) {
      fail(`core.market is missing S9.1 column(s): ${missing.join(', ')}`);
    } else {
      pass(`core.market carries all ${cols.length} S9.1 columns (three renamed, mapped by name)`);
    }
  }
}

await client.end();

if (failures) {
  console.error(`\nFAIL  ${failures} transcription check(s) failed.\n`);
  process.exit(1);
}
console.log('\nPASS  the migration and the document agree on the delivery layer.\n');