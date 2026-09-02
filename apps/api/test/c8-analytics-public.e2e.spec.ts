import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import {
  FakePostLinkAdapter,
  POST_LINK_ADAPTER,
} from '../src/modules/catalogue/post-link.adapter';

/**
 * C8 — analytics (12.13), notifications (12.14), reports (12.15), client
 * events (12.16), and the public anonymous group (12.1): resolved numbers
 * never raw rows, the entitlement resolved at read time, read state on one
 * list, the suppressible=false 422, the allow-list of two, and a storefront
 * that answers in one round trip while emitting its own view events.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = 'eeee8888-3333-4000-8000-000000000001';
const OWNER = 'eeee8888-3333-4000-8000-000000000002';
const BUYER = 'eeee8888-3333-4000-8000-000000000003';
const OWNER2 = 'eeee8888-3333-4000-8000-000000000004';
const DEVICE = 'eeee8888-3333-4000-8000-000000000005';
const SELLER = 'eeee8888-3333-4000-8000-000000000006';
const SELLER2 = 'eeee8888-3333-4000-8000-000000000007';
const PRODUCT = 'eeee8888-3333-4000-8000-000000000008';
const VARIANT = 'eeee8888-3333-4000-8000-000000000009';
const OWNER_S = 'eeee8888-3333-4000-8000-00000000000a';
const OWNER_MOB_S = 'eeee8888-3333-4000-8000-00000000000b';
const BUYER_S = 'eeee8888-3333-4000-8000-00000000000c';
const OWNER2_S = 'eeee8888-3333-4000-8000-00000000000d';
const SOCIAL_POST = 'eeee8888-3333-4000-8000-00000000000e';
const NOTIF_BUYER = 'eeee8888-3333-4000-8000-00000000000f';
const NOTIF_DEVICE = 'eeee8888-3333-4000-8000-000000000010';

const postLinks = new FakePostLinkAdapter();

@Module({ imports: [AppModule] })
class C8AppModule {}

describe('C8 — analytics, notifications, reports, events, public', () => {
  let app: INestApplication;
  let admin: Pool;

  const key = () => randomUUID();
  const http = () => request(app.getHttpServer());
  const cookie = (t: string) => `__Host-adulis_session=${t}`;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'C8E','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en', 'ACTIVE', true, 'AFROMESSAGE')`,
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
        ($1,'+251911661701',$4,'ACTIVE'), ($2,'+251911661702',$4,'ACTIVE'),
        ($3,'+251911661703',$4,'ACTIVE')`,
      [OWNER, BUYER, OWNER2, M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status) VALUES
        ($1,$3,$4,'INDIVIDUAL','C8 Store','c8-store','ACTIVE'),
        ($2,$3,$5,'INDIVIDUAL','C8 Drafty','c8-drafty','DRAFT')`,
      [SELLER, SELLER2, M, OWNER, OWNER2],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, description,
         base_price_minor, base_price_currency, visibility, published_at)
       VALUES ($1,$2,$3,'Woven scarf','Handwoven cotton',80000,'ETB','PUBLISHED', now())`,
      [PRODUCT, SELLER, M],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
         price_currency, variant_key, stock_confirmed_at)
       VALUES ($1,$2,$3,80000,'ETB','indigo', now())`,
      [VARIANT, PRODUCT, SELLER],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       VALUES (gen_random_uuid(),$1,$2,4,'SELLER_SET')`,
      [VARIANT, SELLER],
    );
    await admin.query(
      `INSERT INTO core.seller_eligibility_evaluation (id, seller_id, path, outcome)
       VALUES (gen_random_uuid(), $1, 'AUDIENCE', 'SATISFIED')`,
      [SELLER],
    );
    await admin.query(
      `INSERT INTO core.seller_public_stats (seller_id, level, completed_handoff_count)
       VALUES ($1,'ESTABLISHED',37)
       ON CONFLICT (seller_id) DO UPDATE SET completed_handoff_count = 37`,
      [SELLER],
    );
    // BETA subscription: the Assisted analytics set, never the Free set.
    await admin.query(
      `INSERT INTO billing.subscription (seller_id, state, beta_started_at)
       VALUES ($1,'BETA', now())`,
      [SELLER],
    );
    // SELLER2 anchors the fail-closed branch: a tier with NO definition
    // row resolves to nothing, regardless of what global rows other
    // suites legally seed for LISTED.
    await admin.query(
      `INSERT INTO billing.subscription (seller_id, state, tier, term)
       VALUES ($1,'CANCELLED','VERIFIED_PRO','MONTHLY')`,
      [SELLER2],
    );
    await admin.query(
      `INSERT INTO core.social_post (id, platform, canonical_post_id)
       VALUES ($1,'TIKTOK','ttk-c8-777')`,
      [SOCIAL_POST],
    );
    await admin.query(
      `INSERT INTO core.product_social_post (product_id, social_post_id, seller_id)
       VALUES ($1,$2,$3)`,
      [PRODUCT, SOCIAL_POST, SELLER],
    );
    postLinks.register('https://vm.tiktok.com/c8short', {
      platform: 'TIKTOK',
      canonicalPostId: 'ttk-c8-777',
    });

    await admin.query(`SET session_replication_role = replica`);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$5,'CONSOLE',NULL, now()+interval '12 hours'),
        ($2,$5,'MOBILE',$8, now()+interval '30 days'),
        ($3,$6,'MOBILE',$8, now()+interval '30 days'),
        ($4,$7,'CONSOLE',NULL, now()+interval '12 hours')`,
      [OWNER_S, OWNER_MOB_S, BUYER_S, OWNER2_S, OWNER, BUYER, OWNER2, DEVICE],
    );
    // Notification fixtures: one buyer-class unlinked row, one seller-class
    // (database-enqueued, unsuppressible) row for the owner.
    await admin.query(
      `INSERT INTO core.notification (id, recipient_account_id, channel,
         template_key, locale, slots, suppressible) VALUES
        ($1,$2,'IN_APP','ORDER_EXPIRY_WARNING','en','{}'::jsonb, true),
        ($3,$4,'SMS','NEW_DEVICE_SIGNIN','en','{}'::jsonb, false)`,
      [NOTIF_BUYER, BUYER, NOTIF_DEVICE, OWNER],
    );
    await admin.query(`SET session_replication_role = DEFAULT`);

    const moduleRef = await Test.createTestingModule({ imports: [C8AppModule] })
      .overrideProvider(POST_LINK_ADAPTER)
      .useValue(postLinks)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM analytics.event WHERE market_id='${M}'`,
      `DELETE FROM core.moderation_queue_item WHERE target_id IN ('${SELLER}','${PRODUCT}')`,
      `DELETE FROM core.content_report WHERE reporter_account_id IN ('${BUYER}','${OWNER}')`,
      `DELETE FROM core.notification_preference WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${BUYER}','${OWNER}','${OWNER2}')`,
      `DELETE FROM core.product_social_post WHERE product_id='${PRODUCT}'`,
      `DELETE FROM core.social_post WHERE id='${SOCIAL_POST}'`,
      `DELETE FROM billing.subscription_state_transition WHERE subscription_id IN (SELECT id FROM billing.subscription WHERE seller_id IN ('${SELLER}','${SELLER2}'))`,
      `DELETE FROM billing.subscription WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.stock_event WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.product_variant WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.product WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.seller_eligibility_evaluation WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN ('${SELLER}','${SELLER2}')`,
      `DELETE FROM core.seller WHERE market_id='${M}'`,
      `DELETE FROM core.session WHERE account_id IN ('${OWNER}','${BUYER}','${OWNER2}')`,
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${OWNER}','${BUYER}','${OWNER2}','${DEVICE}')`,
      `DELETE FROM core.device WHERE id='${DEVICE}'`,
      `DELETE FROM core.account WHERE market_id='${M}'`,
      `DELETE FROM core.timing_config WHERE market_id='${M}'`,
      `DELETE FROM core.market WHERE id='${M}'`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
    await app.close();
  });

  describe('the public group (12.1)', () => {
    it('the storefront answers in ONE round trip: header, stats, trust, availability', async () => {
      const r = await http().get('/v1/storefronts/c8-store').expect(200);
      expect(r.body.store_name).toBe('C8 Store');
      expect(r.body.stats).toMatchObject({ completed_handoff_count: 37 });
      expect(r.body.stats.level).toBeTruthy();
      expect(r.body.availability).toHaveProperty('is_open');
      const ev = await admin.query(
        `SELECT count(*)::int AS n FROM analytics.event
          WHERE seller_id=$1 AND name='storefront_viewed'`,
        [SELLER],
      );
      expect(ev.rows[0].n).toBeGreaterThan(0);

      // And the id no longer addresses it. If this ever 200s again, a UUID
      // is back on an anonymous URL.
      await http().get(`/v1/storefronts/c8-store/products/${PRODUCT}`).expect(404);
    });

    it('an unknown or unpublished storefront does not exist', async () => {
      await http().get('/v1/storefronts/nope-nope').expect(404);
      await http().get('/v1/storefronts/c8-drafty').expect(404);
    });

    it('the product read carries variants, stock with confirmed_at, and emits its view', async () => {
      const list = await http().get('/v1/storefronts/c8-store/products').expect(200);
      expect(list.body.data).toHaveLength(1);
      // G1.9: the product page is addressed by SLUG. The list carries it,
      // which is how a client builds the link -- and the uuid that used to
      // be in this URL is exactly what doctrine 5 forbids there.
      const slug = list.body.data[0].slug as string;
      expect(slug).toBeTruthy();
      const r = await http().get(`/v1/storefronts/c8-store/products/${slug}`).expect(200);
      expect(r.body.variants[0]).toMatchObject({ stock_count: 4 });
      expect(r.body.variants[0].stock_confirmed_at).toBeTruthy();
      const ev = await admin.query(
        `SELECT count(*)::int AS n FROM analytics.event
          WHERE seller_id=$1 AND name='product_viewed'`,
        [SELLER],
      );
      expect(ev.rows[0].n).toBeGreaterThan(0);
    });

    it('search stays inside one seller; lookup returns sellers only, capped', async () => {
      const s = await http().get('/v1/storefronts/c8-store/search?q=scarf').expect(200);
      expect(s.body.data).toHaveLength(1);
      const none = await http().get('/v1/storefronts/c8-store/search?q=bicycle').expect(200);
      expect(none.body.data).toHaveLength(0);
      const lookup = await http().get('/v1/sellers/lookup?q=c8-s').expect(200);
      expect(lookup.body.data.map((x: { handle: string }) => x.handle)).toContain('c8-store');
      await http().get('/v1/categories').expect(200);
    });

    it('a post link resolves to a LIST of products; an unknown link to an empty one', async () => {
      const r = await http()
        .post('/v1/post-links/resolve')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', DEVICE)
        .send({ url: 'https://vm.tiktok.com/c8short' })
        .expect(200);
      expect(r.body.data).toHaveLength(1);
      expect(r.body.data[0]).toMatchObject({ id: PRODUCT, seller_handle: 'c8-store' });
      const miss = await http()
        .post('/v1/post-links/resolve')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', DEVICE)
        .send({ url: 'https://vm.tiktok.com/unknown' })
        .expect(200);
      expect(miss.body.data).toHaveLength(0);
    });
  });

  describe('analytics (12.13)', () => {
    it('overview serves every tier, resolved numbers only', async () => {
      const r = await http()
        .get('/v1/seller/analytics/overview')
        .set('Authorization', `Bearer ${OWNER_MOB_S}`)
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      expect(r.body).toMatchObject({ products_published: 1, completed_handoffs: 37 });
      expect(r.body).not.toHaveProperty('events');
    });

    it('full resolves the entitlement at read time: BETA gets the Assisted set; no tier, no set', async () => {
      const r = await http()
        .get('/v1/seller/analytics/full')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      expect(Number(r.body.storefront_views_30d)).toBeGreaterThan(0);
      expect(Number(r.body.product_views_30d)).toBeGreaterThan(0);
      expect(r.body.scope).toBe('VIEWS_RESERVATIONS_CONVERSION');

      const bare = await http()
        .get('/v1/seller/analytics/full')
        .set('Cookie', cookie(OWNER2_S))
        .set('X-Adulis-Seller', SELLER2)
        .expect(409);
      expect(bare.body.code).toBe('TIER_LIMIT_REACHED');
    });

    it('full is CONSOLE-only by permission surface', async () => {
      const r = await http()
        .get('/v1/seller/analytics/full')
        .set('Authorization', `Bearer ${OWNER_MOB_S}`)
        .set('X-Adulis-Seller', SELLER)
        .expect(403);
      expect(r.body.code).toBe('PERMISSION_DENIED');
    });

    it('the date window actually filters (v1.9 item 10): a far-past range zeroes the counts', async () => {
      // The default window includes the seeded views (asserted above); a range
      // years in the past cannot, so a param that filters and a param that is
      // ignored give different answers here. It also echoes the resolved window.
      const past = await http()
        .get('/v1/seller/analytics/full?from=2019-01-01&to=2019-12-31')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      expect(Number(past.body.storefront_views_30d)).toBe(0);
      expect(Number(past.body.product_views_30d)).toBe(0);
      expect(past.body.window_from).toBe('2019-01-01');
      expect(past.body.window_to).toBe('2019-12-31');
    });

    it('overview echoes the resolved window and validates its dates', async () => {
      const r = await http()
        .get('/v1/seller/analytics/overview?from=2020-01-01&to=2020-01-31')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      expect(r.body.products_published).toBe(1); // point-in-time, window-independent
      expect(r.body.window_from).toBe('2020-01-01');
      expect(r.body.window_to).toBe('2020-01-31');

      const bad = await http()
        .get('/v1/seller/analytics/overview?from=not-a-date')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .expect(400);
      expect(bad.body.code).toBe('VALIDATION_FAILED');
      expect(bad.body.slots.path).toBe('from');

      const inverted = await http()
        .get('/v1/seller/analytics/overview?from=2026-02-01&to=2026-01-01')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .expect(400);
      expect(inverted.body.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('client events (12.16)', () => {
    it('the allow-list of two: a listed name lands, an unknown one is 422', async () => {
      await http()
        .post('/v1/events')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .set('Idempotency-Key', key())
        .send({ event_name: 'NotificationOpened' })
        .expect(202);
      const row = await admin.query(
        `SELECT count(*)::int AS n FROM analytics.event
          WHERE actor_account_id=$1 AND name='notification_opened'`,
        [BUYER],
      );
      expect(row.rows[0].n).toBe(1);
      const refused = await http()
        .post('/v1/events')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .set('Idempotency-Key', key())
        .send({ event_name: 'AnythingElse' })
        .expect(422);
      expect(refused.body.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('notifications (12.14)', () => {
    it('the list is scoped like chat: no default, and the two lives never interleave', async () => {
      await http()
        .get('/v1/notifications')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .expect(400);
      const buyer = await http()
        .get('/v1/notifications?as=buyer')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .expect(200);
      expect(buyer.body.data.map((n: { id: string }) => n.id)).toContain(NOTIF_BUYER);
      const seller = await http()
        .get(`/v1/notifications?as=seller&seller_id=${SELLER}`)
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      expect(seller.body.data.map((n: { id: string }) => n.id)).toContain(NOTIF_DEVICE);
    });

    it('D-227 S1: transfer, stock and trial notices reach SC-30 AND never the buyer feed', async () => {
      /*
       * BOTH DIRECTIONS, deliberately -- one arm alone would pass with the
       * predicate inverted (the work order's own warning). The three classes
       * are the ones the T14-C pass found written unlinked to the seller's
       * owner account and reachable from NEITHER list's inclusion -- so they
       * leaked into the buyer feed, where a seller's own ownership-transfer
       * security notice read as shopping news.
       */
      const ids = {
        transfer: 'eeee8888-3333-4000-8000-000000000021',
        stock: 'eeee8888-3333-4000-8000-000000000022',
        trial: 'eeee8888-3333-4000-8000-000000000023',
        ownerBuyerClass: 'eeee8888-3333-4000-8000-000000000024',
      };
      await admin.query(`SET session_replication_role = replica`);
      await admin.query(
        `INSERT INTO core.notification (id, recipient_account_id, channel,
           template_key, locale, slots, suppressible) VALUES
          ($1,$4,'SMS','OWNERSHIP_TRANSFER_REQUESTED','en','{}'::jsonb, false),
          ($2,$4,'IN_APP','STOCK_CONFIDENCE_NUDGE','en','{}'::jsonb, true),
          ($3,$4,'IN_APP','TRIAL_ENDING','en','{}'::jsonb, true),
          ($5,$4,'IN_APP','ORDER_EXPIRY_WARNING','en','{}'::jsonb, true)`,
        [ids.transfer, ids.stock, ids.trial, OWNER, ids.ownerBuyerClass],
      );
      await admin.query(`SET session_replication_role = DEFAULT`);

      const seller = await http()
        .get(`/v1/notifications?as=seller&seller_id=${SELLER}`)
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      const sellerIds = seller.body.data.map((n: { id: string }) => n.id);
      expect(sellerIds).toContain(ids.transfer);
      expect(sellerIds).toContain(ids.stock);
      expect(sellerIds).toContain(ids.trial);

      // The OWNER's own buyer feed must NOT carry them...
      const ownerBuyer = await http()
        .get('/v1/notifications?as=buyer')
        .set('Cookie', cookie(OWNER_S))
        .expect(200);
      const buyerIds = ownerBuyer.body.data.map((n: { id: string }) => n.id);
      expect(buyerIds).not.toContain(ids.transfer);
      expect(buyerIds).not.toContain(ids.stock);
      expect(buyerIds).not.toContain(ids.trial);

      // ...and the CONTROL, on the SAME account (the pass's point: a row
      // whose recipient differs proves nothing about the predicate): OWNER's
      // own unlinked buyer-class row stays OUT of OWNER's seller feed and IN
      // OWNER's buyer feed -- the arm a bare `OR order_id IS NULL`
      // regression would fail.
      expect(sellerIds).not.toContain(ids.ownerBuyerClass);
      expect(buyerIds).toContain(ids.ownerBuyerClass);
      expect(sellerIds).not.toContain(NOTIF_BUYER);
      const buyer = await http()
        .get('/v1/notifications?as=buyer')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .expect(200);
      expect(buyer.body.data.map((n: { id: string }) => n.id)).toContain(NOTIF_BUYER);
    });

    it("read state is one list, two clients; another account's row is 404", async () => {
      await http()
        .post(`/v1/notifications/${NOTIF_BUYER}/read`)
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .expect(404);
      const read = await http()
        .post(`/v1/notifications/${NOTIF_BUYER}/read`)
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .set('Idempotency-Key', key())
        .expect(200);
      expect(read.body.read_at).toBeTruthy();
      const all = await http()
        .post('/v1/notifications/read-all')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', key())
        .expect(200);
      expect(all.body.marked).toBeGreaterThan(0);
    });

    it('a suppressible=false class is not togglable: 422, never a silent accept', async () => {
      await http()
        .patch('/v1/seller/notification-preferences')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .send({ preferences: [{ template_key: 'ORDER_EXPIRY_WARNING', enabled: false }] })
        .expect(200);
      for (const blocked of ['NEW_DEVICE_SIGNIN', 'PAYOUT_CHANGE_REQUESTED', 'OWNERSHIP_TRANSFER_REQUESTED']) {
        const r = await http()
          .patch('/v1/seller/notification-preferences')
          .set('Cookie', cookie(OWNER_S))
          .set('X-Adulis-Seller', SELLER)
          .set('Origin', CONSOLE_ORIGIN)
          .send({ preferences: [{ template_key: blocked, enabled: false }] })
          .expect(422);
        expect(r.body.slots.reason).toBe('NOT_SUPPRESSIBLE');
      }
      const prefs = await http()
        .get('/v1/seller/notification-preferences')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      expect(prefs.body.preferences).toHaveLength(1);
      expect(prefs.body.preferences[0]).toMatchObject({
        template_key: 'ORDER_EXPIRY_WARNING',
        enabled: false,
      });
    });
  });

  describe('reports (12.15)', () => {
    it('a report routes to the moderation queue and appears under mine', async () => {
      const r = await http()
        .post('/v1/reports')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .set('X-Adulis-Device', DEVICE)
        .set('Idempotency-Key', key())
        // D-44: the wire spells it the way the frozen enum does. 'STORE'
        // was a document's word for STOREFRONT and the edge translated it;
        // a translation layer between a document and a shipped type is
        // where a third spelling appears.
        .send({ subject_kind: 'STOREFRONT', subject_id: SELLER, reason: 'COUNTERFEIT' })
        .expect(201);
      expect(r.body.report_id).toBeTruthy();
      const queued = await admin.query(
        `SELECT kind, target_kind FROM core.moderation_queue_item
          WHERE target_id=$1 ORDER BY queued_at DESC LIMIT 1`,
        [SELLER],
      );
      expect(queued.rows[0]).toMatchObject({ kind: 'REPORT', target_kind: 'STOREFRONT' });
      const mine = await http()
        .get('/v1/reports/mine')
        .set('Authorization', `Bearer ${BUYER_S}`)
        .expect(200);
      expect(mine.body.data.map((x: { id: string }) => x.id)).toContain(r.body.report_id);
      expect(mine.body.data[0].resolved_at).toBeNull();
    });
  });
});
