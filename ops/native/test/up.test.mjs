// `up` against a stateful fake engine: the order of proof and write, the refusals that must stop it
// before anything is created or written, and a partial failure that `down` then cleans up.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { executeDown, planDown } from '../lib/cleanup.mjs';
import { Refusal, Refused } from '../lib/guard.mjs';
import { newRun, readManifest, runDir } from '../lib/manifest.mjs';
import { up } from '../lib/stack.mjs';
import { engineWorld } from './engine-fake.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PORTS = { pg: 57311, s3: 57312, api: 57313 };

async function start(opts = {}, mutateWorld = () => {}) {
  const e = engineWorld(opts);
  const root = mkdtempSync(join(tmpdir(), 'native-up-'));
  const fixed = newRun();
  mutateWorld(e, fixed);
  const result = await up(e.io, {
    root,
    repo,
    makeRun: () => structuredClone(fixed),
    ports: PORTS,
  }).catch((x) => x);
  const dir = runDir(root, fixed.run);
  return {
    e,
    root,
    fixed,
    dir,
    result,
    done: () => rmSync(root, { recursive: true, force: true }),
  };
}

test('up creates the stack in order and proves the server before the first write', async () => {
  const s = await start();
  try {
    assert.ok(!(s.result instanceof Error), `${s.result}`);
    const ev = s.e.st.events;
    const at = (x) => ev.indexOf(x);
    assert.equal(ev[0], 'network create');
    assert.ok(
      at('network create') < at('volume create') && at('volume create') < at('run postgres'),
    );
    assert.ok(at('run postgres') < at('run minio'));
    assert.ok(at('run minio') < at('stamp'), 'the marker is written after both containers exist');
    assert.ok(
      at('stamp') < ev.findIndex((x) => x.startsWith('node ')),
      'no migration runs before the identity proof and the marker',
    );
    const m = readManifest(s.dir);
    assert.equal(m.state, 'ready');
    assert.equal(m.engine.id, 'engine-up-0001');
    assert.equal(
      m.db.systemId,
      s.e.st.pg.systemId,
      'the recorded identity comes from the container',
    );
    assert.deepEqual(Object.keys(m.containers).sort(), ['minio', 'postgres']);
    assert.ok(s.result.results.every((r) => r.verdict === 'PASS'));
    assert.deepEqual(
      s.e.st.nodeRuns.map((x) => x.replaceAll('\\', '/').split('/').pop()),
      ['node-pg-migrate.js', 'install-worker-schema.mjs', 'seed.mjs'],
    );
  } finally {
    s.done();
  }
});

test('a name that already exists is refused before anything is created', async () => {
  const s = await start({}, (e, fixed) => {
    e.st.containers.preexisting = {
      Id: 'a'.repeat(64),
      Name: `/${fixed.names.pg}`,
      Config: { Labels: {}, Env: [] },
      Mounts: [],
    };
  });
  try {
    assert.ok(s.result instanceof Refused && s.result.code === 1, `${s.result}`);
    assert.deepEqual(
      s.e.st.events.filter((x) => /create|run|stamp|node|rm/.test(x)),
      [],
    );
    assert.ok(s.e.st.containers.preexisting, 'the other container was touched');
  } finally {
    s.done();
  }
});

test('a different server answering on the port stops up before anything is written, and down cleans up', async () => {
  const s = await start({ wrongServerOnPort: true });
  try {
    assert.ok(s.result instanceof Refused, `${s.result}`);
    assert.match(s.result.message, /not this run's PostgreSQL/);
    const ev = s.e.st.events;
    assert.ok(!ev.includes('stamp') && !ev.some((x) => x.startsWith('node ')), ev.join());
    const m = readManifest(s.dir);
    assert.equal(m.state, 'creating');
    const plan = await planDown(m, s.e.io);
    assert.deepEqual([plan.problems, plan.unknowns], [[], []]);
    const r = await executeDown(m, plan.steps, s.e.io);
    assert.deepEqual(r.left, []);
    const st = s.e.st;
    assert.equal(
      Object.keys(st.containers).length +
        Object.keys(st.volumes).length +
        Object.keys(st.networks).length,
      0,
      'everything the failed up created is gone',
    );
  } finally {
    s.done();
  }
});

test('a container with a second mount is refused at the first write proof, and down still removes it', async () => {
  const s = await start({ secondVolume: true });
  try {
    assert.ok(s.result instanceof Refusal, `${s.result}`);
    assert.ok(s.result.results.some((r) => r.id === 'ID-08' && r.verdict === 'FAIL'));
    assert.ok(
      !s.e.st.events.includes('psql input') && !s.e.st.events.some((x) => x.startsWith('node ')),
    );
    const m = readManifest(s.dir);
    const plan = await planDown(m, s.e.io);
    assert.deepEqual(
      [plan.problems, plan.unknowns],
      [[], []],
      'a run-owned container must stay removable',
    );
    const r = await executeDown(m, plan.steps, s.e.io);
    assert.equal(r.removed.length, 5);
    assert.equal(r.left.length, 2, 'the two anonymous volumes are reported, not removed');
    assert.ok(r.left.every((l) => /anonymous volume/.test(l)));
  } finally {
    s.done();
  }
});

test('a container that fails to start leaves a manifest down can clean', async () => {
  const s = await start({ failRun: 'minio' });
  try {
    assert.ok(
      s.result instanceof Error && /docker run minio failed/.test(s.result.message),
      `${s.result}`,
    );
    const m = readManifest(s.dir);
    assert.deepEqual(Object.keys(m.containers), ['postgres']);
    const plan = await planDown(m, s.e.io);
    const r = await executeDown(m, plan.steps, s.e.io);
    assert.deepEqual([r.left.length, Object.keys(s.e.st.containers).length], [0, 0]);
  } finally {
    s.done();
  }
});

test('an engine that cannot be identified stops up before the manifest or any resource exists', async () => {
  const e = engineWorld();
  e.st.dead = true;
  const root = mkdtempSync(join(tmpdir(), 'native-up-'));
  try {
    const r = await up(e.io, { root, repo, ports: PORTS }).catch((x) => x);
    assert.match(r.message, /Docker engine could not be identified/);
    assert.deepEqual(e.st.events, []);
    assert.throws(() => readManifest(join(root, 'runs')), /ENOENT/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('up is ready only after the finished stack passes every check, and the proof is not empty', async () => {
  const good = await start();
  try {
    assert.deepEqual(
      ['ID-00', 'ID-01', 'ID-02', 'ID-03', 'ID-06', 'ID-07', 'ID-08', 'ID-09', 'ID-10'].filter(
        (id) => !good.result.results.some((r) => r.id === id),
      ),
      [],
      'every stack check ran',
    );
  } finally {
    good.done();
  }
  const s = await start({ noTags: true });
  try {
    assert.ok(s.result instanceof Refusal, `${s.result}`);
    assert.ok(s.result.results.some((r) => r.id === 'ID-07' && r.verdict === 'FAIL'));
    assert.equal(
      readManifest(s.dir).state,
      'creating',
      'a stack that failed its proof is not ready',
    );
  } finally {
    s.done();
  }
});
