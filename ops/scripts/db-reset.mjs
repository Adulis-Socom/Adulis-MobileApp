#!/usr/bin/env node
/**
 * ops/scripts/db-reset.mjs -- drop, re-migrate, seed. (ADU-RUL-05 S3 via
 * T8-C S2.1 -- that document is cited and not supplied, D-125.)
 *
 * WHY A DEVELOPMENT DATABASE NEEDS A RESET BUTTON. Suites create rows and
 * mostly delete them; the ones that do not accumulate. At T8-C this database
 * held 180 markets, 180 accounts, 180 sellers and 458 devices, none of the
 * markets live and only the seeded one carrying a timing_config -- so
 * /v1/bootstrap assigned a market with no timing row and a console sign-in
 * could not complete. A development environment that has degraded until the
 * product does not run makes every local finding suspect: you cannot tell a
 * defect from a deposit.
 *
 * WHAT IT DOES, in the order CI does it, because the point is to arrive at
 * the state CI starts from:
 *   1. drop every application schema, and node-pg-migrate's own record
 *   2. re-create the four extensions (db/init/00-extensions.sql)
 *   3. pnpm db:migrate
 *   4. pnpm worker:install -- graphile-worker's tables live in the `jobs`
 *      schema, which step 1 drops. Nothing else re-creates them: the worker
 *      is not allowed to install its own schema (D-52), so a reset without
 *      this step leaves a database where the worker cannot boot. Found by
 *      running the suite after the first reset: worker-runtime.spec.ts
 *      failed with `permission denied for database adulis`, which is the
 *      runtime role correctly lacking CREATE on the database.
 *   5. give the runtime roles a LOGIN password -- migration 01 creates them
 *      NOLOGIN, because a password in a migration is a secret in git
 *   6. pnpm db:seed
 *
 * IT REFUSES ANYTHING THAT LOOKS LIKE A REAL DEPLOYMENT. NODE_ENV=production
 * is refused outright, and so is a connection string that is not local --
 * this script's whole job is destruction, and the guard is the only thing
 * between it and a database somebody cares about.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONNECTION = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL;

if (!CONNECTION) {
  console.error('FAIL  DATABASE_URL_MIGRATE is not set. Run: docker compose up -d && cp .env.example .env');
  process.exit(2);
}
if (process.env.NODE_ENV === 'production') {
  console.error('FAIL  refusing to reset with NODE_ENV=production.');
  process.exit(2);
}
const host = (() => {
  try {
    return new URL(CONNECTION).hostname;
  } catch {
    return '';
  }
})();
if (!['localhost', '127.0.0.1', '::1', 'db', 'postgres'].includes(host)) {
  console.error(`FAIL  refusing to reset a non-local database (host: ${host || 'unparseable'}).`);
  console.error('      This script drops every application schema. That is its purpose.');
  process.exit(2);
}

/** Every schema the migrations create. core.* is the bulk; the rest are boundaries. */
const SCHEMAS = [
  'core', 'chat', 'billing', 'financial', 'ledger', 'analytics', 'nlu',
  'verification', 'waitlist', 'jobs',
];

const run = (cmd, args) => {
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
};

const client = new pg.Client({ connectionString: CONNECTION });
await client.connect();

const before = await client.query(
  `SELECT (SELECT count(*)::int FROM information_schema.tables
            WHERE table_schema = ANY($1::text[])) AS tables`,
  [SCHEMAS],
);
console.log(`\nbefore: ${before.rows[0].tables} table(s) across ${SCHEMAS.length} schema(s)`);

for (const s of SCHEMAS) {
  await client.query(`DROP SCHEMA IF EXISTS ${s} CASCADE`);
}
// node-pg-migrate's ledger lives in public; without dropping it, migrate is a
// no-op against an empty database and every later step fails confusingly.
await client.query('DROP TABLE IF EXISTS public.pgmigrations');
console.log('dropped: application schemas and the migration record');
await client.end();

console.log('\n-- extensions ------------------------------------------------');
const extSql = readFileSync(path.join(root, 'db', 'init', '00-extensions.sql'), 'utf8');
const ext = new pg.Client({ connectionString: CONNECTION });
await ext.connect();
await ext.query(extSql);
await ext.end();
console.log('the four extensions are in place');

console.log('\n-- migrate ---------------------------------------------------');
run('pnpm', ['db:migrate']);

console.log('\n-- worker queue schema ---------------------------------------');
run('pnpm', ['worker:install']);

console.log('\n-- runtime roles ---------------------------------------------');
const roles = new pg.Client({ connectionString: CONNECTION });
await roles.connect();

/**
 * THE PASSWORD COMES FROM .env, NOT FROM HERE. Migration 01 creates these
 * roles NOLOGIN -- a password in a migration is a secret in git -- so the
 * reset has to hand them one. Inventing a default breaks the developer's own
 * connection strings: the first version set 'dev-password', and the API came
 * up with `"db":"down"` because DATABASE_URL still carried the old one. The
 * only password that can be right is the one already configured.
 */
const passwordFrom = (url) => {
  try {
    const p = new URL(url ?? '').password;
    return p ? decodeURIComponent(p) : null;
  } catch {
    return null;
  }
};
const wanted = [
  ['adulis_app', passwordFrom(process.env.DATABASE_URL)],
  ['adulis_jobs', passwordFrom(process.env.DATABASE_URL_JOBS) ?? passwordFrom(process.env.DATABASE_URL)],
];
for (const [role, pw] of wanted) {
  if (!pw) {
    console.error(
      `FAIL  no password for ${role}: set DATABASE_URL (and DATABASE_URL_JOBS) in .env. ` +
        'The reset gives the runtime roles the password your connection strings already use, ' +
        'because any other choice leaves the API unable to connect to the database it just built.',
    );
    process.exit(2);
  }
  await roles.query(`ALTER ROLE ${role} LOGIN PASSWORD '${pw.replace(/'/g, "''")}'`);
}
await roles.end();
console.log('adulis_app and adulis_jobs can log in, with the password .env already uses');

console.log('\n-- seed ------------------------------------------------------');
run('pnpm', ['db:seed']);

const after = new pg.Client({ connectionString: CONNECTION });
await after.connect();
const counts = await after.query(`
  SELECT (SELECT count(*)::int FROM core.market) AS markets,
         (SELECT count(*)::int FROM core.account) AS accounts,
         (SELECT count(*)::int FROM core.device) AS devices,
         (SELECT count(*)::int FROM core.seller) AS sellers,
         (SELECT count(*)::int FROM core.timing_config WHERE effective @> now()) AS timing`);
await after.end();
const c = counts.rows[0];
console.log(
  `\nafter: markets ${c.markets}, accounts ${c.accounts}, sellers ${c.sellers}, ` +
    `devices ${c.devices}, timing_config in force ${c.timing}`,
);
console.log('\nPASS  the database is what migrate, worker:install and seed give on a fresh clone.\n');
