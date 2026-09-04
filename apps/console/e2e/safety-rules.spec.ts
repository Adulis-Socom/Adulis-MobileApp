/**
 * safety-rules.spec.ts -- the two rules nothing was asserting, and the reason
 * this file exists at all (T22 Phase 5).
 *
 * WORK ORDER T22 S5.1: "These are product safety, not style, and they must hold
 * in both modes after the port ... A port that passes typecheck and breaks rule
 * 1 is the worst outcome available here."
 *
 * FOUR OF THE SIX WERE ALREADY ASSERTED, in trade.spec.ts: the equal weighting
 * of the two payment decisions (by comparing computed styles, which is the only
 * form that catches a "primary" variant), the verify-in-your-own-bank sentence
 * and its not being inside a <details>, R20's disabled-not-hidden region, and
 * the three clock treatments including the third being an absent region.
 *
 * TWO WERE HELD BY NOTHING BUT ABSENCE:
 *
 *   RULE 4  no state is carried by colour alone. Held today by there being no
 *           colour rule on a badge at all -- so a design system that arrives
 *           with tones satisfies every existing test and breaks the rule.
 *   RULE 5  a visible, KEYBOARD-ONLY focus ring. Held today by a single
 *           :focus-visible block in tokens.css that nothing reads back.
 *
 * A rule enforced by the absence of code is a rule the next commit can delete
 * without any gate going red. That is what this file is for, and it is written
 * BEFORE the component port rather than after it, because a guard added after
 * the thing it guards has already proved nothing about the change.
 *
 * THE @safety TAG runs this file, and the four assertions in trade.spec.ts, a
 * SECOND time in dark mode -- see playwright.config.ts. Until T22 not one test
 * in this suite ran in dark mode at all, so every one of the six rules was
 * asserted in exactly the mode a developer looks at.
 */
import { test, expect } from '@playwright/test';
import { SEEDED } from './helpers/session';

const ORDER_SUBMITTED = '5eed0000-0000-4000-8000-000000000012';

test.describe('the six rules @safety', () => {
  /**
   * RULE 4 -- NO STATE IS CARRIED BY COLOUR ALONE (ADU-CON-03 S15).
   *
   * Asserted as the rule is written: every element that reports a state must
   * carry READABLE TEXT. Not "has a class", not "has a colour" -- text, because
   * text is what survives greyscale, a colour-blind reader, and the mode the
   * developer does not look at.
   */
  test('rule 4: every state badge carries a word, not just a colour', async ({ page }) => {
    await page.goto(`/s/${SEEDED.sellerId}/orders`);
    // Wait for the LIST, not for the badge: an empty match on a screen that
    // has not rendered yet is a test that passes for the wrong reason.
    await expect(page.locator('[data-order]').first()).toBeVisible();

    // Keyed on the ATTRIBUTE the port must preserve, not on a class name.
    const badges = page.locator('[data-order] [data-badge]');
    const n = await badges.count();
    expect(n).toBeGreaterThan(0);

    for (let i = 0; i < n; i += 1) {
      const text = ((await badges.nth(i).textContent()) ?? '').trim();
      expect(text.length, 'a state badge with no word is a state carried by colour alone').toBeGreaterThan(0);
    }
  });

  test('rule 4: the readiness list says Done or To do in words', async ({ page }) => {
    await page.goto(`/s/${SEEDED.sellerId}`);
    await expect(page.locator('h1')).toBeVisible();
    const items = page.locator('[data-item]');
    // Home has two lives; the readiness list is only on the unpublished one.
    await page.waitForTimeout(250);
    const n = await items.count();
    if (n === 0) test.skip(true, 'this seller has published; Life 1 is not on screen');
    for (let i = 0; i < n; i += 1) {
      const row = items.nth(i);
      const satisfied = await row.getAttribute('data-satisfied');
      const text = ((await row.textContent()) ?? '').toLowerCase();
      // The glyph is aria-hidden; the WORD is what a screen reader and a
      // greyscale panel both get, and it must differ by state.
      expect(
        satisfied === 'true' ? text.includes('done') : text.includes('still to do') || text.includes('to do'),
        'a readiness row must say its state in words',
      ).toBe(true);
    }
  });

  /**
   * RULE 5 -- A VISIBLE FOCUS RING, KEYBOARD-ONLY.
   *
   * BOTH HALVES, because each without the other is a different defect: a ring
   * that never shows fails a keyboard user, and a ring that shows on every
   * mouse click gets called ugly and then gets deleted -- which is how the
   * first half is usually lost.
   *
   * The token is 2px at 2px offset and it ALIASES THE ACCENT, so it moves with
   * the mode (packages/tokens D-271). Running this test in dark mode is the
   * only thing that would have caught that token having no dark value.
   */
  test('rule 5: Tab shows a ring, a mouse click does not', async ({ page }) => {
    await page.goto(`/s/${SEEDED.sellerId}/orders`);
    // The list must be ON SCREEN before tabbing: tabbing through a skeleton
    // proves nothing about the controls the seller actually reaches.
    await expect(page.locator('[data-order]').first()).toBeVisible();

    // Walk the tab order until focus lands on something focusable in the page.
    let ringed = false;
    let outlineSeen = '';
    for (let i = 0; i < 12 && !ringed; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return {
          tag: el.tagName,
          outlineStyle: s.outlineStyle,
          outlineWidth: s.outlineWidth,
          matchesFocusVisible: el.matches(':focus-visible'),
        };
      });
      if (!info) continue;
      outlineSeen = `${info.tag} ${info.outlineStyle} ${info.outlineWidth}`;
      if (info.matchesFocusVisible && info.outlineStyle !== 'none' && parseFloat(info.outlineWidth) > 0) {
        ringed = true;
      }
    }
    expect(ringed, `no keyboard focus produced a visible ring (last seen: ${outlineSeen})`).toBe(true);

    // THE OTHER HALF. A real mouse click must not ring: :focus-visible is what
    // makes the ring a keyboard affordance rather than a decoration, and a ring
    // on every click is the reason somebody eventually removes it.
    const clickable = page.locator('[data-order] a, [data-order] button').first();
    await clickable.click({ trial: false });
    const afterClick = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return { matches: false, outlineWidth: '0px' };
      return {
        matches: el.matches(':focus-visible'),
        outlineWidth: getComputedStyle(el).outlineWidth,
      };
    });
    expect(afterClick.matches, 'a mouse click must not match :focus-visible').toBe(false);
  });

  /**
   * RULE 6's THIRD TREATMENT, asserted here too because it is the one a port
   * is most likely to "improve" into a stopped clock. trade.spec.ts asserts it
   * on the list; this asserts it on the DETAIL screen, where a running timer on
   * a paid order is, in the spec's words, the single most misleading thing the
   * screen could display.
   */
  test('rule 6: a submitted order shows the CONFIRMATION clock and no other', async ({ page }) => {
    await page.goto(`/s/${SEEDED.sellerId}/orders/${ORDER_SUBMITTED}`);
    await expect(page.locator('.state-region')).toBeVisible();
    await expect(page.locator('[data-clock="CONFIRMATION"]')).toBeVisible();
    // Not a stopped one, not "0:00" -- absent.
    await expect(page.locator('[data-clock="RESERVATION"]')).toHaveCount(0);
  });
});
