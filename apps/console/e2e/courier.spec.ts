/**
 * SC-C1 -- the courier screen. SUPERSEDED by D24-01 (25 November 2026).
 *
 * C-8's done-clause drove the courier end to end against the real API: the Seller invited the
 * seeded buyer's phone as a courier, assigned the PAYMENT_CONFIRMED order, and the courier signed in
 * and worked the screen -- custody gating the handoff QR (R25), with the sentence naming the buyer
 * as the scanner. Live courier delivery depends on a confirmed payment and a handoff, both deferred
 * until payment authority is decided, so the screen is removed from the MVP console. The original
 * journey is replaced here by a negative test, not deleted; it is in git history, and the backend
 * custody and QR controls it exercised still exist and are untouched by this frontend work order.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUYER_STATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.auth', 'buyer-state.json');

test.describe('SC-C1 -- courier delivery is deferred (D24-01) @safety', () => {
  test('a signed-in courier account meets an honest deferred state, with no delivery control and no handoff call', async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ storageState: BUYER_STATE });
    try {
      const calls: string[] = [];
      const page = await ctx.newPage();
      page.on('request', (r) => {
        const u = new URL(r.url());
        if (u.pathname.startsWith('/v1/') && /courier|custody|handoff|qr/i.test(u.pathname)) {
          calls.push(`${r.method()} ${u.pathname}`);
        }
      });
      await page.goto(`${baseURL}/courier`);
      const screen = page.locator('[data-deferred-screen="courier"]');
      await expect(screen).toBeVisible();
      await expect(screen).toContainText('Courier delivery is not part of this release.');
      await expect(page.locator('[data-screen="SC-C1"]')).toHaveCount(0);
      expect(await screen.locator('input, textarea, select, form, button').count()).toBe(0);
      expect(calls, calls.join(' | ')).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
});
