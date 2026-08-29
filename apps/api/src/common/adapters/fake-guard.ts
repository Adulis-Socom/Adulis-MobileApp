/**
 * WORK ORDER T4 S3.2 — "A fake that could be mistaken for an implementation
 * is worse than an obvious one."
 *
 * Every deployment-integration fake calls this in its constructor. Two
 * effects, and the second is the one that matters:
 *
 *  1. It says loudly, once, at construction, that a fake is bound — so a
 *     staging log that should show a vendor shows this instead.
 *  2. It THROWS under NODE_ENV=production. A fake SMS adapter in production
 *     is not a degraded service, it is a silent one: OTPs would appear to
 *     send, every verify would fail, and the logs would look healthy. The
 *     process must refuse to start instead.
 *
 * The five integrations this guards, and their vendor status (T4 S3.2):
 *   SMS         — no vendor; primary awaits Phase 0 delivery-rate measurement
 *   Push        — FCM/APNs decided, credentials not
 *   KYC         — no vendor selected
 *   Object store— Cloudflare R2 decided, credentials not
 *   Classifier  — no provider; layer 4 of the S15.1 cascade
 */

import { createLogger } from '../logging';
import { nodeEnv } from '../env';

const log = createLogger();

export function assertFakeIsPermitted(adapterName: string): void {
  if (nodeEnv() === 'production') {
    throw new Error(
      `${adapterName}: a FAKE adapter cannot run in production. ` +
        'Bind the real integration or do not start this process. ' +
        '(WORK ORDER T4 S3.2 — a fake in production fails silently, which is worse ' +
        'than not starting.)',
    );
  }
  // Through the logger, not console: ADU-RUL-03 S1.1 makes the logger the
  // only egress, and pino needs no configuration to emit this. The message
  // carries an adapter NAME and no user data, so the allow-list's `msg` is
  // the whole line.
  log.warn({ msg: `[FAKE ADAPTER] ${adapterName} is bound. Nothing leaves this process.` });
}
