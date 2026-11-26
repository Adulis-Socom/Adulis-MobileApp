import { expect, test } from '@playwright/test';
import { atSellerHome, goInApp, PHONE, SELLER, signIn } from './helpers';

/**
 * Outcomes the Console must not guess its way past: an unknown authorization result, a failed session read after
 * sign-in, a membership removed mid-session. The fixture can be told to fail a call (`failNext`) or to remove a membership.
 */
test.describe('fail closed', () => {
  test('if access cannot be confirmed on first load, nothing of the Seller is shown, and Retry recovers', async ({ page }) => {
    await signIn(page, PHONE.owner);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.failNext('seller.access.get', 'NETWORK'));
    await page.getByRole('link', { name: SELLER.alem.name }).click();
    const panel = page.getByRole('alert').filter({ hasText: 'We could not confirm your access' });
    await expect(panel).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
    await expect(page.getByText('You are signed in as')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { level: 1, name: SELLER.alem.name })).toBeVisible();
  });

  test('if access cannot be RE-confirmed on a later move, the old grants are not served', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Products' })).toBeVisible();
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.failNext('seller.access.get', 'INTERNAL'));
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Inbox' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'We could not confirm your access' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Products' })).toBeVisible();
  });

  test('a membership removed mid-session lands on the same denial as a Seller that is not yours', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await page.evaluate((id) => window.__ADULIS_FIXTURE__?.revokeMembership(id), SELLER.alem.id);
    await goInApp(page, `/s/${SELLER.alem.id}/more`);
    await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByText(SELLER.alem.name)).toHaveCount(0);
  });

  test('a failed session read right after sign-in is shown with a retry, never silently', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Mobile phone number').fill(PHONE.owner);
    await page.getByRole('button', { name: 'Send code' }).click();
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.failNext('account.context.get', 'NETWORK'));
    await page.getByLabel('One-time code').fill('246810');
    await page.getByRole('button', { name: 'Verify code' }).click();
    const panel = page.getByRole('alert').filter({ hasText: 'We could not load this' });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
  });

  test('capabilities are per Seller: the same account is an Owner at one and Inventory at another, and nothing carries over', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.mixed, SELLER.lemlem.name);
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(page.getByText('You are signed in as Owner.')).toBeVisible();
    await expect(nav.getByRole('link')).toHaveCount(8);
    await goInApp(page, `/s/${SELLER.alem.id}`);
    await expect(page.getByRole('heading', { level: 1, name: SELLER.alem.name })).toBeVisible();
    await expect(page.getByText('You are signed in as Inventory.')).toBeVisible();
    await expect(nav.getByRole('link')).toHaveText(['Home', 'Products']);
    await expect(page.getByRole('region', { name: 'Things to do' })).toContainText('Nothing is due.');
    await goInApp(page, `/s/${SELLER.lemlem.id}`);
    await expect(page.getByText('You are signed in as Owner.')).toBeVisible();
    await expect(nav.getByRole('link')).toHaveCount(8);
  });

  test('switching from a Seller with full entitlements to one with a disabled entry shows that Seller\'s state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Insights' })).toBeVisible();
    await goInApp(page, `/s/${SELLER.biruk.id}`);
    await expect(page.getByRole('heading', { level: 1, name: SELLER.biruk.name })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Insights' })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Insights' })).toHaveAttribute('aria-disabled', 'true');
  });
});
