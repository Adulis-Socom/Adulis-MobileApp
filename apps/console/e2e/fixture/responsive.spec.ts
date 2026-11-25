import { expect, test } from '@playwright/test';
import { goInApp, noHorizontalOverflow, PHONE, scaleText, SELLER, signedInChooser } from './helpers';

const WIDTHS = [320, 360, 390, 768, 1024, 1440] as const;
const SCALES = [100, 150, 200] as const;

/**
 * Every required width at 100%, 150% and 200% text: no horizontal overflow on any screen of the journey, and every
 * control keeps a 44px target at touch widths. (Text scaling is applied as a root font-size, which exercises the same
 * rem-based layout a user text-size setting does.)
 */
for (const width of WIDTHS) {
  for (const scale of SCALES) {
    test(`${width}px at ${scale}% text: sign-in, chooser, readiness hub, operating Home and More fit`, async ({ page }) => {
      await scaleText(page, scale);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/sign-in');
      await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your Seller Console' })).toBeVisible();
      await noHorizontalOverflow(page);

      await signedInChooser(page, PHONE.owner);
      await noHorizontalOverflow(page);

      await page.getByRole('link', { name: SELLER.biruk.name }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Publication readiness' })).toBeVisible();
      await noHorizontalOverflow(page);

      await goInApp(page, `/s/${SELLER.alem.id}`);
      await expect(page.getByRole('heading', { level: 2, name: 'Alerts' })).toBeVisible();
      await noHorizontalOverflow(page);

      await goInApp(page, `/s/${SELLER.alem.id}/more`);
      await expect(page.getByRole('heading', { level: 1, name: 'More' })).toBeVisible();
      await noHorizontalOverflow(page);
    });
  }
}

test('touch targets are at least 44px at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signedInChooser(page, PHONE.owner);
  await page.getByRole('link', { name: SELLER.biruk.name }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Publication readiness' })).toBeVisible();
  const small = await page.evaluate(() => {
    const found: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('.btn, .nav-link, .tab, .icon-btn, .ledger-link, .text-input, .choice')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.width < 43.5 || box.height < 43.5) found.push(`${el.className} ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
    return found;
  });
  expect(small).toEqual([]);
});

test('long translated-length text wraps instead of overflowing (no fixed heights on text)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await scaleText(page, 150);
  await signedInChooser(page, PHONE.states);
  await page.getByRole('link', { name: SELLER.eden.name }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Publication readiness' })).toBeVisible();
  // simulate the 30-50% growth of Amharic by lengthening every text node's container
  await page.addStyleTag({ content: '.ledger-title, .ledger-meta, .state-body, .lead, label, .hint { letter-spacing: 0.08em; word-spacing: 0.25em; }' });
  await noHorizontalOverflow(page);
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('main *')].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'hidden').length,
  );
  expect(clipped).toBe(0);
});
