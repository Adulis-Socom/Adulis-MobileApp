// The target the migration guard names and connects to, and the manifest's append-only rule. No database is touched:
// the commands below either refuse before connecting or fail to connect to a closed port on this machine.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ConnectionParameters from 'pg/lib/connection-parameters';

import {
  ALLOWED_QUERY_KEYS,
  checkAppendOnly,
  checkTarget,
  readBaseManifest,
  resolveTarget,
} from './migration-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUARD = path.join(ROOT, 'ops', 'scripts', 'migration-guard.mjs');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

/** The guard's own command line, with no database variable unless the test gives one. */
function guard(args, env = {}) {
  const base = { ...process.env };
  for (const k of ['DATABASE_URL_MIGRATE', 'PGPORT', 'PGOPTIONS']) delete base[k];
  return spawnSync(process.execPath, [GUARD, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...base, ...env },
  });
}

test('the port named is the one pg uses: the URL port, else PGPORT, else 5432', () => {
  const t = (url, env) => checkTarget(url, env);
  assert.deepEqual(t('postgres://u:p@localhost/app', {}), { target: 'localhost:5432/app' });
  assert.deepEqual(t('postgres://u:p@localhost/app', { PGPORT: '5434' }), {
    target: 'localhost:5434/app',
  });
  assert.deepEqual(t('postgres://u:p@localhost:6000/app', { PGPORT: '5434' }), {
    target: 'localhost:6000/app',
  });
  // an empty PGPORT is no PGPORT (pg treats it as unset)
  assert.deepEqual(t('postgres://u:p@localhost/app', { PGPORT: '' }), {
    target: 'localhost:5432/app',
  });
  for (const bad of ['abc', '0', '70000', '54 34', '5434;x', '-1'])
    assert.match(
      t('postgres://u:p@localhost/app', { PGPORT: bad }).error,
      /not a port number/,
      `PGPORT=${bad}`,
    );
  // a bad PGPORT does not matter when the URL carries its own port
  assert.deepEqual(t('postgres://u:p@localhost:6000/app', { PGPORT: 'abc' }), {
    target: 'localhost:6000/app',
  });
});

test('the named target equals what the installed pg would connect to (host, port, database), for every shape accepted', () => {
  const saved = process.env.PGPORT;
  try {
    const urls = [
      'postgres://u:p@localhost/app',
      'postgres://u:p@127.0.0.1:55432/adulis',
      'postgresql://u:p@db.internal:6543/app_2.test-x?sslmode=require',
      'postgres://u:p@[::1]:5434/adulis',
      'postgres://u:p@dpg-abc123-a/app',
    ];
    for (const pgport of [undefined, '', '5434', '6000']) {
      for (const url of urls) {
        if (pgport === undefined) delete process.env.PGPORT;
        else process.env.PGPORT = pgport;
        const named = checkTarget(url, process.env);
        assert.equal(named.error, undefined, url);
        const cp = new ConnectionParameters(url);
        assert.equal(
          named.target,
          `${cp.host}:${cp.port}/${cp.database}`,
          `${url} PGPORT=${pgport}`,
        );
      }
    }
  } finally {
    if (saved === undefined) delete process.env.PGPORT;
    else process.env.PGPORT = saved;
  }
});

test('resolveTarget prints the effective port on its target line, not 5432, when PGPORT sets it', () => {
  const lines = [];
  const sinks = { log: (l) => lines.push(l), err: (l) => lines.push(`ERR ${l}`) };
  const url = 'postgres://u:secretpw@127.0.0.1/app';
  assert.equal(resolveTarget({ DATABASE_URL_MIGRATE: url, PGPORT: '5434' }, sinks), url);
  assert.deepEqual(lines, ['target: 127.0.0.1:5434/app']);
});

test('the real command line connects where it says: PGPORT decides the port of a URL without one', () => {
  // port 1 is closed on this machine; had the guard used 5432 it would have reached whatever listens there
  const r = guard(['up', '--no-source-check', '--dry-run'], {
    DATABASE_URL_MIGRATE: 'postgres://someuser:s3cretpw@127.0.0.1/portdb',
    PGPORT: '1',
  });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^target: 127\.0\.0\.1:1\/portdb$/m);
  assert.match(r.stderr, /the migration history cannot be read \(ECONNREFUSED\)/);
  assert.doesNotMatch(r.stdout + r.stderr, /s3cretpw|someuser/);
  const bad = guard(['verify', '--db'], {
    DATABASE_URL_MIGRATE: 'postgres://someuser:s3cretpw@127.0.0.1/portdb',
    PGPORT: 'nope',
  });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /is not usable \(the port it names/);
  assert.doesNotMatch(bad.stdout, /^target:/m, 'it must not name, or reach, any target');
});

test('an options query parameter is refused before anything connects, whatever it sets, and nothing echoes the string', () => {
  const urls = [
    'postgres://u:s3cretpw@127.0.0.1:55432/app?options=-c%20default_transaction_read_only%3Doff',
    'postgres://u:s3cretpw@127.0.0.1:55432/app?options=-c%20search_path%3Dother',
    'postgres://u:s3cretpw@127.0.0.1:55432/app?sslmode=disable&options=x',
    'postgresql://u:s3cretpw@localhost/app?options=',
  ];
  for (const url of urls) {
    const r = checkTarget(url, {});
    assert.match(r.error, /sets options as a query option/, url);
    assert.equal(r.target, undefined);
    assert.ok(!/s3cretpw/.test(r.error));
    const cli = guard(['up', '--no-source-check', '--dry-run'], { DATABASE_URL_MIGRATE: url });
    assert.equal(cli.status, 1, url);
    assert.match(cli.stderr, /REFUSED: DATABASE_URL_MIGRATE is not usable \(it sets options/);
    assert.doesNotMatch(cli.stdout, /^target:/m, 'refused before the target line');
    assert.doesNotMatch(cli.stderr, /history cannot be read/, 'it must not have connected');
    assert.doesNotMatch(cli.stdout + cli.stderr, /s3cretpw/);
  }
  // the other query options still work
  assert.deepEqual(checkTarget('postgres://u:p@h:1/app?sslmode=require&application_name=x', {}), {
    target: 'h:1/app',
  });
});

test('a host that is not a plain name or address is refused, so the target line cannot be forged or hide the real host', () => {
  const hosts = ['host%0Atarget', 'ho%73t', 'a%20b', 'x%00y'];
  for (const h of hosts) {
    const r = checkTarget(`postgres://u:p@${h}:5432/app`, {});
    assert.match(r.error, /host is not a plain name or address/, h);
  }
  for (const ok of [
    'localhost',
    '127.0.0.1',
    '[::1]',
    'db.example',
    'dpg-abc123-a',
    'pg_host.internal',
  ])
    assert.ok(checkTarget(`postgres://u:p@${ok}:5432/app`, {}).target, ok);
});

// ---- the manifest only appends --------------------------------------------------------------------------------

const H = (c) => c.repeat(64);
const m = (...files) => ({ version: 1, files: files.map(([name, c]) => ({ name, sha256: H(c) })) });
const BASE = m(['0001_a.sql', 'a'], ['0002_b.sql', 'b']);

test('append-only: an identical or longer manifest passes; a removed, edited, renamed or reordered entry is named', () => {
  assert.deepEqual(checkAppendOnly(BASE, BASE), []);
  assert.deepEqual(
    checkAppendOnly(BASE, m(['0001_a.sql', 'a'], ['0002_b.sql', 'b'], ['0003_c.sql', 'c'])),
    [],
  );
  const cases = {
    'the last entry removed': [
      m(['0001_a.sql', 'a']),
      /REMOVED pinned entry 0002_b\.sql \(position 2\)/,
    ],
    'every entry removed': [m(), /REMOVED pinned entry 0001_a\.sql/],
    'a hash edited': [
      m(['0001_a.sql', 'a'], ['0002_b.sql', 'x']),
      /CHANGED pinned entry 0002_b\.sql/,
    ],
    'the first hash edited, others kept': [
      m(['0001_a.sql', 'z'], ['0002_b.sql', 'b']),
      /CHANGED pinned entry 0001_a\.sql/,
    ],
    'an entry renamed': [
      m(['0001_a.sql', 'a'], ['0002_other.sql', 'b']),
      /RENAMED or reordered pinned entry at position 2: 0002_b\.sql is now 0002_other\.sql/,
    ],
    'two entries swapped': [
      m(['0002_b.sql', 'b'], ['0001_a.sql', 'a']),
      /RENAMED or reordered pinned entry at position 1/,
    ],
  };
  for (const [label, [current, why]] of Object.entries(cases)) {
    const problems = checkAppendOnly(BASE, current);
    assert.ok(problems.length > 0, `${label}: must be refused`);
    assert.match(problems.join('\n'), why, label);
  }
  // a base that has no manifest yet has nothing to compare; a malformed base is refused, never skipped
  assert.deepEqual(checkAppendOnly(null, BASE), []);
  assert.match(
    checkAppendOnly({ version: 2, files: [] }, BASE).join('\n'),
    /^BASE MANIFEST is not a version 1 list/,
  );
  assert.ok(checkAppendOnly(BASE, undefined).length > 0, 'a missing current manifest is refused');
});

function repoWith(manifestAtBase) {
  const dir = mkdtempSync(path.join(tmpdir(), 'migbase-'));
  const git = (...a) => {
    const r = spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  git('init', '-q');
  git('config', 'user.email', 't@example.invalid');
  git('config', 'user.name', 't');
  git('config', 'commit.gpgsign', 'false');
  mkdirSync(path.join(dir, 'ops'));
  writeFileSync(path.join(dir, 'README'), 'x');
  git('add', '.');
  git('commit', '-q', '-m', 'no manifest yet');
  const noManifest = git('rev-parse', 'HEAD');
  writeFileSync(path.join(dir, 'ops', 'migrations.manifest.json'), manifestAtBase);
  git('add', '.');
  git('commit', '-q', '-m', 'manifest');
  return {
    dir,
    git,
    noManifest,
    withManifest: git('rev-parse', 'HEAD'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test('the base manifest is read from git by commit, and a ref that is not a plain commit is refused without running git', () => {
  const r = repoWith(JSON.stringify(BASE));
  try {
    assert.deepEqual(readBaseManifest(r.dir, r.withManifest).manifest, BASE);
    assert.deepEqual(readBaseManifest(r.dir, 'HEAD').manifest, BASE);
    assert.deepEqual(
      readBaseManifest(r.dir, r.noManifest),
      { manifest: null },
      'no manifest at that commit yet',
    );
    for (const bad of ['--help', '-x', 'a b', 'HEAD;ls', '', '$(id)', 'x\ny'])
      assert.match(
        readBaseManifest(r.dir, bad).problems.join('\n'),
        /is not a plain git ref/,
        JSON.stringify(bad),
      );
    assert.match(
      readBaseManifest(r.dir, 'origin/nowhere').problems.join('\n'),
      /BASE origin\/nowhere is not a commit in this clone/,
    );
    // a working-tree edit is invisible: the base is what was committed
    writeFileSync(
      path.join(r.dir, 'ops', 'migrations.manifest.json'),
      JSON.stringify(m(['0001_a.sql', 'q'])),
    );
    assert.deepEqual(readBaseManifest(r.dir, 'HEAD').manifest, BASE);
  } finally {
    r.cleanup();
  }
  const broken = repoWith('{not json');
  try {
    assert.match(
      readBaseManifest(broken.dir, 'HEAD').problems.join('\n'),
      /the committed manifest is not JSON/,
    );
  } finally {
    broken.cleanup();
  }
});

test('verify --base through the command line: bad ref refused before git, a missing value refused, the repository is append-only against its own HEAD', () => {
  const bad = guard(['verify', '--base', 'a b']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /BASE "a b" is not a plain git ref/);
  const none = guard(['verify', '--base']);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /--base needs a value/);
  const twice = guard(['verify', '--base', 'HEAD', '--base', 'HEAD']);
  assert.equal(twice.status, 2);
  assert.match(twice.stderr, /--base is given twice/);
  if (!existsSync(path.join(ROOT, '.git'))) return; // an unpacked tree has no history to compare with
  const ok = guard(['verify', '--base', 'HEAD']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^OK: \d+ pinned migrations match; append-only against HEAD$/m);
});

test('CI checks the append-only rule on every push and pull request, with the base passed through the environment', () => {
  const ci = read('.github/workflows/ci.yml');
  const step = ci
    .split('\n      - name: ')
    .find((s) => s.startsWith('The migration manifest only appends'));
  assert.ok(step, 'the CI step exists');
  const header = step.split('run:')[0];
  assert.doesNotMatch(header, /^\s+if:/m, 'no condition: both same-named runs carry the step');
  assert.match(header, /EVENT_NAME: \$\{\{ github\.event_name \}\}/);
  assert.match(header, /BASE_REF: \$\{\{ github\.base_ref \}\}/);
  const script = step.split('run: |')[1] ?? '';
  assert.match(script, /if \[ "\$EVENT_NAME" = pull_request \]; then\s+BASE="origin\/\$BASE_REF"/);
  assert.match(script, /else\s+BASE="\$\(git merge-base origin\/dev HEAD\)"/);
  assert.match(script, /node ops\/scripts\/migration-guard\.mjs verify --base "\$BASE"/);
  assert.doesNotMatch(script, /\$\{\{/, 'no expression inside the script text');
});

test('the guard document describes the base check, the effective port and the refused options', () => {
  const doc = read('docs/infrastructure/MIGRATION-FILE-GUARD.md');
  assert.match(doc, /pnpm db:migration-guard --base <ref>|db:migration-guard -- --base/);
  assert.match(doc, /PGPORT/);
  assert.match(doc, /`options`/);
});

test('only the query keys on the allow-list are accepted; a key the driver or a later consumer reads as configuration is refused whatever its value', () => {
  for (const key of ALLOWED_QUERY_KEYS)
    assert.ok(checkTarget(`postgres://u:p@h:1/app?${key}=x`, {}).target, key);
  assert.ok(
    checkTarget('postgres://u:p@h:1/app?sslmode=require&application_name=x&connect_timeout=5', {})
      .target,
  );
  const refused = [
    'connectionString',
    'user',
    'password',
    'statement_timeout',
    'search_path',
    'client_encoding',
    'sslcert',
    'sslkey',
    'sslrootcert',
    'replication',
    'binary',
    'fallback_application_name',
    'lock_timeout',
    'target_session_attrs',
    'Host',
    'PORT',
    'x',
  ];
  for (const key of refused) {
    const r = checkTarget(`postgres://u:s3cretpw@h:1/app?${key}=y`, {});
    assert.match(r.error, /as a query option; only sslmode/, key);
    assert.equal(r.target, undefined);
    assert.ok(!r.error.includes('s3cretpw'), 'the reason never repeats the string');
  }
  // a nested connection string would re-target a consumer that parses the raw string
  const nested =
    'postgres://u:p@localhost:55432/adulis?connectionString=postgres%3A%2F%2Fh%3A5434%2Fdb';
  assert.match(checkTarget(nested, {}).error, /sets connectionString as a query option/);
  // one refused key among accepted ones refuses the whole URL
  assert.match(
    checkTarget('postgres://u:p@h:1/app?sslmode=require&user=x', {}).error,
    /sets user as a query option/,
  );
  // through the real command line: refused before any connection, nothing echoed
  const cli = guard(['up', '--no-source-check', '--dry-run'], {
    DATABASE_URL_MIGRATE: `postgres://u:s3cretpw@127.0.0.1:55432/app?connectionString=x`,
  });
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /is not usable \(it sets connectionString as a query option/);
  assert.doesNotMatch(cli.stdout, /^target:/m);
  assert.doesNotMatch(cli.stdout + cli.stderr, /s3cretpw|history cannot be read/);
});

test('a control or whitespace character anywhere in the string is refused, including the ones the URL parser silently drops', () => {
  const base = 'postgres://u:s3cretpw@127.0.0.1:55432/app';
  assert.ok(checkTarget(base, {}).target, 'the plain string is accepted');
  // the parser strips these and would accept what is left; the driver would not
  const stripped = {
    tab: base.replace('127', '1\t27'),
    newline: `${base}\n`,
    'carriage return': `${base}\r`,
    'trailing space': `${base} `,
    'leading space': ` ${base}`,
    'tab in the query': `${base}?sslmode=\trequire`,
  };
  for (const [label, url] of Object.entries(stripped)) {
    const r = checkTarget(url, {});
    assert.match(r.error, /control or whitespace character/, label);
    assert.equal(r.target, undefined, label);
    assert.ok(!r.error.includes('s3cretpw'));
  }
  // the rest are refused by one rule or another; none yields a target
  const others = {
    nul: `${base}\0`,
    delete: `${base}\x7f`,
    'newline in the path': 'postgres://u:s3cretpw@127.0.0.1:55432/a\npp',
    'space in the host': 'postgres://u:s3cretpw@127.0.0.1 :55432/app',
  };
  for (const [label, url] of Object.entries(others)) {
    const r = checkTarget(url, {});
    assert.ok(r.error, label);
    assert.equal(r.target, undefined, label);
  }
  const cli = guard(['up', '--no-source-check', '--dry-run'], {
    DATABASE_URL_MIGRATE: `${base}\n`,
  });
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /is not usable \(it contains a control or whitespace character/);
  assert.doesNotMatch(cli.stdout, /^target:/m);
});

test('a git failure while reading the base is a refusal, never "no manifest yet"', () => {
  const ok = (out = '') => ({ status: 0, out, err: '' });
  const failed = (status, err = 'fatal: x') => ({ status, out: '', err });
  const MANIFEST = 'ops/migrations.manifest.json';
  /** git answering rev-parse, ls-tree and show as given. */
  const git =
    (listed, shown = ok(JSON.stringify(BASE))) =>
    (_root, args) =>
      args[0] === 'rev-parse' ? ok('abc') : args[0] === 'ls-tree' ? listed : shown;
  const readWith = (g) => readBaseManifest('/unused', 'origin/dev', MANIFEST, g);
  // the only way to "no manifest yet": git listed the tree fine and the path is not in it
  assert.deepEqual(readWith(git(ok(''))), { manifest: null });
  assert.deepEqual(readWith(git(ok(MANIFEST))).manifest, BASE);
  // every failure of the listing refuses, whatever the status (128 fatal, 1, 255, git not starting)
  for (const status of [128, 1, 255, null])
    assert.match(
      readWith(git(failed(status))).problems.join('\n'),
      /git could not read the committed tree/,
      `status ${status}`,
    );
  assert.match(readWith(git(ok('some/other/path'))).problems.join('\n'), /unexpected entry/);
  assert.match(
    readWith(git(ok(MANIFEST), failed(128))).problems.join('\n'),
    /git could not read the committed manifest/,
  );
  assert.match(
    readWith(git(ok(MANIFEST), failed(null, ''))).problems.join('\n'),
    /git could not read the committed manifest/,
  );
  assert.match(
    readWith(git(ok(MANIFEST), ok('{not json'))).problems.join('\n'),
    /the committed manifest is not JSON/,
  );
});

test('a damaged repository: a commit whose tree object is gone refuses instead of reading as an empty base', () => {
  const r = repoWith(JSON.stringify(BASE));
  try {
    assert.deepEqual(readBaseManifest(r.dir, 'HEAD').manifest, BASE);
    const tree = r.git('rev-parse', 'HEAD^{tree}');
    rmSync(path.join(r.dir, '.git', 'objects', tree.slice(0, 2), tree.slice(2)), { force: true });
    const damaged = readBaseManifest(r.dir, 'HEAD');
    assert.equal(damaged.manifest, undefined, 'it must not claim an empty base');
    assert.match(damaged.problems.join('\n'), /git could not read the committed tree/);
  } finally {
    r.cleanup();
  }
});
