import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { FakeSmsAdapter, SMS_ADAPTER } from '../src/modules/auth/sms.adapter';

/**
 * C6 — identity/session (12.2), team/subscription/deletion (12.12), web
 * deletion (12.18), couriers (12.11): the OTP ladder end to end, the R17
 * cookie pair, step-up request/verify and its single use, the R4 billing
 * audience gate, seat entitlements, courier revocation ending assignments,
 * closure gating new orders, both deletion paths with their blockers, and
 * the phone-reuse block read at seller creation.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = 'cccc6666-3333-4000-8000-000000000001';
const OWNER = 'cccc6666-3333-4000-8000-000000000002';
const BUYER = 'cccc6666-3333-4000-8000-000000000003';
const MEMBER1 = 'cccc6666-3333-4000-8000-000000000004';
const MEMBER2 = 'cccc6666-3333-4000-8000-000000000005';
const MEMBER3 = 'cccc6666-3333-4000-8000-000000000006';
const COURIER_ACC = 'cccc6666-3333-4000-8000-000000000007';
const OWNER2 = 'cccc6666-3333-4000-8000-000000000008';
const DEVICE = 'cccc6666-3333-4000-8000-000000000009';
const SELLER = 'cccc6666-3333-4000-8000-00000000000a';
const DELSELLER = 'cccc6666-3333-4000-8000-00000000000b';
const PRODUCT = 'cccc6666-3333-4000-8000-00000000000c';
const VARIANT = 'cccc6666-3333-4000-8000-00000000000d';
const OWNER_S = 'cccc6666-3333-4000-8000-00000000000e';
const OWNER_MOB_S = 'cccc6666-3333-4000-8000-00000000000f';
const OWNER_S2 = 'cccc6666-3333-4000-8000-000000000010';
const BUYER_S = 'cccc6666-3333-4000-8000-000000000011';
const MEMBER1_S = 'cccc6666-3333-4000-8000-000000000012';
const MEMBER1_CON_S = 'cccc6666-3333-4000-8000-000000000013';
const OWNER2_S = 'cccc6666-3333-4000-8000-000000000014';
const COURIER_S = 'cccc6666-3333-4000-8000-000000000015';
const SUB = 'cccc6666-3333-4000-8000-000000000016';
const PS_BUSINESS = 'cccc6666-3333-4000-8000-000000000017'; // price schedule
const TD_BUSINESS = 'cccc6666-3333-4000-8000-000000000018'; // tier definition
const OTP_FIX = 'cccc6666-3333-4000-8000-000000000019';
const DELSELLER_PD = 'cccc6666-3333-4000-8000-00000000001a'; // payout details

const P_OWNER = '+251911441701';
const P_BUYER = '+251911441702';
const P_MEMBER1 = '+251911441703';
const P_MEMBER2 = '+251911441704';
const P_COURIER = '+251911441706';
const P_OWNER2 = '+251911441707';
const P_SIGNUP = '+251911441801'; // fresh identity via the API
const P_RESEND = '+251911441802';
const P_ATTEMPTS = '+251911441803';
const P_WEBDEL = '+251911441804'; // web-deletion buyer

const sms = new FakeSmsAdapter();

@Module({ imports: [AppModule] })
class C6AppModule {}

describe('C6 — accounts, team, billing, deletion', () => {
  let app: INestApplication;
  let admin: Pool;

  const key = () => randomUUID();
  const http = () => request(app.getHttpServer());

/**
 * T8 Phase 2 -- a console sign-in is a BROWSER sign-in, and a browser's
 * device identity comes from /v1/bootstrap in an httpOnly cookie
 * (ADU-RUL-03 S2). These tests used to send a device_id in the body; the
 * server now ignores that on a CONSOLE request, so they do what a browser
 * does instead.
 */
const webDevices: string[] = [];
const browserCookie = async (): Promise<string> => {
  const res = await http().get('/v1/bootstrap').set('X-Adulis-Client', 'web/9.9.9').expect(200);
  const raw = res.headers['set-cookie'] as unknown as string[];
  const line = raw.find((c) => c.startsWith('__Host-adulis_browser='));
  if (!line) throw new Error('bootstrap issued no device cookie');
  const id = line.split('=', 2)[1]?.split(';')[0] as string;
  webDevices.push(id);
  return `__Host-adulis_browser=${id}`;
};
  const cookie = (t: string) => `__Host-adulis_session=${t}`;

  const codeFor = (phone: string): string => {
    const m = sms.lastTo(phone);
    if (!m) throw new Error(`no SMS captured for ${phone}`);
    return m.slots['code'] as string;
  };

  const freshStepUp = async (account: string, action: string): Promise<string> => {
    const id = randomUUID();
    await admin.query(
      `INSERT INTO core.step_up_challenge
         (id, account_id, action, otp_challenge_id, satisfied_at, expires_at)
       VALUES ($1, $2, $3::core.step_up_action, $4, now(), now() + interval '1 hour')`,
      [id, account, action, OTP_FIX],
    );
    return id;
  };

  const mintSession = async (account: string, audience: string): Promise<string> => {
    const id = randomUUID();
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at)
       VALUES ($1,$2,$3::core.session_audience,$4, now() + interval '1 day')`,
      [id, account, audience, DEVICE],
    );
    return id;
  };


  /**
   * Place a registered device in THIS SUITE'S market. In production
   * /v1/bootstrap does it (G1.11), and since T8 Phase 3 the market a new
   * identity joins is read off that row -- a device that never bootstrapped
   * cannot create an account, deliberately.
   *
   * The suite does it EXPLICITLY rather than by calling bootstrap, because
   * bootstrap resolves a GLOBAL market (is_live DESC, created_at ASC) and a
   * test that goes through it silently asserts "my market is the earliest
   * live one in this database" -- true only by scheduling luck, and false the
   * moment another suite's live market is older. That reproduced D-104's
   * exact recorded symptom: this suite's accounts landing in a foreign
   * market, invisible to its market-scoped teardown, and the NEXT run
   * answering 200 where 400 belongs.
   */
  const bootDevice = async (id: string): Promise<void> => {
    await admin.query(`UPDATE core.device SET market_id = $1 WHERE id = $2`, [M, id]);
  };
  const purgeRateBuckets = async () => {
    await admin.query(
      `DELETE FROM core.rate_limit_bucket
        WHERE bucket_key IN ('otp-request','otp-request-ip','step-up-request',
                             'auth-recovery','deletion-otp-request')`,
    );
    // T6-B S2 gave the courier invite a budget of ten per hour per SELLER,
    // and a bucket row outlives the run that made it -- so without this the
    // suite starts 429ing on its eleventh cumulative invite, days later,
    // for no reason a reader could see. Scoped to THIS seller: the table is
    // shared, and purging by bucket_key alone wipes another suite's budget
    // mid-run, in a parallel worker.
    await admin.query(
      `DELETE FROM core.rate_limit_bucket
        WHERE bucket_key = 'seller-courier-invite' AND subject_id = $1`,
      [SELLER],
    );
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await purgeRateBuckets();
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live)
       VALUES ($1,'C6E','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en',true)`,
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
      `INSERT INTO core.ladder_config (id, market_id, established_min_handoffs,
         established_window, established_min_avg_rating, established_max_claim_rate,
         trusted_min_handoffs, trusted_window, trusted_min_scan_completion_rate,
         trusted_max_claim_rate, demotion_max_claim_rate,
         demotion_max_cancellation_rate, demotion_min_scan_completion_rate,
         demotion_window, new_level_product_cap, new_level_transaction_cap_minor,
         distinct_buyer_window, distinct_buyer_max_count)
       VALUES (gen_random_uuid(), $1, 25,'90 days',4.0,0.02,100,'180 days',0.9,
         0.01,0.05,0.25,0.5,'60 days',10,50000000,'30 days',5)`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'${P_OWNER}',$8,'ACTIVE'), ($2,'${P_BUYER}',$8,'ACTIVE'),
        ($3,'${P_MEMBER1}',$8,'ACTIVE'), ($4,'${P_MEMBER2}',$8,'ACTIVE'),
        ($5,'${P_COURIER}',$8,'ACTIVE'), ($6,'${P_OWNER2}',$8,'ACTIVE'),
        ($7,'+251911441705',$8,'ACTIVE')`,
      [OWNER, BUYER, MEMBER1, MEMBER2, COURIER_ACC, OWNER2, MEMBER3, M],
    );
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$2)`,
      [DEVICE, M],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status) VALUES
        ($1,$3,$4,'INDIVIDUAL','C6 Store','c6-store','ACTIVE'),
        ($2,$3,$5,'INDIVIDUAL','C6 Closing','c6-closing','ACTIVE')`,
      [SELLER, DELSELLER, M, OWNER, OWNER2],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor,
         base_price_currency, visibility)
       VALUES ($1,$2,$3,'Basket',50000,'ETB','PUBLISHED')`,
      [PRODUCT, SELLER, M],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
         price_currency, variant_key)
       VALUES ($1,$2,$3,50000,'ETB','plain')`,
      [VARIANT, PRODUCT, SELLER],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       VALUES (gen_random_uuid(),$1,$2,10,'SELLER_SET')`,
      [VARIANT, SELLER],
    );
    // Active payout on both sellers: fn_create_order snapshots it, and the
    // deletion effects purge it.
    await admin.query(
      `INSERT INTO core.payout_details (id, seller_id, bank_code, account_last4,
         state, activated_at, requested_by_account_id) VALUES
        (gen_random_uuid(), $1,'CBE','6789','ACTIVE', now(), $2),
        ($5, $3,'CBE','4321','ACTIVE', now(), $4)`,
      [SELLER, OWNER, DELSELLER, OWNER2, DELSELLER_PD],
    );
    await admin.query(
      `INSERT INTO financial.payout_credential
         (payout_details_id, account_ciphertext, account_name_ciphertext,
          encryption_key_ref)
       VALUES ($1, decode('00','hex'), decode('00','hex'), 'PAYOUT_ENCRYPTION_KEY_V1')`,
      [DELSELLER_PD],
    );
    // Business-on-trial subscription for SELLER: team seats come from the
    // tier definition, never a stored boolean (check 3).
    await admin.query(
      `INSERT INTO billing.tier_definition (id, tier, version, product_cap,
         team_seats, analytics_scope)
       VALUES ($1,'BUSINESS',1,NULL,2,'FULL')`,
      [TD_BUSINESS],
    );
    await admin.query(
      `INSERT INTO billing.subscription (id, seller_id, state, tier, term,
         trial_started_at, trial_ends_at)
       VALUES ($1,$2,'TRIAL','BUSINESS','MONTHLY', now(), now() + interval '60 days')`,
      [SUB, SELLER],
    );
    await admin.query(
      `INSERT INTO billing.price_schedule (id, market_id, tier, price_minor,
         currency, usd_reference_minor, fx_rate, prepay_quarterly_discount,
         prepay_annual_discount, derived_at, effective)
       VALUES ($1,$2,'BUSINESS',100000,'ETB',180000,0.018,0.05,0.10,now(),
               tstzrange(now() - interval '1 day', NULL, '[)'))`,
      [PS_BUSINESS, M],
    );

    await admin.query(`SET session_replication_role = replica`);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at, created_at) VALUES
        ($1,$6,'CONSOLE',NULL, now()+interval '12 hours', now()),
        ($2,$6,'MOBILE',$10, now()+interval '30 days', now()),
        ($3,$6,'CONSOLE',NULL, now()+interval '12 hours', now()),
        ($4,$7,'MOBILE',$10, now()+interval '30 days', now()),
        ($5,$8,'MOBILE',$10, now()+interval '30 days', now()),
        ($11,$8,'CONSOLE',NULL, now()+interval '12 hours', now()),
        ($12,$9,'CONSOLE',NULL, now()+interval '12 hours', now()),
        ($13,$14,'CONSOLE',NULL, now()+interval '12 hours', now())`,
      [OWNER_S, OWNER_MOB_S, OWNER_S2, BUYER_S, MEMBER1_S, OWNER, BUYER,
       MEMBER1, OWNER2, DEVICE, MEMBER1_CON_S, OWNER2_S, COURIER_S, COURIER_ACC],
    );
    // The step-up fixture challenges hang off one consumed OTP row.
    await admin.query(
      `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash,
         expires_at, consumed_at, step_up_action)
       VALUES ($1,'STEP_UP','${P_OWNER}', decode('00','hex'),
               now()+interval '1 hour', now(), 'TEAM_CHANGE')`,
      [OTP_FIX],
    );
    await admin.query(`SET session_replication_role = DEFAULT`);

    const moduleRef = await Test.createTestingModule({ imports: [C6AppModule] })
      .overrideProvider(SMS_ADAPTER)
      .useValue(sms)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.handoff_scan WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.order_qr_token WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.order_courier_assignment WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.stock_event WHERE seller_id IN ('${SELLER}','${DELSELLER}')`,
      `DELETE FROM core.buyer_cancellation_counter WHERE buyer_account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.reservation WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.order_payout_snapshot WHERE seller_id IN ('${SELLER}','${DELSELLER}')`,
      `DELETE FROM core.notification WHERE recipient_account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core."order" WHERE market_id='${M}'`,
      `DELETE FROM core.cart_line WHERE cart_id IN (SELECT id FROM core.cart WHERE seller_id IN ('${SELLER}','${DELSELLER}'))`,
      `DELETE FROM core.cart WHERE seller_id IN ('${SELLER}','${DELSELLER}')`,
      `DELETE FROM financial.payout_credential WHERE payout_details_id IN (SELECT id FROM core.payout_details WHERE seller_id IN ('${SELLER}','${DELSELLER}'))`,
      `DELETE FROM core.payout_change_log WHERE seller_id IN ('${SELLER}','${DELSELLER}')`,
      `DELETE FROM core.payout_details WHERE seller_id IN ('${SELLER}','${DELSELLER}')`,
      // BEFORE the record: the intent references it, and this teardown runs
      // with session_replication_role = replica, so deleting the record
      // first does not raise -- it leaves an ORPHANED intent that the next
      // run finds open, returns as the standing quote, and points at a
      // collection_record id that no longer exists. Disabled FKs do not
      // remove the ordering, they remove the complaint about it.
      `DELETE FROM billing.purchase_intent WHERE subscription_id='${SUB}'`,
      `DELETE FROM billing.collection_record WHERE subscription_id='${SUB}'`,
      `DELETE FROM billing.subscription_state_transition WHERE subscription_id IN (SELECT id FROM billing.subscription WHERE seller_id IN ('${SELLER}','${DELSELLER}'))`,
      `DELETE FROM billing.subscription WHERE seller_id IN ('${SELLER}','${DELSELLER}')`,
      `DELETE FROM billing.price_schedule WHERE id='${PS_BUSINESS}'`,
      `DELETE FROM billing.tier_definition WHERE id='${TD_BUSINESS}'`,
      `DELETE FROM core.seller_team_member WHERE seller_id IN ('${SELLER}','${DELSELLER}')`,
      `DELETE FROM core.seller_courier WHERE seller_id IN ('${SELLER}','${DELSELLER}')`,
      // T7/D-67: this teardown runs under replica mode, which disables the
      // invite table's seller CASCADE and its two account FKs alike -- so
      // without this line every c6 run leaves an orphaned invite row
      // carrying a real phone number, which is exactly what migration
      // 0037's one-time cleanup deleted. The FKs cannot prevent the
      // recurrence; only this line does.
      `DELETE FROM core.seller_courier_invite WHERE seller_id IN ('${SELLER}','${DELSELLER}')`,
      `DELETE FROM core.product_variant WHERE seller_id IN ('${SELLER}','${DELSELLER}')`,
      `DELETE FROM core.product WHERE seller_id IN ('${SELLER}','${DELSELLER}')`,
      `DELETE FROM core.seller_eligibility_evaluation WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM core.review WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM core.media_lifecycle WHERE reason='SELLER_DELETED'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM core.seller WHERE market_id='${M}'`,
      `DELETE FROM core.account_recovery_case WHERE account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.step_up_challenge WHERE account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.session WHERE account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.account_device WHERE account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.otp_challenge WHERE phone_e164 LIKE '+2519114417%' OR phone_e164 LIKE '+2519114418%'`,
      `DELETE FROM core.idempotency_record WHERE actor_id::text LIKE 'cccc6666%' OR actor_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.buyer_profile WHERE account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.device WHERE account_id IN (SELECT id FROM core.account WHERE market_id='${M}') OR id='${DEVICE}'`,
      `DELETE FROM core.phone_reuse_block WHERE market_id='${M}'`,
      `DELETE FROM core.account WHERE market_id='${M}'`,
      `DELETE FROM core.ladder_config WHERE market_id='${M}'`,
      `DELETE FROM core.timing_config WHERE market_id='${M}'`,
      `DELETE FROM core.market WHERE id='${M}'`,
    ]) {
      await admin.query(q);
    }
    // The WEB devices /v1/bootstrap minted for this suite's browser sign-ins.
    // A bound one is already gone with its account above; an unbound one would
    // merely be purgeable, and "purgeable" is not "cleaned up" -- the residue
    // class T7 Phase 3 spent a commit on.
    if (webDevices.length) {
      await admin.query(`DELETE FROM core.device WHERE id = ANY($1::uuid[])`, [webDevices]);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await purgeRateBuckets();
    await admin.end();
    await app.close();
  });

  describe('the one-time code and identity creation (12.2, AUTH 4-5)', () => {
    let deviceId = '';
    let mobileToken = '';

    it('registers a device anonymously, then patches it', async () => {
      deviceId = randomUUID();
      await http()
        .post('/v1/devices')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', deviceId)
        .send({ id: deviceId, platform: 'ANDROID' })
        .expect(201);
      await bootDevice(deviceId);
      await http()
        .patch(`/v1/devices/${deviceId}`)
        .send({ notification_permission: 'GRANTED' })
        .expect(200);
      const r = await admin.query(`SELECT notification_permission FROM core.device WHERE id=$1`, [deviceId]);
      expect(r.rows[0].notification_permission).toBe('GRANTED');
    });

    it('request -> SMS -> verify creates the account, binds the device, mints MOBILE bearer', async () => {
      await http()
        .post('/v1/auth/otp/request')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', deviceId)
        .send({ phone: P_SIGNUP, purpose: 'SIGN_IN' })
        .expect(202);
      const r = await http()
        .post('/v1/auth/otp/verify')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', deviceId)
        .send({
          phone: P_SIGNUP,
          code: codeFor(P_SIGNUP),
          audience: 'MOBILE',
          device_id: deviceId,
          age_declared_over_18: true,
        })
        .expect(200);
      expect(r.body.token).toBeTruthy();
      expect(r.body.roles).toEqual([]);
      mobileToken = r.body.token;
      const acc = await admin.query(
        `SELECT a.id, a.age_declared_over_18, d.account_id
           FROM core.account a JOIN core.device d ON d.id=$2
          WHERE a.phone_e164=$1`,
        [P_SIGNUP, deviceId],
      );
      expect(acc.rows[0].age_declared_over_18).toBe(true);
      expect(acc.rows[0].account_id).toBe(acc.rows[0].id);
      // The minted session authenticates.
      await http()
        .get('/v1/auth/sessions')
        .set('Authorization', `Bearer ${mobileToken}`)
        .expect(200);
    });

    it('an idempotent replay of the request sends NO second SMS (X11)', async () => {
      const k = key();
      const before = sms.sent.length;
      // Two prior sends in this hour: a third fresh one is allowed (3/hour),
      // and its replay must not become a fourth.
      await admin.query(
        `UPDATE core.otp_challenge SET created_at = created_at - interval '16 minutes'
          WHERE phone_e164=$1`,
        [P_SIGNUP],
      );
      await http()
        .post('/v1/auth/otp/request')
        .set('Idempotency-Key', k)
        .set('X-Adulis-Device', deviceId)
        .send({ phone: P_SIGNUP, purpose: 'SIGN_IN' })
        .expect(202);
      expect(sms.sent.length).toBe(before + 1);
      const replay = await http()
        .post('/v1/auth/otp/request')
        .set('Idempotency-Key', k)
        .set('X-Adulis-Device', deviceId)
        .send({ phone: P_SIGNUP, purpose: 'SIGN_IN' })
        .expect(202);
      expect(replay.headers['x-adulis-idempotent-replay']).toBe('true');
      expect(sms.sent.length).toBe(before + 1);
    });

    it('identity creation without the age declaration is refused (AUTH 13)', async () => {
      const d = randomUUID();
      await http()
        .post('/v1/devices')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ id: d, platform: 'IOS' })
        .expect(201);
      await bootDevice(d);
      await http()
        .post('/v1/auth/otp/request')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ phone: P_RESEND, purpose: 'SIGN_IN' })
        .expect(202);
      const r = await http()
        .post('/v1/auth/otp/verify')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({
          phone: P_RESEND,
          code: codeFor(P_RESEND),
          audience: 'MOBILE',
          device_id: d,
        })
        .expect(400);
      expect(r.body.code).toBe('VALIDATION_FAILED');
    });

    it('a resend supersedes: the old code says expired-check-newer, the new one works', async () => {
      const d = randomUUID();
      await http()
        .post('/v1/devices')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ id: d, platform: 'ANDROID' })
        .expect(201);
      await bootDevice(d);
      const oldCode = codeFor(P_RESEND);
      // Step past the 30s resend backoff without waiting it out.
      await admin.query(
        `UPDATE core.otp_challenge SET created_at = created_at - interval '1 minute'
          WHERE phone_e164=$1`,
        [P_RESEND],
      );
      await http()
        .post('/v1/auth/otp/resend')
        // The device is what says which market's timing governs this code
        // before an account exists (T8 Phase 3). An app has one; this call
        // simply never sent it, and used to be carried by "some live market".
        .set('X-Adulis-Device', d)
        .send({ phone: P_RESEND, purpose: 'SIGN_IN' })
        .expect(202);
      const newCode = codeFor(P_RESEND);
      expect(newCode).not.toBe(oldCode);
      const stale = await http()
        .post('/v1/auth/otp/verify')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ phone: P_RESEND, code: oldCode, audience: 'MOBILE', device_id: d, age_declared_over_18: true })
        .expect(401);
      expect(stale.body.code).toBe('OTP_EXPIRED');
      expect(stale.body.title_key).toBe('error.auth.otp_expired');
      await http()
        .post('/v1/auth/otp/verify')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ phone: P_RESEND, code: newCode, audience: 'MOBILE', device_id: d, age_declared_over_18: true })
        .expect(200);
    });

    it('five wrong attempts kill the challenge; dead means dead (4.1)', async () => {
      const d = randomUUID();
      await http()
        .post('/v1/devices')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ id: d, platform: 'ANDROID' })
        .expect(201);
      await bootDevice(d);
      await http()
        .post('/v1/auth/otp/request')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ phone: P_ATTEMPTS, purpose: 'SIGN_IN' })
        .expect(202);
      const right = codeFor(P_ATTEMPTS);
      const wrong = right === '000000' ? '000001' : '000000';
      const verify = (code: string) =>
        http()
          .post('/v1/auth/otp/verify')
          .set('Idempotency-Key', key())
          .set('X-Adulis-Device', d)
          .send({ phone: P_ATTEMPTS, code, audience: 'MOBILE', device_id: d, age_declared_over_18: true });
      for (let i = 0; i < 4; i += 1) {
        const r = await verify(wrong).expect(401);
        expect(r.body.code).toBe('OTP_INVALID');
      }
      const fifth = await verify(wrong).expect(429);
      expect(fifth.body.code).toBe('OTP_ATTEMPTS_EXCEEDED');
      // Even the RIGHT code is refused now — no reset by trying harder.
      await verify(right).expect(429);
    });

    it('console verify sets the __Host cookie pair and never a body token (R17, S5.1)', async () => {
      const d = randomUUID();
      await http()
        .post('/v1/devices')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ id: d, platform: 'ANDROID' })
        .expect(201);
      await bootDevice(d);
      await http()
        .post('/v1/auth/otp/request')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ phone: P_OWNER, purpose: 'SIGN_IN' })
        .expect(202);
      const r = await http()
        .post('/v1/auth/otp/verify')
        .set('Idempotency-Key', key())
        .set('Cookie', await browserCookie())
        .set('X-Adulis-Client', 'web/9.9.9')
        .set('Origin', CONSOLE_ORIGIN)
        .send({
          phone: P_OWNER,
          code: codeFor(P_OWNER),
          audience: 'CONSOLE',
          remember_device: true,
        })
        .expect(200);
      expect(r.body.token).toBeUndefined();
      const setCookies = r.headers['set-cookie'] as unknown as string[];
      const sessionCookie = setCookies.find((c) => c.startsWith('__Host-adulis_session='));
      const deviceCookie = setCookies.find((c) => c.startsWith('__Host-adulis_device='));
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Strict');
      expect(deviceCookie).toBeTruthy();
      // Remembered lifetime: 7 days, not 12 hours.
      const token = (sessionCookie as string).split(';')[0]?.split('=')[1] as string;
      const row = await admin.query(
        `SELECT account_device_id, expires_at > now() + interval '13 hours' AS long
           FROM core.session WHERE id=$1`,
        [token],
      );
      expect(row.rows[0].account_device_id).toBeTruthy();
      expect(row.rows[0].long).toBe(true);
    });

    it('recovery answers 202 for known and unknown numbers alike (S22)', async () => {
      const d = randomUUID();
      await http()
        .post('/v1/auth/recovery')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ phone: P_BUYER, reason: 'SIM lost' })
        .expect(202);
      await http()
        .post('/v1/auth/recovery')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ phone: '+251911999999' })
        .expect(202);
      const cases = await admin.query(
        `SELECT count(*)::int AS n FROM core.account_recovery_case WHERE account_id=$1`,
        [BUYER],
      );
      expect(cases.rows[0].n).toBe(1);
    });
  });

  describe('sessions and step-up (AUTH 8-9)', () => {
    it('lists own sessions with a current flag; revokes one; a stranger id is 404', async () => {
      const list = await http()
        .get('/v1/auth/sessions')
        .set('Cookie', cookie(OWNER_S))
        .expect(200);
      const mine = list.body.data.find((s: { id: string }) => s.id === OWNER_S);
      expect(mine.current).toBe(true);
      await http()
        .delete(`/v1/auth/sessions/${BUYER_S}`)
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .expect(404);
      await http()
        .delete(`/v1/auth/sessions/${OWNER_S2}`)
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .expect(204);
      await http()
        .get('/v1/auth/sessions')
        .set('Cookie', cookie(OWNER_S2))
        .expect(401);
    });

    it('step-up request 403s on MOBILE (9.1); on console the SMS names the action (4.4)', async () => {
      await http()
        .post('/v1/auth/step-up/request')
        .set('Authorization', `Bearer ${OWNER_MOB_S}`)
        .set('X-Adulis-Device', DEVICE)
        .set('Idempotency-Key', key())
        .send({ action: 'REVOKE_ALL_SESSIONS' })
        .expect(403);
      const r = await http()
        .post('/v1/auth/step-up/request')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .send({ action: 'REVOKE_ALL_SESSIONS' })
        .expect(202);
      expect(r.body.challenge_id).toBeTruthy();
      const last = sms.lastTo(P_OWNER);
      expect(last?.templateKey).toBe('sms.otp.step_up.revoke_all_sessions');

      const verify = await http()
        .post('/v1/auth/step-up/verify')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .send({ challenge_id: r.body.challenge_id, code: last?.slots['code'] as string })
        .expect(200);
      expect(verify.body.satisfied_at).toBeTruthy();

      // revoke-others consumes it and ends every other session.
      const revoke = await http()
        .post('/v1/auth/sessions/revoke-others')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .send({ step_up_challenge_id: r.body.challenge_id })
        .expect(200);
      expect(revoke.body.revoked).toBeGreaterThan(0);
      await http()
        .get('/v1/auth/sessions')
        .set('Authorization', `Bearer ${OWNER_MOB_S}`)
        .expect(401);
      // Single use: the same challenge cannot authorise a second action.
      const again = await http()
        .post('/v1/auth/sessions/revoke-others')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .send({ step_up_challenge_id: r.body.challenge_id })
        .expect(403);
      expect(again.body.code).toBe('STEP_UP_REQUIRED');
    });
  });

  describe('team (12.12) and couriers (12.11)', () => {
    let member1Id = '';

    it('MOBILE cannot reach the team group even as the Owner (staff:admin is CONSOLE-only)', async () => {
      const r = await http()
        .get('/v1/seller/team')
        .set('Authorization', `Bearer ${await mintSession(OWNER, 'MOBILE')}`)
        .set('X-Adulis-Seller', SELLER)
        .expect(403);
      expect(r.body.code).toBe('PERMISSION_DENIED');
    });

    it('invites by phone with step-up; seats are the tier definition, and the cap holds', async () => {
      const invite = (phone: string, role: string, su: string) =>
        http()
          .post('/v1/seller/team')
          .set('Cookie', cookie(OWNER_S))
          .set('X-Adulis-Seller', SELLER)
          .set('Origin', CONSOLE_ORIGIN)
          .set('Idempotency-Key', key())
          .send({ phone, role, step_up_challenge_id: su });

      const unknown = await invite('+251911000000', 'ANALYST', await freshStepUp(OWNER, 'TEAM_CHANGE')).expect(404);
      expect(unknown.body.code).toBe('NOT_FOUND');

      const r1 = await invite(P_MEMBER1, 'ANALYST', await freshStepUp(OWNER, 'TEAM_CHANGE')).expect(201);
      member1Id = r1.body.id;
      await invite(P_MEMBER2, 'ADMIN', await freshStepUp(OWNER, 'TEAM_CHANGE')).expect(201);
      const capped = await invite('+251911441705', 'INVENTORY', await freshStepUp(OWNER, 'TEAM_CHANGE')).expect(409);
      expect(capped.body.code).toBe('TIER_LIMIT_REACHED');

      const list = await http()
        .get('/v1/seller/team')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      expect(list.body.data).toHaveLength(2);
      expect(list.body.seats).toMatchObject({ allowed: true, cap: 2 });
    });

    it('a seller with no Business tier gets TIER_LIMIT_REACHED, not a tier name', async () => {
      const r = await http()
        .post('/v1/seller/team')
        .set('Cookie', cookie(OWNER2_S))
        .set('X-Adulis-Seller', DELSELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .send({
          phone: P_MEMBER1,
          role: 'ANALYST',
          step_up_challenge_id: await freshStepUp(OWNER2, 'TEAM_CHANGE'),
        })
        .expect(409);
      expect(r.body.code).toBe('TIER_LIMIT_REACHED');
      expect(JSON.stringify(r.body)).not.toContain('BUSINESS');
    });

    it('an ANALYST reads orders until revocation; the NEXT request is refused (R28)', async () => {
      await http()
        .get('/v1/seller/orders')
        .set('Authorization', `Bearer ${MEMBER1_S}`)
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      await http()
        .delete(`/v1/seller/team/${member1Id}`)
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .send({ step_up_challenge_id: await freshStepUp(OWNER, 'TEAM_CHANGE') })
        .expect(204);
      const r = await http()
        .get('/v1/seller/orders')
        .set('Authorization', `Bearer ${MEMBER1_S}`)
        .set('X-Adulis-Seller', SELLER)
        .expect(403);
      expect(r.body.code).toBe('PERMISSION_DENIED');
    });

    it('courier invite, assignment, revocation: access ends in the same transaction', async () => {
      // An order to assign: buyer cart -> order through the API.
      await http()
        .post('/v1/cart/lines')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .set('Idempotency-Key', key())
        .send({ variant_id: VARIANT, quantity: 1 })
        .expect(201);
      const cart = await http()
        .get('/v1/cart')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .expect(200);
      const order = await http()
        .post('/v1/orders')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .set('Idempotency-Key', key())
        .send({ cart_id: cart.body.cart_id, expected: [{ variant_id: VARIANT, unit_price_minor: 50000 }] })
        .expect(201);

      const invited = await http()
        .post('/v1/seller/couriers')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .send({ phone: P_COURIER })
        .expect(201);
      await http()
        .post(`/v1/seller/orders/${order.body.id}/courier-assignment`)
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .send({ courier_account_id: COURIER_ACC })
        .expect(201);
      const seen = await http()
        .get('/v1/courier/orders')
        .set('Cookie', cookie(COURIER_S))
        .expect(200);
      expect(seen.body.data).toHaveLength(1);

      await http()
        .delete(`/v1/seller/couriers/${invited.body.id}`)
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .expect(204);
      const after = await http()
        .get('/v1/courier/orders')
        .set('Cookie', cookie(COURIER_S))
        .expect(200);
      expect(after.body.data).toHaveLength(0);

      // Settle the line so it never blocks the closure/deletion tests.
      await http()
        .post(`/v1/orders/${order.body.id}/cancel`)
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .set('Idempotency-Key', key())
        .expect(200);
    });

    it('a SALES_SUPPORT-less role cannot manage couriers', async () => {
      const r = await http()
        .post('/v1/seller/couriers')
        .set('Cookie', cookie(MEMBER1_CON_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .send({ phone: P_COURIER })
        .expect(403);
      expect(r.body.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('billing (12.12, R4)', () => {
    it('a MOBILE session receives 403 — never a redirect', async () => {
      const r = await http()
        .get('/v1/billing/subscription')
        .set('Authorization', `Bearer ${await mintSession(OWNER, 'MOBILE')}`)
        .set('X-Adulis-Seller', SELLER)
        .expect(403);
      expect(r.body.code).toBe('PERMISSION_DENIED');
      expect(r.headers['location']).toBeUndefined();
    });

    it('purchase-intent prices from the schedule with the term discount; mark-transferred stamps', async () => {
      const sub = await http()
        .get('/v1/billing/subscription')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      expect(sub.body.subscription).toMatchObject({ state: 'TRIAL', tier: 'BUSINESS' });

      const intent = await http()
        .post('/v1/billing/purchase-intent')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .send({
          tier: 'BUSINESS',
          term: 'ANNUAL',
          step_up_challenge_id: await freshStepUp(OWNER, 'SUBSCRIPTION_CHANGE'),
        })
        .expect(201);
      // 100000 x 12 months x (1 - 0.10 annual discount)
      expect(intent.body.amount_minor).toBe(1080000);
      expect(intent.body.currency).toBe('ETB');

      const marked = await http()
        .post('/v1/billing/mark-transferred')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .send({ collection_record_id: intent.body.collection_record_id })
        .expect(200);
      expect(marked.body.marked_transferred_at).toBeTruthy();
    });

    it('the wrong step-up action cannot open a purchase-intent', async () => {
      const r = await http()
        .post('/v1/billing/purchase-intent')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .send({
          tier: 'BUSINESS',
          term: 'MONTHLY',
          step_up_challenge_id: await freshStepUp(OWNER, 'TEAM_CHANGE'),
        })
        .expect(403);
      expect(r.body.code).toBe('STEP_UP_ACTION_MISMATCH');
    });
  });

  describe('closure and deletion (12.12, 12.18, S16.9)', () => {
    it('closure blocks NEW orders and is reversible; existing state is untouched', async () => {
      await http()
        .post('/v1/seller/closure')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .expect(200);

      await http()
        .post('/v1/cart/lines')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .set('Idempotency-Key', key())
        .send({ variant_id: VARIANT, quantity: 1 })
        .expect(201);
      const cart = await http()
        .get('/v1/cart')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .expect(200);
      const refused = await http()
        .post('/v1/orders')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .set('Idempotency-Key', key())
        .send({ cart_id: cart.body.cart_id, expected: [{ variant_id: VARIANT, unit_price_minor: 50000 }] })
        .expect(409);
      expect(JSON.stringify(refused.body.items ?? refused.body)).toContain('SELLER_UNAVAILABLE');

      await http()
        .delete('/v1/seller/closure')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .expect(204);
      const status = await admin.query(`SELECT status FROM core.seller WHERE id=$1`, [SELLER]);
      expect(status.rows[0].status).toBe('ACTIVE');
    });

    it('seller deletion: blocked with items[] while an obligation stands, and the rolled-back step-up survives for the retry', async () => {
      await admin.query(
        `INSERT INTO billing.subscription (seller_id, state, tier, term,
           current_period_start, current_period_end, locked_rate_minor,
           locked_rate_currency, price_schedule_version_id)
         VALUES ($1,'PAST_DUE','LISTED','MONTHLY', now() - interval '40 days',
                 now() - interval '10 days', 0,'ETB',$2)`,
        [DELSELLER, PS_BUSINESS],
      );

      const blockers = await http()
        .get('/v1/seller/deletion/blockers')
        .set('Cookie', cookie(OWNER2_S))
        .set('X-Adulis-Seller', DELSELLER)
        .expect(200);
      expect(blockers.body.items.map((i: { code: string }) => i.code)).toContain(
        'SUBSCRIPTION_PAST_DUE',
      );

      const su = await freshStepUp(OWNER2, 'SELLER_DELETION');
      const refused = await http()
        .post('/v1/seller/deletion')
        .set('Cookie', cookie(OWNER2_S))
        .set('X-Adulis-Seller', DELSELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .send({ step_up_challenge_id: su })
        .expect(409);
      expect(refused.body.code).toBe('DELETION_BLOCKED');
      expect(refused.body.items.length).toBeGreaterThan(0);

      // Clear the obligation; the SAME challenge works — its consumption
      // rolled back with the refused transaction (0023).
      await admin.query(
        `SET session_replication_role = replica;
         UPDATE billing.subscription SET state='CANCELLED' WHERE seller_id='${DELSELLER}';
         SET session_replication_role = DEFAULT`,
      );
      await http()
        .post('/v1/seller/deletion')
        .set('Cookie', cookie(OWNER2_S))
        .set('X-Adulis-Seller', DELSELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .send({ step_up_challenge_id: su })
        .expect(200);

      const s = await admin.query(
        `SELECT status, handle, store_name FROM core.seller WHERE id=$1`,
        [DELSELLER],
      );
      expect(s.rows[0].status).toBe('DELETED');
      expect(s.rows[0].handle).toMatch(/^deleted-/);
      const pd = await admin.query(
        `SELECT bank_code, account_last4 FROM core.payout_details WHERE seller_id=$1`,
        [DELSELLER],
      );
      expect(pd.rows[0]).toMatchObject({ bank_code: 'PURGED', account_last4: '0000' });
      const cred = await admin.query(
        `SELECT count(*)::int AS n FROM financial.payout_credential WHERE payout_details_id=$1`,
        [DELSELLER_PD],
      );
      expect(cred.rows[0].n).toBe(0);
      const block = await admin.query(
        `SELECT count(*)::int AS n FROM core.phone_reuse_block WHERE market_id=$1`,
        [M],
      );
      expect(block.rows[0].n).toBeGreaterThan(0);
    });

    it('the deleted number cannot open a NEW seller during the cooling period (S16.9)', async () => {
      const r = await http()
        .post('/v1/seller')
        .set('Cookie', cookie(OWNER2_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .send({ entity_type: 'INDIVIDUAL', store_name: 'Again', handle: 'c6-again' })
        .expect(409);
      expect(r.body.code).toBe('ELIGIBILITY_NOT_SATISFIED');
      expect(r.body.slots.reason).toBe('PHONE_REUSE_BLOCKED');
    });

    it('web deletion: ticket-only flow, money gate, release, scrub, phone freed (12.18)', async () => {
      // A fresh buyer through the real sign-up flow.
      const d = randomUUID();
      await http()
        .post('/v1/devices')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ id: d, platform: 'ANDROID' })
        .expect(201);
      await bootDevice(d);
      await http()
        .post('/v1/auth/otp/request')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ phone: P_WEBDEL, purpose: 'SIGN_IN' })
        .expect(202);
      const signin = await http()
        .post('/v1/auth/otp/verify')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ phone: P_WEBDEL, code: codeFor(P_WEBDEL), audience: 'MOBILE', device_id: d, age_declared_over_18: true })
        .expect(200);
      const bearer = signin.body.token as string;
      const accountId = signin.body.account_id as string;

      // T7 S3.4 (D-64 residual) -- a CONSOLE sign-in WITH remember_device,
      // so the deletion below has a real core.account_device row and a
      // session referencing it. Without this the account_device assertion
      // is vacuous: MOBILE sessions cannot carry one (CHECK
      // remembered_device_is_console), and the FK-unhook path in
      // fn_delete_account would go untested.
      await http()
        .post('/v1/auth/otp/request')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ phone: P_WEBDEL, purpose: 'SIGN_IN' })
        .expect(202);
      const consoleSignin = await http()
        .post('/v1/auth/otp/verify')
        .set('Idempotency-Key', key())
        .set('Cookie', await browserCookie())
        .set('X-Adulis-Client', 'web/9.9.9')
        .set('Origin', CONSOLE_ORIGIN)
        .send({
          phone: P_WEBDEL,
          code: codeFor(P_WEBDEL),
          audience: 'CONSOLE',
          remember_device: true,
        })
        .expect(200);
      expect(String(consoleSignin.headers['set-cookie'])).toContain('__Host-adulis_device');
      const remembered = await admin.query(
        `SELECT count(*)::int AS n FROM core.account_device WHERE account_id=$1`,
        [accountId],
      );
      expect(remembered.rows[0].n).toBe(1);

      // An order that will be RELEASED by deletion (still pre-payment).
      await http()
        .post('/v1/cart/lines')
        .set('Authorization', `Bearer ${bearer}`)
        .set('X-Adulis-Device', d)
        .set('Idempotency-Key', key())
        .send({ variant_id: VARIANT, quantity: 1 })
        .expect(201);
      const cart = await http()
        .get('/v1/cart')
        .set('Authorization', `Bearer ${bearer}`)
        .set('X-Adulis-Device', d)
        .expect(200);
      const order = await http()
        .post('/v1/orders')
        .set('Authorization', `Bearer ${bearer}`)
        .set('X-Adulis-Device', d)
        .set('Idempotency-Key', key())
        .send({ cart_id: cart.body.cart_id, expected: [{ variant_id: VARIANT, unit_price_minor: 50000 }] })
        .expect(201);

      // The deletion OTP mints a ticket, and the ticket is NOT a session.
      await http()
        .post('/v1/deletion/otp/request')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ phone: P_WEBDEL })
        .expect(202);
      expect(sms.lastTo(P_WEBDEL)?.templateKey).toBe('sms.otp.account_deletion');
      const verified = await http()
        .post('/v1/deletion/otp/verify')
        // Anonymous and phone-taking, so it identifies its device like every
        // other such call -- the check is what keeps the answer the same for
        // a known and an unknown number (ADU-AUTH-01 S22).
        .set('X-Adulis-Device', d)
        .send({ phone: P_WEBDEL, code: codeFor(P_WEBDEL) })
        .expect(200);
      const ticket = verified.body.ticket as string;
      await http()
        .get('/v1/orders')
        .set('Authorization', `Bearer ${ticket}`)
        .expect(401);

      // Money gate: with payment submitted, preview blocks and confirm 409s.
      await admin.query(
        `SET session_replication_role = replica;
         UPDATE core."order" SET state='PAYMENT_SUBMITTED' WHERE id='${order.body.id}';
         SET session_replication_role = DEFAULT`,
      );
      const blockedPreview = await http()
        .get('/v1/deletion/preview')
        .set('Authorization', `Ticket ${ticket}`)
        .expect(200);
      expect(
        blockedPreview.body.items.map((i: { code: string }) => i.code),
      ).toContain('BUYER_ORDERS_IN_PAYMENT');
      const refused = await http()
        .post('/v1/deletion/confirm')
        .set('Authorization', `Ticket ${ticket}`)
        .set('Idempotency-Key', key())
        .send({ acknowledge: true })
        .expect(409);
      expect(refused.body.code).toBe('DELETION_BLOCKED');

      await admin.query(
        `SET session_replication_role = replica;
         UPDATE core."order" SET state='CREATED' WHERE id='${order.body.id}';
         SET session_replication_role = DEFAULT`,
      );
      const preview = await http()
        .get('/v1/deletion/preview')
        .set('Authorization', `Ticket ${ticket}`)
        .expect(200);
      expect(preview.body.items).toHaveLength(0);
      expect(preview.body.effects.length).toBeGreaterThan(0);

      await http()
        .post('/v1/deletion/confirm')
        .set('Authorization', `Ticket ${ticket}`)
        .set('Idempotency-Key', key())
        .send({ acknowledge: true })
        .expect(200);

      // Scrubbed: the session is dead, the reservation released, the row
      // tombstoned — and the number is free for a brand-new account.
      await http()
        .get('/v1/orders')
        .set('Authorization', `Bearer ${bearer}`)
        .expect(401);
      const released = await admin.query(
        `SELECT r.state FROM core.reservation r WHERE r.order_id=$1`,
        [order.body.id],
      );
      expect(released.rows[0].state).toBe('CANCELLED_BY_BUYER');
      const scrubbed = await admin.query(
        `SELECT status, phone_e164, scrubbed_at FROM core.account WHERE id=$1`,
        [accountId],
      );
      expect(scrubbed.rows[0].status).toBe('SCRUBBED');
      expect(scrubbed.rows[0].phone_e164).toMatch(/^\+999/);
      expect(scrubbed.rows[0].scrubbed_at).toBeTruthy();

      // T7 S3.4 -- DIRECT SQL, not a 401: authenticate refuses a scrubbed
      // account's session by account status alone, so the HTTP assertion
      // above passes whether or not the rows were actually revoked. A
      // session belonging to a deleted account is a live credential for an
      // identity that no longer exists; a remembered-device row is worse --
      // it would outlive its account silently.
      const liveSessions = await admin.query(
        `SELECT count(*)::int AS n FROM core.session
          WHERE account_id=$1 AND revoked_at IS NULL`,
        [accountId],
      );
      expect(liveSessions.rows[0].n).toBe(0);
      const deviceRows = await admin.query(
        `SELECT count(*)::int AS n FROM core.account_device WHERE account_id=$1`,
        [accountId],
      );
      // REMOVED, not revoked (D-64 residual): zero rows, not stamped rows.
      expect(deviceRows.rows[0].n).toBe(0);

      await http()
        .post('/v1/auth/otp/request')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ phone: P_WEBDEL, purpose: 'SIGN_IN' })
        .expect(202);
      const again = await http()
        .post('/v1/auth/otp/verify')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', d)
        .send({ phone: P_WEBDEL, code: codeFor(P_WEBDEL), audience: 'MOBILE', device_id: d, age_declared_over_18: true })
        .expect(200);
      expect(again.body.account_id).not.toBe(accountId);
    });
  });
});
