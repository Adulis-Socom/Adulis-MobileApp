import { Client } from 'pg';
import { bootstrap } from '../src/db/bootstrap';
import { runMigrations } from '../src/db/migrate';

/**
 * Integration support. Every suite works in its OWN fresh database (adulis_rebuild_t_<name>) created inside the
 * disposable test cluster, so suites never share state and never touch a persistent database (root CLAUDE.md).
 * Missing services FAIL the run; they never skip it.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`integration tests need ${name} (CI services or ops/rebuild/disposable-db.sh)`);
  return value;
}

export const PASSWORDS = {
  ADULIS_DB_MIGRATOR_PASSWORD: 'migrator-local-only',
  ADULIS_DB_API_PASSWORD: 'api-role-local-only',
  ADULIS_DB_WORKER_PASSWORD: 'worker-role-local-only',
};

export interface TestDb {
  readonly name: string;
  readonly superuser: string;
  readonly migrator: string;
  readonly api: string;
  readonly worker: string;
}

function urlFor(base: string, db: string, user?: string, password?: string): string {
  const u = new URL(base);
  u.pathname = `/${db}`;
  if (user !== undefined && password !== undefined) {
    u.username = user;
    u.password = password;
  }
  return u.toString();
}

/** Creates an EMPTY database (dropping a previous run's copy of the same disposable name). */
export async function createEmptyDatabase(suffix: string): Promise<TestDb> {
  if (!/^[a-z0-9_]{1,30}$/.test(suffix)) throw new Error('bad suffix');
  const base = requireEnv('TEST_DATABASE_URL_BOOTSTRAP');
  const name = `adulis_rebuild_t_${suffix}`;
  const admin = new Client({ connectionString: base });
  await admin.connect();
  try {
    await admin.query(`drop database if exists ${name} with (force)`);
    await admin.query(`create database ${name}`);
  } finally {
    await admin.end();
  }
  return {
    name,
    superuser: urlFor(base, name),
    migrator: urlFor(base, name, 'adulis_migrator', PASSWORDS.ADULIS_DB_MIGRATOR_PASSWORD),
    api: urlFor(base, name, 'adulis_api', PASSWORDS.ADULIS_DB_API_PASSWORD),
    worker: urlFor(base, name, 'adulis_worker', PASSWORDS.ADULIS_DB_WORKER_PASSWORD),
  };
}

/** A database brought up exactly as production would be: bootstrap, then the one migration actor. */
export async function freshReplacementDatabase(suffix: string): Promise<TestDb> {
  const db = await createEmptyDatabase(suffix);
  await bootstrap({ DATABASE_URL_BOOTSTRAP: db.superuser, ...PASSWORDS });
  await runMigrations(db.migrator);
  return db;
}

export async function withClient<T>(url: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Normalized schema: everything that defines behaviour (columns, constraints, indexes, triggers, functions, grants, RLS). */
export const SCHEMA_SNAPSHOT_SQL = `
select 'col ' || table_schema || '.' || table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '') as line
  from information_schema.columns where table_schema not in ('pg_catalog', 'information_schema')
union all select 'con ' || conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid)
  from pg_constraint where connamespace::regnamespace::text not in ('pg_catalog', 'information_schema')
union all select 'idx ' || indexdef from pg_indexes where schemaname not in ('pg_catalog', 'information_schema')
union all select 'trg ' || pg_get_triggerdef(oid) from pg_trigger where not tgisinternal
union all select 'fn ' || p.oid::regprocedure || ' ' || md5(p.prosrc) || ' ' || coalesce(p.proacl::text, '') || ' secdef=' || p.prosecdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname not in ('pg_catalog', 'information_schema')
union all select 'rel ' || c.oid::regclass || ' ' || c.relkind || ' ' || coalesce(c.relacl::text, '') || ' rls=' || c.relrowsecurity || '/' || c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
union all select 'colacl ' || attrelid::regclass || '.' || attname || ' ' || attacl::text from pg_attribute where attacl is not null
union all select 'ns ' || nspname || ' ' || coalesce(nspacl::text, '') from pg_namespace where nspname not like 'pg\\_%' and nspname <> 'information_schema'
union all select 'pol ' || schemaname || '.' || tablename || ' ' || policyname || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '') from pg_policies
order by 1`;

export async function schemaSnapshot(url: string): Promise<string[]> {
  return withClient(url, async (c) => (await c.query(SCHEMA_SNAPSHOT_SQL)).rows.map((r: { line: string }) => r.line));
}
