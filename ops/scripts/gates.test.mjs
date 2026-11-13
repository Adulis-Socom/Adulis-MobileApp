// The gate runner's own rules (WO-INFRA-004, hardened by the WO-INFRA-006 review).
// Run: node --test ops/scripts/gates.test.mjs (also the `gate-runner` gate). Imported with no scope
// filter, so the import spawns nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

delete process.env['ADULIS_SCOPE_FILTER'];
const { GATES, scopeDecision, gateEnv, DB_WRITING_GATES } = await import('./gates.mjs');
const gate = (id) => GATES.find((g) => g.id === id);
const script = fileURLToPath(new URL('./gates.mjs', import.meta.url));

test('the seed step, and only the seed step, declares NODE_ENV=test (ISSUE-INFRA-003)', () => {
  const steps = gate('migrate').steps;
  const seed = steps.find((s) => !Array.isArray(s) && s.cmd.join(' ') === 'pnpm db:seed');
  assert.deepEqual(seed?.env, { NODE_ENV: 'test' });
  assert.ok(
    steps.some((s) => Array.isArray(s) && s.join(' ') === 'pnpm db:migrate'),
    'db:migrate inherits, it is not forced',
  );
  assert.equal(gate('migrate').env, undefined, 'the environment is not set for the whole gate');
});

test('every gate that seeds, drops or resets declares its environment', () => {
  for (const id of ['determinism', 'console-e2e']) assert.equal(gate(id).env?.NODE_ENV, 'test', id);
});

test('the build gates do not force an environment (the console must build as production)', () => {
  for (const id of ['typecheck', 'build', 'test']) assert.equal(gate(id).env, undefined, id);
});

test('a gate environment is a default: it fills an unset NODE_ENV and never overrides one', () => {
  const d = { NODE_ENV: 'test' };
  assert.equal(gateEnv(d, {}).NODE_ENV, 'test');
  for (const v of ['staging', 'production'])
    assert.equal(gateEnv(d, { NODE_ENV: v }).NODE_ENV, v, v);
  const base = { A: '1' };
  assert.equal(gateEnv(undefined, base), base);
});

const RAW = '...[origin/main]';
const never = () => assert.fail('selection should not be consulted');

test('no filter: full run', () => {
  assert.equal(scopeDecision('', [], never).scope, '');
});

test('push to main (nothing changed against the base): full run, not zero packages', () => {
  const d = scopeDecision(RAW, [], () => []);
  assert.equal(d.scope, '');
  assert.match(d.why, /selects no package/);
});

test('root-only change (CI, ops, migrations, lockfile, tsconfig, non-Markdown docs): full run', () => {
  for (const f of [
    '.github/workflows/ci.yml',
    'ops/scripts/gates.mjs',
    'db/migrations/0057_x.sql',
    'pnpm-lock.yaml',
    'tsconfig.base.json',
    'docker-compose.yml',
    'docs/amendments/ADU-AUTH-01_v2_4_permission_seed.sql', // read by apps/api/test/permission-matrix.spec.ts
  ]) {
    const d = scopeDecision(RAW, [f], never);
    assert.equal(d.scope, '', f);
    assert.match(d.why, /root input/, f);
  }
});

test('a root input beside a package change still runs everything', () => {
  assert.equal(
    scopeDecision(RAW, ['apps/api/src/a.ts', 'db/migrations/0057_x.sql'], never).scope,
    '',
  );
});

test('package changes, with Markdown or .claude/ beside them, keep the scope', () => {
  const d = scopeDecision(
    RAW,
    ['apps/mobile/src/a.tsx', 'docs/mobile/WO.md', 'README.md', '.claude/settings.json'],
    () => ['@adulis/mobile', '@adulis/locale'],
  );
  assert.equal(d.scope, RAW);
  assert.deepEqual(d.selected, ['@adulis/mobile', '@adulis/locale']);
});

test('Markdown only: the filter selects nothing, so full run', () => {
  assert.equal(scopeDecision(RAW, ['docs/a.md', 'contracts/README.md'], () => []).scope, '');
});

test('git could not diff, or pnpm could not evaluate the filter: full run', () => {
  assert.equal(scopeDecision(RAW, null, never).scope, '');
  const d = scopeDecision(RAW, ['apps/api/src/a.ts'], () => null);
  assert.equal(d.scope, '');
  assert.match(d.why, /could not evaluate/);
});

test('run as a script, it actually runs: --list prints every gate (junction-safe main guard)', () => {
  const r = spawnSync(process.execPath, [script, '--list'], {
    encoding: 'utf8',
    env: { ...process.env },
  });
  assert.equal(r.status, 0);
  const ids = r.stdout
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split(/\s+/)[0]);
  assert.deepEqual(
    ids,
    GATES.map((g) => g.id),
  );
});

test('--only with an unknown or empty id fails instead of passing zero gates', () => {
  for (const arg of ['no-such-gate', '']) {
    const r = spawnSync(process.execPath, [script, '--only', arg], { encoding: 'utf8' });
    assert.equal(r.status, 2, `--only '${arg}'`);
    assert.doesNotMatch(r.stdout, /PASS {2}all/);
  }
});

test('a gate that writes to the database refuses an unmarked one before it runs (WO-INFRA-012)', () => {
  // Nothing listens on port 1: the mark cannot be read, so `migrate` must not start at all.
  const dead = 'postgres://nobody:none@127.0.0.1:1/none';
  const env = { ...process.env, DATABASE_URL: dead, DATABASE_URL_MIGRATE: dead };
  delete env.DATABASE_URL_JOBS;
  const r = spawnSync(process.execPath, [script, '--only', 'migrate'], { encoding: 'utf8', env });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /writes to the database, which could not be checked; nothing was run/);
  assert.doesNotMatch(r.stdout + r.stderr, /node-pg-migrate|PASS {2}all/);
});

test('the mark check refuses a configuration before connecting: unset, empty, remote, portless', () => {
  const check = fileURLToPath(new URL('./assert-disposable-db.mjs', import.meta.url));
  const ok = 'postgres://u:p@127.0.0.1:55432/adulis';
  for (const [over, why] of [
    [{ DATABASE_URL: undefined }, /DATABASE_URL is not set/],
    [{ DATABASE_URL_JOBS: '' }, /DATABASE_URL_JOBS is empty/],
    [{ DATABASE_URL: 'postgres://u:p@db.staging.example:5432/adulis' }, /not a loopback host/],
    [{ DATABASE_URL_MIGRATE: 'postgres://u:p@127.0.0.1/adulis' }, /no explicit port/],
  ]) {
    const env = { ...process.env, DATABASE_URL: ok, DATABASE_URL_MIGRATE: ok, ...over };
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
    if (!('DATABASE_URL_JOBS' in over)) delete env.DATABASE_URL_JOBS;
    const r = spawnSync(process.execPath, [check], { encoding: 'utf8', env });
    assert.equal(r.status, 1, JSON.stringify(over));
    assert.match(r.stderr, why);
  }
});

test('the database-writing gates are real gates, the writers among them', () => {
  for (const id of ['migrate', 'worker-schema', 'test', 'determinism', 'console-e2e']) assert.ok(DB_WRITING_GATES.has(id), id);
  for (const id of DB_WRITING_GATES) assert.ok(GATES.some((g) => g.id === id), `${id} is not a gate`);
});
