import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { atSellerHome, CODE, expectTextScale, goInApp, noHorizontalOverflow, PHONE, scaleText, SELLER, signedInChooser, signInHere } from './helpers';

/**
 * SC-FE-11: team, step-up, ownership transfer, closure, and the Account's own security, notifications, privacy and invitations. Fixture
 * verification only: nothing is deleted, closed or transferred for real.
 */
const axe = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).disableRules(['target-size']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
};
const teamPage = async (page: Page, phone: string = PHONE.owner) => {
  await atSellerHome(page, phone, SELLER.alem.name);
  await goInApp(page, `/s/${SELLER.alem.id}/settings/team`);
  await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
};
const stepUp = async (page: Page, sentence: string, code = CODE) => {
  const dialog = page.getByRole('dialog', { name: 'Confirm it is you' });
  await expect(dialog.getByText(sentence)).toBeVisible();
  await dialog.getByLabel('One-time code').fill(code);
  await dialog.getByRole('button', { name: 'Confirm' }).click();
};
const signOut = async (page: Page) => {
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
};

test.describe('SC-FE-11 team', () => {
  test('shows the derived Owner, roles as a union, and refuses an active member with no role', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await teamPage(page);
    const members = page.getByRole('list', { name: 'Members' });
    await expect(members.getByRole('listitem').filter({ hasText: 'Amina' })).toContainText('Owner, because they own this Seller.');
    await expect(members.getByRole('listitem').filter({ hasText: 'Mulu' })).toContainText('Inventory, Sales Support');
    await page.getByRole('button', { name: 'Change roles for Saba (demonstration)' }).click();
    await members.getByRole('checkbox', { name: /Sales Support/ }).uncheck();
    await page.getByRole('button', { name: 'Save roles for Saba (demonstration)' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'Choose at least one role.' })).toBeVisible();
    await members.getByRole('checkbox', { name: /Analyst/ }).check();
    await page.getByRole('button', { name: 'Save roles for Saba (demonstration)' }).click();
    await expect(members.getByRole('listitem').filter({ hasText: 'Saba' })).toContainText('Analyst');
  });

  test('invites an existing account by username, says only whether they can accept, and the invitee joins', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await teamPage(page);
    await page.getByLabel('Their Adulis username').fill('nobody');
    await page.getByRole('group', { name: 'Roles' }).last().getByRole('checkbox', { name: /Analyst/ }).check();
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'No Adulis account has this username.' })).toBeVisible();
    await page.getByLabel('Their Adulis username').fill('ibsa');
    await page.getByRole('button', { name: 'Send invitation' }).click();
    const pending = page.getByRole('list', { name: 'Waiting for an answer' });
    await expect(pending).toContainText('They can accept only after leaving the team they are on now.');
    await expect(pending).not.toContainText(SELLER.biruk.name);
    await page.getByLabel('Their Adulis username').fill('hana');
    await page.getByRole('group', { name: 'Roles' }).last().getByRole('checkbox', { name: /Analyst/ }).check();
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(pending.getByRole('listitem')).toHaveCount(2);
    await signOut(page);
    await signInHere(page, PHONE.free);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
    await page.getByRole('link', { name: 'See invitations to join a team' }).click();
    await page.getByRole('button', { name: `Join ${SELLER.alem.name}` }).click();
    // Wait for the server's answer: leaving earlier would (correctly) discard it, and the Seller list would not be refreshed.
    await expect(page.getByText('You have no invitations.')).toBeVisible();
    await page.getByRole('link', { name: 'Back to your Sellers' }).click();
    await expect(page.getByRole('link', { name: SELLER.alem.name })).toBeVisible();
  });

  test('suspends with a confirmation and says the place is kept; other roles have no Team page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await teamPage(page);
    await page.getByRole('button', { name: 'Suspend Ino (demonstration)' }).click();
    const dialog = page.getByRole('dialog', { name: 'Suspend Ino (demonstration)?' });
    await dialog.getByRole('button', { name: 'Suspend Ino (demonstration)' }).click();
    await expect(page.getByRole('list', { name: 'Members' }).getByRole('listitem').filter({ hasText: 'Ino' })).toContainText('Their place on the team is kept.');
    await page.goto('/sign-in');
    await atSellerHome(page, PHONE.sales, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/settings/team`);
    await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
  });

  test('ownership transfer needs an Admin and a purpose-bound code, waits 24 hours, and can be cancelled; an Admin cannot start one', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await teamPage(page);
    await page.getByLabel('New Owner').selectOption({ label: 'Abel (demonstration)' });
    await page.getByRole('button', { name: 'Transfer ownership' }).click();
    await stepUp(page, `Enter the code to transfer ownership of ${SELLER.alem.name} to Abel (demonstration).`, '111111');
    await expect(page.getByRole('dialog', { name: 'Confirm it is you' }).getByRole('alert')).toBeVisible();
    await page.getByRole('dialog', { name: 'Confirm it is you' }).getByLabel('One-time code').fill(CODE);
    await page.getByRole('dialog', { name: 'Confirm it is you' }).getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText(/Ownership will pass to Abel \(demonstration\) at .* unless you cancel\./)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel the transfer' }).click();
    await expect(page.getByRole('button', { name: 'Transfer ownership' })).toBeVisible();
    await page.goto('/sign-in');
    await teamPage(page, PHONE.admin);
    await expect(page.getByRole('region', { name: 'Ownership' })).toHaveCount(0);
  });

  test('a pending transfer whose recipient is suspended stays visible, says why it cannot complete, and can be cancelled (FE12-06)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await teamPage(page);
    await page.getByLabel('New Owner').selectOption({ label: 'Abel (demonstration)' });
    await page.getByRole('button', { name: 'Transfer ownership' }).click();
    await stepUp(page, `Enter the code to transfer ownership of ${SELLER.alem.name} to Abel (demonstration).`);
    await expect(page.getByText(/Ownership will pass to Abel \(demonstration\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Suspend Abel (demonstration)' }).click();
    await page.getByRole('dialog', { name: 'Suspend Abel (demonstration)?' }).getByRole('button', { name: 'Suspend Abel (demonstration)' }).click();
    const ownership = page.getByRole('region', { name: 'Ownership' });
    await expect(ownership.getByText('Abel (demonstration) is no longer an active Admin, so ownership cannot pass to them. Cancel the transfer, then choose someone else.')).toBeVisible();
    await expect(ownership.getByText(/Ownership will pass to/)).toHaveCount(0);
    await ownership.getByRole('button', { name: 'Cancel the transfer' }).click();
    await expect(ownership.getByText(/no longer an active Admin/)).toHaveCount(0);
  });

  test('closure states what it does and keeps, needs no payment, the exact name and a code, and can be cancelled', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/settings`);
    await page.getByRole('link', { name: /Close this Seller/ }).click();
    await expect(page.getByText('Nothing has to be paid to close this Seller, and nothing is owed.')).toBeVisible();
    await page.getByLabel(`Type ${SELLER.alem.name} to confirm`).fill('alem');
    await page.getByRole('button', { name: 'Ask to close this Seller' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'Type the Seller name exactly as shown.' })).toBeVisible();
    await page.getByLabel(`Type ${SELLER.alem.name} to confirm`).fill(SELLER.alem.name);
    await page.getByRole('button', { name: 'Ask to close this Seller' }).click();
    await stepUp(page, `Enter the code to close ${SELLER.alem.name}.`);
    await expect(page.getByText('Nothing has been closed yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel the closure request' }).click();
    await expect(page.getByRole('button', { name: 'Ask to close this Seller' })).toBeVisible();
    await axe(page);
  });

  test('team pages pass axe and do not overflow at 390px and 200% text', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await teamPage(page);
    await axe(page);
    await page.goto('/sign-in');
    await scaleText(page, 200);
    await page.setViewportSize({ width: 390, height: 844 });
    await teamPage(page);
    await expectTextScale(page, 200);
    await noHorizontalOverflow(page);
  });
});

test.describe('SC-FE-11 your account', () => {
  const account = async (page: Page, phone: string = PHONE.owner, sub = '') => {
    await signedInChooser(page, phone);
    await page.getByRole('link', { name: 'Your account and security' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
    if (sub !== '') await page.getByRole('navigation', { name: 'Account sections' }).getByRole('link', { name: sub }).click();
  };

  test('lists sessions, signs one out, and signs out everywhere else only after a code', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await account(page);
    await expect(page.getByText('Adulis never asks for a government ID.')).toBeVisible();
    const list = page.getByRole('list', { name: 'Where you are signed in' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(list.getByRole('listitem').first()).toContainText('This session');
    await page.getByRole('button', { name: 'Sign out Another browser (demonstration)' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await page.getByRole('button', { name: 'Sign out everywhere else' }).click();
    await stepUp(page, 'Enter the code to sign your account out everywhere else.');
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByText('You are signed in only here.')).toBeVisible();
    await axe(page);
  });

  test('security notices cannot be turned off; others can', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await account(page, PHONE.owner, 'Notifications');
    await expect(page.getByRole('checkbox', { name: /Security notices/ })).toBeDisabled();
    await expect(page.getByRole('checkbox', { name: /Security notices/ })).toBeChecked();
    // The box changes only when the server confirms the preference, so click and wait rather than assert at once.
    await page.getByRole('checkbox', { name: 'Team changes' }).click();
    await expect(page.getByRole('checkbox', { name: 'Team changes' })).not.toBeChecked();
    await axe(page);
  });

  test('deletion shows consequences, what is kept, what blocks it, needs DELETE and a code, deletes nothing, and can be cancelled', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await account(page, PHONE.owner, 'Privacy and deletion');
    await expect(page.getByText('You own 4 Sellers. Close them or transfer their ownership first.')).toBeVisible();
    await expect(page.getByText('Deleting your account never needs anything to be paid.')).toBeVisible();
    await page.getByLabel('Type DELETE to confirm').fill('delete');
    await page.getByRole('button', { name: 'Ask to delete my account' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'Type DELETE in capital letters.' })).toBeVisible();
    await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    await page.getByRole('button', { name: 'Ask to delete my account' }).click();
    await stepUp(page, 'Enter the code to ask for your account to be deleted.');
    await expect(page.getByText('Your deletion request is waiting until the items above are resolved.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel my deletion request' }).click();
    await expect(page.getByText('You cancelled your deletion request.')).toBeVisible();
    await page.getByRole('button', { name: 'Ask for a copy of my data' }).click();
    await stepUp(page, 'Enter the code to request a copy of the data in your account.');
    await expect(page.getByText('Your copy is being prepared.')).toBeVisible();
    await axe(page);
  });

  test('account pages do not overflow at 390px and 200% text', async ({ page }) => {
    await scaleText(page, 200);
    await page.setViewportSize({ width: 390, height: 844 });
    await account(page, PHONE.owner, 'Privacy and deletion');
    await expectTextScale(page, 200);
    await noHorizontalOverflow(page);
  });
});
