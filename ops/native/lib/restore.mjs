// Changing a device setting and putting it back. A setting is changed only after (1) its current value
// was read and can be written back, (2) writing that original value back was tried and read back, and
// (3) the intent was written to the journal. Putting it back never overwrites a value the run did not
// set: a third value is reported, not replaced.
import { adbOk as ok, BOOT_ID } from './adb.mjs';
import { Refused } from './guard.mjs';
import { appendEntry, nextChangeId, summarize } from './journal.mjs';
import { resolveSetting, sameValue } from './settings.mjs';

const show = (v) => (v.present ? `'${v.value}'` : 'unset');

/** What identifies the device behind a serial, read through the classified adb. */
export async function deviceIdentity(adb) {
  const prop = async (p) => {
    const r = await adb(['shell', 'getprop', p]);
    if (!ok(r)) throw new Error(`could not read ${p}`);
    return r.stdout.trim();
  };
  const boot = await adb(['shell', 'cat', BOOT_ID]);
  return {
    qemu: await prop('ro.kernel.qemu'),
    bootQemu: await prop('ro.boot.qemu'),
    hardware: await prop('ro.hardware'),
    model: await prop('ro.product.model'),
    fingerprint: await prop('ro.build.fingerprint'),
    serialno: await prop('ro.serialno'),
    avd: await prop('ro.boot.qemu.avd_name'),
    bootCompleted: await prop('sys.boot_completed'),
    bootId: ok(boot) ? boot.stdout.trim() : '',
  };
}
const FIELDS = ['qemu', 'bootQemu', 'hardware', 'model', 'fingerprint', 'serialno', 'avd'];
export const sameDevice = (a, b) => FIELDS.every((k) => a?.[k] === b?.[k]);

/** Opens a session in the journal. Open changes of an earlier session must be restored first. */
export function beginSession(dir, { run, serial, identity, pid = process.pid }) {
  const s = summarize(dir);
  if (s.corrupt)
    throw new Refused(`refused: the device journal of this run is unusable (${s.corrupt})`);
  if (s.open.length)
    throw new Refused(
      `refused: ${s.open.length} device change(s) of an earlier session are not restored (${s.open.map((c) => c.setting).join(', ')}): run \`device restore\` first`,
    );
  appendEntry(dir, { op: 'begin', run, serial, device: identity, pid });
}

const putBack = (entry, adb, original) =>
  original.present ? entry.write(adb, original.value) : entry.clear(adb);

/**
 * Sets `name` to `target`, journaled. Throws Refused BEFORE any change when the original cannot be read,
 * cannot be written back, or the journal cannot be written. Resolves { changed, id, original }.
 */
export async function applySetting({ dir, adb, name, target }) {
  const entry = resolveSetting(name);
  if (!entry.valid(`${target}`))
    throw new Refused(`refused: '${target}' is not a value ${entry.describe} may be given`);
  if (summarize(dir).open.some((c) => c.setting === name))
    throw new Refused(
      `refused: ${entry.describe} was already changed by this run and is not restored`,
    );
  let original;
  try {
    original = await entry.read(adb);
  } catch (e) {
    throw new Refused(
      `refused: ${entry.describe} cannot be read (${e.message}): its original value cannot be recorded`,
      2,
    );
  }
  if (original.present && !entry.valid(original.value))
    throw new Refused(
      `refused: ${entry.describe} is ${show(original)}, which the driver cannot write back`,
    );
  if (!original.present && !entry.clear)
    throw new Refused(`refused: ${entry.describe} is unset and cannot be put back to unset`);
  const want = { present: true, value: `${target}` };
  if (sameValue(entry, original, want)) return { changed: false, original };
  if (entry.verifyAfterWrite !== false) {
    // The restore path is proven now, on this device, with the value that is already there.
    try {
      await putBack(entry, adb, original);
      if (!sameValue(entry, await entry.read(adb), original))
        throw new Error('the value read back differs');
    } catch (e) {
      throw new Refused(
        `refused: putting ${entry.describe} back could not be proven (${e.message})`,
        2,
      );
    }
  }
  const id = nextChangeId(dir);
  try {
    appendEntry(dir, { op: 'intend', id, setting: name, original, target: want });
  } catch (e) {
    throw new Refused(
      `refused: the journal could not be written (${e.message}): nothing was changed`,
      2,
    );
  }
  try {
    await entry.write(adb, want.value);
  } catch (e) {
    const now = await entry.read(adb).catch(() => null);
    if (now && sameValue(entry, now, original)) appendEntry(dir, { op: 'not-applied', id });
    throw e;
  }
  if (entry.verifyAfterWrite !== false) {
    const now = await entry.read(adb);
    if (!sameValue(entry, now, want))
      throw new Error(
        `${entry.describe} did not take the value ${want.value} (it reads ${show(now)})`,
      );
  }
  appendEntry(dir, { op: 'applied', id });
  return { changed: true, id, original };
}

/**
 * Puts every open change back, newest first. A value that is neither the recorded original nor the one
 * this run set is left as it is and reported. Resolves { restored, unchanged, failed } and never throws
 * for a device problem: a failure to restore is a result the caller must report.
 */
export async function restoreOpen({ dir, adb }) {
  const out = { restored: [], unchanged: [], failed: [] };
  const s = summarize(dir);
  const fail = (c, why) => {
    out.failed.push({ id: c.id, setting: c.setting, why });
    try {
      appendEntry(dir, { op: 'restore-failed', id: c.id, why });
    } catch {
      // the journal is the thing that failed: the failure is still reported
    }
  };
  if (s.corrupt) {
    out.failed.push({
      id: null,
      setting: '(journal)',
      why: `the journal is unusable: ${s.corrupt}`,
    });
    return out;
  }
  if (!s.open.length) return out;
  let live;
  try {
    live = await deviceIdentity(adb);
  } catch (e) {
    for (const c of s.open) fail(c, `the device cannot be reached (${e.message})`);
    return out;
  }
  if (!s.begin || !sameDevice(s.begin.device, live)) {
    for (const c of s.open)
      fail(
        c,
        'the device on this serial is not the one the change was made on: nothing was touched',
      );
    return out;
  }
  for (const c of [...s.open].reverse()) {
    try {
      const entry = resolveSetting(c.setting);
      const cur = await entry.read(adb);
      if (sameValue(entry, cur, c.original)) {
        appendEntry(dir, { op: 'restored', id: c.id, how: 'unchanged' });
        out.unchanged.push(c.setting);
      } else if (sameValue(entry, cur, c.target)) {
        await putBack(entry, adb, c.original);
        const after = await entry.read(adb);
        if (sameValue(entry, after, c.original)) {
          appendEntry(dir, { op: 'restored', id: c.id, how: 'set' });
          out.restored.push(c.setting);
        } else fail(c, `after putting it back it reads ${show(after)}, not ${show(c.original)}`);
      } else
        fail(
          c,
          `it reads ${show(cur)}, which is neither the original ${show(c.original)} nor this run's ${show(c.target)}: not overwritten`,
        );
    } catch (e) {
      fail(c, e.message);
    }
  }
  return out;
}

/** One line for a status or a log. */
export const restoreLine = (r) =>
  r.failed.length
    ? `restoration FAILED for ${r.failed.length}: ${r.failed.map((f) => `${f.setting} (${f.why})`).join('; ')}`
    : `restored ${r.restored.length}, already original ${r.unchanged.length}`;

/** What stops a run directory from being purged or a device from being reused: unrestored changes. */
export function journalProblems(dir) {
  const s = summarize(dir);
  const p = [];
  if (s.corrupt) p.push(`the device journal is unusable: ${s.corrupt}`);
  if (s.open.length)
    p.push(
      `${s.open.length} device change(s) are not restored (${s.open.map((c) => c.setting).join(', ')})`,
    );
  return p;
}
