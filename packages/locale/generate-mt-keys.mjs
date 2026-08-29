#!/usr/bin/env node
/**
 * Regenerate packages/locale/MT-KEYS.md -- the human translation pass's
 * WORK LIST (T7 S7.4): every key whose Amharic string is a
 * machine-translation placeholder. Today that is EVERY key in am.ts (its
 * own header says so); when the human pass replaces a batch, it deletes
 * those keys from this manifest in the same change, and AM_ENABLED turns
 * on when the manifest is empty.
 *
 * Generated from en.ts's key set so the list cannot drift from the
 * catalogue: run `node packages/locale/generate-mt-keys.mjs` after adding
 * keys.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const en = await readFile(path.join(here, 'src', 'en.ts'), 'utf8');
const keys = [...en.matchAll(/^ {2}'([^']+)':/gm)].map((m) => m[1]);

const out = [
  '# MT-KEYS -- the human translation work list',
  '',
  'Every key below carries a MACHINE-TRANSLATION placeholder in `am.ts`.',
  'The placeholders satisfy the completeness gate (a missing key is a compile',
  'error) and nothing else. `AM_ENABLED` stays off until this list is empty.',
  '',
  'When a batch is humanly translated: replace the strings in `am.ts` and',
  'delete the keys here, in the same change. Regenerate after ADDING keys:',
  '`node packages/locale/generate-mt-keys.mjs`.',
  '',
  `${keys.length} keys:`,
  '',
  ...keys.map((k) => `- \`${k}\``),
  '',
];
await writeFile(path.join(here, 'MT-KEYS.md'), out.join('\n'), 'utf8');
console.log(`MT-KEYS.md: ${keys.length} keys`);
