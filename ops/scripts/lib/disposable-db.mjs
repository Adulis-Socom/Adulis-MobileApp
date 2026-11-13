// What the test tooling may destroy, defined once (WO-INFRA-012, WO-INFRA-015A).
//
// A database is DISPOSABLE when it carries the comment DISPOSABLE_MARKER, set only by
// ops/scripts/test-db.sh and by CI on the databases they create. Everything that drops, resets or
// re-creates databases for TESTS checks it here first: assert-disposable-db.mjs (the gate check),
// db-determinism.mjs, verify-console-e2e.mjs, and db-reset.mjs (which also allows an explicitly
// confirmed reset of a named persistent target). apps/api/test/db-target.ts applies the same rules
// to the Jest suites and keeps its own spec.
//
// Nothing here writes. Every connection is read-only, and `docker` is only inspected or used to
// run a read-only query.
import { appendFileSync } from 'node:fs';
import { hostname, userInfo } from 'node:os';
import pg from 'pg';

export const DISPOSABLE_MARKER = 'adulis:disposable-test-database';
export const DB_URL_NAMES = ['DATABASE_URL', 'DATABASE_URL_MIGRATE', 'DATABASE_URL_JOBS'];
const OPTIONAL_URLS = new Set(['DATABASE_URL_JOBS']); // the jobs suites throw without it
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const TARGET_PARAMS = ['host', 'hostaddr', 'port', 'dbname', 'service'];
// The persistent development server, refused by name as well as by its named data volume.
export const PROTECTED_CONTAINERS = new Set(['adulis-postgres']);
const ANONYMOUS_VOLUME = /^[0-9a-f]{64}$/;

/** Configuration only, no connection. Returns { problems, urls }. */
export function checkUrlConfig(env, names = DB_URL_NAMES, optional = OPTIONAL_URLS) {
  const problems = [];
  const urls = [];
  for (const name of names) {
    const raw = env[name];
    if (raw === undefined) {
      if (!optional.has(name)) problems.push(`${name} is not set: no default is safe`);
      continue;
    }
    let u;
    try {
      u = new URL(raw);
    } catch {
      problems.push(`${name} is ${raw === '' ? 'empty' : 'not a URL'}`);
      continue;
    }
    if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:')
      problems.push(`${name} is not a postgres URL`);
    if (!LOOPBACK.has(u.hostname)) problems.push(`${name} points at ${u.hostname}, not a loopback host`);
    if (!u.port) problems.push(`${name} has no explicit port`);
    if (TARGET_PARAMS.some((k) => u.searchParams.has(k)))
      problems.push(`${name} overrides its target in the query string`);
    urls.push({ name, raw, url: u });
  }
  return { problems, urls };
}

/**
 * The database one URL reaches, read in a read-only session: its name, its mark, and (when the
 * role may read it) the cluster's system identifier, which tells one server from another.
 */
export async function readIdentity(raw, { Client = pg.Client, withSystemId = false } = {}) {
  const client = new Client({
    connectionString: raw,
    options: '-c default_transaction_read_only=on',
    connectionTimeoutMillis: 10_000,
  });
  try {
    await client.connect();
    const { rows } = await client.query(
      `SELECT current_database() AS db, shobj_description(oid, 'pg_database') AS marker${
        withSystemId ? ', (SELECT system_identifier::text FROM pg_control_system()) AS system_id' : ''
      } FROM pg_database WHERE datname = current_database()`,
    );
    return rows[0] ?? null;
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Every configured URL must reach a database carrying the mark. Returns { code, out, err }:
 * code 0 all marked, 1 refused, 2 could not check (never read as a pass).
 */
export async function checkDisposable(env, { names = DB_URL_NAMES, Client } = {}) {
  const { problems, urls } = checkUrlConfig(env, names);
  if (problems.length)
    return { code: 1, out: [], err: [`FAIL  the database configuration is refused:\n  - ${problems.join('\n  - ')}`] };
  const out = [];
  for (const { name, raw } of urls) {
    let id;
    try {
      id = await readIdentity(raw, { Client });
    } catch (e) {
      return { code: 2, out, err: [`FAIL  could not read the mark through ${name}: ${e.message}`] };
    }
    if (id?.marker !== DISPOSABLE_MARKER)
      return {
        code: 1,
        out,
        err: [
          `FAIL  ${name} reaches database ${id?.db}, which is not marked disposable: the gates that write refuse.\n` +
            '      Start one: bash ops/scripts/test-db.sh up && eval "$(bash ops/scripts/test-db.sh env)"',
        ],
      };
    out.push(`  PASS  ${name} reaches ${id.db}, marked disposable`);
  }
  return { code: 0, out, err: [] };
}

/**
 * db-determinism DROPs and CREATEs databases with `docker exec` into a container, and migrates them
 * through DATABASE_URL_MIGRATE. Both paths must reach the SAME disposable server, so this proves it
 * before anything is written:
 *   1. the URL passes checkUrlConfig and reaches a marked database (read over TCP);
 *   2. the container is named, exists, runs, is not the persistent development server, and keeps
 *      its data in no named volume (CI's service container and test-db.sh's keep none);
 *   3. the container publishes 5432 on the URL's port;
 *   4. inside the container, the same database carries the mark and the cluster has the same
 *      system identifier as the server the URL reached.
 * `docker(args)` returns { status, stdout, stderr, error }. Returns { ok, code, problems, id }:
 * `id` is the container's full ID, the only handle later steps may use.
 */
export async function checkContainerTarget({ container, adminUrl, docker, Client }) {
  const refused = (code, ...problems) => ({ ok: false, code, problems });
  const { problems, urls } = checkUrlConfig({ DATABASE_URL_MIGRATE: adminUrl }, ['DATABASE_URL_MIGRATE']);
  if (problems.length) return refused(1, ...problems);
  if (!container)
    return refused(
      1,
      'ADULIS_PG_CONTAINER is not set: name the disposable PostgreSQL container (test-db.sh env exports it; CI passes its service container). There is no default.',
    );
  const url = urls[0].url;
  const user = decodeURIComponent(url.username);
  const db = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!user || !db) return refused(1, 'DATABASE_URL_MIGRATE names no user or no database');

  let overUrl;
  try {
    overUrl = await readIdentity(adminUrl, { Client, withSystemId: true });
  } catch (e) {
    return refused(2, `could not reach PostgreSQL through DATABASE_URL_MIGRATE: ${e.message}`);
  }
  if (overUrl?.marker !== DISPOSABLE_MARKER)
    return refused(1, `DATABASE_URL_MIGRATE reaches database ${overUrl?.db}, which is not marked disposable`);
  if (!overUrl.system_id) return refused(2, 'could not read the server identity through DATABASE_URL_MIGRATE');

  const r = docker(['inspect', container]);
  if (r.error) return refused(2, `could not run docker: ${r.error.message}`);
  if (r.status !== 0)
    return refused(
      /no such/i.test(`${r.stderr}${r.stdout}`) ? 1 : 2,
      `docker inspect ${container} failed: ${`${r.stderr || r.stdout}`.trim().slice(-300)}`,
    );
  let info;
  try {
    [info] = JSON.parse(r.stdout);
  } catch {
    return refused(2, `docker inspect ${container} returned no readable description`);
  }
  if (!info?.Id) return refused(2, `docker inspect ${container} returned no container`);
  const name = `${info.Name ?? ''}`.replace(/^\//, '');
  const why = [];
  if (PROTECTED_CONTAINERS.has(name) || PROTECTED_CONTAINERS.has(container))
    why.push(`${name} is the persistent development server`);
  if (!info.State?.Running) why.push(`${name} is not running`);
  const named = (info.Mounts ?? []).filter((m) => m.Type === 'volume' && !ANONYMOUS_VOLUME.test(m.Name ?? ''));
  if (named.length)
    why.push(
      `${name} keeps data in named volume(s) ${named.map((m) => m.Name).join(', ')}: a disposable server keeps none`,
    );
  const bound = (info.NetworkSettings?.Ports?.['5432/tcp'] ?? []).map((p) => `${p.HostPort}`);
  if (!bound.includes(url.port))
    why.push(`${name} publishes 5432 on [${bound.join(', ') || 'nothing'}], not on ${url.port} (the URL's port)`);
  if (why.length) return refused(1, ...why);

  const sql =
    "SELECT (SELECT system_identifier::text FROM pg_control_system()) || '|' || " +
    "coalesce(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname = current_database()";
  const q = docker(['exec', info.Id, 'psql', '-U', user, '-d', db, '-AtX', '-v', 'ON_ERROR_STOP=1', '-c', sql]);
  if (q.error || q.status !== 0)
    return refused(2, `could not query PostgreSQL inside ${name}: ${`${q.error?.message ?? q.stderr ?? ''}`.trim().slice(-300)}`);
  const [systemId, marker] = `${q.stdout}`.trim().split('|');
  if (marker !== DISPOSABLE_MARKER) return refused(1, `inside ${name}, database ${db} is not marked disposable`);
  if (systemId !== overUrl.system_id)
    return refused(
      1,
      `${name} is a different server from the one DATABASE_URL_MIGRATE reaches (system identifier ${systemId} != ${overUrl.system_id})`,
    );
  return { ok: true, code: 0, problems: [], id: info.Id, name, user };
}

/**
 * db-reset may reset (a) a database carrying the mark, or (b) one persistent database the caller
 * names exactly, on the command line, for this run only: --confirm-target=<database>@<host>:<port>.
 * An environment variable can never authorise (b). Pure: `identity` is what the URL reached.
 */
export function resetDecision({ url, identity, argv }) {
  if (identity?.marker === DISPOSABLE_MARKER) return { allowed: true, kind: 'disposable' };
  const target = `${identity?.db}@${url.hostname}:${url.port || '5432'}`;
  const flags = argv.filter((a) => a.startsWith('--confirm-target='));
  const how = `pnpm db:reset -- --confirm-target=${target}`;
  if (flags.length === 0)
    return {
      allowed: false,
      target,
      reason: `${target} is not marked disposable. To reset this persistent database deliberately: ${how}`,
    };
  if (flags.length > 1) return { allowed: false, target, reason: 'more than one --confirm-target given' };
  const named = flags[0].slice('--confirm-target='.length);
  if (named !== target)
    return { allowed: false, target, reason: `--confirm-target names ${named}, but this run would reset ${target}` };
  return { allowed: true, kind: 'confirmed', target };
}

/** One JSON line per authorised persistent reset; a reset that cannot be recorded does not run. */
export function recordAdminAction(file, action, target, now = new Date()) {
  let who = 'unknown';
  try {
    who = userInfo().username;
  } catch {
    /* recorded as unknown */
  }
  appendFileSync(file, `${JSON.stringify({ at: now.toISOString(), action, target, user: who, host: hostname(), pid: process.pid })}\n`);
}
