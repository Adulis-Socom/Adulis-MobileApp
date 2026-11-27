import { expect, test, type Page } from '@playwright/test';
import { atSellerHome, goInApp, PHONE, SELLER, signedInChooser, signInHere } from './helpers';

/**
 * SC-FE-07-09-CLOSE: retry identity (A), session generation (B), read high-water (E) and safety-suspended access (F), driven through the
 * built fixture Console. Unit tests cover the stores themselves (retry.test.ts, freshness.test.ts) and the fixture server (inbox.test.ts).
 */
const keysOf = (page: Page, op: string) =>
  page.evaluate((o) => (window.__ADULIS_FIXTURE__?.callLog() ?? []).filter((c) => c.op === o).map((c) => c.key), op);

const openThread = async (page: Page, buyer: string) => {
  await goInApp(page, `/s/${SELLER.alem.id}/inbox`);
  await page.getByRole('link', { name: new RegExp(buyer) }).click();
  await expect(page.getByRole('heading', { level: 1, name: buyer })).toBeVisible();
};

const signOut = async (page: Page) => {
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
};

test.describe('A: retry identity', () => {
  test('an unknown outcome keeps the key across navigation; a new session never reuses it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await openThread(page, 'Demonstration buyer D');
    await page.getByLabel('Your message').fill('Come in any day.');
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.failNext('inbox.reply.send', 'NETWORK'));
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByText('We could not confirm whether this was saved. Check the current status before trying again.')).toBeVisible();
    // Leave (answering the unsaved-draft question) and come back: the same request carries the same key.
    await page.getByRole('link', { name: 'Back to the Inbox' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Leave and discard changes' }).click();
    await page.getByRole('link', { name: /Demonstration buyer D/ }).click();
    await page.getByLabel('Your message').fill('Come in any day.');
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.failNext('inbox.reply.send', 'NETWORK'));
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByText('We could not confirm whether this was saved. Check the current status before trying again.')).toBeVisible();
    const before = await keysOf(page, 'inbox.reply.send');
    expect(before).toHaveLength(2);
    expect(before[1]).toBe(before[0]);
    // A new session is a new scope: the same body is a new command with a new key.
    await page.getByRole('link', { name: 'Back to the Inbox' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Leave and discard changes' }).click();
    await signOut(page);
    await signInHere(page, PHONE.owner);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
    await page.getByRole('link', { name: SELLER.alem.name }).first().click();
    await openThread(page, 'Demonstration buyer D');
    await page.getByLabel('Your message').fill('Come in any day.');
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByText('Your reply was sent.')).toBeVisible();
    const after = await keysOf(page, 'inbox.reply.send');
    expect(after).toHaveLength(3);
    expect(after[2]).not.toBe(after[0]);
  });

  test('a key held for one Seller is never used for another', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await openThread(page, 'Demonstration buyer D');
    await page.getByLabel('Your message').fill('Hello there.');
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.failNext('inbox.reply.send', 'NETWORK'));
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByRole('alert')).toContainText('We could not reach the server.');
    await page.getByRole('link', { name: 'Back to the Inbox' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Leave and discard changes' }).click();
    await goInApp(page, `/s/${SELLER.biruk.id}/inbox`);
    await page.getByRole('link', { name: /Demonstration buyer F/ }).click();
    await page.getByLabel('Your message').fill('Hello there.');
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByText('Your reply was sent.')).toBeVisible();
    const log = await page.evaluate(() => (window.__ADULIS_FIXTURE__?.callLog() ?? []).filter((c) => c.op === 'inbox.reply.send'));
    expect(log.map((c) => c.sellerId)).toEqual([SELLER.alem.id, SELLER.biruk.id]);
    expect(log[1]?.key).not.toBe(log[0]?.key);
  });
});

test.describe('B: session generation', () => {
  test("a late authentication failure of an ENDED session does not expire the new one", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await openThread(page, 'Demonstration buyer D');
    await page.getByLabel('Your message').fill('Sent just before signing out.');
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('inbox.reply.send', 4000));
    await page.getByRole('button', { name: 'Send reply' }).click();
    await signOut(page);
    await signInHere(page, PHONE.owner);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
    // The delayed reply now answers AUTHENTICATION_REQUIRED for the old session. The new session must survive it.
    await page.waitForTimeout(4500);
    await expect(page.getByRole('heading', { name: 'Your session ended' })).toHaveCount(0);
    await page.getByRole('link', { name: SELLER.alem.name }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: SELLER.alem.name })).toBeVisible();
  });

  test('the CURRENT session ending is still respected', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await openThread(page, 'Demonstration buyer D');
    await page.getByLabel('Your message').fill('Sent after the server ended the session.');
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.revokeSession());
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByRole('heading', { name: 'Your session ended' })).toBeVisible();
  });
});

test.describe('E: read high-water', () => {
  test('a Buyer message that arrives while the thread is open stays unread', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await openThread(page, 'Demonstration buyer D');
    await expect.poll(() => page.evaluate(() => (window.__ADULIS_FIXTURE__?.callLog() ?? []).filter((c) => c.op === 'inbox.read.mark').length)).toBe(1);
    await page.evaluate((id) => window.__ADULIS_FIXTURE__?.buyerMessage(id, 'fx_conv_alem_4', 'Are you open on Sunday?'), SELLER.alem.id);
    await page.getByRole('link', { name: 'Back to the Inbox' }).click();
    const row = page.getByRole('list', { name: 'Conversations', exact: true }).getByRole('listitem').filter({ hasText: 'Demonstration buyer D' });
    await expect(row).toContainText('Unread messages: 1');
    // Opening it again shows the new message and moves the mark to it.
    await row.getByRole('link').click();
    await expect(page.getByText('Are you open on Sunday?')).toBeVisible();
    await page.getByRole('link', { name: 'Back to the Inbox' }).click();
    await expect(page.getByRole('list', { name: 'Conversations', exact: true }).getByRole('listitem').filter({ hasText: 'Demonstration buyer D' })).toContainText('All read');
  });
});

test.describe('F: a safety-suspended Seller', () => {
  test('keeps read-only Trust and its historical Reviews, and nothing commercial', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signedInChooser(page, PHONE.states);
    await page.getByRole('link', { name: SELLER.gelila.name }).click();
    await expect(page.getByRole('heading', { name: 'This Seller is restricted' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link')).toHaveText(['Home', 'Trust', 'Settings']);
    await nav.getByRole('link', { name: 'Trust' }).click();
    await expect(page.getByRole('heading', { name: 'This Seller is restricted' })).toBeVisible();
    await expect(page.getByText('Fresh and fragrant.')).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: /edit|change|publish/i })).toHaveCount(0);
    for (const path of ['products', 'content', 'inbox']) {
      await goInApp(page, `/s/${SELLER.gelila.id}/${path}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
    }
  });
});
