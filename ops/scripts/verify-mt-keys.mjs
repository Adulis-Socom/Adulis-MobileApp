#!/usr/bin/env node
/**
 * ops/scripts/verify-mt-keys.mjs -- MT-KEYS.md is current, and the
 * HUMAN-REQUIRED list is a gate rather than a note.
 *
 * WHY THIS EXISTS. Nothing in CI touched that file, so it drifted from
 * en.ts silently -- and did, within one work order: T7 Phase 5's repairs
 * added a key and left the manifest one behind, which a fact-check caught by
 * hand. A work list that can be wrong without anything noticing hands a
 * translator the wrong work.
 *
 * Two assertions, and the second is the one ADU-RUL-03 S4 asks for:
 *   1. Regenerating changes nothing. Same shape as the contract gate: the
 *      generator is the author, and a hand-edit is a red build.
 *   2. Every HUMAN-REQUIRED key is listed under that heading, and its am.ts
 *      value is NOT a machine translation -- which here means it is exactly
 *      the English, because a person who has not been translated for should
 *      read the sentence that was actually written rather than one nobody
 *      checked.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = path.join(root, 'packages', 'locale', 'MT-KEYS.md');
const before = readFileSync(manifest, 'utf8');

execFileSync(process.execPath, [path.join(root, 'packages', 'locale', 'generate-mt-keys.mjs')], {
  stdio: 'ignore',
});
const after = readFileSync(manifest, 'utf8');

let failures = 0;
const fail = (m) => {
  console.error(`  FAIL  ${m}`);
  failures += 1;
};
const pass = (m) => console.log(`  PASS  ${m}`);

if (before !== after) {
  fail('MT-KEYS.md was stale: regenerating it changed the file. Commit the regenerated manifest.');
} else {
  pass('MT-KEYS.md is what the generator produces');
}

// The HUMAN-REQUIRED half.
const en = readFileSync(path.join(root, 'packages', 'locale', 'src', 'en.ts'), 'utf8');
const am = readFileSync(path.join(root, 'packages', 'locale', 'src', 'am.ts'), 'utf8');
/**
 * The VALUE of a key: the string literals between this key and the next one,
 * concatenated. Reading the raw source text instead compares a trailing
 * `// HUMAN-REQUIRED` comment as though it were part of the sentence, which
 * is how the first version of this gate failed two keys that were identical.
 */
const value = (src, key) => {
  const keys = [...src.matchAll(/^ {2}'([^']+)':/gm)];
  const at = keys.findIndex((m) => m[1] === key);
  if (at === -1) return null;
  const start = (keys[at].index ?? 0) + keys[at][0].length;
  const end = at + 1 < keys.length ? (keys[at + 1].index ?? src.length) : src.length;
  const body = src.slice(start, end);
  const literals = [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
  return literals.length ? literals.join('') : null;
};

const gatedSection = after.split('## Machine-translated placeholders')[0];
const gated = [...gatedSection.matchAll(/^- `([^`]+)`$/gm)].map((m) => m[1]);
const markedInAm = [...am.matchAll(/^ {2}'([^']+)':/gm)]
  .filter((m, i, all) => {
    const start = m.index ?? 0;
    const next = all[i + 1]?.index ?? am.length;
    return am.slice(start, next).includes('HUMAN-REQUIRED');
  })
  .map((m) => m[1]);

for (const k of markedInAm) {
  if (!gated.includes(k)) fail(`${k} is HUMAN-REQUIRED in am.ts but not listed under that heading`);
}
for (const k of gated) {
  if (!markedInAm.includes(k)) fail(`${k} is listed as HUMAN-REQUIRED but carries no marker in am.ts`);
  const a = value(am, k);
  const e = value(en, k);
  if (a === null || e === null) {
    fail(`${k}: could not read both values to compare`);
  } else if (a !== e) {
    fail(
      `${k}: the Amharic value differs from the English. A HUMAN-REQUIRED string is ` +
        'either written by a person -- in which case remove the marker -- or left as the ' +
        'English. What it must never be is machine-translated.',
    );
  }
}
if (failures === 0) {
  pass(`${gated.length} HUMAN-REQUIRED key(s) carry the English and are listed as a gate`);
}

if (failures > 0) {
  console.error(`\nFAIL  ${failures} problem(s) with the translation work list.`);
  process.exit(1);
}
console.log('\nPASS  MT-KEYS.md is current and the HUMAN-REQUIRED gate holds.\n');
