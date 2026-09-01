/**
 * C-8's done-clause: SC-C1, driven end-to-end against the real API.
 *
 * The chain is REAL at every link: the signed-in SELLER invites the seeded
 * buyer's phone as a courier (the account exists and is ACTIVE, so the
 * invite claims immediately -- G1.8's one-shape-either-way), assigns the
 * seeded PAYMENT_CONFIRMED order to that account, and then the COURIER
 * signs in on their own cookie-free context (their own OTP, never the
 * seller's -- the SC-23 sentence, lived) and works the screen:
 *
 *   R25, both halves, with the SERVER as the enforcement: before custody
 *   the QR payload is ABSENT from the wire and the screen says the code
 *   does not exist yet; after Accept custody (a real runIdempotent POST,
 *   Event A courier side) the re-read carries the payload and the QR
 *   renders -- with the sentence naming WHO scans it, because a courier
 *   reading the QR as theirs to scan is the failure R25's sibling rule
 *   (the composite FK) exists to make impossible.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEEDED, BUYER, API } from './helpers/session';

const BUYER_STATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.auth', 'buyer-state.json');

const CONFIRMED_ORDER = '5eed0000-0000-4000-8000-000000000013';

test.describe('SC-C1 -- the courier, driven end-to-end', () => {
  test('assignment appears; custody gates the QR; the buyer is named as the scanner', async ({
    browser,
    page,
    baseURL,
  }) => {
    const origin = { Origin: baseURL ?? '' };
    const sellerHeaders = {
      'X-Adulis-Client': 'web/0.0.0',
      'X-Adulis-Seller': SEEDED.sellerId,
      ...origin,
    };

    // The COURIER's context first: BEFORE any assignment exists, the screen
    // is the EMPTY state that explains the mechanism (and doubles as the
    // proof that RLS shows a non-assigned courier nothing).
    const courierCtx = await browser.newContext({ storageState: BUYER_STATE });
    let inviteId: string | null = null;
    try {
      const cPage = await courierCtx.newPage();
      await cPage.goto(`${baseURL}/courier`);
      await expect(cPage.locator('[data-screen="SC-C1"]')).toBeVisible();
      await expect(cPage.getByText('No assigned orders')).toBeVisible();

      // The SELLER's half, through the seller wire (the page context holds
      // the seller session): invite the courier's phone, assign the order.
      // Inside the try so a failure still reaches the revoke cleanup.
      const invited = await page.request.post(`${API}/v1/seller/couriers`, {
        headers: { ...sellerHeaders, 'Idempotency-Key': crypto.randomUUID() },
        data: { phone: BUYER.phone },
      });
      expect(invited.status()).toBe(201);
      inviteId = ((await invited.json()) as { id: string }).id;

      const assigned = await page.request.post(
        `${API}/v1/seller/orders/${CONFIRMED_ORDER}/courier-assignment`,
        {
          headers: { ...sellerHeaders, 'Idempotency-Key': crypto.randomUUID() },
          data: { courier_account_id: BUYER.accountId },
        },
      );
      expect(assigned.ok()).toBeTruthy();

      await cPage.reload();
      await expect(cPage.locator('[data-screen="SC-C1"]')).toBeVisible();

      // The list IS the assignments: the one assigned order, no seller nav.
      await expect(cPage.getByRole('navigation')).toHaveCount(0);
      const row = cPage.locator('.courier-order-row', { hasText: 'Seed Store' });
      await expect(row).toBeVisible();
      await row.click();

      // R25's first half AT THE WIRE, not only in the DOM: the payload is
      // ABSENT from the server's answer -- a client hiding a leaked payload
      // would render the same DOM and fail here.
      const before = await cPage.request.get(`${API}/v1/courier/orders/${CONFIRMED_ORDER}`, {
        headers: { 'X-Adulis-Client': 'web/0.0.0' },
      });
      expect(((await before.json()) as { qr: unknown }).qr).toBeNull();

      // Custody not accepted: the buyer's phone (the wire's one contact
      // field), the ORDER REFERENCE (two orders from one store must be
      // tellable apart at a doorway), the named absences, NO QR.
      await expect(cPage.getByText(BUYER.phone)).toBeVisible();
      await expect(cPage.locator('.courier-order').getByText(CONFIRMED_ORDER.slice(0, 8))).toBeVisible();
      await expect(cPage.getByText(/not reported to couriers yet/)).toBeVisible();
      await expect(cPage.locator('.handoff-qr')).toHaveCount(0);
      await expect(cPage.getByText(/does not exist until the goods are with you/)).toBeVisible();

      // Event A, courier side -- a real runIdempotent POST.
      await cPage.getByRole('button', { name: 'Accept custody' }).click();

      // R25, second half: the payload arrived WITH the re-read and the QR
      // renders, with the scanner named.
      await expect(cPage.locator('.handoff-qr')).toBeVisible();
      await expect(cPage.getByText(/The BUYER scans this at the doorway/)).toBeVisible();
      await expect(cPage.getByRole('button', { name: 'Accept custody' })).toHaveCount(0);

      // And the PAYLOAD is the right order's, from the wire -- a QR of
      // garbage or of another order's token renders identically.
      const after = await cPage.request.get(`${API}/v1/courier/orders/${CONFIRMED_ORDER}`, {
        headers: { 'X-Adulis-Client': 'web/0.0.0' },
      });
      const qr = ((await after.json()) as { qr: { order_ref: string; signature: string } }).qr;
      expect(qr.order_ref).toBe(CONFIRMED_ORDER);
      expect(qr.signature.length).toBeGreaterThan(0);
    } finally {
      await courierCtx.close();
      // Leave the world as found for the specs after this file: revoking
      // the invite ends the courier row AND the live assignment in one
      // transaction (SC-23's own warning, lived). ASSERTED -- a silent 4xx
      // here would leak a live courier into every later spec.
      if (inviteId) {
        const revoked = await page.request.delete(`${API}/v1/seller/couriers/${inviteId}`, {
          headers: sellerHeaders,
        });
        expect(revoked.status()).toBe(204);
      }
    }
  });
});
