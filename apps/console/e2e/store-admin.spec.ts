/**
 * C-6's done-clauses, asserted by a machine, against the real API -- groups F
 * (store) and G (administration), ADU-CON-03 v1.2 S11/S12.
 *
 * The C-5 lesson (D-221) is the design brief here: the mutation paths are
 * DRIVEN, not rendered -- fulfilment saves for real and reads back, closure
 * closes and reopens a real seller, an availability override is written and
 * removed, a courier is invited and revoked, notification preferences PATCH
 * a real row, and the payout change drives the ENTIRE step-up pipeline (the
 * modal opens, a real code leaves the dev SMS adapter, verify passes, the
 * action retries) into the seed's one deterministic answer: the NEW-DEVICE
 * lock, whose 409 must render as a message and not as silence.
 *
 * Two facts are planted at the wire (the upgrade-required.spec.ts pattern),
 * because the real server cannot be made to produce them in this harness:
 * a PENDING payout row (the 24h new-device lock blocks creating one) for
 * R21's presence half, and nothing else.
 *
 * Order of tests matters only within the closure block (close -> reopen
 * restores the seed's ACTIVE state for later runs of anything).
 */
import { test, expect } from '@playwright/test';
import { SEEDED, currentSmsCode, nextSmsCode } from './helpers/session';

const base = `/s/${SEEDED.sellerId}`;

test.describe('More menu and shell navigation', () => {
  test('the four groups render and their entries navigate', async ({ page }) => {
    await page.goto(`${base}/more`);
    for (const heading of ['Insights', 'Store', 'Settings', 'Billing']) {
      await expect(page.locator('.more-menu').getByRole('heading', { name: heading })).toBeVisible();
    }
    // ALL fourteen entries, not a sample -- a typo in any one dead-ends a
    // seller (the pass's vacuity note on this test).
    for (const entry of [
      'Analytics', 'Trust and level', 'Reviews',
      'Profile', 'Fulfilment', 'Availability', 'Identity', 'Couriers',
      'Sessions and devices', 'Notifications', 'Team', 'Closing',
      'Subscription', 'Payout',
    ]) {
      await expect(page.locator('.more-menu').getByRole('link', { name: entry, exact: true })).toBeVisible();
    }
    await page.locator('.more-menu').getByRole('link', { name: 'Fulfilment' }).click();
    await expect(page).toHaveURL(new RegExp(`${SEEDED.sellerId}/fulfilment$`));
    await expect(page.locator('[data-screen="SC-18"]')).toBeVisible();
  });
});

test.describe('SC-17 Store profile -- loads, edits, and reads back (T15 Phase 4)', () => {
  test('shows status and handle, and a saved edit reads back from the server', async ({ page }) => {
    await page.goto(`${base}/profile`);
    await expect(page.locator('[data-screen="SC-17"]')).toBeVisible();

    // The read-back-owed sentence is GONE: the form loads the real profile.
    // (The gap sentence's removal is the claim; this is the proof.)
    await expect(page.getByText(/cannot be shown here yet/)).toHaveCount(0);

    // Status and handle are read back from the server, not inferred.
    await expect(page.locator('[data-screen="SC-17"] dd[data-status]')).not.toBeEmpty();
    const handle = page.locator('[data-screen="SC-17"] dd[data-handle]');
    await expect(handle).not.toBeEmpty();
    // The name field is POPULATED from the saved profile, not blank.
    await expect(page.locator('#sp-name')).not.toHaveValue('');

    // Deliberate keeps STAY -- the profile read carries no logo, and the
    // handle is fixed at creation (G1.9). These endpoints still do not exist.
    await expect(page.getByText('A store logo is not supported yet.')).toBeVisible();
    await expect(page.getByText(/handle is fixed when the store is created/)).toBeVisible();

    // Edit the name and save for real...
    await page.locator('#sp-name').fill('Seed Coffee Works');
    await expect(page.locator('.preview-card').getByText('Seed Coffee Works')).toBeVisible();
    const patched = page.waitForResponse(
      (r) => r.url().includes('/v1/seller/profile') && r.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Save profile' }).click();
    await patched;
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible();

    // ...and READ IT BACK end to end: a fresh load from the server shows the
    // edit. The write-only form could never prove this.
    await page.reload();
    await expect(page.locator('#sp-name')).toHaveValue('Seed Coffee Works');
    // The handle is stable across the reload (it is fixed, and now visible).
    await expect(page.locator('[data-screen="SC-17"] dd[data-handle]')).not.toBeEmpty();
  });
});

test.describe('SC-18 Fulfilment -- the set rule, driven', () => {
  test('refuses all-off, saves one method with its note, and reads it back', async ({ page }) => {
    await page.goto(`${base}/fulfilment`);
    await expect(page.locator('[data-screen="SC-18"]')).toBeVisible();

    // The seed sets no methods: saving the untouched all-off set REFUSES
    // with the rule's own sentence, client-side, before the wire is spent.
    await page.getByRole('button', { name: 'Save fulfilment' }).click();
    await expect(page.getByText('Turn on at least one way buyers can receive goods.')).toBeVisible();

    // Turn one on, write a buyer-visible note, save for real.
    await page.locator('#fm-BUYER_COLLECTION').check();
    await page
      .locator('#fm-note-BUYER_COLLECTION')
      .fill('Collect near Bole Medhanialem, weekdays after 2 PM.');
    await page.getByRole('button', { name: 'Save fulfilment' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    // THE READ-BACK IS THE PROOF THE WRITE LANDED: reload from the server.
    await page.reload();
    await expect(page.locator('#fm-BUYER_COLLECTION')).toBeChecked();
    await expect(page.locator('#fm-note-BUYER_COLLECTION')).toHaveValue(
      'Collect near Bole Medhanialem, weekdays after 2 PM.',
    );
    // The buyer-visibility rule is the LABEL, always on screen.
    await expect(page.getByText('Note - buyers see this before they reserve').first()).toBeVisible();
  });
});

test.describe('SC-19 Availability -- gates nothing; closures are dates', () => {
  test('states its one job, refuses a duplicate closure, writes and removes one', async ({ page }) => {
    await page.goto(`${base}/availability`);
    await expect(page.locator('[data-screen="SC-19"]')).toBeVisible();

    // The sentence that stops over-reporting: it restricts nothing.
    await expect(
      page.getByText('It does not restrict reservations, orders or messages.'),
    ).toBeVisible();
    // The read-back-owed sentence is GONE: the weekly pattern now loads.
    await expect(page.getByText(/Saved hours cannot be shown here yet/)).toHaveCount(0);

    // A closure date is written for real...
    await page.locator('#ov-date').fill('2027-01-07');
    await page.locator('#ov-note').fill('Closed for Genna');
    await page.getByRole('button', { name: 'Add closure date' }).click();
    await expect(page.locator('.override-list').getByText('2027-01-07')).toBeVisible();
    await expect(page.getByText('Closed for Genna')).toBeVisible();

    // ...a duplicate is refused with the spec's VALIDATION sentence...
    await page.locator('#ov-date').fill('2027-01-07');
    await page.getByRole('button', { name: 'Add closure date' }).click();
    await expect(page.getByText('That date is already marked closed.')).toBeVisible();

    // ...and removing it leaves the EMPTY state that teaches.
    await page.locator('.override-list li', { hasText: '2027-01-07' }).getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText(/No closure dates/)).toBeVisible();
  });

  test('the weekly pattern SAVES for real, and a sub-hour window is refused in words', async ({ page }) => {
    /*
     * The pass's B1: the database enforces a one-hour minimum
     * (availability_window_minimum) that neither the zod schema nor the
     * first client transcribed, and the unmapped 23514 rendered as a
     * retryable 500 -- "the platform is broken, try again", forever. The
     * refusal now happens HERE, in words, before the wire; and the valid
     * save is DRIVEN (this PUT had never been exercised by any test).
     */
    await page.goto(`${base}/availability`);
    await page.locator('.weekday-row', { hasText: 'Monday' }).getByRole('button', { name: 'Add a time window' }).click();
    await page.locator('#opens-0').fill('09:00');
    await page.locator('#closes-0').fill('09:30');
    await page.getByRole('button', { name: 'Save weekly hours' }).click();
    await expect(page.getByText('A window must be at least one hour.')).toBeVisible();

    await page.locator('#closes-0').fill('17:00');
    const put = page.waitForResponse(
      (r) => r.url().includes('/v1/seller/availability') && r.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save weekly hours' }).click();
    await put;
    await expect(page.getByText('Saved.')).toBeVisible();

    // READ-BACK end to end (T15 Phase 4): a fresh load shows the saved window,
    // in the editor -- the pattern the screen could never reopen before.
    await page.reload();
    await expect(page.locator('[data-screen="SC-19"]')).toBeVisible();
    await expect(page.locator('#opens-0')).toHaveValue('09:00');
    await expect(page.locator('#closes-0')).toHaveValue('17:00');
  });
});

test.describe('SC-22 Identity -- the sentences that are the screen', () => {
  test('explains both paths, offers no operator-only control, and mints a real bio code', async ({ page }) => {
    await page.goto(`${base}/eligibility`);
    await expect(page.locator('[data-screen="SC-22"]')).toBeVisible();

    await expect(
      page.getByText('No photo of any document is ever sent to or stored by Adulis.'),
    ).toBeVisible();
    // R26's company sentence.
    await expect(page.getByText(/about the named representative as an individual/)).toBeVisible();
    // G1.1: identity verification is operator-performed; NO start button.
    await expect(page.getByText(/performed directly by Adulis/)).toBeVisible();
    // The identity-check REGION exists and holds NO control of any name --
    // scoping beats guessing what a wrong button would be called.
    await expect(page.locator('.identity-check')).toBeVisible();
    await expect(page.locator('.identity-check').getByRole('button')).toHaveCount(0);

    // The linked-accounts list loads (T15 Phase 4) -- the seed links none, so
    // it teaches empty. Before, this list could not be read back at all.
    await expect(page.locator('[data-linked-accounts]')).toBeVisible();
    await expect(page.locator('[data-linked-accounts] [data-account]')).toHaveCount(0);

    // Account control mints a REAL code against the real API.
    await page.locator('#id-handle').fill('senabeauty');
    await page.getByRole('button', { name: 'Get a code' }).click();
    await expect(page.getByText('Post this code:')).toBeVisible();
    await expect(page.getByText(/ADU-[0-9A-F]{8}/)).toBeVisible();

    // The new PENDING account now appears in the list, read from the server.
    const account = page.locator('[data-linked-accounts] [data-account]');
    await expect(account).toHaveCount(1);
    await expect(account).toHaveAttribute('data-status', 'PENDING');

    // The CHECK is driven into the one deterministic answer this harness
    // holds: the fake platform adapter knows no such handle, the service
    // degrades to a retryable 503, and the failure renders as a banner WITH
    // the request id (S4.6) -- never silence (the pass's M11). (A VERIFIED "as
    // of <date>" needs the fake social register, an in-process API-test helper
    // the browser cannot reach; c1-onboarding asserts that path at the wire.)
    // Driven BEFORE the reload below: the minted code is session state, gone
    // on a fresh load -- which is correct, and why the reload goes last.
    await page.getByRole('button', { name: 'Check account control' }).click();
    const banner = page.locator('.problem');
    await expect(banner).toBeVisible();
    await expect(banner.locator('code')).toBeVisible();

    // And the list READS BACK across a fresh load: the account survives the
    // session that created it, which is the closed gap, end to end.
    await page.reload();
    await expect(page.locator('[data-linked-accounts] [data-account][data-status="PENDING"]')).toHaveCount(1);
  });
});

test.describe('SC-23 Couriers -- invite and revoke, for real', () => {
  test('teaches when empty, invites by phone, marks it pending, revokes with the warning', async ({ page }) => {
    await page.goto(`${base}/couriers`);
    await expect(page.locator('[data-screen="SC-23"]')).toBeVisible();

    // The seed has no couriers: the empty state teaches the mechanism.
    await expect(page.getByText('No couriers yet')).toBeVisible();

    // Invite a number with no account: same 201 as any other (G1.8), row
    // renders as a pending invitation. NOTHING was sent to the number.
    await page.locator('#courier-phone').fill('+251944000001');
    await page.getByRole('button', { name: 'Send invitation' }).click();
    const row = page.locator('.courier-row', { hasText: '+251944000001' });
    await expect(row).toBeVisible();
    await expect(row.getByText('Invitation pending')).toBeVisible();
    // Their own credentials, never the seller's -- always on screen.
    await expect(page.getByText('They sign in with their own code, never yours.')).toBeVisible();

    // Revoke: the immediate-access warning renders BEFORE the second tap.
    await row.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(
      row.getByText('Removing a courier ends their courier access immediately, including orders they hold.'),
    ).toBeVisible();
    await row.getByRole('button', { name: 'Remove courier' }).click();
    await expect(page.getByText('No couriers yet')).toBeVisible();

    // The columns the wireframe drew and the wire cannot carry are NAMED --
    // wait: with an empty list the note is hidden with the table; re-invite
    // to see it, then leave the row for the next run's reset to clear.
    await page.locator('#courier-phone').fill('+251944000002');
    await page.getByRole('button', { name: 'Send invitation' }).click();
    // Same correction as the inbox (D-288): a courier has no name to report,
    // ever, so only the assignments and the activity carry a "yet".
    await expect(page.getByText(/Adulis stores no name for an account/)).toBeVisible();
    await expect(
      page.getByText(/Current assignments and last activity are not reported by the server yet/),
    ).toBeVisible();
  });
});

test.describe('SC-24 Payout -- R21, the five facts, and the step-up pipeline', () => {
  test('cancel is ABSENT with no pending change, and the five facts render', async ({ page }) => {
    await page.goto(`${base}/payouts`);
    await expect(page.locator('[data-screen="SC-24"]')).toBeVisible();

    for (const fact of [
      'The new account takes effect in 24 hours, not now.',
      'The current details stay in force until then.',
      'Everyone with admin access is notified and that cannot be switched off.',
      'Orders already placed are unaffected.',
      'You can cancel any time before the new details activate.',
    ]) {
      await expect(page.getByText(fact)).toBeVisible();
    }

    // R21's absence half, against the REAL server (the seed has no pending
    // row): the control does not exist -- not disabled, ABSENT.
    await expect(page.getByRole('button', { name: /Cancel pending change/ })).toHaveCount(0);
  });

  test('a seller with no payout details meets NO lock, from the real GET (T18 Phase 4)', async ({
    page,
  }) => {
    /*
     * THIS TEST USED TO ASSERT THE OPPOSITE, and the change is the point of
     * T18 Phase 4. The harness device signed in minutes ago, so the 24h
     * new-device window is open -- but the seeded seller has NO ACTIVE payout
     * row, so there is no destination to redirect and the lock has no subject.
     * 0047 stopped it firing; this asserts the seller is no longer held.
     *
     * The history is worth keeping. T15 P4 made the lock render PROACTIVELY
     * from the GET instead of being discovered on a doomed POST's 409 (D-224).
     * T17 then reworded it, because telling a brand-new seller "a sign-in from
     * a device we have not seen ... if that was not you" reports a security
     * event that did not happen. T18 removed the state instead of wording it
     * better, which is why that string is gone rather than improved.
     *
     * The proactive panel and the write path read the SAME row by the SAME
     * predicate (0047 and payoutLockState's `act` CTE). A panel that disagrees
     * with the write path is worse than no panel, so this asserts the panel's
     * silence and c4-financial asserts the write path's 201 on the same state.
     */
    await page.goto(`${base}/payouts`);
    await expect(page.locator('[data-screen="SC-24"]')).toBeVisible();

    // No lock panel at all -- not a disabled one, not an empty one.
    await expect(page.locator('[data-payout-lock]')).toHaveCount(0);
    await expect(page.getByText(/Locked until/)).toHaveCount(0);
    await expect(page.getByText(/device we have not seen/)).toHaveCount(0);

    // R20's disabled-not-hidden rule still governs the CHANGE case; here there
    // is nothing to explain, so the control is simply available.
    await expect(page.locator('[data-action="change-payout"]')).toBeEnabled();

    // The five facts stay where they are -- before the control, never behind a
    // disclosure. Removing a lock must not remove the standing explanation.
    await expect(page.locator('.payout-facts')).toBeVisible();
  });

  test('the new-device lock keeps its security wording for an actual CHANGE (planted)', async ({
    page,
    context,
  }) => {
    /*
     * The other half of T17's first-set split, and the half that matters for
     * safety: a seller who HAS payout details and meets a new-device lock is
     * exactly the person the original sentence was written for -- someone whose
     * account may be being taken over. That warning must survive.
     *
     * Planted because the real harness cannot hold active details under this
     * lock (the real-GET test above is the locked, detail-less case).
     */
    await context.route('**/v1/seller/payout', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          active: {
            id: '33333333-3333-4333-8333-333333333333',
            bank_code: 'CBE',
            account_last4: '4821',
            state: 'ACTIVE',
            requested_at: '2026-08-01T10:00:00Z',
            activates_at: null,
            activated_at: '2026-08-02T10:00:00Z',
          },
          pending: null,
          payout_locked_until: '2026-09-04T10:00:00Z',
          reason: 'NEW_DEVICE',
          // The grant is PRESENT -- R20 is about a control that is rendered and
          // unavailable, not one that is absent. With an empty allowed_actions
          // the button is not drawn at all (D-155 gates rendering on the grant),
          // and "disabled" could not be asserted because there is nothing to
          // disable. The state forbids the action; the grant does not.
          allowed_actions: ['seller.payout:update'],
        },
      });
    });
    await page.goto(`${base}/payouts`);
    const lock = page.locator('[data-payout-lock]');
    await expect(lock).toHaveAttribute('data-payout-lock', 'NEW_DEVICE');
    // The warning stands, verbatim, for the person it was written for.
    await expect(lock.getByText(/device we have not seen/)).toBeVisible();
    await expect(lock.getByText(/If that was not you/)).toBeVisible();
    // R20: PRESENT and DISABLED -- not hidden, and not armed to waste a real
    // step-up code on a refusal the panel has already explained. T18 Phase 4
    // moved this assertion here from the real-GET test, because that test now
    // proves the opposite case (no lock at all); without the move, R20's
    // disabled rule would have lost its only assertion in the suite.
    await expect(page.locator('[data-action="change-payout"]')).toBeDisabled();
  });

  test('R21 presence half (planted): a pending row summons the cancel control', async ({ page, context }) => {
    // The real server cannot hold a pending row in this harness (the lock
    // above), so the GET is planted -- the client obligation under test is
    // R21's rendering, and only the client renders.
    await context.route('**/v1/seller/payout', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          active: {
            id: '11111111-1111-4111-8111-111111111111',
            bank_code: 'CBE',
            account_last4: '4821',
            state: 'ACTIVE',
            requested_at: '2026-08-01T10:00:00Z',
            activates_at: null,
            activated_at: '2026-08-02T10:00:00Z',
          },
          pending: {
            id: '22222222-2222-4222-8222-222222222222',
            bank_code: 'AWASH',
            account_last4: '9034',
            state: 'PENDING',
            requested_at: '2026-08-30T10:00:00Z',
            activates_at: '2026-08-31T10:00:00Z',
            activated_at: null,
          },
          // A plant derives from the server (D-227): the read carries
          // allowed_actions (D-155) and, since T15 Phase 4, the lock state.
          // This plant is the UNLOCKED shape, so the change control is live.
          payout_locked_until: null,
          reason: null,
          allowed_actions: ['seller.payout:update'],
        },
      });
    });
    await page.goto(`${base}/payouts`);
    await expect(page.getByRole('heading', { name: 'Pending change' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancel pending change/ })).toBeVisible();
    // The two decisions are PEERS: both render, neither is buried -- and with
    // no lock in the plant, the change control is ENABLED (the disabled state
    // belongs to the lock, which the real-GET test above proves).
    const change = page.getByRole('button', { name: /Change payout account/ });
    await expect(change).toBeVisible();
    await expect(change).toBeEnabled();
  });
});

test.describe('SC-25 Team -- the entitlement is the server\'s answer', () => {
  test('the seed seller is not Business: NO_ENTITLEMENT renders with the unlock named', async ({ page }) => {
    await page.goto(`${base}/team`);
    await expect(page.locator('[data-screen="SC-25"]')).toBeVisible();
    const gate = page.locator('[data-state="NO_ENTITLEMENT"]');
    await expect(gate).toBeVisible();
    await expect(gate.getByRole('button')).toBeDisabled();
    await expect(page.getByText('Business includes team access.')).toBeVisible();
  });

  test('the invite drives step-up and the POST reaches the REAL server (planted seats)', async ({ page, context }) => {
    /*
     * The seed is not Business, so the gate hides the whole form -- which is
     * exactly how the C-6 pass's A1 (no Idempotency-Key on the invite POST)
     * shipped green. Plant ONLY the seats flag so the form renders, then
     * drive the invite THROUGH the real step-up into the REAL server. The
     * server's answer -- 409 TIER_LIMIT_REACHED, "Your current plan does not
     * include this." -- can only arrive if the POST got PAST the
     * idempotency-key gate (a keyless POST 400s with a different message),
     * so this one assertion proves the key fix and the error rendering at
     * once.
     */
    await context.route('**/v1/seller/team', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const real = await route.fetch();
      const body = (await real.json()) as {
        data: unknown[];
        seats: unknown;
        allowed_actions: string[];
      };
      // The seed OWNER holds seller.staff:admin, so the real body already
      // carries the code the form gates on; the plant only flips seats.
      expect(body.allowed_actions).toContain('seller.staff:admin');
      await route.fulfill({ response: real, json: { ...body, seats: { allowed: true, cap: 5 } } });
    });
    await page.goto(`${base}/team`);
    await page.locator('#tm-phone').fill('+251977000111');
    const before = currentSmsCode();
    await page.getByRole('button', { name: 'Add member - code required' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Enter the code to change your team.')).toBeVisible();
    const code = await nextSmsCode(before);
    await page.locator('#stepup-code').fill(code);
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByText('Your current plan does not include this.')).toBeVisible();
  });
});

test.describe('SC-26 Subscription -- honest about having none', () => {
  test('renders the empty truth, the S16.1 table, and Business-only team', async ({ page }) => {
    await page.goto(`${base}/subscription`);
    await expect(page.locator('[data-screen="SC-26"]')).toBeVisible();
    await expect(page.getByText(/No subscription yet/)).toBeVisible();
    // S16.1 transcribed: team appears on Business and on no other row.
    const table = page.locator('.compare-plans table');
    await expect(table.getByText('Included, with roles')).toHaveCount(1);
    await expect(table.locator('tr', { hasText: 'Business' }).getByText('Included, with roles')).toBeVisible();
  });

  test('an open intent renders ITS REFERENCE from the GET (planted; A7, T15 Phase 4)', async ({
    page,
    context,
  }) => {
    /*
     * The reference-owed sentence's removal, proven on SCREEN (pass M7). A
     * real open intent needs the billing seed T14-C registered as owed, so
     * the GET is planted -- the R21 pattern, and the plant derives from the
     * server's real shape: t6-purchase-intent proves the wire carries this
     * exact object, reference included, identical to the POST's.
     */
    await context.route('**/v1/billing/subscription', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          subscription: {
            state: 'PENDING_PAYMENT',
            tier: 'LISTED',
            term: 'ANNUAL',
            trial_ends_at: null,
            current_period_start: null,
            current_period_end: null,
            locked_rate_minor: 1200000,
            locked_rate_currency: 'ETB',
          },
          intent: {
            intent_id: '33333333-3333-4333-8333-333333333333',
            collection_record_id: 'ab12cd34-5678-4000-8000-000000000001',
            tier: 'LISTED',
            term: 'ANNUAL',
            amount_minor: 1200000,
            currency: 'ETB',
            expires_at: '2026-09-03T10:00:00Z',
            reference: 'ADU-SUB-AB12CD34',
            marked_transferred_at: null,
          },
        },
      });
    });
    await page.goto(`${base}/subscription`);
    // The seller who closed the tab reads back what to write on the transfer.
    await expect(page.locator('[data-reference="ADU-SUB-AB12CD34"]')).toBeVisible();
    await expect(page.getByText('Write ADU-SUB-AB12CD34 on the bank transfer.')).toBeVisible();
    // And the owed sentence is gone.
    await expect(page.getByText(/cannot be shown again yet/)).toHaveCount(0);
  });
});

test.describe('SC-27 Sessions -- never empty, current marked, forget is NOT sign-out', () => {
  test('forgets the remembered device ALONE: the flag goes, the session stays (T15 Phase 4)', async ({
    page,
  }) => {
    await page.goto(`${base}/sessions`);
    await expect(page.locator('[data-screen="SC-27"]')).toBeVisible();
    const current = page.locator('.session-list .session-row', { hasText: 'This session' });
    await expect(current).toBeVisible();
    await expect(current.getByRole('button', { name: 'Sign out' })).toHaveCount(0);

    // The harness signs in with remember_device (R17), so the remembered
    // region lists a REAL device with the forget control, and the consequence
    // says what forgetting is: NOT a sign-out.
    await expect(
      page.getByText(/Forgetting a device keeps you signed in on it/),
    ).toBeVisible();
    const rememberedRow = page.locator('.remembered-devices [data-action="forget-device"]');
    await expect(rememberedRow).toHaveCount(1);
    // The old cannot-remove-the-flag sentence is GONE: the endpoint exists.
    await expect(page.getByText(/cannot be listed or removed here yet/)).toHaveCount(0);

    // DRIVE the forget against the real API...
    const forgot = page.waitForResponse(
      (r) => r.url().includes('/v1/auth/remembered-devices/') && r.request().method() === 'DELETE',
    );
    await rememberedRow.click();
    await forgot;

    // ...the device leaves the remembered region...
    await expect(page.getByText('No remembered device has a live session right now.')).toBeVisible();
    // ...and THE SESSION STAYS: the current session is still listed, still
    // signed in -- forgetting was not a sign-out. That distinction is the
    // whole of item 8's second half.
    await expect(
      page.locator('.session-list .session-row', { hasText: 'This session' }),
    ).toBeVisible();
  });
});

test.describe('SC-28 Notification preferences -- R22, driven', () => {
  test('seven rows, the locked eighth outside them, and the payments consequence at the moment of choice', async ({ page }) => {
    await page.goto(`${base}/notification-preferences`);
    await expect(page.locator('[data-screen="SC-28"]')).toBeVisible();

    // The locked row is VISIBLE, checked, disabled, with its reason.
    const locked = page.locator('.pref-row.locked');
    await expect(locked.getByText('Security and payout')).toBeVisible();
    await expect(locked.locator('input')).toBeChecked();
    await expect(locked.locator('input')).toBeDisabled();
    await expect(locked.getByText('Locked on because security alerts cannot be suppressed.')).toBeVisible();

    // Payments toggles OFF for real -- and the consequence renders AT THAT
    // MOMENT (R22), not in a tooltip, not never.
    const patched = page.waitForResponse(
      (r) => r.url().includes('/v1/seller/notification-preferences') && r.request().method() === 'PATCH',
    );
    await page.locator('#pref-payments').uncheck();
    await expect(page.getByText(/Turning off payment alerts risks missing the 24-hour window/)).toBeVisible();
    // The warning above renders from the click-time flip; the RELOAD proof
    // must wait for the wire, or it races the in-flight PATCH (pass note).
    await patched;

    // The write LANDED: reload reads the row back from the server.
    await page.reload();
    await expect(page.locator('#pref-payments')).not.toBeChecked();
    // Restore for other runs of this suite within the same database life.
    await page.locator('#pref-payments').check();
    await expect(page.locator('#pref-payments')).toBeChecked();
  });
});

test.describe('SC-29 Closure -- two things, not blurred, driven for real', () => {
  test('blockers render as messages, closure stays available, and close/reopen round-trips', async ({ page }) => {
    await page.goto(`${base}/closure`);
    await expect(page.locator('[data-screen="SC-29"]')).toBeVisible();

    // The seed holds live orders: deletion is BLOCKED, every blocker renders
    // as its MESSAGE (never a code), and the delete control is absent.
    await expect(page.getByText('Deletion blocked')).toBeVisible();
    await expect(page.getByText(/must be/).first()).toBeVisible();
    await expect(page.getByText('NON_TERMINAL_RESERVATIONS')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Delete account/ })).toHaveCount(0);
    // G1.3: closing SURVIVES the deletion block.
    await expect(page.getByRole('button', { name: 'Close store', exact: true })).toBeVisible();

    // Close, for real -- reversible, badge renders -- then PROVE the status is
    // the SERVER's (T15 Phase 5 pass B1): a fresh load must still know the
    // store is CLOSING. Before, `closed` was this tab's memory of its own
    // POST, and the screen told sellers the server could not report a status
    // SC-17 was rendering two taps away.
    await page.getByRole('button', { name: 'Close store', exact: true }).click();
    await expect(page.getByText(/stop taking new orders/)).toBeVisible();
    const closedPost = page.waitForResponse(
      (r) => r.url().includes('/v1/seller/closure') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Close the store' }).click();
    await closedPost;
    await expect(page.getByText('Store closed')).toBeVisible();

    await page.reload();
    // The badge renders from GET /v1/seller/profile's status, not session
    // memory -- and the old cannot-be-shown sentence is GONE.
    await expect(page.getByText('Store closed')).toBeVisible();
    await expect(page.getByText(/cannot be shown here yet/)).toHaveCount(0);

    // Reopen, for real, and prove THAT reads back too (leaving the seed's
    // ACTIVE state for later runs, as this test always has).
    const reopened = page.waitForResponse(
      (r) => r.url().includes('/v1/seller/closure') && r.request().method() === 'DELETE',
    );
    await page.getByRole('button', { name: 'Reopen store' }).click();
    await reopened;
    await page.reload();
    await expect(page.getByRole('button', { name: 'Close store', exact: true })).toBeVisible();
    await expect(page.getByText('Store closed')).toHaveCount(0);
  });
});
