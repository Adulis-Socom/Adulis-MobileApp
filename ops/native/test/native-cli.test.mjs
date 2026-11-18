// The command line of the driver: native conditions and native run, device prepare / restore / journal,
// metro, and what down, purge and status do about a device that was changed. One exit-code scheme: a
// finished run with a failed flow is 5, anything that was changed and not finished is 3.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { EXIT, EXIT_TEST_FAILED, main } from '../harness.mjs';
import { makeAdb } from '../lib/adb.mjs';
import { observeDevice } from '../lib/device.mjs';
import { summarize } from '../lib/journal.mjs';
import { applySetting, beginSession, deviceIdentity } from '../lib/restore.mjs';
import { fakeDevice, initialState, junit, SERIAL } from './fake-device.mjs';
import { BUILT_AT, nativeWorld, SHA } from './native-world.mjs';

const worlds = [];
after(() => worlds.forEach((x) => x.done()));

function rig(opts) {
  const x = nativeWorld(opts);
  worlds.push(x);
  const lines = [];
  const proc = new EventEmitter();
  const env = { ADULIS_NATIVE_ROOT: x.root, ...x.deps.env };
  const native = {
    freeBytes: x.deps.freeBytes,
    commitBytes: x.deps.commitBytes,
    diskFree: x.deps.diskFree,
    maestro: x.deps.maestro,
    decl: x.deps.decl,
    sleep: x.deps.sleep,
  };
  const run = (...argv) =>
    main(argv, {
      io: x.io,
      env,
      out: (s) => lines.push(s),
      native,
      proc,
      preflight: async () => [],
    });
  const nativeArgs = (sub) => [
    'native',
    sub,
    '--run',
    x.w.m.run,
    '--serial',
    SERIAL,
    '--checkout',
    x.checkout,
    '--sha',
    SHA,
    '--apk',
    x.apkPath,
    '--built-at',
    BUILT_AT,
  ];
  return { x, lines, proc, env, run, nativeArgs, last: () => lines.at(-1) };
}
const CHANGE = /settings (put|delete)|reverse (tcp|--remove)/;

test('the scheme has one code beside the documented five: 5, a finished run with a failed flow', () => {
  assert.equal(EXIT_TEST_FAILED, 5);
  assert.ok(!Object.values(EXIT).includes(EXIT_TEST_FAILED));
});

/* ---- native conditions ---- */

test('native conditions with no device ends BLOCKED, prints every condition, and changes nothing (the state of this machine)', async () => {
  const r = rig();
  r.x.dev.st.attached = false;
  assert.equal(await r.run(...r.nativeArgs('conditions')), EXIT.BLOCKED);
  assert.equal(
    r.last(),
    'HARNESS BLOCKED - NC-01 device attached and authorised: no device is attached - NOTHING STARTED',
  );
  assert.equal(
    r.lines.filter((l) => /^ {2}(PASS|FAIL|BLOCKED|UNKNOWN) {2}NC-\d\d /.test(l)).length,
    13,
    'one line per condition',
  );
  assert.deepEqual(
    r.x.dev.st.log.filter((l) => CHANGE.test(l)),
    [],
  );
});

test('native conditions that all pass say so and say the device was not tested', async () => {
  const r = rig();
  assert.equal(await r.run(...r.nativeArgs('conditions')), EXIT.OK);
  assert.equal(r.last(), 'NATIVE CONDITIONS MET - DEVICE TESTING NOT EXECUTED');
  assert.equal(r.x.maestro.calls.length, 0);
});

test('a checkout that is not the verified commit is refused before the device is looked at', async () => {
  const r = rig();
  const inner = r.x.io.git;
  r.x.io.git = async (a, c) =>
    a[0] === 'rev-parse'
      ? { status: 0, stdout: `${'c'.repeat(40)}\n`, stderr: '', error: null }
      : inner(a, c);
  assert.equal(await r.run(...r.nativeArgs('conditions')), EXIT.REFUSED);
  assert.match(
    r.last(),
    /^HARNESS REFUSED - refused: checkout HEAD .* is not the expected commit .* - NO RESOURCE WAS CHANGED$/,
  );
  assert.equal(r.x.dev.st.log.length, 0, 'no adb call was made');
});

test('a usage mistake is exit 2 and names the missing option; a serial that is a network address is refused', async () => {
  const r = rig();
  for (const [argv, re] of [
    [['native', 'frobnicate', '--run', r.x.w.m.run], /usage: native conditions\|run/],
    [
      r.nativeArgs('run').filter((_, i, a) => a[i - 1] !== '--apk' && a[i] !== '--apk'),
      /--apk is required/,
    ],
    [
      r.nativeArgs('run').filter((_, i, a) => a[i - 1] !== '--built-at' && a[i] !== '--built-at'),
      /--built-at is required/,
    ],
    [
      r.nativeArgs('run').filter((_, i, a) => a[i - 1] !== '--sha' && a[i] !== '--sha'),
      /--sha is required/,
    ],
    [
      [
        ...r.nativeArgs('run').slice(0, 4),
        '--serial',
        '192.168.1.5:5555',
        ...r.nativeArgs('run').slice(6),
      ],
      /is not a device serial/,
    ],
  ]) {
    assert.equal(await r.run(...argv), EXIT.COULD_NOT_CHECK, argv.join(' '));
    assert.match(r.last(), /^HARNESS USAGE - /);
    assert.match(r.last(), re, argv.join(' '));
  }
  assert.equal(r.x.dev.st.log.length, 0);
});

test('the serial comes from ANDROID_SERIAL when it is not given, and never from a default', async () => {
  const r = rig();
  const args = r.nativeArgs('conditions');
  const noSerial = [...args.slice(0, 4), ...args.slice(6)];
  r.env.ANDROID_SERIAL = SERIAL;
  assert.equal(await r.run(...noSerial), EXIT.OK);
  delete r.env.ANDROID_SERIAL;
  assert.equal(await r.run(...noSerial), EXIT.BLOCKED);
  assert.match(r.last(), /no device serial was named/);
});

test('an allow-list file that is not valid stops the command; a valid one admits a matching physical test device', async () => {
  const state = initialState();
  Object.assign(state, { serial: 'R58M1234ABC' });
  Object.assign(state.props, {
    'ro.kernel.qemu': '',
    'ro.boot.qemu': '',
    'ro.hardware': 'qcom',
    'ro.serialno': 'HW123',
    'ro.product.model': 'Pixel 7',
  });
  const r = rig({ deviceState: state });
  const args = r.nativeArgs('conditions');
  args[args.indexOf('--serial') + 1] = 'R58M1234ABC';
  assert.equal(await r.run(...args), EXIT.REFUSED);
  assert.match(
    r.last(),
    /NC-02 device identity: R58M1234ABC is not an emulator and is not on the allow-list/,
  );
  const file = join(r.x.root, 'allowed-devices.json');
  writeFileSync(file, '{ not json');
  assert.equal(await r.run(...args), EXIT.COULD_NOT_CHECK);
  writeFileSync(
    file,
    JSON.stringify([{ serial: 'R58M1234ABC', hardwareSerial: 'HW123', model: 'Pixel 7' }]),
  );
  assert.equal(
    await r.run(...args),
    EXIT.COULD_NOT_CHECK,
    'the operator must state the device is disposable',
  );
  writeFileSync(
    file,
    JSON.stringify([
      { serial: 'R58M1234ABC', hardwareSerial: 'HW123', model: 'Pixel 7', disposable: true },
    ]),
  );
  assert.equal(await r.run(...args), EXIT.OK);
  assert.equal(r.last(), 'NATIVE CONDITIONS MET - DEVICE TESTING NOT EXECUTED');
});

/* ---- native run ---- */

test('native run: exit 0 only when every flow passed and the device is back; the line says what it did', async () => {
  const r = rig();
  assert.equal(await r.run(...r.nativeArgs('run')), EXIT.OK);
  assert.equal(
    r.last(),
    'HARNESS OK - native run (2 PASS, 0 FAIL, 0 NOT EXECUTED); device settings restored',
  );
  assert.equal(summarize(r.x.dir).open.length, 0);
});

test('native run: a failed flow is exit 5 and the device is back', async () => {
  const r = rig({
    maestro: async (n) => ({ status: 1, junit: junit({ failures: 1 }), log: 'x', n }),
  });
  assert.equal(await r.run(...r.nativeArgs('run')), EXIT_TEST_FAILED);
  assert.match(
    r.last(),
    /^HARNESS TEST FAILED - native run \(0 PASS, 2 FAIL, 0 NOT EXECUTED\); device settings restored$/,
  );
  assert.equal(summarize(r.x.dir).open.length, 0);
});

test('native run: SIGINT, SIGTERM, SIGBREAK and SIGHUP during a flow stop it, restore the device and end INCOMPLETE; the handlers are removed afterwards', async () => {
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP']) {
    const holder = {};
    const r = rig({
      maestro: async (_n, o) => {
        holder.during = r.proc.listenerCount(sig);
        r.proc.emit(sig); // the operator hits Ctrl+C while Maestro runs
        await new Promise((res) => setImmediate(res));
        return { aborted: o.signal.aborted, status: null };
      },
    });
    const before = JSON.stringify([r.x.dev.st.settings, r.x.dev.st.reverse]);
    assert.equal(await r.run(...r.nativeArgs('run')), EXIT.INCOMPLETE, sig);
    assert.match(
      r.last(),
      /^HARNESS INCOMPLETE - interrupted \(0 PASS, 0 FAIL, 2 NOT EXECUTED\); device settings restored$/,
      sig,
    );
    assert.equal(holder.during, 1, `${sig}: a handler was installed while the session ran`);
    assert.equal(r.proc.listenerCount(sig), 0, `${sig}: and removed afterwards`);
    assert.equal(JSON.stringify([r.x.dev.st.settings, r.x.dev.st.reverse]), before, sig);
    assert.equal(r.x.maestro.calls.length, 1, `${sig}: no further flow was started`);
  }
});

test('native run with a precondition missing changes nothing and starts nothing', async () => {
  const r = rig();
  r.x.deps.freeBytes = () => 0.48 * 1024 ** 3;
  const native = {
    ...{
      freeBytes: () => 0.48 * 1024 ** 3,
      commitBytes: r.x.deps.commitBytes,
      diskFree: r.x.deps.diskFree,
      maestro: r.x.deps.maestro,
      decl: r.x.deps.decl,
      sleep: r.x.deps.sleep,
    },
  };
  const lines = [];
  const code = await main(r.nativeArgs('run'), {
    io: r.x.io,
    env: r.env,
    out: (s) => lines.push(s),
    native,
    proc: r.proc,
    preflight: async () => [],
  });
  assert.equal(code, EXIT.BLOCKED);
  assert.match(
    lines.at(-1),
    /^HARNESS BLOCKED - NC-07 free memory: free memory 0\.48 GB is below 6 GB - NOTHING STARTED$/,
  );
  assert.equal(r.x.maestro.calls.length, 0);
  assert.deepEqual(
    r.x.dev.st.log.filter((l) => CHANGE.test(l)),
    [],
  );
});

/* ---- device prepare, restore and journal ---- */

test('device prepare journals the reverse entries; device restore replays the journal, even for a session that no longer exists', async () => {
  const r = rig();
  const dev = ['device', 'prepare', '--run', r.x.w.m.run, '--serial', SERIAL];
  assert.equal(await r.run(...dev), EXIT.OK);
  assert.equal(r.last(), 'HARNESS OK - device prepare');
  assert.equal(r.x.dev.st.reverse.length, 3);
  assert.equal(summarize(r.x.dir).open.length, 3);
  assert.equal(await r.run('device', 'journal', '--run', r.x.w.m.run), EXIT.OK);
  assert.ok(r.lines.some((l) => l === 'device journal: 3 change(s) recorded, 3 open'));
  assert.equal(await r.run('device', 'restore', '--run', r.x.w.m.run, '--serial', SERIAL), EXIT.OK);
  assert.equal(r.last(), 'HARNESS OK - device restore (3 restored, 0 already original)');
  assert.deepEqual(r.x.dev.st.reverse, []);
  assert.equal(await r.run('device', 'restore', '--run', r.x.w.m.run, '--serial', SERIAL), EXIT.OK);
  assert.equal(
    r.last(),
    'HARNESS OK - device restore (no open device change is recorded for this run)',
  );
});

test('device restore of settings changed by a killed session, from the journal alone, and a restore that fails is INCOMPLETE', async () => {
  const r = rig();
  const adb = makeAdb(r.x.dev.io, SERIAL);
  beginSession(r.x.dir, { run: r.x.w.m.run, serial: SERIAL, identity: await deviceIdentity(adb) });
  await applySetting({ dir: r.x.dir, adb, name: 'font_scale', target: '1.3' });
  await applySetting({ dir: r.x.dir, adb, name: 'night_mode', target: 'yes' });
  const args = ['device', 'restore', '--run', r.x.w.m.run, '--serial', SERIAL];
  r.x.dev.st.denyPut = ['system/font_scale'];
  assert.equal(await r.run(...args), EXIT.INCOMPLETE);
  assert.match(
    r.last(),
    /^HARNESS INCOMPLETE - restoration FAILED for 1: font_scale \(.*\); the journal keeps them open: run `device restore` again when the device is reachable$/,
  );
  assert.equal(r.x.dev.st.night, 'auto', 'what could be restored was');
  r.x.dev.st.denyPut = [];
  assert.equal(await r.run(...args), EXIT.OK);
  assert.equal(r.x.dev.st.settings['system/font_scale'], '1.0');
});

test('device restore needs a named serial and refuses while a live session holds the run', async () => {
  const r = rig();
  assert.equal(await r.run('device', 'restore', '--run', r.x.w.m.run), EXIT.COULD_NOT_CHECK);
  assert.match(
    r.last(),
    /^HARNESS USAGE - --serial \(or ANDROID_SERIAL\) is required: there is no default device$/,
  );
  writeFileSync(join(r.x.dir, 'native.lock'), JSON.stringify({ pid: 4999, createdAt: 'alive' }));
  r.x.w.proc.byPid[4999] = { createdAt: 'alive', commandLine: 'node' };
  assert.equal(
    await r.run('device', 'restore', '--run', r.x.w.m.run, '--serial', SERIAL),
    EXIT.REFUSED,
  );
  assert.match(r.last(), /a native session \(pid 4999\) is running on this run/);
});

test('device restore refuses an unusable journal and says nothing was changed', async () => {
  const r = rig();
  writeFileSync(
    join(r.x.dir, 'device-journal.ndjson'),
    `${JSON.stringify({ v: 1, seq: 1, prev: 'wrong', op: 'begin' })}\n`,
  );
  assert.equal(
    await r.run('device', 'restore', '--run', r.x.w.m.run, '--serial', SERIAL),
    EXIT.REFUSED,
  );
  assert.match(r.last(), /device journal is unusable/);
  assert.equal(r.x.dev.st.log.filter((l) => CHANGE.test(l)).length, 0);
});

test('an unknown device sub-command is a usage error that lists the four', async () => {
  const r = rig();
  assert.equal(await r.run('device', 'frobnicate', '--run', r.x.w.m.run), EXIT.COULD_NOT_CHECK);
  assert.match(r.last(), /usage: device check\|prepare\|restore\|journal/);
});

test("the legacy device check reads the app's own package block: another package's DEBUGGABLE flag does not make the app debuggable", async () => {
  const d = fakeDevice();
  d.st.pkg.debuggable = false; // the double's second package block always carries DEBUGGABLE
  const f = await observeDevice((a) => d.io.adb(a), SERIAL);
  assert.deepEqual(f.package, { installed: true, debuggable: false });
});

/* ---- down, purge, status ---- */

test('down removes the Docker resources and stops Metro by its identity, but a device that is not restored makes the run INCOMPLETE; purge refuses until it is restored', async () => {
  const r = rig();
  await r.run('device', 'prepare', '--run', r.x.w.m.run, '--serial', SERIAL);
  assert.equal(await r.run('down', '--run', r.x.w.m.run), EXIT.INCOMPLETE);
  assert.match(
    r.last(),
    /^HARNESS INCOMPLETE - 3 device change\(s\) are not restored \(.*\) \(the Docker resources are removed\); run `device restore --run native-\d{8}-[0-9a-f]{8} --serial <serial>`$/,
  );
  assert.ok(
    r.lines.some((l) => l.startsWith('removed container')),
    'the Docker resources were removed all the same',
  );
  assert.deepEqual(r.x.kills, [5151], 'Metro was stopped by its recorded pid');
  assert.equal(
    await r.run('down', '--run', r.x.w.m.run),
    EXIT.INCOMPLETE,
    'a second down of the cleaned run still says so',
  );
  assert.equal(await r.run('purge', '--run', r.x.w.m.run), EXIT.REFUSED);
  assert.match(r.last(), /refused purge: 3 device change\(s\) are not restored/);
  assert.ok(existsSync(join(r.x.dir, 'device-journal.ndjson')), 'the journal is still there');
  writeFileSync(join(r.x.dir, 'run.marker'), `${r.x.w.m.run}\n`);
  assert.equal(await r.run('device', 'restore', '--run', r.x.w.m.run, '--serial', SERIAL), EXIT.OK);
  assert.equal(await r.run('down', '--run', r.x.w.m.run), EXIT.OK);
  assert.equal(await r.run('purge', '--run', r.x.w.m.run), EXIT.OK);
  assert.ok(!existsSync(r.x.dir));
});

test('status counts the device changes that are not restored and names Metro', async () => {
  const r = rig();
  await r.run('device', 'prepare', '--run', r.x.w.m.run, '--serial', SERIAL);
  assert.equal(await r.run('status', '--run', r.x.w.m.run), EXIT.OK);
  assert.match(
    r.lines.find((l) => l.startsWith('run native-')),
    /Metro pid 5151; device changes not restored: 3; nothing was verified by this command$/,
  );
});

/* ---- metro ---- */

test('metro stop through the command line stops it only by identity; an unknown metro sub-command is a usage error', async () => {
  const r = rig();
  assert.equal(await r.run('metro', 'stop', '--run', r.x.w.m.run), EXIT.OK);
  assert.deepEqual(r.x.kills, [5151]);
  assert.equal(await r.run('metro', 'frobnicate', '--run', r.x.w.m.run), EXIT.COULD_NOT_CHECK);
  assert.match(r.last(), /usage: metro start\|stop/);
  const other = rig();
  other.x.w.proc.byPid[5151] = { ...other.x.w.proc.byPid[5151], createdAt: 'someone-else' };
  assert.equal(await other.run('metro', 'stop', '--run', other.x.w.m.run), EXIT.REFUSED);
  assert.deepEqual(other.x.kills, []);
});

test('a device refusal prints its label, not "undefined"', async () => {
  const state = initialState();
  state.props['ro.kernel.qemu'] = '0';
  const r = rig({ deviceState: state });
  assert.equal(
    await r.run('device', 'check', '--run', r.x.w.m.run, '--serial', SERIAL),
    EXIT.REFUSED,
  );
  assert.match(r.last(), /^HARNESS REFUSED - ID-11 device - NO RESOURCE WAS CHANGED$/);
  assert.ok(
    r.lines.some((l) => /^refused device: ID-11 device FAIL \(/.test(l)),
    'the refusal message names its check as well',
  );
});
