// Starting and stopping the test API: build provenance (a stale checkout is refused before anything is
// built), the port guard, the verified start, and a stop that only ever targets the recorded process.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { provenanceProblems, startApi, stopApi } from '../lib/api.mjs';
import { Refused } from '../lib/guard.mjs';
import { readManifest, writeManifest } from '../lib/manifest.mjs';
import { apiAppName } from '../lib/identity.mjs';
import { makeIo, world } from './fakes.mjs';

const SHA = 'c'.repeat(40);
const gitFake =
  ({ head = SHA, dirty = '', behind = false, notRepo = false } = {}) =>
  async (args) => {
    if (notRepo) return { status: 128, stdout: '', stderr: 'not a git repository' };
    if (args[0] === 'rev-parse') return { status: 0, stdout: `${head}\n` };
    if (args[0] === 'status') return { status: 0, stdout: dirty };
    if (args[0] === 'merge-base') return { status: behind ? 1 : 0, stdout: '' };
    return { status: 1, stdout: '' };
  };

test('provenance accepts the verified commit on a clean tree that contains origin/dev', async () => {
  assert.deepEqual(await provenanceProblems('C:\\x', SHA, gitFake()), []);
});

test('provenance refuses a stale or different HEAD, a dirty tree, a checkout behind dev, a bad sha, a non-checkout', async () => {
  const cases = [
    [gitFake({ head: 'd'.repeat(40) }), SHA, /not the expected commit/],
    [gitFake({ dirty: ' M apps/api/src/main.ts\n' }), SHA, /uncommitted/],
    [gitFake({ behind: true }), SHA, /behind dev/],
    [gitFake(), 'main', /40-hex/],
    [gitFake(), SHA.toUpperCase(), /40-hex/],
    [gitFake({ notRepo: true }), SHA, /not a git checkout/],
  ];
  for (const [git, sha, re] of cases)
    assert.match((await provenanceProblems('C:\\x', sha, git)).join(), re);
});

function startWorld({ head = SHA, behind = false, portBusy = false } = {}) {
  const w = world();
  const dir = mkdtempSync(join(tmpdir(), 'native-api-'));
  const checkout = join(dir, 'checkout');
  mkdirSync(join(checkout, 'apps', 'api', 'dist'), { recursive: true });
  writeFileSync(join(checkout, 'apps', 'api', 'dist', 'main.js'), '// built');
  const io = makeIo(w);
  const effects = { builds: 0, spawns: [] };
  const node = 'C:\\Program Files\\nodejs\\node.exe';
  Object.assign(io, {
    node,
    git: gitFake({ head, behind }),
    connects: async () => portBusy,
    build: async () => {
      effects.builds += 1;
    },
    spawnApi: ({ main, env }) => {
      effects.spawns.push(env);
      w.api.health.boot_marker = env.ADULIS_BOOT_MARKER;
      w.proc.listeners = [4242];
      w.proc.byPid[4242] = {
        createdAt: '2026-11-18T10:01:00.0000000Z',
        commandLine: `"${node}" ${main}`,
      };
      w.pg.activity = [`adulis_app|${apiAppName(w.m)}`];
      return { pid: 4242 };
    },
  });
  writeManifest(dir, w.m);
  return {
    w,
    io,
    dir,
    checkout,
    effects,
    node,
    done: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test('a stale checkout is refused before the build and before any process starts', async () => {
  for (const opts of [{ head: 'd'.repeat(40) }, { behind: true }]) {
    const s = startWorld(opts);
    try {
      await assert.rejects(
        startApi(s.w.m, s.io, { checkout: s.checkout, sha: SHA, dir: s.dir }),
        /refused/,
      );
      assert.equal(s.effects.builds, 0, 'built a stale checkout');
      assert.equal(s.effects.spawns.length, 0, 'started an API from a stale checkout');
      assert.equal(readManifest(s.dir).api, null);
    } finally {
      s.done();
    }
  }
});

test('a listener already on the API port is refused: no build, no start, nothing killed', async () => {
  const s = startWorld({ portBusy: true });
  try {
    await assert.rejects(
      startApi(s.w.m, s.io, { checkout: s.checkout, sha: SHA, dir: s.dir }),
      /already listens/,
    );
    assert.equal(s.effects.builds, 0);
    assert.equal(s.effects.spawns.length, 0);
    assert.deepEqual(s.w.proc.kills, []);
  } finally {
    s.done();
  }
});

test('an API is not built or started while the stack fails an identity check', async () => {
  for (const edit of [
    (w) => (w.pg.tcp = w.pg.tcp.replace(w.m.db.systemId, '1')),
    (w) => (w.s3.accept = 'a-key-the-run-never-made'),
    (w) =>
      w.d.containers[w.m.containers.minio.id].Mounts.push({
        Type: 'bind',
        Source: '/x',
        Destination: '/y',
      }),
  ]) {
    const s = startWorld();
    try {
      edit(s.w);
      await assert.rejects(
        startApi(s.w.m, s.io, { checkout: s.checkout, sha: SHA, dir: s.dir }),
        /refused/,
      );
      assert.equal(s.effects.builds, 0);
      assert.equal(s.effects.spawns.length, 0);
    } finally {
      s.done();
    }
  }
});

test('a run that is not ready cannot start an API', async () => {
  const s = startWorld();
  try {
    s.w.m.state = 'creating';
    await assert.rejects(
      startApi(s.w.m, s.io, { checkout: s.checkout, sha: SHA, dir: s.dir }),
      /not ready/,
    );
    assert.equal(s.effects.spawns.length, 0);
  } finally {
    s.done();
  }
});

test('a verified start builds, starts with the allow-listed environment, records the process and proves identity', async () => {
  const s = startWorld();
  try {
    const m = await startApi(s.w.m, s.io, { checkout: s.checkout, sha: SHA, dir: s.dir });
    assert.equal(s.effects.builds, 1);
    assert.equal(s.effects.spawns.length, 1);
    assert.equal(m.api.pid, 4242);
    assert.equal(m.api.sha, SHA);
    assert.match(m.api.bootMarker, /^native\./);
    assert.equal(readManifest(s.dir).api.pid, 4242);
    assert.deepEqual(s.w.d.mutations, []);
  } finally {
    s.done();
  }
});

test('a started API that fails identity verification is stopped (by its verified pid) and the start is refused', async () => {
  const s = startWorld();
  try {
    const spawn = s.io.spawnApi;
    s.io.spawnApi = (o) => {
      const r = spawn(o);
      s.w.pg.activity = []; // attached to a different server: no connection in this one
      return r;
    };
    await assert.rejects(
      startApi(s.w.m, s.io, { checkout: s.checkout, sha: SHA, dir: s.dir }),
      /API instance/,
    );
    assert.deepEqual(s.w.proc.kills, [4242]);
  } finally {
    s.done();
  }
});

/* ---- stopping ---- */

test('stop kills the recorded process only when pid, creation time and command line all match', async () => {
  const w = world({ api: true });
  const dir = mkdtempSync(join(tmpdir(), 'native-stop-'));
  try {
    writeManifest(dir, w.m);
    const r = await stopApi(w.m, makeIo(w), dir);
    assert.equal(r.stopped, true);
    assert.deepEqual(w.proc.kills, [4242]);
    assert.equal(readManifest(dir).api, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('stop refuses a reused pid or another command line and kills nothing', async () => {
  const cases = [
    (w) => (w.proc.byPid[4242].createdAt = '2026-11-18T13:00:00.0000000Z'),
    (w) => (w.proc.byPid[4242].commandLine = '"C:\\tools\\unrelated.exe"'),
    (w) => (w.proc.byPid[4242].commandLine = `"${w.m.api.node}" --inspect ${w.m.api.main}`),
    (w) => (w.proc.byPid[4242].commandLine = `"${w.m.api.node}" C:\\other\\main.js`),
  ];
  for (const edit of cases) {
    const w = world({ api: true });
    edit(w);
    const dir = mkdtempSync(join(tmpdir(), 'native-stop-'));
    try {
      writeManifest(dir, w.m);
      await assert.rejects(stopApi(w.m, makeIo(w), dir), /not the API this run started/);
      assert.deepEqual(w.proc.kills, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('a port owned by an unrelated program is never a reason to kill anything', async () => {
  const w = world({ api: true });
  w.proc.listeners = [19028];
  w.proc.byPid[19028] = {
    createdAt: '2026-11-17T08:27:00.0000000Z',
    commandLine: '"C:\\tools\\unrelated.exe" --serve',
  };
  const io = makeIo(w);
  await assert.rejects(
    stopApi({ ...w.m, api: { ...w.m.api, pid: 19028 } }, io, tmpdir()),
    /not the API this run started/,
  );
  assert.deepEqual(w.proc.kills, []);
  assert.ok(!io.calls.some((c) => c.startsWith('kill')));
});

test('a recorded process that is gone is reported, not killed', async () => {
  const w = world({ api: true });
  delete w.proc.byPid[4242];
  const dir = mkdtempSync(join(tmpdir(), 'native-stop-'));
  try {
    writeManifest(dir, w.m);
    const r = await stopApi(w.m, makeIo(w), dir);
    assert.equal(r.stopped, false);
    assert.deepEqual(w.proc.kills, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ---- refusals are typed (exit 1), and the checkout is re-checked after the build ---- */

test('provenance, port-busy and stop refusals are typed refusals, not generic errors', async () => {
  const stale = startWorld({ head: 'd'.repeat(40) });
  const busy = startWorld({ portBusy: true });
  try {
    for (const s of [stale, busy]) {
      const e = await startApi(s.w.m, s.io, { checkout: s.checkout, sha: SHA, dir: s.dir }).catch(
        (x) => x,
      );
      assert.ok(e instanceof Refused && e.code === 1, `${e}`);
    }
  } finally {
    stale.done();
    busy.done();
  }
  const w = world({ api: true });
  w.proc.byPid[4242].createdAt = '2026-11-18T13:00:00.0000000Z';
  const e = await stopApi(w.m, makeIo(w), tmpdir()).catch((x) => x);
  assert.ok(e instanceof Refused && e.code === 1, `${e}`);
});

test('a checkout that changes during the build is refused before the API runs', async () => {
  const s = startWorld();
  try {
    let head = SHA;
    s.io.git = async (args) => gitFake({ head })(args);
    s.io.build = async () => {
      s.effects.builds += 1;
      head = 'e'.repeat(40); // a checkout switched while the build ran
    };
    const e = await startApi(s.w.m, s.io, { checkout: s.checkout, sha: SHA, dir: s.dir }).catch(
      (x) => x,
    );
    assert.ok(e instanceof Refused && /after the build/.test(e.message), `${e}`);
    assert.equal(s.effects.spawns.length, 0);
  } finally {
    s.done();
  }
});
