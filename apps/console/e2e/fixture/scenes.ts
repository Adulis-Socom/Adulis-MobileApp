import { expect, type Page } from '@playwright/test';
import { atSellerHome, CODE, goInApp, PHONE, SELLER, signedInChooser, signInHere } from './helpers';

/**
 * Representative states, defined once and used twice: the axe pass (a11y.spec.ts) and the screenshot capture
 * (screenshots.spec.ts), so what is checked for accessibility is exactly what is looked at. `dialog` scenes have a
 * modal open, which makes the rest of the page inert, so they skip the landmark and heading assertions.
 */
export interface Scene {
  readonly name: string;
  readonly dialog?: boolean;
  readonly setup: (page: Page) => Promise<void>;
}

async function newAccountThroughDeclarations(page: Page): Promise<void> {
  await page.goto('/sign-in');
  await signInHere(page, PHONE.fresh);
  await expect(page.getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible();
}

async function newAccountSignedIn(page: Page): Promise<void> {
  await newAccountThroughDeclarations(page);
  await page.getByRole('checkbox', { name: /18 years old or older/ }).check();
  await page.getByRole('checkbox', { name: /accept the current Adulis terms/ }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
}

async function statesAccountAt(page: Page, name: string): Promise<void> {
  await signedInChooser(page, PHONE.states);
  await page.getByRole('link', { name }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** A valid 1x1 PNG, so a chosen file renders as a real image in a screenshot. */
const REAL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

export const SCENES: readonly Scene[] = [
  { name: 'signin', setup: async (p) => { await p.goto('/sign-in'); await expect(p.getByRole('heading', { level: 1 })).toBeVisible(); } },
  {
    name: 'signin-error',
    setup: async (p) => {
      await p.goto('/sign-in');
      await p.getByRole('button', { name: 'Send code' }).click();
      await expect(p.getByRole('alert').first()).toBeVisible();
    },
  },
  {
    name: 'otp-verify',
    setup: async (p) => {
      await p.goto('/sign-in');
      await p.getByLabel('Mobile phone number').fill(PHONE.owner);
      await p.getByRole('button', { name: 'Send code' }).click();
      await expect(p.getByRole('heading', { level: 1, name: 'Enter your code' })).toBeVisible();
    },
  },
  {
    name: 'otp-incorrect',
    setup: async (p) => {
      await p.goto('/sign-in');
      await p.getByLabel('Mobile phone number').fill(PHONE.owner);
      await p.getByRole('button', { name: 'Send code' }).click();
      await p.getByLabel('One-time code').fill('111111');
      await p.getByRole('button', { name: 'Verify code' }).click();
      await expect(p.getByText('That code is not right. Check it and try again.').first()).toBeVisible();
    },
  },
  { name: 'recovery', setup: async (p) => { await p.goto('/sign-in/recovery'); await expect(p.getByRole('heading', { level: 1, name: 'Recover your account' })).toBeVisible(); } },
  { name: 'declarations', setup: newAccountThroughDeclarations },
  { name: 'chooser-empty', setup: newAccountSignedIn },
  {
    name: 'become-seller',
    setup: async (p) => {
      await newAccountSignedIn(p);
      await p.getByRole('link', { name: 'Become a Seller' }).click();
      await expect(p.getByLabel('Store name')).toBeVisible();
    },
  },
  { name: 'chooser', setup: async (p) => { await signedInChooser(p, PHONE.owner); } },
  {
    name: 'admission-needs-evidence',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.biruk.name);
      await goInApp(p, `/s/${SELLER.biruk.id}/admission`);
      await expect(p.getByRole('heading', { name: 'More is needed' })).toBeVisible();
    },
  },
  {
    name: 'admission-challenge',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.biruk.name);
      await goInApp(p, `/s/${SELLER.biruk.id}/admission`);
      await p.getByLabel('Your account handle').fill('biruk.shoes');
      await p.getByRole('button', { name: 'Send me a verification code' }).click();
      await expect(p.getByRole('heading', { name: 'Send the code to Adulis' })).toBeVisible();
    },
  },
  {
    name: 'admission-refused',
    setup: async (p) => {
      await statesAccountAt(p, SELLER.fana.name);
      await goInApp(p, `/s/${SELLER.fana.id}/admission`);
      await expect(p.getByRole('heading', { name: 'Not admitted under the current policy' })).toBeVisible();
    },
  },
  { name: 'readiness-incomplete', setup: async (p) => { await atSellerHome(p, PHONE.owner, SELLER.biruk.name); } },
  { name: 'readiness-partial', setup: async (p) => { await atSellerHome(p, PHONE.owner, SELLER.chaltu.name); } },
  {
    name: 'readiness-complete',
    setup: async (p) => {
      await statesAccountAt(p, SELLER.dawit.name);
      await expect(p.getByRole('heading', { name: 'Every requirement is met' })).toBeVisible();
    },
  },
  {
    name: 'readiness-company-pending',
    setup: async (p) => {
      await statesAccountAt(p, SELLER.eden.name);
      await expect(p.getByRole('heading', { name: 'Not ready to publish yet' })).toBeVisible();
    },
  },
  {
    name: 'readiness-permission-denied',
    setup: async (p) => { await atSellerHome(p, PHONE.invBiruk, SELLER.biruk.name); },
  },
  {
    name: 'readiness-unavailable',
    setup: async (p) => {
      await statesAccountAt(p, SELLER.hana.name);
      await expect(p.getByRole('alert').filter({ hasText: 'We could not load your readiness list' })).toBeVisible();
    },
  },
  { name: 'dashboard-operational', setup: async (p) => { await atSellerHome(p, PHONE.owner, SELLER.alem.name); } },
  { name: 'dashboard-sales-support', setup: async (p) => { await atSellerHome(p, PHONE.sales, SELLER.alem.name); } },
  { name: 'dashboard-analyst', setup: async (p) => { await atSellerHome(p, PHONE.analyst, SELLER.alem.name); } },
  {
    name: 'dashboard-restricted-seller',
    setup: async (p) => {
      await statesAccountAt(p, SELLER.gelila.name);
      await expect(p.getByRole('heading', { name: 'This Seller is restricted' })).toBeVisible();
    },
  },
  {
    name: 'dashboard-unpublished',
    setup: async (p) => {
      await statesAccountAt(p, SELLER.iman.name);
      await expect(p.getByText('Buyers cannot see this store while it is unpublished.')).toBeVisible();
    },
  },
  {
    name: 'notifications',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/notifications`);
      await expect(p.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
    },
  },
  {
    name: 'unavailable-insights',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      // Insights itself is built (SC-FE-10); its sub-pages still arrive later.
      await goInApp(p, `/s/${SELLER.alem.id}/insights/reviews`);
      await expect(p.getByText('Insights arrives in a later release')).toBeVisible();
    },
  },
  {
    name: 'no-permission',
    setup: async (p) => {
      await atSellerHome(p, PHONE.sales, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/products`);
      await expect(p.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
    },
  },
  {
    name: 'no-entitlement',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.biruk.name);
      await goInApp(p, `/s/${SELLER.biruk.id}/insights`);
      await expect(p.getByRole('heading', { level: 1, name: 'Not included for this Seller' })).toBeVisible();
    },
  },
  {
    name: 'more',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.biruk.name);
      await goInApp(p, `/s/${SELLER.biruk.id}/more`);
      await expect(p.getByRole('heading', { level: 1, name: 'More' })).toBeVisible();
    },
  },
  {
    name: 'not-found',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/no-such-page`);
      await expect(p.getByRole('heading', { level: 1, name: 'We could not find that page' })).toBeVisible();
    },
  },
  {
    name: 'session-expired',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await p.evaluate(() => window.__ADULIS_FIXTURE__?.revokeSession());
      await goInApp(p, `/s/${SELLER.alem.id}/more`);
      await expect(p.getByRole('heading', { name: 'Your session ended' })).toBeVisible();
    },
  },
  {
    name: 'dialog-switch-seller',
    dialog: true,
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await p.getByRole('button', { name: 'Switch Seller' }).click();
      await expect(p.getByRole('dialog', { name: 'Switch Seller' })).toBeVisible();
    },
  },
  {
    name: 'dialog-help',
    dialog: true,
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await p.getByRole('button', { name: 'Help' }).click();
      await expect(p.getByRole('dialog', { name: 'Help' })).toBeVisible();
    },
  },
  {
    name: 'dialog-account',
    dialog: true,
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await p.getByRole('button', { name: 'Account' }).click();
      await expect(p.getByRole('dialog', { name: 'Account' })).toBeVisible();
    },
  },
  {
    name: 'products-list',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/products`);
      await expect(p.getByRole('heading', { level: 1, name: 'Products and Inventory' })).toBeVisible();
      await expect(p.getByRole('link', { name: /Canvas backpack/ })).toBeVisible();
    },
  },
  {
    name: 'product-editor-published',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/products/fx_prod_alem_1`);
      await expect(p.getByRole('heading', { level: 1, name: 'Linen wrap dress' })).toBeVisible();
      await expect(p.getByRole('heading', { level: 2, name: 'Publication' })).toBeVisible();
    },
  },
  {
    name: 'product-editor-draft-blockers',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/products/fx_prod_alem_6`);
      await expect(p.getByRole('heading', { level: 1, name: 'Linen shirt' })).toBeVisible();
      await expect(p.getByRole('heading', { level: 3, name: 'Needs attention before publication: 3' })).toBeVisible();
    },
  },
  {
    name: 'product-editor-category-gap',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/products/fx_prod_alem_4`);
      await expect(p.getByRole('heading', { level: 1, name: 'Canvas backpack' })).toBeVisible();
      await expect(p.getByText('The attributes of this category have not been defined yet.').first()).toBeVisible();
    },
  },
  {
    name: 'dialog-stock-update',
    dialog: true,
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/products/fx_prod_alem_1`);
      await expect(p.getByRole('heading', { level: 1, name: 'Linen wrap dress' })).toBeVisible();
      await p.getByRole('button', { name: 'Update stock' }).first().click();
      await expect(p.getByRole('dialog', { name: 'Update stock for Black / S' })).toBeVisible();
    },
  },
  {
    name: 'scenes-list-private',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/content`);
      await expect(p.getByRole('heading', { level: 1, name: 'Scenes' })).toBeVisible();
      await p.getByRole('button', { name: 'Private', exact: true }).click();
      await expect(p.getByText('All tagged Products are currently out of stock.')).toBeVisible();
    },
  },
  {
    name: 'scene-editor-public',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/content/scenes/fx_scene_alem_1`);
      await expect(p.getByRole('heading', { level: 1, name: 'Linen wrap dress styled for the rainy season' })).toBeVisible();
      await expect(p.getByRole('button', { name: /^Hotspot 1 for Linen wrap dress/ })).toBeVisible();
    },
  },
  {
    name: 'scene-editor-private',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/content/scenes/fx_scene_alem_2`);
      await expect(p.getByRole('heading', { level: 1, name: 'The silk slip dress, evening edit' })).toBeVisible();
      await expect(p.getByText('You do not need to publish it again.')).toBeVisible();
    },
  },
  {
    name: 'scene-editor-draft-blockers',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/content/scenes/fx_scene_alem_3`);
      await expect(p.getByRole('heading', { level: 1, name: 'New Scene' })).toBeVisible();
      await expect(p.getByRole('heading', { level: 3, name: 'Needs attention before publication: 3' })).toBeVisible();
    },
  },
  {
    name: 'scene-editor-restricted',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/content/scenes/fx_scene_alem_5`);
      await expect(p.getByRole('heading', { level: 3, name: 'Moderation' })).toBeVisible();
    },
  },
  {
    name: 'stories-list',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/content/stories`);
      await expect(p.getByRole('heading', { level: 1, name: 'Seller Stories' })).toBeVisible();
      await expect(p.getByText('Held back for review')).toBeVisible();
    },
  },
  {
    name: 'story-compose',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/content/stories`);
      await p.getByRole('button', { name: 'Add a Story' }).click();
      await expect(p.getByRole('heading', { level: 2, name: 'New Story' })).toBeVisible();
    },
  },
  {
    name: 'story-preview',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/content/stories`);
      await p.getByRole('button', { name: 'Add a Story' }).click();
      await p.getByLabel('Photo', { exact: true }).setInputFiles({ name: 'rain.png', mimeType: 'image/png', buffer: REAL_PNG });
      await p.getByLabel('Text', { exact: true }).fill('Fresh stock');
      await p.getByRole('radio', { name: 'A Product' }).check();
      await p.getByLabel('Product', { exact: true }).selectOption({ label: 'Canvas backpack' });
      await p.getByRole('button', { name: 'Preview Story' }).click();
      await expect(p.getByText('This Story will link to the Product: Canvas backpack.')).toBeVisible();
    },
  },
  {
    name: 'store-profile',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/store`);
      await expect(p.getByRole('heading', { level: 1, name: 'Store', exact: true })).toBeVisible();
    },
  },
  {
    name: 'store-location',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/store/location`);
      await expect(p.getByRole('heading', { level: 1, name: 'Store location', exact: true })).toBeVisible();
      await expect(p.locator('dl.facts')).toContainText('Demonstration place 1');
    },
  },
  {
    name: 'store-coverage',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/store/coverage`);
      await expect(p.getByRole('heading', { level: 1, name: 'Service coverage', exact: true })).toBeVisible();
    },
  },
  {
    name: 'store-hours',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/store/hours`);
      await expect(p.getByRole('heading', { level: 1, name: 'Opening hours', exact: true })).toBeVisible();
      await expect(p.getByLabel('Monday, hours 1: opens at')).toHaveValue('08:30');
    },
  },
  {
    name: 'store-fulfilment',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/store/fulfilment`);
      await expect(p.getByRole('heading', { level: 1, name: 'Fulfilment', exact: true })).toBeVisible();
    },
  },
  {
    name: 'store-couriers',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/store/couriers`);
      await expect(p.getByRole('heading', { level: 1, name: 'Couriers', exact: true })).toBeVisible();
      await expect(p.getByRole('list', { name: 'Courier relationships' }).getByRole('listitem')).toHaveCount(3);
    },
  },
  {
    name: 'order-simulation',
    setup: async (p) => {
      await p.goto('/internal/order-simulation');
      await expect(p.getByRole('heading', { level: 1, name: 'Order experience demonstration' })).toBeVisible();
      await p.getByRole('button', { name: 'Open fx_sim_ord_001' }).click();
      await expect(p.getByRole('button', { name: 'Start preparing' })).toBeVisible();
    },
  },
  {
    name: 'inbox-list',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/inbox`);
      await expect(p.getByRole('list', { name: 'Conversations', exact: true }).getByRole('listitem')).toHaveCount(4);
    },
  },
  {
    name: 'inbox-thread-waiting',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/inbox/fx_conv_alem_2`);
      await expect(p.getByRole('heading', { level: 1, name: 'Demonstration buyer B' })).toBeVisible();
      await expect(p.getByText('A team member is needed. Automated replies cannot answer this conversation.')).toBeVisible();
    },
  },
  {
    name: 'inbox-thread-scene',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/inbox/fx_conv_alem_1`);
      await expect(p.getByRole('heading', { level: 1, name: 'Demonstration buyer A' })).toBeVisible();
      await p.getByLabel('Scene (optional)').selectOption({ label: 'Linen wrap dress styled for the rainy season' });
    },
  },
  {
    name: 'trust-reviews',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/trust`);
      await expect(p.getByRole('region', { name: 'Trust level' })).toContainText('Established');
      await expect(p.getByRole('list', { name: 'Product review list' }).getByRole('listitem')).toHaveCount(3);
    },
  },
  {
    name: 'trust-new-no-reviews',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.biruk.name);
      await goInApp(p, `/s/${SELLER.biruk.id}/trust`);
      await expect(p.getByText('There are no Product reviews yet.')).toBeVisible();
    },
  },
  {
    name: 'dialog-courier-revoke',
    dialog: true,
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/store/couriers`);
      await p.getByRole('button', { name: 'Revoke Meseret (demonstration)' }).click();
      await expect(p.getByRole('dialog', { name: 'Revoke this Courier?' })).toBeVisible();
    },
  },
  {
    name: 'store-company',
    setup: async (p) => {
      await atSellerHome(p, PHONE.states, SELLER.eden.name);
      await goInApp(p, `/s/${SELLER.eden.id}/store/company`);
      await expect(p.getByRole('heading', { level: 1, name: 'Company details', exact: true })).toBeVisible();
      await expect(p.getByText('does not mean Adulis has verified the company')).toBeVisible();
    },
  },
  {
    name: 'store-location-preview',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.biruk.name);
      await goInApp(p, `/s/${SELLER.biruk.id}/store/location`);
      await p.getByLabel('Search for your shop').fill('Piassa');
      await p.getByRole('button', { name: 'Search places' }).click();
      await p.getByRole('button', { name: 'Preview Demonstration place 2, Piassa, Addis Ababa' }).click();
      await expect(p.getByRole('img', { name: /Demonstration map preview/ })).toBeVisible();
    },
  },
  {
    name: 'story-compose-photo',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/content/stories`);
      await p.getByRole('button', { name: 'Add a Story' }).click();
      await p.getByLabel('Photo', { exact: true }).setInputFiles({ name: 'look.png', mimeType: 'image/png', buffer: REAL_PNG });
      await expect(p.getByRole('img', { name: 'Photo for the Story: look.png' })).toBeVisible();
    },
  },
  {
    name: 'product-editor-media-tiktok',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/products/fx_prod_alem_1`);
      await expect(p.getByRole('heading', { level: 2, name: 'Product images' })).toBeVisible();
      await p.getByRole('heading', { level: 2, name: 'TikTok video' }).scrollIntoViewIfNeeded();
      await expect(p.getByRole('heading', { level: 2, name: 'TikTok video' })).toBeVisible();
    },
  },
  // ---- Batch 02D visual closure: states nobody had looked at, and the new SC-FE-07-09-CLOSE / SC-FE-08 screens ----
  {
    name: 'closure-unsaved-dialog',
    dialog: true,
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/inbox/fx_conv_alem_4`);
      await p.getByLabel('Your message').fill('Not sent yet.');
      await p.getByRole('link', { name: 'Back to the Inbox' }).click();
      await expect(p.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
    },
  },
  {
    name: 'closure-product-multiple-images',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.biruk.name);
      await goInApp(p, `/s/${SELLER.biruk.id}/products`);
      await p.getByRole('button', { name: 'Add a Product' }).click();
      await expect(p.getByRole('heading', { level: 1, name: 'New Product' })).toBeVisible();
      const list = p.getByRole('list', { name: 'Product images', exact: true });
      for (const [n, name] of ['front.png', 'back.png', 'detail.png'].entries()) {
        await p.getByLabel('Add an image').setInputFiles({ name, mimeType: 'image/png', buffer: REAL_PNG });
        await expect(list.getByRole('listitem')).toHaveCount(n + 1);
      }
    },
  },
  {
    name: 'closure-tiktok-linked',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/products/fx_prod_alem_1`);
      const region = p.getByRole('region', { name: 'TikTok video' });
      await region.getByLabel('TikTok video link').fill('https://www.tiktok.com/@alem.textiles/video/456');
      await region.getByRole('button', { name: 'Link video' }).click();
      await expect(region.getByText('https://www.tiktok.com/@alem.textiles/video/456')).toBeVisible();
    },
  },
  {
    name: 'suspended-trust-read-only',
    setup: async (p) => {
      await statesAccountAt(p, SELLER.gelila.name);
      await goInApp(p, `/s/${SELLER.gelila.id}/trust`);
      await expect(p.getByText('Fresh and fragrant.')).toBeVisible();
    },
  },
  {
    name: 'inbox-thread-provenance',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/inbox/fx_conv_alem_3`);
      await expect(p.getByText('From the Scene The old kaftan, styled two ways, which can no longer be shown')).toHaveCount(2);
    },
  },
  {
    name: 'automation-overview',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/inbox/automation`);
      await expect(p.getByRole('heading', { level: 2, name: 'Questions it can answer' })).toBeVisible();
    },
  },
  {
    name: 'automation-knowledge',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/inbox/automation/knowledge`);
      await expect(p.getByRole('heading', { level: 2, name: 'Store knowledge' })).toBeVisible();
    },
  },
  {
    name: 'automation-test-result',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/inbox/automation/test`);
      await p.getByLabel('Buyer question').fill('Is this still available?');
      await p.getByLabel('Product the question is about').selectOption({ label: 'Linen wrap dress' });
      await p.getByRole('button', { name: 'Run test' }).click();
      await expect(p.getByRole('heading', { level: 2, name: 'Test result' })).toBeVisible();
    },
  },
  // ---- SC-FE-10 nonfinancial Insights and Plan ----
  {
    name: 'insights-owner',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/insights`);
      await expect(p.getByRole('region', { name: 'Not measured in this release' })).toBeVisible();
    },
  },
  {
    name: 'insights-stale',
    setup: async (p) => {
      await statesAccountAt(p, SELLER.iman.name);
      await goInApp(p, `/s/${SELLER.iman.id}/insights`);
      await expect(p.getByText('These figures are older than usual.')).toBeVisible();
    },
  },
  {
    name: 'settings-plan',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.biruk.name);
      await goInApp(p, `/s/${SELLER.biruk.id}/settings/plan`);
      await expect(p.getByRole('region', { name: 'What this Seller includes' })).toBeVisible();
    },
  },
  // ---- SC-FE-11 team, step-up, closure and the Account's own pages ----
  {
    name: 'settings-team',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/settings/team`);
      await expect(p.getByRole('list', { name: 'Members' })).toBeVisible();
    },
  },
  {
    name: 'settings-team-stepup',
    dialog: true,
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/settings/team`);
      await p.getByLabel('New Owner').selectOption({ label: 'Abel (demonstration)' });
      await p.getByRole('button', { name: 'Transfer ownership' }).click();
      await expect(p.getByRole('dialog', { name: 'Confirm it is you' }).getByText('Enter the code to transfer ownership of Alem Textiles.')).toBeVisible();
    },
  },
  {
    name: 'settings-closure',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/settings/closure`);
      await expect(p.getByRole('heading', { level: 2, name: 'What closing does' })).toBeVisible();
    },
  },
  {
    name: 'account-security',
    setup: async (p) => {
      await signedInChooser(p, PHONE.owner);
      await p.getByRole('link', { name: 'Your account and security' }).click();
      await expect(p.getByRole('list', { name: 'Where you are signed in' })).toBeVisible();
    },
  },
  {
    name: 'account-privacy',
    setup: async (p) => {
      await signedInChooser(p, PHONE.owner);
      await p.getByRole('link', { name: 'Your account and security' }).click();
      await p.getByRole('navigation', { name: 'Account sections' }).getByRole('link', { name: 'Privacy and deletion' }).click();
      await expect(p.getByRole('heading', { level: 2, name: 'Delete your account' })).toBeVisible();
    },
  },
];

export { CODE };
