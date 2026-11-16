// The foreign-key teardown can never report a failed audit as a pass (INF-03, task F3). The verdict
// lives in apps/api/test/fk-teardown-verdict.js (CommonJS, so the Jest teardown can require it); this
// covers every outcome, plus the real audit's exit status when it cannot reach a database.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { teardownVerdict } = createRequire(import.meta.url)(
  '../../apps/api/test/fk-teardown-verdict.js',
);

const BANNER = '\nForeign-key audit -- 201 keys, read-only session\n\n';
const PASS = 'PASS  all 201 foreign keys hold, apart from 5 known test leak(s) (35 rows).\n';

test('a pass needs status 0, the banner and the PASS line', () => {
  assert.deepEqual(teardownVerdict({ status: 0, signal: null, stdout: BANNER + PASS }), {
    ok: true,
    reason: 'pass',
    message: '',
  });
  assert.equal(
    teardownVerdict({
      status: 0,
      signal: null,
      stdout: BANNER + 'PASS  all 175 foreign keys hold.\n',
    }).ok,
    true,
  );
});

test('orphans: status 1 with the banner fails as orphans', () => {
  const v = teardownVerdict({
    status: 1,
    signal: null,
    stdout: BANNER + '  FAIL  x_fkey: 3 row(s)\n\nFAIL  3 orphaned row(s) across 1 key(s).\n',
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'orphans');
});

test('every way of not finishing the audit fails, never passes', () => {
  const cases = [
    { status: 0, signal: null, stdout: '' }, // silent exit 0 (the PR105-F11 case)
    { status: 0, signal: null, stdout: PASS }, // a PASS line without the banner
    { status: 1, signal: null, stdout: '' }, // a crash (module not found) is not "orphans"
    { status: 2, signal: null, stdout: BANNER }, // could not audit
    { status: null, signal: 'SIGTERM', stdout: BANNER + PASS }, // killed
    { status: null, signal: null, error: new Error('spawn ENOENT'), stdout: null }, // could not start
    { status: 3, signal: null, stdout: BANNER + PASS },
  ];
  for (const c of cases) {
    const v = teardownVerdict(c);
    assert.equal(v.ok, false, JSON.stringify(c));
    assert.equal(v.reason, 'did-not-run', JSON.stringify(c));
    assert.match(v.message, /did not run to its verdict/);
  }
  assert.match(
    teardownVerdict({ status: null, signal: null, error: new Error('spawn ENOENT') }).message,
    /spawn ENOENT/,
  );
});

test('status 0 with the banner but no PASS line fails', () => {
  for (const tail of [
    '',
    'PASS all 201 foreign keys hold.\n',
    'xPASS  all 201 foreign keys hold.\n',
    'FAIL  something\n',
  ]) {
    const v = teardownVerdict({ status: 0, signal: null, stdout: BANNER + tail });
    assert.equal(v.ok, false, JSON.stringify(tail));
    assert.equal(v.reason, 'no-pass-line');
  }
});

test('the real audit, given an unreachable database, gives a verdict that fails', () => {
  const r = spawnSync(process.execPath, ['ops/scripts/fk-audit.mjs', '--known-test-leaks'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      DATABASE_URL_MIGRATE: 'postgres://u:p@127.0.0.1:1/x',
    },
    timeout: 30_000,
  });
  assert.equal(r.status, 2, r.stderr);
  const v = teardownVerdict({
    status: r.status,
    signal: r.signal,
    error: r.error,
    stdout: r.stdout,
  });
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'did-not-run');
});

test('global-teardown.ts throws on every verdict that is not ok', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(join(root, 'apps/api/test/global-teardown.ts'), 'utf8');
  assert.match(src, /import \{ teardownVerdict \} from '\.\/fk-teardown-verdict'/);
  assert.match(src, /if \(!verdict\.ok\) throw new Error\(verdict\.message\)/);
});
