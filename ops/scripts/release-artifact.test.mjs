// The identity of a deployment artifact's migration set: what a record proves, what it does not, and that nothing
// applies a migration because of one. Fake artifacts are built in temporary directories; no database is involved.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

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
