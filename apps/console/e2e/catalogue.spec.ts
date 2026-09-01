/**
 * C-5's done-clause, asserted by a machine, against the real API.
 *
 * The seed publishes one product ("Seed Coffee 1kg", PRODUCT
 * 5eed...06) with variants, so these screens render real rows rather than an
 * EMPTY state -- a test that only ever saw EMPTY would pass vacuously the day
 * the screens broke on real data.
 *
 * What C-5's traps require a browser to have DRAWN (ADU-CON-03 v1.2 S8):
 *   SC-07  the list renders, the honest cap-note is present (the counter the
 *          contract cannot yet supply is named, not faked), the filter note
 *          says filtering is over what loaded.
 *   SC-08  the editor renders the product with its Variants and Media
 *          sections and a publication control.
 *   SC-11  stock offers TWO DISTINCT actions -- Set count AND Confirm stock is
 *          accurate -- never one field that does both.
 */
import { test, expect } from '@playwright/test';
import { SEEDED } from './helpers/session';

const base = `/s/${SEEDED.sellerId}`;

test.describe('SC-07 -- products list', () => {
  test('renders the seeded product, and names the cap it cannot yet report', async ({ page }) => {
    await page.goto(`${base}/products`);
    await expect(page.locator('[data-screen="SC-07"]')).toBeVisible();

    // At least the seeded product, rendered READY (not EMPTY).
    await expect(page.locator('[data-product]').first()).toBeVisible();
    await expect(page.getByText('Seed Coffee 1kg')).toBeVisible();

    // The cap counter is HONEST about the field it lacks (S8, S17): no invented
    // "N of 10", a plain statement that the server owns the limit.
    await expect(page.getByText(/product limit is set by the server/i)).toBeVisible();

    // The filter row filters what LOADED, and says so (D-154 class).
    await expect(page.getByText(/These tabs filter the products already loaded/i)).toBeVisible();
  });
});

test.describe('SC-08 -- product editor with its sections', () => {
  test('opens the seeded product and shows variants, media and publication', async ({ page }) => {
    await page.goto(`${base}/products`);
    await page.getByText('Seed Coffee 1kg').click();

    await expect(page.locator('[data-screen="SC-08"]')).toBeVisible();
    // SC-09 and SC-10 are SECTIONS of SC-08.
    await expect(page.getByRole('heading', { name: 'Variants' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Images and video' })).toBeVisible();
    // The seeded product is PUBLISHED, so the control is Unpublish.
    await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();
  });
});

test.describe('SC-11 -- stock is two distinct actions', () => {
  test('set-count and confirm-accurate are both present and are not the same control', async ({ page }) => {
    await page.goto(`${base}/products`);
    await page.getByText('Seed Coffee 1kg').click();
    await expect(page.locator('[data-screen="SC-08"]')).toBeVisible();

    // Expand the first variant's stock section.
    await page.getByRole('button', { name: 'Manage stock' }).first().click();
    const stock = page.locator('[data-screen="SC-11"]').first();
    await expect(stock).toBeVisible();

    // THE TWO DISTINCT ACTIONS. Set count changes a number; Confirm stock is
    // accurate changes none. Both must exist, as separate controls.
    await expect(stock.getByRole('button', { name: 'Set count' })).toBeVisible();
    await expect(
      stock.getByRole('button', { name: 'Confirm stock is accurate' }),
    ).toBeVisible();
  });
});
