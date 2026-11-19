// A device setting is changed only when it can be put back, and it is put back after a success, a
// failure, an interruption, a crash, a cancellation and a killed process: from the journal alone.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeAdb } from '../lib/adb.mjs';
import { appendEntry, journalPath, summarize } from '../lib/journal.mjs';
import {
  applySetting,
  beginSession,
  deviceIdentity,
  journalProblems,
  restoreLine,
  restoreOpen,
} from '../lib/restore.mjs';
import { fakeDevice, initialState, SERIAL } from './fake-device.mjs';

const dirs = [];
const rig = (opts = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'native-r-'));
  dirs.push(dir);
  const d = fakeDevice(opts);
  return { dir, d, adb: makeAdb(d.io, SERIAL) };
};
after(() => dirs.forEach((x) => rmSync(x, { recursive: true, force: true })));
const begin = async ({ dir, adb }) =>
  beginSession(dir, {
    run: 'native-20261118-aabbccdd',
    serial: SERIAL,
    identity: await deviceIdentity(adb),
  });
const snap = (d) =>
  JSON.stringify({
    s: d.st.settings,
    density: d.st.density,
    night: d.st.night,
    locales: d.st.locales,
    reverse: d.st.reverse,
  });
const writes = (d) =>
  d.st.log.filter((l) =>
    /settings (put|delete)|wm density \d|wm density reset|uimode night \w|airplane-mode|set-app-locales|reverse (tcp|--remove)/.test(
      l,
    ),
  );
const TALKBACK =
  'com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService';

const CASES = [
  ['animation_window', '0'],
  ['animation_transition', '0'],
  ['animation_animator', '0'],
  ['font_scale', '1.3'],
  ['stay_awake', '7'],
  ['airplane_mode', '1'],
  ['night_mode', 'yes'],
  ['density', '480'],
  ['a11y_enabled', '1'],
  ['a11y_services', TALKBACK],
  ['rotation_auto', '0'],
  ['rotation_user', '1'],
  ['app_locale', 'am-ET'],
  ['reverse:57213', 'tcp:57213'],
  ['reverse:8081', 'tcp:8081'],
];

test('every setting the driver can change is changed, journaled, and put back exactly', async () => {
  for (const [name, target] of CASES) {
    const r = rig();
    await begin(r);
    const before = snap(r.d);
    const a = await applySetting({ dir: r.dir, adb: r.adb, name, target });
    assert.equal(a.changed, true, name);
    assert.notEqual(snap(r.d), before, `${name} changed the device`);
    assert.deepEqual(
      summarize(r.dir).open.map((c) => c.setting),
      [name],
      name,
    );
    const back = await restoreOpen({ dir: r.dir, adb: r.adb });
    assert.deepEqual(back.failed, [], name);
    assert.deepEqual(back.restored, [name], name);
    assert.equal(snap(r.d), before, `${name} is back to the original`);
    assert.deepEqual(journalProblems(r.dir), [], name);
  }
});

test('a setting that was never set is deleted again, not set to a made-up default', async () => {
  const r = rig();
  await begin(r);
  assert.equal(r.d.st.settings['secure/accessibility_enabled'], undefined);
  await applySetting({ dir: r.dir, adb: r.adb, name: 'a11y_enabled', target: '1' });
  assert.equal(r.d.st.settings['secure/accessibility_enabled'], '1');
  await restoreOpen({ dir: r.dir, adb: r.adb });
  assert.equal('secure/accessibility_enabled' in r.d.st.settings, false);
  assert.ok(r.d.st.log.some((l) => l.includes('settings delete secure accessibility_enabled')));
});

test('the intent is on disk BEFORE the device is changed', async () => {
  const r = rig();
  await begin(r);
  const seen = [];
  const inner = r.d.io.adb;
  const io = {
    ...r.d.io,
    adb: async (args) => {
      if (args.join(' ').includes('settings put system font_scale 1.3'))
        seen.push(readFileSync(journalPath(r.dir), 'utf8').includes('"op":"intend"'));
      return inner(args);
    },
  };
  await applySetting({ dir: r.dir, adb: makeAdb(io, SERIAL), name: 'font_scale', target: '1.3' });
  assert.deepEqual(seen, [true]);
});

test('nothing is changed when the original value cannot be read, cannot be written back, or the restore path fails its proof', async () => {
  const cases = [
    ['unreadable original', { failOn: ['settings get system font_scale'] }, /cannot be read/, 2],
    [
      'an original the driver cannot write back',
      { settings: { 'system/font_scale': '9.9' } },
      /cannot write back/,
      1,
    ],
    [
      'a restore path that does not work on this device',
      { denyPut: ['system/font_scale'] },
      /could not be proven/,
      2,
    ],
  ];
  for (const [what, patch, re, code] of cases) {
    const state = initialState();
    Object.assign(state, { ...patch, settings: { ...state.settings, ...(patch.settings ?? {}) } });
    const r = rig({ state });
    await begin(r);
    const before = snap(r.d);
    const e = await applySetting({
      dir: r.dir,
      adb: r.adb,
      name: 'font_scale',
      target: '1.3',
    }).catch((x) => x);
    assert.match(e.message, re, what);
    assert.equal(e.code, code, what);
    assert.equal(snap(r.d), before, `${what}: the device is untouched`);
    assert.deepEqual(summarize(r.dir).changes, [], `${what}: no change was recorded`);
    assert.ok(
      !r.d.st.log.some((l) => l.includes('font_scale 1.3')),
      `${what}: the target was never sent`,
    );
  }
});

test('an unset setting that cannot be put back to unset is never changed (airplane mode)', async () => {
  const state = initialState();
  delete state.settings['global/airplane_mode_on'];
  const r = rig({ state });
  await begin(r);
  await assert.rejects(
    applySetting({ dir: r.dir, adb: r.adb, name: 'airplane_mode', target: '1' }),
    /cannot be put back to unset/,
  );
  assert.deepEqual(writes(r.d), []);
});

test('a journal that cannot be written stops the change: nothing is sent but the proof of the original', async () => {
  const r = rig();
  await begin(r);
  writeFileSync(join(r.dir, 'blocker'), 'x'); // a directory cannot be made under a file
  const e = await applySetting({
    dir: join(r.dir, 'blocker', 'sub'),
    adb: r.adb,
    name: 'font_scale',
    target: '1.3',
  }).catch((x) => x);
  assert.match(e.message, /journal could not be written/);
  assert.equal(r.d.st.settings['system/font_scale'], '1.0');
});

test('a target equal to the original is no change and writes nothing to the journal', async () => {
  const r = rig();
  await begin(r);
  const n = readFileSync(journalPath(r.dir), 'utf8').length;
  const a = await applySetting({ dir: r.dir, adb: r.adb, name: 'font_scale', target: '1.0' });
  assert.equal(a.changed, false);
  assert.equal(readFileSync(journalPath(r.dir), 'utf8').length, n);
  assert.deepEqual(writes(r.d), []);
});

test('an unknown setting, an invalid value and a setting already changed by this run are refused', async () => {
  const r = rig();
  await begin(r);
  for (const [name, target, re] of [
    ['install_non_market_apps', '1', /not a setting the driver may change/],
    ['font_scale', '9', /not a value/],
    ['reverse:9100', 'tcp:9100', /may not be reversed/],
    ['reverse:5434', 'tcp:5434', /may not be reversed/],
    ['reverse:80', 'tcp:80', /may not be reversed/],
  ])
    await assert.rejects(applySetting({ dir: r.dir, adb: r.adb, name, target }), re, name);
  await applySetting({ dir: r.dir, adb: r.adb, name: 'font_scale', target: '1.3' });
  await assert.rejects(
    applySetting({ dir: r.dir, adb: r.adb, name: 'font_scale', target: '1.5' }),
    /already changed by this run/,
  );
  assert.equal(r.d.st.settings['system/font_scale'], '1.3', 'the first original is the one kept');
});

test('a foreign reverse entry on a run port is refused: it cannot be put back', async () => {
  const state = initialState();
  state.reverse = [{ remote: 'tcp:57213', local: 'tcp:57999' }];
  const r = rig({ state });
  await begin(r);
  await assert.rejects(
    applySetting({ dir: r.dir, adb: r.adb, name: 'reverse:57213', target: 'tcp:57213' }),
    /cannot write back/,
  );
  assert.deepEqual(r.d.st.reverse, [{ remote: 'tcp:57213', local: 'tcp:57999' }]);
});

/* ---- a failed or doubtful write ---- */

test('a write that fails and left the device as it was is not an open change', async () => {
  const r = rig({ state: Object.assign(initialState(), { failOn: ['font_scale 1.3'] }) });
  await begin(r);
  await assert.rejects(
    applySetting({ dir: r.dir, adb: r.adb, name: 'font_scale', target: '1.3' }),
    /injected failure/,
  );
  assert.deepEqual(summarize(r.dir).open, []);
  assert.equal(summarize(r.dir).changes[0].state, 'not-applied');
});

test('a write that exits 0 and changes nothing is caught by the read-back; the change stays open until restored', async () => {
  const r = rig({ state: Object.assign(initialState(), { ignorePut: ['system/font_scale'] }) });
  await begin(r);
  // the proof of the restore path passes (the original is put back and read), the target is ignored
  await assert.rejects(
    applySetting({ dir: r.dir, adb: r.adb, name: 'font_scale', target: '1.3' }),
    /did not take the value 1\.3/,
  );
  assert.equal(summarize(r.dir).open[0].state, 'intended');
  const back = await restoreOpen({ dir: r.dir, adb: r.adb });
  assert.deepEqual(back.unchanged, ['font_scale']);
  assert.deepEqual(journalProblems(r.dir), []);
});

/* ---- restoring ---- */

test('changes are put back newest first, and a second restore changes nothing', async () => {
  const r = rig();
  await begin(r);
  for (const [name, target] of [
    ['font_scale', '1.3'],
    ['stay_awake', '7'],
    ['reverse:57213', 'tcp:57213'],
  ])
    await applySetting({ dir: r.dir, adb: r.adb, name, target });
  r.d.st.log.length = 0;
  const back = await restoreOpen({ dir: r.dir, adb: r.adb });
  assert.deepEqual(back.restored, ['reverse:57213', 'stay_awake', 'font_scale']);
  const order = writes(r.d).map((l) =>
    l.includes('reverse') ? 'reverse' : l.includes('stay_on') ? 'stay' : 'font',
  );
  assert.deepEqual(order, ['reverse', 'stay', 'font']);
  r.d.st.log.length = 0;
  const again = await restoreOpen({ dir: r.dir, adb: r.adb });
  assert.deepEqual([again.restored, again.unchanged, again.failed], [[], [], []]);
  assert.deepEqual(writes(r.d), []);
});

test('a value that is neither the original nor the one this run set is reported and NOT overwritten', async () => {
  const r = rig();
  await begin(r);
  await applySetting({ dir: r.dir, adb: r.adb, name: 'font_scale', target: '1.3' });
  r.d.st.settings['system/font_scale'] = '1.5'; // the user changed it meanwhile
  const back = await restoreOpen({ dir: r.dir, adb: r.adb });
  assert.equal(back.failed.length, 1);
  assert.match(
    back.failed[0].why,
    /neither the original '1\.0' nor this run's '1\.3'.*not overwritten/,
  );
  assert.equal(r.d.st.settings['system/font_scale'], '1.5');
  assert.equal(summarize(r.dir).open[0].state, 'restore-failed');
  assert.match(restoreLine(back), /^restoration FAILED for 1: font_scale/);
  assert.equal(journalProblems(r.dir).length, 1);
});

test('a write that fails while restoring is a reported failure; the journal keeps it open and a later replay completes it', async () => {
  const r = rig();
  await begin(r);
  await applySetting({ dir: r.dir, adb: r.adb, name: 'font_scale', target: '1.3' });
  r.d.st.denyPut = ['system/font_scale'];
  const first = await restoreOpen({ dir: r.dir, adb: r.adb });
  assert.equal(first.failed.length, 1);
  assert.equal(r.d.st.settings['system/font_scale'], '1.3');
  r.d.st.denyPut = [];
  const later = await restoreOpen({ dir: r.dir, adb: r.adb });
  assert.deepEqual([later.restored, later.failed], [['font_scale'], []]);
  assert.equal(r.d.st.settings['system/font_scale'], '1.0');
});

test('a put that exits 0 but does not stick while restoring is read back and reported', async () => {
  const r = rig();
  await begin(r);
  await applySetting({ dir: r.dir, adb: r.adb, name: 'font_scale', target: '1.3' });
  r.d.st.ignorePut = ['system/font_scale'];
  const back = await restoreOpen({ dir: r.dir, adb: r.adb });
  assert.match(back.failed[0].why, /after putting it back it reads '1\.3'/);
});

test('the device behind the serial must be the one the changes were made on; otherwise nothing is touched', async () => {
  const r = rig();
  await begin(r);
  await applySetting({ dir: r.dir, adb: r.adb, name: 'font_scale', target: '1.3' });
  for (const [what, patch] of [
    ['another build', { 'ro.build.fingerprint': 'google/other/1:17/X/1:user/release-keys' }],
    ['another hardware serial', { 'ro.serialno': 'SOMEONEELSE' }],
    ['another AVD', { 'ro.boot.qemu.avd_name': 'Other_AVD' }],
  ]) {
    const other = fakeDevice({
      state: { ...JSON.parse(JSON.stringify(r.d.st)), props: { ...r.d.st.props, ...patch } },
    });
    other.st.log.length = 0; // the copy carries the original's history
    const back = await restoreOpen({ dir: r.dir, adb: makeAdb(other.io, SERIAL) });
    assert.match(back.failed[0].why, /not the one the change was made on/, what);
    assert.deepEqual(writes(other), [], `${what}: nothing was written`);
  }
});

test('a device that cannot be reached leaves every change open and says so', async () => {
  const r = rig();
  await begin(r);
  await applySetting({ dir: r.dir, adb: r.adb, name: 'font_scale', target: '1.3' });
  r.d.st.attached = false;
  const back = await restoreOpen({ dir: r.dir, adb: r.adb });
  assert.match(back.failed[0].why, /cannot be reached/);
  assert.equal(summarize(r.dir).open.length, 1);
});

test('after a reboot the settings are put back and the reverse entries, which do not survive, count as restored', async () => {
  const r = rig();
  await begin(r);
  await applySetting({ dir: r.dir, adb: r.adb, name: 'font_scale', target: '1.3' });
  await applySetting({ dir: r.dir, adb: r.adb, name: 'reverse:57213', target: 'tcp:57213' });
  r.d.st.reverse = [];
  r.d.st.bootId = 'boot-0002';
  const back = await restoreOpen({ dir: r.dir, adb: r.adb });
  assert.deepEqual(back.failed, []);
  assert.deepEqual(back.restored, ['font_scale']);
  assert.deepEqual(back.unchanged, ['reverse:57213']);
});

test('a journal that is unusable is reported, never guessed at', async () => {
  const r = rig();
  await begin(r);
  await applySetting({ dir: r.dir, adb: r.adb, name: 'font_scale', target: '1.3' });
  const text = readFileSync(journalPath(r.dir), 'utf8').split('\n').filter(Boolean);
  writeFileSync(journalPath(r.dir), `${[text[0], text[2]].join('\n')}\n`);
  const back = await restoreOpen({ dir: r.dir, adb: r.adb });
  assert.match(back.failed[0].why, /journal is unusable/);
  assert.equal(r.d.st.settings['system/font_scale'], '1.3', 'the device was not touched');
  assert.match(journalProblems(r.dir)[0], /unusable/);
  await assert.rejects(
    async () => beginSession(r.dir, { run: 'x', serial: SERIAL, identity: {} }),
    /unusable/,
  );
});

test('a new session is refused while an earlier one has open changes', async () => {
  const r = rig();
  await begin(r);
  await applySetting({ dir: r.dir, adb: r.adb, name: 'font_scale', target: '1.3' });
  await assert.rejects(
    begin(r),
    /1 device change\(s\) of an earlier session are not restored \(font_scale\)/,
  );
  await restoreOpen({ dir: r.dir, adb: r.adb });
  await begin(r);
});

/* ---- interruption, crash, cancellation ---- */

test('an interruption after the intent and before the write leaves an open change that restores as unchanged', async () => {
  const r = rig();
  await begin(r);
  appendEntry(r.dir, {
    op: 'intend',
    id: 'c1',
    setting: 'font_scale',
    original: { present: true, value: '1.0' },
    target: { present: true, value: '1.3' },
  }); // the process died here: the device was never written
  assert.equal(journalProblems(r.dir).length, 1);
  const back = await restoreOpen({ dir: r.dir, adb: r.adb });
  assert.deepEqual([back.unchanged, back.failed], [['font_scale'], []]);
});

test('an interruption after the write and before the journal learned of it restores to the original', async () => {
  const r = rig();
  await begin(r);
  appendEntry(r.dir, {
    op: 'intend',
    id: 'c1',
    setting: 'font_scale',
    original: { present: true, value: '1.0' },
    target: { present: true, value: '1.3' },
  });
  r.d.st.settings['system/font_scale'] = '1.3'; // written, never marked applied
  const back = await restoreOpen({ dir: r.dir, adb: r.adb });
  assert.deepEqual(back.restored, ['font_scale']);
  assert.equal(r.d.st.settings['system/font_scale'], '1.0');
});

test('a killed process: its journal and the device state on disk are all the next process needs', async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const killAt of ['before-put', 'after-put', 'after-applied']) {
    const dir = mkdtempSync(join(tmpdir(), 'native-kill-'));
    dirs.push(dir);
    const file = join(dir, 'device.json');
    const child = spawnSync(process.execPath, [join(here, 'kill-child.mjs'), dir, file, killAt], {
      encoding: 'utf8',
    });
    assert.ok(
      child.status !== 0 || child.signal,
      `${killAt}: the child was killed (status ${child.status}): ${child.stderr}`,
    );
    assert.ok(
      !/KILL-CHILD-SURVIVED/.test(child.stdout),
      `${killAt}: the child did not reach its end`,
    );
    const d = fakeDevice({ file });
    assert.ok(summarize(dir).open.length > 0, `${killAt}: the journal records the change`);
    const back = await restoreOpen({ dir, adb: makeAdb(d.io, SERIAL) });
    assert.deepEqual(back.failed, [], killAt);
    assert.equal(d.st.settings['system/font_scale'], '1.0', `${killAt}: font scale is back`);
    assert.deepEqual(d.st.reverse, [], `${killAt}: no reverse entry is left`);
    assert.deepEqual(journalProblems(dir), [], killAt);
  }
});
