import type { ClientBase, Pool } from 'pg';

/**
 * Database-target safety (ARC-BE-01/03, RBL-02). Every process that opens the replacement database proves,
 * BEFORE doing anything else, that it is connected to the replacement lineage and never to adulis-postgres:
 * exact name grammar, the identity comment, no legacy-lineage markers, a known migration history, and (for the
 * API and worker) a role that is neither superuser nor BYPASSRLS. Any doubt refuses.
 */

export const LINEAGE = 'rebuild-20261125';
/** Identical to ops/rebuild/disposable-db.sh. Stamped once on an EMPTY database, never overwritten. */
export const DATABASE_IDENTITY = `adulis clean-rebuild disposable target, lineage ${LINEAGE}; never the legacy adulis-postgres`;
/** adulis_rebuild, or a suffixed disposable copy (adulis_rebuild_det_a). Never the legacy `adulis`. */
export const DATABASE_NAME = /^adulis_rebuild(?:_[a-z0-9_]{1,40})?$/;
/**
 * Markers the replacement can NEVER contain (so a future domain schema named `chat` or `core` is not refused):
 * node-pg-migrate's history, the Graphile Worker schema, and the retired Reservation table (RB25-D03).
 */
// Catalog lookups, not to_regclass(): the runtime roles have no USAGE on `public`, and to_regclass() on a schema
// the caller cannot use raises 42501 instead of answering.
export const LEGACY_MARKERS_SQL = `select (exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'pgmigrations')
  or exists (select 1 from pg_namespace where nspname = 'graphile_worker')
  or exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'core' and c.relname = 'reservation')) as v`;
/** Host ports of the repository default, another local project, and adulis-postgres. Refused on loopback. */
const LEGACY_LOOPBACK_PORTS = new Set(['5432', '5433', '5434']);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export type Stage = 'bootstrap' | 'migrate' | 'runtime';
type Queryable = Pool | ClientBase;

export class TargetRefused extends Error {
  override readonly name = 'TargetRefused';
}
const refuse = (why: string): never => {
  throw new TargetRefused(`database target refused: ${why}`);
};

export function assertTargetUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return refuse('connection URL does not parse');
  }
  const port = parsed.port || '5432';
  if (LOOPBACK.has(parsed.hostname) && LEGACY_LOOPBACK_PORTS.has(port)) refuse(`loopback port ${port} belongs to a non-rebuild database`);
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!DATABASE_NAME.test(name)) refuse(`database name '${name}' is not a replacement-lineage name`);
  return name;
}

async function one<T>(db: Queryable, text: string, values: unknown[] = []): Promise<T> {
  const r = await db.query(text, values);
  return (r.rows[0] as Record<string, T>)['v'] as T;
}

export async function identityComment(db: Queryable): Promise<string | null> {
  return one<string | null>(db, `select shobj_description(oid, 'pg_database') as v from pg_database where datname = current_database()`);
}

export async function assertReplacementTarget(
  db: Queryable,
  url: string,
  opts: { stage: Stage; journalHashes?: readonly string[]; expectedRole?: 'adulis_api' | 'adulis_worker' | 'adulis_migrator' },
): Promise<void> {
  const urlName = assertTargetUrl(url);
  const current = await one<string>(db, 'select current_database() as v');
  if (current !== urlName || !DATABASE_NAME.test(current)) refuse(`connected database '${current}' is not '${urlName}'`);

  if (await one<boolean>(db, LEGACY_MARKERS_SQL)) refuse('a legacy-lineage marker (pgmigrations, graphile_worker, core.reservation) is present');

  // Bootstrap checks identity itself, because it is the one stage allowed to stamp an empty database.
  if (opts.stage !== 'bootstrap' && (await identityComment(db)) !== DATABASE_IDENTITY) refuse('identity comment absent or foreign');

  if (opts.stage === 'migrate') {
    const known = new Set(opts.journalHashes ?? refuse('migrate stage needs the local journal'));
    const hasHistory = await one<boolean>(db, `select exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'drizzle' and c.relname = '__drizzle_migrations') as v`);
    if (hasHistory) {
      const applied = await db.query('select hash from drizzle.__drizzle_migrations order by id');
      for (const row of applied.rows as { hash: string }[]) if (!known.has(row.hash)) refuse('applied migration history is not this lineage');
    }
  }

  if (opts.stage !== 'bootstrap') {
    const role = (await db.query('select rolsuper, rolbypassrls from pg_roles where rolname = current_user')).rows[0] as
      | { rolsuper: boolean; rolbypassrls: boolean }
      | undefined;
    if (!role || role.rolsuper || role.rolbypassrls) refuse('migrations, the API and the worker never run as a superuser or BYPASSRLS role');
    // Each process runs as exactly its own role: never the owner, never a role that can SET ROLE to another.
    if (opts.expectedRole !== undefined && (await one<string>(db, 'select current_user::text as v')) !== opts.expectedRole) {
      refuse(`this process must connect as ${opts.expectedRole}`);
    }
    const memberships = await one<number>(db, 'select count(*)::int as v from pg_auth_members m join pg_roles r on r.oid = m.member where r.rolname = current_user');
    if (memberships > 0) refuse('the connecting role is a member of another role');
  }
}
