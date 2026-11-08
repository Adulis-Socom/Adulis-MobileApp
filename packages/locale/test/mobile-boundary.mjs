#!/usr/bin/env node
/**
 * The mobile catalogue's isolation, checked from source (WO-001A, founder decision D2).
 *
 * 1. src/mobile.ts reaches ONLY the *.common.ts parts - never en.ts, am.ts or a console
 *    part. The boundary is the import graph, not bundler tree-shaking.
 * 2. No shared string uses software-subscription vocabulary. Marketplace words (price,
 *    payment, order, store, level, business) are deliberately absent from the list: they
 *    are legitimate mobile commerce copy. A hit means the string belongs in a console part.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { entries, valueOf } from '../mt-keys-lib.mjs';

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const ALLOWED = new Set(['mobile.ts', 'en.common.ts', 'am.common.ts']);
const SUBSCRIPTION_VOCABULARY = /\b(subscri\w*|plans?|tiers?|billing|upgrades?)\b/i;

const failures = [];

const reached = new Set();
const queue = ['mobile.ts'];
while (queue.length > 0) {
  const file = queue.pop();
  if (reached.has(file)) continue;
  reached.add(file);
  const text = readFileSync(path.join(src, file), 'utf8');
  // TypeScript's own scanner: static, side-effect, re-export, dynamic import() and require().
  for (const { fileName: spec } of ts.preProcessFile(text, true, true).importedFiles) {
    if (!/^\.\/[\w.-]+$/.test(spec))
      failures.push(`${file} imports '${spec}' (only sibling parts allowed)`);
    else queue.push(`${spec.slice(2)}.ts`);
  }
}
for (const file of reached) {
  if (!ALLOWED.has(file)) failures.push(`mobile.ts reaches ${file}, which is not a common part`);
}

const common = readFileSync(path.join(src, 'en.common.ts'), 'utf8');
for (const { key } of entries(common)) {
  const value = valueOf(common, key) ?? '';
  if (SUBSCRIPTION_VOCABULARY.test(value)) {
    failures.push(`${key} uses software-subscription vocabulary: "${value}"`);
  }
}

if (failures.length > 0) {
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log(`  PASS  mobile.ts reaches only ${[...reached].sort().join(', ')}`);
console.log(`  PASS  ${entries(common).length} shared strings, none with subscription vocabulary`);
