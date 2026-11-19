// May a native run start? One test per condition, each breaking ONE thing, and the mapping of the
// results onto the harness's exit scheme: a rule that fails is REFUSED (1), one that could not be checked
// is exit 2, a resource that is missing is BLOCKED (4) and nothing is started.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adbEnvProblems,
  allowListProblems,
  decide,
  deviceIdentityProblems,
  evaluateConditions,
  NATIVE_CHECKS,
  NATIVE_LIMITS,
  reverseTableProblems,
} from '../lib/conditions.mjs';
import { MIN_FREE } from '../harness.mjs';
import { PROTECTED_PORTS } from '../lib/protected.mjs';
import { world } from './fakes.mjs';
import { SERIAL } from './fake-device.mjs';

const GB = 1024 ** 3;
const goodFacts = () => ({
  serial: SERIAL,
  devices: { devices: [{ serial: SERIAL, state: 'device' }] },
  identity: {
    qemu: '1',
    bootQemu: '1',
    hardware: 'ranchu',
    model: 'sdk_gphone64_x86_64',
    fingerprint: 'f',
    serialno: 'EMU1',
    avd: 'A',
    bootId: 'b',
    bootCompleted: '1',
  },
  allowList: [],
  build: {
    facts: { package: { installed: true, debuggable: true } },
    appJsonPackage: 'com.adulis.app',
    problems: [],
  },
  endpoint: { problems: [] },
  harness: {},
  free: {
    memory: 16 * GB,
    commit: 40 * GB,
    disks: [
      { where: 'root', free: 100 * GB },
      { where: 'tmp', free: 100 * GB },
    ],
  },
  toolchain: { adb: { version: '1.0.41' }, maestro: { problems: [] } },
  journal: { writable: true, open: [], corrupt: null },
  plan: { problems: [] },
  lock: { held: false },
  env: {},
});
const run = (patch = {}) => {
  const r = evaluateConditions({ ...goodFacts(), ...patch });
  return { r, d: decide(r), by: (id) => r.find((x) => x.id === id) };
};

test('every condition has an id, a name and a kind; the list is the documented thirteen', () => {
  assert.deepEqual(Object.keys(NATIVE_CHECKS), [
    'NC-01',
    'NC-02',
    'NC-03',
    'NC-04',
    'NC-05',
    'NC-06',
    'NC-07',
    'NC-08',
    'NC-09',
    'NC-10',
    'NC-11',
    'NC-12',
    'NC-13',
  ]);
  const { r } = run();
  assert.deepEqual(
    r.map((x) => x.id),
    Object.keys(NATIVE_CHECKS),
  );
  assert.ok(r.every((x) => x.name && ['safety', 'resource'].includes(x.kind)));
});

test('with everything in order every condition passes and nothing blocks the run', () => {
  const { r, d } = run();
  assert.deepEqual(
    r.filter((x) => x.verdict !== 'PASS'),
    [],
  );
  assert.deepEqual(d, { code: 0, line: null });
});

test("the thresholds are the ones the design names, and the memory one is the harness's own device limit", () => {
  assert.deepEqual(NATIVE_LIMITS, { memory: 6 * GB, commit: 8 * GB, disk: 10 * GB });
  assert.equal(NATIVE_LIMITS.memory, MIN_FREE.device);
});

/* ---- the device ---- */

test('NC-01: no device attached is a missing resource: BLOCKED, and the checks that need the device are BLOCKED with it', () => {
  const { d, by } = run({ devices: { devices: [] } });
  assert.equal(by('NC-01').verdict, 'FAIL');
  assert.match(by('NC-01').detail, /no device is attached/);
  for (const id of ['NC-02', 'NC-03', 'NC-04', 'NC-05', 'NC-11'])
    assert.equal(by(id).verdict, 'BLOCKED', id);
  assert.equal(d.code, 4);
  assert.match(
    d.line,
    /^HARNESS BLOCKED - NC-01 device attached and authorised: no device is attached - NOTHING STARTED$/,
  );
});

test('NC-01: an unauthorised or offline device, two devices, another serial, or no serial named are not a usable device', () => {
  assert.match(
    run({ devices: { devices: [{ serial: SERIAL, state: 'unauthorized' }] } }).by('NC-01').detail,
    /unauthorized.*authorise it on the device/,
  );
  assert.match(
    run({ devices: { devices: [{ serial: SERIAL, state: 'offline' }] } }).by('NC-01').detail,
    /offline/,
  );
  assert.match(
    run({
      devices: {
        devices: [
          { serial: SERIAL, state: 'device' },
          { serial: 'R58M1', state: 'device' },
        ],
      },
    }).by('NC-01').detail,
    /2 devices are attached/,
  );
  assert.match(
    run({ devices: { devices: [{ serial: 'R58M1', state: 'device' }] } }).by('NC-01').detail,
    /not the attached device/,
  );
  assert.match(run({ serial: undefined }).by('NC-01').detail, /no device serial was named/);
  const u = run({ devices: { error: 'adb devices failed: cannot connect' } });
  assert.equal(u.by('NC-01').verdict, 'UNKNOWN');
  assert.equal(u.d.code, 2);
});

test('NC-02: an emulator serial needs emulator hardware; anything else is on the allow-list with a matching hardware serial and model', () => {
  assert.equal(run().by('NC-02').verdict, 'PASS');
  const phoneAsEmu = run({
    identity: { ...goodFacts().identity, qemu: '', bootQemu: '', hardware: 'qcom' },
  });
  assert.equal(phoneAsEmu.by('NC-02').verdict, 'FAIL');
  assert.equal(phoneAsEmu.d.code, 1, 'a safety rule that fails is a refusal, not a block');
  const phone = { serial: 'R58M1234ABC', state: 'device' };
  const id = {
    qemu: '',
    bootQemu: '',
    hardware: 'qcom',
    model: 'Pixel 7',
    fingerprint: 'f',
    serialno: 'HW123',
    avd: '',
    bootId: 'b',
    bootCompleted: '1',
  };
  const entry = {
    serial: 'R58M1234ABC',
    hardwareSerial: 'HW123',
    model: 'Pixel 7',
    disposable: true,
  };
  const base = { serial: phone.serial, devices: { devices: [phone] }, identity: id };
  assert.match(
    run({ ...base, allowList: [] }).by('NC-02').detail,
    /not an emulator and is not on the allow-list/,
  );
  assert.equal(run({ ...base, allowList: [entry] }).by('NC-02').verdict, 'PASS');
  assert.match(
    run({ ...base, allowList: [{ ...entry, hardwareSerial: 'OTHER' }] }).by('NC-02').detail,
    /hardware serial 'HW123'/,
  );
  assert.match(
    run({ ...base, allowList: [{ ...entry, model: 'Pixel 8' }] }).by('NC-02').detail,
    /model is 'Pixel 7'/,
  );
  assert.match(
    run({ ...base, allowList: [{ ...entry, disposable: false }] }).by('NC-02').detail,
    /"disposable": true/,
  );
  assert.match(
    run({ ...base, allowList: [entry], identity: { ...id, qemu: '1' } }).by('NC-02').detail,
    /names an emulator/,
  );
});

test('the allow-list: hardware serials only, the operator states the device is disposable, no network address', () => {
  const ok = { serial: 'R58M1234ABC', hardwareSerial: 'HW1', model: 'M', disposable: true };
  assert.deepEqual(allowListProblems([ok]), []);
  assert.match(allowListProblems('x').join(), /not a list/);
  assert.match(
    allowListProblems([{ ...ok, serial: 'emulator-5554' }]).join(),
    /not a hardware serial/,
  );
  assert.match(
    allowListProblems([{ ...ok, serial: '10.0.0.5:5555' }]).join(),
    /not a hardware serial/,
  );
  assert.match(
    allowListProblems([{ ...ok, hardwareSerial: '' }]).join(),
    /hardwareSerial and model are required/,
  );
  assert.match(allowListProblems([{ ...ok, disposable: 'yes' }]).join(), /disposable/);
  assert.deepEqual(deviceIdentityProblems({ serial: undefined, identity: {}, allowList: [] }), [
    'no device serial was named: there is no default device',
  ]);
});

test('NC-03: the app must be installed, debuggable and named as app.json names it', () => {
  const b = (o) => ({ ...goodFacts().build, ...o });
  assert.match(
    run({ build: b({ facts: { package: { installed: false } } }) }).by('NC-03').detail,
    /not installed/,
  );
  assert.match(
    run({ build: b({ facts: { package: { installed: true, debuggable: false } } }) }).by('NC-03')
      .detail,
    /not a debuggable build/,
  );
  const wrong = run({ build: b({ appJsonPackage: 'com.adulis.app.dev' }) });
  assert.match(wrong.by('NC-03').detail, /app\.json names com\.adulis\.app\.dev/);
  assert.equal(wrong.d.code, 1);
  assert.equal(run({ build: { error: 'dumpsys failed' } }).by('NC-03').verdict, 'UNKNOWN');
});

test('NC-04: any problem of the build check fails it; NC-05: any problem of the endpoint check', () => {
  const b = run({
    build: { ...goodFacts().build, problems: ['the installed APK is not the file that was named'] },
  });
  assert.equal(b.by('NC-04').verdict, 'FAIL');
  assert.equal(b.d.code, 1);
  const e = run({
    endpoint: {
      problems: ["the device has the reverse entry tcp:9999 -> tcp:9999, which is not this run's"],
    },
  });
  assert.equal(e.by('NC-05').verdict, 'FAIL');
  assert.equal(e.d.code, 1);
  assert.equal(run({ endpoint: { error: 'listener lookup failed' } }).d.code, 2);
});

test('NC-05 and NC-06: a Metro or an API that was never started is a missing precondition (BLOCKED), not a refusal', () => {
  const m = run({ endpoint: { problems: [], blocked: 'this run started no Metro' } });
  assert.deepEqual([m.by('NC-05').verdict, m.d.code], ['BLOCKED', 4]);
  const a = run({ harness: { blocked: 'this run started no API' } });
  assert.deepEqual([a.by('NC-06').verdict, a.d.code], ['BLOCKED', 4]);
  const both = run({
    endpoint: {
      problems: ['the device has a foreign reverse entry'],
      blocked: 'this run started no Metro',
    },
  });
  assert.deepEqual(
    [both.by('NC-05').verdict, both.d.code],
    ['FAIL', 1],
    'a refusal outranks a block',
  );
});

test('NC-06: the ten identity checks must pass; a refusal fails, a check that could not run is unknown', () => {
  const f = run({ harness: { refused: 'refused API-WRITE: ID-04 API instance FAIL' } });
  assert.deepEqual([f.by('NC-06').verdict, f.d.code], ['FAIL', 1]);
  const u = run({ harness: { refused: 'refused API-WRITE: ID-01 UNKNOWN', unknownOnly: true } });
  assert.deepEqual([u.by('NC-06').verdict, u.d.code], ['UNKNOWN', 2]);
  assert.equal(run({ harness: { error: 'boom' } }).by('NC-06').verdict, 'UNKNOWN');
});

/* ---- the host ---- */

test('NC-07 to NC-09: memory, commit headroom and disk below the limit block the run; an unreadable value is unknown', () => {
  const m = run({ free: { ...goodFacts().free, memory: 0.48 * GB } });
  assert.match(m.by('NC-07').detail, /free memory 0\.48 GB is below 6 GB/);
  assert.equal(m.d.code, 4, 'a missing resource blocks and nothing is started');
  assert.match(
    run({ free: { ...goodFacts().free, memory: 6 * GB } }).by('NC-07').verdict,
    /PASS/,
    'the limit itself is enough',
  );
  assert.match(
    run({ free: { ...goodFacts().free, commit: 5.2 * GB } }).by('NC-08').detail,
    /commit headroom 5\.20 GB is below 8 GB/,
  );
  assert.match(
    run({
      free: {
        ...goodFacts().free,
        disks: [
          { where: 'root', free: 100 * GB },
          { where: 'tmp', free: 9 * GB },
        ],
      },
    }).by('NC-09').detail,
    /tmp has 9\.0 GB free, below 10 GB/,
  );
  for (const patch of [
    { memory: undefined },
    { commit: undefined },
    { disks: [] },
    { disks: [{ where: 'root', free: undefined }] },
  ]) {
    const u = run({ free: { ...goodFacts().free, ...patch } });
    assert.equal(u.d.code, 2, JSON.stringify(patch));
  }
});

test('NC-10: adb and Maestro with its Java must be present', () => {
  assert.match(
    run({ toolchain: { adb: { version: null }, maestro: { problems: [] } } }).by('NC-10').detail,
    /adb was not found/,
  );
  assert.match(
    run({
      toolchain: { adb: { version: '1.0.41' }, maestro: { problems: ['JAVA_HOME is not set'] } },
    }).by('NC-10').detail,
    /JAVA_HOME is not set/,
  );
  assert.equal(
    run({ toolchain: { adb: { version: '1.0.41' } } }).by('NC-10').verdict,
    'FAIL',
    'an unchecked Maestro is not a pass',
  );
});

/* ---- restoration, locks and the adb server ---- */

test('NC-11: restoration is provable only with a usable, writable journal, nothing open, and every original readable', () => {
  assert.match(
    run({ journal: { writable: true, open: [{}, {}], corrupt: null } }).by('NC-11').detail,
    /2 earlier change\(s\) are not restored/,
  );
  assert.match(
    run({ journal: { writable: true, open: [], corrupt: 'line 3 does not follow' } }).by('NC-11')
      .detail,
    /journal is unusable/,
  );
  assert.match(
    run({ journal: { writable: false, writeError: 'EACCES' } }).by('NC-11').detail,
    /cannot be written \(EACCES\)/,
  );
  assert.match(run({ journal: undefined }).by('NC-11').detail, /not checked/);
  assert.match(
    run({ plan: { problems: ['font_scale cannot be read: x'] } }).by('NC-11').detail,
    /font_scale cannot be read/,
  );
  assert.equal(run({ plan: { error: 'boom' } }).by('NC-11').verdict, 'UNKNOWN');
  assert.equal(run({ journal: { writable: true, open: [{}], corrupt: null } }).d.code, 1);
});

test('NC-12: another session on the run blocks; NC-13: a remote adb server is refused', () => {
  const l = run({ lock: { held: true, pid: 4242 } });
  assert.match(l.by('NC-12').detail, /another native session holds this run \(pid 4242\)/);
  assert.equal(l.d.code, 4);
  // any server selection is refused, a loopback one too: the driver and Maestro must share one adb server
  for (const env of [
    { ANDROID_ADB_SERVER_ADDRESS: '10.0.0.7' },
    { ANDROID_ADB_SERVER_ADDRESS: '127.0.0.1' },
    { ADB_SERVER_SOCKET: 'tcp:build-host:5037' },
    { ADB_SERVER_SOCKET: 'tcp:localhost:5037' },
    { ANDROID_ADB_SERVER_PORT: '5038' },
  ]) {
    const r = run({ env });
    assert.equal(r.by('NC-13').verdict, 'FAIL', JSON.stringify(env));
    assert.equal(r.d.code, 1);
  }
  assert.deepEqual(adbEnvProblems({ PATH: 'x', ANDROID_HOME: 'y' }), []);
  assert.match(
    adbEnvProblems({ ADB_SERVER_SOCKET: 'tcp:127.0.0.1.evil.example:5037' }).join(),
    /ADB_SERVER_SOCKET is set: the driver and Maestro would not use the same adb server/,
  );
});

test('NC-02: a device that has not finished booting is not identified, whatever else it reports', () => {
  const r = run({ identity: { ...goodFacts().identity, bootCompleted: '0' } });
  assert.equal(r.by('NC-02').verdict, 'FAIL');
  assert.match(r.by('NC-02').detail, /has not finished booting/);
  assert.equal(r.d.code, 1);
  assert.equal(run({ identity: { ...goodFacts().identity, bootCompleted: undefined } }).d.code, 1);
});

test('a fact that was never collected is UNKNOWN, never a pass: the stack check, the settings plan, the lock and the disks', () => {
  for (const [id, patch, detail] of [
    ['NC-06', { harness: undefined }, /stack and API checks were not run/],
    ['NC-11', { plan: undefined }, /settings the battery changes were not checked/],
    ['NC-12', { lock: undefined }, /session lock was not checked/],
    ['NC-09', { free: { ...goodFacts().free, disks: [{ where: 'root', free: NaN }] } }, /disk/],
    ['NC-07', { free: { ...goodFacts().free, memory: NaN } }, /could not be read/],
    ['NC-08', { free: { ...goodFacts().free, commit: NaN } }, /could not be read/],
  ]) {
    const r = run(patch);
    assert.equal(r.by(id).verdict, 'UNKNOWN', id);
    assert.match(r.by(id).detail, detail, id);
    assert.equal(r.d.code, 2, `${id} stops the run with the unknown-exit code`);
  }
  // each of them is a pass only when its fact is present and good
  assert.equal(run().by('NC-06').verdict, 'PASS');
  assert.equal(run().by('NC-11').verdict, 'PASS');
  assert.equal(run().by('NC-12').verdict, 'PASS');
});

test("NC-11 and NC-12 name another run's open changes and a Maestro process left behind by an earlier session", () => {
  const others = run({
    journal: {
      writable: true,
      open: [],
      corrupt: null,
      others: [
        { run: 'r-older', open: 2 },
        { run: 'r-broken', corrupt: 'line 2 does not follow' },
      ],
    },
  });
  assert.equal(others.by('NC-11').verdict, 'FAIL');
  assert.match(
    others.by('NC-11').detail,
    /run r-older still has 2 device change\(s\) not restored on this device: run `device restore --run r-older` first/,
  );
  assert.match(others.by('NC-11').detail, /run r-broken has an unusable device journal/);
  assert.equal(others.d.code, 1);
  const orphan = run({ lock: { held: false, orphan: { pid: 777 } } });
  assert.equal(orphan.by('NC-12').verdict, 'FAIL');
  assert.match(orphan.by('NC-12').detail, /Maestro process \(pid 777\).*run `device restore`/);
  assert.equal(orphan.d.code, 4);
  assert.match(
    run({ lock: { held: true, pid: 5, why: 'its lock file cannot be read' } }).by('NC-12').detail,
    /pid 5, its lock file cannot be read/,
  );
});

/* ---- the mapping onto the exit scheme ---- */

test('a safety refusal outranks an unknown, which outranks a missing resource', () => {
  const f = run({
    identity: { ...goodFacts().identity, hardware: 'qcom', qemu: '', bootQemu: '' },
    free: { ...goodFacts().free, memory: 1 * GB },
  });
  assert.equal(f.d.code, 1);
  assert.match(f.d.line, /^HARNESS REFUSED - NC-02 .* - NO RESOURCE WAS CHANGED$/);
  const u = run({ endpoint: { error: 'x' }, free: { ...goodFacts().free, memory: 1 * GB } });
  assert.equal(u.d.code, 2);
  assert.match(u.d.line, /\(could not be checked\) - NO RESOURCE WAS CHANGED$/);
  assert.equal(run({ free: { ...goodFacts().free, memory: 1 * GB } }).d.code, 4);
});

test("the addresses of the device are this run's: a protected port or a foreign entry in the reverse table is a problem, an unprepared table is not", () => {
  const m = world().m;
  const mine = [m.ports.api, m.ports.s3, 8081].map((p) => ({
    remote: `tcp:${p}`,
    local: `tcp:${p}`,
  }));
  assert.deepEqual(reverseTableProblems([], m, { prepared: false }), []);
  assert.deepEqual(reverseTableProblems(mine, m, { prepared: true }), []);
  assert.match(
    reverseTableProblems(mine.slice(1), m, { prepared: true }).join(),
    /is not reversed/,
  );
  for (const p of PROTECTED_PORTS)
    assert.match(
      reverseTableProblems([{ remote: `tcp:${p}`, local: `tcp:${p}` }], m, {
        prepared: false,
      }).join(),
      /protected port/,
      `${p}`,
    );
  assert.match(
    reverseTableProblems([{ remote: 'tcp:57999', local: 'tcp:57999' }], m, {
      prepared: false,
    }).join(),
    /not this run's/,
  );
  assert.match(
    reverseTableProblems([{ remote: `tcp:${m.ports.api}`, local: 'tcp:57999' }], m, {
      prepared: false,
    }).join(),
    /not this run's/,
  );
});

test('NC-12: a lock that cannot be read says what to do about it; a live session does not', () => {
  const unreadable = run({ lock: { held: true, unknown: true, why: 'the lock file is empty' } });
  assert.match(unreadable.by('NC-12').detail, /delete native\.lock in the run directory/);
  assert.doesNotMatch(run({ lock: { held: true, pid: 4242 } }).by('NC-12').detail, /delete/);
});
