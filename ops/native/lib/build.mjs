// Is the app on the device the build this run claims to test? The production identity is read, never
// changed: the package id must be the one in apps/mobile/app.json and the one the driver is built for.
// What is proven: the installed APK is byte for byte the file the operator named, the installed package
// runs on the device's own CPU architecture, and the native dependencies (apps/mobile/app.json and the
// dependencies of apps/mobile/package.json) are the same at the commit the file was built at (named by the
// operator) and at the verified commit.
import { createHash } from 'node:crypto';
import { closeSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { adbOk as ok } from './adb.mjs';
import { APP_ID } from './device.mjs';
import { parsePackage as parseBlock } from './package-dump.mjs';

const SHA_RE = /^[0-9a-f]{40}$/;

/** The installed package, read from `dumpsys package <id>` (only the block of that package). */
export const parsePackage = (dump, appId = APP_ID) => parseBlock(dump, appId);

/** The Android package id of the Expo app: apps/mobile/app.json, as the checkout holds it. */
export function appIdentity(checkout) {
  const j = JSON.parse(readFileSync(join(checkout, 'apps', 'mobile', 'app.json'), 'utf8'));
  return { package: j?.expo?.android?.package ?? null };
}

/** The APK file: its size, SHA-256, and the CPU architectures of its native libraries (zip directory only). */
export function apkInfo(path) {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    const h = createHash('sha256');
    const buf = Buffer.allocUnsafe(1 << 20);
    for (let pos = 0, n = 1; n > 0; pos += n) {
      n = readSync(fd, buf, 0, buf.length, pos);
      if (n > 0) h.update(buf.subarray(0, n));
    }
    const tailLen = Math.min(size, 65557);
    const tail = Buffer.alloc(tailLen);
    readSync(fd, tail, 0, tailLen, size - tailLen);
    let e = tail.length - 22;
    while (e >= 0 && tail.readUInt32LE(e) !== 0x06054b50) e -= 1;
    if (e < 0) throw new Error(`${path} is not a zip archive`);
    const cdSize = tail.readUInt32LE(e + 12);
    const cdOffset = tail.readUInt32LE(e + 16);
    if (cdSize === 0xffffffff || cdOffset === 0xffffffff)
      throw new Error('zip64 archives are not read');
    const cd = Buffer.alloc(cdSize);
    readSync(fd, cd, 0, cdSize, cdOffset);
    const names = [];
    for (let p = 0; p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50;) {
      const [n, x, c] = [cd.readUInt16LE(p + 28), cd.readUInt16LE(p + 30), cd.readUInt16LE(p + 32)];
      names.push(cd.toString('utf8', p + 46, p + 46 + n));
      p += 46 + n + x + c;
    }
    const abis = [
      ...new Set(names.map((n) => /^lib\/([^/]+)\//.exec(n)?.[1]).filter(Boolean)),
    ].sort();
    return {
      path,
      size,
      sha256: h.digest('hex'),
      abis,
      hasManifest: names.includes('AndroidManifest.xml'),
    };
  } finally {
    closeSync(fd);
  }
}

/** What the device says about itself and the installed app, through the classified adb. */
export async function observeBuild(adb) {
  const prop = async (p) => (await adb(['shell', 'getprop', p])).stdout.trim();
  const dump = await adb(['shell', 'dumpsys', 'package', APP_ID]);
  const paths = await adb(['shell', 'pm', 'path', APP_ID]);
  const lines = ok(paths)
    ? paths.stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
  const apkPaths = lines.filter((l) => l.startsWith('package:')).map((l) => l.slice(8));
  let installedSha = null;
  if (apkPaths.length === 1) {
    const r = await adb(['shell', 'sha256sum', apkPaths[0]]);
    if (ok(r)) installedSha = /^([0-9a-f]{64})\b/.exec(r.stdout.trim())?.[1] ?? null;
  }
  return {
    package: ok(dump) ? parsePackage(dump.stdout) : { installed: false, error: 'dumpsys failed' },
    apkPaths,
    installedSha,
    sdk: Number(await prop('ro.build.version.sdk')),
    release: await prop('ro.build.version.release'),
    abilist: (await prop('ro.product.cpu.abilist')).split(',').filter(Boolean),
    abi: await prop('ro.product.cpu.abi'),
  };
}

const sortKeys = (v) =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sortKeys(v[k])]),
        )
      : v;
const canon = (v) => JSON.stringify(sortKeys(v));

/**
 * The native dependencies at `builtAt` and at `sha` must be the same: `dependencies` of
 * apps/mobile/package.json and the whole of apps/mobile/app.json. `git(args)` resolves to { status, stdout }.
 * Resolves { problems, fingerprint } where the fingerprint is the SHA-256 of those two at `sha`.
 */
export async function nativeDepsCheck({ builtAt, sha, git }) {
  const problems = [];
  if (!SHA_RE.test(`${builtAt}`))
    return { problems: ['the commit the APK was built at is not a full 40-hex id'] };
  if (!SHA_RE.test(`${sha}`)) return { problems: ['the verified commit is not a full 40-hex id'] };
  const anc = await git(['merge-base', '--is-ancestor', builtAt, sha]);
  if (anc.status !== 0)
    problems.push(
      `the build commit ${builtAt.slice(0, 12)} is not an ancestor of the verified commit`,
    );
  const at = async (rev) => {
    const out = {};
    for (const f of ['apps/mobile/package.json', 'apps/mobile/app.json']) {
      const r = await git(['show', `${rev}:${f}`]);
      if (r.status !== 0) return { error: `${f} cannot be read at ${rev.slice(0, 12)}` };
      try {
        out[f] = JSON.parse(r.stdout);
      } catch {
        return { error: `${f} at ${rev.slice(0, 12)} is not JSON` };
      }
    }
    return out;
  };
  const [a, b] = [await at(builtAt), await at(sha)];
  for (const x of [a, b]) if (x.error) problems.push(x.error);
  if (problems.length) return { problems };
  if (
    canon(a['apps/mobile/package.json'].dependencies) !==
    canon(b['apps/mobile/package.json'].dependencies)
  )
    problems.push(
      "the dependencies of apps/mobile changed since the build: the installed app is not this checkout's native build",
    );
  if (canon(a['apps/mobile/app.json']) !== canon(b['apps/mobile/app.json']))
    problems.push(
      "apps/mobile/app.json changed since the build: the installed app is not this checkout's native build",
    );
  const fingerprint = createHash('sha256')
    .update(canon({ d: b['apps/mobile/package.json'].dependencies, a: b['apps/mobile/app.json'] }))
    .digest('hex');
  return { problems, fingerprint };
}

/**
 * Every reason the installed app is not the build under test. `facts` = observeBuild, `apk` = apkInfo,
 * `id` = appIdentity of the checkout.
 */
export function buildProblems({ facts, apk, id }) {
  const p = [];
  if (id.package !== APP_ID)
    p.push(
      `apps/mobile/app.json names package ${id.package}, not ${APP_ID}: the production identity differs from the one the driver is built for`,
    );
  if (!facts.package.installed) p.push(`${APP_ID} is not installed`);
  else {
    if (!facts.package.debuggable) p.push(`${APP_ID} is not a debuggable build`);
    if (!Number.isInteger(facts.sdk) || facts.sdk <= 0)
      p.push('the Android version of the device could not be read');
    else if (facts.package.minSdk !== null && facts.package.minSdk > facts.sdk)
      p.push(`the app needs Android API ${facts.package.minSdk}, the device runs API ${facts.sdk}`);
    const primary = facts.abilist[0] ?? facts.abi;
    if (!primary) p.push('the CPU architecture of the device could not be read');
    else {
      if (facts.package.primaryCpuAbi && facts.package.primaryCpuAbi !== primary)
        p.push(
          `the installed app runs as ${facts.package.primaryCpuAbi} on a ${primary} device (an emulated architecture is not tested)`,
        );
      if (!apk.abis.length)
        p.push('the APK holds no native libraries: its architecture cannot be checked');
      else if (!apk.abis.includes(primary))
        p.push(`the APK holds ${apk.abis.join(', ')}; the device is ${primary}`);
    }
  }
  if (!apk.hasManifest) p.push('the file is not an APK (no AndroidManifest.xml)');
  if (facts.apkPaths.length !== 1)
    p.push(
      `${facts.apkPaths.length} APK files are installed for ${APP_ID}: split APKs cannot be matched to one file`,
    );
  else if (!facts.installedSha) p.push('the installed APK could not be hashed on the device');
  else if (facts.installedSha !== apk.sha256)
    p.push('the installed APK is not the file that was named (SHA-256 differs)');
  return p;
}
