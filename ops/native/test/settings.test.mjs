// The settings catalogue: how each value is read back from the device's own words, what may be written,
// and what cannot be put back to "unset" (and so is never changed).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeAdb } from '../lib/adb.mjs';
import {
  resolveSetting,
  reverseEntry,
  reverseTable,
  SETTINGS,
  sameValue,
} from '../lib/settings.mjs';
import { fakeDevice, initialState, SERIAL } from './fake-device.mjs';

const adbOf = (state) => {
  const d = fakeDevice({ state });
  return { d, adb: makeAdb(d.io, SERIAL) };
};

test('settings get: the word null is "unset", an empty answer is not an answer, a failure is an error', async () => {
  const { adb, d } = adbOf(initialState());
  assert.deepEqual(await SETTINGS.font_scale.read(adb), { present: true, value: '1.0' });
  assert.deepEqual(await SETTINGS.a11y_enabled.read(adb), { present: false, value: null });
  d.st.failOn = ['settings get system font_scale'];
  await assert.rejects(SETTINGS.font_scale.read(adb), /reading system\/font_scale failed/);
  d.st.failOn = [];
  const empty = makeAdb(
    { adb: async () => ({ status: 0, stdout: '\n', stderr: '', error: null }) },
    SERIAL,
  );
  await assert.rejects(SETTINGS.font_scale.read(empty), /returned nothing/);
});

test('display density: an override is a value, no override is unset, no physical density is an error', async () => {
  const { adb, d } = adbOf(initialState());
  assert.deepEqual(await SETTINGS.density.read(adb), { present: false, value: null });
  d.st.density.override = 480;
  assert.deepEqual(await SETTINGS.density.read(adb), { present: true, value: '480' });
  const odd = makeAdb(
    { adb: async () => ({ status: 0, stdout: 'garbage', stderr: '', error: null }) },
    SERIAL,
  );
  await assert.rejects(SETTINGS.density.read(odd), /no physical density/);
});

test('night mode: yes, no and auto only; a custom schedule is not something the driver can put back', async () => {
  const { adb, d } = adbOf(initialState());
  for (const v of ['yes', 'no', 'auto']) {
    d.st.night = v;
    assert.deepEqual(await SETTINGS.night_mode.read(adb), { present: true, value: v });
  }
  d.st.night = 'custom_schedule';
  await assert.rejects(SETTINGS.night_mode.read(adb), /not one the driver can put back/);
  assert.equal(SETTINGS.night_mode.valid('custom'), false);
});

test('values compare as the setting does: font scale as a number, accessibility services as text', () => {
  assert.equal(
    sameValue(SETTINGS.font_scale, { present: true, value: '1.0' }, { present: true, value: '1' }),
    true,
  );
  assert.equal(
    sameValue(
      SETTINGS.font_scale,
      { present: true, value: '1.0' },
      { present: true, value: '1.3' },
    ),
    false,
  );
  assert.equal(
    sameValue(
      SETTINGS.a11y_services,
      { present: true, value: 'a/b' },
      { present: true, value: 'a/B' },
    ),
    false,
  );
  assert.equal(
    sameValue(SETTINGS.font_scale, { present: false, value: null }, { present: true, value: '1' }),
    false,
  );
  assert.equal(
    sameValue(
      SETTINGS.font_scale,
      { present: false, value: null },
      { present: false, value: null },
    ),
    true,
  );
});

test('accessibility services must be component names; the TalkBack service qualifies, a shell fragment does not', () => {
  const v = SETTINGS.a11y_services.valid;
  assert.equal(
    v('com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService'),
    true,
  );
  assert.equal(v('a.b/c.D:e.f/g.H'), true);
  for (const bad of ['', 'plain', 'a/b;rm', 'a/b c', 'a/b$Inner', 'a/b:', ':a/b'])
    assert.equal(v(bad), false, JSON.stringify(bad));
});

test('the settings with no "unset" form cannot be cleared, so a device that has them unset is not changed', () => {
  assert.equal(SETTINGS.airplane_mode.clear, undefined);
  assert.equal(SETTINGS.night_mode.clear, undefined);
  for (const k of [
    'font_scale',
    'density',
    'a11y_services',
    'app_locale',
    'stay_awake',
    'rotation_user',
  ])
    assert.equal(typeof SETTINGS[k].clear, 'function', k);
});

test('the app locale: the list in the device answer is the value; no list is an error', async () => {
  const { adb, d } = adbOf(initialState());
  assert.deepEqual(await SETTINGS.app_locale.read(adb), { present: false, value: null });
  d.st.locales = ['am-ET', 'en-US'];
  assert.deepEqual(await SETTINGS.app_locale.read(adb), { present: true, value: 'am-ET,en-US' });
  const odd = makeAdb(
    { adb: async () => ({ status: 0, stdout: 'Unknown command', stderr: '', error: null }) },
    SERIAL,
  );
  await assert.rejects(SETTINGS.app_locale.read(odd), /has no list/);
});

test("a reverse entry: absent, this run's, or a foreign mapping to another local port", async () => {
  const { adb, d } = adbOf(initialState());
  const e = reverseEntry(57213);
  assert.deepEqual(await e.read(adb), { present: false, value: null });
  d.st.reverse = [{ remote: 'tcp:57213', local: 'tcp:57213' }];
  assert.deepEqual(await e.read(adb), { present: true, value: 'tcp:57213' });
  d.st.reverse = [{ remote: 'tcp:57213', local: 'tcp:60000' }];
  assert.deepEqual(await e.read(adb), { present: true, value: 'tcp:60000' });
  assert.equal(e.valid('tcp:60000'), false);
  assert.deepEqual(await reverseTable(adb), [{ remote: 'tcp:57213', local: 'tcp:60000' }]);
});

test('a journal name resolves to a catalogue entry or to a reversible port, and to nothing else', () => {
  assert.equal(resolveSetting('font_scale'), SETTINGS.font_scale);
  assert.equal(typeof resolveSetting('reverse:57213').write, 'function');
  for (const bad of [
    'reverse:9100',
    'reverse:5434',
    'reverse:3000',
    'reverse:abc',
    'reverse:57213:1',
    'constructor',
    '__proto__',
    'toString',
    '',
  ])
    assert.throws(() => resolveSetting(bad), /may not|not a setting/, bad);
});
