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

    // The gap, named where the seller reads it -- and naming the register
    // entry, so the next person finds the reasoning rather than re-deriving it.
    const gap = page.locator('.hint');
    await expect(gap).toContainText('D-97');
    await expect(gap).toContainText(/no endpoint listing your stores/i);

    // No list. If one ever appears here it was invented, because the contract
    // still has nowhere to get it from.
    await expect(page.getByRole('list')).toHaveCount(0);

    // Every input has a <label for> -- T7 S7.3, and the one rule that is
    // cheapest to break and cheapest to check.
    const input = page.locator('#chooser-id');
    await expect(input).toBeVisible();
    await expect(page.locator('label[for="chooser-id"]')).toHaveCount(1);
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
