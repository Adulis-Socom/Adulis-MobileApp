import { expect, test } from '@playwright/test';
import { atSellerHome, goInApp, PHONE, SELLER, signIn } from './helpers';

/** GOV-06 RN-2 and the indicator rule, in the fixture build. The release-negative checks are scripts/verify-release.mjs and e2e/release. */
test.describe('fixture boundary (development build only)', () => {
  test('RN-2: a whole journey makes no request to any API origin, and none to a /v1 path or another origin', async ({ page, baseURL }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await signIn(page, PHONE.owner);
    await page.getByRole('link', { name: SELLER.alem.name }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Alerts' })).toBeVisible();
    await goInApp(page, `/s/${SELLER.biruk.id}/admission`);
    await expect(page.getByRole('heading', { level: 1, name: 'Admission to Adulis' })).toBeVisible();
    await goInApp(page, `/s/${SELLER.alem.id}/notifications`);
    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
    expect(requests.length).toBeGreaterThan(0);
    const origin = new URL(baseURL ?? '').origin;
    const foreign = requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:'));
    expect(foreign, `requests to other origins: ${foreign.join(', ')}`).toEqual([]);
    expect(requests.filter((u) => new URL(u).pathname.startsWith('/v1'))).toEqual([]);
  });

  test('the demonstration indicator is on every screen, survives navigation and scrolling, and is not an announcement', async ({ page }) => {
    const strip = page.getByRole('complementary', { name: 'Demonstration notice' });
    await page.goto('/sign-in');
    await expect(strip).toContainText('Demonstration data. Nothing here is real.');
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await expect(strip).toBeVisible();
    await goInApp(page, `/s/${SELLER.alem.id}/products`);
    await expect(strip).toBeVisible();
    await page.setViewportSize({ width: 390, height: 300 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight), 'the page must be scrollable for this to prove anything').toBe(true);
    await expect(strip).toBeInViewport();
    await goInApp(page, '/nowhere');
    await expect(strip).toBeVisible();
    // it is plain content, not a live region that would re-announce on every change
    await expect(strip).not.toHaveAttribute('role', /alert|status/);
  });

  test('the sticky bars sit below the indicator, never under it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await page.setViewportSize({ width: 1440, height: 400 });
    await page.evaluate(() => window.scrollTo(0, 300));
    const strip = await page.getByRole('complementary', { name: 'Demonstration notice' }).boundingBox();
    const top = await page.getByRole('banner').boundingBox();
    expect(strip && top && top.y >= strip.y + strip.height - 1, 'the sticky top bar must sit below the strip even when scrolled').toBe(true);
  });

  test('the fixture handle is installed only here, and the live transport is not in play', async ({ page }) => {
    await page.goto('/sign-in');
    expect(await page.evaluate(() => typeof window.__ADULIS_FIXTURE__)).toBe('object');
    // demonstration accounts are offered on the sign-in screen of this build only
    await expect(page.getByRole('heading', { name: 'Demonstration accounts' })).toBeVisible();
    await page.getByRole('button', { name: /Admin at Alem Textiles/ }).click();
    await expect(page.getByLabel('Mobile phone number')).toHaveValue(PHONE.admin);
  });
});
