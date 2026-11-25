import { expect, test, type Page } from '@playwright/test';
import { SCENES } from './scenes';

/**
 * Screenshot artifacts of every representative state, desktop and phone, uploaded by CI (screenshots/). They are
 * inspected by eye before any visual claim is made; the capture itself asserts nothing beyond the scene's own checks.
 */
/** A capture shows a SETTLED state: no skeleton left, scrolled to the top (sticky bars would otherwise land mid-image). */
async function settle(page: Page): Promise<void> {
  await expect(page.locator('.skeleton')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
}

const SIZES = [
  { label: 'desktop-1440', width: 1440, height: 900 },
  { label: 'phone-390', width: 390, height: 800 },
] as const;

for (const size of SIZES) {
  for (const scene of SCENES) {
    test(`shot: ${scene.name} ${size.label}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await scene.setup(page);
      await settle(page);
      await page.screenshot({ path: `screenshots/${scene.name}.${size.label}.png`, fullPage: !scene.dialog });
    });
  }
}

test('shot: 200% text at phone width, readiness hub', async ({ page }) => {
  const { atSellerHome, expectTextScale, PHONE, scaleText, SELLER } = await import('./helpers');
  await scaleText(page, 200);
  await page.setViewportSize({ width: 390, height: 800 });
  await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
  await expectTextScale(page, 200);
  await settle(page);
  await page.screenshot({ path: 'screenshots/readiness-incomplete.phone-390-text200.png', fullPage: true });
});

test('shot: 320px at 150% text, operating Home', async ({ page }) => {
  const { atSellerHome, expectTextScale, PHONE, scaleText, SELLER } = await import('./helpers');
  await scaleText(page, 150);
  await page.setViewportSize({ width: 320, height: 700 });
  await atSellerHome(page, PHONE.owner, SELLER.alem.name);
  await expectTextScale(page, 150);
  await settle(page);
  await page.screenshot({ path: 'screenshots/dashboard-operational.phone-320-text150.png', fullPage: true });
});
