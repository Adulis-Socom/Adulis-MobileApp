import { expect, test, type Page } from '@playwright/test';
import { atSellerHome, goInApp, PHONE, SELLER } from './helpers';

/**
 * SC-FE-04-06-CLOSE (Batch 02C). Fixture verification of Console behaviour, NOT backend enforcement. A frontend that stops listening to a
 * late answer does not reverse what the server already did; these tests prove only what the Console shows and does afterwards.
 */
const PNG = (name: string) => ({ name, mimeType: 'image/png', buffer: Buffer.from('demonstration image bytes') });
const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' });

test.describe('B: a late answer to a write changes nothing it should not', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('after navigating away, a delayed create does not open its editor over the new screen', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await goInApp(page, `/s/${SELLER.biruk.id}/products`);
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('products.create', 1200));
    await page.getByRole('button', { name: 'Add a Product' }).click();
    await mainNav(page).getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Publication readiness' }).first()).toBeVisible();
    await page.waitForTimeout(1800);
    await expect(page.getByRole('heading', { level: 1, name: 'New Product' })).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(`/s/${SELLER.biruk.id}`);
  });

  test('after switching Seller, a delayed create does not navigate into the previous Seller', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await goInApp(page, `/s/${SELLER.biruk.id}/products`);
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('products.create', 1200));
    await page.getByRole('button', { name: 'Add a Product' }).click();
    await goInApp(page, `/s/${SELLER.alem.id}`);
    await page.waitForTimeout(1800);
    expect(new URL(page.url()).pathname).toBe(`/s/${SELLER.alem.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'New Product' })).toHaveCount(0);
  });

  test('a delayed answer arriving after the session ended does not restore the screen', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await goInApp(page, `/s/${SELLER.biruk.id}/products`);
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('products.create', 1200));
    await page.getByRole('button', { name: 'Add a Product' }).click();
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.failNext('seller.access.get', 'AUTHENTICATION_REQUIRED'));
    await goInApp(page, `/s/${SELLER.biruk.id}/inbox`);
    await expect(page.getByRole('heading', { name: 'Your session ended' })).toBeVisible();
    await page.waitForTimeout(1800);
    await expect(page.getByRole('heading', { name: 'Your session ended' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'New Product' })).toHaveCount(0);
  });
});

test.describe('D: unsaved edits are guarded', () => {
  test('leaving a Product with edits asks first; staying keeps them, leaving discards them', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/products/fx_prod_alem_1`);
    const name = page.getByLabel('Product name', { exact: true });
    await expect(name).toBeVisible();
    await name.fill('Edited but not saved');
    await expect(page.getByText('You have unsaved changes.')).toBeVisible();
    await mainNav(page).getByRole('link', { name: 'Home' }).click();
    const dialog = page.getByRole('dialog', { name: 'Leave without saving?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Stay and keep editing' }).click();
    await expect(name).toHaveValue('Edited but not saved');
    await mainNav(page).getByRole('link', { name: 'Home' }).click();
    await page.getByRole('dialog', { name: 'Leave without saving?' }).getByRole('button', { name: 'Leave and discard changes' }).click();
    await expect(page.getByRole('heading', { level: 2, name: /Alerts|Publication readiness/ }).first()).toBeVisible();
  });

  test('an unchanged form never asks', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/products/fx_prod_alem_1`);
    await expect(page.getByLabel('Product name', { exact: true })).toBeVisible();
    await mainNav(page).getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Product media: real previews, arrangement, removal', () => {
  test('a chosen image is shown as itself, can be moved earlier and later, and removed', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await goInApp(page, `/s/${SELLER.biruk.id}/products`);
    await page.getByRole('button', { name: 'Add a Product' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'New Product' })).toBeVisible();
    await page.getByLabel('Add an image').setInputFiles(PNG('first.png'));
    await page.getByLabel('Add an image').setInputFiles(PNG('second.png'));
    const list = page.getByRole('list', { name: 'Product images', exact: true });
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(list.getByRole('img', { name: 'Product image: first.png' })).toBeVisible();
    await expect(list.getByRole('listitem').nth(0)).toContainText('Main image');
    await list.getByRole('button', { name: 'Move second.png earlier' }).click();
    await expect(list.getByRole('listitem').nth(0)).toContainText('second.png');
    await expect(list.getByRole('listitem').nth(0)).toContainText('Main image');
    await list.getByRole('button', { name: 'Remove first.png' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(1);
  });
});

test.describe('TikTok: optional, Product-detail-only, never a connection made here', () => {
  test('a link is refused with the canonical reason, and an eligible one is attached then removed', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/products/fx_prod_alem_1`);
    const region = page.getByRole('region', { name: 'TikTok video' });
    await expect(region).toContainText('never in the For You feed');
    await region.getByLabel('TikTok video link').fill('not a link');
    await region.getByRole('button', { name: 'Link video' }).click();
    await expect(region.getByRole('alert').getByRole('link', { name: 'Enter the link to a TikTok video.' })).toHaveAttribute('href', '#tiktok');
    await region.getByLabel('TikTok video link').fill('https://www.tiktok.com/@someone.else/video/123');
    await region.getByRole('button', { name: 'Link video' }).click();
    await expect(region.getByRole('alert')).toContainText('We could not confirm that this video belongs to your TikTok account.');
    await region.getByLabel('TikTok video link').fill('https://www.tiktok.com/@alem.textiles/video/unavailable');
    await region.getByRole('button', { name: 'Link video' }).click();
    await expect(region.getByRole('alert')).toContainText('This video cannot be shown right now.');
    await region.getByLabel('TikTok video link').fill('https://www.tiktok.com/@alem.textiles/video/456');
    await region.getByRole('button', { name: 'Link video' }).click();
    await expect(region.getByText('https://www.tiktok.com/@alem.textiles/video/456')).toBeVisible();
    await region.getByRole('button', { name: 'Remove video' }).click();
    await expect(region.getByText('No TikTok video is linked to this Product.')).toBeVisible();
  });
});

test.describe('Store: company details, a phone-width section picker, the map preview', () => {
  test('a Company Seller has Company details, which say they are not verification', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.states, SELLER.eden.name);
    await goInApp(page, `/s/${SELLER.eden.id}/store`);
    const nav = page.getByRole('navigation', { name: 'Store settings', exact: true });
    await expect(nav.getByRole('link', { name: 'Company details' })).toBeVisible();
    await nav.getByRole('link', { name: 'Company details' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Company details' })).toBeVisible();
    await expect(page.getByText('does not mean Adulis has verified the company')).toBeVisible();
    await expect(page.getByText('Adulis does not ask for a Government ID here.')).toBeVisible();
  });

  test('at phone width the sections are one labelled picker, and choosing one goes there', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/store`);
    const picker = page.getByLabel('Store section');
    await expect(picker).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Store settings', exact: true })).toBeHidden();
    await picker.selectOption({ label: 'Opening hours' });
    await expect(page).toHaveURL(/\/store\/hours$/);
  });

  test('the demonstration map preview follows the place being previewed, and says it is not a real map', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await goInApp(page, `/s/${SELLER.biruk.id}/store/location`);
    await page.getByLabel('Search for your shop').fill('Piassa');
    await page.getByRole('button', { name: 'Search places' }).click();
    await page.getByRole('button', { name: 'Preview Demonstration place 2, Piassa, Addis Ababa' }).click();
    await expect(page.getByRole('img', { name: 'Demonstration map preview showing the position of Demonstration place 2, Piassa, Addis Ababa' })).toBeVisible();
    await expect(page.getByText('This is a demonstration preview, not a real map.')).toBeVisible();
  });
});
