#!/usr/bin/env node
/**
 * ops/scripts/verify-mt-keys.mjs -- MT-KEYS.md is current, and the
 * HUMAN-REQUIRED class is what the ruling says it is.
 *
 * WHY THIS EXISTS. Nothing in CI touched that file, so it drifted from en.ts
 * silently -- and did, within one work order. A work list that can be wrong
 * without anything noticing hands a translator the wrong work.
 *
 * THE MEMBERSHIP IS PINNED HERE, and that is the load-bearing part. The first
 * version defined the class by a marker comment in am.ts -- the very file the
 * translation pass rewrites -- so deleting the comment and supplying a machine
 * translation passed green, and even printed a smaller count as though that
 * were fine. A rule about what may not be machine-translated cannot live in
 * the file the machine translation edits.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markedHumanRequired, valueOf } from '../../packages/locale/mt-keys-lib.mjs';

/**
 * ADU-RUL-03 S4's INVARIANT, transcribed: a machine-translated placeholder is
 * not acceptable for a string a person is legally BOUND by. The ruling names
 * the declaration; the refusal is here too because it is the other half of the
 * same act -- the sentence a person is shown when their attestation is what
 * stops them. Terms acceptance, the seller agreement and the payout
 * authorisation join this list as they land.
 */
const HUMAN_REQUIRED = ['console.signin.age_declaration', 'console.signin.age_refused'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const localeDir = path.join(root, 'packages', 'locale');
const manifestPath = path.join(localeDir, 'MT-KEYS.md');

let failures = 0;
const fail = (m) => {
  console.error(`  FAIL  ${m}`);
  failures += 1;
};
const pass = (m) => console.log(`  PASS  ${m}`);

// ---- 1. the manifest is what the generator produces ------------------------
const before = readFileSync(manifestPath, 'utf8');
execFileSync(process.execPath, [path.join(localeDir, 'generate-mt-keys.mjs')], { stdio: 'ignore' });
const after = readFileSync(manifestPath, 'utf8');
if (before !== after) {
  // PUT IT BACK. A gate that repairs what it checks turns red into green on a
  // re-run and leaves the fix unstaged; the contract gate diffs against the
  // COMMIT for the same reason. Regenerate deliberately, do not be regenerated.
  writeFileSync(manifestPath, before, 'utf8');
  fail(
    'MT-KEYS.md is stale: regenerating it would change the file. ' +
      'Run `node packages/locale/generate-mt-keys.mjs` and commit the result.',
  );
} else {
  pass('MT-KEYS.md is what the generator produces');
}

// ---- 2. the class is exactly what the ruling names -------------------------
const en = readFileSync(path.join(localeDir, 'src', 'en.ts'), 'utf8');
const am = readFileSync(path.join(localeDir, 'src', 'am.ts'), 'utf8');
const marked = markedHumanRequired(am);

for (const key of HUMAN_REQUIRED) {
  if (!marked.includes(key)) {
    fail(
      `${key} is HUMAN-REQUIRED (ADU-RUL-03 S4) and carries no marker in am.ts. ` +
        'Removing the marker is how a machine translation reaches a string a person is bound by.',
    );
  }
  if (!after.includes(`- \`${key}\``)) {
    fail(`${key} is HUMAN-REQUIRED and is not listed in MT-KEYS.md`);
  }
  const a = valueOf(am, key);
  const e = valueOf(en, key);
  if (a === null || e === null) {
    fail(`${key}: could not read both values to compare`);
  } else if (a !== e) {
    fail(
      `${key}: the Amharic value differs from the English. A HUMAN-REQUIRED string is ` +
        'either written by a person -- in which case say so here and remove it from the ' +
        'list -- or left as the English. What it must never be is machine-translated.',
    );
  }
}
for (const key of marked) {
  if (!HUMAN_REQUIRED.includes(key)) {
    fail(
      `${key} is marked HUMAN-REQUIRED in am.ts but is not in this gate's list. ` +
        'Add it here, with the ruling that put it in the class.',
    );
  }
}
if (failures === 0) {
  pass(`${HUMAN_REQUIRED.length} HUMAN-REQUIRED key(s): marked, listed, and carrying the English`);
}

if (failures > 0) {
  console.error(`\nFAIL  ${failures} problem(s) with the translation work list.`);
  process.exit(1);
}
console.log('\nPASS  MT-KEYS.md is current and the HUMAN-REQUIRED gate holds.\n');
