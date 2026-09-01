import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { qrSignature } from '../src/modules/handoff/handoff.service';

/**
 * C5 — handoff and courier: R20 and R25 at both ends of the handoff, the
 * two clocks separating, per-item batch semantics with the replay
 * correction, and courier isolation BY ROW-LEVEL SECURITY — proven by
 * reading as a courier, not by trusting a WHERE clause.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = 'bbbb2222-3333-4000-8000-000000000001';
const OWNER = 'bbbb2222-3333-4000-8000-000000000002';
const BUYER = 'bbbb2222-3333-4000-8000-000000000003';
const COURIER = 'bbbb2222-3333-4000-8000-000000000004';
const DEVICE = 'bbbb2222-3333-4000-8000-000000000005';
const SELLER = 'bbbb2222-3333-4000-8000-000000000006';
const OWNER_S = 'bbbb2222-3333-4000-8000-000000000007';
const BUYER_S = 'bbbb2222-3333-4000-8000-000000000008';
const COURIER_S = 'bbbb2222-3333-4000-8000-000000000009';
const PRODUCT = 'bbbb2222-3333-4000-8000-00000000000a';
const VARIANT = 'bbbb2222-3333-4000-8000-00000000000b';
const VARIANT2 = 'bbbb2222-3333-4000-8000-00000000000c';

@Module({ imports: [AppModule] })
class C5AppModule {}

describe('C5 — handoff and courier', () => {
  let app: INestApplication;
  let admin: Pool;
  let orderId = '';
  let orderId2 = '';
  let qr: { order_ref: string; nonce: string; signing_key_version: number; signature: string };

  const cookie = (t: string) => `__Host-adulis_session=${t}`;
  const key = () => randomUUID();
  const sellerPost = (path: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Cookie', cookie(OWNER_S))
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Seller', SELLER)
      .set('Idempotency-Key', key());
  const buyerPost = (path: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${BUYER_S}`)
      .set('X-Adulis-Device', DEVICE)
      .set('Idempotency-Key', key());
  const courierReq = (method: 'get' | 'post', path: string) => {
    const r = request(app.getHttpServer())[method](path).set('Cookie', cookie(COURIER_S));
    if (method === 'post') r.set('Origin', CONSOLE_ORIGIN).set('Idempotency-Key', key());
    return r;
  };

  const mkOrder = async (variant: string): Promise<string> => {
    await buyerPost('/v1/cart/lines').send({ variant_id: variant, quantity: 1 }).expect(201);
    const cart = await request(app.getHttpServer())
      .get('/v1/cart')
      .set('Authorization', `Bearer ${BUYER_S}`)
      .set('X-Adulis-Device', DEVICE)
      .expect(200);
    const r = await buyerPost('/v1/orders')
      .send({
        cart_id: cart.body.cart_id,
        expected: [{ variant_id: variant, unit_price_minor: 90000 }],
      })
      .expect(201);
    return r.body.id as string;
  };
  const confirmPayment = async (id: string): Promise<void> => {
    await admin.query(`UPDATE core."order" SET state='PAYMENT_SUBMITTED' WHERE id=$1`, [id]);
    await admin.query(
      `INSERT INTO core.payment_submission (id, order_id, submitted_at, evidence_ref, state)
       VALUES (gen_random_uuid(), $1, now(), gen_random_uuid(), 'SUBMITTED')`,
      [id],
    );
    await sellerPost(`/v1/seller/orders/${id}/payment/confirm`).send({}).expect(200);
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'C5E','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en', 'ACTIVE', true, 'AFROMESSAGE')`,
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
        ($1,'+251911331001',$4,'ACTIVE'), ($2,'+251911331002',$4,'ACTIVE'),
        ($3,'+251911331003',$4,'ACTIVE')`,
      [OWNER, BUYER, COURIER, M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','C5 Store','c5-store','ACTIVE')`,
      [SELLER, M, OWNER],
    );
    await admin.query(
      `INSERT INTO core.seller_courier (id, seller_id, account_id)
       VALUES (gen_random_uuid(), $1, $2)`,
      [SELLER, COURIER],
    );
    await admin.query(
      `INSERT INTO core.payout_details (id, seller_id, bank_code, account_last4,
         state, requested_by_account_id, activated_at)
       VALUES (gen_random_uuid(), $1, 'CBE', '5151', 'ACTIVE', $2, now())`,
      [SELLER, OWNER],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor,
         base_price_currency, visibility)
       VALUES ($1,$2,$3,'Basket',90000,'ETB','PUBLISHED')`,
      [PRODUCT, SELLER, M],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
         price_currency, variant_key) VALUES
        ($1,$3,$4,90000,'ETB','one'), ($2,$3,$4,90000,'ETB','two')`,
      [VARIANT, VARIANT2, PRODUCT, SELLER],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES
        (gen_random_uuid(),$1,$3,10,'SELLER_SET'),
        (gen_random_uuid(),$2,$3,10,'SELLER_SET')`,
      [VARIANT, VARIANT2, SELLER],
    );
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at, created_at) VALUES
        ($1,$4,'CONSOLE',$7, now()+interval '12 hours', now()-interval '3 days'),
        ($2,$5,'MOBILE',$7, now()+interval '30 days', now()-interval '3 days'),
        ($3,$6,'CONSOLE',$7, now()+interval '12 hours', now()-interval '3 days')`,
      [OWNER_S, BUYER_S, COURIER_S, OWNER, BUYER, COURIER, DEVICE],
    );

    const moduleRef = await Test.createTestingModule({ imports: [C5AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id::text LIKE 'bbbb2222%'`,
      `DELETE FROM analytics.event WHERE market_id='${M}'`,
      `DELETE FROM core.order_confirmation WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.handoff_scan WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.courier_custody_transfer WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.order_courier_assignment WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.order_qr_token WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
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
      `DELETE FROM core.payout_details WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_courier WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_level_state WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_level_event WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller WHERE id='${SELLER}'`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER}','${BUYER}','${COURIER}')`,
      `DELETE FROM core.session WHERE account_id IN ('${OWNER}','${BUYER}','${COURIER}')`,
      `DELETE FROM core.device WHERE id='${DEVICE}'`,
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

  describe('R20 — the QR moment', () => {
    it('the QR endpoint refuses before PAYMENT_CONFIRMED', async () => {
      orderId = await mkOrder(VARIANT);
      const r = await request(app.getHttpServer())
        .get(`/v1/seller/orders/${orderId}/qr`)
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .expect(409);
      expect(r.body.code).toBe('ORDER_NOT_READYABLE');
    });

    it('after confirmation the QR exists, server-signed', async () => {
      await confirmPayment(orderId);
      const r = await request(app.getHttpServer())
        .get(`/v1/seller/orders/${orderId}/qr`)
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      qr = r.body;
      expect(qr.signature).toBe(qrSignature(orderId, qr.nonce, qr.signing_key_version));
    });
  });

  describe('courier isolation — by RLS, and R25', () => {
    it('an unassigned courier sees NO orders; an assigned one sees exactly theirs', async () => {
      const before = await courierReq('get', '/v1/courier/orders').expect(200);
      expect(before.body.data).toHaveLength(0);

      await sellerPost(`/v1/seller/orders/${orderId}/courier-assignment`)
        .send({ courier_account_id: COURIER })
        .expect(201);

      const after = await courierReq('get', '/v1/courier/orders').expect(200);
      expect(after.body.data).toHaveLength(1);
      expect(after.body.data[0].id).toBe(orderId);
    });

    it('the QR is ABSENT until custody is accepted (R25), present after', async () => {
      const before = await courierReq('get', `/v1/courier/orders/${orderId}`).expect(200);
      expect(before.body.qr).toBeNull();
      expect(before.body.buyer_phone).toBeTruthy();

      await courierReq('post', `/v1/courier/orders/${orderId}/custody-accept`)
        .send({})
        .expect(200);
      await sellerPost(`/v1/seller/orders/${orderId}/custody-transfer`)
        .send({ courier_account_id: COURIER })
        .expect(200);

      const afterCustody = await courierReq('get', `/v1/courier/orders/${orderId}`).expect(200);
      expect(afterCustody.body.qr).not.toBeNull();
      expect(afterCustody.body.custody_accepted).toBe(true);
      // Event A never completed anything
      const state = await admin.query(`SELECT state FROM core."order" WHERE id=$1`, [orderId]);
      expect(state.rows[0].state).toBe('PAYMENT_CONFIRMED');
    });
  });

  describe('the sync batch (12.6.1)', () => {
    it('a valid scan completes; the byte-identical retry replays the ORIGINAL outcome', async () => {
      const scan = {
        nonce: qr.nonce,
        order_ref: orderId,
        signed_at: Date.now(),
        signature: qr.signature,
      };
      const first = await buyerPost('/v1/handoffs/sync').send({ scans: [scan] }).expect(200);
      expect(first.body.results[0]).toMatchObject({
        outcome: 'VALID',
        replay: false,
        order_state: 'HANDED_OFF',
      });

      const retry = await buyerPost('/v1/handoffs/sync').send({ scans: [scan] }).expect(200);
      expect(retry.body.results[0]).toMatchObject({ outcome: 'VALID', replay: true });
    });

    it('the same nonce with a DIFFERENT payload is REJECTED_REPLAY; garbage signatures and unknown orders reject per item', async () => {
      const r = await buyerPost('/v1/handoffs/sync')
        .send({
          scans: [
            {
              nonce: qr.nonce,
              order_ref: orderId,
              signed_at: Date.now() + 5000, // different bytes
              signature: qr.signature,
            },
            {
              nonce: randomUUID(),
              order_ref: orderId,
              signed_at: Date.now(),
              signature: 'a'.repeat(64), // wrong signature
            },
            {
              nonce: randomUUID(),
              order_ref: randomUUID(), // no such order
              signed_at: Date.now(),
              signature: 'b'.repeat(64),
            },
          ],
        })
        .expect(200); // a batch of rejections is a SUCCESSFUL request
      const outcomes = r.body.results.map((x: { outcome: string }) => x.outcome);
      expect(outcomes).toEqual(['REJECTED_REPLAY', 'REJECTED_SIGNATURE', 'REJECTED_UNKNOWN_ORDER']);
    });

    it('a courier session cannot submit a buyer scan — 403, not a 500', async () => {
      orderId2 = await mkOrder(VARIANT2);
      await confirmPayment(orderId2);
      const t = await admin.query(
        `SELECT nonce, signing_key_version FROM core.order_qr_token WHERE order_id=$1`,
        [orderId2],
      );
      const r = await courierReq('post', '/v1/handoffs/sync')
        .send({
          scans: [
            {
              nonce: t.rows[0].nonce,
              order_ref: orderId2,
              signed_at: Date.now(),
              signature: qrSignature(orderId2, t.rows[0].nonce, t.rows[0].signing_key_version),
            },
          ],
        })
        .expect(403);
      expect(r.body.code).toBe('COURIER_CANNOT_SCAN');
    });
  });
});
