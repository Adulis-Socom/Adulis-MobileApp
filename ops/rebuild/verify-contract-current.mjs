#!/usr/bin/env node
/**
 * `pnpm verify:contract` (ARC-BE-05): regenerate the OpenAPI contract and the typed client with the official
 * generators, then fail if either differs from the committed copy -- including the case where the committed
 * copy is MISSING (git diff alone passes vacuously on an untracked file). CI runs this on the exact head and
 * uploads the regenerated files, so the committed copies are always generator output, never hand edits.
 */
import { execFileSync } from 'node:child_process';

const FILES = ['contracts/openapi.json', 'packages/api-client/src/schema.d.ts'];
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
run('pnpm', ['generate:openapi']);
run('pnpm', ['generate:api-client']);
const status = execFileSync('git', ['status', '--porcelain', '--', ...FILES], { encoding: 'utf8' }).trim();
if (status) {
  console.log(status);
  try {
    execFileSync('git', ['--no-pager', 'diff', '--stat', '--', ...FILES], { stdio: 'inherit' });
  } catch {
    // the status lines above already name the files
  }
  console.log('verify:contract: FAIL -- the committed contract or client is not the generator output; commit the regenerated files');
  process.exit(1);
}
console.log(`verify:contract: ok -- ${FILES.join(' and ')} match their generators`);
