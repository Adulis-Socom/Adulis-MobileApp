/**
 * Fixture project, SC-FE-01-CLOSE: the master plan's "320-1440px safe" acceptance line, which Batch 01
 * left UNMET by evidence. Representative Seller Console journeys at six widths; no API, no database.
 *
 * Page overflow is the defect class here. A table may scroll horizontally on purpose inside its own
 * `.table-scroll` container (that is accessible: it is a labelled scroll region), but the PAGE must
 * never overflow, and no element outside such a container may poke past the viewport. Screenshots are
 * written to the SSD evidence folder (E2E_SHOT_DIR) so the claim can be looked at, not just trusted.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const WIDTHS = [320, 360, 390, 768, 1024, 1440] as const;
const SHOT_DIR = process.env['E2E_SHOT_DIR'] ?? '';

const SCREENS: ReadonlyArray<readonly [name: string, path: string, ready: string]> = [
  ['chooser', '/', 'main'],
  ['home', '/s/fx_seller_a', '[data-item]'],
  ['orders', '/s/fx_seller_a/orders', '[data-order="fx_order_a1"]'],
  ['order-detail', '/s/fx_seller_a/orders/fx_order_a3', '.payment-region'],
  ['more', '/s/fx_seller_a/more', 'section.more-menu'],
  ['subscription', '/s/fx_seller_a/subscription', '.compare-plans table'],
  ['deferred', '/s/fx_seller_a/payouts', '[data-deferred-screen]'],
  ['become-seller', '/s/new', 'form'],
];

/** Elements whose right edge is past the viewport, excluding anything inside an intentional scroll region. */
async function overflow(page: Page): Promise<{ page: number; offenders: string[] }> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      if (el.closest('.table-scroll, .visually-hidden, .skip-link')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1) offenders.push(`${el.tagName.toLowerCase()}.${el.className || '-'} right=${Math.round(r.right)} vw=${vw}`);
    }
    return { page: document.documentElement.scrollWidth - vw, offenders: offenders.slice(0, 8) };
  });
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const [name, path, ready] of SCREENS) {
      test(`${name}: no page overflow, nothing outside a scroll region past the edge`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator(ready).first()).toBeVisible();
        const o = await overflow(page);
        expect(o.page, `page scrolls horizontally by ${o.page}px; offenders: ${o.offenders.join(' | ')}`).toBeLessThanOrEqual(1);
        expect(o.offenders, o.offenders.join(' | ')).toEqual([]);
        if (SHOT_DIR && ['orders', 'order-detail', 'subscription'].includes(name)) {
          mkdirSync(SHOT_DIR, { recursive: true });
          await page.screenshot({ path: join(SHOT_DIR, `${name}-${width}.png`), fullPage: true });
        }
      });
    }
  });
}

test.describe('text expansion and keyboard (the narrow widths, where it breaks first)', () => {
  for (const width of [320, 360] as const) {
    test(`${width}px at 150% text: still no page overflow on the screens that carry the most text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const [name, path, ready] of SCREENS.filter(([n]) => ['orders', 'order-detail', 'subscription', 'more'].includes(n))) {
        await page.goto(path);
        await expect(page.locator(ready).first()).toBeVisible();
        await page.addStyleTag({ content: 'html { font-size: 150% !important; }' });
        const o = await overflow(page);
        expect(o.page, `${name}: page scrolls horizontally by ${o.page}px at 150% text; offenders: ${o.offenders.join(' | ')}`).toBeLessThanOrEqual(1);
        expect(o.offenders, `${name}: ${o.offenders.join(' | ')}`).toEqual([]);
      }
    });

    test(`${width}px: the first Tab lands on a visible control inside the viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/s/fx_seller_a/orders');
      await expect(page.locator('[data-order="fx_order_a1"]')).toBeVisible();
      await page.keyboard.press('Tab');
      const box = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: document.documentElement.clientWidth, vh: window.innerHeight };
      });
      expect(box, 'Tab focused nothing').not.toBeNull();
      expect(box!.left).toBeGreaterThanOrEqual(-1);
      expect(box!.right).toBeLessThanOrEqual(box!.vw + 1);
      expect(box!.top).toBeGreaterThanOrEqual(-1);
      expect(box!.bottom).toBeLessThanOrEqual(box!.vh + 1);
    });

    test(`${width}px: the store switcher menu opens inside the viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/s/fx_seller_a');
      await page.locator('[data-switcher-toggle]').click();
      const menu = page.locator('[data-switcher-menu]');
      await expect(menu).toBeVisible();
      const r = await menu.evaluate((el) => {
        const b = el.getBoundingClientRect();
        return { left: b.left, right: b.right, vw: document.documentElement.clientWidth };
      });
      expect(r.left).toBeGreaterThanOrEqual(-1);
      expect(r.right).toBeLessThanOrEqual(r.vw + 1);
    });
  }
});
