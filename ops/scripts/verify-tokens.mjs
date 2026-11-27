#!/usr/bin/env node
/**
 * `pnpm verify:tokens` (ARC-BE-05, RB25-D05) -- the shared token gate for the replacement theme.
 *
 *  1. PARITY: every token in packages/tokens/src/index.ts has its custom property in tokens.css and every
 *     custom property has its token, with the same resolved value (both directions; var() resolved).
 *  2. CTO PALETTE: the base values are exactly the approved ones.
 *  3. RETIRED THEME ABSENT: no legacy blue, no dark mode (no colorDark/neutralDark export, no
 *     prefers-color-scheme or data-theme block).
 *  4. CONTRAST (WCAG 2.x): every text pair >= 4.5:1, every control/indicator pair >= 3:1, and the two
 *     forbidden uses (white on lime, the CTO red as text) are proven to FAIL, so the rule is seen to bite.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tsText = readFileSync(path.join(root, 'packages/tokens/src/index.ts'), 'utf8');
const cssText = readFileSync(path.join(root, 'packages/tokens/tokens.css'), 'utf8');
const failures = [];
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => {
  console.log(`  FAIL  ${m}`);
  failures.push(m);
};

const js = ts.transpileModule(tsText, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const T = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

// --- 1. parity ---------------------------------------------------------------------------------------
const kebab = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const expected = new Map();
for (const [k, v] of Object.entries(T.neutral)) expected.set(`--adu-neutral-${k}`, v);
for (const [k, v] of Object.entries(T.color)) expected.set(`--adu-color-${kebab(k)}`, v);
expected.set('--adu-font-family', T.font.family);
expected.set('--adu-font-mono', T.font.mono);
for (const [k, v] of Object.entries(T.font.size)) expected.set(`--adu-font-size-${k}`, v);
for (const [k, v] of Object.entries(T.font.weight)) expected.set(`--adu-font-weight-${k}`, v);
for (const [k, v] of Object.entries(T.font.lineHeight)) expected.set(`--adu-line-height-${kebab(k)}`, v);
for (const [k, v] of Object.entries(T.space)) expected.set(`--adu-space-${k}`, v);
for (const [k, v] of Object.entries(T.radius)) expected.set(`--adu-radius-${k}`, v);
expected.set('--adu-touch-min', T.touchTarget.min);
for (const [k, v] of Object.entries(T.focus)) expected.set(`--adu-focus-${kebab(k)}`, v);

const rootBlock = /:root\s*\{([^}]*)\}/.exec(cssText)?.[1] ?? '';
const declared = new Map([...rootBlock.matchAll(/(--adu-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].replace(/\s+/g, ' ').trim()]));
const resolve = (value, depth = 0) => {
  const ref = /^var\((--adu-[a-z0-9-]+)\)$/.exec(value);
  if (!ref || depth > 10) return value;
  return declared.has(ref[1]) ? resolve(declared.get(ref[1]), depth + 1) : `unresolved ${ref[1]}`;
};
const norm = (v) => String(v).replace(/\s+/g, ' ').trim().toLowerCase();
const before = failures.length;
for (const [name, value] of expected) {
  if (!declared.has(name)) fail(`${name} exported by index.ts is missing from tokens.css`);
  else if (norm(resolve(declared.get(name))) !== norm(value)) fail(`${name}: css ${resolve(declared.get(name))} vs ts ${value}`);
}
for (const name of declared.keys()) if (!expected.has(name)) fail(`${name} in tokens.css has no token in index.ts`);
if (failures.length === before) pass(`parity: ${expected.size} tokens agree between index.ts and tokens.css in both directions`);

// --- 2. CTO palette ----------------------------------------------------------------------------------
const CTO = {
  primary: '#111111', secondary: '#f4f5f7', highlight: '#c4fe29', like: '#ef4444', borderStrong: '#7e8494', border: '#e5e7eb', bg: '#f5f5f7',
  surface: '#ffffff', textMuted: '#5b6272', danger: '#b91c1c', highlightText: '#111111',
};
const ctoWrong = Object.entries(CTO).filter(([role, hex]) => norm(T.color[role]) !== hex);
if (ctoWrong.length) for (const [role, hex] of ctoWrong) fail(`color.${role} is ${T.color[role]}, the CTO palette says ${hex}`);
else pass(`CTO palette: ${Object.keys(CTO).length} base and semantic values exact`);

// --- 3. retired theme absent ------------------------------------------------------------------------
const LEGACY_BLUE = /#(1e40af|1a3a9c|16327f|eef2ff|c7d2fe|8ab0ff|a4c2ff|bcd3ff|1b2740|33509c)\b/i;
const retired = [];
if (LEGACY_BLUE.test(tsText) || LEGACY_BLUE.test(cssText)) retired.push('a legacy blue value');
for (const name of ['colorDark', 'neutralDark', 'colorModes', 'focusDark', 'focusModes']) if (name in T) retired.push(`export ${name}`);
if (Object.keys(T.color).some((k) => k.startsWith('accent'))) retired.push('an accent* role');
if (/prefers-color-scheme|data-theme/.test(cssText)) retired.push('a dark-mode block in tokens.css');
if (retired.length) for (const r of retired) fail(`retired theme present: ${r}`);
else pass('retired theme absent: no legacy blue, no accent role, no dark mode');

// --- 4. contrast ------------------------------------------------------------------------------------
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
if (Math.abs(ratio('#000000', '#ffffff') - 21) > 0.01) fail('contrast formula self-check (black on white must be 21:1)');
const c = T.color;
const TEXT = [
  ['text', 'bg'], ['text', 'surface'], ['textSecondary', 'bg'], ['textSecondary', 'surface'], ['textMuted', 'bg'], ['textMuted', 'surface'], ['textMuted', 'surfaceMuted'],
  ['primaryText', 'primary'], ['primaryText', 'primaryHover'], ['primaryText', 'primaryActive'], ['secondaryText', 'secondary'], ['secondaryText', 'secondaryHover'], ['secondaryText', 'secondaryActive'],
  ['highlightText', 'highlight'], ['highlightText', 'highlightHover'], ['highlightText', 'highlightActive'],
  ['danger', 'surface'], ['danger', 'bg'], ['danger', 'dangerBg'], ['success', 'surface'], ['success', 'successBg'], ['warn', 'surface'], ['warn', 'warnBg'], ['info', 'surface'], ['info', 'infoBg'],
];
const NON_TEXT = [['borderStrong', 'bg'], ['borderStrong', 'surface'], ['highlightBorder', 'bg'], ['highlightBorder', 'surface'], ['like', 'bg'], ['like', 'surface'], ['dangerSolid', 'surface']];
const pairs = [
  ...TEXT.map(([fg, bg]) => [`text ${fg} on ${bg}`, c[fg], c[bg], 4.5]),
  ...NON_TEXT.map(([fg, bg]) => [`non-text ${fg} on ${bg}`, c[fg], c[bg], 3]),
  ...['bg', 'surface', 'highlight', 'secondary'].map((s) => [`focus ring on ${s}`, T.focus.ringColor, c[s], 3]),
];
for (const [label, fg, bg, min] of pairs) if (ratio(fg, bg) < min) fail(`${label}: ${ratio(fg, bg).toFixed(2)}:1 < ${min}`);
// The forbidden uses must be measured as failing, or the rules above prove nothing.
if (ratio('#ffffff', c.highlight) >= 4.5) fail('white on lime unexpectedly passes: the highlightText rule is not biting');
if (ratio(c.like, c.surface) >= 4.5) fail('the CTO red passes as text: re-check the like/danger split');
if (!failures.some((f) => f.includes(' on '))) pass(`contrast: ${pairs.length} pairs clear their targets; white-on-lime and red-as-text measured as failing`);

if (failures.length) {
  console.log(`verify:tokens: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('verify:tokens: ok');
