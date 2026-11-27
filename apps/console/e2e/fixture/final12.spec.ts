import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { atSellerHome, CODE, expectTextScale, goInApp, noHorizontalOverflow, PHONE, scaleText, SELLER, signedInChooser } from './helpers';

/**
 * SC-FE-12 final closure: FE12-01 bounded retry identity (browser), FE12-02 session binding (unit tests in people.test.ts; one journey here),
 * FE12-08 cancellation of sensitive actions, and the targeted responsive and accessibility cases the corrected matrix named. Fixture
 * verification only: nothing is deleted, closed or transferred for real, and nothing here proves production backend security.
 */
const axe = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).disableRules(['target-size']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
};
const log = (page: Page, op: string) => page.evaluate((o) => (window.__ADULIS_FIXTURE__?.callLog() ?? []).filter((c) => c.op === o).map((c) => c.key), op);
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Confirm it is you' });
const codeIn = async (page: Page, sentence: string, code = CODE) => {
  await expect(dialog(page).getByText(sentence)).toBeVisible();
  await dialog(page).getByLabel('One-time code').fill(code);
};
const FULL = 'Some of your earlier changes have not been confirmed. Check their current status before making another change.';

const openThread = async (page: Page, buyer: string) => {
  await goInApp(page, `/s/${SELLER.alem.id}/inbox`);
  await page.getByRole('link', { name: new RegExp(buyer) }).click();
  await expect(page.getByRole('heading', { level: 1, name: buyer })).toBeVisible();
};
const failedReply = async (page: Page, text: string) => {
  await page.getByLabel('Your message').fill(text);
  await page.evaluate(() => window.__ADULIS_FIXTURE__?.failNext('inbox.reply.send', 'NETWORK'));
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(page.getByText('We could not confirm whether this was saved. Check the current status before trying again.')).toBeVisible();
};

test.describe('FE12-01: the retry store is bounded and never evicts', () => {
  test('at capacity a new change is refused before it is sent, with the approved sentence; an unconfirmed one can still be retried', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await openThread(page, 'Demonstration buyer D');
    for (let i = 0; i < 16; i += 1) await failedReply(page, `Unconfirmed reply ${i}`);
    expect(await log(page, 'inbox.reply.send')).toHaveLength(16);
    // The 17th is a genuinely new request: refused, nothing sent.
    await page.getByLabel('Your message').fill('One reply too many');
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByRole('alert').getByText(FULL)).toBeVisible();
    expect(await log(page, 'inbox.reply.send')).toHaveLength(16);
    await page.screenshot({ path: 'screenshots/retry-store-full.desktop-1440.png', fullPage: true });
    // An earlier unconfirmed reply is still retryable, with its ORIGINAL key.
    const first = (await log(page, 'inbox.reply.send'))[0];
    await page.getByLabel('Your message').fill('Unconfirmed reply 0');
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByText('Your reply was sent.')).toBeVisible();
    const after = await log(page, 'inbox.reply.send');
    expect(after).toHaveLength(17);
    expect(after[16]).toBe(first);
    // The definite answer released a slot: a new reply is admitted again.
    // (An in-flight write, such as the read mark that follows opening a thread, also holds a slot until it settles, so allow it to finish.)
    await expect(async () => {
      await page.getByLabel('Your message').fill('One reply too many');
      await page.getByRole('button', { name: 'Send reply' }).click();
      await expect(page.getByText('Your reply was sent.')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 8000 });
    expect(await log(page, 'inbox.reply.send')).toHaveLength(18);
  });

  test('the full-store sentence reads at 390px and 200% text without overflow, and passes axe', async ({ page }) => {
    await scaleText(page, 200);
    await page.setViewportSize({ width: 390, height: 844 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await expectTextScale(page, 200);
    await openThread(page, 'Demonstration buyer D');
    for (let i = 0; i < 16; i += 1) await failedReply(page, `Unconfirmed reply ${i}`);
    await page.getByLabel('Your message').fill('One reply too many');
    await page.getByRole('button', { name: 'Send reply' }).click();
    const alert = page.getByRole('alert').getByText(FULL);
    await expect(alert).toBeVisible();
    await alert.scrollIntoViewIfNeeded();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: 'screenshots/retry-store-full.phone-390-text200.png', fullPage: true });
    await axe(page);
  });

  test('an Account change keeps its key across navigation inside the signed-in session, and a new session starts fresh', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signedInChooser(page, PHONE.owner);
    await page.getByRole('link', { name: 'Your account and security' }).click();
    await page.getByRole('navigation', { name: 'Account sections' }).getByRole('link', { name: 'Notifications' }).click();
    const box = page.getByRole('checkbox', { name: 'Team changes' });
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.failNext('account.preferences.set', 'NETWORK'));
    await box.click();
    await expect(page.getByText('We could not confirm whether this was saved. Check the current status before trying again.')).toBeVisible();
    // Leave the page (another Account page, so the hook is unmounted) and come back: the same request, the same key.
    await page.getByRole('navigation', { name: 'Account sections' }).getByRole('link', { name: 'Security and sessions' }).click();
    await page.getByRole('navigation', { name: 'Account sections' }).getByRole('link', { name: 'Notifications' }).click();
    await page.getByRole('checkbox', { name: 'Team changes' }).click();
    await expect(page.getByRole('checkbox', { name: 'Team changes' })).not.toBeChecked();
    const keys = await log(page, 'account.preferences.set');
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });
});

test.describe('FE12-08: cancelling a sensitive action prevents its dispatch', () => {
  // [page route, how to start, the sentence, the protected operation that must NOT be sent]
  const CASES: readonly { name: string; start: (page: Page) => Promise<void>; sentence: string; op: string }[] = [
    {
      name: 'sign out everywhere else',
      start: async (page) => {
        await page.getByRole('button', { name: 'Sign out everywhere else' }).click();
      },
      sentence: 'Enter the code to sign your account out everywhere else.',
      op: 'account.sessions.revoke_others',
    },
    {
      name: 'copy of my data',
      start: async (page) => {
        await page.getByRole('button', { name: 'Ask for a copy of my data' }).click();
      },
      sentence: 'Enter the code to request a copy of the data in your account.',
      op: 'privacy.export.request',
    },
    {
      name: 'account deletion',
      start: async (page) => {
        await page.getByLabel('Type DELETE to confirm').fill('DELETE');
        await page.getByRole('button', { name: 'Ask to delete my account' }).click();
      },
      sentence: 'Enter the code to ask for your account to be deleted.',
      op: 'privacy.deletion.request',
    },
  ];
  const where = async (page: Page, sub: string) => {
    await signedInChooser(page, PHONE.owner);
    await page.getByRole('link', { name: 'Your account and security' }).click();
    if (sub !== '') await page.getByRole('navigation', { name: 'Account sections' }).getByRole('link', { name: sub }).click();
  };

  for (const c of CASES) {
    for (const how of ['Cancel', 'Escape'] as const) {
      test(`${c.name}: ${how} during verification never sends the protected command`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await where(page, c.op === 'account.sessions.revoke_others' ? '' : 'Privacy and deletion');
        await c.start(page);
        await codeIn(page, c.sentence);
        await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('account.stepup.verify', 1500));
        await dialog(page).getByRole('button', { name: 'Confirm' }).click();
        if (how === 'Cancel') await dialog(page).getByRole('button', { name: 'Cancel' }).click();
        else await page.keyboard.press('Escape');
        await expect(dialog(page)).toBeHidden();
        await page.waitForTimeout(2200);
        expect(await log(page, 'account.stepup.verify')).toHaveLength(1); // the verification itself did go out
        expect(await log(page, c.op)).toHaveLength(0); // the protected command did not
        await expect(dialog(page)).toBeHidden();
      });
    }
  }

  test('Seller closure and ownership transfer: cancelling during verification sends neither', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/settings/closure`);
    await page.getByLabel(`Type ${SELLER.alem.name} to confirm`).fill(SELLER.alem.name);
    await page.getByRole('button', { name: 'Ask to close this Seller' }).click();
    await codeIn(page, `Enter the code to close ${SELLER.alem.name}.`);
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('account.stepup.verify', 1500));
    await dialog(page).getByRole('button', { name: 'Confirm' }).click();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(2200);
    expect(await log(page, 'seller.closure.request')).toHaveLength(0);
    await expect(page.getByRole('button', { name: 'Ask to close this Seller' })).toBeVisible();
    await goInApp(page, `/s/${SELLER.alem.id}/settings/team`);
    await page.getByLabel('New Owner').selectOption({ label: 'Abel (demonstration)' });
    await page.getByRole('button', { name: 'Transfer ownership' }).click();
    await codeIn(page, `Enter the code to transfer ownership of ${SELLER.alem.name} to Abel (demonstration).`);
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('account.stepup.verify', 1500));
    await dialog(page).getByRole('button', { name: 'Confirm' }).click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2200);
    expect(await log(page, 'ownership.transfer.start')).toHaveLength(0);
    await expect(page.getByRole('button', { name: 'Transfer ownership' })).toBeVisible();
  });

  test('a delayed challenge from a cancelled opening is not adopted by the next opening, which still gets its own', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await where(page, 'Privacy and deletion');
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('account.stepup.start', 1800));
    await page.getByRole('button', { name: 'Ask for a copy of my data' }).click(); // opening 1: export, its challenge is slow
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape'); // cancelled while the challenge is being created
    await expect(dialog(page)).toBeHidden();
    await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    await page.getByRole('button', { name: 'Ask to delete my account' }).click(); // opening 2: a different purpose
    await codeIn(page, 'Enter the code to ask for your account to be deleted.'); // its own challenge arrives at once
    await page.waitForTimeout(2200); // opening 1's late answer arrives now
    await expect(dialog(page).getByText('Enter the code to ask for your account to be deleted.')).toBeVisible();
    await expect(dialog(page).getByText('Enter the code to request a copy of the data in your account.')).toHaveCount(0);
    // The current opening still works end to end.
    await dialog(page).getByLabel('One-time code').fill(CODE);
    await dialog(page).getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Your deletion request is waiting until the items above are resolved.')).toBeVisible();
    expect(await log(page, 'privacy.deletion.request')).toHaveLength(1);
    expect(await log(page, 'privacy.export.request')).toHaveLength(0);
  });

  test('reopening for a different recipient while the first challenge is still being created: the second opening gets its own, and keeps it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/settings/team`);
    // Two eligible recipients: Abel is an Admin already; make Saba one too.
    await page.getByRole('button', { name: 'Change roles for Saba (demonstration)' }).click();
    await page.getByRole('list', { name: 'Members' }).getByRole('checkbox', { name: /Admin/ }).check();
    await page.getByRole('button', { name: 'Save roles for Saba (demonstration)' }).click();
    await expect(page.getByLabel('New Owner').locator('option', { hasText: 'Saba (demonstration)' })).toHaveCount(1);
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('account.stepup.start', 1800));
    await page.getByLabel('New Owner').selectOption({ label: 'Abel (demonstration)' });
    await page.getByRole('button', { name: 'Transfer ownership' }).click(); // opening 1, slow challenge
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByLabel('New Owner').selectOption({ label: 'Saba (demonstration)' });
    await page.getByRole('button', { name: 'Transfer ownership' }).click(); // opening 2, the same dialog component, a different recipient
    await codeIn(page, `Enter the code to transfer ownership of ${SELLER.alem.name} to Saba (demonstration).`);
    await page.waitForTimeout(2200); // opening 1's late answer arrives now
    await expect(dialog(page).getByText(/to Saba \(demonstration\)/)).toBeVisible();
    await expect(dialog(page).getByText(/to Abel \(demonstration\)/)).toHaveCount(0);
    await dialog(page).getByLabel('One-time code').fill(CODE);
    await dialog(page).getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText(/Ownership will pass to Saba \(demonstration\)/)).toBeVisible();
  });

  test('navigating away, or the session being replaced, during verification sends nothing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await where(page, 'Privacy and deletion');
    await page.getByRole('button', { name: 'Ask for a copy of my data' }).click();
    await codeIn(page, 'Enter the code to request a copy of the data in your account.');
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('account.stepup.verify', 1500));
    await dialog(page).getByRole('button', { name: 'Confirm' }).click();
    await goInApp(page, '/account'); // away from the page that opened it
    await page.waitForTimeout(2200);
    expect(await log(page, 'privacy.export.request')).toHaveLength(0);
    // Now the session is replaced while a code is being verified (another device took over this Account's session).
    await page.getByRole('button', { name: 'Sign out everywhere else' }).click();
    await codeIn(page, 'Enter the code to sign your account out everywhere else.');
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('account.stepup.verify', 1500));
    await dialog(page).getByRole('button', { name: 'Confirm' }).click();
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.resumeSession('fx_sess_fx_acct_owner_3'));
    await page.waitForTimeout(2200);
    expect(await log(page, 'account.sessions.revoke_others')).toHaveLength(0);
  });

  test('a late wrong-code answer of a cancelled opening does not appear in the next opening', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await where(page, 'Privacy and deletion');
    await page.getByRole('button', { name: 'Ask for a copy of my data' }).click();
    await codeIn(page, 'Enter the code to request a copy of the data in your account.', '111111');
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.delayNext('account.stepup.verify', 1500));
    await dialog(page).getByRole('button', { name: 'Confirm' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Ask for a copy of my data' }).click();
    await codeIn(page, 'Enter the code to request a copy of the data in your account.', '');
    await page.waitForTimeout(2000);
    await expect(dialog(page).getByRole('alert')).toHaveCount(0);
  });
});

test.describe('FE12-04 end to end: signing a member out of one Seller removes authority there on the next request', () => {
  test('the revoked session is refused in that Seller, while the Account itself still works', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/settings/team`);
    await expect(page.getByRole('button', { name: /Sign out of this Seller: Abel/ })).toBeVisible();
    await page.getByRole('button', { name: /Sign out of this Seller: Abel/ }).click();
    await expect(page.getByRole('button', { name: /Sign out of this Seller: Abel/ })).toHaveCount(0);
    // The Admin's other browser now sends its next request.
    await page.evaluate(() => window.__ADULIS_FIXTURE__?.resumeSession('fx_sess_fx_acct_admin_3'));
    // Authorization is per navigation: go somewhere else in the Seller, as the Admin's next click would.
    await goInApp(page, `/s/${SELLER.alem.id}/settings/plan`);
    await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
    // Not the rest of the Account.
    await goInApp(page, '/account');
    await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
  });
});

test.describe('SC-FE-12 closure: targeted responsive coverage at 390px and 200% text', () => {
  const narrow = async (page: Page) => {
    await scaleText(page, 200);
    await page.setViewportSize({ width: 390, height: 844 });
  };
  const check = async (page: Page) => {
    await expectTextScale(page, 200);
    await noHorizontalOverflow(page);
    await axe(page);
  };

  test('Seller closure page, and its step-up dialog', async ({ page }) => {
    await narrow(page);
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/settings/closure`);
    await expect(page.getByText('Nothing has to be paid to close this Seller, and nothing is owed.')).toBeVisible();
    await check(page);
    await page.screenshot({ path: 'screenshots/closure.phone-390-text200.png', fullPage: true });
    await page.getByLabel(`Type ${SELLER.alem.name} to confirm`).fill(SELLER.alem.name);
    await page.getByRole('button', { name: 'Ask to close this Seller' }).click();
    await codeIn(page, `Enter the code to close ${SELLER.alem.name}.`);
    await noHorizontalOverflow(page);
    await dialog(page).getByRole('button', { name: 'Cancel' }).scrollIntoViewIfNeeded();
    await expect(dialog(page).getByRole('button', { name: 'Confirm' })).toBeVisible();
    await page.screenshot({ path: 'screenshots/stepup.phone-390-text200.png' });
  });

  for (const [name, sub] of [['sessions', ''], ['notification preferences', 'Notifications'], ['invitations', 'Team invitations']] as const) {
    test(`Account ${name}`, async ({ page }) => {
      await narrow(page);
      await signedInChooser(page, PHONE.owner);
      await page.getByRole('link', { name: 'Your account and security' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
      if (sub !== '') await page.getByRole('navigation', { name: 'Account sections' }).getByRole('link', { name: sub }).click();
      await expect(page.locator('.skeleton')).toHaveCount(0);
      await check(page);
      await page.screenshot({ path: `screenshots/account-${name.replace(/ /g, '-')}.phone-390-text200.png`, fullPage: true });
    });
  }

  test('a pending transfer to a recipient who is no longer eligible, and the notice that says so', async ({ page }) => {
    await narrow(page);
    await atSellerHome(page, PHONE.owner, SELLER.alem.name);
    await goInApp(page, `/s/${SELLER.alem.id}/settings/team`);
    await page.getByLabel('New Owner').selectOption({ label: 'Abel (demonstration)' });
    await page.getByRole('button', { name: 'Transfer ownership' }).click();
    await codeIn(page, `Enter the code to transfer ownership of ${SELLER.alem.name} to Abel (demonstration).`);
    await dialog(page).getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText(/Ownership will pass to Abel \(demonstration\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Suspend Abel (demonstration)' }).click();
    await page.getByRole('dialog', { name: 'Suspend Abel (demonstration)?' }).getByRole('button', { name: 'Suspend Abel (demonstration)' }).click();
    const ownership = page.getByRole('region', { name: 'Ownership' });
    await expect(ownership.getByText(/is no longer an active Admin/)).toBeVisible();
    await check(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: 'screenshots/transfer-ineligible.desktop-1440.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });

    // SC12-FINAL-03: real viewport screenshots while scrolling (never a stitched capture), and proof that nothing fixed or sticky covers the message or the control.
    const notice = ownership.getByText(/is no longer an active Admin/);
    const cancel = ownership.getByRole('button', { name: 'Cancel the transfer' });
    // True when, with the element scrolled to the middle of the viewport, its sampled points are the top-most thing at that point (not a bar over it).
    const unobscured = (loc: Locator) =>
      loc.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const pts: Array<[number, number]> = [];
        for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.1, 0.5, 0.9]) pts.push([r.left + r.width * fx, r.top + r.height * fy]);
        return pts.every(([x, y]) => {
          if (y < 0 || y > innerHeight) return false;
          const top = document.elementFromPoint(x, y);
          return top !== null && (el === top || el.contains(top));
        });
      });
    // The message is fully readable: bring each band of it, in turn, to the viewport middle and require it uncovered.
    const height = await notice.evaluate((el) => el.getBoundingClientRect().height);
    for (let y = 0; y <= height; y += 24) {
      await notice.evaluate((el, off) => {
        const r = el.getBoundingClientRect();
        scrollBy(0, r.top + off - innerHeight / 2);
      }, y);
      const covered = await notice.evaluate((el, off) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const py = r.top + Math.min(off, r.height - 1);
        const top = document.elementFromPoint(x, py);
        return !(top && (el === top || el.contains(top)));
      }, y);
      expect(covered, `notice band at ${y}px is covered by something`).toBe(false);
    }
    // Walk the section top to bottom one viewport-sized step at a time.
    await ownership.evaluate((el) => scrollTo(0, el.getBoundingClientRect().top + scrollY - 8));
    for (let i = 1; i <= 4; i++) {
      await page.screenshot({ path: `screenshots/transfer-ineligible.phone-390-text200.step${i}.png` });
      const atEnd = (await ownership.evaluate((el) => el.getBoundingClientRect().bottom)) < 400;
      if (atEnd) break;
      await page.evaluate(() => scrollBy(0, innerHeight * 0.6));
    }
    // The control: reached by keyboard from the section heading, so the browser's own focus scroll is what is being tested.
    await ownership.getByRole('heading').first().evaluate((h) => { h.setAttribute('tabindex', '-1'); (h as HTMLElement).focus(); });
    let focused = false;
    for (let i = 0; i < 25 && !focused; i++) {
      await page.keyboard.press('Tab');
      focused = await cancel.evaluate((el) => el === document.activeElement);
    }
    expect(focused, 'Cancel the transfer is reachable by Tab').toBe(true);
    expect(await unobscured(cancel), 'Cancel the transfer is uncovered after keyboard focus').toBe(true);
    const ring = await cancel.evaluate((el) => {
      const c = getComputedStyle(el);
      return { match: el.matches(':focus-visible'), outline: c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0, shadow: c.boxShadow !== 'none' };
    });
    expect(ring.match, 'keyboard focus is :focus-visible').toBe(true);
    expect(ring.outline || ring.shadow, `a visible focus indicator ${JSON.stringify(ring)}`).toBe(true);
    await page.screenshot({ path: 'screenshots/transfer-ineligible.phone-390-text200.cancel-focused.png' });
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Ownership will pass to Abel/)).toHaveCount(0);
    await page.screenshot({ path: 'screenshots/transfer-ineligible.phone-390-text200.after-cancel.png' });
  });
});
