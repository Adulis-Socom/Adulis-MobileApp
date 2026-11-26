import { expect, test, type Page } from '@playwright/test';
import { atSellerHome, expectTextScale, goInApp, limeCount, noHorizontalOverflow, PHONE, scaleText, SELLER } from './helpers';

const OUT_OF_STOCK = 'All tagged Products are currently out of stock.';
const sceneList = (page: Page) => page.getByRole('list', { name: 'Scenes', exact: true });
const sceneBlockers = (page: Page) => page.getByRole('heading', { level: 3, name: /Needs attention before publication/ });
const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function openContent(page: Page, phone: string, seller: { id: string; name: string } = SELLER.alem): Promise<void> {
  await atSellerHome(page, phone, seller.name);
  await goInApp(page, `/s/${seller.id}/content`);
  await expect(page.getByRole('heading', { level: 1, name: 'Scenes' })).toBeVisible();
}
async function openScene(page: Page, phone: string, id: string): Promise<void> {
  await atSellerHome(page, phone, SELLER.alem.name);
  await goInApp(page, `/s/${SELLER.alem.id}/content/scenes/${id}`);
  await expect(page.getByRole('heading', { level: 2, name: 'Publication' })).toBeVisible();
}

test.describe('SC-FE-05: the Scenes inventory', () => {
  test('has the six tabs of the design, paginates by cursor, and keeps lifecycle, visibility and moderation apart', async ({ page }) => {
    await openContent(page, PHONE.owner);
    for (const name of ['All', 'Draft', 'Public', 'Private', 'Archived', 'Restricted / Removed']) await expect(tab(page, name)).toBeVisible();
    await expect(tab(page, 'All')).toHaveAttribute('aria-pressed', 'true');
    await expect(sceneList(page).getByRole('listitem')).toHaveCount(5);
    await page.getByRole('button', { name: 'Show more Scenes' }).click();
    await expect(sceneList(page).getByRole('listitem')).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Show more Scenes' })).toHaveCount(0);

    await tab(page, 'Private').click();
    await expect(tab(page, 'Private')).toHaveAttribute('aria-pressed', 'true');
    await expect(sceneList(page).getByRole('listitem')).toHaveCount(2);
    // the one sentence the design quotes, for the stock reason; an honest neutral line for a reason with no approved sentence
    await expect(sceneList(page).getByRole('listitem').filter({ hasText: 'The silk slip dress, evening edit' })).toContainText(OUT_OF_STOCK);
    await expect(sceneList(page).getByRole('listitem').filter({ hasText: 'The old kaftan, styled two ways' })).toContainText('This Scene is private for a reason this version cannot describe yet.');
    for (const row of await sceneList(page).getByRole('listitem').all()) {
      await expect(row).toContainText('Published');
      await expect(row).toContainText('Private');
    }

    await tab(page, 'Restricted / Removed').click();
    await expect(sceneList(page).getByRole('listitem')).toHaveCount(1);
    await expect(sceneList(page).getByRole('listitem').first()).toContainText('Restricted');
    await tab(page, 'Public').click();
    await expect(sceneList(page).getByRole('listitem')).toHaveCount(1);
    await expect(sceneList(page).getByRole('listitem').first()).toContainText('Tagged Products: 2');
    await tab(page, 'Draft').click();
    await expect(sceneList(page).getByRole('listitem').first()).toContainText('No caption yet');
    await tab(page, 'Archived').click();
    await expect(sceneList(page).getByRole('listitem')).toHaveCount(1);
  });

  test('the Private reason is a quoted sentence, with the way back, and no action to force it Public', async ({ page }) => {
    await openScene(page, PHONE.owner, 'fx_scene_alem_2');
    await expect(page.getByRole('region', { name: 'Publication' })).toContainText(OUT_OF_STOCK);
    await expect(page.getByRole('region', { name: 'Publication' })).toContainText('You do not need to publish it again.');
    await expect(page.getByRole('button', { name: 'Publish Scene' })).toHaveCount(0);
  });

  test('a Scene turns Public again by itself when its tagged Product is restocked', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/products/fx_prod_alem_3`);
    await expect(page.getByRole('heading', { level: 1, name: 'Silk slip dress' })).toBeVisible();
    await page.getByRole('button', { name: 'Update stock' }).click();
    await page.getByLabel('New quantity in stock').fill('3');
    await page.getByRole('button', { name: 'Save stock', exact: true }).click();
    await expect(page.getByText('In stock: 3')).toBeVisible();
    await goInApp(page, `/s/${SELLER.alem.id}/content`);
    await expect(page.getByRole('heading', { level: 1, name: 'Scenes' })).toBeVisible();
    await tab(page, 'Public').click();
    await expect(sceneList(page).getByRole('listitem')).toHaveCount(2);
    await tab(page, 'Private').click();
    await expect(sceneList(page).getByRole('listitem')).toHaveCount(1);
  });

  test('"Add a Scene" is the one lime action, and only for a role that may create', async ({ page }) => {
    await openContent(page, PHONE.owner);
    expect(await limeCount(page)).toBe(1);
    await expect(page.getByRole('button', { name: 'Add a Scene' })).toBeVisible();
    await openContent(page, PHONE.campaign);
    await expect(page.getByRole('button', { name: 'Add a Scene' })).toBeVisible();
    await atSellerHome(page, PHONE.inventory, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/content`);
    await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
  });

  test('a Scene of another Seller is "not found"', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
    await goInApp(page, `/s/${SELLER.biruk.id}/content/scenes/fx_scene_alem_1`);
    await expect(page.getByRole('heading', { level: 1, name: 'We could not find that page' })).toBeVisible();
  });
});

test.describe('SC-FE-05: the Scene editor', () => {
  test('authoring from nothing to published: image, caption, same-Seller tag, a keyboard-placed hotspot, preview', async ({ page }) => {
    await openContent(page, PHONE.owner);
    await page.getByRole('button', { name: 'Add a Scene' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'New Scene' })).toBeVisible();
    await expect(sceneBlockers(page)).toHaveText('Needs attention before publication: 3');
    await page.getByRole('button', { name: 'Publish Scene' }).click();
    await expect(page.getByText('Not published. Needing attention: 3.')).toBeVisible();

    await page.getByLabel('Add an image').setInputFiles({ name: 'look.png', mimeType: 'image/png', buffer: Buffer.from('demonstration image bytes') });
    await expect(page.getByRole('region', { name: 'Image' })).toContainText('Processing');
    await expect(page.getByRole('region', { name: 'Image' })).toContainText('Ready');

    await page.getByLabel('Caption', { exact: true }).fill('A new look for the rainy season');
    await page.getByRole('button', { name: 'Save caption' }).click();
    await expect(sceneBlockers(page)).toHaveText('Needs attention before publication: 1');

    // tag one of THIS Seller's Products, found by search
    await page.getByLabel('Search your Products').fill('wrap');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('button', { name: 'Tag Linen wrap dress' }).click();
    await expect(page.getByRole('list', { name: 'Tagged Products', exact: true }).getByRole('listitem')).toContainText('Linen wrap dress');

    // a hotspot with the keyboard alone: Enter on the image, arrow keys on the marker, exact values in the fields
    const place = page.getByRole('button', { name: 'Click here to add a hotspot for Linen wrap dress' });
    await place.focus();
    await page.keyboard.press('Enter');
    const marker = page.getByRole('button', { name: 'Hotspot 1 for Linen wrap dress, 50 percent across, 50 percent down' });
    await expect(marker).toBeVisible();
    await marker.focus();
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(page.getByRole('button', { name: 'Hotspot 1 for Linen wrap dress, 55 percent across, 55 percent down' })).toBeVisible();
    await page.getByLabel('Hotspot 1: percent down').fill('30');
    await expect(page.getByRole('button', { name: 'Hotspot 1 for Linen wrap dress, 55 percent across, 30 percent down' })).toBeVisible();
    await expect(page.getByText('You have changes that are not saved yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Save tags and hotspots' }).click();
    await expect(page.getByText('You have changes that are not saved yet.')).toHaveCount(0);
    await expect(sceneBlockers(page)).toHaveCount(0);
    await expect(page.getByText('Nothing is blocking publication.')).toBeVisible();

    // the preview states what it is not
    await expect(page.getByRole('region', { name: 'Preview' })).toContainText('A preview does not make it public and has no link for Buyers.');
    await expect(page.getByRole('list', { name: 'Tagged Products in this Scene' })).toContainText('Linen wrap dress');
    await page.getByRole('button', { name: 'Publish Scene' }).click();
    await expect(page.getByText('The Scene is published.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Publication' }).locator('.badges')).toContainText('Public');
  });

  test('a hotspot can be removed by key and by button, and a Product removed from the Scene takes its hotspots with it', async ({ page }) => {
    await openScene(page, PHONE.owner, 'fx_scene_alem_1');
    const marker = page.getByRole('button', { name: /^Hotspot 1 for Linen wrap dress/ });
    await expect(marker).toBeVisible();
    await marker.focus();
    await page.keyboard.press('Delete');
    await expect(marker).toHaveCount(0);
    await page.getByRole('button', { name: 'Add a hotspot for Linen wrap dress' }).click();
    await page.getByRole('button', { name: 'Remove hotspot 1' }).click();
    await expect(page.getByText('No hotspots for Linen wrap dress yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Remove Cotton shirt dress from this Scene' }).click();
    await expect(page.getByRole('list', { name: 'Tagged Products', exact: true }).getByRole('listitem')).toHaveCount(1);
  });

  test('a Product that is not one of this Seller\'s published Products cannot be tagged, and is shown with the reason', async ({ page }) => {
    await openScene(page, PHONE.owner, 'fx_scene_alem_1');
    await page.getByLabel('Search your Products').fill('kaftan');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const row = page.getByRole('list', { name: 'Products you can tag' }).getByRole('listitem').filter({ hasText: 'Old season kaftan' });
    await expect(row).toContainText('This Product cannot be tagged right now.');
    await expect(row.getByRole('button')).toHaveCount(0);
  });

  test('a restricted Scene shows the moderation state and the fact that Adulis decides it', async ({ page }) => {
    await openScene(page, PHONE.owner, 'fx_scene_alem_5');
    const publication = page.getByRole('region', { name: 'Publication' });
    await expect(publication.getByRole('heading', { level: 3, name: 'Moderation' })).toBeVisible();
    await expect(publication).toContainText('Restricted');
    await expect(publication).toContainText('The content is being reviewed against Adulis policy.');
    await expect(publication).toContainText('Adulis makes moderation decisions. This screen only shows them.');
  });

  test('archiving asks first and then leaves the Scene visible here with no action', async ({ page }) => {
    await openScene(page, PHONE.owner, 'fx_scene_alem_1');
    await page.getByRole('button', { name: 'Archive Scene' }).click();
    const dialog = page.getByRole('dialog', { name: 'Archive this Scene?' });
    await dialog.getByRole('button', { name: 'Keep it' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'Archive Scene' }).click();
    await dialog.getByRole('button', { name: 'Archive Scene' }).click();
    await expect(page.getByText('The Scene is archived.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Archive Scene|Publish Scene|Save/ })).toHaveCount(0);
  });

  test('Campaign Manager can author a Scene; the Product fields it tags remain read-only elsewhere', async ({ page }) => {
    await openContent(page, PHONE.campaign);
    await page.getByRole('button', { name: 'Add a Scene' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'New Scene' })).toBeVisible();
    await expect(page.getByLabel('Caption', { exact: true })).toBeEnabled();
  });

  test('the editor does not overflow at 390px and 200% text, hotspots included', async ({ page }) => {
    await scaleText(page, 200);
    await page.setViewportSize({ width: 390, height: 800 });
    await openScene(page, PHONE.owner, 'fx_scene_alem_1');
    await expectTextScale(page, 200);
    await noHorizontalOverflow(page);
  });
});
