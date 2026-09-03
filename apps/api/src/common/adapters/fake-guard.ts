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
 * EVERY CALLER OF THIS FUNCTION — all eight, each in a constructor, each
 * still guarded (corrected twice at T18 Phase 1; the second correction is
 * why this list is now mechanical rather than narrative):
 *
 *   FakeSmsAdapter                 sms.adapter.ts
 *   FakeSmsProvider(x4 instances)  sms-provider.ts
 *   FakeMediaStorageAdapter        media-storage.adapter.ts
 *   FakeFinancialStorageAdapter    financial-storage.adapter.ts
 *   FakeInferenceAdapter           inference.adapter.ts
 *   FakePushAdapter                push.adapter.ts
 *   FakeSocialPlatformAdapter      social-platform.adapter.ts
 *   FakePostLinkAdapter            post-link.adapter.ts
 *
 * Media and evidence storage are DELIBERATELY separate tokens: grep the
 * importers of the financial one and you hold the complete list of code that
 * can touch payment-evidence bytes. Do not collapse them for the convenience
 * of one S3 implementation.
 *
 * WHAT THE RUNNING PROCESSES ACTUALLY CONSTRUCT is a different and smaller
 * question, and confusing the two is how the previous version of this comment
 * went wrong. T18 Phase 1 changed the BINDING SITES, not the guard and not
 * these classes: app.module.ts and jobs/runtime.ts now bind NULL adapters for
 * push, the social platform and post-link resolution, so the fakes above are
 * reached only by tests. A fake pretends to be a vendor and must refuse
 * production; a null adapter says there is no vendor, which is true in every
 * environment we have, so it runs. Each null answers honestly and lands on a
 * degradation the specification already describes.
 *
 * The old list also named KYC, and THERE IS NO KYC ADAPTER — no class, no
 * token, no file. It existed only as that line, while adapter-interfaces
 * .spec.ts asserted its absence as a finding (D-53).
 *
 * Nothing about THIS function changed. A constructed fake still cannot run in
 * production, which is the defect it exists to catch.
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
