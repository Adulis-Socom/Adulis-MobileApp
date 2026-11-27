import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { atSellerHome, expectTextScale, goInApp, limeCount, noHorizontalOverflow, PHONE, scaleText, SELLER } from './helpers';

/**
 * SC-FE-08: the Inbox and its human reply. Fixture verification only. No generated text, no classifier and no live messaging provider
 * exist; automated entries in the data are fixed, provisional strings.
 */
const list = (page: Page) => page.getByRole('list', { name: 'Conversations', exact: true });
const open = async (page: Page, phone: string, seller: { id: string; name: string } = SELLER.alem) => {
  await atSellerHome(page, phone, seller.name);
  await goInApp(page, `/s/${seller.id}/inbox`);
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible();
};
const thread = async (page: Page, buyer: string) => {
  await page.getByRole('link', { name: new RegExp(buyer) }).click();
  await expect(page.getByRole('heading', { level: 1, name: buyer })).toBeVisible();
};

test.describe('SC-FE-08: the list', () => {
  test('is newest first, paginated by cursor, and says who is unread and who is waiting for a team member', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner);
    await expect(list(page).getByRole('listitem')).toHaveCount(4);
    const first = list(page).getByRole('listitem').first();
    await expect(first).toContainText('Demonstration buyer B');
    await expect(first).toContainText('Unread messages: 2');
    await expect(first).toContainText('Waiting for a team member');
    await expect(list(page).getByRole('listitem').nth(2)).toContainText('All read');
    await page.getByRole('button', { name: 'Show more conversations' }).click();
    await expect(list(page).getByRole('listitem')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Show more conversations' })).toHaveCount(0);
  });

  test('a failed load is an error with a retry, never an empty Inbox', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.failNext('inbox.list', 'INTERNAL'));
    await goInApp(page, `/s/${SELLER.alem.id}/inbox`);
    await expect(page.getByRole('alert')).toContainText('We could not load your conversations');
    await expect(page.getByText('There are no conversations yet.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(list(page).getByRole('listitem')).toHaveCount(4);
  });
});

test.describe('SC-FE-08: a conversation', () => {
  test('marks the automated reply as automated and provisional, and keeps the system note apart', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner);
    await thread(page, 'Demonstration buyer B');
    await expect(page.getByText('A team member is needed. Automated replies cannot answer this conversation.')).toBeVisible();
    const messages = page.getByRole('list', { name: 'Messages' });
    await expect(messages.getByRole('listitem').filter({ hasText: 'Automated reply' })).toContainText('provisional demonstration, not approved dialogue');
    await expect(messages.getByRole('listitem').filter({ hasText: 'Automated help could not answer this.' })).toBeVisible();
    await expect(messages.getByRole('listitem').filter({ hasText: 'About the Product: Silk slip dress' }).first()).toBeVisible();
  });

  test('a Scene that is no longer public is an unavailable reference, never its newer content', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner);
    await thread(page, 'Demonstration buyer C');
    await expect(page.getByText('From the Scene The old kaftan, styled two ways, which can no longer be shown').first()).toBeVisible();
  });

  test('Scene first, then Product: a Scene narrows the Products, and "Show all my Products" clears the Scene', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner);
    await thread(page, 'Demonstration buyer D');
    const products = page.getByLabel('Product (optional)');
    const all = await products.locator('option').count();
    await page.getByLabel('Scene (optional)').selectOption({ label: 'Linen wrap dress styled for the rainy season' });
    await expect(page.getByText('Only the Products tagged in this Scene are listed.')).toBeVisible();
    await expect(products.locator('option')).toHaveCount(3); // No Product + the two tagged
    expect(all).toBeGreaterThan(3);
    await page.getByRole('button', { name: 'Show all my Products' }).click();
    await expect(page.getByLabel('Scene (optional)')).toHaveValue('');
    await expect(page.getByText('No Scene is chosen, so all of your Products are listed.')).toBeVisible();
    await expect(products.locator('option')).toHaveCount(all);
  });

  test('a human reply continues the same thread, takes it back from automation, and carries the chosen Product', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner);
    await thread(page, 'Demonstration buyer B');
    expect(await limeCount(page)).toBe(1);
    await page.getByLabel('Product (optional)').selectOption({ label: 'Silk slip dress' });
    await page.getByLabel('Your message').fill('It comes in black.');
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByText('Your reply was sent.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Messages' }).getByRole('listitem').last()).toContainText('It comes in black.');
    await expect(page.getByText('A team member is needed. Automated replies cannot answer this conversation.')).toHaveCount(0); // the banner is gone; the old system note stays as history
    await goInApp(page, `/s/${SELLER.alem.id}/inbox`);
    await expect(list(page).getByRole('listitem').first()).toContainText('All read');
  });

  test('an empty message is refused beside the field with a summary link, and nothing is sent', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner);
    await thread(page, 'Demonstration buyer D');
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'Write a message before sending.' })).toHaveAttribute('href', '#body');
    await expect(page.getByLabel('Your message')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('list', { name: 'Messages' }).getByRole('listitem')).toHaveCount(1);
  });

  test('a lost answer is shown as uncertain, keeps the draft, and the retry makes exactly one message', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner);
    await thread(page, 'Demonstration buyer D');
    await page.getByLabel('Your message').fill('Come in any day.');
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.failNext('inbox.reply.send', 'NETWORK'));
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByRole('alert')).toContainText('We could not reach the server.');
    await expect(page.getByText('We could not confirm whether this was saved.')).toBeVisible(); // the uncertain-outcome note sits beside the problem
    await expect(page.getByLabel('Your message')).toHaveValue('Come in any day.');
    await expect(page.getByText('Your reply was sent.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByText('Your reply was sent.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Messages' }).getByRole('listitem')).toHaveCount(2);
  });

  test('a draft is guarded against leaving, and nothing is written to browser storage', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner);
    await thread(page, 'Demonstration buyer D');
    await page.getByLabel('Your message').fill('Not sent yet.');
    await expect(page.getByText('You have unsaved changes.')).toBeVisible();
    await page.getByRole('link', { name: 'Back to the Inbox' }).click();
    await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
    await page.getByRole('button', { name: 'Stay and keep editing' }).click();
    await expect(page.getByLabel('Your message')).toHaveValue('Not sent yet.');
    const stored = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), cookie: document.cookie }));
    expect(stored).toEqual({ local: [], session: [], cookie: '' });
  });
});

test.describe('SC-FE-08: who may see it, and whose it is', () => {
  test('Sales Support reads and replies; Inventory, Analyst and Campaign Manager have no Inbox and are denied the address', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.sales);
    await thread(page, 'Demonstration buyer D');
    await expect(page.getByRole('button', { name: 'Send reply' })).toBeVisible();
    for (const phone of [PHONE.inventory, PHONE.analyst, PHONE.campaign]) {
      await atSellerHome(page, phone, SELLER.alem.name);
      await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Inbox' })).toHaveCount(0);
      await goInApp(page, `/s/${SELLER.alem.id}/inbox`);
      await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
      await expect(page.getByText('Demonstration buyer')).toHaveCount(0);
    }
  });

  test('another Seller sees only its own conversations, and a conversation of the first is simply not found', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, PHONE.owner, SELLER.biruk);
    await expect(list(page).getByRole('listitem')).toHaveCount(1);
    await expect(list(page)).toContainText('Demonstration buyer F');
    await expect(page.getByText('Demonstration buyer B')).toHaveCount(0);
    await goInApp(page, `/s/${SELLER.biruk.id}/inbox/fx_conv_alem_1`);
    await expect(page.getByRole('heading', { level: 1, name: 'We could not find that page' })).toBeVisible();
  });

});

test.describe('SC-FE-08: layout and accessibility', () => {
  test('passes axe on the list and on a conversation, on desktop and on a phone', async ({ page }) => {
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await open(page, PHONE.owner);
      let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).disableRules(['target-size']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
      await thread(page, 'Demonstration buyer B');
      results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).disableRules(['target-size']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    }
  });

  test('the list and a conversation do not overflow at 390px and 200% text', async ({ page }) => {
    await scaleText(page, 200);
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, PHONE.owner);
    await expectTextScale(page, 200);
    await noHorizontalOverflow(page);
    await thread(page, 'Demonstration buyer B');
    await noHorizontalOverflow(page);
  });
});
