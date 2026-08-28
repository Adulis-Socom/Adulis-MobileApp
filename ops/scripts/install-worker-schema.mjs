/**
 * Install graphile-worker's own tables into the `jobs` schema, as the DDL
 * role, and grant the runtime role what it needs to use them.
 *
 * WHY THIS EXISTS AS A STEP (register D-52). graphile-worker installs its
 * schema on first boot, and its very first statement is
 * `create schema if not exists jobs` — which requires CREATE **on the
 * database**, even when the schema already exists. Letting the worker hold
 * that would mean the runtime role could create arbitrary schemas, which is
 * exactly the kind of standing privilege the boundary work of T3/T4 spent
 * two migrations removing.
 *
 * So the DDL happens here, as `adulis_migrate`, the same way every other
 * schema change does: "a rule the database can hold, the database holds",
 * and privileges the runtime does not need, the runtime does not get. The
 * worker then boots, finds `jobs.migrations` already present, and skips its
 * installer entirely.
 *
 * Run:  pnpm worker:install     (after pnpm db:migrate)
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// The script lives at the repo root but the dependency belongs to apps/api
// (ADU-REPO-01 S4: the root package.json is thin and delegates), so resolve
// from there rather than hoisting graphile-worker to the root.
const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { Client } = require('pg');
const { runMigrations } = require('graphile-worker');

// Local convenience only. CI supplies the environment directly and has no
// .env, so its absence is not an error — and must not be, or the deploy step
// this script becomes fails on every machine that does it properly.
try {
  for (const line of readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* no .env: CI, or a real deployment */
}

const connectionString = process.env.DATABASE_URL_MIGRATE;
if (!connectionString) {
  console.error('DATABASE_URL_MIGRATE is not set — this step is DDL and needs the DDL role.');
  process.exit(1);
}

await runMigrations({ connectionString, schema: 'jobs' });

const c = new Client({ connectionString });
await c.connect();
try {
  // The worker role uses these tables; it does not own them. Grants are
  // per-object rather than a blanket ALTER DEFAULT PRIVILEGES so that a
  // future graphile table arrives visibly rather than silently.
  await c.query(`GRANT USAGE ON SCHEMA jobs TO adulis_jobs`);
  await c.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA jobs TO adulis_jobs`);
  await c.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA jobs TO adulis_jobs`);
  await c.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jobs TO adulis_jobs`);

  // OWNERSHIP, and it is not a formality (register D-52). graphile-worker
  // enables ROW-LEVEL SECURITY on its own tables with policies written for
  // their owner, so a non-owning role with full DML still cannot insert:
  //
  //   ERROR: new row violates row-level security policy for table "_private_tasks"
  //
  // The worker BOOTS anyway and then fails on its first task, which is the
  // worst shape available — a process that looks alive and does nothing.
  // The queue's tables belong to the queue's user: DDL is performed by the
  // migrate role (so the runtime never needs CREATE on the database), and
  // ownership then moves to adulis_jobs, which already owns the schema.
  // Tables and views only. An identity/serial sequence is OWNED BY its
  // table's column and follows it — PostgreSQL refuses to move one on its
  // own ("cannot change owner of sequence"). worker_heartbeat is ours, from
  // migration 0026, and is not graphile's to re-own.
  const owned = await c.query(
    `SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'jobs' AND c.relkind IN ('r','p','v')
        AND c.relname <> 'worker_heartbeat'`,
  );
  for (const row of owned.rows) {
    const what = row.relkind === 'v' ? 'VIEW' : 'TABLE';
    await c.query(`ALTER ${what} jobs.${'"' + row.relname + '"'} OWNER TO adulis_jobs`);
  }
  const tables = await c.query(
    `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'jobs' AND c.relkind IN ('r','p')`,
  );
  console.log(`worker schema installed: ${tables.rows[0].n} tables in schema jobs, granted to adulis_jobs`);
} finally {
  await c.end();
}
