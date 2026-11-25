import { expect, test } from '@playwright/test';
import { atSellerHome, goInApp, PHONE, SELLER, signIn } from './helpers';

/** RN-4: nothing of one Seller is ever visible under another, including while requests are still in flight. */
test.describe('SC-FE-01: Seller isolation', () => {
  test('a late response for the Seller you left never lands on the Seller you are viewing', async ({ page }) => {
    // Alem answers 2.5s late; Biruk answers promptly. Leave Alem while its requests are still in flight.
    await signIn(page, PHONE.owner, `/sign-in?fx_delay=${SELLER.alem.id}:2500`);
    await page.getByRole('link', { name: SELLER.alem.name }).click();
    await expect(page.getByRole('heading', { level: 1, name: SELLER.alem.name })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Loading' }).first()).toBeAttached();
    // Alem's Home request is really in flight when we leave
    await expect.poll(() => page.evaluate(() => window.__ADULIS_FIXTURE__?.callLog().filter((c) => c.sellerId === 'fx_seller_alem' && c.op === 'seller.home.get').length)).toBeGreaterThan(0);
    await goInApp(page, `/s/${SELLER.biruk.id}`);
    await expect(page.getByRole('heading', { level: 1, name: SELLER.biruk.name })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Publication readiness' })).toBeVisible();
    // outlast Alem's slow responses, then look again
    await page.waitForTimeout(3500);
    const main = page.getByRole('main');
    await expect(main).not.toContainText(SELLER.alem.name);
    await expect(main).not.toContainText('Accept the updated Seller policy.');
    await expect(main).not.toContainText('Your admission is due to be checked again');
    await expect(page.getByRole('banner')).toContainText(SELLER.biruk.name);
    await expect(page.getByRole('banner')).not.toContainText(SELLER.alem.name);
    // and Biruk's own screen is still whole: a late answer must not have replaced it with an error or a blank
    await expect(page.getByRole('heading', { level: 1, name: SELLER.biruk.name })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Publication readiness' })).toContainText('2 of 6 requirements are met.');
  });

  test('form state is isolated: text typed under one Seller is gone under another, and does not come back', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await goInApp(page, `/s/${SELLER.biruk.id}/admission`);
    const handle = page.getByLabel('Your account handle');
    await handle.fill('@biruk.private.draft');
    await expect(handle).toHaveValue('@biruk.private.draft');
    await goInApp(page, `/s/${SELLER.kidist.id}/admission`);
    await expect(page.getByRole('banner')).toContainText(SELLER.kidist.name);
    await expect(page.getByLabel('Your account handle')).toHaveValue('');
    await page.getByLabel('Your account handle').fill('@kidist.draft');
    await expect(page.getByRole('main')).not.toContainText('@biruk.private.draft');
    await goInApp(page, `/s/${SELLER.biruk.id}/admission`);
    await expect(page.getByLabel('Your account handle')).toHaveValue('');
    await expect(page.getByRole('main')).not.toContainText('@kidist.draft');
  });

  test('dialog state is isolated: an open dialog does not follow the page to another Seller (Back and Forward)', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await goInApp(page, `/s/${SELLER.chaltu.id}`);
    await expect(page.getByRole('heading', { level: 1, name: SELLER.chaltu.name })).toBeVisible();
    await page.getByRole('button', { name: 'Help' }).click();
    await expect(page.getByRole('dialog', { name: 'Help' })).toContainText(`You are viewing ${SELLER.chaltu.name}.`);
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: SELLER.biruk.name })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(SELLER.chaltu.name)).toHaveCount(0);
    await page.goForward();
    await expect(page.getByRole('heading', { level: 1, name: SELLER.chaltu.name })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Help' })).toBeHidden();
    await expect(page.getByText(SELLER.biruk.name)).toHaveCount(0);
  });

  test('Back and Forward move between Sellers without ever mixing their pages', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.biruk.id}`);
    await expect(page.getByRole('heading', { level: 1, name: SELLER.biruk.name })).toBeVisible();
    await goInApp(page, `/s/${SELLER.chaltu.id}`);
    await expect(page.getByRole('heading', { level: 1, name: SELLER.chaltu.name })).toBeVisible();
    for (const [back, name, others] of [[true, SELLER.biruk.name, [SELLER.alem.name, SELLER.chaltu.name]], [true, SELLER.alem.name, [SELLER.biruk.name, SELLER.chaltu.name]]] as const) {
      if (back) await page.goBack();
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
      for (const other of others) await expect(page.getByRole('main')).not.toContainText(other);
    }
    await page.goForward();
    await expect(page.getByRole('heading', { level: 1, name: SELLER.biruk.name })).toBeVisible();
    await expect(page.getByRole('main')).not.toContainText(SELLER.alem.name);
  });

  test('two Sellers hold disjoint data: each Home and notification list belongs to its own Seller only', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await expect(page.getByText('Your admission is due to be checked again under the current policy.')).toBeVisible();
    await goInApp(page, `/s/${SELLER.alem.id}/notifications`);
    await expect(page.getByRole('list', { name: 'Notifications' }).getByRole('listitem')).toHaveCount(3);
    await goInApp(page, `/s/${SELLER.biruk.id}/notifications`);
    await expect(page.getByRole('list', { name: 'Notifications' }).getByRole('listitem')).toHaveCount(2);
    await goInApp(page, `/s/${SELLER.biruk.id}`);
    await expect(page.getByText('Your admission is due to be checked again under the current policy.')).toHaveCount(0);
    await expect(page.getByText('No alerts right now.')).toBeVisible();
  });

  test('sign-out clears Seller state: signing in as someone else shows none of the previous account', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
    await page.getByLabel('Mobile phone number').fill(PHONE.states);
    await page.getByRole('button', { name: 'Send code' }).click();
    await page.getByLabel('One-time code').fill('246810');
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
    await expect(page.getByRole('main')).not.toContainText(SELLER.alem.name);
    await expect(page.getByRole('main')).toContainText(SELLER.dawit.name);
  });
});
