// The gate runner's own rules (WO-INFRA-004). Run: node --test ops/scripts/gates.test.mjs
// (also the `gate-runner` gate). Imported with no scope filter, so the import spawns nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';

delete process.env['ADULIS_SCOPE_FILTER'];
const { GATES, scopeDecision } = await import('./gates.mjs');
const gate = (id) => GATES.find((g) => g.id === id);

test('the seed step, and only the seed step, runs with NODE_ENV=test (ISSUE-INFRA-003)', () => {
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

const RAW = '...[origin/main]';
const never = () => assert.fail('selection should not be consulted');

test('no filter: full run', () => {
  assert.equal(scopeDecision('', [], never).scope, '');
});

test('push to main (nothing changed against the base): full run, not zero packages', () => {
  const d = scopeDecision(RAW, [], () => 0);
  assert.equal(d.scope, '');
  assert.match(d.why, /selects no package/);
});

test('root-only change (CI, ops, migrations, lockfile, tsconfig): full run', () => {
  for (const f of [
    '.github/workflows/ci.yml',
    'ops/scripts/gates.mjs',
    'db/migrations/0057_x.sql',
    'pnpm-lock.yaml',
    'tsconfig.base.json',
    'docker-compose.yml',
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

test('package changes, with or without docs, keep the scope', () => {
  const d = scopeDecision(
    RAW,
    ['apps/mobile/src/a.tsx', 'docs/mobile/WO.md', 'README.md', '.claude/settings.json'],
    () => 2,
  );
  assert.equal(d.scope, RAW);
  assert.match(d.why, /2 package/);
});

test('documentation only: the filter selects nothing, so full run', () => {
  assert.equal(scopeDecision(RAW, ['docs/a.md', 'contracts/README.md'], () => 0).scope, '');
});

test('git could not diff: full run', () => {
  assert.equal(scopeDecision(RAW, null, never).scope, '');
});
