// `test-db.sh down` removes only containers it can positively identify (INF-03): the disposable role
// label, this owner's label, and no bind mount or named volume. Anything else refuses and removes
// NOTHING, and a docker error is never read as "absent" or "removed" (INF-03 review A). Runs the real
// script against a fake `docker` on PATH; no Docker is needed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ANON = 'a'.repeat(64);
const OWNER = 'inf-03-test-owner';
const PG_ID = '1'.repeat(64);
const S3_ID = '2'.repeat(64);

// The fake engine: containers by name in a JSON file; every `rm` is logged.
const FAKE = `
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
const [stateFile, logFile] = [process.env.FAKE_DOCKER_STATE, process.env.FAKE_DOCKER_LOG];
const s = JSON.parse(readFileSync(stateFile, 'utf8'));
const args = process.argv.slice(2);
const find = (ref) => Object.entries(s.containers).find(([n, c]) => n === ref || c.id === ref);
if (args[0] === 'info') process.exit(s.engineDown ? 1 : 0);
if (args[0] === 'ps') {
  if (s.engineDead) process.exit(1);
  const filter = args[args.indexOf('--filter') + 1] || '';
  if (filter.startsWith('name=')) {
    const name = filter.slice('name=^/'.length, -1);
    if (s.containers[name]?.listFails) process.exit(1);
    if (s.containers[name]) console.log(s.containers[name].id);
  } else if (filter.startsWith('id=')) {
    const hit = find(filter.slice(3));
    if (hit) console.log(hit[1].id);
  }
  process.exit(0);
}
if (args[0] === 'inspect') {
  const hit = find(args[args.length - 1]);
  if (!hit) process.exit(1);
  const [, c] = hit;
  if (c.inspectFails) process.exit(1);
  const mounts = c.mounts.map((m) => m.type + ':' + (m.type === 'volume' ? m.name : '') + ';').join('');
  console.log([c.id, c.role ?? '<no value>', c.owner ?? '<no value>', mounts].join('|'));
  process.exit(0);
}
if (args[0] === 'rm') {
  const refs = args.filter((a) => !a.startsWith('-') && a !== 'rm');
  appendFileSync(logFile, 'rm ' + refs.join(' ') + '\\n');
  if (s.rmKillsEngine) s.engineDead = true;
  else if (!s.rmFails) for (const r of refs) { const hit = find(r); if (hit) delete s.containers[hit[0]]; }
  writeFileSync(stateFile, JSON.stringify(s));
  process.exit(0);
}
process.exit(0);
`;

function down(containers, extra = {}, owner = OWNER) {
  const dir = mkdtempSync(join(tmpdir(), 'test-db-fake-'));
  try {
    const state = join(dir, 'state.json');
    const log = join(dir, 'rm.log');
    writeFileSync(state, JSON.stringify({ containers, ...extra }));
    writeFileSync(log, '');
    writeFileSync(join(dir, 'fake-docker.mjs'), FAKE);
    const shim = join(dir, 'docker');
    writeFileSync(
      shim,
      `#!/bin/sh\nexec node "${join(dir, 'fake-docker.mjs').replaceAll('\\', '/')}" "$@"\n`,
    );
    chmodSync(shim, 0o755);
    const r = spawnSync('bash', ['ops/scripts/test-db.sh', 'down'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dir}${delimiter}${process.env.PATH}`,
        FAKE_DOCKER_STATE: state,
        FAKE_DOCKER_LOG: log,
        ADULIS_TEST_DB_OWNER: owner,
      },
    });
    return {
      status: r.status,
      err: `${r.stderr}`,
      rm: readFileSync(log, 'utf8').trim(),
      left: Object.keys(JSON.parse(readFileSync(state, 'utf8')).containers),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const owned = (id, mounts = [{ type: 'volume', name: ANON }]) => ({
  id,
  role: 'disposable',
  owner: OWNER,
  mounts,
});
const unlabelled = (id) => ({ id, mounts: [] });

test('nothing present: exits 0 and removes nothing', () => {
  const r = down({});
  assert.equal(r.status, 0, r.err);
  assert.equal(r.rm, '');
  assert.match(r.err, /nothing to remove/);
});

test("this owner's disposable pair is removed, by container ID and never by name", () => {
  const r = down({ 'adulis-test-pg': owned(PG_ID), 'adulis-test-minio': owned(S3_ID, []) });
  assert.equal(r.status, 0, r.err);
  assert.equal(r.rm, `rm ${PG_ID} ${S3_ID}`);
  assert.deepEqual(r.left, []);
});

test('a container without the disposable label refuses, and NOTHING is removed (either order)', () => {
  for (const containers of [
    { 'adulis-test-pg': unlabelled(PG_ID), 'adulis-test-minio': owned(S3_ID, []) },
    { 'adulis-test-pg': owned(PG_ID), 'adulis-test-minio': unlabelled(S3_ID) },
  ]) {
    const r = down(containers);
    assert.equal(r.status, 1, JSON.stringify(containers));
    assert.match(r.err, /REFUSED, nothing was removed/);
    assert.match(r.err, /has no adulis\.test-db\.role=disposable label/);
    assert.equal(r.rm, '', 'no rm at all');
    assert.deepEqual(r.left.sort(), ['adulis-test-minio', 'adulis-test-pg']);
  }
});

test("another owner's pair refuses (another worktree or work order)", () => {
  const r = down({ 'adulis-test-pg': { ...owned(PG_ID), owner: 'C:/other/worktree' } });
  assert.equal(r.status, 1);
  assert.match(r.err, /belongs to 'C:\/other\/worktree', not 'inf-03-test-owner'/);
  assert.equal(r.rm, '');
});

test("a named volume or a bind mount refuses: that is someone's data", () => {
  for (const mounts of [
    [{ type: 'volume', name: 'adulis-platform_adulis-pgdata' }],
    [{ type: 'bind' }],
    [{ type: 'volume', name: ANON }, { type: 'bind' }],
  ]) {
    const r = down({ 'adulis-test-pg': owned(PG_ID, mounts) });
    assert.equal(r.status, 1, JSON.stringify(mounts));
    assert.match(r.err, /not disposable/);
    assert.equal(r.rm, '');
  }
});

test('a container that exists but cannot be inspected refuses', () => {
  const r = down({ 'adulis-test-pg': { ...owned(PG_ID), inspectFails: true } });
  assert.equal(r.status, 1);
  assert.match(r.err, /exists but could not be inspected/);
  assert.equal(r.rm, '');
});

test('a docker error while listing one container is never read as "absent": nothing removed', () => {
  const r = down({
    'adulis-test-pg': { ...owned(PG_ID), listFails: true },
    'adulis-test-minio': owned(S3_ID, []),
  });
  assert.equal(r.status, 1);
  assert.match(r.err, /adulis-test-pg could not be listed \(docker error\)/);
  assert.equal(r.rm, '', 'the healthy MinIO must not be removed alone');
});

test('a removal that does not take effect is reported, not hidden', () => {
  const r = down({ 'adulis-test-pg': owned(PG_ID) }, { rmFails: true });
  assert.equal(r.status, 1);
  assert.match(r.err, new RegExp(`could not remove ${PG_ID}`));
});

test('the engine dying during removal is never read as "removed"', () => {
  const r = down(
    { 'adulis-test-pg': owned(PG_ID), 'adulis-test-minio': owned(S3_ID, []) },
    { rmKillsEngine: true },
  );
  assert.equal(r.status, 1);
  assert.match(r.err, /docker stopped answering/);
  assert.doesNotMatch(r.err, /removed 2 container/);
});

test('an unreachable engine removes nothing', () => {
  const r = down({ 'adulis-test-pg': owned(PG_ID) }, { engineDown: true });
  assert.equal(r.status, 1);
  assert.match(r.err, /docker is not reachable; nothing was removed/);
  assert.equal(r.rm, '');
});

test('an owner holding a field separator is refused before docker is asked', () => {
  for (const bad of ['a|b', 'a;b']) {
    const r = down({ 'adulis-test-pg': owned(PG_ID) }, {}, bad);
    assert.equal(r.status, 2, bad);
    assert.match(r.err, /must be non-empty and contain no/);
    assert.equal(r.rm, '');
  }
});

test('up labels both containers with the role and the owner', () => {
  const sh = readFileSync(join(root, 'ops/scripts/test-db.sh'), 'utf8');
  const runs = sh.match(/docker run -d --rm --name "\$(PG|S3)"[\s\S]*?\)"\)/g) ?? [];
  assert.equal(runs.length, 2);
  for (const run of runs) {
    assert.match(run, /--label "\$ROLE_LABEL=disposable"/);
    assert.match(run, /--label "\$OWNER_LABEL=\$OWNER"/);
  }
});
