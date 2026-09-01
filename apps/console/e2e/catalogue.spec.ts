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

/**
 * THE MUTATION ARM (D-221). The three tests above only ever LOOK -- the pass's
 * summary was that the e2e walked the happy path of screens whose mutations
 * had never once succeeded against the real API. This arm drives the full
 * write cycle on a product it creates itself, so it can never race the render
 * tests above and never leans on the seed's shape:
 *
 *   create (refusing a blank price first) -> add a variant (refusing a blank
 *   price first) -> set stock (refusing a blank count first -- the B4 zeroing
 *   hazard) -> confirm stock -> publish for real.
 *
 * The blank-input refusals are asserted here because Number('') === 0: before
 * the pass, clearing the field and clicking Set count ZEROED a live variant.
 *
 * The first test ends on a REAL blocked publish -- the seed satisfies four of
 * nine readiness items, so fn_publish_product raises for real and the screen
 * must render each blocker as its readiness LABEL. The second test PLANTS a
 * 409 at the wire (the upgrade-required.spec.ts pattern) for the shapes the
 * real seed cannot produce -- a LEVEL_LIMIT_REACHED item and a message_key
 * with no slots.item -- asserting the same obligation: MESSAGES, never raw
 * codes, and publish disables while blockers stand.
 */
test.describe('C-5 mutation arm -- the write cycle, for real', () => {
  test('create, variant, stock, confirm, publish -- with each blank refused', async ({ page }) => {
    await page.goto(`${base}/products/new`);

    // A blank price is refused, not coerced to a 0.00 product (B4).
    await page.locator('#np-name').fill('E2E Mutation Arm');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByText('Enter a name and a starting price. A blank price is not zero.')).toBeVisible();

    await page.locator('#np-price').fill('120');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.locator('[data-screen="SC-08"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'E2E Mutation Arm' })).toBeVisible();

    // SC-09: a blank variant price is refused the same way.
    await page.locator('#new-variant-key').fill('Size L');
    await page.getByRole('button', { name: 'Add variant' }).click();
    await expect(page.getByText('Enter a price before saving. A blank price is not zero.')).toBeVisible();

    await page.locator('#new-variant-price').fill('150');
    await page.getByRole('button', { name: 'Add variant' }).click();
    const row = page.locator('.variant-row').filter({ hasText: 'Size L' });
    await expect(row).toBeVisible();

    // SC-11 inline: open stock and refuse the blank count (the zeroing
    // hazard). The field arrives prefilled with the server's count, so the
    // hazard is reproduced the way a seller would hit it: CLEAR, then click.
    await row.getByRole('button', { name: 'Manage stock' }).click();
    const stock = page.locator('[data-screen="SC-11"]');
    await expect(stock).toBeVisible();
    await stock.getByLabel('Stock count').fill('');
    await stock.getByRole('button', { name: 'Set count' }).click();
    await expect(page.getByText('Enter a stock count before setting it. A blank count is not zero.')).toBeVisible();

    // Set a real count: the variant summary reflects it and the history gains
    // the event -- stock is EVENTS, and the row is the proof the write landed.
    await stock.getByLabel('Stock count').fill('7');
    await stock.getByRole('button', { name: 'Set count' }).click();
    await expect(row.getByText('7 in stock')).toBeVisible();
    await expect(stock.locator('.stock-delta').first()).toHaveText('+7');

    // Confirm stock is accurate -- the SECOND, distinct action; it changes no
    // number, it changes the confirmed-at line.
    await stock.getByRole('button', { name: 'Confirm stock is accurate' }).click();
    await expect(stock.getByText(/Confirmed accurate at/)).toBeVisible();

    // Publish, for REAL -- and the real server BLOCKS it: the seed satisfies
    // only four of the nine readiness items (its product was published by SQL,
    // not through fn_publish_product, so readiness was never passed). The 409
    // items[] each carry the generic publication_blocked message_key and the
    // distinguishing readiness code in slots.item -- the screen must render
    // the ITEM's label (SC-01's own vocabulary), never five copies of the
    // same sentence and never a raw code.
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    const publishRegion = page.locator('.publish');
    await expect(
      publishRegion.getByText('This product cannot be published until each of these is resolved:'),
    ).toBeVisible();
    await expect(publishRegion.getByText('Payout details')).toBeVisible();
    await expect(publishRegion.getByText('Identity verified')).toBeVisible();
    await expect(publishRegion.getByText('PUBLICATION_BLOCKED')).toHaveCount(0);
    await expect(publishRegion.getByText('PAYOUT_DETAILS')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  });

  test('publish blockers render as MESSAGES, never raw codes, and publish disables (planted)', async ({ page, context }) => {
    await page.goto(`${base}/products/new`);
    await page.locator('#np-name').fill('E2E Blocked Publish');
    await page.locator('#np-price').fill('80');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.locator('[data-screen="SC-08"]')).toBeVisible();

    // The wire shape is the server's own (catalogue.service.ts publishProduct):
    // a 409 problem envelope whose items[] each carry code + message_key.
    await context.route('**/v1/seller/products/*/publish', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        json: {
          type: 'about:blank',
          title_key: 'error.seller.publication_blocked',
          status: 409,
          code: 'PUBLICATION_BLOCKED',
          request_id: 'e2e-planted',
          retryable: false,
          items: [
            {
              code: 'PUBLICATION_BLOCKED',
              message_key: 'error.seller.publication_blocked',
              slots: { item: 'IDENTITY_VERIFIED' },
            },
            {
              code: 'LEVEL_LIMIT_REACHED',
              message_key: 'error.seller.level_limit_reached',
              slots: { cap: 10, published: 10 },
            },
          ],
        },
      });
    });

    await page.getByRole('button', { name: 'Publish', exact: true }).click();

    // EVERY item renders as what a person reads: an item carrying slots.item
    // renders its readiness LABEL (SC-01's vocabulary); one without renders
    // its message_key's message. The raw code appears NOWHERE.
    await expect(page.getByText('Identity verified')).toBeVisible();
    await expect(page.getByText('Your store level does not include this yet.')).toBeVisible();
    await expect(page.getByText('PUBLICATION_BLOCKED')).toHaveCount(0);
    await expect(page.getByText('LEVEL_LIMIT_REACHED')).toHaveCount(0);

    // And the button disables until a reload could change the answer.
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  });
});
