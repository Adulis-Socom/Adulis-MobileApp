import { expect, test, type Page } from '@playwright/test';
import { atSellerHome, expectTextScale, goInApp, limeCount, noHorizontalOverflow, PHONE, scaleText, SELLER } from './helpers';

const list = (page: Page) => page.getByRole('list', { name: 'Stories', exact: true });
const rowOf = (page: Page, text: string) => list(page).getByRole('listitem').filter({ hasText: text });
const PHOTO = { name: 'rain.png', mimeType: 'image/png', buffer: Buffer.from('demonstration photo bytes') };

async function openStories(page: Page, phone: string): Promise<void> {
  await atSellerHome(page, phone, SELLER.alem.name);
  await goInApp(page, `/s/${SELLER.alem.id}/content/stories`);
  await expect(page.getByRole('heading', { level: 1, name: 'Seller Stories' })).toBeVisible();
}

test.describe('SC-FE-05S: the Stories list shows what the server decided', () => {
  test('every state, the link or its absence, and times in the Market timezone', async ({ page }) => {
    await openStories(page, PHONE.owner);
    await expect(list(page).getByRole('listitem')).toHaveCount(6);
    const live = rowOf(page, 'New arrivals');
    await expect(live).toContainText('Published');
    await expect(live).toContainText('Public now');
    await expect(live).toContainText('Linked to the Product: Canvas backpack');
    await expect(live).toContainText('Public until');
    await expect(live.locator('time')).toHaveCount(1);
    const plain = rowOf(page, 'No text');
    await expect(plain).toContainText('No link. This Story has no Product or Scene button.');
    await expect(rowOf(page, 'Last weekend only')).toContainText('Expired');
    await expect(rowOf(page, 'Last weekend only')).toContainText('Ended');
    await expect(rowOf(page, 'Last weekend only').getByRole('button')).toHaveCount(0);
    await expect(rowOf(page, 'Sold out already')).toContainText('Withdrawn');
    await expect(rowOf(page, 'Held back for review')).toContainText('Restricted');
    // a published Story whose linked Scene is Private is not shown to Buyers, and the Seller is told why
    await expect(rowOf(page, 'Evening edit')).toContainText('Not public');
    await expect(rowOf(page, 'Evening edit')).toContainText('The linked item is not available to Buyers right now, so this Story is not shown.');
    await expect(page.getByText('A published Story cannot be edited. Withdraw it and post a new one.')).toBeVisible();
  });

  test('past the end time the server reports Expired and offers no action, even for a Story that was live a moment before', async ({ page }) => {
    await openStories(page, PHONE.owner);
    await expect(rowOf(page, 'New arrivals')).toContainText('Public now');
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.skewClock(25 * 3_600_000));
    // the Console does not decide: it asks again, and shows the answer
    await goInApp(page, `/s/${SELLER.alem.id}/products`);
    await expect(page.getByRole('heading', { level: 1, name: 'Products and Inventory' })).toBeVisible();
    await goInApp(page, `/s/${SELLER.alem.id}/content/stories`);
    await expect(rowOf(page, 'New arrivals')).toContainText('Expired');
    await expect(rowOf(page, 'New arrivals')).not.toContainText('Public now');
    await expect(rowOf(page, 'New arrivals').getByRole('button')).toHaveCount(0);
  });

  test('the content navigation moves between Scenes and Stories', async ({ page }) => {
    await openStories(page, PHONE.owner);
    const nav = page.getByRole('navigation', { name: 'Content', exact: true });
    await expect(nav.getByRole('link', { name: 'Seller Stories' })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: 'Scenes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Scenes' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Content', exact: true }).getByRole('link', { name: 'Scenes' })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('SC-FE-05S: composing, previewing, publishing and withdrawing', () => {
  test('a Story with a Product link: composed, previewed, published; it is the one lime action at each step', async ({ page }) => {
    await openStories(page, PHONE.owner);
    // the button depends on what the server says this account may do, so wait for it before counting
    await expect(page.getByRole('button', { name: 'Add a Story' })).toBeVisible();
    expect(await limeCount(page)).toBe(1);
    await page.getByRole('button', { name: 'Add a Story' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'New Story' })).toBeVisible();
    expect(await limeCount(page)).toBe(0);
    await expect(page.getByLabel('Photo', { exact: true })).toHaveAttribute('accept', 'image/*');

    // a photo is required: the summary links to the field, the message sits beside it
    await page.getByRole('button', { name: 'Preview Story' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'Choose an image file.' })).toHaveAttribute('href', '#photo');

    await page.getByLabel('Photo', { exact: true }).setInputFiles(PHOTO);
    await expect(page.getByText('Chosen: rain.png')).toBeVisible();
    await page.getByLabel('Text', { exact: true }).fill('Fresh stock');
    // a link is optional, and when chosen it must name something
    await page.getByRole('radio', { name: 'A Product' }).check();
    await page.getByRole('button', { name: 'Preview Story' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'Choose what to link to, or choose Nothing.' })).toBeVisible();
    await page.getByLabel('Product', { exact: true }).selectOption({ label: 'Canvas backpack' });
    await page.getByRole('button', { name: 'Preview Story' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Preview' })).toBeVisible();
    await expect(page.getByText('This Story will link to the Product: Canvas backpack.')).toBeVisible();
    await expect(page.getByText('After you publish it you cannot edit it')).toBeVisible();
    expect(await limeCount(page)).toBe(1);
    await page.getByRole('button', { name: 'Back to editing' }).click();
    await expect(page.getByLabel('Text', { exact: true })).toHaveValue('Fresh stock');
    await page.getByRole('button', { name: 'Preview Story' }).click();
    await page.getByRole('button', { name: 'Publish Story' }).click();

    await expect(page.getByText('The Story is published.')).toBeVisible();
    await expect(list(page).getByRole('listitem')).toHaveCount(7);
    const created = rowOf(page, 'Fresh stock');
    await expect(created).toContainText('Public now');
    await expect(created).toContainText('Linked to the Product: Canvas backpack');
    await expect(created).toContainText('Photo: rain.png');
  });

  test('a Story with no link says so, in the preview and in the list, and shows no Product or Scene button', async ({ page }) => {
    await openStories(page, PHONE.owner);
    await page.getByRole('button', { name: 'Add a Story' }).click();
    await page.getByLabel('Photo', { exact: true }).setInputFiles(PHOTO);
    await page.getByRole('button', { name: 'Preview Story' }).click();
    await expect(page.getByText('This Story will have no Product or Scene button.')).toBeVisible();
    await page.getByRole('button', { name: 'Publish Story' }).click();
    await expect(rowOf(page, 'No text').filter({ hasText: 'rain.png' })).toContainText('No link. This Story has no Product or Scene button.');
  });

  test('a file that is not a photo is refused by the server and the Seller is returned to the field', async ({ page }) => {
    await openStories(page, PHONE.owner);
    await page.getByRole('button', { name: 'Add a Story' }).click();
    await page.getByLabel('Photo', { exact: true }).setInputFiles({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.from('not a photo') });
    await page.getByRole('button', { name: 'Preview Story' }).click();
    await page.getByRole('button', { name: 'Publish Story' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'This file is not accepted. Choose a photo.' })).toBeVisible();
    await expect(page.getByLabel('Photo', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(list(page).getByRole('listitem')).toHaveCount(6);
  });

  test('withdrawing asks first, is final, and leaves no action behind', async ({ page }) => {
    await openStories(page, PHONE.owner);
    const row = rowOf(page, 'New arrivals');
    await row.getByRole('button', { name: 'Withdraw Story' }).click();
    const dialog = page.getByRole('dialog', { name: 'Withdraw this Story?' });
    await dialog.getByRole('button', { name: 'Keep it' }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toContainText('Published');
    await row.getByRole('button', { name: 'Withdraw Story' }).click();
    await dialog.getByRole('button', { name: 'Withdraw Story' }).click();
    await expect(row).toContainText('Withdrawn');
    await expect(row).toContainText('Not public');
    await expect(row.getByRole('button')).toHaveCount(0);
  });
});

test.describe('SC-FE-05S: roles, and layout', () => {
  test('Campaign Manager may post; Inventory has no Content area at all', async ({ page }) => {
    await openStories(page, PHONE.campaign);
    await expect(page.getByRole('button', { name: 'Add a Story' })).toBeVisible();
    await atSellerHome(page, PHONE.inventory, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/content/stories`);
    await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
  });

  test('the list and the composer do not overflow at 390px and 200% text', async ({ page }) => {
    await scaleText(page, 200);
    await page.setViewportSize({ width: 390, height: 800 });
    await openStories(page, PHONE.owner);
    await expectTextScale(page, 200);
    await noHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Add a Story' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'New Story' })).toBeVisible();
    await noHorizontalOverflow(page);
  });
});
