import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { APP_DATABASE } from '../src/common/db/database.module';
import {
  RateLimitService,
  subjectHash,
} from '../src/common/rate-limit/rate-limit.service';
import { resolveKey } from '../src/common/crypto/aead';
import { OtpDeliveryService } from '../src/modules/auth/otp-delivery.service';
import { OtpIssuancePolicy } from '../src/modules/auth/otp-issuance.policy';
import {
  FakeSmsProviderSet,
  SMS_PROVIDERS,
  definitiveNotSent,
  deliveryUnknown,
  type SmsProviderName,
} from '../src/modules/auth/sms-provider';

/**
 * T13 Phase 3 -- the delivery layer (ADU-AUTH-01 v2.6 S5.5, S5.6, S7.1, S7.4,
 * S9.2, S12, S15, S16).
 *
 * THE FAKES ARE DISTINGUISHABLE AND EVERY ASSERTION USES THAT. The work order
 * names the trap by way of T12's own pass: a suite went vacuous because a
 * fixture's two sources agreed with each other, and the same trap in this
 * shape is a failover test whose primary and fallback behave identically --
 * it passes whichever provider sent, so it proves nothing about routing.
 *
 * So the tests below assert WHICH PROVIDER TRANSPORTED THE MESSAGE, off the
 * `provider` column and off the vendor-stamped `provider_message_id`, and
 * they assert the negative arm too: on `DELIVERY_UNKNOWN` the fallback must
 * have been asked NOTHING. A test that only counted attempts would pass with
 * the classification rule inverted, which is the one rule this phase exists
 * to get right.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

/** This suite's own market, NOT live (D-179: a live fixture market steals
 *  other suites' devices through bootstrap). Devices are placed by hand. */
const MK = '77e13000-0000-4000-8000-0000000000d1';
/** A second market, ACTIVE-adjacent but SUSPENDED, for the S9.2 arm. */
const MS = '77e13000-0000-4000-8000-0000000000d2';
const PHONE_PREFIX = '+2519113330';

@Module({ imports: [AppModule] })
class T13P3AppModule {}

interface AttemptRow {
  attempt_no: number;
  provider: string;
  status: string;
  provider_message_id: string | null;
  failure_class: string | null;
  accepted_at: Date | null;
  finalized_at: Date | null;
  otp_challenge_id: string;
}

describe('T13 Phase 3 - OTP delivery, failover and the market gates', () => {
  let app: INestApplication;
  let admin: Pool;
  let delivery: OtpDeliveryService;
  let policy: OtpIssuancePolicy;
  let db: { transaction: () => { execute: <T>(f: (trx: never) => Promise<T>) => Promise<T> } };
  const providers = new FakeSmsProviderSet();
  const devices: string[] = [];
  /** Every anonymous phone-taking path requires a bootstrapped device, and
   *  its market is what the S9.2 gate reads (never the phone's account). */
  const DEVICE = '77e13000-0000-4000-8000-0000000000e1';

  const timingFor = (marketId: string): [string, string[]] => [
    `INSERT INTO core.timing_config (id, market_id, reservation_window,
       payment_confirmation_window, fulfilment_window, offline_sync_horizon,
       payout_activation_delay, recovery_cooling_period,
       deleted_number_cooling_period, refund_ack_window, media_retention,
       level_credit_grace, mobile_session_lifetime, console_session_lifetime,
       console_idle_timeout, console_remembered_lifetime,
       console_remembered_idle, otp_ttl, otp_max_attempts, step_up_freshness,
       new_device_payout_lock, same_seller_cancellation_threshold,
       same_seller_cooldown, cross_seller_cooldown_ladder,
       cancellation_counter_decay)
     VALUES (gen_random_uuid(), $1, '48 hours','24 hours','72 hours','7 days',
       '24 hours','7 days','30 days','48 hours','90 days','24 hours',
       '30 days','12 hours','30 minutes','7 days','8 hours','5 minutes',5,
       '5 minutes','24 hours',3,'1 hour',
       ARRAY['1 day','2 days','4 days']::interval[],'30 days')`,
    [marketId],
  ];

  /** A committed challenge to transport. Delivery never issues one. */
  async function seedChallenge(phone: string): Promise<string> {
    const id = randomUUID();
    await admin.query(
      `INSERT INTO core.otp_challenge
         (id, purpose, phone_e164, code_hash, expires_at)
       VALUES ($1,'SIGN_IN',$2,'\\x00'::bytea, now() + interval '5 minutes')`,
      [id, phone],
    );
    return id;
  }

  const attemptsFor = async (challengeId: string): Promise<AttemptRow[]> =>
    (
      await admin.query<AttemptRow>(
        `SELECT attempt_no, provider::text AS provider, status::text AS status,
                provider_message_id, failure_class, accepted_at, finalized_at,
                otp_challenge_id
           FROM core.otp_delivery_attempt
          WHERE otp_challenge_id = $1 ORDER BY attempt_no`,
        [challengeId],
      )
    ).rows;

  const setRoute = async (
    marketId: string,
    primary: SmsProviderName,
    fallback: SmsProviderName | null,
  ): Promise<void> => {
    await admin.query(
      `UPDATE core.market SET sms_primary_provider = $2::core.sms_provider,
              sms_fallback_provider = $3::core.sms_provider WHERE id = $1`,
      [marketId, primary, fallback],
    );
  };

  const message = (code: string) => ({
    phone: `${PHONE_PREFIX}01`,
    templateKey: 'sms.otp.sign_in',
    slots: { code },
  });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [T13P3AppModule] })
      .overrideProvider(SMS_PROVIDERS)
      .useValue(providers)
      .compile();
    app = mod.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
    admin = new Pool({ connectionString: ADMIN });
    delivery = app.get(OtpDeliveryService);
    policy = app.get(OtpIssuancePolicy);
    db = app.get(APP_DATABASE);

    await cleanup();
    for (const [id, code, state, otp] of [
      [MK, 'T13K', 'ACTIVE', true],
      [MS, 'T13S', 'SUSPENDED', false],
    ] as const) {
      await admin.query(
        `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                  display_timezone, default_locale, is_live,
                                  activation_state, otp_enabled,
                                  sms_primary_provider, sms_fallback_provider,
                                  otp_daily_soft_limit, otp_daily_hard_limit)
         VALUES ($1,$2,'Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en',false,
                 $3::core.market_activation_state,$4,'AFROMESSAGE','SMSETHIOPIA',
                 100000, 200000)`,
        [id, code, state, otp],
      );
      const [q, p] = timingFor(id);
      await admin.query(q, p);
    }
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$2)`,
      [DEVICE, MK],
    );
    devices.push(DEVICE);
  });

  async function cleanup(): Promise<void> {
    // Attempts cascade from the challenge; the challenge is scoped by PHONE.
    await admin.query(`DELETE FROM core.otp_challenge WHERE phone_e164 LIKE $1`, [
      `${PHONE_PREFIX}%`,
    ]);
    const mine = await admin.query<{ id: string }>(
      `SELECT id FROM core.account WHERE phone_e164 LIKE $1`,
      [`${PHONE_PREFIX}%`],
    );
    const ids = mine.rows.map((r) => r.id);
    if (ids.length) {
      await admin.query(`DELETE FROM core.session WHERE account_id = ANY($1::uuid[])`, [ids]);
      await admin.query(
        `UPDATE core.device SET account_id = NULL WHERE account_id = ANY($1::uuid[])`,
        [ids],
      );
      await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [ids]);
      await admin.query(`DELETE FROM core.account WHERE id = ANY($1::uuid[])`, [ids]);
    }
    for (const m of [MK, MS]) {
      await admin.query(
        `DELETE FROM core.device WHERE market_id = $1 AND account_id IS NULL`,
        [m],
      );
      await admin.query(`DELETE FROM core.timing_config WHERE market_id = $1`, [m]);
      await admin.query(
        `DELETE FROM core.market m WHERE m.id = $1
          AND NOT EXISTS (SELECT 1 FROM core.account a WHERE a.market_id = m.id)
          AND NOT EXISTS (SELECT 1 FROM core.device d WHERE d.market_id = m.id)`,
        [m],
      );
    }
  }

  afterAll(async () => {
    if (devices.length) {
      await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [devices]);
      await admin.query(`DELETE FROM core.device WHERE id = ANY($1::uuid[])`, [devices]);
    }
    await cleanup();
    await admin.end();
    await app.close();
  });

  beforeEach(async () => {
    providers.resetAll();
    await setRoute(MK, 'AFROMESSAGE', 'SMSETHIOPIA');
  });

  // ---------------------------------------------------------------- S5.6
  describe('S5.6 - failover classification', () => {
    it('DEFINITIVE_NOT_SENT fails over, and the FALLBACK is what transported it', async () => {
      const challenge = await seedChallenge(`${PHONE_PREFIX}01`);
      providers.AFROMESSAGE.willReturn(definitiveNotSent('sender_not_permitted'));

      const report = await delivery.deliver(challenge, MK, message('483920'));

      expect(report.attempts).toBe(2);
      expect(report.outcome).toBe('ACCEPTED');
      // WHICH provider, not merely that one did.
      expect(report.acceptedBy).toBe('SMSETHIOPIA');

      const rows = await attemptsFor(challenge);
      expect(rows.map((r) => [r.attempt_no, r.provider, r.status])).toEqual([
        [1, 'AFROMESSAGE', 'DEFINITIVE_NOT_SENT'],
        [2, 'SMSETHIOPIA', 'ACCEPTED'],
      ]);
      // The vendor stamp: a router that called the wrong fake cannot forge it.
      expect(rows[1]?.provider_message_id).toMatch(/^smsethiopia-/);
      expect(rows[0]?.failure_class).toBe('sender_not_permitted');

      expect(providers.AFROMESSAGE.sent).toHaveLength(1);
      expect(providers.SMSETHIOPIA.sent).toHaveLength(1);
    });

    it('DELIVERY_UNKNOWN does NOT fail over, and the fallback is asked nothing', async () => {
      const challenge = await seedChallenge(`${PHONE_PREFIX}02`);
      providers.AFROMESSAGE.willReturn(deliveryUnknown('http_timeout_after_transmission'));

      const report = await delivery.deliver(challenge, MK, message('112233'));

      expect(report.attempts).toBe(1);
      expect(report.outcome).toBe('DELIVERY_UNKNOWN');
      expect(report.acceptedBy).toBeNull();

      const rows = await attemptsFor(challenge);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.provider).toBe('AFROMESSAGE');
      expect(rows[0]?.status).toBe('DELIVERY_UNKNOWN');

      /**
       * THE ASSERTION THE WHOLE RULE RESTS ON. The first provider may already
       * have sent the SMS, so a second send would put two messages carrying
       * the same code on one phone. If the classification is ever inverted,
       * this is the line that goes red -- counting attempt rows alone would
       * not, because the row count and the provider set fail independently.
       */
      expect(providers.SMSETHIOPIA.sent).toHaveLength(0);
    });

    it('an adapter that THROWS is DELIVERY_UNKNOWN, so it does not fail over either', async () => {
      const challenge = await seedChallenge(`${PHONE_PREFIX}03`);
      jest
        .spyOn(providers.AFROMESSAGE, 'send')
        .mockRejectedValueOnce(new Error('ECONNRESET'));

      const report = await delivery.deliver(challenge, MK, message('445566'));

      expect(report.outcome).toBe('DELIVERY_UNKNOWN');
      const rows = await attemptsFor(challenge);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.failure_class).toBe('adapter_threw');
      // A throw is the ABSENCE of a classification. Defaulting it the other
      // way would fail over on an unknown, which is the one thing forbidden.
      expect(providers.SMSETHIOPIA.sent).toHaveLength(0);
    });

    it('the two timestamps record different facts, and UNKNOWN sets neither', async () => {
      const accepted = await seedChallenge(`${PHONE_PREFIX}04`);
      await delivery.deliver(accepted, MK, message('000111'));
      const a = (await attemptsFor(accepted))[0];
      expect(a?.status).toBe('ACCEPTED');
      expect(a?.accepted_at).not.toBeNull();
      // Accepted is not final: a callback may still say DELIVERED or FAILED.
      expect(a?.finalized_at).toBeNull();

      const refused = await seedChallenge(`${PHONE_PREFIX}05`);
      await setRoute(MK, 'AFROMESSAGE', null);
      providers.AFROMESSAGE.willReturn(definitiveNotSent('account_suspended'));
      await delivery.deliver(refused, MK, message('000222'));
      const d = (await attemptsFor(refused))[0];
      expect(d?.accepted_at).toBeNull();
      expect(d?.finalized_at).not.toBeNull();

      const unknown = await seedChallenge(`${PHONE_PREFIX}06`);
      providers.AFROMESSAGE.willReturn(deliveryUnknown('receipt_delayed'));
      await delivery.deliver(unknown, MK, message('000333'));
      const u = (await attemptsFor(unknown))[0];
      expect(u?.accepted_at).toBeNull();
      // Deliberately NOT final: the message may yet have gone out, and a late
      // receipt is exactly what would resolve it.
      expect(u?.finalized_at).toBeNull();
    });
  });

  // ---------------------------------------------------------------- S5.5
  describe('S5.5 - failover is not resend', () => {
    it('transports THE SAME code, against ONE challenge, over two vendors', async () => {
      const challenge = await seedChallenge(`${PHONE_PREFIX}07`);
      providers.AFROMESSAGE.willReturn(definitiveNotSent('rejected_before_dispatch'));

      await delivery.deliver(challenge, MK, message('483920'));

      const first = providers.AFROMESSAGE.sent[0];
      const second = providers.SMSETHIOPIA.sent[0];
      // One OTP: the fallback carries the code the primary refused, not a new one.
      expect(first?.body.slots['code']).toBe('483920');
      expect(second?.body.slots['code']).toBe('483920');

      // One challenge, one expiry, one attempt budget -- both attempts point
      // at the same row, and delivery created no second challenge.
      const rows = await attemptsFor(challenge);
      expect(new Set(rows.map((r) => r.otp_challenge_id)).size).toBe(1);
      const challenges = await admin.query<{ n: string }>(
        `SELECT count(*) AS n FROM core.otp_challenge WHERE phone_e164 = $1`,
        [`${PHONE_PREFIX}07`],
      );
      expect(Number(challenges.rows[0]?.n)).toBe(1);
    });
  });

  // ---------------------------------------------------------------- S7.1
  describe('S7.1 / S7.4 - Ethiopia has no fallback yet', () => {
    it('a market with Fallback = NONE makes one attempt and stops', async () => {
      await setRoute(MK, 'AFROMESSAGE', null);
      const challenge = await seedChallenge(`${PHONE_PREFIX}08`);
      providers.AFROMESSAGE.willReturn(definitiveNotSent('provider_down'));

      const report = await delivery.deliver(challenge, MK, message('778899'));

      expect(report.attempts).toBe(1);
      expect(report.outcome).toBe('DEFINITIVE_NOT_SENT');
      expect(providers.SMSETHIOPIA.sent).toHaveLength(0);
      // S7.4: new sends fail while the primary is down. Already-issued codes
      // are untouched -- the challenge is still live and still verifiable,
      // because verification is local and reads no provider state.
      const live = await admin.query<{ n: string }>(
        `SELECT count(*) AS n FROM core.otp_challenge
          WHERE phone_e164 = $1 AND consumed_at IS NULL AND expires_at > now()`,
        [`${PHONE_PREFIX}08`],
      );
      expect(Number(live.rows[0]?.n)).toBe(1);
    });

    it('the SEEDED Ethiopian market really is configured with no fallback', async () => {
      // Not a restatement of the fixture: this reads the row db:reset writes,
      // which is what production-shaped configuration looks like.
      const r = await admin.query<{
        primary: string | null;
        fallback: string | null;
        state: string;
        otp: boolean;
      }>(
        `SELECT sms_primary_provider::text AS primary,
                sms_fallback_provider::text AS fallback,
                activation_state::text AS state, otp_enabled AS otp
           FROM core.market WHERE code = 'SEED'`,
      );
      const row = r.rows[0];
      expect(row?.primary).toBe('AFROMESSAGE');
      expect(row?.fallback).toBeNull();
      expect(row?.state).toBe('ACTIVE');
      expect(row?.otp).toBe(true);
    });
  });

  // ---------------------------------------------------------------- S9.2
  describe('S9.2 - only ACTIVE markets issue', () => {
    const inTrx = <T>(f: (trx: never) => Promise<T>): Promise<T> =>
      db.transaction().execute(f);

    it('an ACTIVE market passes the gate and a SUSPENDED one does not', async () => {
      await expect(
        inTrx((trx) => policy.assertMarketIssuesOtp(trx, MK)),
      ).resolves.toBeUndefined();

      await expect(inTrx((trx) => policy.assertMarketIssuesOtp(trx, MS))).rejects.toThrow(
        /VALIDATION_FAILED/,
      );
    });

    it('ACTIVE but otp_enabled=false is still a refusal -- both are required', async () => {
      await admin.query(`UPDATE core.market SET otp_enabled = false WHERE id = $1`, [MK]);
      try {
        await expect(
          inTrx((trx) => policy.assertMarketIssuesOtp(trx, MK)),
        ).rejects.toThrow(/VALIDATION_FAILED/);
      } finally {
        await admin.query(`UPDATE core.market SET otp_enabled = true WHERE id = $1`, [MK]);
      }
    });
  });

  // ---------------------------------------------------------------- S16
  describe('S16 - the spending circuit breaker', () => {
    const inTrx = <T>(f: (trx: never) => Promise<T>): Promise<T> =>
      db.transaction().execute(f);

    it('a hard limit blocks ANONYMOUS issuance and lets step-up through', async () => {
      // A ceiling below today's attempts, whatever they are.
      await admin.query(
        `UPDATE core.market SET otp_daily_soft_limit = 1, otp_daily_hard_limit = 1
          WHERE id = $1`,
        [MK],
      );
      try {
        await expect(
          inTrx((trx) => policy.assertWithinBudget(trx, MK, true)),
        ).rejects.toThrow(/RATE_LIMITED/);

        /**
         * S16.2, and this is the arm that matters. Blocking step-up here
         * would stop a signed-in seller confirming a payout change because
         * strangers spent the day's SMS budget -- the safeguard becoming the
         * attack. A test that only asserted the refusal would pass with the
         * `anonymous` gate deleted.
         */
        await expect(
          inTrx((trx) => policy.assertWithinBudget(trx, MK, false)),
        ).resolves.toBeUndefined();
      } finally {
        await admin.query(
          `UPDATE core.market SET otp_daily_soft_limit = 100000,
                  otp_daily_hard_limit = 200000 WHERE id = $1`,
          [MK],
        );
      }
    });

    it('a hard limit does not touch a live challenge', async () => {
      const challenge = await seedChallenge(`${PHONE_PREFIX}09`);
      await admin.query(
        `UPDATE core.market SET otp_daily_soft_limit = 1, otp_daily_hard_limit = 1
          WHERE id = $1`,
        [MK],
      );
      try {
        await expect(
          inTrx((trx) => policy.assertWithinBudget(trx, MK, true)),
        ).rejects.toThrow(/RATE_LIMITED/);
        // S16.2 in as many words: it does not invalidate existing OTP.
        const live = await admin.query<{ n: string }>(
          `SELECT count(*) AS n FROM core.otp_challenge
            WHERE id = $1 AND consumed_at IS NULL AND expires_at > now()`,
          [challenge],
        );
        expect(Number(live.rows[0]?.n)).toBe(1);
      } finally {
        await admin.query(
          `UPDATE core.market SET otp_daily_soft_limit = 100000,
                  otp_daily_hard_limit = 200000 WHERE id = $1`,
          [MK],
        );
      }
    });
  });

  // ---------------------------------------------------------------- S15
  describe('S15 - the IP limiter must not execute', () => {
    /**
     * ASSERTED ON THE LIMITER ITSELF, NOT ON ITS TABLE.
     *
     * The first version counted `core.rate_limit_bucket` rows, and that is
     * unreliable HERE FOR A REASON WORTH RECORDING: several other suites
     * blanket-delete the `otp-request` and `otp-request-ip` buckets in their
     * own `beforeEach` (t8, t12), because those buckets are IP-keyed and every
     * suite in this repository comes from one address. A deletion racing this
     * test can only REMOVE rows -- so a restored IP limiter would leave no
     * trace and the test would pass. **The race biases toward vacuity**, which
     * is the direction that matters.
     *
     * Spying on `RateLimitService.consume` asserts the thing S15 actually
     * says -- "it must not EXECUTE" -- in process, with no shared state, and
     * the PHONE_HASH count in the same assertion is the control that proves
     * the requests reached the limiter at all.
     */
    it('an OTP request consults the PHONE limiter and never an IP one', async () => {
      /**
       * ITS OWN BUDGET, CLEARED FIRST. The four requests below must all reach
       * the handler, and 3/hour/PHONE_KEY is real -- so a second run inside
       * the same hour would answer 429 and the test would fail for a reason
       * that has nothing to do with S15. It did exactly that, and a test that
       * only passes against a fresh database has a dependency it never
       * declared.
       */
      const key = resolveKey(
        process.env['IDENTITY_HASH_KEY_V1'],
        'RATE_LIMIT',
      ).toString('hex');
      await admin.query(
        `DELETE FROM core.rate_limit_bucket WHERE subject_id = ANY($1::text[])`,
        [[0, 1, 2, 3].map((i) => subjectHash(`${PHONE_PREFIX}1${i}`, key))],
      );

      const rl = app.get(RateLimitService);
      const spy = jest.spyOn(rl, 'consume');
      try {
        for (let i = 0; i < 4; i += 1) {
          const res = await request(app.getHttpServer())
            .post('/v1/auth/otp/request')
            .set('Idempotency-Key', randomUUID())
            .set('Origin', CONSOLE_ORIGIN)
            .set('X-Adulis-Device', DEVICE)
            .send({ phone: `${PHONE_PREFIX}1${i}`, purpose: 'SIGN_IN' });
          // Reaching the handler is the control: a request refused earlier
          // would consult no limiter and prove nothing about S15.
          expect(res.status).toBe(202);
        }
        const kinds = spy.mock.calls.map((c) => c[0]);
        expect(kinds.filter((k) => k === 'PHONE_HASH')).toHaveLength(4);
        expect(kinds.filter((k) => k === 'IP_HASH')).toHaveLength(0);

        // S14's numbers, pinned where they are actually passed: 3/hour on the
        // phone key. A limiter that ran with a different ceiling would satisfy
        // the counts above and none of the rule.
        for (const call of spy.mock.calls) {
          expect(call[2]).toEqual({
            bucketKey: 'otp-request',
            windowSeconds: 3600,
            max: 3,
          });
        }
      } finally {
        spy.mockRestore();
      }
    });

    it('the phone-keyed control S14 requires still binds at 3 per hour', async () => {
      // Driven through the limiter directly, on a subject no other suite
      // touches, so the assertion cannot be raced by another file's cleanup.
      const rl = app.get(RateLimitService);
      const subject = `t13-${randomUUID()}`;
      /**
       * ITS OWN BUCKET KEY, and that is not fastidiousness. Other suites
       * blanket-delete every row whose `bucket_key` is `otp-request`,
       * regardless of subject, so a unique subject is not enough to be safe
       * from them -- this failed in the full run for exactly that reason
       * while passing alone. The RULE is what is under test here; that the
       * OTP path passes this rule is pinned by the spy above.
       */
      const rule = { bucketKey: 't13-limiter-probe', windowSeconds: 3600, max: 3 };
      try {
        await rl.consume('PHONE_HASH', subject, rule);
        await rl.consume('PHONE_HASH', subject, rule);
        await rl.consume('PHONE_HASH', subject, rule);
        await expect(rl.consume('PHONE_HASH', subject, rule)).rejects.toThrow(
          /RATE_LIMITED/,
        );
      } finally {
        await admin.query(`DELETE FROM core.rate_limit_bucket WHERE subject_id = $1`, [
          subject,
        ]);
      }
    });
  });
});
