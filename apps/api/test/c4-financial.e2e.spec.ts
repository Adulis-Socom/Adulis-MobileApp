import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import {
  FakeFinancialStorageAdapter,
  FINANCIAL_STORAGE_ADAPTER,
} from '../src/modules/financial/financial-storage.adapter';
import { payoutActivateDue } from '../src/jobs/e5-transport-ledger';
import { createJobHarness } from './jobs-harness';

/**
 * C4 — the financial boundary, end to end: the payout write path with every
 * S10.4 control, the R15 decrypt-in-the-API instructions read, R18 framed
 * evidence in and out (byte-identical through encrypt-store-decrypt), the
 * logged evidence read, and single-order reissue.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = 'aaaa1111-2222-4000-8000-000000000001';
const OWNER = 'aaaa1111-2222-4000-8000-000000000002';
const BUYER = 'aaaa1111-2222-4000-8000-000000000003';
const STRANGER = 'aaaa1111-2222-4000-8000-000000000004';
const DEVICE = 'aaaa1111-2222-4000-8000-000000000005';
const NEW_DEVICE = 'aaaa1111-2222-4000-8000-000000000006';
const SELLER = 'aaaa1111-2222-4000-8000-000000000007';
const OWNER_S = 'aaaa1111-2222-4000-8000-000000000008';
const BUYER_S = 'aaaa1111-2222-4000-8000-000000000009';
const STRANGER_S = 'aaaa1111-2222-4000-8000-00000000000a';
const OWNER_NEWDEV_S = 'aaaa1111-2222-4000-8000-00000000000b';
const PRODUCT = 'aaaa1111-2222-4000-8000-00000000000c';
const VARIANT = 'aaaa1111-2222-4000-8000-00000000000d';
const OTP = 'aaaa1111-2222-4000-8000-00000000000e';
const SU_PAYOUT = 'aaaa1111-2222-4000-8000-00000000000f';
const SU_REISSUE = 'aaaa1111-2222-4000-8000-000000000010';
/**
 * A SELLER THAT EXISTS ONLY TO BE SWEPT (T21 S1). The payout job is global --
 * it activates every due seller in the database -- so the row it operates on
 * must be one no other test in this file reads. SELLER's row cannot be it: the
 * order, evidence and reissue arms all need SELLER's ACTIVE payout to keep its
 * credential, and an activation would supersede it with a credential-less row.
 */
const SELLER_SWEEP = 'aaaa1111-2222-4000-8000-000000000011';
const PD_SWEEP = 'aaaa1111-2222-4000-8000-000000000012';

const ACCOUNT_NUMBER = '1000123456789';
const storage = new FakeFinancialStorageAdapter();

@Module({ imports: [AppModule] })
class C4AppModule {}

describe('C4 — the financial boundary', () => {
  let app: INestApplication;
  let admin: Pool;
  let orderId = '';

  const cookie = (t: string) => `__Host-adulis_session=${t}`;
  const key = () => randomUUID();
  const freshStepUp = async (action: string): Promise<string> => {
    const id = randomUUID();
    await admin.query(
      `INSERT INTO core.step_up_challenge
         (id, account_id, action, otp_challenge_id, satisfied_at, expires_at)
       VALUES ($1, $2, $3::core.step_up_action, $4, now(), now() + interval '1 hour')`,
      [id, OWNER, action, OTP],
    );
    return id;
  };
  const sellerReq = (method: 'post' | 'get' | 'delete', path: string, token = OWNER_S) => {
    const r = request(app.getHttpServer())[method](path)
      .set('Cookie', cookie(token))
      .set('X-Adulis-Seller', SELLER);
    if (method !== 'get') r.set('Origin', CONSOLE_ORIGIN);
    if (method === 'post') r.set('Idempotency-Key', key());
    return r;
  };
  const buyerPost = (path: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${BUYER_S}`)
      .set('X-Adulis-Device', DEVICE)
      .set('Idempotency-Key', key());

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'C4E','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en', 'ACTIVE', true, 'AFROMESSAGE')`,
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
         0.01,0.05,0.25,0.5,'60 days',10,50000000,'30 days',3)`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251911221001',$4,'ACTIVE'), ($2,'+251911221002',$4,'ACTIVE'),
        ($3,'+251911221003',$4,'ACTIVE')`,
      [OWNER, BUYER, STRANGER, M],
    );
    await admin.query(
      `INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID'), ($2,'ANDROID')`,
      [DEVICE, NEW_DEVICE],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','C4 Store','c4-store','ACTIVE')`,
      [SELLER, M, OWNER],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor,
         base_price_currency, visibility)
       VALUES ($1,$2,$3,'Scarf',145000,'ETB','PUBLISHED')`,
      [PRODUCT, SELLER, M],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
         price_currency, variant_key)
       VALUES ($1,$2,$3,145000,'ETB','red')`,
      [VARIANT, PRODUCT, SELLER],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       VALUES (gen_random_uuid(),$1,$2,10,'SELLER_SET')`,
      [VARIANT, SELLER],
    );
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at, created_at) VALUES
        ($1,$5,'CONSOLE',$4, now()+interval '12 hours', now()-interval '3 days'),
        ($2,$6,'MOBILE',$4, now()+interval '30 days', now()-interval '3 days'),
        ($3,$7,'MOBILE',$4, now()+interval '30 days', now()-interval '3 days'),
        ($8,$5,'CONSOLE',$9, now()+interval '12 hours', now())`,
      [OWNER_S, BUYER_S, STRANGER_S, DEVICE, OWNER, BUYER, STRANGER,
       OWNER_NEWDEV_S, NEW_DEVICE],
    );
    await admin.query(
      `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash, expires_at, consumed_at, step_up_action)
       VALUES ($1,'STEP_UP','+251911221001', decode('00','hex'), now()+interval '1 hour', now(), 'PAYOUT_CHANGE')`,
      [OTP],
    );
    await admin.query(
      `INSERT INTO core.step_up_challenge (id, account_id, action, otp_challenge_id, satisfied_at, expires_at) VALUES
        ($1,$3,'PAYOUT_CHANGE',$4, now(), now()+interval '1 hour'),
        ($2,$3,'REISSUE_INSTRUCTIONS',$4, now(), now()+interval '1 hour')`,
      [SU_PAYOUT, SU_REISSUE, OWNER, OTP],
    );

    // The sweep-only seller and its one due PENDING row, LAST because a PENDING
    // row needs a step-up challenge to point at: 0012's
    // `payout_pending_requires_step_up` makes step_up_challenge_id NOT NULL on
    // any row entering PENDING (13.4), so this cannot be inserted before the
    // challenges above exist. No ACTIVE row for this seller, so activating it
    // supersedes nothing and no credential is touched.
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','C4 Sweep Store','c4-sweep-store','ACTIVE')`,
      [SELLER_SWEEP, M, OWNER],
    );
    await admin.query(
      `INSERT INTO core.payout_details (id, seller_id, bank_code, account_last4,
         state, requested_at, activates_at, requested_by_account_id, step_up_challenge_id)
       VALUES ($1,$2,'CBE','9911','PENDING', now() - interval '25 hours',
               now() - interval '1 hour', $3, $4)`,
      [PD_SWEEP, SELLER_SWEEP, OWNER, SU_PAYOUT],
    );

    const moduleRef = await Test.createTestingModule({ imports: [C4AppModule] })
      .overrideProvider(FINANCIAL_STORAGE_ADAPTER)
      .useValue(storage)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id::text LIKE 'aaaa1111%'`,
      `DELETE FROM financial.access_log WHERE actor_account_id IN ('${OWNER}','${BUYER}','${STRANGER}')`,
      `DELETE FROM financial.payment_evidence WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.payment_instruction_reissue WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.payment_submission WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.reservation WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.order_state_transition WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core."order" WHERE market_id='${M}'`,
      `DELETE FROM core.order_payout_snapshot WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.cart_line WHERE cart_id IN (SELECT id FROM core.cart WHERE market_id='${M}')`,
      `DELETE FROM core.cart WHERE market_id='${M}'`,
      `DELETE FROM core.stock_event WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.product_variant WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.product WHERE market_id='${M}'`,
      `DELETE FROM financial.payout_credential WHERE payout_details_id IN (SELECT id FROM core.payout_details WHERE seller_id='${SELLER}')`,
      `DELETE FROM core.payout_change_log WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.payout_details WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.step_up_challenge WHERE account_id='${OWNER}'`,
      `DELETE FROM core.otp_challenge WHERE id='${OTP}'`,
      `DELETE FROM core.account_recovery_case WHERE account_id='${OWNER}'`,
      `DELETE FROM core.payout_change_log WHERE seller_id='${SELLER_SWEEP}'`,
      `DELETE FROM core.payout_details WHERE seller_id='${SELLER_SWEEP}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN ('${SELLER}','${SELLER_SWEEP}')`,
      `DELETE FROM core.seller WHERE id IN ('${SELLER}','${SELLER_SWEEP}')`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER}','${BUYER}','${STRANGER}')`,
      `DELETE FROM core.session WHERE account_id IN ('${OWNER}','${BUYER}','${STRANGER}')`,
      `DELETE FROM core.device WHERE id IN ('${DEVICE}','${NEW_DEVICE}')`,
      `DELETE FROM core.account WHERE market_id='${M}'`,
      `DELETE FROM core.ladder_config WHERE market_id='${M}'`,
      `DELETE FROM core.timing_config WHERE market_id='${M}'`,
      `DELETE FROM core.market WHERE id='${M}'`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  describe('the payout write path — every S10.4 control', () => {
    it('GET shows no lock for an aged device with no recovery (proactive panel, v1.9 S15.0c)', async () => {
      // Runs before any recovery case is planted below: the aged-device OWNER
      // is unlocked, so the panel draws nothing and a write would succeed.
      const r = await sellerReq('get', '/v1/seller/payout').expect(200);
      expect(r.body.reason).toBeNull();
      expect(r.body.payout_locked_until).toBeNull();
    });

    /*
     * T18 PHASE 4 -- THE NEW-DEVICE LOCK HAS A SUBJECT.
     *
     * "The lock exists to stop an attacker redirecting payments after a
     * takeover. On a brand-new account there is nothing to redirect."
     *
     * BOTH ARMS ARE TESTED AND THE SECOND IS THE ONE THAT MATTERS: a fix that
     * removed the lock outright would pass the first arm alone, so the second
     * plants an ACTIVE destination and requires the refusal to stand. They run
     * in this order deliberately -- the first arm proves the seller can get a
     * destination at all, which is the precondition the second one needs.
     */
    it('a FIRST SET from a new device is NOT locked -- the lock has no subject (T18 P4)', async () => {
      const pre = await admin.query(
        `SELECT count(*)::int AS n FROM core.payout_details
          WHERE seller_id=$1 AND state='ACTIVE'`,
        [SELLER],
      );
      expect(pre.rows[0].n).toBe(0);

      // The panel must agree with the write path BEFORE the write, or SC-24
      // draws a lock the server would not raise. Same rows, same predicate.
      const before = await sellerReq('get', '/v1/seller/payout', OWNER_NEWDEV_S).expect(200);
      expect(before.body.reason).toBeNull();
      expect(before.body.payout_locked_until).toBeNull();

      const r = await sellerReq('post', '/v1/seller/payout', OWNER_NEWDEV_S)
        .send({
          bank_code: 'CBE',
          account_number: ACCOUNT_NUMBER,
          account_name: 'Naod Solomon',
          step_up_challenge_id: await freshStepUp('PAYOUT_CHANGE'),
        })
        .expect(201);
      expect(r.body.state).toBe('PENDING');

      // AND THE LOCK ARMS ITSELF THE MOMENT THERE IS SOMETHING TO PROTECT.
      // One request later the same seller on the same new device is locked,
      // because they now have payout details. The carve-out is a property of
      // the seller's history, not a property of the device or the session.
      const after = await sellerReq('get', '/v1/seller/payout', OWNER_NEWDEV_S).expect(200);
      expect(after.body.reason).toBe('NEW_DEVICE');

      // The activation delay STILL applies -- the lock's subject narrowed, the
      // delay did not move. Even an accepted first set cannot be paid today.
      expect(new Date(r.body.activates_at).getTime()).toBeGreaterThan(Date.now());

      await admin.query(
        `DELETE FROM financial.payout_credential WHERE payout_details_id=$1`,
        [r.body.payout_details_id],
      );
      await admin.query(`DELETE FROM core.payout_details WHERE id=$1`, [r.body.payout_details_id]);
    });

    it('a CHANGE from a new device is STILL LOCKED -- the arm that matters (T18 P4)', async () => {
      // Plant an ACTIVE destination: now there IS something to redirect, which
      // is the entire situation S7.2 was written for.
      const activeId = randomUUID();
      await admin.query(
        `INSERT INTO core.payout_details
           (id, seller_id, bank_code, account_last4, state,
            requested_by_account_id, activated_at)
         VALUES ($1,$2,'CBE','4821','ACTIVE',$3, now())`,
        [activeId, SELLER, OWNER],
      );

      const r = await sellerReq('post', '/v1/seller/payout', OWNER_NEWDEV_S)
        .send({
          bank_code: 'AWASH',
          account_number: '2000999888777',
          account_name: 'Naod Solomon',
          step_up_challenge_id: await freshStepUp('PAYOUT_CHANGE'),
        })
        .expect(409);
      // ONE cause-neutral code (v1.9 S15.0c / D-224.6); the cause is the slot.
      expect(r.body.code).toBe('PAYOUT_LOCKED');
      expect(r.body.slots.reason).toBe('NEW_DEVICE');

      // v1.9 S15.0c: the SAME lock the write path discovers on a 409, the GET
      // draws PROACTIVELY -- same reason vocabulary, plus the lift horizon.
      const g = await sellerReq('get', '/v1/seller/payout', OWNER_NEWDEV_S).expect(200);
      expect(g.body.reason).toBe('NEW_DEVICE');
      expect(g.body.payout_locked_until).toBeTruthy();
      expect(new Date(g.body.payout_locked_until).getTime()).toBeGreaterThan(Date.now());

      // And no row was written by the refused attempt.
      const rows = await admin.query(
        `SELECT count(*)::int AS n FROM core.payout_details
          WHERE seller_id=$1 AND state='PENDING'`,
        [SELLER],
      );
      expect(rows.rows[0].n).toBe(0);

      await admin.query(`DELETE FROM core.payout_details WHERE id=$1`, [activeId]);
    });

    it('CANCEL-THEN-SET does not walk through the carve-out (T18 P4, adversarial)', async () => {
      /*
       * THE ATTACK THE FIRST DRAFT OF 0047 WAS OPEN TO, and the reason its
       * predicate is "has never had a payout row" rather than "has no ACTIVE
       * row".
       *
       * core.fn_cancel_payout_change requires NO step-up and checks NO lock --
       * deliberately, because "reverting must always be easier than changing".
       * So an attacker on a device we have never seen can cancel a seller's
       * legitimate PENDING first set for free, leaving no ACTIVE and no PENDING
       * row. Under an ACTIVE-only carve-out the state then looks exactly like a
       * brand-new seller's, and the attacker sets their own bank account
       * unlocked -- 24 hours earlier than the design's stated floor.
       *
       * A CANCELLED row is still a row. This proves the lock returns.
       */
      // The seller sets payout legitimately (aged device), then it is cancelled.
      const first = await sellerReq('post', '/v1/seller/payout')
        .send({
          bank_code: 'CBE',
          account_number: ACCOUNT_NUMBER,
          account_name: 'Naod Solomon',
          step_up_challenge_id: await freshStepUp('PAYOUT_CHANGE'),
        })
        .expect(201);
      await sellerReq('delete', '/v1/seller/payout/pending').expect(204);

      const state = await admin.query(
        `SELECT count(*) FILTER (WHERE state='ACTIVE')::int AS act,
                count(*) FILTER (WHERE state='PENDING')::int AS pend,
                count(*)::int AS ever
           FROM core.payout_details WHERE seller_id=$1`,
        [SELLER],
      );
      // The state an ACTIVE-only carve-out would have mistaken for a new seller.
      expect(state.rows[0].act).toBe(0);
      expect(state.rows[0].pend).toBe(0);
      expect(state.rows[0].ever).toBeGreaterThan(0);

      const r = await sellerReq('post', '/v1/seller/payout', OWNER_NEWDEV_S)
        .send({
          bank_code: 'AWASH',
          account_number: '2000999888777',
          account_name: 'Not The Seller',
          step_up_challenge_id: await freshStepUp('PAYOUT_CHANGE'),
        })
        .expect(409);
      expect(r.body.code).toBe('PAYOUT_LOCKED');
      expect(r.body.slots.reason).toBe('NEW_DEVICE');

      // And the panel says the same thing, from the same rows.
      const g = await sellerReq('get', '/v1/seller/payout', OWNER_NEWDEV_S).expect(200);
      expect(g.body.reason).toBe('NEW_DEVICE');

      await admin.query(
        `DELETE FROM financial.payout_credential WHERE payout_details_id=$1`,
        [first.body.payout_details_id],
      );
      await admin.query(`DELETE FROM core.payout_details WHERE seller_id=$1`, [SELLER]);
    });

    it('a PENDING change is refused as PENDING, not as a device (T18 P4 guard order)', async () => {
      // One-pending-per-seller moved ABOVE the new-device lock, so a seller with
      // a change in flight is told THAT, which is the true and more useful
      // answer. Both are refusals and neither writes, so nothing is weakened.
      const first = await sellerReq('post', '/v1/seller/payout')
        .send({
          bank_code: 'CBE',
          account_number: ACCOUNT_NUMBER,
          account_name: 'Naod Solomon',
          step_up_challenge_id: await freshStepUp('PAYOUT_CHANGE'),
        })
        .expect(201);

      const r = await sellerReq('post', '/v1/seller/payout', OWNER_NEWDEV_S)
        .send({
          bank_code: 'AWASH',
          account_number: '2000999888777',
          account_name: 'Naod Solomon',
          step_up_challenge_id: await freshStepUp('PAYOUT_CHANGE'),
        })
        .expect(409);
      expect(r.body.code).toBe('PAYOUT_CHANGE_PENDING');

      await admin.query(
        `DELETE FROM financial.payout_credential WHERE payout_details_id=$1`,
        [first.body.payout_details_id],
      );
      await admin.query(`DELETE FROM core.payout_details WHERE seller_id=$1`, [SELLER]);
    });

    it('the OTHER locks are unaltered: recovery cooling fires with no ACTIVE row (T18 P4)', async () => {
      // The first-set carve-out is narrow ON PURPOSE. RECOVERY_COOLING is
      // checked BEFORE the new-device guard and knows nothing about ACTIVE
      // rows, so a first set cannot be used as a way around an account that is
      // under recovery. Asserted, because "everything else stands unaltered"
      // is the kind of claim that decays quietly.
      await admin.query(
        `INSERT INTO core.account_recovery_case
           (id, account_id, payout_locked_until)
         VALUES ($1,$2, now() + interval '7 days')`,
        [randomUUID(), OWNER],
      );
      try {
        const r = await sellerReq('post', '/v1/seller/payout', OWNER_NEWDEV_S)
          .send({
            bank_code: 'CBE',
            account_number: ACCOUNT_NUMBER,
            account_name: 'Naod Solomon',
            step_up_challenge_id: await freshStepUp('PAYOUT_CHANGE'),
          })
          .expect(409);
        expect(r.body.slots.reason).toBe('RECOVERY_COOLING');
      } finally {
        // core.account_recovery_case is APPEND-ONLY (a trigger refuses DELETE),
        // which is correct for a record of who recovered whose account -- so the
        // teardown suspends triggers for the one statement rather than pretending
        // the table is ordinary. Same technique the claim-evidence teardown uses.
        // Without this the case survives, and every later payout test in this
        // file fails with RECOVERY_COOLING instead of what it asserts.
        await admin.query(`SET session_replication_role = replica`);
        await admin.query(`DELETE FROM core.account_recovery_case WHERE account_id=$1`, [OWNER]);
        await admin.query(`SET session_replication_role = DEFAULT`);
      }
    });


    it('with step-up, an aged device and no locks: PENDING + delay + log + ciphertext', async () => {
      const startedAt = new Date();
      const r = await sellerReq('post', '/v1/seller/payout')
        .send({
          bank_code: 'CBE',
          account_number: ACCOUNT_NUMBER,
          account_name: 'Naod Solomon',
          step_up_challenge_id: SU_PAYOUT,
        })
        .expect(201);
      expect(r.body.state).toBe('PENDING');
      const log = await admin.query(
        `SELECT outcome, device_id FROM core.payout_change_log
          WHERE seller_id=$1 ORDER BY occurred_at DESC LIMIT 1`,
        [SELLER],
      );
      expect(log.rows[0]).toMatchObject({ outcome: 'REQUESTED', device_id: DEVICE });
      const cred = await admin.query(
        `SELECT octet_length(account_ciphertext) AS n FROM financial.payout_credential
          WHERE payout_details_id=$1`,
        [r.body.payout_details_id],
      );
      expect(cred.rows[0].n).toBeGreaterThan(ACCOUNT_NUMBER.length);
      // A DELTA, not a running total. This used to be a global count with
      // toBeGreaterThan(0), which any earlier arm that sets payout satisfies
      // in advance -- so the assertion could no longer fail. Scope it to the
      // row this arm created.
      const notices = await admin.query(
        // SCOPED BY RECIPIENT AS WELL AS BY TIME (T22, D-273). The previous
        // narrowing was by time ALONE, which still counts every seller's
        // PAYOUT_CHANGE_REQUESTED row in the database inside the window.
        // NOTE: this does NOT explain D-261/D-266's observed red -- another
        // suite ADDING rows can only make `toBeGreaterThan(0)` pass, and no
        // unscoped delete of core.notification exists anywhere in the suite.
        // The unscoped read is a real defect (it can produce a FALSE GREEN)
        // and is fixed here; the red remains undiagnosed and is NOT fitted to
        // this theory to make the answer tidy.
        `SELECT count(*)::int AS n FROM core.notification
          WHERE template_key='PAYOUT_CHANGE_REQUESTED' AND NOT suppressible
            AND scheduled_for >= $1 AND recipient_account_id = $2`,
        [startedAt, OWNER],
      );
      // D-261 / D-266 / D-273: THIS ARM STILL FLAKES, ABOUT ONCE IN TEN FULL
      // RUNS, AND NOBODY HAS DIAGNOSED IT ACROSS THREE ORDERS. Scoping the read
      // (above) cannot have fixed it -- an unscoped read can only produce a
      // false GREEN -- and T22 measured it surviving: 9 of 10 runs green, the
      // tenth red here and nowhere else.
      //
      // So the next red is made to explain itself. The two hypotheses have
      // different fingerprints and this tells them apart:
      //
      //   rows exist, ALL scheduled_for < startedAt  -> a clock/window problem:
      //       the row WAS written and the predicate excluded it
      //   no rows at all for this seller, ever       -> the INSERT wrote
      //       nothing. core.fn_notify_payout_change is an INSERT..SELECT that
      //       JOINs core.market; an empty SELECT inserts nothing and raises
      //       nothing, which is exactly the shape T20 found in the device seed
      //       and D-266 named as the remaining candidate.
      if (notices.rows[0].n === 0) {
        const forensics = await admin.query(
          `SELECT scheduled_for, template_key, suppressible
             FROM core.notification
            WHERE recipient_account_id = $1
            ORDER BY scheduled_for DESC LIMIT 10`,
          [OWNER],
        );
        const pgNow = (await admin.query(`SELECT now() AS n, clock_timestamp() AS c`)).rows[0];
        throw new Error(
          'D-261/D-266/D-273 reproduced. No PAYOUT_CHANGE_REQUESTED for this owner at or after ' +
            `${startedAt.toISOString()}. Rows that DO exist for the owner: ` +
            JSON.stringify(forensics.rows) +
            ` | postgres now()=${String(pgNow.n)} clock_timestamp()=${String(pgNow.c)}` +
            ` | node Date.now()=${new Date().toISOString()}`,
        );
      }
      expect(notices.rows[0].n).toBeGreaterThan(0);
    });

    it('a second request while one is pending is 409 PAYOUT_CHANGE_PENDING', async () => {
      const r = await sellerReq('post', '/v1/seller/payout')
        .send({
          bank_code: 'CBE',
          account_number: '2000999888777',
          account_name: 'Naod Solomon',
          step_up_challenge_id: await freshStepUp('PAYOUT_CHANGE'),
        })
        .expect(409);
      expect(r.body.code).toBe('PAYOUT_CHANGE_PENDING');
    });

    /**
     * T21 S1 (D-268) SPLIT THE OLD SINGLE TEST INTO THREE, because the old one
     * asserted the thing that was just removed. It read
     * "activation on the due date: prior superseded, log written, GET shows
     * active" and it drove the activation THROUGH THE GET -- which was also,
     * silently, the only producer of an ACTIVE payout row in this whole file.
     * Deleting it would have taken order creation, evidence and reissue with
     * it (core.fn_create_order raises restrict_violation with no ACTIVE row)
     * and left `fn_activate_due_payout` with no behavioural coverage anywhere
     * in the repository -- the three existing job references assert only that
     * its NAME is registered.
     */

    it('the GET does NOT activate a due change -- the read that wrote is gone (T21 S1, D-268)', async () => {
      await admin.query(
        `UPDATE core.payout_details SET activates_at = now() - interval '1 minute'
          WHERE seller_id=$1 AND state='PENDING'`,
        [SELLER],
      );
      const logsBefore = await admin.query(
        `SELECT count(*)::int AS n FROM core.payout_change_log
          WHERE seller_id=$1 AND outcome='ACTIVATED'`,
        [SELLER],
      );

      // Read it twice. Under the old code the FIRST of these activated the row.
      await sellerReq('get', '/v1/seller/payout').expect(200);
      const r = await sellerReq('get', '/v1/seller/payout').expect(200);

      // THIS IS THE ARM THAT GOES RED IF THE LAZY CALL EVER COMES BACK.
      expect(r.body.pending).not.toBeNull();
      expect(r.body.pending.account_last4).toBe(ACCOUNT_NUMBER.slice(-4));
      const logsAfter = await admin.query(
        `SELECT count(*)::int AS n FROM core.payout_change_log
          WHERE seller_id=$1 AND outcome='ACTIVATED'`,
        [SELLER],
      );
      expect(logsAfter.rows[0].n).toBe(logsBefore.rows[0].n);
    });

    it('a failing GET rolls back nothing, because there is nothing to roll back (D-268)', async () => {
      // Force a REAL failure INSIDE the handler transaction, at a point AFTER
      // the one the activation used to occupy: payoutLockState's `rec` CTE
      // reads core.account_recovery_case, which nothing else on this request
      // path touches. This is D-74's exact shape -- a handler that raises
      // after the top of its own transaction -- and the point of the ruling is
      // that there is no longer a write above it to lose.
      await admin.query(`REVOKE SELECT ON core.account_recovery_case FROM adulis_app`);
      try {
        await sellerReq('get', '/v1/seller/payout').expect(500);
      } finally {
        await admin.query(`GRANT SELECT ON core.account_recovery_case TO adulis_app`);
      }

      // The due row is untouched: not activated, not damaged, not logged.
      const still = await admin.query(
        `SELECT state::text AS state FROM core.payout_details
          WHERE seller_id=$1 AND state='PENDING'`,
        [SELLER],
      );
      expect(still.rows).toHaveLength(1);

      // And it is still activatable -- the failure cost the row nothing.
      const ok = await sellerReq('get', '/v1/seller/payout').expect(200);
      expect(ok.body.pending).not.toBeNull();
    });

    it('activation on the due date: prior superseded, log written, GET shows active', async () => {
      // PER SELLER, NOT THE FLEET SWEEP. `payout.activate_due` is global -- it
      // activates every due seller in the database -- and running it from here
      // put a second suite's global sweep into a parallel jest worker, which is
      // D-83's registered flake ("exactly one suite may own a global sweep")
      // and it fired: c4's teardown moved inside E4's before/after window and
      // E4's fleet-wide payout_credential count went 2 -> 1 for reasons that
      // had nothing to do with the evidence purge it was testing.
      //
      // So this calls the same SECURITY DEFINER function the job calls, for
      // THIS seller only, and the job's own run() is covered where global
      // sweeps already live: e2-e6.jobs.spec.ts, E5.
      const activated = await admin.query(
        `SELECT core.fn_activate_due_payout($1) AS did`,
        [SELLER],
      );
      expect(activated.rows[0].did).toBe(true);

      const r = await sellerReq('get', '/v1/seller/payout').expect(200);
      expect(r.body.active.account_last4).toBe(ACCOUNT_NUMBER.slice(-4));
      expect(r.body.pending).toBeNull();
      const hist = await sellerReq('get', '/v1/seller/payout/history').expect(200);
      expect(hist.body.data.map((x: { outcome: string }) => x.outcome)).toContain('ACTIVATED');
    });

    /**
     * THE JOB, ACTUALLY RUN -- and the test that found D-270.
     *
     * `payout.activate_due` shipped in T20 with three tests, all of which
     * assert only that its NAME is registered and scheduled. Nothing ever
     * called run(). The first time anything did, it raised
     * `permission denied for table payout_details`: 0022 gave adulis_jobs
     * EXECUTE on the SECURITY DEFINER function but no SELECT on the table the
     * job reads to FIND its work, and that read is the job's first statement,
     * outside the per-seller try/catch. The job had never activated anything.
     *
     * It stayed invisible because the lazy call this order removes was doing
     * the work -- the defect masked by the defect. Migration 0049 supplies the
     * grant; this arm is why it was ever noticed, and it goes red again if the
     * grant is ever dropped.
     *
     * The harness connects as adulis_jobs. Running it as the admin role would
     * certify the grant green without testing it (apps/api/CLAUDE.md).
     */
    it('the JOB activates a due change with no read at all, as adulis_jobs (T21 S1, D-270)', async () => {
      const before = await admin.query(
        `SELECT state::text AS state FROM core.payout_details WHERE id=$1`,
        [PD_SWEEP],
      );
      expect(before.rows[0].state).toBe('PENDING');

      const h = createJobHarness(new Date());
      let result: Record<string, unknown>;
      try {
        result = (await payoutActivateDue.run(h.ctx)) as Record<string, unknown>;
      } finally {
        await h.close();
      }
      // The sweep is fleet-wide, so `due` and `activated` are not this
      // seller's alone and are asserted only as lower bounds. `raised` is the
      // D-270 guard proper: without the grant the job throws before this.
      expect(Number(result['due'])).toBeGreaterThanOrEqual(1);
      expect(Number(result['activated'])).toBeGreaterThanOrEqual(1);
      expect(Number(result['raised'])).toBe(0);

      const after = await admin.query(
        `SELECT state::text AS state, activated_at FROM core.payout_details WHERE id=$1`,
        [PD_SWEEP],
      );
      expect(after.rows[0].state).toBe('ACTIVE');
      expect(after.rows[0].activated_at).not.toBeNull();

      const log = await admin.query(
        `SELECT outcome FROM core.payout_change_log WHERE seller_id=$1`,
        [SELLER_SWEEP],
      );
      expect(log.rows.map((r: { outcome: string }) => r.outcome)).toContain('ACTIVATED');
    });

    it('cancelling a pending change needs no step-up — reverting is easier', async () => {
      await sellerReq('post', '/v1/seller/payout')
        .send({
          bank_code: 'CBE',
          account_number: '2000999888777',
          account_name: 'Naod Solomon',
          step_up_challenge_id: await freshStepUp('PAYOUT_CHANGE'),
        })
        .expect(201);
      await sellerReq('delete', '/v1/seller/payout/pending').expect(204);
      const log = await admin.query(
        `SELECT outcome FROM core.payout_change_log
          WHERE seller_id=$1 ORDER BY occurred_at DESC LIMIT 1`,
        [SELLER],
      );
      expect(log.rows[0].outcome).toBe('CANCELLED');
    });

    // LAST in this describe: the recovery case is append-only, so once the
    // lock exists it cannot be retracted mid-suite - which is the point.
    it('a freshly recovered account is locked for the cooling period', async () => {
      await admin.query(
        `INSERT INTO core.account_recovery_case
           (id, account_id, requested_at, reason, payout_locked_until)
         VALUES (gen_random_uuid(), $1, now() - interval '1 hour', 'SIM lost',
                 now() + interval '7 days')`,
        [OWNER],
      );
      const r = await sellerReq('post', '/v1/seller/payout')
        .send({
          bank_code: 'CBE',
          account_number: ACCOUNT_NUMBER,
          account_name: 'Naod Solomon',
          step_up_challenge_id: await freshStepUp('PAYOUT_CHANGE'),
        })
        .expect(409);
      expect(r.body.code).toBe('PAYOUT_LOCKED');
      expect(r.body.slots.reason).toBe('RECOVERY_COOLING');

      // Proactive panel again: recovery cooling reads its horizon straight off
      // the recovery case (payout_locked_until), so the GET names the same day
      // the 409 refuses, seven days out, without a write attempt.
      const g = await sellerReq('get', '/v1/seller/payout').expect(200);
      expect(g.body.reason).toBe('RECOVERY_COOLING');
      expect(g.body.payout_locked_until).toBeTruthy();
      expect(new Date(g.body.payout_locked_until).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('instructions and evidence — R15 and R18 through real crypto', () => {
    it('the buyer reads DECRYPTED instructions from the snapshot path', async () => {
      await buyerPost('/v1/cart/lines').send({ variant_id: VARIANT, quantity: 1 }).expect(201);
      const cart = await request(app.getHttpServer())
        .get('/v1/cart')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .expect(200);
      const order = await buyerPost('/v1/orders')
        .send({
          cart_id: cart.body.cart_id,
          expected: [{ variant_id: VARIANT, unit_price_minor: 145000 }],
        })
        .expect(201);
      orderId = order.body.id;

      const r = await request(app.getHttpServer())
        .get(`/v1/orders/${orderId}/payment-instructions`)
        .set('Authorization', `Bearer ${BUYER_S}`)
        .expect(200);
      expect(r.body.account_number).toBe(ACCOUNT_NUMBER);
      expect(r.body.account_name).toBe('Naod Solomon');
      expect(r.body.amount_minor).toBe(145000);
      expect(r.headers['cache-control']).toBe('private, no-store');
    });

    it('a stranger probing the instructions gets 404 - S19 outranks 12.5 (D-30)', async () => {
      // ADU-API-01 12.5 says "403 where the caller is not the buyer";
      // ADU-AUTH-01 S19/S21 rule that an actor with no relationship must
      // not learn the object exists. A 403 IS the existence oracle, so the
      // function raises U0002 and the wire says not-found. Register D-30.
      const r = await request(app.getHttpServer())
        .get(`/v1/orders/${orderId}/payment-instructions`)
        .set('Authorization', `Bearer ${STRANGER_S}`)
        .expect(404);
      expect(r.body.code).toBe('NOT_FOUND');
    });

    it('an oversize commit is 413 EVIDENCE_TOO_LARGE', async () => {
      const up = await buyerPost(`/v1/orders/${orderId}/payment-evidence`)
        .send({ action: 'REQUEST_UPLOAD' })
        .expect(200);
      const rawKey = up.body.upload.key as string;
      storage.seed(rawKey, Buffer.alloc(6 * 1024 * 1024));
      const r = await buyerPost(`/v1/orders/${orderId}/payment-evidence`)
        .send({ action: 'COMMIT', key: rawKey })
        .expect(413);
      expect(r.body.code).toBe('EVIDENCE_TOO_LARGE');
    });

    it('evidence: upload-commit moves the order to PAYMENT_SUBMITTED, raw deleted, frames stored', async () => {
      const up = await buyerPost(`/v1/orders/${orderId}/payment-evidence`)
        .send({ action: 'REQUEST_UPLOAD' })
        .expect(200);
      const rawKey = up.body.upload.key as string;
      const screenshot = Buffer.from(
        `FAKE-SCREENSHOT-${'x'.repeat(200_000)}-END`,
      );
      storage.seed(rawKey, screenshot);

      const commit = await buyerPost(`/v1/orders/${orderId}/payment-evidence`)
        .send({ action: 'COMMIT', key: rawKey })
        .expect(201);
      expect(commit.body.state).toBe('PAYMENT_SUBMITTED');
      expect(await storage.getObject(rawKey)).toBeNull(); // the raw is GONE

      const sub = await admin.query(
        `SELECT state, sla_deadline FROM core.payment_submission
          WHERE order_id=$1 ORDER BY submitted_at DESC LIMIT 1`,
        [orderId],
      );
      expect(sub.rows[0].state).toBe('SUBMITTED');
      expect(sub.rows[0].sla_deadline).not.toBeNull();

      // the seller streams it back byte-identical, and the read is LOGGED
      const streamed = await sellerReq(
        'get',
        `/v1/seller/orders/${orderId}/payment-evidence`,
      ).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      }).expect(200);
      expect(Buffer.compare(streamed.body as Buffer, screenshot)).toBe(0);

      const log = await admin.query(
        `SELECT actor_role FROM financial.access_log
          WHERE subject_kind='PAYMENT_EVIDENCE' AND actor_account_id=$1
          ORDER BY occurred_at DESC LIMIT 1`,
        [OWNER],
      );
      expect(log.rows[0].actor_role).toBe('SELLER');
    });

  });

  describe('reissue — one named order (S8.5)', () => {
    it('reissues against the CURRENT active payout, appends the record, relinks the order', async () => {
      const before = await admin.query(
        `SELECT payout_snapshot_id FROM core."order" WHERE id=$1`,
        [orderId],
      );
      const r = await sellerReq('post', `/v1/seller/orders/${orderId}/reissue-instructions`)
        .send({ step_up_challenge_id: SU_REISSUE })
        .expect(201);
      expect(r.body.snapshot_id).toBeTruthy();
      const after = await admin.query(
        `SELECT payout_snapshot_id FROM core."order" WHERE id=$1`,
        [orderId],
      );
      expect(after.rows[0].payout_snapshot_id).not.toBe(before.rows[0].payout_snapshot_id);
      const reissue = await admin.query(
        `SELECT count(*)::int AS n FROM core.payment_instruction_reissue WHERE order_id=$1`,
        [orderId],
      );
      expect(reissue.rows[0].n).toBe(1);
    });

    it('the wrong step-up action is 403 STEP_UP_ACTION_MISMATCH', async () => {
      const r = await sellerReq('post', `/v1/seller/orders/${orderId}/reissue-instructions`)
        .send({ step_up_challenge_id: await freshStepUp('PAYOUT_CHANGE') })
        .expect(403);
      expect(r.body.code).toBe('STEP_UP_ACTION_MISMATCH');
    });
  });
});
