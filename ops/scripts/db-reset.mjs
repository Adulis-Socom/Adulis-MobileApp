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
 * IT REFUSES ANYTHING IT CANNOT NAME. NODE_ENV must be development or test --
 * unset is refused with the rest, because a process that cannot determine its
 * environment must not pick the permissive default (D-105) -- and the host in
 * the connection string must be local.
 *
 * THE HOST GUARD IS NOT PROOF. A port-forward to production presents as
 * localhost:5432 and passes it. It is worth having and it is not sufficient,
 * and saying so here is the point: a comment that oversells a guard is how
 * the next reader decides no further care is needed.
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
/**
 * F2 (T8-C S2 adversarial pass). The first version refused only the literal
 * string 'production' -- so an unset NODE_ENV, or 'staging', or a typo, all
 * proceeded to drop every schema. That is D-105's defect exactly, committed
 * inside the work order raised to fix it: a process that cannot determine
 * its environment must not pick the permissive default. The allow-list is
 * the inverse of the old check, and unset is refused with the rest.
 */
const RESETTABLE = ['development', 'test'];
if (!RESETTABLE.includes(process.env.NODE_ENV ?? '')) {
  console.error(
    `FAIL  NODE_ENV is ${process.env.NODE_ENV ? `'${process.env.NODE_ENV}'` : 'unset'}; ` +
      `this script runs only under ${RESETTABLE.join(' or ')}.`,
  );
  console.error('      It drops every application schema, so it refuses anything it cannot name.');
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

/**
 * F3 (adversarial pass): `before:` used to print TABLE counts and `after:`
 * ROW counts, under labels that read as a pair. The number this script exists
 * for -- 180 markets before, 1 after -- was in neither, and had to be
 * gathered by hand for D-128. Both ends now print the same five rows.
 *
 * `to_regclass` rather than a try/catch: on a genuinely fresh clone there is
 * no core.market yet, and "no tables" is the expected state, not an error.
 */
const rowCounts = async (c) => {
  const present = await c.query(`SELECT to_regclass('core.market') IS NOT NULL AS ok`);
  if (!present.rows[0].ok) return null;
  const r = await c.query(`
    SELECT (SELECT count(*)::int FROM core.market) AS markets,
           (SELECT count(*)::int FROM core.account) AS accounts,
           (SELECT count(*)::int FROM core.seller) AS sellers,
           (SELECT count(*)::int FROM core.device) AS devices,
           (SELECT count(*)::int FROM core.timing_config WHERE effective @> now()) AS timing`);
  return r.rows[0];
};
const show = (label, c) =>
  console.log(
    c === null
      ? `${label}: no core.market -- nothing has been migrated here yet`
      : `${label}: markets ${c.markets}, accounts ${c.accounts}, sellers ${c.sellers}, ` +
        `devices ${c.devices}, timing_config in force ${c.timing}`,
  );

const tables = await client.query(
  `SELECT (SELECT count(*)::int FROM information_schema.tables
            WHERE table_schema = ANY($1::text[])) AS tables`,
  [SCHEMAS],
);
console.log(`\n${tables.rows[0].tables} table(s) across ${SCHEMAS.length} schema(s)`);
show('before', await rowCounts(client));

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
// F4 (adversarial pass): fall back to DATABASE_URL only when
// DATABASE_URL_JOBS is ABSENT. If it is present but carries no password, the
// old `??` handed adulis_jobs the app's password -- one that matches nothing
// the worker will ever present, failing later and somewhere else.
const jobsUrl = process.env.DATABASE_URL_JOBS;
const wanted = [
  ['adulis_app', passwordFrom(process.env.DATABASE_URL)],
  ['adulis_jobs', jobsUrl ? passwordFrom(jobsUrl) : passwordFrom(process.env.DATABASE_URL)],
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
const c = await rowCounts(after);
await after.end();
show('after', c);

/**
 * F1 (adversarial pass), and the most important line in this file. The first
 * version printed PASS unconditionally: nothing between the counts and the
 * print read the counts. The README and the commit message both claimed it
 * "fails if the result is not what a fresh clone gives", so the repository
 * documented a check that did not exist -- which is T8-C S1's finding
 * arriving one section later by a different door.
 *
 * The numbers are PINNED, on S1's rule: what fixes them is db/seeds -- one
 * market, one account with a seller, no devices, one timing_config in force.
 * When the seed changes, this moves in the same commit, and until then a
 * seed that silently stops producing a timing row turns this red instead of
 * leaving a database where bootstrap succeeds and sign-in cannot (D-128).
 */
const EXPECTED = { markets: 1, accounts: 1, sellers: 1, devices: 0, timing: 1 };
const wrong = c === null
  ? [['core.market', 'present', 'absent']]
  : Object.entries(EXPECTED)
      .filter(([k, v]) => c[k] !== v)
      .map(([k, v]) => [k, v, c[k]]);

if (wrong.length) {
  console.error(`\nFAIL  the reset did not produce what the seed defines:`);
  for (const [k, want, got] of wrong) console.error(`        ${k}: expected ${want}, got ${got}`);
  console.error('      The schemas were dropped. Fix the seed or the migrations and run this again.');
  process.exit(1);
}
console.log('\nPASS  markets/accounts/sellers/devices/timing_config are what the seed defines.\n');
