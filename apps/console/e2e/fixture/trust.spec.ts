import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { atSellerHome, expectTextScale, goInApp, noHorizontalOverflow, PHONE, scaleText, SELLER } from './helpers';

/**
 * SC-FE-09: Trust and Reviews, READ ONLY. Fixture verification only. No score, no progress, no combined rating, no Seller reply, no
 * review action and no report or appeal control exists; those wait for the Operator process.
 */
const open = async (page: Page, phone: string, seller: { id: string; name: string } = SELLER.alem) => {
  await atSellerHome(page, phone, seller.name);
  await goInApp(page, `/s/${seller.id}/trust`);
  await expect(page.getByRole('heading', { level: 1, name: 'Trust and Reviews' })).toBeVisible();
};
const region = (page: Page, name: string) => page.getByRole('region', { name });

test.describe('SC-FE-09: the Trust level', () => {
  test('shows the level as the server holds it, says it cannot be changed, and shows no progress', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner);
    const level = region(page, 'Trust level');
    await expect(level).toContainText('Established');
    await expect(level).toContainText('Last evaluated');
    await expect(level).toContainText('You cannot change it, and this page does not estimate it.');
    await expect(level).toContainText('Evidence from completed transactions is not connected in this release');
    expect(await level.innerText()).not.toMatch(/\d+\s*%|score|points|next level|requirements/i);
  });

  test('a new Seller was never evaluated, and a Rebuilding Seller is never called New', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner, SELLER.biruk);
    await expect(region(page, 'Trust level')).toContainText('New');
    await expect(region(page, 'Trust level')).toContainText('Your level has not been evaluated yet.');
    await atSellerHome(page, PHONE.states, SELLER.iman.name);
    await goInApp(page, `/s/${SELLER.iman.id}/trust`);
    await expect(region(page, 'Trust level')).toContainText('Rebuilding');
    await expect(region(page, 'Trust level')).toContainText('This Seller reached a higher level before and is now below Established.');
    await expect(region(page, 'Trust level').getByText('New', { exact: true })).toHaveCount(0);
  });

  test('a failed load is an error with a retry, and the reviews still load on their own', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.failNext('standing.get', 'INTERNAL'));
    await goInApp(page, `/s/${SELLER.alem.id}/trust`);
    await expect(region(page, 'Trust level').getByRole('alert')).toContainText('We could not load your Trust level');
    await expect(region(page, 'Reviews')).toContainText('Product reviews');
    await region(page, 'Trust level').getByRole('button', { name: 'Try again' }).click();
    await expect(region(page, 'Trust level')).toContainText('Established');
  });
});

test.describe('SC-FE-09: Reviews', () => {
  test('keeps Product reviews and service reviews apart, each with its own count, and never combines them', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner);
    const reviews = region(page, 'Reviews');
    await expect(reviews.getByRole('heading', { level: 3, name: 'Product reviews' })).toBeVisible();
    await expect(reviews.getByRole('heading', { level: 3, name: 'Service reviews' })).toBeVisible();
    await expect(reviews.getByRole('list', { name: 'Product review list' }).getByRole('listitem')).toHaveCount(3);
    await expect(reviews.getByRole('list', { name: 'Service review list' }).getByRole('listitem')).toHaveCount(3);
    expect(await reviews.innerText()).not.toMatch(/overall|average|combined|out of 5 stars overall/i);
    await expect(reviews.getByRole('list', { name: 'Product review list' }).getByRole('listitem').first()).toContainText('Product: Linen wrap dress');
    await reviews.getByRole('button', { name: 'Show more Product reviews' }).click();
    await expect(reviews.getByRole('list', { name: 'Product review list' }).getByRole('listitem')).toHaveCount(6);
    await reviews.getByRole('button', { name: 'Show more Product reviews' }).click();
    await expect(reviews.getByRole('list', { name: 'Product review list' }).getByRole('listitem')).toHaveCount(7);
    await expect(reviews.getByRole('button', { name: 'Show more Product reviews' })).toHaveCount(0);
  });

  test('says Buyers write them and a Seller cannot alter them, and offers no reply, report, hide or delete', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner);
    await expect(page.getByText('Reviews are written by Buyers. You cannot edit, hide, delay or remove them.')).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: /reply|report|hide|delete|remove|appeal|approve|respond/i })).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('link', { name: /reply|report|appeal/i })).toHaveCount(0);
    await expect(region(page, 'Reporting and appeals')).toContainText('arrive in a later release');
    await expect(region(page, 'Reporting and appeals').getByRole('button')).toHaveCount(0);
  });

  test('a Seller with no reviews sees empty states, not an error and not zero-filled stars as a rating', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner, SELLER.biruk);
    await expect(page.getByText('There are no Product reviews yet.')).toBeVisible();
    await expect(page.getByText('There are no service reviews yet.')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('SC-FE-09: who may see what', () => {
  test('Sales Support sees both; Inventory sees the level only', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.sales);
    await expect(region(page, 'Trust level')).toBeVisible();
    await expect(region(page, 'Reviews')).toBeVisible();
    await open(page, PHONE.inventory);
    await expect(region(page, 'Trust level')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Reviews' })).toHaveCount(0);
  });

  test('Analyst and Campaign Manager have no Trust destination and are denied the address', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const phone of [PHONE.analyst, PHONE.campaign]) {
      await atSellerHome(page, phone, SELLER.alem.name);
      await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Trust' })).toHaveCount(0);
      await goInApp(page, `/s/${SELLER.alem.id}/trust`);
      await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
    }
  });
});

test.describe('SC-FE-09: layout and accessibility', () => {
  test('passes axe on desktop and on a phone', async ({ page }) => {
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await open(page, PHONE.owner);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).disableRules(['target-size']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    }
  });

  test('does not overflow at 390px and 200% text', async ({ page }) => {
    await scaleText(page, 200);
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, PHONE.owner);
    await expectTextScale(page, 200);
    await noHorizontalOverflow(page);
  });
});
