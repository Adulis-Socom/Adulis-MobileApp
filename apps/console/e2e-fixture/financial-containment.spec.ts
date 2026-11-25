/**
 * Fixture project, SC-SAFE-01: financial containment of the Seller Console frontend.
 *
 * Founder decisions D24-01 (payment unresolved), B02-D01 (Subscription Option B: no purchase)
 * and B02-D02 (Payout Option A: deferred). These are the CANONICAL NEGATIVE tests that replace the
 * old positive expectations of the real-API suite (a Seller confirming payment, viewing evidence,
 * reading bank-transfer instructions, marking a transfer, saving payout details).
 *
 * Every assertion is about what the browser ended up showing or attempting, never about a CSS
 * class. The fixture transport records every call the console TRIES to make
 * (`__ADULIS_FIXTURE_CALLS`), so "no prohibited request" is checked even though the transport
 * never touches the network; the page's real fetches are checked separately.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __fxFetches?: string[];
    __ADULIS_FIXTURE_CALLS?: string[];
  }
}

/** Anything a payment, payout, purchase, evidence or handoff action would call. */
const PROHIBITED =
  /payment|payout|purchase-intent|mark-transferred|reissue|custody|handoff|\/qr|refund|evidence|courier-assignment|\/ready|settle|confirm/i;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__fxFetches = [];
    window.__ADULIS_FIXTURE_CALLS = [];
    const real = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      window.__fxFetches?.push(input instanceof Request ? input.url : String(input));
      return real(input, init);
    };
  });
});

async function attempted(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__ADULIS_FIXTURE_CALLS ?? []);
}

/** The universal check, run at the end of every journey. */
async function expectNoProhibitedCall(page: Page): Promise<void> {
  const calls = await attempted(page);
  expect(calls.filter((c) => PROHIBITED.test(c)), `attempted: ${calls.join(' | ')}`).toEqual([]);
  expect(calls.filter((c) => /^(POST|PUT|PATCH|DELETE)\b/.test(c) && !/\/auth\/logout/.test(c))).toEqual([]);
  const fetches = await page.evaluate(() => (window.__fxFetches ?? []).filter((u) => u.includes('/v1')));
  expect(fetches).toEqual([]);
}

test('navigation: More offers no Payout, Claims or courier delivery; Subscription stays', async ({ page }) => {
  await page.goto('/s/fx_seller_a/more');
  await expect(page.locator('section.more-menu')).toBeVisible();

  const hrefs = await page.locator('section.more-menu a').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
  expect(hrefs.some((h) => h.endsWith('/subscription'))).toBe(true);
  // `/couriers` (the Store's courier-invite management) is a different, non-delivery screen and stays.
  expect(hrefs.filter((h) => /\/payouts$|\/claims|\/courier$/.test(h))).toEqual([]);

  // The chooser has no courier door either.
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  expect(await page.locator('a[href="/courier"]').count()).toBe(0);
  await expectNoProhibitedCall(page);
});

// Reservation retirement (2026-11-25): these routes are removed, not deferred. Each URL ends at
// a live screen through a catch-all (fixture mode has two stores, so `/` stays on the chooser).
for (const [path, landed] of [
  ['/s/fx_seller_a/orders', /\/s\/fx_seller_a$/],
  ['/s/fx_seller_a/orders/fx_order_a1', /\/s\/fx_seller_a$/],
  ['/s/fx_seller_a/payouts', /\/s\/fx_seller_a$/],
  ['/s/fx_seller_a/claims', /\/s\/fx_seller_a$/],
  ['/s/fx_seller_a/claims/fx_claim_1', /\/s\/fx_seller_a$/],
  ['/courier', /\/$/],
] as const) {
  test(`retired route ${path} is gone: it ends at a live screen and attempts nothing prohibited`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(landed);
    expect(await page.locator('form, input, textarea, select').count()).toBe(0);
    await expectNoProhibitedCall(page);
  });
}

test('subscription keeps status and plan comparison but offers no purchase, instructions or transfer', async ({ page }) => {
  await page.goto('/s/fx_seller_a/subscription');
  await expect(page.locator('.current-plan')).toBeVisible();
  await expect(page.locator('.compare-plans table')).toBeVisible();

  // No purchase region, no tier or term picker, no button.
  expect(await page.locator('.purchase').count()).toBe(0);
  expect(await page.locator('.subscription select, .subscription button').count()).toBe(0);
  const text = await page.locator('.subscription').innerText();
  expect(text).not.toMatch(/transferred|bank|instructions/i);

  const calls = await attempted(page);
  expect(calls).toContain('GET /billing/subscription');
  await expectNoProhibitedCall(page);
});

test('home asks for no payout details and draws no obligation for an empty list', async ({ page }) => {
  await page.goto('/s/fx_seller_a');
  await expect(page.locator('[data-item="AT_LEAST_ONE_PRODUCT"]')).toBeVisible();
  expect(await page.locator('[data-item="PAYOUT_DETAILS"], a[href$="/payouts"]').count()).toBe(0);
  expect(await page.locator('[data-obligation]').count()).toBe(0);
  await expectNoProhibitedCall(page);
});
