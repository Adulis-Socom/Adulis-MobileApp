#!/usr/bin/env node
// Exit 0 only if EVERY database URL the gates will use reaches a database carrying the disposable mark
// (WO-INFRA-012). gates.mjs runs it before the first gate that writes to the database: locally the root
// .env points at the persistent development database, `migrate` (migrations + seed) runs before `test`,
// and `console-e2e` starts the API with DATABASE_URL, not DATABASE_URL_MIGRATE. The same rules as the
// Jest guard (apps/api/test/db-target.ts): required URLs set and not empty, loopback, an explicit port,
// and the mark read through each URL. Exit 1: refused. Exit 2: could not check.
import pg from 'pg';

export const DISPOSABLE_MARKER = 'adulis:disposable-test-database';
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const NAMES = ['DATABASE_URL', 'DATABASE_URL_MIGRATE', 'DATABASE_URL_JOBS'];

const problems = [];
const urls = [];
for (const name of NAMES) {
  const raw = process.env[name];
  if (raw === undefined) {
    if (name !== 'DATABASE_URL_JOBS') problems.push(`${name} is not set: no default is safe`);
    continue;
  }
  let u;
  try {
    u = new URL(raw);
  } catch {
    problems.push(`${name} is ${raw === '' ? 'empty' : 'not a URL'}`);
    continue;
  }
  if (!LOOPBACK.has(u.hostname))
    problems.push(`${name} points at ${u.hostname}, not a loopback host`);
  if (!u.port) problems.push(`${name} has no explicit port`);
  if (['host', 'hostaddr', 'port', 'dbname', 'service'].some((k) => u.searchParams.has(k)))
    problems.push(`${name} overrides its target in the query string`);
  urls.push({ name, raw });
}
if (problems.length) {
  console.error(`FAIL  the database configuration is refused:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}

for (const { name, raw } of urls) {
  const client = new pg.Client({
    connectionString: raw,
    options: '-c default_transaction_read_only=on',
  });
  try {
    await client.connect();
    const { rows } = await client.query(
      `SELECT current_database() AS db, shobj_description(oid, 'pg_database') AS marker
         FROM pg_database WHERE datname = current_database()`,
    );
    if (rows[0]?.marker !== DISPOSABLE_MARKER) {
      console.error(
        `FAIL  ${name} reaches database ${rows[0]?.db}, which is not marked disposable: the gates that write refuse.\n` +
          '      Start one: bash ops/scripts/test-db.sh up && eval "$(bash ops/scripts/test-db.sh env)"',
      );
      process.exitCode = 1;
    } else console.log(`  PASS  ${name} reaches ${rows[0].db}, marked disposable`);
  } catch (e) {
    console.error(`FAIL  could not read the mark through ${name}: ${e.message}`);
    process.exitCode = 2;
  } finally {
    await client.end().catch(() => {});
  }
  if (process.exitCode) break;
}
