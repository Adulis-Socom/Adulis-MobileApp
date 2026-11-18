// OPT-IN, local only: runs the real guard statement on the PostgreSQL of a disposable run that is
// `ready` (created by `harness up`), through `docker exec` by the container's full id. CI does not
// run it (it is not in a gate, and it skips itself unless both variables below are set).
//
//   ADULIS_NATIVE_ROOT=<root> ADULIS_NATIVE_GUARD_RUN=<run> node --test ops/native/test/guard-live.test.mjs
//
// For each single wrong identity the guard must raise and the statement after it must write nothing;
// with the right identity it must run.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { guardSql } from '../fixtures/index.mjs';
import { readManifest, runDir } from '../lib/manifest.mjs';

const run = process.env.ADULIS_NATIVE_GUARD_RUN;
const root = process.env.ADULIS_NATIVE_ROOT;
const skip =
  !run || !root
    ? 'set ADULIS_NATIVE_ROOT and ADULIS_NATIVE_GUARD_RUN to run against a disposable run'
    : false;

test('the identity guard raises on each single wrong identity and writes nothing', { skip }, () => {
  const m = readManifest(runDir(root, run));
  assert.equal(m.state, 'ready');
  const id = m.containers.postgres.id;
  const psql = (input, extra = []) =>
    spawnSync(
      'docker',
      [
        'exec',
        '-i',
        id,
        'psql',
        '-U',
        m.db.user,
        '-d',
        m.db.name,
        '-v',
        'ON_ERROR_STOP=1',
        '-q',
        ...extra,
      ],
      {
        input,
        encoding: 'utf8',
      },
    );
  const count = () =>
    spawnSync(
      'docker',
      [
        'exec',
        id,
        'psql',
        '-U',
        m.db.user,
        '-d',
        m.db.name,
        '-AtX',
        '-c',
        "SELECT count(*) FROM core.category WHERE code = 'guard-live-test'",
      ],
      {
        encoding: 'utf8',
      },
    ).stdout.trim();
  const write =
    "INSERT INTO core.category (id, code) VALUES (gen_random_uuid(), 'guard-live-test');";
  for (const bad of [
    { ...m, db: { ...m.db, systemId: '1234567890123456789' } },
    { ...m, db: { ...m.db, name: 'adulis' } },
    { ...m, nonce: '0'.repeat(64) },
  ]) {
    const r = psql(`${guardSql(bad)}\n${write}`, ['--single-transaction', '-f', '-']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /native run identity mismatch/);
    assert.equal(count(), '0');
  }
  const good = psql(`${guardSql(m)}\nSELECT 1;`, ['--single-transaction', '-f', '-']);
  assert.equal(good.status, 0, good.stderr);
});
