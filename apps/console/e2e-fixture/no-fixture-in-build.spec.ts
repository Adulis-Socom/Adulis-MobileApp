/**
 * Fixture project, SC-FE-01. N5: a RELEASE build contains no fixture, even when the
 * fixture variable is set. (The marker strings are unique to the fixture files on purpose:
 * 'Demonstration data' alone also appears in the shared locale package's Mobile Cart copy.) The build runs with VITE_CONSOLE_FIXTURES=1 on purpose:
 * a build that excluded the fixture only because the variable was unset would prove
 * nothing. The control is that Vite folds `import.meta.env.DEV` to false.
 *
 * The scan has a positive control (below): the same strings are found in a build
 * where DEV is true, so an empty result means absence, not a blind scan.
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MARKERS = ['ADULIS_FIXTURE_TRANSPORT_V1', 'fx_seller_a', 'no request leaves this browser', 'FIXTURE_BLOCKED'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function build(nodeEnv: 'production' | 'development', extra: string[]): { dir: string; text: string } {
  const dir = mkdtempSync(join(tmpdir(), 'adulis-fx-build-'));
  execFileSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['exec', 'vite', 'build', '--outDir', dir, '--emptyOutDir', ...extra], {
    cwd: process.cwd(),
    // NODE_ENV is set explicitly: Playwright runs with NODE_ENV=test, and Vite treats anything
    // other than 'production' as development, which would make this "release" build a dev build.
    env: { ...process.env, NODE_ENV: nodeEnv, VITE_CONSOLE_FIXTURES: '1', VITE_BUILD_ID: 'fixture-scan' },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
  const text = walk(dir)
    .filter((f) => /\.(js|html|css)$/.test(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  return { dir, text };
}

test('N5: the release build has no fixture module, data or banner, though the flag is set', async () => {
  test.setTimeout(180_000);
  const { dir, text } = build('production', []);
  try {
    expect(text.length).toBeGreaterThan(10_000); // it really scanned a bundle
    for (const m of MARKERS) expect(text.includes(m), `release bundle contains ${m}`).toBe(false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('N5 control: a build where DEV is true does contain them (the scan can see)', async () => {
  test.setTimeout(180_000);
  const { dir, text } = build('development', ['--mode', 'development']);
  try {
    expect(MARKERS.every((m) => text.includes(m)), 'positive control: scan must find every marker when DEV is true').toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
