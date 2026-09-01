import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { APP_DATABASE } from '../../common/db/database.module';
import type { Database } from '../../common/db/database.types';
import { createLogger } from '../../common/logging';
import type { SmsMessage } from './sms.adapter';
import type { SendOutcome, SendResult, SmsProvider } from './sms-provider';
import { SmsProviderRouter } from './sms-provider.router';

/**
 * OTP delivery (ADU-AUTH-01 v2.6 S5.5, S5.6, S12, S12.1, S12.2).
 *
 * TRANSPORT STATE IS SEPARATE FROM SECURITY STATE (S12), and this file only
 * ever writes the first. One challenge may have many delivery attempts; the
 * code's validity, its expiry and its attempt budget live in
 * `core.otp_challenge` and are not derived from anything written here.
 *
 *     DELIVERED       does not mean authenticated
 *     FAILED_FINAL    does not invalidate a code the user already holds
 *
 * FAILOVER IS NOT RESEND (S5.5), and this service is where the difference is
 * enforced rather than described. Failover transports THE SAME LIVE OTP over
 * a second vendor:
 *
 *     one challenge - one OTP - one expiry - one attempt budget
 *
 * A resend is the other operation entirely: the old code dies and a new one
 * is generated. Nothing in this file issues a challenge, generates a code, or
 * touches `core.otp_challenge` -- it takes an already-issued message and
 * transports it. That is the structural guarantee; the test asserts it from
 * the outside by counting challenge rows across a failover.
 *
 * IT RUNS AFTER COMMIT. The challenge is committed by the handler
 * transaction and only then handed here, so a rolled-back issue transports
 * nothing and an idempotent replay transports nothing -- the same rule the
 * SMS adapter has always followed, now with a ledger behind it.
 */

const log = createLogger();

/**
 * S12.2's six statuses.
 *
 * FOUR ARE EVER WRITTEN TODAY. `DELIVERED` and `FAILED_FINAL` are the two a
 * delivery callback would write (S13), AND NO CALLBACK ROUTE EXISTS -- no
 * vendor is integrated, so there is nothing to receive one from. The enum is
 * still right (S12.2 is "at minimum"), but saying they "are written by
 * callbacks" in the present tense would be a claim about a mechanism that is
 * not there, which is the exact defect D-186 and D-195 were registered for.
 *
 * The consequence is worth stating rather than leaving implicit: nothing
 * finalises an `ACCEPTED` and nothing resolves a `DELIVERY_UNKNOWN`, so this
 * ledger records what WE did, never what arrived.
 */
type DeliveryStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DELIVERED'
  | 'DEFINITIVE_NOT_SENT'
  | 'DELIVERY_UNKNOWN'
  | 'FAILED_FINAL';

/**
 * What an issued challenge hands to transport.
 *
 * THE MARKET TRAVELS WITH IT rather than being re-derived here. v2.6 S6.1
 * routes from market configuration, and issuance has already resolved which
 * market this challenge belongs to -- including the S17 care about WHICH
 * market may be read on an anonymous path. Asking again here would be a
 * second answer to a settled question, and two answers can disagree.
 */
export interface IssuedOtp {
  readonly challengeId: string;
  readonly marketId: string;
  readonly sms: SmsMessage;
}

export interface DeliveryReport {
  readonly attempts: number;
  /** The outcome of the LAST attempt made. */
  readonly outcome: SendOutcome;
  /** Which vendor transported it, when one accepted. */
  readonly acceptedBy: string | null;
}

@Injectable()
export class OtpDeliveryService {
  constructor(
    @Inject(APP_DATABASE) private readonly db: Kysely<Database>,
    private readonly router: SmsProviderRouter,
  ) {}

  /**
   * The after-commit entry point every OTP path uses.
   *
   * `null` is the ORDINARY case, not an error: a rolled-back issue and an
   * idempotent replay both leave nothing to transport, which is X11's whole
   * point -- a retried request must not put a second SMS on a person's
   * phone. Handlers therefore call this unconditionally and say nothing
   * about it.
   */
  async transport(issued: IssuedOtp | null): Promise<DeliveryReport | null> {
    if (!issued) return null;
    try {
      return await this.deliver(issued.challengeId, issued.marketId, issued.sms);
    } catch (err) {
      /**
       * NOTHING ESCAPES THIS, AND THE REASON IS THE COMMIT THAT ALREADY
       * HAPPENED.
       *
       * `deliver` is no-throw for transport OUTCOMES, which an earlier
       * version of this file claimed was the whole story. It was wrong:
       * `deliver` also raises for a market with no primary provider, a
       * configured provider with no bound adapter, a REJECTED sender
       * registration, and any SQL error on the two attempt statements. Every
       * one happens AFTER the handler transaction committed the challenge
       * AND its idempotency record.
       *
       * The consequence was not a 500, it was a PERMANENT one. The caller
       * gets 500, retries with the SAME Idempotency-Key, and the stored 202
       * replays with nothing to transport: no SMS, ever, while the client
       * advances to the code step and starts a countdown. The console's
       * sign-in does not remint its key on an error path, so the retry is
       * always a replay -- verbatim the failure its own comment says was
       * fixed once already.
       *
       * It also catches the ROLLED-BACK challenge: two concurrent requests
       * on one Idempotency-Key leave the loser holding an `issued` whose
       * `otp_challenge` row rolled back, so the attempt INSERT violates its
       * foreign key. Swallowing that is CORRECT -- a replay must transport
       * nothing -- and it is what this file's header already claimed.
       *
       * LOUD, THOUGH. This is the one place a person waits for a message
       * nobody sent, so it is an error line, and D-196's ruling request is
       * what closes it properly: the wire cannot say "issued, not sent".
       */
      log.error({
        msg: 'otp transport raised after the challenge committed; no SMS sent',
        err: err instanceof Error ? err.name : 'unknown',
      });
      return null;
    }
  }

  /**
   * Transport an issued OTP, failing over once where the rule permits it.
   *
   * DOES NOT THROW on a transport failure, and that is deliberate. The
   * challenge is already committed: raising here would leave a live code the
   * caller was told did not exist, and would turn a vendor outage into a
   * 500 on an endpoint whose contract is 202. Every outcome is written to
   * `core.otp_delivery_attempt`, which is the record that can be read.
   *
   * The gap this leaves is worth naming rather than hiding: the wire cannot
   * currently say "issued but not transported" -- ADU-API-01 S7.1's taxonomy
   * has no code for it, and inventing one here would be designing a contract
   * from the implementation side. Registered, amendment owed.
   */
  async deliver(
    challengeId: string,
    marketId: string,
    sms: SmsMessage,
  ): Promise<DeliveryReport> {
    const route = await this.router.routeFor(marketId);

    const first = await this.attempt(challengeId, 1, route.primary, sms);
    if (first.outcome === 'ACCEPTED') {
      return { attempts: 1, outcome: 'ACCEPTED', acceptedBy: route.primary.name };
    }

    /**
     * THE ONE RULE THIS WHOLE FILE EXISTS FOR (S5.6).
     *
     * Automatic failover is permitted only from `DEFINITIVE_NOT_SENT` -- the
     * provider refused BEFORE dispatch, so nothing is in flight and a second
     * send cannot duplicate anything.
     *
     * `DELIVERY_UNKNOWN` is not that. An HTTP timeout after transmission, a
     * lost acknowledgement, a delayed receipt: THE FIRST PROVIDER MAY
     * ALREADY HAVE SENT THE SMS. Failing over would deliver two messages
     * carrying the same code -- harmless, and it looks like a bug to the
     * person holding the phone. A later user-requested resend follows the
     * normal resend flow (S7.5), which is a decision the user makes and not
     * one this service makes for them.
     */
    if (first.outcome !== 'DEFINITIVE_NOT_SENT' || !route.fallback) {
      return { attempts: 1, outcome: first.outcome, acceptedBy: null };
    }

    const second = await this.attempt(challengeId, 2, route.fallback, sms);
    return {
      attempts: 2,
      outcome: second.outcome,
      acceptedBy: second.outcome === 'ACCEPTED' ? route.fallback.name : null,
    };
  }

  /**
   * One attempt: row first, vendor second, classification third.
   *
   * THE ROW IS WRITTEN BEFORE THE VENDOR CALL, not after. A callback (S13)
   * can arrive before the send's own response does, and it needs a row to
   * land on; an attempt recorded only on success is also an attempt that
   * vanishes exactly when someone needs to know it happened.
   */
  private async attempt(
    challengeId: string,
    attemptNo: number,
    provider: SmsProvider,
    sms: SmsMessage,
  ): Promise<SendResult> {
    const attemptId = randomUUID();
    await sql`
      INSERT INTO core.otp_delivery_attempt
        (id, otp_challenge_id, attempt_no, provider, status)
      VALUES (${attemptId}, ${challengeId}, ${attemptNo},
              ${provider.name}::core.sms_provider, 'PENDING')`.execute(this.db);

    let result: SendResult;
    try {
      result = await provider.send(sms.phone, sms, attemptId);
    } catch (err) {
      /**
       * A THROW IS `DELIVERY_UNKNOWN`, NEVER `DEFINITIVE_NOT_SENT`.
       *
       * An exception is the absence of a classification, and the two
       * defaults are not symmetric: treating it as definitive would fail
       * over on an unknown, which is the single thing S5.6 forbids. A
       * connection reset mid-request is indistinguishable from a delivered
       * message whose reply was lost, so it is exactly the case the
       * asymmetry was written for.
       */
      result = {
        outcome: 'DELIVERY_UNKNOWN',
        providerMessageId: null,
        failureClass: 'adapter_threw',
      };
      // The provider NAME and the class, never the phone and never the body.
      log.warn({
        msg: `sms provider ${provider.name} threw; classified DELIVERY_UNKNOWN`,
        err: err instanceof Error ? err.name : 'unknown',
      });
    }

    await this.record(attemptId, result);
    return result;
  }

  /** S12.2's statuses, and the two timestamps that mean different things. */
  private async record(attemptId: string, result: SendResult): Promise<void> {
    // The three send outcomes are three of the six statuses, by the same
    // names. (This was a ternary whose arms were identical.)
    const status: DeliveryStatus = result.outcome;

    /**
     * `accepted_at` is when a vendor took it. `finalized_at` is when the
     * attempt can no longer change.
     *
     * They are not the same event and only one outcome sets both to nothing:
     *
     *   ACCEPTED             accepted, not final -- a callback may yet say
     *                        DELIVERED or FAILED_FINAL
     *   DEFINITIVE_NOT_SENT  final immediately; the vendor refused and there
     *                        is nothing further to hear
     *   DELIVERY_UNKNOWN     NEITHER. Not accepted, and deliberately not
     *                        final: the message may still have gone out, and
     *                        a late receipt is exactly what would resolve it.
     *                        Finalising it here would be recording an answer
     *                        we do not have.
     */
    /**
     * `WHERE ... AND status = 'PENDING'` AND `coalesce` ON BOTH TIMESTAMPS,
     * because this statement is a LATE WRITER BY CONSTRUCTION.
     *
     * The row is inserted before the vendor call (above) precisely so an S13
     * callback arriving before the send's own response has somewhere to land.
     * In that ordering this UPDATE runs LAST, and as first written it was a
     * blind full-row overwrite: `CASE WHEN c THEN now() END` carries an
     * implicit `ELSE NULL`, so it wrote NULL over any timestamp a callback
     * had set, reverted `DELIVERED` to `ACCEPTED` and `FAILED_FINAL` to
     * `DELIVERY_UNKNOWN`, and nulled a `provider_message_id` the callback
     * supplied -- the throw path hardcodes null for it.
     *
     * So an attempt row would have contradicted what happened, and S12.2's
     * two callback statuses would have been unwritable by the very ordering
     * this file chose in order to support them. Latent only because the
     * callback route does not exist yet, which is not a reason to leave it.
     *
     * The guard makes this write once-only and the coalesces make it
     * additive: a row already moved past PENDING is left exactly as it is.
     */
    await sql`
      UPDATE core.otp_delivery_attempt
         SET status              = ${status}::core.otp_delivery_status,
             provider_message_id = coalesce(${result.providerMessageId},
                                            provider_message_id),
             failure_class       = coalesce(${result.failureClass},
                                            failure_class),
             accepted_at   = coalesce(accepted_at,
                               CASE WHEN ${status} = 'ACCEPTED' THEN now() END),
             finalized_at  = coalesce(finalized_at,
                               CASE WHEN ${status} = 'DEFINITIVE_NOT_SENT'
                                    THEN now() END)
       WHERE id = ${attemptId}
         AND status = 'PENDING'`.execute(this.db);
  }
}
