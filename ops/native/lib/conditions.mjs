// May a native run start? Every condition is PASS, FAIL (the rule is not met), UNKNOWN (it could not be
// checked) or BLOCKED (it depends on a condition that failed, usually "no device"). The evaluation is a
// pure function over facts the caller collected, so each rule is tested without a device. Nothing here
// changes anything, and a condition that passes is not a device result: only a run is.
import { isEmulatorSerial, SERIAL_RE } from './adb.mjs';
import { APP_ID } from './device.mjs';
import { PROTECTED_PORTS } from './protected.mjs';

const GB = 1024 ** 3;
/** Memory equals MIN_FREE.device of the harness (a test keeps them equal). */
export const NATIVE_LIMITS = { memory: 6 * GB, commit: 8 * GB, disk: 10 * GB };

export const NATIVE_CHECKS = {
  'NC-01': 'device attached and authorised',
  'NC-02': 'device identity',
  'NC-03': 'application identity',
  'NC-04': 'build verification',
  'NC-05': 'isolated endpoint',
  'NC-06': 'harness safety checks',
  'NC-07': 'free memory',
  'NC-08': 'commit headroom',
  'NC-09': 'free disk',
  'NC-10': 'toolchain',
  'NC-11': 'restoration provable',
  'NC-12': 'no other native session',
  'NC-13': 'adb server address',
};
const KIND = {
  'NC-01': 'resource',
  'NC-02': 'safety',
  'NC-03': 'safety',
  'NC-04': 'safety',
  'NC-05': 'safety',
  'NC-06': 'safety',
  'NC-07': 'resource',
  'NC-08': 'resource',
  'NC-09': 'resource',
  'NC-10': 'resource',
  'NC-11': 'safety',
  'NC-12': 'resource',
  'NC-13': 'safety',
};

/** The operator's list of non-emulator test devices: <root>/allowed-devices.json. */
export function allowListProblems(list) {
  if (!Array.isArray(list)) return ['the allow-list is not a list'];
  const p = [];
  for (const [i, e] of list.entries()) {
    if (!SERIAL_RE.test(`${e?.serial}`) || isEmulatorSerial(e?.serial))
      p.push(`entry ${i}: serial '${e?.serial}' is not a hardware serial`);
    if (!e?.hardwareSerial || !e?.model)
      p.push(`entry ${i}: hardwareSerial and model are required`);
    if (e?.disposable !== true)
      p.push(
        `entry ${i}: the operator must state "disposable": true (the device holds no personal data)`,
      );
  }
  return p;
}

/**
 * No adb server selection by the environment, whatever its value: the driver talks to the default local
 * adb server and so does the Maestro process, which receives none of these variables.
 */
export function adbEnvProblems(env) {
  return ['ANDROID_ADB_SERVER_ADDRESS', 'ADB_SERVER_SOCKET', 'ANDROID_ADB_SERVER_PORT']
    .filter((k) => env[k])
    .map((k) => `${k} is set: the driver and Maestro would not use the same adb server`);
}

/**
 * A device is used only if it is an emulator (serial `emulator-<port>` AND emulator hardware) or an
 * allow-listed disposable test device whose hardware serial and model match the entry.
 */
export function deviceIdentityProblems({ serial, identity, allowList }) {
  const p = [];
  if (!serial) return ['no device serial was named: there is no default device'];
  if (identity.bootCompleted !== '1')
    p.push('the device has not finished booting (sys.boot_completed)');
  if (isEmulatorSerial(serial)) {
    const hw =
      identity.qemu === '1' ||
      identity.bootQemu === '1' ||
      ['ranchu', 'goldfish'].includes(identity.hardware);
    if (!hw)
      p.push(
        `${serial} is named like an emulator but the device does not report emulator hardware (ro.hardware '${identity.hardware}')`,
      );
    return p;
  }
  const entry = (allowList ?? []).find((e) => e.serial === serial);
  if (!entry)
    return [`${serial} is not an emulator and is not on the allow-list: it is never used`];
  const bad = allowListProblems([entry]);
  if (bad.length) return [...p, ...bad];
  if (identity.serialno !== entry.hardwareSerial)
    p.push(`the device reports hardware serial '${identity.serialno}', not the allow-listed one`);
  if (identity.model !== entry.model)
    p.push(`the device model is '${identity.model}', not the allow-listed '${entry.model}'`);
  if (identity.qemu === '1') p.push('an allow-listed physical entry names an emulator');
  return p;
}

/** The reverse table of a prepared or unprepared device: only this run's ports, each to itself. */
export function reverseTableProblems(table, m, { prepared }) {
  const p = [];
  const mine = new Set([m.ports.api, m.ports.s3, 8081].map((x) => `tcp:${x}`));
  for (const r of table) {
    const port = Number(`${r.remote}`.replace('tcp:', ''));
    if (PROTECTED_PORTS.has(port)) p.push(`the device reverses protected port ${r.remote}`);
    else if (!mine.has(r.remote) || r.remote !== r.local)
      p.push(`the device has the reverse entry ${r.remote} -> ${r.local}, which is not this run's`);
  }
  if (prepared)
    for (const want of [m.ports.api, m.ports.s3, 8081])
      if (!table.some((r) => r.remote === `tcp:${want}` && r.local === `tcp:${want}`))
        p.push(`tcp:${want} is not reversed`);
  return p;
}

const R = (id, verdict, detail = '') => ({
  id,
  name: NATIVE_CHECKS[id],
  kind: KIND[id],
  verdict,
  detail,
});
const fromProblems = (id, problems) =>
  R(id, problems.length ? 'FAIL' : 'PASS', problems.join('; '));

/**
 * `f` is what the caller collected; a part it could not collect is `{ error }` and its conditions are
 * UNKNOWN. Resolves the list of results, one per condition, in id order.
 */
export function evaluateConditions(f) {
  const out = [];
  const blocked = (id, why) => out.push(R(id, 'BLOCKED', why));
  const unknown = (id, why) => out.push(R(id, 'UNKNOWN', why));

  // resources of the host
  const need = (id, have, limit, what) =>
    out.push(
      have === undefined || have === null || Number.isNaN(have)
        ? R(id, 'UNKNOWN', `${what} could not be read`)
        : have >= limit
          ? R(id, 'PASS', `${(have / GB).toFixed(2)} GB`)
          : R(
              id,
              'FAIL',
              `${what} ${(have / GB).toFixed(2)} GB is below ${(limit / GB).toFixed(0)} GB`,
            ),
    );

  // NC-01
  let attached = null;
  if (f.devices?.error) unknown('NC-01', f.devices.error);
  else if (!f.serial) out.push(R('NC-01', 'FAIL', 'no device serial was named'));
  else {
    const d = f.devices?.devices ?? [];
    const mine = d.find((x) => x.serial === f.serial);
    if (!d.length) out.push(R('NC-01', 'FAIL', 'no device is attached'));
    else if (d.length !== 1)
      out.push(
        R('NC-01', 'FAIL', `${d.length} devices are attached; exactly one (${f.serial}) must be`),
      );
    else if (!mine) out.push(R('NC-01', 'FAIL', `device ${f.serial} is not the attached device`));
    else if (mine.state !== 'device')
      out.push(
        R('NC-01', 'FAIL', `device ${f.serial} is '${mine.state}' (authorise it on the device)`),
      );
    else {
      attached = mine;
      out.push(R('NC-01', 'PASS', f.serial));
    }
  }
  const dev = attached !== null;
  const why = 'no usable device (NC-01)';

  // NC-02 .. NC-04 need the device
  if (!dev) {
    for (const id of ['NC-02', 'NC-03', 'NC-04']) blocked(id, why);
  } else {
    if (f.identity?.error) unknown('NC-02', f.identity.error);
    else
      out.push(
        fromProblems(
          'NC-02',
          deviceIdentityProblems({
            serial: f.serial,
            identity: f.identity,
            allowList: f.allowList,
          }),
        ),
      );
    if (f.build?.error) {
      unknown('NC-03', f.build.error);
      unknown('NC-04', f.build.error);
    } else {
      const pkg = [];
      if (!f.build.facts.package.installed) pkg.push(`${APP_ID} is not installed`);
      else if (!f.build.facts.package.debuggable)
        pkg.push(`${APP_ID} is not a debuggable build: its data would be cleared`);
      if (f.build.appJsonPackage !== APP_ID)
        pkg.push(`apps/mobile/app.json names ${f.build.appJsonPackage}, not ${APP_ID}`);
      out.push(fromProblems('NC-03', pkg));
      out.push(fromProblems('NC-04', f.build.problems));
    }
  }

  // NC-05 endpoint
  if (!dev) blocked('NC-05', why);
  else if (f.endpoint?.error) unknown('NC-05', f.endpoint.error);
  else if (!f.endpoint.problems.length && f.endpoint.blocked) blocked('NC-05', f.endpoint.blocked);
  else out.push(fromProblems('NC-05', f.endpoint.problems));

  // NC-06 the ten identity checks of the stack and the API
  if (!f.harness) unknown('NC-06', 'the stack and API checks were not run');
  else if (f.harness.error) unknown('NC-06', f.harness.error);
  else if (f.harness.refused)
    out.push(R('NC-06', f.harness.unknownOnly ? 'UNKNOWN' : 'FAIL', f.harness.refused));
  else if (f.harness.blocked) blocked('NC-06', f.harness.blocked);
  else out.push(R('NC-06', 'PASS', 'ID-00 to ID-10'));

  need('NC-07', f.free?.memory, NATIVE_LIMITS.memory, 'free memory');
  need('NC-08', f.free?.commit, NATIVE_LIMITS.commit, 'commit headroom');
  const disks = f.free?.disks ?? [];
  const low = disks.find((d) => d.free < NATIVE_LIMITS.disk);
  out.push(
    !disks.length || disks.some((d) => d.free === undefined || Number.isNaN(d.free))
      ? R('NC-09', 'UNKNOWN', 'free disk space could not be read')
      : low
        ? R(
            'NC-09',
            'FAIL',
            `${low.where} has ${(low.free / GB).toFixed(1)} GB free, below ${NATIVE_LIMITS.disk / GB} GB`,
          )
        : R(
            'NC-09',
            'PASS',
            disks.map((d) => `${d.where} ${(d.free / GB).toFixed(1)} GB`).join(', '),
          ),
  );

  // NC-10 toolchain
  const tp = [];
  if (!f.toolchain?.adb?.version) tp.push('adb was not found or did not answer');
  tp.push(...(f.toolchain?.maestro?.problems ?? ['Maestro was not checked']));
  out.push(fromProblems('NC-10', tp));

  // NC-11 restoration
  const rp = [];
  if (f.journal?.corrupt) rp.push(`the journal is unusable: ${f.journal.corrupt}`);
  if (f.journal?.open?.length)
    rp.push(`${f.journal.open.length} earlier change(s) are not restored: run \`device restore\``);
  for (const o of f.journal?.others ?? [])
    rp.push(
      o.corrupt
        ? `run ${o.run} has an unusable device journal for this device`
        : `run ${o.run} still has ${o.open} device change(s) not restored on this device: run \`device restore --run ${o.run}\` first`,
    );
  if (f.journal && f.journal.writable === false)
    rp.push(`the journal cannot be written (${f.journal.writeError})`);
  if (!f.journal) rp.push('the journal was not checked');
  if (!dev && !rp.length) blocked('NC-11', `${why}: the original values cannot be read`);
  else if (!f.plan && !rp.length)
    unknown('NC-11', 'the settings the battery changes were not checked');
  else if (f.plan?.error) unknown('NC-11', f.plan.error);
  else out.push(fromProblems('NC-11', [...rp, ...(f.plan?.problems ?? [])]));

  // NC-12 one session at a time, and no process of an earlier one left behind
  if (!f.lock) unknown('NC-12', 'the session lock was not checked');
  else if (f.lock.held)
    out.push(
      R(
        'NC-12',
        'FAIL',
        `another native session holds this run (pid ${f.lock.pid ?? 'unknown'}${f.lock.why ? `, ${f.lock.why}` : ''})`,
      ),
    );
  else if (f.lock.orphan)
    out.push(
      R(
        'NC-12',
        'FAIL',
        `a Maestro process (pid ${f.lock.orphan.pid}) of an earlier session of this run is still running: run \`device restore\``,
      ),
    );
  else out.push(R('NC-12', 'PASS'));
  // NC-13 adb server
  out.push(fromProblems('NC-13', adbEnvProblems(f.env ?? {})));

  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** The one verdict of a list of results: { code, line } in the exit scheme of the harness. */
export function decide(results) {
  const bad = results.filter((r) => r.verdict !== 'PASS');
  const first = (list) => `${list[0].id} ${list[0].name}: ${list[0].detail}`;
  const safety = bad.filter((r) => r.kind === 'safety' && r.verdict === 'FAIL');
  if (safety.length)
    return { code: 1, line: `HARNESS REFUSED - ${first(safety)} - NO RESOURCE WAS CHANGED` };
  const unk = bad.filter((r) => r.verdict === 'UNKNOWN');
  if (unk.length)
    return {
      code: 2,
      line: `HARNESS REFUSED - ${first(unk)} (could not be checked) - NO RESOURCE WAS CHANGED`,
    };
  if (bad.length) {
    const resource = bad.filter((r) => r.kind === 'resource' && r.verdict === 'FAIL');
    return {
      code: 4,
      line: `HARNESS BLOCKED - ${first(resource.length ? resource : bad)} - NOTHING STARTED`,
    };
  }
  return { code: 0, line: null };
}
