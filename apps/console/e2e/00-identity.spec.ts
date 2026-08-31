/**
 * 00-identity.spec.ts -- THE SELF-TEST. Runs first (workers: 1, alphabetical
 * file order) and every later assertion in this suite is conditional on it.
 *
 * ==========================================================================
 * THE INVARIANT (T11 Phase 1)
 * ==========================================================================
 * The harness proves the IDENTITY of the artifact under test, not its
 * liveness. T10's adversarial pass showed why in the hardest way available:
 * sixteen tests passed against something that was not the built console --
 * the built console, under its own CSP, could not make a single API call.
 * The plants proved each assertion discriminates; nothing proved the
 * assertions were pointed at the right thing. Those are different
 * properties, and this file is the second one.
 *
 * Three checks, each of which fails BY NAME for a distinct wrong-world:
 *
 *   1. BUILD ID. The gate mints an id per run; the build stamps it on
 *      <html data-build-id>; this asserts the SERVED page carries exactly
 *      that id. A stale server, a previous bundle, a reused dev server, a
 *      wrong origin -- all fail here, immediately, named.
 *
 *   2. NOT A DEVELOPMENT BUNDLE. The gate greps the dist it just built for
 *      the dev-React marker before Playwright ever starts (the primary
 *      check); this asserts the SERVED page is the untagged-or-tagged
 *      production stamp rather than a literal template token, which catches
 *      a server serving a dist the gate did not build.
 *
 *   3. THE PAGE CAN REACH THE API ORIGIN. The exact fetch the console makes,
 *      made from the page's own context. Under the T10 policy this is the
 *      check that would have failed on day one with the refusal quoted --
 *      instead of sixteen green tests. CSP violations are captured from the
 *      browser console and quoted in the failure, so a blocking policy is
 *      loud and specific, never a vague timeout.
 */
import { test, expect } from '@playwright/test';

const API = process.env['E2E_API_BASE_URL'] ?? 'http://localhost:3000';
const EXPECTED_ID = process.env['E2E_EXPECT_BUILD_ID'];

test.describe('the artifact under test is the artifact we built', () => {
  test('identity: build id, bundle kind, and the API is reachable', async ({ page }) => {
    const cspRefusals: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && /content security policy/i.test(m.text())) {
        cspRefusals.push(m.text());
      }
    });

    await page.goto('/');
    const served = await page.evaluate(() => document.documentElement.dataset['buildId'] ?? null);

    if (EXPECTED_ID) {
      expect(
        served,
        `BUILD ID MISMATCH: the gate built ${EXPECTED_ID} but the server on this ` +
          `port is serving ${served ?? 'a page with no build id at all'}. ` +
          'This is a STALE OR FOREIGN SERVER -- a previous run, a dev server, or ' +
          'another process. Nothing this suite reports about that page is about ' +
          'the artifact under test.',
      ).toBe(EXPECTED_ID);
    } else {
      // Run outside the gate (pnpm e2e by hand): no minted id to compare, but
      // the page must still carry a REAL stamp -- 'untagged' from an ordinary
      // build, or some run's uuid -- never the raw template token, which means
      // the server is serving a dist Vite never processed.
      expect(served, 'the page carries no data-build-id at all').not.toBeNull();
    }
    expect(
      served,
      'the served page carries the literal %VITE_BUILD_ID% token: this dist was ' +
        'not produced by the Vite build (the HTML env replacement never ran).',
    ).not.toContain('%');

    /*
     * The connectivity half. GET /healthz from the page context -- the same
     * origin, the same fetch path, the same CSP every screen lives under.
     * On refusal the assertion message carries the browser's own words.
     */
    const reach = await page.evaluate(async (api) => {
      try {
        const r = await fetch(`${api}/healthz`);
        return { ok: true, status: r.status };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    }, API);

    expect(
      reach.ok,
      `THE PAGE CANNOT REACH THE API AT ${API}. Every data-bearing test after ` +
        'this one would fail for this reason while appearing to be about its ' +
        'screen. ' +
        (cspRefusals.length
          ? `The browser refused it as POLICY, not network: ${cspRefusals[0]}`
          : `No CSP refusal was logged, so this looks like the API being down or ` +
            `the origin being wrong (fetch said: ${'error' in reach ? reach.error : '?'}).`),
    ).toBe(true);
  });
});
