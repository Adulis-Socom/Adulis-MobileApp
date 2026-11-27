#!/usr/bin/env node
/**
 * `pnpm verify:release` -- GOV-06 S4 RN-1 / RN-6 for Mobile, against the REAL `expo export` output, with controls.
 *
 *  1. RELEASE (negative expectation): a production export made WITH the fixture flag set contains none of the fixture
 *     markers. A configuration flag being false proves nothing about a dynamic import; only the artifact does.
 *  2. POSITIVE CONTROL: a development-format export (`--dev`) with the same flag contains ALL of them. Without this,
 *     "none found" could mean the scan cannot see (empty directory, bytecode it cannot read, a renamed marker).
 *  3. NEGATIVE CONTROL (planted): the real release output is copied and one marker is planted in the copy; the scanner
 *     must report it. This proves the scanner itself fails when it should, on the release-format files.
 *  4. EMPTY-ARTIFACT GUARD: the release export must hold a JavaScript or Hermes bundle of real size.
 *
 * Files are read as bytes (Latin-1), so Hermes bytecode string tables are searched too: ASCII strings stay readable.
 * The CI job ALSO demonstrates the planted-source failure (a marker in code that production imports must turn this
 * script red); that is a CI-only mutation and never part of a candidate.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// L2-ROOT-01: the export platform. A JavaScript/Hermes export proves bundle contents only, never behaviour on a device.
const PLATFORM = process.env.ADULIS_EXPORT_PLATFORM === 'ios' ? 'ios' : 'android';

// Markers: each is present in src/fixtures and absent from every release (GOV-06 S4 RN-1).
const MARKERS = {
  'module marker': 'ADULIS_MOBILE_FIXTURE_MODULE_MARKER_5b2e',
  'synthetic account id': 'fx_acct_demo_owner',
  'synthetic device id': 'fx_device_demo_one',
  'synthetic market id': 'fx_market_ethiopia',
  'synthetic seller id': 'fx_seller_demo_alem',
  'banner sentence': 'Demonstration data. Nothing here is real.',
  'refusal code': 'FIXTURE_BLOCKED',
  'test handle': '__ADULIS_FIXTURE__',
  'demonstration phone': '+251900000001',
  'demonstration code': '246810',
};
// A generic reserved-id pattern, so a fixture id that is not in the list above is still caught.
const FIXTURE_ID = /fx_(acct|device|market|seller|scene|conv|cred|otp)_[a-z0-9]/;
// RN-6: strings that exist only in a demonstration. Specific UI strings and marker names, not bare words: library
// code legitimately contains words such as "payment" or "handoff", and a scan that cries wolf is switched off.
const FORBIDDEN_IN_RELEASE = {
  'Confirm Payment': 'the retired Seller payment confirmation control',
  'Payment Not Received': 'the retired Seller payment confirmation control',
  'Mark Ready': 'the retired fulfilment control',
  'Demonstration accounts': 'the demonstration account chooser',
  ADULIS_ORDER_SIMULATION_MARKER: 'the internal Order experience demonstration (GOV-06 S3)',
  'internal/order-simulation': 'the internal simulation route',
};
const MIN_BUNDLE_BYTES = 200_000;

const failures = [];
const ok = (message) => console.log(`  PASS  ${message}`);
const bad = (message) => {
  console.log(`  FAIL  ${message}`);
  failures.push(message);
};

function filesOf(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map((entry) => path.join(dir, String(entry)))
    .filter((file) => statSync(file).isFile());
}
const textOf = (dir) => filesOf(dir).map((file) => readFileSync(file).toString('latin1')).join('\n');

/** Every marker, id pattern and forbidden string found in a directory's files. */
export function scan(dir) {
  const text = textOf(dir);
  const found = [];
  for (const [name, needle] of Object.entries(MARKERS)) if (text.includes(needle)) found.push(`marker: ${name}`);
  const id = FIXTURE_ID.exec(text);
  if (id) found.push(`fixture-style id: ${id[0]}`);
  const lower = text.toLowerCase();
  for (const [needle, reason] of Object.entries(FORBIDDEN_IN_RELEASE)) if (lower.includes(needle.toLowerCase())) found.push(`forbidden (${reason}): ${needle}`);
  return found;
}

function exportBundle(outDir, extraArgs) {
  const abs = path.join(root, outDir);
  rmSync(abs, { recursive: true, force: true });
  execFileSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'expo', 'export', '--platform', PLATFORM, '--output-dir', outDir, '--clear', ...extraArgs],
    // The flag is set on purpose: a release export must ignore it.
    { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, EXPO_PUBLIC_ADULIS_FIXTURES: 'on', CI: '1' } },
  );
  return abs;
}

const releaseDir = exportBundle('dist-release-scan', []);
const controlDir = exportBundle('dist-fixture-scan', ['--dev']);
const plantedDir = path.join(root, 'dist-planted-scan');

try {
  // 4. Empty-artifact guard, on the release export.
  const bundles = filesOf(releaseDir).filter((file) => /\.(hbc|js|bundle)$/.test(file));
  const bytes = bundles.reduce((sum, file) => sum + statSync(file).size, 0);
  if (bundles.length === 0 || bytes < MIN_BUNDLE_BYTES) bad(`the release export holds ${bundles.length} bundle file(s) and ${bytes} bytes: the scan would prove nothing`);
  else ok(`the release export holds ${bundles.length} bundle file(s), ${bytes} bytes (the scan has something to read)`);

  // 1. Release must be clean.
  const inRelease = scan(releaseDir);
  if (inRelease.length > 0) for (const finding of inRelease) bad(`RN-1/RN-6 release export (flag set) CONTAINS ${finding}`);
  else ok('RN-1/RN-6 release export, built with the fixture flag set, contains no fixture marker, id or forbidden string');

  // 2. Positive control: the development export must show every marker.
  const control = textOf(controlDir);
  for (const [name, needle] of Object.entries(MARKERS)) {
    if (control.includes(needle)) ok(`positive control: the development export contains the ${name}`);
    else bad(`positive control: the development export is MISSING the ${name}, so a clean release scan cannot be trusted`);
  }

  // 3. Planted negative control on a copy of the real release output.
  rmSync(plantedDir, { recursive: true, force: true });
  mkdirSync(plantedDir, { recursive: true });
  cpSync(releaseDir, plantedDir, { recursive: true });
  writeFileSync(path.join(plantedDir, 'planted-control.txt'), 'fx_acct_planted_control ADULIS_MOBILE_FIXTURE_MODULE_MARKER_5b2e');
  const planted = scan(plantedDir);
  if (planted.length >= 2) ok(`negative control: the scan reports a marker planted in a copy of the release output (${planted.length} findings)`);
  else bad('negative control: the scan did NOT report a marker planted in a copy of the release output');
} finally {
  for (const dir of [releaseDir, controlDir, plantedDir]) rmSync(dir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n${failures.length} release-boundary check(s) failed`);
  process.exit(1);
}
console.log('\nrelease boundary holds, and its controls prove the scan can see');
