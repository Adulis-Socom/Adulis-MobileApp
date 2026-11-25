import { expect, test } from '@playwright/test';
import { atSellerHome, goInApp, PHONE, SELLER, signedInChooser } from './helpers';

const sidebar = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Main navigation' });

test.describe('SC-FE-01: shell, navigation and denial vocabulary', () => {
  test('desktop shows the sidebar (no Orders), the full top bar and no bottom bar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    const nav = sidebar(page);
    for (const name of ['Home', 'Products', 'Content', 'Inbox', 'Insights', 'Store', 'Trust', 'Settings']) {
      await expect(nav.getByRole('link', { name })).toBeVisible();
    }
    await expect(nav.getByRole('link', { name: 'Orders' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Orders' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    const bar = page.getByRole('banner');
    await expect(bar).toContainText(SELLER.alem.name);
    await expect(bar.getByRole('button', { name: 'Switch Seller' })).toBeVisible();
    await expect(bar.getByRole('link', { name: /Notifications/ })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Help' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Account' })).toBeVisible();
    await expect(page.locator('.bottombar')).toBeHidden();
  });

  test('narrow screens show Home, Products, Inbox and More, and More lists the rest', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    const bar = page.locator('.bottombar');
    await expect(bar).toBeVisible();
    await expect(page.locator('.sidebar')).toBeHidden();
    await expect(bar.getByRole('link')).toHaveText(['Home', 'Products', 'Inbox', 'More']);
    await bar.getByRole('link', { name: 'More' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'More' })).toBeVisible();
    for (const name of ['Content', 'Insights', 'Store', 'Trust', 'Settings', 'Notifications']) {
      await expect(page.getByRole('main').getByRole('link', { name })).toBeVisible();
    }
    await expect(bar.getByRole('link', { name: 'More' })).toHaveAttribute('aria-current', 'page');
  });

  test('1024px is the breakpoint: sidebar at 1024, bottom bar at 1023', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.bottombar')).toBeHidden();
    await page.setViewportSize({ width: 1023, height: 800 });
    await expect(page.locator('.sidebar')).toBeHidden();
    await expect(page.locator('.bottombar')).toBeVisible();
  });

  test('the switcher exists only for an account with more than one Seller', async ({ page }) => {
    await atSellerHome(page, PHONE.admin, SELLER.alem.name);
    await expect(page.getByRole('banner').getByRole('button', { name: 'Switch Seller' })).toHaveCount(0);
  });

  test('switching Seller changes the URL, the top bar and the page', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await page.getByRole('button', { name: 'Switch Seller' }).click();
    const dialog = page.getByRole('dialog', { name: 'Switch Seller' });
    await expect(dialog.getByRole('link', { name: new RegExp(SELLER.alem.name) })).toHaveAttribute('aria-current', 'true');
    await dialog.getByRole('link', { name: SELLER.biruk.name }).click();
    await expect(page).toHaveURL(new RegExp(`/s/${SELLER.biruk.id}$`));
    await expect(page.getByRole('heading', { level: 1, name: SELLER.biruk.name })).toBeVisible();
    await expect(page.getByRole('banner')).toContainText(SELLER.biruk.name);
    await expect(page.getByRole('banner')).not.toContainText(SELLER.alem.name);
  });

  test('Help is a real dialog: keyboard opens it, focus moves in, Escape closes it and focus returns', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    const help = page.getByRole('banner').getByRole('button', { name: 'Help' });
    await help.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Help' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`You are viewing ${SELLER.alem.name}.`);
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(help).toBeFocused();
  });

  test('areas that are not built say so, behind their own gate, and contain no control', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    for (const [path, area] of [['products', 'Products and Inventory'], ['content', 'Scenes and Seller Stories'], ['content/stories', 'Scenes and Seller Stories'], ['inbox', 'Inbox'], ['store', 'Store settings'], ['trust', 'Trust and Reviews'], ['settings/team', 'Settings'], ['insights', 'Insights']] as const) {
      await goInApp(page, `/s/${SELLER.alem.id}/${path}`);
      await expect(page.getByRole('heading', { level: 1, name: area })).toBeVisible();
      await expect(page.getByText(`${area} arrives in a later release`)).toBeVisible();
      await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
    }
  });

  test('an unknown address inside a Seller and outside one both say not found', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/no-such-page`);
    await expect(page.getByRole('heading', { level: 1, name: 'We could not find that page' })).toBeVisible();
    await expect(page.getByRole('banner')).toContainText(SELLER.alem.name);
    await goInApp(page, '/nowhere');
    await expect(page.getByRole('heading', { level: 1, name: 'We could not find that page' })).toBeVisible();
  });
});

test.describe('SC-FE-01: roles, permission and entitlement', () => {
  const cases = [
    { who: 'sales', phone: PHONE.sales, role: 'Sales Support', visible: ['Home', 'Inbox'], hidden: ['Products', 'Content', 'Insights', 'Store', 'Trust', 'Settings'] },
    { who: 'inventory', phone: PHONE.inventory, role: 'Inventory', visible: ['Home', 'Products'], hidden: ['Inbox', 'Content', 'Insights', 'Store', 'Settings'] },
    { who: 'analyst', phone: PHONE.analyst, role: 'Analyst', visible: ['Home', 'Insights'], hidden: ['Products', 'Inbox', 'Content', 'Store', 'Settings'] },
    { who: 'campaign', phone: PHONE.campaign, role: 'Campaign Manager', visible: ['Home', 'Content', 'Products', 'Insights'], hidden: ['Inbox', 'Store', 'Settings'] },
    { who: 'admin', phone: PHONE.admin, role: 'Admin', visible: ['Home', 'Products', 'Content', 'Inbox', 'Insights', 'Store', 'Trust', 'Settings'], hidden: [] },
  ] as const;
  for (const c of cases) {
    test(`${c.who}: the sidebar shows exactly what the server granted`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await atSellerHome(page, c.phone, SELLER.alem.name);
      await expect(page.getByText(`You are signed in as ${c.role}.`)).toBeVisible();
      for (const name of c.visible) await expect(sidebar(page).getByRole('link', { name })).toBeVisible();
      for (const name of c.hidden) await expect(sidebar(page).getByText(name, { exact: true })).toHaveCount(0);
    });
  }

  test('combined roles show the union of their destinations', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.multirole, SELLER.alem.name);
    await expect(page.getByText('You are signed in as Inventory, Sales Support.')).toBeVisible();
    for (const name of ['Home', 'Products', 'Inbox']) await expect(sidebar(page).getByRole('link', { name })).toBeVisible();
    await expect(sidebar(page).getByText('Insights', { exact: true })).toHaveCount(0);
  });

  test('direct navigation to a destination the role cannot use is denied, not redirected and not fetched', async ({ page }) => {
    await atSellerHome(page, PHONE.sales, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/products`);
    await expect(page.getByRole('heading', { level: 1, name: 'You do not have access to this' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp('/products$'));
    await expect(page.getByText('arrives in a later release')).toHaveCount(0);
  });

  test('a Seller that is not the account\'s is denied the same way as one that does not exist', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.dawit.id}`);
    await expect(page.getByRole('heading', { name: 'You do not have access to this' })).toBeVisible();
    await expect(page.getByText(SELLER.dawit.name)).toHaveCount(0);
    await goInApp(page, '/s/fx_seller_nobody');
    await expect(page.getByRole('heading', { name: 'You do not have access to this' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to your Sellers' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
  });

  test('missing entitlement is shown disabled with the reason, and the page explains it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signedInChooser(page, PHONE.owner);
    await page.getByRole('link', { name: SELLER.biruk.name }).click();
    await expect(page.getByRole('heading', { level: 1, name: SELLER.biruk.name })).toBeVisible();
    const insights = sidebar(page).getByRole('button', { name: 'Insights' });
    await expect(insights).toHaveAttribute('aria-disabled', 'true');
    await expect(sidebar(page).getByText('Not included for this Seller yet.')).toBeVisible();
    await goInApp(page, `/s/${SELLER.biruk.id}/insights`);
    await expect(page.getByRole('heading', { level: 1, name: 'Not included for this Seller' })).toBeVisible();
  });

  test('a restricted Seller says so on every page and offers only what the server left', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signedInChooser(page, PHONE.states);
    await page.getByRole('link', { name: SELLER.gelila.name }).click();
    await expect(page.getByRole('heading', { name: 'This Seller is restricted' })).toBeVisible();
    await expect(page.getByText('The Seller is under review.')).toBeVisible();
    await expect(sidebar(page).getByRole('link')).toHaveText(['Home', 'Settings']);
    await goInApp(page, `/s/${SELLER.gelila.id}/settings`);
    await expect(page.getByRole('heading', { name: 'This Seller is restricted' })).toBeVisible();
  });

  test('a capability change shows on the next move: the destination vanishes and its page is denied', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await expect(sidebar(page).getByRole('link', { name: 'Products' })).toBeVisible();
    await page.evaluate((id) => window.__ADULIS_FIXTURE__?.revokeDestination(id, 'products'), SELLER.alem.id);
    await sidebar(page).getByRole('link', { name: 'Inbox' }).click();
    await expect(sidebar(page).getByText('Products', { exact: true })).toHaveCount(0);
    await goInApp(page, `/s/${SELLER.alem.id}/products`);
    await expect(page.getByRole('heading', { level: 1, name: 'You do not have access to this' })).toBeVisible();
  });
});
