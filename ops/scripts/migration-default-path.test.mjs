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

import { up, write } from './migration-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const pkg = JSON.parse(read('package.json'));
const GUARD = 'ops/scripts/migration-guard.mjs';
const SELF = 'ops/scripts/migration-default-path.test.mjs';

/** Every way of naming the raw runner on a command line or in code (not a mention in prose). */
const RAW_RUNNER =
  /node-pg-migrate\/bin|bin\/node-pg-migrate|(?:exec|dlx|npx|yarn)\s+node-pg-migrate|(?:from|require\()\s*['"]node-pg-migrate['"]/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.expo', '.next']);
const TEXT =
  /\.(mjs|cjs|js|ts|tsx|json|ya?ml|sh|ps1|md)$|(^|\/)(Dockerfile[^/]*|docker-compose[^/]*)$/;

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

test('no script, workflow, runbook or doc outside the guard names the raw runner', () => {
  const offenders = SCANNED.filter(
    (f) => f !== GUARD && f !== SELF && RAW_RUNNER.test(readFileSync(path.join(ROOT, f), 'utf8')),
  );
  assert.deepEqual(offenders, [], 'only the guard starts node-pg-migrate');
  for (const f of SCANNED.filter((f) => f.endsWith('package.json')))
    for (const [n, cmd] of Object.entries(JSON.parse(read(f)).scripts ?? {}))
      assert.doesNotMatch(cmd, /node-pg-migrate/, `${f} script ${n}`);
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

test('the documented commands exist: the migration docs name the ordinary command, the strict one and the pin command', () => {
  const doc = read('docs/infrastructure/MIGRATION-FILE-GUARD.md');
  for (const name of ['db:migrate', 'db:migrate:guarded', 'db:migration-guard', 'db:migration-pin'])
    assert.ok(pkg.scripts[name], `${name} is a script`);
  for (const name of [
    'pnpm db:migrate',
    'pnpm db:migrate:guarded',
    'pnpm db:migration-guard',
    'pnpm db:migration-pin',
  ])
    assert.ok(doc.includes(name), `MIGRATION-FILE-GUARD.md documents ${name}`);
  assert.match(
    doc,
    /node-pg-migrate directly/i,
    'the doc says the raw runner is not a way to migrate',
  );
  assert.ok(
    read('apps/api/CLAUDE.md').includes('pnpm db:migration-pin'),
    'the migration authoring rules name the pin command',
  );
});

test('the ordinary command, as the package script spells it, refuses without a database and on a mistyped flag, and never applies', () => {
  const run = (extra, env = {}) => {
    const clean = { ...process.env };
    delete clean.DATABASE_URL_MIGRATE;
    return spawnSync(process.execPath, [...scriptArgv('db:migrate'), ...extra], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...clean, ...env },
    });
  };
  const noDb = run([]);
  assert.equal(noDb.status, 1);
  assert.match(noDb.stdout, /REFUSED: DATABASE_URL_MIGRATE is not set; nothing was applied/);
  // a typo of --dry-run must not become a real apply, and the source rules cannot be mixed
  const typo = run(['--dryrun'], { DATABASE_URL_MIGRATE: 'postgres://x:y@127.0.0.1:1/none' });
  assert.equal(typo.status, 2);
  assert.match(typo.stdout, /unknown argument "--dryrun"/);
  const mixed = run(['--expect-commit', 'abc1234'], {
    DATABASE_URL_MIGRATE: 'postgres://x:y@127.0.0.1:1/none',
  });
  assert.equal(mixed.status, 2);
  assert.match(mixed.stdout, /exclude each other/);
  // the strict script is `up` alone: it must name its source rule
  const strict = spawnSync(process.execPath, scriptArgv('db:migrate:guarded'), {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(strict.status, 2);
  assert.match(strict.stdout, /up needs --expect-commit/);
});

test('an unpinned new migration is refused with the pin command, and pinning it makes the same set apply', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'migpath-'));
  try {
    const dir = path.join(root, 'migrations');
    mkdirSync(dir);
    writeFileSync(path.join(dir, '0001_a.sql'), 'SELECT 1;\n');
    const manifestPath = path.join(root, 'manifest.json');
    assert.equal(write({ dir, manifestPath, log: () => {} }), 0);
    writeFileSync(path.join(dir, '0002_b.sql'), 'SELECT 2;\n');
    let started = 0;
    const deps = { readApplied: async () => ['0001_a'], run: () => ((started += 1), 0) };
    const lines = [];
    const refused = await up({ dir, manifestPath, root, log: (l) => lines.push(l) }, deps);
    assert.equal(refused, 1);
    assert.equal(started, 0);
    assert.match(lines.join('\n'), /UNEXPECTED file .*0002_b\.sql.*pnpm db:migration-pin/);
    assert.equal(write({ dir, manifestPath, log: () => {} }), 0);
    const applied = await up({ dir, manifestPath, root, log: () => {} }, deps);
    assert.equal(applied, 0);
    assert.equal(started, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a run without a source rule says so in its output', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'migpath-'));
  try {
    const dir = path.join(root, 'migrations');
    mkdirSync(dir);
    writeFileSync(path.join(dir, '0001_a.sql'), 'SELECT 1;\n');
    const manifestPath = path.join(root, 'manifest.json');
    write({ dir, manifestPath, log: () => {} });
    const deps = { readApplied: async () => ['0001_a'], run: () => 0 };
    const lines = [];
    await up({ dir, manifestPath, root, log: (l) => lines.push(l) }, deps);
    assert.match(lines.join('\n'), /source check: skipped/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
