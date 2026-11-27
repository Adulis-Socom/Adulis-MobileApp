import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { atSellerHome, expectTextScale, goInApp, noHorizontalOverflow, PHONE, scaleText, SELLER, signedInChooser } from './helpers';

/** SC-FE-10: nonfinancial Insights and Plan status. Fixture verification only: every figure is a demonstration projection. */
const insights = async (page: Page, phone: string) => {
  await atSellerHome(page, phone, SELLER.alem.name);
  await goInApp(page, `/s/${SELLER.alem.id}/insights`);
  await expect(page.getByRole('heading', { level: 1, name: 'Insights' })).toBeVisible();
};

test.describe('SC-FE-10 Insights', () => {
  test('shows each state for what it is: a value, a real zero, withheld, unknown, unavailable, and not measured', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await insights(page, PHONE.owner);
    await expect(page.getByText('Last 30 days, from')).toBeVisible();
    await expect(page.getByText('Times are in Africa/Addis_Ababa.')).toBeVisible();
    const discovery = page.getByRole('region', { name: 'Discovery' });
    await expect(discovery).toContainText('Scene views');
    await expect(discovery).toContainText('1,240');
    await expect(discovery).toContainText('Too few to show');
    await expect(page.getByRole('region', { name: 'Storefront and inquiries' })).toContainText('Not known for this period.');
    await expect(page.getByRole('region', { name: 'Messaging' })).toContainText('Not available yet.');
    const notMeasured = page.getByRole('region', { name: 'Not measured in this release' });
    await expect(notMeasured).toContainText('Conversion to a sale');
    await expect(notMeasured).toContainText('Not measured in this release.');
    await expect(notMeasured).not.toContainText(/\b0\b/);
    await expect(page.getByText('Definition version 1').first()).toBeVisible();
  });

  test('carries no financial figure, no purchase control and no chart that implies one', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await insights(page, PHONE.owner);
    const text = await page.getByRole('main').innerText();
    expect(text).not.toMatch(/revenue|gmv|payout|paid|payment|refund|settlement|birr|ETB|deliver/i);
    await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  });

  test('the Campaign Manager has no storefront section; Sales Support has no Insights at all', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await insights(page, PHONE.campaign);
    await expect(page.getByRole('region', { name: 'Discovery' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Storefront and inquiries' })).toHaveCount(0);
    await page.goto('/sign-in');
    await atSellerHome(page, PHONE.sales, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/insights`);
    await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
  });

  test('a stale projection says so', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signedInChooser(page, PHONE.states);
    await page.getByRole('link', { name: SELLER.iman.name }).click();
    await goInApp(page, `/s/${SELLER.iman.id}/insights`);
    await expect(page.getByText('These figures are older than usual.')).toBeVisible();
  });

  test('passes axe and does not overflow at 390px and 200% text', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await insights(page, PHONE.owner);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).disableRules(['target-size']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    await page.goto('/sign-in');
    await scaleText(page, 200);
    await page.setViewportSize({ width: 390, height: 844 });
    await insights(page, PHONE.owner);
    await expectTextScale(page, 200);
    await noHorizontalOverflow(page);
  });
});

test.describe('SC-FE-10 Plan and features (Option B)', () => {
  test('says no plan is defined, lists what is included, and offers nothing to buy', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await goInApp(page, `/s/${SELLER.biruk.id}/settings`);
    await page.getByRole('link', { name: /Plan and features/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Plan and features' })).toBeVisible();
    await expect(page.getByText('No plan is set up for Sellers yet.')).toBeVisible();
    await expect(page.getByText('There is nothing to buy here, and nothing is charged.')).toBeVisible();
    const features = page.getByRole('region', { name: 'What this Seller includes' });
    await expect(features.getByRole('listitem').filter({ hasText: 'Insights' })).toContainText('Not included yet');
    await expect(features.getByRole('listitem').filter({ hasText: 'Products' })).toContainText('Included');
    await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('main')).not.toContainText(/price|trial|upgrade|subscribe|renew|billing|payment|per month/i);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).disableRules(['target-size']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  });

  test('is not reachable for a role without Settings', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.analyst, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/settings/plan`);
    await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
  });
});
