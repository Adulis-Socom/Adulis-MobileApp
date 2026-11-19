// The device settings a native run may change, each with the three things restoring needs: how to
// read the current value, how to write one, and how to put back "there was no value". A setting that
// is not here is never touched. `adb(args)` is the classified adb of adb.mjs (the serial is already bound).
import { adbOk as ok, reversiblePort, SETTING_KEYS } from './adb.mjs';
import { APP_ID } from './device.mjs';
import { Refused } from './guard.mjs';

const tail = (r) => `${r.stderr || r.stdout || r.error?.message || ''}`.trim().slice(-200);
const must = (r, what) => {
  if (!ok(r)) throw new Error(`${what} failed: ${tail(r)}`);
  return `${r.stdout}`;
};
const num = (a, b) => Number(a) === Number(b);
const text = (a, b) => a === b;

/** A value of `settings get`: the word "null" means the key is not set; an empty answer is not an answer. */
function generic(ns, key, same = text) {
  const id = `${ns}/${key}`;
  return {
    describe: `${ns} setting ${key}`,
    valid: SETTING_KEYS[id],
    same,
    async read(adb) {
      const v = must(await adb(['shell', 'settings', 'get', ns, key]), `reading ${id}`).trim();
      if (v === '') throw new Error(`reading ${id} returned nothing`);
      return v === 'null' ? { present: false, value: null } : { present: true, value: v };
    },
    async write(adb, v) {
      must(await adb(['shell', 'settings', 'put', ns, key, v]), `writing ${id}`);
    },
    async clear(adb) {
      must(await adb(['shell', 'settings', 'delete', ns, key]), `deleting ${id}`);
    },
  };
}

const airplane = {
  ...generic('global', 'airplane_mode_on', num),
  describe: 'airplane mode',
  async write(adb, v) {
    must(
      await adb([
        'shell',
        'cmd',
        'connectivity',
        'airplane-mode',
        v === '1' ? 'enable' : 'disable',
      ]),
      'writing airplane mode',
    );
  },
  clear: undefined, // an unset original cannot be put back: such a device is not changed
};

const density = {
  describe: 'display density',
  valid: (v) => /^\d{2,3}$/.test(v) && Number(v) >= 72 && Number(v) <= 800,
  same: num,
  async read(adb) {
    const out = must(await adb(['shell', 'wm', 'density']), 'reading the density');
    if (!/Physical density:\s*\d+/.test(out))
      throw new Error('wm density printed no physical density');
    const o = /Override density:\s*(\d+)/.exec(out);
    return o ? { present: true, value: o[1] } : { present: false, value: null };
  },
  async write(adb, v) {
    must(await adb(['shell', 'wm', 'density', v]), 'writing the density');
  },
  async clear(adb) {
    must(await adb(['shell', 'wm', 'density', 'reset']), 'resetting the density');
  },
};

const night = {
  describe: 'night mode',
  valid: (v) => ['yes', 'no', 'auto'].includes(v),
  same: text,
  async read(adb) {
    const out = must(await adb(['shell', 'cmd', 'uimode', 'night']), 'reading night mode');
    const m = /Night mode:\s*(yes|no|auto)\b/i.exec(out);
    if (!m)
      throw new Error(`night mode '${out.trim().slice(0, 60)}' is not one the driver can put back`);
    return { present: true, value: m[1].toLowerCase() };
  },
  async write(adb, v) {
    must(await adb(['shell', 'cmd', 'uimode', 'night', v]), 'writing night mode');
  },
  clear: undefined,
};

// A read that does not match the platform's answer is an error, which refuses the change.
const locale = {
  describe: "the app's own locale list",
  valid: (v) =>
    /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*(,[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*)*$/.test(v),
  same: text,
  async read(adb) {
    const out = must(
      await adb(['shell', 'cmd', 'locale', 'get-app-locales', APP_ID]),
      'reading the app locale',
    );
    const m = /\[([^\]]*)\]/.exec(out);
    if (!m) throw new Error(`the app locale answer '${out.trim().slice(0, 60)}' has no list`);
    const list = m[1].replaceAll(' ', '');
    return list === '' ? { present: false, value: null } : { present: true, value: list };
  },
  async write(adb, v) {
    must(
      await adb([
        'shell',
        'cmd',
        'locale',
        'set-app-locales',
        APP_ID,
        '--locales',
        v.replaceAll('_', '-'),
      ]),
      'writing the app locale',
    );
  },
  async clear(adb) {
    must(
      await adb(['shell', 'cmd', 'locale', 'set-app-locales', APP_ID]),
      'clearing the app locale',
    );
  },
};

export const SETTINGS = {
  font_scale: generic('system', 'font_scale', num),
  animation_window: generic('global', 'window_animation_scale', num),
  animation_transition: generic('global', 'transition_animation_scale', num),
  animation_animator: generic('global', 'animator_duration_scale', num),
  stay_awake: generic('global', 'stay_on_while_plugged_in', num),
  airplane_mode: airplane,
  night_mode: night,
  density,
  a11y_enabled: generic('secure', 'accessibility_enabled', num),
  a11y_services: generic('secure', 'enabled_accessibility_services'),
  rotation_auto: generic('system', 'accelerometer_rotation', num),
  rotation_user: generic('system', 'user_rotation', num),
  app_locale: locale,
};

/** `adb reverse --list` as [{ remote, local }]. */
export async function reverseTable(adb) {
  const out = must(await adb(['reverse', '--list']), 'reading the reverse table');
  return out
    .split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/))
    .filter((x) => x.length === 3)
    .map(([, remote, local]) => ({ remote, local }));
}

/** One reverse entry of this run: absent before, `tcp:<port>` after. A different local port is a foreign entry. */
export function reverseEntry(port) {
  if (!reversiblePort(port)) throw new Refused(`refused: port ${port} may not be reversed`);
  const mine = `tcp:${port}`;
  return {
    describe: `adb reverse ${mine}`,
    valid: (v) => v === mine,
    same: text,
    verifyAfterWrite: false, // adb's exit status is the answer; the table is read back by the checks
    async read(adb) {
      const e = (await reverseTable(adb)).find((x) => x.remote === mine);
      return e ? { present: true, value: e.local } : { present: false, value: null };
    },
    async write(adb) {
      if (!ok(await adb(['reverse', mine, mine]))) throw new Error(`adb reverse ${mine} failed`);
    },
    async clear(adb) {
      if (!ok(await adb(['reverse', '--remove', mine])))
        throw new Error(`adb reverse --remove ${mine} failed`);
    },
  };
}

/** The entry for a journal name: a catalogue name, or `reverse:<port>`. Anything else is refused. */
export function resolveSetting(name) {
  if (Object.hasOwn(SETTINGS, name)) return SETTINGS[name];
  const m = /^reverse:(\d{1,5})$/.exec(`${name}`);
  if (m) return reverseEntry(Number(m[1]));
  throw new Refused(`refused: '${name}' is not a setting the driver may change`);
}

export const sameValue = (entry, a, b) =>
  a.present === b.present && (!a.present || (entry.same ?? text)(a.value, b.value));
