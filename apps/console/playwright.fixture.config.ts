/**
 * playwright.fixture.config.ts -- the FIXTURE project (SC-FE-01).
 *
 * It exists beside, never inside, playwright.config.ts. That config drives the
 * BUILT console against the REAL API on a reset database (the `console-e2e` gate);
 * this one drives the Vite dev server with VITE_CONSOLE_FIXTURES=1, where the
 * transport answers from typed fixtures and no request leaves the browser. There
 * is no global sign-in, no storage state, no API and no database, so it cannot
 * touch real data and the real gate cannot start it.
 *
 *   pnpm --filter @adulis/console e2e:fixture
 */
import { defineConfig } from '@playwright/test';

const PORT = Number(process.env['E2E_FIXTURE_PORT'] ?? 5199);

export default defineConfig({
  testDir: './e2e-fixture',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env['PLAYWRIGHT_CHANNEL'] ?? 'msedge',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { VITE_CONSOLE_FIXTURES: '1' },
  },
});
