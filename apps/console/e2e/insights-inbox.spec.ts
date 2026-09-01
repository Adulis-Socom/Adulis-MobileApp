/**
 * C-7's done-clauses, asserted by a machine, against the real API -- groups
 * D (conversations) and E (trust) plus SC-30, ADU-CON-03 v1.2 S9/S10/S12.
 *
 * The determinism this file leans on, all real:
 *  - the seeded seller's analytics overview is exactly {1 published, 5
 *    orders, 4 active reservations, 0 handoffs, 0 followers}, and its
 *    analytics/full is a 409 TIER_LIMIT_REACHED (no subscription -> LISTED
 *    -> no tier definition -> fail closed) -- the NO_ENTITLEMENT branch;
 *  - reviews and claims are empty (no seeded rows) -- the two empty states
 *    whose COPY is the point;
 *  - the seller's own sign-in (globalSetup, always a fresh device on a reset
 *    database) mints a real NEW_DEVICE_SIGNIN notification -- SC-30 always
 *    has at least one unread row to mark read FOR REAL;
 *  - a second signed-in context (the seeded BUYER account) creates a real
 *    conversation and message through the buyer wire, and the seller
 *    console reads and REPLIES through its own -- Companion parity driven,
 *    not asserted from a render.
 *
 * One plant (the upgrade-required pattern): SC-16's claim detail, because no
 * claim can exist in this harness without violating an order's state
 * machine. The remedy POST is then driven into the REAL server's 404 --
 * which can only arrive PAST the idempotency-key gate, so the one assertion
 * proves the key plumbing and the error rendering at once (the C-6 lesson).
 */
import { test, expect } from '@playwright/test';
import { SEEDED, signInAs } from './helpers/session';

const base = `/s/${SEEDED.sellerId}`;
const BUYER_PHONE = '+251900000002';

test.describe('SC-12 Analytics -- the wire, not the wireframe', () => {
  test('overview renders real counts; full renders the locked entitlement; the fixed window is said', async ({ page }) => {
    await page.goto(`${base}/insights`);
    await expect(page.locator('[data-screen="SC-12"]')).toBeVisible();

    // The seed's exact numbers -- a wrong join breaks these.
    const tile = (label: string) => page.locator('.kpi-tile', { hasText: label });
    await expect(tile('Published products').locator('.kpi-value')).toHaveText('1');
    await expect(tile('Orders').first().locator('.kpi-value')).toHaveText('5');
    await expect(tile('Active reservations').locator('.kpi-value')).toHaveText('4');
    await expect(tile('Completed handoffs').locator('.kpi-value')).toHaveText('0');

    // The 30-day window is the server's and FIXED; the absent picker is said.
    await expect(page.getByText(/All figures cover the last 30 days/)).toBeVisible();

    // S3.5: the entitlement-locked section is VISIBLE, disabled, unlock named
    // -- and it is the REAL server's 409 that put it there.
    const locked = page.locator('[data-state="NO_ENTITLEMENT"]');
    await expect(locked).toBeVisible();
    await expect(locked.getByRole('button')).toBeDisabled();
    await expect(page.getByText(/does not include this section/)).toBeVisible();

    // Export exists on no wire; the absence is words, not a dead button.
    await expect(page.getByText(/Exporting your data/)).toBeVisible();
    await expect(page.getByRole('button', { name: /export/i })).toHaveCount(0);
  });
});

test.describe('SC-13 Trust -- the two sentences, and the honest absence', () => {
  test('states independence and computedness; invents no number', async ({ page }) => {
    await page.goto(`${base}/insights/trust`);
    await expect(page.locator('[data-screen="SC-13"]')).toBeVisible();
    await expect(
      page.getByText('Trust level and subscription plan are independent. Paying for a plan does not change this level.'),
    ).toBeVisible();
    await expect(page.getByText(/cannot be shown yet/)).toBeVisible();
    // NOTHING here is a control (S10).
    await expect(page.locator('[data-screen="SC-13"]').getByRole('button')).toHaveCount(0);
  });
});

test.describe('SC-14 Reviews -- read-only, and the empty state teaches the gate', () => {
  test('explains the QR dependency and offers no moderation of any kind', async ({ page }) => {
    await page.goto(`${base}/insights/reviews`);
    await expect(page.locator('[data-screen="SC-14"]')).toBeVisible();
    await expect(page.getByText(/after a buyer scans the QR at handoff/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open completed orders' })).toBeVisible();
  });
});

test.describe('SC-15 Claims -- the empty list is good news', () => {
  test('reads as a positive condition and offers NO action', async ({ page }) => {
    await page.goto(`${base}/claims`);
    await expect(page.locator('[data-screen="SC-15"]')).toBeVisible();
    const empty = page.locator('[data-screen="SC-15"] .empty');
    await expect(empty.getByText(/That is good news/)).toBeVisible();
    // Deliberately actionless (S14): no button, no link, in the empty block.
    await expect(empty.getByRole('button')).toHaveCount(0);
    await expect(empty.getByRole('link')).toHaveCount(0);
  });
});

test.describe('SC-16 Claim detail -- planted render, real refusal', () => {
  test('regions render from the wire shape; the remedy POST reaches the real server', async ({ page, context }) => {
    const CLAIM = '99999999-9999-4999-8999-999999999999';
    await context.route(`**/v1/claims/${CLAIM}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          id: CLAIM,
          order_id: '5eed0000-0000-4000-8000-00000000000b',
          reservation_id: null,
          trigger: 'SLA_BREACH',
          state: 'AWAITING_SELLER_EVIDENCE',
          severity: null,
          remedy: null,
          outcome: null,
          outcome_reason: null,
          opened_at: '2026-08-26T09:10:00Z',
          review_deadline: '2026-09-27T14:00:00Z',
          decided_at: null,
          viewer: 'SELLER',
          evidence: [
            { kind: 'RESERVATION', reference_id: null, attached_at: '2026-08-26T09:10:00Z' },
            { kind: 'CONVERSATION', reference_id: null, attached_at: '2026-08-26T09:10:00Z' },
          ],
        },
      });
    });
    await page.goto(`${base}/claims/${CLAIM}`);
    await expect(page.locator('[data-screen="SC-16"]')).toBeVisible();

    // The factual-language rule, the read-only evidence, the deadline.
    await expect(page.getByText('This is a statement of recorded facts, not an accusation.')).toBeVisible();
    await expect(page.getByText('Reservation record')).toBeVisible();
    await expect(page.getByText(/Evidence is read-only/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Deadline' })).toBeVisible();

    // The remedy control is complete (radio + submit), and the POST goes to
    // the REAL server, which 404s an unknown claim -- an answer that can
    // only arrive past the idempotency-key gate. The refusal RENDERS.
    await page.locator('#remedy-refund').check();
    await page.getByRole('button', { name: 'Record this remedy' }).click();
    await expect(page.locator('.problem')).toBeVisible();
  });
});

test.describe('SC-20/SC-21 -- a real conversation, both sides driven', () => {
  test('a buyer writes through the buyer wire; the seller reads, is told what is absent, and replies', async ({ browser, page, baseURL }) => {
    /*
     * The second context is the seeded BUYER account, signed in for real
     * (its own OTP through the dev adapter). The conversation and the first
     * message travel the buyer wire; everything the seller side then does is
     * the console under test.
     */
    // EXPLICITLY cookie-free: the test runner applies `use` options --
    // including the SELLER's storageState -- to browser.newContext(), and a
    // buyer request carrying the seller's session cookie trips the CSRF
    // origin middleware (a cookie-carrying write with no Origin is 403).
    const buyerCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      await signInAs(buyerCtx, { phone: BUYER_PHONE, sellerId: SEEDED.sellerId });
      // A cookie-carrying WRITE must present the console's exact Origin
      // (the CSRF pair's server half) -- the browser does this for the app;
      // an API-context request says it explicitly.
      const origin = { Origin: baseURL ?? '' };
      const created = await buyerCtx.request.post('http://localhost:3000/v1/conversations', {
        headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-Adulis-Client': 'web/0.0.0', ...origin },
        data: { seller_id: SEEDED.sellerId },
      });
      expect(created.status()).toBe(201);
      const { conversation_id } = (await created.json()) as { conversation_id: string };
      const sent = await buyerCtx.request.post(
        `http://localhost:3000/v1/conversations/${conversation_id}/messages`,
        {
          headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-Adulis-Client': 'web/0.0.0', ...origin },
          data: { text: 'Can I collect after 5 PM?' },
        },
      );
      expect(sent.status()).toBe(201);

      // The seller console: the list shows the thread (and says what the
      // wire does not carry), the thread shows the buyer's words, and the
      // reply is DRIVEN -- a real POST through the real key gate.
      await page.goto(`${base}/inbox`);
      await expect(page.locator('[data-screen="SC-20"]')).toBeVisible();
      await expect(page.getByText(/Buyer names, message previews/)).toBeVisible();
      await page.locator('.conversation-row a').first().click();

      await expect(page.locator('[data-screen="SC-21"]')).toBeVisible();
      await expect(page.getByText('Can I collect after 5 PM?')).toBeVisible();

      await page.locator('#seller-message').fill('Yes, 5:30 PM works.');
      await page.getByRole('button', { name: 'Send' }).click();
      await expect(page.locator('.message-seller').getByText('Yes, 5:30 PM works.')).toBeVisible();
    } finally {
      await buyerCtx.close();
    }
  });
});

test.describe('SC-30 Notifications -- real rows, real read state', () => {
  test('the sign-in security notification renders unread and marks read for real; the bell navigates', async ({ page }) => {
    // The bell is a link now, not a dead control.
    await page.goto(`${base}/`);
    await page.locator('.topbar .bell').click();
    await expect(page).toHaveURL(new RegExp(`${SEEDED.sellerId}/notifications$`));
    await expect(page.locator('[data-screen="SC-30"]')).toBeVisible();

    // The globalSetup sign-in on a fresh device minted this row for real.
    const row = page
      .locator('.notification-row', { hasText: 'A new device signed in to your account.' })
      .first();
    await expect(row).toBeVisible();
    await expect(row.getByText('Unread')).toBeVisible();

    // Mark read: a real runIdempotent POST; read state is the SERVER's.
    await row.getByRole('button', { name: 'Mark read' }).click();
    await expect(row.getByText('Read', { exact: true })).toBeVisible();
    await page.reload();
    await expect(
      page
        .locator('.notification-row', { hasText: 'A new device signed in to your account.' })
        .first()
        .getByText('Read', { exact: true }),
    ).toBeVisible();
  });
});
