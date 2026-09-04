/**
 * environment-banner.spec.ts -- the console says which server it is on, in
 * words, before you sign in (T23 Phase 4).
 *
 * THE FAILURE IT GUARDS is not confusion in the abstract. Staging is a real
 * server on the internet with no confidentiality; a seller who believes they
 * are on production types a real phone number, real bank details and a real
 * identity document into it. The banner makes that mistake require ignoring a
 * sentence rather than merely not knowing one.
 *
 * IT IS ASSERTED ON THE SIGN-IN SCREEN, deliberately. The banner renders above
 * the router rather than inside the Shell, because sign-in is outside the
 * Shell -- and sign-in is where the wrong-server mistake is made.
 *
 * TAGGED @safety so the dark project re-runs it. A banner is a coloured strip,
 * which makes it the single most likely surface in the console to carry its
 * meaning in a colour -- exactly what rule 4 forbids and exactly what a mode
 * you do not develop in exposes.
 */
import { test, expect } from '@playwright/test';

test.describe('the environment banner @safety', () => {
  test('names the server in WORDS, on the sign-in screen, before anyone signs in', async ({
    browser,
  }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    if (!baseURL) throw new Error('the project declares no baseURL');

    // A SIGNED-OUT context. The shared storageState would put us inside the
    // shell, and the screen this banner most has to reach is the one before it.
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      baseURL,
    });
    const page = await context.newPage();
    await page.goto('/');

    const banner = page.locator('.env-banner');
    await expect(banner).toBeVisible();

    /*
     * `development`, because that is what the harness ACTUALLY starts the API
     * with -- verify-console-e2e.mjs spawns it that way so the dev SMS adapter
     * writes its file, and the whole point of this banner is that it reports
     * the server rather than the bundle. The first version of this test
     * asserted `test` on the strength of the gate's own NODE_ENV and went red
     * showing `development`, which is the banner being right and the test
     * being wrong about which process it was describing.
     *
     * The ATTRIBUTE and the WORD are asserted together: the attribute is what
     * a future component port must preserve, the word is what a seller reads.
     */
    await expect(banner).toHaveAttribute('data-environment', 'development');
    await expect(banner).toContainText('Development');

    // RULE 4, the half a banner is most likely to fail: the meaning is in the
    // text, not the tone. Strip every colour and the sentence still says the
    // thing -- which is also what survives greyscale, a monochrome display and
    // the mode nobody develops in.
    await expect(banner).toContainText(/Nothing here is real/i);

    // role="status", so a screen reader is told without the focus being stolen
    // from whatever the seller was doing.
    await expect(banner).toHaveAttribute('role', 'status');

    await context.close();
  });
});
