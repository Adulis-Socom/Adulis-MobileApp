import { assertFakeIsPermitted } from '../common/adapters/fake-guard';
import { createLogger } from '../common/logging';

const log = createLogger();

/**
 * Native push delivery (ADU-DB-01 S6.4; S24's `notification.push_seller`).
 *
 * FCM and APNs are the decided providers (ADU-PRD-01's push row, ADU-API-01
 * S15's open item) and their credentials are not; this interface is what the
 * real one implements, and nothing in the job set knows a provider name.
 *
 * The interface carries a TEMPLATE KEY and SLOTS, never assembled prose —
 * the same rule as SMS and as the wire (S17.3): word order differs between
 * English and Amharic, and a notification assembled from fragments can only
 * be assembled in English word order.
 *
 * `send` reports per-token outcomes rather than throwing, because one dead
 * token must not fail a batch — and a permanently-dead token is the signal
 * that a device row should stop being pushed to.
 */

export interface PushMessage {
  readonly token: string;
  readonly templateKey: string;
  readonly locale: string;
  readonly slots: Readonly<Record<string, unknown>>;
}

/**
 * T20 S5 -- NO_PROVIDER is the fourth, and D-240 is why it exists. That entry
 * recorded that none of the three could say 'there is no vendor': DELIVERED is
 * the lie the fake guard exists to stop, TOKEN_DEAD is a fact about the DEVICE
 * that makes e2-notification clear a real push token, and RETRYABLE is true but
 * indistinguishable from a transient failure -- so the job could only mark the
 * row FAILED and four templates reached nobody.
 *
 * With it, the absence of a vendor becomes something the caller can ACT on:
 * the sender falls the row back to IN_APP, which is S9.3's own fallback and
 * needs no vendor and no credentials.
 */
export type PushOutcome = 'DELIVERED' | 'RETRYABLE' | 'TOKEN_DEAD' | 'NO_PROVIDER';

export interface PushAdapter {
  send(message: PushMessage): Promise<PushOutcome>;
}

export const PUSH_ADAPTER = Symbol('PUSH_ADAPTER');

export class FakePushAdapter implements PushAdapter {
  readonly sent: PushMessage[] = [];
  /** Tests set an outcome per token to drive the dead-token path. */
  readonly outcomes = new Map<string, PushOutcome>();

  constructor() {
    assertFakeIsPermitted('FakePushAdapter');
  }

  send(message: PushMessage): Promise<PushOutcome> {
    this.sent.push(message);
    return Promise.resolve(this.outcomes.get(message.token) ?? 'DELIVERED');
  }

  lastTo(token: string): PushMessage | undefined {
    for (let i = this.sent.length - 1; i >= 0; i -= 1) {
      const m = this.sent[i];
      if (m && m.token === token) return m;
    }
    return undefined;
  }
}

/**
 * NO PUSH PROVIDER IS CONFIGURED (T18 Phase 1).
 *
 * NOT a fake, and so NOT guarded against production. FCM and APNs are the
 * decided providers and their credentials are not.
 *
 * READ THIS BEFORE BELIEVING PUSH IS COVERED. The first draft of this comment
 * said "SMS and the in-app list carry every notification". THAT IS FALSE, and
 * the adversarial pass caught it:
 *
 *   - NOTHING produces channel = 'IN_APP'. The only two mentions in the tree
 *     are the enum (0001_foundation.sql:240) and the CLAIM side of this job
 *     set (e2-notification.ts:122). There is no INSERT. The fallback S9.3
 *     describes exists on the read side and has no writer.
 *   - The four PUSH producers have NO SMS TWIN. ORDER_AWAITING_PAYMENT_MORNING
 *     (e2-notification), STOCK_CONFIDENCE_NUDGE (e3), TRIAL_ENDING (e6) and
 *     notification.chat.escalated (chat.service) are PUSH-only; the SMS set
 *     (NEW_DEVICE_SIGNIN, PAYOUT_CHANGE_*, OWNERSHIP_TRANSFER_*) is disjoint.
 *
 * So with no push provider those four are NOT DELIVERED. That is a real
 * defect and it is registered rather than papered over -- but it is not one
 * this adapter introduces, and binding a null here is strictly the more
 * honest of the two available lies:
 *
 *   FakePushAdapter returned DELIVERED, so the row was marked SENT while
 *   nothing left the process -- "the logs would look healthy", which is the
 *   exact sentence the fake guard was written around.
 *   NullPushAdapter reports it undelivered, and the row is marked FAILED.
 *
 * The one thing that still reaches the recipient is accidental and worth
 * naming as such: notifications.controller.ts does not filter on `state`, so
 * a FAILED row is still listed if the person opens their notifications. That
 * is a property of one query, not a delivery channel.
 *
 * WHICH OUTCOME IS HONEST, and why it is not the obvious one. The enum is
 * DELIVERED | RETRYABLE | TOKEN_DEAD, and NONE of the three means "there is
 * no provider":
 *
 *   DELIVERED   is a lie, and the precise lie the fake guard exists to stop:
 *               the row would be marked sent and nobody would be told.
 *   TOKEN_DEAD  is a fact about the DEVICE, and e2-notification acts on it by
 *               clearing core.device.push_token. Saying it here would delete
 *               real tokens because WE have no vendor -- so the day a
 *               provider is bound, the devices that should receive the first
 *               push are exactly the ones we un-registered.
 *   RETRYABLE   is the only one that is true. Nothing was delivered, and
 *               nothing about the device is wrong.
 *
 * It does not loop: e2-notification's markFailed writes state = 'FAILED',
 * which is terminal, and S9.3's IN_APP fallback is the upstream design for a
 * seller who gets no push. That fallback's own comment is the precedent this
 * adapter follows -- "there is no provider to call, the row IS the delivery".
 */
export class NullPushAdapter implements PushAdapter {
  constructor() {
    log.warn({
      msg: '[NO PUSH PROVIDER] no FCM/APNs client is bound; push never delivers and notifications fall back to SMS and the in-app list.',
    });
  }

  async send(message: PushMessage): Promise<PushOutcome> {
    void message;
    // NO_PROVIDER, not RETRYABLE (T20 S5). RETRYABLE was the truest of the
    // three that existed, and it still left the sender unable to tell "try
    // again later" from "there is no vendor and never will be until one is
    // bound" -- so every push row died FAILED. This says the second, and the
    // sender falls back to the in-app list rather than dropping it.
    return 'NO_PROVIDER';
  }
}
