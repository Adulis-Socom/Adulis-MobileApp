import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { APP_DATABASE } from '../../common/db/database.module';
import type { Database } from '../../common/db/database.types';
import { AdulisException } from '../../common/errors/adulis-exception';
import { SMS_PROVIDERS, type SmsProvider, type SmsProviderName } from './sms-provider';

/**
 * `SmsProviderRouter` (ADU-AUTH-01 v2.6 S6.1).
 *
 * "Provider routing comes from market configuration." Not from the phone's
 * country code, not from a switch in a service, not from an environment
 * variable -- from `core.market`, which is the row an operator edits when
 * they activate a market and the row the activation runbook walks.
 *
 *     ETHIOPIA                    Primary = AFROMESSAGE
 *                                 Fallback = SMSETHIOPIA once approved
 *     INTERNATIONAL ACTIVE        Primary = INFOBIP
 *                                 Fallback = TWILIO where approved
 *
 * ETHIOPIA HAS NO FALLBACK TODAY, and that is the configured state rather
 * than a missing feature (S7.1): SMSEthiopia is a CANDIDATE, not a route.
 * `sms_fallback_provider IS NULL` is how "Fallback = NONE" is written -- and
 * it is why S7.1's provider lifecycle gets no state machine of its own
 * (D-182: a state machine with one live transition is a table waiting to
 * disagree with the column beside it).
 *
 * So S7.4's accepted limitation holds and is worth stating where the code
 * implements it: while AfroMessage is down, NEW sends fail, and codes
 * ALREADY DELIVERED still verify -- because verification is local and reads
 * `core.otp_challenge`, which no provider can reach.
 *
 * INVARIANT (S6.1) -- provider routing has no authorization semantics.
 * Nothing here decides who may sign in, what a session may do, or whether a
 * market accepts OTP at all. That last one is the ACTIVATION gate and it
 * runs BEFORE this, in the issuing path; a router that also decided
 * eligibility would be a second answer to a question already answered.
 */

export interface MarketRoute {
  readonly primary: SmsProvider;
  /** S7.1's `Fallback = NONE` when the market configures none. */
  readonly fallback: SmsProvider | null;
}

interface RouteRow {
  sms_primary_provider: SmsProviderName | null;
  sms_fallback_provider: SmsProviderName | null;
  sender_registration_status: string;
}

@Injectable()
export class SmsProviderRouter {
  constructor(
    @Inject(APP_DATABASE) private readonly db: Kysely<Database>,
    @Inject(SMS_PROVIDERS) private readonly providers: Readonly<
      Record<SmsProviderName, SmsProvider>
    >,
  ) {}

  /**
   * The route a market's configuration names.
   *
   * FAILS CLOSED, twice. A market with no primary provider cannot send --
   * that is `INTERNAL` rather than a silent no-op, because an OTP that was
   * never transported and never reported is the failure mode where a user
   * waits for a message nobody sent. And a configured provider with no bound
   * implementation is the same class of hole: the enum value exists, the
   * adapter does not, and refusing is the only honest answer.
   */
  async routeFor(marketId: string): Promise<MarketRoute> {
    const r = await sql<RouteRow>`
      SELECT sms_primary_provider::text        AS sms_primary_provider,
             sms_fallback_provider::text       AS sms_fallback_provider,
             sender_registration_status::text  AS sender_registration_status
        FROM core.market WHERE id = ${marketId}`.execute(this.db);
    const row = r.rows[0];
    if (!row?.sms_primary_provider) throw new AdulisException('INTERNAL');

    /**
     * S10.2, AS MUCH OF IT AS THE SCHEMA CAN EXPRESS -- and the rest is named
     * rather than implied.
     *
     * The rule is: "where registration is mandatory, status != APPROVED
     * forces otp_enabled = false unless an approved alternative route
     * exists." Migration 0043's own comment says this is "enforced in the
     * router, not by a CHECK" -- IT WAS NOT, and a comment claiming an
     * enforcement that does not exist is the defect D-186 was registered for,
     * one level up.
     *
     * `REJECTED` is the part that needs no extra knowledge: a vendor has
     * refused this sender, so the route cannot carry a message whether or not
     * registration was mandatory. It is refused here.
     *
     * `PENDING` and `NOT_REQUIRED` are NOT refused, and cannot be, because
     * the schema does not carry WHERE REGISTRATION IS MANDATORY -- 0043's
     * comment admits this in its own last clause. Whether a pending
     * registration may serve is a per-market compliance decision, and it is
     * an item on the activation checklist (S9.3), which is where a human
     * makes it. Registered, so the gap is a known one rather than a silence.
     */
    if (row.sender_registration_status === 'REJECTED') {
      throw new AdulisException('INTERNAL');
    }

    const primary = this.providers[row.sms_primary_provider];
    if (!primary) throw new AdulisException('INTERNAL');

    const fallbackName = row.sms_fallback_provider;
    if (!fallbackName) return { primary, fallback: null };

    const fallback = this.providers[fallbackName];
    if (!fallback) throw new AdulisException('INTERNAL');

    // A market configured to fail over to its own primary would produce two
    // attempts against the same vendor and call it redundancy.
    if (fallback.name === primary.name) return { primary, fallback: null };

    return { primary, fallback };
  }
}
