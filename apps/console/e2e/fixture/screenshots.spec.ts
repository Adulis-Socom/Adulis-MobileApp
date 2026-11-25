import { test } from '@playwright/test';
import { SCENES } from './scenes';

/**
 * Screenshot artifacts of every representative state, desktop and phone, uploaded by CI (screenshots/). They are
 * inspected by eye before any visual claim is made; the capture itself asserts nothing beyond the scene's own checks.
 */
const SIZES = [
  { label: 'desktop-1440', width: 1440, height: 900 },
  { label: 'phone-390', width: 390, height: 800 },
] as const;

for (const size of SIZES) {
  for (const scene of SCENES) {
    test(`shot: ${scene.name} ${size.label}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await scene.setup(page);
      await page.waitForTimeout(250); // let focus, fonts and the strip height settle
      await page.screenshot({ path: `screenshots/${scene.name}.${size.label}.png`, fullPage: !scene.dialog });
    });
  }
}

test('shot: 200% text at phone width, readiness hub', async ({ page }) => {
  const { atSellerHome, PHONE, scaleText, SELLER } = await import('./helpers');
  await scaleText(page, 200);
  await page.setViewportSize({ width: 390, height: 800 });
  await atSellerHome(page, PHONE.owner, SELLER.biruk.name);
  await page.screenshot({ path: 'screenshots/readiness-incomplete.phone-390-text200.png', fullPage: true });
});

test('shot: 320px at 150% text, operating Home', async ({ page }) => {
  const { atSellerHome, PHONE, scaleText, SELLER } = await import('./helpers');
  await scaleText(page, 150);
  await page.setViewportSize({ width: 320, height: 700 });
  await atSellerHome(page, PHONE.owner, SELLER.alem.name);
  await page.screenshot({ path: 'screenshots/dashboard-operational.phone-320-text150.png', fullPage: true });
});
