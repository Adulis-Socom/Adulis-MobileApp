// OPT-IN, local only: runs the real guard statement on the PostgreSQL of a disposable run that is
// `ready` (created by `harness up`), through `docker exec` by the container's full id. CI does not
// run it (it is not in a gate, and it skips itself unless both variables below are set).
//
//   ADULIS_NATIVE_ROOT=<root> ADULIS_NATIVE_GUARD_RUN=<run> node --test ops/native/test/guard-live.test.mjs
//
// The harness proves the run's stack FIRST (the same DB-WRITE proof every fixture write needs), so the
// statements below can only reach the run's own server. They never write: the statement after the guard
// is a sentinel that raises 'ran after the guard'. For each single wrong identity the guard must stop the
// script before the sentinel (the error says "identity mismatch", not "ran after the guard"); with the
// right identity the sentinel must be reached.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { guardSql } from '../fixtures/index.mjs';
import { assertTarget } from '../lib/guard.mjs';
import { realIo } from '../lib/io.mjs';
import { readManifest, runDir } from '../lib/manifest.mjs';

const run = process.env.ADULIS_NATIVE_GUARD_RUN;
const root = process.env.ADULIS_NATIVE_ROOT;
const skip =
  !run || !root
    ? 'set ADULIS_NATIVE_ROOT and ADULIS_NATIVE_GUARD_RUN to run against a disposable run'
    : false;

test(
  'the identity guard stops each single wrong identity before the next statement, and lets the right one through',
  { skip },
  async () => {
    const m = readManifest(runDir(root, run));
    await assertTarget(m, 'DB-WRITE', realIo(), { states: ['ready'] });
    const id = m.containers.postgres.id;
    const sentinel = "DO $$ BEGIN RAISE EXCEPTION 'ran after the guard'; END $$;";
    const psql = (sql) =>
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
          '--single-transaction',
          '-f',
          '-',
        ],
        { input: `${guardSql({ ...m, ...sql })}\n${sentinel}`, encoding: 'utf8' },
      );
    for (const bad of [
      { db: { ...m.db, systemId: '1234567890123456789' } },
      { db: { ...m.db, name: 'adulis' } },
      { nonce: '0'.repeat(64) },
    ]) {
      const r = psql(bad);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /native run identity mismatch/);
      assert.doesNotMatch(r.stderr, /ran after the guard/, 'the guard did not stop the script');
    }
    const good = psql({});
    assert.notEqual(good.status, 0);
    assert.match(good.stderr, /ran after the guard/, 'the right identity must reach the sentinel');
    assert.doesNotMatch(good.stderr, /identity mismatch/);
  },
);
