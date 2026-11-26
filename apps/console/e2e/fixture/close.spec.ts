import { expect, test, type Page } from '@playwright/test';
import { atSellerHome, goInApp, limeCount, openSeller, PHONE, SELLER, signedInChooser } from './helpers';

/**
 * SC-FE-01-03-CLOSE. Fixture verification of Console behaviour, NOT backend enforcement.
 *
 * A: while the question "what may this account do on this screen?" is open, nothing protected mounts or fetches on the
 *    strength of an earlier answer. `delayNext` makes that question take 1.5 s, deterministically.
 * B: a readiness action respects permission, entitlement and whether its destination is built.
 * C: cold start and reload are safe; the fixture session is in memory by design.
 */
const banner = (page: Page) => page.getByRole('banner');
const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' });
const ops = (page: Page) => page.evaluate(() => (window.__ADULIS_FIXTURE__?.callLog() ?? []).map((c) => c.op));
const row = (page: Page, title: string) => page.getByRole('list', { name: 'Requirements' }).getByRole('listitem').filter({ hasText: title });

test.describe('A: pending authorization serves no outdated grant', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('revoked access + delayed re-check: nothing mounts, nothing is fetched, then the denial reveals nothing', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await expect(banner(page)).toBeVisible();
    await expect(mainNav(page).getByRole('link', { name: 'Inbox' })).toBeVisible();
    await page.evaluate((id) => {
      window.__ADULIS_FIXTURE__?.revokeDestination(id, 'inbox');
      window.__ADULIS_FIXTURE__?.delayNext('seller.access.get', 1500);
    }, SELLER.alem.id);
    const before = (await ops(page)).length;
    await goInApp(page, `/s/${SELLER.alem.id}/inbox`);
    // The old grant listed Inbox. While the new answer is pending the Seller shell is not served on it at all.
    await expect(banner(page)).toHaveCount(0);
    await expect(mainNav(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Inbox' })).toHaveCount(0);
    expect((await ops(page)).slice(before)).toEqual(['seller.access.get']);
    // The answer says no: a plain denial, with nothing of the destination, and no Inbox entry left to follow.
    await expect(page.getByRole('heading', { level: 1, name: 'You do not have access to this' })).toBeVisible();
    await expect(mainNav(page).getByRole('link', { name: 'Inbox' })).toHaveCount(0);
    await expect(page.getByText('arrives later')).toHaveCount(0);
  });

  test('unchanged access + delayed re-check: the destination appears only after the answer, and only then does it fetch', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('seller.access.get', 1500));
    const before = (await ops(page)).length;
    await goInApp(page, `/s/${SELLER.alem.id}/notifications`);
    await expect(banner(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toHaveCount(0);
    // Neither the page nor the shell's notification badge asked for anything before authorization.
    expect((await ops(page)).slice(before)).toEqual(['seller.access.get']);
    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
    await expect(banner(page)).toBeVisible();
    expect((await ops(page)).slice(before)).toContain('notifications.list');
  });

  test('going back to a path whose old answer is stored still waits for the new answer (A to B to A)', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/notifications`);
    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
    // The server now revokes notifications, and both of the next two re-checks are slow.
    await page.evaluate((id) => {
      window.__ADULIS_FIXTURE__?.revokeCapability(id, 'notifications.view');
      window.__ADULIS_FIXTURE__?.delayNext('seller.access.get', 1500, 2);
    }, SELLER.alem.id);
    const before = (await ops(page)).length;
    await goInApp(page, `/s/${SELLER.alem.id}`);
    await goInApp(page, `/s/${SELLER.alem.id}/notifications`); // Back to the path whose old grant is still stored
    await expect(banner(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toHaveCount(0);
    expect((await ops(page)).slice(before).filter((op) => op !== 'seller.access.get')).toEqual([]);
    await expect(banner(page)).toBeVisible();
  });

  test('a late answer for an earlier Seller cannot restore that Seller grants over the current one', async ({ page }) => {
    await atSellerHome(page, PHONE.mixed, SELLER.lemlem.name);
    await expect(mainNav(page).getByRole('link')).toHaveCount(8);
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('seller.access.get', 1500));
    // Alem (where this account is only Inventory) is asked and left before it answers; Lemlem (Owner) answers at once.
    await goInApp(page, `/s/${SELLER.alem.id}/products`);
    await expect.poll(() => page.evaluate((id) => (window.__ADULIS_FIXTURE__?.callLog() ?? []).some((c) => c.op === 'seller.access.get' && c.sellerId === id), SELLER.alem.id)).toBe(true);
    await goInApp(page, `/s/${SELLER.lemlem.id}`);
    // Lemlem is shown well inside the 1.5 s Alem's answer takes, so the slow call really was Alem's.
    await expect(page.getByRole('heading', { level: 1, name: SELLER.lemlem.name })).toBeVisible({ timeout: 1200 });
    await expect(mainNav(page).getByRole('link')).toHaveCount(8);
    // Let Alem's late answer arrive and prove it changed nothing.
    await page.waitForTimeout(1800);
    await expect(page.getByRole('heading', { level: 1, name: SELLER.lemlem.name })).toBeVisible();
    await expect(mainNav(page).getByRole('link')).toHaveCount(8);
    await expect(page.getByText('You are signed in as Owner.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: SELLER.alem.name })).toHaveCount(0);
  });

  test('a successful answer that arrives after the session ended cannot reopen the Seller', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('seller.access.get', 1500));
    const asked = () => ops(page).then((all) => all.filter((op) => op === 'seller.access.get').length);
    const askedBefore = await asked();
    await goInApp(page, `/s/${SELLER.alem.id}/more`); // call 1: slow, will answer with a success
    await expect.poll(asked).toBeGreaterThan(askedBefore);
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.failNext('seller.access.get', 'AUTHENTICATION_REQUIRED'));
    await goInApp(page, `/s/${SELLER.alem.id}/inbox`); // call 2: fast, the server says the session is over
    await expect(page.getByRole('heading', { name: 'Your session ended' })).toBeVisible();
    // Call 1's success now arrives (it was asked before the session ended) and must change nothing.
    await page.waitForTimeout(1800);
    await expect(page.getByRole('heading', { name: 'Your session ended' })).toBeVisible();
    await expect(mainNav(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: SELLER.alem.name })).toHaveCount(0);
  });
});

test.describe('B: a readiness action respects entitlement, permission and the destination', () => {
  test('a destination the Seller is not entitled to is a disabled action with the reason, never an active link', async ({ page }) => {
    await signedInChooser(page, PHONE.owner);
    await page.evaluate((id) => window.__ADULIS_FIXTURE__?.withdrawEntitlement(id, 'store'), SELLER.biruk.id);
    await openSeller(page, SELLER.biruk.name);
    const store = row(page, 'Store profile');
    await expect(store).toBeVisible();
    const action = store.getByRole('button', { name: 'Set up the store profile' });
    await expect(action).toHaveAttribute('aria-disabled', 'true');
    await expect(action).toHaveAccessibleDescription('Not included for this Seller yet.');
    await expect(store.getByRole('link')).toHaveCount(0);
    await expect(store).not.toContainText('arrives in a later release');
    // The built admission step still carries the single lime action.
    expect(await limeCount(page)).toBe(1);
  });

  test('a destination the account has no permission for hides the action; the requirement itself stays visible', async ({ page }) => {
    await signedInChooser(page, PHONE.owner);
    await page.evaluate((id) => window.__ADULIS_FIXTURE__?.revokeDestination(id, 'store'), SELLER.biruk.id);
    await openSeller(page, SELLER.biruk.name);
    const store = row(page, 'Store profile');
    await expect(store).toBeVisible();
    await expect(store.getByRole('button')).toHaveCount(0);
    await expect(store.getByRole('link')).toHaveCount(0);
    // Other requirements are not affected.
    await expect(row(page, 'First Product').getByRole('button', { name: 'Create your first Product' })).toHaveAttribute('aria-disabled', 'true');
  });
});

test.describe('C: cold start and reload are safe', () => {
  test('a reload returns to sign-in, shows nothing of the Seller and persists no credential or session', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: SELLER.alem.name })).toHaveCount(0);
    await expect(mainNav(page)).toHaveCount(0);
    const stored = await page.evaluate(() => ({ local: Object.keys(window.localStorage), session: Object.keys(window.sessionStorage), cookie: document.cookie }));
    expect(stored).toEqual({ local: [], session: [], cookie: '' });
  });

  test('cold start on a Seller address without a session asks for sign-in; an unknown address is a plain not-found', async ({ page }) => {
    await page.goto(`/s/${SELLER.alem.id}/inbox`);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: SELLER.alem.name })).toHaveCount(0);
    await expect(mainNav(page)).toHaveCount(0);
    await page.goto('/this-is-not-a-page');
    await expect(page.getByRole('heading', { level: 1, name: 'We could not find that page' })).toBeVisible();
  });
});

test.describe('D: the narrow bar keeps a meaningful name where one fits', () => {
  test('at 150% text on a phone, More is current under a route that lives under it and shows its name; the other names stay icons', async ({ page }) => {
    const { expectTextScale, scaleText } = await import('./helpers');
    await scaleText(page, 150);
    await page.setViewportSize({ width: 390, height: 800 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await expectTextScale(page, 150);
    await goInApp(page, `/s/${SELLER.alem.id}/insights`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const bar = mainNav(page);
    const more = bar.getByRole('link', { name: 'More' });
    await expect(more).toHaveAttribute('aria-current', 'page');
    const width = (name: string) => bar.getByRole('link', { name }).locator('.nav-label').evaluate((el) => el.getBoundingClientRect().width);
    expect(await width('More')).toBeGreaterThan(20); // its name is visible
    expect(await width('Home')).toBeLessThanOrEqual(2); // the others are icons; their names stay for assistive technology
    await expect(bar.getByRole('link', { name: 'Home' })).toBeVisible();
  });
});
