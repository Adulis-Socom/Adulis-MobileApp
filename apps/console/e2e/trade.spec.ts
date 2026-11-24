/**
 * C-4's done-clause, asserted by a machine.
 *
 *   "Three clock treatments visible; handoff gated on PAYMENT_CONFIRMED;
 *    payment decisions equally weighted."   -- ADU-REPO-01 S9.5 build order
 *
 * plus the two rules S7 attaches to the evidence modal: the blob URL revoked
 * on unmount, and no save affordance of any kind.
 *
 * SUPERSEDED BY D24-01 / B02-D01 / B02-D02 (SC-SAFE-01, 25 November 2026). The original done-clause
 * above (handoff gated on PAYMENT_CONFIRMED, equally weighted payment decisions, the evidence
 * modal's blob rules, a live courier assignment control) described the Seller confirming payment
 * and handing orders off. That workflow is removed from the MVP console, so its positive tests
 * are replaced below by canonical NEGATIVE tests, not silently deleted: the same orders are
 * opened and the same regions are asserted to carry no action and to call no payment endpoint.
 * The original expectations live in git history (this file before this change).
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
  /** PAYMENT_SUBMITTED with the confirmation deadline ALREADY PAST (D-167). */
  lapsed: '5eed0000-0000-4000-8000-000000000015',
};

const detail = (id: string) => `/s/${SEEDED.sellerId}/orders/${id}`;

async function openDetail(page: Page, id: string) {
  await page.goto(detail(id));
  await expect(page.locator('.state-region')).toBeVisible();
}

test.describe('SC-03 -- the orders list @safety', () => {
  test('renders the seeded orders, each with the clock its state governs', async ({ page }) => {
    await page.goto(`/s/${SEEDED.sellerId}/orders`);

    const rows = page.locator('[data-order]');
    await expect(rows).toHaveCount(5);

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
      'the Seller no longer decides payment, so no confirmation countdown is shown (D24-01)',
    ).toHaveCount(0);

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
    // And the legacy "review payment" door on the list is gone.
    await expect(page.locator('[data-primary="review_payment"]')).toHaveCount(0);

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

  test('the bucket is the server-owned set: each tab re-fetches, not a page-local filter (D-154 answered)', async ({
    page,
  }) => {
    await page.goto(`/s/${SEEDED.sellerId}/orders`);
    await expect(page.locator('[data-order]')).toHaveCount(5);

    // needs_action is a SET the server owns: PAYMENT_SUBMITTED (submitted,
    // lapsed) AND PAYMENT_CONFIRMED (confirmed) -- three of the five seeds.
    // A re-fetch, asserted at the wire, is what a page-local filter is not.
    const needs = page.waitForResponse(
      (r) => r.url().includes('bucket=needs_action') && r.request().method() === 'GET',
    );
    await page.locator('[data-filter="needs_action"]').click();
    await needs;
    await expect(page.locator('[data-order]')).toHaveCount(3);
    await expect(page.locator(`[data-order="${ORDER.submitted}"]`)).toHaveCount(1);
    await expect(page.locator(`[data-order="${ORDER.lapsed}"]`)).toHaveCount(1);
    await expect(page.locator(`[data-order="${ORDER.confirmed}"]`)).toHaveCount(1);
    // CREATED is not needs_action -- the server's map, not the client's.
    await expect(page.locator(`[data-order="${ORDER.created}"]`)).toHaveCount(0);

    await page.locator('[data-filter="completed"]').click();
    await expect(page.locator(`[data-order="${ORDER.completed}"]`)).toHaveCount(1);
    await expect(page.locator(`[data-order="${ORDER.submitted}"]`)).toHaveCount(0);

    // D-153 stays STATED (no buyer name still owed); D-154's sentence is
    // GONE -- the bucket is the server's, and the page-local disclaimer with
    // it. A sentence outliving its gap reads as an unfinished screen.
    await expect(page.locator('[data-gap="D-153"]')).toBeVisible();
    await expect(page.locator('[data-gap="D-154"]')).toHaveCount(0);
  });
});

/** Anything a payment, handoff, evidence, purchase or courier-assignment action would call. */
const PROHIBITED_CALL =
  /payment|reissue|custody|handoff|\/qr|refund|evidence|courier-assignment|\/ready\b|confirm/i;

test.describe('SC-04 -- payment and handoff are removed, not disabled (D24-01) @safety', () => {
  test('no order state offers a payment, evidence, reissue or handoff control, and none calls such an endpoint', async ({
    page,
  }) => {
    const prohibited: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith('/v1/') && PROHIBITED_CALL.test(u.pathname)) {
        prohibited.push(`${r.method()} ${u.pathname}`);
      }
    });

    for (const [name, id] of Object.entries(ORDER)) {
      await openDetail(page, id);
      await expect(page.locator('.payment-region [data-deferred="payment"]'), name).toBeVisible();
      await expect(page.locator('.handoff-region [data-deferred="handoff"]'), name).toBeVisible();
      for (const sel of [
        '[data-decision]',
        '#detail-confirm',
        '#detail-reject',
        '[data-action="view-evidence"]',
        '[data-action="reissue-instructions"]',
        '[data-action="mark-ready"]',
        '[data-action="assign-courier"]',
        '[data-action="custody-transfer"]',
        '[data-action="show-qr"]',
        '#courier-select',
      ]) {
        expect(await page.locator(sel).count(), `${name}: ${sel}`).toBe(0);
      }
      const text = await page.locator('main').innerText();
      expect(text, name).not.toMatch(
        /Confirm Payment Received|Payment Not Received|View evidence|Reissue payment instructions|Mark Ready|Show QR|Hand to the courier|Assign a courier/,
      );
    }
    expect(prohibited, prohibited.join(' | ')).toEqual([]);
  });

  test('a direct URL to the evidence or QR view is not a route: there is no evidence or QR modal to open', async ({
    page,
  }) => {
    await openDetail(page, ORDER.submitted);
    await expect(page.locator('.modal')).toHaveCount(0);
    // The old modals were opened by the removed buttons; nothing else mounts them.
    await page.goto(`${detail(ORDER.submitted)}?modal=evidence`);
    await expect(page.locator('.state-region')).toBeVisible();
    await expect(page.locator('.modal')).toHaveCount(0);
  });
});

test.describe('SC-04 -- terminal orders', () => {
  test('render history and no actions', async ({ page }) => {
    await openDetail(page, ORDER.completed);

    await expect(page.locator('[data-state="TERMINAL"]')).toHaveCount(1);

    /*
     * SHOW QR IS PRESENT AND DISABLED (D-169). It used to stay operable
     * here: `paid` includes COMPLETED, so a terminal screen offered a live
     * signed handoff token for an order that is over. Present rather than
     * gone -- the handoff region renders-not-hides -- but inert, and clicking
     * it (force, past the disabled attribute) opens nothing.
     */
    await expect(page.locator('[data-action="show-qr"]')).toHaveCount(0);
    await expect(page.locator('.modal.qr')).toHaveCount(0);

    // The line's state is a LABEL, not the raw enum (D-171): a seller reads
    // "Fulfilled", and the word came through the catalogue.
    await expect(page.locator('.line-state')).toHaveText('Fulfilled');

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

  test('reissue is not offered where the database would refuse it', async ({ page }) => {
    /*
     * D-170. fn_reissue_instructions accepts CREATED, NOTIFIED and
     * PAYMENT_SUBMITTED; the control used to render enabled on
     * PAYMENT_CONFIRMED, where the POST always raises "order is not payable"
     * -- AFTER the seller has spent an OTP on the step-up the action
     * requires. A control the server will refuse must not cost a step-up to
     * find out. Both sides asserted: absent where refused, present where
     * accepted.
     */
    await openDetail(page, ORDER.confirmed);
    await expect(page.locator('[data-action="reissue-instructions"]')).toHaveCount(0);

    // D24-01: reissuing payment instructions is removed from every state, including the ones
    // fn_reissue_instructions still accepts.
    await openDetail(page, ORDER.submitted);
    await expect(page.locator('[data-action="reissue-instructions"]')).toHaveCount(0);
  });

  test('the SC-04 gap sentences carry their markers, and the markers are load-bearing', async ({
    page,
  }) => {
    /*
     * T10's report claimed all six stated gaps were e2e-asserted; only
     * SC-03's two were (the T10 adversarial pass, upheld 3/3). These are the
     * SC-04 two. Asserted BY MARKER, so deleting the data-gap attribute --
     * not just the sentence -- fails the suite: a marker a test never reads
     * is decorative (D-121's class).
     */
    await openDetail(page, ORDER.submitted);
    await expect(page.locator('.buyer-region [data-gap="D-153"]')).toBeVisible();
    // D-157 is ANSWERED (T15 Phase 3): the courier endpoint returns
    // account_id, the assignment control is live, and its gap sentence is
    // gone. The marker must be absent -- a sentence outliving its gap is a
    // screen apologising for something that works.
    await expect(page.locator('[data-gap="D-157"]')).toHaveCount(0);
  });

  test('D-157 superseded: order detail has no courier assignment at all (handoff is deferred)', async ({
    page,
  }) => {
    for (const id of [ORDER.confirmed, ORDER.submitted]) {
      await openDetail(page, id);
      await expect(page.locator('#courier-select')).toHaveCount(0);
      await expect(page.locator('[data-action="assign-courier"]')).toHaveCount(0);
      await expect(page.locator('[data-action="custody-transfer"]')).toHaveCount(0);
    }
  });
});

test.describe('a deadline already past -- D-167', () => {
  /*
   * THE ASSERTION IS A REQUEST COUNT, NOT A RENDERING. D-167: <Deadline>'s
   * once-only guard was a ref, ScreenState remounted its subtree on every
   * READY<->STALE flip, and the refetch the guard permitted caused the very
   * remount that reset the guard -- ~68 requests/second, unbounded, on any
   * order whose displayed deadline had passed. Every RENDERING assertion
   * passed throughout: the screen looked perfect while it hammered the API.
   *
   * The seeded `lapsed` order exists for this test: PAYMENT_SUBMITTED, its
   * confirmation deadline hours behind now(). Legal state (the clock
   * consistency constraint binds clock_stopped_at, not sla_deadline), and no
   * worker runs under the harness, so the expiry sweep cannot move it.
   *
   * Budget: initial load, at most one elapsed refetch, plus modest headroom
   * for React strict-effects double-invocation. The broken code blows past
   * this in the first second.
   */
  test('refetches at most once, instead of forever', async ({ page }) => {
    let detailRequests = 0;
    page.on('request', (r) => {
      if (r.url().includes(`/v1/seller/orders/${ORDER.lapsed}`)) detailRequests += 1;
    });

    await openDetail(page, ORDER.lapsed);
    // D24-01: no confirmation clock is drawn for a decision nobody here can make, so there is
    // nothing to elapse. The boundedness assertion below is kept: it guards the refetch loop class
    // (D-167), whose RESERVATION-clock twin has no lapsed seed row (registered as a coverage gap).
    await expect(page.locator('[data-clock]')).toHaveCount(0);

    // Hold the screen open across several would-be loop iterations.
    await page.waitForTimeout(4_000);

    expect(
      detailRequests,
      `the screen made ${detailRequests} requests for one order in ~4s -- ` +
        'the elapsed-deadline refetch is looping (D-167)',
    ).toBeLessThanOrEqual(4);
  });
});
