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
    name: 'unavailable-inbox',
    setup: async (p) => {
      await atSellerHome(p, PHONE.owner, SELLER.alem.name);
      await goInApp(p, `/s/${SELLER.alem.id}/inbox`);
      await expect(p.getByText('Inbox arrives in a later release')).toBeVisible();
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
      await p.getByLabel('Photo', { exact: true }).setInputFiles({ name: 'rain.png', mimeType: 'image/png', buffer: Buffer.from('demonstration photo bytes') });
      await p.getByLabel('Text', { exact: true }).fill('Fresh stock');
      await p.getByRole('radio', { name: 'A Product' }).check();
      await p.getByLabel('Product', { exact: true }).selectOption({ label: 'Canvas backpack' });
      await p.getByRole('button', { name: 'Preview Story' }).click();
      await expect(p.getByText('This Story will link to the Product: Canvas backpack.')).toBeVisible();
    },
  },
];

export { CODE };
