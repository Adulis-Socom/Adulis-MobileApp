// A stateful fake Android device behind the adb argument lists the driver sends, and the doubles around
// it (Maestro, git, a minimal APK). Nothing here starts a process or opens a socket; a device test is
// never a device result. `fakeDevice({ file })` keeps its state in a JSON file after every call, so a
// test can kill a child process in the middle of a session and let the next process see the device as
// it was left.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const SERIAL = 'emulator-5554';
export const APK_PATH = '/data/app/~~abc123==/com.adulis.app-xyz789==/base.apk';
export const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

const ok = (stdout = '') => ({ status: 0, stdout, stderr: '', error: null });
const fail = (stderr, status = 1) => ({ status, stdout: '', stderr, error: null });

export const initialState = () => ({
  serial: SERIAL,
  attached: true,
  adbState: 'device',
  bootId: 'boot-0001',
  props: {
    'ro.kernel.qemu': '1',
    'ro.boot.qemu': '1',
    'ro.hardware': 'ranchu',
    'ro.product.model': 'sdk_gphone64_x86_64',
    'ro.build.fingerprint': 'google/sdk_gphone64_x86_64/emu64xa:17/CP21/1:userdebug/dev-keys',
    'ro.serialno': 'EMULATOR35X1',
    'ro.boot.qemu.avd_name': 'Adulis_Pixel_8a_API_37',
    'ro.product.cpu.abi': 'x86_64',
    'ro.product.cpu.abilist': 'x86_64,arm64-v8a',
    'ro.build.version.sdk': '37',
    'ro.build.version.release': '17',
    'ro.debuggable': '1',
    'sys.boot_completed': '1',
  },
  settings: {
    'system/font_scale': '1.0',
    'global/window_animation_scale': '1.0',
    'global/transition_animation_scale': '1.0',
    'global/animator_duration_scale': '1.0',
    'global/stay_on_while_plugged_in': '0',
    'global/airplane_mode_on': '0',
    'system/accelerometer_rotation': '1',
    'system/user_rotation': '0',
  },
  density: { physical: 420, override: null },
  night: 'auto',
  locales: [],
  reverse: [],
  pkg: {
    installed: true,
    debuggable: true,
    primaryCpuAbi: 'x86_64',
    versionCode: 1,
    minSdk: 24,
    targetSdk: 36,
    apkPath: APK_PATH,
    apkSha: 'f'.repeat(64),
  },
  maestroDrivers: ['package:dev.mobile.maestro', 'package:dev.mobile.maestro.test'],
  logcat: [],
  // failure injection
  denyPut: [], // `ns/key` whose `settings put` is refused with a non-zero exit
  ignorePut: [], // `ns/key` whose `settings put` exits 0 and changes nothing
  failOn: [], // substrings of a joined command line: that command answers with an error
  dieAfter: null, // after this many calls the device goes offline
  calls: 0,
  log: [],
});

const dump = (p) =>
  `Packages:\n  Package [com.adulis.app] (a1b2c3):\n    userId=10200\n    codePath=${p.apkPath.replace('/base.apk', '')}\n    primaryCpuAbi=${p.primaryCpuAbi}\n    secondaryCpuAbi=null\n    versionCode=${p.versionCode} minSdk=${p.minSdk} targetSdk=${p.targetSdk}\n    versionName=1.0.0\n    pkgFlags=[ ${p.debuggable ? 'DEBUGGABLE ' : ''}HAS_CODE ALLOW_CLEAR_USER_DATA ]\n    installerPackageName=null\n  Package [com.other.app] (d4e5f6):\n    pkgFlags=[ DEBUGGABLE HAS_CODE ]\n`;

/**
 * `fakeDevice({ file })`: { st, calls, raw(args), bytes(args), save() }. The adb of the driver is
 * `makeAdb({ adb: d.raw, adbBytes: d.bytes }, serial)`.
 */
export function fakeDevice({ file, state } = {}) {
  const st =
    file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : (state ?? initialState());
  const save = () => {
    if (!file) return;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(st));
  };
  const key = (ns, k) => `${ns}/${k}`;

  const shell = (a) => {
    const [c, x, y, z, w] = a;
    if (c === 'getprop') return ok(`${st.props[x] ?? ''}\n`);
    if (c === 'cat') return ok(`${st.bootId}\n`);
    if (c === 'settings') {
      const k = key(y, z);
      if (x === 'get') return ok(`${st.settings[k] ?? 'null'}\n`);
      if (x === 'put') {
        if (st.denyPut.includes(k)) return fail('java.lang.SecurityException: not allowed', 255);
        if (!st.ignorePut.includes(k)) st.settings[k] = w;
        return ok();
      }
      if (x === 'delete') {
        if (st.denyPut.includes(k)) return fail('java.lang.SecurityException: not allowed', 255);
        delete st.settings[k];
        return ok('Deleted 1 rows\n');
      }
    }
    if (c === 'wm' && x === 'density') {
      if (a.length === 2)
        return ok(
          `Physical density: ${st.density.physical}\n${st.density.override ? `Override density: ${st.density.override}\n` : ''}`,
        );
      st.density.override = y === 'reset' ? null : Number(y);
      return ok();
    }
    if (c === 'cmd' && x === 'uimode') {
      if (a.length === 3) return ok(`Night mode: ${st.night}\n`);
      st.night = z;
      return ok();
    }
    if (c === 'cmd' && x === 'connectivity') {
      st.settings['global/airplane_mode_on'] = z === 'enable' ? '1' : '0';
      return ok();
    }
    if (c === 'cmd' && x === 'locale') {
      if (y === 'get-app-locales')
        return ok(`Locales for com.adulis.app for user 0 are [${st.locales.join(',')}]\n`);
      st.locales = w === '--locales' ? a[5].split(',') : [];
      return ok();
    }
    if (c === 'dumpsys' && x === 'package')
      return st.pkg.installed ? ok(dump(st.pkg)) : ok('Packages:\n');
    if (c === 'pm' && x === 'path')
      return st.pkg.installed ? ok(`package:${st.pkg.apkPath}\n`) : fail('', 1);
    if (c === 'pm' && x === 'list') return ok(`${st.maestroDrivers.join('\n')}\n`);
    if (c === 'sha256sum') return ok(`${st.pkg.apkSha}  ${x}\n`);
    if (c === 'input') return ok();
    if (c === 'log') {
      st.logcat.push(
        `11-19 10:00:00.000  1  1 I ADULIS_NATIVE: ${y === 'ADULIS_NATIVE' ? a[3] : ''}`,
      );
      return ok();
    }
    return fail(`unexpected shell ${a.join(' ')}`, 127);
  };

  const dispatch = (args) => {
    st.log.push(args.join(' '));
    st.calls += 1;
    if (args[0] === 'devices')
      return ok(
        `List of devices attached\n${st.attached ? `${st.serial}\t${st.adbState}\n` : ''}\n`,
      );
    if (args[0] === 'version')
      return ok('Android Debug Bridge version 1.0.41\nVersion 37.0.1-15733141\n');
    if (args[0] !== '-s') return fail(`unexpected call without -s: ${args.join(' ')}`, 2);
    if (args[1] !== st.serial) return fail(`error: device '${args[1]}' not found`);
    if (!st.attached) return fail(`error: device '${st.serial}' not found`);
    if (st.adbState !== 'device') return fail(`error: device ${st.adbState}`);
    if (st.dieAfter !== null && st.calls > st.dieAfter) {
      st.attached = false;
      return fail(`error: device '${st.serial}' not found`);
    }
    const a = args.slice(2);
    const line = a.join(' ');
    const hit = st.failOn.find((s) => line.includes(s));
    if (hit) return fail(`injected failure for ${hit}`);
    if (a[0] === 'shell') return shell(a.slice(1));
    if (a[0] === 'reverse') {
      if (a[1] === '--list')
        return ok(
          st.reverse.map((r) => `${st.serial} ${r.remote} ${r.local}`).join('\n') +
            (st.reverse.length ? '\n' : ''),
        );
      if (a[1] === '--remove') {
        const at = st.reverse.findIndex((r) => r.remote === a[2]);
        if (at < 0) return fail(`adb: error: listener '${a[2]}' not found`);
        st.reverse.splice(at, 1);
        return ok();
      }
      st.reverse = st.reverse.filter((r) => r.remote !== a[1]);
      st.reverse.push({ remote: a[1], local: a[2] });
      return ok(`${a[1].slice(4)}\n`);
    }
    if (a[0] === 'logcat') return ok(`${st.logcat.join('\n')}\n`);
    if (a[0] === 'exec-out') return ok(); // screencap: the bytes double supplies the image
    return fail(`unexpected adb ${line}`, 127);
  };

  const raw = async (args) => {
    const r = dispatch(args);
    save();
    return r;
  };
  const bytes = async (args) => {
    const r = dispatch(args);
    save();
    return r.status === 0 ? { ...r, stdout: PNG } : r;
  };
  save();
  return { st, raw, bytes, save, io: { adb: raw, adbBytes: bytes } };
}

/** A minimal APK: a zip (stored entries) with a manifest and one native library per architecture. */
export function makeApk(path, { abis = ['x86_64'], manifest = true, extra = 'build-1' } = {}) {
  const names = [
    ...(manifest ? ['AndroidManifest.xml'] : []),
    'classes.dex',
    ...abis.map((a) => `lib/${a}/libapp.so`),
  ];
  const parts = [];
  const central = [];
  let offset = 0;
  for (const name of names) {
    const body = Buffer.from(`${name}:${extra}`);
    const n = Buffer.from(name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(body.length, 22);
    lh.writeUInt16LE(n.length, 26);
    parts.push(lh, n, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(body.length, 24);
    ch.writeUInt16LE(n.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, n);
    offset += lh.length + n.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...parts, cd, end]);
  writeFileSync(path, all);
  return createHash('sha256').update(all).digest('hex');
}

/** A JUnit report in the shape the runner reads. */
export const junit = ({ failures = 0, name = 'Flow' } = {}) =>
  `<?xml version='1.0' encoding='UTF-8'?>\n<testsuites><testsuite name="Test Suite" device="${SERIAL}" tests="1" failures="${failures}" time="3.0">` +
  (failures
    ? `<testcase id="${name}" name="${name}" classname="${name}" time="3.0" status="ERROR"><failure>Assertion is false: "x" is visible</failure></testcase>`
    : `<testcase id="${name}" name="${name}" classname="${name}" time="3.0" status="SUCCESS"/>`) +
  `</testsuite></testsuites>\n`;

/**
 * A Maestro double: `script(call, opts)` answers each run with { status, junit?, log?, error?, aborted?, onRun? }
 * and the report and log are written where the runner asked for them. `calls` records every request.
 */
export function fakeMaestro(script) {
  const calls = [];
  const maestro = async (opts) => {
    const idx = calls.length;
    calls.push(opts);
    const r = (await script(idx, opts)) ?? {};
    const out = opts.args[opts.args.indexOf('--output') + 1];
    mkdirSync(dirname(out), { recursive: true });
    if (r.junit) writeFileSync(out, r.junit);
    writeFileSync(opts.log, r.log ?? '');
    return {
      status: r.status ?? 0,
      error: r.error ?? null,
      pid: 4321,
      timedOut: !!r.timedOut,
      aborted: !!r.aborted,
    };
  };
  return { maestro, calls };
}

/** git answers for the native-dependency check: `deps` per revision, an ancestry verdict. */
export function fakeGit({
  builtAt,
  head,
  builtAtDeps,
  headDeps,
  appJson = { expo: { android: { package: 'com.adulis.app' } } },
  headAppJson = appJson,
  ancestor = true,
} = {}) {
  const pkg = (deps) =>
    JSON.stringify({ name: '@adulis/mobile', scripts: { x: 'y' }, dependencies: deps });
  return async (args) => {
    if (args[0] === 'rev-parse') return ok(`${head}\n`);
    if (args[0] === 'merge-base') return ancestor ? ok() : fail('', 1);
    if (args[0] === 'show') {
      const [rev, file] = args[1].split(':');
      if (file === 'apps/mobile/package.json')
        return ok(pkg(rev === builtAt ? builtAtDeps : headDeps));
      if (file === 'apps/mobile/app.json')
        return ok(JSON.stringify(rev === builtAt ? appJson : headAppJson));
    }
    return ok();
  };
}
