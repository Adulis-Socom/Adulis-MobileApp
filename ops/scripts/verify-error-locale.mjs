#!/usr/bin/env node
/**
 * `pnpm verify:error-locale` — ADU-API-01 v1.6 section 7.3, made executable:
 *
 *   "INVARIANT — CI fails when any code in S7.1 lacks an entry in both the
 *    English and the Amharic catalogue."
 *
 * The check is possible BECAUSE keys are derived (7.2): every code's key is
 * mechanically `error.<group>.<code lower>`, so this script needs no
 * mapping table — it reads the API's closed taxonomy and both locale files
 * and demands the derivation exists in each.
 *
 * Two consequences the document accepts by name: a new code cannot ship
 * without its Amharic string (friction, and the point), and
 * machine-translated placeholders SATISFY this gate — presence, not
 * quality; the human-translation gate is separate and later.
 *
 * Reads sources as text rather than importing them: this script must not
 * couple ops/ to either package's build, and the shapes it parses are the
 * two files' own documented conventions.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

const catalogue = await readFile(
  path.join(root, 'apps', 'api', 'src', 'common', 'errors', 'error-catalogue.ts'),
  'utf8',
);
const en = await readFile(path.join(root, 'packages', 'locale', 'src', 'en.ts'), 'utf8');
const am = await readFile(path.join(root, 'packages', 'locale', 'src', 'am.ts'), 'utf8');

const codes = [...catalogue.matchAll(/^\s*([A-Z_]+): \{ group: '(\w+)'/gm)].map(
  ([, code, group]) => ({ code, key: `error.${group}.${code.toLowerCase()}` }),
);

if (codes.length === 0) {
  console.error('FAIL  parsed zero codes from error-catalogue.ts — the parser or the file moved.');
  process.exit(2);
}

const missing = [];
for (const { code, key } of codes) {
  if (!en.includes(`'${key}'`)) missing.push(`${code}: '${key}' absent from en.ts`);
  if (!am.includes(`'${key}'`)) missing.push(`${code}: '${key}' absent from am.ts`);
}

if (missing.length > 0) {
  console.error(`\nFAIL  the error catalogue and the locale catalogues disagree (S7.3):\n`);
  for (const m of missing) console.error(`      ${m}`);
  console.error(
    `\n      A new code cannot ship without BOTH strings. Machine-translated` +
      `\n      placeholders satisfy this gate; human translation is a later, separate one.\n`,
  );
  process.exit(1);
}

console.log(
  `\nPASS  every one of ${codes.length} error codes carries its derived key in both catalogues.\n`,
);
