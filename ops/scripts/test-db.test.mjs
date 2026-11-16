// `test-db.sh down` removes only containers it can positively identify (INF-03): the disposable role
// label, this owner's label, and no bind mount or named volume. Anything else refuses and removes
// NOTHING. Runs the real script against a fake `docker` on PATH; no Docker is needed.
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

// The fake engine: containers by name in a JSON file; every `rm` is logged.
const FAKE = `
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
const [stateFile, logFile] = [process.env.FAKE_DOCKER_STATE, process.env.FAKE_DOCKER_LOG];
const s = JSON.parse(readFileSync(stateFile, 'utf8'));
const args = process.argv.slice(2);
const find = (ref) => Object.entries(s.containers).find(([n, c]) => n === ref || c.id === ref);
if (args[0] === 'info') process.exit(s.engineDown ? 1 : 0);
if (args[0] === 'inspect') {
  const ref = args[args.length - 1];
  const hit = find(ref);
  if (!hit) process.exit(1);
  const [, c] = hit;
  if (!args.includes('--format')) process.exit(0);
  if (c.inspectFails) process.exit(1);
  const mounts = c.mounts.map((m) => m.type + ':' + (m.type === 'volume' ? m.name : '') + ';').join('');
  console.log([c.id, c.role ?? '<no value>', c.owner ?? '<no value>', mounts].join('|'));
  process.exit(0);
}
if (args[0] === 'rm') {
  const refs = args.filter((a) => !a.startsWith('-') && a !== 'rm');
  appendFileSync(logFile, 'rm ' + refs.join(' ') + '\\n');
  if (!s.rmFails) for (const r of refs) { const hit = find(r); if (hit) delete s.containers[hit[0]]; }
  writeFileSync(stateFile, JSON.stringify(s));
  process.exit(0);
}
process.exit(0);
`;

function down(containers, extra = {}) {
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
        ADULIS_TEST_DB_OWNER: OWNER,
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

test('nothing present: exits 0 and removes nothing', () => {
  const r = down({});
  assert.equal(r.status, 0, r.err);
  assert.equal(r.rm, '');
  assert.match(r.err, /nothing to remove/);
});

test("this owner's disposable pair is removed, by container ID and never by name", () => {
  const r = down({ 'adulis-test-pg': owned('pg111'), 'adulis-test-minio': owned('s3222', []) });
  assert.equal(r.status, 0, r.err);
  assert.equal(r.rm, 'rm pg111 s3222');
  assert.deepEqual(r.left, []);
});

test('a container without the disposable label refuses, and NOTHING is removed', () => {
  const r = down({
    'adulis-test-pg': { id: 'decoy', mounts: [] },
    'adulis-test-minio': owned('s3222', []),
  });
  assert.equal(r.status, 1);
  assert.match(r.err, /REFUSED, nothing was removed/);
  assert.match(r.err, /adulis-test-pg \(decoy\) has no adulis\.test-db\.role=disposable label/);
  assert.equal(r.rm, '');
  assert.deepEqual(r.left.sort(), ['adulis-test-minio', 'adulis-test-pg']);
});

test("another owner's pair refuses (another worktree or work order)", () => {
  const r = down({ 'adulis-test-pg': { ...owned('pg111'), owner: 'C:/other/worktree' } });
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
    const r = down({ 'adulis-test-pg': owned('pg111', mounts) });
    assert.equal(r.status, 1, JSON.stringify(mounts));
    assert.match(r.err, /not disposable/);
    assert.equal(r.rm, '');
  }
});

test('a container that exists but cannot be inspected refuses', () => {
  const r = down({ 'adulis-test-pg': { ...owned('pg111'), inspectFails: true } });
  assert.equal(r.status, 1);
  assert.match(r.err, /exists but could not be inspected/);
  assert.equal(r.rm, '');
});

test('a removal that does not take effect is reported, not hidden', () => {
  const r = down({ 'adulis-test-pg': owned('pg111') }, { rmFails: true });
  assert.equal(r.status, 1);
  assert.match(r.err, /could not remove pg111/);
});

test('an unreachable engine removes nothing', () => {
  const r = down({ 'adulis-test-pg': owned('pg111') }, { engineDown: true });
  assert.equal(r.status, 1);
  assert.match(r.err, /docker is not reachable; nothing was removed/);
  assert.equal(r.rm, '');
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
