/**
 * SC-01's readiness hub -- C-3's done-clause, now asserted by a machine.
 *
 * "Nine readiness items render from `readiness[]`, in any order, resumable."
 * Through T9 that clause was met by driving a browser once, by hand, and
 * reading the DOM. This is the same assertion, made on every run.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { SEEDED } from './helpers/session';

const BUYER_STATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.auth', 'buyer-state.json');

test.describe('SC-01 -- the readiness hub', () => {
  test('renders every item the server returned, and resumes across a reload', async ({ page }) => {
    await page.goto(`/s/${SEEDED.sellerId}`);

    const items = page.locator('[data-item]');
    await expect(items.first()).toBeVisible();

    // NOT "expect nine". The count is the SERVER's -- this screen renders
    // readiness[] and computes nothing (S3.1) -- so the test asserts the
    // screen shows what the API returned, and the API is where nine lives.
    const served = await page.request
      .get(`${process.env['E2E_API_BASE_URL'] ?? 'http://localhost:3000'}/v1/seller/readiness`, {
        headers: { 'X-Adulis-Seller': SEEDED.sellerId, 'X-Adulis-Client': 'web/0.0.0', Accept: 'application/json' },
      })
      .then((r) => r.json() as Promise<{ items: Array<{ code: string; satisfied: boolean }> }>);

    await expect(items).toHaveCount(served.items.length);
    for (const item of served.items) {
      const row = page.locator(`[data-item="${item.code}"]`);
      await expect(row).toHaveCount(1);
      await expect(row).toHaveAttribute('data-satisfied', String(item.satisfied));
    }

    // RESUMABLE. A wizard would remember a step; this has no step to remember,
    // so a reload is indistinguishable from a first visit. That is the
    // property, and it is the one a stored cursor would quietly break.
    const before = await page.locator('.progress').textContent();
    await page.reload();
    await expect(items).toHaveCount(served.items.length);
    await expect(page.locator('.progress')).toHaveText(before ?? '');
  });

  test('every unsatisfied item carries a control that lands on a real screen', async ({ page }) => {
    await page.goto(`/s/${SEEDED.sellerId}`);
    await expect(page.locator('[data-item]').first()).toBeVisible();

    // Collected BEFORE navigating. Reading an attribute off a row after
    // leaving the page it lives on hangs until the test times out -- the
    // element is detached and the locator waits for it forever. The first
    // version of this test did exactly that.
    const targets = await page.locator('[data-satisfied="false"]').evaluateAll((rows) =>
      rows.map((row) => ({
        code: row.getAttribute('data-item'),
        href: row.querySelector('a.readiness-action')?.getAttribute('href') ?? null,
        unrouted: row.querySelector('.readiness-action.unrouted') !== null,
      })),
    );
    expect(targets.length).toBeGreaterThan(0);

    /*
     * NO ROW IS SKIPPED (T11 Phase 5, D-172). The first version did
     * `if (!t.href) continue;` -- and Home renders an UNROUTED SPAN, not an
     * anchor, for any resolving-action kind missing from ACTION_ROUTE. So
     * the test skipped exactly the rows whose links were broken: delete a
     * route key and every affected row became a span, the loop body never
     * ran, and the suite stayed green while a seller lost the way to a
     * blocking requirement. Now every unsatisfied row must carry a ROUTED
     * link; a new server kind without a route fails here, by name, at the
     * moment it is introduced.
     *
     * (The unrouted-span rendering itself stays -- it is the right runtime
     * fallback for a kind this build does not know. What must be zero is
     * the count of rows that NEED it, in a build whose table is current.
     * Fixture limit, recorded: the seeded seller is INDIVIDUAL, so the
     * DECLARE_SELLER_TYPE and PROVIDE_COMPANY_DETAILS rows are satisfied
     * here and their routes are exercised only by this table being checked
     * at review, not by this navigation loop.)
     */
    const unrouted = targets.filter((t) => t.unrouted || !t.href);
    expect(
      unrouted.map((t) => t.code),
      'every unsatisfied readiness row must carry a routed resolving link -- ' +
        'these have none, which is D-146 wearing a span',
    ).toEqual([]);

    // D-146: four of six links fell through the router's catch-all and
    // navigated the seller straight back to Home -- a control that appears to
    // work, does nothing visible, and teaches that the readiness list is
    // decorative. Following each one is the only way to know; reading the
    // route table is what missed it.
    for (const t of targets) {
      await page.goto(t.href as string);

      // THE URL IS THE ASSERTION, and the first version of this test got that
      // wrong. It checked that Home's readiness list was absent -- which is
      // true for an instant after `goto`, BEFORE the catch-all's
      // `<Navigate>` has run, so the planted regression passed. A redirect is
      // a thing that happens slightly later; the only stable way to catch it
      // is to ask where the browser ended up.
      await expect(
        page,
        `"Complete this" for ${t.code} did not stay at ${t.href} -- the router sent it elsewhere`,
      ).toHaveURL(new RegExp(`${t.href}$`));

      // And having stayed, it is a screen rather than Home.
      await expect(page.locator('[data-item]')).toHaveCount(0);
    }
  });
});

test.describe('SC-01 -- what needs you (T16 Phase 3)', () => {
  /*
   * THE STRONGEST ASSERTION IS THE ORDERING (the work order's own words):
   * obligations of THREE different kinds, nearest deadline first, from the
   * REAL server. The seed supplies two payment entries (one overdue -- the
   * lapsed order; the harness runs no jobs, so no SYSTEM claim exists and it
   * rightly carries the pre-lapse sentence) and the confirmed-unready order
   * (clock_stopped_at + the 7-day window). The third KIND arrives through the
   * BUYER WIRE: the seeded buyer files a real claim (review deadline +2 days),
   * which must interleave STRICTLY BETWEEN the fresh payment (+~1 day) and
   * the unready order (+~6 days) -- an ordering neither a per-kind grouping
   * nor a client-side sort of anything else would reproduce.
   *
   * Residue: the claim stays open (no delete path). Later specs tolerate it
   * -- SC-29 is already deletion-blocked by the live orders, and nothing
   * after this file asserts an empty claims list (insights-inbox, which
   * does, runs alphabetically BEFORE this file).
   */
  test('three kinds, nearest deadline first, consequences from the server', async ({
    browser,
    page,
    baseURL,
  }) => {
    // The buyer files the claim through the buyer wire, for real.
    const buyerCtx = await browser.newContext({ storageState: BUYER_STATE });
    try {
      const filed = await buyerCtx.request.post('http://localhost:3000/v1/claims', {
        headers: {
          'Idempotency-Key': crypto.randomUUID(),
          'X-Adulis-Client': 'web/0.0.0',
          Origin: baseURL ?? '',
        },
        data: { order_id: '5eed0000-0000-4000-8000-000000000014', trigger: 'GOODS_NOT_RECEIVED' },
      });
      expect(filed.status()).toBe(201);
    } finally {
      await buyerCtx.close();
    }

    await page.goto(`/s/${SEEDED.sellerId}`);
    const rows = page.locator('[data-obligation]');
    await expect(rows.first()).toBeVisible();

    // The region sits ABOVE the readiness list (S3.1: a seller opening Home
    // to find out what needs them should not scroll past anything).
    const order = await page
      .locator('[data-obligation], [data-item]')
      .evaluateAll((els) => els.map((el) => (el.hasAttribute('data-obligation') ? 'OB' : 'RD')));
    expect(order.indexOf('RD')).toBeGreaterThan(order.lastIndexOf('OB'));

    // NEAREST DEADLINE FIRST, three kinds, the claim strictly interleaved --
    // rendered AS SERVED (the console sorts nothing, groups nothing).
    const kinds = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-obligation')));
    expect(kinds).toEqual([
      'PAYMENT_AWAITING_CONFIRMATION', // the lapsed order -- OVERDUE, first
      'PAYMENT_AWAITING_CONFIRMATION', // the fresh submission
      'CLAIM_AWAITING_SELLER', // the buyer's claim, +2 days
      'ORDER_NOT_READY', // the paid unready order, +~6 days
    ]);

    // The overdue entry renders the standing truth, not a countdown.
    await expect(rows.first().locator('.deadline-value')).toHaveText('Overdue');

    // The consequence is the SERVER's sentence, rendered verbatim -- never
    // composed by the client.
    await expect(
      rows.nth(1).getByText(
        'Confirm or reject before the deadline, or a claim opens against you automatically and the missed window is shown on your public store page.',
      ),
    ).toBeVisible();
    await expect(
      rows.nth(2).getByText('After the deadline the claim can be decided without your side of it.'),
    ).toBeVisible();
    await expect(
      rows.nth(3).getByText(
        'The buyer has already paid and is waiting. An order left unready invites a goods-not-received claim.',
      ),
    ).toBeVisible();

    // Tapping opens the object: the claim row links to the claim.
    await rows.nth(2).locator('a').click();
    await expect(page).toHaveURL(/\/claims\/[0-9a-f-]+$/);
  });

  test('life 2: obligations above the summary; empty reads as a good state; NO picker (R23)', async ({
    page,
    context,
  }) => {
    /*
     * The seeded seller is unpublished (life 1) and genuinely obligated, so
     * BOTH facts are planted at the wire (the R21 pattern; only the client
     * renders here): readiness all-satisfied summons life 2, and an empty
     * obligations list summons the good state. The summary's numbers stay
     * REAL -- the two windowed overview reads hit the live API.
     */
    await context.route('**/v1/seller/readiness', async (route) => {
      const real = await route.fetch();
      const body = (await real.json()) as { items: Array<{ satisfied: boolean }> };
      await route.fulfill({
        response: real,
        json: { items: body.items.map((i) => ({ ...i, satisfied: true })) },
      });
    });
    await context.route('**/v1/seller/obligations', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({ status: 200, contentType: 'application/json', json: { data: [] } });
    });

    await page.goto(`/s/${SEEDED.sellerId}`);

    // Life 2 renders; the empty obligation state reads as GOOD NEWS beside
    // the summary, never an empty box.
    await expect(page.locator('[data-brief]')).toBeVisible();
    await expect(page.locator('[data-nothing-needed]')).toHaveText('Nothing needs you right now.');

    // R23: the week-on-week orders line renders from TWO real windowed reads.
    await expect(page.locator('[data-brief-orders]')).toContainText(/Orders this week: \d+ \(previous 7 days: \d+\)/);

    // AND THERE IS NO PICKER. SC-12 owns it; Home answers a question nobody
    // asked when it offers one.
    await expect(page.locator('[data-period]')).toHaveCount(0);
  });
});
