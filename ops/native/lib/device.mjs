// The Android device a native run may drive. Flows clear the app's data, so a device is used only
// when the operator named its serial, it is the one device attached, it is an emulator, the app on
// it is a debug build, and its reverse-port table holds nothing but this run's ports.
import { parsePackage } from './package-dump.mjs';
import { DEVICE_PORTS_EXTRA, PROTECTED_PORTS } from './protected.mjs';

export const APP_ID = 'com.adulis.app';
export const METRO_PORT = 8081;

/** The only ports the harness reverses onto a device: this run's API and MinIO, and Metro. */
export const reversePorts = (m) => [m.ports.api, m.ports.s3, ...DEVICE_PORTS_EXTRA];

/** `facts` = { devices: [{ serial, state }], qemu, package, reverse: [{ remote, local }] }. */
export function deviceProblems(m, serial, facts) {
  const p = [];
  if (!serial) return ['no device serial was named: there is no default device'];
  const d = facts.devices ?? [];
  if (d.length !== 1) p.push(`${d.length} devices are attached; exactly one (${serial}) must be`);
  const mine = d.find((x) => x.serial === serial);
  if (!mine) p.push(`device ${serial} is not attached`);
  else if (mine.state !== 'device') p.push(`device ${serial} is '${mine.state}', not ready`);
  if (facts.qemu !== '1')
    p.push(`device ${serial} is not an emulator (ro.kernel.qemu is '${facts.qemu}')`);
  if (!facts.package?.installed) p.push(`${APP_ID} is not installed`);
  else if (!facts.package.debuggable)
    p.push(`${APP_ID} on ${serial} is not a debuggable build: its data would be cleared`);
  const allowed = new Set(reversePorts(m).map((x) => `tcp:${x}`));
  for (const r of facts.reverse ?? []) {
    const port = Number(`${r.remote}`.replace('tcp:', ''));
    if (PROTECTED_PORTS.has(port)) p.push(`the device already reverses protected port ${r.remote}`);
    else if (!allowed.has(r.remote) || r.remote !== r.local)
      p.push(`the device has a reverse entry ${r.remote} -> ${r.local} that is not this run's`);
  }
  return p;
}

/** `adb(args)` resolves to { status, stdout }. */
export async function observeDevice(adb, serial) {
  const list = await adb(['devices']);
  const devices = list.stdout
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.trim().split(/\s+/))
    .filter((x) => x.length >= 2 && x[0])
    .map(([s, state]) => ({ serial: s, state }));
  const sh = (cmd) => adb(['-s', serial, 'shell', ...cmd]);
  const qemu = (await sh(['getprop', 'ro.kernel.qemu'])).stdout.trim();
  const dump = (await sh(['dumpsys', 'package', APP_ID])).stdout;
  // Only the app's own block counts: another package's DEBUGGABLE flag in the same output proves nothing.
  const pkg = parsePackage(dump, APP_ID);
  const installed = pkg.installed;
  const debuggable = !!pkg.debuggable;
  const rev = (await adb(['-s', serial, 'reverse', '--list'])).stdout
    .split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/))
    .filter((x) => x.length === 3)
    .map(([, remote, local]) => ({ remote, local }));
  return { devices, qemu, package: { installed, debuggable }, reverse: rev };
}

/** Reverses exactly the run's ports. The caller has already passed deviceProblems and API-WRITE. */
export async function prepareDevice(m, adb, serial) {
  const ports = reversePorts(m);
  for (const port of ports)
    if (PROTECTED_PORTS.has(port)) throw new Error(`refused: port ${port} is protected`);
  for (const port of ports) {
    const r = await adb(['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
    if (r.status !== 0) throw new Error(`adb reverse tcp:${port} failed`);
  }
}

export async function restoreDevice(m, adb, serial) {
  for (const port of reversePorts(m))
    await adb(['-s', serial, 'reverse', '--remove', `tcp:${port}`]);
}
