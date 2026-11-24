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
  expect(hrefs.filter((h) => /\/payouts$|\/claims|\/courier/.test(h))).toEqual([]);

  // The chooser has no courier door either.
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  expect(await page.locator('a[href="/courier"]').count()).toBe(0);
  await expectNoProhibitedCall(page);
});

for (const [path, what] of [
  ['/s/fx_seller_a/payouts', 'payout'],
  ['/s/fx_seller_a/claims', 'claims'],
  ['/s/fx_seller_a/claims/fx_claim_1', 'claims'],
  ['/courier', 'courier'],
] as const) {
  test(`direct route ${path} meets the deferred state, with nothing to fill in or submit`, async ({ page }) => {
    await page.goto(path);
    const screen = page.locator(`[data-deferred-screen="${what}"]`);
    await expect(screen).toBeVisible();
    await expect(screen).toContainText('Not available in this release');
    // No form, no field, no bank-detail control of any kind.
    expect(await screen.locator('input, textarea, select, form').count()).toBe(0);
    expect(await screen.getByRole('button').count()).toBe(0);
    await expectNoProhibitedCall(page);
  });
}

test('an order with an OPEN payment submission offers no payment or handoff action', async ({ page }) => {
  await page.goto('/s/fx_seller_a/orders');
  await expect(page.locator('[data-order="fx_order_a3"]')).toBeVisible();
  // The legacy "review payment" door on the list is gone.
  expect(await page.locator('[data-primary="review_payment"]').count()).toBe(0);

  await page.goto('/s/fx_seller_a/orders/fx_order_a3');
  await expect(page.locator('.payment-region [data-deferred="payment"]')).toBeVisible();
  await expect(page.locator('.handoff-region [data-deferred="handoff"]')).toBeVisible();

  for (const sel of [
    '[data-decision]',
    '[data-action="view-evidence"]',
    '[data-action="reissue-instructions"]',
    '[data-action="mark-ready"]',
    '[data-action="assign-courier"]',
    '[data-action="custody-transfer"]',
    '[data-action="show-qr"]',
    '#courier-select',
  ]) {
    expect(await page.locator(sel).count(), sel).toBe(0);
  }
  const text = (await page.locator('main').innerText()) ?? '';
  expect(text).not.toMatch(
    /Confirm Payment Received|Payment Not Received|View evidence|Reissue payment instructions|Mark Ready|Show QR|Hand to the courier|Assign a courier/,
  );
  // No payment-confirmation countdown for a decision nobody here can make.
  expect(await page.locator('.deadline, [data-clock]').count()).toBe(0);
  await expectNoProhibitedCall(page);
});

test('subscription keeps status and plan comparison but offers no purchase, instructions or transfer', async ({ page }) => {
  await page.goto('/s/fx_seller_a/subscription');
  await expect(page.locator('.current-plan')).toBeVisible();
  await expect(page.locator('.compare-plans table')).toBeVisible();
  await expect(page.locator('.purchase [data-deferred="purchase"]')).toBeVisible();

  // No tier or term picker, no button, and none of the stale open intent's content.
  expect(await page.locator('.subscription select, .subscription button').count()).toBe(0);
  const text = await page.locator('.subscription').innerText();
  expect(text).not.toContain('FX-REFERENCE-123');
  expect(text).not.toMatch(/999|transferred|bank|instructions/i);

  const calls = await attempted(page);
  expect(calls).toContain('GET /billing/subscription');
  await expectNoProhibitedCall(page);
});

test('home asks for no payout details and shows no obligation of a deferred workflow', async ({ page }) => {
  await page.goto('/s/fx_seller_a');
  await expect(page.locator('[data-deferred="payout"]')).toBeVisible();
  expect(await page.locator('a[href$="/payouts"]').count()).toBe(0);
  expect(await page.locator('[data-obligation]').count()).toBe(0);
  await expectNoProhibitedCall(page);
});
