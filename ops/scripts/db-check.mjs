#!/usr/bin/env node
/**
 * `pnpm db:check` — ADU-DB-01 v1.9 Appendix C, all sixteen checks.
 *
 * Each check guards an invariant enforced by an ABSENCE: the failure mode where
 * an agent "completes" the schema and silently removes a guarantee. Nothing here
 * raises on its own, which is why the harness exists.
 *
 * THREE STATES. Most checks guard objects a later tier creates. A binary harness
 * would print nine failures at Tier 1 and drown the two that are real.
 *
 *   PASS     ran, invariant holds
 *   FAIL     ran, invariant broken   -> exit 1
 *   PENDING  belongs to a later tier -> not run, not a failure
 *
 * Exits non-zero ONLY on FAIL. See db/checks/README.md.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { loadMigrations, PASS, FAIL, PENDING, CHECKS_DIR } from '../../db/checks/_lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

async function readCurrentTier() {
  const raw = await readFile(path.join(repoRoot, 'db', 'checks', 'CURRENT_TIER'), 'utf8');
  const tier = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(tier)) throw new Error(`db/checks/CURRENT_TIER is not an integer: ${raw}`);
  return tier;
}

async function loadChecks() {
  const files = (await readdir(CHECKS_DIR))
    .filter((f) => f.startsWith('check-') && f.endsWith('.mjs'))
    .sort();
  const checks = [];
  for (const f of files) {
    // pathToFileURL: on Windows a bare absolute path is not a valid ESM specifier.
    const mod = await import(pathToFileURL(path.join(CHECKS_DIR, f)).href);
    checks.push({ ...mod.default, file: f });
  }
  return checks.sort((a, b) => a.id - b.id);
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

const tier = await readCurrentTier();
const checks = await loadChecks();
const migrations = await loadMigrations();

if (checks.length !== 16) {
  console.error(`FAIL  expected 16 checks in db/checks, found ${checks.length}`);
  process.exit(2);
}

// One connection, opened only if a live check will actually use it.
const needsDb = checks.some((c) => c.kind === 'database' && tier >= c.liveAtTier);
let client = null;
if (needsDb) {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    console.error('FAIL  DATABASE_URL is not set, and live database checks are due at this tier.');
    console.error('      Run:  docker compose up -d  &&  cp .env.example .env');
    process.exit(2);
  }
  client = new pg.Client({ connectionString });
  try {
    await client.connect();
  } catch (err) {
    console.error(`FAIL  cannot connect to the database: ${err.message}`);
    process.exit(2);
  }
}

const sql = async (text, params = []) => (await client.query(text, params)).rows;
const ctx = { sql, migrations, tier, repoRoot };

const results = [];
for (const check of checks) {
  if (tier < check.liveAtTier) {
    results.push({ check, state: PENDING, detail: `live at Tier ${check.liveAtTier}` });
    continue;
  }
  try {
    const r = await check.run(ctx);
    results.push({ check, ...r });
  } catch (err) {
    results.push({ check, state: FAIL, detail: `check threw: ${err.message}` });
  }
}

if (client) await client.end();

console.log(`\nADU-DB-01 v1.9 Appendix C — sixteen checks · repository at Tier ${tier}`);
console.log(`migrations inspected: ${migrations.length}\n`);
const W = Math.max(...checks.map((c) => c.title.length)) + 2;
console.log(`  ${pad('#', 3)}${pad('STATE', 9)}${pad('CHECK', W)}DETAIL`);
console.log(`  ${'-'.repeat(3 + 9 + W + 40)}`);
for (const r of results) {
  console.log(`  ${pad(r.check.id, 3)}${pad(r.state, 9)}${pad(r.check.title, W)}${r.detail}`);
}

const count = (s) => results.filter((r) => r.state === s).length;
const [p, f, w] = [count(PASS), count(FAIL), count(PENDING)];
console.log(`\n  ${p} PASS · ${w} PENDING · ${f} FAIL\n`);

if (f > 0) {
  console.error('An Appendix C invariant is broken. Stop and fix it before continuing.\n');
  process.exit(1);
}
