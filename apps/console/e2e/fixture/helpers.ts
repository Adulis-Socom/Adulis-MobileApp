import { expect, type Page } from '@playwright/test';

/** Demonstration accounts of the fixture world (src/fixtures/world.ts PERSONAS). Synthetic; not real numbers. */
export const PHONE = {
  owner: '+251900000001',
  states: '+251900000002',
  fresh: '+251900000003',
  admin: '+251900000011',
  sales: '+251900000012',
  inventory: '+251900000013',
  analyst: '+251900000014',
  campaign: '+251900000015',
  multirole: '+251900000016',
  invBiruk: '+251900000017',
  mixed: '+251900000018',
} as const;
export const CODE = '246810';

export const SELLER = {
  alem: { id: 'fx_seller_alem', name: 'Alem Textiles' },
  biruk: { id: 'fx_seller_biruk', name: 'Biruk Shoes' },
  chaltu: { id: 'fx_seller_chaltu', name: 'Chaltu Crafts' },
  kidist: { id: 'fx_seller_kidist', name: 'Kidist Cosmetics' },
  lemlem: { id: 'fx_seller_lemlem', name: 'Lemlem Linen' },
  dawit: { id: 'fx_seller_dawit', name: 'Dawit Leather' },
  eden: { id: 'fx_seller_eden', name: 'Eden Foods PLC' },
  fana: { id: 'fx_seller_fana', name: 'Fana Fashion' },
  gelila: { id: 'fx_seller_gelila', name: 'Gelila Spices' },
  hana: { id: 'fx_seller_hana', name: 'Hana Home Goods' },
  iman: { id: 'fx_seller_iman', name: 'Iman Jewellery' },
} as const;

export async function signIn(page: Page, phone: string, url = '/sign-in'): Promise<void> {
  await page.goto(url);
  await page.getByLabel('Mobile phone number').fill(phone);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('One-time code').fill(CODE);
  await page.getByRole('button', { name: 'Verify code' }).click();
}

/** Sign in on the phone screen the app is ALREADY showing: no reload, so the in-memory fixture world survives. */
export async function signInHere(page: Page, phone: string): Promise<void> {
  await page.getByLabel('Mobile phone number').fill(phone);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('One-time code').fill(CODE);
  await page.getByRole('button', { name: 'Verify code' }).click();
}

/** Sign in and arrive on the chooser (accounts with one or more Sellers). */
export async function signedInChooser(page: Page, phone: string): Promise<void> {
  await signIn(page, phone);
  await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
}

export async function openSeller(page: Page, name: string): Promise<void> {
  await page.getByRole('link', { name }).first().click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** Sign in, open one Seller, wait for its Home to settle (the readiness hub or the brief has rendered). */
export async function atSellerHome(page: Page, phone: string, name: string): Promise<void> {
  await signedInChooser(page, phone);
  await openSeller(page, name);
  // A draft Seller shows BOTH the readiness hub and the alerts, so wait for the first of them, not for exactly one.
  await expect(page.getByRole('heading', { level: 2, name: 'Alerts' }).or(page.getByRole('heading', { level: 2, name: 'Publication readiness' })).first()).toBeVisible();
}

/** Navigate inside the running app (client-side), as Back, Forward or a link would. Full reloads drop the in-memory fixture session by design. */
export async function goInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

export async function noHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const client = document.documentElement.clientWidth;
    // name the offenders, so a failure says which element is wider than the window
    const culprits = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => el.getBoundingClientRect().right > client + 1 && getComputedStyle(el).position !== 'fixed')
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(el.getBoundingClientRect().right)} w=${Math.round(el.getBoundingClientRect().width)}`);
    return { scroll: document.documentElement.scrollWidth, client, culprits };
  });
  expect(overflow.scroll, `horizontal overflow: scrollWidth ${overflow.scroll} > clientWidth ${overflow.client}; wider than the window: ${overflow.culprits.join(' | ')}`).toBeLessThanOrEqual(overflow.client + 1);
}

export async function limeCount(page: Page): Promise<number> {
  return page.locator('.btn-highlight').count();
}

/** Apply a text-scale factor before any script of the page runs (150 or 200), approximating a user text-size setting. */
export async function scaleText(page: Page, percent: number): Promise<void> {
  await page.addInitScript((pct) => {
    // An init script runs before <html> exists, so the style can only be attached once the document is there.
    const attach = () => {
      const style = document.createElement('style');
      style.textContent = `html { font-size: ${pct}% !important; }`;
      document.documentElement.appendChild(style);
    };
    if (document.documentElement) attach();
    else document.addEventListener('readystatechange', attach, { once: true });
  }, percent);
}

/** Prove the scale really applied: a helper that silently did nothing would make every scaled test a 100% test. */
export async function expectTextScale(page: Page, percent: number): Promise<void> {
  const px = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(px, `root font size at ${percent}%`).toBeCloseTo((16 * percent) / 100, 1);
}
