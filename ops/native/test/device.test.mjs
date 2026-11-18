// A device is used only when the operator named it, it is the only one attached, it is an emulator,
// the app on it is a debug build, and its reverse-port table holds only this run's ports.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deviceProblems, observeDevice, prepareDevice, restoreDevice } from '../lib/device.mjs';
import { PROTECTED_PORTS } from '../lib/protected.mjs';
import { world } from './fakes.mjs';

const SERIAL = 'emulator-5554';
const good = () => ({
  devices: [{ serial: SERIAL, state: 'device' }],
  qemu: '1',
  package: { installed: true, debuggable: true },
  reverse: [],
});
const m = () => world().m;

test('a debug build on the only attached emulator with no foreign reverse entries is acceptable', () => {
  assert.deepEqual(deviceProblems(m(), SERIAL, good()), []);
  const mm = m();
  const f = good();
  f.reverse = [
    { remote: `tcp:${mm.ports.api}`, local: `tcp:${mm.ports.api}` },
    { remote: 'tcp:8081', local: 'tcp:8081' },
  ];
  assert.deepEqual(deviceProblems(mm, SERIAL, f), []);
});

test('there is no default device: a missing serial is refused', () => {
  assert.match(deviceProblems(m(), undefined, good()).join(), /no device serial/);
  assert.match(deviceProblems(m(), '', good()).join(), /no device serial/);
});

test('two attached devices, an offline device, or a serial that is not attached is refused', () => {
  const two = { ...good(), devices: [...good().devices, { serial: 'R58M123', state: 'device' }] };
  assert.match(deviceProblems(m(), SERIAL, two).join(), /2 devices/);
  const off = { ...good(), devices: [{ serial: SERIAL, state: 'offline' }] };
  assert.match(deviceProblems(m(), SERIAL, off).join(), /offline/);
  assert.match(deviceProblems(m(), 'emulator-5556', good()).join(), /not attached/);
  assert.match(deviceProblems(m(), SERIAL, { ...good(), devices: [] }).join(), /0 devices/);
});

test('a physical phone is refused: its app data would be cleared', () => {
  assert.match(deviceProblems(m(), SERIAL, { ...good(), qemu: '' }).join(), /not an emulator/);
  assert.match(deviceProblems(m(), SERIAL, { ...good(), qemu: '0' }).join(), /not an emulator/);
});

test('an app that is missing or not a debug build is refused', () => {
  assert.match(
    deviceProblems(m(), SERIAL, {
      ...good(),
      package: { installed: false, debuggable: false },
    }).join(),
    /not installed/,
  );
  assert.match(
    deviceProblems(m(), SERIAL, {
      ...good(),
      package: { installed: true, debuggable: false },
    }).join(),
    /not a debuggable build/,
  );
});

test('a foreign or protected reverse entry is refused', () => {
  for (const [remote, local, re] of [
    ...[...PROTECTED_PORTS].map((p) => [`tcp:${p}`, `tcp:${p}`, /protected port/]),
    ['tcp:57999', 'tcp:57999', /not this run's/],
    ['tcp:8081', 'tcp:9999', /not this run's/],
  ]) {
    const f = { ...good(), reverse: [{ remote, local }] };
    assert.match(deviceProblems(m(), SERIAL, f).join(), re, remote);
  }
});

test('observeDevice reads the facts from adb output', async () => {
  const adb = async (args) => {
    const s = args.join(' ');
    if (s === 'devices')
      return { status: 0, stdout: 'List of devices attached\nemulator-5554\tdevice\n\n' };
    if (s.includes('getprop ro.kernel.qemu')) return { status: 0, stdout: '1\n' };
    if (s.includes('dumpsys package'))
      return {
        status: 0,
        stdout: 'Package [com.adulis.app] (abc):\n  pkgFlags=[ DEBUGGABLE HAS_CODE ]\n',
      };
    if (s.includes('reverse --list'))
      return { status: 0, stdout: 'emulator-5554 tcp:8081 tcp:8081\n' };
    return { status: 1, stdout: '' };
  };
  const f = await observeDevice(adb, SERIAL);
  assert.deepEqual(f.devices, [{ serial: SERIAL, state: 'device' }]);
  assert.equal(f.qemu, '1');
  assert.deepEqual(f.package, { installed: true, debuggable: true });
  assert.deepEqual(f.reverse, [{ remote: 'tcp:8081', local: 'tcp:8081' }]);
});

test("prepare reverses exactly the run's API, MinIO and Metro ports and nothing else; restore removes the same", async () => {
  const mm = m();
  const calls = [];
  const adb = async (args) => (calls.push(args.join(' ')), { status: 0, stdout: '' });
  await prepareDevice(mm, adb, SERIAL);
  assert.deepEqual(calls, [
    `-s ${SERIAL} reverse tcp:${mm.ports.api} tcp:${mm.ports.api}`,
    `-s ${SERIAL} reverse tcp:${mm.ports.s3} tcp:${mm.ports.s3}`,
    `-s ${SERIAL} reverse tcp:8081 tcp:8081`,
  ]);
  calls.length = 0;
  await restoreDevice(mm, adb, SERIAL);
  assert.deepEqual(calls, [
    `-s ${SERIAL} reverse --remove tcp:${mm.ports.api}`,
    `-s ${SERIAL} reverse --remove tcp:${mm.ports.s3}`,
    `-s ${SERIAL} reverse --remove tcp:8081`,
  ]);
});

test('prepare refuses a protected port even if the manifest was tampered with', async () => {
  const mm = m();
  [mm.ports.s3] = [...PROTECTED_PORTS];
  const calls = [];
  const adb = async (args) => (calls.push(args.join(' ')), { status: 0, stdout: '' });
  await assert.rejects(prepareDevice(mm, adb, SERIAL), /protected/);
  assert.deepEqual(calls, [], 'nothing is reversed when any port is refused');
});
