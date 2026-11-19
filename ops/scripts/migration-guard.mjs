// Fail-closed guard for applying db/migrations (DB-LIVE-02).
//
// THE DEFECT. node-pg-migrate applies whatever is in the directory. A migration file that is MISSING from the
// middle of the sequence is never noticed: the runner applies the files it finds, exits 0, and the database ends
// up at a version whose schema nobody has seen. A renamed, duplicated or edited file is not noticed either: the
// runner records only names, never contents.
//
// THE GUARD. `ops/migrations.manifest.json` pins every migration file (name and sha256, in order). Before
// anything is applied, `up` checks, and refuses on the first problem, never spawning the runner:
//   1 the directory holds exactly the pinned files (none missing, none unexpected, no duplicate number, no rename);
//   2 every file's bytes equal the pinned hash (no unreviewed edit of a historical migration);
//   3 the pinned list is itself a clean sequence 0001..N;
//   4 with --expect-commit: the checkout is that commit and db/migrations and the manifest are clean in git;
//   5 the database history (pgmigrations) is exactly the first N pinned names, in order: no unknown, skipped or
//     re-ordered version (`up` always reads it, read-only; `verify` reads it with --db).
// `write` pins ADDED migrations only. It never re-pins a missing or changed historical file: that needs a hand edit
// of the manifest, which shows in review.
//
// THE TARGET. The checks above are about the files. Before the runner starts, `up` also asks which database this is
// (classifyTarget): DISPOSABLE (a loopback host named exactly, a port the URL names that is not the protected one, and
// a database that carries the disposable mark), PERSISTENT-DEV (the protected development port, or a loopback database
// without the mark) or UNKNOWN (everything else; never treated as disposable). Only a DISPOSABLE target is migrated on
// the ordinary command. Any other needs the approved commit (--expect-commit, the full sha, equal to HEAD, no changed
// tracked file) and --confirm-target=<database>@<host>:<port> naming exactly this run's target; the authorization is
// appended to .adulis-db-admin.log first. A dry run is allowed on every target.
//
//   node ops/scripts/migration-guard.mjs verify [--db] [--expect-commit <sha>] [--base <ref>]
//                                                                  (--base: the manifest only appends to the one at <ref>)
//   node ops/scripts/migration-guard.mjs up (--expect-commit <sha> | --no-source-check) [--confirm-target=<db>@<host>:<port>]
//                                                                  [--dry-run]   (verify, the target gate, then node-pg-migrate up)
//   node ops/scripts/migration-guard.mjs authorize [--expect-commit <sha>] [--confirm-target=<db>@<host>:<port>]
//                                                                  (only the target gate: exit 0 when `up` would be allowed)
//   node ops/scripts/migration-guard.mjs write                    (pin newly added migrations)
//
// Refusals are written to stderr (a caller that discards stdout still sees why nothing was applied); progress to stdout.
// This is the only code that starts the runner (a test pins that). `pnpm db:migrate` is `up --no-source-check`: every
// check except the git source check, and it applies only to a DISPOSABLE target. A persistent or shared database is
// upgraded with `pnpm db:migrate:guarded --expect-commit <sha> --confirm-target=<db>@<host>:<port>`.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DISPOSABLE_MARKER,
  DISPOSABLE_SETUP_MARKER,
  PERSISTENT_DEV_PORTS,
  readIdentity,
  recordAdminAction,
} from './lib/disposable-db.mjs';

export { PERSISTENT_DEV_PORTS };

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const DEFAULT_DIR = path.join(REPO_ROOT, 'db', 'migrations');
export const DEFAULT_MANIFEST = path.join(REPO_ROOT, 'ops', 'migrations.manifest.json');
export const MIGRATION_NAME = /^(\d{4})_[a-z0-9_]+\.sql$/;
/** The only non-migration entry the directory may hold: git's placeholder. Anything else is unexpected. */
export const IGNORED_ENTRIES = new Set(['.gitkeep']);

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** The pinned list: [{ name, sha256 }], in sequence. */
export function buildManifest(dir) {
  const entries = readdirSync(dir);
  const odd = entries.filter((n) => !MIGRATION_NAME.test(n) && !IGNORED_ENTRIES.has(n));
  if (odd.length)
    throw new Error(
      `the migrations directory holds entries that are not NNNN_name.sql: ${odd.join(', ')}`,
    );
  const names = entries.filter((n) => MIGRATION_NAME.test(n)).sort();
  return {
    version: 1,
    files: names.map((name) => ({ name, sha256: sha256(readFileSync(path.join(dir, name))) })),
  };
}

/** The manifest must be a well-formed, gapless, duplicate-free sequence starting at 0001. */
export function checkManifest(manifest) {
  const problems = [];
  if (
    !manifest ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.files) ||
    manifest.files.length === 0
  ) {
    return ['MANIFEST is not a version 1 list of files'];
  }
  manifest.files.forEach((f, i) => {
    const m = MIGRATION_NAME.exec(f?.name ?? '');
    if (!m) {
      problems.push(`MANIFEST entry ${i} has an invalid name: ${JSON.stringify(f?.name)}`);
      return;
    }
    if (!/^[0-9a-f]{64}$/.test(f.sha256 ?? ''))
      problems.push(`MANIFEST entry ${f.name} has an invalid sha256`);
    if (Number(m[1]) !== i + 1)
      problems.push(
        `MANIFEST sequence broken at position ${i + 1}: found ${f.name} (expected number ${String(i + 1).padStart(4, '0')})`,
      );
  });
  return problems;
}

/** The directory against the manifest: files present, files unexpected, numbers duplicated, contents unchanged. */
export function checkDirectory(dir, manifest) {
  const problems = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (e) {
    return [`DIRECTORY ${dir} cannot be read: ${e.code ?? e.message}`];
  }
  const pinned = new Map(manifest.files.map((f) => [f.name, f.sha256]));
  const byNumber = new Map();
  for (const n of entries) {
    const m = MIGRATION_NAME.exec(n);
    if (m) byNumber.set(m[1], [...(byNumber.get(m[1]) ?? []), n]);
    if (!pinned.has(n) && !IGNORED_ENTRIES.has(n))
      problems.push(
        `UNEXPECTED file in the migrations directory: ${n} (a new migration is pinned in the same change: pnpm db:migration-pin)`,
      );
  }
  for (const [num, names] of byNumber)
    if (names.length > 1) problems.push(`DUPLICATE number ${num}: ${names.join(', ')}`);
  for (const [name, hash] of pinned) {
    if (!entries.includes(name)) {
      problems.push(`MISSING migration ${name}`);
      continue;
    }
    const bytes = readFileSync(path.join(dir, name));
    const actual = sha256(bytes);
    if (actual !== hash)
      problems.push(
        `CHANGED migration ${name}: sha256 ${actual.slice(0, 16)} differs from the pinned ${hash.slice(0, 16)}${bytes.includes(0x0d) ? ' (the file has CRLF line endings; migrations are LF)' : ''}`,
      );
  }
  return problems;
}

/** node-pg-migrate records an SQL migration by its file name WITHOUT the .sql extension (pgmigrations.name). */
export const recordedName = (fileName) => fileName.replace(/\.sql$/, '');

/**
 * The database history against the manifest: exactly the first N pinned names, in order.
 * `applied` holds names as pgmigrations records them (no .sql). Returns { problems, pending } (pending as file names).
 */
export function checkHistory(applied, manifest) {
  const problems = [];
  const files = manifest.files.map((f) => f.name);
  const recorded = files.map(recordedName);
  applied.forEach((name, i) => {
    if (i >= recorded.length)
      problems.push(
        `APPLIED but not pinned: ${name} (position ${i + 1}); the database is ahead of this checkout`,
      );
    else if (name !== recorded[i])
      problems.push(
        `HISTORY MISMATCH at position ${i + 1}: the database has ${name}, the manifest expects ${recorded[i]} (an unknown, skipped or re-ordered version)`,
      );
  });
  return { problems, pending: problems.length === 0 ? files.slice(applied.length) : [] };
}

/** Variables that move git to another repository than the checkout's own. */
const GIT_LOCATION_ENV = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_NAMESPACE',
];

/** The environment git is started with: the repository-location variables are dropped by name in any letter case (Windows ignores case). */
export function gitEnvironment(base = process.env) {
  const env = { ...base };
  for (const k of Object.keys(env)) if (GIT_LOCATION_ENV.includes(k.toUpperCase())) delete env[k];
  return env;
}

function git(root, args) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env: gitEnvironment() });
  return {
    status: r.status,
    out: (r.stdout ?? '').trim(),
    err: (r.stderr ?? '').trim(),
    spawnError: r.error?.code ?? null,
  };
}

const NO_OWN_GIT =
  'this directory is not a git checkout of its own, so the commit it was built from cannot be checked. A database that is not disposable is migrated only from a clean git checkout of the approved commit (--expect-commit <full sha>); an artifact without git metadata cannot satisfy that';

const firstLine = (text) => text.split(/\r?\n/)[0];

/** Why git could not describe the directory, in the words that tell the operator what to do. */
function whyNoGit(r) {
  if (r.status === null)
    return {
      cause: `git could not be started${r.spawnError ? ` (${r.spawnError})` : ''}`,
      advice: 'git is not installed or is not on PATH',
    };
  const cause = firstLine(r.err) || 'git failed';
  if (/dubious ownership|safe\.directory/i.test(r.err))
    return {
      cause,
      advice: 'git refuses a directory that belongs to another user (see safe.directory)',
    };
  if (/not a git repository/i.test(r.err)) return { cause, advice: 'it has no .git of its own' };
  return { cause, advice: 'git cannot read this checkout' };
}

/**
 * HEAD of the checkout's OWN repository. `root` must be that repository's work tree and its top level: git finds a
 * repository by walking up, so a directory without a .git of its own (an unpacked artifact inside a workspace, say) would
 * otherwise be judged by the repository around it, and a bare repository or the inside of a git directory is no checkout
 * at all. A linked worktree or a submodule (whose .git is a file) is a checkout of its own and is judged by its own HEAD.
 * Returns { head } or { problem }. `run` is injectable for the tests.
 */
export function readCheckoutHead(root, run = git) {
  const refuse = (cause, advice) => ({
    problem: `SOURCE: cannot read the git HEAD (${cause}):${advice ? ` ${advice}.` : ''} ${NO_OWN_GIT}`,
  });
  const top = run(root, ['rev-parse', '--is-inside-work-tree', '--show-cdup']);
  if (top.status !== 0) {
    const why = whyNoGit(top);
    return refuse(why.cause, why.advice);
  }
  const [inside, cdup = ''] = top.out.split(/\r?\n/);
  if (inside !== 'true')
    return refuse('it is not a work tree: a bare repository, or the inside of a git directory', '');
  if (cdup !== '')
    return refuse('it has no .git of its own and sits inside another repository', '');
  const head = run(root, ['rev-parse', 'HEAD']);
  if (head.status !== 0)
    return { problem: `SOURCE: cannot read the git HEAD (${head.err || 'git failed'})` };
  return { head: head.out };
}

/** Source commit: the checkout is the expected commit, and the migrations and the manifest are exactly as committed. */
export function checkSource({
  root,
  expectedCommit,
  dirRel = 'db/migrations',
  manifestRel = 'ops/migrations.manifest.json',
}) {
  const problems = [];
  const head = readCheckoutHead(root);
  if (!head.head) return [head.problem];
  if (!/^[0-9a-f]{7,40}$/i.test(expectedCommit))
    return [
      `SOURCE: --expect-commit must be a hex commit (7 to 40 characters), got ${JSON.stringify(expectedCommit)}`,
    ];
  if (!head.head.toLowerCase().startsWith(expectedCommit.toLowerCase()))
    problems.push(`SOURCE: HEAD is ${head.head.slice(0, 12)}, expected ${expectedCommit}`);
  const status = git(root, [
    'status',
    '--porcelain',
    '--untracked-files=all',
    '--',
    dirRel,
    manifestRel,
  ]);
  if (status.status !== 0) problems.push(`SOURCE: git status failed (${status.err})`);
  else if (status.out !== '')
    problems.push(`SOURCE: the migrations or the manifest differ from the commit:\n${status.out}`);
  return problems;
}

/** A git ref the check may hand to git: no leading dash (an option), no spaces or other shell-looking characters. */
const PLAIN_REF = /^[A-Za-z0-9][A-Za-z0-9._/@^~-]*$/;

/**
 * The manifest as committed at `ref`: { manifest } (null when that commit has none yet) or { problems }.
 * "No manifest yet" is claimed only when git LISTS the commit's tree successfully and the path is not in it. Any other
 * outcome (an unreadable or missing object, a shallow or damaged clone, git not starting) refuses: a failed read is
 * never read as an empty base. (`git cat-file -e ref:path` cannot be used for this: it exits 128 both for a path that
 * is absent from a good commit and for a broken repository.) `runGit` is injectable for the tests.
 */
export function readBaseManifest(
  root,
  ref,
  manifestRel = 'ops/migrations.manifest.json',
  runGit = git,
) {
  if (!PLAIN_REF.test(ref))
    return { problems: [`BASE ${JSON.stringify(ref)} is not a plain git ref`] };
  if (runGit(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).status !== 0)
    return { problems: [`BASE ${ref} is not a commit in this clone (fetch it first)`] };
  const listed = runGit(root, ['ls-tree', '--name-only', ref, '--', manifestRel]);
  if (listed.status !== 0)
    return {
      problems: [
        `BASE ${ref}: git could not read the committed tree (${listed.err || 'git failed'})`,
      ],
    };
  if (listed.out === '') return { manifest: null };
  if (listed.out !== manifestRel)
    return { problems: [`BASE ${ref}: git listed an unexpected entry for the manifest path`] };
  const shown = runGit(root, ['show', `${ref}:${manifestRel}`]);
  if (shown.status !== 0)
    return {
      problems: [
        `BASE ${ref}: git could not read the committed manifest (${shown.err || 'git failed'})`,
      ],
    };
  try {
    return { manifest: JSON.parse(shown.out) };
  } catch {
    return { problems: [`BASE ${ref}: the committed manifest is not JSON`] };
  }
}

/**
 * The manifest against the one at the base commit: every base entry is still there, unchanged, in the same place;
 * a change may only append. A hand edit of a merged migration together with its manifest line passes every other
 * check, so this is what shows it. `base` null: the base has no manifest yet, nothing to compare.
 */
export function checkAppendOnly(base, current) {
  if (base === null) return [];
  const problems = checkManifest(base).map((p) => `BASE ${p}`);
  if (problems.length) return problems;
  base.files.forEach((f, i) => {
    const now = current?.files?.[i];
    if (!now)
      problems.push(
        `REMOVED pinned entry ${f.name} (position ${i + 1}): the manifest is append-only`,
      );
    else if (now.name !== f.name)
      problems.push(
        `RENAMED or reordered pinned entry at position ${i + 1}: ${f.name} is now ${now.name}`,
      );
    else if (now.sha256 !== f.sha256)
      problems.push(
        `CHANGED pinned entry ${f.name}: sha256 ${String(now.sha256).slice(0, 16)} differs from the base's ${f.sha256.slice(0, 16)} (a merged migration is never rewritten)`,
      );
  });
  return problems;
}

/** The applied names, read-only, oldest first. A missing pgmigrations table is an empty history; any other error refuses. */
export async function readApplied(connectionString) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString,
    options: '-c default_transaction_read_only=on -c statement_timeout=30000',
  });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT name FROM pgmigrations ORDER BY id');
    return rows.map((r) => r.name);
  } catch (e) {
    if (e.code === '42P01') return [];
    throw e;
  } finally {
    await client.end();
  }
}

/** Query options that would send the connection somewhere other than the URL says (pg reads them over the URL). */
const RETARGETING = ['host', 'hostaddr', 'port', 'dbname', 'database', 'service'];

/**
 * The only query keys a migration URL may carry. Everything else is refused, so a key the driver or a later consumer
 * reads as configuration (`options`, which pg lets replace the read-only startup option the guard sets for its history
 * read; `connectionString`, `user`, `password`, `statement_timeout`, `search_path`, a certificate path, ...) can never
 * change what the guard checked.
 */
export const ALLOWED_QUERY_KEYS = [
  'sslmode',
  'ssl',
  'uselibpqcompat',
  'application_name',
  'connect_timeout',
];

/** Tab, newline, space and every other control character: the URL parser silently drops some of them, the driver does not. */
const hasControlOrSpace = (s) =>
  [...s].some((c) => c.charCodeAt(0) <= 0x20 || c.charCodeAt(0) === 0x7f);

/** A host is a plain name or address: a percent-encoded or control character would let the printed line differ from where pg connects. */
const PLAIN_HOST = /^[A-Za-z0-9._[\]:-]+$/;

/**
 * The target a connection string names, or why it is refused. Only a plain postgres URL is accepted: a host, and one
 * plain database name as the whole path. A malformed string (credentials landing in the path, no host, a retargeting
 * query option) would make the printed line differ from the place pg connects to, or show a password, so it is
 * refused before anything connects. The reason never repeats the string.
 *
 * The port is the one pg will use: the URL's, else PGPORT, else 5432. `options` is refused as a query parameter: pg
 * lets the URL's value replace the startup options the guard sets for its read-only history read.
 */
export function parseTarget(connectionString, env = process.env) {
  let u;
  try {
    u = new URL(connectionString);
  } catch {
    return { error: 'it is not a URL' };
  }
  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:')
    return { error: 'it is not a postgres:// or postgresql:// URL' };
  if (hasControlOrSpace(connectionString))
    return { error: 'it contains a control or whitespace character' };
  if (u.hostname === '') return { error: 'it names no host' };
  if (!PLAIN_HOST.test(u.hostname)) return { error: 'its host is not a plain name or address' };
  const database = u.pathname.slice(1);
  if (!/^[A-Za-z0-9_.-]+$/.test(database))
    return { error: 'its path is not one plain database name' };
  const bad = RETARGETING.filter((k) => u.searchParams.has(k));
  if (bad.length)
    return {
      error: `it sets ${bad.join(', ')} as a query option; the URL itself must name the target`,
    };
  const unknown = [...new Set(u.searchParams.keys())].filter(
    (k) => !ALLOWED_QUERY_KEYS.includes(k),
  );
  if (unknown.length)
    return {
      error: `it sets ${unknown.join(', ')} as a query option; only ${ALLOWED_QUERY_KEYS.join(', ')} are allowed`,
    };
  const port = u.port || env.PGPORT || '5432';
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    return { error: 'the port it names (or PGPORT, when the URL has none) is not a port number' };
  return { host: u.hostname, port: Number(port), database, explicitPort: u.port !== '' };
}

/** The target as named on the target line, or why it is refused. */
export function checkTarget(connectionString, env = process.env) {
  const t = parseTarget(connectionString, env);
  return t.error ? t : { target: `${t.host}:${t.port}/${t.database}` };
}

// ---- which database is this? (a migration is applied only to one that proved it is disposable) ---------------------

// PERSISTENT_DEV_PORTS (imported above, defined once in lib/disposable-db.mjs): never accepted as disposable.
/** The only host spellings that are loopback. Anything else (an alias, an address, a machine name) is at best UNKNOWN. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const DISPOSABLE_MARKS = new Set([DISPOSABLE_MARKER, DISPOSABLE_SETUP_MARKER]);

/** The database comment, read through the target's own URL in a read-only session. */
async function readMark(url) {
  return (await readIdentity(url))?.marker ?? null;
}

/**
 * DISPOSABLE: a loopback host named exactly, a port the URL names and that is not the protected one, and a database
 * that carries a disposable mark. PERSISTENT-DEV: the protected port (no mark is read there, and none is accepted), or a
 * loopback database without the mark. UNKNOWN: everything else, including a mark that cannot be read. UNKNOWN is
 * never treated as disposable. `t` is parseTarget's result; `readMark` is only called when a mark can matter.
 */
export async function classifyTarget(t, { readMark: read }) {
  if (PERSISTENT_DEV_PORTS.has(t.port))
    return {
      kind: 'PERSISTENT-DEV',
      why: `port ${t.port} is the persistent development cluster; no mark is accepted there`,
    };
  if (!LOOPBACK_HOSTS.has(t.host))
    return {
      kind: 'UNKNOWN',
      why: `${t.host} is not a plain loopback host, so no disposable mark is accepted`,
    };
  if (!t.explicitPort)
    return {
      kind: 'UNKNOWN',
      why: 'the URL has no explicit port, so no disposable mark is accepted',
    };
  let mark;
  try {
    mark = await read();
  } catch (e) {
    return {
      kind: 'UNKNOWN',
      why: `the database mark could not be read (${e.code ?? 'connection failed'})`,
    };
  }
  if (DISPOSABLE_MARKS.has(mark))
    return { kind: 'DISPOSABLE', why: 'the database is marked disposable' };
  return {
    kind: 'PERSISTENT-DEV',
    why: mark ? 'its comment is not the disposable mark' : 'it carries no disposable mark',
  };
}

/** The whole approved commit: the full sha, equal to HEAD, and no changed tracked file anywhere (the guard itself included). */
export function checkApprovedSource({ root, expectedCommit }) {
  if (!/^[0-9a-f]{40}$/i.test(expectedCommit))
    return ['SOURCE: --expect-commit must be the full 40-character commit sha for this target'];
  const head = readCheckoutHead(root);
  if (!head.head) return [head.problem];
  const problems = [];
  if (head.head.toLowerCase() !== expectedCommit.toLowerCase())
    problems.push(
      `SOURCE: HEAD is ${head.head.slice(0, 12)}, not the approved ${expectedCommit.slice(0, 12)}`,
    );
  const status = git(root, ['status', '--porcelain', '--untracked-files=no']);
  if (status.status !== 0) problems.push(`SOURCE: git status failed (${status.err})`);
  else if (status.out !== '')
    problems.push(
      `SOURCE: the working tree has uncommitted changes to tracked files:\n${status.out.split('\n').slice(0, 10).join('\n')}`,
    );
  return problems;
}

/**
 * May the pending migrations be applied to this target? A DISPOSABLE target needs nothing. Any other target
 * (PERSISTENT-DEV or UNKNOWN: the same rule) needs the approved commit (--expect-commit, the full sha equal to HEAD,
 * clean tree) AND --confirm-target=<database>@<host>:<port> naming exactly this run's target; the authorization is
 * recorded before anything is applied (`record` null: not recorded, for the `authorize` command). A dry run is allowed
 * on every target and only reports. Returns { ok, log, refusals }; nothing here writes to the database.
 */
export async function authorizeApply({
  url,
  env = process.env,
  expectedCommit = null,
  confirmTarget = null,
  dryRun = false,
  root = REPO_ROOT,
  readMark: read = () => readMark(url),
  sourceProblems = checkApprovedSource,
  record = recordAdminAction,
  now = new Date(),
  logFile = path.join(REPO_ROOT, '.adulis-db-admin.log'),
}) {
  const t = parseTarget(url, env);
  if (t.error)
    return {
      ok: false,
      log: [],
      refusals: [`REFUSED: the target is not usable (${t.error}); nothing was applied`],
    };
  const cls = await classifyTarget(t, { readMark: read });
  const log = [`classification: ${cls.kind} (${cls.why})`];
  if (cls.kind === 'DISPOSABLE') return { ok: true, log };
  const want = `${t.database}@${t.host}:${t.port}`;
  const how = `pnpm db:migrate:guarded --expect-commit <the approved commit's full sha> --confirm-target=${want}`;
  if (dryRun) {
    log.push(`dry run: applying here would need ${how}`);
    return { ok: true, log };
  }
  const need = [];
  if (expectedCommit === null)
    need.push(
      'the source check: --expect-commit <full sha> (pnpm db:migrate skips it; use pnpm db:migrate:guarded)',
    );
  else need.push(...sourceProblems({ root, expectedCommit }));
  if (confirmTarget === null) need.push(`--confirm-target=${want}`);
  else if (confirmTarget !== want)
    need.push(`--confirm-target names ${confirmTarget}, but this run would apply to ${want}`);
  if (need.length)
    return {
      ok: false,
      log,
      refusals: [
        `REFUSED: the target ${t.host}:${t.port}/${t.database} is ${cls.kind}, not a disposable database; nothing was applied.`,
        ...need.map((n) => `  - ${n}`),
        `To upgrade it on purpose, after a dry run, from a clean checkout of the approved commit: ${how}`,
      ],
    };
  if (record) {
    try {
      record(logFile, 'db:migrate', want, now, { commit: expectedCommit.toLowerCase() });
    } catch (e) {
      return {
        ok: false,
        log,
        refusals: [
          `REFUSED: could not record the upgrade in .adulis-db-admin.log (${e.code ?? e.message}); nothing was applied`,
        ],
      };
    }
    log.push(
      `authorized: ${want} at ${expectedCommit.slice(0, 12).toLowerCase()} (recorded in .adulis-db-admin.log)`,
    );
  }
  return { ok: true, log };
}

/**
 * The one target, DATABASE_URL_MIGRATE: refused (null) when unset or not a plain postgres URL, otherwise named on
 * `log` as host:port/database (never the credentials) and returned. There is no default host or database.
 */
export function resolveTarget(env, { log, err }) {
  const url = env.DATABASE_URL_MIGRATE;
  if (!url) {
    err('REFUSED: DATABASE_URL_MIGRATE is not set; nothing was applied');
    return null;
  }
  const t = checkTarget(url, env);
  if (t.error) {
    err(`REFUSED: DATABASE_URL_MIGRATE is not usable (${t.error}); nothing was applied`);
    return null;
  }
  log(`target: ${t.target}`);
  return url;
}

/** Everything, fail-closed. `applied` is an array of names, or null when the database history is not being checked. */
export function verify({
  dir = DEFAULT_DIR,
  manifest,
  applied = null,
  root = REPO_ROOT,
  expectedCommit = null,
}) {
  const problems = [...checkManifest(manifest)];
  if (problems.length === 0) problems.push(...checkDirectory(dir, manifest));
  if (expectedCommit !== null) problems.push(...checkSource({ root, expectedCommit }));
  let pending = [];
  if (applied !== null && problems.length === 0) {
    const h = checkHistory(applied, manifest);
    problems.push(...h.problems);
    pending = h.pending;
  }
  return { ok: problems.length === 0, problems, pending };
}

/**
 * verify, then run node-pg-migrate. `deps.run` is only ever called after every check passed.
 * `deps.readApplied` is read-only. Returns the process exit code. Refusals go to `err` (stderr on the command line, so
 * a caller that discards stdout still sees why nothing was applied); everything else goes to `log`.
 */
export async function up(
  {
    dir = DEFAULT_DIR,
    manifestPath = DEFAULT_MANIFEST,
    root = REPO_ROOT,
    expectedCommit = null,
    confirmTarget = null,
    dryRun = false,
    log = console.log,
    err = log,
  },
  deps = {},
) {
  const run = deps.run ?? defaultRun;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    err(`REFUSED: the manifest cannot be read (${e.code ?? e.message}); nothing was applied`);
    return 1;
  }
  // The gate between the checks and the runner. `deps.readApplied` is the test seam (it supplies its own history and
  // decides for itself); the command line never injects one, so it always gets the real gate for its target.
  let readApplied_ = deps.readApplied;
  let authorize = deps.authorize ?? null;
  if (!readApplied_) {
    const url = resolveTarget(process.env, { log, err });
    if (!url) return 1;
    readApplied_ = () => readApplied(url);
    authorize ??= (o) =>
      authorizeApply({ url, env: process.env, expectedCommit, confirmTarget, root, ...o });
  }
  let applied;
  try {
    applied = await readApplied_();
  } catch (e) {
    err(
      `REFUSED: the migration history cannot be read (${e.code ?? e.message}); nothing was applied`,
    );
    return 1;
  }
  const result = verify({ dir, manifest, applied, root, expectedCommit });
  if (!result.ok) {
    err('REFUSED: the migration set is not the pinned one; nothing was applied.');
    for (const p of result.problems) err(`  - ${p}`);
    return 1;
  }
  log(
    `OK: ${manifest.files.length} pinned migrations, ${applied.length} applied, ${result.pending.length} pending${result.pending.length ? ': ' + result.pending.join(', ') : ''}`,
  );
  if (expectedCommit === null) log('source check: skipped (--no-source-check)');
  if (dryRun) {
    for (const l of (await authorize?.({ dryRun: true }))?.log ?? []) log(l);
    log('dry run: the runner was not started');
    return 0;
  }
  if (result.pending.length === 0) {
    log('nothing to apply');
    return 0;
  }
  if (authorize) {
    const gate = await authorize({ dryRun: false });
    for (const l of gate.log) log(l);
    if (!gate.ok) {
      for (const l of gate.refusals) err(l);
      return 1;
    }
  }
  return run({ dir });
}

/** The runner, by path as `pnpm db:migrate` does: the package's exports map does not expose its bin to require.resolve. */
export const RUNNER_PATH = path.join(
  REPO_ROOT,
  'node_modules',
  'node-pg-migrate',
  'bin',
  'node-pg-migrate.js',
);

function defaultRun({ dir }) {
  if (!existsSync(RUNNER_PATH)) {
    console.error(
      `REFUSED: the migration runner is not installed (${RUNNER_PATH}); nothing was applied`,
    );
    return 1;
  }
  const r = spawnSync(
    process.execPath,
    [RUNNER_PATH, '-d', 'DATABASE_URL_MIGRATE', '-m', dir, '-j', 'sql', 'up'],
    { stdio: 'inherit', env: process.env },
  );
  return r.status ?? 1;
}

/**
 * `write`: pin newly ADDED migrations. A missing or changed historical entry is refused, never re-pinned. A new file
 * with CRLF line endings is refused too: .gitattributes stores migrations as LF, so git would turn it into LF on
 * commit and the pin of its CRLF bytes would then fail in CI as a changed file, with no way for `write` to repair it.
 */
export function write({
  dir = DEFAULT_DIR,
  manifestPath = DEFAULT_MANIFEST,
  log = console.log,
  err = log,
} = {}) {
  const fresh = buildManifest(dir);
  let pinned = 0;
  if (existsSync(manifestPath)) {
    const old = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const problems = checkManifest(old);
    old.files.forEach((f, i) => {
      const now = fresh.files[i];
      if (!now || now.name !== f.name)
        problems.push(
          `pinned ${f.name} is missing or renamed in the directory; write does not re-pin history`,
        );
      else if (now.sha256 !== f.sha256)
        problems.push(`pinned ${f.name} has changed; write does not re-pin history`);
    });
    if (problems.length) {
      for (const p of problems) err(`REFUSED: ${p}`);
      return 1;
    }
    pinned = old.files.length;
  }
  const problems = checkManifest(fresh);
  for (const f of fresh.files.slice(pinned))
    if (readFileSync(path.join(dir, f.name)).includes(0x0d))
      problems.push(
        `${f.name} has CRLF line endings; migrations are LF (.gitattributes), so git would store it as LF and the pin would fail as changed: convert it to LF and pin again`,
      );
  if (problems.length) {
    for (const p of problems) err(`REFUSED: ${p}`);
    return 1;
  }
  writeFileSync(manifestPath, JSON.stringify(fresh, null, 2) + '\n');
  log(`pinned ${fresh.files.length} migrations in ${path.relative(REPO_ROOT, manifestPath)}`);
  return 0;
}

const COMMANDS = {
  verify: { bool: ['--db'], value: ['--expect-commit', '--base'] },
  up: { bool: ['--dry-run', '--no-source-check'], value: ['--expect-commit'] },
  write: { bool: [], value: [] },
  authorize: { bool: [], value: ['--expect-commit'] },
};
/** Commands that take --confirm-target=<database>@<host>:<port> as ONE argument (the form db:reset uses). */
const CONFIRMS = new Set(['up', 'authorize']);

/**
 * The command line, strictly. An unknown flag, a repeated flag, a flag without its value, and an `up` without
 * --expect-commit (or an explicit --no-source-check) are refusals, never defaults: a typo such as --dryrun must
 * not turn a dry run into a real apply, and a missing value must not skip the source check.
 */
export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const spec = COMMANDS[cmd];
  if (!spec) return { error: `unknown command ${JSON.stringify(cmd ?? null)}` };
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (CONFIRMS.has(cmd) && a.startsWith('--confirm-target=')) {
      if ('--confirm-target' in flags) return { error: '--confirm-target is given twice' };
      if (a === '--confirm-target=')
        return {
          error: '--confirm-target needs a value: --confirm-target=<database>@<host>:<port>',
        };
      flags['--confirm-target'] = a.slice('--confirm-target='.length);
      continue;
    }
    const isBool = spec.bool.includes(a);
    if (!isBool && !spec.value.includes(a))
      return { error: `unknown argument ${JSON.stringify(a)} for ${cmd}` };
    if (a in flags) return { error: `${a} is given twice` };
    if (isBool) {
      flags[a] = true;
    } else {
      const v = rest[i + 1];
      if (v === undefined || v.startsWith('--')) return { error: `${a} needs a value` };
      flags[a] = v;
      i += 1;
    }
  }
  if (cmd === 'up') {
    const has = flags['--expect-commit'] !== undefined;
    if (!has && !flags['--no-source-check'])
      return { error: 'up needs --expect-commit <sha>, or an explicit --no-source-check' };
    if (has && flags['--no-source-check'])
      return { error: '--expect-commit and --no-source-check exclude each other' };
  }
  return { cmd, flags };
}

async function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    console.error(`REFUSED: ${parsed.error}; nothing was applied`);
    console.error(
      'usage: migration-guard.mjs verify [--db] [--expect-commit <sha>] [--base <ref>] | up (--expect-commit <sha> | --no-source-check) [--confirm-target=<db>@<host>:<port>] [--dry-run] | authorize [--expect-commit <sha>] [--confirm-target=<db>@<host>:<port>] | write',
    );
    return 2;
  }
  const { cmd, flags } = parsed;
  const flag = (n) => flags[n] === true;
  const val = (n) => flags[n] ?? null;
  const sinks = { log: console.log, err: console.error };
  if (cmd === 'write') return write(sinks);
  if (cmd === 'up')
    return up({
      expectedCommit: val('--expect-commit'),
      confirmTarget: val('--confirm-target'),
      dryRun: flag('--dry-run'),
      ...sinks,
    });
  if (cmd === 'authorize') {
    const url = resolveTarget(process.env, sinks);
    if (!url) return 1;
    const g = await authorizeApply({
      url,
      expectedCommit: val('--expect-commit'),
      confirmTarget: val('--confirm-target'),
      record: null,
    });
    for (const l of g.log) console.log(l);
    for (const l of g.refusals ?? []) console.error(l);
    if (g.ok) console.log('OK: this run may apply to the target');
    return g.ok ? 0 : 1;
  }
  if (cmd === 'verify') {
    const manifest = JSON.parse(readFileSync(DEFAULT_MANIFEST, 'utf8'));
    let applied = null;
    if (flag('--db')) {
      const url = resolveTarget(process.env, sinks);
      if (!url) return 1;
      applied = await readApplied(url);
    }
    const r = verify({ manifest, applied, expectedCommit: val('--expect-commit') });
    if (val('--base') !== null) {
      const base = readBaseManifest(REPO_ROOT, val('--base'));
      r.problems.push(...(base.problems ?? checkAppendOnly(base.manifest, manifest)));
      r.ok = r.problems.length === 0;
    }
    if (!r.ok) {
      console.error('REFUSED:');
      for (const p of r.problems) console.error(`  - ${p}`);
      return 1;
    }
    console.log(
      `OK: ${manifest.files.length} pinned migrations match${applied ? `; ${applied.length} applied, ${r.pending.length} pending` : ''}${val('--base') !== null ? `; append-only against ${val('--base')}` : ''}`,
    );
    return 0;
  }
  console.error(
    'usage: migration-guard.mjs verify [--db] [--expect-commit <sha>] [--base <ref>] | up (--expect-commit <sha> | --no-source-check) [--confirm-target=<db>@<host>:<port>] [--dry-run] | authorize [--expect-commit <sha>] [--confirm-target=<db>@<host>:<port>] | write',
  );
  return 2;
}

/** Exit once both streams have drained: a refusal written to a pipe must not be cut short by process.exit. */
const exitAfterFlush = (code) =>
  process.stdout.write('', () => process.stderr.write('', () => process.exit(code)));

/**
 * Is this module the script being run? Both sides are resolved to real paths: through a symlink, a junction or a
 * substituted drive, process.argv[1] keeps the path as typed while the module's own URL is resolved, so a plain comparison
 * runs nothing and exits 0. Returns 'run', 'import', or 'unresolved' (a file named like this one whose path cannot be
 * resolved: refuse, never a silent exit 0).
 */
export function entryKind(
  metaUrl,
  argv1 = process.argv[1],
  name = path.basename(fileURLToPath(metaUrl)),
) {
  if (!argv1) return 'import';
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(metaUrl)) ? 'run' : 'import';
  } catch {
    return path.basename(argv1) === name ? 'unresolved' : 'import';
  }
}

const entry = entryKind(import.meta.url);
if (entry === 'run') {
  main(process.argv.slice(2)).then(exitAfterFlush, (e) => {
    console.error(`REFUSED: unexpected error (${e.code ?? e.message}); nothing was applied`);
    exitAfterFlush(1);
  });
} else if (entry === 'unresolved') {
  console.error(
    'REFUSED: the guard could not recognise itself as the script being run; nothing was applied',
  );
  process.exitCode = 2;
}
