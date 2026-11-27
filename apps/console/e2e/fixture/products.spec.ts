import { expect, test, type Page } from '@playwright/test';
import { atSellerHome, expectTextScale, goInApp, limeCount, noHorizontalOverflow, PHONE, scaleText, SELLER } from './helpers';

const DRESSES = "Fashion / Demonstration category: Women's Clothing / Demonstration category: Dresses";
const BACKPACKS = 'Fashion / Demonstration category: Backpacks';
const productPath = (seller: { id: string }, id: string) => `/s/${seller.id}/products/${id}`;
const blockers = (page: Page) => page.getByRole('heading', { level: 3, name: /Needs attention before publication/ });

async function openProduct(page: Page, phone: string, seller: { id: string; name: string }, id: string, title: string): Promise<void> {
  await atSellerHome(page, phone, seller.name);
  await goInApp(page, productPath(seller, id));
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

test.describe('SC-FE-04: the Products list', () => {
  test('is searchable, filterable and paginated by cursor, and shows what the server resolved', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/products`);
    await expect(page.getByRole('heading', { level: 1, name: 'Products and Inventory' })).toBeVisible();
    const list = page.getByRole('list', { name: 'Products', exact: true });
    await expect(list.getByRole('listitem')).toHaveCount(6);
    await page.getByRole('button', { name: 'Show more Products' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(8);
    await expect(page.getByRole('button', { name: 'Show more Products' })).toHaveCount(0);
    // every row carries a state word, never colour alone
    await expect(list.getByRole('listitem').filter({ hasText: 'Linen wrap dress' })).toContainText('Published');
    await expect(list.getByRole('listitem').filter({ hasText: 'Silk slip dress' })).toContainText('Not Available');
    await expect(list.getByRole('listitem').filter({ hasText: 'Wool scarf' })).toContainText('No category yet');

    await page.getByLabel('Show', { exact: true }).selectOption('DRAFT');
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await page.getByLabel('Show', { exact: true }).selectOption('ALL');
    await expect(list.getByRole('listitem')).toHaveCount(6);
    await page.getByLabel('Search Products').fill('silk');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await page.getByLabel('Search Products').fill('zzz');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByText('No Products match this search.')).toBeVisible();
    await expect(list).toHaveCount(0);
  });

  test('offers "Add a Product" as the one lime action, and only to a role that may create', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/products`);
    await expect(page.getByRole('button', { name: 'Add a Product' })).toBeVisible();
    expect(await limeCount(page)).toBe(1);
    await atSellerHome(page, PHONE.campaign, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/products`);
    await expect(page.getByRole('link', { name: /Canvas backpack/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add a Product' })).toHaveCount(0);
  });

  test('a Product of another Seller is "not found", exactly like one that does not exist', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await goInApp(page, productPath(SELLER.biruk, 'fx_prod_alem_1'));
    await expect(page.getByRole('heading', { level: 1, name: 'We could not find that page' })).toBeVisible();
    await goInApp(page, productPath(SELLER.biruk, 'fx_prod_nothing'));
    await expect(page.getByRole('heading', { level: 1, name: 'We could not find that page' })).toBeVisible();
  });
});

test.describe('SC-FE-04: the Product editor', () => {
  test('a Product goes from empty draft to published, every blocker shown at once, and the readiness hub follows the data', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await expect(page.getByRole('region', { name: 'Publication readiness' })).toContainText('2 of 6 requirements are met.');
    await goInApp(page, `/s/${SELLER.biruk.id}/products`);
    await page.getByRole('button', { name: 'Add a Product' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'New Product' })).toBeVisible();
    // all four blockers at once, each a link to the thing that resolves it
    await expect(blockers(page)).toHaveText('Needs attention before publication: 4');
    await expect(page.getByRole('link', { name: 'Add a Product name.' })).toHaveAttribute('href', '#title');

    await page.getByLabel('Product name', { exact: true }).fill('Demonstration shirt dress');
    await page.getByLabel('Category', { exact: true }).selectOption({ label: DRESSES });
    await page.getByRole('button', { name: 'Save name, description and category' }).click();
    await expect(blockers(page)).toHaveText('Needs attention before publication: 3');

    // attributes are rendered from the server's definitions for the saved category
    await expect(page.getByLabel('Material', { exact: true })).toBeVisible();
    await page.getByLabel('Material', { exact: true }).selectOption({ label: 'Linen' });
    await page.getByRole('button', { name: 'Save attributes' }).click();
    await expect(blockers(page)).toHaveText('Needs attention before publication: 2');

    await page.getByLabel('Colour', { exact: true }).selectOption({ label: 'Blue' });
    await page.getByLabel('Size', { exact: true }).selectOption({ label: 'M' });
    await page.locator('#price').fill('2100');
    await page.getByRole('button', { name: 'Add Variant' }).click();
    await expect(page.getByRole('list', { name: 'Variants' }).getByRole('listitem')).toContainText('Blue / M');
    await expect(blockers(page)).toHaveText('Needs attention before publication: 1');

    await page.getByRole('button', { name: 'Update stock' }).click();
    await page.getByLabel('New quantity in stock').fill('3');
    await page.getByRole('button', { name: 'Save stock', exact: true }).click();
    await expect(page.getByText('In stock: 3')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Stock by Variant' })).toContainText('Low');

    await page.getByLabel('Add an image').setInputFiles({ name: 'dress.png', mimeType: 'image/png', buffer: Buffer.from('demonstration image bytes') });
    await expect(page.getByRole('list', { name: 'Product images' })).toContainText('Processing');
    await expect(page.getByRole('list', { name: 'Product images' })).toContainText('Ready');
    await expect(blockers(page)).toHaveCount(0);
    await expect(page.getByText('Nothing is blocking publication.')).toBeVisible();

    await page.getByRole('button', { name: 'Publish Product' }).click();
    await expect(page.getByText('The Product is published.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish Product' })).toHaveCount(0);

    await goInApp(page, `/s/${SELLER.biruk.id}`);
    await expect(page.getByRole('region', { name: 'Publication readiness' })).toContainText('3 of 6 requirements are met.');
  });

  test('publishing an incomplete Product changes nothing and lists what is missing', async ({ page }) => {
    await openProduct(page, PHONE.owner, SELLER.alem, 'fx_prod_alem_6', 'Linen shirt');
    await expect(blockers(page)).toHaveText('Needs attention before publication: 3');
    await page.getByRole('button', { name: 'Publish Product' }).click();
    await expect(page.getByText('Not published. Needing attention: 3.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish Product' })).toBeVisible();
  });

  test('a category whose attributes are not defined says so, and the generic editor still works with one default Variant', async ({ page }) => {
    await openProduct(page, PHONE.owner, SELLER.alem, 'fx_prod_alem_5', 'Wool scarf');
    await page.getByLabel('Category', { exact: true }).selectOption({ label: BACKPACKS });
    await expect(page.getByText('The attributes of this category have not been defined yet.').first()).toBeVisible();
    await page.getByRole('button', { name: 'Save name, description and category' }).click();
    await expect(page.getByText('This category has no Variant options, so you can add one default Variant.')).toBeVisible();
    await expect(page.getByText('The Variant options for this category have not been defined yet, so a Variant is a single default.')).toBeVisible();
    await page.getByRole('button', { name: 'Add the default Variant' }).click();
    await expect(page.getByRole('list', { name: 'Variants' }).getByRole('listitem')).toContainText('Default');
    // a second default is the same combination: the server refuses it and the summary links to the group
    await page.getByRole('button', { name: 'Add the default Variant' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'A Variant with this combination already exists.' })).toBeVisible();
  });

  test('withdrawing asks first, keeps the Product, and offers to publish it again', async ({ page }) => {
    await openProduct(page, PHONE.owner, SELLER.alem, 'fx_prod_alem_2', 'Cotton shirt dress');
    await page.getByRole('button', { name: 'Withdraw Product' }).click();
    const dialog = page.getByRole('dialog', { name: 'Withdraw this Product?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Keep it published' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Publish Product again' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Withdraw Product' }).click();
    await dialog.getByRole('button', { name: 'Withdraw Product' }).click();
    await expect(page.getByText('The Product is withdrawn.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish Product again' })).toBeVisible();
  });

  test('a restricted Product can be read and offers no control', async ({ page }) => {
    await openProduct(page, PHONE.owner, SELLER.alem, 'fx_prod_alem_8', 'Restricted import jacket');
    await expect(page.getByText('This Product is restricted, so it cannot be changed or published here.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Save|Publish|Withdraw|Update stock|Add Variant/ })).toHaveCount(0);
  });
});

test.describe('SC-FE-04: Inventory keeps two distinct controls and a ledger', () => {
  test('Update stock changes the quantity; Confirm stock is accurate does not; History shows both as events', async ({ page }) => {
    await openProduct(page, PHONE.owner, SELLER.alem, 'fx_prod_alem_1', 'Linen wrap dress');
    const card = page.getByRole('listitem', { name: 'Black / S' });
    await expect(card).toContainText('In stock: 8');
    await expect(card).toContainText('Recently confirmed');
    // one shared explanation for the whole section, not repeated on every row
    await expect(page.getByText('No effect on what Buyers see has been defined yet.')).toHaveCount(1);
    await card.getByRole('button', { name: 'Confirm stock is accurate' }).click();
    await expect(card).toContainText('In stock: 8');
    await card.getByRole('button', { name: 'Update stock' }).click();
    await page.getByLabel('New quantity in stock').fill('6');
    await page.getByRole('button', { name: 'Save stock', exact: true }).click();
    await expect(card).toContainText('In stock: 6');
    await card.getByRole('button', { name: 'History' }).click();
    const history = page.getByRole('dialog', { name: 'Stock history for Black / S' });
    await expect(history.getByRole('listitem')).toHaveCount(3);
    await expect(history.getByRole('listitem').nth(0)).toContainText('Removed 2');
    await expect(history.getByRole('listitem').nth(1)).toContainText('Stock confirmed, no change');
    await expect(history.getByRole('listitem').nth(2)).toContainText('Added 8');
  });

  test('a quantity that is not a whole number is refused before and by the server, with a message beside the field', async ({ page }) => {
    await openProduct(page, PHONE.owner, SELLER.alem, 'fx_prod_alem_1', 'Linen wrap dress');
    await page.getByRole('button', { name: 'Update stock' }).first().click();
    await page.getByLabel('New quantity in stock').fill('-3');
    await page.getByRole('button', { name: 'Save stock', exact: true }).click();
    await expect(page.getByText('Enter a whole number, zero or more.').first()).toBeVisible();
    await expect(page.getByLabel('New quantity in stock')).toHaveAttribute('aria-invalid', 'true');
  });

  test('zero stock does not unpublish: the Product stays Published and shows Not Available', async ({ page }) => {
    await openProduct(page, PHONE.owner, SELLER.alem, 'fx_prod_alem_2', 'Cotton shirt dress');
    await page.getByRole('button', { name: 'Update stock' }).click();
    await page.getByLabel('New quantity in stock').fill('0');
    await page.getByRole('button', { name: 'Save stock', exact: true }).click();
    await expect(page.getByText('In stock: 0')).toBeVisible();
    const productBadges = page.getByRole('main').locator('.badges').first();
    await expect(productBadges).toContainText('Published');
    await expect(productBadges).toContainText('Not Available');
  });
});

test.describe('SC-FE-04: roles see what the server says they may do', () => {
  test('Inventory edits Products and stock (CATINV S110), so it also holds the withdraw control for a published Product', async ({ page }) => {
    await openProduct(page, PHONE.inventory, SELLER.alem, 'fx_prod_alem_1', 'Linen wrap dress');
    await expect(page.getByLabel('Product name', { exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Update stock' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm stock is accurate' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Withdraw Product' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish Product' })).toHaveCount(0);
  });

  test('Campaign Manager reads Products for tagging and has no write and no stock control', async ({ page }) => {
    await openProduct(page, PHONE.campaign, SELLER.alem, 'fx_prod_alem_1', 'Linen wrap dress');
    await expect(page.getByLabel('Product name', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Update stock|Confirm stock is accurate|Add Variant|Save/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'History' }).first()).toBeVisible();
  });

  test('Sales Support has no Products area at all', async ({ page }) => {
    await atSellerHome(page, PHONE.sales, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/products`);
    await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
  });
});

test.describe('SC-FE-04: layout at large text', () => {
  test('the editor does not overflow at 390px and 200% text', async ({ page }) => {
    await scaleText(page, 200);
    await page.setViewportSize({ width: 390, height: 800 });
    await openProduct(page, PHONE.owner, SELLER.alem, 'fx_prod_alem_1', 'Linen wrap dress');
    await expectTextScale(page, 200);
    await noHorizontalOverflow(page);
  });
});
