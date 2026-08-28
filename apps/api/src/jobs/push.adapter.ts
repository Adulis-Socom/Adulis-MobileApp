import { assertFakeIsPermitted } from '../common/adapters/fake-guard';

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

export type PushOutcome = 'DELIVERED' | 'RETRYABLE' | 'TOKEN_DEAD';

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
