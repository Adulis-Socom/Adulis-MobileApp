// The device, Metro and native commands of the harness. Each resolves { code, status } or throws what
// the harness's own error handling turns into a status line (a Refused, a Usage or an Error).
import { existsSync, readFileSync, statfsSync } from 'node:fs';
import { freemem, tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { provenanceProblems } from './api.mjs';
import { makeAdb, SERIAL_RE } from './adb.mjs';
import { allowListProblems, reverseTableProblems } from './conditions.mjs';
import { deviceProblems, observeDevice, reversePorts } from './device.mjs';
import { loadDeclaration } from './flows.mjs';
import { assertTarget, Refusal, Refused } from './guard.mjs';
import { summarize } from './journal.mjs';
import { locateMaestro } from './maestro.mjs';
import { startMetro, stopMetro } from './metro.mjs';
import {
  applySetting,
  beginSession,
  deviceIdentity,
  restoreLine,
  restoreOpen,
} from './restore.mjs';
import { reverseTable } from './settings.mjs';
import { lockHeld, runNative } from './session.mjs';

export class UsageError extends Error {}

const FLOWS = join(dirname(fileURLToPath(import.meta.url)), '..', 'flows.json');

/** Signals that end a console session: the session stops, restores the device, and reports INCOMPLETE. */
export function installInterrupt(proc, onSignal) {
  const sigs = ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP'];
  for (const s of sigs) proc.on(s, onSignal);
  return () => {
    for (const s of sigs) proc.off(s, onSignal);
  };
}

const serialOf = (a, env) => {
  const serial = a.serial ?? env.ANDROID_SERIAL;
  if (serial && !SERIAL_RE.test(serial)) throw new UsageError(`'${serial}' is not a device serial`);
  return serial;
};

/** `device check|prepare|restore|journal`. The first two serve the manual workflow on an emulator. */
export async function deviceCommand({ sub, m, dir, io, a, env, say }) {
  const serial = serialOf(a, env);
  if (sub === 'journal') {
    const s = summarize(dir);
    say(
      `device journal: ${s.changes.length} change(s) recorded, ${s.open.length} open${s.torn ? `, ${s.torn} cut-short line(s) skipped` : ''}`,
    );
    for (const c of s.open) say(`  open: ${c.setting} (${c.state})`);
    if (s.corrupt) throw new Refused(`refused: the device journal is unusable: ${s.corrupt}`, 1);
    return { code: 0, status: `HARNESS OK - device journal` };
  }
  if (sub === 'restore') {
    if (!serial)
      throw new UsageError('--serial (or ANDROID_SERIAL) is required: there is no default device');
    const held = await lockHeld(dir, io);
    if (held.held)
      throw new Refused(
        `refused: a native session (pid ${held.pid}) is running on this run: it restores its own changes`,
      );
    const s = summarize(dir);
    if (s.corrupt)
      throw new Refused(
        `refused: the device journal is unusable: ${s.corrupt}; nothing was changed`,
      );
    if (!s.open.length)
      return {
        code: 0,
        status: 'HARNESS OK - device restore (no open device change is recorded for this run)',
      };
    const r = await restoreOpen({ dir, adb: makeAdb(io, serial) });
    say(restoreLine(r));
    if (r.failed.length)
      return {
        code: 3,
        status: `HARNESS INCOMPLETE - ${restoreLine(r)}; the journal keeps them open: run \`device restore\` again when the device is reachable`,
      };
    return {
      code: 0,
      status: `HARNESS OK - device restore (${r.restored.length} restored, ${r.unchanged.length} already original)`,
    };
  }
  const adb = (x) => io.adb(x);
  const facts = serial ? await observeDevice(adb, serial) : {};
  const p = deviceProblems(m, serial, facts);
  if (p.length)
    throw new Refusal(
      'device',
      p.map((detail) => ({ id: 'ID-11', verdict: 'FAIL', detail })),
    );
  if (sub === 'check')
    return { code: 0, status: `HARNESS OK - device ${serial} passes the device checks` };
  await assertTarget(m, 'API-WRITE', io, { dir, states: ['ready'] });
  const dev = makeAdb(io, serial);
  beginSession(dir, { run: m.run, serial, identity: await deviceIdentity(dev) });
  for (const port of reversePorts(m))
    await applySetting({ dir, adb: dev, name: `reverse:${port}`, target: `tcp:${port}` });
  const bad = reverseTableProblems(await reverseTable(dev), m, { prepared: true });
  if (bad.length) throw new Error(`the reverse table is not as prepared: ${bad.join('; ')}`);
  say(`reverse ports set on ${serial} (journaled: \`device restore\` puts them back)`);
  return { code: 0, status: 'HARNESS OK - device prepare' };
}

export async function metroCommand({ sub, m, dir, io, a, say }) {
  if (sub === 'start') {
    const r = await startMetro(m, io, {
      checkout: resolve(a.checkout ?? ''),
      sha: a.sha,
      dir,
    });
    say(`Metro pid ${r.metro.pid} on port ${r.metro.port} with API address ${r.metro.apiUrl}`);
  } else {
    const r = await stopMetro(m, io, dir);
    say(r.stopped ? 'Metro stopped' : `Metro not stopped: ${r.why}`);
  }
  return { code: 0, status: `HARNESS OK - metro ${sub}` };
}

const onPath = (env) => (name) => {
  for (const d of `${env.PATH ?? env.Path ?? ''}`.split(delimiter).filter(Boolean))
    for (const f of [`${name}.bat`, name]) if (existsSync(join(d, f))) return join(d, f);
  return null;
};

/** `native conditions` (checks only) and `native run` (the session). */
export async function nativeCommand({
  sub,
  m,
  dir,
  io,
  a,
  env,
  say,
  root,
  native = {},
  proc = process,
}) {
  const serial = serialOf(a, env);
  const need = (v, n) => {
    if (!v) throw new UsageError(`${n} is required`);
    return v;
  };
  const checkout = resolve(need(a.checkout, '--checkout'));
  const sha = need(a.sha, '--sha');
  const prov = await provenanceProblems(checkout, sha, (x) => io.git(x, checkout));
  if (prov.length) throw new Refused(`refused: ${prov.join('; ')}`);
  let allowList = [];
  const listFile = join(root, 'allowed-devices.json');
  if (existsSync(listFile)) {
    try {
      allowList = JSON.parse(readFileSync(listFile, 'utf8'));
    } catch (e) {
      throw new Refused(`refused: ${listFile} is not readable JSON (${e.message})`, 2);
    }
    const bad = allowListProblems(allowList);
    if (bad.length)
      throw new Refused(`refused: the device allow-list is not acceptable: ${bad.join('; ')}`, 2);
  }
  const disk = (p) => {
    const s = statfsSync(p);
    return s.bavail * s.bsize;
  };
  const deps = {
    env,
    root,
    tmp: tmpdir(),
    allowList,
    freeBytes: native.freeBytes ?? (() => freemem()),
    commitBytes: native.commitBytes ?? (() => io.commitFree()),
    diskFree: native.diskFree ?? disk,
    maestro: native.maestro ?? locateMaestro({ env, onPath: onPath(env) }),
    decl: native.decl ?? loadDeclaration(FLOWS),
    sleep: native.sleep,
    log: say,
  };
  const args = {
    m,
    io,
    dir,
    serial,
    batteryName: a.battery ?? 'smoke',
    checkout,
    sha,
    apkPath: need(a.apk, '--apk'),
    builtAt: need(a['built-at'], '--built-at'),
    deps,
  };
  if (sub === 'conditions') return runNative({ ...args, onlyConditions: true });
  const ac = new AbortController();
  deps.signal = ac.signal;
  const off = installInterrupt(proc, () => ac.abort());
  try {
    return await runNative(args);
  } finally {
    off();
  }
}
