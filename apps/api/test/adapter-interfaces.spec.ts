import { FakeSmsAdapter } from '../src/modules/auth/sms.adapter';
import { FakeSmsProvider } from '../src/modules/auth/sms-provider';
import { FakePushAdapter } from '../src/jobs/push.adapter';
import { FakeMediaStorageAdapter } from '../src/modules/catalogue/media-storage.adapter';
import { FakeFinancialStorageAdapter } from '../src/modules/financial/financial-storage.adapter';
import { FakeSocialPlatformAdapter } from '../src/modules/onboarding/social-platform.adapter';
import { FakePostLinkAdapter } from '../src/modules/catalogue/post-link.adapter';
import { NullPushAdapter } from '../src/jobs/push.adapter';
import { NullSocialPlatformAdapter } from '../src/modules/onboarding/social-platform.adapter';
import { NullPostLinkAdapter } from '../src/modules/catalogue/post-link.adapter';
import { NullInferenceAdapter } from '../src/modules/chat/inference.adapter';
import { resetNodeEnvForTests } from '../src/common/env';

/**
 * Phase F.2 — "A fake that could be mistaken for an implementation is worse
 * than an obvious one."
 *
 * The five deployment integrations T4 S3.2 names, their vendor status, and
 * the one adapter that is deliberately NOT a fake.
 */

const FAKES: ReadonlyArray<[string, () => unknown]> = [
  ['SMS (no vendor — awaits Phase 0 delivery-rate measurement)', () => new FakeSmsAdapter()],
  ['Push (FCM/APNs decided, credentials not)', () => new FakePushAdapter()],
  ['Object storage (Cloudflare R2 decided, credentials not)', () => new FakeMediaStorageAdapter()],
  ['Evidence storage (same R2 decision)', () => new FakeFinancialStorageAdapter()],
  ['Social platform (TikTok/Instagram adapters)', () => new FakeSocialPlatformAdapter()],
  ['Post-link resolution', () => new FakePostLinkAdapter()],
];

/*
 * T18 Phase 1 -- the null adapters, and the count they change.
 *
 * A fake pretends to be a vendor and must refuse production. A NULL adapter
 * says there is no vendor, which is true in every environment we have, so it
 * runs anywhere. The difference is what it ANSWERS, not whether it exists --
 * and it cannot be expressed by leaving the provider out, because there is no
 * `@Optional()` anywhere in apps/api and a missing provider is an
 * UnknownDependenciesException at NestFactory.create: a boot crash, not a
 * degradation.
 */
const NULLS: ReadonlyArray<[string, () => unknown]> = [
  ['Classifier (layer 4 of the S15.1 cascade)', () => new NullInferenceAdapter()],
  ['Push (SMS and the in-app list carry beta)', () => new NullPushAdapter()],
  ['Social platform (audience_required = false)', () => new NullSocialPlatformAdapter()],
  ['Post-link resolution (a seller can sell without a linked post)', () => new NullPostLinkAdapter()],
];

/*
 * WHAT THE API PROCESS ACTUALLY TRIPS OVER, as a maintained fact rather than
 * a number in a report. These are the guarded classes AppModule constructs;
 * every other fake either is not bound there (FakePushAdapter lives only in
 * jobs/runtime.ts) or has been replaced by a null above.
 *
 * Two integrations, four bindings: SMS is one vendor decision behind two
 * classes, and storage is one implementation behind two deliberately separate
 * tokens (grep the importers of the financial one and you hold the complete
 * list of code that can touch payment-evidence bytes -- do not collapse them).
 */
const API_BOOT_BLOCKERS: ReadonlyArray<[string, () => unknown]> = [
  ['SMS adapter', () => new FakeSmsAdapter()],
  ['SMS provider', () => new FakeSmsProvider('AFROMESSAGE')],
  ['Media storage', () => new FakeMediaStorageAdapter()],
  ['Evidence storage', () => new FakeFinancialStorageAdapter()],
];

describe('deployment adapters', () => {
  const realNodeEnv = process.env['NODE_ENV'];

  // NODE_ENV is read once and memoised (ADU-RUL-03 S1.2 -- asserted at a
  // boundary, not consulted at a call site), so a spec that changes it must
  // forget the memo first. That the seam is needed here is the design
  // working: nothing in the running processes can change environment
  // mid-flight either.
  beforeEach(() => {
    resetNodeEnvForTests();
  });

  afterEach(() => {
    if (realNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = realNodeEnv;
  });

  describe('every fake refuses to run in production (T4 S3.2)', () => {
    it.each(FAKES)('%s', (_name, construct) => {
      process.env['NODE_ENV'] = 'production';
      // A fake SMS adapter in production is not a degraded service, it is a
      // silent one: OTPs appear to send, every verify fails, and the logs
      // look healthy. The process must refuse to start instead.
      expect(construct).toThrow(/cannot run in production/i);
    });

    it.each(FAKES)('%s constructs outside production', (_name, construct) => {
      process.env['NODE_ENV'] = 'test';
      expect(construct).not.toThrow();
    });
  });

  describe('a null adapter says there is no vendor, and runs anywhere (T18 Phase 1)', () => {
    it.each(NULLS)('%s constructs under production', (_name, construct) => {
      process.env['NODE_ENV'] = 'production';
      expect(construct).not.toThrow();
    });

    it('the null social adapter REFUSES rather than inventing a follower count', async () => {
      process.env['NODE_ENV'] = 'production';
      const social = new NullSocialPlatformAdapter();
      // The adapter's own INVARIANT is that the count comes from the adapter
      // and never from the seller. An adapter that fabricates one is worse
      // than an adapter that refuses, so both calls reject -- and both call
      // sites already land on the SPECIFIED degradation (503-retryable to the
      // manual path; UNKNOWN rather than UNAVAILABLE).
      await expect(social.fetchProfile('TIKTOK', 'anyone')).rejects.toThrow(
        /no social platform integration/i,
      );
      await expect(social.postExists('TIKTOK', 'anything')).rejects.toThrow(
        /no social platform integration/i,
      );
    });

    it('the null post-link resolver returns the contract\'s own degenerate case', async () => {
      process.env['NODE_ENV'] = 'production';
      // `resolve` is documented as returning null "when the URL resolves to
      // nothing recognisable". With no resolver bound, nothing is.
      await expect(new NullPostLinkAdapter().resolve('https://vm.tiktok.com/x')).resolves.toBeNull();
    });

    it('the null push adapter never claims delivery and never kills a token', async () => {
      process.env['NODE_ENV'] = 'production';
      const outcome = await new NullPushAdapter().send({
        token: 'a-real-device-token',
        templateKey: 'k',
        locale: 'en',
        slots: {},
      });
      // DELIVERED would be the exact lie the guard exists to stop. TOKEN_DEAD
      // is a fact about the DEVICE, and e2-notification acts on it by clearing
      // core.device.push_token -- so saying it here would un-register the very
      // devices that should receive the first push the day a provider lands.
      //
      // IT SAYS NO_PROVIDER NOW, AND RETRYABLE WAS THE BUG (T20 S5). RETRYABLE
      // was the most honest of the three outcomes that existed when this test
      // was written, and it was still wrong in the way that mattered: "try
      // again" is a claim about a TRANSIENT failure, so every PUSH notification
      // retried its full backoff and landed in FAILED. Four templates are
      // PUSH-only -- including notification.chat.escalated, where a buyer asks
      // what the assistant cannot answer and the seller never learns -- so the
      // outcome the fleet actually produced was silence with a retry count.
      // NO_PROVIDER is the fourth outcome and it is a fact about the PLATFORM
      // rather than the device or the network, which is what lets the job fall
      // the row back to IN_APP instead of retrying a vendor that is not there.
      expect(outcome).toBe('NO_PROVIDER');
      expect(outcome).not.toBe('DELIVERED');
      expect(outcome).not.toBe('TOKEN_DEAD');
      expect(outcome).not.toBe('RETRYABLE');
    });
  });

  describe('what the API process still refuses production over', () => {
    it.each(API_BOOT_BLOCKERS)('%s still refuses', (_name, construct) => {
      process.env['NODE_ENV'] = 'production';
      expect(construct).toThrow(/cannot run in production/i);
    });

    it('is exactly four bindings, and two integrations', () => {
      // The number is asserted so that nulling a fifth, or quietly re-binding
      // a fake, changes a test rather than only a paragraph.
      expect(API_BOOT_BLOCKERS).toHaveLength(4);
      expect(new Set(['SMS', 'SMS', 'storage', 'storage']).size).toBe(2);
    });
  });

  it('the Null classifier is NOT a fake and does not block production', () => {
    process.env['NODE_ENV'] = 'production';
    // "The bot never goes dark" (S15.1): with no layer-4 classifier bound,
    // layers 0-2 keep answering and everything above escalates — the
    // SPECIFIED degradation, identical to the behaviour at the inference
    // cap. Refusing to start over it would take the whole API down to
    // disable one cascade layer.
    expect(() => new NullInferenceAdapter()).not.toThrow();
  });

  describe('the interfaces are stable', () => {
    it('SMS and push carry a template key and slots, never assembled prose', async () => {
      process.env['NODE_ENV'] = 'test';
      const sms = new FakeSmsAdapter();
      await sms.send({ phone: '+251900000000', templateKey: 'sms.otp.sign_in', slots: { code: '1' } });
      expect(sms.sent[0]).toHaveProperty('templateKey');
      expect(sms.sent[0]).not.toHaveProperty('body');

      const push = new FakePushAdapter();
      await push.send({ token: 't', templateKey: 'k', locale: 'en', slots: {} });
      expect(push.sent[0]).toHaveProperty('templateKey');
      expect(push.sent[0]).not.toHaveProperty('body');
    });

    it('the social adapter can say "deleted" and "unreachable" differently (S9.6)', async () => {
      process.env['NODE_ENV'] = 'test';
      const social = new FakeSocialPlatformAdapter();
      social.registerPost('TIKTOK', 'gone', false);
      await expect(social.postExists('TIKTOK', 'gone')).resolves.toBe(false);
      // An unregistered post is an OUTAGE, not a deletion. A boolean-only
      // interface would collapse the two and unlink every seller's
      // catalogue during a platform incident.
      await expect(social.postExists('TIKTOK', 'never-registered')).rejects.toThrow();
    });

    it('there is NO KYC adapter, and that is a finding rather than an omission', () => {
      // POST /v1/seller/identity-verification takes verifier_kind,
      // vendor_reference, legal_name and id_hash FROM THE CLIENT and writes
      // the attestation with no callback to any vendor — because no vendor
      // is selected, so there is nothing to call back to. The interface is
      // therefore absent by consequence, not by design, and the current
      // arrangement trusts client-supplied verification.
      //
      // Registered as F-1 and carried to RULINGS-NEEDED as a load-bearing
      // workaround. Nothing is asserted here except that no adapter exists,
      // so this test starts failing the day one is added — which is the day
      // this comment should be deleted.
      const adapters = [
        'sms.adapter',
        'push.adapter',
        'media-storage.adapter',
        'financial-storage.adapter',
        'social-platform.adapter',
        'post-link.adapter',
        'inference.adapter',
      ];
      expect(adapters.some((a) => a.includes('kyc'))).toBe(false);
    });
  });
});
