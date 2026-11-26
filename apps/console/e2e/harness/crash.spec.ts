import { expect, test } from '@playwright/test';

/**
 * A screen that throws while rendering must land on the approved recovery state, never a blank page and never React
 * Router's default error screen, and must not show anything about the failure. The harness is test-only: the Console
 * has no crash control.
 */
for (const mode of ['route', 'boundary'] as const) {
  test.describe(`render failure caught by the ${mode === 'route' ? 'router root errorElement' : 'app ErrorBoundary'}`, () => {
    test('shows the approved recovery state and nothing about the failure', async ({ page }) => {
      await page.goto(`/?mode=${mode}`);
      const panel = page.getByRole('alert').filter({ hasText: 'Something went wrong on our side. Please try again.' });
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Try again' })).toBeVisible();
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByText('SECRET-SELLER-DATA')).toHaveCount(0);
      await expect(page.getByText('Unexpected Application Error')).toHaveCount(0);
      expect(await page.locator('body').innerText()).not.toContain('deliberate render failure');
    });

    test('Try again reloads and lands on the same safe state instead of a loop or a blank page', async ({ page }) => {
      await page.goto(`/?mode=${mode}`);
      const retry = page.getByRole('button', { name: 'Try again' });
      await expect(retry).toBeVisible();
      const reloaded = page.waitForEvent('load');
      await retry.click();
      await reloaded;
      await expect(page.getByRole('alert').filter({ hasText: 'Something went wrong on our side.' })).toBeVisible();
    });
  });
}
