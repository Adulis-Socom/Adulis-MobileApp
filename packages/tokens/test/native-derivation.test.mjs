/**
 * The native token set DERIVES from the web set; it does not duplicate it.
 * ops/scripts/verify-tokens.mjs holds index.ts and tokens.css together; this
 * holds src/native together with index.ts. A value given in two forms is not
 * verified until a comparator runs (verify-tokens.mjs's own header).
 *
 * The structural rules of ADU-MOB-03 S2.2-S2.5 are asserted here too: the role
 * table exactly, three weights, an even line height at or above the Ethiopic
 * content height, a 4-point scale with nothing between the steps, no height
 * token, two levels of elevation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as web from '../src/index.ts';
import * as native from '../src/native/index.ts';

function leaves(v, out = []) {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => leaves(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => leaves(x, out));
  return out;
}

function keyPaths(o, prefix = '', out = []) {
  for (const [k, v] of Object.entries(o)) {
    const p = prefix ? `${prefix}.${k}` : k;
    out.push(p);
    if (v && typeof v === 'object') keyPaths(v, p, out);
  }
  return out;
}

const isHex = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
const webHex = new Set(
  leaves([web.neutral, web.neutralDark, web.color, web.colorDark]).filter(isHex),
);

/** The hex values in a role set that the web set does not export. The comparator under test. */
export function foreignHexes(roleSet, allowed = webHex) {
  return leaves(roleSet).filter((s) => isHex(s) && !allowed.has(s));
}

test('the role table is exactly ADU-MOB-03 S2.2, no more and no fewer', () => {
  assert.deepEqual(Object.keys(native.color).sort(), [
    'bg',
    'border',
    'brand',
    'overlay',
    'scan',
    'skeleton',
    'state',
    'text',
  ]);
  assert.deepEqual(Object.keys(native.bg), ['base', 'raised', 'sunken']);
  assert.deepEqual(Object.keys(native.text), ['primary', 'secondary', 'disabled', 'inverse']);
  assert.deepEqual(Object.keys(native.border), ['subtle', 'strong', 'focus']);
  assert.deepEqual(Object.keys(native.brand), ['base', 'pressed', 'subtle', 'on']);
  assert.deepEqual(Object.keys(native.state), ['info', 'success', 'warning', 'danger']);
  for (const s of Object.values(native.state))
    assert.deepEqual(Object.keys(s), ['fg', 'bg', 'border']);
  assert.deepEqual(Object.keys(native.scan), ['frame', 'bg', 'on']);
  assert.deepEqual(Object.keys(native.skeleton), ['base', 'sheen']);
  assert.deepEqual(Object.keys(native.overlay), ['scrim']);
});

test('every hex reachable from the native colour roles is a value the web set exports (one source of hues)', () => {
  const hexes = leaves(native.color).filter(isHex);
  assert.ok(hexes.length >= 25, `expected the full role table, found ${hexes.length} hex values`);
  assert.deepEqual(foreignHexes(native.color), [], 'a second palette has started');
});

test('the negative case: a role set carrying a hue the web set does not export is caught', () => {
  const rogue = { ...native.color, brand: { ...native.brand, base: '#123456' } };
  assert.deepEqual(foreignHexes(rogue), ['#123456']);
  assert.deepEqual(
    foreignHexes({ a: '#1e40af' }, new Set()),
    ['#1e40af'],
    'with an empty allowed set every hex is foreign',
  );
});

test('the scrim is neutral[900] with an alpha, and it is the only non-hex colour', () => {
  const nonHex = leaves(native.color).filter((s) => typeof s === 'string' && !isHex(s));
  assert.deepEqual(nonHex, [native.overlay.scrim]);
  const m = /^rgba\((\d+), (\d+), (\d+), (0\.\d+)\)$/.exec(native.overlay.scrim);
  assert.ok(m, `scrim is not an rgba(): ${native.overlay.scrim}`);
  const hex = '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  assert.equal(hex, web.neutral[900]);
});

test('brand.base is the console accent until ADU-MOB-03 Q1 rules the hue', () => {
  assert.equal(native.brand.base, web.color.accent);
  assert.equal(native.brand.pressed, web.color.accentActive);
  assert.equal(native.brand.subtle, web.color.accentSubtle);
  assert.equal(native.brand.on, web.color.accentText);
});

test('every line height is even and clears size x the measured Ethiopic content height (S2.3)', () => {
  const ratio = native.metrics.ethiopicContentHeight;
  assert.equal(ratio, 1.362, 'the measured value from the bundled NotoSansEthiopic files');
  assert.deepEqual(Object.keys(native.scale), [
    'display',
    'title',
    'heading',
    'body',
    'bodyStrong',
    'caption',
    'mono',
  ]);
  for (const [name, s] of Object.entries(native.scale)) {
    assert.ok(s.lineHeight >= s.size * ratio, `${name}: ${s.lineHeight} < ${s.size} x ${ratio}`);
    assert.equal(s.lineHeight % 2, 0, `${name}: line height ${s.lineHeight} is not even`);
    assert.ok(s.weight in native.face, `${name}: weight '${s.weight}' has no loaded face`);
  }
  assert.equal(
    native.scale.body.lineHeight / native.scale.body.size,
    1.5,
    'body matches the web base ratio',
  );
  assert.equal(
    native.scale.bodyStrong.size,
    native.scale.body.size,
    'emphasis is weight, never size (D6)',
  );
});

test('three weights per family, no Light, no Italic (D3)', () => {
  assert.deepEqual(
    Object.values(native.weight).sort((a, b) => a - b),
    [400, 500, 700],
  );
  assert.deepEqual(Object.keys(native.face).sort(), ['bold', 'medium', 'regular']);
  for (const v of leaves(native.typography)) {
    if (typeof v === 'string')
      assert.ok(!/light|italic|thin/i.test(v), `forbidden weight or style: ${v}`);
  }
});

test('the default family is the Latin one and the Ethiopic name appears once (D2)', () => {
  assert.equal(native.face.regular, native.family.latin);
  const mentions = leaves(native.typography).filter(
    (v) => typeof v === 'string' && /Ethiopic/i.test(v),
  );
  assert.equal(mentions.length, 1);
});

test('the 4-point scale: multiples of four, ascending, nothing between (S2.4)', () => {
  const steps = Object.keys(native.space)
    .map(Number)
    .sort((a, b) => a - b)
    .map((k) => native.space[k]);
  assert.deepEqual(steps, [0, 4, 8, 12, 16, 24, 32, 48, 64]);
  assert.equal(native.target.min, 44);
  assert.equal(native.target.gap, 8);
});

test('no height token exists anywhere in the native set (D4)', () => {
  for (const p of keyPaths(native)) {
    if (/(^|\.)(height|minHeight|maxHeight)$/.test(p)) {
      assert.ok(/shadowOffset\.height$/.test(p), `a height token: ${p}`);
    }
  }
});

test('radii are three and ascending; durations are three and ascending; elevation has two levels', () => {
  assert.deepEqual(Object.keys(native.radius), ['sm', 'md', 'full']);
  assert.ok(native.radius.sm < native.radius.md && native.radius.md < native.radius.full);
  assert.deepEqual(Object.keys(native.duration), ['fast', 'base', 'slow']);
  assert.ok(
    native.duration.fast < native.duration.base && native.duration.base < native.duration.slow,
  );
  assert.deepEqual(Object.keys(native.elevation), ['raised', 'overlay']);
  for (const e of Object.values(native.easing)) assert.equal(e.length, 4);
});
