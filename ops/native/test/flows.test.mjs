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
  ALLOWED_PERMISSIONS,
  flowHash,
  loadDeclaration,
  NEVER_HAZARDS,
  resolveBattery,
  scanFlow,
  verifyFlowFile,
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
  assert.deepEqual(
    scan('# needs ${PHONE}\n- tapOn: Home').vars,
    [],
    'a variable named in a comment is not needed',
  );
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
    expression: "- inputText: ${http.get('https://example.test')}",
    'hardware-key': '- pressKey: Power',
    'unknown-command': '- frobnicate: x',
    unparseable: '- tapOn: [unclosed',
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
  // the same in flow style
  assert.deepEqual(scan('- runFlow: {when: {visible: X}, commands: [{tapOn: X}]}').hazards, []);
  assert.deepEqual(scan('- runFlow: {file: other.yaml}').hazards, ['runFlow-file']);
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
// resolveBattery with every flow that has no pin of its own pinned to the file as it is
const rb = (d, name, dir) => {
  const flows = Object.fromEntries(
    Object.entries(d.flows).map(([k, f]) => {
      let sha256 = f.sha256;
      if (!sha256)
        try {
          sha256 = flowHash(readFileSync(join(dir, f.file)));
        } catch {
          // no such file: resolveBattery reports it
        }
      return [k, { ...f, sha256 }];
    }),
  );
  return resolveBattery({ ...d, flows }, name, dir);
};

test('a declaration that states what the file does is accepted; one that states less, or more, is not', () => {
  const dir = tmpFlows({ 'a.yaml': flow('- launchApp:\n    clearState: true') });
  const ok = rb(decl({ a: { file: 'a.yaml', hazards: ['clearState'] } }), 'b', dir);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.flows[0].name, 'a');
  assert.match(
    rb(decl({ a: { file: 'a.yaml', hazards: [] } }), 'b', dir).problems.join(),
    /does to the device \[clearState\] but is declared as \[\]/,
  );
  assert.match(
    rb(
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
    rb(decl({ a: { file: 'a.yaml', hazards: ['clearState'] } }), 'b', dir).problems.join(),
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
    const p = rb(decl({ a: { file: 'a.yaml', hazards: [hazard] } }), 'b', dir).problems.join();
    assert.match(p, new RegExp(`uses '${hazard}', which no declaration can approve`), body);
  }
});

test('a flow that is not declared, a file name that leaves the directory, and a flow for another app are refused', () => {
  const dir = tmpFlows({
    'a.yaml': flow('- tapOn: X'),
    'c.yaml': flow('- tapOn: X', 'appId: com.other.app\n---\n'),
  });
  const d = decl({ a: { file: 'a.yaml', hazards: [] } });
  d.batteries.b.flows = ['a', 'ghost'];
  assert.match(rb(d, 'b', dir).problems.join(), /flow 'ghost' is not declared/);
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
      rb(decl({ a: { file, hazards: [] } }), 'b', dir).problems.join(),
      /plain flow file name/,
      JSON.stringify(file),
    );
  assert.match(
    rb(decl({ c: { file: 'c.yaml', hazards: [] } }), 'b', dir).problems.join(),
    /runs app com\.other\.app/,
  );
  assert.match(
    rb(
      { ...decl({ a: { file: 'a.yaml', hazards: [] } }), appId: 'com.other.app' },
      'b',
      dir,
    ).problems.join(),
    /declaration is for com\.other\.app/,
  );
  assert.match(rb(decl({}), 'nope', dir).problems.join(), /not a declared battery/);
  assert.match(
    rb(decl({ a: { file: 'missing.yaml', hazards: [] } }), 'b', dir).problems.join(),
    /cannot be read/,
  );
});

test('a battery names only flows it declares, a canary inside itself, and settings the driver may change', () => {
  const dir = tmpFlows({ 'a.yaml': flow('- tapOn: X') });
  const base = { a: { file: 'a.yaml', hazards: [] } };
  assert.deepEqual(
    rb(decl(base, { canary: 'a', settings: { stay_awake: '7' } }), 'b', dir).problems,
    [],
  );
  assert.match(
    rb(decl(base, { canary: 'z' }), 'b', dir).problems.join(),
    /canary flow 'z' is not in the battery/,
  );
  assert.match(
    rb(decl(base, { settings: { install_apps: '1' } }), 'b', dir).problems.join(),
    /not a setting the driver may change/,
  );
  assert.match(
    rb(decl(base, { settings: { font_scale: '9' } }), 'b', dir).problems.join(),
    /not valid/,
  );
  const withVars = tmpFlows({ 'v.yaml': flow('- inputText: ${PHONE}') });
  assert.match(
    rb(
      decl({ v: { file: 'v.yaml', hazards: [], vars: ['PHONE'] } }),
      'b',
      withVars,
    ).problems.join(),
    /variables: a battery with variables is not supported/,
  );
  assert.match(
    rb(decl({ v: { file: 'v.yaml', hazards: [] } }), 'b', withVars).problems.join(),
    /needs variables \[PHONE\]/,
  );
});

/* ---- the repository's own flows and declaration ---- */

test("the repository's declaration and its flow files agree: the smoke battery resolves with no problem", () => {
  const real = loadDeclaration(REAL_DECL);
  const r = rb(real, 'smoke', REAL_FLOWS);
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
    const r = rb({ ...real, batteries: { x: { flows: [n] } } }, 'x', REAL_FLOWS);
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

/* ---- the spellings a deny-list could miss, and the content pin ---- */

test('the string form of clearState, launchApp and stopApp names a package: another app is refused', () => {
  const cs = scan('- clearState: com.other.app');
  assert.ok(cs.hazards.includes('clearState') && cs.hazards.includes('foreign-app'));
  assert.ok(scan('- launchApp: com.other.app').hazards.includes('foreign-app'));
  assert.ok(scan('- stopApp: com.other.app').hazards.includes('foreign-app'));
  assert.ok(scan("- launchApp:\n    clearState: '${PKG}'").hazards.includes('foreign-app'));
  // this app's own id in the string form is not foreign
  assert.deepEqual(scan('- launchApp: com.adulis.app').hazards, []);
  assert.ok(!scan('- clearState: com.adulis.app').hazards.includes('foreign-app'));
});

test('the map form of openLink and a quoted link are read: an external URL is refused, an adulis link is not', () => {
  assert.ok(
    scan('- openLink:\n    link: https://example.test/x').hazards.includes('external-link'),
  );
  assert.ok(scan('- openLink: {link: https://example.test/x}').hazards.includes('external-link'));
  assert.ok(scan('- openLink: "https://example.test/x"').hazards.includes('external-link'));
  assert.deepEqual(scan('- openLink:\n    link: adulis://saved').hazards, []);
  assert.deepEqual(scan('- openLink: "adulis://saved"').hazards, []);
});

test('an expression that calls, indexes or reaches out is a script; a comparison of variables is not', () => {
  for (const bad of [
    "${http.get('https://example.test')}",
    "${json(http.get('https://example.test')).x}",
    '${output.value}',
    '${a + b}',
    '${require("fs")}',
  ])
    assert.ok(scan(`- inputText: ${bad}`).hazards.includes('expression'), bad);
  const ok = scan(
    '- runFlow:\n    when:\n      true: ${STEP == \'a\' || STEP != "b"}\n    commands:\n      - back',
  );
  assert.ok(!ok.hazards.includes('expression'));
  assert.deepEqual(ok.vars, ['STEP'], 'the variable of a comparison is a variable the flow needs');
  assert.deepEqual(scan('- assertVisible: ${maestro.platform}').hazards, []);
});

test('commands in flow style are read like commands in block style', () => {
  assert.ok(scan('- {runScript: steal.js}').hazards.includes('script'));
  assert.ok(scan('- { runScript: steal.js }').hazards.includes('script'));
  assert.ok(scan('- {clearState: true}').hazards.includes('clearState'));
  assert.ok(
    scan('- launchApp: {clearState: true, appId: com.other.app}').hazards.includes('foreign-app'),
  );
  assert.ok(
    scan('- repeat: {while: {notVisible: X}, commands: [{back: }]}').hazards.includes('loop-while'),
  );
  assert.ok(scan('- tapOn: X\n- {addMedia: [a.png]}').hazards.includes('media'));
  assert.ok(scan('- runFlow: {file: other.yaml}').hazards.includes('runFlow-file'));
});

test('a permission grant is read in block and flow style; one that is wider than the declared grant is refused', () => {
  const grant = (list) => `- launchApp:\n    permissions:\n${list}`;
  assert.deepEqual(
    scan(grant('      android.permission.ACCESS_LOCAL_NETWORK: allow')).permissions,
    ALLOWED_PERMISSIONS,
  );
  assert.deepEqual(scan(grant('      all: allow')).permissions, ['all:allow']);
  assert.deepEqual(scan('- launchApp: {permissions: {all: allow}}').permissions, ['all:allow']);
  assert.deepEqual(
    scan(
      grant(
        '      android.permission.ACCESS_LOCAL_NETWORK: allow\n      android.permission.CAMERA: allow',
      ),
    ).permissions,
    ['android.permission.ACCESS_LOCAL_NETWORK:allow', 'android.permission.CAMERA:allow'],
  );
  const dir = tmpFlows({
    'a.yaml': flow(grant('      android.permission.ACCESS_LOCAL_NETWORK: allow\n      all: allow')),
    'b.yaml': flow(grant('      android.permission.ACCESS_LOCAL_NETWORK: allow')),
  });
  const narrow = {
    file: 'a.yaml',
    hazards: ['permission-grant'],
    permissions: ALLOWED_PERMISSIONS,
  };
  assert.match(
    rb(decl({ a: narrow }), 'b', dir).problems.join(),
    /grants permissions \[all:allow, android\.permission\.ACCESS_LOCAL_NETWORK:allow\] but declares \[android\.permission\.ACCESS_LOCAL_NETWORK:allow\]/,
  );
  // a declaration may not name a grant outside the allowed one, even when the file matches it
  const wide = {
    file: 'a.yaml',
    hazards: ['permission-grant'],
    permissions: ['all:allow', ...ALLOWED_PERMISSIONS],
  };
  assert.match(
    rb(decl({ a: wide }), 'b', dir).problems.join(),
    /permission grant 'all:allow', which is not allowed/,
  );
  const good = { file: 'b.yaml', hazards: ['permission-grant'], permissions: ALLOWED_PERMISSIONS };
  assert.deepEqual(rb(decl({ b: good }), 'b', dir).problems, []);
  // a grant that cannot be read is never read as no grant
  const unreadable = scan('- launchApp:\n    permissions: all');
  assert.deepEqual(unreadable.permissions, ['(none readable)']);
  assert.ok(unreadable.hazards.includes('permission-grant'));
});

test('pressKey is for navigation keys; power, volume and lock keys are refused', () => {
  for (const key of ['Power', 'Volume Up', 'Volume Down', 'Lock', 'Camera'])
    assert.ok(scan(`- pressKey: ${key}`).hazards.includes('hardware-key'), key);
  assert.ok(scan('- {pressKey: Power}').hazards.includes('hardware-key'));
  assert.ok(scan('- pressKey:\n    key: Power').hazards.includes('hardware-key'));
  for (const key of ['Back', 'Home', 'Enter', 'Backspace', 'Tab', 'Escape'])
    assert.deepEqual(scan(`- pressKey: ${key}`).hazards, [], key);
});

test('a flow is run only if its content is the pinned one: a changed byte, a missing pin and a bad pin are refused', () => {
  const text = flow('- launchApp:\n    clearState: true');
  const dir = tmpFlows({ 'a.yaml': text });
  const pin = flowHash(Buffer.from(text));
  const d = (sha256) => decl({ a: { file: 'a.yaml', hazards: ['clearState'], sha256 } });
  assert.deepEqual(resolveBattery(d(pin), 'b', dir).problems, []);
  const other = flow('- launchApp:\n    clearState: true\n- tapOn: Home');
  writeFileSync(join(dir, 'a.yaml'), other);
  const changed = resolveBattery(d(pin), 'b', dir).problems.join();
  assert.match(changed, /the flow file changed: its content hash is [0-9a-f]{64}, the pin is /);
  assert.match(resolveBattery(d(undefined), 'b', dir).problems.join(), /has no content pin/);
  assert.match(resolveBattery(d('abc'), 'b', dir).problems.join(), /has no content pin/);
  // the check is made again on the file as it is NOW, which is what runs right before Maestro starts
  writeFileSync(join(dir, 'a.yaml'), text);
  assert.ok(verifyFlowFile(join(dir, 'a.yaml'), pin).buffer);
  writeFileSync(join(dir, 'a.yaml'), `${text}# edited\n`);
  assert.match(verifyFlowFile(join(dir, 'a.yaml'), pin).problem, /the flow file changed/);
  assert.match(verifyFlowFile(join(dir, 'missing.yaml'), pin).problem, /cannot be read/);
});

test('the pin ignores a checkout that turned LF into CRLF, and nothing else', () => {
  const text = flow('- tapOn: Home\n- back');
  assert.equal(flowHash(Buffer.from(text)), flowHash(Buffer.from(text.replaceAll('\n', '\r\n'))));
  assert.notEqual(flowHash(Buffer.from(text)), flowHash(Buffer.from(`${text} `)));
  const bytes = Buffer.from([0xe1, 0x8a, 0xa0, 0x0a, 0xff]);
  assert.match(
    flowHash(bytes),
    /^[0-9a-f]{64}$/,
    'bytes that are not UTF-8 are hashed as they are',
  );
});

test('the real declaration pins the real flow files, and the failure says how to re-pin', () => {
  const real = loadDeclaration(REAL_DECL);
  for (const [name, d] of Object.entries(real.flows)) {
    const got = flowHash(readFileSync(join(REAL_FLOWS, d.file)));
    assert.equal(
      got,
      d.sha256,
      `${name} changed: review it, then set "sha256": "${got}" in ops/native/flows.json`,
    );
  }
});

/* ---- the scan reads the YAML, not the spelling ---- */

const has = (body, hazard, head) => scan(body, head).hazards.includes(hazard);

test('whitespace before the colon changes nothing: every command is read as if it had none', () => {
  assert.ok(has('- clearState : com.other.app', 'foreign-app'));
  assert.ok(has('- clearState : com.other.app', 'clearState'));
  assert.ok(has('- launchApp : com.other.app', 'foreign-app'));
  assert.ok(has('- stopApp : com.other.app', 'foreign-app'));
  assert.ok(has('- openLink : https://example.test/x', 'external-link'));
  assert.ok(has('- openLink:\n    link : https://example.test/x', 'external-link'));
  assert.ok(has('- runFlow : other.yaml', 'runFlow-file'));
  assert.ok(has('- runFlow:\n    file : other.yaml', 'runFlow-file'));
  assert.ok(has('- pressKey : Power', 'hardware-key'));
  assert.ok(
    has('- repeat:\n    while :\n      notVisible: X\n    commands:\n      - back', 'loop-while'),
  );
  assert.ok(has('- launchApp:\n    appId : com.other.app', 'foreign-app'));
  assert.deepEqual(scan('- launchApp : {permissions : {all: allow}}').permissions, ['all:allow']);
  assert.deepEqual(scan('- launchApp:\n    permissions :\n      all : allow').permissions, [
    'all:allow',
  ]);
  assert.deepEqual(scan('- openLink : adulis://saved').hazards, []);
});

test('a value on the next line is read like a value on the same line', () => {
  assert.ok(has('- openLink:\n    https://example.test/x', 'external-link'));
  assert.ok(has('- clearState:\n    com.other.app', 'foreign-app'));
  assert.ok(has('- launchApp:\n    com.other.app', 'foreign-app'));
  assert.ok(has('- runFlow:\n    other.yaml', 'runFlow-file'));
  assert.ok(has('- pressKey:\n    Power', 'hardware-key'));
  assert.deepEqual(scan('- openLink:\n    adulis://saved').hazards, []);
});

test('quoted and escaped keys and values are read as what they say', () => {
  assert.ok(has('- "runScript": x.js', 'script'));
  assert.ok(has("- 'setAirplaneMode': enabled", 'airplane'));
  assert.ok(has('- "clearKeychain"', 'clearKeychain'));
  assert.ok(has('- "\\x72unScript": x.js', 'script'), 'a hex escape in a key');
  assert.ok(
    has('- inputText: "\\x24{http.get(\'https://example.test\')}"', 'expression'),
    'an escaped ${',
  );
  assert.ok(has('- "launchApp":\n    "appId": "com.other.app"', 'foreign-app'));
  assert.ok(has('- openLink: "https://example.test/x"', 'external-link'));
  assert.ok(has("- 'pressKey': 'Power'", 'hardware-key'));
  assert.deepEqual(scan('- "tapOn": "Home"').hazards, []);
});

test('an anchor or a tag before the key, or an alias of a value, does not hide a command', () => {
  assert.ok(has('- &c\n  runScript: x.js', 'script'));
  assert.ok(has('- !!map\n  runScript: x.js', 'script'));
  assert.ok(has('- &c {runScript: x.js}', 'script'));
  assert.ok(has('- launchApp:\n    appId: &p com.other.app\n- stopApp: *p', 'foreign-app'));
  assert.ok(has('- launchApp: &l\n    clearState: true\n- launchApp: *l', 'clearState'));
});

test('CRLF reads like LF; a lone CR cannot be read as a flow and is refused', () => {
  const body = '- runScript: x.js\n- clearState : com.other.app\n- tapOn: Home';
  const lf = scanFlow(`${HEAD}${body}\n`);
  assert.ok(lf.hazards.includes('script') && lf.hazards.includes('foreign-app'));
  assert.deepEqual(scanFlow(`${HEAD}${body}\n`.replaceAll('\n', '\r\n')), lf);
  const cr = scanFlow(`${HEAD}${body}\n`.replaceAll('\n', '\r'));
  assert.ok(
    cr.hazards.includes('unparseable'),
    'a flow that is not read is never read as harmless',
  );
  assert.notDeepEqual(cr.hazards, []);
});

test('a command or an option that is not on the list is refused: deny by default', () => {
  assert.ok(has('- frobnicate: x', 'unknown-command'));
  assert.ok(has('- assertTrue: ${A == B}', 'unknown-command'));
  assert.ok(has('- launchApp:\n    environment: x', 'unknown-command'));
  assert.ok(has('- launchApp: {arguments: {a: b}, flavour: x}', 'unknown-command'));
  assert.ok(has('- TapOn: Home', 'unknown-command'), 'names are case sensitive');
  assert.ok(has('- "runscript": x.js', 'unknown-command'));
  assert.deepEqual(scan('- tapOn: Home\n- back\n- takeScreenshot: a').hazards, []);
});

test('a file that cannot be read as a Maestro flow is refused: parse errors, shapes that are not commands', () => {
  for (const body of [
    '- tapOn: [unclosed',
    '- tapOn: a\n  back: b',
    '- {tapOn: a, back: b}',
    '- [tapOn, Home]',
    '- 12',
    '- launchApp:\n    clearState: true\n    clearState: false',
    'tapOn: Home',
    '- repeat: 3',
    '- runFlow: 3',
  ])
    assert.ok(has(body, 'unparseable'), body);
  assert.ok(scanFlow('- tapOn: Home\n').hazards.includes('unparseable'), 'no header document');
  assert.ok(
    scanFlow(`${HEAD}- tapOn: a\n---\n- runScript: x\n`).hazards.includes('unparseable'),
    'a third document',
  );
  assert.equal(scanFlow(`${HEAD}- tapOn: a\n`).appId, 'com.adulis.app');
  assert.equal(scanFlow('name: x\n---\n- back\n').appId, null);
});

test('a command nested in another command is read: runFlow, repeat, retry and the flow hooks', () => {
  assert.ok(has('- runFlow:\n    commands:\n      - runScript: x.js', 'script'));
  assert.ok(has('- repeat:\n    times: 2\n    commands:\n      - clearKeychain', 'clearKeychain'));
  assert.ok(
    has(
      '- retry:\n    maxRetries: 2\n    commands:\n      - setLocation:\n          latitude: 1',
      'location',
    ),
  );
  assert.ok(has('- retry:\n    file: other.yaml', 'runFlow-file'));
  assert.ok(has('', 'script', 'appId: com.adulis.app\nonFlowStart:\n  - runScript: x.js\n---\n'));
  assert.ok(has('', 'clearState', 'appId: com.adulis.app\nonFlowComplete:\n  - clearState\n---\n'));
  assert.ok(
    has(
      '- runFlow:\n    when:\n      visible: X\n    commands:\n      - tapOn: ${a.b}',
      'expression',
    ),
  );
  assert.deepEqual(
    scan('- runFlow:\n    when:\n      visible: X\n    commands:\n      - back').hazards,
    [],
  );
});

test('options and keys that mean something are read wherever they stand, and a command list must be a list', () => {
  assert.ok(has('- launchApp:\n    clearKeychain: true', 'clearKeychain'));
  assert.ok(!has('- launchApp:\n    clearKeychain: false', 'clearKeychain'));
  assert.ok(
    has('- tapOn:\n    link: https://example.test/x', 'external-link'),
    'a link key in any command',
  );
  assert.ok(!has('- tapOn:\n    link: adulis://saved', 'external-link'));
  assert.ok(has('- runFlow:\n    commands: tapOn', 'unparseable'), 'commands that is not a list');
  assert.ok(has('- repeat:\n    times: 2\n    commands: back', 'unparseable'));
});

test('an expression that never closes, or that sits in a key or the header, is not a variable', () => {
  assert.ok(has("- inputText: ${http.get('x')", 'expression'));
  assert.ok(has('- tapOn:\n    ${a.b}: x', 'expression'));
  assert.ok(has('', 'expression', 'appId: com.adulis.app\nenv:\n  A: ${a.b}\n---\n'));
  assert.deepEqual(scan('- inputText: ${PHONE} and ${OTP}').vars, ['OTP', 'PHONE']);
});

test('a permission grant that is a list or empty cannot be read and is never read as no grant', () => {
  assert.deepEqual(scan('- launchApp:\n    permissions: []').permissions, ['(none readable)']);
  assert.deepEqual(scan('- launchApp:\n    permissions: {}').permissions, ['(none readable)']);
  assert.deepEqual(scan('- launchApp:\n    permissions:').permissions, ['(none readable)']);
});

test('every flow in the repository directory is read as YAML: none is unparseable, and the approved ones carry no refused hazard', () => {
  const files = readdirSync(REAL_FLOWS).filter((f) => f.endsWith('.yaml'));
  assert.ok(files.length > 40, `${files.length} flows`);
  const unparseable = files.filter((f) =>
    scanFlow(readFileSync(join(REAL_FLOWS, f), 'utf8')).hazards.includes('unparseable'),
  );
  assert.deepEqual(unparseable, [], 'a flow that cannot be read is a flow nobody can approve');
  const real = loadDeclaration(REAL_DECL);
  for (const d of Object.values(real.flows)) {
    const scan = scanFlow(readFileSync(join(REAL_FLOWS, d.file), 'utf8'));
    assert.deepEqual(
      scan.hazards.filter((h) => NEVER_HAZARDS.includes(h)),
      [],
      d.file,
    );
  }
});
