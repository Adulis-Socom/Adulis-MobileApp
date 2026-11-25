import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { armFixtureSessions, sessionToken } from '../test/session-fixture';

/**
 * Phase D — the API-level loads of ADU-CON-02-A1 section 6 that survive the
 * Reservation retirement (migration 0063). Order creation (1) and evidence
 * streaming (5) had no route left to load; their successors here:
 *
 *   (1) cart writes on ONE hot variant at 50/100/200 concurrent buyers — the
 *       queueing curve, and Checkout Option A's proof: with stock 300 and 350
 *       buyers every add succeeds, because a Cart never holds stock, and the
 *       count, the stock ledger and the Order table do not move;
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
const SELLER = 'ffffaaaa-0000-4000-8000-000000000004';
const PRODUCT = 'ffffaaaa-0000-4000-8000-000000000005';
const VARIANT = 'ffffaaaa-0000-4000-8000-000000000006';
const OWNER_S = 'ffffaaaa-0000-4000-8000-000000000007';

const STOCK = 300;
const WAVES = [50, 100, 200];
const TOTAL_BUYERS = WAVES.reduce((a, b) => a + b, 0);

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
  const cookie = (t: string) => `__Host-adulis_session=${sessionToken(t)}`;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
         display_timezone, default_locale)
       VALUES ($1,'LDA','LoadApi','PHASE_1','ETB','Africa/Addis_Ababa','en')`,
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
         0.01,0.05,0.25,0.5,'60 days',10,50000000,'30 days',5)`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251911881701',$2,'ACTIVE')`,
      [OWNER, M],
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
    await armFixtureSessions(admin, sessionIds);
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

    // The seller's console session: the second identity of (6).
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at)
       VALUES ($1,$2,'CONSOLE',NULL, now()+interval '12 hours')`,
      [OWNER_S, OWNER],
    );
    await armFixtureSessions(admin, [OWNER_S]);
    await admin.query(`SET session_replication_role = DEFAULT`);

    const moduleRef = await Test.createTestingModule({ imports: [LoadAppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.stock_event WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.notification WHERE recipient_account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.cart_line WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.cart WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.product_variant WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.product WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_level_state WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_eligibility_evaluation WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller WHERE id='${SELLER}'`,
      `DELETE FROM core.session WHERE account_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
      `DELETE FROM core.idempotency_record WHERE actor_id IN (SELECT id FROM core.account WHERE market_id='${M}')`,
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

  it('(1) one hot variant, 50/100/200 concurrent buyers adding to their carts: no stock is held', async () => {
    const ledger = async () =>
      (
        await admin.query(
          `SELECT (SELECT stock_count FROM core.product_variant WHERE id = $1) AS stock,
                  (SELECT count(*)::int FROM core.stock_event WHERE variant_id = $1) AS events,
                  (SELECT count(*)::int FROM core."order" WHERE market_id = $2) AS orders`,
          [VARIANT, M],
        )
      ).rows[0];
    const before = await ledger();
    let cursor = 0;
    let added = 0;
    const waveResults: Record<string, unknown>[] = [];

    for (const wave of WAVES) {
      const slice = buyers.slice(cursor, cursor + wave);
      cursor += wave;
      const latencies: number[] = [];
      const t0 = Date.now();
      const outcomes = await Promise.all(
        slice.map(async (b) => {
          const s = Date.now();
          const r = await http()
            .post('/v1/cart/lines')
            .set('Authorization', `Bearer ${sessionToken(b.session)}`)
            .set('X-Adulis-Device', b.device)
            .set('Idempotency-Key', randomUUID())
            .send({ variant_id: VARIANT, quantity: 1 });
          latencies.push(Date.now() - s);
          return r.status;
        }),
      );
      const wall = Date.now() - t0;
      const ok = outcomes.filter((st) => st === 201).length;
      added += ok;
      latencies.sort((a, b) => a - b);
      waveResults.push({
        concurrent: wave,
        wall_ms: wall,
        ok,
        p50_ms: latencies[Math.floor(latencies.length * 0.5)],
        p95_ms: latencies[Math.floor(latencies.length * 0.95)],
        max_ms: latencies[latencies.length - 1],
      });
    }

    // 350 buyers, 300 units, and every add succeeds: a Cart is not a hold
    // (Checkout Option A), so there is nothing to run out of.
    expect(added).toBe(TOTAL_BUYERS);
    expect(await ledger()).toEqual(before);
    expect(before.stock).toBe(STOCK);
    expect(before.orders).toBe(0);
    const negatives = await admin.query(
      `SELECT count(*)::int AS n FROM core.stock_event
        WHERE variant_id=$1 AND resulting_count < 0`,
      [VARIANT],
    );
    expect(negatives.rows[0].n).toBe(0);

    console.log('A1 6.1 hot-variant cart waves:', JSON.stringify(waveResults));
  });

  it('(6) two identities interleaved on one pool never cross (the settings leak)', async () => {
    const buyer = buyers[0] as Buyer;
    const rounds = 150;
    const checks = await Promise.all(
      Array.from({ length: rounds }, async (_, i) => {
        if (i % 2 === 0) {
          const r = await http()
            .get('/v1/cart')
            .set('Authorization', `Bearer ${sessionToken(buyer.session)}`)
            .set('X-Adulis-Device', buyer.device)
            .expect(200);
          // The buyer's own cart and no one else's -- a leaked context would
          // resolve another account's cart, or none.
          return r.body.cart_id === buyer.cart;
        }
        const r = await http()
          .get('/v1/seller/products')
          .set('Cookie', cookie(OWNER_S))
          .set('X-Adulis-Seller', SELLER)
          .expect(200);
        // The seller's RLS-scoped list is exactly its one Product.
        return (
          r.body.data.length === 1 &&
          (r.body.data[0] as { id: string }).id === PRODUCT
        );
      }),
    );
    expect(checks.every(Boolean)).toBe(true);
  });
});
