import { expect, test } from '@playwright/test';
import { CODE, goInApp, limeCount, PHONE, SELLER, signIn, signedInChooser } from './helpers';

test.describe('SC-FE-02: authentication', () => {
  test('phone, code and chooser, with one lime action per screen', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
    expect(await limeCount(page)).toBe(1);
    await page.getByLabel('Mobile phone number').fill(PHONE.owner);
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Enter your code' })).toBeFocused();
    expect(await limeCount(page)).toBe(1);
    await page.getByLabel('One-time code').fill(CODE);
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
    await expect(page.getByRole('link', { name: SELLER.alem.name })).toBeVisible();
  });

  test('phone validation shows a summary of links plus the field message, and nothing is sent', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: 'Send code' }).click();
    const summary = page.getByRole('alert').filter({ hasText: 'There is a problem with what you entered.' });
    await expect(summary).toBeFocused();
    await summary.getByRole('link', { name: 'Enter a valid mobile phone number with its country code.' }).click();
    await expect(page.getByLabel('Mobile phone number')).toBeFocused();
    await expect(page.getByLabel('Mobile phone number')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
  });

  test('incorrect, expired and rate-limited codes each read differently and keep the person in place', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Mobile phone number').fill(PHONE.owner);
    await page.getByRole('button', { name: 'Send code' }).click();
    const code = page.getByLabel('One-time code');
    const verify = page.getByRole('button', { name: 'Verify code' });

    await code.fill('111111');
    await verify.click();
    await expect(page.getByText('That code is not right. Check it and try again.').first()).toBeVisible();

    await code.fill('333333');
    await verify.click();
    await expect(page.getByRole('alert').filter({ hasText: /Too many tries\. You can try again at/ })).toBeVisible();

    await code.fill('222222');
    await verify.click();
    await expect(page.getByText('That code has expired. Ask for a new one.').first()).toBeVisible();
    // expiry is reported by the server, which then allows a new code: no waiting on our clock
    await expect(page.getByRole('button', { name: 'Send a new code' })).toHaveAttribute('aria-disabled', 'false');

    await code.fill('abc');
    await verify.click();
    await expect(page.getByText('The code contains digits only.').first()).toBeVisible();
  });

  test('resend is available only when the server says so and replaces the old code', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Mobile phone number').fill(PHONE.owner);
    await page.getByRole('button', { name: 'Send code' }).click();
    const resend = page.getByRole('button', { name: 'Send a new code' });
    await expect(resend).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText(/You can ask for a new code at/)).toBeVisible();
    // the demonstration resend delay is two seconds; the page asks the server again when its deadline passes
    await expect(resend).toHaveAttribute('aria-disabled', 'false', { timeout: 10_000 });
    await resend.click();
    await expect(page.getByText('A new code was sent. The old code no longer works.').first()).toBeVisible();
    await page.getByLabel('One-time code').fill(CODE);
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
  });

  test('"use a different number" returns to the phone screen; a reload of the code screen does too', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Mobile phone number').fill(PHONE.owner);
    await page.getByRole('button', { name: 'Send code' }).click();
    await page.getByRole('button', { name: 'Use a different number' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
    await page.goto('/sign-in/verify');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
  });

  test('account recovery entry answers the same way and never reveals an account', async ({ page }) => {
    await page.goto('/sign-in/recovery');
    await page.getByLabel('Mobile phone number').fill('+251911000999');
    await page.getByRole('button', { name: 'Request recovery' }).click();
    await expect(page.getByRole('heading', { name: 'Request recorded' })).toBeVisible();
    await expect(page.getByText(/If this number belongs to an account/)).toBeVisible();
    await page.getByRole('link', { name: 'Back to sign in' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
  });

  test('a new account must make both declarations; the refusal never says which was missing', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Mobile phone number').fill(PHONE.fresh);
    await page.getByRole('button', { name: 'Send code' }).click();
    await page.getByLabel('One-time code').fill(CODE);
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible();
    await page.getByRole('checkbox', { name: /I confirm that I am 18 years old or older/ }).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Both confirmations are needed to create an account.').first()).toBeVisible();
    await page.getByRole('checkbox', { name: /I accept the current Adulis terms and privacy policy/ }).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'You do not have a Seller yet' })).toBeVisible();
  });

  test('sign-out ends the session, and Back does not show Seller data', async ({ page }) => {
    await signedInChooser(page, PHONE.owner);
    await page.getByRole('link', { name: SELLER.alem.name }).click();
    await expect(page.getByRole('heading', { level: 1, name: SELLER.alem.name })).toBeVisible();
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
    await expect(page.getByText('You have signed out.')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
    // the demonstration-account helper names Alem in its labels, so look for Seller screens, not for the name
    await expect(page.getByRole('link', { name: SELLER.alem.name })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: SELLER.alem.name })).toHaveCount(0);
  });

  test('a session the server ended shows the session-expired state and drops every Seller screen', async ({ page }) => {
    await signedInChooser(page, PHONE.owner);
    await page.getByRole('link', { name: SELLER.alem.name }).click();
    await expect(page.getByRole('heading', { level: 1, name: SELLER.alem.name })).toBeVisible();
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.revokeSession());
    await goInApp(page, `/s/${SELLER.alem.id}/more`);
    await expect(page.getByRole('heading', { name: 'Your session ended' })).toBeVisible();
    await expect(page.getByText(SELLER.alem.name)).toHaveCount(0);
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
  });

  test('a Seller deep link before sign-in returns there afterwards', async ({ page }) => {
    await signIn(page, PHONE.owner, `/s/${SELLER.biruk.id}`);
    await expect(page.getByRole('heading', { level: 1, name: SELLER.biruk.name })).toBeVisible();
  });
});
