// The flows a native run may execute: the Maestro files are the source of the allow-list, never the list.
// A flow that does more to the device than its declaration says, a flow that is not declared, and a
// hazard no declaration can approve are all refused; the real flow files are pinned against the real
// declaration so a change to either is noticed here.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_HAZARDS,
  loadDeclaration,
  NEVER_HAZARDS,
  resolveBattery,
  scanFlow,
} from '../lib/flows.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REAL_FLOWS = join(repo, 'apps', 'mobile', '.maestro');
const REAL_DECL = join(repo, 'ops', 'native', 'flows.json');
const dirs = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const HEAD = 'appId: com.adulis.app\nname: X\n---\n';
const flow = (body, head = HEAD) => `${head}${body}\n`;
const scan = (body, head) => scanFlow(flow(body, head));

test('comments are not code, and every hazard has its own spelling', () => {
  assert.deepEqual(scan('# clearState: true\n# - runScript: x\n- tapOn: Home').hazards, []);
  assert.deepEqual(scan('- launchApp:\n    clearState: true').hazards, ['clearState']);
  assert.deepEqual(scan('- launchApp:\n    clearState: false').hazards, []);
  assert.deepEqual(scan('- clearState').hazards, ['clearState']);
  assert.deepEqual(
    scan('- launchApp:\n    permissions:\n      android.permission.ACCESS_LOCAL_NETWORK: allow')
      .hazards,
    ['permission-grant'],
  );
  assert.deepEqual(
    scan('- repeat:\n    while:\n      notVisible: X\n    commands:\n      - back').hazards,
    ['loop-while'],
  );
  assert.deepEqual(scan('- stopApp').hazards, ['app-stop']);
  assert.deepEqual(scan('- openLink: adulis://saved').hazards, []);
  const never = {
    clearKeychain: '- clearKeychain',
    script: '- runScript: x.js',
    'runFlow-file': '- runFlow: other.yaml',
    media: '- addMedia:\n    - a.png',
    location: '- setLocation:\n    latitude: 1',
    airplane: '- setAirplaneMode: enabled',
    orientation: '- setOrientation: LANDSCAPE',
    recording: '- startRecording: x',
    'cloud-ai': '- assertWithAI:\n    assertion: x',
    clipboard: '- copyTextFrom: a',
    'external-link': '- openLink: https://example.test/',
    'foreign-app': '- launchApp:\n    appId: com.other.app',
  };
  for (const [name, body] of Object.entries(never))
    assert.ok(scan(body).hazards.includes(name), `${name}: ${body}`);
  assert.deepEqual(
    Object.keys(never).sort(),
    [...NEVER_HAZARDS].sort(),
    'every hazard that is never approved has a case here',
  );
});

test('an inline runFlow block with commands is not a file load; a runFlow of a file is', () => {
  const inline = '- runFlow:\n    when:\n      visible: X\n    commands:\n      - tapOn: X';
  assert.deepEqual(scan(inline).hazards, []);
  assert.deepEqual(scan('- runFlow:\n    file: other.yaml').hazards, ['runFlow-file']);
});

test("variables a flow needs are listed, and Maestro's own are not", () => {
  assert.deepEqual(
    scan('- inputText: ${PHONE}\n- tapOn: ${OTP}\n- assertVisible: ${maestro.platform}').vars,
    ['OTP', 'PHONE'],
  );
});

const tmpFlows = (files) => {
  const d = mkdtempSync(join(tmpdir(), 'native-f-'));
  dirs.push(d);
  mkdirSync(d, { recursive: true });
  for (const [n, t] of Object.entries(files)) writeFileSync(join(d, n), t);
  return d;
};
const decl = (flows, battery = {}) => ({
  appId: 'com.adulis.app',
  flows,
  batteries: { b: { flows: Object.keys(flows), ...battery } },
});

test('a declaration that states what the file does is accepted; one that states less, or more, is not', () => {
  const dir = tmpFlows({ 'a.yaml': flow('- launchApp:\n    clearState: true') });
  const ok = resolveBattery(decl({ a: { file: 'a.yaml', hazards: ['clearState'] } }), 'b', dir);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.flows[0].name, 'a');
  assert.match(
    resolveBattery(decl({ a: { file: 'a.yaml', hazards: [] } }), 'b', dir).problems.join(),
    /does to the device \[clearState\] but is declared as \[\]/,
  );
  assert.match(
    resolveBattery(
      decl({ a: { file: 'a.yaml', hazards: ['clearState', 'app-stop'] } }),
      'b',
      dir,
    ).problems.join(),
    /declared as \[clearState, app-stop\]/,
  );
});

test('a flow that later gains a hazard is refused until it is declared again', () => {
  const dir = tmpFlows({
    'a.yaml': flow(
      '- launchApp:\n    clearState: true\n    permissions:\n      android.permission.X: allow',
    ),
  });
  assert.match(
    resolveBattery(
      decl({ a: { file: 'a.yaml', hazards: ['clearState'] } }),
      'b',
      dir,
    ).problems.join(),
    /permission-grant/,
  );
});

test('a hazard on the never list is refused even when it is declared', () => {
  for (const [body, hazard] of [
    ['- runScript: x.js', 'script'],
    ['- addMedia:\n    - a.png', 'media'],
    ['- assertWithAI:\n    assertion: x', 'cloud-ai'],
    ['- openLink: https://example.test', 'external-link'],
    ['- runFlow: other.yaml', 'runFlow-file'],
    ['- launchApp:\n    appId: com.other.app', 'foreign-app'],
  ]) {
    const dir = tmpFlows({ 'a.yaml': flow(body) });
    const p = resolveBattery(
      decl({ a: { file: 'a.yaml', hazards: [hazard] } }),
      'b',
      dir,
    ).problems.join();
    assert.match(
      p,
      new RegExp(`'${hazard}'.*no declaration can approve|declares '${hazard}'`),
      body,
    );
  }
});

test('a flow that is not declared, a file name that leaves the directory, and a flow for another app are refused', () => {
  const dir = tmpFlows({
    'a.yaml': flow('- tapOn: X'),
    'c.yaml': flow('- tapOn: X', 'appId: com.other.app\n---\n'),
  });
  const d = decl({ a: { file: 'a.yaml', hazards: [] } });
  d.batteries.b.flows = ['a', 'ghost'];
  assert.match(resolveBattery(d, 'b', dir).problems.join(), /flow 'ghost' is not declared/);
  for (const file of [
    '../a.yaml',
    '..\\a.yaml',
    'sub/a.yaml',
    'A.yaml',
    'a.yml',
    'a.yaml ',
    '/etc/x.yaml',
    'a.yaml\0',
  ])
    assert.match(
      resolveBattery(decl({ a: { file, hazards: [] } }), 'b', dir).problems.join(),
      /plain flow file name/,
      JSON.stringify(file),
    );
  assert.match(
    resolveBattery(decl({ c: { file: 'c.yaml', hazards: [] } }), 'b', dir).problems.join(),
    /runs app com\.other\.app/,
  );
  assert.match(
    resolveBattery(
      { ...decl({ a: { file: 'a.yaml', hazards: [] } }), appId: 'com.other.app' },
      'b',
      dir,
    ).problems.join(),
    /declaration is for com\.other\.app/,
  );
  assert.match(resolveBattery(decl({}), 'nope', dir).problems.join(), /not a declared battery/);
  assert.match(
    resolveBattery(decl({ a: { file: 'missing.yaml', hazards: [] } }), 'b', dir).problems.join(),
    /cannot be read/,
  );
});

test('a battery names only flows it declares, a canary inside itself, and settings the driver may change', () => {
  const dir = tmpFlows({ 'a.yaml': flow('- tapOn: X') });
  const base = { a: { file: 'a.yaml', hazards: [] } };
  assert.deepEqual(
    resolveBattery(decl(base, { canary: 'a', settings: { stay_awake: '7' } }), 'b', dir).problems,
    [],
  );
  assert.match(
    resolveBattery(decl(base, { canary: 'z' }), 'b', dir).problems.join(),
    /canary flow 'z' is not in the battery/,
  );
  assert.match(
    resolveBattery(decl(base, { settings: { install_apps: '1' } }), 'b', dir).problems.join(),
    /not a setting the driver may change/,
  );
  assert.match(
    resolveBattery(decl(base, { settings: { font_scale: '9' } }), 'b', dir).problems.join(),
    /not valid/,
  );
  const withVars = tmpFlows({ 'v.yaml': flow('- inputText: ${PHONE}') });
  assert.match(
    resolveBattery(
      decl({ v: { file: 'v.yaml', hazards: [], vars: ['PHONE'] } }),
      'b',
      withVars,
    ).problems.join(),
    /variables: a battery with variables is not supported/,
  );
  assert.match(
    resolveBattery(decl({ v: { file: 'v.yaml', hazards: [] } }), 'b', withVars).problems.join(),
    /needs variables \[PHONE\]/,
  );
});

/* ---- the repository's own flows and declaration ---- */

test("the repository's declaration and its flow files agree: the smoke battery resolves with no problem", () => {
  const real = loadDeclaration(REAL_DECL);
  const r = resolveBattery(real, 'smoke', REAL_FLOWS);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(
    r.flows.map((f) => f.name),
    ['foundation-smoke', 'buyer-shell'],
  );
  for (const f of r.flows) {
    assert.deepEqual(f.scan.hazards, ['clearState', 'permission-grant'], f.name);
    assert.deepEqual(f.scan.vars, [], f.name);
  }
  assert.equal(r.battery.canary, 'foundation-smoke');
});

test('the declaration approves only flows that exist, only allowed hazards, and nothing for another app', () => {
  const real = loadDeclaration(REAL_DECL);
  const files = new Set(readdirSync(REAL_FLOWS));
  for (const [name, d] of Object.entries(real.flows)) {
    assert.ok(files.has(d.file), `${name}: ${d.file} exists`);
    for (const h of d.hazards) assert.ok(ALLOWED_HAZARDS.includes(h), `${name}: ${h}`);
  }
  assert.equal(real.appId, 'com.adulis.app');
  for (const b of Object.values(real.batteries))
    for (const f of b.flows) assert.ok(real.flows[f], f);
});

test('no repository flow is approved by being in the directory: every other flow is refused as undeclared', () => {
  const real = loadDeclaration(REAL_DECL);
  const others = readdirSync(REAL_FLOWS)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace(/\.yaml$/, ''))
    .filter((n) => !real.flows[n]);
  assert.ok(others.length > 40, `${others.length} other flows exist`);
  for (const n of others) {
    const r = resolveBattery({ ...real, batteries: { x: { flows: [n] } } }, 'x', REAL_FLOWS);
    assert.match(r.problems.join(), /is not declared/, n);
  }
});

test("the declaration fits the files: the two smoke flows clear state, and the scan agrees with the README's count", () => {
  const cleared = readdirSync(REAL_FLOWS)
    .filter((f) => f.endsWith('.yaml'))
    .filter((f) =>
      scanFlow(readFileSync(join(REAL_FLOWS, f), 'utf8')).hazards.includes('clearState'),
    );
  assert.ok(cleared.includes('foundation-smoke.yaml') && cleared.includes('buyer-shell.yaml'));
  const readme = readFileSync(join(REAL_FLOWS, 'README.md'), 'utf8');
  assert.match(
    readme,
    new RegExp(`${cleared.length} flows clear the app's data`),
    'the README states how many flows clear the data',
  );
});
