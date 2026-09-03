#!/usr/bin/env node
/**
 * `pnpm verify:tokens` -- the comparator `packages/tokens/README.md` has been
 * asking for since the package stopped being a placeholder:
 *
 *   "One source would be better than two; until a build step derives one from
 *    the other, A DRIFT BETWEEN THESE FILES IS A DEFECT TO FIX IN BOTH."
 *
 * A rule that depends on someone remembering is a rule that holds until the
 * week someone is busy. This is the comparison, and it exists for the same
 * reason `verify:permission-doc` and `verify:appendix` do: A VALUE GIVEN IN TWO
 * FORMS IS NOT VERIFIED UNTIL A COMPARATOR RUNS. Two forms that nothing
 * compares are two chances to be wrong, not a check.
 *
 * T20 S6.3 made this urgent rather than merely owed. Dark mode DOUBLED the
 * number of places a value can hide, and it did so in the worst possible shape:
 * the dark role values are written TWICE inside tokens.css -- once under
 * `prefers-color-scheme` for the OS default and once under `[data-theme=dark]`
 * for an explicit choice -- because a theme has three states and CSS gives no
 * way to say "these two selectors, one body" without a preprocessor this
 * repository does not have. Two hand-maintained copies of thirty values is a
 * drift waiting for its first hurried edit, and the failure is silent: the
 * toggle and the OS preference would simply disagree, on one machine, for one
 * user, in one direction.
 *
 * FOUR THINGS ARE CHECKED, and the last two are the ones dark mode added:
 *
 *   1. every TS export has its custom property, and every custom property has
 *      its export -- BOTH DIRECTIONS, per group;
 *   2. the VALUES agree;
 *   3. MODE PARITY: colorDark has exactly the keys color has. A dark value with
 *      no light twin is a token no design tool can express as a mode and no
 *      component can switch on (T20 S7.3's Light/Dark collection is precisely
 *      this shape);
 *   4. the two dark blocks in tokens.css are byte-identical to each other.
 *
 * The group table below maps a TS path to a CSS prefix. It is STRUCTURE, not
 * values -- the naming is irregular enough (`font.lineHeight` is
 * `--adu-line-height-*`, not `--adu-font-line-height-*`) that inferring it would
 * be guessing, and a comparator that guesses its own mapping can pass by
 * mapping two wrong things onto each other.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const TS = path.join(root, 'packages/tokens/src/index.ts');
const CSS = path.join(root, 'packages/tokens/tokens.css');

const failures = [];
const pass = (l, d = '') => console.log(`  PASS  ${l}${d ? `  ${d}` : ''}`);
const fail = (l, d = '') => {
  console.log(`  FAIL  ${l}${d ? `  ${d}` : ''}`);
  failures.push(l);
};

/** TS export name (and optional nested key) -> the custom-property prefix. */
const GROUPS = [
  { export: 'neutral', prefix: '--adu-neutral-', mode: 'light' },
  { export: 'neutralDark', prefix: '--adu-neutral-', mode: 'dark' },
  { export: 'color', prefix: '--adu-color-', mode: 'light' },
  { export: 'colorDark', prefix: '--adu-color-', mode: 'dark' },
  { export: 'space', prefix: '--adu-space-', mode: 'light' },
  { export: 'radius', prefix: '--adu-radius-', mode: 'light' },
  { export: 'font', nested: 'size', prefix: '--adu-font-size-', mode: 'light' },
  { export: 'font', nested: 'weight', prefix: '--adu-font-weight-', mode: 'light' },
  { export: 'font', nested: 'lineHeight', prefix: '--adu-line-height-', mode: 'light' },
];

const kebab = (k) => k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** Strip // and block comments so a commented-out value is never read as one. */
function decomment(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** The body of `export const <name> = { ... } as const;` */
function exportBody(src, name) {
  const start = src.indexOf(`export const ${name} = {`);
  if (start < 0) return null;
  let i = src.indexOf('{', start);
  let depth = 0;
  for (let j = i; j < src.length; j += 1) {
    if (src[j] === '{') depth += 1;
    else if (src[j] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(i + 1, j);
    }
  }
  return null;
}

/**
 * Top-level `key: value` pairs, ignoring anything nested.
 *
 * SPLIT ON COMMAS AT DEPTH ZERO, NOT ON LINES. The first draft was line-based
 * and silently mis-read every single-line object -- `weight: { regular: 400,
 * medium: 500, ... }` came back as ONE key whose value was the rest of the
 * line. It then reported the other three as missing from index.ts, which is the
 * comparator accusing the source of its own parsing bug. A comparator that can
 * do that is worse than none: it trains the reader to disbelieve it.
 */
function pairs(body) {
  const items = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '{' || ch === '[') depth += 1;
    if (ch === '}' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) {
      items.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  items.push(cur);

  const out = new Map();
  for (const item of items) {
    const m = /^\s*'?([A-Za-z0-9_$-]+)'?\s*:\s*([\s\S]+)$/.exec(item.trim());
    if (!m) continue;
    const v = m[2].trim();
    if (v.startsWith('{') || v.startsWith('[')) continue; // nested; handled separately
    out.set(m[1], v.replace(/^['"]|['"]$/g, ''));
  }
  return out;
}

/** Resolve `neutral[500]` / `neutralDark[0]` to the literal it names. */
function resolve(value, ramps) {
  const m = /^(neutral|neutralDark)\[(\d+)\]$/.exec(value);
  if (!m) return value;
  return ramps[m[1]]?.get(m[2]) ?? value;
}

/**
 * Resolve a CSS value one hop through the ramp, in the given mode.
 *
 * THE INDIRECTION IS THE DESIGN, NOT AN INCONSISTENCY. index.ts writes
 * `bg: neutral[0]`, which TypeScript evaluates to '#ffffff' at the point of
 * definition; tokens.css writes `--adu-color-bg: var(--adu-neutral-0)` and
 * keeps the reference live, which is exactly what lets a dark block redefine
 * eleven ramp values and move every role with them. Comparing the two without
 * resolving both sides reports thirty-eight disagreements where there are none
 * -- which is what the first run of this script did.
 */
function resolveCss(value, rampVars) {
  const m = /^var\((--adu-neutral-\d+)\)$/.exec(value.trim());
  if (!m) return value;
  return rampVars.get(m[1]) ?? value;
}

// ---------------------------------------------------------------- read
const tsSrc = decomment(await readFile(TS, 'utf8'));
const cssSrc = await readFile(CSS, 'utf8');

const ramps = {
  neutral: pairs(exportBody(tsSrc, 'neutral') ?? ''),
  neutralDark: pairs(exportBody(tsSrc, 'neutralDark') ?? ''),
};

/** Custom properties declared in a block of CSS text. */
function cssVars(block) {
  const out = new Map();
  for (const m of block.matchAll(/(--adu-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1], m[2].trim().replace(/\s*\/\*[\s\S]*?\*\/\s*/g, '').trim());
  }
  return out;
}

/** The `:root { ... }` that opens the file: the light values. */
function rootBlock(src) {
  const start = src.indexOf(':root {');
  const end = src.indexOf('\n}', start);
  return src.slice(start, end);
}

/** The two dark blocks, in source order. */
function darkBlocks(src) {
  const blocks = [];
  for (const m of src.matchAll(/:root:not\(\[data-theme='light'\]\)\s*\{|:root\[data-theme='dark'\]\s*\{/g)) {
    let depth = 0;
    const open = src.indexOf('{', m.index);
    for (let j = open; j < src.length; j += 1) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push(src.slice(open + 1, j));
          break;
        }
      }
    }
  }
  return blocks;
}

const light = cssVars(rootBlock(cssSrc));
const dark = darkBlocks(cssSrc);

// ---------------------------------------------------------------- 4. the two dark blocks
if (dark.length !== 2) {
  fail(`expected exactly two dark blocks in tokens.css, found ${dark.length}`);
} else {
  const [a, b] = dark.map((d) => [...cssVars(d)].map(([k, v]) => `${k}:${v}`).sort().join('\n'));
  if (a === b) {
    pass('the OS-preference and explicit-choice dark blocks declare identical values');
  } else {
    fail('the two dark blocks have DRIFTED -- the toggle and the OS preference disagree');
    const av = cssVars(dark[0]);
    const bv = cssVars(dark[1]);
    for (const k of new Set([...av.keys(), ...bv.keys()])) {
      if (av.get(k) !== bv.get(k)) console.log(`          ${k}: media=${av.get(k) ?? '(absent)'}  explicit=${bv.get(k) ?? '(absent)'}`);
    }
  }
}

// The dark CSS is the union of the light root (roles, declared once as var()
// references) and whatever the dark blocks override.
const darkVars = dark.length > 0 ? new Map([...light, ...cssVars(dark[0])]) : light;

// ---------------------------------------------------------------- 1 + 2. both directions, values
for (const g of GROUPS) {
  const body = exportBody(tsSrc, g.export);
  if (body === null) {
    fail(`export '${g.export}' not found in index.ts`);
    continue;
  }
  const scope = g.nested ? pairs(nestedBody(body, g.nested)) : pairs(body);
  const table = g.mode === 'dark' ? darkVars : light;

  const missing = [];
  const wrong = [];
  for (const [k, rawV] of scope) {
    const prop = `${g.prefix}${kebab(k)}`;
    const expected = String(resolve(rawV, ramps));
    if (!table.has(prop)) {
      missing.push(`${g.export}.${k} -> ${prop}`);
      continue;
    }
    const actual = resolveCss(table.get(prop), table);
    if (actual !== expected) wrong.push(`${prop}: css='${actual}' ts='${expected}'`);
  }
  // The other direction, for the groups whose prefix is theirs alone.
  const orphan = [];
  if (g.prefix !== '--adu-color-' || g.mode === 'light') {
    for (const prop of table.keys()) {
      if (!prop.startsWith(g.prefix)) continue;
      const key = prop.slice(g.prefix.length);
      if (![...scope.keys()].some((k) => kebab(k) === key)) orphan.push(prop);
    }
  }

  const label = `${g.export}${g.nested ? `.${g.nested}` : ''} <-> ${g.prefix}* (${g.mode})`;
  if (missing.length === 0 && wrong.length === 0 && orphan.length === 0) {
    pass(label, `${scope.size} values`);
  } else {
    fail(label);
    for (const m of missing) console.log(`          no custom property for  ${m}`);
    for (const w of wrong) console.log(`          value disagrees         ${w}`);
    for (const o of orphan) console.log(`          no export for           ${o}`);
  }
}

/** `font` holds nested objects; pull one out by name. */
function nestedBody(body, name) {
  const start = body.indexOf(`${name}: {`);
  if (start < 0) return '';
  let depth = 0;
  const open = body.indexOf('{', start);
  for (let j = open; j < body.length; j += 1) {
    if (body[j] === '{') depth += 1;
    else if (body[j] === '}') {
      depth -= 1;
      if (depth === 0) return body.slice(open + 1, j);
    }
  }
  return '';
}

// ---------------------------------------------------------------- 3. mode parity
const lightKeys = [...pairs(exportBody(tsSrc, 'color') ?? '').keys()].sort();
const darkKeys = [...pairs(exportBody(tsSrc, 'colorDark') ?? '').keys()].sort();
if (lightKeys.join(',') === darkKeys.join(',')) {
  pass('mode parity: colorDark has exactly the keys color has', `${lightKeys.length} roles`);
} else {
  fail('mode parity broken: a role exists in one mode and not the other');
  for (const k of lightKeys.filter((k) => !darkKeys.includes(k))) console.log(`          light only: ${k}`);
  for (const k of darkKeys.filter((k) => !lightKeys.includes(k))) console.log(`          dark only:  ${k}`);
}

console.log(
  failures.length === 0
    ? '\nPASS  index.ts and tokens.css agree, in both modes and both directions.\n'
    : `\nFAIL  ${failures.length} token disagreement(s).\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
