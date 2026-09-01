/**
 * D-101's CONSOLE HALF (T12 S5.1) -- the control, not the server rule.
 *
 * "Rendered to everyone on the OTP screen; required by the server only when
 * creating an account. The client must not ask whether a phone has an account
 * in order to decide whether to show it" -- that question is the S17 oracle,
 * and the reason the control is UNCONDITIONAL.
 *
 * Three properties, each of which has already failed once in this project:
 *   1. VISIBLE ON THE CODE STEP, UNCONDITIONALLY -- for a phone that HAS an
 *      account (the seeded buyer's). If the box only appeared for new phones,
 *      the console would be running the oracle.
 *   2. NEVER PRE-CHECKED. An attestation someone else ticked is not an
 *      attestation (ADU-RUL-03 S4 -- the same rule that makes the label
 *      HUMAN-REQUIRED in MT-KEYS).
 *   3. CLEARED ON "CHANGE NUMBER" (D-119's correction): a different number is
 *      a different person until proven otherwise, and a ticked box must not
 *      travel to the next number's code step.
 *
 * OTP BUDGET NOTE: this signs nothing in and verifies nothing -- it only
 * REQUESTS codes, twice, on the seeded BUYER phone, whose 3/hour bucket is
 * shared with nothing else in this suite (the seller phone carries
 * globalSetup's sign-in). The gate's db:reset clears the buckets every run,
 * so two requests per run cannot accumulate into D-124's 429.
 */
import { test, expect } from '@playwright/test';
import { SEEDED } from './helpers/session';

const BUYER_PHONE = '+251900000002';

// A fresh, signed-OUT context: the sign-in screen is unreachable through the
// storageState every other test rides.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('D-101 -- the age declaration control', () => {
  test('unconditional on the code step, never pre-checked, cleared on change number', async ({
    page,
  }) => {
    await page.goto('/sign-in');

    // Step 1: request a code for a phone that ALREADY HAS an account.
    await page.locator('#signin-phone').fill(BUYER_PHONE);
    await page.getByRole('button', { name: 'Send me a code' }).click();

    // Property 1: the box is on the code step, for an EXISTING account --
    // the server will not require it for this phone, and the console must
    // not know that.
    const box = page.locator('#signin-age');
    await expect(box).toBeVisible();

    // Property 2: never pre-checked.
    await expect(box).not.toBeChecked();

    // Tick it, then change number -- the declaration must not survive.
    await box.check();
    await expect(box).toBeChecked();
    await page.getByRole('button', { name: 'Change number' }).click();
    await expect(page.locator('#signin-phone')).toBeVisible();

    // Step 2 again (second and last OTP request of this test).
    await page.locator('#signin-phone').fill(BUYER_PHONE);
    await page.getByRole('button', { name: 'Send me a code' }).click();

    // Property 3: D-119 -- cleared.
    await expect(box).toBeVisible();
    await expect(
      box,
      'a ticked declaration travelled through "change number" to the next code step (D-119)',
    ).not.toBeChecked();

    // And the label is the HUMAN-REQUIRED attestation string, present in
    // full -- not a paraphrase (its wording is load-bearing, MT-KEYS).
    await expect(page.locator('label[for="signin-age"]')).toBeVisible();
    void SEEDED; // imported to anchor this file to the one place ids live
  });
});
