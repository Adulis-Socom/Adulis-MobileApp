import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import {
  FakeMediaStorageAdapter,
  MEDIA_STORAGE_ADAPTER,
} from '../src/modules/catalogue/media-storage.adapter';
import {
  FakePostLinkAdapter,
  POST_LINK_ADAPTER,
} from '../src/modules/catalogue/post-link.adapter';

/**
 * C2 — catalogue, media and stock: the per-group gate. Media never
 * transits the API (the commit validates what actually landed in
 * storage); stock never moves without an event and overselling is a
 * transaction failure; publish is the database function and a blocked
 * publish carries its complete items[].
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = '77777777-6666-4000-8000-000000000001';
const OWNER = '77777777-6666-4000-8000-000000000002';
const ANALYST = '77777777-6666-4000-8000-000000000003';
const STRANGER = '77777777-6666-4000-8000-000000000004';
const BUYER = '77777777-6666-4000-8000-000000000005';
const DEVICE = '77777777-6666-4000-8000-000000000006';
const SELLER = '77777777-6666-4000-8000-000000000007';
const OWNER_S = '77777777-6666-4000-8000-000000000008';
const ANALYST_S = '77777777-6666-4000-8000-000000000009';
const STRANGER_S = '77777777-6666-4000-8000-00000000000a';

const storage = new FakeMediaStorageAdapter();
const links = new FakePostLinkAdapter();

@Module({ imports: [AppModule] })
class C2AppModule {}

describe('C2 — catalogue, media and stock', () => {
  let app: INestApplication;
  let admin: Pool;
  let productId = '';
  let variantId = '';

  const cookie = (t: string) => `__Host-adulis_session=${t}`;
  const key = () =>
    `77777777-6666-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
  const write = (method: 'post' | 'put' | 'patch' | 'delete', path: string, token = OWNER_S) => {
    const r = request(app.getHttpServer())[method](path)
      .set('Cookie', cookie(token))
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Seller', SELLER);
    return method === 'post' ? r.set('Idempotency-Key', key()) : r;
  };
  const read = (path: string, token = OWNER_S) =>
    request(app.getHttpServer()).get(path).set('Cookie', cookie(token)).set('X-Adulis-Seller', SELLER);

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live)
       VALUES ($1,'C2E','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en',false)`,
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
      `INSERT INTO core.eligibility_config (id, market_id, audience_required,
         follower_threshold, counting_platforms, threshold_basis,
         permitted_seller_types, id_verification_requirement)
       VALUES (gen_random_uuid(), $1, true, 1000,
         ARRAY['TIKTOK']::core.platform[], 'HIGHEST_SINGLE',
         ARRAY['INDIVIDUAL','COMPANY']::core.seller_entity_type[], 'OPTIONAL')`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.identity_config (id, market_id, identity_required,
         verifier_kind, accepted_id_types)
       VALUES (gen_random_uuid(), $1, false, 'KYC_VENDOR', ARRAY['NATIONAL_ID'])`,
      [M],
    );
    // NEW-level cap 2: the third publish must refuse.
    await admin.query(
      `INSERT INTO core.ladder_config (id, market_id, established_min_handoffs,
         established_window, established_min_avg_rating, established_max_claim_rate,
         trusted_min_handoffs, trusted_window, trusted_min_scan_completion_rate,
         trusted_max_claim_rate, demotion_max_claim_rate,
         demotion_max_cancellation_rate, demotion_min_scan_completion_rate,
         demotion_window, new_level_product_cap, new_level_transaction_cap_minor,
         distinct_buyer_window, distinct_buyer_max_count)
       VALUES (gen_random_uuid(), $1, 25,'90 days',4.0,0.02,100,'180 days',0.9,
         0.01,0.05,0.25,0.5,'60 days',2,500000,'30 days',3)`,
      [M],
    );
    await admin.query(
      `INSERT INTO billing.tier_definition (tier, version, product_cap, analytics_scope)
       VALUES ('LISTED', 202, 10, 'VIEWS')`,
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251911771001',$5,'ACTIVE'), ($2,'+251911771002',$5,'ACTIVE'),
        ($3,'+251911771003',$5,'ACTIVE'), ($4,'+251911771004',$5,'ACTIVE')`,
      [OWNER, ANALYST, STRANGER, BUYER, M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status, description, category_id)
       VALUES ($1,$2,$3,'INDIVIDUAL','C2 Store','c2-store','ACTIVE','sells','${M}')`,
      [SELLER, M, OWNER],
    );
    await admin.query(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role)
       VALUES (gen_random_uuid(), $1, $2, 'ANALYST')`,
      [SELLER, ANALYST],
    );
    // eligibility satisfied: a verified counting account over threshold
    await admin.query(
      `INSERT INTO core.seller_social_account (id, seller_id, platform, handle,
         status, verified_at, follower_count_at_verification, follower_count_source)
       VALUES (gen_random_uuid(), $1, 'TIKTOK', '@c2', 'VERIFIED', now(), 5000, 'PLATFORM_FETCH')`,
      [SELLER],
    );
    await admin.query(
      `INSERT INTO core.seller_eligibility_evaluation
         (id, seller_id, evaluated_at, path, outcome, reasons)
       VALUES (gen_random_uuid(), $1, now(), 'AUDIENCE', 'SATISFIED', '{}')`,
      [SELLER],
    );
    await admin.query(
      `INSERT INTO core.payout_details (id, seller_id, bank_code, account_last4,
         state, requested_by_account_id, activated_at)
       VALUES (gen_random_uuid(), $1, 'CBE', '7788', 'ACTIVE', $2, now())`,
      [SELLER, OWNER],
    );
    await admin.query(
      `INSERT INTO core.seller_fulfilment_method (seller_id, method, handoff_note, is_active)
       VALUES ($1, 'BUYER_COLLECTION', 'Piassa', true)`,
      [SELLER],
    );
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$4,'CONSOLE',$7, now()+interval '12 hours'),
        ($2,$5,'CONSOLE',$7, now()+interval '12 hours'),
        ($3,$6,'CONSOLE',$7, now()+interval '12 hours')`,
      [OWNER_S, ANALYST_S, STRANGER_S, OWNER, ANALYST, STRANGER, DEVICE],
    );

    const moduleRef = await Test.createTestingModule({ imports: [C2AppModule] })
      .overrideProvider(MEDIA_STORAGE_ADAPTER)
      .useValue(storage)
      .overrideProvider(POST_LINK_ADAPTER)
      .useValue(links)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${OWNER}','${ANALYST}','${STRANGER}')`,
      `DELETE FROM analytics.event WHERE market_id='${M}'`,
      `DELETE FROM core.moderation_queue_item WHERE target_id IN (SELECT id FROM core.product WHERE market_id='${M}')`,
      `DELETE FROM core.reservation WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.order_state_transition WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.order_payout_snapshot WHERE seller_id='${SELLER}'`,
      `DELETE FROM core."order" WHERE market_id='${M}'`,
      `DELETE FROM core.stock_event WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.product_social_post WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.social_post WHERE id NOT IN (SELECT social_post_id FROM core.product_social_post)`,
      `DELETE FROM core.product_attribute_value WHERE product_id IN (SELECT id FROM core.product WHERE market_id='${M}')`,
      `DELETE FROM core.variant_attribute_value WHERE variant_id IN (SELECT id FROM core.product_variant WHERE seller_id='${SELLER}')`,
      `DELETE FROM core.product_image WHERE product_id IN (SELECT id FROM core.product WHERE market_id='${M}')`,
      `DELETE FROM core.product_video WHERE product_id IN (SELECT id FROM core.product WHERE market_id='${M}')`,
      `DELETE FROM core.media_lifecycle WHERE object_key LIKE 'products/%'`,
      `DELETE FROM core.product_variant WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.product WHERE market_id='${M}'`,
      `DELETE FROM core.seller_fulfilment_method WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.payout_details WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_eligibility_evaluation WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_level_state WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_level_event WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_social_account WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_team_member WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller WHERE id='${SELLER}'`,
      `DELETE FROM billing.tier_definition WHERE version=202`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER}','${ANALYST}','${STRANGER}','${BUYER}')`,
      `DELETE FROM core.session WHERE account_id IN ('${OWNER}','${ANALYST}','${STRANGER}','${BUYER}')`,
      `DELETE FROM core.device WHERE id='${DEVICE}'`,
      `DELETE FROM core.account WHERE market_id='${M}'`,
      `DELETE FROM core.ladder_config WHERE market_id='${M}'`,
      `DELETE FROM core.identity_config WHERE market_id='${M}'`,
      `DELETE FROM core.eligibility_config WHERE market_id='${M}'`,
      `DELETE FROM core.timing_config WHERE market_id='${M}'`,
      `DELETE FROM core.market WHERE id='${M}'`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  describe('products', () => {
    it('creates a DRAFT product (201)', async () => {
      const r = await write('post', '/v1/seller/products')
        .send({ name: 'Leather tote', base_price_minor: 250000, base_price_currency: 'ETB' })
        .expect(201);
      productId = r.body.product_id;
      expect(r.body.visibility).toBe('DRAFT');
    });

    it('403 for the ANALYST creating; 404 for a stranger reading', async () => {
      await write('post', '/v1/seller/products', ANALYST_S)
        .send({ name: 'X', base_price_minor: 1, base_price_currency: 'ETB' })
        .expect(403);
      await read(`/v1/seller/products/${productId}`, STRANGER_S).expect(404);
    });

    it('publishes within the cap; the THIRD publish refuses at the NEW-level cap of 2', async () => {
      await write('post', `/v1/seller/products/${productId}/publish`).send({}).expect(200);
      const p2 = await write('post', '/v1/seller/products')
        .send({ name: 'Second', base_price_minor: 1000, base_price_currency: 'ETB' })
        .expect(201);
      await write('post', `/v1/seller/products/${p2.body.product_id}/publish`)
        .send({})
        .expect(200);
      const p3 = await write('post', '/v1/seller/products')
        .send({ name: 'Third', base_price_minor: 1000, base_price_currency: 'ETB' })
        .expect(201);
      const r = await write('post', `/v1/seller/products/${p3.body.product_id}/publish`)
        .send({})
        .expect(409);
      expect(r.body.code).toBe('LEVEL_LIMIT_REACHED');
    });

    it('unpublish keeps the row with the reason', async () => {
      const r = await write('post', `/v1/seller/products/${productId}/unpublish`)
        .send({})
        .expect(200);
      expect(r.body.visibility).toBe('UNPUBLISHED');
      const p = await read(`/v1/seller/products/${productId}`).expect(200);
      expect(p.body.unpublished_reason).toBe('SELLER');
      // republish for the stock/order tests below
      await write('post', `/v1/seller/products/${productId}/publish`).send({}).expect(200);
    });
  });

  describe('variants and stock', () => {
    it('creates a variant and sets stock by absolute count — as an event', async () => {
      const v = await write('post', `/v1/seller/products/${productId}/variants`)
        .send({ variant_key: 'brown', price_minor: 250000, price_currency: 'ETB' })
        .expect(201);
      variantId = v.body.variant_id;
      const r = await write('post', `/v1/seller/variants/${variantId}/stock`)
        .send({ count: 10 })
        .expect(201);
      expect(r.body.stock_count).toBe(10);
      expect(r.body.event).toBeTruthy();
    });

    it('overselling is a transaction failure: a -11 delta refuses as 409 INSUFFICIENT_STOCK', async () => {
      const r = await write('post', `/v1/seller/variants/${variantId}/stock`)
        .send({ delta: -11 })
        .expect(409);
      expect(r.body.code).toBe('INSUFFICIENT_STOCK');
    });

    it('confirm-stock resets the timestamp; events list newest first', async () => {
      await write('post', `/v1/seller/variants/${variantId}/confirm-stock`)
        .send({})
        .expect(200);
      const r = await read(`/v1/seller/variants/${variantId}/stock-events`).expect(200);
      expect(r.body.data.length).toBeGreaterThan(0);
      expect(r.body.data[0].reason).toBeDefined();
    });

    it('a variant with a live reservation cannot be deleted (409)', async () => {
      const orderId = '77777777-6666-4000-8000-0000000000f0';
      await admin.query(
        `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id,
           state, expires_at, total_currency, display_currency)
         VALUES ($1,$2,$3,$4,'CREATED', now()+interval '48 hours','ETB','ETB')`,
        [orderId, M, SELLER, BUYER],
      );
      await admin.query(
        `INSERT INTO core.reservation (id, order_id, variant_id, seller_id,
           buyer_account_id, quantity, unit_price_minor, unit_price_currency)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 1, 250000, 'ETB')`,
        [orderId, variantId, SELLER, BUYER],
      );
      const r = await write('delete', `/v1/seller/variants/${variantId}`).expect(409);
      expect(r.body.code).toBe('VARIANT_HAS_ACTIVE_ORDERS');
      const p = await write('delete', `/v1/seller/products/${productId}`).expect(409);
      expect(p.body.code).toBe('PRODUCT_HAS_ACTIVE_ORDERS');
    });
  });

  describe('media — never through the API', () => {
    let keys: { thumb: string; card: string; full: string };

    it('REQUEST_UPLOAD signs the three derivative PUTs with server-minted keys', async () => {
      const r = await write('post', `/v1/seller/products/${productId}/images`)
        .send({ action: 'REQUEST_UPLOAD', position: 1 })
        .expect(200);
      keys = {
        thumb: r.body.uploads.thumb.key,
        card: r.body.uploads.card.key,
        full: r.body.uploads.full.key,
      };
      expect(keys.full).toContain(`products/${productId}/img/1/`);
      expect(r.body.uploads.full.url).toContain('http');
    });

    it('COMMIT before the objects exist is a 409; after upload it registers the row', async () => {
      const commit = {
        action: 'COMMIT',
        position: 1,
        thumb_key: keys.thumb,
        card_key: keys.card,
        full_key: keys.full,
      };
      const r1 = await write('post', `/v1/seller/products/${productId}/images`)
        .send(commit)
        .expect(409);
      expect(r1.body.slots.reason).toBe('OBJECT_NOT_UPLOADED');

      storage.put(keys.thumb, { bytes: 40_000, contentType: 'image/webp' });
      storage.put(keys.card, { bytes: 200_000, contentType: 'image/webp' });
      storage.put(keys.full, { bytes: 900_000, contentType: 'image/webp' });
      await write('post', `/v1/seller/products/${productId}/images`).send(commit).expect(201);

      // the same position cannot be committed twice
      const again = await write('post', `/v1/seller/products/${productId}/images`)
        .send(commit)
        .expect(409);
      expect(again.body.slots.reason).toBe('POSITION_TAKEN');
    });

    it('DELETE schedules the purge — storage that only grows is a cost curve', async () => {
      await write('delete', `/v1/seller/products/${productId}/images/1`).expect(204);
      const lc = await admin.query(
        `SELECT purge_after FROM core.media_lifecycle WHERE object_key = $1`,
        [keys.full],
      );
      expect(lc.rows[0].purge_after).not.toBeNull();
    });

    it('an oversize video commit is 413', async () => {
      const r = await write('post', `/v1/seller/products/${productId}/video`)
        .send({ action: 'REQUEST_UPLOAD' })
        .expect(200);
      const vkey = r.body.upload.key as string;
      storage.put(vkey, { bytes: 60 * 1024 * 1024, contentType: 'video/mp4' });
      const c = await write('post', `/v1/seller/products/${productId}/video`)
        .send({ action: 'COMMIT', key: vkey, duration_seconds: 20, height_px: 480 })
        .expect(413);
      expect(c.body.code).toBe('PAYLOAD_TOO_LARGE');
      storage.put(vkey, { bytes: 8 * 1024 * 1024, contentType: 'video/mp4' });
      await write('post', `/v1/seller/products/${productId}/video`)
        .send({ action: 'COMMIT', key: vkey, duration_seconds: 20, height_px: 480 })
        .expect(201);
    });
  });

  describe('social posts', () => {
    it('an unresolvable link is 422; a resolved one attaches by canonical id', async () => {
      const r1 = await write('post', `/v1/seller/products/${productId}/social-posts`)
        .send({ url: 'https://vm.tiktok.com/ZMdead/' })
        .expect(422);
      expect(r1.body.slots.reason).toBe('POST_LINK_UNRESOLVED');

      links.register('https://vm.tiktok.com/ZMlive/', {
        platform: 'TIKTOK',
        canonicalPostId: '7300000001',
      });
      const r2 = await write('post', `/v1/seller/products/${productId}/social-posts`)
        .send({ url: 'https://vm.tiktok.com/ZMlive/' })
        .expect(201);
      expect(r2.body.canonical_post_id).toBe('7300000001');
    });
  });
});
