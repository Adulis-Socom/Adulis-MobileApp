// The identity of a deployment artifact's migration set: what a record proves, what it does not, and that nothing
// applies a migration because of one. Fake artifacts are built in temporary directories; no database is involved.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildManifest, checkDirectory, sha256 } from './migration-guard.mjs';
import {
  ARTIFACT_SCHEMA,
  MAX_RECORD_BYTES,
  describeArtifact,
  main,
  readRecordFile,
  verifyArtifact,
} from './release-artifact.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMMIT = 'c'.repeat(40);
const OTHER = 'd'.repeat(40);

/** A small fake artifact: three migrations and their manifest, in a temporary directory. */
function fake() {
  const base = mkdtempSync(path.join(tmpdir(), 'relart-'));
  const dir = path.join(base, 'migrations');
  mkdirSync(dir);
  for (const [n, body] of [
    ['0001_one.sql', 'SELECT 1;\n'],
    ['0002_two.sql', 'SELECT 2;\n'],
    ['0003_three.sql', 'SELECT 3;\n'],
  ])
    writeFileSync(path.join(dir, n), body);
  const manifestPath = path.join(base, 'manifest.json');
  const pin = () => writeFileSync(manifestPath, `${JSON.stringify(buildManifest(dir), null, 2)}\n`);
  pin();
  const opts = { dir, manifestPath };
  const record = describeArtifact({ commit: COMMIT, ...opts }).record;
  return {
    base,
    dir,
    manifestPath,
    pin,
    opts,
    record,
    cleanup: () => rmSync(base, { recursive: true, force: true }),
  };
}

test('a tree whose files are its pinned set is described: the commit and the manifest hash, nothing else', () => {
  const f = fake();
  try {
    assert.deepEqual(Object.keys(f.record).sort(), ['commit', 'manifestSha256', 'schema']);
    assert.equal(f.record.schema, ARTIFACT_SCHEMA);
    assert.equal(f.record.commit, COMMIT);
    assert.equal(f.record.manifestSha256, sha256(readFileSync(f.manifestPath)));
    assert.equal(
      describeArtifact({ commit: COMMIT.toUpperCase(), ...f.opts }).record.commit,
      COMMIT,
    );
    assert.deepEqual(verifyArtifact({ record: f.record, expectedCommit: COMMIT, ...f.opts }), []);
    assert.deepEqual(
      verifyArtifact({ record: f.record, expectedCommit: COMMIT.toUpperCase(), ...f.opts }),
      [],
    );
  } finally {
    f.cleanup();
  }
});

test('a tree that is not its pinned set is never described, and a commit that is not a full sha is refused', () => {
  const f = fake();
  try {
    for (const commit of [
      '',
      'c'.repeat(39),
      'c'.repeat(41),
      'g'.repeat(40),
      'cccccccc',
      undefined,
      null,
      40,
    ])
      assert.match(
        describeArtifact({ commit, ...f.opts }).problems.join('\n'),
        /--commit must be the full 40-character commit sha/,
        String(commit),
      );
    writeFileSync(path.join(f.dir, '0002_two.sql'), 'SELECT 22;\n');
    assert.match(
      describeArtifact({ commit: COMMIT, ...f.opts }).problems.join('\n'),
      /CHANGED migration 0002_two\.sql/,
    );
    rmSync(path.join(f.dir, '0002_two.sql'));
    assert.match(
      describeArtifact({ commit: COMMIT, ...f.opts }).problems.join('\n'),
      /MISSING migration 0002_two\.sql/,
    );
    writeFileSync(path.join(f.dir, '0002_two.sql'), 'SELECT 2;\n');
    writeFileSync(path.join(f.dir, '0004_extra.sql'), 'SELECT 4;\n');
    assert.match(
      describeArtifact({ commit: COMMIT, ...f.opts }).problems.join('\n'),
      /UNEXPECTED file[^]*0004_extra\.sql/,
    );
    rmSync(path.join(f.dir, '0004_extra.sql'));
    writeFileSync(f.manifestPath, '{"version":2,"files":[]}');
    assert.match(
      describeArtifact({ commit: COMMIT, ...f.opts }).problems.join('\n'),
      /MANIFEST is not a version 1 list/,
    );
    assert.match(
      describeArtifact({
        commit: COMMIT,
        dir: f.dir,
        manifestPath: path.join(f.base, 'absent.json'),
      }).problems.join('\n'),
      /the manifest cannot be read/,
    );
  } finally {
    f.cleanup();
  }
});

test('verify names every way the artifact differs from its record: a changed, missing or added file, a re-pinned manifest, another commit', () => {
  const f = fake();
  const check = (extra = {}) =>
    verifyArtifact({ record: f.record, expectedCommit: COMMIT, ...f.opts, ...extra }).join('\n');
  try {
    // a file edited after the record was made
    writeFileSync(path.join(f.dir, '0003_three.sql'), 'DROP TABLE core.account;\n');
    assert.match(check(), /CHANGED migration 0003_three\.sql/);
    // the same edit AND its manifest line re-pinned: every directory check passes, the record does not
    f.pin();
    assert.deepEqual(
      checkDirectory(f.dir, JSON.parse(readFileSync(f.manifestPath, 'utf8'))),
      [],
      'the guard alone accepts it',
    );
    assert.match(check(), /the migration manifest is not the one the record describes/);
    // a migration appended and pinned after the record was made
    writeFileSync(path.join(f.dir, '0003_three.sql'), 'SELECT 3;\n');
    writeFileSync(path.join(f.dir, '0004_new.sql'), 'SELECT 4;\n');
    f.pin();
    assert.match(check(), /the migration manifest is not the one the record describes/);
    rmSync(path.join(f.dir, '0004_new.sql'));
    f.pin();
    assert.equal(check(), '', 'back to the described tree');
    // a manifest that only differs in formatting is not the recorded bytes
    writeFileSync(f.manifestPath, JSON.stringify(JSON.parse(readFileSync(f.manifestPath, 'utf8'))));
    assert.match(check(), /the migration manifest is not the one the record describes/);
    f.pin();
    // a file removed
    rmSync(path.join(f.dir, '0001_one.sql'));
    assert.match(check(), /MISSING migration 0001_one\.sql/);
    writeFileSync(path.join(f.dir, '0001_one.sql'), 'SELECT 1;\n');
    // the commit the pipeline expects
    assert.match(
      check({ expectedCommit: OTHER }),
      /the record is for commit cccccccccccc, the pipeline expects dddddddddddd/,
    );
    // git HEAD, when the checkout has its own
    assert.match(
      check({ headCommit: OTHER }),
      /git HEAD is dddddddddddd, the record is for cccccccccccc/,
    );
    assert.equal(check({ headCommit: COMMIT.toUpperCase() }), '');
    assert.equal(
      check({ headCommit: null }),
      '',
      'no git metadata: judged by the files and the expected commit',
    );
  } finally {
    f.cleanup();
  }
});

test('a record that is not exactly what write produces, and an expectation that is not a full sha, are refused before anything is compared', () => {
  const f = fake();
  const run = (record, expectedCommit = COMMIT) =>
    verifyArtifact({ record, expectedCommit, ...f.opts }).join('\n');
  try {
    assert.match(run({ ...f.record, schema: 2 }), /schema is not 1/);
    assert.match(run({ ...f.record, schema: '1' }), /schema is not 1/);
    assert.match(
      run({ ...f.record, commit: COMMIT.toUpperCase() }),
      /names no full 40-character commit/,
    );
    assert.match(
      run({ ...f.record, commit: COMMIT.slice(0, 12) }),
      /names no full 40-character commit/,
    );
    assert.match(run({ ...f.record, manifestSha256: 'x'.repeat(64) }), /names no manifest sha256/);
    assert.match(run({ ...f.record, manifestSha256: undefined }), /names no manifest sha256/);
    assert.match(run(null), /schema is not 1/);
    assert.match(
      run(f.record, COMMIT.slice(0, 12)),
      /--expect-commit must be the full 40-character commit sha/,
    );
    assert.match(run(f.record, ''), /--expect-commit must be the full 40-character commit sha/);
    assert.match(run(f.record, null), /--expect-commit must be the full 40-character commit sha/);
  } finally {
    f.cleanup();
  }
});

test('a record file is size-capped JSON with exactly the keys write produces', () => {
  const f = fake();
  const file = path.join(f.base, 'record.json');
  const put = (text) => writeFileSync(file, text);
  try {
    put(JSON.stringify(f.record));
    assert.deepEqual(readRecordFile(file).record, f.record);
    put('{');
    assert.match(readRecordFile(file).problems[0], /not JSON/);
    for (const v of ['null', '[]', '"x"', '5']) {
      put(v);
      assert.match(readRecordFile(file).problems[0], /not a JSON object/, v);
    }
    put(JSON.stringify({ ...f.record, note: 'extra' }));
    assert.match(
      readRecordFile(file).problems[0],
      /exactly the keys commit, manifestSha256, schema/,
    );
    put(JSON.stringify({ schema: 1, commit: COMMIT }));
    assert.match(readRecordFile(file).problems[0], /exactly the keys/);
    put(JSON.stringify({ ...f.record, pad: 'x'.repeat(MAX_RECORD_BYTES) }));
    assert.match(readRecordFile(file).problems[0], /larger than 2048 bytes/);
    assert.match(readRecordFile(path.join(f.base, 'absent.json')).problems[0], /cannot be read/);
  } finally {
    f.cleanup();
  }
});

// ---- the real scripts in an artifact checkout with no git metadata ---------------------------------------------------

/** copies of the guard, the record script and the library, the real migrations and manifest, and a junction to `pg`. */
function artifactTree() {
  const dir = mkdtempSync(path.join(tmpdir(), 'relart-tree-'));
  mkdirSync(path.join(dir, 'ops', 'scripts'), { recursive: true });
  for (const f of ['migration-guard.mjs', 'release-artifact.mjs'])
    cpSync(path.join(ROOT, 'ops', 'scripts', f), path.join(dir, 'ops', 'scripts', f));
  cpSync(path.join(ROOT, 'ops', 'scripts', 'lib'), path.join(dir, 'ops', 'scripts', 'lib'), {
    recursive: true,
  });
  cpSync(
    path.join(ROOT, 'ops', 'migrations.manifest.json'),
    path.join(dir, 'ops', 'migrations.manifest.json'),
  );
  cpSync(path.join(ROOT, 'db', 'migrations'), path.join(dir, 'db', 'migrations'), {
    recursive: true,
  });
  mkdirSync(path.join(dir, 'node_modules'));
  symlinkSync(
    realpathSync(path.join(ROOT, 'node_modules', 'pg')),
    path.join(dir, 'node_modules', 'pg'),
    'junction',
  );
  const cli = (args, env = {}) => {
    const r = spawnSync(
      process.execPath,
      [path.join(dir, 'ops', 'scripts', 'release-artifact.mjs'), ...args],
      {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, ...env },
      },
    );
    return { status: r.status, out: `${r.stdout}`, err: `${r.stderr}` };
  };
  const git = (...a) => {
    const r = spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  return {
    dir,
    cli,
    git,
    record: path.join(dir, 'release-record.json'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test('real command line, artifact without git metadata: write, then verify with the commit the pipeline expects; it says it authorises nothing', () => {
  const t = artifactTree();
  try {
    const w = t.cli(['write', '--commit', COMMIT, '--out', t.record]);
    assert.equal(w.status, 0, w.err);
    assert.match(w.out, /wrote the record for commit cccccccccccc/);
    const again = t.cli(['write', '--commit', COMMIT, '--out', t.record]);
    assert.equal(again.status, 1, 'an existing record is never overwritten');
    assert.match(again.err, /cannot be created \(EEXIST\)/);
    const v = t.cli(['verify', '--info', t.record, '--expect-commit', COMMIT]);
    assert.equal(v.status, 0, v.err);
    assert.match(v.out, /OK: the migration files are the ones recorded for commit cccccccccccc/);
    assert.match(v.out, /git metadata: none/);
    assert.match(v.out, /does not authorise a migration/);
    const wrong = t.cli(['verify', '--info', t.record, '--expect-commit', OTHER]);
    assert.equal(wrong.status, 1);
    assert.match(
      wrong.err,
      /the record is for commit cccccccccccc, the pipeline expects dddddddddddd/,
    );
    // an edit of a migration file after the record was made
    const f = path.join(t.dir, 'db', 'migrations', '0001_foundation.sql');
    writeFileSync(f, `${readFileSync(f, 'utf8')}\n-- edited\n`);
    const tampered = t.cli(['verify', '--info', t.record, '--expect-commit', COMMIT]);
    assert.equal(tampered.status, 1);
    assert.match(tampered.err, /CHANGED migration 0001_foundation\.sql/);
    assert.equal(
      t.cli(['write', '--commit', OTHER, '--out', path.join(t.dir, 'second.json')]).status,
      1,
      'a tampered tree is never described',
    );
    assert.ok(!existsSync(path.join(t.dir, 'second.json')));
  } finally {
    t.cleanup();
  }
});

test('real command line: a strict command line, and a checkout with git metadata is held to it', () => {
  const t = artifactTree();
  try {
    for (const args of [
      [],
      ['apply'],
      ['write', '--commit', COMMIT],
      ['write', '--out', t.record],
      ['write', '--commit', COMMIT, '--out', t.record, '--commit', COMMIT],
      ['write', '--commit', COMMIT, '--out', t.record, '--force', 'x'],
      ['write', '--commit', '--out', t.record],
      ['verify', '--info', t.record],
      ['verify', '--expect-commit', COMMIT],
    ]) {
      const r = t.cli(args);
      assert.equal(r.status, 2, args.join(' '));
      assert.match(r.err, /REFUSED:/);
    }
    assert.ok(!existsSync(t.record), 'a refused command line writes nothing');
    assert.equal(t.cli(['write', '--commit', 'c'.repeat(12), '--out', t.record]).status, 1);
    // with git metadata of its own, HEAD must be the recorded commit
    t.git('init', '-q');
    t.git('config', 'user.email', 't@example.invalid');
    t.git('config', 'user.name', 't');
    t.git('config', 'commit.gpgsign', 'false');
    t.git('config', 'core.autocrlf', 'false');
    writeFileSync(path.join(t.dir, '.gitignore'), 'node_modules/\n');
    t.git('add', '-A');
    t.git('commit', '-q', '-m', 'tree');
    const head = t.git('rev-parse', 'HEAD');
    const bad = t.cli(['write', '--commit', COMMIT, '--out', t.record]);
    assert.equal(bad.status, 1);
    assert.match(bad.err, /git HEAD is [0-9a-f]{12}, not --commit cccccccccccc/);
    assert.ok(!existsSync(t.record));
    assert.equal(t.cli(['write', '--commit', head, '--out', t.record]).status, 0);
    const ok = t.cli(['verify', '--info', t.record, '--expect-commit', head]);
    assert.equal(ok.status, 0, ok.err);
    assert.match(ok.out, /git HEAD: equal to the recorded commit/);
    // a .git that git cannot read is a refusal, never "no git metadata"
    rmSync(path.join(t.dir, '.git'), { recursive: true, force: true });
    writeFileSync(path.join(t.dir, '.git'), 'gitdir: ./does-not-exist\n');
    const broken = t.cli(['verify', '--info', t.record, '--expect-commit', head]);
    assert.equal(broken.status, 1);
    assert.match(broken.err, /cannot read the git HEAD/);
  } finally {
    t.cleanup();
  }
});

test('a record never authorises a migration: the guard and the package scripts do not read it, and it is not registered anywhere that applies one', () => {
  const guard = readFileSync(path.join(ROOT, 'ops', 'scripts', 'migration-guard.mjs'), 'utf8');
  assert.doesNotMatch(
    guard,
    /release-artifact|readRecordFile|verifyArtifact/,
    'the guard never reads a record',
  );
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const [name, cmd] of Object.entries(pkg.scripts))
    assert.doesNotMatch(cmd, /release-artifact/, `package script ${name} must not use it`);
  for (const f of [
    'ops/render.yaml',
    '.github/workflows/ci.yml',
    'ops/scripts/db-reset.mjs',
    'ops/scripts/test-db.sh',
  ])
    assert.doesNotMatch(
      readFileSync(path.join(ROOT, f), 'utf8'),
      /release-artifact/,
      `${f} must not use it`,
    );
  // it reads and writes only through its own two commands; it cannot start the migration runner or reach a database
  const src = readFileSync(path.join(ROOT, 'ops', 'scripts', 'release-artifact.mjs'), 'utf8');
  assert.doesNotMatch(src, /child_process|from 'pg'|import\('pg'\)|spawn|DATABASE_URL/);
});

test('main() is usable in process: the same refusals, with the output injected', () => {
  const lines = [];
  const code = main(['verify'], { log: (l) => lines.push(l), err: (l) => lines.push(l) });
  assert.equal(code, 2);
  assert.match(lines.join('\n'), /REFUSED: --info, --expect-commit needed; nothing was written/);
});

test('the gate that CI runs includes this test file next to the guard tests', () => {
  const gates = readFileSync(path.join(ROOT, 'ops', 'scripts', 'gates.mjs'), 'utf8');
  const line = gates.split('\n').find((l) => l.includes("id: 'migration-guard'"));
  assert.ok(line, 'the migration-guard gate exists');
  for (const f of ['migration-persistent-target.test.mjs', 'release-artifact.test.mjs'])
    assert.ok(line.includes(`ops/scripts/${f}`), `${f} is part of the gate`);
});

test('a pipeline simulation: the record written in the build checkout travels to an image without git, and a stale or altered image is refused there', () => {
  const build = artifactTree();
  const image = artifactTree(); // the deployed artifact: the same files, no git metadata
  try {
    build.git('init', '-q');
    build.git('config', 'user.email', 't@example.invalid');
    build.git('config', 'user.name', 't');
    build.git('config', 'commit.gpgsign', 'false');
    build.git('config', 'core.autocrlf', 'false');
    writeFileSync(path.join(build.dir, '.gitignore'), 'node_modules/\n');
    build.git('add', '-A');
    build.git('commit', '-q', '-m', 'release');
    const head = build.git('rev-parse', 'HEAD');
    assert.equal(build.cli(['write', '--commit', head, '--out', build.record]).status, 0);
    cpSync(build.record, image.record);
    const ok = image.cli(['verify', '--info', image.record, '--expect-commit', head]);
    assert.equal(ok.status, 0, ok.err);
    assert.match(ok.out, /git metadata: none/);
    // a record from another release: the pipeline expects a different commit
    assert.equal(image.cli(['verify', '--info', image.record, '--expect-commit', OTHER]).status, 1);
    // an image built from a later commit: a migration was appended and pinned after the record was made
    const manifest = JSON.parse(
      readFileSync(path.join(image.dir, 'ops', 'migrations.manifest.json'), 'utf8'),
    );
    const number = String(manifest.files.length + 1).padStart(4, '0');
    writeFileSync(
      path.join(image.dir, 'db', 'migrations', `${number}_appended.sql`),
      'SELECT 1;\n',
    );
    const pinned = spawnSync(
      process.execPath,
      [path.join(image.dir, 'ops', 'scripts', 'migration-guard.mjs'), 'write'],
      {
        cwd: image.dir,
        encoding: 'utf8',
      },
    );
    assert.equal(pinned.status, 0, pinned.stderr);
    const stale = image.cli(['verify', '--info', image.record, '--expect-commit', head]);
    assert.equal(stale.status, 1);
    assert.match(stale.err, /the migration manifest is not the one the record describes/);
  } finally {
    build.cleanup();
    image.cleanup();
  }
});

// ---- a script started through a link, and the other ways a start can silently do nothing ----------------------------------

/** A directory link (a junction on Windows, a symlink elsewhere) to `dir`, removed without touching `dir`. */
function linkTo(dir) {
  const base = mkdtempSync(path.join(tmpdir(), 'rellink-'));
  const link = path.join(base, 'current');
  symlinkSync(dir, link, 'junction');
  return {
    link,
    cleanup: () => {
      try {
        unlinkSync(link);
      } catch {
        rmdirSync(link);
      }
      rmSync(base, { recursive: true, force: true });
    },
  };
}

test('started through a directory link, the migration guard and the record script still run: the usage refusal and exit 2, never a silent exit 0', (t) => {
  const tree = artifactTree();
  let l;
  try {
    l = linkTo(tree.dir);
  } catch (e) {
    tree.cleanup();
    t.skip(`no directory link can be created here (${e.code}); the Linux CI run creates a symlink`);
    return;
  }
  try {
    const run = (dir, script, args) =>
      spawnSync(process.execPath, [path.join(dir, 'ops', 'scripts', script), ...args], {
        cwd: tree.dir,
        encoding: 'utf8',
      });
    for (const dir of [tree.dir, l.link]) {
      const via = dir === l.link ? 'through the link' : 'directly';
      const art = run(dir, 'release-artifact.mjs', ['verify']);
      assert.equal(art.status, 2, `record script ${via}: ${art.stdout}${art.stderr}`);
      assert.match(art.stderr, /REFUSED: --info, --expect-commit needed/, via);
      const guard = run(dir, 'migration-guard.mjs', ['up', '--bogus']);
      assert.equal(guard.status, 2, `guard ${via}: ${guard.stdout}${guard.stderr}`);
      assert.match(guard.stderr, /REFUSED: unknown argument "--bogus" for up/, via);
    }
    // and real work done through the link is done: the record is written
    const w = run(l.link, 'release-artifact.mjs', [
      'write',
      '--commit',
      COMMIT,
      '--out',
      'via-link.json',
    ]);
    assert.equal(w.status, 0, w.stderr);
    assert.ok(existsSync(path.join(tree.dir, 'via-link.json')));
  } finally {
    l.cleanup();
    tree.cleanup();
  }
});

test('entryKind recognises the running script through a link and refuses an unresolvable name instead of guessing', async (t) => {
  const { entryKind } = await import('./migration-guard.mjs');
  const base = mkdtempSync(path.join(tmpdir(), 'relentry-'));
  let l = null;
  try {
    const real = path.join(base, 'real');
    mkdirSync(real);
    const file = path.join(real, 'tool.mjs');
    writeFileSync(file, '');
    writeFileSync(path.join(real, 'other.mjs'), '');
    const meta = pathToFileURL(realpathSync(file)).href;
    assert.equal(entryKind(meta, file), 'run');
    assert.equal(entryKind(meta, path.join(real, 'other.mjs')), 'import');
    assert.equal(entryKind(meta, undefined), 'import');
    assert.equal(entryKind(meta, ''), 'import');
    assert.equal(entryKind(meta, path.join(base, 'gone', 'tool.mjs')), 'unresolved');
    assert.equal(entryKind(meta, path.join(base, 'gone', 'else.mjs')), 'import');
    try {
      l = linkTo(real);
    } catch (e) {
      t.diagnostic(
        `no directory link can be created here (${e.code}); the link case ran in the Linux CI run`,
      );
    }
    if (l) assert.equal(entryKind(meta, path.join(l.link, 'tool.mjs')), 'run');
  } finally {
    l?.cleanup();
    rmSync(base, { recursive: true, force: true });
  }
});

test('no script in ops/scripts decides it is the running script by comparing its URL with argv[1] as typed', () => {
  const dir = path.join(ROOT, 'ops', 'scripts');
  const offenders = readdirSync(dir)
    .filter((n) => n.endsWith('.mjs') && !n.endsWith('.test.mjs'))
    .filter((n) => {
      const src = readFileSync(path.join(dir, n), 'utf8');
      return /import\.meta\.url\s*===/.test(src) || /resolve\(process\.argv\[1\]\)\s*===/.test(src);
    });
  assert.deepEqual(offenders, []);
});

// ---- with git metadata the record is also a promise about the files -------------------------------------------------------

/** A build checkout: git-initialised, everything committed; returns its head. */
function commitTree(t) {
  t.git('init', '-q');
  t.git('config', 'user.email', 't@example.invalid');
  t.git('config', 'user.name', 't');
  t.git('config', 'commit.gpgsign', 'false');
  t.git('config', 'core.autocrlf', 'false');
  writeFileSync(path.join(t.dir, '.gitignore'), 'node_modules/\n');
  t.git('add', '-A');
  t.git('commit', '-q', '-m', 'release');
  return t.git('rev-parse', 'HEAD');
}

test('with git metadata, a migration that is pinned but not committed is neither recorded nor verified as the commit', () => {
  const t = artifactTree();
  try {
    const head = commitTree(t);
    const manifestPath = path.join(t.dir, 'ops', 'migrations.manifest.json');
    const count = JSON.parse(readFileSync(manifestPath, 'utf8')).files.length;
    const name = `${String(count + 1).padStart(4, '0')}_dirty.sql`;
    // appended and pinned, never committed: the manifest is modified and the new file is untracked
    writeFileSync(path.join(t.dir, 'db', 'migrations', name), 'SELECT 1;\n');
    const guardScript = path.join(t.dir, 'ops', 'scripts', 'migration-guard.mjs');
    const git = (args) =>
      spawnSync(process.execPath, [guardScript, ...args], { cwd: t.dir, encoding: 'utf8' });
    assert.equal(git(['write']).status, 0);
    // the guard's own source check refuses this tree
    const guard = git(['verify', '--expect-commit', head]);
    assert.equal(guard.status, 1);
    assert.match(guard.stderr, /SOURCE: the migrations or the manifest differ from the commit/);
    // write refuses it too, and writes nothing
    const dirty = path.join(t.dir, 'dirty.json');
    const w = t.cli(['write', '--commit', head, '--out', dirty]);
    assert.equal(w.status, 1, w.out + w.err);
    assert.match(
      w.err,
      /SOURCE: the migrations or the manifest differ from the commit[^]*dirty\.sql/,
    );
    assert.ok(!existsSync(dirty));
    // a record made on this dirty tree (as the script used to make it) is refused by verify as well
    const d = describeArtifact({
      commit: head,
      dir: path.join(t.dir, 'db', 'migrations'),
      manifestPath,
    });
    assert.ok(
      d.record,
      'the in-process description accepts the tree: only the git check can refuse it',
    );
    writeFileSync(path.join(t.dir, 'made-dirty.json'), JSON.stringify(d.record));
    const v = t.cli([
      'verify',
      '--info',
      path.join(t.dir, 'made-dirty.json'),
      '--expect-commit',
      head,
    ]);
    assert.equal(v.status, 1, v.out + v.err);
    assert.match(v.err, /SOURCE: the migrations or the manifest differ from the commit/);
    // committing the migration makes the same input acceptable
    t.git('add', '-A');
    t.git('commit', '-q', '-m', 'the migration');
    const next = t.git('rev-parse', 'HEAD');
    assert.equal(t.cli(['write', '--commit', next, '--out', dirty]).status, 0);
    const ok = t.cli(['verify', '--info', dirty, '--expect-commit', next]);
    assert.equal(ok.status, 0, ok.err);
    assert.match(
      ok.out,
      /git HEAD: equal to the recorded commit; db\/migrations and the manifest are as committed/,
    );
  } finally {
    t.cleanup();
  }
});

// ---- what the record script may import, and who may mention it ---------------------------------------------------------------

test('the record script imports only identity helpers from the guard, nothing that applies a migration, and no other file mentions it', () => {
  const src = readFileSync(path.join(ROOT, 'ops', 'scripts', 'release-artifact.mjs'), 'utf8');
  const imports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)].map((m) => ({
    names: m[1]
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean),
    from: m[2],
  }));
  assert.deepEqual(
    imports
      .filter((i) => i.from === './migration-guard.mjs')
      .flatMap((i) => i.names)
      .sort(),
    [
      'DEFAULT_DIR',
      'DEFAULT_MANIFEST',
      'REPO_ROOT',
      'checkDirectory',
      'checkManifest',
      'checkSource',
      'entryKind',
      'readCheckoutHead',
      'sha256',
    ],
    'a new import from the guard (up, authorizeApply, the runner path) is a decision, not an accident',
  );
  for (const i of imports.filter((x) => x.from !== './migration-guard.mjs'))
    assert.ok(i.from.startsWith('node:'), `${i.from}: only the standard library otherwise`);
  assert.doesNotMatch(src, /import\s+\w+\s+from\s+'(?!node:)|import\s*\*\s*as|import\s*\(/);
  // every file of the repository that names the script
  const allowed = new Set([
    'ops/scripts/release-artifact.mjs',
    'ops/scripts/release-artifact.test.mjs',
    'ops/scripts/gates.mjs',
    'docs/infrastructure/MIGRATION-FILE-GUARD.md',
    'ops/runbooks/deploy.md',
  ]);
  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);
  const text = /\.(md|mjs|cjs|js|ts|tsx|json|ya?ml|sh|sql|toml|txt)$|^Dockerfile/;
  const found = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(e.name) || e.isSymbolicLink()) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (text.test(e.name) && statSync(p).size < 3 * 1024 * 1024) {
        if (readFileSync(p, 'utf8').includes('release-artifact'))
          found.push(path.relative(ROOT, p).replaceAll('\\', '/'));
      }
    }
  };
  walk(ROOT);
  assert.deepEqual(
    found.filter((f) => !allowed.has(f)),
    [],
    'a Dockerfile, workflow, compose file, blueprint or script that starts using the record script must be reviewed on purpose',
  );
});

// ---- a record path is read with a limit, and an odd commit value is a refusal, not a crash ------------------------------

test('a record path that is not a regular file is refused, and a commit value that is not a string does not throw', () => {
  const f = fake();
  try {
    assert.match(readRecordFile(f.base).problems[0], /not a regular file/);
    for (const commit of [[COMMIT], { toLowerCase: () => COMMIT }, 12])
      assert.match(
        describeArtifact({ commit, ...f.opts }).problems.join('\n'),
        /--commit must be the full 40-character commit sha/,
      );
  } finally {
    f.cleanup();
  }
});

test('the backup verifier and the recovery verdict also run through a directory link: a usage refusal and an UNKNOWN verdict, never a silent exit 0', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'relverify-'));
  mkdirSync(path.join(dir, 'ops', 'scripts'), { recursive: true });
  for (const f of ['db-backup-verify.mjs', 'pg-recovery-verdict.mjs'])
    cpSync(path.join(ROOT, 'ops', 'scripts', f), path.join(dir, 'ops', 'scripts', f));
  let l;
  try {
    l = linkTo(dir);
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    t.skip(`no directory link can be created here (${e.code}); the Linux CI run creates a symlink`);
    return;
  }
  try {
    for (const root of [dir, l.link]) {
      const backup = spawnSync(
        process.execPath,
        [path.join(root, 'ops', 'scripts', 'db-backup-verify.mjs')],
        {
          encoding: 'utf8',
        },
      );
      assert.equal(backup.status, 2, `${root}: ${backup.stdout}${backup.stderr}`);
      assert.match(backup.stderr, /usage: node ops\/scripts\/db-backup-verify\.mjs/);
      const verdict = spawnSync(
        process.execPath,
        [path.join(root, 'ops', 'scripts', 'pg-recovery-verdict.mjs')],
        {
          encoding: 'utf8',
          input: '',
        },
      );
      assert.equal(verdict.status, 2, `${root}: ${verdict.stdout}${verdict.stderr}`);
      assert.match(verdict.stdout, /"verdict": "UNKNOWN"/);
    }
  } finally {
    l.cleanup();
    rmSync(dir, { recursive: true, force: true });
  }
});
