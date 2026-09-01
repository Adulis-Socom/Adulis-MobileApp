/**
 * e2e/helpers/session.ts -- THE ONLY FILE IN THIS HARNESS THAT KNOWS HOW
 * AUTHENTICATION WORKS.
 *
 * ==========================================================================
 * WHY IT IS ONE FUNCTION (WORK ORDER T10 S4)
 * ==========================================================================
 * ADU-AUTH-01 v2.6 is under evaluation and is NOT installed. Phone-plus-OTP is
 * not settled: the provider question, the challenge table's shape and
 * `fn_assert_step_up` are all open.
 *
 * So every auth-dependent step lives here, in `signInAs`. When the mechanism is
 * ruled, ONE FUNCTION CHANGES AND NO TEST DOES -- because everything
 * downstream of a session is unaffected by the ruling. A test that knows a
 * phone number is a test that has to be rewritten twice.
 *
 * ==========================================================================
 * IT DRIVES THE REAL WIRE, NOT A FIXTURE
 * ==========================================================================
 * `bootstrap -> otp/request -> read the code -> otp/verify`, on the browser
 * context's own request object, so the `__Host-` cookies the server sets land
 * in the context the test then navigates. There is no injected cookie and no
 * seeded session: a harness that fabricates a session proves the screens
 * render, not that a seller can reach them.
 *
 * THE CODE COMES FROM THE FILE THE DEV ADAPTER WRITES. D-106: the local SMS
 * adapter no longer prints OTPs to the terminal, because the logger's
 * redaction allow-list exists precisely so the code is never named -- routing
 * it through the logger would satisfy the letter while laundering the value.
 * It appends to a gitignored `apps/api/.dev-sms.log`, and reading that file is
 * the only way a test can learn the code. Development only, by construction.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, BrowserContext } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..', '..', '..');
const SMS_LOG = path.join(REPO, 'apps', 'api', '.dev-sms.log');

export const API = process.env['E2E_API_BASE_URL'] ?? 'http://localhost:3000';

/**
 * The seeded market's seller and the phone that owns it (`pnpm db:seed`).
 * Named here rather than in the tests: which identity signs in is an
 * authentication fact, and S4 keeps those in one file.
 */
export const SEEDED = {
  sellerId: '5eed0000-0000-4000-8000-000000000004',
  phone: '+251900000001',
} as const;

const headers = {
  'X-Adulis-Client': 'web/0.0.0',
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

/** The last six-digit code the dev adapter wrote, or null if it wrote none. */
function lastCode(): string | null {
  if (!existsSync(SMS_LOG)) return null;
  const lines = readFileSync(SMS_LOG, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const m = lines[i]?.match(/"code":"(\d{6})"/);
    if (m) return m[1] as string;
  }
  return null;
}

/**
 * The step-up arm's one window into the dev SMS log (T10's rule that no TEST
 * knows what an OTP is holds: tests call this, and only this file reads the
 * log). Capture the current code before the action, then wait for a NEW one.
 */
export function currentSmsCode(): string | null {
  return lastCode();
}
export async function nextSmsCode(prev: string | null, timeoutMs = 10_000): Promise<string> {
  const t0 = Date.now();
  for (;;) {
    const c = lastCode();
    if (c && c !== prev) return c;
    if (Date.now() - t0 > timeoutMs) throw new Error('no new code appeared in the dev SMS log');
    await new Promise((r) => setTimeout(r, 200));
  }
}

/**
 * Sign the seeded seller in, on this browser context.
 *
 * Returns the seller id the caller should navigate to, so a test never has to
 * name one. `remember_device: true` because the console's own sign-in offers
 * it and the remembered path is the one a returning seller takes (R17).
 */
export async function signInAs(
  context: BrowserContext,
  who: { phone: string; sellerId: string } = SEEDED,
): Promise<string> {
  const key = () => crypto.randomUUID();
  const req = context.request;

  // 1. Bootstrap FIRST, always. This is where the browser's device row is
  //    minted and its httpOnly __Host- cookie set; the server reads the device
  //    from that cookie and there is nothing else to read (D-118).
  const boot = await req.get(`${API}/v1/bootstrap`, { headers });
  if (!boot.ok()) throw new Error(`bootstrap ${boot.status()}`);

  const before = lastCode();

  const asked = await req.post(`${API}/v1/auth/otp/request`, {
    headers: { ...headers, 'Idempotency-Key': key() },
    data: { phone: who.phone, purpose: 'SIGN_IN', audience: 'CONSOLE' },
  });
  if (asked.status() !== 202) throw new Error(`otp/request ${asked.status()}`);

  // The adapter appends synchronously with the response, but a file write and
  // an HTTP response are not ordered, so wait for a code that is not the one
  // that was already there.
  let code: string | null = null;
  for (let i = 0; i < 40 && code === null; i += 1) {
    const seen = lastCode();
    if (seen && seen !== before) code = seen;
    else await new Promise((r) => setTimeout(r, 100));
  }
  if (!code) {
    throw new Error(
      `no new OTP in ${SMS_LOG}. The dev SMS adapter writes there (D-106) and ` +
        'only under NODE_ENV=development -- check the API is running with it set.',
    );
  }

  const verified = await req.post(`${API}/v1/auth/otp/verify`, {
    headers: { ...headers, 'Idempotency-Key': key() },
    // No audience at verify: stamped at request, refused here (S5.2).
    data: { phone: who.phone, code, remember_device: true },
  });
  if (!verified.ok()) throw new Error(`otp/verify ${verified.status()}`);

  // The server's own answer to "am I signed in", which is what the console
  // asks on boot. Asserting it here means a downstream failure is about the
  // screen rather than about the session.
  const sessions = await req.get(`${API}/v1/auth/sessions`, { headers });
  const body = (await sessions.json()) as { data?: Array<{ current?: boolean }> };
  if (!body.data?.some((s) => s.current)) throw new Error('no current session after verify');

  return who.sellerId;
}

/**
 * Sign in ONCE for the whole run and save the cookies.
 *
 * THE OTP BUDGET IS THE REASON, and it is D-124's class arriving in the
 * harness. ADU-VAL-01 S3 ships 3 OTPs/hour per phone. The first version of
 * this suite signed in per test and the fourth test got `otp/request 429` --
 * a refusal about nothing, exactly as the shared rate-limit bucket produces
 * between jest suites. Signing in per test also measures the OTP path eight
 * times and the screens once each, which is backwards.
 *
 * So: one sign-in, one saved `storageState`, every test loaded from it. The
 * sign-in path is still exercised on every run -- once, for real, through the
 * wire -- and it is still the only place this harness knows what an OTP is.
 */
/**
 * The seeded BUYER account -- the other half of two-sided arms (SC-20/21's
 * conversation, SC-C1's courier claim). Signed in ONCE per run by
 * globalSetup, because the OTP budget is per phone and two specs each
 * minting their own code spent it (the D-124 class, rediscovered at C-8).
 */
export const BUYER = {
  phone: '+251900000002',
  accountId: '5eed0000-0000-4000-8000-000000000005',
};

export async function saveSignedInState(browser: Browser, file: string): Promise<void> {
  const context = await browser.newContext();
  await signInAs(context);
  await context.storageState({ path: file });
  await context.close();
}

/** The buyer's session, saved beside the seller's (one OTP per run). */
export async function saveBuyerState(browser: Browser, file: string): Promise<void> {
  const context = await browser.newContext();
  await signInAs(context, { phone: BUYER.phone, sellerId: SEEDED.sellerId });
  await context.storageState({ path: file });
  await context.close();
}
