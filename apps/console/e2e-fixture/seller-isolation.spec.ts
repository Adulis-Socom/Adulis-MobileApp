/**
 * Fixture project, SC-FE-01-CLOSE: Seller isolation, extending N3/N4. A Seller's data must never be on
 * screen under another Seller's URL: not while the new Seller loads, not when an old response arrives
 * late, not after Back or Forward, not after a direct link.
 *
 * Every assertion that could pass merely because stale data eventually disappears reads the DOM ONCE
 * (a retrying toHaveCount(0) would pass the moment the new data lands and hide the defect), or records
 * every DOM state with a MutationObserver and asserts the stale value was NEVER present.
 *
 * NOT covered here, and registered rather than implied: a seller-scoped FORM or DIALOG holding another
 * Seller's input (no such screen is served by the fixture transport), and sign-out and session change
 * (the fixture has no session lifecycle; the real-API suite exercises sign-out in zz-beta-walk).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __ADULIS_FIXTURE_DELAY_MS?: Record<string, number>;
    __seenA?: string[];
  }
}

const A = 'fx_seller_a';
const B = 'fx_seller_b';

async function switchTo(page: Page, seller: string): Promise<void> {
  await page.locator('[data-switcher-toggle]').click();
  await page.locator(`[data-switcher-seller="${seller}"] a`).click();
  await expect(page).toHaveURL(new RegExp(`/s/${seller}$`));
}

async function openOrders(page: Page, seller: string): Promise<void> {
  await page.locator('nav.sidenav a[href$="/orders"]').click();
  await expect(page).toHaveURL(new RegExp(`/s/${seller}/orders$`));
}

/*
 * TWO INDEPENDENT DEFENCES guard this case: the Shell remounts the screen per Seller (the Back/Forward test
 * below pins that one: it is red without it), and the Orders list ignores an answer from a superseded load.
 * Mutation-checked in SC-FE-01-CLOSE: removing EITHER alone leaves this test green, because the other still
 * holds; it goes red only if both fail. That is its job -- the end-to-end promise, not one mechanism.
 */
test('a response for the PREVIOUS Seller that arrives late never reaches the new Seller screen', async ({ page }) => {
  await page.goto(`/s/${B}/orders`);
  await expect(page.locator('[data-order="fx_order_b1"]')).toBeVisible();

  // Start A's orders with A's answer held back 1.5s ...
  await page.evaluate((a) => {
    window.__ADULIS_FIXTURE_DELAY_MS = { [a]: 1500 };
  }, A);
  await switchTo(page, A);
  await openOrders(page, A);

  // ... and record every state of the document from here on, then leave for B before A answers.
  await page.evaluate(() => {
    window.__seenA = [];
    const note = () => {
      if (location.pathname.includes('fx_seller_b') && document.querySelector('[data-order^="fx_order_a"]')) {
        window.__seenA?.push(location.pathname);
      }
    };
    new MutationObserver(note).observe(document.body, { childList: true, subtree: true, attributes: true });
  });
  await switchTo(page, B);
  await openOrders(page, B);
  await expect(page.locator('[data-order="fx_order_b1"]')).toBeVisible();

  await page.waitForTimeout(2200); // A's held answer lands now, under B's URL
  expect(await page.evaluate(() => window.__seenA), "Seller A's order was on screen under Seller B's URL").toEqual([]);
  expect(await page.locator('[data-order^="fx_order_a"]').count()).toBe(0);
  await expect(page.locator('[data-order="fx_order_b1"]')).toBeVisible();
});

test('the previous Seller is cleared the moment the route changes, before the new Seller has loaded', async ({ page }) => {
  await page.goto(`/s/${B}/orders`);
  await expect(page.locator('[data-order="fx_order_b1"]')).toBeVisible();
  await page.evaluate((a) => {
    window.__ADULIS_FIXTURE_DELAY_MS = { [a]: 1500 };
  }, A);
  await switchTo(page, A);
  await openOrders(page, A);
  // A has not answered yet: ONE read. No B row, and no A row yet either.
  expect(await page.locator('[data-order^="fx_order_b"]').count(), "B's data is on screen while A loads").toBe(0);
  expect(await page.locator('[data-order^="fx_order_a"]').count(), 'A rows before A answered').toBe(0);
  await expect(page.locator('[data-order="fx_order_a1"]')).toBeVisible();
});

test('Back and Forward jump straight between the Orders of two Sellers and each shows exactly one Seller, never a mix', async ({ page }) => {
  await page.goto(`/s/${A}/orders`);
  await expect(page.locator('[data-order="fx_order_a1"]')).toBeVisible();
  await switchTo(page, B);
  await openOrders(page, B);
  await expect(page.locator('[data-order="fx_order_b1"]')).toBeVisible();

  // ONE history jump from B's Orders to A's Orders: the SAME route for another Seller, so React reuses the
  // screen unless the Shell remounts it. A's answer is held back, so any B row still on screen is stale.
  await page.evaluate((a) => {
    window.__ADULIS_FIXTURE_DELAY_MS = { [a]: 1200 };
    history.go(-2);
  }, A);
  await expect(page).toHaveURL(new RegExp(`/s/${A}/orders$`));
  await page.waitForTimeout(300);
  expect(await page.locator('[data-order^="fx_order_b"]').count(), "B's order is on screen under A's URL after Back").toBe(0);
  await expect(page.locator('[data-order="fx_order_a1"]')).toBeVisible();
  expect(await page.locator('[data-order^="fx_order_b"]').count()).toBe(0);

  // And Forward, the other way, with B's answer held back.
  await page.evaluate((b) => {
    window.__ADULIS_FIXTURE_DELAY_MS = { [b]: 1200 };
    history.go(2);
  }, B);
  await expect(page).toHaveURL(new RegExp(`/s/${B}/orders$`));
  await page.waitForTimeout(300);
  expect(await page.locator('[data-order^="fx_order_a"]').count(), "A's order is on screen under B's URL after Forward").toBe(0);
  await expect(page.locator('[data-order="fx_order_b1"]')).toBeVisible();
  expect(await page.locator('[data-order^="fx_order_a"]').count()).toBe(0);
});

test('a direct link to another Seller loads that Seller only', async ({ page }) => {
  await page.goto(`/s/${A}/orders`);
  await expect(page.locator('[data-order="fx_order_a1"]')).toBeVisible();
  await page.goto(`/s/${B}/orders`);
  await expect(page.locator('[data-order="fx_order_b1"]')).toBeVisible();
  expect(await page.locator('[data-order^="fx_order_a"]').count()).toBe(0);
});

test('switching Seller closes the switcher and the top bar names the new store', async ({ page }) => {
  await page.goto(`/s/${A}`);
  await expect(page.locator('[data-switcher] .store-name')).toHaveText('Fixture Alpha Store');
  await switchTo(page, B);
  await expect(page.locator('[data-switcher-menu]')).toHaveCount(0);
  await expect(page.locator('[data-switcher] .store-name')).toHaveText('Fixture Beta Store');
});
