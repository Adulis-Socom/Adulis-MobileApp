// Is the app on the device the build under test? The production identity is read and compared, never
// changed; the installed APK must be the named file; the architecture must fit; the native dependencies
// must not have moved since the commit the file was built at.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { makeAdb } from '../lib/adb.mjs';
import {
  apkInfo,
  appIdentity,
  buildProblems,
  nativeDepsCheck,
  observeBuild,
  parsePackage,
} from '../lib/build.mjs';
import { fakeDevice, fakeGit, initialState, makeApk, SERIAL } from './fake-device.mjs';

const dirs = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'native-b-'));
  dirs.push(d);
  return d;
};
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const deps = { expo: '~58.0.24', react: '19.3.0' };

test('the installed package is read from its own block of the dumpsys text, not from a neighbour', () => {
  const dump = `Packages:
  Package [com.adulis.app] (1a2b):
    primaryCpuAbi=x86_64
    versionCode=7 minSdk=24 targetSdk=36
    versionName=1.2.3
    pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]
  Package [com.neighbour.app] (3c4d):
    pkgFlags=[ DEBUGGABLE HAS_CODE ]
Hidden system packages:
`;
  const p = parsePackage(dump);
  assert.deepEqual(p, {
    installed: true,
    debuggable: false,
    primaryCpuAbi: 'x86_64',
    versionCode: 7,
    minSdk: 24,
    targetSdk: 36,
    versionName: '1.2.3',
  });
  assert.equal(
    parsePackage(dump.replace('HAS_CODE ALLOW', 'DEBUGGABLE HAS_CODE ALLOW')).debuggable,
    true,
  );
  assert.deepEqual(parsePackage('Packages:\n'), { installed: false });
  assert.equal(
    parsePackage(dump.replace('[com.adulis.app]', '[com.adulis.app.other]')).installed,
    false,
  );
});

test('the APK file: SHA-256, size, the architectures of its native libraries, and whether it is an APK at all', () => {
  const d = tmp();
  const p = join(d, 'a.apk');
  const sha = makeApk(p, { abis: ['arm64-v8a', 'x86_64'] });
  const i = apkInfo(p);
  assert.equal(i.sha256, sha);
  assert.deepEqual(i.abis, ['arm64-v8a', 'x86_64']);
  assert.equal(i.hasManifest, true);
  assert.ok(i.size > 100);
  assert.equal(apkInfo(makeApkTo(d, 'b.apk', { manifest: false })).hasManifest, false);
  writeFileSync(join(d, 'junk.apk'), 'this is not a zip archive at all, only text');
  assert.throws(() => apkInfo(join(d, 'junk.apk')), /not a zip archive/);
});
const makeApkTo = (d, name, o) => {
  makeApk(join(d, name), o);
  return join(d, name);
};

test('the package id comes from apps/mobile/app.json as the checkout holds it', () => {
  const d = tmp();
  mkdirSync(join(d, 'apps', 'mobile'), { recursive: true });
  writeFileSync(
    join(d, 'apps', 'mobile', 'app.json'),
    JSON.stringify({ expo: { android: { package: 'com.adulis.app' } } }),
  );
  assert.deepEqual(appIdentity(d), { package: 'com.adulis.app' });
  writeFileSync(join(d, 'apps', 'mobile', 'app.json'), JSON.stringify({ expo: {} }));
  assert.deepEqual(appIdentity(d), { package: null });
});

test('the device side is read through the classified adb: package, one APK path and its hash, version, architecture', async () => {
  const d = fakeDevice();
  const f = await observeBuild(makeAdb(d.io, SERIAL));
  assert.equal(f.package.installed, true);
  assert.deepEqual(f.apkPaths, ['/data/app/~~abc123==/com.adulis.app-xyz789==/base.apk']);
  assert.equal(f.installedSha, 'f'.repeat(64));
  assert.equal(f.sdk, 37);
  assert.equal(f.release, '17');
  assert.deepEqual(f.abilist, ['x86_64', 'arm64-v8a']);
});

const good = () => {
  const d = tmp();
  const p = join(d, 'a.apk');
  const sha = makeApk(p, { abis: ['x86_64'] });
  const dev = fakeDevice({ state: Object.assign(initialState(), {}) });
  dev.st.pkg.apkSha = sha;
  return { apk: apkInfo(p), dev, id: { package: 'com.adulis.app' } };
};
const problems = async (g) =>
  buildProblems({ facts: await observeBuild(makeAdb(g.dev.io, SERIAL)), apk: g.apk, id: g.id });

test('a matching debug build on a matching device has no problem', async () => {
  assert.deepEqual(await problems(good()), []);
});

test('each way the installed app is not the build under test is a problem', async () => {
  const cases = [
    [
      'a different production identity in app.json',
      (g) => (g.id = { package: 'com.adulis.app.dev' }),
      /production identity differs/,
    ],
    ['not installed', (g) => (g.dev.st.pkg.installed = false), /is not installed/],
    ['not debuggable', (g) => (g.dev.st.pkg.debuggable = false), /not a debuggable build/],
    [
      'not the named APK file',
      (g) => (g.dev.st.pkg.apkSha = '0'.repeat(64)),
      /not the file that was named/,
    ],
    [
      'an APK for another architecture',
      (g) => (g.apk = { ...g.apk, abis: ['arm64-v8a'] }),
      /APK holds arm64-v8a; the device is x86_64/,
    ],
    [
      'an app that runs emulated',
      (g) => (g.dev.st.pkg.primaryCpuAbi = 'arm64-v8a'),
      /runs as arm64-v8a on a x86_64 device/,
    ],
    [
      'an APK with no native libraries',
      (g) => (g.apk = { ...g.apk, abis: [] }),
      /no native libraries/,
    ],
    ['a file that is not an APK', (g) => (g.apk = { ...g.apk, hasManifest: false }), /not an APK/],
    [
      'an app that needs a newer Android',
      (g) => (g.dev.st.pkg.minSdk = 38),
      /needs Android API 38, the device runs API 37/,
    ],
    [
      'an Android version that cannot be read',
      (g) => (g.dev.st.props['ro.build.version.sdk'] = ''),
      /Android version of the device could not be read/,
    ],
  ];
  for (const [what, mutate, re] of cases) {
    const g = good();
    mutate(g);
    const p = (await problems(g)).join(' | ');
    assert.match(p, re, what);
  }
});

test('an app whose APK cannot be hashed on the device, or has several APKs, is not matched to one file', async () => {
  const g = good();
  g.dev.st.failOn = ['sha256sum'];
  assert.match((await problems(g)).join(), /could not be hashed on the device/);
  const g2 = good();
  const inner = g2.dev.io.adb;
  g2.dev.io.adb = async (args) => {
    const r = await inner(args);
    return args.includes('path')
      ? { ...r, stdout: `${r.stdout}package:/data/app/x/split_config.arm64.apk\n` }
      : r;
  };
  const facts = await observeBuild(makeAdb(g2.dev.io, SERIAL));
  assert.match(
    buildProblems({ facts, apk: g2.apk, id: g2.id }).join(),
    /2 APK files are installed/,
  );
});

test('native dependencies: unchanged since the build passes; a changed dependency or app.json is a problem', async () => {
  const same = await nativeDepsCheck({
    builtAt: A,
    sha: B,
    git: fakeGit({ builtAt: A, head: B, builtAtDeps: deps, headDeps: deps }),
  });
  assert.deepEqual(same.problems, []);
  assert.match(same.fingerprint, /^[0-9a-f]{64}$/);
  const key = await nativeDepsCheck({
    builtAt: A,
    sha: B,
    git: fakeGit({
      builtAt: A,
      head: B,
      builtAtDeps: { react: '19.3.0', expo: '~58.0.24' },
      headDeps: deps,
    }),
  });
  assert.deepEqual(key.problems, [], 'key order is not a change');
  const changed = await nativeDepsCheck({
    builtAt: A,
    sha: B,
    git: fakeGit({
      builtAt: A,
      head: B,
      builtAtDeps: deps,
      headDeps: { ...deps, 'expo-camera': '~58.0.1' },
    }),
  });
  assert.match(changed.problems.join(), /dependencies of apps\/mobile changed/);
  const app = await nativeDepsCheck({
    builtAt: A,
    sha: B,
    git: fakeGit({
      builtAt: A,
      head: B,
      builtAtDeps: deps,
      headDeps: deps,
      headAppJson: { expo: { android: { package: 'com.adulis.app' }, plugins: ['x'] } },
    }),
  });
  assert.match(app.problems.join(), /app\.json changed/);
});

test('a build commit that is not declared, not a full id, or not an ancestor is refused', async () => {
  const git = fakeGit({ builtAt: A, head: B, builtAtDeps: deps, headDeps: deps });
  assert.match(
    (await nativeDepsCheck({ builtAt: undefined, sha: B, git })).problems.join(),
    /not a full 40-hex/,
  );
  assert.match(
    (await nativeDepsCheck({ builtAt: 'abc123', sha: B, git })).problems.join(),
    /not a full 40-hex/,
  );
  assert.match(
    (await nativeDepsCheck({ builtAt: A, sha: 'main', git })).problems.join(),
    /verified commit is not a full/,
  );
  const behind = await nativeDepsCheck({
    builtAt: A,
    sha: B,
    git: fakeGit({ builtAt: A, head: B, builtAtDeps: deps, headDeps: deps, ancestor: false }),
  });
  assert.match(behind.problems.join(), /not an ancestor/);
  const unreadable = await nativeDepsCheck({
    builtAt: A,
    sha: B,
    git: async () => ({ status: 128, stdout: '', stderr: 'bad object', error: null }),
  });
  assert.ok(unreadable.problems.length);
});
