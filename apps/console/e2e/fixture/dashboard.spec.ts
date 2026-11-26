import { expect, test } from '@playwright/test';
import { atSellerHome, goInApp, limeCount, PHONE, SELLER, signedInChooser } from './helpers';

const area = (page: import('@playwright/test').Page, title: string) => page.getByRole('region', { name: 'Work areas' }).getByRole('listitem').filter({ hasText: title });

test.describe('SC-FE-03: the daily operating Home', () => {
  test('an operational Seller: identity, market, honest data statement, alerts, obligations, work areas', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await expect(page.getByText('You are signed in as Owner.')).toBeVisible();
    await expect(page.getByText('Market: Ethiopia. Times are shown in Africa/Addis_Ababa.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No business activity is connected yet' })).toBeVisible();
    await expect(page.getByText('Nothing here is a business figure.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Alerts' })).toContainText('Your admission is due to be checked again under the current policy.');
    await expect(page.getByRole('region', { name: 'Things to do' })).toContainText('Accept the updated Seller policy.');
    await expect(page.getByRole('region', { name: 'Things to do' }).locator('time')).toHaveCount(1);
    for (const name of ['Scenes', 'Seller Stories', 'Inbox', 'Insights', 'Settings']) {
      await expect(area(page, name).first()).toContainText('Arrives later');
    }
    // Products is built (SC-FE-04): open, and a link
    await expect(area(page, 'Products').first()).toContainText('Open');
    await expect(area(page, 'Notification centre')).toContainText('Open');
    // Published, so no readiness hub competes with the brief
    await expect(page.getByRole('heading', { name: 'Publication readiness' })).toHaveCount(0);
    expect(await limeCount(page)).toBe(0);
  });

  test('it never fabricates a business figure, a completed activity or a transactional control', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    const text = (await page.getByRole('main').innerText()).replace('No business activity is connected yet', '').replace(/This page shows no sales, orders or deliveries, because none are connected in this release\./, '');
    expect(text).not.toMatch(/revenue|gmv|paid|payment|payout|reservation|countdown|refund|delivery|deliveries|trust level|\bsales\b/i);
    expect(text).not.toMatch(/\b\d+\s*(orders?|sales|reviews?|deliveries)\b/i);
    await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  });

  test('area rows lead to honest destinations the role may open, and nothing else', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    // an area that only arrives later is a row that says so: no link, no chevron promising a destination
    await expect(area(page, 'Scenes').getByRole('link')).toHaveCount(0);
    await expect(area(page, 'Scenes').locator('svg.icon').first()).toBeVisible(); // only the status badge icon
    await expect(area(page, 'Scenes').locator('.ledger-link')).toHaveCount(0);
    await expect(area(page, 'Products').getByRole('link')).toHaveCount(1);
    await area(page, 'Notification centre').getByRole('link').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
  });

  test('each role gets its own Home: areas follow the server, never the owner view', async ({ page }) => {
    const expectations = [
      { phone: PHONE.sales, present: ['Inbox', 'Notification centre'], absent: ['Products', 'Scenes', 'Insights', 'Settings'], limited: true },
      { phone: PHONE.inventory, present: ['Products', 'Inventory'], absent: ['Inbox', 'Scenes', 'Insights', 'Settings'], limited: true },
      { phone: PHONE.analyst, present: ['Insights'], absent: ['Products', 'Inbox', 'Scenes', 'Settings'], limited: true },
      { phone: PHONE.campaign, present: ['Scenes', 'Seller Stories', 'Insights'], absent: ['Inbox', 'Settings'], limited: true },
      { phone: PHONE.admin, present: ['Products', 'Scenes', 'Inbox', 'Settings'], absent: [], limited: false },
    ] as const;
    for (const e of expectations) {
      await atSellerHome(page, e.phone, SELLER.alem.name);
      for (const name of e.present) await expect(area(page, name).first()).toBeVisible();
      for (const name of e.absent) await expect(area(page, name)).toHaveCount(0);
      // obligations are carried by Owner and Admin only
      if (e.limited) await expect(page.getByRole('region', { name: 'Things to do' })).toContainText('Nothing is due.');
      else await expect(page.getByRole('region', { name: 'Things to do' })).toContainText('Accept the updated Seller policy.');
      if (e.limited) await expect(page.getByText('You see the tools your role allows.')).toBeVisible();
      else await expect(page.getByText('You see the tools your role allows.')).toHaveCount(0);
    }
  });

  test('a restricted Seller keeps Home but marks it restricted, with its alert', async ({ page }) => {
    await signedInChooser(page, PHONE.states);
    await page.getByRole('link', { name: SELLER.gelila.name }).click();
    await expect(page.getByRole('banner')).toContainText('Restricted');
    await expect(page.getByRole('region', { name: 'Alerts' })).toContainText('This Seller is restricted.');
    await expect(page.getByText('Buyers cannot see this store while it is unpublished.')).toBeVisible();
  });

  test('an unpublished Seller and a draft Seller are each described as such', async ({ page }) => {
    await signedInChooser(page, PHONE.states);
    await page.getByRole('link', { name: SELLER.iman.name }).click();
    await expect(page.getByText('Buyers cannot see this store while it is unpublished.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Alerts' })).toContainText('The storefront is not published.');
    await goInApp(page, `/s/${SELLER.dawit.id}`);
    await expect(page.getByText('This Seller is a draft. Buyers cannot see it yet.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Publication readiness' })).toBeVisible();
  });

  test('the Notification centre is read-only, shows the unread count, and has no transactional templates', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    const bell = page.getByRole('banner').getByRole('link', { name: 'Notifications, 2 unread' });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
    const items = page.getByRole('list', { name: 'Notifications' }).getByRole('listitem');
    await expect(items).toHaveCount(3);
    await expect(items.filter({ hasText: 'Unread' })).toHaveCount(2);
    await expect(items.locator('.badge', { hasText: /^Read$/ })).toHaveCount(1);
    await expect(items.locator('.badge', { hasText: /^Unread$/ })).toHaveCount(2);
    await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
    const text = await page.getByRole('main').innerText();
    expect(text).not.toMatch(/order|payment|paid|delivery|refund|claim/i);
  });

  test('a role without the notification capability is denied the centre', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await page.evaluate((id) => window.__ADULIS_FIXTURE__?.revokeCapability(id, 'notifications.view'), SELLER.alem.id);
    await goInApp(page, `/s/${SELLER.alem.id}/notifications`);
    await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
    // the bell is the same capability: it is gone, not left pointing at a denied page
    await expect(page.getByRole('banner').getByRole('link', { name: /Notifications/ })).toHaveCount(0);
  });
});
