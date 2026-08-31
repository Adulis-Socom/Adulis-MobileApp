/**
 * SC-01's readiness hub -- C-3's done-clause, now asserted by a machine.
 *
 * "Nine readiness items render from `readiness[]`, in any order, resumable."
 * Through T9 that clause was met by driving a browser once, by hand, and
 * reading the DOM. This is the same assertion, made on every run.
 */
import { test, expect } from '@playwright/test';
import { SEEDED } from './helpers/session';

test.describe('SC-01 -- the readiness hub', () => {
  test('renders every item the server returned, and resumes across a reload', async ({ page }) => {
    await page.goto(`/s/${SEEDED.sellerId}`);

    const items = page.locator('[data-item]');
    await expect(items.first()).toBeVisible();

    // NOT "expect nine". The count is the SERVER's -- this screen renders
    // readiness[] and computes nothing (S3.1) -- so the test asserts the
    // screen shows what the API returned, and the API is where nine lives.
    const served = await page.request
      .get(`${process.env['E2E_API_BASE_URL'] ?? 'http://localhost:3000'}/v1/seller/readiness`, {
        headers: { 'X-Adulis-Seller': SEEDED.sellerId, 'X-Adulis-Client': 'web/0.0.0', Accept: 'application/json' },
      })
      .then((r) => r.json() as Promise<{ items: Array<{ code: string; satisfied: boolean }> }>);

    await expect(items).toHaveCount(served.items.length);
    for (const item of served.items) {
      const row = page.locator(`[data-item="${item.code}"]`);
      await expect(row).toHaveCount(1);
      await expect(row).toHaveAttribute('data-satisfied', String(item.satisfied));
    }

    // RESUMABLE. A wizard would remember a step; this has no step to remember,
    // so a reload is indistinguishable from a first visit. That is the
    // property, and it is the one a stored cursor would quietly break.
    const before = await page.locator('.progress').textContent();
    await page.reload();
    await expect(items).toHaveCount(served.items.length);
    await expect(page.locator('.progress')).toHaveText(before ?? '');
  });

  test('every unsatisfied item carries a control that lands on a real screen', async ({ page }) => {
    await page.goto(`/s/${SEEDED.sellerId}`);
    await expect(page.locator('[data-item]').first()).toBeVisible();

    // Collected BEFORE navigating. Reading an attribute off a row after
    // leaving the page it lives on hangs until the test times out -- the
    // element is detached and the locator waits for it forever. The first
    // version of this test did exactly that.
    const targets = await page.locator('[data-satisfied="false"]').evaluateAll((rows) =>
      rows.map((row) => ({
        code: row.getAttribute('data-item'),
        href: row.querySelector('a.readiness-action')?.getAttribute('href') ?? null,
      })),
    );
    expect(targets.length).toBeGreaterThan(0);

    // D-146: four of six links fell through the router's catch-all and
    // navigated the seller straight back to Home -- a control that appears to
    // work, does nothing visible, and teaches that the readiness list is
    // decorative. Following each one is the only way to know; reading the
    // route table is what missed it.
    for (const t of targets) {
      if (!t.href) continue;
      await page.goto(t.href);

      // THE URL IS THE ASSERTION, and the first version of this test got that
      // wrong. It checked that Home's readiness list was absent -- which is
      // true for an instant after `goto`, BEFORE the catch-all's
      // `<Navigate>` has run, so the planted regression passed. A redirect is
      // a thing that happens slightly later; the only stable way to catch it
      // is to ask where the browser ended up.
      await expect(
        page,
        `"Complete this" for ${t.code} did not stay at ${t.href} -- the router sent it elsewhere`,
      ).toHaveURL(new RegExp(`${t.href}$`));

      // And having stayed, it is a screen rather than Home.
      await expect(page.locator('[data-item]')).toHaveCount(0);
    }
  });
});
