import { Client } from 'pg';

/**
 * WHICH DATABASE THE API SUITES MAY TOUCH (WO-INFRA-012).
 *
 * The suites insert, delete, and in about 36 files switch off foreign-key triggers with
 * `session_replication_role = replica`. Run against the persistent development database, they left
 * rows that break its foreign keys (ISSUE-INFRA-FOLLOWUP-005): the root .env, which the test script
 * loads, points there.
 *
 * So a run proceeds only against a database that says it is disposable. All three of these hold:
 *   - every URL is set (an unset one means libpq's defaults: some other local database), names a
 *     loopback host, and all of them name the same database;
 *   - that database carries DISPOSABLE_MARKER as its comment. Only CI's service database and
 *     ops/scripts/test-db.sh set it; nobody marks a database they keep;
 *   - NODE_ENV is not production or staging.
 *
 * NODE_ENV=test alone proves nothing: it is a label on the process, not a property of the database.
 */
export const DISPOSABLE_MARKER = 'adulis:disposable-test-database';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
// libpq lets the query string override the host, port or database of the URL itself.
const TARGET_OVERRIDES = ['host', 'hostaddr', 'port', 'dbname', 'service'];
const HOW =
  'Start a disposable database: `bash ops/scripts/test-db.sh up`, then `eval "$(bash ops/scripts/test-db.sh env)"` (docs/infrastructure/WO-INFRA-012-ISOLATION-IMPLEMENTATION.md).';

export interface Target {
  host: string;
  port: string;
  database: string;
}

const refuse = (problems: string[]): never => {
  throw new Error(
    `[db-target] the API suites refuse this database:\n  - ${problems.join('\n  - ')}\n${HOW}`,
  );
};

/** Everything that can be decided without connecting. Returns the one target all URLs name. */
export function resolveTarget(env: NodeJS.ProcessEnv): Target {
  const problems: string[] = [];
  if (env['NODE_ENV'] === 'production' || env['NODE_ENV'] === 'staging')
    problems.push(`NODE_ENV is ${env['NODE_ENV']}`);
  const targets: Array<Target & { name: string }> = [];
  for (const name of ['DATABASE_URL', 'DATABASE_URL_MIGRATE', 'DATABASE_URL_JOBS']) {
    const raw = env[name];
    if (!raw) {
      // The jobs suites fall back to DATABASE_URL, so an unset DATABASE_URL_JOBS names no new target.
      if (name !== 'DATABASE_URL_JOBS') problems.push(`${name} is not set: no default is safe`);
      continue;
    }
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      problems.push(`${name} is not a URL`);
      continue;
    }
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:')
      problems.push(`${name} is not a postgres URL`);
    const overrides = TARGET_OVERRIDES.filter((k) => url.searchParams.has(k));
    if (overrides.length)
      problems.push(`${name} overrides its target in the query string (${overrides.join(', ')})`);
    if (!LOOPBACK.has(url.hostname))
      problems.push(
        `${name} points at ${url.hostname}: only a loopback database can be disposable here`,
      );
    targets.push({
      name,
      host: url.hostname === 'localhost' ? '127.0.0.1' : url.hostname,
      port: url.port || '5432',
      database: decodeURIComponent(url.pathname.slice(1)),
    });
  }
  const keys = new Set(targets.map((t) => `${t.host}:${t.port}/${t.database}`));
  if (keys.size > 1) problems.push(`the URLs name different databases (${[...keys].join(', ')})`);
  if (problems.length || !targets[0]) refuse(problems.length ? problems : ['no database URL']);
  const { host, port, database } = targets[0]!;
  return { host, port, database };
}

export interface MarkerReader {
  connect(): Promise<unknown>;
  query(sql: string): Promise<{ rows: Array<{ db?: string; marker?: string | null }> }>;
  end(): Promise<unknown>;
}

/** The target, checked for the marker through the migrate credential (it can read pg_database). */
export async function assertDisposable(
  env: NodeJS.ProcessEnv = process.env,
  reader: (url: string) => MarkerReader = (url) =>
    new Client({ connectionString: url }) as unknown as MarkerReader,
): Promise<Target> {
  const target = resolveTarget(env);
  const client = reader(env['DATABASE_URL_MIGRATE']!);
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT current_database() AS db, shobj_description(oid, 'pg_database') AS marker
         FROM pg_database WHERE datname = current_database()`,
    );
    const where = `${target.host}:${target.port}/${target.database}`;
    if (rows[0]?.db !== target.database)
      refuse([`connected to ${rows[0]?.db ?? 'nothing'}, not ${where}`]);
    if (rows[0]?.marker !== DISPOSABLE_MARKER)
      refuse([
        `${where} is not marked disposable (its comment is ${JSON.stringify(rows[0]?.marker ?? null)})`,
      ]);
  } finally {
    await client.end();
  }
  return target;
}
