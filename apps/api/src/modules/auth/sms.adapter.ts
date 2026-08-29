import { assertFakeIsPermitted } from '../../common/adapters/fake-guard';
/**
 * SMS delivery adapter (ADU-AUTH-01 sections 4.4, 6).
 *
 * The SMS provider is a deployment integration behind an interface, like the
 * social platform and storage adapters. Locally and under test the fake
 * binds and records; production binds a real provider by environment when
 * one exists (section 6's provider strategy — two providers, delivery
 * confirmation instrumented — is deployment work recorded in the report).
 *
 * INVARIANT (4.4) — a sign-in code names no action; a step-up code names
 * the action. The TEMPLATE KEY travels here; the adapter renders from the
 * locale catalogue so the wire and the SMS agree on wording, and no
 * assembled prose exists in code.
 */

export interface SmsMessage {
  readonly phone: string;
  readonly templateKey: string;
  readonly slots: Readonly<Record<string, string>>;
}

export interface SmsAdapter {
  send(message: SmsMessage): Promise<void>;
}

export const SMS_ADAPTER = Symbol('SMS_ADAPTER');

/**
 * Records what would have been sent. Tests read the code out of the last
 * message's slots; local development reads it from the API log.
 */
export class FakeSmsAdapter implements SmsAdapter {
  constructor() {
    assertFakeIsPermitted('FakeSmsAdapter');
  }

  readonly sent: SmsMessage[] = [];

  send(message: SmsMessage): Promise<void> {
    this.sent.push(message);
    // ADU-CON-02 S13 promises "the local SMS adapter prints OTPs to the
    // terminal" -- until T7 it did not, and a developer signing the seeded
    // seller into the console had no way to read the code.
    //
    // THE GATE IS AN ALLOW-LIST, and deliberately so. This line prints a
    // phone number and a live OTP through console.warn, which bypasses the
    // logger's NEVER_LOG redaction entirely (otpCode, phone, phoneNumber are
    // all on that list). It was written as `!== 'test'`, i.e. printing
    // everywhere except jest -- and NOTHING in this repository sets
    // NODE_ENV=production (no render.yaml, and the deploy runbook never
    // mentions it, per D-80), so the one deployment that must never see this
    // was the one it printed in. Only an explicit development environment
    // qualifies now.
    if (process.env['NODE_ENV'] === 'development') {
      console.warn(`[FAKE SMS] to ${message.phone}: ${message.templateKey}`, message.slots);
    }
    return Promise.resolve();
  }

  /** The most recent message to a phone, or undefined. */
  lastTo(phone: string): SmsMessage | undefined {
    for (let i = this.sent.length - 1; i >= 0; i -= 1) {
      const m = this.sent[i];
      if (m && m.phone === phone) return m;
    }
    return undefined;
  }
}
