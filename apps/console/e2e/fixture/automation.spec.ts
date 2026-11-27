import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { atSellerHome, expectTextScale, goInApp, limeCount, noHorizontalOverflow, PHONE, scaleText, SELLER } from './helpers';

/**
 * SC-FE-08 completion: scripted-assistance administration. Fixture verification only. Intents and templates are a provisional demonstration;
 * there is no model, no generated text, no automation switch and no feedback submission (no AUTH-02 code exists for it).
 */
const at = async (page: Page, phone: string, sub = '') => {
  await atSellerHome(page, phone, SELLER.alem.name);
  await goInApp(page, `/s/${SELLER.alem.id}/inbox/automation${sub}`);
};

test.describe('SC-FE-08 automation: who may do what (AUTH-02 seller.chatbot codes)', () => {
  test('the Owner sees readiness, intents, activity, history, and can configure and test', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await at(page, PHONE.owner);
    await expect(page.getByRole('heading', { level: 1, name: 'Scripted assistance' })).toBeVisible();
    await expect(page.getByText('provisional demonstration')).toBeVisible();
    const readiness = page.getByRole('region', { name: 'Readiness' });
    await expect(readiness).toContainText('Information missing');
    await expect(readiness).toContainText('Describe your warranty or after-sales help.');
    await expect(readiness).toContainText('Not defined yet');
    await expect(page.getByRole('region', { name: 'Questions it can answer' })).toContainText('Template fx_tpl_returns, version 1 (provisional)');
    // Not live in this release: the figures say so, they are never a zero.
    const activity = page.getByRole('region', { name: 'Activity in the last 30 days' });
    await expect(activity).toContainText('Not available yet.');
    await expect(activity).not.toContainText(/\b0\b/);
    const nav = page.getByRole('navigation', { name: 'Scripted assistance sections' });
    await expect(nav.getByRole('link')).toHaveText(['Overview', 'Store knowledge', 'Test answers']);
    await expect(page.getByRole('main').getByRole('button', { name: /switch on|enable|turn on/i })).toHaveCount(0);
  });

  test('Sales Support reads but cannot change or test; no activity figures', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await at(page, PHONE.sales);
    await expect(page.getByRole('region', { name: 'Readiness' })).toBeVisible();
    await expect(page.getByRole('region', { name: /Activity in the last/ })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Scripted assistance sections' }).getByRole('link')).toHaveText(['Overview', 'Store knowledge']);
    await goInApp(page, `/s/${SELLER.alem.id}/inbox/automation/knowledge`);
    await expect(page.getByText('You can see this information but not change it.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save store knowledge' })).toHaveCount(0);
    await goInApp(page, `/s/${SELLER.alem.id}/inbox/automation/test`);
    await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
  });

  test('the Campaign Manager configures without any Inbox access; Inventory and Analyst are denied', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await at(page, PHONE.campaign);
    await expect(page.getByRole('heading', { level: 1, name: 'Scripted assistance' })).toBeVisible();
    await goInApp(page, `/s/${SELLER.alem.id}/inbox`);
    await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
    for (const phone of [PHONE.inventory, PHONE.analyst]) {
      await page.goto('/sign-in');
      await at(page, phone);
      await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
    }
  });
});

test.describe('SC-FE-08 automation: knowledge and the simulator', () => {
  test('saving the missing warranty makes a new version, completes readiness, and leaves facts owned elsewhere alone', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await at(page, PHONE.owner, '/knowledge');
    await expect(page.getByRole('region', { name: 'Answered from elsewhere' })).toContainText('Prices come from your Products.');
    await expect(page.getByLabel('Price')).toHaveCount(0);
    await page.getByLabel('Days a Buyer has to return an item').fill('seven');
    await page.getByRole('button', { name: 'Save store knowledge' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'Enter a whole number of days from 1 to 365.' })).toHaveAttribute('href', '#returns_window_days');
    await page.getByLabel('Days a Buyer has to return an item').fill('14');
    await page.getByLabel('Warranty or after-sales help').fill('Six months on stitching.');
    await page.getByRole('button', { name: 'Save store knowledge' }).click();
    await expect(page.getByText('This is version 2.')).toBeVisible();
    await page.getByRole('navigation', { name: 'Scripted assistance sections' }).getByRole('link', { name: 'Overview' }).click();
    await expect(page.getByRole('region', { name: 'Readiness' })).toContainText('Complete');
    await expect(page.getByRole('region', { name: 'Changes to your store knowledge' }).getByRole('listitem')).toHaveCount(2);
  });

  test('unsaved knowledge is guarded', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await at(page, PHONE.owner, '/knowledge');
    await page.getByLabel('General guidance for Buyers').fill('Sizes run small.');
    await page.getByRole('navigation', { name: 'Scripted assistance sections' }).getByRole('link', { name: 'Overview' }).click();
    await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
  });

  test('the simulator answers deterministically, shows how, hands over what it cannot answer, and is labelled test only', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await at(page, PHONE.owner, '/test');
    await page.getByRole('button', { name: 'Run test' }).click();
    await expect(page.getByRole('alert').getByRole('link', { name: 'Type a question to test.' })).toHaveAttribute('href', '#question');
    await page.getByRole('button', { name: 'Try: Is this still available?' }).click();
    await page.getByRole('button', { name: 'Run test' }).click();
    const result = page.getByRole('region', { name: 'Test result' });
    await expect(result).toContainText('Handed to your team: information is missing');
    await expect(result).toContainText('The question is about a Product, but no Product was chosen.');
    await page.getByLabel('Product the question is about').selectOption({ label: 'Silk slip dress' });
    await page.getByRole('button', { name: 'Run test' }).click();
    await expect(result).toContainText('This Product is not available right now.');
    await expect(result).toContainText('Template fx_tpl_availability, version 1 (provisional)');
    await expect(result).toContainText('Facts: taken from your stock');
    await expect(result).toContainText('Test only. No Buyer sees this.');
    await page.getByRole('button', { name: /Try: \S+ \S+\?/ }).last().click();
    await page.getByRole('button', { name: 'Run test' }).click();
    await expect(result).toContainText('Handed to your team: not in English');
  });
});

test.describe('SC-FE-08 automation: layout and accessibility', () => {
  test('passes axe on every page, desktop and phone, with one lime action at most', async ({ page }) => {
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      for (const sub of ['', '/knowledge', '/test']) {
        await page.goto('/sign-in');
        await at(page, PHONE.owner, sub);
        await expect(page.locator('.skeleton')).toHaveCount(0);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).disableRules(['target-size']).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
        expect(await limeCount(page)).toBeLessThanOrEqual(1);
      }
    }
  });

  test('no horizontal overflow at 390px and 200% text', async ({ page }) => {
    await scaleText(page, 200);
    await page.setViewportSize({ width: 390, height: 844 });
    await at(page, PHONE.owner, '/test');
    await expectTextScale(page, 200);
    await page.getByRole('button', { name: 'Try: Can I return it if it does not fit?' }).click();
    await page.getByRole('button', { name: 'Run test' }).click();
    await expect(page.getByRole('region', { name: 'Test result' })).toBeVisible();
    await noHorizontalOverflow(page);
  });
});
