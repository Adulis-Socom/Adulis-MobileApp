import { Injectable } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../common/db/database.types';
import { AdulisException } from '../../common/errors/adulis-exception';
import { createLogger } from '../../common/logging';

/**
 * May this market issue an OTP right now (ADU-AUTH-01 v2.6 S9, S9.2, S16)?
 *
 * Two questions, asked in order, both BEFORE a code is generated:
 *
 *   1. ACTIVATION -- is this market allowed to send OTP at all (S9.2)?
 *   2. BUDGET     -- has the day's spend ceiling been reached (S16)?
 *
 * They are separate controls with separate reasons. Activation is regulatory
 * and operational: an unreviewed market has no sender registration, no
 * compliance review and no measured delivery, so "OTP sending is denied by
 * default for unreviewed international markets" (S9). Budget is money: an
 * SMS costs, and an unbounded OTP endpoint is an unbounded invoice.
 *
 * INVARIANT (S16.2) -- A HARD LIMIT BLOCKS NEW ANONYMOUS ISSUANCE AND
 * NOTHING ELSE. It does not invalidate a live OTP, does not log anyone out,
 * and does not stop an already-issued code from verifying. A spend control
 * that ends a payout change mid-flight is a denial of service wearing a
 * safeguard, and S16.2 says so in as many words: authenticated high-security
 * flows such as step-up may draw on a separately reserved budget.
 */

const log = createLogger();

interface ActivationRow {
  activation_state: string;
  otp_enabled: boolean;
  sender_registration_status: string;
}

interface BudgetRow {
  market_soft: number | null;
  market_hard: number | null;
  global_soft: number;
  global_hard: number;
  spent_today: number;
}

@Injectable()
export class OtpIssuancePolicy {
  /**
   * S9.2 -- only `ACTIVE` markets may receive ordinary new OTP issuance.
   *
   * WHICH MARKET IS PASSED HERE IS AN ENUMERATION QUESTION, NOT A ROUTING
   * ONE, and the caller resolves it accordingly: on an anonymous path it is
   * THE CALLER'S OWN DEVICE'S market, never the market of whatever account
   * the phone might belong to.
   *
   * Reading the account's market here would rebuild the oracle this module
   * has already had once: a phone with an account in an ACTIVE market would
   * answer 202, the same phone without one would answer a refusal, and the
   * sign-in form would tell an attacker which numbers are registered. S17
   * has no "where practical" exception, and market availability may be
   * disclosed only because it "depends solely on public market
   * configuration" -- which is true of the device's market and false of the
   * account's.
   */
  async assertMarketIssuesOtp(
    trx: Transaction<Database>,
    marketId: string,
  ): Promise<void> {
    const r = await sql<ActivationRow>`
      SELECT activation_state::text AS activation_state, otp_enabled,
             sender_registration_status::text AS sender_registration_status
        FROM core.market WHERE id = ${marketId}`.execute(trx);
    const row = r.rows[0];

    // No row is not a "no": it is a caller referring to a market that does
    // not exist, which is ours to fail on rather than theirs.
    if (!row) throw new AdulisException('INTERNAL');

    /**
     * THREE CLAUSES, AND THE FIRST IS UNREACHABLE WHILE THE DATABASE HOLDS.
     * Migration 0043's `market_otp_requires_active` is
     * `CHECK (NOT otp_enabled OR activation_state = 'ACTIVE')`, so no row the
     * database accepts has `otp_enabled` true outside ACTIVE.
     *
     * Worth saying rather than leaving as an apparent redundancy, because it
     * bounds what a test can prove: a SUSPENDED fixture necessarily has
     * `otp_enabled = false`, so deleting the activation clause alone leaves
     * the suite green. It is defence against the constraint being dropped,
     * not a second enforcement of it -- and the claim that a mutation
     * "removes the activation check" was overstated for exactly this reason.
     *
     * THE THIRD CLAUSE IS S10.2's REFUSAL, MOVED TO WHERE IT BELONGS. The
     * router also refuses a REJECTED sender and that stays as defence, but
     * it runs AFTER the challenge commits -- on its own it produced a live,
     * verifiable, undeliverable code and a 500. S10.2's rule is "status !=
     * APPROVED forces `otp_enabled` = false", which is a refusal to ISSUE.
     */
    if (
      row.activation_state !== 'ACTIVE' ||
      !row.otp_enabled ||
      row.sender_registration_status === 'REJECTED'
    ) {
      /**
       * `SUSPENDED` means what suspension should mean (D-183's ruling in
       * ADU-DB-01 v1.14 S30b.3): no new entry, existing trade continues. No
       * new OTP is issued into this market and no new device is assigned to
       * it, while every account already there is untouched -- which is a
       * genuinely useful state, and the reason `is_live` was withdrawn in
       * favour of this column.
       *
       * IT RAISES `VALIDATION_FAILED` BECAUSE ADU-API-01 S7.1'S TAXONOMY IS
       * CLOSED and has no code for this refusal.
       *
       * S7.1 IS TWO SENTENCES AND THEY SAY DIFFERENT THINGS. An earlier
       * version of this comment spliced them into one that inverted the
       * second. Verbatim:
       *
       *   "A code invented in a service is a code with no catalogue entry,
       *    which renders to the buyer as a generic apology in the one moment
       *    they needed to be told what to do."
       *
       *   "Adding a code within `/v1` is additive -- old clients render it
       *    through the S7.2 fallback -- but it is a change to this document,
       *    not a decision taken in a pull request."
       *
       * So the document PERMITS a new code and names the route: an amendment
       * to ADU-API-01. What it forbids is inventing one HERE. Registered,
       * amendment owed, the same way OTP_SUPERSEDED and
       * AGE_DECLARATION_REQUIRED were handled.
       *
       * And the substitute is better than a placeholder, which is why it is
       * not merely tolerable: this is the IDENTICAL refusal a device with no
       * market already gets from `timingFor`. An inactive market and an
       * unbootstrapped device now answer the same thing, so the response
       * distinguishes nothing S17 did not already permit -- a new code would
       * have made the surface MORE informative, not less.
       */
      throw new AdulisException('VALIDATION_FAILED', {
        slots: { path: 'bootstrap' },
      });
    }
  }

  /**
   * S16 -- the daily OTP spending circuit breaker.
   *
   * `anonymous` is the whole shape of S16.2: an anonymous request is new
   * spend the platform did not ask for, and an authenticated step-up is a
   * person already inside finishing something they started.
   */
  async assertWithinBudget(
    trx: Transaction<Database>,
    marketId: string,
    anonymous: boolean,
  ): Promise<void> {
    const r = await sql<BudgetRow>`
      SELECT m.otp_daily_soft_limit AS market_soft,
             m.otp_daily_hard_limit AS market_hard,
             b.otp_global_daily_soft_limit AS global_soft,
             b.otp_global_daily_hard_limit AS global_hard,
             (SELECT count(*)::int FROM core.otp_delivery_attempt
               WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
                       AT TIME ZONE 'UTC') AS spent_today
        FROM core.market m
        CROSS JOIN core.platform_otp_budget b
       WHERE m.id = ${marketId}`.execute(trx);
    const row = r.rows[0];
    if (!row) throw new AdulisException('INTERNAL');

    /**
     * THE DAY IS UTC, and that is a stated choice rather than a default that
     * happened. A market carries `default_timezone`, so a per-market day
     * could be a local one -- but the GLOBAL ceiling spans markets and has
     * no single local day to belong to, and two ceilings that reset at
     * different hours would let a spend spike cross whichever boundary had
     * not yet turned over. One clock for both.
     */

    /**
     * WHAT THIS COUNT ATTRIBUTES, AND WHY OVER-COUNTING IS THE SAFE DIRECTION.
     *
     * `spent_today` counts delivery attempts PLATFORM-WIDE. It is EXACTLY the
     * per-market count while exactly one market is ACTIVE, and that is not a
     * coincidence: only ACTIVE markets issue (S9.2), so every attempt in
     * existence belongs to the one that is.
     *
     * With two ACTIVE markets it OVER-COUNTS any single market -- and it can
     * only over-count, never under-count, because a market's own attempts are
     * a subset of all of them. Checked against a per-market ceiling that
     * means the breaker can fire EARLY, never LATE. A spend control that
     * trips sooner than intended throttles; one that trips later than
     * intended does not control spend at all. The approximation is therefore
     * sound in the direction that matters, and its cost is fairness: a busy
     * market can spend a quiet one's allowance.
     *
     * IT CANNOT BE MADE EXACT HERE, and that is a documented gap rather than
     * an oversight to route around. NOTHING IN THE INSTALLED SCHEMA
     * ATTRIBUTES AN OTP TO A MARKET: `core.otp_delivery_attempt` carries no
     * market and neither does `core.otp_challenge`; v2.6 S12.1's field list
     * has none and ADU-DB-01 v1.14 adds none. Attributing through the phone's
     * ACCOUNT would count only phones that already have one, undercounting
     * exactly the abandoned anonymous requests a spend control exists to
     * catch -- an under-count, which is the unsafe direction.
     *
     * The fix is a `market_id` on the challenge, written at issue. That is a
     * DB amendment, it is registered, and the activation runbook names exact
     * per-market accounting as a prerequisite for a second ACTIVE market.
     *
     * An EARLIER VERSION OF THIS FILE REFUSED TO ISSUE AT ALL once a second
     * market went ACTIVE, reasoning that a number it could not attribute was
     * worse than none. Its own test showed what that means: a fixture market
     * turned OTP on and every market stopped serving. A safeguard whose
     * failure mode is a platform-wide outage is not a safeguard, and the
     * conservative count above is the honest version of the same intent.
     */

    const soft = Math.min(
      row.market_soft ?? Number.POSITIVE_INFINITY,
      row.global_soft,
    );
    const hard = Math.min(
      row.market_hard ?? Number.POSITIVE_INFINITY,
      row.global_hard,
    );

    // S16.1 -- crossing the soft limit alerts and keeps serving. It is a
    // signal, not a control, and it must never become one by accident.
    if (row.spent_today >= soft) {
      log.warn({
        msg: `otp daily soft limit crossed: ${row.spent_today} attempts today`,
      });
    }

    if (row.spent_today >= hard) {
      /**
       * S16.2, and the `anonymous` gate is the invariant rather than a
       * refinement of it. Blocking step-up here would stop a signed-in
       * seller from confirming a payout change because strangers spent the
       * day's SMS budget -- the safeguard becoming the attack.
       */
      if (anonymous) {
        throw new AdulisException('RATE_LIMITED', {
          slots: { retry_after_seconds: secondsUntilUtcMidnight() },
        });
      }
      // NOT "from a reserve" -- there is no reserve, and naming one would
      // describe a mechanism that does not exist. S16.2 PERMITS step-up to
      // draw on a separately reserved budget; what is implemented is that
      // the hard limit does not apply to it.
      log.warn({
        msg: 'otp hard limit reached; authenticated step-up not blocked (S16.2)',
      });
    }
  }
}

/** The hard limit is a daily window, so Retry-After is the rest of the day. */
function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000));
}
