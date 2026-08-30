import { appendFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertFakeIsPermitted } from '../../common/adapters/fake-guard';
import { createLogger } from '../../common/logging';
import { nodeEnv } from '../../common/env';
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
 * Where development OTPs are written. Overridable so a developer can point it
 * somewhere else; gitignored where it lands by default.
 */
export function devSmsLogPath(): string {
  return process.env['DEV_SMS_LOG'] ?? join(process.cwd(), '.dev-sms.log');
}

const log = createLogger();

/**
 * Records what would have been sent. Tests read the code out of the last
 * message's slots; local development reads it from the file named above.
 */
export class FakeSmsAdapter implements SmsAdapter {
  constructor() {
    assertFakeIsPermitted('FakeSmsAdapter');
    if (nodeEnv() === 'development') {
      // REMOVED, then created 0600 (#25 review, corrected by #26's). Two
      // reasons, both about a file holding live codes and phone numbers: it
      // must not grow across months of development, and on a shared machine
      // another user must not be able to read it.
      //
      // The unlink is what makes the mode real ON POSIX: writeFileSync with
      // a mode opens O_CREAT|O_TRUNC, which truncates the EXISTING inode and
      // leaves its permissions alone, so without the unlink the mode was
      // silently ignored and the file stayed as permissive as it was.
      //
      // ON WINDOWS THE MODE BUYS NOTHING and it is worth saying so rather
      // than implying protection that is not there: Node maps mode to the
      // read-only bit alone, ACLs are inherited from the directory, and a
      // measured run shows 0666 with the machine's other principals able to
      // read it. A developer on a shared Windows machine should treat this
      // file as world-readable -- or point DEV_SMS_LOG somewhere protected.
      rmSync(devSmsLogPath(), { force: true });
      writeFileSync(devSmsLogPath(), '', { encoding: 'utf8', mode: 0o600 });
      // The PATH is safe to log; what the file contains is not.
      log.warn({ msg: `[FAKE SMS] development codes are written to ${devSmsLogPath()}` });
    }
  }

  readonly sent: SmsMessage[] = [];

  send(message: SmsMessage): Promise<void> {
    this.sent.push(message);
    // ADU-CON-02 S13 promises "the local SMS adapter prints OTPs to the
    // TERMINAL". It cannot, and this is the deviation, recorded rather than
    // quietly kept: ADU-RUL-03 S1.1 makes the logger the only egress in
    // apps/api, and the logger CANNOT carry an OTP -- the code and the phone
    // are on NEVER_LOG precisely so they never reach a log line. Printing
    // them to stdout under any name is the defect that ruling closes.
    //
    // So the code goes to a FILE that only a development machine has:
    // gitignored, off stdout, and therefore outside every container log
    // aggregator. Production cannot reach it because production cannot
    // construct this adapter at all (assertFakeIsPermitted, above), and that
    // refusal is now provable because NODE_ENV is asserted at boot.
    if (nodeEnv() === 'development') {
      appendFileSync(
        devSmsLogPath(),
        `${new Date().toISOString()} to ${message.phone}: ${message.templateKey} ` +
          `${JSON.stringify(message.slots)}\n`,
        'utf8',
      );
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
