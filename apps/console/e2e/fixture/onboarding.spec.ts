import { expect, test } from '@playwright/test';
import { atSellerHome, CODE, goInApp, limeCount, PHONE, SELLER, signInHere, signedInChooser } from './helpers';

const hub = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Publication readiness' });
const row = (page: import('@playwright/test').Page, title: string) => page.getByRole('list', { name: 'Requirements' }).getByRole('listitem').filter({ hasText: title });

test.describe('SC-FE-02: becoming a Seller (ONB-01)', () => {
  test('type, name and handle, then admission: no government ID, no payout, no payment', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Mobile phone number').fill(PHONE.fresh);
    await page.getByRole('button', { name: 'Send code' }).click();
    await page.getByLabel('One-time code').fill(CODE);
    await page.getByRole('button', { name: 'Verify code' }).click();
    await page.getByRole('checkbox', { name: /18 years old or older/ }).check();
    await page.getByRole('checkbox', { name: /accept the current Adulis terms/ }).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByRole('link', { name: 'Become a Seller' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Become a Seller' })).toBeVisible();
    await expect(page.getByText('No government ID is asked for.')).toBeVisible();
    await expect(page.getByText('Market: Ethiopia. Times are shown in Africa/Addis_Ababa.')).toBeVisible();
    expect(await limeCount(page)).toBe(1);

    await page.getByRole('button', { name: 'Create my Seller' }).click();
    const summary = page.getByRole('alert').filter({ hasText: 'There is a problem with what you entered.' });
    await expect(summary).toBeFocused();
    await expect(summary.getByRole('link')).toHaveText(['Choose a Seller type.', 'Enter the store name.', 'Use 3 to 30 lowercase letters, numbers, dots or underscores.']);

    await page.getByRole('radio', { name: /Individual Seller/ }).check();
    await page.getByLabel('Store name').fill('Zed Store');
    await page.getByLabel('Store handle').fill('alem');
    await page.getByRole('button', { name: 'Create my Seller' }).click();
    await expect(page.getByText('That handle is already taken.').first()).toBeVisible();

    await page.getByLabel('Store handle').fill('zed.store');
    await page.getByRole('button', { name: 'Create my Seller' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Admission to Adulis' })).toBeVisible();
    await expect(page.getByRole('banner')).toContainText('Zed Store');
    await expect(page.getByRole('banner')).toContainText('Draft');
  });

  test('a double submit creates exactly one Seller (the idempotency key is minted when the form mounts)', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Mobile phone number').fill(PHONE.fresh);
    await page.getByRole('button', { name: 'Send code' }).click();
    await page.getByLabel('One-time code').fill(CODE);
    await page.getByRole('button', { name: 'Verify code' }).click();
    await page.getByRole('checkbox', { name: /18 years old or older/ }).check();
    await page.getByRole('checkbox', { name: /accept the current Adulis terms/ }).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByRole('link', { name: 'Become a Seller' }).click();
    await page.getByRole('radio', { name: /Company Seller/ }).check();
    await page.getByLabel('Store name').fill('Double Click PLC');
    await page.getByLabel('Store handle').fill('double.click');
    const submit = page.getByRole('button', { name: 'Create my Seller' });
    await submit.dblclick();
    await expect(page.getByRole('heading', { level: 1, name: 'Admission to Adulis' })).toBeVisible();
    await goInApp(page, '/sellers');
    await expect(page.getByRole('list', { name: 'Your Sellers' }).getByRole('listitem')).toHaveCount(1);
    await expect(page.getByRole('main')).toContainText('Company Seller');
  });

  test('admission with a code: choose a platform, send the code to the OFFICIAL account, see the anti-phishing statement, and wait for review', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await row(page, 'Admission to Adulis').getByRole('link', { name: 'Connect a social account' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Admission to Adulis' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'More is needed' })).toBeVisible();
    await expect(page.getByText('Connect a TikTok or Instagram account.')).toBeVisible();
    await expect(page.getByText('Connecting directly with the platform is not available yet.')).toBeVisible();
    await expect(page.getByText('Adulis never asks for your social media password.')).toBeVisible();
    expect(await limeCount(page)).toBe(1);

    await page.getByRole('button', { name: 'Send me a verification code' }).click();
    await expect(page.getByText('Enter the handle of the account you sell from.').first()).toBeVisible();
    await page.getByLabel('Your account handle').fill('not a handle!');
    await page.getByRole('button', { name: 'Send me a verification code' }).click();
    await expect(page.getByText('That handle does not look right.').first()).toBeVisible();

    await page.getByRole('radio', { name: 'Instagram' }).check();
    await page.getByLabel('Your account handle').fill('biruk.shoes');
    await page.getByRole('button', { name: 'Send me a verification code' }).click();
    await expect(page.getByRole('heading', { name: 'Send the code to Adulis' })).toBeVisible();
    await expect(page.getByText('Official Adulis Instagram account: @adulis.official.shop')).toBeVisible();
    await expect(page.getByText('Never send the code you use to sign in.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Waiting for review' })).toBeVisible();
    await expect(page.getByText('Instagram @biruk.shoes')).toBeVisible();
    await expect(page.getByText('Waiting for review').nth(1)).toBeVisible();
  });

  test('onboarding resumes after sign-out: the server remembers where the Seller stopped', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await goInApp(page, `/s/${SELLER.biruk.id}/admission`);
    await page.getByLabel('Your account handle').fill('biruk.shoes');
    await page.getByRole('button', { name: 'Send me a verification code' }).click();
    await expect(page.getByRole('heading', { name: 'Send the code to Adulis' })).toBeVisible();
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
    await signInHere(page, PHONE.owner);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
    await page.getByRole('link', { name: SELLER.biruk.name }).click();
    const eligibility = row(page, 'Admission to Adulis');
    await expect(eligibility).toContainText('Waiting');
    await expect(eligibility).toContainText('Waiting for an Adulis review.');
    await expect(eligibility.getByRole('link')).toHaveCount(0);
  });

  test('admission outcomes: admitted, refused under policy, pending', async ({ page }) => {
    await signedInChooser(page, PHONE.states);
    await page.getByRole('link', { name: SELLER.dawit.name }).click();
    await goInApp(page, `/s/${SELLER.dawit.id}/admission`);
    await expect(page.getByRole('heading', { name: 'Admitted', exact: true })).toBeVisible();
    await goInApp(page, `/s/${SELLER.fana.id}/admission`);
    await expect(page.getByRole('heading', { name: 'Not admitted under the current policy' })).toBeVisible();
    await expect(page.getByText('The account does not yet show an established business presence.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send me a verification code' })).toHaveCount(0);
    await goInApp(page, `/s/${SELLER.eden.id}/admission`);
    await expect(page.getByRole('heading', { name: 'Waiting for review' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Check my status again' }).click();
    await expect(page.getByRole('heading', { name: 'Waiting for review' }).first()).toBeVisible();
    // the button really asked the server: the heading alone was already on screen
    await expect.poll(() => page.evaluate(() => window.__ADULIS_FIXTURE__?.callLog().filter((c) => c.op === 'seller.eligibility.recheck').length)).toBe(1);
  });

  test('a team member without the permission sees admission read-only', async ({ page }) => {
    await atSellerHome(page, PHONE.invBiruk, SELLER.biruk.name);
    await goInApp(page, `/s/${SELLER.biruk.id}/admission`);
    await expect(page.getByText('Only an Owner or Admin can change admission details.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send me a verification code' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Check my status again' })).toHaveCount(0);
  });
});

test.describe('SC-FE-02: the Publication Readiness Hub (independent items, server-decided)', () => {
  test('all requirements incomplete: the server order, one lime action, honest deferred steps', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await expect(hub(page)).toContainText('2 of 6 requirements are met.');
    await expect(hub(page).getByRole('heading', { name: 'Not ready to publish yet' })).toBeVisible();
    const titles = await page.getByRole('list', { name: 'Requirements' }).locator('.ledger-title').allTextContents();
    expect(titles).toEqual(['Account created', 'Seller type chosen', 'Admission to Adulis', 'Store profile', 'How buyers receive items', 'First Product']);
    expect(await limeCount(page)).toBe(1);
    await expect(row(page, 'Admission to Adulis').getByRole('link', { name: 'Connect a social account' })).toHaveClass(/btn-highlight/);
    await expect(row(page, 'Store profile')).toContainText('This step arrives in a later release.');
    // a step that is not built is a disabled control with its reason beside it, not a link to a dead page
    const store = row(page, 'Store profile').getByRole('button', { name: 'Set up the store profile' });
    await expect(store).toHaveAttribute('aria-disabled', 'true');
    await expect(store).toHaveAccessibleDescription('This step arrives in a later release.');
    await expect(row(page, 'Store profile').getByRole('link')).toHaveCount(0);
  });

  test('partially complete readiness reflects only what the server marked done', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.chaltu.name);
    await expect(hub(page)).toContainText('4 of 6 requirements are met.');
    await expect(row(page, 'Store profile')).toContainText('Done');
    await expect(row(page, 'How buyers receive items')).toContainText('Needs your action');
    await expect(row(page, 'First Product')).toContainText('Create your first Product.');
    // Products is built (SC-FE-04), so its action is the first built one and carries the single lime action; Fulfilment is not built yet
    await expect(row(page, 'First Product').getByRole('link')).toHaveAttribute('href', `/s/${SELLER.chaltu.id}/products`);
    expect(await limeCount(page)).toBe(1);
  });

  test('complete non-financial readiness is stated, and offers no publish control', async ({ page }) => {
    await signedInChooser(page, PHONE.states);
    await page.getByRole('link', { name: SELLER.dawit.name }).click();
    await expect(hub(page).getByRole('heading', { name: 'Every requirement is met' })).toBeVisible();
    await expect(hub(page)).toContainText('6 of 6 requirements are met.');
    await expect(page.getByRole('button', { name: /publish/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /publish/i })).toHaveCount(0);
  });

  test('missing company information and pending eligibility are separate items with their own words', async ({ page }) => {
    await signedInChooser(page, PHONE.states);
    await page.getByRole('link', { name: SELLER.eden.name }).click();
    await expect(hub(page)).toContainText('2 of 7 requirements are met.');
    await expect(row(page, 'Company details')).toContainText('Company details are incomplete.');
    await expect(row(page, 'Company details').getByRole('button', { name: 'Add company details' })).toHaveAttribute('aria-disabled', 'true');
    await expect(row(page, 'Admission to Adulis')).toContainText('Waiting for an Adulis review.');
    await expect(page.getByText('Eden Foods PLC').first()).toBeVisible();
  });

  test('an unavailable readiness list is an error with a retry, never an empty or complete list', async ({ page }) => {
    await signedInChooser(page, PHONE.states);
    await page.getByRole('link', { name: SELLER.hana.name }).click();
    const error = page.getByRole('alert').filter({ hasText: 'We could not load your readiness list' });
    await expect(error).toBeVisible();
    await expect(error.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Requirements' })).toHaveCount(0);
    await expect(page.getByText('Every requirement is met')).toHaveCount(0);
    await expect(page.getByText(/of \d requirements are met/)).toHaveCount(0);
    // the rest of Home still works: one failed request does not blank the Seller
    await expect(page.getByRole('heading', { level: 2, name: 'Alerts' })).toBeVisible();
  });

  test('a permission-denied resolving action is not rendered, and the row says who can do it', async ({ page }) => {
    await atSellerHome(page, PHONE.invBiruk, SELLER.biruk.name);
    await expect(row(page, 'Admission to Adulis')).toContainText('Needs someone with permission');
    await expect(row(page, 'Admission to Adulis')).toContainText('An Owner or Admin can do this.');
    await expect(row(page, 'Admission to Adulis').getByRole('link')).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Requirements' }).getByRole('link')).toHaveCount(0);
    expect(await limeCount(page)).toBe(0);
  });
});
