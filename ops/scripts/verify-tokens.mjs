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

/**
 * TS export name (and optional nested key) -> the custom-property prefix.
 *
 * T21 S2 ADDED THE LAST FOUR ROWS, AND THE REASON IS THE TABLE ITSELF. This
 * list is hand-maintained, and "both directions" is only true of a property
 * that some row's prefix actually matches: the orphan loop below iterates
 * `table.keys()` filtered by `g.prefix`, so a custom property matched by NO row
 * is visited by no direction of no check. `--adu-focus-ring-*`, `--adu-touch-*`
 * and `--adu-font-family`/`--adu-font-mono` were in exactly that position --
 * declared in tokens.css, exported from index.ts, and compared by nothing.
 *
 * The hole was not theoretical. `focus.ringColor` was `color.accent`, which
 * TypeScript freezes at the LIGHT accent at the point of definition, while
 * tokens.css wrote `var(--adu-color-accent)` and kept the reference live. In
 * dark mode the two files therefore disagreed -- CSS gave the light-on-dark
 * accent (#8ab0ff), TS gave the dark-on-light one (#1e40af), which is a focus
 * ring the colour of the page it sits on. The web surfaces read the CSS and
 * were right; anything reading the TS (React Native has no other source) was
 * wrong, in the mode nobody develops in. See D-271 for that value, and
 * D-272 for this table having been able to hide it.
 */
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
  // The font's own top-level keys. `except` hands the three nested groups above
  // back to their own rows -- without it this row's orphan direction would
  // report every --adu-font-size-* and --adu-font-weight-* as unexported.
  {
    export: 'font',
    prefix: '--adu-font-',
    mode: 'light',
    except: ['--adu-font-size-', '--adu-font-weight-'],
  },
  { export: 'touchTarget', prefix: '--adu-touch-', mode: 'light' },
  { export: 'focus', prefix: '--adu-focus-', mode: 'light' },
  { export: 'focusDark', prefix: '--adu-focus-', mode: 'dark' },
];

const kebab = (k) => k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** Collapse whitespace runs to one space, for comparing wrapped font stacks. */
const flat = (v) => String(v).replace(/\s+/g, ' ').trim();

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
  let quote = null;
  let cur = '';
  for (const ch of body) {
    // T21 S2: AND NOT ON COMMAS INSIDE A STRING, which is the same bug one
    // level down. `font.family` is a font stack -- 'system-ui, -apple-system,
    // "Segoe UI", ...' -- so a depth-only split cut it into six items and kept
    // `system-ui` as the whole value. The check then reported a disagreement
    // between a value and its own first word: the comparator accusing the
    // source of its own parsing bug, exactly as the comment above describes.
    // It stayed invisible because until T21 no GROUPS row reached a value
    // containing a comma.
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else {
      if (ch === '{' || ch === '[') depth += 1;
      if (ch === '}' || ch === ']') depth -= 1;
      if (ch === ',' && depth === 0) {
        items.push(cur);
        cur = '';
        continue;
      }
    }
    cur += ch;
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

/**
 * Resolve an index.ts value that NAMES another token rather than stating one:
 * `neutral[500]`, `neutralDark[0]`, `color.accent`, `colorDark.accent`.
 *
 * The bracket form was always here for the ramp. The DOT form is T21 S2's
 * addition and it is the TS-side twin of `resolveCss` below: index.ts writes
 * `ringColor: color.accent` exactly as tokens.css writes
 * `var(--adu-color-accent)`, and a comparator that resolves one side's
 * indirection but not the other reports a disagreement where there is none --
 * which is how the first version of this check read `'color.accent' !==
 * '#1e40af'` and blamed the source for its own blind spot.
 *
 * Resolution is iterative and depth-capped: a token may name a token that names
 * a ramp step, and a cycle must not hang the gate.
 */
function resolve(value, tables) {
  let v = value;
  for (let hop = 0; hop < 4; hop += 1) {
    const bracket = /^([A-Za-z][A-Za-z0-9_$]*)\[(\d+)\]$/.exec(v);
    const dot = /^([A-Za-z][A-Za-z0-9_$]*)\.([A-Za-z][A-Za-z0-9_$]*)$/.exec(v);
    const m = bracket ?? dot;
    if (!m) return v;
    const next = tables[m[1]]?.get(m[2]);
    if (next === undefined || next === v) return v;
    v = next;
  }
  return v;
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
function resolveCss(value, table) {
  let v = value;
  for (let hop = 0; hop < 4; hop += 1) {
    // T21 S2: any --adu-* reference, not just the ramp. The focus ring points
    // at a ROLE (`var(--adu-color-accent)`), which points at nothing in light
    // and at an overridden literal in dark -- two hops in one mode, one in the
    // other. A ramp-only regex saw the outer var() and gave up, so the focus
    // row could never have been compared even once it was in the table above.
    const m = /^var\((--adu-[a-z0-9-]+)\)$/.exec(String(v).trim());
    if (!m) return v;
    const next = table.get(m[1]);
    if (next === undefined || next === v) return v;
    v = next;
  }
  return v;
}

// ---------------------------------------------------------------- read
const tsSrc = decomment(await readFile(TS, 'utf8'));
const cssSrc = await readFile(CSS, 'utf8');

/**
 * The index.ts tables a value may NAME. The two ramps were always here; `color`
 * and `colorDark` join them so `focus.ringColor: color.accent` resolves the
 * same way `--adu-focus-ring-color: var(--adu-color-accent)` does on the CSS
 * side. Resolution is per-mode by construction: the light rows resolve through
 * `color`, the dark rows through `colorDark`, because that is what the value
 * literally names.
 */
const ramps = {
  neutral: pairs(exportBody(tsSrc, 'neutral') ?? ''),
  neutralDark: pairs(exportBody(tsSrc, 'neutralDark') ?? ''),
  color: pairs(exportBody(tsSrc, 'color') ?? ''),
  colorDark: pairs(exportBody(tsSrc, 'colorDark') ?? ''),
  // `focusDark` names `focus.ringWidth`/`focus.ringOffset` rather than
  // restating '2px' twice -- the ring's GEOMETRY does not change with the
  // theme, only its colour does, and saying so once is the point. Resolving
  // that reference is this table's job; refusing it would push the source into
  // duplicating a value to satisfy its own comparator.
  focus: pairs(exportBody(tsSrc, 'focus') ?? ''),
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
    const actual = String(resolveCss(table.get(prop), table));
    // Compare on collapsed whitespace. The font stacks are wrapped across lines
    // in BOTH files, at different columns, by the same formatter that is not
    // allowed to change their meaning -- a line break inside a comma-separated
    // list is formatting, not a value. Every other token is a single word, so
    // this loosens nothing that was previously tight.
    if (flat(actual) !== flat(expected)) wrong.push(`${prop}: css='${actual}' ts='${expected}'`);
  }
  // The other direction, for the groups whose prefix is theirs alone.
  const orphan = [];
  if (g.prefix !== '--adu-color-' || g.mode === 'light') {
    for (const prop of table.keys()) {
      if (!prop.startsWith(g.prefix)) continue;
      if (g.except?.some((p) => prop.startsWith(p))) continue;
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
