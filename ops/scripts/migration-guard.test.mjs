// The migration-file guard (DB-LIVE-02): an incomplete, altered or mismatched migration set is refused
// BEFORE the runner starts, so nothing reaches a database. Fixtures are temporary directories and a temporary git
// repository; no database is read or written (the history is injected).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  DEFAULT_DIR,
  DEFAULT_MANIFEST,
  MIGRATION_NAME,
  buildManifest,
  checkDirectory,
  checkHistory,
  checkManifest,
  checkSource,
  up,
  verify,
  write,
} from './migration-guard.mjs';

const NAMES = [
  '0001_foundation.sql',
  '0002_accounts.sql',
  '0003_orders.sql',
  '0004_reviews.sql',
  '0005_search_index.sql',
];
function fixture(names = NAMES) {
  const root = mkdtempSync(path.join(tmpdir(), 'migguard-'));
  const dir = path.join(root, 'db', 'migrations');
  mkdirSync(dir, { recursive: true });
  for (const n of names) writeFileSync(path.join(dir, n), `-- ${n}\nSELECT 1;\n`);
  return {
    root,
    dir,
    manifestPath: path.join(root, 'ops-manifest.json'),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
const quiet = () => {};
const captured = () => {
  const lines = [];
  return { lines, log: (l) => lines.push(l) };
};

/** `up` with a runner that records whether it was ever started. */
async function runUp(f, applied, extra = {}) {
  let started = 0;
  const out = captured();
  const code = await up(
    { dir: f.dir, manifestPath: f.manifestPath, root: f.root, log: out.log, ...extra },
    {
      readApplied: async () => applied,
      run: () => {
        started += 1;
        return 0;
      },
    },
  );
  return { code, started, text: out.lines.join('\n') };
}

test('a complete set passes: verify is clean and the runner starts with the pending files', async () => {
  const f = fixture();
  try {
    assert.equal(write({ dir: f.dir, manifestPath: f.manifestPath, log: quiet }), 0);
    const m = JSON.parse(readFileSync(f.manifestPath, 'utf8'));
    assert.deepEqual(verify({ dir: f.dir, manifest: m }).problems, []);
    const r = await runUp(f, NAMES.slice(0, 2));
    assert.equal(r.code, 0);
    assert.equal(r.started, 1);
    assert.match(r.text, /5 pinned migrations, 2 applied, 3 pending/);
  } finally {
    f.cleanup();
  }
});

test('a file missing from the MIDDLE of the sequence is refused, and the runner never starts', async () => {
  const f = fixture();
  try {
    write({ dir: f.dir, manifestPath: f.manifestPath, log: quiet });
    rmSync(path.join(f.dir, '0003_orders.sql'));
    const r = await runUp(f, NAMES.slice(0, 2));
    assert.equal(r.code, 1);
    assert.equal(r.started, 0, 'the runner must not start');
    assert.match(r.text, /REFUSED/);
    assert.match(r.text, /MISSING migration 0003_orders\.sql/);
    assert.match(r.text, /nothing was applied/);
  } finally {
    f.cleanup();
  }
});

test('the last file missing, an extra file, a duplicate number, a rename and an edited file are each refused before the runner', async () => {
  const cases = {
    'last file missing': (d) => rmSync(path.join(d, '0005_search_index.sql')),
    'an unexpected extra file': (d) => writeFileSync(path.join(d, '0006_extra.sql'), 'SELECT 2;\n'),
    'a non-migration file': (d) => writeFileSync(path.join(d, 'notes.txt'), 'x'),
    'a duplicate number': (d) =>
      writeFileSync(path.join(d, '0004_reviews_again.sql'), 'SELECT 3;\n'),
    'a rename (same bytes)': (d) =>
      renameSync(path.join(d, '0002_accounts.sql'), path.join(d, '0002_people.sql')),
    'an edited historical file': (d) =>
      writeFileSync(path.join(d, '0001_foundation.sql'), '-- 0001_foundation.sql\nSELECT 99;\n'),
    'an emptied file': (d) => writeFileSync(path.join(d, '0003_orders.sql'), ''),
  };
  for (const [label, mutate] of Object.entries(cases)) {
    const f = fixture();
    try {
      write({ dir: f.dir, manifestPath: f.manifestPath, log: quiet });
      mutate(f.dir);
      const r = await runUp(f, []);
      assert.equal(r.code, 1, `${label}: must be refused`);
      assert.equal(r.started, 0, `${label}: the runner must not start`);
    } finally {
      f.cleanup();
    }
  }
});

test('an empty directory is refused (every pinned file is missing)', () => {
  const f = fixture();
  try {
    write({ dir: f.dir, manifestPath: f.manifestPath, log: quiet });
    for (const n of NAMES) rmSync(path.join(f.dir, n));
    const m = JSON.parse(readFileSync(f.manifestPath, 'utf8'));
    assert.equal(checkDirectory(f.dir, m).length, NAMES.length);
  } finally {
    f.cleanup();
  }
});

test('the database history must be exactly the first N pinned names, in order', () => {
  const m = { version: 1, files: NAMES.map((name) => ({ name, sha256: 'a'.repeat(64) })) };
  assert.deepEqual(checkHistory([], m), { problems: [], pending: NAMES });
  assert.deepEqual(checkHistory(NAMES.slice(0, 3), m).pending, NAMES.slice(3));
  assert.deepEqual(checkHistory(NAMES, m), { problems: [], pending: [] });
  const unknown = checkHistory([...NAMES.slice(0, 2), '0003_something_else.sql'], m);
  assert.match(unknown.problems[0], /HISTORY MISMATCH at position 3/);
  const skipped = checkHistory([NAMES[0], NAMES[2]], m);
  assert.match(skipped.problems[0], /HISTORY MISMATCH at position 2/);
  const reordered = checkHistory([NAMES[1], NAMES[0]], m);
  assert.equal(reordered.problems.length, 2);
  const ahead = checkHistory([...NAMES, '0006_future.sql'], m);
  assert.match(ahead.problems[0], /APPLIED but not pinned: 0006_future\.sql/);
  assert.deepEqual(ahead.pending, []);
});

test('a database history that disagrees with the manifest is refused before the runner', async () => {
  const f = fixture();
  try {
    write({ dir: f.dir, manifestPath: f.manifestPath, log: quiet });
    for (const applied of [
      ['0001_foundation.sql', '0003_orders.sql'],
      ['0009_unknown.sql'],
      [...NAMES, '0006_future.sql'],
    ]) {
      const r = await runUp(f, applied);
      assert.equal(r.code, 1);
      assert.equal(r.started, 0);
    }
  } finally {
    f.cleanup();
  }
});

test('a history that cannot be read refuses; an up-to-date database starts nothing; a dry run starts nothing', async () => {
  const f = fixture();
  try {
    write({ dir: f.dir, manifestPath: f.manifestPath, log: quiet });
    let started = 0;
    const out = captured();
    const code = await up(
      { dir: f.dir, manifestPath: f.manifestPath, root: f.root, log: out.log },
      {
        readApplied: async () => {
          throw Object.assign(new Error('boom'), { code: 'ECONNREFUSED' });
        },
        run: () => {
          started += 1;
          return 0;
        },
      },
    );
    assert.equal(code, 1);
    assert.equal(started, 0);
    assert.match(out.lines.join('\n'), /history cannot be read \(ECONNREFUSED\)/);
    const done = await runUp(f, NAMES);
    assert.equal(done.code, 0);
    assert.equal(done.started, 0);
    assert.match(done.text, /nothing to apply/);
    const dry = await runUp(f, NAMES.slice(0, 1), { dryRun: true });
    assert.equal(dry.code, 0);
    assert.equal(dry.started, 0);
    assert.match(dry.text, /4 pending/);
  } finally {
    f.cleanup();
  }
});

test('an unreadable or malformed manifest refuses', async () => {
  const f = fixture();
  try {
    const out = captured();
    let started = 0;
    assert.equal(
      await up(
        { dir: f.dir, manifestPath: path.join(f.root, 'absent.json'), root: f.root, log: out.log },
        {
          readApplied: async () => [],
          run: () => {
            started += 1;
            return 0;
          },
        },
      ),
      1,
    );
    writeFileSync(
      f.manifestPath,
      JSON.stringify({
        version: 1,
        files: [
          { name: '0001_foundation.sql', sha256: 'a'.repeat(64) },
          { name: '0003_orders.sql', sha256: 'a'.repeat(64) },
        ],
      }),
    );
    assert.equal(
      await up(
        { dir: f.dir, manifestPath: f.manifestPath, root: f.root, log: out.log },
        {
          readApplied: async () => [],
          run: () => {
            started += 1;
            return 0;
          },
        },
      ),
      1,
    );
    assert.equal(started, 0);
    assert.match(out.lines.join('\n'), /MANIFEST sequence broken at position 2/);
  } finally {
    f.cleanup();
  }
});

test('manifest rules: a clean 0001..N sequence only', () => {
  const ok = (names) =>
    checkManifest({ version: 1, files: names.map((name) => ({ name, sha256: 'b'.repeat(64) })) });
  assert.deepEqual(ok(NAMES), []);
  assert.match(ok([NAMES[0], NAMES[2]])[0], /sequence broken at position 2/);
  assert.match(ok(['0002_a.sql'])[0], /sequence broken at position 1/);
  assert.match(ok(['0001_A.sql'])[0], /invalid name/);
  assert.match(checkManifest({ version: 2, files: [] })[0], /not a version 1 list/);
  assert.match(
    checkManifest({ version: 1, files: [{ name: NAMES[0], sha256: 'xyz' }] })[0],
    /invalid sha256/,
  );
});

test('write pins ADDED migrations only and never re-pins history', () => {
  const f = fixture();
  try {
    assert.equal(write({ dir: f.dir, manifestPath: f.manifestPath, log: quiet }), 0);
    writeFileSync(path.join(f.dir, '0006_new.sql'), 'SELECT 6;\n');
    assert.equal(write({ dir: f.dir, manifestPath: f.manifestPath, log: quiet }), 0);
    assert.equal(JSON.parse(readFileSync(f.manifestPath, 'utf8')).files.length, 6);
    writeFileSync(path.join(f.dir, '0002_accounts.sql'), 'edited\n');
    const out = captured();
    assert.equal(write({ dir: f.dir, manifestPath: f.manifestPath, log: out.log }), 1);
    assert.match(
      out.lines.join('\n'),
      /0002_accounts\.sql has changed; write does not re-pin history/,
    );
    rmSync(path.join(f.dir, '0004_reviews.sql'));
    assert.equal(write({ dir: f.dir, manifestPath: f.manifestPath, log: quiet }), 1);
    assert.throws(() => {
      writeFileSync(path.join(f.dir, 'oops.txt'), 'x');
      buildManifest(f.dir);
    }, /not NNNN_name\.sql/);
  } finally {
    f.cleanup();
  }
});

function git(root, ...args) {
  const r = spawnSync(
    'git',
    [
      '-C',
      root,
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@example.invalid',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

test('source commit: the checkout must be the expected commit and the migrations and manifest must be as committed', () => {
  const f = fixture();
  try {
    mkdirSync(path.join(f.root, 'ops'), { recursive: true });
    const manifestPath = path.join(f.root, 'ops', 'migrations.manifest.json');
    write({ dir: f.dir, manifestPath, log: quiet });
    git(f.root, 'init', '-q');
    git(f.root, 'add', '-A');
    git(f.root, 'commit', '-q', '-m', 'm');
    const head = git(f.root, 'rev-parse', 'HEAD');
    assert.deepEqual(checkSource({ root: f.root, expectedCommit: head }), []);
    assert.deepEqual(checkSource({ root: f.root, expectedCommit: head.slice(0, 9) }), []);
    assert.match(checkSource({ root: f.root, expectedCommit: 'deadbeef' })[0], /HEAD is/);
    assert.match(
      checkSource({ root: f.root, expectedCommit: 'not hex' })[0],
      /must be a hex commit/,
    );
    writeFileSync(path.join(f.dir, '0003_orders.sql'), 'dirty\n');
    assert.match(
      checkSource({ root: f.root, expectedCommit: head }).join('\n'),
      /differ from the commit/,
    );
    git(f.root, 'checkout', '--', 'db');
    writeFileSync(path.join(f.dir, '0099_untracked.sql'), 'u\n');
    assert.match(
      checkSource({ root: f.root, expectedCommit: head }).join('\n'),
      /0099_untracked\.sql/,
    );
    assert.equal(
      checkSource({ root: path.join(f.root, 'nowhere'), expectedCommit: head }).length,
      1,
    );
  } finally {
    f.cleanup();
  }
});

test('up with --expect-commit refuses on a wrong commit before the runner', async () => {
  const f = fixture();
  try {
    mkdirSync(path.join(f.root, 'ops'), { recursive: true });
    const manifestPath = path.join(f.root, 'ops', 'migrations.manifest.json');
    write({ dir: f.dir, manifestPath, log: quiet });
    git(f.root, 'init', '-q');
    git(f.root, 'add', '-A');
    git(f.root, 'commit', '-q', '-m', 'm');
    let started = 0;
    const out = captured();
    const code = await up(
      { dir: f.dir, manifestPath, root: f.root, expectedCommit: 'deadbeef', log: out.log },
      {
        readApplied: async () => [],
        run: () => {
          started += 1;
          return 0;
        },
      },
    );
    assert.equal(code, 1);
    assert.equal(started, 0);
    assert.match(out.lines.join('\n'), /HEAD is/);
  } finally {
    f.cleanup();
  }
});

test('the real repository: the pinned manifest equals db/migrations exactly (a new migration must be pinned in the same change)', () => {
  const manifest = JSON.parse(readFileSync(DEFAULT_MANIFEST, 'utf8'));
  assert.deepEqual(checkManifest(manifest), []);
  assert.deepEqual(
    checkDirectory(DEFAULT_DIR, manifest),
    [],
    'db/migrations differs from ops/migrations.manifest.json: run `node ops/scripts/migration-guard.mjs write` for an ADDED migration; a changed historical migration is never re-pinned',
  );
  assert.ok(manifest.files.length >= 62, 'the migrations 0001..0062 are pinned');
  assert.ok(manifest.files.every((f) => MIGRATION_NAME.test(f.name)));
});
