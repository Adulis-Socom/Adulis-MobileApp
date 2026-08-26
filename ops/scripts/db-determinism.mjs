#!/usr/bin/env node
/**
 * `pnpm db:determinism` — ADU-CON-02 v3.0 section 16:
 * "migrations applied twice to empty DBs, schema dumps diffed".
 *
 * Catches a migration whose EFFECT on the schema is not reproducible: an
 * ordering that depends on the clock, a name derived from a sequence, anything
 * that makes two clean environments diverge. Every environment converging on the
 * same schema is the entire premise of a migration runner, and it is not true by
 * construction — it is true until someone writes `now()` into a DDL default.
 *
 * ONE TRAP, RECORDED SO IT IS NOT REDISCOVERED. pg_dump 17 emits a per-run
 * random token on `\restrict` / `\unrestrict` lines. A naive `diff` of two dumps
 * therefore ALWAYS reports a difference, on any schema, forever — a check that
 * fails on correct input teaches people to ignore it. Lines beginning with a
 * backslash are psql meta-commands rather than schema, and are excluded.
 */

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const CONTAINER = process.env['ADULIS_PG_CONTAINER'] ?? 'adulis-postgres';
const ADMIN_URL = process.env['DATABASE_URL_MIGRATE'];

if (!ADMIN_URL) {
  console.error('FAIL  DATABASE_URL_MIGRATE is not set.');
  process.exit(2);
}

const url = new URL(ADMIN_URL);
const adminUser = decodeURIComponent(url.username);
const suffix = randomUUID().slice(0, 8).replace(/-/g, '');
const dbs = [`adulis_det_a_${suffix}`, `adulis_det_b_${suffix}`];

/** Run psql/pg_dump inside the container, so no client tooling is required. */
function inContainer(args, { capture = false } = {}) {
  const r = spawnSync('docker', ['exec', '-i', CONTAINER, ...args], {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (r.status !== 0 && capture) {
    console.error(r.stderr);
    throw new Error(`${args[0]} failed`);
  }
  return r.stdout ?? '';
}

function adminSql(sqlText) {
  inContainer(['psql', '-U', adminUser, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sqlText], {
    capture: true,
  });
}

function migrate(dbName) {
  const target = new URL(ADMIN_URL);
  target.pathname = `/${dbName}`;
  const r = spawnSync(
    process.execPath,
    [
      'node_modules/node-pg-migrate/bin/node-pg-migrate.js',
      '-d', 'DETERMINISM_URL',
      '-m', 'db/migrations',
      '-j', 'sql',
      'up',
    ],
    { encoding: 'utf8', env: { ...process.env, DETERMINISM_URL: target.href } },
  );
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    throw new Error(`migrations failed against ${dbName}`);
  }
}

/** Schema only, ownership and privileges excluded, psql meta-commands stripped. */
function schemaLines(dbName) {
  const dump = inContainer(
    ['pg_dump', '-U', adminUser, '-d', dbName, '--schema-only', '--no-owner', '--no-privileges'],
    { capture: true },
  );
  return dump.split('\n').filter((l) => !l.startsWith('\\'));
}

let failed = false;
try {
  for (const d of dbs) {
    adminSql(`DROP DATABASE IF EXISTS ${d}`);
    adminSql(`CREATE DATABASE ${d}`);
    migrate(d);
  }
  const [a, b] = dbs.map(schemaLines);

  if (a.length === b.length && a.every((l, i) => l === b[i])) {
    console.log(`PASS  two clean databases converge on an identical schema (${a.length} lines compared).`);
  } else {
    failed = true;
    console.error('FAIL  migrations are not deterministic. First differences:');
    let shown = 0;
    for (let i = 0; i < Math.max(a.length, b.length) && shown < 12; i += 1) {
      if (a[i] !== b[i]) {
        console.error(`  ${i + 1}\n    A: ${a[i] ?? '<absent>'}\n    B: ${b[i] ?? '<absent>'}`);
        shown += 1;
      }
    }
  }
} finally {
  for (const d of dbs) {
    try {
      adminSql(`DROP DATABASE IF EXISTS ${d}`);
    } catch {
      console.error(`warning: could not drop scratch database ${d}`);
    }
  }
}

process.exit(failed ? 1 : 0);
