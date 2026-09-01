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
  market_spent: number;
  global_spent: number;
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
             (SELECT count(*)::int FROM core.otp_delivery_attempt a
                JOIN core.otp_challenge c ON c.id = a.otp_challenge_id
               WHERE c.market_id = ${marketId}
                 AND a.created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
                       AT TIME ZONE 'UTC') AS market_spent,
             (SELECT count(*)::int FROM core.otp_delivery_attempt
               WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
                       AT TIME ZONE 'UTC') AS global_spent
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
     * TWO CEILINGS, TWO COUNTS, EACH AGAINST ITS OWN (S16; ADU-RUL-06 S2).
     *
     * `market_spent` is attributed through `otp_challenge.market_id` -- the
     * stamp migration 0044 added, which is what made D-193 close "for free":
     * every challenge names the market that governed its creation, so its
     * attempts belong somewhere by construction. `global_spent` is the
     * platform-wide count the platform ceiling was always about.
     *
     * The PREVIOUS version of this file could not attribute -- nothing in the
     * schema named a market -- so it checked one platform-wide count against
     * `Math.min(market, global)`: conservative (it could only fire early),
     * unfair (a busy market spent a quiet one's allowance), and recorded as
     * such. The stamp removes the approximation rather than tuning it.
     *
     * A market with NULL limits has NO per-market ceiling -- that is the row
     * a newly activated market has until an operator sets one (the runbook's
     * step 3) -- and the GLOBAL ceiling still binds it, which is the reason
     * the platform row exists and both of its columns are NOT NULL.
     *
     * Attempts on PRE-0044 challenges carry no market and count against the
     * global ceiling only; the transitional window is one TTL wide.
     */
    const softCrossed =
      (row.market_soft !== null && row.market_spent >= row.market_soft) ||
      row.global_spent >= row.global_soft;
    const hardCrossed =
      (row.market_hard !== null && row.market_spent >= row.market_hard) ||
      row.global_spent >= row.global_hard;

    // S16.1 -- crossing the soft limit alerts and keeps serving. It is a
    // signal, not a control, and it must never become one by accident.
    if (softCrossed) {
      log.warn({
        msg:
          `otp daily soft limit crossed: market ${row.market_spent}, ` +
          `platform ${row.global_spent} attempts today`,
      });
    }

    if (hardCrossed) {
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
