#!/usr/bin/env node
/**
 * `pnpm verify:release` -- GOV-06 S4 RN-1 / RN-6 for the Seller Console, with its own positive control.
 *
 *  1. RN-1 NEGATIVE: a release build made WITH the fixture flag set (`ADULIS_FIXTURES=on`, default mode) contains none
 *     of the fixture markers: the module marker, an `fx_` identifier, the banner sentence, the refusal code, the
 *     demonstration code and phone, the test handle.
 *  2. RN-1 POSITIVE CONTROL: a `--mode fixture-control` build made with the same flag contains ALL of them. Without
 *     this, "none found" could mean the scan cannot see (empty directory, renamed marker) rather than "not there".
 *  3. RN-6: the release build has no demo entry and no simulated payment, payout, handoff or Reservation string.
 *  4. The built index.html carries no inline script (the CSP is `script-src 'self'`), and React is the production build.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKERS = {
  'module marker': 'ADULIS_FIXTURE_MODULE_MARKER_7f3a',
  'synthetic id': 'fx_seller_alem',
  'banner sentence': 'Demonstration data. Nothing here is real.',
  'refusal code': 'FIXTURE_BLOCKED',
  'demonstration code': '246810',
  'demonstration phone': '+251900000001',
  'test handle': '__ADULIS_FIXTURE__',
};
const FORBIDDEN_IN_RELEASE = ['Confirm Payment', 'Payment Not Received', 'payout', 'handoff', 'Reservation', 'Mark Ready', 'Demonstration accounts'];
const failures = [];
const ok = (m) => console.log(`  PASS  ${m}`);
const bad = (m) => {
  console.log(`  FAIL  ${m}`);
  failures.push(m);
};

function build(outDir, mode) {
  rmSync(path.join(root, outDir), { recursive: true, force: true });
  const args = ['exec', 'vite', 'build', '--outDir', outDir, '--emptyOutDir', ...(mode ? ['--mode', mode] : [])];
  execFileSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ADULIS_FIXTURES: 'on' },
  });
}

function filesOf(dir) {
  const abs = path.join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { recursive: true })
    .map((f) => path.join(abs, String(f)))
    .filter((f) => statSync(f).isFile());
}
const textOf = (dir) => filesOf(dir).map((f) => readFileSync(f, 'utf8')).join('\n');

build('dist-release-scan', undefined);
build('dist-fixture-scan', 'fixture-control');

const release = textOf('dist-release-scan');
const control = textOf('dist-fixture-scan');
if (filesOf('dist-release-scan').filter((f) => f.endsWith('.js')).length === 0) bad('the release build produced no JavaScript, so the scan proves nothing');

for (const [name, needle] of Object.entries(MARKERS)) {
  if (release.includes(needle)) bad(`RN-1 release build with the fixture flag set CONTAINS the ${name} (${needle})`);
  else ok(`RN-1 release build has no ${name}`);
  if (control.includes(needle)) ok(`RN-1 control (fixture-control build) contains the ${name}`);
  else bad(`RN-1 positive control: the fixture-control build is MISSING the ${name}, so the scan cannot be trusted`);
}
for (const needle of FORBIDDEN_IN_RELEASE) {
  if (release.toLowerCase().includes(needle.toLowerCase())) bad(`RN-6 release build contains "${needle}"`);
  else ok(`RN-6 release build has no "${needle}"`);
}

const index = readFileSync(path.join(root, 'dist-release-scan', 'index.html'), 'utf8');
if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(index)) bad('the release index.html contains an inline script (CSP is script-src self)');
else ok('the release index.html has no inline script');
if (release.includes('Download the React DevTools') || release.includes('react-dom.development')) bad('the release build ships a React development build');
else ok('the release build is the React production build');

rmSync(path.join(root, 'dist-release-scan'), { recursive: true, force: true });
rmSync(path.join(root, 'dist-fixture-scan'), { recursive: true, force: true });
if (failures.length > 0) {
  console.error(`\n${failures.length} release-boundary check(s) failed`);
  process.exit(1);
}
console.log('\nrelease boundary holds, and its control proves the scan can see');
