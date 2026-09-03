/**
 * WORK ORDER T17 -- the beta-readiness walk. A DIAGNOSTIC, not a gate.
 *
 * It walks S2's journey as a seller would, on the reset database the harness
 * provides, signing up a phone the seed has never seen. It asserts almost
 * nothing: it RECORDS what a seller can and cannot do, and screenshots the
 * screen at each step, because the order's rule is that nothing counts as
 * verified unless a browser drew it.
 *
 * Named zz- so it runs last: it creates a real account and a real store, and
 * every other spec should meet the world as it was seeded.
 */
import { test, expect } from '@playwright/test';
import { currentSmsCode, nextSmsCode } from './helpers/session';
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = path.join(process.cwd(), 'e2e', '.walk');
const FINDINGS: string[] = [];

const T0 = Date.now();
const at = (): string => `${((Date.now() - T0) / 1000).toFixed(1)}s`;

function note(step: string, verdict: string, detail: string): void {
  FINDINGS.push(`[${verdict}] step ${step}: ${detail}`);
  // eslint-disable-next-line no-console
  console.log(`WALK [${verdict}] step ${step} (@${at()}): ${detail}`);
}

/** Where the budget actually goes -- printed even when nothing is found. */
function mark(what: string): void {
  // eslint-disable-next-line no-console
  console.log(`WALK ..... ${what} @${at()}`);
}

// A phone the seed and every other spec has never used.
const PHONE = '+251911990117';

test.describe('T17 -- what a beta seller can actually do', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  // The walk itself takes well under a minute. It is generous only because it
  // signs up for real and waits on a real OTP.
  //
  // A LESSON WORTH KEEPING: this spec spent three runs appearing to hang at
  // step 14. It was not step 14 and it was not the product. Playwright's
  // default action timeout is UNLIMITED, so an optional probe like
  // `.locator('.problem').first().textContent()` -- written to capture an error
  // message IF one appeared -- waits for the entire test budget when the thing
  // it looks for is legitimately absent. The variant SUCCEEDING is what made it
  // hang. Every optional probe below is bounded at 2s for that reason.
  test.setTimeout(120_000);

  test('the whole journey, drawn', async ({ page }) => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const shot = async (name: string) => {
      await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
    };

    // ---------------------------------------------------------------- step 1
    // Sign up. Phone, code, age declaration -- through the SCREEN, not the API.
    await page.goto('/sign-in');
    await expect(page.locator('#signin-phone')).toBeVisible();
    const before = currentSmsCode();
    await page.locator('#signin-phone').fill(PHONE);
    await page.locator('#signin-remember').check().catch(() => {});
    await page.getByRole('button', { name: /code|sign in|continue/i }).first().click();

    let code = '';
    try {
      code = await nextSmsCode(before, 15_000);
      note('1', 'OK', 'a code arrives for a brand-new phone');
    } catch {
      note('1', 'CANNOT', 'no OTP arrived for a new phone -- sign-up is impossible');
      await shot('01-signin-no-code');
      return;
    }

    await page.locator('#signin-code').fill(code);
    // The age declaration only exists on the account-creating step.
    const age = page.locator('#signin-age');
    if (await age.count()) {
      await age.check();
      note('1', 'OK', 'the age declaration is asked on the step that creates the account');
    } else {
      note('1', 'EMBARRASSES', 'no age declaration control appeared on sign-up');
    }
    await shot('01-signin-filled');
    await page.getByRole('button', { name: /verify|confirm|sign in|continue/i }).last().click();

    await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 20_000 });
    await shot('02-after-signin');
    note('1', 'OK', `signed in; landed on ${new URL(page.url()).pathname}`);

    mark('step 1 done');
    // ---------------------------------------------------------------- step 2
    // What does a brand-new seller with NO store see first?
    const landedPath = new URL(page.url()).pathname;
    const chooserHint = await page.locator('.hint').first().textContent({ timeout: 2000 }).catch(() => null);
    if (landedPath === '/') {
      // T18 Phase 3: this used to be an EMBARRASSES -- the chooser named a
      // register number and asked for a store id the seller had never been
      // given. It now lists the account's stores, so a seller with none meets
      // a good empty state and the way to make one.
      note('2', 'OK', `a seller with no store is told: "${(chooserHint ?? '').trim()}"`);
    }
    // Is there any route to creating a store from here, or must it be typed?
    const createLink = page.getByRole('link', { name: /create|new store|become/i });
    if (await createLink.count()) {
      note('2', 'OK', 'the chooser offers a link to create a store');
      await createLink.first().click();
    } else {
      note('2', 'CANNOT', 'no link from the chooser to creating a store -- /s/new must be typed');
      await page.goto('/s/new');
    }
    await shot('03-become-seller');

    // Fill the store form as a seller would: the form asks in plain words and
    // keeps the button disabled until the one required choice is made.
    const handle = `walk-store-${Date.now().toString(36)}`.slice(0, 30);
    await page.getByRole('radio', { name: /individual/i }).check().catch(() => {});
    await page.getByRole('textbox', { name: /store name/i }).fill('Addis Thread').catch(() => {});
    await page.getByRole('textbox', { name: /store address/i }).fill(handle).catch(() => {});
    await shot('04-store-form-filled');

    const createBtn = page.getByRole('button', { name: /create my store/i });
    if (await createBtn.isDisabled({ timeout: 2000 }).catch(() => true)) {
      note('2', 'CANNOT', 'the create-store button stays disabled with the form filled');
    }
    await createBtn.click({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await shot('05-after-store-create');

    const m = /\/s\/([0-9a-f-]{36})/.exec(page.url());
    const sellerId = m ? m[1] : null;
    if (sellerId) {
      note('2', 'OK', 'creating a store navigates straight into it');
    } else {
      const err = await page.locator('.problem, .field-error').first().textContent({ timeout: 2000 }).catch(() => null);
      note('2', 'CANNOT', `store creation did not land in a store. Screen says: "${(err ?? '').trim()}"`);
      fs.writeFileSync(path.join(SHOTS, 'findings.txt'), FINDINGS.join('\n'), 'utf8');
      return;
    }

    mark('step 2 done');
    // ---------------------------------------------------------------- step 6
    // Home: the readiness list a seller must clear to publish.
    await page.goto(`/s/${sellerId}`);
    await page.waitForTimeout(1200);
    await shot('06-home-readiness');
    const items = await page.locator('[data-item]').count();
    const done = await page.locator('[data-item][data-satisfied="true"]').count();
    note('6', 'OK', `Home shows ${items} readiness items, ${done} already satisfied`);
    const todo = await page
      .locator('[data-item][data-satisfied="false"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-item')));
    note('6', 'OK', `still to do before publishing: ${todo.join(', ')}`);
    // THE ONE ASSERTION THIS DIAGNOSTIC MAKES, and the reason it makes it:
    // everything else here RECORDS, but this must REFUSE. The only endpoint
    // that satisfies IDENTITY_VERIFIED is operator-only, so a brand-new seller
    // held by it cannot publish without the founder -- for every seller,
    // indefinitely. It was held that way because this market's identity_config
    // row was never seeded and 0018's rule fails closed to "required". If it
    // comes back, this walk should go red rather than narrate the outage.
    expect(todo).not.toContain('IDENTITY_VERIFIED');
    const unrouted = await page.locator('.readiness-action.unrouted').count();
    if (unrouted > 0) {
      note('6', 'EMBARRASSES', `${unrouted} readiness items show a raw code with no link to resolve them`);
    }

    mark('step 6 done');
    // ---------------------------------------------------------------- step 4
    // Payout details, on the day the seller signs up -- one of the nine.
    await page.goto(`/s/${sellerId}/payouts`);
    await page.waitForTimeout(1500);
    await shot('06b-payout-day-one');
    const lock = page.locator('[data-payout-lock]');
    if (await lock.count()) {
      const why = (await lock.textContent({ timeout: 2000 }).catch(() => '')) ?? '';
      const changeDisabled = await page
        .locator('[data-action="change-payout"]')
        .isDisabled({ timeout: 2000 })
        .catch(() => null);
      note(
        '4',
        'CANNOT',
        `on day one the payout control is ${changeDisabled ? 'DISABLED' : 'enabled'} and the screen says: "${why.replace(/\s+/g, ' ').trim()}"`,
      );
    } else {
      note('4', 'OK', 'payout details can be set on the day of sign-up');
    }

    mark('step 4 done');
    // ---------------------------------------------------------------- step 5
    // List a product with photographs, variants, prices and stock.
    await page.goto(`/s/${sellerId}/products/new`);
    await page.waitForTimeout(1000);
    await shot('07-product-new');
    await page.locator('#np-name').fill('Habesha Kemis').catch(() => {});
    await page.locator('#np-price').fill('1200').catch(() => {});
    // Any select (a category, say) -- take the first real option.
    const sel = page.locator('select').first();
    if (await sel.count()) {
      const opts = await sel.locator('option').count();
      if (opts > 1) await sel.selectOption({ index: 1 }).catch(() => {});
    }
    await page
      .getByRole('button', { name: /create|save|add/i })
      .first()
      .click({ timeout: 10_000 })
      .catch(() => {});
    await page.waitForTimeout(3000);
    await shot('08-after-product-create');

    const pm = /\/products\/([0-9a-f-]{36})/.exec(page.url());
    const productId = pm ? pm[1] : null;
    if (!productId) {
      const err = await page.locator('.problem, .field-error').first().textContent({ timeout: 2000 }).catch(() => null);
      note('5', 'CANNOT', `could not create a product. Screen says: "${(err ?? '').trim()}"`);
    } else {
      note('5', 'OK', 'a product is created');

      // MEDIA -- the S1.1 question, drawn.
      await page.goto(`/s/${sellerId}/products/${productId}`);
      await page.waitForTimeout(1200);
      await shot('09-product-editor');
      const fileInputs = await page.locator('input[type="file"]').count();
      const mediaOwed = await page.locator('.media-upload-owed').first().textContent({ timeout: 2000 }).catch(() => null);
      if (fileInputs === 0) {
        note(
          '5',
          'CANNOT',
          `no file input exists on the product screen. The screen says: "${(mediaOwed ?? '').trim()}"`,
        );
      } else {
        note('5', 'OK', `${fileInputs} file input(s) present`);
      }

      // VARIANTS -- the S1.2 question, drawn.
      const keyField = page.locator('#new-variant-key');
      if (await keyField.count()) {
        const label = await page
          .locator('label[for="new-variant-key"]')
          .textContent({ timeout: 2000 })
          .catch(() => null);
        const owed = await page
          .getByText(/shown by their key/i)
          .first()
          .textContent({ timeout: 2000 })
          .catch(() => null);
        note(
          '5',
          'EMBARRASSES',
          `variants are typed free-text into a box labelled "${(label ?? '').trim()}"; screen says "${(owed ?? '').trim()}"`,
        );
        await keyField.fill('Size M / Red');
        mark('variant: key filled');
        const priceField = page.locator('#new-variant-price');
        if (await priceField.count()) await priceField.fill('1200');
        mark('variant: price filled');
        await shot('10-variant-form');
        mark('variant: form screenshot');
        await page
          .getByRole('button', { name: 'Add variant', exact: true })
          .click({ timeout: 10_000 })
          .catch(() => {});
        mark('variant: add clicked');
        await page.waitForTimeout(2500);
        await shot('11-after-variant');
        mark('variant: after screenshot');
        const keys = await page.locator('.variant-key').allTextContents();
        mark('variant: keys read');
        const vErr = await page
          .locator('.problem, .field-error')
          .first()
          .textContent({ timeout: 2000 })
          .catch(() => null);
        note(
          '5',
          keys.length ? 'OK' : 'CANNOT',
          `variants after adding: ${JSON.stringify(keys)}${keys.length ? '' : ` -- screen says: "${(vErr ?? '').trim()}"`}`,
        );
      } else {
        note('5', 'CANNOT', 'no variant control found on the product screen');
      }
    }

    // ---------------------------------------------------------------- step 7
    // Open the public storefront and look at it as a buyer would.
    mark('step 5 done');
    // Nothing to drive: the question is whether a BUYER can reach this store,
    // and the answer is a filesystem fact, not a request. apps/storefront does
    // not exist and apps/mobile is a placeholder with no sources -- so there is
    // no client to point at any URL this API might serve.
    const repo = path.resolve(process.cwd(), '..', '..');
    const storefront = fs.existsSync(path.join(repo, 'apps', 'storefront'));
    const mobileSrc = fs.existsSync(path.join(repo, 'apps', 'mobile', 'src'));
    note(
      '7',
      storefront || mobileSrc ? 'OK' : 'CANNOT',
      `no buyer client exists to open this store: apps/storefront present=${storefront}, apps/mobile/src present=${mobileSrc}. Steps 8-13 cannot be walked because no buyer can start them.`,
    );

    // --------------------------------------------------------------- step 14
    // Come back the next day: a returning seller lands on "/".
    mark('step 7 done');
    // Coming back tomorrow is a FRESH LOAD of the root, not a link click from
    // inside the store -- so open a new page on the same (still signed-in)
    // context. Bounded: an unresponsive root must report itself, never consume
    // the test's budget and surface as a failure about step 14.
    const fresh = await page.context().newPage();
    try {
      await fresh.goto('/', { timeout: 20_000, waitUntil: 'domcontentloaded' });
      await fresh.waitForTimeout(1500);
      await fresh.screenshot({ path: path.join(SHOTS, '12-return-next-day.png'), fullPage: true });
      // T18 Phase 3 closed D-97, so "/" now redirects a single-store seller
      // straight into their store (S2.1). The old CANNOT read: "a returning
      // seller is asked to paste a store id".
      const backIn = fresh.locator('#chooser-id');
      const landed = new URL(fresh.url()).pathname;
      if (await backIn.count()) {
        const hint = await fresh.locator('.hint').first().textContent({ timeout: 2000 }).catch(() => null);
        note('14', 'CANNOT', `a returning seller is asked to paste a store id: "${(hint ?? '').trim()}"`);
      } else if (/^\/s\/[0-9a-f-]{36}/.test(landed)) {
        note('14', 'OK', `a returning seller is taken straight back into their store (${landed})`);
      } else {
        note('14', 'CANNOT', `a returning seller landed on ${landed}, not in a store`);
      }
    } catch (e) {
      note('14', 'CANNOT', `the app root did not load within 20s: ${String(e).slice(0, 80)}`);
    } finally {
      await fresh.close();
    }

    // -------------------------------------------------------- step 14 (b)
    // The two routes #80's redirect took away. This walk owns its account and
    // runs last, so it is the one place the SIGNED-IN path can be driven: the
    // shared suite session cannot sign out without revoking the row every
    // later spec authenticates with.
    const back = await page.context().newPage();
    try {
      await back.goto('/', { timeout: 20_000, waitUntil: 'domcontentloaded' });
      await back.locator('[data-switcher-toggle]').click({ timeout: 10_000 });
      const create = back
        .locator('[data-switcher-menu]')
        .getByRole('link', { name: /create a store/i });
      const reachable = (await create.count()) > 0;
      note(
        '14',
        reachable ? 'OK' : 'CANNOT',
        reachable
          ? 'a redirected seller still reaches "Create a store", from the switcher'
          : 'a redirected seller cannot reach store creation without typing /s/new',
      );

      await back.getByRole('button', { name: /sign out/i }).click({ timeout: 10_000 });
      await back.waitForURL(/sign-in/, { timeout: 20_000 });
      await back
        .getByRole('link', { name: /deliveries assigned to you/i })
        .click({ timeout: 10_000 });
      const armed = await back.locator('[data-courier-resume]').count();
      note(
        '14',
        armed > 0 ? 'OK' : 'CANNOT',
        armed > 0
          ? 'signing out reaches the courier entry point, which says it will resume there'
          : 'the courier entry point was not reachable after signing out',
      );
      await back.screenshot({ path: path.join(SHOTS, '13-courier-from-signin.png'), fullPage: true });
    } catch (e) {
      note('14', 'CANNOT', `could not reach the recovered routes: ${String(e).slice(0, 90)}`);
    } finally {
      await back.close();
    }
    fs.writeFileSync(path.join(SHOTS, 'findings.txt'), FINDINGS.join('\n'), 'utf8');
    // eslint-disable-next-line no-console
    console.log('\n===== WALK FINDINGS =====\n' + FINDINGS.join('\n') + '\n=========================\n');
  });
});
