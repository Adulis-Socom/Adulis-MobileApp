// The registered flows and the buyer-discovery battery (BUY-03A): hashes, allow-list, battery resolution,
// and that every fixture a battery names exists, is loadable in the order given, and does not conflict.
// Nothing here runs Maestro, a device or a stack.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SETS, loadSet } from '../fixtures/index.mjs';
import {
  ALLOWED_HAZARDS,
  flowHash,
  loadDeclaration,
  NEVER_HAZARDS,
  resolveBattery,
  scanFlow,
} from '../lib/flows.mjs';
import { makeIo, world } from './fakes.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FLOWS = join(repo, 'apps', 'mobile', '.maestro');
const decl = loadDeclaration(join(repo, 'ops', 'native', 'flows.json'));

const DISCOVERY = [
  'foundation-smoke',
  'buyer-scene-explorer',
  'catalogue-product-1',
  'catalogue-product-link',
  'shop',
  'search',
  'seller-profile',
  'seller-profile-private-1',
  'shop-refresh-1',
];

test('the smoke battery is exactly as it was', () => {
  assert.deepEqual(decl.batteries.smoke, {
    flows: ['foundation-smoke', 'buyer-shell'],
    settings: { stay_awake: '7' },
    canary: 'foundation-smoke',
    fixtures: ['baseline'],
  });
});

test('ten flows are registered: the two smoke flows and the eight data-only discovery flows', () => {
  assert.equal(Object.keys(decl.flows).length, 10);
  assert.deepEqual(
    Object.keys(decl.flows).sort(),
    [...new Set([...DISCOVERY, 'buyer-shell'])].sort(),
  );
  for (const [name, d] of Object.entries(decl.flows)) {
    assert.deepEqual(d.vars, [], `${name} needs no variable`);
    for (const h of d.hazards) assert.ok(ALLOWED_HAZARDS.includes(h), `${name}: ${h}`);
    assert.deepEqual(d.permissions, ['android.permission.ACCESS_LOCAL_NETWORK:allow'], name);
  }
});

test('every registered flow is pinned to its file, and the static scan agrees with its declaration', () => {
  for (const [name, d] of Object.entries(decl.flows)) {
    const buffer = readFileSync(join(FLOWS, d.file));
    assert.equal(flowHash(buffer), d.sha256, `${name}: pin`);
    const s = scanFlow(buffer.toString('utf8'));
    assert.equal(s.appId, decl.appId, name);
    assert.deepEqual(s.hazards, [...d.hazards].sort(), `${name}: hazards`);
    assert.deepEqual(s.permissions, [...d.permissions].sort(), `${name}: permissions`);
    assert.deepEqual(s.vars, [], `${name}: variables`);
    for (const h of s.hazards) assert.ok(!NEVER_HAZARDS.includes(h), `${name}: ${h}`);
  }
});

test('all 54 flow files scan cleanly: no never-hazard, only the declared command set', () => {
  const files = readdirSync(FLOWS).filter((f) => f.endsWith('.yaml'));
  assert.ok(files.length >= 54, 'the 54 flows of BUY-03A are still all there');
  for (const f of files) {
    const s = scanFlow(readFileSync(join(FLOWS, f), 'utf8'));
    assert.equal(s.appId, 'com.adulis.app', f);
    for (const h of s.hazards) assert.ok(ALLOWED_HAZARDS.includes(h), `${f}: ${h}`);
  }
});

test('the buyer-discovery battery resolves with no problem, canary first, and fixtures that exist', () => {
  const r = resolveBattery(decl, 'buyer-discovery', FLOWS);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(
    r.flows.map((f) => f.name),
    DISCOVERY,
  );
  assert.equal(r.battery.canary, 'foundation-smoke');
  assert.equal(r.battery.flows[0], r.battery.canary);
  assert.deepEqual(r.battery.settings, { stay_awake: '7' });
  assert.deepEqual(r.battery.fixtures, [
    'baseline',
    'catalogue-core',
    'scenes',
    'market-b',
    'extras',
  ]);
});

test('every fixture a battery names exists, comes after the sets it requires, and does not conflict', () => {
  for (const [name, b] of Object.entries(decl.batteries)) {
    const loaded = [];
    for (const f of b.fixtures ?? []) {
      assert.ok(Object.hasOwn(SETS, f), `${name}: ${f} exists`);
      for (const req of SETS[f].requires ?? [])
        assert.ok(loaded.includes(req), `${name}: ${f} requires ${req} before it`);
      for (const l of loaded)
        assert.ok(
          !SETS[f].conflicts.includes(l) && !SETS[l].conflicts.includes(f),
          `${name}: ${f} conflicts with ${l}`,
        );
      loaded.push(f);
    }
  }
});

test('the battery loads through loadSet in order, as the session does', async () => {
  const w = world();
  w.m.fixtures = [];
  let m = w.m;
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'native-bat-'));
  try {
    for (const f of decl.batteries['buyer-discovery'].fixtures)
      m = await loadSet(m, makeIo(w), f, { dir });
    assert.deepEqual(m.fixtures, decl.batteries['buyer-discovery'].fixtures);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a flow that needs a variable, a between-step or a sign-in continuation is not registered', () => {
  for (const f of readdirSync(FLOWS).filter((x) => x.endsWith('.yaml'))) {
    const name = f.replace(/\.yaml$/, '');
    if (!decl.flows[name]) continue;
    const scan = scanFlow(readFileSync(join(FLOWS, f), 'utf8'));
    assert.deepEqual(scan.vars, [], name);
    // A continuation never clears the app's data; every registered discovery flow starts from a clean install.
    assert.ok(
      scan.hazards.includes('clearState'),
      `${name} starts from clearState (no continuation)`,
    );
  }
  for (const n of [
    'buyer-auth-request',
    'account',
    'saved-guest-1',
    'catalogue-product-refresh',
    'messaging',
    'buyer-for-you',
  ])
    assert.equal(decl.flows[n], undefined, `${n} stays unregistered`);
});

test('the new sets refuse to write when the run identity does not match, for every set', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  for (const n of ['catalogue-core', 'scenes', 'market-b', 'extras', 'assistant']) {
    const w = world();
    w.m.fixtures = ['catalogue-core'].filter(() => n !== 'catalogue-core');
    w.pg.tcp = w.pg.tcp.replace(w.m.db.systemId, '1'); // ID-01: another server
    const dir = mkdtempSync(join(tmpdir(), 'native-iso-'));
    try {
      await assert.rejects(loadSet(w.m, makeIo(w), n, { dir }), /ID-01|identity|refused/i, n);
      assert.equal(w.pg.executed, undefined, `${n} wrote nothing`);
      assert.deepEqual(w.d.mutations, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});
