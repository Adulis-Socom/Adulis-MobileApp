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
