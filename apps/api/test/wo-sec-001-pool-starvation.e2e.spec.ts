import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { resolveKey } from '../src/common/crypto/aead';
import { APP_POOL_MAX, createDatabase, isPoolAcquireTimeout } from '../src/common/db/database';
import { RateLimitService, subjectHash } from '../src/common/rate-limit/rate-limit.service';
import { FakeSmsAdapter, SMS_ADAPTER } from '../src/modules/auth/sms.adapter';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * WO-SEC-001 -- OVN-045, pool starvation through nested acquisition.
 *
 * Every limited route used to count its rate limit on the DEFAULT pool from
 * inside its handler transaction: one pooled connection held, a second one
 * requested. With APP_POOL_MAX (10) such requests in flight, every connection
 * was held by a request waiting for another, and nothing moved again. The
 * OTP wrong-guess counter (burnAttempt) and the handoff scan retry had the
 * same shape.
 *
 * Each route below takes a burst of APP_POOL_MAX + 4 concurrent requests
 * against the REAL pool and a real PostgreSQL, with a health probe fired into
 * the middle of it. Before the fix the burst hangs (or, with the new acquire
 * bound, fails with 503); after it, every request answers and the probe gets
 * a connection. Then the limiter's semantics, which must not have moved:
 * thresholds, Retry-After, replay burning nothing, a refused request still
 * counting, known and unknown phones alike.
 *
 * SHARED BUCKETS. Other suites purge `otp-request` (T8, t12, c6) and the
 * other phone buckets (c6) BY BUCKET KEY, mid-run, in parallel workers. So
 * the assertions that need a seeded count to survive are kept to a single
 * round trip on `otp-request`, and the count-after checks live on the courier
 * bucket (purged by seller only) and the buckets c6 touches just twice.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const APP_ROLE = process.env['DATABASE_URL'];

const BURST = APP_POOL_MAX + 4;
const id = (n: number) => `5ec00100-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const M = id(1);
const DEVICE = id(2); // the anonymous caller's device, placed in M
const CONSOLE_DEVICE = id(3);
const OWNER = id(4);
const OWNER_S = id(5);
const SELLER = id(6);
const STRANGER = id(7); // a console account with no relationship to SELLER
const STRANGER_S = id(8);
const KNOWN = id(9); // an account whose phone the limiter must not reveal
const stepUpAccount = (i: number) => id(0x100 + i);
const stepUpSession = (i: number) => id(0x200 + i);
const STEP_UP_ACCOUNTS = BURST + 2; // the burst, one for thresholds, one for wrong guesses

const PHONE_PREFIX = '+2519146';
const phone = (n: number) => `${PHONE_PREFIX}${n.toString().padStart(6, '0')}`;
const P_OWNER = phone(1);
const P_STRANGER = phone(2);
const P_KNOWN = phone(3);
const stepUpPhone = (i: number) => phone(100 + i);

const rateKey = () => resolveKey(process.env['IDENTITY_HASH_KEY_V1'], 'RATE_LIMIT').toString('hex');
const phoneSubject = (p: string) => subjectHash(p, rateKey());

const sms = new FakeSmsAdapter();

@Module({ imports: [AppModule] })
class WoSec001AppModule {}

interface Problem {
  code?: string;
  slots?: { retry_after_seconds?: number };
}

describe('WO-SEC-001 -- no request starves the pool (OVN-045)', () => {
  // A starving pool fails each request after DB_POOL_ACQUIRE_TIMEOUT_MS (5 s);
  // this bound lets that show as 503s rather than as a jest timeout.
  jest.setTimeout(30_000);

  let app: INestApplication;
  let admin: Pool;
  const http = () => request(app.getHttpServer());
  const cookie = (s: string) => `__Host-adulis_session=${sessionToken(s)}`;
  const body = (r: request.Response) => r.body as Problem;

  const otpRequest = (p: string, key = randomUUID()) =>
    http()
      .post('/v1/auth/otp/request')
      .set('Idempotency-Key', key)
      .set('X-Adulis-Device', DEVICE)
      .send({ phone: p, purpose: 'SIGN_IN', audience: 'MOBILE' });
  const deletionRequest = (p: string, key = randomUUID()) =>
    http()
      .post('/v1/deletion/otp/request')
      .set('Idempotency-Key', key)
      .set('X-Adulis-Device', DEVICE)
      .send({ phone: p });
  const recovery = (p: string, key = randomUUID()) =>
    http()
      .post('/v1/auth/recovery')
      .set('Idempotency-Key', key)
      .set('X-Adulis-Device', DEVICE)
      .send({ phone: p });
  const stepUp = (session: string, key = randomUUID()) =>
    http()
      .post('/v1/auth/step-up/request')
      .set('Cookie', cookie(session))
      .set('Origin', CONSOLE_ORIGIN)
      .set('Idempotency-Key', key)
      .send({ action: 'REVOKE_ALL_SESSIONS' });
  const invite = (p: string, key = randomUUID(), session = OWNER_S) =>
    http()
      .post('/v1/seller/couriers')
      .set('Cookie', cookie(session))
      .set('X-Adulis-Seller', SELLER)
      .set('Origin', CONSOLE_ORIGIN)
      .set('Idempotency-Key', key)
      .send({ phone: p });
  const verify = (p: string, code: string) =>
    http()
      .post('/v1/auth/otp/verify')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', DEVICE)
      .send({ phone: p, code, device_id: DEVICE });
  const stepUpVerify = (session: string, challengeId: string, code: string) =>
    http()
      .post('/v1/auth/step-up/verify')
      .set('Cookie', cookie(session))
      .set('Origin', CONSOLE_ORIGIN)
      .send({ challenge_id: challengeId, code });

  /** BURST requests at once, a health probe fired into the middle of them. */
  async function burst(make: (i: number) => request.Test) {
    const requests = Array.from({ length: BURST }, (_, i) => make(i));
    const [results, health] = await Promise.all([Promise.all(requests), http().get('/healthz')]);
    return {
      statuses: results.map((r) => r.status),
      codes: results.map((r) => body(r).code ?? ''),
      healthDb: (health.body as { db?: string }).db,
    };
  }

  const tally = (xs: readonly (string | number)[]) =>
    xs.reduce<Record<string, number>>((t, x) => ({ ...t, [x]: (t[x] ?? 0) + 1 }), {});

  /** Puts the CURRENT window of a bucket at `count`, the way consume() keys it. */
  const seed = (kind: string, subject: string, bucketKey: string, windowSeconds: number, count: number) =>
    admin.query(
      `INSERT INTO core.rate_limit_bucket (subject_kind, subject_id, bucket_key, window_start, count)
       VALUES ($1, $2, $3, to_timestamp(floor(extract(epoch FROM now()) / $4) * $4), $5)
       ON CONFLICT (subject_kind, subject_id, bucket_key, window_start)
       DO UPDATE SET count = EXCLUDED.count`,
      [kind, subject, bucketKey, windowSeconds, count],
    );
  const countOf = async (kind: string, subject: string, bucketKey: string) =>
    (
      await admin.query<{ count: number }>(
        `SELECT count FROM core.rate_limit_bucket
          WHERE subject_kind = $1 AND subject_id = $2 AND bucket_key = $3
          ORDER BY window_start DESC LIMIT 1`,
        [kind, subject, bucketKey],
      )
    ).rows[0]?.count;

  /** 429 RATE_LIMITED whose Retry-After header is the slot, inside the window. */
  const expectRefused = (r: request.Response, windowSeconds: number) => {
    expect(r.status).toBe(429);
    expect(body(r).code).toBe('RATE_LIMITED');
    const after = Number(r.headers['retry-after']);
    expect(after).toBe(body(r).slots?.retry_after_seconds);
    expect(after).toBeGreaterThanOrEqual(1);
    expect(after).toBeLessThanOrEqual(windowSeconds);
    return after;
  };

  const expectReplay = (r: request.Response, status: number) => {
    expect(r.status).toBe(status);
    expect(r.headers['x-adulis-idempotent-replay']).toBe('true');
  };

  const subjects = (): string[] => [
    ...Array.from({ length: 7000 }, (_, n) => phoneSubject(phone(n))),
  ];

  async function cleanup(): Promise<void> {
    const accounts = [OWNER, STRANGER, KNOWN, ...Array.from({ length: STEP_UP_ACCOUNTS }, (_, i) => stepUpAccount(i))];
    const sessions = [OWNER_S, STRANGER_S, ...Array.from({ length: STEP_UP_ACCOUNTS }, (_, i) => stepUpSession(i))];
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(`DELETE FROM core.step_up_challenge WHERE account_id = ANY($1::uuid[])`, [accounts]);
    await admin.query(
      `DELETE FROM core.otp_delivery_attempt WHERE otp_challenge_id IN
         (SELECT id FROM core.otp_challenge WHERE phone_e164 LIKE $1)`,
      [`${PHONE_PREFIX}%`],
    );
    await admin.query(`DELETE FROM core.otp_challenge WHERE phone_e164 LIKE $1`, [`${PHONE_PREFIX}%`]);
    await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [
      [DEVICE, ...accounts],
    ]);
    await admin.query(`DELETE FROM core.account_recovery_case WHERE account_id = ANY($1::uuid[])`, [accounts]);
    await admin.query(`DELETE FROM core.seller_courier_invite WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller_courier WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller_public_stats WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller WHERE id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.session WHERE id = ANY($1::uuid[])`, [sessions]);
    await admin.query(`DELETE FROM core.account WHERE id = ANY($1::uuid[])`, [accounts]);
    await admin.query(`DELETE FROM core.device WHERE id = ANY($1::uuid[])`, [[DEVICE, CONSOLE_DEVICE]]);
    await admin.query(`DELETE FROM core.timing_config WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.market WHERE id = $1`, [M]);
    await admin.query(
      `DELETE FROM core.rate_limit_bucket
        WHERE subject_id = ANY($1::text[]) OR bucket_key = 'wo-sec-001-proof'`,
      [[...subjects(), SELLER, ...accounts]],
    );
    await admin.query(`SET session_replication_role = DEFAULT`);
  }

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await cleanup();
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, created_at,
                                activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'S01','Pool','PHASE_1','ETB','Africa/Addis_Ababa','en',
               now() + interval '10 years', 'ACTIVE', true, 'AFROMESSAGE')`,
      [M],
    );
    await admin.query(
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
      [M],
    );
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$3), ($2,'WEB',NULL)`,
      [DEVICE, CONSOLE_DEVICE, M],
    );
    const accounts: [string, string][] = [
      [OWNER, P_OWNER],
      [STRANGER, P_STRANGER],
      [KNOWN, P_KNOWN],
      ...Array.from({ length: STEP_UP_ACCOUNTS }, (_, i): [string, string] => [stepUpAccount(i), stepUpPhone(i)]),
    ];
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status)
       SELECT a, p, $3, 'ACTIVE' FROM unnest($1::uuid[], $2::text[]) AS v(a, p)`,
      [accounts.map(([a]) => a), accounts.map(([, p]) => p), M],
    );
    const sessions: [string, string][] = [
      [OWNER_S, OWNER],
      [STRANGER_S, STRANGER],
      ...Array.from({ length: STEP_UP_ACCOUNTS }, (_, i): [string, string] => [stepUpSession(i), stepUpAccount(i)]),
    ];
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at)
       SELECT s, a, 'CONSOLE', $3, now() + interval '12 hours'
         FROM unnest($1::uuid[], $2::uuid[]) AS v(s, a)`,
      [sessions.map(([s]) => s), sessions.map(([, a]) => a), CONSOLE_DEVICE],
    );
    await armFixtureSessions(admin, sessions.map(([s]) => s));
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','Pool','wo-sec-001-pool','ACTIVE')`,
      [SELLER, M, OWNER],
    );

    const moduleRef = await Test.createTestingModule({ imports: [WoSec001AppModule] })
      .overrideProvider(SMS_ADAPTER)
      .useValue(sms)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await cleanup();
    await admin.end();
  });

  describe('POST /v1/auth/otp/request (otp-request, 3/hour/phone)', () => {
    it(`a burst of ${BURST} completes and the pool still serves a probe`, async () => {
      const r = await burst((i) => otpRequest(phone(1000 + i)));
      expect(r.statuses).toEqual(Array(BURST).fill(202));
      expect(r.healthDb).toBe('up');
    });

  });

  describe('POST /v1/deletion/otp/request (deletion-otp-request, 3/hour/phone)', () => {
    it(`a burst of ${BURST} completes and the pool still serves a probe`, async () => {
      const r = await burst((i) => deletionRequest(phone(2000 + i)));
      expect(r.statuses).toEqual(Array(BURST).fill(202));
      expect(r.healthDb).toBe('up');
    });

    it('threshold, Retry-After and replay unchanged; a refused request still counts', async () => {
      const p = phone(2100);
      const subject = phoneSubject(p);
      await seed('PHONE_HASH', subject, 'deletion-otp-request', 3600, 2);
      const key = randomUUID();
      expect((await deletionRequest(p, key)).status).toBe(202);
      expectRefused(await deletionRequest(p), 3600);
      expectReplay(await deletionRequest(p, key), 202);
      // 2 seeded + the served one + the refused one; the replay added nothing.
      // A refused request counting is the behaviour the count always had.
      expect(await countOf('PHONE_HASH', subject, 'deletion-otp-request')).toBe(4);
    });

    it('a known and an unknown phone are refused alike at the limit', async () => {
      const unknown = phone(2101);
      await seed('PHONE_HASH', phoneSubject(P_KNOWN), 'deletion-otp-request', 3600, 3);
      await seed('PHONE_HASH', phoneSubject(unknown), 'deletion-otp-request', 3600, 3);
      const k = await deletionRequest(P_KNOWN);
      const u = await deletionRequest(unknown);
      expect(Math.abs(expectRefused(k, 3600) - expectRefused(u, 3600))).toBeLessThanOrEqual(1);
      expect(Object.keys(k.body).sort()).toEqual(Object.keys(u.body).sort());
    });
  });

  describe('POST /v1/auth/step-up/request (step-up-request, 5/hour/account)', () => {
    it(`a burst of ${BURST} accounts completes and the pool still serves a probe`, async () => {
      const r = await burst((i) => stepUp(stepUpSession(i)));
      expect(r.statuses).toEqual(Array(BURST).fill(202));
      expect(r.healthDb).toBe('up');
    });

    it('threshold, Retry-After and replay unchanged; a refused request still counts', async () => {
      const i = BURST;
      await seed('ACCOUNT', stepUpAccount(i), 'step-up-request', 3600, 4);
      const key = randomUUID();
      expect((await stepUp(stepUpSession(i), key)).status).toBe(202);
      expectRefused(await stepUp(stepUpSession(i)), 3600);
      expectReplay(await stepUp(stepUpSession(i), key), 202);
      expect(await countOf('ACCOUNT', stepUpAccount(i), 'step-up-request')).toBe(6);
    });

    it('still demands a signed-in console session', async () => {
      const anonymous = await http()
        .post('/v1/auth/step-up/request')
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', randomUUID())
        .send({ action: 'REVOKE_ALL_SESSIONS' });
      expect(anonymous.status).toBe(401);
    });
  });

  describe('POST /v1/auth/recovery (auth-recovery, 2/day/phone)', () => {
    it(`a burst of ${BURST} completes and the pool still serves a probe`, async () => {
      const r = await burst((i) => recovery(phone(3000 + i)));
      expect(r.statuses).toEqual(Array(BURST).fill(202));
      expect(r.healthDb).toBe('up');
    });

    it('threshold, Retry-After and replay unchanged; a refused request still counts', async () => {
      const p = phone(3100);
      const subject = phoneSubject(p);
      await seed('PHONE_HASH', subject, 'auth-recovery', 86400, 1);
      const key = randomUUID();
      expect((await recovery(p, key)).status).toBe(202);
      expectRefused(await recovery(p), 86400);
      expectReplay(await recovery(p, key), 202);
      expect(await countOf('PHONE_HASH', subject, 'auth-recovery')).toBe(3);
    });
  });

  describe('POST /v1/seller/couriers (seller-courier-invite, 10/hour/seller)', () => {
    const keys = Array.from({ length: BURST }, () => randomUUID());
    let served = -1;

    it(`a burst of ${BURST} completes: exactly ten invites, the rest 429`, async () => {
      const r = await burst((i) => invite(phone(4000 + i), keys[i]));
      expect(tally(r.statuses)).toEqual({ 201: 10, 429: BURST - 10 });
      expect(r.healthDb).toBe('up');
      served = r.statuses.indexOf(201);
      const invites = await admin.query(
        `SELECT count(*)::int AS n FROM core.seller_courier_invite WHERE seller_id = $1`,
        [SELLER],
      );
      expect(invites.rows[0].n).toBe(10);
      // Every attempt counted, the refused ones included -- as before.
      expect(await countOf('ACCOUNT', SELLER, 'seller-courier-invite')).toBe(BURST);
    });

    it('a replay of a served invite is still served while the budget is spent', async () => {
      expect(served).toBeGreaterThanOrEqual(0);
      // Same key and same body: the stored 201, never the limiter's 429.
      expectReplay(await invite(phone(4000 + served), keys[served]), 201);
      expect(await countOf('ACCOUNT', SELLER, 'seller-courier-invite')).toBe(BURST);
    });

    it('an account without the permission is refused before counting, and burns none of the budget', async () => {
      const before = await countOf('ACCOUNT', SELLER, 'seller-courier-invite');
      const refused = await invite(phone(4100), randomUUID(), STRANGER_S);
      expect(refused.status).toBe(404);
      expect(await countOf('ACCOUNT', SELLER, 'seller-courier-invite')).toBe(before);
    });
  });

  /**
   * A wrong guess is counted in the transaction that compared it, under the
   * challenge's row lock, and committed before the refusal. So the attempt
   * count after a burst is the number of codes actually COMPARED: exactly the
   * budget (5), however many arrive at once. (The response codes alone cannot
   * show that: a design that compared every guess against a stale count and
   * counted later answered the same 4 + 10 -- the WO-SEC-001 review finding.)
   */
  describe('wrong OTP guesses (counted where compared, never past the budget)', () => {
    const wrongFor = (code: string) => (code === '000000' ? '111111' : '000000');
    const attempts = async (challengeId: string) =>
      (
        await admin.query<{ n: number }>(
          `SELECT attempt_count AS n FROM core.otp_challenge WHERE id = $1`,
          [challengeId],
        )
      ).rows[0]?.n;

    it(`a burst of ${BURST} wrong sign-in guesses completes, and only five are compared`, async () => {
      const p = phone(5000);
      expect((await otpRequest(p)).status).toBe(202);
      const code = sms.lastTo(p)?.slots['code'] as string;
      expect(code).toMatch(/^\d{6}$/);
      const challenge = (
        await admin.query<{ id: string }>(
          `SELECT id FROM core.otp_challenge WHERE phone_e164 = $1 ORDER BY created_at DESC LIMIT 1`,
          [p],
        )
      ).rows[0]?.id as string;

      const r = await burst(() => verify(p, wrongFor(code)));
      // One verify holds the challenge at a time (FOR UPDATE NOWAIT); a verify
      // that finds it held is refused at once with nothing compared, so which
      // requests get compared varies run to run. What may not vary: no 5xx, at
      // most five compares, and every OTP_INVALID is a compare that counted.
      const t = tally(r.codes);
      expect(Object.keys(t).every((c) => ['OTP_INVALID', 'OTP_ATTEMPTS_EXCEEDED', 'RATE_LIMITED'].includes(c))).toBe(true);
      expect(r.statuses.every((s) => s === 401 || s === 429)).toBe(true);
      expect(r.healthDb).toBe('up');
      const compared = (await attempts(challenge)) as number;
      expect(compared).toBeLessThanOrEqual(5);
      expect(t['OTP_INVALID'] ?? 0).toBe(Math.min(compared, 4));

      // Spend the rest one at a time: the budget ends at exactly five, and the
      // counted attempts survived their requests -- the right code is dead too
      // (4.1, "dead means dead").
      for (let n = compared; n < 5; n++) {
        expect(body(await verify(p, wrongFor(code))).code).toBe(n < 4 ? 'OTP_INVALID' : 'OTP_ATTEMPTS_EXCEEDED');
      }
      expect(await attempts(challenge)).toBe(5);
      expect(body(await verify(p, code)).code).toBe('OTP_ATTEMPTS_EXCEEDED');
    });

    it('a verify that finds the challenge held is refused at once, with nothing compared', async () => {
      const p = phone(5001);
      expect((await otpRequest(p)).status).toBe(202);
      const code = sms.lastTo(p)?.slots['code'] as string;
      const challenge = (
        await admin.query<{ id: string }>(
          `SELECT id FROM core.otp_challenge WHERE phone_e164 = $1 ORDER BY created_at DESC LIMIT 1`,
          [p],
        )
      ).rows[0]?.id as string;

      const holder = await admin.connect();
      try {
        await holder.query('BEGIN');
        await holder.query('SELECT 1 FROM core.otp_challenge WHERE id = $1 FOR UPDATE', [challenge]);
        const started = Date.now();
        // The RIGHT code: had it been compared it would have signed in.
        const held = await verify(p, code);
        expect(Date.now() - started).toBeLessThan(2000);
        expectRefused(held, 1);
      } finally {
        await holder.query('ROLLBACK');
        holder.release();
      }
      expect(await attempts(challenge)).toBe(0);
      // Released, guesses are compared and counted again (a wrong one here,
      // so the test leaves no account behind).
      expect(body(await verify(p, wrongFor(code))).code).toBe('OTP_INVALID');
      expect(await attempts(challenge)).toBe(1);
    });

    it(`a burst of ${BURST} wrong step-up guesses completes, and only five are compared`, async () => {
      const i = BURST + 1;
      const requested = await stepUp(stepUpSession(i));
      expect(requested.status).toBe(202);
      const challengeId = (requested.body as { challenge_id: string }).challenge_id;
      const code = sms.lastTo(stepUpPhone(i))?.slots['code'] as string;
      expect(code).toMatch(/^\d{6}$/);
      const otpChallenge = (
        await admin.query<{ id: string }>(
          `SELECT otp_challenge_id AS id FROM core.step_up_challenge WHERE id = $1`,
          [challengeId],
        )
      ).rows[0]?.id as string;

      const r = await burst(() => stepUpVerify(stepUpSession(i), challengeId, wrongFor(code)));
      expect(tally(r.codes)).toEqual({ OTP_INVALID: 4, OTP_ATTEMPTS_EXCEEDED: BURST - 4 });
      expect(r.healthDb).toBe('up');
      expect(await attempts(otpChallenge)).toBe(5);
      expect(body(await stepUpVerify(stepUpSession(i), challengeId, code)).code).toBe(
        'OTP_ATTEMPTS_EXCEEDED',
      );
    });
  });

  describe('POST /v1/auth/otp/request -- limiter semantics (last: shared bucket)', () => {
    /**
     * `otp-request` is purged BY KEY by T8 (before each of its tests), t12 and
     * c6, in parallel workers -- T8 every few hundred milliseconds while it
     * runs, which is why this block runs LAST -- so a seeded count can vanish between the seed
     * and the request meant to meet it. The bucket shows when that happened:
     * its count is below what the seed plus our own requests make. Only then
     * is the step retried, on fresh phones, 750 ms apart, at most eight times. A limiter that
     * fails to refuse leaves the full count, so it fails at once.
     */
    async function despitePurges(step: (n: number) => Promise<'done' | 'purged'>): Promise<void> {
      for (let n = 0; n < 8; n++) {
        if ((await step(n)) === 'done') return;
        await new Promise((r) => setTimeout(r, 750));
      }
      throw new Error('another suite purged otp-request on every attempt');
    }
    const otpCount = async (p: string) => (await countOf('PHONE_HASH', phoneSubject(p), 'otp-request')) ?? 0;

    it('one below the limit is served; at the limit, 429 with Retry-After; a replay burns nothing', async () => {
      await despitePurges(async (n) => {
        const p = phone(1100 + n);
        await seed('PHONE_HASH', phoneSubject(p), 'otp-request', 3600, 2);
        const key = randomUUID();
        expect((await otpRequest(p, key)).status).toBe(202);
        const refused = await otpRequest(p);
        if (refused.status !== 429 && (await otpCount(p)) < 4) return 'purged';
        expectRefused(refused, 3600);
        // The bucket is full, and the replay still answers its stored 202: it
        // never reached the limiter.
        expectReplay(await otpRequest(p, key), 202);
        return 'done';
      });
    });

    it('a known and an unknown phone are refused alike at the limit', async () => {
      await despitePurges(async (n) => {
        const unknown = phone(1110 + n);
        await seed('PHONE_HASH', phoneSubject(P_KNOWN), 'otp-request', 3600, 3);
        await seed('PHONE_HASH', phoneSubject(unknown), 'otp-request', 3600, 3);
        const k = await otpRequest(P_KNOWN);
        const u = await otpRequest(unknown);
        if ((k.status !== 429 || u.status !== 429) && Math.min(await otpCount(P_KNOWN), await otpCount(unknown)) < 4) {
          return 'purged';
        }
        expect(Math.abs(expectRefused(k, 3600) - expectRefused(u, 3600))).toBeLessThanOrEqual(1);
        expect(Object.keys(k.body).sort()).toEqual(Object.keys(u.body).sort());
        return 'done';
      });
    });
  });

  /**
   * The mechanism, on a pool of two, without the API in the way: the OLD
   * shape cannot finish, the NEW shapes do, and a full pool fails a new
   * acquisition within its bound instead of waiting forever.
   */
  describe('the pool itself', () => {
    const rule = { bucketKey: 'wo-sec-001-proof', windowSeconds: 3600, max: 1000 };

    it('counting on the default pool inside a transaction starves it; counting first or with the transaction does not', async () => {
      const pool = new Pool({ connectionString: APP_ROLE, max: 2, connectionTimeoutMillis: 500 });
      const db = createDatabase(pool);
      const limiter = new RateLimitService(db);
      try {
        // OLD: both transactions hold their connection, then each asks for a third.
        const old = await Promise.allSettled(
          [1, 2].map(() =>
            db.transaction().execute(async (trx) => {
              await sql`SELECT pg_sleep(0.1)`.execute(trx);
              await limiter.consume('DEVICE', randomUUID(), rule);
            }),
          ),
        );
        // Nothing moves until the first wait reaches the bound. That request's
        // rollback then frees a connection the other may still take in time --
        // the bound unjamming the pool -- so only the first failure is certain.
        const rejected = old.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        expect(rejected.length).toBeGreaterThanOrEqual(1);
        for (const r of rejected) expect(isPoolAcquireTimeout(r.reason)).toBe(true);

        // NEW (the routes): count with nothing held, then open the transaction.
        const before = await Promise.allSettled(
          [1, 2].map(async () => {
            await limiter.consume('DEVICE', randomUUID(), rule);
            await db.transaction().execute(async (trx) => {
              await sql`SELECT pg_sleep(0.1)`.execute(trx);
            });
          }),
        );
        expect(before.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);

        // NEW (GET /v1/fyp): count with the transaction itself.
        const within = await Promise.allSettled(
          [1, 2].map(() =>
            db.transaction().execute(async (trx) => {
              await sql`SELECT pg_sleep(0.1)`.execute(trx);
              await limiter.consume('DEVICE', randomUUID(), rule, trx);
            }),
          ),
        );
        expect(within.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
        expect(pool.waitingCount).toBe(0);
      } finally {
        await db.destroy();
      }
    });

    it('a pool with every connection taken fails a new acquisition within its bound, then recovers', async () => {
      const pool = new Pool({ connectionString: APP_ROLE, max: 2, connectionTimeoutMillis: 300 });
      try {
        const held = [await pool.connect(), await pool.connect()];
        const started = Date.now();
        const err = await pool.connect().then(
          () => null,
          (e: unknown) => e,
        );
        const waited = Date.now() - started;
        expect(isPoolAcquireTimeout(err)).toBe(true);
        expect(waited).toBeGreaterThanOrEqual(250);
        expect(waited).toBeLessThan(3000);

        for (const c of held) c.release();
        const again = await pool.connect();
        again.release();
        expect(pool.totalCount).toBeLessThanOrEqual(2);
        expect(pool.waitingCount).toBe(0);
      } finally {
        await pool.end();
      }
    });
  });
});
