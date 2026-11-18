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
//   node ops/scripts/migration-guard.mjs verify [--db] [--expect-commit <sha>]
//   node ops/scripts/migration-guard.mjs up [--dry-run] [--expect-commit <sha>]     (verify, then node-pg-migrate up)
//   node ops/scripts/migration-guard.mjs write                                        (pin newly added migrations)
//
// The plain `pnpm db:migrate` is unchanged and unguarded. A persistent database is upgraded with `db:migrate:guarded`.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
      problems.push(`UNEXPECTED file in the migrations directory: ${n}`);
  }
  for (const [num, names] of byNumber)
    if (names.length > 1) problems.push(`DUPLICATE number ${num}: ${names.join(', ')}`);
  for (const [name, hash] of pinned) {
    if (!entries.includes(name)) {
      problems.push(`MISSING migration ${name}`);
      continue;
    }
    const actual = sha256(readFileSync(path.join(dir, name)));
    if (actual !== hash)
      problems.push(
        `CHANGED migration ${name}: sha256 ${actual.slice(0, 16)} differs from the pinned ${hash.slice(0, 16)}`,
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

function git(root, args) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  return { status: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

/** Source commit: the checkout is the expected commit, and the migrations and the manifest are exactly as committed. */
export function checkSource({
  root,
  expectedCommit,
  dirRel = 'db/migrations',
  manifestRel = 'ops/migrations.manifest.json',
}) {
  const problems = [];
  const head = git(root, ['rev-parse', 'HEAD']);
  if (head.status !== 0) return [`SOURCE: cannot read the git HEAD (${head.err || 'git failed'})`];
  if (!/^[0-9a-f]{7,40}$/i.test(expectedCommit))
    return [
      `SOURCE: --expect-commit must be a hex commit (7 to 40 characters), got ${JSON.stringify(expectedCommit)}`,
    ];
  if (!head.out.toLowerCase().startsWith(expectedCommit.toLowerCase()))
    problems.push(`SOURCE: HEAD is ${head.out.slice(0, 12)}, expected ${expectedCommit}`);
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
 * `deps.readApplied` is read-only. Returns the process exit code.
 */
export async function up(
  {
    dir = DEFAULT_DIR,
    manifestPath = DEFAULT_MANIFEST,
    root = REPO_ROOT,
    expectedCommit = null,
    dryRun = false,
    log = console.log,
  },
  deps = {},
) {
  const readApplied_ = deps.readApplied ?? (() => readApplied(process.env.DATABASE_URL_MIGRATE));
  const run = deps.run ?? defaultRun;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    log(`REFUSED: the manifest cannot be read (${e.code ?? e.message}); nothing was applied`);
    return 1;
  }
  if (!deps.readApplied && !process.env.DATABASE_URL_MIGRATE) {
    log('REFUSED: DATABASE_URL_MIGRATE is not set; nothing was applied');
    return 1;
  }
  let applied;
  try {
    applied = await readApplied_();
  } catch (e) {
    log(
      `REFUSED: the migration history cannot be read (${e.code ?? e.message}); nothing was applied`,
    );
    return 1;
  }
  const result = verify({ dir, manifest, applied, root, expectedCommit });
  if (!result.ok) {
    log('REFUSED: the migration set is not the pinned one; nothing was applied.');
    for (const p of result.problems) log(`  - ${p}`);
    return 1;
  }
  log(
    `OK: ${manifest.files.length} pinned migrations, ${applied.length} applied, ${result.pending.length} pending${result.pending.length ? ': ' + result.pending.join(', ') : ''}`,
  );
  if (dryRun) {
    log('dry run: the runner was not started');
    return 0;
  }
  if (result.pending.length === 0) {
    log('nothing to apply');
    return 0;
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
    console.log(
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

/** `write`: pin newly ADDED migrations. A missing or changed historical entry is refused, never re-pinned. */
export function write({
  dir = DEFAULT_DIR,
  manifestPath = DEFAULT_MANIFEST,
  log = console.log,
} = {}) {
  const fresh = buildManifest(dir);
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
      for (const p of problems) log(`REFUSED: ${p}`);
      return 1;
    }
  }
  const problems = checkManifest(fresh);
  if (problems.length) {
    for (const p of problems) log(`REFUSED: ${p}`);
    return 1;
  }
  writeFileSync(manifestPath, JSON.stringify(fresh, null, 2) + '\n');
  log(`pinned ${fresh.files.length} migrations in ${path.relative(REPO_ROOT, manifestPath)}`);
  return 0;
}

const COMMANDS = {
  verify: { bool: ['--db'], value: ['--expect-commit'] },
  up: { bool: ['--dry-run', '--no-source-check'], value: ['--expect-commit'] },
  write: { bool: [], value: [] },
};

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
    console.log(`REFUSED: ${parsed.error}; nothing was applied`);
    console.log(
      'usage: migration-guard.mjs verify [--db] [--expect-commit <sha>] | up (--expect-commit <sha> | --no-source-check) [--dry-run] | write',
    );
    return 2;
  }
  const { cmd, flags } = parsed;
  const flag = (n) => flags[n] === true;
  const val = (n) => flags[n] ?? null;
  if (cmd === 'write') return write();
  if (cmd === 'up')
    return up({ expectedCommit: val('--expect-commit'), dryRun: flag('--dry-run') });
  if (cmd === 'verify') {
    const manifest = JSON.parse(readFileSync(DEFAULT_MANIFEST, 'utf8'));
    const applied = flag('--db') ? await readApplied(process.env.DATABASE_URL_MIGRATE) : null;
    const r = verify({ manifest, applied, expectedCommit: val('--expect-commit') });
    if (!r.ok) {
      console.log('REFUSED:');
      for (const p of r.problems) console.log(`  - ${p}`);
      return 1;
    }
    console.log(
      `OK: ${manifest.files.length} pinned migrations match${applied ? `; ${applied.length} applied, ${r.pending.length} pending` : ''}`,
    );
    return 0;
  }
  console.log(
    'usage: migration-guard.mjs verify [--db] [--expect-commit <sha>] | up [--dry-run] [--expect-commit <sha>] | write',
  );
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.log(`REFUSED: unexpected error (${e.code ?? e.message}); nothing was applied`);
      process.exit(1);
    },
  );
}
