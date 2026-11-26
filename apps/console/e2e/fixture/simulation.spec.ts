import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { atSellerHome, expectTextScale, limeCount, noHorizontalOverflow, PHONE, scaleText, SELLER } from './helpers';

/**
 * SC-FE-07: the internal Order experience demonstration. Fixture verification only. It is synthetic from end to end, has no payment,
 * handover or delivery state, is reachable only from a fixture build, and is not in any navigation.
 */
const open = async (page: Page) => {
  await page.goto('/internal/order-simulation');
  await expect(page.getByRole('heading', { level: 1, name: 'Order experience demonstration' })).toBeVisible();
};
const role = (page: Page, name: string) => page.getByLabel('View as').selectOption({ label: name });
const FORBIDDEN = /payment|paid|refund|payout|handoff|handover|revenue|tracking|in transit|out for delivery/i;

test.describe('SC-FE-07: what is shown, and what is never shown', () => {
  test('says it is synthetic, sits under the Demonstration banner, and shows only preparation states', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    await expect(page.getByRole('complementary', { name: 'Demonstration notice' })).toBeVisible();
    await expect(page.getByText('Everything on this page is synthetic.')).toBeVisible();
    for (const bucket of [/^Needs action \(2\)$/, /^Preparing \(1\)$/, /^Ready \(1\)$/]) await expect(page.getByRole('button', { name: bucket })).toBeVisible();
    // the only negations of payment, handover and delivery are the sentences that say they are not part of it
    const text = (await page.locator('main').innerText()).replace(/Payment, handover and delivery are not part of this demonstration\.|No Order, stock, money or delivery exists/g, '');
    expect(text).not.toMatch(FORBIDDEN);
  });

  test('has no route from any navigation: the sign-in screen offers it only as a demonstration link, and Seller navigation never does', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('link', { name: 'Internal Order experience demonstration' })).toBeVisible();
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Products' })).toBeVisible(); // signed in, so the empty result below is not vacuous
    await expect(nav.getByRole('link', { name: /Orders?/ })).toHaveCount(0);
  });
});

test.describe('SC-FE-07: preparing an Order in the simulation', () => {
  test('Inventory walks an Order from Needs action to Preparing to Ready, one lime action at a time, and then nothing more', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    await page.getByRole('button', { name: 'Open fx_sim_ord_001' }).click();
    await expect(page.getByRole('region', { name: 'Order detail' })).toContainText('Linen wrap dress');
    expect(await limeCount(page)).toBe(1);
    await page.getByRole('button', { name: 'Start preparing' }).click();
    await expect(page.getByText('Done in the simulation. No stock, payment or delivery was affected.')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Preparing \(2\)$/ })).toBeVisible();
    await page.getByRole('button', { name: 'Mark ready' }).click();
    await expect(page.getByRole('button', { name: /^Ready \(2\)$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start preparing|Mark ready/ })).toHaveCount(0);
    await expect(page.getByText('The demonstration ends here.')).toBeVisible();
    expect(await limeCount(page)).toBe(0);
  });

  test('a stale write is refused with the current state offered, never applied', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    await page.getByRole('button', { name: 'Open fx_sim_ord_001' }).click();
    await page.getByRole('button', { name: 'Simulate a change made elsewhere' }).click();
    await page.getByRole('button', { name: 'Start preparing' }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('This Order was changed somewhere else, so your action was not applied.');
    await expect(page.getByText('Done in the simulation.')).toHaveCount(0);
    await alert.getByRole('button', { name: 'Reload this Order' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('SC-FE-07: roles, and every screen state', () => {
  test('Sales Support can read and cannot prepare; Analyst cannot see Orders at all', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    await role(page, 'Sales Support');
    await page.getByRole('button', { name: 'Open fx_sim_ord_001' }).click();
    await expect(page.getByText('This role can look at Orders but cannot prepare them.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Start preparing|Mark ready|Simulate a change/ })).toHaveCount(0);
    await role(page, 'Analyst');
    await expect(page.getByRole('heading', { name: 'This role cannot see Orders' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Synthetic Orders' })).toHaveCount(0);
  });

  test('loading, empty and failed are three different screens, and a failure is never an empty list', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    const screen = page.getByLabel('Screen state');
    await screen.selectOption({ label: 'Loading' });
    await expect(page.getByLabel('Loading Orders')).toBeVisible();
    await screen.selectOption({ label: 'Empty' });
    await expect(page.getByText('There are no Orders in this part of the list.')).toBeVisible();
    await screen.selectOption({ label: 'Request failed' });
    await expect(page.getByRole('alert')).toContainText('We could not load the Orders');
    await expect(page.getByText('There are no Orders in this part of the list.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('list', { name: 'Synthetic Orders' })).toBeVisible();
  });
});

test.describe('SC-FE-07: layout and accessibility', () => {
  test('passes axe with a detail open, on desktop and on a phone', async ({ page }) => {
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await open(page);
      await page.getByRole('button', { name: 'Open fx_sim_ord_003' }).click();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).disableRules(['target-size']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    }
  });

  test('does not overflow at 390px and 200% text', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await scaleText(page, 200);
    await open(page);
    await expectTextScale(page, 200);
    await page.getByRole('button', { name: 'Open fx_sim_ord_002' }).click();
    await noHorizontalOverflow(page);
  });
});
