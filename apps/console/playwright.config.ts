/**
 * playwright.config.ts -- the console harness, owed at C-3 and overdue.
 *
 * WHY IT EXISTS. Every console verification through C-3 was a browser driven
 * once, by hand, on the day the screen was built. That proves the screen
 * worked; it proves nothing about tomorrow. T9 Phase 4's three defects are the
 * argument -- a link that navigated back to Home, a provider nothing read, a
 * state that could not fire -- and **none was found by reading the diff.**
 *
 * IT USES AN INSTALLED BROWSER RATHER THAN A DOWNLOADED ONE. `channel` points
 * at Edge, which is present on this machine and on GitHub's ubuntu image, and
 * is what `boot-smoke` already drives. Downloading a private Chromium adds
 * ~130 MB to every install for a second copy of a browser both environments
 * already have. Override with PLAYWRIGHT_CHANNEL where that is wrong.
 *
 * THE STATIC SERVER IS PLAYWRIGHT'S; THE API IS NOT. `webServer` serves the
 * BUILT console -- the artifact that ships, not the dev server -- and the API
 * is started by the gate, because it needs the migrated database, the
 * environment and NODE_ENV=development for the dev SMS adapter the sign-in
 * helper reads.
 */
import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env['E2E_CONSOLE_PORT'] ?? 5173);

export default defineConfig({
  testDir: './e2e',
  // The suite drives one API and one database. Parallel workers would share
  // the seeded seller's rate-limit buckets and its single session list, which
  // is D-124's shape: a 429 about nothing, intermittently.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: [['list']],
  // One sign-in for the run: the phone's OTP budget is 3/hour and a
  // per-test sign-in spends it by the fourth test (D-124's class).
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    storageState: path.join(here, 'e2e', '.auth', 'state.json'),
    channel: process.env['PLAYWRIGHT_CHANNEL'] ?? 'msedge',
    headless: true,
    // A failure in a browser test is nearly unreadable without them, and both
    // are discarded on success so a green run leaves nothing behind.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node e2e/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}/`,
    /*
     * NEVER REUSED BY DEFAULT (T11 Phase 2, D-160's other half). The first
     * version reused any existing server whenever CI was unset -- which is
     * every local run -- so the suite would drive WHATEVER was on the port:
     * a dev server with no CSP, a stale bundle, anything. Combined with the
     * production connect-src bug, that is the only way sixteen tests ever
     * went green, and it meant the built artifact was never once under test.
     *
     * Reuse is now an explicit, human act (E2E_REUSE_SERVER=1) for tight
     * dev loops only. The gate never sets it, and even when a human does,
     * the identity spec still asserts the served page carries this run's
     * build id -- two independent controls; neither trusted alone.
     */
    reuseExistingServer: process.env['E2E_REUSE_SERVER'] === '1',
    timeout: 30_000,
    // serve.mjs derives its connect-src from this -- the same value the
    // build consumed -- so the policy and the origin cannot drift apart.
    env: {
      ...(process.env['E2E_API_BASE_URL']
        ? { E2E_API_BASE_URL: process.env['E2E_API_BASE_URL'] }
        : {}),
    },
  },
});
