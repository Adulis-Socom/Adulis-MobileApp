// The ordinary migration command is the guarded one. These tests read the repository's own wiring (package
// scripts, workflows, ops scripts, runbooks, docs) so that a later edit which points `db:migrate` back at the raw
// runner, adds an unguarded alias, or documents a command that does not exist fails here. No database is touched.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkDirectory, checkTarget, resolveTarget, up, write } from './migration-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const pkg = JSON.parse(read('package.json'));
const GUARD = 'ops/scripts/migration-guard.mjs';
const SELF = 'ops/scripts/migration-default-path.test.mjs';

/** Every way of starting the raw runner, on a command line or in code (not a mention in prose). */
const RAW_RUNNER = new RegExp(
  [
    'node-pg-migrate/bin',
    'bin/node-pg-migrate',
    String.raw`(?:exec|dlx|npx|yarn|pnpm)\s+node-pg-migrate`,
    String.raw`(?:^|[\s;&|(])node-pg-migrate\s+(?:up|down|redo|create)\b`,
    String.raw`(?:from|require\(|import\()\s*['"]node-pg-migrate['"]`,
  ].join('|'),
  'm',
);
/**
 * A runner start that is BUILT instead of written out: `join(repo, 'node_modules', 'node-pg-migrate', 'bin', ...)`,
 * `path.resolve(root, 'node-pg-migrate')`, a template such as `${root}/node_modules/node-pg-migrate/dist/cli.js`.
 * No single string holds `node-pg-migrate/bin`, so RAW_RUNNER cannot see it. In code, the runner's package or bin
 * name is never a quoted string of its own and never a path segment, except in the guard.
 */
const BT = String.fromCharCode(96); // a backtick, which cannot sit inside the template literals below
const BUILT_RUNNER = new RegExp(
  [
    `['"${BT}]node-pg-migrate(?:\\.js)?['"${BT}]`,
    `[\\\\/]node-pg-migrate(?:\\.js)?[\\\\/'"${BT}]`,
  ].join('|'),
  'm',
);
const CODE = /\.(mjs|cjs|js|ts|mts|cts|tsx|sh|ps1|cmd|bat)$/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.expo', '.next']);
const TEXT =
  /\.(mjs|cjs|js|ts|mts|cts|tsx|json|toml|ya?ml|sh|ps1|cmd|bat|md)$|(^|\/)(Dockerfile[^/]*|docker-compose[^/]*|Makefile)$/;

function walk(rel, out = []) {
  const abs = path.join(ROOT, rel);
  let st;
  try {
    st = statSync(abs);
  } catch {
    return out;
  }
  if (st.isFile()) {
    if (TEXT.test(rel)) out.push(rel);
    return out;
  }
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    if (e.isDirectory() && SKIP_DIRS.has(e.name)) continue;
    walk(`${rel}/${e.name}`, out);
  }
  return out;
}
const SCANNED = [
  'package.json',
  'README.md',
  'CLAUDE.md',
  'docker-compose.yml',
  '.github',
  '.claude',
  'ops',
  'docs',
  'db',
  'apps',
  'packages',
].flatMap((r) => walk(r));

/** The root script, without node's own options (--env-file-if-exists=.env would load a developer's real database). */
function scriptArgv(name) {
  const tokens = pkg.scripts[name].split(/\s+/).filter((t) => !t.startsWith('--env-file'));
  assert.equal(tokens[0], 'node', `${name} must be a plain node command`);
  return tokens.slice(1);
}

/** The real CLI as a package script spells it, without a database variable unless the test gives one. */
function cli(script, extra = [], env = {}) {
  const base = { ...process.env };
  delete base.DATABASE_URL_MIGRATE;
  return spawnSync(process.execPath, [...scriptArgv(script), ...extra], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...base, ...env },
  });
}

/** A one-migration scratch tree, pinned. */
function scratch(files = { '0001_a.sql': 'SELECT 1;\n' }) {
  const root = mkdtempSync(path.join(tmpdir(), 'migpath-'));
  const dir = path.join(root, 'migrations');
  mkdirSync(dir);
  for (const [n, body] of Object.entries(files)) writeFileSync(path.join(dir, n), body);
  const manifestPath = path.join(root, 'manifest.json');
  return { root, dir, manifestPath, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
const quiet = () => {};

test('the ordinary command runs the guard, and every db:migrat* script goes through it', () => {
  assert.equal(
    pkg.scripts['db:migrate'].replace(/\s--env-file\S+/, ''),
    `node ${GUARD} up --no-source-check`,
  );
  assert.equal(
    pkg.scripts['db:migrate:guarded'].replace(/\s--env-file\S+/, ''),
    `node ${GUARD} up`,
  );
  const migrating = Object.keys(pkg.scripts).filter((n) => /^db:migrat/.test(n));
  assert.ok(
    migrating.length >= 4,
    `db:migrate, db:migrate:guarded, db:migration-guard, db:migration-pin: ${migrating}`,
  );
  for (const n of migrating) {
    assert.ok(pkg.scripts[n].includes(GUARD), `${n} must run ${GUARD}`);
    assert.doesNotMatch(pkg.scripts[n], /node-pg-migrate/, `${n} must not name the runner`);
  }
  assert.equal(pkg.scripts['db:migration-pin'], `node ${GUARD} write`);
});

test('the raw-runner pattern recognises every way of starting it, and not a sentence that mentions it', () => {
  const starts = [
    'node --env-file-if-exists=.env node_modules/node-pg-migrate/bin/node-pg-migrate.js -d DATABASE_URL_MIGRATE -m db/migrations -j sql up',
    'node_modules/.bin/node-pg-migrate up',
    'pnpm exec node-pg-migrate up',
    'pnpm dlx node-pg-migrate up',
    'pnpm node-pg-migrate up',
    'pnpm node-pg-migrate -d DATABASE_URL_MIGRATE -m db/migrations up',
    'npx node-pg-migrate up',
    'yarn node-pg-migrate up',
    '        run: node-pg-migrate up -d DATABASE_URL_MIGRATE',
    'RUN node-pg-migrate down 1',
    "const { runner } = await import('node-pg-migrate');",
    "import runner from 'node-pg-migrate';",
    "const r = require('node-pg-migrate');",
  ];
  for (const s of starts) assert.match(s, RAW_RUNNER, s);
  const prose = [
    '`node-pg-migrate` will not re-run a file it has recorded',
    'node-pg-migrate ... up exit 0, 0001_foundation through 0050',
    'node-pg-migrate applies whatever the migrations directory holds',
    "on node-pg-migrate's own tracking table",
  ];
  for (const s of prose) assert.doesNotMatch(s, RAW_RUNNER, s);
});

test('no script, workflow, runbook or doc outside the guard starts the raw runner', () => {
  const offenders = SCANNED.filter(
    (f) => f !== GUARD && f !== SELF && RAW_RUNNER.test(readFileSync(path.join(ROOT, f), 'utf8')),
  );
  assert.deepEqual(offenders, [], 'only the guard starts node-pg-migrate');
  for (const f of SCANNED.filter((f) => f.endsWith('package.json')))
    for (const [n, cmd] of Object.entries(JSON.parse(read(f)).scripts ?? {}))
      assert.doesNotMatch(cmd, /node-pg-migrate/, `${f} script ${n}`);
});

test('the built-path pattern recognises a runner start assembled from segments, and not prose or the guard script', () => {
  const built = [
    "join(repo, 'node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js'),",
    "path.resolve(root, 'node-pg-migrate')",
    "const bin = ['node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js'].join('/');",
    '`${root}/node_modules/node-pg-migrate/dist/cli.js`',
    "const p = 'C:\\x\\node_modules\\node-pg-migrate\\bin';",
    "['node-pg-migrate.js', 'seed.mjs']",
  ];
  for (const x of built) assert.match(x, BUILT_RUNNER, x);
  const fine = [
    '// node-pg-migrate applies whatever the directory holds',
    "join(repo, 'ops', 'scripts', 'migration-guard.mjs')",
    "[guard, 'up', '--expect-commit', sha]",
    'node-pg-migrate-compat is not the runner',
  ];
  for (const x of fine) assert.doesNotMatch(x, BUILT_RUNNER, x);
});

test('no code file outside the guard builds a path to the raw runner (ops/native and every other directory included)', () => {
  const scanned = SCANNED.filter((f) => CODE.test(f) && f !== GUARD && f !== SELF);
  assert.ok(
    scanned.some((f) => f.startsWith('ops/native/')),
    'the scan must reach ops/native',
  );
  assert.ok(scanned.length > 100, `the scan must reach the code (${scanned.length})`);
  const offenders = scanned.filter((f) =>
    BUILT_RUNNER.test(readFileSync(path.join(ROOT, f), 'utf8')),
  );
  assert.deepEqual(
    offenders,
    [],
    'only the guard starts node-pg-migrate, however its path is spelled',
  );
});

test('the native harness migrates only through the guard, with the verified commit', () => {
  const stack = read('ops/native/lib/stack.mjs');
  assert.match(stack, /migration-guard\.mjs/);
  assert.match(stack, /'--expect-commit'/);
  assert.doesNotMatch(stack, /--no-source-check/);
});

test('every db:migrate reference in workflows, scripts and docs resolves to a script that runs the guard', () => {
  const guarded = new Set(
    Object.entries(pkg.scripts)
      .filter(([, cmd]) => cmd.includes(`${GUARD} up`))
      .map(([n]) => n),
  );
  assert.deepEqual([...guarded].sort(), ['db:migrate', 'db:migrate:guarded']);
  const bad = [];
  let seen = 0;
  for (const f of SCANNED) {
    for (const m of readFileSync(path.join(ROOT, f), 'utf8').matchAll(
      /\bdb:migrate(?::[a-z][a-z-]*)?\b/g,
    )) {
      seen += 1;
      if (!guarded.has(m[0])) bad.push(`${f}: ${m[0]}`);
    }
  }
  assert.ok(seen > 20, `the scan must reach the references (${seen})`);
  assert.deepEqual(bad, [], 'a db:migrate command that is not defined as guarded');
});

test('CI, the gate list, the disposable pair, db:reset and the deploy blueprint all run the guarded command', () => {
  const wires = [
    ['.github/workflows/ci.yml', /^\s+run: pnpm db:migrate$/m],
    ['ops/scripts/gates.mjs', /\['pnpm', 'db:migrate'\]/],
    ['ops/scripts/test-db.sh', /pnpm -s db:migrate\b/],
    ['ops/scripts/db-reset.mjs', /run\('pnpm', \['db:migrate'\]\)/],
    ['ops/render.yaml', /preDeployCommand: pnpm db:migrate && /],
    ['ops/scripts/db-determinism.mjs', /ops\/scripts\/migration-guard\.mjs/],
  ];
  for (const [file, pattern] of wires)
    assert.match(read(file), pattern, `${file} must run the guarded command`);
  assert.doesNotMatch(read('ops/scripts/db-determinism.mjs'), /node-pg-migrate\.js/);
  assert.match(
    read('ops/scripts/gates.mjs'),
    /id: 'migration-guard'.*migration-default-path\.test\.mjs/,
    'this file runs in the migration-guard gate',
  );
});

test('the disposable pair discards the guard progress but keeps stderr, where every refusal is written', () => {
  const line = read('ops/scripts/test-db.sh')
    .split('\n')
    .find((l) => /pnpm -s db:migrate\b/.test(l));
  assert.match(line, /^\s*pnpm -s db:migrate >\/dev\/null\s*$/, 'stdout may be discarded');
  assert.doesNotMatch(
    line,
    /2>|&>|\|/,
    'stderr must stay visible: a refusal is the only explanation',
  );
});

test('the documented commands exist: the migration docs name the ordinary command, the strict one and the pin command', () => {
  const doc = read('docs/infrastructure/MIGRATION-FILE-GUARD.md');
  const names = ['db:migrate', 'db:migrate:guarded', 'db:migration-guard', 'db:migration-pin'];
  for (const name of names) {
    assert.ok(pkg.scripts[name], `${name} is a script`);
    // a name followed by more of a name does not count (db:migrate is a prefix of db:migrate:guarded)
    assert.match(
      doc,
      new RegExp(`pnpm ${name}(?![:\\w-])`),
      `MIGRATION-FILE-GUARD.md documents pnpm ${name}`,
    );
  }
  assert.match(
    doc,
    /node-pg-migrate directly/i,
    'the doc says the raw runner is not a way to migrate',
  );
  assert.match(
    doc,
    /Which database is this/,
    'the doc says which targets the ordinary command applies to',
  );
  assert.ok(
    read('apps/api/CLAUDE.md').includes('pnpm db:migration-pin'),
    'the migration authoring rules name the pin command',
  );
});

test('the ordinary command, as the package script spells it, refuses without a database and on a mistyped flag, and never applies', () => {
  const noDb = cli('db:migrate');
  assert.equal(noDb.status, 1);
  assert.match(noDb.stderr, /REFUSED: DATABASE_URL_MIGRATE is not set; nothing was applied/);
  assert.doesNotMatch(noDb.stdout, /REFUSED/, 'a refusal is written to stderr, never to stdout');
  // a typo of --dry-run must not become a real apply, and the source rules cannot be mixed
  const target = { DATABASE_URL_MIGRATE: 'postgres://x:y@127.0.0.1:1/none' };
  const typo = cli('db:migrate', ['--dryrun'], target);
  assert.equal(typo.status, 2);
  assert.match(typo.stderr, /unknown argument "--dryrun"/);
  assert.doesNotMatch(typo.stdout, /REFUSED/);
  const mixed = cli('db:migrate', ['--expect-commit', 'abc1234'], target);
  assert.equal(mixed.status, 2);
  assert.match(mixed.stderr, /exclude each other/);
  // the strict script is `up` alone: it must name its source rule (and never reaches a database)
  const strict = cli('db:migrate:guarded');
  assert.equal(strict.status, 2);
  assert.match(strict.stderr, /up needs --expect-commit/);
});

test('an unpinned new migration is refused with the pin command, and pinning it makes the same set apply', async () => {
  const s = scratch();
  try {
    assert.equal(write({ dir: s.dir, manifestPath: s.manifestPath, log: quiet }), 0);
    writeFileSync(path.join(s.dir, '0002_b.sql'), 'SELECT 2;\n');
    let started = 0;
    const deps = { readApplied: async () => ['0001_a'], run: () => ((started += 1), 0) };
    const lines = [];
    const o = { dir: s.dir, manifestPath: s.manifestPath, root: s.root };
    assert.equal(await up({ ...o, log: (l) => lines.push(l) }, deps), 1);
    assert.equal(started, 0);
    assert.match(lines.join('\n'), /UNEXPECTED file .*0002_b\.sql.*pnpm db:migration-pin/);
    assert.equal(write({ dir: s.dir, manifestPath: s.manifestPath, log: quiet }), 0);
    assert.equal(await up({ ...o, log: quiet }, deps), 0);
    assert.equal(started, 1);
  } finally {
    s.cleanup();
  }
});

test('an unmerged migration edited after it was pinned: refused, and deleting its own manifest entry lets it be pinned again', async () => {
  const s = scratch({ '0001_a.sql': 'SELECT 1;\n', '0002_b.sql': 'SELECT 2;\n' });
  try {
    const o = { dir: s.dir, manifestPath: s.manifestPath };
    assert.equal(write({ ...o, log: quiet }), 0);
    writeFileSync(path.join(s.dir, '0002_b.sql'), 'SELECT 22;\n');
    const deps = { readApplied: async () => ['0001_a'], run: () => 0 };
    const lines = [];
    assert.equal(await up({ ...o, root: s.root, log: (l) => lines.push(l) }, deps), 1);
    assert.match(lines.join('\n'), /CHANGED migration 0002_b\.sql/);
    const refused = [];
    assert.equal(write({ ...o, log: (l) => refused.push(l) }), 1);
    assert.match(
      refused.join('\n'),
      /pinned 0002_b\.sql has changed; write does not re-pin history/,
    );
    // the documented way out, for an entry that was never merged: drop that last entry and pin again
    const m = JSON.parse(readFileSync(s.manifestPath, 'utf8'));
    m.files.pop();
    writeFileSync(s.manifestPath, JSON.stringify(m));
    assert.equal(write({ ...o, log: quiet }), 0);
    assert.equal(await up({ ...o, root: s.root, log: quiet }, deps), 0);
    // ...and it never re-pins an entry that is not the last one
    writeFileSync(path.join(s.dir, '0001_a.sql'), 'SELECT 11;\n');
    assert.equal(write({ ...o, log: quiet }), 1);
  } finally {
    s.cleanup();
  }
});

test('a new migration with CRLF line endings is refused at pin time, and a pinned file that is now CRLF says so', async () => {
  const s = scratch({ '0001_a.sql': 'SELECT 1;\n' });
  try {
    const o = { dir: s.dir, manifestPath: s.manifestPath };
    assert.equal(write({ ...o, log: quiet }), 0);
    const before = readFileSync(s.manifestPath, 'utf8');
    writeFileSync(path.join(s.dir, '0002_b.sql'), 'SELECT 2;\r\nSELECT 3;\r\n');
    const out = [];
    assert.equal(write({ ...o, log: (l) => out.push(l) }), 1);
    assert.match(out.join('\n'), /0002_b\.sql has CRLF line endings; migrations are LF/);
    assert.equal(readFileSync(s.manifestPath, 'utf8'), before, 'nothing was pinned');
    writeFileSync(path.join(s.dir, '0002_b.sql'), 'SELECT 2;\nSELECT 3;\n');
    assert.equal(write({ ...o, log: quiet }), 0, 'the same file as LF pins');
    // a pinned LF file that an editor rewrote as CRLF: CHANGED, with the reason
    writeFileSync(path.join(s.dir, '0001_a.sql'), 'SELECT 1;\r\n');
    const manifest = JSON.parse(readFileSync(s.manifestPath, 'utf8'));
    assert.match(
      checkDirectory(s.dir, manifest).join('\n'),
      /CHANGED migration 0001_a\.sql.*CRLF line endings/,
    );
    // no committed migration has a CR (git stores them as LF: .gitattributes eol=lf)
    const real = path.join(ROOT, 'db', 'migrations');
    for (const n of readdirSync(real).filter((n) => n.endsWith('.sql')))
      assert.ok(!readFileSync(path.join(real, n)).includes(0x0d), `${n} has no CR`);
  } finally {
    s.cleanup();
  }
});

test('a run without a source rule says so in its output', async () => {
  const s = scratch();
  try {
    write({ dir: s.dir, manifestPath: s.manifestPath, log: quiet });
    const deps = { readApplied: async () => ['0001_a'], run: () => 0 };
    const lines = [];
    await up(
      { dir: s.dir, manifestPath: s.manifestPath, root: s.root, log: (l) => lines.push(l) },
      deps,
    );
    assert.match(lines.join('\n'), /source check: skipped/);
  } finally {
    s.cleanup();
  }
});

test('refusals go to the error stream and progress to the output stream, so a caller that discards stdout still sees why', async () => {
  const s = scratch();
  try {
    write({ dir: s.dir, manifestPath: s.manifestPath, log: quiet });
    const o = { dir: s.dir, manifestPath: s.manifestPath, root: s.root };
    const deps = { readApplied: async () => ['0001_a'], run: () => 0 };
    const sinks = () => {
      const r = { out: [], err: [] };
      return { r, log: (l) => r.out.push(l), err: (l) => r.err.push(l) };
    };
    const ok = sinks();
    assert.equal(await up({ ...o, log: ok.log, err: ok.err }, deps), 0);
    assert.deepEqual(ok.r.err, []);
    assert.match(ok.r.out.join('\n'), /^OK: /);
    writeFileSync(path.join(s.dir, '0002_unpinned.sql'), 'SELECT 2;\n');
    const bad = sinks();
    assert.equal(await up({ ...o, log: bad.log, err: bad.err }, deps), 1);
    assert.match(bad.r.err.join('\n'), /REFUSED: the migration set is not the pinned one/);
    assert.match(bad.r.err.join('\n'), /UNEXPECTED file/);
    assert.doesNotMatch(bad.r.out.join('\n'), /REFUSED|UNEXPECTED/);
    // the other two places a refusal is written: an unreadable history, an unreadable manifest
    const noHistory = sinks();
    await up(
      { ...o, log: noHistory.log, err: noHistory.err },
      {
        readApplied: async () => {
          throw Object.assign(new Error('x'), { code: 'ECONNREFUSED' });
        },
      },
    );
    assert.match(noHistory.r.err.join('\n'), /history cannot be read/);
    assert.doesNotMatch(noHistory.r.out.join('\n'), /REFUSED/);
    const noManifest = sinks();
    await up(
      {
        ...o,
        manifestPath: path.join(s.root, 'missing.json'),
        log: noManifest.log,
        err: noManifest.err,
      },
      deps,
    );
    assert.match(noManifest.r.err.join('\n'), /manifest cannot be read/);
    assert.doesNotMatch(noManifest.r.out.join('\n'), /REFUSED/);
  } finally {
    s.cleanup();
  }
});

test('the target is a plain postgres URL or it is refused before anything connects, and it is named without credentials', () => {
  const ok = {
    'postgres://u:pw@db.example:6543/app?sslmode=require': 'db.example:6543/app',
    'postgresql://u:pw@localhost/app_2.test-x': 'localhost:5432/app_2.test-x',
    'postgres://adulis_bootstrap:ci-password@127.0.0.1:55432/adulis': '127.0.0.1:55432/adulis',
  };
  for (const [url, target] of Object.entries(ok)) assert.deepEqual(checkTarget(url), { target });
  const refused = {
    'not a url': /not a URL/,
    '': /not a URL/,
    'mysql://u:pw@h/db': /not a postgres/,
    'postgres:/user:secretpw@host/db': /no host/,
    'postgres://user:12/34@host/db': /not one plain database name/,
    'postgres://u:pw@h/db/extra': /not one plain database name/,
    'postgres://u:pw@h': /not one plain database name/,
    'postgres://u:pw@h/db%20x': /not one plain database name/,
    'postgres://u:pw@h/db?host=elsewhere': /sets host as a query option/,
    'postgres://u:pw@h/db?port=1&dbname=other': /sets port, dbname as a query option/,
  };
  for (const [url, why] of Object.entries(refused)) {
    const r = checkTarget(url);
    assert.match(r.error, why, url);
    assert.equal(r.target, undefined);
    assert.ok(!/secretpw|12\/34/.test(r.error), 'the reason never repeats the string');
  }
  const saved = process.env.DATABASE_URL_MIGRATE;
  try {
    for (const bad of [undefined, 'not a url', 'postgres:/user:secretpw@host/db']) {
      const lines = [];
      if (bad === undefined) delete process.env.DATABASE_URL_MIGRATE;
      else process.env.DATABASE_URL_MIGRATE = bad;
      const url = resolveTarget(process.env, {
        log: (l) => lines.push(`out ${l}`),
        err: (l) => lines.push(`err ${l}`),
      });
      assert.equal(url, null);
      assert.equal(lines.length, 1);
      assert.match(lines[0], /^err REFUSED: DATABASE_URL_MIGRATE is not (set|usable)/);
      assert.doesNotMatch(lines[0], /secretpw/);
    }
  } finally {
    if (saved === undefined) delete process.env.DATABASE_URL_MIGRATE;
    else process.env.DATABASE_URL_MIGRATE = saved;
  }
});

test('the ordinary command names its one target before it reads anything, never prints the credentials, and refuses a malformed one without connecting', async () => {
  // in process: the target line comes before the history read
  const s = scratch();
  const saved = process.env.DATABASE_URL_MIGRATE;
  try {
    write({ dir: s.dir, manifestPath: s.manifestPath, log: quiet });
    process.env.DATABASE_URL_MIGRATE = 'postgres://someuser:s3cretpw@127.0.0.1:1/target_db';
    const lines = [];
    const code = await up(
      { dir: s.dir, manifestPath: s.manifestPath, root: s.root, log: (l) => lines.push(l) },
      { run: () => assert.fail('the runner must not start') },
    );
    assert.equal(code, 1);
    const at = (re) => lines.findIndex((l) => re.test(l));
    assert.ok(at(/^target: 127\.0\.0\.1:1\/target_db$/) >= 0, 'the target is named');
    assert.ok(at(/history cannot be read/) > at(/^target: /), 'the target line comes first');
  } finally {
    if (saved === undefined) delete process.env.DATABASE_URL_MIGRATE;
    else process.env.DATABASE_URL_MIGRATE = saved;
    s.cleanup();
  }
  // the real command line: port 1 refuses at once, after the target is named; credentials are never printed
  const r = cli('db:migrate', [], {
    DATABASE_URL_MIGRATE: 'postgres://someuser:s3cretpw@127.0.0.1:1/target_db',
  });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^target: 127\.0\.0\.1:1\/target_db$/m);
  assert.match(r.stderr, /the migration history cannot be read/);
  assert.doesNotMatch(r.stdout + r.stderr, /s3cretpw|someuser/);
  // a malformed target never reaches a connection (and its credentials are not echoed)
  for (const bad of [
    'postgres:/someuser:s3cretpw@host/db',
    'postgres://someuser:12/34@host/db',
    'not a url',
  ]) {
    const m = cli('db:migrate', [], { DATABASE_URL_MIGRATE: bad });
    assert.equal(m.status, 1, bad);
    assert.match(m.stderr, /REFUSED: DATABASE_URL_MIGRATE is not usable/);
    assert.doesNotMatch(m.stderr, /history cannot be read/, 'it must not have connected');
    assert.doesNotMatch(m.stdout + m.stderr, /s3cretpw|someuser|12\/34/);
    assert.doesNotMatch(m.stdout, /^target:/m);
  }
});

test('verify --db refuses without a target, names the target it reads, and writes its refusals to stderr', () => {
  const none = cli('db:migration-guard', ['--db']);
  assert.equal(none.status, 1);
  assert.match(none.stderr, /REFUSED: DATABASE_URL_MIGRATE is not set/);
  assert.doesNotMatch(none.stdout, /REFUSED/);
  const unreachable = cli('db:migration-guard', ['--db'], {
    DATABASE_URL_MIGRATE: 'postgres://someuser:s3cretpw@127.0.0.1:1/verify_db',
  });
  assert.equal(unreachable.status, 1);
  assert.match(unreachable.stdout, /^target: 127\.0\.0\.1:1\/verify_db$/m);
  assert.doesNotMatch(unreachable.stdout + unreachable.stderr, /s3cretpw|someuser/);
  const bad = cli('db:migration-guard', ['--db'], {
    DATABASE_URL_MIGRATE: 'postgres://someuser:s3cretpw@host/db?host=elsewhere',
  });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /is not usable/);
  // without --db it reads no database and needs no variable
  const files = cli('db:migration-guard');
  assert.equal(files.status, 0);
  assert.match(files.stdout, /^OK: \d+ pinned migrations match$/m);
});
