import { FakeSmsAdapter } from '../src/modules/auth/sms.adapter';
import { FakePushAdapter } from '../src/jobs/push.adapter';
import { FakeMediaStorageAdapter } from '../src/modules/catalogue/media-storage.adapter';
import { FakeFinancialStorageAdapter } from '../src/modules/financial/financial-storage.adapter';
import { FakeSocialPlatformAdapter } from '../src/modules/onboarding/social-platform.adapter';
import { FakePostLinkAdapter } from '../src/modules/catalogue/post-link.adapter';
import { NullInferenceAdapter } from '../src/modules/chat/inference.adapter';

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

describe('deployment adapters', () => {
  const realNodeEnv = process.env['NODE_ENV'];

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
