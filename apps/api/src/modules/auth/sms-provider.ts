import { assertFakeIsPermitted } from '../../common/adapters/fake-guard';
import type { SmsAdapter, SmsMessage } from './sms.adapter';

/**
 * The vendor boundary for SMS transport (ADU-AUTH-01 v2.6 S6).
 *
 * "Business/authentication services do not call vendor-specific SDKs
 * directly." Everything above this file knows four provider NAMES and three
 * outcome CLASSES; nothing above it knows what an AfroMessage response body
 * looks like.
 *
 * THE CLASSIFICATION IS THE WHOLE POINT OF THIS FILE (S5.6). A transport
 * result is one of three things, and only the middle one may fail over:
 *
 *     ACCEPTED             the provider took it
 *     DEFINITIVE_NOT_SENT  the provider refused BEFORE dispatch -- fail over
 *     DELIVERY_UNKNOWN     we do not know -- DO NOT fail over
 *
 * The asymmetry is not caution for its own sake. A send that succeeded with
 * a lost acknowledgement, followed by a fallback send, delivers TWO messages
 * carrying the same code. That is harmless to security -- one challenge, one
 * code -- and it will look like a bug to whoever sees it first, which is the
 * user. `DELIVERY_UNKNOWN` is not `DEFINITIVE_NOT_SENT`, and the difference
 * between "it refused" and "we did not hear back" is the difference between
 * a safe retry and a duplicate.
 *
 * INVARIANT (S5.6) -- every adapter documents which of ITS OWN responses map
 * to each class. A provider that classifies by guesswork turns the rule above
 * into a coin flip, so the mapping is stated per adapter, in the adapter, and
 * the fakes below state theirs even though they invent their own responses.
 *
 * NO VENDOR IS INTEGRATED. Every provider here is a fake behind the
 * interface, and each one refuses to construct under NODE_ENV=production
 * (fake-guard) -- an SMS fake in production is not a degraded service, it is
 * a silent one. AfroMessage, SMSEthiopia, Infobip and Twilio all require a
 * registered business, which is blocked; the interface is what is buildable
 * now, and it is built so the vendor is a binding rather than a rewrite.
 */

/** S6.1's provider set, and `core.sms_provider`'s values. */
export type SmsProviderName = 'AFROMESSAGE' | 'SMSETHIOPIA' | 'INFOBIP' | 'TWILIO';

/** S5.6's three classes, "at least" -- these are all we classify into. */
export type SendOutcome = 'ACCEPTED' | 'DEFINITIVE_NOT_SENT' | 'DELIVERY_UNKNOWN';

export interface SendResult {
  readonly outcome: SendOutcome;
  /**
   * The vendor's own handle for the message, when it gave one. Recorded on
   * the attempt row so a delivery callback (S13) can find its attempt.
   * `null` whenever the provider never got as far as issuing one.
   */
  readonly providerMessageId: string | null;
  /**
   * The provider's own error label, verbatim, unmapped.
   *
   * TEXT rather than an enum, and that is a decision rather than an omission
   * (D-181): v2.6 names `failure_class` and never enumerates it, and
   * inventing a taxonomy before a real provider's error set exists is
   * designing rather than transcribing -- check 16 would then freeze the
   * invention.
   */
  readonly failureClass: string | null;
}

export interface SmsProvider {
  readonly name: SmsProviderName;
  /**
   * S6's signature. `deliveryAttemptId` is passed DOWN rather than returned
   * up because a real provider's callback URL must carry it -- the attempt
   * row exists before the vendor call, so a callback that arrives before the
   * response does still has a row to land on.
   */
  send(
    phoneE164: string,
    body: SmsMessage,
    deliveryAttemptId: string,
  ): Promise<SendResult>;
}

export const SMS_PROVIDERS = Symbol('SMS_PROVIDERS');

/** What a fake was asked to transport, in order. */
export interface RecordedSend {
  readonly phoneE164: string;
  readonly body: SmsMessage;
  readonly deliveryAttemptId: string;
}

/**
 * A fake vendor.
 *
 * THE FAKES ARE DELIBERATELY DISTINGUISHABLE, and that is a test-design
 * requirement rather than a convenience. T12's Phase 1 pass found a suite
 * that was vacuous because a fixture's two sources agreed with each other;
 * the same trap in this shape is a failover test whose primary and fallback
 * behave identically -- it passes whichever provider sent, so it tests
 * nothing about routing.
 *
 * So every fake stamps its OWN NAME into the `providerMessageId` it returns.
 * A test asserts WHICH provider transported the message, not merely that a
 * message was transported, and a router that called the wrong one fails
 * loudly instead of passing quietly.
 */
export class FakeSmsProvider implements SmsProvider {
  readonly sent: RecordedSend[] = [];

  /**
   * What the next send returns. A test sets this to drive an arm; the
   * default is the happy one, so a test that forgets to set it gets
   * `ACCEPTED` rather than an accidental failover.
   */
  private queued: SendResult[] = [];

  /**
   * `sink` IS THE FAKE VENDOR'S NETWORK, and it is not a convenience.
   *
   * A real provider hands the message to a carrier and the carrier hands it
   * to a phone. A fake has to hand it somewhere, and the somewhere that
   * already exists is `FakeSmsAdapter` -- which in DEVELOPMENT writes the
   * code to a gitignored 0600 file, because that is **how a developer reads
   * their own OTP**. Routing OTP through providers without this would have
   * silently ended local sign-in: every code generated, none readable, and
   * nothing in the logs to say so (the code and the phone are on NEVER_LOG
   * precisely so they never reach a log line).
   *
   * It is also the one place that answers "what would this phone have
   * received", independently of WHICH vendor carried it -- so a test asking
   * about the message reads the adapter, and a test asking about the route
   * reads `sent` here. Two questions, two places, neither standing in for
   * the other.
   */
  constructor(
    readonly name: SmsProviderName,
    private readonly sink?: SmsAdapter | undefined,
  ) {
    assertFakeIsPermitted(`FakeSmsProvider(${name})`);
  }

  /** Queue outcomes for the next sends, in order. */
  willReturn(...results: readonly SendResult[]): this {
    this.queued.push(...results);
    return this;
  }

  /**
   * The three classes as a fake vendor's own response mapping, stated here
   * because S5.6 requires every adapter to state one:
   *
   *   queued DEFINITIVE_NOT_SENT -> the vendor rejected before dispatch
   *   queued DELIVERY_UNKNOWN    -> the request went out, the reply did not
   *   nothing queued             -> ACCEPTED, with a vendor message id
   */
  async send(
    phoneE164: string,
    body: SmsMessage,
    deliveryAttemptId: string,
  ): Promise<SendResult> {
    this.sent.push({ phoneE164, body, deliveryAttemptId });
    const queued = this.queued.shift();
    /*
     * A provider that REFUSED transported nothing, so nothing reaches the
     * sink -- which is what makes "the phone received it" and "a vendor
     * accepted it" distinguishable rather than the same assertion twice.
     *
     * But a queued ACCEPTED DID transport, and `if (queued) return` skipped
     * the sink for that too -- so a test queueing ACCEPTED and then reading
     * the adapter would see nothing, for a reason unrelated to what it was
     * testing.
     */
    if (queued && queued.outcome !== 'ACCEPTED') return queued;
    if (this.sink) await this.sink.send(body);
    if (queued) return queued;
    return Promise.resolve({
      outcome: 'ACCEPTED',
      // THE STAMP. Lowercased provider name, then the attempt id: a test
      // reading this off the attempt row can say which vendor transported
      // it without the router telling it.
      providerMessageId: `${this.name.toLowerCase()}-${deliveryAttemptId}`,
      failureClass: null,
    });
  }

  reset(): void {
    this.sent.length = 0;
    this.queued.length = 0;
  }
}

/** Shorthands for the two failure classes, so tests read as the document does. */
export const definitiveNotSent = (failureClass: string): SendResult => ({
  outcome: 'DEFINITIVE_NOT_SENT',
  providerMessageId: null,
  failureClass,
});

export const deliveryUnknown = (failureClass: string): SendResult => ({
  outcome: 'DELIVERY_UNKNOWN',
  // A timeout AFTER transmission may well have a message id the caller never
  // saw. Null here says we do not have one, never that none exists.
  providerMessageId: null,
  failureClass,
});

/**
 * The four fakes S6 names as initial implementations, one instance each.
 *
 * `AfricasTalking` and `Unifonic` are S6's "future only when justified" and
 * are deliberately absent: an unused adapter is an adapter nobody has tested
 * against a vendor that nobody has chosen.
 */
export class FakeSmsProviderSet {
  readonly AFROMESSAGE: FakeSmsProvider;
  readonly SMSETHIOPIA: FakeSmsProvider;
  readonly INFOBIP: FakeSmsProvider;
  readonly TWILIO: FakeSmsProvider;

  constructor(sink?: SmsAdapter) {
    this.AFROMESSAGE = new FakeSmsProvider('AFROMESSAGE', sink);
    this.SMSETHIOPIA = new FakeSmsProvider('SMSETHIOPIA', sink);
    this.INFOBIP = new FakeSmsProvider('INFOBIP', sink);
    this.TWILIO = new FakeSmsProvider('TWILIO', sink);
  }

  byName(name: SmsProviderName): FakeSmsProvider {
    return this[name];
  }

  all(): readonly FakeSmsProvider[] {
    return [this.AFROMESSAGE, this.SMSETHIOPIA, this.INFOBIP, this.TWILIO];
  }

  resetAll(): void {
    for (const p of this.all()) p.reset();
  }
}
