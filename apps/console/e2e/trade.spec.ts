/**
 * C-4's done-clause, asserted by a machine.
 *
 *   "Three clock treatments visible; handoff gated on PAYMENT_CONFIRMED;
 *    payment decisions equally weighted."   -- ADU-REPO-01 S9.5 build order
 *
 * plus the two rules S7 attaches to the evidence modal: the blob URL revoked
 * on unmount, and no save affordance of any kind.
 *
 * THE ORDERS COME FROM THE SEED, one per clock treatment, and their ids are
 * fixed there precisely so this file can name them. A test that first goes
 * looking for "an order in state X" passes vacuously on the day the fixture
 * stops producing one.
 */
import { test, expect, type Page } from '@playwright/test';
import { SEEDED } from './helpers/session';

const ORDER = {
  created: '5eed0000-0000-4000-8000-000000000011',
  submitted: '5eed0000-0000-4000-8000-000000000012',
  confirmed: '5eed0000-0000-4000-8000-000000000013',
  completed: '5eed0000-0000-4000-8000-000000000014',
};

const detail = (id: string) => `/s/${SEEDED.sellerId}/orders/${id}`;

async function openDetail(page: Page, id: string) {
  await page.goto(detail(id));
  await expect(page.locator('.state-region')).toBeVisible();
}

test.describe('SC-03 -- the orders list', () => {
  test('renders the seeded orders, each with the clock its state governs', async ({ page }) => {
    await page.goto(`/s/${SEEDED.sellerId}/orders`);

    const rows = page.locator('[data-order]');
    await expect(rows).toHaveCount(4);

    /*
     * THE THREE TREATMENTS, ADU-CON-03 S7. `data-clock` carries WHICH clock,
     * so this asserts the treatment rather than inferring it from rendered
     * minutes -- two clocks showing "3h 20m left" are indistinguishable by
     * text and completely different by meaning.
     */
    await expect(
      page.locator(`[data-order="${ORDER.created}"] [data-clock="RESERVATION"]`),
      'a CREATED order must show the reservation window',
    ).toHaveCount(1);

    await expect(
      page.locator(`[data-order="${ORDER.submitted}"] [data-clock="CONFIRMATION"]`),
      'a PAYMENT_SUBMITTED order must show the 24h confirmation window',
    ).toHaveCount(1);

    /*
     * AND NOT THE OTHER ONE. This is the assertion that catches a fallback to
     * expires_at: the seeded PAYMENT_SUBMITTED order carries an expires_at in
     * the PAST, so a row that reached for the reservation clock here would
     * render a stale deadline for a decision that is still live.
     */
    await expect(
      page.locator(`[data-order="${ORDER.submitted}"] [data-clock="RESERVATION"]`),
      'the reservation clock is irrelevant once payment is submitted (S7)',
    ).toHaveCount(0);

    /*
     * NO COUNTDOWN AT ALL on a paid order. Not a stopped one, not "0:00" --
     * S7 calls a running timer on a paid order "the single most misleading
     * thing this screen could display", and the honest rendering of that is
     * an absent region.
     */
    for (const id of [ORDER.confirmed, ORDER.completed]) {
      await expect(
        page.locator(`[data-order="${id}"] .deadline`),
        'a paid order must carry no clock region at all',
      ).toHaveCount(0);
    }
  });

  test('the filter groups the loaded rows, and says that is what it does', async ({ page }) => {
    await page.goto(`/s/${SEEDED.sellerId}/orders`);
    await expect(page.locator('[data-order]')).toHaveCount(4);

    await page.locator('[data-filter="needs_action"]').click();
    await expect(page.locator('[data-order]')).toHaveCount(1);
    await expect(page.locator(`[data-order="${ORDER.submitted}"]`)).toHaveCount(1);

    await page.locator('[data-filter="completed"]').click();
    await expect(page.locator(`[data-order="${ORDER.completed}"]`)).toHaveCount(1);

    // D-153 and D-154 are STATED ON SCREEN, and this test exists to stop a
    // later agent deleting two awkward sentences. A screen that hides a
    // known gap reads as finished -- the same argument the chooser makes.
    await expect(page.locator('[data-gap="D-153"]')).toBeVisible();
    await expect(page.locator('[data-gap="D-154"]')).toBeVisible();
  });
});

test.describe('SC-04 -- the payment decisions', () => {
  test('are equally weighted, verbatim, and carry the verify sentence', async ({ page }) => {
    await openDetail(page, ORDER.submitted);

    const confirm = page.locator('#detail-confirm');
    const reject = page.locator('#detail-reject');

    /*
     * RULE 2: THE WORDS, VERBATIM. "Confirm Payment Received", never "Accept
     * Payment" -- accepting is what you do to a request, confirming is what
     * you do to a fact you have checked, and the word does the teaching.
     */
    await expect(confirm).toHaveText('Confirm Payment Received');
    await expect(reject).toHaveText('Payment Not Received');
    await expect(
      page.getByText(/accept payment/i),
      '"Accept Payment" must appear nowhere on this screen',
    ).toHaveCount(0);

    /*
     * RULE 1: EQUALLY WEIGHTED. Neither is the styled default. Compared as
     * COMPUTED STYLE rather than by class name, because a class list proves
     * only that the markup agrees with itself -- what a seller sees is what
     * the cascade produced.
     */
    const weigh = (sel: string) =>
      page.locator(sel).evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          color: s.color,
          background: s.backgroundColor,
          border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
          textTransform: s.textTransform,
        };
      });
    expect(
      await weigh('#detail-confirm'),
      'the two decisions must be styled identically -- neither is the safe default',
    ).toEqual(await weigh('#detail-reject'));

    // Same rendered size, to within a pixel of rounding. A "safe" default is
    // just as often bigger as it is coloured.
    const a = await confirm.boundingBox();
    const b = await reject.boundingBox();
    expect(a && b ? Math.abs(a.height - b.height) : 99).toBeLessThanOrEqual(1);

    /*
     * RULE 3: ADJACENT, ALWAYS VISIBLE, NEVER BEHIND A DISCLOSURE. Visible
     * with no interaction, and provably not inside a <details> or any
     * collapsed container -- checking `toBeVisible` alone would pass for a
     * sentence inside an OPEN <details> that the next seller finds closed.
     */
    const verify = page.locator('[data-verbatim="verify-in-your-own-bank"]');
    await expect(verify).toBeVisible();
    await expect(verify).toHaveText(
      'Verify the payment in your own bank or payment account before confirming.',
    );
    expect(
      await verify.evaluate((el) => el.closest('details') !== null),
      'the verify sentence must not be behind a disclosure',
    ).toBe(false);

    /*
     * RULE 4: CONFIRMING WITHOUT OPENING THE EVIDENCE IS A NORMAL PATH. So
     * confirm is enabled before the evidence modal has ever been opened, and
     * nothing marks the evidence as unread-and-required.
     */
    await expect(confirm).toBeEnabled();
  });

  test('rejection is two steps, and step two states the consequence', async ({ page }) => {
    await openDetail(page, ORDER.submitted);

    await page.locator('#detail-reject').click();

    // The first tap does NOT reject. It asks again, having said what the
    // seller is agreeing to.
    const consequence = page.locator('.reject-confirm .consequence');
    await expect(consequence).toBeVisible();
    await expect(consequence).toContainText(/back to awaiting payment/i);
    await expect(consequence).toContainText(/clock keeps running/i);
    await expect(consequence).toContainText(/second time, the order ends/i);

    // And the final control is inert until a reason is given -- the API
    // requires one, so demanding it here beats a 400 the seller cannot read.
    await expect(page.locator('[data-decision="reject-confirm"]')).toBeDisabled();
    await page.locator('#detail-reject-reason').fill('No deposit in the account.');
    await expect(page.locator('[data-decision="reject-confirm"]')).toBeEnabled();

    // Backing out leaves the order untouched and the pair restored.
    await page.locator('[data-decision="reject-cancel"]').click();
    await expect(page.locator('#detail-confirm')).toBeVisible();
  });
});

test.describe('SC-04 -- R20, the handoff region', () => {
  test('is DISABLED and not hidden before PAYMENT_CONFIRMED', async ({ page }) => {
    await openDetail(page, ORDER.submitted);

    const region = page.locator('.handoff-region');
    // PRESENT. "A region that disappears makes a seller wonder what they
    // broke; a region that explains itself teaches the sequence."
    await expect(region).toBeVisible();
    await expect(region).toHaveAttribute('data-gated', 'true');
    await expect(page.locator('[data-gate="R20"]')).toBeVisible();

    // ALL THREE CONTROLS, not only Mark Ready -- which is the exact omission
    // v1.0 made and the wireframes inherited.
    for (const action of ['mark-ready', 'assign-courier', 'custody-transfer', 'show-qr']) {
      const control = page.locator(`[data-action="${action}"]`);
      await expect(control, `${action} must be rendered`).toHaveCount(1);
      await expect(control, `${action} must be disabled before payment`).toBeDisabled();
    }

    // And not merely visually: clicking Show QR opens nothing.
    await page.locator('[data-action="show-qr"]').click({ force: true });
    await expect(page.locator('.modal.qr')).toHaveCount(0);
  });

  test('opens at PAYMENT_CONFIRMED, and the QR is available only then', async ({ page }) => {
    await openDetail(page, ORDER.confirmed);

    await expect(page.locator('.handoff-region')).toHaveAttribute('data-gated', 'false');
    await expect(page.locator('[data-gate="R20"]')).toHaveCount(0);
    await expect(page.locator('[data-action="mark-ready"]')).toBeEnabled();
    await expect(page.locator('[data-action="show-qr"]')).toBeEnabled();

    await page.locator('[data-action="show-qr"]').click();
    await expect(page.locator('.modal.qr')).toBeVisible();

    /*
     * WAIT FOR THE SVG, THEN COUNT. `locator.count()` DOES NOT RETRY -- it
     * asks once and answers -- and the modal becomes visible the instant it
     * mounts, while GET /qr is still in flight. The first version counted
     * there, got 0, and reported "the QR is empty" about a QR that was fine.
     *
     * This is D-152 again in a second costume: an assertion that runs before
     * the thing it is about has happened. `expect(locator)` retries;
     * `await locator.count()` is a plain read, and mixing the two is how a
     * suite acquires a flake it later learns to ignore.
     */
    await expect(page.locator('.handoff-qr')).toBeVisible();
    // A real QR, not an empty <svg>: an empty one satisfies any presence
    // check and scans as nothing.
    const modules = page.locator('.handoff-qr rect');
    expect(await modules.count()).toBeGreaterThan(50);
    // WHO scans it. Sellers read a QR on their own screen as one they scan.
    await expect(page.locator('.qr-explain')).toContainText(/buyer scans/i);
  });
});

test.describe('SC-05 -- payment evidence', () => {
  /*
   * THE BYTES ARE INTERCEPTED, and the reason is a fixture limit rather than
   * a shortcut: financial storage in development is FakeFinancialStorageAdapter,
   * which holds objects in a Map inside the API process. No SQL fixture can
   * put bytes where the API will look for them, so the seeded submission has
   * an evidence_ref with no object behind it. Registered as D-158.
   *
   * What is being asserted is not "an image appears" -- it is the security
   * shape around the image, which is what S7 actually specifies and what is
   * identical whether the bytes are real or planted.
   */
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  test('renders from a blob URL, offers no way to save it, and revokes on close', async ({
    page,
    context,
  }) => {
    await context.route('**/payment-evidence', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
    );

    await openDetail(page, ORDER.submitted);
    await page.locator('[data-action="view-evidence"]').click();

    const img = page.locator('.evidence-image');
    await expect(img).toBeVisible();

    // A BLOB URL. Never a public one, never a predictable one (ADU-SEC-01 S7).
    const src = await img.getAttribute('src');
    expect(src, 'evidence must render from a blob URL').toMatch(/^blob:/);

    /*
     * NO DOWNLOAD, NO PRINT, NO SHARE, NO SAVE, AND NO "LOOKS VALID"
     * AFFORDANCE OF ANY KIND. Asserted across the whole modal rather than on
     * the image alone -- a download button beside the picture is still a
     * download button.
     */
    const modal = page.locator('.modal.evidence');
    await expect(modal.locator('[download]')).toHaveCount(0);
    await expect(modal.locator('a')).toHaveCount(0);
    await expect(modal.locator('canvas')).toHaveCount(0);
    for (const word of [/download/i, /print/i, /share/i, /save/i, /valid/i, /verified/i]) {
      await expect(
        modal.getByText(word),
        `the evidence modal must offer nothing matching ${word}`,
      ).toHaveCount(0);
    }

    // THE DECISIONS ARE REPEATED HERE, "so the seller need not close to act",
    // and they are the same component -- so the verify sentence comes too.
    await expect(page.locator('#evidence-confirm')).toHaveText('Confirm Payment Received');
    await expect(page.locator('#evidence-reject')).toHaveText('Payment Not Received');
    await expect(modal.locator('[data-verbatim="verify-in-your-own-bank"]')).toBeVisible();

    /*
     * REVOKED ON UNMOUNT. Asserted by FETCHING THE URL after closing: a
     * revoked blob URL is not resolvable, and this is the only check that
     * distinguishes a real revoke from a cleanup function nobody called.
     * Checking that the <img> is gone would pass with the blob still alive.
     */
    await page.locator('.modal.evidence .modal-close').click();
    await expect(page.locator('.modal.evidence')).toHaveCount(0);

    const stillAlive = await page.evaluate(
      (url) =>
        fetch(url)
          .then(() => true)
          .catch(() => false),
      src as string,
    );
    expect(stillAlive, 'the blob URL must be revoked when the modal unmounts').toBe(false);
  });
});

test.describe('SC-04 -- terminal orders', () => {
  test('render history and no actions', async ({ page }) => {
    await openDetail(page, ORDER.completed);

    await expect(page.locator('[data-state="TERMINAL"]')).toHaveCount(1);

    // The history is the order's own, from core.order_state_transition --
    // five transitions for the completed fixture, ending at COMPLETED.
    // Same rule: wait for the region with a retrying assertion before taking
    // a plain count off it.
    await expect(page.locator('[data-transition="COMPLETED"]')).toBeVisible();
    const entries = page.locator('[data-transition]');
    expect(await entries.count()).toBeGreaterThanOrEqual(5);
    await expect(page.locator('[data-transition="COMPLETED"]')).toHaveCount(1);

    // No decisions on an ended order, and no line-level action.
    await expect(page.locator('[data-decision="confirm"]')).toHaveCount(0);
    await expect(page.locator('[data-action="cant-fulfil"]')).toHaveCount(0);
    await expect(page.locator('[data-action="reissue-instructions"]')).toHaveCount(0);
  });
});
