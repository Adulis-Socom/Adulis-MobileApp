// A whole native session against fakes: conditions, journaled settings, the approved flows, evidence and
// restoration, and what happens when the device, a flow, the process or the harness fails in the middle.
// Nothing here is a device result: it proves the driver's logic, never the app.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeAdb } from '../lib/adb.mjs';
import { appendEntry, summarize } from '../lib/journal.mjs';
import { reapOrphan } from '../lib/lock.mjs';
import { flowHash } from '../lib/flows.mjs';
import { journalProblems, restoreOpen } from '../lib/restore.mjs';
import { acquireLock, countAppDevices, lockHeld, releaseLock, runNative } from '../lib/session.mjs';
import { fakeDevice, initialState, junit, SERIAL } from './fake-device.mjs';
import { PROTECTED_PORTS } from '../lib/protected.mjs';
import { nativeWorld } from './native-world.mjs';

const worlds = [];
const nw = (o) => {
  const x = nativeWorld(o);
  worlds.push(x);
  return x;
};
after(() => worlds.forEach((x) => x.done()));
const snap = (d) =>
  JSON.stringify({
    s: d.st.settings,
    density: d.st.density,
    night: d.st.night,
    locales: d.st.locales,
    reverse: d.st.reverse,
    drivers: d.st.maestroDrivers,
  });
const CHANGE =
  /settings (put|delete)|wm density \d|wm density reset|uimode night \w|airplane-mode|set-app-locales|reverse (tcp|--remove)/;
const changes = (d) => d.st.log.filter((l) => CHANGE.test(l));
const go = (x, extra = {}) => runNative({ ...x.args(), ...extra });
const sessionDir = (x) => {
  const names = readdirSync(join(x.dir, 'native'));
  assert.equal(names.length, 1, 'one session directory');
  return join(x.dir, 'native', names[0]);
};

/* ---- the whole session ---- */

test('a session on a good emulator runs both approved flows, leaves evidence, and puts every setting back', async () => {
  const x = nw();
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, 0, r.status);
  assert.equal(
    r.status,
    'HARNESS OK - native run (2 PASS, 0 FAIL, 0 NOT EXECUTED); device settings restored',
  );
  assert.equal(snap(x.dev), before, 'the device is as it was');
  assert.deepEqual(
    r.record.flows.map((f) => [f.flow, f.verdict]),
    [
      ['foundation-smoke', 'PASS'],
      ['buyer-shell', 'PASS'],
    ],
  );
  assert.deepEqual(journalProblems(x.dir), []);
  assert.ok(!existsSync(join(x.dir, 'native.lock')), 'the lock is released');
  assert.equal(x.maestro.calls.length, 2);
  assert.ok(x.maestro.calls.every((c) => c.args[c.args.indexOf('--device') + 1] === SERIAL));
  assert.match(
    x.maestro.calls[0].args.at(-1),
    /foundation-smoke\.yaml$/,
    'the canary flow runs first',
  );
  const s = sessionDir(x);
  for (const f of ['conditions.json', 'build.json', 'device.json', 'result.json'])
    assert.ok(existsSync(join(s, f)), f);
  for (const flow of ['foundation-smoke', 'buyer-shell'])
    for (const f of ['report.xml', 'maestro.log', 'logcat.txt', 'attempt.json'])
      assert.ok(existsSync(join(s, flow, 'attempt-1', f)), `${flow} ${f}`);
  const build = JSON.parse(readFileSync(join(s, 'build.json'), 'utf8'));
  assert.equal(
    build.apk.sha256,
    x.dev.st.pkg.apkSha,
    'the build record names the APK that was installed',
  );
  assert.deepEqual(build.apk.abis, ['x86_64']);
  assert.match(build.fingerprint, /^[0-9a-f]{64}$/);
  const result = JSON.parse(readFileSync(join(s, 'result.json'), 'utf8'));
  assert.deepEqual(result.restoration.failed, []);
  assert.equal(result.sha, x.args().sha);
  assert.deepEqual(result.maestroDriversBefore, result.maestroDriversAfter);
});

test("the settings are changed only after the conditions, and in the journal first: stay-awake and the run's three reverse entries", async () => {
  const x = nw();
  let during = null;
  x.maestro.calls.length = 0;
  const first = x.io.maestro;
  x.io.maestro = async (o) => {
    during ??= {
      settings: { ...x.dev.st.settings },
      reverse: [...x.dev.st.reverse],
      open: summarize(x.dir).open.map((c) => c.setting),
    };
    return first(o);
  };
  await go(x);
  assert.equal(during.settings['global/stay_on_while_plugged_in'], '7');
  assert.deepEqual(
    during.reverse.map((r) => r.remote).sort(),
    [`tcp:${x.w.m.ports.api}`, `tcp:${x.w.m.ports.s3}`, 'tcp:8081'].sort(),
  );
  assert.deepEqual(during.open, [
    'stay_awake',
    `reverse:${x.w.m.ports.api}`,
    `reverse:${x.w.m.ports.s3}`,
    'reverse:8081',
  ]);
});

test('a battery that changes many settings restores them all, and a failure at the Nth change restores the first N-1', async () => {
  const many = {
    font_scale: '1.3',
    animation_window: '0',
    animation_animator: '0',
    night_mode: 'yes',
    stay_awake: '7',
    rotation_auto: '0',
  };
  const x = nw();
  x.deps.decl.batteries.smoke.settings = many;
  const before = snap(x.dev);
  const ok = await go(x);
  assert.equal(ok.code, 0, ok.status);
  assert.equal(snap(x.dev), before);
  const y = nw();
  y.deps.decl.batteries.smoke.settings = many;
  y.dev.st.failOn = ['night mode', 'uimode night yes']; // the 4th change cannot be made
  const b2 = snap(y.dev);
  const r = await go(y);
  assert.equal(r.code, 3);
  assert.match(
    r.status,
    /^HARNESS INCOMPLETE - .*uimode night|^HARNESS INCOMPLETE - writing night mode failed/,
  );
  assert.match(r.status, /device settings restored$/);
  assert.equal(y.maestro.calls.length, 0, 'no flow runs on a half-prepared device');
  assert.equal(snap(y.dev), b2, 'the first three changes are back');
  assert.deepEqual(journalProblems(y.dir), []);
});

/* ---- refusals before anything is changed ---- */

const refused = async (x, code, re, what) => {
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, code, `${what}: ${r.status}`);
  assert.match(r.status, re, what);
  assert.deepEqual(changes(x.dev), [], `${what}: no device change was sent`);
  assert.equal(snap(x.dev), before, what);
  assert.equal(x.maestro.calls.length, 0, `${what}: Maestro never started`);
  assert.ok(!existsSync(join(x.dir, 'device-journal.ndjson')), `${what}: no journal was opened`);
  assert.ok(!existsSync(join(x.dir, 'native')), `${what}: no session directory`);
  return r;
};

test('no device attached: BLOCKED, nothing started', async () => {
  const x = nw();
  x.dev.st.attached = false;
  await refused(
    x,
    4,
    /^HARNESS BLOCKED - NC-01 device attached and authorised: no device is attached - NOTHING STARTED$/,
    'no device',
  );
});

test('an unauthorised device is BLOCKED; so is a lack of memory', async () => {
  const a = nw();
  a.dev.st.adbState = 'unauthorized';
  await refused(a, 4, /NC-01 .*unauthorized/, 'unauthorised');
  const b = nw();
  b.deps.freeBytes = () => 0.48 * 1024 ** 3;
  await refused(
    b,
    4,
    /^HARNESS BLOCKED - NC-07 free memory: free memory 0\.48 GB is below 6 GB - NOTHING STARTED$/,
    'memory',
  );
  const c = nw();
  c.deps.commitBytes = async () => 5.2 * 1024 ** 3;
  await refused(c, 4, /NC-08 commit headroom/, 'commit');
});

test('a device that is not an emulator and not allow-listed is refused, and nothing is sent to it but reads', async () => {
  const state = initialState();
  Object.assign(state, { serial: 'R58M1234ABC' });
  Object.assign(state.props, {
    'ro.kernel.qemu': '',
    'ro.boot.qemu': '',
    'ro.hardware': 'qcom',
    'ro.serialno': 'HW123',
    'ro.product.model': 'Pixel 7',
  });
  const x = nw({ deviceState: state });
  const args = x.args();
  args.serial = 'R58M1234ABC';
  const before = snap(x.dev);
  const r = await runNative(args);
  assert.equal(r.code, 1);
  assert.match(
    r.status,
    /^HARNESS REFUSED - NC-02 device identity: R58M1234ABC is not an emulator and is not on the allow-list/,
  );
  assert.deepEqual(changes(x.dev), []);
  assert.equal(snap(x.dev), before);
  assert.equal(x.maestro.calls.length, 0);
  // the same device, allow-listed and matching, passes the identity check
  x.deps.allowList = [
    { serial: 'R58M1234ABC', hardwareSerial: 'HW123', model: 'Pixel 7', disposable: true },
  ];
  const ok = await runNative({ ...args, onlyConditions: true });
  assert.equal(ok.code, 0, ok.status);
});

test('the wrong package id, a build that is not debuggable, and an APK that is not the installed one are all refused', async () => {
  const a = nw();
  writeFileSync(
    join(a.checkout, 'apps', 'mobile', 'app.json'),
    JSON.stringify({ expo: { android: { package: 'com.adulis.app.dev' } } }),
  );
  await refused(
    a,
    1,
    /^HARNESS REFUSED - NC-03 application identity: apps\/mobile\/app\.json names com\.adulis\.app\.dev/,
    'package id in app.json',
  );
  const b = nw();
  b.dev.st.pkg.debuggable = false;
  await refused(b, 1, /NC-03 application identity: .*not a debuggable build/, 'release build');
  const c = nw();
  c.dev.st.pkg.apkSha = '0'.repeat(64);
  await refused(c, 1, /NC-04 build verification: .*not the file that was named/, 'another APK');
  const d = nw();
  d.dev.st.pkg.installed = false;
  await refused(d, 1, /NC-03 application identity: .*is not installed/, 'not installed');
});

test('a CPU architecture that does not match the build, and native dependencies that changed since it, are refused', async () => {
  const a = nw({ apkAbis: ['arm64-v8a'] });
  await refused(
    a,
    1,
    /NC-04 build verification: .*APK holds arm64-v8a; the device is x86_64/,
    'architecture',
  );
  const b = nw();
  b.io.git = async (g) => {
    if (g[0] === 'show' && g[1].startsWith('b'.repeat(40)))
      return {
        status: 0,
        stdout: JSON.stringify({ dependencies: { expo: '~57.0.0' } }),
        stderr: '',
        error: null,
      };
    return {
      status: 0,
      stdout:
        g[0] === 'show' ? JSON.stringify({ dependencies: { expo: '~58.0.24' }, expo: {} }) : '',
      stderr: '',
      error: null,
    };
  };
  await refused(
    b,
    1,
    /NC-04 build verification: .*(dependencies of apps\/mobile changed|app\.json changed)/,
    'native dependencies',
  );
});

test('a manifest naming a protected port as any of its ports is refused before the device is touched', async () => {
  for (const port of PROTECTED_PORTS)
    for (const role of ['pg', 's3', 'api']) {
      const x = nw();
      x.w.m.ports[role] = port;
      const what = `protected port ${port} as the ${role} port`;
      const r = await refused(x, 1, /^HARNESS REFUSED - NC-0[56] /, what);
      const nc6 = r.results.find((c) => c.id === 'NC-06');
      assert.equal(nc6.verdict, 'FAIL', what);
      assert.match(nc6.detail, /protected port/, what);
    }
});

test("a device that already reverses a protected port or any port that is not the run's is refused, and no reverse call is made", async () => {
  for (const remote of [...PROTECTED_PORTS, 57999, 8080].map((p) => `tcp:${p}`)) {
    const x = nw();
    x.dev.st.reverse = [{ remote, local: remote }];
    const before = JSON.stringify(x.dev.st.reverse);
    await refused(x, 1, /^HARNESS REFUSED - NC-05 isolated endpoint: /, remote);
    assert.equal(JSON.stringify(x.dev.st.reverse), before, `${remote}: the entry was not touched`);
  }
});

test("an API address that is not this run's (a deployed host, another port) is refused; a Metro or an API that was never started blocks", async () => {
  for (const url of [
    'https://api.example.test',
    'http://localhost:3000',
    'http://10.0.2.2:57213',
    'http://localhost:9100',
  ]) {
    const x = nw();
    x.w.m.metro.apiUrl = url;
    await refused(x, 1, /^HARNESS REFUSED - NC-05 isolated endpoint: /, url);
  }
  const none = nw({ noMetro: true });
  await refused(
    none,
    4,
    /^HARNESS BLOCKED - NC-05 isolated endpoint: this run started no Metro \(run `metro start`\) - NOTHING STARTED$/,
    'no Metro',
  );
  const noApi = nw();
  delete noApi.w.m.api;
  await refused(
    noApi,
    4,
    /^HARNESS BLOCKED - NC-06 harness safety checks: this run started no API \(run `api start`\) - NOTHING STARTED$/,
    'no API',
  );
});

test("an API that is not this run's API (a wrong boot marker) is refused: the ten identity checks gate the device too", async () => {
  const x = nw();
  x.w.api.health.boot_marker = 'someone-elses-api';
  await refused(x, 1, /^HARNESS REFUSED - NC-06 harness safety checks: .*ID-04/, 'wrong API');
});

test('earlier changes that were never restored stop a new session, and are left exactly as they are', async () => {
  const x = nw();
  appendEntry(x.dir, { op: 'begin', run: 'r', serial: SERIAL, device: {} });
  appendEntry(x.dir, {
    op: 'intend',
    id: 'c1',
    setting: 'font_scale',
    original: { present: true, value: '1.0' },
    target: { present: true, value: '1.3' },
  });
  const text = readFileSync(join(x.dir, 'device-journal.ndjson'), 'utf8');
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, 1);
  assert.match(r.status, /NC-11 restoration provable: 1 earlier change\(s\) are not restored/);
  assert.equal(
    readFileSync(join(x.dir, 'device-journal.ndjson'), 'utf8'),
    text,
    'the journal is untouched',
  );
  assert.equal(snap(x.dev), before);
  assert.deepEqual(changes(x.dev), []);
});

test('a session already running on the run (a live lock) blocks; a lock whose process is gone does not', async () => {
  const x = nw();
  writeFileSync(join(x.dir, 'native.lock'), JSON.stringify({ pid: 4999, createdAt: 'alive' }));
  x.w.proc.byPid[4999] = { createdAt: 'alive', commandLine: 'node harness.mjs' };
  await refused(
    x,
    4,
    /NC-12 no other native session: another native session holds this run \(pid 4999\)/,
    'live lock',
  );
  const y = nw();
  writeFileSync(join(y.dir, 'native.lock'), JSON.stringify({ pid: 4999, createdAt: 'long ago' }));
  const r = await go(y);
  assert.equal(r.code, 0, r.status);
  assert.ok(!existsSync(join(y.dir, 'native.lock')));
});

test('conditions only: a passing check changes nothing, starts nothing, and says the device was not tested', async () => {
  const x = nw();
  const before = snap(x.dev);
  const r = await go(x, { onlyConditions: true });
  assert.deepEqual([r.code, r.status], [0, 'NATIVE CONDITIONS MET - DEVICE TESTING NOT EXECUTED']);
  assert.deepEqual(changes(x.dev), []);
  assert.equal(snap(x.dev), before);
  assert.equal(x.maestro.calls.length, 0);
  assert.ok(
    !existsSync(join(x.dir, 'native')) && !existsSync(join(x.dir, 'device-journal.ndjson')),
  );
});

test('an unknown battery, or a flow file that gained a hazard, is refused before the device is looked at', async () => {
  const a = nw();
  const r = await go(a, { batteryName: 'everything' });
  assert.equal(r.code, 1);
  assert.match(r.status, /flows: 'everything' is not a declared battery/);
  assert.ok(
    !a.dev.st.log.length || a.dev.st.log.every((l) => !l.startsWith('-s')),
    'no device was addressed',
  );
  const b = nw();
  writeFileSync(
    join(b.checkout, 'apps', 'mobile', '.maestro', 'buyer-shell.yaml'),
    `${readFileSync(join(b.checkout, 'apps', 'mobile', '.maestro', 'buyer-shell.yaml'), 'utf8')}\n- runScript: steal.js\n`,
  );
  const r2 = await go(b);
  assert.equal(r2.code, 1);
  assert.match(r2.status, /^HARNESS REFUSED - flows: flow 'buyer-shell': the flow file changed/);
  assert.deepEqual(r2.problems.length, 1, 'a flow that is not the pinned one is not read further');
  assert.doesNotMatch(r2.problems.join(' | '), /uses 'script'/);
  assert.equal(b.maestro.calls.length, 0);
  // re-pinned (a reviewed change to the declaration), the scan refuses the hazard whatever the pin says
  const edited = join(b.checkout, 'apps', 'mobile', '.maestro', 'buyer-shell.yaml');
  b.deps.decl.flows['buyer-shell'].sha256 = flowHash(readFileSync(edited));
  const r3 = await go(b);
  assert.equal(r3.code, 1);
  assert.match(r3.status, /flow 'buyer-shell' uses 'script', which no declaration can approve/);
  assert.equal(b.maestro.calls.length, 0);
});

/* ---- failures in the middle ---- */

test('a flow whose assertion fails is a FAIL (exit 5) and the device is still put back; the next flow still runs', async () => {
  const x = nw({
    maestro: async (n) => {
      if (n === 1)
        return {
          status: 1,
          junit: junit({ failures: 1, name: 'buyer-shell' }),
          log: 'Assertion is false',
        };
      x.w.pg.canary = String(Number(x.w.pg.canary) + 1);
      return { status: 0, junit: junit() };
    },
  });
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, 5);
  assert.equal(
    r.status,
    'HARNESS TEST FAILED - native run (1 PASS, 1 FAIL, 0 NOT EXECUTED); device settings restored',
  );
  assert.equal(snap(x.dev), before);
  assert.ok(existsSync(join(sessionDir(x), 'buyer-shell', 'attempt-1', 'failure.png')));
  assert.equal(x.maestro.calls.length, 2, 'a failing flow is not retried');
});

test('an app crash during a flow is a FAIL, the device log is kept, and the device is put back', async () => {
  const x = nw({
    maestro: async (n) => {
      x.w.pg.canary = String(Number(x.w.pg.canary) + 1);
      if (n === 1)
        x.dev.st.logcat.push(
          '11-19 10:00:01.000 1 1 E AndroidRuntime: FATAL EXCEPTION: main',
          '11-19 10:00:01.001 1 1 E AndroidRuntime: Process: com.adulis.app, PID: 9',
        );
      return { status: n === 1 ? 1 : 0, junit: junit() };
    },
  });
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, 5);
  assert.equal(r.record.flows[1].kind, 'crash');
  assert.match(
    readFileSync(join(sessionDir(x), 'buyer-shell', 'attempt-1', 'logcat.txt'), 'utf8'),
    /FATAL EXCEPTION/,
  );
  assert.equal(snap(x.dev), before);
});

test('an infrastructure error is retried once and passes; if it persists the flow and the rest are NOT EXECUTED, with no loop', async () => {
  let n1 = 0;
  const a = nw({
    maestro: async (n) => {
      if (n === 0) return { status: 1, log: 'Device is offline' };
      a.w.pg.canary = String(Number(a.w.pg.canary) + 1);
      n1 += 1;
      return { status: 0, junit: junit() };
    },
  });
  const r = await go(a);
  assert.equal(r.code, 0, r.status);
  assert.equal(a.maestro.calls.length, 3, 'one retry of the first flow, then the second flow');
  assert.equal(n1, 2);
  const b = nw({ maestro: async () => ({ status: 1, log: 'adb server is out of date' }) });
  const before = snap(b.dev);
  const r2 = await go(b);
  assert.equal(r2.code, 3);
  assert.match(
    r2.status,
    /^HARNESS INCOMPLETE - the battery did not finish \(0 PASS, 0 FAIL, 2 NOT EXECUTED\); device settings restored$/,
  );
  assert.equal(b.maestro.calls.length, 2, 'two attempts of the first flow and nothing else');
  assert.equal(r2.record.flows[1].why, 'an earlier flow could not run (infrastructure)');
  assert.equal(snap(b.dev), before);
});

test("the canary: a flow that passes while this run's database gains no device means the app is not talking to this API", async () => {
  const x = nw({ maestro: async () => ({ status: 0, junit: junit() }) }); // never registers a device
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, 5);
  assert.equal(r.record.flows[0].verdict, 'FAIL');
  assert.equal(r.record.flows[0].kind, 'canary');
  assert.match(r.record.flows[0].why, /not talking to this run's API/);
  assert.equal(r.record.flows[1].verdict, 'NOT EXECUTED');
  assert.equal(x.maestro.calls.length, 1);
  assert.equal(snap(x.dev), before);
});

test("the device count comes from this run's own database through its container, by full id", async () => {
  const x = nw();
  x.w.pg.canary = '3';
  assert.equal(await countAppDevices(x.w.m, x.io), 3);
  const sent = x.io.calls
    .filter((c) => c.startsWith('docker exec') && c.includes('core.device'))
    .at(-1);
  assert.ok(
    sent.includes(x.w.m.containers.postgres.id),
    'addressed by the recorded full container id',
  );
  assert.ok(sent.includes(x.w.m.db.name));
  x.w.pg.canary = 'garbage';
  await assert.rejects(countAppDevices(x.w.m, x.io), /could not be read/);
});

test("the baseline fixtures are loaded through the harness's own guarded channel when the run lacks them", async () => {
  const x = nw({ fixtures: [] });
  const r = await go(x);
  assert.equal(r.code, 0, r.status);
  assert.equal(x.w.pg.committed.length, 1, 'one guarded transaction');
  assert.match(x.w.pg.committed[0], /native run identity mismatch/, 'behind the identity guard');
  assert.deepEqual(JSON.parse(readFileSync(join(x.dir, 'manifest.json'), 'utf8')).fixtures, [
    'baseline',
  ]);
  const y = nw();
  await go(y);
  assert.equal(y.w.pg.committed.length, 0, 'already loaded: nothing is written');
});

/* ---- interruption, cancellation, crash of the device or of the process ---- */

test('an interruption during a flow stops Maestro, starts no further flow, restores the device and ends INCOMPLETE', async () => {
  const ac = new AbortController();
  const x = nw({
    maestro: async () => {
      ac.abort();
      return { aborted: true, status: null };
    },
  });
  x.deps.signal = ac.signal;
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, 3);
  assert.match(
    r.status,
    /^HARNESS INCOMPLETE - interrupted \(0 PASS, 0 FAIL, 2 NOT EXECUTED\); device settings restored$/,
  );
  assert.equal(x.maestro.calls.length, 1);
  assert.equal(r.record.flows[1].why, 'cancelled');
  assert.equal(snap(x.dev), before);
  assert.deepEqual(journalProblems(x.dir), []);
  assert.ok(!existsSync(join(x.dir, 'native.lock')));
});

test('the prepared device is checked again: a foreign reverse entry that appears after preparation stops the session before any flow', async () => {
  const x = nw();
  const inner = x.io.adb;
  x.io.adb = async (a) => {
    const r = await inner(a);
    if (a.join(' ').includes('input keyevent 224'))
      x.dev.st.reverse.push({ remote: 'tcp:57999', local: 'tcp:57999' });
    return r;
  };
  const r = await go(x);
  assert.equal(r.code, 3);
  assert.match(
    r.status,
    /^HARNESS INCOMPLETE - the prepared device no longer passes: HARNESS REFUSED - NC-05 /,
  );
  assert.equal(x.maestro.calls.length, 0);
  assert.deepEqual(
    x.dev.st.reverse,
    [{ remote: 'tcp:57999', local: 'tcp:57999' }],
    "only the foreign entry is left: this run's own entries were restored",
  );
  assert.equal(x.dev.st.settings['global/stay_on_while_plugged_in'], '0');
  assert.deepEqual(journalProblems(x.dir), []);
});

test('a cancellation before the first flow still restores what was prepared', async () => {
  const ac = new AbortController();
  const x = nw();
  const apply = x.io.adb;
  x.io.adb = async (a) => {
    if (a.join(' ').includes('input keyevent 224')) ac.abort(); // cancelled right after the device was prepared
    return apply(a);
  };
  x.deps.signal = ac.signal;
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, 3);
  assert.match(r.status, /interrupted/);
  assert.equal(x.maestro.calls.length, 0);
  assert.equal(snap(x.dev), before);
});

test('a failure to put a setting back is reported explicitly, makes the run INCOMPLETE, and leaves the journal to replay later', async () => {
  const x = nw({
    maestro: async () => {
      x.w.pg.canary = String(Number(x.w.pg.canary) + 1);
      x.dev.st.denyPut = ['global/stay_on_while_plugged_in']; // the device stops accepting the restore
      return { status: 0, junit: junit() };
    },
  });
  const r = await go(x);
  assert.equal(r.code, 3);
  assert.match(
    r.status,
    /^HARNESS INCOMPLETE - restoration FAILED for 1: stay_awake \(.*\); run `device restore --run native-\d{8}-[0-9a-f]{8} --serial emulator-5554`$/,
  );
  assert.equal(
    x.dev.st.settings['global/stay_on_while_plugged_in'],
    '7',
    'the setting is still the one the run made',
  );
  assert.deepEqual(x.dev.st.reverse, [], 'the reverse entries were restored all the same');
  assert.equal(summarize(x.dir).open.length, 1);
  // later: the device accepts it again and the journal alone puts it back
  x.dev.st.denyPut = [];
  const later = await restoreOpen({ dir: x.dir, adb: makeAdb(x.dev.io, SERIAL) });
  assert.deepEqual([later.restored, later.failed], [['stay_awake'], []]);
  assert.equal(x.dev.st.settings['global/stay_on_while_plugged_in'], '0');
  assert.deepEqual(journalProblems(x.dir), []);
});

test('the device disappears in the middle: the run is INCOMPLETE with the restoration failure named, and a later replay completes it', async () => {
  const x = nw({
    maestro: async () => {
      x.dev.st.attached = false; // unplugged, crashed, closed
      return { status: 1, error: new Error('spawn failed') };
    },
  });
  const r = await go(x);
  assert.equal(r.code, 3);
  assert.match(r.status, /restoration FAILED for 4: .*cannot be reached/);
  assert.equal(summarize(x.dir).open.length, 4);
  x.dev.st.attached = true;
  const later = await restoreOpen({ dir: x.dir, adb: makeAdb(x.dev.io, SERIAL) });
  assert.deepEqual(later.failed, []);
  assert.equal(x.dev.st.settings['global/stay_on_while_plugged_in'], '0');
  assert.deepEqual(x.dev.st.reverse, []);
});

test('a harness process that is killed in the middle of a flow leaves a journal the next process restores from, and a stale lock', async () => {
  const x = nw();
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(x.tmp, 'child-dir.txt');
  const file = join(x.tmp, 'device.json');
  const child = spawnSync(process.execPath, [join(here, 'kill-session-child.mjs'), file, out], {
    encoding: 'utf8',
  });
  assert.ok(child.status !== 0 || child.signal, `the child was killed: ${child.stderr}`);
  assert.ok(!/KILL-SESSION-SURVIVED/.test(child.stdout));
  const dir = readFileSync(out, 'utf8');
  worlds.push({
    done: () => rmSync(join(dir, '..', '..', '..'), { recursive: true, force: true }),
  });
  const d = fakeDevice({ file });
  assert.equal(
    d.st.settings['global/stay_on_while_plugged_in'],
    '7',
    'the device was left changed',
  );
  assert.ok(d.st.reverse.length === 3);
  assert.equal(summarize(dir).open.length, 4);
  const stale = await lockHeld(dir, x.io);
  assert.equal(stale.held, false, 'the dead process does not hold the lock');
  const back = await restoreOpen({ dir, adb: makeAdb(d.io, SERIAL) });
  assert.deepEqual(back.failed, []);
  assert.equal(d.st.settings['global/stay_on_while_plugged_in'], '0');
  assert.deepEqual(d.st.reverse, []);
  assert.deepEqual(journalProblems(dir), []);
});

test("the session lock: a live holder refuses a second session, a dead holder's lock is replaced, release removes it", async () => {
  const x = nw();
  const me = await acquireLock(x.dir, x.io);
  assert.equal(me.pid, process.pid);
  await assert.rejects(acquireLock(x.dir, x.io, process.pid), /another native session/);
  releaseLock(x.dir);
  assert.ok(!existsSync(join(x.dir, 'native.lock')));
  writeFileSync(join(x.dir, 'native.lock'), JSON.stringify({ pid: 31337, createdAt: 'gone' }));
  const again = await acquireLock(x.dir, x.io);
  assert.equal(again.pid, process.pid);
});

/* ---- the flow gate, errors before the session began, other runs, and a Maestro that will not stop ---- */

test('a flow file that changes after the checks passed is refused right before it runs: no further flow, the device is put back', async () => {
  const buyer = (x) => join(x.checkout, 'apps', 'mobile', '.maestro', 'buyer-shell.yaml');
  const x = nw({
    maestro: async () => {
      x.w.pg.canary = String(Number(x.w.pg.canary) + 1);
      // the second flow's file is edited while the first one runs
      writeFileSync(buyer(x), `${readFileSync(buyer(x), 'utf8')}\n- runScript: steal.js\n`);
      return { status: 0, junit: junit() };
    },
  });
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, 3);
  assert.match(
    r.status,
    /^HARNESS INCOMPLETE - flow 'buyer-shell': the flow file changed: its content hash is [0-9a-f]{64}, the pin is [0-9a-f]{64} \(review it and re-pin it in flows\.json\) \(1 PASS, 0 FAIL, 0 NOT EXECUTED\); device settings restored$/,
  );
  assert.equal(x.maestro.calls.length, 1, 'the changed flow was never started');
  assert.equal(snap(x.dev), before, 'the device is as it was');
  assert.deepEqual(journalProblems(x.dir), []);
  assert.ok(!existsSync(join(x.dir, 'native.lock')));
});

test("an error before the session began says nothing was changed, never that settings were restored, and keeps the refusal's own code", async () => {
  // a process that cannot be identified takes no lock: a check that could not be made (2)
  const a = nw();
  delete a.w.proc.byPid[process.pid];
  const ra = await go(a);
  assert.equal(ra.code, 2);
  assert.equal(
    ra.status,
    'HARNESS REFUSED - refused: this process could not be identified for the session lock (could not be checked) - NO RESOURCE WAS CHANGED',
  );
  assert.deepEqual(changes(a.dev), []);
  assert.ok(!existsSync(join(a.dir, 'device-journal.ndjson')), 'no journal was opened');
  assert.ok(!existsSync(join(a.dir, 'native.lock')));
  assert.equal(a.maestro.calls.length, 0);

  // another session takes the lock between the checks and the start: a refusal (1)
  const b = nw();
  const look = b.io.proc.info;
  b.io.proc.info = async (p) => {
    if (p === process.pid) {
      writeFileSync(join(b.dir, 'native.lock'), JSON.stringify({ pid: 4999, createdAt: 'alive' }));
      b.w.proc.byPid[4999] = { createdAt: 'alive', commandLine: 'node harness.mjs' };
    }
    return look(p);
  };
  const rb = await go(b);
  assert.equal(rb.code, 1);
  assert.equal(
    rb.status,
    'HARNESS REFUSED - refused: another native session (pid 4999) holds this run - NO RESOURCE WAS CHANGED',
  );
  assert.ok(existsSync(join(b.dir, 'native.lock')), "the other session's lock is not removed");
  assert.deepEqual(changes(b.dev), []);
  assert.ok(!existsSync(join(b.dir, 'device-journal.ndjson')));

  // an unexpected error (the process lookup itself fails): code 2, and still no claim of a restore
  const c = nw();
  const look2 = c.io.proc.info;
  c.io.proc.info = async (p) => {
    if (p === process.pid) throw new Error('powershell failed');
    return look2(p);
  };
  const rc = await go(c);
  assert.equal(rc.code, 2);
  assert.equal(rc.status, 'HARNESS ERROR - powershell failed - NO RESOURCE WAS CHANGED');
  assert.deepEqual(changes(c.dev), []);
  for (const r of [ra, rb, rc]) assert.doesNotMatch(r.status, /restored/);
});

test('"settings restored" is said only when a restore ran and found something to put back', async () => {
  const x = nw();
  x.dev.st.failOn = ['settings put global stay_on_while_plugged_in']; // the very first change cannot be made
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, 3);
  assert.equal(snap(x.dev), before);
  assert.equal(x.maestro.calls.length, 0);
  const said = /device settings restored$/.test(r.status);
  const nothing = /no device setting was left changed$/.test(r.status);
  assert.ok(said !== nothing, r.status);
  // the words follow what the restoration did, not the fact that it ran
  assert.equal(
    said,
    r.record.restoration.restored.length + r.record.restoration.unchanged.length > 0,
    r.status,
  );
});

test("another run's open device changes on the same device stop a new session, and are left exactly as they are", async () => {
  const other = (x, name, serial = SERIAL) => {
    const d = join(x.root, 'runs', name);
    appendEntry(d, { op: 'begin', run: name, serial, device: {} });
    appendEntry(d, {
      op: 'intend',
      id: 'c1',
      setting: 'font_scale',
      original: { present: true, value: '1.0' },
      target: { present: true, value: '1.3' },
    });
    return d;
  };
  const x = nw();
  const d = other(x, 'native-20261117-aaaaaaaa');
  const text = readFileSync(join(d, 'device-journal.ndjson'), 'utf8');
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, 1);
  assert.match(
    r.status,
    /NC-11 restoration provable: run native-20261117-aaaaaaaa still has 1 device change\(s\) not restored on this device: run `device restore --run native-20261117-aaaaaaaa` first/,
  );
  assert.equal(
    readFileSync(join(d, 'device-journal.ndjson'), 'utf8'),
    text,
    'their journal is untouched',
  );
  assert.equal(snap(x.dev), before);
  assert.deepEqual(changes(x.dev), []);
  assert.equal(x.maestro.calls.length, 0);
  // the same run's own journal is not "another run", and another device's journal does not count
  const y = nw();
  other(y, 'native-20261117-bbbbbbbb', 'R58M1234ABC');
  const ry = await go(y);
  assert.equal(ry.code, 0, ry.status);
  // an unusable journal of another run for this device is named, not skipped
  const z = nw();
  const dz = other(z, 'native-20261117-cccccccc');
  appendFileSync(
    join(dz, 'device-journal.ndjson'),
    `${JSON.stringify({ v: 1, seq: 9, prev: 'x', op: 'end' })}\n`,
  );
  const rz = await go(z);
  assert.equal(rz.code, 1);
  assert.match(
    rz.status,
    /run native-20261117-cccccccc has an unusable device journal that may belong to this device/,
  );
});

test('a Maestro process that will not stop keeps its identity in the lock, ends the run INCOMPLETE, starts nothing more, and the next start finds it', async () => {
  const x = nw({
    maestro: async () => ({ status: null, stuck: true, error: new Error('did not stop') }),
  });
  x.w.proc.byPid[4321] = { createdAt: 'm-created', commandLine: 'java maestro.cli.AppKt' };
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, 3);
  assert.match(
    r.status,
    /^HARNESS INCOMPLETE - the Maestro process 4321 could not be stopped \(its identity stays in the lock: `device restore` stops it; /,
  );
  assert.equal(x.maestro.calls.length, 1, 'no other flow and no retry was started over it');
  assert.equal(r.record.flows[1].verdict, 'NOT EXECUTED');
  assert.equal(r.record.flows[1].why, 'a Maestro process could not be stopped');
  assert.equal(snap(x.dev), before, 'the device was still put back');
  const lock = JSON.parse(readFileSync(join(x.dir, 'native.lock'), 'utf8'));
  assert.deepEqual(lock.maestro, {
    pid: 4321,
    createdAt: 'm-created',
    commandLine: 'java maestro.cli.AppKt',
  });
  // the harness process is gone, the Maestro process is not: the next session is refused
  delete x.w.proc.byPid[process.pid];
  const again = await go(x);
  assert.equal(again.code, 4);
  assert.match(again.status, /NC-12 no other native session: a Maestro process \(pid 4321\)/);
  assert.equal(x.maestro.calls.length, 1);
  // and `reapOrphan` stops it by that identity and clears the lock
  const reaped = await reapOrphan(x.dir, x.io, { tries: 2, delayMs: 0 });
  assert.deepEqual(reaped, { stopped: true, pid: 4321 });
  assert.ok(!existsSync(join(x.dir, 'native.lock')));
});

test('a Maestro process that ended normally leaves no trace in the lock, and the lock is gone with the session', async () => {
  const x = nw();
  x.w.proc.byPid[4321] = { createdAt: 'm-created', commandLine: 'java maestro.cli.AppKt' };
  let during = null;
  const inner = x.io.maestro;
  const before = [];
  x.io.maestro = async (o) => {
    // what the lock says when a flow is about to start: nothing of an earlier flow's process
    before.push(JSON.parse(readFileSync(join(x.dir, 'native.lock'), 'utf8')).maestro);
    const res = await inner(o);
    during ??= JSON.parse(readFileSync(join(x.dir, 'native.lock'), 'utf8'));
    return res;
  };
  const r = await go(x);
  assert.equal(r.code, 0, r.status);
  assert.equal(during.maestro.pid, 4321, 'while the flow ran the lock named the process');
  assert.deepEqual(before, [undefined, undefined], 'the record is cleared when each process ended');
  assert.ok(!existsSync(join(x.dir, 'native.lock')));
});

/* ---- device facts that cannot be read, journals nobody can read, a Maestro that cannot be recorded ---- */

test('device facts that cannot be read once the checks passed are a check that could not be made: exit 2, nothing changed', async () => {
  const x = nw();
  let reads = 0;
  const inner = x.io.adb;
  x.io.adb = async (a) => {
    if (a.join(' ').includes('getprop ro.hardware') && (reads += 1) > 1)
      return { status: 1, stdout: '', stderr: 'cannot read', error: null };
    return inner(a);
  };
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, 2);
  assert.match(
    r.status,
    /^HARNESS REFUSED - the device facts could not be read: .* \(could not be checked\) - NO RESOURCE WAS CHANGED$/,
  );
  assert.equal(snap(x.dev), before);
  assert.deepEqual(changes(x.dev), []);
  assert.ok(!existsSync(join(x.dir, 'native.lock')));
});

test("another run's journal that cannot be read, or that is unusable before it names its device, stops a new session", async () => {
  // a journal path that is a directory cannot be read
  const a = nw();
  mkdirSync(join(a.root, 'runs', 'native-20261117-dddddddd', 'device-journal.ndjson'), {
    recursive: true,
  });
  const ra = await go(a);
  assert.equal(ra.code, 1);
  assert.match(
    ra.status,
    /run native-20261117-dddddddd has an unusable device journal \(?that may belong to this device|run native-20261117-dddddddd has an unusable device journal that may belong/,
  );
  // a journal that is wrong from its first line names no device: it may be this one
  const b = nw();
  const d = join(b.root, 'runs', 'native-20261117-eeeeeeee');
  mkdirSync(d, { recursive: true });
  writeFileSync(
    join(d, 'device-journal.ndjson'),
    `${JSON.stringify({ v: 1, seq: 1, prev: 'wrong', op: 'begin' })}\n`,
  );
  const rb = await go(b);
  assert.equal(rb.code, 1);
  assert.match(rb.status, /run native-20261117-eeeeeeee has an unusable device journal/);
  assert.deepEqual(changes(b.dev), []);
  // a run directory with no journal at all is nothing
  const c = nw();
  mkdirSync(join(c.root, 'runs', 'native-20261117-ffffffff'), { recursive: true });
  assert.equal((await go(c)).code, 0);
});

test('a Maestro process that cannot be recorded in the lock stops the session before any flow result: INCOMPLETE, the device is put back', async () => {
  const x = nw();
  delete x.w.proc.byPid[4321]; // the lock cannot name the process
  const before = snap(x.dev);
  const r = await go(x);
  assert.equal(r.code, 3);
  assert.match(
    r.status,
    /^HARNESS INCOMPLETE - the Maestro process 4321 could not be recorded in the session lock \(the Maestro process 4321 could not be identified: it is not recorded\); it was stopped \(0 PASS, 0 FAIL, 0 NOT EXECUTED\); device settings restored$/,
  );
  assert.equal(x.maestro.calls.length, 1, 'no second flow was started');
  assert.equal(snap(x.dev), before);
  assert.deepEqual(journalProblems(x.dir), []);
});
