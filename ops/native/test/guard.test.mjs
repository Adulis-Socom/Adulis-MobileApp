// The identity guard that opens every fixture transaction. Its logic is evaluated from the SQL text
// the harness sends (guard-model.mjs), so a changed connective, a negated predicate, a missing
// RAISE or a guard that is not first fails here; guard-live.test.mjs runs the same statement on a
// disposable PostgreSQL where one is available.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guardSql, loadSet, SETS } from '../fixtures/index.mjs';
import { readManifest, writeManifest } from '../lib/manifest.mjs';
import { evaluateGuard } from './guard-model.mjs';
import { makeIo, world } from './fakes.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const facts = (m, over = {}) => ({
  systemId: m.db.systemId,
  db: m.db.name,
  setting: `${m.run}:${m.nonce}`,
  ...over,
});

test('the guard passes on the right server, database and run setting', () => {
  const { m } = world();
  const g = evaluateGuard(guardSql(m), facts(m));
  assert.deepEqual([g.guarded, g.raises], [true, false]);
});

test('the guard raises when ANY single identity is wrong (the three are joined by OR)', () => {
  const { m } = world();
  for (const over of [
    { systemId: '1234567890123456789' },
    { db: 'adulis' },
    { setting: `${m.run}:${'0'.repeat(64)}` },
    { setting: '' },
    { setting: undefined },
  ]) {
    const g = evaluateGuard(guardSql(m), facts(m, over));
    assert.equal(g.raises, true, JSON.stringify(over));
    assert.match(g.message, /identity mismatch: nothing was written/);
  }
  const g = evaluateGuard(guardSql(m), { systemId: 'x', db: 'y', setting: 'z' });
  assert.equal(g.raises, true);
});

test('a script that does not start with the guard is not guarded', () => {
  const { m } = world();
  const g = evaluateGuard(`INSERT INTO t VALUES (1);\n${guardSql(m)}`, facts(m, { db: 'adulis' }));
  assert.equal(g.guarded, false);
});

test('the model refuses to read a guard whose shape it does not know', () => {
  const { m } = world();
  const sql = guardSql(m).replace('IS DISTINCT FROM', 'IS DIFFERENT FROM');
  assert.throws(() => evaluateGuard(sql, facts(m)), /does not know/);
});

test('a fixture load whose server changed after the checks wrote NOTHING, whichever leg changed', async () => {
  for (const over of [
    { systemId: '1234567890123456789' },
    { db: 'adulis' },
    { setting: `${world().m.run}:${'0'.repeat(64)}` },
  ]) {
    const w = world();
    // The checks (tcp, inside) still see the right identity: only the moment of the write differs.
    w.pg.live = { ...w.pg.live, ...over };
    const dir = mkdtempSync(join(tmpdir(), 'native-guard-'));
    try {
      writeManifest(dir, w.m);
      await assert.rejects(loadSet(w.m, makeIo(w), 'baseline', { dir }), /identity mismatch/);
      assert.deepEqual(w.pg.committed, [], `rows were committed: ${JSON.stringify(over)}`);
      assert.deepEqual(readManifest(dir).fixtures, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('with the right identity the same load commits exactly once, guard first', async () => {
  const w = world();
  const dir = mkdtempSync(join(tmpdir(), 'native-guard-'));
  try {
    writeManifest(dir, w.m);
    await loadSet(w.m, makeIo(w), 'baseline', { dir });
    assert.equal(w.pg.committed.length, 1);
    const sql = w.pg.committed[0];
    assert.equal(
      evaluateGuard(sql, w.pg.live).guarded,
      true,
      'the committed script starts with the guard',
    );
    assert.ok(sql.includes(SETS.baseline.sql(w.m).trim().slice(0, 40)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the run-setting term of the guard is pinned byte for byte (the model cannot evaluate its inner SELECT)', () => {
  const { m } = world();
  const flat = guardSql(m).replace(/\s+/g, ' ');
  const inner =
    "coalesce((SELECT substr(s, length('adulis.native_run=') + 1) FROM pg_db_role_setting r, unnest(r.setconfig) s " +
    'WHERE r.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database()) ' +
    "AND r.setrole = 0 AND starts_with(s, 'adulis.native_run=') LIMIT 1), '')";
  assert.ok(flat.includes(inner), flat);
});
