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
const OWNER_MOBILE_S = '88888888-7777-4000-8000-00000000001b';
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
// T15 Phase 3: four orders across states for bucket + allowed_actions.
const VARIANT_BUCKET_A = '88888888-7777-4000-8000-000000000017';
const VARIANT_BUCKET_B = '88888888-7777-4000-8000-000000000018';
const VARIANT_AA = '88888888-7777-4000-8000-000000000019';
const VARIANT_AB = '88888888-7777-4000-8000-00000000001a';
const VARIANT_RN = '88888888-7777-4000-8000-00000000001c';
const VARIANT_RC = '88888888-7777-4000-8000-00000000001d';
const VARIANT_MO = '88888888-7777-4000-8000-00000000001e';
// T16 Phase 2: dedicated variants for the obligations fixture.
const VARIANT_OB1 = '88888888-7777-4000-8000-000000000021';
const VARIANT_OB2 = '88888888-7777-4000-8000-000000000022';
const VARIANT_OB3 = '88888888-7777-4000-8000-000000000023';
const VARIANT_OB4 = '88888888-7777-4000-8000-000000000027';
// T16 Phase 2: INVENTORY is the role that discriminates the grant filter --
// it holds seller.orders:read and seller.store:read but NOT seller.claims:read
// (the v2.4 seed; ANALYST holds claims:read, which the first draft of the
// filter test learned the hard way). And a CONSOLE stranger, because the
// MOBILE stranger meets the SURFACE gate first (U0001 -> 403, identical for
// everyone) before the relationship gate could 404.
const INV = '88888888-7777-4000-8000-000000000024';
const INV_S = '88888888-7777-4000-8000-000000000025';
const STRANGER_CON_S = '88888888-7777-4000-8000-000000000026';

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
  const sellerGet = (path: string, token = OWNER_S) =>
    request(app.getHttpServer())
      .get(path)
      .set('Cookie', cookie(token))
      .set('X-Adulis-Seller', SELLER);
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
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'C3E','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en', 'ACTIVE', true, 'AFROMESSAGE')`,
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
        ($3,'+251911881003',$5,'ACTIVE'), ($4,'+251911881004',$5,'ACTIVE'),
        ($6,'+251911881005',$5,'ACTIVE')`,
      [OWNER, BUYER, STRANGER, ANALYST, M, INV],
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
       VALUES (gen_random_uuid(), $1, $2, 'ANALYST'),
              (gen_random_uuid(), $1, $3, 'INVENTORY')`,
      [SELLER, ANALYST, INV],
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
        ($12,$4,$5,250000,'ETB','vf'),
        ($13,$4,$5,250000,'ETB','vba'), ($14,$4,$5,250000,'ETB','vbb'),
        ($15,$4,$5,250000,'ETB','vaa'), ($16,$4,$5,250000,'ETB','vab'),
        ($17,$4,$5,250000,'ETB','vrn'), ($18,$4,$5,250000,'ETB','vrc'),
        ($19,$4,$5,250000,'ETB','vmo'),
        ($20,$4,$5,250000,'ETB','vo1'), ($21,$4,$5,250000,'ETB','vo2'),
        ($22,$4,$5,250000,'ETB','vo3'), ($23,$4,$5,250000,'ETB','vo4')`,
      [VARIANT, VARIANT2, V2SELLER2, PRODUCT, SELLER, PRODUCT2, SELLER2,
       VB, VC, VD, VE, VF,
       VARIANT_BUCKET_A, VARIANT_BUCKET_B, VARIANT_AA, VARIANT_AB,
       VARIANT_RN, VARIANT_RC, VARIANT_MO, VARIANT_OB1, VARIANT_OB2, VARIANT_OB3,
       VARIANT_OB4],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       SELECT gen_random_uuid(), v, $1::uuid, 20, 'SELLER_SET'
         FROM unnest($2::uuid[]) v`,
      [SELLER, [VARIANT, VARIANT2, VB, VC, VD, VE, VF,
               VARIANT_BUCKET_A, VARIANT_BUCKET_B, VARIANT_AA, VARIANT_AB,
               VARIANT_RN, VARIANT_RC, VARIANT_MO, VARIANT_OB1, VARIANT_OB2,
               VARIANT_OB3, VARIANT_OB4]],
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
        ($4,$8,'CONSOLE',$9, now()+interval '12 hours'),
        ($10,$5,'MOBILE',$9, now()+interval '30 days'),
        ($11,$12,'CONSOLE',$9, now()+interval '12 hours'),
        ($13,$7,'CONSOLE',$9, now()+interval '12 hours')`,
      [OWNER_S, BUYER_S, STRANGER_S, ANALYST_S, OWNER, BUYER, STRANGER, ANALYST, DEVICE,
       OWNER_MOBILE_S, INV_S, INV, STRANGER_CON_S],
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
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${OWNER}','${BUYER}','${STRANGER}','${ANALYST}','${INV}','${DEVICE}')`,
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
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER}','${BUYER}','${STRANGER}','${ANALYST}','${INV}')`,
      `DELETE FROM core.session WHERE account_id IN ('${OWNER}','${BUYER}','${STRANGER}','${ANALYST}','${INV}')`,
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

  describe('T15 Phase 3 -- bucket and allowed_actions (D-154, D-155)', () => {
    // Orders inserted directly: these tests exercise the SELLER READ shape,
    // not order creation, and the prior describes leave the buyer in an
    // S9.5 cancellation cooldown that would 409 a fresh createOrder.
    const mkOrder = async (variant: string, state: string): Promise<string> => {
      const id = (await admin.query(`SELECT gen_random_uuid() AS id`)).rows[0].id as string;
      const stopped = ['PAYMENT_CONFIRMED', 'HANDED_OFF', 'COMPLETED'].includes(state);
      await admin.query(
        `INSERT INTO core."order"
           (id, market_id, seller_id, buyer_account_id, state, created_at,
            expires_at, clock_stopped_at, total_minor, total_currency,
            display_currency, seller_level_at_order)
         VALUES ($1,$2,$3,$4,$5::core.order_state, now(), now()+interval '48 hours',
                 CASE WHEN $6 THEN now() ELSE NULL END,
                 250000, 'ETB', 'ETB', 'NEW')`,
        [id, M, SELLER, BUYER, state, stopped],
      );
      await admin.query(
        `INSERT INTO core.reservation
           (id, order_id, variant_id, seller_id, buyer_account_id, quantity,
            unit_price_minor, unit_price_currency, state, active_window)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 1, 250000, 'ETB',
                 'ACTIVE', tstzrange(now(), now()+interval '48 hours', '[)'))`,
        [id, variant, SELLER, BUYER],
      );
      return id;
    };
    const withSubmission = async (id: string): Promise<void> => {
      await admin.query(
        `INSERT INTO core.payment_submission (id, order_id, submitted_at, evidence_ref, state)
         VALUES (gen_random_uuid(), $1, now(), gen_random_uuid(), 'SUBMITTED')`,
        [id],
      );
    };

    it('the bucket is resolved SERVER-SIDE by state, not client-filtered', async () => {
      const paid = await mkOrder(VARIANT_BUCKET_A, 'PAYMENT_CONFIRMED');
      const created = await mkOrder(VARIANT_BUCKET_B, 'CREATED');

      const needs = await sellerGet('/v1/seller/orders?bucket=needs_action').expect(200);
      const needsIds = needs.body.data.map((o: { id: string }) => o.id);
      expect(needsIds).toContain(paid); // PAYMENT_CONFIRMED is needs_action
      expect(needsIds).not.toContain(created); // CREATED is not

      const active = await sellerGet('/v1/seller/orders?bucket=active').expect(200);
      const activeIds = active.body.data.map((o: { id: string }) => o.id);
      expect(activeIds).toContain(paid);
      expect(activeIds).toContain(created); // both non-terminal

      // A bucket the SERVER does not define is refused at the edge -- the
      // client cannot smuggle a state filter through the parameter.
      const bad = await sellerGet('/v1/seller/orders?bucket=PAYMENT_CONFIRMED').expect(400);
      expect(bad.body.code).toBe('VALIDATION_FAILED');
      expect(bad.body.slots.path).toBe('bucket');
    });

    it('allowed_actions is the grant set INTERSECTED with state, never a client union', async () => {
      // OWNER holds every order permission; ANALYST holds seller.orders:read
      // and nothing else. The SAME order in the SAME state yields DIFFERENT
      // allowed_actions -- which a client ORing its own guess could not.
      const o = await mkOrder(VARIANT_AA, 'PAYMENT_SUBMITTED');
      await withSubmission(o);

      const owner = await sellerGet(`/v1/seller/orders/${o}`).expect(200);
      expect(owner.body.allowed_actions).toContain('seller.payment:confirm');
      expect(owner.body.allowed_actions).toContain('seller.payment_evidence:read');

      const analyst = await sellerGet(`/v1/seller/orders/${o}`, ANALYST_S).expect(200);
      // ANALYST READS the order (200) and holds none of the acting grants:
      // the intersection is empty, so the console renders no control. A
      // state-only client would show the confirm button here.
      expect(analyst.body.allowed_actions).not.toContain('seller.payment:confirm');
      expect(analyst.body.allowed_actions).toEqual([]);
    });

    it('reissue_instructions matches the FUNCTION state gate, not a guessed one', async () => {
      // fn_reissue_instructions accepts CREATED/NOTIFIED/PAYMENT_SUBMITTED and
      // 409s otherwise. The pass caught the first predicate wrong at BOTH ends.
      const notified = await mkOrder(VARIANT_RN, 'NOTIFIED');
      const rN = await sellerGet(`/v1/seller/orders/${notified}`).expect(200);
      // PRESENT in NOTIFIED -- a seller who changed banks must reissue before
      // the buyer pays. A state-only guess that keyed on "submitted" hid it.
      expect(rN.body.allowed_actions).toContain('seller.orders:reissue_instructions');

      const confirmed = await mkOrder(VARIANT_RC, 'PAYMENT_CONFIRMED');
      const rC = await sellerGet(`/v1/seller/orders/${confirmed}`).expect(200);
      // ABSENT in PAYMENT_CONFIRMED -- the function 409s there, so offering it
      // is a control that errors on tap.
      expect(rC.body.allowed_actions).not.toContain('seller.orders:reissue_instructions');
    });

    it('the surface filter excludes console-only actions on a MOBILE seller session', async () => {
      // OWNER holds every grant; on MOBILE the console-only codes must drop
      // out, because the write path would 403 them there -- the one place a
      // Seller Companion could over-render a control it cannot exercise.
      const o = await mkOrder(VARIANT_MO, 'PAYMENT_CONFIRMED');
      const mobile = await request(app.getHttpServer())
        .get(`/v1/seller/orders/${o}`)
        .set('Authorization', `Bearer ${OWNER_MOBILE_S}`)
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      // MOBILE-reachable stays; CONSOLE-only goes.
      expect(mobile.body.allowed_actions).not.toContain('seller.couriers:manage');
      expect(mobile.body.allowed_actions).not.toContain('seller.handoff:custody_transfer');
      expect(mobile.body.allowed_actions).not.toContain('seller.orders:reissue_instructions');
      // And a CONSOLE session on the same order DOES carry couriers:manage,
      // proving the difference is the surface, not the state.
      const console = await sellerGet(`/v1/seller/orders/${o}`).expect(200);
      expect(console.body.allowed_actions).toContain('seller.couriers:manage');
    });

    it('allowed_actions is STATE-gated too: confirm is absent once the order is terminal', async () => {
      const o = await mkOrder(VARIANT_AB, 'COMPLETED');
      const r = await sellerGet(`/v1/seller/orders/${o}`).expect(200);
      // OWNER still holds the grant; the terminal state admits neither action.
      expect(r.body.allowed_actions).not.toContain('seller.payment:confirm');
      expect(r.body.allowed_actions).not.toContain('seller.orders:respond');
    });
  });


  describe('T16 Phase 2 -- GET /v1/seller/obligations (S12.12b)', () => {
    /*
     * THE STRONGEST ASSERTION IS THE ORDERING: three obligations of three
     * DIFFERENT kinds, deadlines interleaved so that no per-kind grouping,
     * insertion order or client-side sort could reproduce it by accident --
     * ORDER_NOT_READY at +2h (a DERIVED deadline), the payment at +4h (a
     * STORED one), the claim at +12h. Orders are inserted directly (the
     * T15 pattern -- this fixture tests the READ, not order creation).
     */
    let NR = ''; // PAYMENT_CONFIRMED, unready -- deadline now()+2h (derived)
    let PA = ''; // PAYMENT_SUBMITTED             -- deadline now()+4h (stored)
    let CLAIM_ORDER = '';
    let CLAIM = '';

    const insertOrder = async (variant: string, state: string): Promise<string> => {
      const id = (await admin.query(`SELECT gen_random_uuid() AS id`)).rows[0].id as string;
      const stopped = ['PAYMENT_CONFIRMED', 'HANDED_OFF', 'COMPLETED'].includes(state);
      await admin.query(
        `INSERT INTO core."order"
           (id, market_id, seller_id, buyer_account_id, state, created_at,
            expires_at, clock_stopped_at, total_minor, total_currency,
            display_currency, seller_level_at_order)
         VALUES ($1,$2,$3,$4,$5::core.order_state, now(), now()+interval '48 hours',
                 CASE WHEN $6 THEN now() ELSE NULL END,
                 250000, 'ETB', 'ETB', 'NEW')`,
        [id, M, SELLER, BUYER, state, stopped],
      );
      await admin.query(
        `INSERT INTO core.reservation
           (id, order_id, variant_id, seller_id, buyer_account_id, quantity,
            unit_price_minor, unit_price_currency, state, active_window)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 1, 250000, 'ETB',
                 'ACTIVE', tstzrange(now(), now()+interval '48 hours', '[)'))`,
        [id, variant, SELLER, BUYER],
      );
      return id;
    };

    const get = (token = OWNER_S, seller = SELLER) =>
      request(app.getHttpServer())
        .get('/v1/seller/obligations')
        .set('Cookie', cookie(token))
        .set('X-Adulis-Seller', seller);

    beforeAll(async () => {
      // ORDER_NOT_READY: confirmed 70h ago against a 72h fulfilment window
      // -> the DERIVED deadline lands ~now()+2h, NEAREST of the three.
      NR = await insertOrder(VARIANT_OB1, 'PAYMENT_CONFIRMED');
      await admin.query(
        `UPDATE core."order" SET clock_stopped_at = now() - interval '70 hours' WHERE id=$1`,
        [NR],
      );
      // PAYMENT_AWAITING_CONFIRMATION: an open submission with its STORED
      // sla_deadline at now()+4h -- the same column the SC-03 clock renders.
      PA = await insertOrder(VARIANT_OB2, 'PAYMENT_SUBMITTED');
      await admin.query(
        `INSERT INTO core.payment_submission
           (id, order_id, submitted_at, evidence_ref, state, sla_deadline)
         VALUES (gen_random_uuid(), $1, now(), gen_random_uuid(), 'SUBMITTED',
                 now() + interval '4 hours')`,
        [PA],
      );
      // CLAIM_AWAITING_SELLER on a third order, review_deadline now()+12h.
      CLAIM_ORDER = await insertOrder(VARIANT_OB3, 'COMPLETED');
      const c = await admin.query(
        `INSERT INTO core.claim
           (order_id, opened_by_kind, opened_by_account_id, trigger, state,
            severity, review_deadline)
         VALUES ($1, 'BUYER', $2, 'GOODS_NOT_RECEIVED',
                 'AWAITING_SELLER_EVIDENCE', 'ORDINARY', now() + interval '12 hours')
         RETURNING id`,
        [CLAIM_ORDER, BUYER],
      );
      CLAIM = c.rows[0].id as string;
    });

    afterAll(async () => {
      // c3's global teardown deletes orders by seller; a surviving claim row
      // would block that on its FK, so the claim leaves first -- under
      // replica mode, the same trigger bypass the global teardown uses,
      // because claim_evidence_item is append-only by trigger.
      await admin.query(`SET session_replication_role = replica`);
      await admin.query(`DELETE FROM core.claim_evidence_item WHERE claim_id=$1`, [CLAIM]);
      await admin.query(`DELETE FROM core.claim WHERE id=$1`, [CLAIM]);
      await admin.query(`SET session_replication_role = DEFAULT`);
    });

    it('three kinds, NEAREST DEADLINE FIRST, each entry complete', async () => {
      const r = await get().expect(200);
      const mine = r.body.data.filter((e: { object_id: string }) =>
        [NR, PA, CLAIM].includes(e.object_id),
      );
      // The interleaved ordering no grouping or client sort reproduces:
      // derived(+2h), stored(+4h), claim(+12h).
      expect(mine.map((e: { kind: string }) => e.kind)).toEqual([
        'ORDER_NOT_READY',
        'PAYMENT_AWAITING_CONFIRMATION',
        'CLAIM_AWAITING_SELLER',
      ]);
      expect(mine.map((e: { object_id: string }) => e.object_id)).toEqual([NR, PA, CLAIM]);
      // Strictly ascending deadlines across the WHOLE response, not just ours.
      const all = r.body.data.map((e: { deadline: string }) => Date.parse(e.deadline));
      expect([...all].sort((a: number, b: number) => a - b)).toEqual(all);
      for (const e of mine) {
        expect(e.object_kind).toBe(e.kind === 'CLAIM_AWAITING_SELLER' ? 'CLAIM' : 'ORDER');
        expect(Number.isNaN(Date.parse(e.deadline))).toBe(false);
        // consequence_key is DERIVED from the kind, S7.2-style -- the console
        // renders the server's sentence and composes nothing.
        expect(e.consequence_key).toBe(`obligation.${e.kind.toLowerCase()}.consequence`);
      }
    });

    it('the deadlines are the SOURCE values, never recomputed elsewhere', async () => {
      const r = await get().expect(200);
      const byId = new Map(
        r.body.data.map((e: { object_id: string; deadline: string }) => [e.object_id, e.deadline]),
      );
      // The payment entry's deadline IS payment_submission.sla_deadline.
      const sla = await admin.query(
        `SELECT sla_deadline FROM core.payment_submission
          WHERE order_id=$1 AND state='SUBMITTED'`,
        [PA],
      );
      expect(byId.get(PA)).toBe(new Date(sla.rows[0].sla_deadline).toISOString());
      // The not-ready deadline IS clock_stopped_at + fulfilment_window,
      // computed by Postgres against the market's timing_config.
      const derived = await admin.query(
        `SELECT o.clock_stopped_at + tc.fulfilment_window AS dl
           FROM core."order" o
           JOIN core.seller s ON s.id = o.seller_id
           JOIN core.timing_config tc ON tc.market_id = s.market_id AND tc.effective @> now()
          WHERE o.id=$1`,
        [NR],
      );
      expect(byId.get(NR)).toBe(new Date(derived.rows[0].dl).toISOString());
    });

    it('entries are FILTERED by the grant set: INVENTORY sees orders, never the claim', async () => {
      // INVENTORY holds seller.orders:read and NOT seller.claims:read (the
      // v2.4 matrix) -- a role that cannot read claims must not learn one
      // exists from this list. (ANALYST was the first draft's pick and DOES
      // hold claims:read; the failing run corrected the fixture, not the rule.)
      const r = await get(INV_S).expect(200);
      const kinds = r.body.data.map((e: { kind: string }) => e.kind);
      expect(kinds).toContain('ORDER_NOT_READY');
      expect(kinds).toContain('PAYMENT_AWAITING_CONFIRMATION');
      expect(kinds).not.toContain('CLAIM_AWAITING_SELLER');
    });

    it('MOBILE is 403 (store:read is CONSOLE-only); a CONSOLE stranger is 404', async () => {
      await request(app.getHttpServer())
        .get('/v1/seller/obligations')
        .set('Authorization', `Bearer ${OWNER_MOBILE_S}`)
        .set('X-Adulis-Seller', SELLER)
        .expect(403);
      // A CONSOLE stranger passes the surface gate and fails the relationship
      // gate: U0002 -> 404, never confirming the seller exists (S19). (A
      // MOBILE stranger meets the surface gate FIRST -- U0001 -> 403,
      // identical for members and strangers alike, so no oracle.)
      await get(STRANGER_CON_S).expect(404);
    });

    it('an empty list is a 200 with an empty array, not a 404', async () => {
      const r = await get(OWNER_S, SELLER2).expect(200);
      expect(r.body).toEqual({ data: [] });
    });

    it('acting on an obligation REMOVES it: marking the order ready', async () => {
      await request(app.getHttpServer())
        .post(`/v1/seller/orders/${NR}/ready`)
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .send({})
        .expect(200);
      const r = await get().expect(200);
      const ids = r.body.data.map((e: { object_id: string }) => e.object_id);
      expect(ids).not.toContain(NR);
      expect(ids).toContain(PA); // the others stand
      expect(ids).toContain(CLAIM);
    });

    it('POST-LAPSE (pass F1): the stale entry switches its sentence instead of lying forever', async () => {
      /*
       * fn_confirmation_window_lapse leaves the order in PAYMENT_SUBMITTED,
       * so a missed window keeps its payment entry -- overdue, first, and the
       * decision still owed -- beside the new SYSTEM claim. The pre-lapse
       * sentence ("a claim opens automatically...") would then promise, in
       * the future tense and forever, what already happened and cannot happen
       * again. The entry must carry the LAPSED consequence key.
       */
      const LP = await insertOrder(VARIANT_OB4, 'PAYMENT_SUBMITTED');
      await admin.query(
        `INSERT INTO core.payment_submission
           (id, order_id, submitted_at, evidence_ref, state, sla_deadline)
         VALUES (gen_random_uuid(), $1, now() - interval '25 hours',
                 gen_random_uuid(), 'SUBMITTED', now() - interval '1 hour')`,
        [LP],
      );
      const lc = await admin.query(
        `INSERT INTO core.claim
           (order_id, opened_by_kind, trigger, state, severity, review_deadline)
         VALUES ($1, 'SYSTEM', 'SLA_BREACH', 'AWAITING_SELLER_EVIDENCE',
                 'ORDINARY', now() + interval '2 days')
         RETURNING id`,
        [LP],
      );
      const lapseClaim = lc.rows[0].id as string;

      const r = await get().expect(200);
      const entries = r.body.data.filter(
        (e: { object_id: string }) => e.object_id === LP || e.object_id === lapseClaim,
      );
      // BOTH situations list: the payment decision still owed, and the claim.
      expect(entries.map((e: { kind: string }) => e.kind).sort()).toEqual([
        'CLAIM_AWAITING_SELLER',
        'PAYMENT_AWAITING_CONFIRMATION',
      ]);
      const payment = entries.find((e: { object_id: string }) => e.object_id === LP);
      // Overdue -> the payment entry sorts FIRST in the whole list.
      expect(r.body.data[0].object_id).toBe(LP);
      // The sentence switched: no future-tense promise of a claim that
      // already opened.
      expect(payment.consequence_key).toBe(
        'obligation.payment_awaiting_confirmation.consequence_lapsed',
      );
      // And a NON-lapsed payment entry still carries the pre-lapse key.
      const fresh = r.body.data.find((e: { object_id: string }) => e.object_id === PA);
      expect(fresh.consequence_key).toBe(
        'obligation.payment_awaiting_confirmation.consequence',
      );

      // Leave the world as found (the claim would block the global teardown).
      await admin.query(`SET session_replication_role = replica`);
      await admin.query(`DELETE FROM core.claim_evidence_item WHERE claim_id=$1`, [lapseClaim]);
      await admin.query(`DELETE FROM core.claim WHERE id=$1`, [lapseClaim]);
      await admin.query(`SET session_replication_role = DEFAULT`);
    });
  });

});
