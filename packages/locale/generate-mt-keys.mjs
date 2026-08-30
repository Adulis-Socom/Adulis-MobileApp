#!/usr/bin/env node
/**
 * Regenerate packages/locale/MT-KEYS.md -- the human translation pass's
 * WORK LIST (T7 S7.4): every key whose Amharic string is a
 * machine-translation placeholder. When the human pass replaces a batch, it
 * deletes those keys from this manifest in the same change, and AM_ENABLED
 * turns on when the manifest is empty.
 *
 * TWO LISTS, NOT ONE (ADU-RUL-03 S4). A machine-translated placeholder is
 * not acceptable for a string a person is legally BOUND by -- an attestation
 * whose wording was never verified is not evidence of anything. Those keys
 * are marked HUMAN-REQUIRED in am.ts and listed separately here, as a GATE
 * rather than an item: the translation pass may ship the ordinary list in
 * batches, and must not ship a HUMAN-REQUIRED string at all until a person
 * has written it.
 *
 * The marker is a comment on the am.ts line, so the shape holds as many keys
 * as the class grows to -- terms acceptance, the seller agreement, the payout
 * authorisation are all coming.
 *
 * Generated from en.ts's key set so the list cannot drift from the
 * catalogue: run `node packages/locale/generate-mt-keys.mjs` after adding
 * keys. `pnpm verify:mt-keys` fails if it is stale.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markedHumanRequired } from './mt-keys-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const en = await readFile(path.join(here, 'src', 'en.ts'), 'utf8');
const am = await readFile(path.join(here, 'src', 'am.ts'), 'utf8');
const keys = [...en.matchAll(/^ {2}'([^']+)':/gm)].map((m) => m[1]);

// One reader for both this file and the gate (mt-keys-lib.mjs).
const humanRequired = new Set(markedHumanRequired(am));
const mtKeys = keys.filter((k) => !humanRequired.has(k));
const gated = keys.filter((k) => humanRequired.has(k));

const out = [
  '# MT-KEYS -- the human translation work list',
  '',
  '## HUMAN-REQUIRED -- a gate, not an item',
  '',
  'These keys carry the ENGLISH text in `am.ts`, not a machine translation,',
  'and they must not be machine-translated at all (ADU-RUL-03 S4). A person',
  'cannot attest, in a language they read, to a sentence nobody has checked --',
  'and an attestation whose wording was never verified is not evidence of',
  'anything. A human translator writes these, or they stay English.',
  '',
  gated.length ? `${gated.length} key(s):` : 'None yet.',
  '',
  ...gated.map((k) => `- \`${k}\``),
  '',
  '## Machine-translated placeholders',
  '',
  'Every key below carries a MACHINE-TRANSLATION placeholder in `am.ts`.',
  'The placeholders satisfy the completeness gate (a missing key is a compile',
  'error) and nothing else. `AM_ENABLED` stays off until BOTH lists are',
  'clear.',
  '',
  'When a batch is humanly translated: replace the strings in `am.ts` and',
  'delete the keys here, in the same change. Regenerate after ADDING keys:',
  '`node packages/locale/generate-mt-keys.mjs`.',
  '',
  `${mtKeys.length} keys:`,
  '',
  ...mtKeys.map((k) => `- \`${k}\``),
  '',
];
await writeFile(path.join(here, 'MT-KEYS.md'), out.join('\n'), 'utf8');
console.log(`MT-KEYS.md: ${mtKeys.length} machine-translated, ${gated.length} HUMAN-REQUIRED`);
