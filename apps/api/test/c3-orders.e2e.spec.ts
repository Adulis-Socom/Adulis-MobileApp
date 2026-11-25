import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * C3 — the cart (Checkout Option A: a real Cart that reviews and never
 * submits). Order creation, payment decisions, refunds, Reservation
 * cancellation and handoff were retired with the Reservation model
 * (migration 0063); what remains to prove is that the cart works, that it
 * never holds stock or writes an order, and that the retired routes are gone.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = '88888888-7777-4000-8000-000000000001';
const OWNER = '88888888-7777-4000-8000-000000000002';
const BUYER = '88888888-7777-4000-8000-000000000003';
const STRANGER = '88888888-7777-4000-8000-000000000004';
const DEVICE = '88888888-7777-4000-8000-000000000006';
const SELLER = '88888888-7777-4000-8000-000000000007';
const SELLER2 = '88888888-7777-4000-8000-000000000008';
const OWNER_S = '88888888-7777-4000-8000-000000000009';
const BUYER_S = '88888888-7777-4000-8000-00000000000a';
const OWNER_MOBILE_S = '88888888-7777-4000-8000-00000000001b';
const PRODUCT = '88888888-7777-4000-8000-00000000000d';
const VARIANT = '88888888-7777-4000-8000-00000000000e';
const PRODUCT2 = '88888888-7777-4000-8000-000000000010';
const V2SELLER2 = '88888888-7777-4000-8000-000000000011';
// A CONSOLE stranger, because the MOBILE stranger meets the SURFACE gate
// first (U0001 -> 403, identical for everyone) before the relationship gate
// could 404.
const STRANGER_CON_S = '88888888-7777-4000-8000-000000000026';

@Module({ imports: [AppModule] })
class C3AppModule {}

describe('C3 — the cart', () => {
  let app: INestApplication;
  let admin: Pool;

  const cookie = (t: string) => `__Host-adulis_session=${sessionToken(t)}`;
  const key = () => randomUUID();

  const buyerPost = (path: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${sessionToken(BUYER_S)}`)
      .set('X-Adulis-Device', DEVICE)
      .set('Idempotency-Key', key());
  const buyerCart = () =>
    request(app.getHttpServer())
      .get('/v1/cart')
      .set('Authorization', `Bearer ${sessionToken(BUYER_S)}`)
      .set('X-Adulis-Device', DEVICE);

  /** What a stock-holding or order-writing path would leave behind. */
  const ledger = async (): Promise<{ orders: number; events: number; stock: number }> => {
    const r = await admin.query(
      `SELECT (SELECT count(*)::int FROM core."order" WHERE market_id=$1) AS orders,
              (SELECT count(*)::int FROM core.stock_event
                WHERE seller_id IN ($2::uuid, $3::uuid)) AS events,
              (SELECT stock_count FROM core.product_variant WHERE id=$4) AS stock`,
      [M, SELLER, SELLER2, VARIANT],
    );
    return r.rows[0];
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'C3E','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en', 'ACTIVE', true, 'AFROMESSAGE')`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.timing_config (id, market_id, payment_confirmation_window, fulfilment_window, offline_sync_horizon,
         payout_activation_delay, recovery_cooling_period,
         deleted_number_cooling_period, refund_ack_window, media_retention,
         level_credit_grace, mobile_session_lifetime, console_session_lifetime,
         console_idle_timeout, console_remembered_lifetime,
         console_remembered_idle, otp_ttl, otp_max_attempts, step_up_freshness,
         new_device_payout_lock, same_seller_cancellation_threshold,
         same_seller_cooldown, cross_seller_cooldown_ladder,
         cancellation_counter_decay)
       VALUES (gen_random_uuid(), $1,'24 hours','72 hours','7 days',
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
        ($1,'+251911881001',$4,'ACTIVE'), ($2,'+251911881002',$4,'ACTIVE'),
        ($3,'+251911881003',$4,'ACTIVE')`,
      [OWNER, BUYER, STRANGER, M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status) VALUES
        ($1,$3,$4,'INDIVIDUAL','C3 Store','c3-store','ACTIVE'),
        ($2,$3,$4,'INDIVIDUAL','C3 Other','c3-other','ACTIVE')`,
      [SELLER, SELLER2, M, OWNER],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor,
         base_price_currency, visibility) VALUES
        ($1,$3,$4,'Tote',250000,'ETB','PUBLISHED'),
        ($2,$5,$4,'Other',1000,'ETB','PUBLISHED')`,
      [PRODUCT, PRODUCT2, SELLER, M, SELLER2],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
         price_currency, variant_key) VALUES
        ($1,$3,$4,250000,'ETB','brown'),
        ($2,$5,$6,1000,'ETB','one')`,
      [VARIANT, V2SELLER2, PRODUCT, SELLER, PRODUCT2, SELLER2],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES
        (gen_random_uuid(), $1, $2, 20, 'SELLER_SET'),
        (gen_random_uuid(), $3, $4, 20, 'SELLER_SET')`,
      [VARIANT, SELLER, V2SELLER2, SELLER2],
    );
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$4,'CONSOLE',$7, now()+interval '12 hours'),
        ($2,$5,'MOBILE',$7, now()+interval '30 days'),
        ($3,$4,'MOBILE',$7, now()+interval '30 days'),
        ($8,$6,'CONSOLE',$7, now()+interval '12 hours')`,
      [OWNER_S, BUYER_S, OWNER_MOBILE_S, OWNER, BUYER, STRANGER, DEVICE, STRANGER_CON_S],
    );
    await armFixtureSessions(admin, [OWNER_S, BUYER_S, OWNER_MOBILE_S, STRANGER_CON_S]);

    const moduleRef = await Test.createTestingModule({ imports: [C3AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${OWNER}','${BUYER}','${STRANGER}','${DEVICE}')`,
      `DELETE FROM analytics.event WHERE market_id='${M}'`,
      `DELETE FROM core.cart_line WHERE cart_id IN (SELECT id FROM core.cart WHERE market_id='${M}')`,
      `DELETE FROM core.cart WHERE market_id='${M}'`,
      `DELETE FROM core.stock_event WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.product_variant WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.product WHERE market_id='${M}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.seller WHERE market_id='${M}'`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER}','${BUYER}','${STRANGER}')`,
      `DELETE FROM core.session WHERE account_id IN ('${OWNER}','${BUYER}','${STRANGER}')`,
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

  describe('cart', () => {
    it('a second seller in one cart is 409 CART_SELLER_CONFLICT', async () => {
      await buyerPost('/v1/cart/lines').send({ variant_id: VARIANT, quantity: 2 }).expect(201);
      const r = await buyerPost('/v1/cart/lines')
        .send({ variant_id: V2SELLER2, quantity: 1 })
        .expect(409);
      expect(r.body.code).toBe('CART_SELLER_CONFLICT');
    });

    it('the cart view carries live price and availability per line', async () => {
      const r = await buyerCart().expect(200);
      expect(r.body.lines).toHaveLength(1);
      expect(r.body.lines[0].available).toBe(true);
      expect(r.body.lines[0].current_price.amount_minor).toBe(250000);
      // clean the line for later tests
      await request(app.getHttpServer())
        .delete(`/v1/cart/lines/${r.body.lines[0].id}`)
        .set('Authorization', `Bearer ${sessionToken(BUYER_S)}`)
        .set('X-Adulis-Device', DEVICE)
        .expect(204);
    });

    it('Option A: add, patch, read and remove write no order and hold no stock', async () => {
      const before = await ledger();
      const added = await buyerPost('/v1/cart/lines')
        .send({ variant_id: VARIANT, quantity: 3 })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/v1/cart/lines/${added.body.line_id}`)
        .set('Authorization', `Bearer ${sessionToken(BUYER_S)}`)
        .set('X-Adulis-Device', DEVICE)
        .send({ quantity: 5 })
        .expect(200);
      const cart = await buyerCart().expect(200);
      expect(cart.body.lines).toHaveLength(1);
      expect(cart.body.lines[0].quantity).toBe(5);
      expect(await ledger()).toEqual(before);
      await request(app.getHttpServer())
        .delete(`/v1/cart/lines/${added.body.line_id}`)
        .set('Authorization', `Bearer ${sessionToken(BUYER_S)}`)
        .set('X-Adulis-Device', DEVICE)
        .expect(204);
      expect(await ledger()).toEqual(before);
      expect(before.orders).toBe(0);
      expect(before.stock).toBe(20);
    });
  });

  describe('retired order, payment, refund, financial, payout and handoff routes (migration 0063)', () => {
    const ID = randomUUID();
    const RID = randomUUID();
    const buyer: Array<[string, string]> = [
      ['post', '/v1/orders'],
      ['get', '/v1/orders'],
      ['get', `/v1/orders/${ID}`],
      ['post', `/v1/orders/${ID}/reservations/${RID}/cancel`],
      ['post', `/v1/orders/${ID}/cancel`],
      ['post', `/v1/orders/${ID}/confirm-receipt`],
      ['post', `/v1/orders/${ID}/refunds/${RID}/acknowledge`],
      ['get', `/v1/orders/${ID}/payment-instructions`],
      ['post', `/v1/orders/${ID}/payment-evidence`],
      ['post', '/v1/handoffs/sync'],
      ['get', '/v1/courier/orders'],
      ['get', `/v1/courier/orders/${ID}`],
      ['post', `/v1/courier/orders/${ID}/custody-accept`],
    ];
    const seller: Array<[string, string]> = [
      ['get', '/v1/seller/orders'],
      ['get', `/v1/seller/orders/${ID}`],
      ['post', `/v1/seller/orders/${ID}/ready`],
      ['post', `/v1/seller/orders/${ID}/payment/confirm`],
      ['post', `/v1/seller/orders/${ID}/payment/reject`],
      ['post', `/v1/seller/orders/${ID}/reservations/${RID}/cancel`],
      ['post', `/v1/seller/orders/${ID}/refunds`],
      ['get', `/v1/seller/orders/${ID}/payment-evidence`],
      ['post', `/v1/seller/orders/${ID}/reissue-instructions`],
      ['get', '/v1/seller/payout'],
      ['post', '/v1/seller/payout'],
      ['delete', '/v1/seller/payout/pending'],
      ['get', '/v1/seller/payout/history'],
      ['get', `/v1/seller/orders/${ID}/qr`],
      ['post', `/v1/seller/orders/${ID}/custody-transfer`],
      ['post', `/v1/seller/orders/${ID}/courier-assignment`],
    ];

    it('every one is 404 for an authenticated buyer and seller, and writes nothing', async () => {
      const before = await ledger();
      for (const [method, path] of buyer) {
        const r = await request(app.getHttpServer())
          [method as 'get' | 'post' | 'delete'](path)
          .set('Authorization', `Bearer ${sessionToken(BUYER_S)}`)
          .set('X-Adulis-Device', DEVICE)
          .set('Idempotency-Key', key())
          .send({ variant_id: VARIANT, quantity: 1 });
        expect([method, path, r.status]).toEqual([method, path, 404]);
      }
      for (const [method, path] of seller) {
        const r = await request(app.getHttpServer())
          [method as 'get' | 'post' | 'delete'](path)
          .set('Cookie', cookie(OWNER_S))
          .set('Origin', CONSOLE_ORIGIN)
          .set('X-Adulis-Seller', SELLER)
          .set('Idempotency-Key', key())
          .send({});
        expect([method, path, r.status]).toEqual([method, path, 404]);
      }
      expect(await ledger()).toEqual(before);
    });
  });

  describe('GET /v1/seller/obligations (S12.12b)', () => {
    const get = (token = OWNER_S, sellerId = SELLER) =>
      request(app.getHttpServer())
        .get('/v1/seller/obligations')
        .set('Cookie', cookie(token))
        .set('X-Adulis-Seller', sellerId);

    it('MOBILE is 403 (store:read is CONSOLE-only); a CONSOLE stranger is 404', async () => {
      await request(app.getHttpServer())
        .get('/v1/seller/obligations')
        .set('Authorization', `Bearer ${sessionToken(OWNER_MOBILE_S)}`)
        .set('X-Adulis-Seller', SELLER)
        .expect(403);
      // A CONSOLE stranger passes the surface gate and fails the relationship
      // gate: U0002 -> 404, never confirming the seller exists (S19).
      await get(STRANGER_CON_S).expect(404);
    });

    it('the set is empty since 0063 -- a 200 with an empty array, not a 404', async () => {
      const r = await get().expect(200);
      expect(r.body).toEqual({ data: [] });
    });
  });
});
