import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { atSellerHome, noHorizontalOverflow, PHONE, SELLER, signIn } from './helpers';
import { SCENES } from './scenes';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'phone', width: 390, height: 800 },
] as const;

/** axe over every representative state at desktop and phone width, plus the structural checks axe cannot make. */
for (const viewport of VIEWPORTS) {
  for (const scene of SCENES) {
    test(`axe: ${scene.name} (${viewport.label})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await scene.setup(page);
      const describe = (vs: { id: string; impact?: string | null; nodes: { target: unknown[] }[] }[]) => vs.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
      // Top of the page: everything except target-size, which counts a control under the STICKY bottom bar as overlapped
      // although it is only where the page happens to be scrolled.
      const top = await new AxeBuilder({ page }).withTags(TAGS).disableRules(['target-size']).analyze();
      expect(describe(top.violations), `axe violations on ${scene.name} (top)`).toEqual([]);
      // End of the page, where the bar sits after the content and covers nothing: the full rule set, target size included.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(describe(results.violations), `axe violations on ${scene.name} (end of page)`).toEqual([]);
      // heading order is a best-practice rule outside the WCAG tag sets: a skipped level would otherwise pass
      const order = await new AxeBuilder({ page }).withRules(['heading-order']).analyze();
      expect(order.violations.map((v) => v.nodes.map((n) => n.target.join(' ')).join(' | ')), `heading order on ${scene.name}`).toEqual([]);
      await noHorizontalOverflow(page);
      if (!scene.dialog) {
        await expect(page.getByRole('heading', { level: 1 }), 'exactly one h1').toHaveCount(1);
        await expect(page.getByRole('main'), 'exactly one main landmark').toHaveCount(1);
      }
    });
  }
}

test.describe('keyboard, focus and announcements', () => {
  test('sign-in is fully operable by keyboard, in a logical order, with a visible focus ring', async ({ page }) => {
    await page.goto('/sign-in');
    // the session check finishes before the form exists: tabbing earlier would be tabbing through a loading skeleton
    await expect(page.getByLabel('Mobile phone number')).toBeVisible();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Mobile phone number')).toBeFocused();
    await page.keyboard.type(PHONE.owner);
    await page.keyboard.press('Tab');
    const send = page.getByRole('button', { name: 'Send code' });
    await expect(send).toBeFocused();
    const ring = await send.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(ring.style).toBe('solid');
    expect(ring.width).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'I cannot use this number' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Enter your code' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('One-time code')).toBeFocused();
    await page.keyboard.type('246810');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Your Sellers' })).toBeVisible();
  });

  test('the page title takes focus on every route change, so keyboard users land on the new page', async ({ page }) => {
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Products' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Products and Inventory' })).toBeFocused();
  });

  test('a modal dialog makes the page behind inert, and Escape returns focus to the opener', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    const opener = page.getByRole('button', { name: 'Account' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Account' });
    await expect(dialog.getByRole('button', { name: 'Sign out' })).toBeVisible();
    const behindTookFocus = await page.evaluate(() => {
      const behind = document.querySelector<HTMLElement>('.sidebar a');
      if (!behind) return 'no-target';
      behind.focus();
      return document.activeElement === behind ? 'took-focus' : 'inert';
    });
    expect(behindTookFocus, 'a control behind the modal must exist and must not take focus').toBe('inert');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('icon-only controls have accessible names and landmarks are present', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    const bar = page.getByRole('banner');
    await expect(bar.getByRole('link', { name: /Notifications/ })).toBeVisible();
    for (const name of ['Help', 'Account', 'Switch Seller']) await expect(bar.getByRole('button', { name })).toBeVisible();
  });

  test('loading is announced as a status and a failed request as an alert', async ({ page }) => {
    await signIn(page, PHONE.owner, `/sign-in?fx_delay=${SELLER.alem.id}:1500`);
    await page.getByRole('link', { name: SELLER.alem.name }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Loading' }).first()).toBeAttached();
    await expect(page.getByRole('heading', { level: 2, name: 'Alerts' })).toBeVisible({ timeout: 10_000 });
    await page.goto('/sign-in');
    await signIn(page, PHONE.states);
    await page.getByRole('link', { name: SELLER.hana.name }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'We could not load your readiness list' })).toBeVisible();
  });

  test('reduced motion is honoured: no animation runs', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/sign-in');
    const durations = await page.evaluate(() => [...document.querySelectorAll('*')].map((el) => getComputedStyle(el).animationName).filter((n) => n !== 'none'));
    expect(durations).toEqual([]);
  });
});
