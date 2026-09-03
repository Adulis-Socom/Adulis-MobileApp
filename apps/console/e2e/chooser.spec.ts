/**
 * The store chooser, and the gap it is required to state out loud.
 *
 * D-97: **no endpoint lists the caller's own sellers.** Nothing returns "the
 * stores this account holds", so the chooser cannot enumerate. T9 S4.2 rules
 * what to do about that -- "the chooser takes a pasted id with the hole
 * labelled on screen. Do not invent the endpoint; its shape (owned only? team
 * memberships? role per store?) is contract design."
 *
 * So the label is not decoration; it is the ruled behaviour, and this test
 * exists to stop a later agent quietly deleting an awkward sentence. A screen
 * that hides a known gap reads as finished.
 */
import { test, expect } from '@playwright/test';
import { SEEDED } from './helpers/session';

test.describe('the store chooser -- D-97', () => {
  test('states the gap on screen, and does not pretend to enumerate', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The gap, still named where the seller reads it. T17 changed WHO the
    // register number is for, not whether the hole is labelled: the sentence
    // is now plain, and D-97 rides the DOM. BOTH are asserted, so the hole
    // still cannot be quietly closed over -- deleting either fails here.
    const gap = page.locator('.hint');
    await expect(gap).toHaveAttribute('data-gap', 'D-97');
    await expect(gap).toContainText(/stores cannot be listed here yet/i);
    // ...and the seller is never made to read the defect number.
    await expect(gap).not.toContainText('D-97');

    // No list. If one ever appears here it was invented, because the contract
    // still has nowhere to get it from.
    await expect(page.getByRole('list')).toHaveCount(0);

    // Every input has a <label for> -- T7 S7.3, and the one rule that is
    // cheapest to break and cheapest to check.
    const input = page.locator('#chooser-id');
    await expect(input).toBeVisible();
    await expect(page.locator('label[for="chooser-id"]')).toHaveCount(1);
  });

  test('a seller with no store can reach store creation without typing a URL', async ({ page }) => {
    /*
     * T17's walk: a brand-new account signs up, lands here, and finds a box
     * demanding a store id it has never been given -- with nothing on screen
     * offering to create one. /s/new had to be typed into the address bar.
     * That is the point at which a real seller stops and messages us, so it
     * is the point this test defends.
     */
    await page.goto('/');
    await page.getByRole('link', { name: /create a store/i }).click();
    await expect(page).toHaveURL(/\/s\/new$/);
    await expect(page.getByRole('button', { name: /create my store/i })).toBeVisible();
  });

  test('a pasted id opens that store; a malformed one is refused before the network', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('#chooser-id');

    // Refused client-side, and SAID so -- aria-invalid rather than a silently
    // dead button, because a control that does nothing teaches nothing.
    await input.fill('not-a-uuid');
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    await input.fill(SEEDED.sellerId);
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('button', { name: /open store/i }).click();

    await expect(page).toHaveURL(new RegExp(`/s/${SEEDED.sellerId}$`));
    await expect(page.locator('[data-item]').first()).toBeVisible();
  });
});
