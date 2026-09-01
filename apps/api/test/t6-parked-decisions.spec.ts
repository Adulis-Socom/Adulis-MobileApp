import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { FakeSmsAdapter, SMS_ADAPTER } from '../src/modules/auth/sms.adapter';
import { codeHash } from '../src/modules/auth/otp.service';

/**
 * T6 Phase C -- the five decisions the register RECORDED and nothing
 * ASSERTED.
 *
 * Work Order T6 S4: "verify D-27, D-30, D-33, D-34 and D-51. **Write a test
 * for each, even where no code changes.**"
 *
 * That instruction is the point of the file. Each of these five is a place
 * where two governing documents disagreed and a decision was taken and
 * written down -- and a decision recorded in a register is a decision
 * nothing defends. Every one of them is a single line or a single predicate
 * away from being undone by a change that looks like a tidy-up:
 *
 *   D-27  a fourth set_config the ruled wrapper does not print
 *   D-30  404 where ADU-API-01's prose says 403
 *   D-33  OTP_EXPIRED where ADU-AUTH-01 names OTP_SUPERSEDED
 *   D-34  403 to MOBILE where ADU-API-01's audience column says B S C
 *   D-51  200 with a degraded body where "reddens" reads like 503
 *
 * Four of the five are here. D-51's live in worker-runtime.spec.ts, beside
 * the heartbeat they manipulate: jobs.worker_heartbeat holds ONE row by
 * construction, so exactly one suite may own it, and two suites racing on
 * one row is a flake that reads as a real failure. That file now builds the
 * REAL AppModule, which is what found register D-79 -- /healthz answered
 * 401 in the assembled application, because the APP_GUARD-global AuthGuard
 * does not exist in a standalone test module and both of its tests were
 * standalone.
 *
 * D-27, D-30 and D-34 change no code. D-33 changes none either. D-51's did.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = randomUUID();
const SELLER_OWNER = randomUUID();
const BUYER = randomUUID();
const STRANGER = randomUUID();
// P_FRESH's account exists so otp.timingFor resolves THIS market's config;
// D-33 is about supersession, not about identity creation.
const FRESH = randomUUID();
const DEVICE = randomUUID();
const FRESH_DEVICE = randomUUID();
const OWNER_CON_S = randomUUID();
const OWNER_MOB_S = randomUUID();
const STRANGER_MOB_S = randomUUID();
const SELLER = randomUUID();
const ORDER = randomUUID();

const P_OWNER = '+251919950001';
const P_BUYER = '+251919950002';
const P_STRANGER = '+251919950003';
const P_FRESH = '+251919950004'; // signs in through the real OTP path

const sms = new FakeSmsAdapter();

@Module({ imports: [AppModule] })
class T6AppModule {}

describe('T6 Phase C -- the recorded decisions, now defended', () => {
  let app: INestApplication;
  let admin: Pool;

  const http = () => request(app.getHttpServer());
  const cookie = (t: string) => `__Host-adulis_session=${t}`;
  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'T6P','Parked','PHASE_1','ETB','Africa/Addis_Ababa','en', 'ACTIVE', true, 'AFROMESSAGE')`,
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
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,$5,$9,'ACTIVE'), ($2,$6,$9,'ACTIVE'), ($3,$7,$9,'ACTIVE'),
        ($4,$8,$9,'ACTIVE')`,
      [SELLER_OWNER, BUYER, STRANGER, FRESH, P_OWNER, P_BUYER, P_STRANGER, P_FRESH, M],
    );
    await admin.query(
      // market_id is what /v1/bootstrap stamps (G1.11), and since T8 Phase 3
      // it is where an anonymous OTP path reads the governing timing from.
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$3), ($2,'ANDROID',$3)`,
      [DEVICE, FRESH_DEVICE, M],
    );
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$4,'CONSOLE',$6, now() + interval '12 hours'),
        ($2,$4,'MOBILE',$6, now() + interval '12 hours'),
        ($3,$5,'MOBILE',$6, now() + interval '12 hours')`,
      [OWNER_CON_S, OWNER_MOB_S, STRANGER_MOB_S, SELLER_OWNER, STRANGER, DEVICE],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','Parked','t6-parked','ACTIVE')`,
      [SELLER, M, SELLER_OWNER],
    );
    // A confirmed order belonging to BUYER, so it is both markable-ready
    // (D-27) and probeable by a stranger (D-30).
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id,
         state, expires_at, clock_stopped_at, total_minor, total_currency,
         display_currency)
       VALUES ($1,$2,$3,$4,'PAYMENT_CONFIRMED', now() + interval '2 days',
               now(), 50000,'ETB','ETB')`,
      [ORDER, M, SELLER, BUYER],
    );

    const moduleRef = await Test.createTestingModule({ imports: [T6AppModule] })
      .overrideProvider(SMS_ADAPTER)
      .useValue(sms)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [
      [SELLER_OWNER, BUYER, STRANGER],
    ]);
    await admin.query(`DELETE FROM core."order" WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller_public_stats WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller WHERE id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.step_up_challenge WHERE account_id = ANY($1::uuid[])`, [
      [SELLER_OWNER, BUYER, STRANGER],
    ]);
    await admin.query(`DELETE FROM core.otp_challenge WHERE phone_e164 = ANY($1::core.e164[])`, [
      [P_OWNER, P_BUYER, P_STRANGER, P_FRESH],
    ]);
    await admin.query(`DELETE FROM core.session WHERE account_id IN
                        (SELECT id FROM core.account WHERE market_id = $1)`, [M]);
    await admin.query(`DELETE FROM core.account_device WHERE account_id IN
                        (SELECT id FROM core.account WHERE market_id = $1)`, [M]);
    await admin.query(`DELETE FROM core.buyer_profile WHERE account_id IN
                        (SELECT id FROM core.account WHERE market_id = $1)`, [M]);
    await admin.query(`DELETE FROM core.device WHERE id = ANY($1::uuid[])`, [[DEVICE, FRESH_DEVICE]]);
    await admin.query(`DELETE FROM core.account WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.timing_config WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.market WHERE id = $1`, [M]);
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  // ======================================================================
  // D-27 -- the ruled wrapper sets THREE settings; a ratified function body
  //         reads a FOURTH.
  // ======================================================================
  describe('D-27 -- adulis.audience is the fourth transaction-local setting', () => {
    it('the surface check inside fn_mark_order_ready actually runs, and it is not the endpoint doing it', async () => {
      // ADU-CON-02 v3.0 S6.1 prints set_config for exactly three settings.
      // ADU-DB-01 S12.6a's ratified fn_mark_order_ready body reads
      // current_setting('adulis.audience'), so with three settings every
      // mark-ready call was a 500: "unrecognised configuration parameter".
      //
      // Success here is the whole assertion. If the fourth set_config is
      // ever removed as an unruled extra, this is a 500 -- and a 500 on a
      // seller's happy path is what the C3 gate suite found the first time.
      const ok = await http()
        .post(`/v1/seller/orders/${ORDER}/ready`)
        .set('Cookie', cookie(OWNER_CON_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', randomUUID())
        .send({})
        .expect(200);
      expect(ok.body.ready_at).toBeTruthy();

      // AND THE SETTING IS LOAD-BEARING, proven by removing it. Called with
      // no adulis.audience in scope, current_setting raises 42704
      // "unrecognized configuration parameter" -- which the translator does
      // not recognise, so it is a 500. That is precisely the C3 finding:
      // every mark-ready call was a 500 on a seller's happy path.
      const bare = admin;
      await expect(
        bare.query(`SELECT core.fn_mark_order_ready($1,$2,$3)`, [ORDER, SELLER_OWNER, SELLER]),
      ).rejects.toMatchObject({ code: '42704' });

      // With the fourth setting present, in the same shape the wrapper
      // writes it, the same call succeeds.
      const c = await admin.connect();
      try {
        await c.query('BEGIN');
        await c.query(`SELECT set_config('adulis.audience','CONSOLE',true)`);
        const r = await c.query<{ fn_mark_order_ready: Date }>(
          `SELECT core.fn_mark_order_ready($1,$2,$3)`,
          [ORDER, SELLER_OWNER, SELLER],
        );
        expect(r.rows[0]?.fn_mark_order_ready).toBeTruthy();
        await c.query('ROLLBACK');
      } finally {
        c.release();
      }

      // AND IT CARRIES THE REAL VALUE, not a constant. seller.order_ready:update
      // is {MOBILE, CONSOLE} -- seller lite marks orders ready from the
      // phone -- so a MOBILE session must also succeed. If the wrapper ever
      // wrote a fixed 'CONSOLE', or an empty string, this call would fail
      // the ::core.session_audience cast (22P02) rather than pass.
      const surfaces = await admin.query<{ surfaces: string[] }>(
        `SELECT surfaces::text[] AS surfaces FROM core.permission
          WHERE code = 'seller.order_ready:update'`,
      );
      expect(surfaces.rows[0]?.surfaces?.sort()).toEqual(['CONSOLE', 'MOBILE']);
      const fromMobile = await http()
        .post(`/v1/seller/orders/${ORDER}/ready`)
        .set('Authorization', `Bearer ${OWNER_MOB_S}`)
        .set('X-Adulis-Seller', SELLER)
        .set('Idempotency-Key', randomUUID())
        .send({})
        .expect(200);
      expect(fromMobile.body.ready_at).toBe(ok.body.ready_at);
    });

    it('all four settings are transaction-local, so a pooled connection carries nothing between requests', async () => {
      // The third argument to set_config is the entire RLS control, and it
      // is what makes the wrapper safe under PgBouncer transaction mode
      // (ADU-CON-02 S17). A `false` here would leak one request's identity
      // into the next request that happened to get the same connection.
      const r = await admin.query<Record<string, string>>(
        `SELECT set_config('adulis.account_id','a',true) AS a,
                set_config('adulis.actor_role','b',true)  AS b,
                set_config('adulis.seller_id','c',true)   AS c,
                set_config('adulis.audience','CONSOLE',true) AS d`,
      );
      expect(r.rows[0]).toMatchObject({ a: 'a', b: 'b', c: 'c', d: 'CONSOLE' });
      // A NEW statement outside that transaction sees them empty again.
      const after = await admin.query<Record<string, string>>(
        `SELECT current_setting('adulis.account_id', true) AS a,
                current_setting('adulis.audience', true)   AS d`,
      );
      expect(after.rows[0]?.a ?? '').toBe('');
      expect(after.rows[0]?.d ?? '').toBe('');
    });
  });

  // ======================================================================
  // D-30 -- 12.5 says 403 for a non-buyer; S19 says a stranger must not
  //         learn the object exists.
  // ======================================================================
  describe('D-30 -- a stranger probing an order gets 404, and no detail', () => {
    it('the order exists, belongs to someone else, and is reported as not found', async () => {
      // The order is real: the buyer can read it.
      const mine = await admin.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM core."order" WHERE id = $1`,
        [ORDER],
      );
      expect(Number(mine.rows[0]?.n)).toBe(1);

      const probe = await http()
        .get(`/v1/orders/${ORDER}`)
        .set('Authorization', `Bearer ${STRANGER_MOB_S}`)
        .set('X-Adulis-Device', DEVICE)
        .expect(404);

      // ADU-AUTH-01 S19/S21: a scope failure is 404 AND CARRIES NO DETAIL.
      // 403 would confirm the order exists, which is the whole objection --
      // an id oracle over other people's orders, one probe at a time.
      expect(probe.body.code).toBe('NOT_FOUND');
      expect(probe.body.items).toBeUndefined();
      expect(probe.body.slots).toBeUndefined();

      // And a completely fictional id is INDISTINGUISHABLE from the real
      // one the stranger may not see. That is the property, not the status
      // code: two responses that differ would rebuild the oracle.
      const fiction = await http()
        .get(`/v1/orders/${randomUUID()}`)
        .set('Authorization', `Bearer ${STRANGER_MOB_S}`)
        .set('X-Adulis-Device', DEVICE)
        .expect(404);
      expect(fiction.body.code).toBe(probe.body.code);
      expect(Object.keys(fiction.body).sort()).toEqual(Object.keys(probe.body).sort());
    });
  });

  // ======================================================================
  // D-33 -- AUTH 4.2 mandates OTP_SUPERSEDED; API 7.1's taxonomy is closed
  //         and has no such code.
  // ======================================================================
  describe('D-33 -- a superseded code is EXPIRED on the wire, and burns no attempt', () => {
    it('the first code answers OTP_EXPIRED after a resend, and the live challenge is untouched', async () => {
      // THE TWO CHALLENGES ARE WRITTEN DIRECTLY, and that is not a
      // shortcut. Going through POST /v1/auth/otp/request would consume the
      // per-IP rate-limit bucket, which is keyed by an HMAC of the IP and is
      // therefore SHARED with every other suite that requests an OTP. This
      // file used to purge that bucket by bucket_key to make room -- which
      // wipes every other suite's budget mid-run, in a parallel worker, and
      // is a flake that reads as a real failure.
      //
      // D-33 is about what verifyCode ANSWERS, not about how the older
      // challenge came to be superseded. So the state verifyCode sees is
      // built directly: an older unconsumed challenge inside the 15-minute
      // window, and a live one after it. codeHash is the service's own
      // keyed digest, so the codes are real codes.
      const firstCode = '111111';
      const secondCode = '222222';
      const olderId = randomUUID();
      const liveId = randomUUID();
      await admin.query(
        // STAMPED like the service stamps (migration 0044): a hand-written
        // challenge without audience/market/max_attempts is a pre-0044 relic
        // the verify path answers as EXPIRED, which is not what this test
        // is about.
        `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash,
           expires_at, created_at, audience, market_id, max_attempts,
           transported_at)
         VALUES ($1,'SIGN_IN',$2,$3, now() + interval '5 minutes',
                 now() - interval '5 minutes', 'MOBILE', $4, 5,
                 now() - interval '5 minutes')`,
        [olderId, P_FRESH, codeHash(olderId, firstCode), M],
      );
      await admin.query(
        `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash,
           expires_at, created_at, audience, market_id, max_attempts,
           transported_at)
         VALUES ($1,'SIGN_IN',$2,$3, now() + interval '5 minutes', now(),
                 'MOBILE', $4, 5, now())`,
        [liveId, P_FRESH, codeHash(liveId, secondCode), M],
      );

      const stale = await http()
        .post('/v1/auth/otp/verify')
        .set('Idempotency-Key', randomUUID())
        .set('X-Adulis-Device', FRESH_DEVICE)
        .send({
          phone: P_FRESH,
          code: firstCode,
          device_id: FRESH_DEVICE,
          age_declared_over_18: true,
        });
      // THE WIRE SAYS OTP_EXPIRED. DOCUMENT_AUTHORITY gives wire behaviour
      // to ADU-API-01, whose S7.1 taxonomy is closed and has no
      // OTP_SUPERSEDED -- and inventing one in a service is the thing S7.1
      // exists to forbid.
      expect(stale.status).toBe(401);
      expect(stale.body.code).toBe('OTP_EXPIRED');

      // AND IT BURNED NO ATTEMPT ON THE LIVE CHALLENGE. This is the half
      // that matters: without it, a person who typed the older of two SMS
      // spends one of five tries on the code they were about to use, and
      // three such mistakes lock the phone for an hour.
      const after = await admin.query<{ attempt_count: number }>(
        `SELECT attempt_count FROM core.otp_challenge WHERE id = $1`,
        [liveId],
      );
      expect(Number(after.rows[0]?.attempt_count)).toBe(0);

      // The newer code still works, which is what the person was told to do.
      await http()
        .post('/v1/auth/otp/verify')
        .set('Idempotency-Key', randomUUID())
        .set('X-Adulis-Device', FRESH_DEVICE)
        .send({
          phone: P_FRESH,
          code: secondCode,
          device_id: FRESH_DEVICE,
          age_declared_over_18: true,
        })
        .expect(200);
    });

    it('the string a person reads says to check for a newer message, in BOTH locales', () => {
      // The UX ADU-AUTH-01 S4.2 exists to protect survives the code being
      // OTP_EXPIRED rather than OTP_SUPERSEDED -- but ONLY through the
      // wording, so the wording is the assertion. Read as text rather than
      // imported: apps/api does not depend on @adulis/locale and must not
      // grow the edge for one test (ADU-REPO-01 S4). Same technique
      // ops/scripts/verify-error-locale.mjs uses.
      const root = path.resolve(__dirname, '..', '..', '..');
      const en = readFileSync(path.join(root, 'packages', 'locale', 'src', 'en.ts'), 'utf8');
      const am = readFileSync(path.join(root, 'packages', 'locale', 'src', 'am.ts'), 'utf8');
      const line = (src: string): string => {
        const m = /'error\.auth\.otp_expired':\s*'([^']*)'/.exec(src);
        if (!m) throw new Error('error.auth.otp_expired is absent');
        return m[1] as string;
      };
      expect(line(en)).toMatch(/newer/i);
      expect(line(am).length).toBeGreaterThan(0);
    });
  });

  // ======================================================================
  // D-34 -- 12.2 lists revoke-others for B S C; AUTH 9.1 says no step-up
  //         action is reachable from MOBILE.
  // ======================================================================
  describe('D-34 -- step-up is CONSOLE-only, and revoke-others is a step-up action', () => {
    it('a MOBILE session is refused by BOTH the request and the revoke', async () => {
      // ADU-AUTH-01 v2.4 S9.1's INVARIANT: all step-up actions are
      // CONSOLE-only. ADU-API-01 v1.6 S12.2's audience column says B S C for
      // this row. Authorization doctrine belongs to ADU-AUTH-01.
      const requestRefused = await http()
        .post('/v1/auth/step-up/request')
        .set('Authorization', `Bearer ${OWNER_MOB_S}`)
        .set('Idempotency-Key', randomUUID())
        .send({ action: 'REVOKE_ALL_SESSIONS' })
        .expect(403);
      expect(requestRefused.body.code).toBe('PERMISSION_DENIED');

      // And the endpoint refuses too, so removing one gate does not open
      // the other. A mobile buyer still revokes sessions ONE AT A TIME --
      // same outcome, more taps, no invariant broken.
      const revokeRefused = await http()
        .post('/v1/auth/sessions/revoke-others')
        .set('Authorization', `Bearer ${OWNER_MOB_S}`)
        .send({ step_up_challenge_id: randomUUID() })
        .expect(403);
      expect(revokeRefused.body.code).toBe('PERMISSION_DENIED');

      // The refusal is decided BEFORE the step-up challenge is looked at:
      // the id above is fictional and the answer is still 403, not 404.
      // If the order were reversed, a MOBILE caller could learn whether a
      // challenge id exists.
    });

    it('the same call from CONSOLE reaches the step-up gate instead of the audience gate', async () => {
      // The control: the audience refusal must be about the audience, not
      // about the endpoint being broken.
      const reached = await http()
        .post('/v1/auth/sessions/revoke-others')
        .set('Cookie', cookie(OWNER_CON_S))
        .set('Origin', CONSOLE_ORIGIN)
        .send({ step_up_challenge_id: randomUUID() });
      // A fictional challenge from CONSOLE fails the STEP-UP gate, which is
      // a different code from the audience gate above.
      expect(reached.status).toBe(403);
      expect(reached.body.code).toBe('STEP_UP_REQUIRED');
    });
  });

});
