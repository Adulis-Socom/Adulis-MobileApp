/**
 * ADU-MOB-03 v1.0 S2.2 -- "Contrast, non-negotiable and measured rather than
 * eyeballed": 4.5:1 for text, 3:1 for every non-text element that carries
 * meaning, 7:1 for the outdoor scan set. This file is the measurement. A
 * palette that passes by eye and fails here is a palette that fails in Addis
 * at midday on a cheap panel.
 *
 * Node's built-in runner imports the token modules directly with type
 * stripping (--experimental-strip-types, present since Node 22.6 and on by
 * default from 22.18; engines pins >=22.18) -- no framework, no transpiler, no
 * dependency added to a package whose whole contract is that it imports nothing.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bg, border, brand, scan, state, text } from '../src/native/color.ts';

function channel(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  assert.ok(m, `not a 6-digit hex colour: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio, 1:1 to 21:1. */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const atLeast = (ratio, fg, back, what) => {
  const c = contrast(fg, back);
  assert.ok(c >= ratio, `${what}: ${fg} on ${back} measures ${c.toFixed(2)}:1, needs ${ratio}:1`);
};

test('every text role clears 4.5:1 on every background (S2.2)', () => {
  for (const [bn, b] of Object.entries(bg)) {
    for (const [tn, t] of Object.entries(text)) {
      if (tn === 'inverse') continue;
      atLeast(4.5, t, b, `text.${tn} on bg.${bn}`);
    }
  }
});

test('text.inverse clears 4.5:1 on the brand fill and on the scan background', () => {
  atLeast(4.5, text.inverse, brand.base, 'text.inverse on brand.base');
  atLeast(4.5, text.inverse, brand.pressed, 'text.inverse on brand.pressed');
  atLeast(4.5, text.inverse, scan.bg, 'text.inverse on scan.bg');
});

test('brand.on clears 4.5:1 on brand.base and brand.pressed; brand.base reads as text on bg.base', () => {
  atLeast(4.5, brand.on, brand.base, 'brand.on on brand.base');
  atLeast(4.5, brand.on, brand.pressed, 'brand.on on brand.pressed');
  atLeast(4.5, brand.base, bg.base, 'brand.base as link text on bg.base');
});

test('each state fg clears 4.5:1 on its own bg, and each state border clears 3:1 on the page (D6)', () => {
  for (const [name, s] of Object.entries(state)) {
    atLeast(4.5, s.fg, s.bg, `state.${name}.fg on state.${name}.bg`);
    atLeast(4.5, s.fg, bg.base, `state.${name}.fg on bg.base`);
    atLeast(3, s.border, bg.base, `state.${name}.border on bg.base`);
    atLeast(3, s.border, s.bg, `state.${name}.border on state.${name}.bg`);
  }
});

test('the meaning-carrying borders clear 3:1 on the page; the divider is exempt by design', () => {
  atLeast(3, border.strong, bg.base, 'border.strong (the input outline)');
  atLeast(3, border.strong, bg.raised, 'border.strong on bg.raised');
  atLeast(3, border.focus, bg.base, 'border.focus (the focus ring)');
  atLeast(3, border.focus, bg.raised, 'border.focus on bg.raised');
});

test('the outdoor scan set clears 7:1 (S4.1)', () => {
  atLeast(7, scan.frame, scan.bg, 'scan.frame on scan.bg');
  atLeast(7, scan.on, scan.bg, 'scan.on on scan.bg');
});

test('the negative case: the comparator refuses what it should', () => {
  // neutral[400] on white is the step border.strong deliberately skips.
  assert.ok(
    contrast('#9c968b', '#ffffff') < 3,
    'neutral[400] must measure under 3:1 or the color.ts comment is wrong',
  );
  assert.throws(() => contrast('rgba(0, 0, 0, 0.5)', '#ffffff'), /not a 6-digit hex/);
  assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01);
});
