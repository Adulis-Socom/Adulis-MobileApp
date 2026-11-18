// The harness as a whole: what `up` would create, fixtures behind the identity guard, preflight, the
// command line's exit codes and status lines, and rules about the harness source itself.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SETS, canaryDeviceId, guardSql, loadSet } from '../fixtures/index.mjs';
import { main, MIN_FREE, preflightProblems, STATUS } from '../harness.mjs';
import { readManifest, runDir, writeManifest } from '../lib/manifest.mjs';
import { LABEL, OWNER, PORT_BLOCK, PROTECTED_PORTS } from '../lib/protected.mjs';
import { dockerSteps, pickPorts } from '../lib/stack.mjs';
import { id64, makeIo, refusal, world } from './fakes.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/* ---- what `up` creates ---- */

test('every resource `up` creates carries the owner, run and role labels and a name with the run prefix', () => {
  const m = world().m;
  const steps = dockerSteps(m, {
    pg: 'pgvector/pgvector:pg17',
    minio: 'cgr.dev/chainguard/minio@sha256:x',
  });
  for (const [k, args] of Object.entries(steps)) {
    const joined = args.join(' ');
    assert.ok(joined.includes(`${LABEL.owner}=${OWNER}`), k);
    assert.ok(joined.includes(`${LABEL.run}=${m.run}`), k);
    assert.ok(joined.includes(`${LABEL.role}=`), k);
  }
  for (const k of ['network', 'pgVolume', 'minioVolume', 'postgres', 'minio'])
    assert.ok(
      steps[k].some((a) => a.startsWith(`adulis-native-${m.run8}-`)),
      k,
    );
});

test('the containers publish on 127.0.0.1 only, use one named run volume, join the run network, and are never --rm', () => {
  const m = world().m;
  const steps = dockerSteps(m, { pg: 'pgvector/pgvector:pg17', minio: 'img' });
  for (const k of ['postgres', 'minio']) {
    const a = steps[k];
    assert.ok(
      !a.includes('--rm') &&
        !a.includes('--privileged') &&
        !a.includes('--volumes-from') &&
        !a.includes('--network=host'),
    );
    assert.equal(a.filter((x) => x === '-p').length, 1);
    assert.match(a[a.indexOf('-p') + 1], /^127\.0\.0\.1:\d+:\d+$/);
    const vols = a.filter((x, i) => a[i - 1] === '-v');
    assert.equal(vols.length, 1);
    assert.match(vols[0], new RegExp(`^adulis-native-${m.run8}-[a-z]+data:/`));
    assert.equal(a[a.indexOf('--network') + 1], m.names.network);
  }
  assert.equal(
    steps.postgres.find((x) => x.startsWith('POSTGRES_DB=')),
    `POSTGRES_DB=adulis_native_${m.run8}`,
  );
});

test('ports come from the reserved block, are distinct, and are never a protected port', async () => {
  for (let i = 0; i < 60; i += 1) {
    const p = await pickPorts(async () => true);
    const all = Object.values(p);
    assert.equal(new Set(all).size, 3);
    for (const x of all)
      assert.ok(
        x >= PORT_BLOCK.from && x <= PORT_BLOCK.to && !PROTECTED_PORTS.has(x) && x !== 8081,
      );
  }
  await assert.rejects(
    pickPorts(async () => false),
    /free ports/,
  );
});

/* ---- fixtures ---- */

test('fixture SQL runs behind the identity guard in one transaction, through the container by full id', async () => {
  const w = world();
  const dir = mkdtempSync(join(tmpdir(), 'native-fx-'));
  try {
    const io = makeIo(w);
    const next = await loadSet(w.m, io, 'baseline', { dir });
    assert.deepEqual(next.fixtures, ['baseline']);
    const sql = w.pg.executed;
    assert.ok(
      sql.indexOf('native run identity mismatch') < sql.indexOf('INSERT INTO'),
      'the guard must come first',
    );
    assert.ok(
      sql.includes(w.m.db.systemId) &&
        sql.includes(w.m.db.name) &&
        sql.includes(`${w.m.run}:${w.m.nonce}`),
    );
    const exec = w.d.mutations.find((x) => x.startsWith('exec'));
    assert.ok(exec.includes(w.m.containers.postgres.id) && exec.includes('--single-transaction'));
    assert.ok(!exec.includes(w.m.names.pg), 'addressed by name');
    assert.deepEqual(readManifest(dir).fixtures, ['baseline']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a fixture load is refused, writing nothing, when any identity check fails', async () => {
  const edits = [
    ['ID-01', (w) => (w.pg.tcp = w.pg.tcp.replace(w.m.db.systemId, '1'))],
    ['ID-03', (w) => (w.pg.inside = w.pg.inside.replace(/\|[^|]*$/, '|'))],
    [
      'ID-08',
      (w) =>
        w.d.containers[w.m.containers.postgres.id].Mounts.push({
          Type: 'bind',
          Source: '/x',
          Destination: '/y',
        }),
    ],
    ['ID-09', (w) => ([w.m.ports.pg] = [...PROTECTED_PORTS])],
  ];
  for (const [id, edit] of edits) {
    const w = world();
    edit(w);
    await refusal(assert, loadSet(w.m, makeIo(w), 'baseline', { dir: tmpdir() }), id);
    assert.deepEqual(w.d.mutations, []);
    assert.equal(w.pg.executed, undefined);
  }
});

test('a set cannot be loaded twice, a conflicting set is refused, and an unknown set is refused', async () => {
  const w = world();
  w.m.fixtures = ['baseline'];
  await assert.rejects(loadSet(w.m, makeIo(w), 'baseline', { dir: tmpdir() }), /already loaded/);
  await assert.rejects(loadSet(w.m, makeIo(w), 'nope', { dir: tmpdir() }), /unknown fixture set/);
  for (const key of ['constructor', '__proto__', 'toString'])
    await assert.rejects(
      loadSet(w.m, makeIo(w), key, { dir: tmpdir() }),
      /unknown fixture set/,
      key,
    );
  SETS.other = { conflicts: ['baseline'], sql: () => '' };
  try {
    await assert.rejects(
      loadSet(w.m, makeIo(w), 'other', { dir: tmpdir() }),
      /cannot share a stack/,
    );
  } finally {
    delete SETS.other;
  }
  assert.deepEqual(w.d.mutations, []);
});

test('fixture data is synthetic: no real-looking contact data, ids derived from the run', () => {
  const w = world();
  const sql = SETS.baseline.sql(w.m);
  assert.doesNotMatch(sql, /@/);
  assert.match(sql, /\+251900000/);
  assert.notEqual(canaryDeviceId(w.m), canaryDeviceId(world().m));
  assert.match(guardSql(w.m), /RAISE EXCEPTION/);
});

/* ---- preflight ---- */

const okDocker = (names = '') => ({
  docker: async () => ({ status: 0, stdout: names, stderr: '', error: null }),
});

test('preflight blocks on low memory, low disk, another test pair, an uncleaned run, and an unreachable docker', async () => {
  const root = mkdtempSync(join(tmpdir(), 'native-pre-'));
  const GB = 1024 ** 3;
  try {
    assert.deepEqual(
      await preflightProblems(okDocker(), { root, freeBytes: 4 * GB, diskBytes: 50 * GB }),
      [],
    );
    assert.match(
      (
        await preflightProblems(okDocker(), { root, freeBytes: 0.5 * GB, diskBytes: 50 * GB })
      ).join(),
      /free memory/,
    );
    assert.match(
      (
        await preflightProblems(okDocker(), {
          root,
          profile: 'device',
          freeBytes: 4 * GB,
          diskBytes: 50 * GB,
        })
      ).join(),
      /free memory/,
    );
    assert.ok(MIN_FREE.device > MIN_FREE.stack);
    assert.match(
      (await preflightProblems(okDocker(), { root, freeBytes: 4 * GB, diskBytes: 1 * GB })).join(),
      /free space/,
    );
    assert.match(
      (
        await preflightProblems(okDocker('adulis-test-pg\nother\n'), {
          root,
          freeBytes: 4 * GB,
          diskBytes: 50 * GB,
        })
      ).join(),
      /one Docker-heavy job/,
    );
    assert.match(
      (
        await preflightProblems(okDocker('adulis-native-0a1b2c3d-pg\n'), {
          root,
          freeBytes: 4 * GB,
          diskBytes: 50 * GB,
        })
      ).join(),
      /one Docker-heavy job/,
    );
    assert.match(
      (
        await preflightProblems(
          { docker: async () => ({ status: 1, stdout: '', stderr: 'x', error: null }) },
          { root, freeBytes: 4 * GB, diskBytes: 50 * GB },
        )
      ).join(),
      /not reachable/,
    );
    const w = world();
    writeManifest(runDir(root, w.m.run), w.m);
    assert.match(
      (await preflightProblems(okDocker(), { root, freeBytes: 4 * GB, diskBytes: 50 * GB })).join(),
      /down --run/,
    );
    mkdirSync(join(root, 'runs', 'stray'), { recursive: true });
    assert.match(
      (await preflightProblems(okDocker(), { root, freeBytes: 4 * GB, diskBytes: 50 * GB })).join(),
      /no readable manifest/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/* ---- the command line ---- */

function cli(world_, extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'native-cli-'));
  const w = world_ ?? world();
  writeManifest(runDir(root, w.m.run), w.m);
  const io = { ...makeIo(w), ...extra };
  const lines = [];
  const run = (...argv) =>
    main(argv, { io, env: { ADULIS_NATIVE_ROOT: root }, out: (s) => lines.push(s) });
  return { root, w, io, lines, run, done: () => rmSync(root, { recursive: true, force: true }) };
}

test('verify on a consistent run exits 0 and names what it verified', async () => {
  const c = cli();
  try {
    assert.equal(await c.run('verify', '--run', c.w.m.run), 0);
    assert.equal(c.lines.at(-1), STATUS.READY_STACK);
    assert.equal(
      STATUS.READY_STACK,
      'HARNESS READY - STACK VERIFIED - NATIVE EXECUTION NOT PERFORMED',
    );
  } finally {
    c.done();
  }
});

test('verify on a run that names a protected port exits 1 before connecting, with a REFUSED line', async () => {
  const w = world();
  [w.m.ports.pg] = [...PROTECTED_PORTS];
  const c = cli(w);
  try {
    assert.equal(await c.run('verify', '--run', w.m.run), 1);
    assert.match(c.lines.at(-1), /^HARNESS REFUSED - ID-09 .* - NO RESOURCE WAS CHANGED$/);
    assert.deepEqual(c.io.calls, []);
  } finally {
    c.done();
  }
});

test('a check that could not be made exits 2, and the refusal is recorded as evidence', async () => {
  const w = world();
  w.pg.tcpFails = true;
  const c = cli(w);
  try {
    assert.equal(await c.run('verify', '--run', w.m.run), 2);
    assert.match(c.lines.at(-1), /could not be checked/);
    const refusal_ = JSON.parse(
      readFileSync(join(runDir(c.root, w.m.run), 'refusal.json'), 'utf8'),
    );
    assert.ok(refusal_.results.some((r) => r.verdict === 'UNKNOWN'));
  } finally {
    c.done();
  }
});

test('usage errors exit 2: no root, no run, unknown command', async () => {
  const c = cli();
  try {
    const lines = [];
    assert.equal(
      await main(['verify', '--run', c.w.m.run], { io: c.io, env: {}, out: (s) => lines.push(s) }),
      2,
    );
    assert.equal(await c.run('verify'), 2);
    assert.equal(await c.run('verify', '--run', 'native-20200101-00000000'), 2);
    assert.equal(await c.run('frobnicate'), 2);
    assert.equal(await c.run('api', 'start', '--run', c.w.m.run), 2);
    assert.equal(await c.run('verify', '--override', '--run', c.w.m.run), 2); // there is no override flag
  } finally {
    c.done();
  }
});

test("down removes a run's own resources, ends cleaned, and the second down is a no-op", async () => {
  const c = cli();
  try {
    assert.equal(await c.run('down', '--run', c.w.m.run), 0);
    assert.equal(readManifest(runDir(c.root, c.w.m.run)).state, 'cleaned');
    assert.equal(c.w.d.mutations.length, 5);
    const before = c.w.d.mutations.length;
    assert.equal(await c.run('down', '--run', c.w.m.run), 0);
    assert.equal(c.w.d.mutations.length, before);
  } finally {
    c.done();
  }
});

test('down refuses when any resource lacks ownership proof: exit 1, nothing removed, state unchanged', async () => {
  const w = world();
  delete w.d.volumes[w.m.names.minioVolume].Labels[LABEL.run];
  const c = cli(w);
  try {
    assert.equal(await c.run('down', '--run', w.m.run), 1);
    assert.match(c.lines.at(-1), /^HARNESS REFUSED/);
    assert.deepEqual(w.d.mutations, []);
    assert.equal(readManifest(runDir(c.root, w.m.run)).state, 'ready');
  } finally {
    c.done();
  }
});

test('down that cannot list is exit 2 with nothing removed; down whose removal fails is exit 3 and registered', async () => {
  const a = world();
  a.d.listFails.containers = true;
  const ca = cli(a);
  try {
    assert.equal(await ca.run('down', '--run', a.m.run), 2);
    assert.deepEqual(
      a.d.mutations.filter((x) => /^(rm|volume rm|network rm)/.test(x)),
      [],
    );
  } finally {
    ca.done();
  }
  const b = world();
  b.d.rmFails = true;
  const cb = cli(b);
  try {
    assert.equal(await cb.run('down', '--run', b.m.run), 3);
    assert.match(cb.lines.at(-1), /^HARNESS CLEANUP INCOMPLETE - \d+ RESOURCES LEFT, REGISTERED$/);
    assert.equal(readManifest(runDir(cb.root, b.m.run)).state, 'cleanup-incomplete');
  } finally {
    cb.done();
  }
});

test('fixtures through the command line load the baseline and record it', async () => {
  const c = cli();
  try {
    assert.equal(await c.run('fixtures', '--run', c.w.m.run, '--set', 'baseline'), 0);
    assert.deepEqual(readManifest(runDir(c.root, c.w.m.run)).fixtures, ['baseline']);
    assert.equal(await c.run('fixtures', '--run', c.w.m.run, '--set', 'baseline'), 2);
  } finally {
    c.done();
  }
});

test("the API canary reads the API's own write back from this run's database, and refuses when it is not there", async () => {
  const w = world({ api: true });
  const c = cli(w);
  try {
    assert.equal(await c.run('api', 'canary', '--run', w.m.run), 0);
    w.pg.canary = 'f';
    assert.equal(await c.run('api', 'canary', '--run', w.m.run), 1);
  } finally {
    c.done();
  }
});

test('reverify records a PostgreSQL restart only when everything else is unchanged, and never runs an operation', async () => {
  const w = world();
  const restarted = (v) => v.replace(w.m.db.postmasterStart, '2026-11-18T12:00:00.000000');
  w.pg.tcp = restarted(w.pg.tcp);
  w.pg.inside = restarted(w.pg.inside);
  const c = cli(w);
  try {
    assert.equal(await c.run('verify', '--run', w.m.run), 1); // refused until the restart is recorded
    assert.equal(await c.run('reverify', '--run', w.m.run), 0);
    const m = readManifest(runDir(c.root, w.m.run));
    assert.equal(m.db.postmasterStart, '2026-11-18T12:00:00.000000');
    assert.equal(m.restarts.length, 1);
    assert.equal(await c.run('verify', '--run', w.m.run), 0);
    assert.deepEqual(w.d.mutations, []);
  } finally {
    c.done();
  }
  const other = world();
  other.pg.inside = other.pg.inside
    .replace(other.m.db.systemId, '1')
    .replace(other.m.db.postmasterStart, '2026-11-18T12:00:00.000000');
  other.pg.tcp = other.pg.inside;
  const d = cli(other);
  try {
    assert.equal(await d.run('reverify', '--run', other.m.run), 1); // another server: nothing is recorded
    assert.equal(readManifest(runDir(d.root, other.m.run)).restarts, undefined);
  } finally {
    d.done();
  }
});

test('plan prints the exact docker arguments without any secret value', async () => {
  const c = cli();
  try {
    const repo = join(here, '..', '..', '..');
    assert.equal(await c.run('plan', '--checkout', repo), 0);
    const text = c.lines.join('\n');
    assert.match(text, /docker postgres: run -d/);
    assert.match(text, /POSTGRES_PASSWORD=<random>/);
    assert.doesNotMatch(text, /MINIO_ROOT_PASSWORD=[0-9a-f]{10}/);
    assert.deepEqual(c.io.calls, []);
  } finally {
    c.done();
  }
});

/* ---- rules about the harness source ---- */

function sources(dir = join(here, '..')) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'test' || e.name === 'node_modules') continue;
    const f = join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(f));
    else if (e.name.endsWith('.mjs')) out.push([f, readFileSync(f, 'utf8')]);
  }
  return out;
}

test('the harness source never kills by port, composes, prunes, execs by name, reads .env or inherits the environment', () => {
  const rules = [
    [/Stop-Process|taskkill|pkill|killall/i, 'kills a process by name or port'],
    [/docker compose|docker-compose up|compose up/i, 'uses docker compose'],
    [/\bprune\b/i, 'prunes'],
    [
      /'(exec|rm|stop|kill|inspect)',\s*'(adulis|nac|welcome)/,
      'addresses a container by a literal name',
    ],
    [/['"]--volumes['"]|\brm['"],\s*'-f',\s*'-v'|'-fv'/, 'removes volumes with the container'],
    [/\.env['"`)]|--env-file|dotenv/, 'reads a .env file'],
    [/\.\.\.process\.env|env:\s*process\.env/, 'inherits the process environment'],
    [/Get-NetTCPConnection[^;]*Stop|OwningProcess[^;]*(kill|Stop)/i, 'kills the owner of a port'],
    [/DROP DATABASE|dropdb/i, 'drops a database'],
    [/10\.0\.2\.2/, 'uses the emulator host alias'],
  ];
  for (const [file, text] of sources()) {
    for (const [re, what] of rules) assert.doesNotMatch(text, re, `${file} ${what}`);
  }
});

test('the only process kill is of a recorded pid, and nothing kills by a port or a name', () => {
  const hits = sources().flatMap(([file, text]) =>
    [...text.matchAll(/\.kill\(([^)]*)\)|process\.kill\(([^)]*)\)/g)].map((m) => [file, m[0]]),
  );
  for (const [file, call] of hits) assert.match(call, /rec\.pid|\(pid\)/, `${file}: ${call}`);
});

test('the harness has no flag that overrides a refused check', () => {
  const text = sources()
    .map(([, t]) => t)
    .join('\n');
  assert.doesNotMatch(text, /['"](force|override|skip-checks|no-verify|yes)['"]\s*:\s*\{/i);
  assert.doesNotMatch(text, /process\.env\.ADULIS_NATIVE_(FORCE|SKIP|OVERRIDE)/);
});

test('an id helper in the doubles yields 64 hex characters like a docker id', () => {
  assert.match(id64(), /^[0-9a-f]{64}$/);
});
