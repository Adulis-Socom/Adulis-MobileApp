import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { encryptFramed, keyForRef } from '../src/common/crypto/aead';
import {
  FakeFinancialStorageAdapter,
  FINANCIAL_STORAGE_ADAPTER,
} from '../src/modules/financial/financial-storage.adapter';

/**
 * Phase D — the three API-level loads of ADU-CON-02-A1 section 6:
 *
 *   (1) order creation on ONE hot variant at 50/100/200 concurrent buyers —
 *       the real transaction hold, the queueing curve, and the overselling
 *       proof: with stock 300 and 350 attempts, exactly 300 succeed and the
 *       count never goes negative (it is a CHECK, not a race);
 *   (5) evidence streaming at 100 concurrent viewers — R18's flat memory:
 *       framed decryption is a generator, so a hundred 2MB streams must not
 *       buffer two hundred megabytes;
 *   (6) the pooled-connection settings-leak test under load — interleaved
 *       identities on one pool must never cross, which is the invariant
 *       everything else stands on.
 *
 * Run separately from the suite:  pnpm --filter @adulis/api test:load
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = 'ffffaaaa-0000-4000-8000-000000000001';
const OWNER = 'ffffaaaa-0000-4000-8000-000000000002';
const COURIER_ACC = 'ffffaaaa-0000-4000-8000-000000000003';
const SELLER = 'ffffaaaa-0000-4000-8000-000000000004';
const PRODUCT = 'ffffaaaa-0000-4000-8000-000000000005';
const VARIANT = 'ffffaaaa-0000-4000-8000-000000000006';
const OWNER_S = 'ffffaaaa-0000-4000-8000-000000000007';
const COURIER_S = 'ffffaaaa-0000-4000-8000-000000000008';
const EV_ORDER = 'ffffaaaa-0000-4000-8000-000000000009';
const EV_BUYER = 'ffffaaaa-0000-4000-8000-00000000000a';
const EV_ID = 'ffffaaaa-0000-4000-8000-00000000000b';
const AS_ORDER = 'ffffaaaa-0000-4000-8000-00000000000c'; // courier-assigned

const STOCK = 300;
const WAVES = [50, 100, 200];
const TOTAL_BUYERS = WAVES.reduce((a, b) => a + b, 0);

const storage = new FakeFinancialStorageAdapter();

@Module({ imports: [AppModule] })
class LoadAppModule {}

interface Buyer {
  account: string;
  session: string;
  device: string;
  cart: string;
}

jest.setTimeout(600000);

describe('Phase D — API loads (A1 section 6)', () => {
  let app: INestApplication;
  let admin: Pool;
  const buyers: Buyer[] = [];

  const http = () => request(app.getHttpServer());
  const cookie = (t: string) => `__Host-adulis_session=${t}`;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
         display_timezone, default_locale)
       VALUES ($1,'LDA','LoadApi','PHASE_1','ETB','Africa/Addis_Ababa','en')`,
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
        ($1,'+251911881701',$4,'ACTIVE'), ($2,'+251911881702',$4,'ACTIVE'),
        ($3,'+251911881703',$4,'ACTIVE')`,
      [OWNER, COURIER_ACC, EV_BUYER, M],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
         store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','Load Store','load-api-store','ACTIVE')`,
      [SELLER, M, OWNER],
    );
    // ESTABLISHED: the NEW-level caps are not what this load measures.
    await admin.query(
      `INSERT INTO core.seller_level_state (seller_id, level) VALUES ($1,'ESTABLISHED')`,
      [SELLER],
    );
    await admin.query(
      `INSERT INTO core.payout_details (id, seller_id, bank_code, account_last4,
         state, activated_at, requested_by_account_id)
       VALUES (gen_random_uuid(), $1,'CBE','9999','ACTIVE', now(), $2)`,
      [SELLER, OWNER],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor,
         base_price_currency, visibility)
       VALUES ($1,$2,$3,'Hot variant',5000,'ETB','PUBLISHED')`,
      [PRODUCT, SELLER, M],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
         price_currency, variant_key)
       VALUES ($1,$2,$3,5000,'ETB','hot')`,
      [VARIANT, PRODUCT, SELLER],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       VALUES (gen_random_uuid(),$1,$2,${STOCK},'SELLER_SET')`,
      [VARIANT, SELLER],
    );

    // The buyer fleet: account + device + MOBILE session + ACTIVE cart with
    // one line on the hot variant, in four bulk statements.
    for (let i = 0; i < TOTAL_BUYERS; i += 1) {
      buyers.push({
        account: randomUUID(),
        session: randomUUID(),
        device: randomUUID(),
        cart: randomUUID(),
      });
    }
    const accountIds = buyers.map((b) => b.account);
    const phones = buyers.map((_, i) => `+2519119${String(10000 + i).slice(-5)}`);
    const deviceIds = buyers.map((b) => b.device);
    const sessionIds = buyers.map((b) => b.session);
    const cartIds = buyers.map((b) => b.cart);
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status)
       SELECT a, p, $3, 'ACTIVE' FROM unnest($1::uuid[], $2::text[]) AS t(a, p)`,
      [accountIds, phones, M],
    );
    await admin.query(
      `INSERT INTO core.device (id, platform)
       SELECT d, 'ANDROID' FROM unnest($1::uuid[]) AS t(d)`,
      [deviceIds],
    );
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at)
       SELECT s, a, 'MOBILE', d, now() + interval '1 day'
         FROM unnest($1::uuid[], $2::uuid[], $3::uuid[]) AS t(s, a, d)`,
      [sessionIds, accountIds, deviceIds],
    );
    await admin.query(
      `INSERT INTO core.cart (id, device_id, buyer_account_id, seller_id, market_id)
       SELECT c, d, a, $4, $5
         FROM unnest($1::uuid[], $2::uuid[], $3::uuid[]) AS t(c, d, a)`,
      [cartIds, deviceIds, accountIds, SELLER, M],
    );
    await admin.query(
      `INSERT INTO core.cart_line (id, cart_id, seller_id, variant_id, quantity)
       SELECT gen_random_uuid(), c, $2, $3, 1 FROM unnest($1::uuid[]) AS t(c)`,
      [cartIds, SELLER, VARIANT],
    );

    // Evidence fixture: a submitted order whose framed 2MB blob streams back.
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$3,'CONSOLE',NULL, now()+interval '12 hours'),
        ($2,$4,'CONSOLE',NULL, now()+interval '12 hours')`,
      [OWNER_S, COURIER_S, OWNER, COURIER_ACC],
    );
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state,
         total_minor, total_currency, display_currency, expires_at, clock_stopped_at) VALUES
        ($1,$3,$4,$5,'PAYMENT_SUBMITTED',5000,'ETB','ETB', now()+interval '1 day', NULL),
        ($2,$3,$4,$5,'PAYMENT_CONFIRMED',5000,'ETB','ETB', now()+interval '1 day', now())`,
      [EV_ORDER, AS_ORDER, M, SELLER, EV_BUYER],
    );
    const plaintext = Buffer.alloc(2 * 1024 * 1024, 7);
    const framed = encryptFramed(plaintext, keyForRef('EVID_V1'));
    const objectKey = `evidence/framed/${EV_ORDER}/load`;
    await storage.putObject(objectKey, framed.payload);
    await admin.query(
      `INSERT INTO financial.payment_evidence
         (id, order_id, object_key, encryption_key_ref, frame_size_bytes, frame_count)
       VALUES ($1,$2,$3,'EVID_V1',$4,$5)`,
      [EV_ID, EV_ORDER, objectKey, framed.frameSize, framed.frameCount],
    );
    await admin.query(
      `INSERT INTO core.payment_submission (id, order_id, evidence_ref)
       VALUES (gen_random_uuid(), $1, $2)`,
      [EV_ORDER, EV_ID],
    );
    await admin.query(
      `INSERT INTO core.seller_courier (id, seller_id, account_id)
       VALUES (gen_random_uuid(), $1, $2)`,
      [SELLER, COURIER_ACC],
    );
    await admin.query(
      `INSERT INTO core.order_courier_assignment (order_id, courier_account_id)
       VALUES ($1, $2)`,
      [AS_ORDER, COURIER_ACC],
    );
    await admin.query(`SET session_replication_role = DEFAULT`);

    const moduleRef = await Test.createTestingModule({ imports: [LoadAppModule] })
      .overrideProvider(FINANCIAL_STORAGE_ADAPTER)
      .useValue(storage)
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
      `DELETE FROM core.seller_courier WHERE seller_id='${SELLER}'`,
      `DELETE FROM financial.access_log WHERE subject_id='${EV_ID}'`,
      `DELETE FROM financial.payment_evidence WHERE id='${EV_ID}'`,
      `DELETE FROM core.payment_submission WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.stock_event WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.reservation WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.order_payout_snapshot WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.notification WHERE recipient_account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.order_state_transition WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core."order" WHERE market_id='${M}'`,
      `DELETE FROM core.cart_line WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.cart WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.payout_change_log WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.payout_details WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.product_variant WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.product WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_level_state WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_eligibility_evaluation WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller WHERE id='${SELLER}'`,
      `DELETE FROM core.session WHERE account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.idempotency_record WHERE actor_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.buyer_cancellation_counter WHERE buyer_account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.buyer_profile WHERE account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.device WHERE id IN (SELECT device_id FROM core.session WHERE account_id IN (SELECT id FROM core.account WHERE market_id='${M}'))`,
      `DELETE FROM core.device WHERE account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.account WHERE market_id='${M}'`,
      `DELETE FROM core.ladder_config WHERE market_id='${M}'`,
      `DELETE FROM core.timing_config WHERE market_id='${M}'`,
      `DELETE FROM core.market WHERE id='${M}'`,
    ]) {
      await admin.query(q);
    }
    // The buyer devices are unbound; the session join above misses none,
    // but sweep by id prefix-free: delete any leftovers by explicit ids.
    await admin.query(`DELETE FROM core.device WHERE id = ANY($1::uuid[])`, [
      buyers.map((b) => b.device),
    ]);
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
    await app.close();
  });

  it('(1) one hot variant, 50/100/200 concurrent buyers: queueing curve, exact stock', async () => {
    let cursor = 0;
    const waveResults: Record<string, unknown>[] = [];
    let created = 0;
    let conflicts = 0;

    for (const wave of WAVES) {
      const slice = buyers.slice(cursor, cursor + wave);
      cursor += wave;
      const latencies: number[] = [];
      const t0 = Date.now();
      const outcomes = await Promise.all(
        slice.map(async (b) => {
          const s = Date.now();
          const r = await http()
            .post('/v1/orders')
            .set('Authorization', `Bearer ${b.session}`)
            .set('X-Adulis-Device', b.device)
            .set('Idempotency-Key', randomUUID())
            .send({
              cart_id: b.cart,
              expected: [{ variant_id: VARIANT, unit_price_minor: 5000 }],
            });
          latencies.push(Date.now() - s);
          return r.status;
        }),
      );
      const wall = Date.now() - t0;
      const ok = outcomes.filter((s) => s === 201).length;
      const conflict = outcomes.filter((s) => s === 409).length;
      created += ok;
      conflicts += conflict;
      // Nothing but success or the documented conflict, ever.
      expect(outcomes.every((s) => s === 201 || s === 409)).toBe(true);
      latencies.sort((a, b) => a - b);
      waveResults.push({
        concurrent: wave,
        wall_ms: wall,
        ok,
        conflict,
        p50_ms: latencies[Math.floor(latencies.length * 0.5)],
        p95_ms: latencies[Math.floor(latencies.length * 0.95)],
        max_ms: latencies[latencies.length - 1],
      });
    }

    const stock = await admin.query(
      `SELECT stock_count FROM core.product_variant WHERE id=$1`,
      [VARIANT],
    );
    // The overselling proof: 350 attempts, 300 units — exactly 300 orders,
    // stock exactly zero, and the count was never negative because the
    // CHECK makes that a transaction failure, not a number.
    expect(created).toBe(STOCK);
    expect(conflicts).toBe(TOTAL_BUYERS - STOCK);
    expect(stock.rows[0].stock_count).toBe(0);
    const negatives = await admin.query(
      `SELECT count(*)::int AS n FROM core.stock_event
        WHERE variant_id=$1 AND resulting_count < 0`,
      [VARIANT],
    );
    expect(negatives.rows[0].n).toBe(0);

    console.log('A1 6.1 hot-variant waves:', JSON.stringify(waveResults));
  });

  it('(5) evidence streaming at 100 concurrent viewers holds flat memory (R18)', async () => {
    // Warm once, then measure RSS across 100 concurrent 2MB streams.
    await http()
      .get(`/v1/seller/orders/${EV_ORDER}/payment-evidence`)
      .set('Cookie', cookie(OWNER_S))
      .set('X-Adulis-Seller', SELLER)
      .expect(200);
    global.gc?.();
    const before = process.memoryUsage().rss;
    let peak = before;
    const tick = setInterval(() => {
      const rss = process.memoryUsage().rss;
      if (rss > peak) peak = rss;
    }, 10);
    const t0 = Date.now();
    const responses = await Promise.all(
      Array.from({ length: 100 }, () =>
        http()
          .get(`/v1/seller/orders/${EV_ORDER}/payment-evidence`)
          .set('Cookie', cookie(OWNER_S))
          .set('X-Adulis-Seller', SELLER)
          .buffer(true)
          .parse((res, cb) => {
            // Count bytes without retaining them — the CLIENT must not be
            // the thing that buffers 200MB either.
            let bytes = 0;
            res.on('data', (chunk: Buffer) => {
              bytes += chunk.length;
            });
            res.on('end', () => cb(null, bytes));
          }),
      ),
    );
    const wall = Date.now() - t0;
    clearInterval(tick);
    for (const r of responses) {
      expect(r.status).toBe(200);
      expect(r.body).toBe(2 * 1024 * 1024);
    }
    const grewMb = (peak - before) / (1024 * 1024);
    console.log(
      `A1 6.5 evidence streaming: 100 x 2MB in ${wall}ms, rss growth ${grewMb.toFixed(1)}MB`,
    );
    // Fully buffered would hold ~200MB of plaintext alone; the generator
    // path plus supertest overhead must stay far below it.
    expect(grewMb).toBeLessThan(150);
  });

  it('(6) two identities interleaved on one pool never cross (the settings leak)', async () => {
    const buyer = buyers[0] as Buyer; // holds exactly one order from wave 1
    const rounds = 150;
    const checks = await Promise.all(
      Array.from({ length: rounds }, async (_, i) => {
        if (i % 2 === 0) {
          const r = await http()
            .get('/v1/orders')
            .set('Authorization', `Bearer ${buyer.session}`)
            .set('X-Adulis-Device', buyer.device)
            .expect(200);
          // The buyer's list is exactly their one wave-1 order — a leaked
          // context would show the fleet's hundreds, or someone else's.
          return r.body.data.length === 1;
        }
        const r = await http()
          .get('/v1/courier/orders')
          .set('Cookie', cookie(COURIER_S))
          .expect(200);
        // The courier's RLS-backed list is exactly the one assigned order,
        // never the buyer fleet's 300.
        return (
          r.body.data.length === 1 &&
          (r.body.data[0] as { id: string }).id === AS_ORDER
        );
      }),
    );
    expect(checks.every(Boolean)).toBe(true);
  });
});
