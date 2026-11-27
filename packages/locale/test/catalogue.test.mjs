#!/usr/bin/env node
/**
 * Runtime checks the type system cannot make (ARC-BE-05). The leaf catalogues are plain data, so each is
 * transpiled with TypeScript itself and imported; nothing is parsed by regex.
 *  1. mobile.ts reaches only the shared parts (en.ts, am.ts, entry.ts).
 *  2. Shared English never uses software-subscription vocabulary (it can reach a mobile bundle).
 *  3. English is ASCII, unpadded, and a brace appears only inside a {slot}.
 *  4. A REVIEWED Amharic entry names exactly the English slots; nothing is public before review.
 *  5. The rules catch their own planted violations.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const failures = [];

async function load(file) {
  const js = ts.transpileModule(readFileSync(path.join(src, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

// 1. import boundary
const ALLOWED = new Set(['mobile.ts', 'en.ts', 'am.ts', 'entry.ts']);
const reached = new Set();
const queue = ['mobile.ts'];
while (queue.length > 0) {
  const file = queue.pop();
  if (reached.has(file)) continue;
  reached.add(file);
  for (const { fileName: spec } of ts.preProcessFile(readFileSync(path.join(src, file), 'utf8'), true, true).importedFiles) {
    if (!/^\.\/[\w.-]+$/.test(spec)) failures.push(`${file} imports '${spec}' (only sibling parts allowed)`);
    else queue.push(`${spec.slice(2)}.ts`);
  }
}
for (const file of reached) if (!ALLOWED.has(file)) failures.push(`mobile.ts reaches ${file}, which is not a shared part`);

const SLOT = /\{([A-Za-z0-9_]+)\}/g;
const SUBSCRIPTION = /\b(subscri\w*|plans?|tiers?|billing|upgrades?)\b/i;
const slotsOf = (v) => [...new Set([...v.matchAll(SLOT)].map((m) => m[1]))].sort().join();
function englishProblems(value, shared) {
  const found = [];
  if (value.trim() === '' || value !== value.trim()) found.push('empty or padded');
  if ([...value].some((c) => c.codePointAt(0) > 0x7e || c.codePointAt(0) < 0x20)) found.push('non-ASCII or control character');
  if (/[{}]/.test(value.replace(SLOT, ''))) found.push('brace outside a {slot}');
  if (shared && SUBSCRIPTION.test(value)) found.push('software-subscription vocabulary in shared copy');
  return found;
}
function amharicProblems(en, entry) {
  if (entry.status === 'PENDING') return [];
  if (entry.status !== 'REVIEWED' || typeof entry.text !== 'string' || entry.text.trim() === '') return ['malformed entry'];
  return slotsOf(entry.text) === slotsOf(en) ? [] : [`slots {${slotsOf(en)}} vs {${slotsOf(entry.text)}}`];
}

// 5. the rules bite
const planted = [
  [englishProblems(' Hello', false), 'padded'],
  [englishProblems('A – B', false), 'non-ASCII'],
  [englishProblems('Hello {name', false), 'brace'],
  [englishProblems('Choose a plan', true), 'subscription'],
  [amharicProblems('Hello {name}', { status: 'REVIEWED', text: 'ሰላም {nam}' }), 'slots'],
];
for (const [found, expected] of planted) if (!found.some((m) => m.includes(expected))) failures.push(`rule '${expected}' does not catch its own sample`);

// 2-4. the real catalogues
const { enCommon } = await load('en.ts');
const { enConsole } = await load('en.console.ts');
const { amCommon } = await load('am.ts');
const { amConsole } = await load('am.console.ts');
for (const [part, en, am, shared] of [['shared', enCommon, amCommon, true], ['console', enConsole, amConsole, false]]) {
  for (const [key, value] of Object.entries(en)) {
    for (const p of englishProblems(value, shared)) failures.push(`${part} ${key}: ${p}`);
    if (!(key in am)) failures.push(`${part} ${key}: no Amharic entry`);
    else for (const p of amharicProblems(value, am[key])) failures.push(`${part} ${key}: Amharic ${p}`);
  }
  for (const key of Object.keys(am)) if (!(key in en)) failures.push(`${part} ${key}: Amharic key with no English`);
}
// 6. a key lives in exactly one part (the spread in catalogue.ts would let console silently overwrite shared copy)
for (const key of Object.keys(enCommon)) if (key in enConsole) failures.push(`${key}: defined in both the shared and the console part`);
for (const key of Object.keys(enConsole)) if (key.startsWith('mobile.')) failures.push(`${key}: mobile.* keys belong to the shared part`);
const catalogueText = readFileSync(path.join(src, 'catalogue.ts'), 'utf8');
if (!/PUBLIC_LOCALES = \['en'\] as const/.test(catalogueText)) failures.push('PUBLIC_LOCALES must stay English-only until every Amharic entry is REVIEWED');

if (failures.length > 0) {
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log(`  PASS  mobile.ts reaches only ${[...reached].sort().join(', ')}`);
console.log(`  PASS  ${Object.keys(enCommon).length + Object.keys(enConsole).length} English strings well shaped; Amharic complete as PENDING/REVIEWED entries; public locales: en`);
