import { defineConfig, devices } from '@playwright/test';

/**
 * Three servers, three projects, all serving BUILT artifacts (never the dev server):
 *  - `fixture`: the fixture-control build (ADULIS_FIXTURES=on), port 4173. Every journey, isolation, responsive and
 *    accessibility test runs here against the demonstration world.
 *  - `harness`: the test-only render-failure harness (e2e/harness), port 4175. Not the Console and never a release.
 *  - `release`: the plain release build, port 4174. Proves what a release shows: honest unavailable states, no fixture.
 * Runs in CI under the temporary RAM policy (heavy browser work is not run on the developer laptop).
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  workers: process.env['CI'] ? 2 : 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', reducedMotion: 'reduce' },
  projects: [
    { name: 'fixture', testMatch: /fixture\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173' } },
    { name: 'harness', testMatch: /harness\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4175' } },
    { name: 'release', testMatch: /release\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4174' } },
  ],
  webServer: [
    {
      command: 'pnpm exec vite build --mode fixture-control --outDir dist-fixture && pnpm exec vite preview --outDir dist-fixture --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      env: { ADULIS_FIXTURES: 'on' },
      reuseExistingServer: false,
      timeout: 240_000,
    },
    {
      command: 'pnpm exec vite build --outDir dist && pnpm exec vite preview --outDir dist --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false,
      timeout: 240_000,
    },
    {
      command: 'pnpm exec vite build --config vite.harness.config.ts && pnpm exec vite preview --config vite.harness.config.ts --host 127.0.0.1 --port 4175 --strictPort',
      url: 'http://127.0.0.1:4175',
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
