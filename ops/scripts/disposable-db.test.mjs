// WO-INFRA-015A. The guards of the destructive scripts, without a database: the shared target rules
// (lib/disposable-db.mjs), db-determinism's container binding and failure paths (lib/determinism.mjs,
// driven with stub docker and pg), db-reset's confirmation, the scripts refusing when run directly
// against nothing that answers, and the MinIO data-volume guard script. Nothing here can write: the
// stubs record what WOULD have been sent, and the direct runs point at 127.0.0.1 port 1.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DISPOSABLE_MARKER,
  checkDisposable,
  checkUrlConfig,
  recordAdminAction,
  resetDecision,
} from './lib/disposable-db.mjs';
import { runDeterminism } from './lib/determinism.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const SYSID = '7437194283910384711';
const URL_OK = 'postgres://adulis_bootstrap:pw@127.0.0.1:55432/adulis';

/** A pg Client stub answering the identity query with `row`, or failing to connect. */
const clientFor = (row, { connectError } = {}) =>
  class {
    async connect() {
      if (connectError) throw new Error(connectError);
    }
    async query() {
      return { rows: row === null ? [] : [row] };
    }
    async end() {}
  };
const marked = (extra = {}) => clientFor({ db: 'adulis', marker: DISPOSABLE_MARKER, system_id: SYSID, ...extra });

/** A docker stub for one container; records every call. */
function dockerStub({
  name = 'adulis-test-pg',
  running = true,
  mounts = [{ Type: 'volume', Name: 'f'.repeat(64), Destination: '/var/lib/postgresql/data' }],
  ports = { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55432' }] },
  sysid = SYSID,
  marker = DISPOSABLE_MARKER,
  engineDown = false,
  missing = false,
  failDrop = false,
  leftover = [],
} = {}) {
  const calls = [];
  const fn = (args) => {
    calls.push(args);
    if (engineDown) return { status: 1, stdout: '', stderr: 'Cannot connect to the Docker daemon. Is the docker daemon running?' };
    if (args[0] === 'inspect') {
      if (missing) return { status: 1, stdout: '[]', stderr: `Error: No such object: ${args.at(-1)}` };
      return {
        status: 0,
        stdout: JSON.stringify([{ Id: 'c0ffee'.repeat(10) + 'beef', Name: `/${name}`, State: { Running: running }, Mounts: mounts, NetworkSettings: { Ports: ports } }]),
        stderr: '',
      };
    }
    const text = args.join(' ');
    if (text.includes('pg_control_system')) return { status: 0, stdout: `${sysid}|${marker}\n`, stderr: '' };
    if (text.includes('DROP DATABASE') && failDrop) return { status: 1, stdout: '', stderr: 'ERROR: database is being accessed by other users' };
    if (text.includes('SELECT datname')) return { status: 0, stdout: leftover.join('\n'), stderr: '' };
    if (args[2] === 'pg_dump') return { status: 0, stdout: 'CREATE TABLE core.x (id uuid);\n\\restrict abc\n', stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  };
  fn.calls = calls;
  fn.writes = () => calls.filter((a) => /DROP DATABASE|CREATE DATABASE/.test(a.join(' ')));
  return fn;
}

async function determinism({ env = {}, docker = dockerStub(), Client = marked(), interruptAt = null, migrateFails = false } = {}) {
  const out = [];
  const err = [];
  let n = 0;
  const code = await runDeterminism({
    env: { NODE_ENV: 'test', ADULIS_PG_CONTAINER: 'adulis-test-pg', DATABASE_URL_MIGRATE: URL_OK, ...env },
    docker,
    migrate: () => (migrateFails ? { status: 1, stdout: '', stderr: 'migration 0042 failed' } : { status: 0, stdout: '', stderr: '' }),
    Client,
    // interruptAt: the number of step boundaries passed before the signal "arrives"
    interrupted: () => (interruptAt !== null && ++n > interruptAt ? 'SIGINT' : null),
    suffix: (() => {
      let i = 0;
      return () => ['0a1b2c3d', '4e5f6a7b'][i++ % 2];
    })(),
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  return { code, out: out.join('\n'), err: err.join('\n'), docker };
}

// ---------- the shared URL rules ----------

test('configuration refusals: unset, empty, remote, portless, query override, not postgres', () => {
  const p = (env) => checkUrlConfig(env).problems.join('\n');
  assert.match(p({}), /DATABASE_URL is not set: no default is safe/);
  assert.match(p({ DATABASE_URL: '', DATABASE_URL_MIGRATE: URL_OK }), /DATABASE_URL is empty/);
  assert.match(p({ DATABASE_URL: 'postgres://u:p@db.example.com:5432/adulis', DATABASE_URL_MIGRATE: URL_OK }), /not a loopback host/);
  assert.match(p({ DATABASE_URL: 'postgres://u:p@127.0.0.1/adulis', DATABASE_URL_MIGRATE: URL_OK }), /no explicit port/);
  assert.match(p({ DATABASE_URL: `${URL_OK}?host=10.0.0.5`, DATABASE_URL_MIGRATE: URL_OK }), /overrides its target/);
  assert.match(p({ DATABASE_URL: 'mysql://u:p@127.0.0.1:3306/adulis', DATABASE_URL_MIGRATE: URL_OK }), /not a postgres URL/);
  assert.equal(p({ DATABASE_URL: URL_OK, DATABASE_URL_MIGRATE: URL_OK }), ''); // JOBS optional
});

test('every URL must reach a marked database: split targets and failed connections refuse', async () => {
  const env = { DATABASE_URL: URL_OK, DATABASE_URL_MIGRATE: URL_OK, DATABASE_URL_JOBS: URL_OK };
  assert.equal((await checkDisposable(env, { Client: marked() })).code, 0);
  // Split: the first URL reaches an unmarked (persistent) database.
  let calls = 0;
  class Split {
    async connect() {}
    async query() {
      calls += 1;
      return { rows: [calls === 1 ? { db: 'adulis', marker: null } : { db: 'adulis', marker: DISPOSABLE_MARKER }] };
    }
    async end() {}
  }
  const split = await checkDisposable(env, { Client: Split });
  assert.equal(split.code, 1);
  assert.match(split.err.join(), /not marked disposable/);
  const down = await checkDisposable(env, { Client: clientFor(null, { connectError: 'connect ECONNREFUSED 127.0.0.1:55432' }) });
  assert.equal(down.code, 2);
  assert.match(down.err.join(), /could not read the mark/);
  const staging = await checkDisposable({ ...env, DATABASE_URL: 'postgres://u:p@staging.internal:5432/adulis' }, { Client: marked() });
  assert.equal(staging.code, 1);
});

// ---------- db-determinism: the twelve cases of WO-INFRA-015A A5 ----------

test('A5.1 the disposable target: two scratch databases created, compared, dropped, all in that container', async () => {
  const r = await determinism();
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /PASS {2}two clean databases converge/);
  const id = 'c0ffee'.repeat(10) + 'beef';
  const execs = r.docker.calls.filter((a) => a[0] === 'exec');
  assert.ok(execs.length > 0 && execs.every((a) => a[1] === id), 'every exec goes to the verified container ID');
  const w = r.docker.writes().map((a) => a.at(-1));
  for (const d of ['adulis_det_a_0a1b2c3d', 'adulis_det_b_0a1b2c3d']) {
    assert.ok(w.includes(`CREATE DATABASE ${d}`));
    assert.equal(w.filter((s) => s === `DROP DATABASE IF EXISTS ${d} WITH (FORCE)`).length, 2); // before, and in cleanup
  }
});

test('A5.2 no ADULIS_PG_CONTAINER: refused before any docker call, no default', async () => {
  const docker = dockerStub();
  const r = await determinism({ env: { ADULIS_PG_CONTAINER: undefined }, docker });
  assert.equal(r.code, 1);
  assert.match(r.err, /ADULIS_PG_CONTAINER is not set.*no default/s);
  assert.equal(docker.calls.length, 0);
});

test('A5.3 a container name that does not exist: refused, nothing written', async () => {
  const docker = dockerStub({ missing: true });
  const r = await determinism({ env: { ADULIS_PG_CONTAINER: 'adulis-test-pq' }, docker });
  assert.equal(r.code, 1);
  assert.match(r.err, /No such object/);
  assert.equal(docker.writes().length, 0);
});

test('A5.4 the persistent development server: refused by name and by its named volume', async () => {
  for (const opts of [
    { name: 'adulis-postgres' },
    { mounts: [{ Type: 'volume', Name: 'adulis-platform_adulis-pgdata', Destination: '/var/lib/postgresql/data' }] },
  ]) {
    const docker = dockerStub(opts);
    const r = await determinism({ env: { ADULIS_PG_CONTAINER: opts.name ?? 'adulis-test-pg' }, docker });
    assert.equal(r.code, 1);
    assert.match(r.err, /persistent development server|named volume/);
    assert.equal(docker.writes().length, 0);
  }
});

test('A5.5 the URL reaches another server than the container: refused on the system identifier', async () => {
  const docker = dockerStub({ sysid: '1111111111111111111' });
  const r = await determinism({ docker });
  assert.equal(r.code, 1);
  assert.match(r.err, /different server/);
  assert.equal(docker.writes().length, 0);
});

test('A5.6 the container does not publish 5432 on the URL port: refused', async () => {
  const docker = dockerStub({ ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '5434' }] } });
  const r = await determinism({ docker });
  assert.equal(r.code, 1);
  assert.match(r.err, /publishes 5432 on \[5434\], not on 55432/);
  assert.equal(docker.writes().length, 0);
});

test('A5.7 an unmarked database: refused over the URL, and inside the container', async () => {
  const over = await determinism({ Client: marked({ marker: null }) });
  assert.equal(over.code, 1);
  assert.match(over.err, /not marked disposable/);
  const docker = dockerStub({ marker: '' });
  const inside = await determinism({ docker });
  assert.equal(inside.code, 1);
  assert.match(inside.err, /inside adulis-test-pg, database adulis is not marked/);
  assert.equal(docker.writes().length, 0);
});

test('A5.8 the docker engine does not answer: refused as "could not check"', async () => {
  const docker = dockerStub({ engineDown: true });
  const r = await determinism({ docker });
  assert.equal(r.code, 2);
  assert.match(r.err, /Cannot connect to the Docker daemon/);
  const absent = await determinism({ docker: () => ({ error: new Error('spawnSync docker ENOENT') }) });
  assert.equal(absent.code, 2);
  assert.match(absent.err, /could not run docker/);
});

test('A5.9 PostgreSQL does not answer: refused before docker is asked anything', async () => {
  const docker = dockerStub();
  const r = await determinism({ docker, Client: clientFor(null, { connectError: 'connect ECONNREFUSED 127.0.0.1:55432' }) });
  assert.equal(r.code, 2);
  assert.match(r.err, /could not reach PostgreSQL/);
  assert.equal(docker.calls.length, 0);
});

test('A5.10 an interrupt mid-run: stops, still drops both scratch databases, never passes', async () => {
  const r = await determinism({ interruptAt: 1 }); // after the first database is created
  assert.equal(r.code, 130);
  assert.match(r.err, /interrupted by SIGINT: stopped; dropping the scratch databases/);
  assert.doesNotMatch(r.out, /PASS {2}two clean databases/);
  const drops = r.docker.writes().map((a) => a.at(-1)).filter((s) => s.startsWith('DROP'));
  assert.ok(drops.includes('DROP DATABASE IF EXISTS adulis_det_a_0a1b2c3d WITH (FORCE)') && drops.includes('DROP DATABASE IF EXISTS adulis_det_b_0a1b2c3d WITH (FORCE)'));
});

test('A5.10b a child ended by a signal (a real Ctrl+C reaches it) is an interrupt, never a pass', async () => {
  const docker = dockerStub();
  const out = [];
  const err = [];
  const code = await runDeterminism({
    env: { NODE_ENV: 'test', ADULIS_PG_CONTAINER: 'adulis-test-pg', DATABASE_URL_MIGRATE: URL_OK },
    docker,
    migrate: () => ({ status: null, signal: 'SIGINT', stdout: '', stderr: '' }),
    Client: marked(),
    interrupted: () => null,
    suffix: () => '0a1b2c3d',
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  assert.equal(code, 130);
  assert.match(err.join('\n'), /interrupted by SIGINT \(during migrations against adulis_det_a_0a1b2c3d\)/);
  assert.ok(docker.writes().some((a) => a.at(-1) === 'DROP DATABASE IF EXISTS adulis_det_a_0a1b2c3d WITH (FORCE)'));
});

// WO-INFRA-015B review: what a child's end means.
async function determinismWith({ migrate, docker = dockerStub() }) {
  const out = [];
  const err = [];
  const code = await runDeterminism({
    env: { NODE_ENV: 'test', ADULIS_PG_CONTAINER: 'adulis-test-pg', DATABASE_URL_MIGRATE: URL_OK },
    docker,
    migrate,
    Client: marked(),
    interrupted: () => null,
    suffix: () => '0a1b2c3d',
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  return { code, out: out.join('\n'), err: err.join('\n'), docker };
}

test('015B: an output overflow (ENOBUFS, which also sends SIGTERM) is a failure, not an interrupt', async () => {
  const r = await determinismWith({
    migrate: () => ({ status: null, signal: 'SIGTERM', error: new Error('spawnSync node ENOBUFS'), stdout: '', stderr: '' }),
  });
  assert.equal(r.code, 1);
  assert.match(r.err, /migrations against adulis_det_a_0a1b2c3d failed: spawnSync node ENOBUFS/);
  assert.doesNotMatch(r.err, /interrupted/);
});

test('015B: a Windows console Ctrl+C (STATUS_CONTROL_C_EXIT, no signal) is an interrupt', async () => {
  for (const status of [3221225786, -1073741510]) {
    const r = await determinismWith({ migrate: () => ({ status, signal: null, stdout: '', stderr: '' }) });
    assert.equal(r.code, 130, String(status));
    assert.match(r.err, /interrupted by Ctrl\+C \(during migrations against adulis_det_a_0a1b2c3d\)/);
  }
});

test('015B: two schema dumps without a single CREATE TABLE are not a pass', async () => {
  const base = dockerStub();
  const docker = Object.assign(
    (args) => (args[2] === 'pg_dump' ? { status: 0, stdout: 'SET client_encoding = 0;\n', stderr: '' } : base(args)),
    { calls: base.calls, writes: base.writes },
  );
  const r = await determinismWith({ migrate: () => ({ status: 0, stdout: '', stderr: '' }), docker });
  assert.equal(r.code, 1);
  assert.match(r.err, /holds no CREATE TABLE/);
  assert.doesNotMatch(r.out, /converge on an identical schema/);
});

test('A5.4b a data directory bind-mounted from the host is not a disposable server', async () => {
  const docker = dockerStub({
    mounts: [{ Type: 'bind', Source: 'C:\\pgdata', Destination: '/var/lib/postgresql/data' }],
  });
  const r = await determinism({ docker });
  assert.equal(r.code, 1);
  assert.match(r.err, /keeps its data directory on the host/);
  assert.equal(docker.writes().length, 0);
});

test('A5.11 cleanup that fails, or leaves a database behind, fails the run and names it', async () => {
  const r = await determinism({ docker: dockerStub({ failDrop: true }) });
  assert.equal(r.code, 1);
  assert.match(r.err, /cleanup: scratch database\(s\) left on adulis-test-pg: adulis_det_a_0a1b2c3d, adulis_det_b_0a1b2c3d/);
  const left = await determinism({ docker: dockerStub({ leftover: ['adulis_det_b_0a1b2c3d'] }) });
  assert.equal(left.code, 1);
  assert.match(left.err, /left on adulis-test-pg: adulis_det_b_0a1b2c3d/);
  const migr = await determinism({ migrateFails: true });
  assert.equal(migr.code, 1); // a failed migration still cleans up
  assert.match(migr.err, /migrations against adulis_det_a/);
});

test('A5.12 a repeat run succeeds with fresh scratch names and cleans up again', async () => {
  const docker = dockerStub();
  let i = 0;
  const run = () =>
    runDeterminism({
      env: { NODE_ENV: 'test', ADULIS_PG_CONTAINER: 'adulis-test-pg', DATABASE_URL_MIGRATE: URL_OK },
      docker,
      migrate: () => ({ status: 0 }),
      Client: marked(),
      interrupted: () => null,
      suffix: () => ['11111111', '22222222'][i++],
      out: () => {},
      err: () => {},
    });
  assert.equal(await run(), 0);
  assert.equal(await run(), 0);
  const created = docker.writes().map((a) => a.at(-1)).filter((s) => s.startsWith('CREATE'));
  assert.deepEqual(created, [
    'CREATE DATABASE adulis_det_a_11111111',
    'CREATE DATABASE adulis_det_b_11111111',
    'CREATE DATABASE adulis_det_a_22222222',
    'CREATE DATABASE adulis_det_b_22222222',
  ]);
});

test('determinism refuses an environment it cannot name, before anything else', async () => {
  const docker = dockerStub();
  const r = await determinism({ env: { NODE_ENV: 'staging' }, docker });
  assert.equal(r.code, 2);
  assert.equal(docker.calls.length, 0);
});

// ---------- db-reset: disposable, or one persistent database named exactly ----------

test('db-reset: a marked database needs nothing more; a persistent one needs its exact name, per run', () => {
  const url = new URL('postgres://u:p@localhost:5434/adulis');
  assert.deepEqual(resetDecision({ url, identity: { db: 'adulis', marker: DISPOSABLE_MARKER }, argv: [] }), { allowed: true, kind: 'disposable' });
  const none = resetDecision({ url, identity: { db: 'adulis', marker: null }, argv: [] });
  assert.equal(none.allowed, false);
  assert.match(none.reason, /pnpm db:reset -- --confirm-target=adulis@localhost:5434/);
  assert.equal(resetDecision({ url, identity: { db: 'adulis', marker: null }, argv: ['--', '--confirm-target=adulis@localhost:5434'] }).allowed, true);
  assert.match(resetDecision({ url, identity: { db: 'adulis', marker: null }, argv: ['--confirm-target=adulis@localhost:5432'] }).reason, /names adulis@localhost:5432, but this run would reset adulis@localhost:5434/);
  assert.match(resetDecision({ url, identity: { db: 'adulis', marker: null }, argv: ['--confirm-target=adulis@localhost:5434', '--confirm-target=x'] }).reason, /more than one/);
  assert.equal(resetDecision({ url, identity: { db: 'adulis', marker: null }, argv: ['--confirm-target'] }).allowed, false);
});

test('a confirmed reset is recorded as one JSON line before it runs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'adulis-admin-'));
  try {
    const f = join(dir, '.adulis-db-admin.log');
    recordAdminAction(f, 'db:reset', 'adulis@localhost:5434', new Date('2026-11-13T12:00:00Z'));
    const line = JSON.parse(readFileSync(f, 'utf8').trim());
    assert.equal(line.action, 'db:reset');
    assert.equal(line.target, 'adulis@localhost:5434');
    assert.equal(line.at, '2026-11-13T12:00:00.000Z');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- the scripts, run directly, refuse before doing anything ----------

const NOBODY = 'postgres://u:p@127.0.0.1:1/adulis'; // nothing answers on port 1
const runScript = (script, env, args = []) => {
  const base = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !/^(DATABASE_URL|NODE_ENV|ADULIS_|R2_)/.test(k)),
  );
  return spawnSync(process.execPath, [join(root, 'ops/scripts', script), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...base, ...env },
    timeout: 60_000,
  });
};

test('verify-console-e2e run directly: refuses before it builds, resets or seeds anything', () => {
  const unreachable = runScript('verify-console-e2e.mjs', { NODE_ENV: 'test', DATABASE_URL: NOBODY, DATABASE_URL_MIGRATE: NOBODY });
  assert.equal(unreachable.status, 2, unreachable.stderr);
  assert.match(unreachable.stderr, /could not read the mark.*Nothing was built, reset or seeded/s);
  assert.doesNotMatch(unreachable.stdout + unreachable.stderr, /the api build failed|db:reset failed|PASS {2}DATABASE_URL/);
  const remote = runScript('verify-console-e2e.mjs', { NODE_ENV: 'development', DATABASE_URL: 'postgres://u:p@db.example.com:5432/adulis', DATABASE_URL_MIGRATE: NOBODY });
  assert.equal(remote.status, 1);
  assert.match(remote.stderr, /not a loopback host/);
  const unset = runScript('verify-console-e2e.mjs', { NODE_ENV: 'test' });
  assert.equal(unset.status, 1);
  assert.match(unset.stderr, /DATABASE_URL is not set/);
});

test('db-reset run directly: refuses an unreadable target, a split configuration and a foreign environment', () => {
  const unreachable = runScript('db-reset.mjs', { NODE_ENV: 'development', DATABASE_URL_MIGRATE: NOBODY });
  assert.equal(unreachable.status, 2);
  assert.match(unreachable.stderr, /could not read the target database .*nothing was dropped/);
  // A confirmation does not get past an unreadable target, and an environment flag is not one.
  const flagged = runScript('db-reset.mjs', { NODE_ENV: 'development', DATABASE_URL_MIGRATE: NOBODY, ADULIS_CONFIRM_TARGET: 'adulis@127.0.0.1:1' }, ['--confirm-target=adulis@127.0.0.1:1']);
  assert.equal(flagged.status, 2);
  const split = runScript('db-reset.mjs', { NODE_ENV: 'development', DATABASE_URL: NOBODY });
  assert.equal(split.status, 2);
  assert.match(split.stderr, /DATABASE_URL_MIGRATE is not set/);
  const staging = runScript('db-reset.mjs', { NODE_ENV: 'staging', DATABASE_URL_MIGRATE: NOBODY });
  assert.equal(staging.status, 2);
  const remote = runScript('db-reset.mjs', { NODE_ENV: 'development', DATABASE_URL_MIGRATE: 'postgres://u:p@prod.example.com:5432/adulis' });
  assert.equal(remote.status, 2);
  assert.match(remote.stderr, /non-local database/);
  const override = runScript('db-reset.mjs', { NODE_ENV: 'development', DATABASE_URL_MIGRATE: `${NOBODY}?host=prod.example.com` });
  assert.equal(override.status, 2);
  assert.match(override.stderr, /overrides its target/);
});

test('db-determinism run directly without a container: refused before it connects anywhere', () => {
  const r = runScript('db-determinism.mjs', { NODE_ENV: 'test', DATABASE_URL_MIGRATE: NOBODY });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ADULIS_PG_CONTAINER is not set/);
});

test('db:seed run directly against a non-local database: refused', () => {
  const r = runScript('seed.mjs', { NODE_ENV: 'development', DATABASE_URL_MIGRATE: 'postgres://u:p@staging.example.com:5432/adulis' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /refusing to seed a non-local database/);
});

