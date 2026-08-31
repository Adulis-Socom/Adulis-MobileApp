/**
 * UPGRADE_REQUIRED -- the state the client can render and the server cannot
 * yet produce.
 *
 * D-147: `UpgradeGate` sits above the router so S3's "reload prompt, NO OTHER
 * CONTENT" can hold. But `bootstrap.controller.ts` returns
 * `client_status: 'OK'` as a LITERAL, beside `MIN_SUPPORTED_CLIENT = '0.0.0'`,
 * and performs no comparison -- so the only value that can fire this gate
 * never arrives. The client half is correct and inert until the floor is
 * ruled (ADU-VAL-01 v1.2 S4.17).
 *
 * WORK ORDER T10 S4 asks for it PLANTED, and this is the only honest way to
 * test a state whose producer does not exist: intercept the one response the
 * gate keys on, at the network, and assert the whole app obeys it. The plant
 * is in the test, not in the server -- T9 proved the client half by patching
 * the controller and reverting; a route intercept proves the same thing
 * without touching a file, so it can run on every push.
 *
 * WHAT IS BEING ASSERTED IS THE "NO OTHER CONTENT" HALF. That the state
 * renders is the easy part; that nothing else does is the rule, and it is the
 * one a gate placed inside a screen instead of above the router would fail.
 */
import { test, expect } from '@playwright/test';
import { SEEDED } from './helpers/session';

test.describe('UPGRADE_REQUIRED -- planted', () => {
  test('blocks the whole app, not just a screen', async ({ page, context }) => {

    // The server says OK today. Say the other thing, once, at the wire.
    await context.route('**/v1/bootstrap', async (route) => {
      const real = await route.fetch();
      const body = await real.json();
      await route.fulfill({
        response: real,
        json: { ...body, client_status: 'UPGRADE_REQUIRED' },
      });
    });

    await page.goto(`/s/${SEEDED.sellerId}`);

    await expect(page.locator('[data-state="UPGRADE_REQUIRED"]')).toHaveCount(1);
    await expect(page.getByRole('button')).toHaveCount(1); // the reload prompt, and only it

    // NO OTHER CONTENT. Not the readiness list the URL asks for, not the
    // sign-in form the session probe would fall back to, not the shell's nav.
    await expect(page.locator('[data-item]')).toHaveCount(0);
    await expect(page.locator('#signin-phone')).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(0);
  });

  test('and with the server as it really is, the app renders normally', async ({ page }) => {
    // The other half of the proof: the intercept above is what produced the
    // state, so this asserts the gate is not simply always on -- which is the
    // failure mode a single positive test cannot see.
    await page.goto(`/s/${SEEDED.sellerId}`);
    await expect(page.locator('[data-state="UPGRADE_REQUIRED"]')).toHaveCount(0);
    await expect(page.locator('[data-item]').first()).toBeVisible();
  });
});
