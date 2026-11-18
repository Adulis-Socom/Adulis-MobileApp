// Cleanup removes a container, volume or network only with full ownership proof, identifies EVERYTHING
// before removing anything, and never reads a failed listing or a dead engine as "absent" or "removed".
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { executeDown, planDown, purge, purgeProblems } from '../lib/cleanup.mjs';
import { LABEL } from '../lib/protected.mjs';
import { id64, makeIo, world } from './fakes.mjs';

const pgId = (w) => w.m.containers.postgres.id;
const s3Id = (w) => w.m.containers.minio.id;

async function down(w) {
  const io = makeIo(w);
  const plan = await planDown(w.m, io);
  if (plan.problems.length || plan.unknowns.length) return { plan, removed: [], left: [] };
  const log = [];
  const r = await executeDown(w.m, plan.steps, io, (e) => log.push(e));
  return { plan, ...r, log };
}
const nothingRemoved = (w) =>
  assert.deepEqual(w.d.mutations, [], `something was removed: ${w.d.mutations.join(' | ')}`);

test("a run's own resources are removed in order, by full id, with no -v and no name-based removal", async () => {
  const w = world();
  const r = await down(w);
  assert.deepEqual(w.d.mutations, [
    `rm -f ${pgId(w)}`,
    `rm -f ${s3Id(w)}`,
    `volume rm ${w.m.names.pgVolume}`,
    `volume rm ${w.m.names.minioVolume}`,
    `network rm ${w.m.network.id}`,
  ]);
  assert.equal(r.left.length, 0);
  assert.equal(
    Object.keys(w.d.containers).length +
      Object.keys(w.d.volumes).length +
      Object.keys(w.d.networks).length,
    0,
  );
  assert.equal(r.log.length, 5);
});

test('a resource that is already gone is not an error, but only when an empty listing proves it', async () => {
  const w = world();
  delete w.d.networks[w.m.network.id].Containers[s3Id(w)];
  delete w.d.containers[s3Id(w)];
  delete w.d.volumes[w.m.names.minioVolume];
  const r = await down(w);
  assert.equal(r.left.length, 0);
  assert.equal(r.plan.problems.length + r.plan.unknowns.length, 0);
});

test("a container, volume or network without this run's label is refused and NOTHING is removed", async () => {
  const cases = [
    (w) => delete w.d.containers[pgId(w)].Config.Labels[LABEL.run],
    (w) => (w.d.containers[s3Id(w)].Config.Labels[LABEL.run] = 'native-20200101-deadbeef'),
    (w) => (w.d.volumes[w.m.names.pgVolume].Labels = {}),
    (w) => (w.d.networks[w.m.network.id].Labels[LABEL.run] = 'native-20200101-deadbeef'),
  ];
  for (const edit of cases) {
    const w = world();
    edit(w);
    const r = await down(w);
    assert.ok(r.plan.problems.length > 0);
    assert.deepEqual(r.plan.steps, []);
    nothingRemoved(w);
  }
});

test('an object whose name lacks the run prefix, or is protected, is never removed even with the right labels', async () => {
  const a = world();
  a.d.containers[pgId(a)].Name = '/adulis-postgres';
  await down(a);
  nothingRemoved(a);
  const b = world();
  const old = b.m.names.pgVolume;
  b.d.volumes['adulis-pgdata'] = { ...b.d.volumes[old], Name: 'adulis-pgdata' };
  delete b.d.volumes[old];
  b.m.names.pgVolume = 'adulis-pgdata';
  const r = await down(b);
  assert.ok(r.plan.problems.some((p) => /protected|prefix/.test(p)));
  nothingRemoved(b);
});

test('an extra resource carrying the run label, or a foreign container on the network, refuses everything', async () => {
  const a = world();
  const stray = id64();
  a.d.containers[stray] = {
    ...structuredClone(a.d.containers[pgId(a)]),
    Id: stray,
    Name: '/adulis-native-stray',
  };
  await down(a);
  nothingRemoved(a);
  const b = world();
  b.d.networks[b.m.network.id].Containers[id64()] = {};
  await down(b);
  nothingRemoved(b);
  const c = world();
  c.d.volumes['adulis-native-extra'] = {
    Name: 'adulis-native-extra',
    Labels: { [LABEL.run]: c.m.run },
  };
  await down(c);
  nothingRemoved(c);
});

test('an id that differs from the manifest refuses everything', async () => {
  const w = world();
  const other = id64();
  w.d.containers[other] = { ...structuredClone(w.d.containers[pgId(w)]), Id: other };
  w.m.containers.postgres.id = other;
  w.d.containers[other].Id = id64(); // inspect by the recorded id returns another container id
  const r = await down(w);
  assert.ok(r.plan.problems.length > 0);
  nothingRemoved(w);
});

test('a listing or inspect that fails is never read as absent: exit class "could not check", nothing removed', async () => {
  for (const edit of [
    (w) => (w.d.listFails.containers = true),
    (w) => (w.d.listFails.volumes = true),
    (w) => (w.d.listFails.networks = true),
    (w) => (w.d.inspectFails = { [pgId(w)]: true }),
    (w) => (w.d.engineDead = true),
  ]) {
    const w = world();
    edit(w);
    const r = await down(w);
    assert.ok(r.plan.unknowns.length > 0, 'expected an unknown');
    assert.deepEqual(r.plan.steps, []);
    nothingRemoved(w);
  }
});

test('a removal that does not take effect, or an engine that dies mid-removal, is reported as left', async () => {
  const a = world();
  a.d.rmFails = true;
  const r = await down(a);
  assert.ok(r.left.length >= 1);
  assert.equal(r.removed.length, 0);
  const b = world();
  b.d.rmKillsEngine = true;
  const k = await down(b);
  assert.ok(k.left.length >= 1, 'the dead engine must not be read as removed');
  assert.equal(k.removed.length, 0);
});

test('a volume still attached to a container is not removed', async () => {
  const w = world();
  const io = makeIo(w);
  const plan = await planDown(w.m, io);
  const only = plan.steps.filter((s) => s.kind !== 'container'); // skip the container removal: the volume stays attached
  const r = await executeDown(w.m, only, io);
  assert.ok(r.left.some((l) => /volume/.test(l)));
  assert.ok(!w.d.mutations.some((x) => x.startsWith('volume rm')));
});

/* ---- the run directory ---- */

function runTree() {
  const root = mkdtempSync(join(tmpdir(), 'native-purge-'));
  const run = 'native-20261118-0a1b2c3d';
  const dir = join(root, 'runs', run);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'run.marker'), `${run}\n`);
  writeFileSync(join(dir, 'manifest.json'), '{}');
  return { root, run, dir };
}

test('purge removes exactly the run directory that holds its own marker', () => {
  const t = runTree();
  try {
    assert.deepEqual(purge(t.root, t.run), []);
    assert.equal(existsSync(t.dir), false);
  } finally {
    rmSync(t.root, { recursive: true, force: true });
  }
});

test('purge refuses a missing or foreign marker, an unknown run, and a link or junction inside', () => {
  const t = runTree();
  const outside = mkdtempSync(join(tmpdir(), 'native-outside-'));
  writeFileSync(join(outside, 'precious.txt'), 'keep');
  try {
    writeFileSync(join(t.dir, 'run.marker'), 'native-20260101-ffffffff\n');
    assert.match(purgeProblems(t.root, t.run).join(), /run\.marker does not name this run/);
    rmSync(join(t.dir, 'run.marker'));
    assert.match(purgeProblems(t.root, t.run).join(), /run\.marker is missing/);
    writeFileSync(join(t.dir, 'run.marker'), `${t.run}\n`);
    symlinkSync(outside, join(t.dir, 'link'), 'junction');
    assert.match(purgeProblems(t.root, t.run).join(), /link or junction/);
    assert.ok(purge(t.root, t.run).length > 0);
    assert.ok(existsSync(join(outside, 'precious.txt')), 'the target of the link was reached');
    assert.ok(purgeProblems(t.root, 'native-20261118-ffffffff').length > 0);
  } finally {
    rmSync(join(t.dir, 'link'), { force: true, recursive: false });
    rmSync(t.root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('purge refuses a run directory that is itself a link out of runs/', () => {
  const t = runTree();
  const outside = mkdtempSync(join(tmpdir(), 'native-outside-'));
  writeFileSync(join(outside, 'run.marker'), `${t.run}\n`);
  try {
    rmSync(t.dir, { recursive: true });
    symlinkSync(outside, t.dir, 'junction');
    assert.match(purgeProblems(t.root, t.run).join(), /outside/);
    assert.ok(existsSync(join(outside, 'run.marker')));
  } finally {
    rmSync(t.dir, { force: true, recursive: false });
    rmSync(t.root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
