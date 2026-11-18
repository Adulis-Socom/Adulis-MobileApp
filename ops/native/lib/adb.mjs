// Every adb call of the device driver is classified here before it is sent. The driver can do only
// what this list names: read a few properties, read and write the settings of settings.mjs, add and
// remove its own reverse entries, read the installed app, wake the screen, take a screenshot and a
// log. Everything else (install, uninstall, clear, push, pull, reboot, root, a free shell, a command
// for another package, a network transport) is refused before it reaches adb.
import { APP_ID } from './device.mjs';
import { Refused } from './guard.mjs';
import { DEVICE_PORTS_EXTRA, PORT_BLOCK, PROTECTED_PORTS } from './protected.mjs';

/** A named serial. No colon: a network (wireless) transport is never used, so a device cannot drop out of reach. */
export const SERIAL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{3,63}$/;
export const isEmulatorSerial = (s) => /^emulator-\d{4,5}$/.test(`${s}`);

const float = (lo, hi) => (v) =>
  /^\d{1,2}(\.\d{1,3})?$/.test(v) && Number(v) >= lo && Number(v) <= hi;
const int = (lo, hi) => (v) => /^\d{1,4}$/.test(v) && Number(v) >= lo && Number(v) <= hi;
const COMPONENT = '[A-Za-z0-9_.]+/[A-Za-z0-9_.]+';
const components = (v) => new RegExp(`^${COMPONENT}(:${COMPONENT})*$`).test(v) && v.length <= 512;

/** The settings the driver may read, write and delete: `<namespace>/<key>` and what a value must look like. */
export const SETTING_KEYS = {
  'system/font_scale': float(0.5, 3),
  'global/window_animation_scale': float(0, 10),
  'global/transition_animation_scale': float(0, 10),
  'global/animator_duration_scale': float(0, 10),
  'global/stay_on_while_plugged_in': int(0, 15),
  'global/airplane_mode_on': int(0, 1),
  'secure/accessibility_enabled': int(0, 1),
  'secure/enabled_accessibility_services': components,
  'system/accelerometer_rotation': int(0, 1),
  'system/user_rotation': int(0, 3),
};

export const PROPS = new Set([
  'ro.kernel.qemu',
  'ro.boot.qemu',
  'ro.hardware',
  'ro.product.model',
  'ro.product.cpu.abi',
  'ro.product.cpu.abilist',
  'ro.build.version.release',
  'ro.build.version.sdk',
  'ro.build.fingerprint',
  'ro.serialno',
  'ro.boot.qemu.avd_name',
  'ro.debuggable',
  'sys.boot_completed',
]);

/** A token reaches the device's shell: nothing it could expand, split or chain. */
const SAFE = /^[A-Za-z0-9_.:/=@,+~-]+$/;
const LOCALES = /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*(,[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*)*$/;
export const BOOT_ID = '/proc/sys/kernel/random/boot_id';
/** The package prefix of the driver apps Maestro installs on the device for itself. */
export const MAESTRO_DRIVER = 'dev.mobile.maestro';
const APK_PATH = /^\/data\/app\/[A-Za-z0-9_.=/~-]+\.apk$/;

/** The ports the driver may reverse: this harness's block and Metro, never a protected port. */
export const reversiblePort = (p) =>
  Number.isInteger(p) &&
  !PROTECTED_PORTS.has(p) &&
  ((p >= PORT_BLOCK.from && p <= PORT_BLOCK.to) || DEVICE_PORTS_EXTRA.has(p));
const tcp = (s) => {
  const m = /^tcp:(\d{1,5})$/.exec(`${s}`);
  return m ? Number(m[1]) : null;
};

const read = { effect: 'read' };
const ui = { effect: 'ui' };
const change = { effect: 'change' };
const no = (why) => ({ effect: null, why });
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

function shell(a) {
  if (a.some((t) => !SAFE.test(t)))
    return no('a shell token holds a character the device shell would interpret');
  const [c, x, y, z, w] = a;
  if (c === 'getprop' && a.length === 2)
    return PROPS.has(x) ? read : no(`property ${x} is not on the list`);
  if (c === 'settings') {
    const key = `${y}/${z}`;
    if (x === 'get' && a.length === 4 && key in SETTING_KEYS) return read;
    if (x === 'delete' && a.length === 4 && key in SETTING_KEYS) return change;
    if (x === 'put' && a.length === 5 && key in SETTING_KEYS)
      return SETTING_KEYS[key](w) ? change : no(`${w} is not a valid value for ${key}`);
    return no(`settings ${x} ${key} is not on the list`);
  }
  if (c === 'wm' && x === 'density') {
    if (a.length === 2) return read;
    if (
      a.length === 3 &&
      (y === 'reset' || (/^\d{2,3}$/.test(y) && Number(y) >= 72 && Number(y) <= 800))
    )
      return change;
  }
  if (c === 'wm' && x === 'size' && a.length === 2) return read;
  if (c === 'cmd' && x === 'uimode' && y === 'night') {
    if (a.length === 3) return read;
    if (a.length === 4 && ['yes', 'no', 'auto'].includes(z)) return change;
  }
  if (
    c === 'cmd' &&
    x === 'connectivity' &&
    y === 'airplane-mode' &&
    a.length === 4 &&
    ['enable', 'disable'].includes(z)
  )
    return change;
  if (c === 'cmd' && x === 'locale') {
    if (y === 'get-app-locales' && z === APP_ID && a.length === 4) return read;
    if (y === 'set-app-locales' && z === APP_ID && a.length === 4) return change;
    if (
      y === 'set-app-locales' &&
      z === APP_ID &&
      w === '--locales' &&
      a.length === 6 &&
      LOCALES.test(a[5])
    )
      return change;
  }
  if (c === 'dumpsys' && x === 'package' && y === APP_ID && a.length === 3) return read;
  if (c === 'pm' && x === 'path' && y === APP_ID && a.length === 3) return read;
  if (c === 'pm' && x === 'list' && y === 'packages' && z === MAESTRO_DRIVER && a.length === 4)
    return read;
  if (c === 'sha256sum' && a.length === 2 && APK_PATH.test(x)) return read;
  if (c === 'cat' && x === BOOT_ID && a.length === 2) return read;
  if (c === 'pidof' && x === APP_ID && a.length === 2) return read;
  if (c === 'input' && x === 'keyevent' && y === '224' && a.length === 3) return ui;
  if (c === 'log' && x === '-t' && y === 'ADULIS_NATIVE' && a.length === 4) return ui;
  return no(`adb shell ${c} is not on the list`);
}

/**
 * What an adb call (the arguments after `-s <serial>`) does: { effect: 'read' | 'ui' | 'change' }, or
 * { effect: null, why } when the driver may not send it. 'ui' is a transient effect (a key press, a log
 * line); 'change' is a device setting or a reverse entry that has to be restored.
 */
export function classifyAdb(argsIn) {
  const a = argsIn[0] === '-s' ? argsIn.slice(2) : argsIn;
  const [c, x, y] = a;
  if (c === 'devices' && (a.length === 1 || (a.length === 2 && x === '-l'))) return read;
  if (c === 'get-state' && a.length === 1) return read;
  if (c === 'version' && a.length === 1) return read;
  if (c === 'reverse') {
    if (a.length === 2 && x === '--list') return read;
    if (a.length === 3 && x !== '--remove') {
      const [r, l] = [tcp(x), tcp(y)];
      if (r === null || r !== l) return no('reverse maps a port to itself only');
      return reversiblePort(r) ? change : no(`port ${r} may not be reversed`);
    }
    if (a.length === 3 && x === '--remove') {
      const r = tcp(y);
      return r !== null && reversiblePort(r) ? change : no(`port ${y} may not be reversed`);
    }
    return no('adb reverse form is not on the list');
  }
  if (c === 'logcat') {
    const base = ['logcat', '-d', '-v', 'threadtime'];
    if (eq(a, base)) return read;
    if (a.length === 6 && eq(a.slice(0, 4), base) && a[4] === '-t' && /^\d{1,5}$/.test(a[5]))
      return read;
  }
  if (c === 'exec-out' && eq(a, ['exec-out', 'screencap', '-p'])) return read;
  if (c === 'shell') return shell(a.slice(1));
  return no(`adb ${c} is not on the list`);
}

export const isMutatingAdb = (args) => {
  const c = classifyAdb(args);
  // A call the list does not know may do anything: it counts as a change.
  return c.effect === 'change' || c.effect === null;
};

const ok = (r) => !r.error && r.status === 0;
export { ok as adbOk };

/**
 * The only way the driver talks to a device: the serial is added here (a caller can never name another
 * one) and the call is classified first. `io.adb(args)` resolves to { status, stdout, stderr, error };
 * `io.adbBytes(args)` is the same with stdout as a Buffer (a screenshot), reached as `adb.bytes(args)`.
 */
export function makeAdb(io, serial) {
  if (!SERIAL_RE.test(`${serial}`))
    throw new Refused(`refused: '${serial}' is not a device serial`);
  const classified = (args) => {
    if (args.includes('-s') || args.includes('-H') || args.includes('-P'))
      throw new Refused('refused: a call may not name its own device or server');
    const c = classifyAdb(args);
    if (c.effect === null) throw new Refused(`refused adb ${args.join(' ')}: ${c.why}`);
    return c;
  };
  const adb = async (args) => {
    const c = classified(args);
    return { ...(await io.adb(['-s', serial, ...args])), effect: c.effect };
  };
  adb.bytes = async (args) => {
    classified(args);
    return io.adbBytes(['-s', serial, ...args]);
  };
  return adb;
}

/** `adb devices`: the attached devices, read from the lines after the header only. */
export async function listDevices(raw) {
  const r = await raw(['devices']);
  if (!ok(r))
    return { error: `adb devices failed: ${`${r.stderr || r.error?.message || r.status}`.trim()}` };
  const lines = r.stdout.split(/\r?\n/).map((l) => l.trim());
  const at = lines.findIndex((l) => l.startsWith('List of devices attached'));
  if (at < 0) return { error: 'adb devices printed no device list' };
  return {
    devices: lines
      .slice(at + 1)
      .filter(Boolean)
      .map((l) => l.split(/\s+/))
      .filter((x) => x.length >= 2)
      .map(([serial, state]) => ({ serial, state })),
  };
}
