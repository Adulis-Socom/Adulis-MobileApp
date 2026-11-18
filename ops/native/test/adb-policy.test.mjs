// The driver sends only the adb calls its list names, always to the one named serial, and refuses
// everything that could change an unidentified device, reach a protected port or run arbitrary code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyAdb,
  isEmulatorSerial,
  isMutatingAdb,
  listDevices,
  makeAdb,
  reversiblePort,
  SERIAL_RE,
} from '../lib/adb.mjs';
import { PROTECTED_PORTS } from '../lib/protected.mjs';
import { fakeDevice, SERIAL } from './fake-device.mjs';

const effect = (...a) => classifyAdb(a).effect;

test('reads, transient effects and changes are told apart', () => {
  for (const a of [
    ['devices'],
    ['devices', '-l'],
    ['version'],
    ['reverse', '--list'],
    ['shell', 'getprop', 'ro.hardware'],
    ['shell', 'settings', 'get', 'system', 'font_scale'],
    ['shell', 'wm', 'density'],
    ['shell', 'cmd', 'uimode', 'night'],
    ['shell', 'dumpsys', 'package', 'com.adulis.app'],
    ['shell', 'pm', 'path', 'com.adulis.app'],
    ['shell', 'pm', 'list', 'packages', 'dev.mobile.maestro'],
    ['shell', 'sha256sum', '/data/app/~~abc==/com.adulis.app-x==/base.apk'],
    ['shell', 'cat', '/proc/sys/kernel/random/boot_id'],
    ['logcat', '-d', '-v', 'threadtime'],
    ['logcat', '-d', '-v', 'threadtime', '-t', '5000'],
    ['exec-out', 'screencap', '-p'],
  ])
    assert.equal(effect(...a), 'read', a.join(' '));
  assert.equal(effect('shell', 'input', 'keyevent', '224'), 'ui');
  assert.equal(effect('shell', 'log', '-t', 'ADULIS_NATIVE', 'start:x:1'), 'ui');
  for (const a of [
    ['shell', 'settings', 'put', 'system', 'font_scale', '1.3'],
    ['shell', 'settings', 'delete', 'system', 'font_scale'],
    ['shell', 'wm', 'density', '480'],
    ['shell', 'wm', 'density', 'reset'],
    ['shell', 'cmd', 'uimode', 'night', 'yes'],
    ['shell', 'cmd', 'connectivity', 'airplane-mode', 'enable'],
    ['shell', 'cmd', 'locale', 'set-app-locales', 'com.adulis.app', '--locales', 'am-ET'],
    ['reverse', 'tcp:57213', 'tcp:57213'],
    ['reverse', '--remove', 'tcp:8081'],
  ])
    assert.equal(effect(...a), 'change', a.join(' '));
});

test('every call outside the list is refused, whatever it is', () => {
  const refused = [
    ['install', '-r', 'x.apk'],
    ['uninstall', 'com.adulis.app'],
    ['push', 'a', '/sdcard/a'],
    ['pull', '/sdcard/a'],
    ['root'],
    ['remount'],
    ['reboot'],
    ['emu', 'kill'],
    ['kill-server'],
    ['start-server'],
    ['connect', '10.0.0.5:5555'],
    ['tcpip', '5555'],
    ['forward', 'tcp:1', 'tcp:2'],
    ['reverse', '--remove-all'],
    ['reverse', 'tcp:57213', 'tcp:9100'],
    ['shell'],
    ['shell', 'pm', 'clear', 'com.adulis.app'],
    ['shell', 'pm', 'uninstall', 'com.adulis.app'],
    ['shell', 'rm', '-rf', '/sdcard'],
    ['shell', 'su', '0', 'id'],
    ['shell', 'am', 'force-stop', 'com.adulis.app'],
    ['shell', 'dumpsys', 'package', 'com.other.app'],
    ['shell', 'pm', 'path', 'com.other.app'],
    ['shell', 'pm', 'list', 'packages'],
    ['shell', 'settings', 'put', 'secure', 'install_non_market_apps', '1'],
    ['shell', 'settings', 'put', 'global', 'adb_enabled', '0'],
    ['shell', 'settings', 'get', 'secure', 'android_id'],
    ['shell', 'getprop', 'persist.sys.timezone'],
    ['shell', 'cat', '/data/data/com.adulis.app/databases/x'],
    ['shell', 'sha256sum', '/sdcard/photo.jpg'],
    ['shell', 'input', 'text', 'hello'],
    ['shell', 'input', 'keyevent', '26'],
    ['logcat', '-c'],
    ['logcat', '-b', 'all'],
    ['exec-out', 'cat', '/sdcard/a'],
    ['bugreport'],
    ['backup', '-all'],
  ];
  for (const a of refused) assert.equal(effect(...a), null, a.join(' '));
});

test('a shell token the device shell would interpret is refused (no chaining, no expansion)', () => {
  for (const bad of [
    'a;b',
    'a&&b',
    'a|b',
    '$(id)',
    '`id`',
    'a b',
    'a>b',
    '"x"',
    "'x'",
    'a*',
    'a\nb',
  ])
    assert.equal(
      effect('shell', 'settings', 'put', 'system', 'font_scale', bad),
      null,
      JSON.stringify(bad),
    );
  assert.equal(effect('shell', 'log', '-t', 'ADULIS_NATIVE', 'x;rm'), null);
});

test('a setting value must be one the setting accepts', () => {
  assert.equal(effect('shell', 'settings', 'put', 'system', 'font_scale', '1.3'), 'change');
  for (const v of ['9', '0.1', '-1', 'abc', '1.3.4', ''])
    assert.equal(effect('shell', 'settings', 'put', 'system', 'font_scale', v), null, v);
  assert.equal(
    effect('shell', 'settings', 'put', 'global', 'stay_on_while_plugged_in', '7'),
    'change',
  );
  assert.equal(
    effect('shell', 'settings', 'put', 'global', 'stay_on_while_plugged_in', '15'),
    'change',
  );
  assert.equal(
    effect('shell', 'settings', 'put', 'global', 'stay_on_while_plugged_in', '16'),
    null,
  );
  assert.equal(
    effect('shell', 'settings', 'put', 'global', 'stay_on_while_plugged_in', '99999'),
    null,
  );
  assert.equal(effect('shell', 'settings', 'put', 'system', 'user_rotation', '4'), null);
  assert.equal(effect('shell', 'wm', 'density', '9'), null);
  assert.equal(effect('shell', 'wm', 'density', '5000'), null);
  assert.equal(effect('shell', 'cmd', 'uimode', 'night', 'custom'), null);
});

test("only this harness's ports are reversed, each to itself, and never a protected port", () => {
  assert.equal(reversiblePort(57213), true);
  assert.equal(reversiblePort(8081), true);
  for (const p of PROTECTED_PORTS) {
    assert.equal(reversiblePort(p), false, `${p}`);
    assert.equal(effect('reverse', `tcp:${p}`, `tcp:${p}`), null, `${p}`);
    assert.equal(effect('reverse', '--remove', `tcp:${p}`), null, `${p}`);
  }
  for (const p of [80, 443, 3001, 8080, 8082, 56999, 58000, 65535])
    assert.equal(reversiblePort(p), false, `${p}`);
  assert.equal(effect('reverse', 'tcp:57213', 'tcp:57214'), null, 'to another port');
  assert.equal(effect('reverse', 'localabstract:x', 'tcp:57213'), null);
});

test('an unknown call counts as a change for the tracker, a read does not', () => {
  assert.equal(isMutatingAdb(['-s', 'e', 'shell', 'getprop', 'ro.hardware']), false);
  assert.equal(isMutatingAdb(['devices']), false);
  assert.equal(
    isMutatingAdb(['-s', 'e', 'shell', 'settings', 'put', 'system', 'font_scale', '1.3']),
    true,
  );
  assert.equal(isMutatingAdb(['-s', 'e', 'shell', 'pm', 'clear', 'x']), true);
  assert.equal(isMutatingAdb(['reverse', '--list']), false);
});

test('the serial is bound: a call can never name another device or server', async () => {
  const d = fakeDevice();
  const adb = makeAdb(d.io, SERIAL);
  await adb(['shell', 'getprop', 'ro.hardware']);
  assert.equal(d.st.log.at(-1), `-s ${SERIAL} shell getprop ro.hardware`);
  for (const a of [
    ['-s', 'R58M123', 'shell', 'getprop', 'ro.hardware'],
    ['shell', 'getprop', '-s'],
    ['-H', 'host', 'devices'],
    ['-P', '5038', 'devices'],
  ])
    await assert.rejects(adb(a), /refused/, a.join(' '));
  assert.ok(!d.st.log.some((l) => l.includes('R58M123')), 'nothing was sent to another serial');
  await assert.rejects(adb(['uninstall', 'com.adulis.app']), /refused adb uninstall/);
  assert.ok(!d.st.log.some((l) => l.includes('uninstall')));
});

test('a serial must be a plain hardware or emulator serial, never a network address', () => {
  for (const good of ['emulator-5554', 'R58M1234ABC', 'ZY22xxxx_1']) assert.match(good, SERIAL_RE);
  for (const bad of ['', 'a b', '192.168.1.5:5555', 'x', '../x', 'a;b', '-s'])
    assert.doesNotMatch(bad, SERIAL_RE, JSON.stringify(bad));
  assert.throws(() => makeAdb({}, '192.168.1.5:5555'), /not a device serial/);
  assert.equal(isEmulatorSerial('emulator-5554'), true);
  assert.equal(isEmulatorSerial('emulator-55'), false);
  assert.equal(isEmulatorSerial('R58M1234ABC'), false);
});

test('adb devices is read from the lines after its header, and a daemon notice is not a device', async () => {
  const mk = (stdout) => ({ adb: async () => ({ status: 0, stdout, stderr: '', error: null }) });
  assert.deepEqual(
    await listDevices(
      mk(
        '* daemon not running; starting now at tcp:5037\n* daemon started successfully\nList of devices attached\nemulator-5554\tdevice\nR58M1\tunauthorized\n\n',
      ).adb,
    ),
    {
      devices: [
        { serial: 'emulator-5554', state: 'device' },
        { serial: 'R58M1', state: 'unauthorized' },
      ],
    },
  );
  assert.deepEqual(await listDevices(mk('List of devices attached\n\n').adb), { devices: [] });
  assert.match((await listDevices(mk('garbage').adb)).error, /no device list/);
  assert.match(
    (
      await listDevices(async () => ({
        status: 1,
        stdout: '',
        stderr: 'cannot connect',
        error: null,
      }))
    ).error,
    /adb devices failed/,
  );
});
