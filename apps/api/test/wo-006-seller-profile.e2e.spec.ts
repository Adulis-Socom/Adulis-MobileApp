import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import {
  FakeMediaStorageAdapter,
  MEDIA_STORAGE_ADAPTER,
} from '../src/modules/catalogue/media-storage.adapter';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * WO-006 -- the public reads behind the Buyer Seller Profile: the storefront header (Trust,
 * review summary, fulfilment, member since), the Seller's public Scenes (canonical gate only,
 * cursor-paginated), Products (cursor-paginated in the Seller's order) and Reviews (validated,
 * tie-safe cursor). The same handle exists in two Markets: every read resolves the same Seller.
 * Disposable database; Scenes published the production way (Seller API).
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const id = (n: number) => `0e060000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const MA = id(1);
const MB = id(2);
const OWNER = { a: id(10), b: id(11), buyer: id(12) };
const SELLER = { a: id(20), b: id(21) };
const DEV = { a: id(30), b: id(31), session: id(32) };
const SESSION = { a: id(40), b: id(41) };
const productId = (n: number) => id(0x100 + n);
const variantId = (n: number) => id(0x200 + n);
const orderId = (n: number) => id(0x300 + n);

const storage = new FakeMediaStorageAdapter();

@Module({ imports: [AppModule] })
class Wo006AppModule {}

describe('WO-006 -- Seller Profile public reads', () => {
  let app: INestApplication;
  let admin: Pool;
  const refs: Record<string, string> = {};

  const server = () => request(app.getHttpServer());
  const get = (path: string, device: string = DEV.a) =>
    server().get(path).set('X-Adulis-Client', 'android/1.0.0').set('X-Adulis-Device', device);
  const asOwner = (seller: string, session: string, r: request.Test) =>
    r.set('Cookie', `__Host-adulis_session=${sessionToken(session)}`).set('Origin', CONSOLE_ORIGIN).set('X-Adulis-Seller', seller);

  const publishScene = async (key: string, seller: string, session: string, products: string[]) => {
    const created = await asOwner(seller, session, server().post('/v1/seller/scene-posts').set('Idempotency-Key', randomUUID()))
      .send({ caption: `WO-006 ${key} ${'long caption '.repeat(20)}`, product_ids: products })
      .expect(201);
    const up = await asOwner(seller, session, server().post(`/v1/seller/scene-posts/${created.body.id}/image-uploads`))
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    const k = up.body.uploads as Record<'thumb' | 'card' | 'full', { key: string }>;
    for (const [kind, bytes] of [
      ['thumb', 30_000],
      ['card', 150_000],
      ['full', 700_000],
    ] as const) {
      storage.put(k[kind].key, { bytes, contentType: 'image/webp' });
    }
    const patched = await asOwner(seller, session, server().patch(`/v1/seller/scene-posts/${created.body.id}/draft`))
      .set('If-Match', `"${created.body.edit_version}"`)
      .send({ image: { thumb_key: k.thumb.key, card_key: k.card.key, full_key: k.full.key } })
      .expect(200);
    const published = await asOwner(seller, session, server().post(`/v1/seller/scene-posts/${created.body.id}/publish`))
      .set('Idempotency-Key', randomUUID())
      .set('If-Match', `"${patched.body.edit_version}"`)
      .expect(200);
    refs[key] = published.body.public_ref as string;
    return created.body.id as string;
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone,
                                default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'W6A','Market A','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($2,'W6B','Market B','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE')`,
      [MA, MB],
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
       SELECT gen_random_uuid(), m, '48 hours','24 hours','72 hours','7 days',
         '24 hours','7 days','30 days','48 hours','90 days','24 hours',
         '30 days','12 hours','30 minutes','7 days','8 hours','5 minutes',5,
         '5 minutes','24 hours',3,'1 hour',
         ARRAY['1 day','2 days','4 days']::interval[],'30 days'
         FROM unnest($1::uuid[]) AS m`,
      [[MA, MB]],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251911706001',$4,'ACTIVE'), ($2,'+251911706002',$5,'ACTIVE'), ($3,'+251911706003',$4,'ACTIVE')`,
      [OWNER.a, OWNER.b, OWNER.buyer, MA, MB],
    );
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$4), ($2,'ANDROID',$5), ($3,'ANDROID',$4)`,
      [DEV.a, DEV.b, DEV.session, MA, MB],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, description, status)
       VALUES ($1,$3,$5,'INDIVIDUAL','Twin Store A','twin-store','Baskets from Market A','ACTIVE'),
              ($2,$4,$6,'INDIVIDUAL','Twin Store B','twin-store','Lamps from Market B','ACTIVE')`,
      [SELLER.a, SELLER.b, MA, MB, OWNER.a, OWNER.b],
    );
    await admin.query(
      `INSERT INTO core.seller_public_stats (seller_id, level, completed_handoff_count) VALUES ($1,'ESTABLISHED',12)
       ON CONFLICT (seller_id) DO UPDATE SET level = 'ESTABLISHED', completed_handoff_count = 12`,
      [SELLER.a],
    );
    await admin.query(
      `INSERT INTO core.seller_fulfilment_method (seller_id, method, is_active) VALUES
        ($1,'BUYER_COLLECTION',true), ($1,'SELLER_DELIVERY',false)`,
      [SELLER.a],
    );
    // Seller A: five Products, all display_order 0 (the tiebreak decides), one unpublished.
    for (let n = 1; n <= 5; n++) {
      await admin.query(
        `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor, base_price_currency, visibility, published_at)
         VALUES ($1,$2,$3,$4,1,'ETB',$5, now())`,
        [productId(n), SELLER.a, MA, `Item ${n}`, n === 5 ? 'UNPUBLISHED' : 'PUBLISHED'],
      );
      await admin.query(
        `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key)
         VALUES ($1,$2,$3,$4,'ETB','one')`,
        [variantId(n), productId(n), SELLER.a, 1000 * n],
      );
      await admin.query(
        `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(),$1,$2,3,'RESTOCK')`,
        [variantId(n), SELLER.a],
      );
    }
    // Seller B (same handle, Market B): one Product.
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor, base_price_currency, visibility, published_at)
       VALUES ($1,$2,$3,'Lamp B',1,'ETB','PUBLISHED',now())`,
      [productId(9), SELLER.b, MB],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key) VALUES ($1,$2,$3,7000,'ETB','one')`,
      [variantId(9), productId(9), SELLER.b],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(),$1,$2,3,'RESTOCK')`,
      [variantId(9), SELLER.b],
    );
    // Seller A: three reviews; two land in ONE transaction, so they share published_at (a tie).
    for (let n = 1; n <= 3; n++) {
      await admin.query(
        `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state, expires_at, total_currency, display_currency)
         VALUES ($1,$2,$3,$4,'CREATED', now()+interval '48 hours','ETB','ETB')`,
        [orderId(n), MA, SELLER.a, OWNER.buyer],
      );
    }
    await admin.query(
      `INSERT INTO core.review (order_id, buyer_account_id, seller_id, seller_rating, body, badge) VALUES ($1,$2,$3,5,'Quick and kind','UNVERIFIED')`,
      [orderId(1), OWNER.buyer, SELLER.a],
    );
    await admin.query(
      `INSERT INTO core.review (order_id, buyer_account_id, seller_id, seller_rating, body, badge) VALUES
        ($1,$3,$4,4,'Good',  'UNVERIFIED'), ($2,$3,$4,3,NULL,'UNVERIFIED')`,
      [orderId(2), orderId(3), OWNER.buyer, SELLER.a],
    );
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$3,'CONSOLE',$5, now()+interval '12 hours'), ($2,$4,'CONSOLE',$5, now()+interval '12 hours')`,
      [SESSION.a, SESSION.b, OWNER.a, OWNER.b, DEV.session],
    );
    await armFixtureSessions(admin, Object.values(SESSION));

    const moduleRef = await Test.createTestingModule({ imports: [Wo006AppModule] })
      .overrideProvider(MEDIA_STORAGE_ADAPTER)
      .useValue(storage)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();

    // Seller A: three public Scenes (S1 tags Item 4 only, so it can go PRIVATE alone). Seller B: one.
    await publishScene('S1', SELLER.a, SESSION.a, [productId(4)]);
    await publishScene('S2', SELLER.a, SESSION.a, [productId(1), productId(2)]);
    await publishScene('S3', SELLER.a, SESSION.a, [productId(3)]);
    await publishScene('SB', SELLER.b, SESSION.b, [productId(9)]);
  });

  afterAll(async () => {
    await app?.close();
    const sellers = `'${SELLER.a}','${SELLER.b}'`;
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM analytics.event WHERE market_id IN ('${MA}','${MB}')`,
      `DELETE FROM core.review WHERE seller_id IN (${sellers})`,
      `DELETE FROM core."order" WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.rate_limit_bucket WHERE subject_id LIKE '0e060000-%'`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER.a}','${OWNER.b}')`,
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${OWNER.a}','${OWNER.b}')`,
      `DELETE FROM core.scene_post_transition WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.scene_post_product WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.scene_post_revision WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.scene_post WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.stock_event WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.product_variant WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.product WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller_fulfilment_method WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.session WHERE id IN ('${SESSION.a}','${SESSION.b}')`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller WHERE id IN (${sellers})`,
      `DELETE FROM core.device WHERE id::text LIKE '0e060000-%'`,
      `DELETE FROM core.account WHERE id::text LIKE '0e060000-%'`,
      `DELETE FROM core.timing_config WHERE market_id IN ('${MA}','${MB}')`,
      `DELETE FROM core.market WHERE id IN ('${MA}','${MB}')`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  describe('the header (S3.1)', () => {
    it('carries real Trust, a plain review summary by evidence basis, active fulfilment and member-since', async () => {
      const r = await get('/v1/storefronts/twin-store').expect(200);
      expect(r.headers['cache-control']).toBe('no-store');
      expect(r.body).toMatchObject({
        store_name: 'Twin Store A',
        handle: 'twin-store',
        description: 'Baskets from Market A',
        status: 'ACTIVE',
        stats: { level: 'ESTABLISHED', completed_handoff_count: 12 },
        review_summary: { count: 3, average_rating: 4, badge_counts: { UNVERIFIED: 3, VERIFIED_HANDOFF: 0 } },
        fulfilment_methods: ['BUYER_COLLECTION'],
      });
      expect(r.body.member_since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('a Seller with no review has count 0 and no average (never a perfect score)', async () => {
      const r = await get('/v1/storefronts/twin-store', DEV.b).expect(200);
      expect(r.body.store_name).toBe('Twin Store B');
      expect(r.body.review_summary).toEqual({
        count: 0,
        average_rating: null,
        badge_counts: { CLAIM_UPHELD: 0, VERIFIED_HANDOFF: 0, CONFIRMED_BY_BUYER: 0, UNVERIFIED: 0 },
      });
    });
  });

  describe('Seller Scenes', () => {
    it('lists only gate-admitted public Scenes, newest first, as excerpts', async () => {
      const r = await get('/v1/storefronts/twin-store/scenes').expect(200);
      expect(r.headers['cache-control']).toBe('no-store');
      expect(r.body.data.map((s: { public_ref: string }) => s.public_ref)).toEqual([refs['S3'], refs['S2'], refs['S1']]);
      expect(r.body.data[0]).toMatchObject({ caption_truncated: true, image: { thumb_key: expect.any(String), card_key: expect.any(String) } });
      expect(r.body.data[0].caption.length).toBeLessThanOrEqual(140);
      expect(r.body.next_cursor).toBeNull();
    });

    it('a PRIVATE Scene is absent and returns when it is public again', async () => {
      await admin.query(
        `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(),$1,$2,-3,'SELLER_SET')`,
        [variantId(4), SELLER.a],
      );
      const hidden = await get('/v1/storefronts/twin-store/scenes').expect(200);
      expect(hidden.body.data.map((s: { public_ref: string }) => s.public_ref)).toEqual([refs['S3'], refs['S2']]);
      await admin.query(
        `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(),$1,$2,3,'RESTOCK')`,
        [variantId(4), SELLER.a],
      );
      const back = await get('/v1/storefronts/twin-store/scenes').expect(200);
      expect(back.body.data).toHaveLength(3);
    });

    it('pages deterministically with an opaque cursor that carries no internal id', async () => {
      const p1 = await get('/v1/storefronts/twin-store/scenes?limit=2').expect(200);
      expect(p1.body.data.map((s: { public_ref: string }) => s.public_ref)).toEqual([refs['S3'], refs['S2']]);
      const decoded = Buffer.from(p1.body.next_cursor as string, 'base64url').toString('utf8');
      expect(decoded).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
      const p2 = await get(`/v1/storefronts/twin-store/scenes?limit=2&cursor=${p1.body.next_cursor}`).expect(200);
      expect(p2.body.data.map((s: { public_ref: string }) => s.public_ref)).toEqual([refs['S1']]);
      expect(p2.body.next_cursor).toBeNull();
    });

    it.each(['garbage', 'eyJ4IjoxfQ', Buffer.from('["2026-11-11T00:00:00Z","x"]').toString('base64url')])(
      'an invalid cursor (%s) is a 400 CURSOR_INVALID, never a 500',
      async (cursor) => {
        const r = await get(`/v1/storefronts/twin-store/scenes?cursor=${cursor}`).expect(400);
        expect(r.body).toMatchObject({ code: 'VALIDATION_FAILED', slots: { reason: 'CURSOR_INVALID' } });
      },
    );

    it('a page size outside 1-50 is a 400', async () => {
      await get('/v1/storefronts/twin-store/scenes?limit=0').expect(400);
      await get('/v1/storefronts/twin-store/scenes?limit=51').expect(400);
    });
  });

  describe('Seller Products', () => {
    it("pages the Seller's catalogue in order with prices and availability; unpublished excluded", async () => {
      const seen: Array<{ slug: string; price_min_minor: number; available: boolean }> = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const r: request.Response = await get(`/v1/storefronts/twin-store/products?limit=2${cursor ? `&cursor=${cursor}` : ''}`).expect(200);
        seen.push(...r.body.data);
        cursor = r.body.next_cursor;
        pages++;
      } while (cursor && pages < 10);
      expect(pages).toBe(2);
      expect(seen.map((p) => p.slug)).toEqual(['item-1', 'item-2', 'item-3', 'item-4']);
      expect(seen.map((p) => p.price_min_minor)).toEqual([1000, 2000, 3000, 4000]);
      expect(seen.every((p) => p.available)).toBe(true);
    });

    it('without a cursor the first page stays compatible (default 100) and an invalid cursor is a 400', async () => {
      const all = await get('/v1/storefronts/twin-store/products').expect(200);
      expect(all.body.data).toHaveLength(4);
      expect(all.body.next_cursor).toBeNull();
      await get('/v1/storefronts/twin-store/products?cursor=bad!').expect(400);
      await get('/v1/storefronts/twin-store/products?limit=101').expect(400);
    });
  });

  describe('Seller Reviews', () => {
    it('pages newest first through a timestamp tie without skipping or repeating', async () => {
      const ids: string[] = [];
      const p1 = await get('/v1/storefronts/twin-store/reviews').expect(200);
      expect(p1.body.data).toHaveLength(3);
      expect(p1.body.data[0]).toMatchObject({ seller_rating: expect.any(Number), badge: 'UNVERIFIED' });
      expect(p1.body.data[0]).not.toHaveProperty('buyer_account_id');
      // One row per page walks across the tie: every review exactly once.
      let cursor: string | null = null;
      do {
        const r: request.Response = await get(`/v1/storefronts/twin-store/reviews?limit=1${cursor ? `&cursor=${cursor}` : ''}`).expect(200);
        ids.push(...r.body.data.map((x: { id: string }) => x.id));
        cursor = r.body.next_cursor;
      } while (cursor && ids.length < 10);
      expect(ids).toEqual(p1.body.data.map((x: { id: string }) => x.id));
      // The two reviews of one transaction share published_at: a one-row page must not drop either.
      const tied = await admin.query<{ n: number }>(
        `SELECT count(DISTINCT published_at)::int AS n FROM core.review WHERE seller_id = $1`,
        [SELLER.a],
      );
      expect(tied.rows[0]!.n).toBe(2);
    });

    it('an invalid cursor is a 400 CURSOR_INVALID (it was a 500)', async () => {
      const r = await get('/v1/storefronts/twin-store/reviews?cursor=not-a-date').expect(400);
      expect(r.body.slots).toMatchObject({ reason: 'CURSOR_INVALID' });
    });
  });

  describe('Market-scoped identity', () => {
    it('the same handle in another Market resolves to that Market\'s Seller on every read', async () => {
      const header = await get('/v1/storefronts/twin-store', DEV.b).expect(200);
      expect(header.body.store_name).toBe('Twin Store B');
      const scenes = await get('/v1/storefronts/twin-store/scenes', DEV.b).expect(200);
      expect(scenes.body.data.map((s: { public_ref: string }) => s.public_ref)).toEqual([refs['SB']]);
      const products = await get('/v1/storefronts/twin-store/products', DEV.b).expect(200);
      expect(products.body.data.map((p: { slug: string }) => p.slug)).toEqual(['lamp-b']);
      const reviews = await get('/v1/storefronts/twin-store/reviews', DEV.b).expect(200);
      expect(reviews.body.data).toEqual([]);
    });

    it('with no Market evidence the ambiguous handle is the neutral 404 on every read', async () => {
      for (const path of ['', '/scenes', '/products', '/reviews']) {
        const r = await server().get(`/v1/storefronts/twin-store${path}`).expect(404);
        expect(r.headers['cache-control']).toBe('no-store');
      }
    });
  });
});
