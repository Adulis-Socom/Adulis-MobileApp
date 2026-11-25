import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The RELEASE build (no fixtures can exist in it): what a person sees while the Seller backend contracts do not exist
 * is an honest unavailable state, never a demonstration, never a fabricated account (GOV-06, Batch 02A section F).
 */
test.describe('release build', () => {
  for (const url of ['/', '/sign-in', '/sellers', '/become-seller', '/s/fx_seller_alem', '/s/seller_real_1/admission']) {
    test(`${url} says the Seller service is not available, with no sign-in form`, async ({ page }) => {
      await page.goto(url);
      await expect(page.getByRole('heading', { name: 'Seller sign-in is not available yet' })).toBeVisible();
      await expect(page.getByText('Nothing was sent and nothing has changed.')).toBeVisible();
      await expect(page.getByLabel('Mobile phone number')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Send code' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Create my Seller' })).toHaveCount(0);
    });
  }

  test('there is no demonstration indicator, no fixture handle and no demonstration account offer', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('complementary', { name: 'Demonstration notice' })).toHaveCount(0);
    await expect(page.getByText('Demonstration data')).toHaveCount(0);
    await expect(page.getByText('Demonstration accounts')).toHaveCount(0);
    expect(await page.evaluate(() => typeof window.__ADULIS_FIXTURE__)).toBe('undefined');
  });

  test('RN-2: it fetches nothing from any API or other origin, and sends no Seller request', async ({ page, baseURL }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: 'Seller sign-in is not available yet' })).toBeVisible();
    const origin = new URL(baseURL ?? '').origin;
    expect(requests.filter((u) => !u.startsWith(origin))).toEqual([]);
    expect(requests.filter((u) => new URL(u).pathname.startsWith('/v1'))).toEqual([]);
  });

  test('the unavailable state is accessible and has no inline script (CSP script-src self)', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { level: 1, name: 'Seller sign-in is not available yet' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    const inline = await page.evaluate(() => [...document.scripts].filter((s) => !s.src).length);
    expect(inline).toBe(0);
  });

  test('an unknown address is a clear not-found, not a blank page', async ({ page }) => {
    await page.goto('/definitely/not/here');
    await expect(page.getByRole('heading', { name: /Seller sign-in is not available yet|We could not find that page/ }).first()).toBeVisible();
  });
});
