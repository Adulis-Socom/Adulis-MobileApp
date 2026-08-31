/**
 * The twelve states, through the one component that renders them.
 *
 * ADU-CON-03 S3's set is CLOSED: "a screen needing a state not on this list
 * has found a contract gap -- report it, do not extend this union." C-1's
 * done-clause is that all twelve are demonstrable, and `StateDemo` is where
 * they are demonstrated -- it survived C-3 at `/s/:id/states` precisely so
 * that evidence was not lost to the screen that replaced it.
 *
 * THREE STATES ARE ASSERTED BY SHAPE, NOT BY PRESENCE, and they are the three
 * a "did it appear" test gets wrong:
 *
 *   NO_PERMISSION   -> NOTHING renders (S3.4). The absence is the assertion.
 *   NO_ENTITLEMENT  -> the control IS rendered, and DISABLED, with what
 *                      unlocks it (S3.5). These two are the pair everyone
 *                      inverts, and an inversion passes any presence check.
 *   UPGRADE_REQUIRED-> a reload prompt and NO OTHER CONTENT.
 *
 * AND TWO RENDER WITHOUT A `data-state` MARKER. `CONFLICT` and `VALIDATION`
 * delegate to `ProblemBanner` and `ValidationSummary`, which carry
 * `role="alert"` and a class instead. That is correct for a screen reader --
 * both are announcements -- and it means this suite identifies them by the
 * role they actually expose rather than by a marker they do not have. A test
 * written against the marker would have failed for a reason that is not a
 * defect.
 */
import { test, expect } from '@playwright/test';
import { SEEDED } from './helpers/session';

/** ADU-CON-03 S3, in the order lib/states.ts declares them. */
const STATES = [
  'LOADING', 'EMPTY', 'READY', 'STALE', 'BLOCKED_READINESS', 'NO_PERMISSION',
  'NO_ENTITLEMENT', 'CONFLICT', 'VALIDATION', 'TERMINAL', 'TRANSPORT_ERROR',
  'UPGRADE_REQUIRED',
] as const;

/** The states whose rendering is an alert rather than a marked region. */
const AS_ALERT: Record<string, string> = {
  CONFLICT: '.problem',
  VALIDATION: '.validation-summary',
};

test.describe('the twelve states', () => {
  test('the demo offers exactly the closed set', async ({ page }) => {
    await page.goto(`/s/${SEEDED.sellerId}/states`);

    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(STATES.length);
    // Exactly the twelve, and no thirteenth: the set is closed, and a screen
    // that needed another has found a contract gap rather than a new state.
    expect((await tabs.allTextContents()).map((t) => t.trim()).sort()).toEqual([...STATES].sort());
  });

  test('each one renders through ScreenState, in its specified shape', async ({ page }) => {
    await page.goto(`/s/${SEEDED.sellerId}/states`);
    const stage = page.locator('.demo-stage');

    for (const s of STATES) {
      await page.getByRole('tab', { name: s, exact: true }).click();

      if (s === 'NO_PERMISSION') {
        // S3.4 -- nothing renders. Not a disabled control, not an explainer.
        await expect(stage.locator('[data-state]')).toHaveCount(0);
        await expect(stage.getByRole('alert')).toHaveCount(0);
        await expect(stage).toHaveText('');
        continue;
      }

      if (AS_ALERT[s]) {
        await expect(stage.locator(AS_ALERT[s] as string), `${s} did not render`).toHaveCount(1);
        await expect(stage.getByRole('alert')).toHaveCount(1);
        continue;
      }

      await expect(stage.locator(`[data-state="${s}"]`), `${s} did not render`).toHaveCount(1);

      if (s === 'NO_ENTITLEMENT') {
        // S3.5 -- visible AND disabled, with what unlocks it. The inverse of
        // NO_PERMISSION, and the reason both are checked by shape.
        const control = stage.locator('[data-state="NO_ENTITLEMENT"] button');
        await expect(control).toHaveCount(1);
        await expect(control).toBeDisabled();
        await expect(stage.locator('[data-state="NO_ENTITLEMENT"] .hint')).not.toBeEmpty();
      }

      if (s === 'UPGRADE_REQUIRED') {
        // A reload prompt and NO OTHER CONTENT.
        await expect(stage.locator('[data-state="UPGRADE_REQUIRED"] button')).toHaveCount(1);
      }
    }
  });
});
