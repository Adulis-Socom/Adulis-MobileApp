// A migration is applied to a database that has PROVEN it is disposable; any other target needs the approved commit
// and an explicit confirmation naming it. These tests classify targets (aliases, ports, marks), run the authorization
// with injected dependencies, and run the real command line against a tiny local PostgreSQL stand-in. They never connect
// to the persistent development port, and they never start the real migration runner (a recording stand-in stands in for it).
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
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
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { PROTECTED_PORTS } from '../native/lib/protected.mjs';
import { runDeterminism } from './lib/determinism.mjs';
import { DISPOSABLE_MARKER, DISPOSABLE_SETUP_MARKER } from './lib/disposable-db.mjs';
import {
  PERSISTENT_DEV_PORTS,
  REPO_ROOT,
  RUNNER_PATH,
  authorizeApply,
  checkApprovedSource,
  classifyTarget,
  parseArgs,
  parseTarget,
  up,
  write,
} from './migration-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUARD = path.join(ROOT, 'ops', 'scripts', 'migration-guard.mjs');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const SHA = 'a'.repeat(40);
const quiet = () => {};

/** parse + classify a URL the way the command does, with a mark reader that records whether it was asked. */
async function classify(url, { env = {}, marker = null, fail = false } = {}) {
  const t = parseTarget(url, env);
  assert.equal(t.error, undefined, `${url}: ${t.error}`);
  let asked = 0;
  const c = await classifyTarget(t, {
    readMark: async () => {
      asked += 1;
      if (fail) throw Object.assign(new Error('boom'), { code: 'ECONNREFUSED' });
      return marker;
    },
  });
  return { ...c, asked, t };
}

// ---- classification ---------------------------------------------------------------------------------------------

test('every alias of the protected development port is PERSISTENT-DEV by its port alone, and is never asked for a mark', async () => {
  const hosts = [
    'localhost',
    '127.0.0.1',
    '[::1]',
    'LOCALHOST',
    'localhost.',
    '127.1',
    '127.0.0.2',
    '0.0.0.0',
    '2130706433',
    '0x7f000001',
    '[::ffff:127.0.0.1]',
    '192.0.2.10',
    'host.docker.internal',
    'kubernetes.docker.internal',
    'my-machine',
    'db.example',
  ];
  for (const h of hosts) {
    for (const portText of ['5434', '05434']) {
      const r = await classify(`postgres://u:p@${h}:${portText}/adulis`, {
        marker: DISPOSABLE_MARKER,
      });
      assert.equal(r.kind, 'PERSISTENT-DEV', `${h}:${portText}`);
      assert.equal(
        r.asked,
        0,
        `${h}:${portText} must not read a mark (a mark on the protected port is not accepted)`,
      );
    }
  }
  assert.ok(PERSISTENT_DEV_PORTS.has(5434));
  for (const p of PERSISTENT_DEV_PORTS)
    assert.ok(PROTECTED_PORTS.has(p), `${p} is also protected in the native harness`);
});

test('a URL without a port takes PGPORT: PGPORT=5434 is the protected cluster, and no port at all is never disposable', async () => {
  const viaEnv = await classify('postgres://u:p@127.0.0.1/adulis', {
    env: { PGPORT: '5434' },
    marker: DISPOSABLE_MARKER,
  });
  assert.equal(viaEnv.kind, 'PERSISTENT-DEV');
  assert.equal(viaEnv.t.port, 5434);
  assert.equal(viaEnv.asked, 0);
  for (const env of [{}, { PGPORT: '55432' }]) {
    const r = await classify('postgres://u:p@127.0.0.1/adulis', { env, marker: DISPOSABLE_MARKER });
    assert.equal(r.kind, 'UNKNOWN', JSON.stringify(env));
    assert.match(r.why, /no explicit port/);
    assert.equal(r.asked, 0, 'a marked database behind an implicit port is still not accepted');
  }
});

test('a host that is not exactly a loopback name is UNKNOWN even when its port is a disposable one and it would be marked', async () => {
  for (const h of [
    '127.1',
    '127.0.0.2',
    '0.0.0.0',
    'LOCALHOST',
    'localhost.',
    '192.0.2.10',
    'db.example',
    '[::ffff:127.0.0.1]',
    'host.docker.internal',
  ]) {
    const r = await classify(`postgres://u:p@${h}:55432/adulis`, { marker: DISPOSABLE_MARKER });
    assert.equal(r.kind, 'UNKNOWN', h);
    assert.equal(
      r.asked,
      0,
      `${h}: no mark is read through a host that is not a plain loopback name`,
    );
  }
});

test('DISPOSABLE needs a loopback host, an explicit port that is not the protected one, and exactly one of the two marks', async () => {
  for (const h of ['localhost', '127.0.0.1', '[::1]']) {
    const full = await classify(`postgres://u:p@${h}:55432/adulis`, { marker: DISPOSABLE_MARKER });
    assert.equal(full.kind, 'DISPOSABLE', h);
    assert.equal(full.asked, 1);
  }
  assert.equal(
    (await classify('postgres://u:p@127.0.0.1:55432/adulis', { marker: DISPOSABLE_SETUP_MARKER }))
      .kind,
    'DISPOSABLE',
  );
  // anything else read back is a database nobody proved disposable
  for (const marker of [
    null,
    '',
    'adulis:disposable-test-database ',
    'ADULIS:DISPOSABLE-TEST-DATABASE',
    'adulis:disposable-test',
    'production',
    `${DISPOSABLE_MARKER}:other`,
  ]) {
    const r = await classify('postgres://u:p@127.0.0.1:55432/adulis', { marker });
    assert.equal(r.kind, 'PERSISTENT-DEV', JSON.stringify(marker));
  }
  // the compose default port of a developer's own database, unmarked: protected, not disposable
  assert.equal(
    (await classify('postgres://u:p@localhost:5432/adulis', { marker: null })).kind,
    'PERSISTENT-DEV',
  );
  // but CI's database, marked first, is disposable on the same port
  assert.equal(
    (await classify('postgres://u:p@localhost:5432/adulis', { marker: DISPOSABLE_MARKER })).kind,
    'DISPOSABLE',
  );
});

test('a mark that cannot be read is UNKNOWN, never disposable', async () => {
  const r = await classify('postgres://u:p@127.0.0.1:55432/adulis', { fail: true });
  assert.equal(r.kind, 'UNKNOWN');
  assert.match(r.why, /could not be read \(ECONNREFUSED\)/);
});

// ---- the authorization ------------------------------------------------------------------------------------------

/** authorizeApply with every dependency injected; `calls` shows what ran. */
async function authorize(o = {}) {
  const calls = { marks: 0, sources: 0, records: [] };
  const url = o.url ?? 'postgres://u:secretpw@127.0.0.1:55432/adulis';
  const r = await authorizeApply({
    url,
    env: o.env ?? {},
    expectedCommit: o.expectedCommit ?? null,
    confirmTarget: o.confirmTarget ?? null,
    dryRun: o.dryRun ?? false,
    root: ROOT,
    readMark: async () => {
      calls.marks += 1;
      return 'marker' in o ? o.marker : null;
    },
    sourceProblems: () => {
      calls.sources += 1;
      return o.source ?? [];
    },
    record: (...a) => {
      if (o.recordFails) throw Object.assign(new Error('disk'), { code: 'EACCES' });
      calls.records.push(a);
    },
    now: new Date('2026-11-19T00:00:00Z'),
  });
  return { ...r, calls, text: [...r.log, ...(r.refusals ?? [])].join('\n') };
}

test('a disposable target needs neither a commit nor a confirmation, and nothing is recorded', async () => {
  const r = await authorize({ marker: DISPOSABLE_MARKER });
  assert.equal(r.ok, true);
  assert.match(r.text, /classification: DISPOSABLE/);
  assert.equal(r.calls.sources, 0);
  assert.deepEqual(r.calls.records, []);
});

test('a persistent target without the source rule is refused, and the message names the exact command', async () => {
  const r = await authorize({ marker: null });
  assert.equal(r.ok, false);
  assert.match(r.text, /REFUSED: the target 127\.0\.0\.1:55432\/adulis is PERSISTENT-DEV/);
  assert.match(r.text, /--expect-commit <full sha>/);
  assert.match(r.text, /--confirm-target=adulis@127\.0\.0\.1:55432/);
  assert.match(r.text, /pnpm db:migrate:guarded/);
  assert.doesNotMatch(r.text, /secretpw/);
  assert.deepEqual(r.calls.records, [], 'a refusal records nothing');
});

test('a persistent target with the commit but no confirmation, a wrong confirmation, or a bad commit is refused', async () => {
  const noConfirm = await authorize({ expectedCommit: SHA });
  assert.equal(noConfirm.ok, false);
  assert.match(noConfirm.text, /--confirm-target=adulis@127\.0\.0\.1:55432/);
  assert.equal(noConfirm.calls.sources, 1, 'the source was checked');
  const wrong = [
    'adulis@127.0.0.1:55433', // another port
    'adulis@localhost:55432', // another spelling of the host
    'other@127.0.0.1:55432', // another database
    'ADULIS@127.0.0.1:55432',
    '127.0.0.1:55432/adulis',
    ' adulis@127.0.0.1:55432',
    'adulis@127.0.0.1:55432 ',
  ];
  for (const c of wrong) {
    const r = await authorize({ expectedCommit: SHA, confirmTarget: c });
    assert.equal(r.ok, false, c);
    assert.match(
      r.text,
      /--confirm-target names .* but this run would apply to adulis@127\.0\.0\.1:55432/,
      c,
    );
    assert.deepEqual(r.calls.records, []);
  }
  const badSource = await authorize({
    expectedCommit: SHA,
    confirmTarget: 'adulis@127.0.0.1:55432',
    source: ['SOURCE: HEAD is 123456789abc, not the approved aaaaaaaaaaaa'],
  });
  assert.equal(badSource.ok, false);
  assert.match(badSource.text, /SOURCE: HEAD is 123456789abc/);
  assert.deepEqual(badSource.calls.records, []);
});

test('the commit and the confirmation together authorize it, and the authorization is recorded before anything is applied', async () => {
  const r = await authorize({
    expectedCommit: SHA.toUpperCase(),
    confirmTarget: 'adulis@127.0.0.1:55432',
  });
  assert.equal(r.ok, true, r.text);
  assert.equal(r.calls.records.length, 1);
  const [file, action, target, at, extra] = r.calls.records[0];
  assert.match(file, /\.adulis-db-admin\.log$/);
  assert.equal(action, 'db:migrate');
  assert.equal(target, 'adulis@127.0.0.1:55432');
  assert.equal(at.toISOString(), '2026-11-19T00:00:00.000Z');
  assert.deepEqual(extra, { commit: SHA });
  assert.match(r.text, /authorized: adulis@127\.0\.0\.1:55432 at aaaaaaaaaaaa/);
  // a record that cannot be written stops it
  const unrecorded = await authorize({
    expectedCommit: SHA,
    confirmTarget: 'adulis@127.0.0.1:55432',
    recordFails: true,
  });
  assert.equal(unrecorded.ok, false);
  assert.match(
    unrecorded.text,
    /could not record the upgrade in \.adulis-db-admin\.log \(EACCES\); nothing was applied/,
  );
});

test('an UNKNOWN target is held to the same rule as a persistent one, and PGPORT cannot move the confirmation', async () => {
  const unreadable = await authorize({
    url: 'postgres://u:p@db.example:5432/app',
    expectedCommit: SHA,
  });
  assert.equal(unreadable.ok, false);
  assert.match(unreadable.text, /the target db\.example:5432\/app is UNKNOWN/);
  const allowed = await authorize({
    url: 'postgres://u:p@db.example:5432/app',
    expectedCommit: SHA,
    confirmTarget: 'app@db.example:5432',
  });
  assert.equal(allowed.ok, true, allowed.text);
  // a URL with no port: the confirmation must name the port pg will use
  const viaEnv = await authorize({
    url: 'postgres://u:p@db.example/app',
    env: { PGPORT: '6543' },
    expectedCommit: SHA,
    confirmTarget: 'app@db.example:5432',
  });
  assert.equal(viaEnv.ok, false);
  assert.match(viaEnv.text, /would apply to app@db\.example:6543/);
});

test('a dry run is allowed on any target: it names the classification and the command it would need, and records nothing', async () => {
  for (const [url, marker] of [
    ['postgres://u:p@127.0.0.1:55432/adulis', null],
    ['postgres://u:p@127.0.0.1:5434/adulis', DISPOSABLE_MARKER],
    ['postgres://u:p@db.example:5432/app', null],
  ]) {
    const r = await authorize({ url, marker, dryRun: true });
    assert.equal(r.ok, true, url);
    assert.match(r.text, /classification: (PERSISTENT-DEV|UNKNOWN)/);
    assert.match(
      r.text,
      /dry run: applying here would need pnpm db:migrate:guarded --expect-commit/,
    );
    assert.deepEqual(r.calls.records, []);
  }
});

test('an unusable target is refused by the authorization too, and the string is never repeated', async () => {
  for (const url of [
    'postgres://u:secretpw@127.0.0.1:55432/adulis?options=-c%20x',
    'postgres://u:secretpw@127.0.0.1:55432/adulis?port=5434',
    'postgres:/u:secretpw@h/db',
  ]) {
    const r = await authorize({
      url,
      expectedCommit: SHA,
      confirmTarget: 'adulis@127.0.0.1:55432',
    });
    assert.equal(r.ok, false, url);
    assert.match(r.text, /the target is not usable/);
    assert.doesNotMatch(r.text, /secretpw/);
    assert.equal(r.calls.marks, 0);
  }
});

// ---- the source rule for a persistent target -------------------------------------------------------------------

test('the approved source is the full commit, equal to HEAD, with no changed tracked file', () => {
  const short = checkApprovedSource({ root: ROOT, expectedCommit: SHA.slice(0, 12) });
  assert.match(short.join('\n'), /must be the full 40-character commit sha/);
  const notHex = checkApprovedSource({ root: ROOT, expectedCommit: 'g'.repeat(40) });
  assert.match(notHex.join('\n'), /must be the full 40-character commit sha/);
  const wrongHead = checkApprovedSource({ root: ROOT, expectedCommit: SHA });
  assert.match(wrongHead.join('\n'), /SOURCE: HEAD is [0-9a-f]{12}, not the approved aaaaaaaaaaaa/);
  const notGit = checkApprovedSource({ root: tmpdir(), expectedCommit: SHA });
  assert.match(notGit.join('\n'), /SOURCE: cannot read the git HEAD/);
});

test('a temporary repository: the exact HEAD with a clean tree passes; a changed tracked file or any other commit does not', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'migsrc-'));
  const git = (...a) => {
    const r = spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  try {
    git('init', '-q');
    git('config', 'user.email', 't@example.invalid');
    git('config', 'user.name', 't');
    git('config', 'commit.gpgsign', 'false');
    writeFileSync(path.join(dir, 'a.txt'), 'one\n');
    writeFileSync(path.join(dir, 'guard.mjs'), 'export {};\n');
    git('add', '.');
    git('commit', '-q', '-m', 'one');
    const head = git('rev-parse', 'HEAD');
    assert.deepEqual(checkApprovedSource({ root: dir, expectedCommit: head }), []);
    assert.deepEqual(checkApprovedSource({ root: dir, expectedCommit: head.toUpperCase() }), []);
    assert.match(checkApprovedSource({ root: dir, expectedCommit: SHA }).join('\n'), /HEAD is/);
    // an untracked file elsewhere is not a changed tracked file (a .env or a log may exist)
    writeFileSync(path.join(dir, 'untracked.log'), 'x');
    assert.deepEqual(checkApprovedSource({ root: dir, expectedCommit: head }), []);
    // a changed tracked file ANYWHERE, the guard itself included, is not the approved source
    writeFileSync(path.join(dir, 'guard.mjs'), 'export const weaker = true;\n');
    assert.match(
      checkApprovedSource({ root: dir, expectedCommit: head }).join('\n'),
      /uncommitted changes to tracked files[^]*guard\.mjs/,
    );
    git('checkout', '--', 'guard.mjs');
    writeFileSync(path.join(dir, 'a.txt'), 'two\n');
    git('add', 'a.txt'); // staged but not committed
    assert.match(
      checkApprovedSource({ root: dir, expectedCommit: head }).join('\n'),
      /uncommitted changes/,
    );
    git('commit', '-q', '-m', 'two');
    assert.match(
      checkApprovedSource({ root: dir, expectedCommit: head }).join('\n'),
      /HEAD is/,
      'the old commit is no longer HEAD',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- up(): the gate sits between the checks and the runner ------------------------------------------------------

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'migpers-'));
  const dir = path.join(root, 'migrations');
  mkdirSync(dir);
  return {
    root,
    dir,
    manifestPath: path.join(root, 'manifest.json'),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

async function runUp({ applied = ['0001_a'], authorize: gate, dryRun = false } = {}) {
  const f = fixture();
  try {
    writeFileSync(path.join(f.dir, '0001_a.sql'), 'SELECT 1;\n');
    writeFileSync(path.join(f.dir, '0002_b.sql'), 'SELECT 2;\n');
    assert.equal(write({ dir: f.dir, manifestPath: f.manifestPath, log: quiet }), 0);
    let started = 0;
    const out = [];
    const errs = [];
    const gateCalls = [];
    const code = await up(
      {
        dir: f.dir,
        manifestPath: f.manifestPath,
        root: f.root,
        dryRun,
        log: (l) => out.push(l),
        err: (l) => errs.push(l),
      },
      {
        readApplied: async () => applied,
        run: () => ((started += 1), 0),
        authorize: gate && ((o) => (gateCalls.push(o), gate(o))),
      },
    );
    return { code, started, out: out.join('\n'), err: errs.join('\n'), gateCalls };
  } finally {
    f.cleanup();
  }
}

test('up: a refusal by the gate stops the runner and goes to the error stream; an allowance starts it', async () => {
  const refused = await runUp({
    authorize: () => ({
      ok: false,
      log: ['classification: PERSISTENT-DEV (x)'],
      refusals: ['REFUSED: not allowed'],
    }),
  });
  assert.equal(refused.code, 1);
  assert.equal(refused.started, 0, 'the runner must not start');
  assert.match(refused.err, /REFUSED: not allowed/);
  assert.match(refused.out, /classification: PERSISTENT-DEV/);
  assert.doesNotMatch(refused.out, /REFUSED/);
  const allowed = await runUp({
    authorize: () => ({ ok: true, log: ['classification: DISPOSABLE (marked)'] }),
  });
  assert.equal(allowed.code, 0);
  assert.equal(allowed.started, 1);
  assert.deepEqual(allowed.gateCalls, [{ dryRun: false }]);
});

test('up: the gate is not asked when nothing is pending, and a dry run asks it only for the classification', async () => {
  const nothing = await runUp({
    applied: ['0001_a', '0002_b'],
    authorize: () => assert.fail('nothing to apply: no authorization is needed'),
  });
  assert.equal(nothing.code, 0);
  assert.match(nothing.out, /nothing to apply/);
  const dry = await runUp({
    dryRun: true,
    authorize: () => ({
      ok: true,
      log: ['classification: PERSISTENT-DEV (x)', 'dry run: applying here would need y'],
    }),
  });
  assert.equal(dry.code, 0);
  assert.equal(dry.started, 0);
  assert.deepEqual(dry.gateCalls, [{ dryRun: true }]);
  assert.match(
    dry.out,
    /classification: PERSISTENT-DEV[^]*dry run: applying here would need y[^]*dry run: the runner was not started/,
  );
});

test('the command line takes --confirm-target as one name=value argument, once, and only where it means something', () => {
  assert.deepEqual(
    parseArgs(['up', '--expect-commit', SHA, '--confirm-target=adulis@127.0.0.1:5434']).flags,
    {
      '--expect-commit': SHA,
      '--confirm-target': 'adulis@127.0.0.1:5434',
    },
  );
  assert.match(
    parseArgs(['up', '--no-source-check', '--confirm-target=a@b:1', '--confirm-target=a@b:1'])
      .error,
    /--confirm-target is given twice/,
  );
  assert.match(
    parseArgs(['up', '--no-source-check', '--confirm-target=']).error,
    /--confirm-target needs a value/,
  );
  assert.match(
    parseArgs(['up', '--no-source-check', '--confirm-target', 'a@b:1']).error,
    /unknown argument "--confirm-target"/,
  );
  assert.match(parseArgs(['verify', '--confirm-target=a@b:1']).error, /unknown argument/);
  assert.match(parseArgs(['write', '--confirm-target=a@b:1']).error, /unknown argument/);
  assert.equal(
    parseArgs(['authorize', '--expect-commit', SHA, '--confirm-target=a@b:1']).error,
    undefined,
  );
  assert.match(parseArgs(['authorize', '--dry-run']).error, /unknown argument "--dry-run"/);
});

// ---- the real command line against a local stand-in for PostgreSQL ---------------------------------------------

/**
 * A minimal PostgreSQL server (protocol 3, simple queries): answers the guard's two read-only queries and records every
 * statement. It parses each connection's startup parameters (`startups`), answers current_database() with the database
 * the client asked for, and enforces a read-only session the way the real server does: a statement other than a SELECT
 * on a connection whose startup `options` carry default_transaction_read_only=on is refused with code 25006.
 */
function fakePg({ names = [], marker = null, failMark = false }) {
  const seen = [];
  const startups = [];
  const state = { connections: 0 };
  const server = createServer((sock) => {
    state.connections += 1;
    let buf = Buffer.alloc(0);
    let started = false;
    let conn = {};
    const cstr = (s) => Buffer.from(`${s}\0`);
    const send = (type, body = Buffer.alloc(0)) => {
      const head = Buffer.alloc(5);
      head.write(type, 0);
      head.writeInt32BE(body.length + 4, 1);
      sock.write(Buffer.concat([head, body]));
    };
    const ready = () => send('Z', Buffer.from('I'));
    const rowDescription = (cols) => {
      const fields = cols.map((c) => {
        const f = Buffer.concat([cstr(c), Buffer.alloc(18)]);
        f.writeInt32BE(25, c.length + 1 + 6); // type oid: text
        f.writeInt16BE(-1, c.length + 1 + 10);
        return f;
      });
      const count = Buffer.alloc(2);
      count.writeInt16BE(cols.length);
      send('T', Buffer.concat([count, ...fields]));
    };
    const dataRow = (values) => {
      const parts = [Buffer.alloc(2)];
      parts[0].writeInt16BE(values.length);
      for (const v of values) {
        const l = Buffer.alloc(4);
        if (v === null) {
          l.writeInt32BE(-1);
          parts.push(l);
        } else {
          l.writeInt32BE(Buffer.byteLength(v));
          parts.push(l, Buffer.from(v));
        }
      }
      send('D', Buffer.concat(parts));
    };
    const error = (message, code = '0A000') =>
      send(
        'E',
        Buffer.concat([cstr('SERROR'), cstr(`C${code}`), cstr(`M${message}`), Buffer.from([0])]),
      );
    sock.on('error', () => {});
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        if (!started) {
          if (buf.length < 8) return;
          const len = buf.readInt32BE(0);
          if (buf.length < len) return;
          const code = buf.readInt32BE(4);
          const params = buf.subarray(8, len);
          buf = buf.subarray(len);
          if (code === 80877103) {
            sock.write('N'); // no TLS
            continue;
          }
          started = true;
          const kv = params.toString('utf8').split('\0');
          for (let i = 0; i + 1 < kv.length; i += 2) if (kv[i]) conn[kv[i]] = kv[i + 1];
          startups.push(conn);
          send('R', Buffer.from([0, 0, 0, 0]));
          send('S', Buffer.concat([cstr('server_version'), cstr('17.0')]));
          send('K', Buffer.alloc(8));
          ready();
          continue;
        }
        if (buf.length < 5) return;
        const len = buf.readInt32BE(1);
        if (buf.length < len + 1) return;
        const type = String.fromCharCode(buf[0]);
        const body = buf.subarray(5, len + 1);
        buf = buf.subarray(len + 1);
        if (type === 'X') return sock.end();
        if (type === 'P') {
          // extended protocol (a parameterised query): record the text, refuse it, answer the Sync that follows
          seen.push(body.toString('utf8').split('\0')[1] ?? '');
          error('the stand-in answers only the guard queries');
          continue;
        }
        if (type === 'S') {
          ready();
          continue;
        }
        if (type !== 'Q') continue;
        const sql = body.toString('utf8', 0, body.length - 1);
        seen.push(sql);
        if (
          /default_transaction_read_only=on/.test(conn.options ?? '') &&
          !/^\s*SELECT/i.test(sql)
        ) {
          error('cannot execute a write in a read-only transaction', '25006');
          ready();
          continue;
        }
        if (/FROM pgmigrations/.test(sql)) {
          rowDescription(['name']);
          for (const n of names) dataRow([n]);
        } else if (/shobj_description/.test(sql)) {
          if (failMark) {
            error('mark unavailable');
            ready();
            continue;
          }
          rowDescription(['db', 'marker']);
          dataRow([conn.database ?? 'fakedb', marker]);
        } else {
          error('the stand-in answers only the guard queries');
          ready();
          continue;
        }
        send('C', cstr('SELECT'));
        ready();
      }
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        port: server.address().port,
        seen,
        startups,
        state,
        close: () => new Promise((r) => server.close(r)),
      }),
    ),
  );
}

/** The guard's own command line, asynchronously (the stand-in lives in this process, so the child must not block it). */
function guardCli(args, env) {
  return new Promise((resolve) => {
    const base = { ...process.env };
    for (const k of ['DATABASE_URL_MIGRATE', 'PGPORT', 'PGOPTIONS']) delete base[k];
    const child = spawn(process.execPath, [GUARD, ...args], {
      cwd: ROOT,
      env: { ...base, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => child.kill(), 60_000); // a hang fails the test with its output instead of stalling the suite
    child.on('close', (status) => (clearTimeout(timer), resolve({ status, stdout, stderr })));
  });
}

const ALL = JSON.parse(read('ops/migrations.manifest.json')).files.map((f) =>
  f.name.replace(/\.sql$/, ''),
);
/** The only two statements the guard sends. Anything else reaching the database (a runner start) fails a test. */
const GUARD_QUERIES = /FROM pgmigrations|shobj_description/;

async function cli(args, pg, extraEnv = {}) {
  const url = `postgres://someuser:s3cretpw@127.0.0.1:${pg.port}/fakedb`;
  assert.notEqual(pg.port, 5434, 'a test must never reach the persistent development port');
  const r = await guardCli(args, { DATABASE_URL_MIGRATE: url, ...extraEnv });
  assert.doesNotMatch(r.stdout + r.stderr, /s3cretpw|someuser/, 'no credential in any output');
  return r;
}

test('real command line: an unmarked loopback database with pending migrations is refused, nothing is written, the runner never starts', async () => {
  const pg = await fakePg({ names: ALL.slice(0, 3), marker: null });
  try {
    for (const args of [
      ['up', '--no-source-check'],
      ['up', '--expect-commit', SHA],
    ]) {
      const r = await cli(args, pg);
      assert.equal(r.status, 1, args.join(' '));
      assert.match(r.stdout, /^target: 127\.0\.0\.1:\d+\/fakedb$/m);
      if (args.includes('--no-source-check')) {
        assert.match(
          r.stdout,
          /^classification: PERSISTENT-DEV \(it carries no disposable mark\)$/m,
        );
        assert.match(
          r.stderr,
          /REFUSED: the target 127\.0\.0\.1:\d+\/fakedb is PERSISTENT-DEV, not a disposable database; nothing was applied/,
        );
        assert.match(r.stderr, /--expect-commit <full sha>/);
        assert.match(r.stderr, /--confirm-target=fakedb@127\.0\.0\.1:\d+/);
      } else {
        assert.match(r.stderr, /REFUSED:/); // the wrong commit is refused by the ordinary source check first
      }
      assert.doesNotMatch(r.stdout, /nothing to apply/);
    }
    assert.ok(
      pg.seen.every((q) => GUARD_QUERIES.test(q)),
      `only the guard's two reads reached the database: ${pg.seen.join(' | ')}`,
    );
    // a commit that is not HEAD is refused by the ordinary source check first; the comparison of the confirmation itself
    // is reached with the real HEAD in the allow-path test below (temporary checkout)
    const wrong = await cli(
      ['up', '--expect-commit', SHA, '--confirm-target=fakedb@localhost:1'],
      pg,
    );
    assert.equal(wrong.status, 1);
    assert.doesNotMatch(wrong.stdout, /authorized:/);
  } finally {
    await pg.close();
  }
});

test('real command line: a database whose mark cannot be read is UNKNOWN and refused', async () => {
  const pg = await fakePg({ names: ALL.slice(0, 3), failMark: true });
  try {
    const r = await cli(['up', '--no-source-check'], pg);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^classification: UNKNOWN \(the database mark could not be read/m);
    assert.match(r.stderr, /is UNKNOWN, not a disposable database; nothing was applied/);
  } finally {
    await pg.close();
  }
});

test('real command line: a dry run is allowed on every classification, names it, and starts nothing', async () => {
  for (const [marker, kind] of [
    [DISPOSABLE_MARKER, 'DISPOSABLE'],
    [DISPOSABLE_SETUP_MARKER, 'DISPOSABLE'],
    [null, 'PERSISTENT-DEV'],
  ]) {
    const pg = await fakePg({ names: ALL.slice(0, 3), marker });
    try {
      const r = await cli(['up', '--no-source-check', '--dry-run'], pg);
      assert.equal(r.status, 0, `${kind}: ${r.stderr}`);
      assert.match(r.stdout, new RegExp(`^classification: ${kind} `, 'm'));
      assert.match(r.stdout, /dry run: the runner was not started/);
      if (kind !== 'DISPOSABLE')
        assert.match(
          r.stdout,
          /dry run: applying here would need pnpm db:migrate:guarded --expect-commit/,
        );
      assert.ok(pg.seen.every((q) => GUARD_QUERIES.test(q)));
    } finally {
      await pg.close();
    }
  }
});

test('real command line: nothing pending needs no authorization on any target; a URL with options is refused before any connection', async () => {
  const pg = await fakePg({ names: ALL, marker: null });
  try {
    const r = await cli(['up', '--no-source-check'], pg);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /nothing to apply/);
    assert.doesNotMatch(r.stdout + r.stderr, /REFUSED/);
    const before = pg.state.connections;
    const opt = await guardCli(['up', '--no-source-check', '--dry-run'], {
      DATABASE_URL_MIGRATE: `postgres://someuser:s3cretpw@127.0.0.1:${pg.port}/fakedb?options=-c%20default_transaction_read_only%3Doff`,
    });
    assert.equal(opt.status, 1);
    assert.match(opt.stderr, /is not usable \(it sets options/);
    assert.equal(pg.state.connections, before, 'it must not have connected');
  } finally {
    await pg.close();
  }
});

test('real command line: the authorize command refuses without the commit and the confirmation, and never records', async () => {
  const pg = await fakePg({ names: ALL.slice(0, 3), marker: null });
  try {
    const none = await cli(['authorize'], pg);
    assert.equal(none.status, 1);
    assert.match(none.stderr, /REFUSED: the target .* is PERSISTENT-DEV/);
    const disposable = await fakePg({ names: [], marker: DISPOSABLE_MARKER });
    try {
      const ok = await cli(['authorize'], disposable);
      assert.equal(ok.status, 0, ok.stderr);
      assert.match(ok.stdout, /^classification: DISPOSABLE/m);
      assert.match(ok.stdout, /^OK: this run may apply to the target$/m);
    } finally {
      await disposable.close();
    }
  } finally {
    await pg.close();
  }
});

// ---- the callers that must keep working -------------------------------------------------------------------------

test('test-db.sh marks the pair with the setup mark before it migrates, and with the final mark last', () => {
  const lines = read('ops/scripts/test-db.sh').split('\n');
  const at = (re) => lines.findIndex((l) => re.test(l));
  const setup = at(/COMMENT ON DATABASE adulis IS 'adulis:disposable-test-database:setup'/);
  const migrate = at(/pnpm -s db:migrate\b/);
  const final = at(/COMMENT ON DATABASE adulis IS 'adulis:disposable-test-database'"/);
  assert.ok(setup > 0 && migrate > 0 && final > 0, 'all three lines exist');
  assert.ok(setup < migrate, 'the setup mark comes before the migration');
  assert.ok(migrate < final, 'the final mark comes last');
  assert.match(
    lines[setup - 1],
    /docker exec "\$PG" psql -U adulis_bootstrap -d adulis -v ON_ERROR_STOP=1/,
    'it is set inside the container just proven',
  );
  // after the identity proof: the setup mark is only written to the server just started
  assert.ok(at(/is not \$PG \(another server answers there\)/) < setup);
  assert.equal(DISPOSABLE_SETUP_MARKER, 'adulis:disposable-test-database:setup');
  assert.notEqual(
    DISPOSABLE_SETUP_MARKER,
    DISPOSABLE_MARKER,
    'the guards that compare with the final mark do not accept it',
  );
});

test('db:determinism marks each scratch database before it migrates it', async () => {
  const sql = [];
  const events = [];
  const docker = (args) => {
    const text = args.join(' ');
    sql.push(text);
    if (args[0] === 'inspect')
      return {
        status: 0,
        stdout: JSON.stringify([
          {
            Id: 'c0ffee'.repeat(10) + 'beef',
            Name: '/adulis-test-pg',
            State: { Running: true },
            Mounts: [],
            NetworkSettings: {
              Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55432' }] },
            },
          },
        ]),
        stderr: '',
      };
    if (text.includes('pg_control_system'))
      return { status: 0, stdout: `7|${DISPOSABLE_MARKER}\n`, stderr: '' };
    if (text.includes('SELECT datname')) return { status: 0, stdout: '', stderr: '' };
    if (args[2] === 'pg_dump')
      return { status: 0, stdout: 'CREATE TABLE core.x (id uuid);\n', stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  };
  class Client {
    async connect() {}
    async query() {
      return { rows: [{ db: 'adulis', marker: DISPOSABLE_MARKER, system_id: '7' }] };
    }
    async end() {}
  }
  const code = await runDeterminism({
    env: {
      NODE_ENV: 'test',
      ADULIS_PG_CONTAINER: 'adulis-test-pg',
      DATABASE_URL_MIGRATE: 'postgres://adulis_bootstrap:x@127.0.0.1:55432/adulis',
    },
    docker: (a) => {
      const r = docker(a);
      const t = a.join(' ');
      if (/CREATE DATABASE/.test(t)) events.push(`create ${t.match(/adulis_det_[ab]_\w+/)[0]}`);
      if (/COMMENT ON DATABASE/.test(t))
        events.push(
          `mark ${t.match(/adulis_det_[ab]_\w+/)[0]} with ${t.includes(`'${DISPOSABLE_MARKER}'`) ? 'the disposable mark' : 'something else'}`,
        );
      return r;
    },
    migrate: (url) => (
      events.push(`migrate ${new URL(url).pathname.slice(1)}`),
      { status: 0, stdout: '', stderr: '' }
    ),
    Client,
    interrupted: () => null,
    suffix: () => '0a1b2c3d',
    out: quiet,
    err: quiet,
  });
  assert.equal(code, 0);
  for (const d of ['adulis_det_a_0a1b2c3d', 'adulis_det_b_0a1b2c3d']) {
    const order = ['create', 'mark', 'migrate'].map((w) =>
      events.findIndex((e) => e.startsWith(`${w} ${d}`)),
    );
    assert.ok(
      order.every((i) => i >= 0),
      `${d}: ${events.join(' | ')}`,
    );
    assert.ok(order[0] < order[1] && order[1] < order[2], `${d}: create, then mark, then migrate`);
    assert.ok(events.includes(`mark ${d} with the disposable mark`));
  }
});

test('db:reset of a persistent database proves the authorization before it drops anything, and migrates with the same two arguments', () => {
  const src = read('ops/scripts/db-reset.mjs');
  const pre = src.indexOf("'authorize'");
  const firstDrop = src.indexOf('DROP SCHEMA');
  const record = src.indexOf(
    "recordAdminAction(path.join(root, '.adulis-db-admin.log'), 'db:reset'",
  );
  assert.ok(pre > 0 && firstDrop > 0 && record > 0);
  assert.ok(pre < record, 'the preflight comes before the reset is recorded');
  assert.ok(pre < firstDrop, 'the preflight comes before the first drop');
  assert.match(src, /--expect-commit=/);
  assert.match(
    src,
    /if \(approvedSha\) run\('pnpm', \['db:migrate:guarded', '--expect-commit', approvedSha, `--confirm-target=\$\{decision\.target\}`\]\)/,
  );
  assert.match(
    src,
    /else run\('pnpm', \['db:migrate'\]\)/,
    'a disposable database still migrates with the ordinary command',
  );
});

test('the guard document states the rule: proven disposable, or the commit and the named confirmation; the ordinary command refuses the rest', () => {
  const doc = read('docs/infrastructure/MIGRATION-FILE-GUARD.md');
  assert.match(doc, /DISPOSABLE/);
  assert.match(doc, /PERSISTENT-DEV/);
  assert.match(doc, /UNKNOWN/);
  assert.match(doc, /--confirm-target=<database>@<host>:<port>/);
  assert.match(doc, /disposable-test-database:setup/);
  assert.match(doc, /dry run is allowed on every target/i);
  assert.doesNotMatch(
    doc,
    /without a prompt, to whatever/,
    'the old statement that anything is applied at once is gone',
  );
});

test('the administrative log keeps the optional commit beside the target, one JSON line per authorised upgrade', async () => {
  const { recordAdminAction } = await import('./lib/disposable-db.mjs');
  const dir = mkdtempSync(path.join(tmpdir(), 'migrec-'));
  try {
    const file = path.join(dir, '.adulis-db-admin.log');
    recordAdminAction(
      file,
      'db:migrate',
      'adulis@localhost:5434',
      new Date('2026-11-19T00:00:00Z'),
      { commit: SHA },
    );
    recordAdminAction(file, 'db:reset', 'adulis@localhost:5434', new Date('2026-11-19T00:00:01Z'));
    const lines = readFileSync(file, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((l) => JSON.parse(l));
    assert.equal(lines.length, 2);
    assert.deepEqual(
      [lines[0].action, lines[0].target, lines[0].commit, lines[0].at],
      ['db:migrate', 'adulis@localhost:5434', SHA, '2026-11-19T00:00:00.000Z'],
    );
    assert.equal(lines[1].commit, undefined, 'a reset record is unchanged');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- the guard's reads are read-only sessions (checked on what the stand-in received, not on the source) ----------

test('the guard reads the history and the mark in read-only sessions, for the database the URL names', async () => {
  const pg = await fakePg({ names: ALL.slice(0, 3), marker: DISPOSABLE_MARKER });
  try {
    const r = await cli(['up', '--no-source-check', '--dry-run'], pg);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(pg.startups.length, 2, 'one connection for the history, one for the mark');
    for (const s of pg.startups) {
      assert.match(s.options ?? '', /-c default_transaction_read_only=on/, JSON.stringify(s));
      assert.equal(s.database, 'fakedb', 'it connects to the database the URL names');
    }
    assert.ok(
      pg.startups.some((s) => /statement_timeout=30000/.test(s.options)),
      'the history read also has its timeout',
    );
    assert.ok(pg.seen.every((q) => GUARD_QUERIES.test(q)));
    // the stand-in enforces what it was told: a write on such a session is refused (it is not just accepted)
    const { default: pg_ } = await import('pg');
    const c = new pg_.Client({
      connectionString: `postgres://someuser:x@127.0.0.1:${pg.port}/fakedb`,
      options: '-c default_transaction_read_only=on',
    });
    await c.connect();
    await assert.rejects(c.query('CREATE TABLE t (id int)'), (e) => e.code === '25006');
    await c.end();
  } finally {
    await pg.close();
  }
});

// ---- the allow path, and db:reset, through the real scripts in a temporary checkout ------------------------------

/**
 * A temporary checkout: copies of the guard, db-reset and the library, the real migrations and manifest, a junction to
 * the installed `pg`, a recording stand-in for the migration runner (so nothing is ever migrated), and a git repository
 * with everything committed. The scripts resolve their root from their own location, so they act on this tree only,
 * and the administrative log they write is this tree's.
 */
function tempTree() {
  const dir = mkdtempSync(path.join(tmpdir(), 'migtree-'));
  const put = (rel) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    copyFileSync(path.join(ROOT, rel), path.join(dir, rel));
  };
  for (const rel of [
    'ops/scripts/migration-guard.mjs',
    'ops/scripts/db-reset.mjs',
    'ops/migrations.manifest.json',
    'db/init/00-extensions.sql',
  ])
    put(rel);
  cpSync(path.join(ROOT, 'ops', 'scripts', 'lib'), path.join(dir, 'ops', 'scripts', 'lib'), {
    recursive: true,
  });
  cpSync(path.join(ROOT, 'db', 'migrations'), path.join(dir, 'db', 'migrations'), {
    recursive: true,
  });
  // the runner's location in this tree is taken from the guard's own constant, so no path to it is spelled out here
  const stub = path.join(dir, path.relative(REPO_ROOT, RUNNER_PATH));
  mkdirSync(path.dirname(stub), { recursive: true });
  symlinkSync(
    realpathSync(path.join(ROOT, 'node_modules', 'pg')),
    path.join(dir, 'node_modules', 'pg'),
    'junction',
  );
  const started = path.join(dir, 'runner-started.json');
  writeFileSync(
    stub,
    `require('node:fs').writeFileSync(${JSON.stringify(started)}, JSON.stringify(process.argv.slice(2)));\n`,
  );
  writeFileSync(path.join(dir, 'notes.txt'), 'one\n');
  writeFileSync(
    path.join(dir, '.gitignore'),
    'node_modules/\n.adulis-db-admin.log\nrunner-started.json\n',
  );
  const git = (...a) => {
    const r = spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  git('init', '-q');
  git('config', 'user.email', 't@example.invalid');
  git('config', 'user.name', 't');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.autocrlf', 'false');
  git('add', '-A');
  git('commit', '-q', '-m', 'tree');
  return {
    dir,
    git,
    head: git('rev-parse', 'HEAD'),
    started,
    log: path.join(dir, '.adulis-db-admin.log'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** A script of the temporary tree, asynchronously (the stand-in lives in this process). */
function inTree(tree, script, args, env) {
  return new Promise((resolve) => {
    const base = { ...process.env };
    for (const k of ['DATABASE_URL_MIGRATE', 'PGPORT', 'PGOPTIONS', 'NODE_ENV']) delete base[k];
    const child = spawn(
      process.execPath,
      [path.join(tree.dir, 'ops', 'scripts', script), ...args],
      {
        cwd: tree.dir,
        env: { ...base, ...env },
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => child.kill(), 60_000);
    child.on('close', (status) => (clearTimeout(timer), resolve({ status, stdout, stderr })));
  });
}

const urlFor = (pg) => `postgres://someuser:s3cretpw@127.0.0.1:${pg.port}/fakedb`;

test('real command line, allow path: the commit and the exact confirmation authorize, record and start the runner; each missing piece stops it first', async () => {
  const tree = tempTree();
  const pg = await fakePg({ names: ALL.slice(0, 3), marker: null });
  try {
    assert.notEqual(pg.port, 5434);
    const env = { DATABASE_URL_MIGRATE: urlFor(pg) };
    const want = `fakedb@127.0.0.1:${pg.port}`;
    const run = (args) => inTree(tree, 'migration-guard.mjs', ['up', ...args], env);
    const untouched = () => !existsSync(tree.started) && !existsSync(tree.log);
    // the REAL head with a confirmation that names another spelling of the host: it gets past the source check
    // and is stopped by the comparison of the confirmation
    const wrong = await run([
      '--expect-commit',
      tree.head,
      `--confirm-target=fakedb@localhost:${pg.port}`,
    ]);
    assert.equal(wrong.status, 1);
    assert.match(
      wrong.stderr,
      /--confirm-target names fakedb@localhost:\d+, but this run would apply to fakedb@127\.0\.0\.1:\d+/,
    );
    assert.doesNotMatch(wrong.stderr, /SOURCE:/, 'the source check had passed');
    assert.ok(untouched(), 'nothing recorded, no runner');
    // no confirmation at all
    const none = await run(['--expect-commit', tree.head]);
    assert.equal(none.status, 1);
    assert.match(none.stderr, new RegExp(`- --confirm-target=fakedb@127\\.0\\.0\\.1:${pg.port}`));
    assert.ok(untouched());
    // a changed tracked file anywhere (here not even in db/migrations): not the approved commit
    writeFileSync(path.join(tree.dir, 'notes.txt'), 'two\n');
    const dirty = await run(['--expect-commit', tree.head, `--confirm-target=${want}`]);
    assert.equal(dirty.status, 1);
    assert.match(dirty.stderr, /uncommitted changes to tracked files[^]*notes\.txt/);
    assert.ok(untouched());
    tree.git('checkout', '--', 'notes.txt');
    // another commit than HEAD
    const other = await run(['--expect-commit', 'b'.repeat(40), `--confirm-target=${want}`]);
    assert.equal(other.status, 1);
    assert.ok(untouched());
    // the full authorization: recorded, then the runner starts with the guard's own arguments
    const ok = await run(['--expect-commit', tree.head, `--confirm-target=${want}`]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(
      ok.stdout,
      new RegExp(`authorized: fakedb@127\\.0\\.0\\.1:${pg.port} at ${tree.head.slice(0, 12)}`),
    );
    const args = JSON.parse(readFileSync(tree.started, 'utf8'));
    assert.deepEqual(args.slice(0, 2), ['-d', 'DATABASE_URL_MIGRATE']);
    assert.equal(args.at(-1), 'up');
    const lines = readFileSync(tree.log, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((l) => JSON.parse(l));
    assert.equal(lines.length, 1, 'exactly one record, written by the allowed run');
    assert.deepEqual(
      [lines[0].action, lines[0].target, lines[0].commit],
      ['db:migrate', want, tree.head],
    );
    assert.ok(
      pg.seen.every((q) => GUARD_QUERIES.test(q)),
      'the guard itself wrote nothing',
    );
  } finally {
    await pg.close();
    tree.cleanup();
  }
});

test('db:reset proves everything the migration after it will check before it drops anything, for a disposable target too', async () => {
  // 1. a disposable (marked) database, but a migration file that is not pinned: refused before any drop
  const unpinned = tempTree();
  const marked = await fakePg({ names: ALL, marker: DISPOSABLE_MARKER });
  try {
    writeFileSync(path.join(unpinned.dir, 'db', 'migrations', '9999_unpinned.sql'), 'SELECT 1;\n');
    const r = await inTree(unpinned, 'db-reset.mjs', [], {
      DATABASE_URL_MIGRATE: urlFor(marked),
      NODE_ENV: 'test',
    });
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stderr, /UNEXPECTED file in the migrations directory: 9999_unpinned\.sql/);
    assert.match(r.stderr, /FAIL {2}the migration files are not the pinned set/);
    assert.match(r.stderr, /Nothing was dropped\./);
    assert.doesNotMatch(
      r.stdout,
      /marked disposable/,
      'it never got as far as announcing the reset',
    );
    assert.ok(!marked.seen.some((q) => /DROP|CREATE/i.test(q)));
    assert.ok(!existsSync(unpinned.log));
  } finally {
    await marked.close();
    unpinned.cleanup();
  }
  // 2. the same marked database with the pinned set passes the pre-flight and reaches the reset
  const clean = tempTree();
  const pg2 = await fakePg({ names: ALL, marker: DISPOSABLE_MARKER });
  try {
    const r = await inTree(clean, 'db-reset.mjs', [], {
      DATABASE_URL_MIGRATE: urlFor(pg2),
      NODE_ENV: 'test',
    });
    assert.equal(
      r.status,
      1,
      `it stops at the stand-in's refusal of the first reset statement, not by hanging: ${r.stderr}`,
    );
    assert.match(r.stdout, /PASS {2}fakedb is marked disposable/);
    assert.ok(
      !pg2.seen.some((q) => /DROP/i.test(q)),
      'the stand-in refuses the first statement of the reset',
    );
    assert.ok(!existsSync(clean.log), 'a disposable reset records nothing');
  } finally {
    await pg2.close();
    clean.cleanup();
  }
});

test('db:reset of a persistent database: no commit, a wrong commit or a wrong confirmation refuse before the record and the drops; the right ones reach the reset', async () => {
  const tree = tempTree();
  const pg = await fakePg({ names: ALL, marker: null });
  try {
    const want = `fakedb@127.0.0.1:${pg.port}`;
    const env = { DATABASE_URL_MIGRATE: urlFor(pg), NODE_ENV: 'test' };
    const reset = (args) => inTree(tree, 'db-reset.mjs', args, env);
    const noSha = await reset([`--confirm-target=${want}`]);
    assert.equal(noSha.status, 1);
    assert.match(noSha.stderr, /a persistent reset also needs the approved commit/);
    const badSha = await reset([`--confirm-target=${want}`, `--expect-commit=${'0'.repeat(40)}`]);
    assert.equal(badSha.status, 1);
    assert.match(badSha.stderr, /SOURCE: HEAD is [0-9a-f]{12}, not the approved 000000000000/);
    assert.match(badSha.stderr, /Nothing was dropped\./);
    const badTarget = await reset([
      `--confirm-target=fakedb@localhost:${pg.port}`,
      `--expect-commit=${tree.head}`,
    ]);
    assert.equal(badTarget.status, 1, 'the reset decision itself names the mismatch');
    assert.ok(!existsSync(tree.log), 'nothing was recorded by any refusal');
    assert.ok(!pg.seen.some((q) => /DROP|CREATE/i.test(q)));
    const ok = await reset([`--confirm-target=${want}`, `--expect-commit=${tree.head}`]);
    assert.equal(
      ok.status,
      1,
      `it stops at the stand-in's refusal of the first reset statement, not by hanging: ${ok.stderr}`,
    );
    assert.match(ok.stdout, /CONFIRMED {2}resetting the persistent database/);
    assert.ok(
      !pg.seen.some((q) => /DROP/i.test(q)),
      'the stand-in refuses the first statement of the reset',
    );
    const lines = readFileSync(tree.log, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((l) => JSON.parse(l));
    assert.deepEqual([lines[0].action, lines[0].target], ['db:reset', want]);
  } finally {
    await pg.close();
    tree.cleanup();
  }
});

// ---- the protected port is refused by every shared URL rule, not only by the migration guard ----------------------

test('the protected port is refused by the shared URL rules, db:reset and the container check, whatever the database says about itself', async () => {
  const { checkContainerTarget, checkDisposable, checkUrlConfig, resetDecision } =
    await import('./lib/disposable-db.mjs');
  const url = (port, host = 'localhost') => `postgres://u:p@${host}:${port}/adulis`;
  // the URL rules (assert-disposable-db, the gates, console-e2e, determinism all start here)
  for (const host of ['localhost', '127.0.0.1', '[::1]'])
    assert.match(
      checkUrlConfig({
        DATABASE_URL: url(5434, host),
        DATABASE_URL_MIGRATE: url(55432),
      }).problems.join('\n'),
      /DATABASE_URL names port 5434, the persistent development cluster, where no disposable mark is accepted/,
      host,
    );
  assert.equal(
    checkUrlConfig({ DATABASE_URL: url(5433), DATABASE_URL_MIGRATE: url(55432) }).problems.length,
    0,
  );
  // a database that IS marked, on the protected port, is still refused before anything connects
  let connected = 0;
  class Marked {
    async connect() {
      connected += 1;
    }
    async query() {
      return { rows: [{ db: 'adulis', marker: DISPOSABLE_MARKER }] };
    }
    async end() {}
  }
  const refused = await checkDisposable(
    { DATABASE_URL: url(5434), DATABASE_URL_MIGRATE: url(5434) },
    { Client: Marked },
  );
  assert.equal(refused.code, 1);
  assert.match(refused.err.join('\n'), /persistent development cluster/);
  assert.equal(connected, 0, 'no connection was made');
  assert.equal(
    (
      await checkDisposable(
        { DATABASE_URL: url(55432), DATABASE_URL_MIGRATE: url(55432) },
        { Client: Marked },
      )
    ).code,
    0,
  );
  // the determinism container check
  const never = () => assert.fail('docker must not be asked');
  const c = await checkContainerTarget({
    container: 'adulis-test-pg',
    adminUrl: url(5434),
    docker: never,
    Client: Marked,
  });
  assert.equal(c.ok, false);
  assert.match(c.problems.join('\n'), /persistent development cluster/);
  // db:reset: a hand-set mark on the protected port does not make it disposable; the named confirmation still works
  const marked = { db: 'adulis', marker: DISPOSABLE_MARKER };
  const protectedUrl = new URL(url(5434));
  const noFlag = resetDecision({ url: protectedUrl, identity: marked, argv: [] });
  assert.equal(noFlag.allowed, false);
  assert.match(
    noFlag.reason,
    /is on the persistent development port, where a mark is not accepted/,
  );
  assert.match(noFlag.reason, /--confirm-target=adulis@localhost:5434/);
  assert.equal(
    resetDecision({
      url: protectedUrl,
      identity: marked,
      argv: ['--confirm-target=adulis@localhost:5434'],
    }).kind,
    'confirmed',
  );
  assert.equal(
    resetDecision({ url: new URL(url(55432)), identity: marked, argv: [] }).kind,
    'disposable',
  );
  // one definition, shared: the guard re-exports the library's
  assert.equal(
    PERSISTENT_DEV_PORTS,
    (await import('./lib/disposable-db.mjs')).PERSISTENT_DEV_PORTS,
  );
});

// ---- documents that must not contradict the rule ---------------------------------------------------------------

test('the database-scripts table no longer says the migration command needs no disposable target, and the limits are stated honestly', () => {
  const startup = read('docs/infrastructure/MINIO-STARTUP.md');
  assert.doesNotMatch(startup, /so they do not require a disposable target/);
  const row = startup.split('\n').find((l) => /^\| `pnpm db:migrate`/.test(l)) ?? '';
  assert.match(row, /disposable/);
  assert.match(row, /--expect-commit/);
  assert.match(row, /--confirm-target/);
  assert.match(row, /deploy/i);
  assert.match(
    startup,
    /`pnpm worker:install`[^\n]*additive/,
    'the worker installer keeps its own row',
  );
  const guardDoc = read('docs/infrastructure/MIGRATION-FILE-GUARD.md');
  const limits = guardDoc.split('## Limits')[1] ?? '';
  assert.match(
    limits,
    /apps\/api\/test\/db-target\.ts/,
    'the Jest guard keeps its own copy of the rules',
  );
  assert.match(limits, /skip-worktree|assume-unchanged/);
  assert.match(limits, /ignored files/);
  assert.match(limits, /`localhost`[^.]*(resolved|each connection)/);
  assert.match(limits, /SQL files[^.]*after[^.]*(hash|hashed)/);
  assert.doesNotMatch(
    limits,
    /the protected port never accepts a mark\)/,
    'the old sentence read as if the rule were global',
  );
});
