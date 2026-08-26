#!/usr/bin/env node
// Runs every script in db/checks (ADU-DB-01 Appendix C as executable checks).
//
// TIER-0 STATE: db/checks is deliberately EMPTY and this passes trivially.
//
// The target is FIFTEEN passes (ADU-CON-02 v3.0 sections 13, 15 and 16), but the
// binding baseline ADU-DB-01 v1.6 Appendix C defines only FOURTEEN checks, and
// its check 14 expects 105 tables where ADU-CON-02 v3.0 requires 107. Check 15
// (grep -c "MATERIALIZED VIEW" = 0, ruling R16) exists only in the pending
// ADU-DB-01 v1.7. Authoring checks now would mean inventing v1.7 — forbidden by
// .claude/reference/DOCUMENT_AUTHORITY.md. Status: SPEC_VERSION_GAP.

import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const checksDir = path.resolve(here, '..', '..', 'db', 'checks');

let entries = [];
try {
  entries = (await readdir(checksDir)).filter((f) => !f.startsWith('.')).sort();
} catch {
  console.error(`FAIL  db/checks not found at ${checksDir}`);
  process.exit(2);
}

if (entries.length === 0) {
  console.log('0 checks present (pre-v1.7)');
  console.log('Target is 15 (ADU-CON-02 v3.0 section 13). ADU-DB-01 v1.6 Appendix C');
  console.log('defines 14, and check 15 arrives with the v1.7 reissue. SPEC_VERSION_GAP.');
  process.exit(0);
}

let failed = 0;
for (const entry of entries) {
  const full = path.join(checksDir, entry);
  const isSql = entry.endsWith('.sql');
  const result = isSql
    ? spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-f', full, process.env.DATABASE_URL ?? ''], {
        stdio: 'inherit',
      })
    : spawnSync(process.execPath, [full], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`FAIL  ${entry}`);
    failed += 1;
  } else {
    console.log(`PASS  ${entry}`);
  }
}

console.log(`\n${entries.length - failed} of ${entries.length} checks passed.`);
process.exit(failed > 0 ? 1 : 0);
