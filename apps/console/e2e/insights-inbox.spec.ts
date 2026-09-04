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
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEEDED } from './helpers/session';

const BUYER_STATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.auth', 'buyer-state.json');

const base = `/s/${SEEDED.sellerId}`;

test.describe('SC-12 Analytics -- the wire, not the wireframe', () => {
  test('overview renders real counts; the period picker DRIVES the wire; full renders the locked entitlement', async ({ page }) => {
    await page.goto(`${base}/insights`);
    await expect(page.locator('[data-screen="SC-12"]')).toBeVisible();

    // The seed's exact numbers -- a wrong join breaks these.
    const tile = (label: string) => page.locator('.kpi-tile', { hasText: label });
    await expect(tile('Published products').locator('.kpi-value')).toHaveText('1');
    await expect(tile('Orders in this period').locator('.kpi-value')).toHaveText('5');
    await expect(tile('Active reservations').locator('.kpi-value')).toHaveText('4');
    await expect(tile('Completed handoffs').locator('.kpi-value')).toHaveText('0');

    // The picker is REAL now (T15 Phase 4): the old fixed-window sentence is
    // gone, the caption is the SERVER's echo of the window it resolved...
    await expect(page.getByText(/A period picker arrives when the server accepts one/)).toHaveCount(0);
    await expect(page.locator('[data-window]')).toContainText(/Showing \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/);

    // ...and choosing a period RE-FETCHES with a real date bound, asserted at
    // the wire -- a picker that changed nothing would be decorative (D-226's
    // objection, answered rather than repeated).
    const refetch = page.waitForResponse(
      (r) => r.url().includes('/v1/seller/analytics/overview?from=') && r.request().method() === 'GET',
    );
    await page.locator('[data-period="7"]').click();
    const resp = await refetch;
    const url = new URL(resp.url());
    const from = url.searchParams.get('from') as string;
    // The 7-day bound really is ~7 days back, and the server echoes it.
    const daysBack = (Date.now() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000;
    expect(daysBack).toBeGreaterThan(6);
    expect(daysBack).toBeLessThan(9);
    await expect(page.locator('[data-window]')).toContainText(`Showing ${from}`);

    // S3.5: the entitlement-locked section is VISIBLE, disabled, unlock named
    // -- and it is the REAL server's 409 that put it there.
    const locked = page.locator('[data-state="NO_ENTITLEMENT"]');
    await expect(locked).toBeVisible();
    await expect(locked.getByRole('button')).toBeDisabled();
    await expect(page.getByText(/does not include this section/)).toBeVisible();

    /*
     * EXPORT IS ABSENT IN BOTH DIRECTIONS NOW (T23 Phase 3, D-288).
     *
     * D-232 still holds and is why there is no control: the export worker and
     * its job table do not exist, and a button faked at a 404 is worse than an
     * absence. What changed is the SENTENCE. It advertised a paid feature
     * ("Business") on a screen where it cannot be bought, and the plan
     * comparison does not sell it either -- so it quoted a price to a seller
     * with no way to pay it. Either sell it or say nothing.
     *
     * Asserted as a PAIR, because the failure this guards is either half
     * arriving alone: a control with no service behind it, or the
     * advertisement coming back.
     */
    await expect(page.getByRole('button', { name: /export/i })).toHaveCount(0);
    await expect(page.getByText(/Exporting your data/)).toHaveCount(0);
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
    // NOTHING here is a control (S10) -- buttons, links, or inputs.
    const sc13 = page.locator('[data-screen="SC-13"]');
    await expect(sc13.getByRole('button')).toHaveCount(0);
    await expect(sc13.getByRole('link')).toHaveCount(0);
    await expect(sc13.locator('input, select, textarea')).toHaveCount(0);
  });
});

test.describe('SC-14 Reviews -- read-only, and the empty state teaches the gate', () => {
  test('explains the QR dependency and offers no moderation of any kind', async ({ page }) => {
    await page.goto(`${base}/insights/reviews`);
    await expect(page.locator('[data-screen="SC-14"]')).toBeVisible();
    await expect(page.getByText(/after a buyer scans the QR at handoff/)).toBeVisible();
    // S14: this empty state offers NO action, deliberately -- an action here
    // is an invitation to game the gate (the pass's M3 caught the first
    // version offering one, with this very test asserting the violation).
    const empty = page.locator('[data-screen="SC-14"] .empty');
    await expect(empty.getByRole('button')).toHaveCount(0);
    await expect(empty.getByRole('link')).toHaveCount(0);
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
  /*
   * THE PLANT IS DERIVED FROM THE SERVICE AND THE DDL, NOT FROM THE
   * COMPONENT (the pass's B1: the first plant copied the code's invented
   * evidence vocabulary and certified fiction). Kinds below are
   * core.claim_evidence_kind values the attach trigger actually inserts;
   * reference_id is NOT NULL at the schema; severity is always ORDINARY on
   * real buyer claims.
   */
  const CLAIM = '99999999-9999-4999-8999-999999999999';
  const planted = (state: string, decided: string | null) => ({
    id: CLAIM,
    order_id: '5eed0000-0000-4000-8000-000000000013',
    reservation_id: null,
    trigger: 'SLA_BREACH',
    state,
    severity: 'ORDINARY',
    remedy: null,
    outcome: null,
    outcome_reason: null,
    opened_at: '2026-08-26T09:10:00Z',
    review_deadline: '2026-09-27T14:00:00Z',
    decided_at: decided,
    viewer: 'SELLER',
    evidence: [
      {
        kind: 'ORDER_TRANSITIONS',
        reference_id: '5eed0000-0000-4000-8000-000000000013',
        attached_at: '2026-08-26T09:10:00Z',
      },
      {
        kind: 'CHAT_HISTORY',
        reference_id: '5eed0000-0000-4000-8000-000000000013',
        attached_at: '2026-08-26T09:10:00Z',
      },
    ],
  });

  test('regions render from the wire shape; the remedy POST reaches the real server', async ({ page, context }) => {
    await context.route(`**/v1/claims/${CLAIM}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: planted('AWAITING_SELLER_EVIDENCE', null),
      });
    });
    await page.goto(`${base}/claims/${CLAIM}`);
    await expect(page.locator('[data-screen="SC-16"]')).toBeVisible();

    // The factual-language rule, the DDL's evidence kinds as words, the
    // read-only sentence, the deadline.
    await expect(page.getByText('This is a statement of recorded facts, not an accusation.')).toBeVisible();
    await expect(page.getByText('Order history')).toBeVisible();
    await expect(page.getByText('Conversation history')).toBeVisible();
    await expect(page.getByText('ORDER_TRANSITIONS')).toHaveCount(0);
    await expect(page.getByText(/Evidence is read-only/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Deadline' })).toBeVisible();

    // M7's discrimination: the POST is watched at the wire -- method, path,
    // Idempotency-Key header, body -- and the REAL server's answer for an
    // unknown claim renders as its OWN copy ('Not found.'), which no other
    // failure on this path shares (a keyless POST says the retry-key
    // sentence; a network drop says the transport one).
    const posted = page.waitForRequest(
      (r) =>
        r.method() === 'POST' &&
        r.url().includes(`/v1/seller/claims/${CLAIM}/remedy`) &&
        Boolean(r.headers()['idempotency-key']) &&
        r.postData() === '{"remedy":"REFUND"}',
    );
    await page.locator('#remedy-refund').check();
    await page.getByRole('button', { name: 'Record this remedy' }).click();
    await posted;
    await expect(page.getByText('Not found.', { exact: true })).toBeVisible();
  });

  test('RESOLVED renders TERMINAL: the badge, the history, and NO controls', async ({ page, context }) => {
    await context.route(`**/v1/claims/${CLAIM}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: planted('RESOLVED', '2026-08-27T10:20:00Z'),
      });
    });
    await page.goto(`${base}/claims/${CLAIM}`);
    await expect(page.locator('[data-screen="SC-16"]')).toBeVisible();
    await expect(page.locator('[data-state="TERMINAL"]')).toBeVisible();
    await expect(page.getByText(/Decided/)).toBeVisible();
    // The case has ended: only history remains (S10 / wireframe annotation 3).
    await expect(page.locator('.claim-remedy')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Record this remedy' })).toHaveCount(0);
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
    // The buyer session comes from globalSetup's ONE sign-in (the OTP
    // budget is per phone; a per-spec sign-in spent it -- D-124's class,
    // rediscovered when the courier arm arrived). The state file also keeps
    // this context free of the SELLER's cookies, which the runner would
    // otherwise apply to browser.newContext().
    const buyerCtx = await browser.newContext({ storageState: BUYER_STATE });
    try {
      // BEFORE anything exists: the EMPTY state teaches the role split.
      await page.goto(`${base}/inbox`);
      await expect(page.getByText(/separate from any buyer-role conversations/)).toBeVisible();

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

      // A SECOND buyer message carries an ORDER ANCHOR (D-73: the anchor
      // rides the message; the seed's confirmed order belongs to this
      // buyer-seller pair, so the ownership probe passes).
      const anchored = await buyerCtx.request.post(
        `http://localhost:3000/v1/conversations/${conversation_id}/messages`,
        {
          headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-Adulis-Client': 'web/0.0.0', ...origin },
          data: { text: 'Is my paid order ready?', order_id: '5eed0000-0000-4000-8000-000000000013' },
        },
      );
      expect(anchored.status()).toBe(201);

      // The seller console: the list shows the thread (and says what the
      // wire does not carry), the thread shows the buyer's words, and the
      // reply is DRIVEN -- a real POST through the real key gate.
      await page.goto(`${base}/inbox`);
      await expect(page.locator('[data-screen="SC-20"]')).toBeVisible();
      // The sentence names the PERMANENT fact first and the backlog second:
      // core.person has no name column, so a buyer name is not "yet" (D-288).
      await expect(page.getByText(/Adulis stores no name for a buyer account/)).toBeVisible();
      await expect(page.getByText(/Message previews, unread markers/)).toBeVisible();
      await expect(page.getByText(/Buyer names[^.]*not reported by the server yet/)).toHaveCount(0);
      await page.locator('.conversation-row a').first().click();

      await expect(page.locator('[data-screen="SC-21"]')).toBeVisible();
      await expect(page.getByText('Can I collect after 5 PM?')).toBeVisible();

      // The pin derives from the MESSAGES (D-73): the anchored message put
      // an order in the thread, so the pinned card renders with its link.
      await expect(page.locator('.pinned-order')).toBeVisible();
      await expect(page.locator('.pinned-order').getByRole('link', { name: 'Open order' })).toBeVisible();

      // Oldest first: the first message renders ABOVE the second.
      const bodies = page.locator('.message-body');
      await expect(bodies.first()).toHaveText('Can I collect after 5 PM?');

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
