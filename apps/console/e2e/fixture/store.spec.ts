import { expect, test, type Page } from '@playwright/test';
import { atSellerHome, expectTextScale, goInApp, noHorizontalOverflow, PHONE, scaleText, SELLER } from './helpers';

type Seller = { id: string; name: string };
const storeNav = (page: Page) => page.getByRole('navigation', { name: 'Store settings', exact: true });
const hubRow = (page: Page, title: string) => page.getByRole('list', { name: 'Requirements' }).getByRole('listitem').filter({ hasText: title });
const ADDIS = 'Demonstration area: Addis Ababa';

async function openStore(page: Page, phone: string, seller: Seller, path: string, heading: string): Promise<void> {
  await atSellerHome(page, phone, seller.name);
  await goInApp(page, `/s/${seller.id}/store${path}`);
  await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
}

test.describe('SC-FE-06: the Store profile', () => {
  test('is reached from the readiness hub, saved, announced, and then the requirement is Done', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await hubRow(page, 'Store profile').getByRole('link', { name: 'Set up the store profile' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Store', exact: true })).toBeVisible();
    for (const name of ['Profile', 'Location', 'Service coverage', 'Opening hours', 'Fulfilment', 'Couriers']) await expect(storeNav(page).getByRole('link', { name, exact: true })).toBeVisible();
    await expect(storeNav(page).getByRole('link', { name: 'Profile', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('biruk', { exact: true })).toBeVisible(); // the handle is shown, not editable
    await expect(page.getByLabel('Store name')).toHaveValue('Biruk Shoes');
    await page.getByLabel('About your Store').fill('Handmade leather shoes from Addis Ababa.');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await goInApp(page, `/s/${SELLER.biruk.id}`);
    await expect(hubRow(page, 'Store profile')).toContainText('Done');
  });

  test('a blank name is refused beside the field, with a summary link to it', async ({ page }) => {
    await openStore(page, PHONE.owner, SELLER.alem, '', 'Store');
    await page.getByLabel('Store name').fill('   ');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'Enter a Store name.' })).toHaveAttribute('href', '#display_name');
    await expect(page.getByLabel('Store name')).toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe('SC-FE-06: location, coverage, hours', () => {
  test('the location is chosen from provider results, starts hidden from Buyers, and can be shown or removed', async ({ page }) => {
    await openStore(page, PHONE.owner, SELLER.biruk, '/location', 'Store location');
    await expect(page.getByText('No shop location is set.')).toBeVisible();
    await page.getByLabel('Search for your shop').fill('Piassa');
    await page.getByRole('button', { name: 'Search places' }).click();
    await page.getByRole('button', { name: 'Use Demonstration place 2, Piassa, Addis Ababa' }).click();
    const facts = page.locator('dl.facts');
    await expect(facts).toContainText('Demonstration place 2, Piassa, Addis Ababa');
    await expect(facts).toContainText('Google Maps');
    await expect(facts).toContainText(/Shown to Buyers\s*No/);
    await page.getByRole('checkbox', { name: 'Show this location to Buyers' }).check();
    await page.getByRole('button', { name: 'Save visibility' }).click();
    await expect(facts).toContainText(/Shown to Buyers\s*Yes/);
    await page.getByRole('button', { name: 'Remove location' }).click();
    await expect(page.getByText('No shop location is set.')).toBeVisible();
    await expect(page.getByText('A map preview is not available in this release.')).toBeVisible();
  });

  test('service coverage starts empty and is explicit; Market eligibility is not coverage', async ({ page }) => {
    await openStore(page, PHONE.owner, SELLER.biruk, '/coverage', 'Service coverage');
    await expect(page.getByText('Being in this Market does not mean you serve everywhere in it.')).toBeVisible();
    await expect(page.getByText('No area is chosen yet.')).toBeVisible();
    await page.getByRole('checkbox', { name: ADDIS }).check();
    await page.getByRole('button', { name: 'Save service coverage' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(page.getByText('No area is chosen yet.')).toHaveCount(0);
  });

  test('opening hours are local to the Market timezone, and the server\'s refusals land beside the day or date', async ({ page }) => {
    await openStore(page, PHONE.owner, SELLER.alem, '/hours', 'Opening hours');
    await expect(page.getByText('Times are in Africa/Addis_Ababa.')).toBeVisible();
    await expect(page.getByLabel('Monday, hours 1: opens at')).toHaveValue('08:30');
    await expect(page.getByText('Sunday: closed.')).toBeVisible();

    await page.getByRole('button', { name: 'Add hours for Sunday' }).click();
    await page.getByLabel('Sunday, hours 1: opens at').fill('18:00');
    await page.getByLabel('Sunday, hours 1: closes at').fill('17:00');
    await page.getByRole('button', { name: 'Save opening hours' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'Each opening time must be earlier than its closing time.' })).toHaveAttribute('href', '#hours-SUN');

    await page.getByLabel('Sunday, hours 1: opens at').fill('10:00');
    await page.getByLabel('Sunday, hours 1: closes at').fill('14:00');
    await page.getByRole('button', { name: 'Add hours for Sunday' }).click();
    await page.getByLabel('Sunday, hours 2: opens at').fill('13:00');
    await page.getByLabel('Sunday, hours 2: closes at').fill('15:00');
    await page.getByRole('button', { name: 'Save opening hours' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'Opening hours on the same day cannot overlap.' })).toBeVisible();

    await page.getByRole('button', { name: 'Remove hours 2 for Sunday' }).click();
    await page.getByRole('button', { name: 'Add a closure date' }).click();
    await page.getByLabel('Closure 2: date').fill('2026-12-25');
    await page.getByRole('button', { name: 'Save opening hours' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'This date is already listed.' })).toHaveAttribute('href', '#closure-1');

    await page.getByLabel('Closure 2: date').fill('2026-12-31');
    await page.getByLabel('Closure 2: note').fill('Stocktake');
    await page.getByRole('button', { name: 'Save opening hours' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(page.getByLabel('Sunday, hours 1: opens at')).toHaveValue('10:00');
  });
});

test.describe('SC-FE-06: fulfilment and coverage depend on each other', () => {
  test('offers exactly the three governing methods, and a delivery method needs a service area', async ({ page }) => {
    await openStore(page, PHONE.owner, SELLER.chaltu, '/fulfilment', 'Fulfilment');
    for (const mode of ['Buyer Collection', 'Seller Delivery', 'Courier Delivery']) await expect(page.getByRole('group', { name: mode, exact: true })).toBeVisible();
    // relationships are not methods: no group, label or option for a pool or a network on this page
    await expect(page.getByText(/Private Courier Pool|Cross-Seller/)).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Offer Seller Delivery' }).check();
    await page.getByRole('button', { name: 'Save fulfilment' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'Choose at least one service area while a delivery method is on.' })).toHaveAttribute('href', '#fulfilment');

    await storeNav(page).getByRole('link', { name: 'Service coverage' }).click();
    await page.getByRole('checkbox', { name: ADDIS }).check();
    await page.getByRole('button', { name: 'Save service coverage' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await storeNav(page).getByRole('link', { name: 'Fulfilment' }).click();
    await page.getByRole('checkbox', { name: 'Offer Buyer Collection' }).check();
    await page.getByLabel('Instructions for Buyer Collection').fill('Collect from the front desk.');
    await page.getByRole('button', { name: 'Save fulfilment' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await goInApp(page, `/s/${SELLER.chaltu.id}`);
    await expect(hubRow(page, 'How buyers receive items')).toContainText('Done');
  });

  test('a method the Market does not enable is shown with that fact and cannot be turned on', async ({ page }) => {
    await openStore(page, PHONE.owner, SELLER.kidist, '/fulfilment', 'Fulfilment');
    await expect(page.getByText('Courier Delivery is not available in your Market yet.')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Offer Courier Delivery' })).toBeDisabled();
  });

  test('turning on Courier Delivery points to Couriers, which are relationships and not another method', async ({ page }) => {
    await openStore(page, PHONE.owner, SELLER.alem, '/fulfilment', 'Fulfilment');
    await page.getByRole('checkbox', { name: 'Offer Courier Delivery' }).check();
    await page.getByRole('link', { name: 'Manage your Couriers' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Couriers', exact: true })).toBeVisible();
  });
});

test.describe('SC-FE-06: Courier relationships, never delivery', () => {
  test('says delivery is not available, and shows only relationship states', async ({ page }) => {
    await openStore(page, PHONE.owner, SELLER.alem, '/couriers', 'Couriers');
    await expect(page.getByText('Assigning a Courier to a delivery, handing items over, delivery progress and Courier compensation are not available yet.')).toBeVisible();
    const list = page.getByRole('list', { name: 'Courier relationships' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(list.getByRole('listitem').filter({ hasText: 'Meseret' })).toContainText('Working with you');
    await expect(list.getByRole('listitem').filter({ hasText: 'Yonas' })).toContainText('Invited');
    await expect(list.getByRole('listitem').filter({ hasText: 'Tigist' })).toContainText('Revoked');
    const text = await page.getByRole('main').innerText();
    expect(text).not.toMatch(/Awaiting Pickup|Pickup Verified|In Delivery|Delivery Verified|payout|settle/i);
    await expect(page.getByText('Working with more Sellers does not let a Courier take more than one delivery at a time.')).toBeVisible();
  });

  test('invites by phone, refuses a bad number beside the field, and revokes or withdraws behind a confirmation', async ({ page }) => {
    await openStore(page, PHONE.owner, SELLER.alem, '/couriers', 'Couriers');
    await page.getByLabel('Courier phone number').fill('12');
    await page.getByRole('button', { name: 'Invite Courier' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'Enter a phone number with the country code.' })).toHaveAttribute('href', '#phone');

    await page.getByLabel('Courier phone number').fill('+251911000042');
    await page.getByRole('button', { name: 'Invite Courier' }).click();
    const list = page.getByRole('list', { name: 'Courier relationships' });
    await expect(list.getByRole('listitem')).toHaveCount(4);
    await expect(list.getByRole('listitem').filter({ hasText: 'Courier ending 042' })).toContainText('Invited');

    await list.getByRole('button', { name: 'Revoke Meseret (demonstration)' }).click();
    const dialog = page.getByRole('dialog', { name: 'Revoke this Courier?' });
    await dialog.getByRole('button', { name: 'Keep it' }).click();
    await expect(dialog).toBeHidden();
    await expect(list.getByRole('listitem').filter({ hasText: 'Meseret' })).toContainText('Working with you');
    await list.getByRole('button', { name: 'Revoke Meseret (demonstration)' }).click();
    await dialog.getByRole('button', { name: 'Revoke Courier' }).click();
    const meseret = list.getByRole('listitem').filter({ hasText: 'Meseret' });
    await expect(meseret).toContainText('Revoked');
    await expect(meseret.getByRole('button')).toHaveCount(0);

    await list.getByRole('button', { name: 'Withdraw the invitation to Yonas (demonstration)' }).click();
    await page.getByRole('dialog', { name: 'Withdraw this invitation?' }).getByRole('button', { name: 'Withdraw invitation' }).click();
    await expect(list.getByRole('listitem').filter({ hasText: 'Yonas' })).toContainText('Revoked');
  });
});

test.describe('SC-FE-06: roles, and layout', () => {
  test('Admin edits the Store; Inventory, Campaign Manager and Sales Support have no Store area at all', async ({ page }) => {
    await openStore(page, PHONE.admin, SELLER.alem, '', 'Store');
    await expect(page.getByRole('button', { name: 'Save profile' })).toBeVisible();
    for (const phone of [PHONE.inventory, PHONE.campaign, PHONE.sales]) {
      await atSellerHome(page, phone, SELLER.alem.name);
      await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Store' })).toHaveCount(0);
      await goInApp(page, `/s/${SELLER.alem.id}/store`);
      await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
    }
  });

  test('the hours and fulfilment pages do not overflow at 390px and 200% text', async ({ page }) => {
    await scaleText(page, 200);
    await page.setViewportSize({ width: 390, height: 800 });
    await openStore(page, PHONE.owner, SELLER.alem, '/hours', 'Opening hours');
    await expectTextScale(page, 200);
    await noHorizontalOverflow(page);
    await goInApp(page, `/s/${SELLER.alem.id}/store/fulfilment`);
    await expect(page.getByRole('heading', { level: 1, name: 'Fulfilment', exact: true })).toBeVisible();
    await noHorizontalOverflow(page);
  });
});
