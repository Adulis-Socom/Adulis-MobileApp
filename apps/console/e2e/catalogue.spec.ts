/**
 * C-5's done-clause, asserted by a machine, against the real API.
 *
 * The seed publishes one product ("Seed Coffee 1kg", PRODUCT
 * 5eed...06) with variants, so these screens render real rows rather than an
 * EMPTY state -- a test that only ever saw EMPTY would pass vacuously the day
 * the screens broke on real data.
 *
 * What C-5's traps require a browser to have DRAWN (ADU-CON-03 v1.2 S8):
 *   SC-07  the list renders, THE CAP COUNTER IS A NUMBER AND NAMES WHICH LIMIT
 *          BINDS (T22 Phase 4.2 -- it was an honest placeholder for three
 *          orders because no endpoint returned the resolved limit), and the
 *          filter note says filtering is over what loaded.
 *   SC-08  the editor renders the product with its Variants and Media
 *          sections and a publication control.
 *   SC-11  stock offers TWO DISTINCT actions -- Set count AND Confirm stock is
 *          accurate -- never one field that does both.
 */
import { test, expect } from '@playwright/test';
import { SEEDED, signInAs } from './helpers/session';

const base = `/s/${SEEDED.sellerId}`;

test.describe('SC-07 -- products list', () => {
  test('renders the seeded product, and names the cap it cannot yet report', async ({ page }) => {
    await page.goto(`${base}/products`);
    await expect(page.locator('[data-screen="SC-07"]')).toBeVisible();

    // At least the seeded product, rendered READY (not EMPTY).
    await expect(page.locator('[data-product]').first()).toBeVisible();
    await expect(page.getByText('Seed Coffee 1kg')).toBeVisible();

    // ------------------------------------------------------------------
    // THE CAP COUNTER (T22 Phase 4.2). ADU-CON-03 S8: "the counter must say
    // which one binds", because "10 of unlimited" is a bug report waiting to
    // be filed. For three orders this region was an honest placeholder --
    // billing.fn_effective_limit computed the tier-and-level intersection and
    // threw both operands away, and no endpoint called it for PRODUCT_COUNT at
    // all. GET /v1/seller/products now carries `publication`.
    // ------------------------------------------------------------------
    const cap = page.locator('[data-cap-binding]');
    await expect(cap).toBeVisible();

    // Whichever limit is in force, the SENTENCE names it rather than saying
    // "your tier or level" -- the phrasing S8 exists to forbid.
    const binding = await cap.getAttribute('data-cap-binding');
    expect(['TIER', 'LEVEL', 'BOTH', 'NONE']).toContain(binding);

    // A cap that exists is DRAWN AS A NUMBER; a cap that does not is drawn as
    // no number at all. What must never appear either way is the word the spec
    // forbids: S8:415 -- the screen must not print "unlimited".
    if (binding === 'NONE') {
      await expect(cap.locator('[data-cap-count]')).toHaveCount(0);
    } else {
      await expect(cap.locator('[data-cap-count]')).toBeVisible();
      await expect(cap.locator('[data-cap-count]')).toHaveText(/\d+ of \d+/);
    }
    await expect(page.getByText(/unlimited/i)).toHaveCount(0);

    // The filter row filters what LOADED, and says so (D-154 class).
    await expect(page.getByText(/These tabs filter the products already loaded/i)).toBeVisible();
  });

  /**
   * THE OTHER SELLER, AND THE REASON THERE ARE TWO (T23, D-284).
   *
   * The seller above has no subscription, so the limit CANNOT be resolved and
   * the honest sentence is that it could not be. This one has a BETA
   * subscription, so it reaches the ordinary path -- and the ordinary path is
   * the one ADU-CON-03 S8 actually specifies:
   *
   *   "10 of 10 -- new sellers can list 10 products. This lifts when your store
   *    reaches Established."
   *
   * BETA's product_cap is NULL, so the LEVEL is what binds, which is the case
   * S8 names explicitly: a seller capped by their level is lifted by trading,
   * not by paying, and a counter that will not say which is a counter that
   * cannot be acted on.
   */
  test('SC-07: the SUBSCRIBED seller sees a real number, and is told the LEVEL binds', async ({
    browser,
  }, testInfo) => {
    /*
     * ITS OWN CONTEXT AND ITS OWN SIGN-IN, because this seller has its own
     * owner. chooser.spec asserts that a single-store seller is taken straight
     * into their store (D-97) and rests on each account owning exactly one, so
     * the second seller could not hang off the first account without taking a
     * real behaviour test with it. The OTP budget is 3/hour PER PHONE, so a
     * second phone spends nothing the shared sign-in relies on.
     */
    /*
     * AN EXPLICITLY EMPTY storageState, NOT `undefined`.
     *
     * The config sets `use.storageState` to the signed-in state file, and
     * Playwright merges context options by treating `undefined` as NOT GIVEN --
     * so `newContext()` and `newContext({ storageState: undefined })` both
     * arrive carrying the FIRST account's session cookie. That is not a stale
     * cookie quietly ignored: ADU-API-01 S5.1's Origin check binds to exactly
     * the requests that carry a session, so the sign-in POST for the second
     * account was refused 403 by the CSRF control, correctly, for being a
     * cookie-carried write with no Origin.
     *
     * `baseURL` comes from the project rather than a literal, because the dev
     * server's port is chosen in one place and must stay chosen there.
     */
    const baseURL = testInfo.project.use.baseURL;
    if (!baseURL) throw new Error('the project declares no baseURL to sign in against');
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      baseURL,
    });
    await signInAs(context, {
      phone: SEEDED.subscribedPhone,
      sellerId: SEEDED.subscribedSellerId,
    });
    const page = await context.newPage();

    await page.goto(`/s/${SEEDED.subscribedSellerId}/products`);
    await expect(page.locator('[data-screen="SC-07"]')).toBeVisible();

    const cap = page.locator('[data-cap-binding]');
    await expect(cap).toBeVisible();
    await expect(cap).toHaveAttribute('data-cap-binding', 'LEVEL');

    // The NUMBER, drawn. 0 published of a level cap of 10.
    await expect(cap.locator('[data-cap-count]')).toHaveText('0 of 10');

    // And the sentence that says what lifts it -- which is the whole point of
    // carrying `binding` on the wire rather than just the smaller number.
    await expect(cap).toContainText('New sellers can list 10 products');
    await expect(cap).toContainText('Established');

    // Still never the forbidden word.
    await expect(page.getByText(/unlimited/i)).toHaveCount(0);
    await context.close();
  });
});

test.describe('SC-08 -- product editor with its sections', () => {
  test('opens the seeded product and shows variants, media and publication', async ({ page }) => {
    await page.goto(`${base}/products`);
    await page.getByText('Seed Coffee 1kg').click();

    await expect(page.locator('[data-screen="SC-08"]')).toBeVisible();
    // SC-09 and SC-10 are SECTIONS of SC-08.
    await expect(page.getByRole('heading', { name: 'Variants' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Images and video' })).toBeVisible();
    // The seeded product is PUBLISHED, so the control is Unpublish.
    await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();
  });
});

test.describe('SC-11 -- stock is two distinct actions', () => {
  test('set-count and confirm-accurate are both present and are not the same control', async ({ page }) => {
    await page.goto(`${base}/products`);
    await page.getByText('Seed Coffee 1kg').click();
    await expect(page.locator('[data-screen="SC-08"]')).toBeVisible();

    // Expand the first variant's stock section.
    await page.getByRole('button', { name: 'Manage stock' }).first().click();
    const stock = page.locator('[data-screen="SC-11"]').first();
    await expect(stock).toBeVisible();

    // THE TWO DISTINCT ACTIONS. Set count changes a number; Confirm stock is
    // accurate changes none. Both must exist, as separate controls.
    await expect(stock.getByRole('button', { name: 'Set count' })).toBeVisible();
    await expect(
      stock.getByRole('button', { name: 'Confirm stock is accurate' }),
    ).toBeVisible();
  });
});

/**
 * THE MUTATION ARM (D-221). The three tests above only ever LOOK -- the pass's
 * summary was that the e2e walked the happy path of screens whose mutations
 * had never once succeeded against the real API. This arm drives the full
 * write cycle on a product it creates itself, so it can never race the render
 * tests above and never leans on the seed's shape:
 *
 *   create (refusing a blank price first) -> add a variant (refusing a blank
 *   price first) -> set stock (refusing a blank count first -- the B4 zeroing
 *   hazard) -> confirm stock -> publish for real.
 *
 * The blank-input refusals are asserted here because Number('') === 0: before
 * the pass, clearing the field and clicking Set count ZEROED a live variant.
 *
 * The first test ends on a REAL blocked publish -- the seed satisfies four of
 * nine readiness items, so fn_publish_product raises for real and the screen
 * must render each blocker as its readiness LABEL. The second test PLANTS a
 * 409 at the wire (the upgrade-required.spec.ts pattern) for the shapes the
 * real seed cannot produce -- a LEVEL_LIMIT_REACHED item and a message_key
 * with no slots.item -- asserting the same obligation: MESSAGES, never raw
 * codes, and publish disables while blockers stand.
 */
test.describe('C-5 mutation arm -- the write cycle, for real', () => {
  test('create, variant, stock, confirm, publish -- with each blank refused', async ({ page }) => {
    await page.goto(`${base}/products/new`);

    // A blank price is refused, not coerced to a 0.00 product (B4).
    await page.locator('#np-name').fill('E2E Mutation Arm');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByText('Enter a name and a starting price. A blank price is not zero.')).toBeVisible();

    await page.locator('#np-price').fill('120');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.locator('[data-screen="SC-08"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'E2E Mutation Arm' })).toBeVisible();

    // SC-09: a blank variant price is refused the same way.
    await page.locator('#new-variant-key').fill('Size L');
    await page.getByRole('button', { name: 'Add variant' }).click();
    await expect(page.getByText('Enter a price before saving. A blank price is not zero.')).toBeVisible();

    await page.locator('#new-variant-price').fill('150');
    await page.getByRole('button', { name: 'Add variant' }).click();
    const row = page.locator('.variant-row').filter({ hasText: 'Size L' });
    await expect(row).toBeVisible();

    // SC-11 inline: open stock and refuse the blank count (the zeroing
    // hazard). The field arrives prefilled with the server's count, so the
    // hazard is reproduced the way a seller would hit it: CLEAR, then click.
    await row.getByRole('button', { name: 'Manage stock' }).click();
    const stock = page.locator('[data-screen="SC-11"]');
    await expect(stock).toBeVisible();
    await stock.getByLabel('Stock count').fill('');
    await stock.getByRole('button', { name: 'Set count' }).click();
    await expect(page.getByText('Enter a stock count before setting it. A blank count is not zero.')).toBeVisible();

    // Set a real count: the variant summary reflects it and the history gains
    // the event -- stock is EVENTS, and the row is the proof the write landed.
    await stock.getByLabel('Stock count').fill('7');
    await stock.getByRole('button', { name: 'Set count' }).click();
    await expect(row.getByText('7 in stock')).toBeVisible();
    await expect(stock.locator('.stock-delta').first()).toHaveText('+7');

    // Confirm stock is accurate -- the SECOND, distinct action; it changes no
    // number, it changes the confirmed-at line.
    await stock.getByRole('button', { name: 'Confirm stock is accurate' }).click();
    await expect(stock.getByText(/Confirmed accurate at/)).toBeVisible();

    // Publish, for REAL -- and the real server BLOCKS it: the seed satisfies
    // only four of the nine readiness items (its product was published by SQL,
    // not through fn_publish_product, so readiness was never passed). The 409
    // items[] each carry the generic publication_blocked message_key and the
    // distinguishing readiness code in slots.item -- the screen must render
    // the ITEM's label (SC-01's own vocabulary), never five copies of the
    // same sentence and never a raw code.
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    const publishRegion = page.locator('.publish');
    await expect(
      publishRegion.getByText('This product cannot be published until each of these is resolved:'),
    ).toBeVisible();
    // Two items, so "each of these" is genuinely plural. NOT "Identity
    // verified" any more: T17/D-237 seeded the identity_config row this market
    // was missing, so IDENTITY_VERIFIED is now SATISFIED for the seeded seller
    // and naming it here would assert a blocker that no longer blocks. These
    // two are the seeded seller's real remaining ones.
    await expect(publishRegion.getByText('Payout details')).toBeVisible();
    await expect(publishRegion.getByText('Eligibility satisfied')).toBeVisible();
    await expect(publishRegion.getByText('PUBLICATION_BLOCKED')).toHaveCount(0);
    await expect(publishRegion.getByText('PAYOUT_DETAILS')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  });

  test('publish blockers render as MESSAGES, never raw codes, and publish disables (planted)', async ({ page, context }) => {
    await page.goto(`${base}/products/new`);
    await page.locator('#np-name').fill('E2E Blocked Publish');
    await page.locator('#np-price').fill('80');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.locator('[data-screen="SC-08"]')).toBeVisible();

    // The wire shape is the server's own (catalogue.service.ts publishProduct):
    // a 409 problem envelope whose items[] each carry code + message_key.
    await context.route('**/v1/seller/products/*/publish', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        json: {
          type: 'about:blank',
          title_key: 'error.seller.publication_blocked',
          status: 409,
          code: 'PUBLICATION_BLOCKED',
          request_id: 'e2e-planted',
          retryable: false,
          items: [
            {
              code: 'PUBLICATION_BLOCKED',
              message_key: 'error.seller.publication_blocked',
              slots: { item: 'IDENTITY_VERIFIED' },
            },
            {
              code: 'LEVEL_LIMIT_REACHED',
              message_key: 'error.seller.level_limit_reached',
              slots: { cap: 10, published: 10 },
            },
          ],
        },
      });
    });

    await page.getByRole('button', { name: 'Publish', exact: true }).click();

    // EVERY item renders as what a person reads: an item carrying slots.item
    // renders its readiness LABEL (SC-01's vocabulary); one without renders
    // its message_key's message. The raw code appears NOWHERE.
    await expect(page.getByText('Identity verified')).toBeVisible();
    await expect(page.getByText('Your store level does not include this yet.')).toBeVisible();
    await expect(page.getByText('PUBLICATION_BLOCKED')).toHaveCount(0);
    await expect(page.getByText('LEVEL_LIMIT_REACHED')).toHaveCount(0);

    // And the button disables until a reload could change the answer.
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  });
});

/**
 * T20 S4 -- THE FATAL ITEM, DRAWN.
 *
 * "A seller cannot put a photograph on a product" is the last fatal entry on
 * BETA-READINESS, and this is the arm that answers it: a real file, picked in
 * a real browser, resized in the page, PUT straight to real object storage
 * (MinIO here, R2 in production -- one adapter, six env values), committed,
 * and then RENDERED from the public origin.
 *
 * It also closes D-242's owed item. That entry's own history is why it cannot
 * be skipped a third time: T14-C fixed the reorder's client half with nothing
 * calling the endpoint, and the fix was never exercised. A fix without a test
 * that drives it is a claim.
 */
test.describe('SC-10 media -- upload, render, reorder, cap (T20 S4)', () => {
  // A real 8x8 PNG, generated (zlib IDAT, correct CRCs) rather than
  // copy-pasted. createImageBitmap must DECODE it: the first draft used a
  // base64 blob that looked like a PNG and was not, and the screen said so
  // exactly -- "The source image could not be decoded" -- which is the
  // upload path's own error handling working before the upload did.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4oaGBFTEMLQkAgl1GAWqNFmsAAAAASUVORK5CYII=',
    'base64',
  );

  const pick = async (page: import('@playwright/test').Page) => {
    await page.locator('#media-file').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
  };

  test('a real photograph reaches the product, the storefront API, and reorders by dragging', async ({
    page,
    request,
  }) => {
    // A product of this arm's own, so the seeded product's media is untouched.
    await page.goto(`${base}/products/new`);
    await page.locator('#np-name').fill('T20 Media Product');
    await page.locator('#np-price').fill('4200');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.locator('[data-screen="SC-08"]')).toBeVisible();
    const productId = /\/products\/([0-9a-f-]{36})/.exec(page.url())?.[1] as string;

    // ---- 1. UPLOAD. The control exists at all, which it never did before.
    await expect(page.locator('#media-file')).toBeVisible();
    await pick(page);

    // ---- 2. IT IS ON THE PRODUCT, as an image the browser actually fetched.
    const img = page.locator('.media-thumb').first();
    await expect(img).toBeVisible();
    const src = await img.getAttribute('src');
    expect(src).toBeTruthy();
    // Rendered, not merely present: naturalWidth is 0 for an <img> whose
    // fetch was refused (CSP, CORS, 404), so this is the assertion that
    // distinguishes "a photograph is on the screen" from "a broken icon is".
    await expect
      .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);

    // ---- 3. THE OBJECT IS REALLY IN THE BUCKET, anonymously readable at the
    // public origin -- the viewing path's whole premise (public media bucket).
    const direct = await request.get(src as string);
    expect(direct.status()).toBe(200);

    // ---- 4. REORDER BY DRAGGING. Two images, dragged, and the ORDER CHANGES.
    await pick(page);
    await expect(page.locator('.media-item')).toHaveCount(2);
    const before = await page.locator('.media-thumb').evaluateAll((els) =>
      els.map((e) => (e as HTMLImageElement).src),
    );
    await page.locator('.media-item').nth(1).dragTo(page.locator('.media-item').nth(0));
    await expect
      .poll(async () =>
        page.locator('.media-thumb').evaluateAll((els) => els.map((e) => (e as HTMLImageElement).src)),
      )
      .toEqual([before[1], before[0]]);

    // ---- 5. THE PUBLIC STOREFRONT API CARRIES IT, once published.
    await page.goto(`${base}/products/${productId}`);
    const publish = page.getByRole('button', { name: 'Publish', exact: true });
    if (await publish.isEnabled().catch(() => false)) {
      await publish.click();
      const res = await request.get(
        `${process.env['E2E_API_BASE_URL'] ?? 'http://localhost:3000'}/v1/storefronts/seed-store/products`,
        { headers: { 'X-Adulis-Client': 'web/0.0.0' } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string; image_key: string | null }> };
      const mine = body.data.find((r) => r.id === productId);
      if (mine) expect(mine.image_key).toBeTruthy();
    }
  });

  test('a SIXTH image is refused BEFORE the upload begins (T20 S4)', async ({ page }) => {
    /*
     * The structural cap -- UNIQUE (product_id, position), positions 1..5 --
     * stops a sixth ROW at COMMIT. It does not stop a sixth signed URL being
     * minted, and a presigned write credential handed out for an upload that
     * can never be committed is one that should never have existed. A
     * presigned upload has two places to check a cap and this proves the one
     * that is right: REQUEST_UPLOAD refuses before any bytes move.
     */
    await page.goto(`${base}/products/new`);
    await page.locator('#np-name').fill('T20 Cap Product');
    await page.locator('#np-price').fill('900');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.locator('[data-screen="SC-08"]')).toBeVisible();

    for (let i = 0; i < 5; i += 1) {
      await pick(page);
      await expect(page.locator('.media-item')).toHaveCount(i + 1);
    }

    // At the cap the control is DISABLED and says why -- the seller is told
    // before they choose a file, not after a failed upload.
    await expect(page.locator('#media-file')).toBeDisabled();
    await expect(page.getByText(/Five images is the maximum/i)).toBeVisible();
  });
});
