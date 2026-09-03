/**
 * The store chooser, after D-97 was closed.
 *
 * THIS FILE USED TO ASSERT THE OPPOSITE, and the history is the point. There
 * was no endpoint listing the caller's own sellers, so the chooser took a
 * pasted store id and NAMED the hole on screen -- and this spec existed "to
 * stop a later agent quietly deleting an awkward sentence". T9 S4.2 ruled that
 * the shape of the endpoint was contract design and must not be invented.
 *
 * T18 Phase 3 built it: GET /v1/seller/list, exempted from the seller header
 * beside the two POSTs that were already exempt, for the same reason -- a path
 * under /v1/seller that no seller header can describe. So the sentence is gone
 * because the gap is gone, which is the only acceptable way for it to go.
 *
 * What this file asserts now is S2.1's rule, which the old chooser could only
 * describe: REDIRECT WHEN EXACTLY ONE.
 */
import { test, expect } from '@playwright/test';
import { SEEDED } from './helpers/session';

test.describe('the store chooser -- D-97 closed', () => {
  test('one store: the seller is taken straight into it, never asked to choose', async ({
    page,
  }) => {
    /*
     * The seeded account owns exactly one store, which is the shape almost
     * every real seller has. T17's walk recorded the old behaviour as "a
     * returning seller is asked to paste a store id ... (1 link(s) on the
     * page)" -- the second thing that would have made a real seller give up,
     * after not being able to create a store at all.
     */
    await page.goto('/');
    await expect(page).toHaveURL(new RegExp(`/s/${SEEDED.sellerId}$`));
    // It is really their store, not just a URL: Home's readiness list renders.
    await expect(page.locator('[data-item]').first()).toBeVisible();
  });

  test('a single-store seller reaches "Create a store" without typing a URL (T19 P1)', async ({
    page,
  }) => {
    /*
     * HALF OF THE REGRESSION #80 SHIPPED, and the state it broke in.
     *
     * The redirect is right -- a returning seller belongs in their store, not
     * on a chooser. But the chooser carried two links, and forwarding past it
     * left both reachable only by typing a URL. That is exactly the failure
     * T17 recorded as the point where a real seller stops and messages the
     * founder, reintroduced by the fix for it.
     *
     * This starts where the seller starts: at "/" with exactly one store.
     */
    await page.goto('/');
    await expect(page).toHaveURL(new RegExp(`/s/${SEEDED.sellerId}$`));

    // With a single store there is nothing to switch to, so the menu is not a
    // switcher -- it is the store list plus the way to add one, which is the
    // control that must not be lost. A component that drew nothing below two
    // stores would satisfy S9.2 and leave the regression in place.
    await page.locator('[data-switcher-toggle]').click();
    await page
      .locator('[data-switcher-menu]')
      .getByRole('link', { name: /create a store/i })
      .click();
    await expect(page).toHaveURL(/\/s\/new$/);
    await expect(page.getByRole('button', { name: /create my store/i })).toBeVisible();
  });

  test('the SWITCHER proper: more than one store, and switching works (T19 P1)', async ({
    page,
  }) => {
    /*
     * The behaviour ADU-REPO-01 S9.2 actually rules, and it had no coverage at
     * all -- the single-store rendering is what this phase needed, so it was
     * the only thing tested. Planted, because the seeded account owns one
     * store and a second would change every other spec's world.
     */
    await page.route('**/v1/seller/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          data: [
            { id: SEEDED.sellerId, handle: 'seed-store', store_name: 'Seed Store', status: 'ACTIVE', role: 'OWNER' },
            {
              id: '5eed0000-0000-4000-8000-0000000000ff',
              handle: 'second-store',
              store_name: 'Second Store',
              status: 'ACTIVE',
              role: 'ADMIN',
            },
          ],
        },
      });
    });
    await page.goto(`/s/${SEEDED.sellerId}`);

    // The topbar names THIS store, not the generic label.
    await expect(page.locator('[data-switcher] .store-name')).toHaveText('Seed Store');
    // With somewhere to go, it offers to switch.
    await expect(page.locator('[data-switcher-toggle]')).toHaveText(/switch store/i);

    await page.locator('[data-switcher-toggle]').click();
    const menu = page.locator('[data-switcher-menu]');
    await expect(menu.locator('[data-switcher-seller]')).toHaveCount(1);

    // Escape closes it -- a menu with no way out is a trap on a phone.
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    await page.locator('[data-switcher-toggle]').click();
    await menu.getByRole('link', { name: 'Second Store' }).click();
    await expect(page).toHaveURL(/\/s\/5eed0000-0000-4000-8000-0000000000ff$/);
  });

  test('a seller reaches COURIER WORK from inside their store (T20 S3)', async ({ page }) => {
    /*
     * T19 parked this: a courier who also owns exactly one store was
     * redirected into it and had to SIGN OUT to see their deliveries. The
     * ruling makes the entry point a LINE IN THE SWITCHER MENU -- a link, not
     * a mode. ADU-MOB-01 makes buyer/seller a real mode with its own session
     * semantics; this is one person with two unrelated relationships to
     * Adulis, and a link is the honest shape.
     */
    // Start where D-245's parked case starts: at "/", REDIRECTED -- the
    // account that could never see the chooser is the one this ruling is for.
    await page.goto('/');
    await expect(page).toHaveURL(new RegExp(`/s/${SEEDED.sellerId}$`));
    await page.locator('[data-switcher-toggle]').click();
    await page
      .locator('[data-switcher-menu]')
      .getByRole('link', { name: /courier deliveries/i })
      .click();
    await expect(page).toHaveURL(/\/courier$/);
    // Not a blank page: SC-C1 itself renders -- for a non-courier that is the
    // empty state that explains itself. Its root is a data-screen div, not a
    // <main>: the courier tree deliberately carries none of the seller shell.
    await expect(page.locator('[data-screen="SC-C1"]')).toBeVisible();
    // ...and the empty state EXPLAINS ITSELF -- the half a bare visibility
    // check would not prove (both pass lenses converged on this line).
    await expect(page.getByText('No assigned orders')).toBeVisible();
  });

  test('a FAILED store list is never mistaken for "you have one store" (T19 P1)', async ({
    page,
  }) => {
    /*
     * The first draft caught every failure into rows = [], which renders
     * byte-identically to an account with exactly one store: the generic
     * "Your store", a menu with no stores in it, and no sign anything went
     * wrong -- for the rest of the session, because the fetch runs once per
     * Shell mount and Shell does not remount on navigation. A seller with
     * three stores would have concluded they had lost access to two of them.
     */
    await page.route('**/v1/seller/list', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', json: {} });
    });
    await page.goto(`/s/${SEEDED.sellerId}`);

    // The store name alone -- exactly what the topbar showed before the
    // switcher existed -- plus a way to try again.
    await expect(page.locator('[data-switcher-retry]')).toBeVisible();
    // ...and NOT a menu that would claim this account has no other stores.
    await expect(page.locator('[data-switcher-toggle]')).toHaveCount(0);
    await expect(page.locator('[data-switcher-menu]')).toHaveCount(0);

    // The rest of the console is unaffected: a failed topbar list must not
    // take a working screen down with it.
    await expect(page.locator('[data-item]').first()).toBeVisible();
  });

  test('the courier entry point is on SIGN-IN, ahead of any seller routing (T19 P1)', async ({
    browser,
  }) => {
    /*
     * THE OTHER HALF, and it moved rather than being restored where it was.
     * A courier is not seller staff: they hold their own account, they see
     * only assigned orders, and they have no store to be redirected into.
     * Routing them through a store chooser was wrong before #80 made it
     * visible.
     *
     * ANONYMOUS CONTEXT, deliberately. This suite shares one signed-in
     * storageState, and signing out REVOKES that session row server-side --
     * it would 401 every spec that runs afterwards. A courier arriving at
     * sign-in is unauthenticated anyway, so this is also the truer starting
     * state. The signed-in path (sign out, then click through) is proved by
     * zz-beta-walk, whose account is its own and which runs last.
     */
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await ctx.newPage();
      await page.goto('/sign-in');

      // /courier is behind RequireSession, so following this while signed out
      // bounces back here -- correctly, and with `from` armed, so the courier
      // lands on their deliveries after verifying. The round trip is
      // invisible, which reads as a dead link on the screen a courier meets
      // first, so the screen says what will happen.
      await page.getByRole('link', { name: /deliveries assigned to you/i }).click();
      await expect(page).toHaveURL(/\/sign-in/);
      await expect(page.locator('[data-courier-resume]')).toBeVisible();
      await expect(page.getByText(/straight to your deliveries/i)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('the redirect REPLACES history -- Back does not bounce', async ({ page }) => {
    // A seller who lands in their store and presses Back should leave the app,
    // not be forwarded again by a screen they never chose to visit. Asserted
    // by going somewhere first, then through "/", then back.
    await page.goto('/sign-in');
    await page.goto('/');
    await expect(page).toHaveURL(new RegExp(`/s/${SEEDED.sellerId}$`));
    await page.goBack();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test('the gap sentence and the pasted-id box are GONE, not hidden', async ({ page }) => {
    /*
     * The inverse of what this spec used to guard. The old screen carried the
     * hole's label and a box for a store id; both existed only because no
     * endpoint could enumerate. If either reappears, something has regressed
     * to asking a seller for an identifier they were never given.
     *
     * Checked on the CHOOSER ITSELF, which a single-store account is
     * redirected away from -- so the assertions run against a planted
     * two-store response, the only way to see this screen at all now.
     */
    await page.route('**/v1/seller/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          data: [
            { id: SEEDED.sellerId, handle: 'seed-store', store_name: 'Seed Store', status: 'ACTIVE', role: 'OWNER' },
            {
              id: '5eed0000-0000-4000-8000-0000000000ff',
              handle: 'second-store',
              store_name: 'Second Store',
              status: 'DRAFT',
              role: 'ANALYST',
            },
          ],
        },
      });
    });
    await page.goto('/');

    // A POSITIVE ASSERTION FIRST, and it is not decoration. Four toHaveCount(0)
    // checks pass on a blank page, on a crashed render, and on a screen that
    // has not finished loading -- D-152's exact class ("assert where the
    // browser ENDED UP"). Waiting for the list to be on screen is what makes
    // the four absences below mean anything.
    await expect(page.locator('[data-seller]')).toHaveCount(2);

    await expect(page.locator('#chooser-id')).toHaveCount(0);
    await expect(page.getByText(/paste the store id/i)).toHaveCount(0);
    await expect(page.getByText(/D-97/)).toHaveCount(0);
    await expect(page.locator('[data-gap]')).toHaveCount(0);
  });

  test('more than one store: each is listed with the role this account holds on it', async ({
    page,
  }) => {
    /*
     * S2.1: one account may be Owner of A and staff of B. The ROLE is per
     * store, not per account, so it is rendered per row -- and as a word a
     * seller reads, never the enum.
     */
    await page.route('**/v1/seller/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          data: [
            { id: SEEDED.sellerId, handle: 'seed-store', store_name: 'Seed Store', status: 'ACTIVE', role: 'OWNER' },
            {
              id: '5eed0000-0000-4000-8000-0000000000ff',
              handle: 'second-store',
              store_name: 'Second Store',
              status: 'DRAFT',
              role: 'ANALYST',
            },
          ],
        },
      });
    });
    await page.goto('/');

    const rows = page.locator('[data-seller]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Seed Store');
    await expect(rows.nth(0)).toContainText('Owner');
    await expect(rows.nth(1)).toContainText('Second Store');
    await expect(rows.nth(1)).toContainText('Analyst');
    // The raw enum never reaches the screen.
    await expect(page.getByText('SALES_SUPPORT')).toHaveCount(0);
    await expect(page.getByText(/^ANALYST$/)).toHaveCount(0);

    // Opening one goes to that store.
    await rows.nth(0).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/s/${SEEDED.sellerId}$`));
  });

  test('no stores at all: a good empty state and the way to make one', async ({ page }) => {
    // An account with no store is every seller on the day they arrive. The
    // only thing they need is the route to creating one -- which T17 found
    // was reachable only by typing /s/new into the address bar.
    await page.route('**/v1/seller/list', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', json: { data: [] } });
    });
    await page.goto('/');

    await expect(page.getByText(/do not have a store yet/i).first()).toBeVisible();
    await page.getByRole('link', { name: /create a store/i }).click();
    await expect(page).toHaveURL(/\/s\/new$/);
    await expect(page.getByRole('button', { name: /create my store/i })).toBeVisible();
  });
});
