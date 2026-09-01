import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * C3 — cart, orders and payment decisions: the concurrency-critical group's
 * gate. Everything here rides the migration-09 guards through named
 * functions; the tests assert the OUTCOMES the documents rule — complete
 * revalidation items, the W6 two-rejection flow, the R20 token moment, the
 * S9.5 cooldown, stock returning exactly once per cancelled line — through
 * the API, as the runtime role.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = '88888888-7777-4000-8000-000000000001';
const OWNER = '88888888-7777-4000-8000-000000000002';
const BUYER = '88888888-7777-4000-8000-000000000003';
const STRANGER = '88888888-7777-4000-8000-000000000004';
const ANALYST = '88888888-7777-4000-8000-000000000005';
const DEVICE = '88888888-7777-4000-8000-000000000006';
const SELLER = '88888888-7777-4000-8000-000000000007';
const SELLER2 = '88888888-7777-4000-8000-000000000008';
const OWNER_S = '88888888-7777-4000-8000-000000000009';
const BUYER_S = '88888888-7777-4000-8000-00000000000a';
const STRANGER_S = '88888888-7777-4000-8000-00000000000b';
const ANALYST_S = '88888888-7777-4000-8000-00000000000c';
const PRODUCT = '88888888-7777-4000-8000-00000000000d';
const VARIANT = '88888888-7777-4000-8000-00000000000e';
const VARIANT2 = '88888888-7777-4000-8000-00000000000f';
const PRODUCT2 = '88888888-7777-4000-8000-000000000010';
const V2SELLER2 = '88888888-7777-4000-8000-000000000011';
const VB = '88888888-7777-4000-8000-000000000012';
const VC = '88888888-7777-4000-8000-000000000013';
const VD = '88888888-7777-4000-8000-000000000014';
const VE = '88888888-7777-4000-8000-000000000015';
const VF = '88888888-7777-4000-8000-000000000016';

@Module({ imports: [AppModule] })
class C3AppModule {}

describe('C3 — cart, orders and payment', () => {
  let app: INestApplication;
  let admin: Pool;

  const cookie = (t: string) => `__Host-adulis_session=${t}`;
  const key = () => randomUUID();

  const buyerPost = (path: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${BUYER_S}`)
      .set('X-Adulis-Device', DEVICE)
      .set('Idempotency-Key', key());
  const sellerPost = (path: string, token = OWNER_S) =>
    request(app.getHttpServer())
      .post(path)
      .set('Cookie', cookie(token))
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Seller', SELLER)
      .set('Idempotency-Key', key());

  /** Walk an order into PAYMENT_SUBMITTED with a live submission row. */
  const submitPayment = async (orderId: string): Promise<void> => {
    await admin.query(`UPDATE core."order" SET state='PAYMENT_SUBMITTED' WHERE id=$1`, [orderId]);
    await admin.query(
      `INSERT INTO core.payment_submission (id, order_id, submitted_at, evidence_ref, state)
       VALUES (gen_random_uuid(), $1, now(), gen_random_uuid(), 'SUBMITTED')`,
      [orderId],
    );
  };

  /** Each flow gets its own variant: an ACTIVE reservation on (buyer,
   *  variant) excludes a second - the section 12.1 constraint at work. */
  const createOrder = async (variant: string = VARIANT): Promise<string> => {
    await buyerPost('/v1/cart/lines').send({ variant_id: variant, quantity: 1 }).expect(201);
    const cart = await request(app.getHttpServer())
      .get('/v1/cart')
      .set('Authorization', `Bearer ${BUYER_S}`)
      .set('X-Adulis-Device', DEVICE)
      .expect(200);
    const r = await buyerPost('/v1/orders')
      .send({
        cart_id: cart.body.cart_id,
        expected: [{ variant_id: variant, unit_price_minor: 250000 }],
      })
      .expect(201);
    return r.body.id as string;
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'C3E','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en',false, 'ACTIVE', true, 'AFROMESSAGE')`,
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
        ($1,'+251911881001',$5,'ACTIVE'), ($2,'+251911881002',$5,'ACTIVE'),
        ($3,'+251911881003',$5,'ACTIVE'), ($4,'+251911881004',$5,'ACTIVE')`,
      [OWNER, BUYER, STRANGER, ANALYST, M],
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
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role)
       VALUES (gen_random_uuid(), $1, $2, 'ANALYST')`,
      [SELLER, ANALYST],
    );
    await admin.query(
      `INSERT INTO core.payout_details (id, seller_id, bank_code, account_last4,
         state, requested_by_account_id, activated_at)
       VALUES (gen_random_uuid(), $1, 'CBE', '3131', 'ACTIVE', $2, now())`,
      [SELLER, OWNER],
    );
    await admin.query(
      `INSERT INTO financial.payout_credential (payout_details_id, account_ciphertext,
         account_name_ciphertext, encryption_key_ref)
       SELECT id, decode('dead','hex'), decode('beef','hex'), 'PAYOUT_V1'
         FROM core.payout_details WHERE seller_id = $1`,
      [SELLER],
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
        ($1,$4,$5,250000,'ETB','brown'),
        ($2,$4,$5,260000,'ETB','black'),
        ($3,$6,$7,1000,'ETB','one'),
        ($8,$4,$5,250000,'ETB','vb'), ($9,$4,$5,250000,'ETB','vc'),
        ($10,$4,$5,250000,'ETB','vd'), ($11,$4,$5,250000,'ETB','ve'),
        ($12,$4,$5,250000,'ETB','vf')`,
      [VARIANT, VARIANT2, V2SELLER2, PRODUCT, SELLER, PRODUCT2, SELLER2,
       VB, VC, VD, VE, VF],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       SELECT gen_random_uuid(), v, $1::uuid, 20, 'SELLER_SET'
         FROM unnest($2::uuid[]) v`,
      [SELLER, [VARIANT, VARIANT2, VB, VC, VD, VE, VF]],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       VALUES (gen_random_uuid(), $1, $2, 20, 'SELLER_SET')`,
      [V2SELLER2, SELLER2],
    );
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$5,'CONSOLE',$9, now()+interval '12 hours'),
        ($2,$6,'MOBILE',$9, now()+interval '30 days'),
        ($3,$7,'MOBILE',$9, now()+interval '30 days'),
        ($4,$8,'CONSOLE',$9, now()+interval '12 hours')`,
      [OWNER_S, BUYER_S, STRANGER_S, ANALYST_S, OWNER, BUYER, STRANGER, ANALYST, DEVICE],
    );

    const moduleRef = await Test.createTestingModule({ imports: [C3AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${OWNER}','${BUYER}','${STRANGER}','${ANALYST}','${DEVICE}')`,
      `DELETE FROM analytics.event WHERE market_id='${M}'`,
      `DELETE FROM core.refund WHERE reservation_id IN (SELECT id FROM core.reservation WHERE seller_id IN ('${SELLER}','${SELLER2}'))`,
      `DELETE FROM core.order_confirmation WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.order_qr_token WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.payment_submission WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.reservation WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.order_state_transition WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.order_payout_snapshot WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core."order" WHERE market_id='${M}'`,
      `DELETE FROM core.buyer_cancellation_counter WHERE buyer_account_id='${BUYER}'`,
      `DELETE FROM core.cart_line WHERE cart_id IN (SELECT id FROM core.cart WHERE market_id='${M}')`,
      `DELETE FROM core.cart WHERE market_id='${M}'`,
      `DELETE FROM core.stock_event WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.product_variant WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.product WHERE market_id='${M}'`,
      `DELETE FROM financial.payout_credential WHERE payout_details_id IN (SELECT id FROM core.payout_details WHERE seller_id='${SELLER}')`,
      `DELETE FROM core.payout_details WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_team_member WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.seller WHERE market_id='${M}'`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER}','${BUYER}','${STRANGER}','${ANALYST}')`,
      `DELETE FROM core.session WHERE account_id IN ('${OWNER}','${BUYER}','${STRANGER}','${ANALYST}')`,
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
      const r = await request(app.getHttpServer())
        .get('/v1/cart')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .expect(200);
      expect(r.body.lines).toHaveLength(1);
      expect(r.body.lines[0].available).toBe(true);
      expect(r.body.lines[0].current_price.amount_minor).toBe(250000);
      // clean the line for later tests
      await request(app.getHttpServer())
        .delete(`/v1/cart/lines/${r.body.lines[0].id}`)
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .expect(204);
    });
  });

  describe('order creation (S8.3)', () => {
    it('a changed price refuses with COMPLETE items[] and resolving actions', async () => {
      await buyerPost('/v1/cart/lines').send({ variant_id: VARIANT, quantity: 1 }).expect(201);
      const cart = await request(app.getHttpServer())
        .get('/v1/cart')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .expect(200);
      const r = await buyerPost('/v1/orders')
        .send({
          cart_id: cart.body.cart_id,
          expected: [{ variant_id: VARIANT, unit_price_minor: 240000 }],
        })
        .expect(409);
      expect(r.body.code).toBe('CART_REVALIDATION_FAILED');
      expect(r.body.items[0]).toMatchObject({
        code: 'PRICE_CHANGED',
        resolving_action: { kind: 'ACCEPT_NEW_PRICE' },
      });
    });

    it('the matching expectation creates the order: card, absolute expiry, stock held', async () => {
      const cart = await request(app.getHttpServer())
        .get('/v1/cart')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .expect(200);
      const r = await buyerPost('/v1/orders')
        .send({
          cart_id: cart.body.cart_id,
          expected: [{ variant_id: VARIANT, unit_price_minor: 250000 }],
        })
        .expect(201);
      expect(r.body.state).toBe('CREATED');
      expect(typeof r.body.expires_at).toBe('string');
      expect(r.body.lines).toHaveLength(1);
      const stock = await admin.query(
        `SELECT stock_count FROM core.product_variant WHERE id=$1`,
        [VARIANT],
      );
      expect(stock.rows[0].stock_count).toBe(19);
    });

    it('404 for a stranger reading the order card', async () => {
      const orders = await request(app.getHttpServer())
        .get('/v1/orders')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .expect(200);
      const id = orders.body.data[0].id;
      await request(app.getHttpServer())
        .get(`/v1/orders/${id}`)
        .set('Authorization', `Bearer ${STRANGER_S}`)
        .expect(404);
    });
  });

  describe('the W6 payment flow and R20 token moment', () => {
    let orderId = '';

    it('confirm: PAYMENT_CONFIRMED, clock stopped, the QR token minted HERE', async () => {
      orderId = await createOrder(VB);
      await submitPayment(orderId);
      const before = await admin.query(
        `SELECT count(*)::int AS n FROM core.order_qr_token WHERE order_id=$1`,
        [orderId],
      );
      expect(before.rows[0].n).toBe(0); // R20: no token before confirmation
      await sellerPost(`/v1/seller/orders/${orderId}/payment/confirm`).send({}).expect(200);
      const after = await admin.query(
        `SELECT o.state, o.clock_stopped_at,
                (SELECT count(*)::int FROM core.order_qr_token t WHERE t.order_id=o.id) AS tokens,
                (SELECT ps.state FROM core.payment_submission ps
                  WHERE ps.order_id=o.id ORDER BY submitted_at DESC LIMIT 1) AS sub
           FROM core."order" o WHERE o.id=$1`,
        [orderId],
      );
      expect(after.rows[0]).toMatchObject({ state: 'PAYMENT_CONFIRMED', tokens: 1, sub: 'CONFIRMED' });
      expect(after.rows[0].clock_stopped_at).not.toBeNull();
    });

    it('a second decision is 409 PAYMENT_ALREADY_DECIDED', async () => {
      const r = await sellerPost(`/v1/seller/orders/${orderId}/payment/confirm`)
        .send({})
        .expect(409);
      expect(r.body.code).toBe('PAYMENT_ALREADY_DECIDED');
    });

    it('403 for the ANALYST at payment/confirm — a role failure', async () => {
      const other = await createOrder(VC);
      await submitPayment(other);
      await sellerPost(`/v1/seller/orders/${other}/payment/confirm`, ANALYST_S)
        .send({})
        .expect(403);
      // first rejection: retry window opens, expiry shortens to <= 12h
      const rej = await sellerPost(`/v1/seller/orders/${other}/payment/reject`)
        .send({ reason: 'Nothing arrived in my account' })
        .expect(200);
      expect(rej.body.outcome).toBe('RETRY_WINDOW_OPEN');
      const o = await admin.query(
        `SELECT state, expires_at <= now() + interval '12 hours' AS shortened
           FROM core."order" WHERE id=$1`,
        [other],
      );
      expect(o.rows[0]).toMatchObject({ state: 'NOTIFIED', shortened: true });
      // resubmission, then the SECOND rejection ends the order
      await submitPayment(other);
      const rej2 = await sellerPost(`/v1/seller/orders/${other}/payment/reject`)
        .send({ reason: 'Still nothing' })
        .expect(200);
      expect(rej2.body.outcome).toBe('ORDER_ENDED');
      const ended = await admin.query(`SELECT state FROM core."order" WHERE id=$1`, [other]);
      expect(ended.rows[0].state).toBe('CANCELLED_BY_SELLER');
    });

    it('mark-ready refuses before confirmation and is idempotent by state after', async () => {
      const o = await createOrder(VD);
      const r1 = await sellerPost(`/v1/seller/orders/${o}/ready`).send({}).expect(409);
      expect(r1.body.code).toBe('ORDER_NOT_READYABLE');
      await submitPayment(o);
      await sellerPost(`/v1/seller/orders/${o}/payment/confirm`).send({}).expect(200);
      const a = await sellerPost(`/v1/seller/orders/${o}/ready`).send({}).expect(200);
      const b = await sellerPost(`/v1/seller/orders/${o}/ready`).send({}).expect(200);
      expect(a.body.ready_at).toBeTruthy();
      expect(b.body.ready_at).toBe(a.body.ready_at);
    });

    it('the tapped tier completes the order at medium weight — no level credit', async () => {
      await buyerPost(`/v1/orders/${orderId}/confirm-receipt`).send({}).expect(200);
      const o = await admin.query(
        `SELECT o.state,
                (SELECT tier FROM core.order_confirmation c WHERE c.order_id=o.id) AS tier,
                (SELECT completed_handoff_count FROM core.seller_public_stats
                  WHERE seller_id=$2) AS handoffs
           FROM core."order" o WHERE o.id=$1`,
        [orderId, SELLER],
      );
      expect(o.rows[0]).toMatchObject({
        state: 'HANDED_OFF',
        tier: 'CONFIRMED_BY_BUYER',
        handoffs: 0,
      });
    });
  });

  describe('refunds — reported, then acknowledged, never inferred', () => {
    it('the full loop through a paid order', async () => {
      const o = await createOrder(VE);
      await submitPayment(o);
      await sellerPost(`/v1/seller/orders/${o}/payment/confirm`).send({}).expect(200);
      const card = await request(app.getHttpServer())
        .get(`/v1/orders/${o}`)
        .set('Authorization', `Bearer ${BUYER_S}`)
        .expect(200);
      const rid = card.body.lines[0].id;

      // seller cancels the paid line -> REFUNDED, stock released
      await sellerPost(`/v1/seller/orders/${o}/reservations/${rid}/cancel`)
        .send({})
        .expect(200);
      const line = await admin.query(`SELECT state FROM core.reservation WHERE id=$1`, [rid]);
      expect(line.rows[0].state).toBe('REFUNDED');

      const rep = await sellerPost(`/v1/seller/orders/${o}/refunds`)
        .send({ reservation_id: rid, amount_minor: 250000, currency: 'ETB' })
        .expect(201);
      await buyerPost(`/v1/orders/${o}/refunds/${rep.body.refund_id}/acknowledge`)
        .send({})
        .expect(200);
      const rf = await admin.query(
        `SELECT acknowledged_by_buyer_at FROM core.refund WHERE id=$1`,
        [rep.body.refund_id],
      );
      expect(rf.rows[0].acknowledged_by_buyer_at).not.toBeNull();
    });
  });

  describe('cancellation and the S9.5 cooldown', () => {
    it('three consecutive buyer cancellations trip the cooldown; the next order is 409', async () => {
      for (let i = 0; i < 3; i += 1) {
        const o = await createOrder(VF);
        const card = await request(app.getHttpServer())
          .get(`/v1/orders/${o}`)
          .set('Authorization', `Bearer ${BUYER_S}`)
          .expect(200);
        await buyerPost(`/v1/orders/${o}/reservations/${card.body.lines[0].id}/cancel`)
          .send({})
          .expect(200);
        const derived = await admin.query(`SELECT state FROM core."order" WHERE id=$1`, [o]);
        expect(derived.rows[0].state).toBe('CANCELLED_BY_BUYER');
      }
      // stock came back every time: three orders on VF, three releases
      const stock = await admin.query(
        `SELECT stock_count FROM core.product_variant WHERE id=$1`,
        [VF],
      );
      expect(stock.rows[0].stock_count).toBe(20);

      await buyerPost('/v1/cart/lines').send({ variant_id: VF, quantity: 1 }).expect(201);
      const cart = await request(app.getHttpServer())
        .get('/v1/cart')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .expect(200);
      const r = await buyerPost('/v1/orders')
        .send({
          cart_id: cart.body.cart_id,
          expected: [{ variant_id: VF, unit_price_minor: 250000 }],
        })
        .expect(409);
      expect(r.body.code).toBe('BUYER_COOLDOWN_ACTIVE');
      expect(r.body.slots.until).toBeTruthy();
    });
  });
});
