#!/usr/bin/env node
/**
 * The shape of both catalogues (the shared part, which is the whole mobile catalogue, and the
 * console part), read with TypeScript's own parser (read-catalogue.mjs). The type check proves a
 * key exists in both languages; this proves what the type check cannot:
 *
 * 1. READABLE. Every value is a plain string; a value the reader cannot read fails the run, and so
 *    does a part that reads fewer strings than it should (the reader or the file moved).
 * 2. SAME KEYS. English and Amharic carry the same keys, in both directions, in each part.
 * 3. SAME SLOTS. Every key names the same {slots} in both languages, and no brace is left over, so
 *    a template cannot lose or gain a value, or ship a half-written slot.
 * 4. NO PADDING. No value is empty or starts or ends with a space.
 * 5. ASCII ENGLISH. English is ASCII, except the keys named in TYPOGRAPHIC (one range dash and one
 *    ellipsis); an Amharic value may carry a non-ASCII mark only when the same key's English does.
 * 6. CLEAN AMHARIC. A value that is not just the English text (an untranslated or human-required key
 *    keeps the English on purpose) holds ASCII and the Ethiopic block only; no Ethiopic numeral
 *    (digits are Latin digits everywhere: numbers are formatted by the app, never typed here); a Latin
 *    word only when the same key's English holds that word (the brand, a literal state name).
 *
 * Each rule is run against a sample it exists to catch before it is used.
 */
import { readCatalogue } from './read-catalogue.mjs';

const failures = [];
const TYPOGRAPHIC = new Set(['buyer.price.range', 'console.states.stale']);
const MIN_READ = { shared: 500, console: 600 };

const SLOT = /\{([A-Za-z0-9_]+)\}/g;
const slotsOf = (value) => [...new Set([...value.matchAll(SLOT)].map((m) => m[1]))].sort();
const leftoverBrace = (value) => /[{}]/.test(value.replace(SLOT, ''));
const padded = (value) => value.trim() === '' || value !== value.trim();
const nonAscii = (value) => [...value].filter((c) => c.codePointAt(0) > 0x7f);
const ETHIOPIC_BLOCK = (c) => c.codePointAt(0) >= 0x1200 && c.codePointAt(0) <= 0x137f;
const ETHIOPIC_NUMERAL = (c) => c.codePointAt(0) >= 0x1369 && c.codePointAt(0) <= 0x137c;
const latinWords = (value) => value.replace(SLOT, ' ').match(/[A-Za-z][A-Za-z0-9]*/g) ?? [];

/** The messages the rules give for a pair, or none. */
function problemsOf(key, en, am) {
  const found = [];
  if (padded(en) || padded(am)) found.push('is empty or padded with a space');
  const a = slotsOf(en).join();
  const b = slotsOf(am).join();
  if (a !== b) found.push(`names slots {${a}} in English and {${b}} in Amharic`);
  if (leftoverBrace(en) || leftoverBrace(am)) found.push('has a brace that is not part of a {slot}');
  const bad = nonAscii(en).filter(() => !TYPOGRAPHIC.has(key));
  if (bad.length > 0) found.push('English holds a non-ASCII character');
  if (am !== en) {
    const stray = nonAscii(am).filter((c) => !ETHIOPIC_BLOCK(c) && !en.includes(c));
    if (stray.length > 0) found.push('Amharic holds a character outside ASCII and the Ethiopic block');
    if ([...am].some(ETHIOPIC_NUMERAL)) found.push('Amharic holds an Ethiopic numeral');
    const foreign = latinWords(am).filter((w) => !latinWords(en).includes(w));
    if (foreign.length > 0) found.push(`Amharic holds the Latin word "${foreign[0]}", which its English does not`);
  }
  return found;
}

// Samples: every rule must catch what it exists to catch, and pass a clean pair.
// Characters are written as code points so that this file stays ASCII.
const chars = (...codePoints) => String.fromCodePoint(...codePoints);
const HELLO = chars(0x1230, 0x120b, 0x121d); // an Amharic word
const EN_DASH = chars(0x2013);
const CURLY_OPEN = chars(0x201c);
const CURLY_CLOSE = chars(0x201d);
const ETHIOPIC_TWO = chars(0x136a);
const SAMPLES = [
  ['two slots', 'Show {count} of {total}', `${HELLO} {count}`, 'names slots'],
  ['renamed slot', 'Hello {name}', `${HELLO} {nam}`, 'names slots'],
  ['half a slot', 'Hello {name}', `${HELLO} {name`, 'brace'],
  ['empty', 'Hello', '', 'empty or padded'],
  ['padded', 'Hello ', HELLO, 'empty or padded'],
  ['dash in English', `A ${EN_DASH} B`, `${HELLO} - ${HELLO}`, 'non-ASCII'],
  ['curly quote in Amharic', 'Hello', `${CURLY_OPEN}${HELLO}${CURLY_CLOSE}`, 'outside ASCII'],
  ['Ethiopic numeral', 'Page 2', `${HELLO} ${ETHIOPIC_TWO}`, 'numeral'],
  ['foreign Latin word', 'Hello', `${HELLO} Hello2`, 'Latin word'],
];
for (const [name, en, am, expected] of SAMPLES) {
  if (!problemsOf('sample', en, am).some((m) => m.includes(expected))) failures.push(`the rule for "${name}" does not catch its own sample`);
}
if (problemsOf('sample', 'Hello {name} on Adulis', `${HELLO} {name} Adulis`).length > 0) failures.push('a clean pair is reported');
if (problemsOf('buyer.price.range', `{min} ${EN_DASH} {max}`, `${HELLO} {min} {max}`).length > 0) failures.push('the named typographic key is reported');

const PARTS = [
  { name: 'shared', en: ['en.ts', 'enCommon'], am: ['am.ts', 'amCommon'] },
  { name: 'console', en: ['en.console.ts', 'enConsole'], am: ['am.console.ts', 'amConsole'] },
];
let checked = 0;
for (const part of PARTS) {
  const en = readCatalogue(...part.en);
  const am = readCatalogue(...part.am);
  failures.push(...en.problems.map((m) => `${part.en[0]}: ${m}`), ...am.problems.map((m) => `${part.am[0]}: ${m}`));
  for (const [label, read] of [['English', en], ['Amharic', am]]) {
    if (read.values.size < MIN_READ[part.name]) failures.push(`only ${read.values.size} ${part.name} ${label} strings were read: the reader or the file moved`);
  }
  for (const key of en.values.keys()) if (!am.values.has(key)) failures.push(`${key} is in ${part.en[0]} and missing from ${part.am[0]}`);
  for (const key of am.values.keys()) if (!en.values.has(key)) failures.push(`${key} is in ${part.am[0]} and missing from ${part.en[0]}`);
  for (const [key, english] of en.values) {
    const amharic = am.values.get(key);
    if (amharic === undefined) continue;
    checked += 1;
    for (const message of problemsOf(key, english, amharic)) failures.push(`${key} ${message}`);
  }
}

if (failures.length > 0) {
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log(`  PASS  ${checked} keys in both parts: same keys, same slots, no padding, ASCII English, clean Amharic`);
