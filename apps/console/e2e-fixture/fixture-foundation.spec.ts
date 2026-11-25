/**
 * Fixture project, SC-FE-01. Seller switching, denied navigation, and proof that
 * fixture mode cannot reach a live endpoint (boundary design tests N1 to N4).
 *
 * Assert where the browser ENDED UP, as in the main harness (D-152).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __fxFetches?: string[];
    __ADULIS_FIXTURE_DELAY_MS?: Record<string, number>;
  }
}

test.beforeEach(async ({ page }) => {
  // Count every fetch() the page makes, whatever the module that makes it.
  await page.addInitScript(() => {
    window.__fxFetches = [];
    const real = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      window.__fxFetches?.push(url);
      return real(input, init);
    };
  });
});

function liveCalls(page: Page): Promise<string[]> {
  return page.evaluate(() => (window.__fxFetches ?? []).filter((u) => u.includes('/v1')));
}

test('N1: fixture mode draws the fixtures, labels them, and sends nothing to any API', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));

  await page.goto('/s/fx_seller_a/products');
  await expect(page.locator('[data-product="fx_product_a1"]')).toBeVisible();
  await expect(page.locator('[data-product="fx_product_a2"]')).toBeVisible();
  await expect(page.locator('[data-fixture="on"]')).toContainText('Demonstration data');

  expect(await liveCalls(page)).toEqual([]);
  const base = new URL(page.url()).origin;
  const foreign = requested.filter((u) => !u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:'));
  expect(foreign).toEqual([]);
  expect(requested.filter((u) => u.includes('/v1'))).toEqual([]);
});

test('N2: financial, evidence, handoff and unserved paths are refused, and nothing reaches fetch', async ({ page }) => {
  await page.goto('/s/fx_seller_a/products');
  await expect(page.locator('[data-product="fx_product_a1"]')).toBeVisible();

  const codes = await page.evaluate(async () => {
    const m = (await (0, eval)("import('/src/api/client.ts')")) as {
      api: (p: string, o?: Record<string, unknown>) => Promise<unknown>;
    };
    const out: Record<string, string> = {};
    const attempt = async (key: string, run: () => Promise<unknown>) => {
      try {
        await run();
        out[key] = 'SERVED';
      } catch (e) {
        out[key] = (e as { problem?: { code?: string } }).problem?.code ?? 'OTHER';
      }
    };
    await attempt('confirm', () => m.api('/seller/orders/fx_order_a1/payment/confirm', { method: 'POST', sellerId: 'fx_seller_a' }));
    await attempt('reject', () => m.api('/seller/orders/fx_order_a1/payment/reject', { method: 'POST', sellerId: 'fx_seller_a' }));
    await attempt('evidence', () => m.api('/seller/orders/fx_order_a1/payment-evidence', { sellerId: 'fx_seller_a' }));
    await attempt('billing', () => m.api('/billing/purchase-intent', { method: 'POST' }));
    await attempt('payout', () => m.api('/seller/payout', { sellerId: 'fx_seller_a' }));
    await attempt('qr', () => m.api('/seller/orders/fx_order_a1/qr', { sellerId: 'fx_seller_a' }));
    await attempt('report', () => m.api('/reports', { method: 'POST' }));
    await attempt('unserved read', () => m.api('/seller/team', { sellerId: 'fx_seller_a' }));
    await attempt('unserved write', () => m.api('/seller/profile', { method: 'PATCH', sellerId: 'fx_seller_a' }));
    return out;
  });

  for (const key of ['confirm', 'reject', 'evidence', 'billing', 'payout', 'qr', 'report', 'unserved read', 'unserved write']) {
    expect(codes[key], key).toBe('FIXTURE_BLOCKED');
  }
  expect(await liveCalls(page)).toEqual([]);
});

test('N3: moving from store B back to store A shows none of B while A is loading', async ({ page }) => {
  await page.goto('/s/fx_seller_a/products');
  await expect(page.locator('[data-product="fx_product_a1"]')).toBeVisible();

  // A client-side route to B, then B's products (history: A/products, B, B/products).
  await page.locator('[data-switcher-toggle]').click();
  await page.locator('[data-switcher-seller="fx_seller_b"] a').click();
  await expect(page).toHaveURL(/\/s\/fx_seller_b$/);
  await page.locator('nav.sidenav a[href$="/products"]').click();
  await expect(page).toHaveURL(/\/s\/fx_seller_b\/products$/);
  await expect(page.locator('[data-product="fx_product_b1"]')).toBeVisible();

  // One history jump straight to A's products: the same route, another store. A's answer
  // is held back, so any B row still on screen is stale B data under A's URL.
  await page.evaluate(() => {
    window.__ADULIS_FIXTURE_DELAY_MS = { fx_seller_a: 1500 };
    history.go(-2);
  });
  await expect(page).toHaveURL(/\/s\/fx_seller_a\/products$/);
  await page.waitForTimeout(400);
  // ONE read, not a retrying assertion: toHaveCount(0) polls, and would pass the moment A's
  // answer lands and replaces B's row by itself, which is exactly the defect hiding.
  expect(await page.locator('[data-product="fx_product_b1"]').count(), "store B's product is on screen under store A's URL").toBe(0);

  await expect(page.locator('[data-product="fx_product_a1"]')).toBeVisible();
  await expect(page.locator('[data-product="fx_product_b1"]')).toHaveCount(0);
});

test('N4: a store the account may not use renders no rows and never reaches a live API', async ({ page }) => {
  await page.goto('/s/fx_seller_zzz/products');
  await expect(page.locator('[data-state="LOADING"]')).toHaveCount(0);
  await expect(page.locator('[data-product]')).toHaveCount(0);
  await expect(page.locator('#main')).not.toContainText('fx_product');
  expect(await liveCalls(page)).toEqual([]);
});
