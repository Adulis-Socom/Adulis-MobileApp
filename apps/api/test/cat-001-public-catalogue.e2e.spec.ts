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
import { FakePostLinkAdapter, POST_LINK_ADAPTER } from '../src/modules/catalogue/post-link.adapter';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * WO-CAT-001 -- public Catalogue read integrity.
 *
 * One price/availability projection behind every public read; per-Variant availability from
 * the server; Market-safe Seller resolution (the same handle in two Markets); product_viewed
 * recorded for openings, not for declared revalidations. All fixtures are rows in the
 * disposable test database, removed in afterAll; the one Scene is published the production
 * way (Seller API).
 *
 *   Market A (ACTIVE)    Seller urban-style (A)   Seller only-here
 *   Market B (ACTIVE)    Seller urban-style (B)
 *   Market C (SUSPENDED) Seller calm-shop
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const id = (n: number) => `ca700000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const MA = id(1);
const MB = id(2);
const MC = id(3);
const OWNER = { a: id(10), b: id(11), c: id(12), u: id(13), buyerB: id(14) };
const SELLER = { a: id(20), b: id(21), c: id(22), u: id(23) };
const P = {
  basket: id(30),
  equal: id(31),
  single: id(32),
  withdrawn: id(33),
  novar: id(34),
  mixed: id(35),
  hidden: id(36),
  big: id(37),
  singleB: id(38),
  onlyB: id(39),
  calm: id(40),
  unique: id(41),
};
const V = {
  small: id(50),
  large: id(51),
  blue: id(52),
  red: id(53),
  one: id(54),
  wActive: id(55),
  wGone: id(56),
  nGone: id(57),
  etb: id(58),
  usd: id(59),
  hidden: id(60),
  big: id(61),
  singleB: id(62),
  onlyB: id(63),
  calm: id(64),
  unique: id(65),
};
const DEV = { a: id(70), b: id(71), c: id(72), noMarket: id(73), session: id(74) };
const UNREGISTERED = id(79);
const S = { ownerA: id(80), buyerB: id(81) };
const SOCIAL_POST = id(90);

const storage = new FakeMediaStorageAdapter();
const postLinks = new FakePostLinkAdapter();

@Module({ imports: [AppModule] })
class Cat001AppModule {}

type Summary = {
  slug: string;
  name: string;
  price_min_minor: number | null;
  price_max_minor: number | null;
  price_currency: string | null;
  available: boolean;
};
type Variant = { variant_key: string; price_minor: number; price_currency: string; available: boolean };

describe('WO-CAT-001 -- public Catalogue read integrity', () => {
  let app: INestApplication;
  let admin: Pool;
  let scenePublicRef = '';

  const server = () => request(app.getHttpServer());
  /** A public read as the Buyer app makes it: no bearer, the registered device's header. */
  const get = (path: string, device?: string) => {
    const r = server().get(path).set('X-Adulis-Client', 'android/1.0.0');
    return device ? r.set('X-Adulis-Device', device) : r;
  };
  const product = async (slug: string, device = DEV.a, handle = 'urban-style') =>
    (await get(`/v1/storefronts/${handle}/products/${slug}`, device).expect(200)).body as Summary & {
      variants: Variant[];
      attributes: unknown[];
    };
  const list = async (device = DEV.a, handle = 'urban-style') =>
    ((await get(`/v1/storefronts/${handle}/products`, device).expect(200)).body as { data: Summary[] }).data;
  const resolve = async (device: string) =>
    (
      (
        await server()
          .post('/v1/post-links/resolve')
          .set('Idempotency-Key', randomUUID())
          .set('X-Adulis-Client', 'android/1.0.0')
          .set('X-Adulis-Device', device)
          .send({ url: 'https://vm.tiktok.com/cat001' })
          .expect(200)
      ).body as { data: Array<Summary & { seller_handle: string }> }
    ).data;
  const priceOf = (s: Summary) => ({
    price_min_minor: s.price_min_minor,
    price_max_minor: s.price_max_minor,
    price_currency: s.price_currency,
    available: s.available,
  });
  const stock = (variant: string, seller: string, delta: number) =>
    admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [variant, seller, delta, delta >= 0 ? 'RESTOCK' : 'SELLER_SET'],
    );
  const views = async (productId: string) =>
    (
      await admin.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM analytics.event
          WHERE name = 'product_viewed' AND payload->>'product_id' = $1`,
        [productId],
      )
    ).rows[0]!.n;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone,
                                default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'CTA','Market A','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($2,'CTB','Market B','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($3,'CTC','Market C','PHASE_1','ETB','Africa/Addis_Ababa','en','SUSPENDED',false,'AFROMESSAGE')`,
      [MA, MB, MC],
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
        ($1,'+251911700101',$6,'ACTIVE'), ($2,'+251911700102',$7,'ACTIVE'),
        ($3,'+251911700103',$8,'ACTIVE'), ($4,'+251911700104',$6,'ACTIVE'),
        ($5,'+251911700105',$7,'ACTIVE')`,
      [OWNER.a, OWNER.b, OWNER.c, OWNER.u, OWNER.buyerB, MA, MB, MC],
    );
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES
        ($1,'ANDROID',$6), ($2,'ANDROID',$7), ($3,'ANDROID',$8), ($4,'ANDROID',NULL), ($5,'ANDROID',$6)`,
      [DEV.a, DEV.b, DEV.c, DEV.noMarket, DEV.session, MA, MB, MC],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status)
       VALUES ($1,$5,$8,'INDIVIDUAL','Urban Style A','urban-style','ACTIVE'),
              ($2,$6,$9,'INDIVIDUAL','Urban Style B','urban-style','ACTIVE'),
              ($3,$7,$10,'INDIVIDUAL','Calm Shop','calm-shop','ACTIVE'),
              ($4,$5,$11,'INDIVIDUAL','Only Here','only-here','ACTIVE')`,
      [SELLER.a, SELLER.b, SELLER.c, SELLER.u, MA, MB, MC, OWNER.a, OWNER.b, OWNER.c, OWNER.u],
    );
    // [id, seller, market, name, slug, seed, visibility]
    const products: Array<[string, string, string, string, string, number, string]> = [
      [P.basket, SELLER.a, MA, 'Woven basket', 'woven-basket', 100000, 'PUBLISHED'],
      [P.equal, SELLER.a, MA, 'Equal cups', 'equal-cups', 1, 'PUBLISHED'],
      [P.single, SELLER.a, MA, 'Single lantern', 'single-lantern', 1, 'PUBLISHED'],
      [P.withdrawn, SELLER.a, MA, 'Old tray', 'old-tray', 1, 'PUBLISHED'],
      [P.novar, SELLER.a, MA, 'Bare frame', 'bare-frame', 77700, 'PUBLISHED'],
      [P.mixed, SELLER.a, MA, 'Mixed scarf', 'mixed-scarf', 1, 'PUBLISHED'],
      [P.big, SELLER.a, MA, 'Big rug', 'big-rug', 1, 'PUBLISHED'],
      [P.singleB, SELLER.b, MB, 'Single lantern', 'single-lantern', 1, 'PUBLISHED'],
      [P.onlyB, SELLER.b, MB, 'Only B', 'only-b', 1, 'PUBLISHED'],
      [P.calm, SELLER.c, MC, 'Calm cup', 'calm-cup', 1, 'PUBLISHED'],
      [P.unique, SELLER.u, MA, 'Unique mat', 'unique-mat', 1, 'PUBLISHED'],
    ];
    for (const [pid, sid, mid, name, slug, seed, vis] of products) {
      await admin.query(
        `INSERT INTO core.product (id, seller_id, market_id, name, slug, base_price_minor,
                                   base_price_currency, visibility, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,'ETB',$7,now())`,
        [pid, sid, mid, name, slug, seed, vis],
      );
    }
    // Restricted by moderation: UNPUBLISHED with its reason, first publication kept.
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, slug, base_price_minor,
                                 base_price_currency, visibility, unpublished_reason, published_at)
       VALUES ($1,$2,$3,'Hidden bowl','hidden-bowl',1,'ETB','UNPUBLISHED','MODERATION',now())`,
      [P.hidden, SELLER.a, MA],
    );
    // [variant, product, seller, price, currency, key, stock]
    const variants: Array<[string, string, string, string, string, string, number]> = [
      [V.small, P.basket, SELLER.a, '90000', 'ETB', 'Small', 3],
      [V.large, P.basket, SELLER.a, '120000', 'ETB', 'Large', 0],
      [V.blue, P.equal, SELLER.a, '50000', 'ETB', 'Blue', 1],
      [V.red, P.equal, SELLER.a, '50000', 'ETB', 'Red', 1],
      [V.one, P.single, SELLER.a, '25000', 'ETB', 'One', 1],
      [V.wActive, P.withdrawn, SELLER.a, '30000', 'ETB', 'Active', 0],
      [V.wGone, P.withdrawn, SELLER.a, '99000', 'ETB', 'Gone', 5],
      [V.nGone, P.novar, SELLER.a, '10000', 'ETB', 'Gone', 2],
      [V.etb, P.mixed, SELLER.a, '40000', 'ETB', 'Birr', 2],
      [V.usd, P.mixed, SELLER.a, '1000', 'USD', 'Dollar', 2],
      [V.hidden, P.hidden, SELLER.a, '20000', 'ETB', 'One', 4],
      [V.big, P.big, SELLER.a, '900719925474099', 'ETB', 'One', 1],
      [V.singleB, P.singleB, SELLER.b, '70000', 'ETB', 'One', 1],
      [V.onlyB, P.onlyB, SELLER.b, '15000', 'ETB', 'One', 1],
      [V.calm, P.calm, SELLER.c, '5000', 'ETB', 'One', 1],
      [V.unique, P.unique, SELLER.u, '8000', 'ETB', 'One', 1],
    ];
    for (const [vid, pid, sid, price, cur, key, n] of variants) {
      const insert = (db: Pick<Pool, 'query'>) =>
        db.query(
          `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [vid, pid, sid, price, cur, key],
        );
      if (cur === 'ETB') {
        await insert(admin);
      } else {
        // A LEGACY row: since 0056 (OVN-088) no write may price a Variant outside its Market's
        // currency, so this one is inserted with triggers off, as data from before the guard.
        const legacy = await admin.connect();
        try {
          await legacy.query(`SET session_replication_role = replica`);
          await insert(legacy);
        } finally {
          await legacy.query(`SET session_replication_role = DEFAULT`);
          legacy.release();
        }
      }
      if (n > 0) await stock(vid, sid, n);
    }
    // Inactive Variants keep their positive stored stock.
    await admin.query(`UPDATE core.product_variant SET status = 'WITHDRAWN' WHERE id IN ($1, $2)`, [V.wGone, V.nGone]);

    await admin.query(`INSERT INTO core.social_post (id, platform, canonical_post_id) VALUES ($1,'TIKTOK','ttk-cat001')`, [
      SOCIAL_POST,
    ]);
    for (const [pid, sid] of [
      [P.single, SELLER.a],
      [P.basket, SELLER.a],
      [P.hidden, SELLER.a],
      [P.singleB, SELLER.b],
      [P.calm, SELLER.c],
    ] as const) {
      await admin.query(
        `INSERT INTO core.product_social_post (product_id, social_post_id, seller_id) VALUES ($1,$2,$3)`,
        [pid, SOCIAL_POST, sid],
      );
    }
    postLinks.register('https://vm.tiktok.com/cat001', { platform: 'TIKTOK', canonicalPostId: 'ttk-cat001' });

    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$3,'CONSOLE',$5, now()+interval '12 hours'),
        ($2,$4,'MOBILE',$5, now()+interval '12 hours')`,
      [S.ownerA, S.buyerB, OWNER.a, OWNER.buyerB, DEV.session],
    );
    await armFixtureSessions(admin, Object.values(S));

    const moduleRef = await Test.createTestingModule({ imports: [Cat001AppModule] })
      .overrideProvider(MEDIA_STORAGE_ADAPTER)
      .useValue(storage)
      .overrideProvider(POST_LINK_ADAPTER)
      .useValue(postLinks)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();

    // One Scene in Market A tagging basket (available), mixed and the all-unavailable tray.
    const asOwner = (r: request.Test) =>
      r
        .set('Cookie', `__Host-adulis_session=${sessionToken(S.ownerA)}`)
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', SELLER.a);
    const created = await asOwner(server().post('/v1/seller/scene-posts').set('Idempotency-Key', randomUUID()))
      .send({ caption: 'CAT-001 baskets', product_ids: [P.basket, P.mixed, P.withdrawn] })
      .expect(201);
    const sceneId = created.body.id as string;
    const up = await asOwner(server().post(`/v1/seller/scene-posts/${sceneId}/image-uploads`))
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    const keys = up.body.uploads as Record<'thumb' | 'card' | 'full', { key: string }>;
    storage.put(keys.thumb.key, { bytes: 30_000, contentType: 'image/webp' });
    storage.put(keys.card.key, { bytes: 150_000, contentType: 'image/webp' });
    storage.put(keys.full.key, { bytes: 700_000, contentType: 'image/webp' });
    const patched = await asOwner(server().patch(`/v1/seller/scene-posts/${sceneId}/draft`))
      .set('If-Match', `"${created.body.edit_version}"`)
      .send({ image: { thumb_key: keys.thumb.key, card_key: keys.card.key, full_key: keys.full.key } })
      .expect(200);
    const published = await asOwner(server().post(`/v1/seller/scene-posts/${sceneId}/publish`))
      .set('Idempotency-Key', randomUUID())
      .set('If-Match', `"${patched.body.edit_version}"`)
      .expect(200);
    scenePublicRef = published.body.public_ref as string;
  });

  afterAll(async () => {
    await app?.close();
    const sellers = Object.values(SELLER).map((s) => `'${s}'`).join(',');
    const markets = `'${MA}','${MB}','${MC}'`;
    const accounts = Object.values(OWNER).map((s) => `'${s}'`).join(',');
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM analytics.event WHERE market_id IN (${markets})`,
      `DELETE FROM core.rate_limit_bucket WHERE subject_id IN (${[...Object.values(DEV), UNREGISTERED, ...Object.values(OWNER)].map((s) => `'${s}'`).join(',')})`,
      `DELETE FROM core.idempotency_record WHERE actor_id IN (${[...Object.values(DEV), ...Object.values(OWNER)].map((s) => `'${s}'`).join(',')})`,
      `DELETE FROM core.notification WHERE recipient_account_id IN (${accounts})`,
      `DELETE FROM core.product_social_post WHERE social_post_id = '${SOCIAL_POST}'`,
      `DELETE FROM core.social_post WHERE id = '${SOCIAL_POST}'`,
      `DELETE FROM core.scene_post_transition WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.scene_post_product WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.scene_post_revision WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.scene_post WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.stock_event WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.product_variant WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.product WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.session WHERE id IN (${Object.values(S).map((s) => `'${s}'`).join(',')})`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller WHERE id IN (${sellers})`,
      `DELETE FROM core.device WHERE id IN (${Object.values(DEV).map((s) => `'${s}'`).join(',')})`,
      `DELETE FROM core.account WHERE id IN (${accounts})`,
      `DELETE FROM core.timing_config WHERE market_id IN (${markets})`,
      `DELETE FROM core.market WHERE id IN (${markets})`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  describe('pricing: one projection (OVN-072)', () => {
    it('different ACTIVE Variant prices are a min-max span; a zero-stock Variant stays in the span; never the seed', async () => {
      const p = await product('woven-basket');
      expect(priceOf(p)).toEqual({ price_min_minor: 90000, price_max_minor: 120000, price_currency: 'ETB', available: true });
      expect(p).toMatchObject({ base_price_minor: 100000 }); // the seed is still a labelled field, never the span
    });

    it('equal ACTIVE prices are one amount; one ACTIVE Variant is one amount', async () => {
      expect(priceOf(await product('equal-cups'))).toMatchObject({ price_min_minor: 50000, price_max_minor: 50000 });
      expect(priceOf(await product('single-lantern'))).toMatchObject({ price_min_minor: 25000, price_max_minor: 25000 });
    });

    it('an inactive Variant never enters the span, the option list or availability, whatever its stored stock', async () => {
      const p = await product('old-tray');
      expect(priceOf(p)).toEqual({ price_min_minor: 30000, price_max_minor: 30000, price_currency: 'ETB', available: false });
      expect(p.variants.map((v) => v.variant_key)).toEqual(['Active']);
    });

    it('no ACTIVE Variant is no current price -- null, never the creation seed', async () => {
      const p = await product('bare-frame');
      expect(priceOf(p)).toEqual({ price_min_minor: null, price_max_minor: null, price_currency: null, available: false });
      expect(p.variants).toEqual([]);
    });

    it('mixed currencies never merge into one range; the option outside the Market currency is not sellable', async () => {
      const p = await product('mixed-scarf');
      expect(priceOf(p)).toEqual({ price_min_minor: null, price_max_minor: null, price_currency: null, available: true });
      const byKey = Object.fromEntries(p.variants.map((v) => [v.variant_key, v]));
      expect(byKey['Birr']).toMatchObject({ price_minor: 40000, price_currency: 'ETB', available: true });
      expect(byKey['Dollar']).toMatchObject({ price_minor: 1000, price_currency: 'USD', available: false });
    });

    it('integer minor units survive exactly as JSON integers', async () => {
      const p = await product('big-rug');
      expect(p.price_max_minor).toBe(900719925474099);
      expect(Number.isSafeInteger(p.variants[0]!.price_minor)).toBe(true);
    });

    it('a Variant price change shows on the next read of every surface', async () => {
      await admin.query(`UPDATE core.product_variant SET price_minor = 26000 WHERE id = $1`, [V.one]);
      try {
        expect((await product('single-lantern')).price_min_minor).toBe(26000);
        expect((await list()).find((s) => s.slug === 'single-lantern')?.price_min_minor).toBe(26000);
      } finally {
        await admin.query(`UPDATE core.product_variant SET price_minor = 25000 WHERE id = $1`, [V.one]);
      }
    });

    it('detail, list, search, post-link and Scene tag price and qualify a Product identically', async () => {
      const want = priceOf(await product('woven-basket'));
      expect(priceOf((await list()).find((s) => s.slug === 'woven-basket')!)).toEqual(want);
      const search = (await get('/v1/storefronts/urban-style/search?q=basket', DEV.a).expect(200)).body as { data: Summary[] };
      expect(search.data.map((s) => s.slug)).toEqual(['woven-basket']);
      expect(priceOf(search.data[0]!)).toEqual(want);
      expect(priceOf((await resolve(DEV.a)).find((s) => s.slug === 'woven-basket')!)).toEqual(want);
      const scene = (await get(`/v1/scene-posts/${scenePublicRef}`, DEV.a).expect(200)).body as { products: Summary[] };
      expect(priceOf(scene.products.find((s) => s.slug === 'woven-basket')!)).toEqual(want);
      // The tag and its Product agree on the mixed-currency and all-unavailable cases too.
      for (const slug of ['mixed-scarf', 'old-tray']) {
        expect(priceOf(scene.products.find((s) => s.slug === slug)!)).toEqual(priceOf(await product(slug)));
      }
    });
  });

  describe('availability: the server decides, per Variant (OVN-074)', () => {
    it('Small is available, Large is currently unavailable, and the Product is available', async () => {
      const p = await product('woven-basket');
      expect(p.available).toBe(true);
      expect(p.variants.map((v) => [v.variant_key, v.price_minor, v.available])).toEqual([
        ['Large', 120000, false],
        ['Small', 90000, true],
      ]);
    });

    it('a Product with every Variant unavailable stays listed, marked unavailable', async () => {
      const tray = (await list()).find((s) => s.slug === 'old-tray');
      expect(tray).toMatchObject({ available: false, price_min_minor: 30000 });
    });

    it.each(['CLOSING', 'BILLING_SUSPENDED'])('a %s Seller keeps its listing but sells nothing', async (status) => {
      await admin.query(`UPDATE core.seller SET status = $2 WHERE id = $1`, [SELLER.a, status]);
      try {
        const p = await product('woven-basket');
        expect(p.available).toBe(false);
        expect(p.variants.every((v) => !v.available)).toBe(true);
        expect((await list()).every((s) => !s.available)).toBe(true);
      } finally {
        await admin.query(`UPDATE core.seller SET status = 'ACTIVE' WHERE id = $1`, [SELLER.a]);
      }
    });

    it('an unpublished (moderation-restricted) Product is on no public read, though it has stock', async () => {
      await get('/v1/storefronts/urban-style/products/hidden-bowl', DEV.a).expect(404);
      expect((await list()).map((s) => s.slug)).not.toContain('hidden-bowl');
      const search = await get('/v1/storefronts/urban-style/search?q=bowl', DEV.a).expect(200);
      expect(search.body.data).toEqual([]);
      expect((await resolve(DEV.a)).map((s) => s.slug)).not.toContain('hidden-bowl');
    });

    it('a stock change shows on the next read, Product and option together', async () => {
      await stock(V.one, SELLER.a, -1);
      try {
        const p = await product('single-lantern');
        expect(p.available).toBe(false);
        expect(p.variants[0]!.available).toBe(false);
      } finally {
        await stock(V.one, SELLER.a, 1);
      }
      expect((await product('single-lantern')).variants[0]!.available).toBe(true);
    });
  });

  describe('Market-safe resolution (OVN-016, OVN-077)', () => {
    it("the same handle in two Markets resolves inside the requester's Market", async () => {
      const a = await list(DEV.a);
      const b = await list(DEV.b);
      expect(a.find((s) => s.slug === 'single-lantern')?.price_min_minor).toBe(25000);
      expect(b.find((s) => s.slug === 'single-lantern')?.price_min_minor).toBe(70000);
      expect(a.map((s) => s.slug)).not.toContain('only-b');
      expect(b.map((s) => s.slug).sort()).toEqual(['only-b', 'single-lantern']);
      expect((await product('single-lantern', DEV.b)).price_min_minor).toBe(70000);
    });

    it.each([
      ['no device', undefined],
      ['an unregistered device', UNREGISTERED],
      ['a device with no Market yet', DEV.noMarket],
    ])('with %s an ambiguous handle is the neutral 404, never the first row', async (_label, device) => {
      for (const path of [
        '/v1/storefronts/urban-style',
        '/v1/storefronts/urban-style/products',
        '/v1/storefronts/urban-style/products/single-lantern',
        '/v1/storefronts/urban-style/search?q=lantern',
        '/v1/storefronts/urban-style/reviews',
      ]) {
        const r = await get(path, device).expect(404);
        expect(r.body.code).toBe('NOT_FOUND');
      }
    });

    it("a unique handle resolves without Market evidence; another Market's requester gets the 404", async () => {
      await get('/v1/storefronts/only-here/products/unique-mat').expect(200);
      await get('/v1/storefronts/only-here/products/unique-mat', DEV.a).expect(200);
      await get('/v1/storefronts/only-here/products/unique-mat', DEV.b).expect(404);
    });

    it("another Market's Seller's Product slug is the same 404 (no cross-Market leak)", async () => {
      await get('/v1/storefronts/urban-style/products/only-b', DEV.a).expect(404);
      await get('/v1/storefronts/urban-style/products/only-b', DEV.b).expect(200);
      await get('/v1/storefronts/urban-style/products/woven-basket', DEV.b).expect(404);
    });

    it("an inactive (SUSPENDED) Market's Seller is the neutral 404 for everyone", async () => {
      for (const device of [undefined, DEV.c, DEV.a]) {
        await get('/v1/storefronts/calm-shop', device).expect(404);
        await get('/v1/storefronts/calm-shop/products/calm-cup', device).expect(404);
      }
    });

    it("a signed-in Account's Market wins over the device's", async () => {
      const r = await get('/v1/storefronts/urban-style/products/single-lantern', DEV.a)
        .set('Authorization', `Bearer ${sessionToken(S.buyerB)}`)
        .expect(200);
      expect(r.body.price_min_minor).toBe(70000);
    });

    it("post-link resolution keeps to the requester's Market and never an inactive Market", async () => {
      const handles = (rows: Array<{ slug: string; seller_handle: string; price_min_minor: number | null }>) =>
        rows.map((r) => `${r.slug}:${r.price_min_minor}`).sort();
      expect(handles(await resolve(DEV.a))).toEqual(['single-lantern:25000', 'woven-basket:90000']);
      expect(handles(await resolve(DEV.b))).toEqual(['single-lantern:70000']);
      expect(handles(await resolve(DEV.noMarket))).toEqual([
        'single-lantern:25000',
        'single-lantern:70000',
        'woven-basket:90000',
      ]);
    });

    it('Scene -> Product stays in one Market: another Market sees the Scene as the same 404', async () => {
      const scene = (await get(`/v1/scene-posts/${scenePublicRef}`, DEV.a).expect(200)).body as {
        seller: { handle: string };
        products: Summary[];
      };
      await get(`/v1/scene-posts/${scenePublicRef}`, DEV.b).expect(404);
      await get(`/v1/scene-posts/${scenePublicRef}`).expect(200); // a public_ref is unique across Markets
      const tag = scene.products.find((s) => s.slug === 'woven-basket')!;
      const p = await product(tag.slug, DEV.a, scene.seller.handle);
      expect(priceOf(p)).toEqual(priceOf(tag));
    });

    it('lookup lists only the requester Market and never an inactive Market', async () => {
      const a = await get('/v1/sellers/lookup?q=urban', DEV.a).expect(200);
      expect(a.body.data).toEqual([{ handle: 'urban-style', store_name: 'Urban Style A' }]);
      const calm = await get('/v1/sellers/lookup?q=calm').expect(200);
      expect(calm.body.data).toEqual([]);
    });

    it('reads that depend on the requester are never shared-cached', async () => {
      for (const path of [
        '/v1/storefronts/urban-style',
        '/v1/storefronts/urban-style/products',
        '/v1/storefronts/urban-style/products/woven-basket',
        '/v1/storefronts/urban-style/search?q=basket',
        '/v1/storefronts/urban-style/reviews',
        '/v1/sellers/lookup?q=urban',
      ]) {
        const r = await get(path, DEV.a).expect(200);
        expect(r.headers['cache-control']).toBe('no-store');
        // The neutral 404 depends on the requester too: it is not cacheable either.
        if (path.includes('urban-style')) {
          const gone = await get(path).expect(404);
          expect(gone.headers['cache-control']).toBe('no-store');
        }
      }
    });

    it('a device whose Market is not ACTIVE has no Market evidence: unique handles resolve, ambiguous ones stay 404', async () => {
      await get('/v1/storefronts/only-here/products/unique-mat', DEV.c).expect(200);
      await get('/v1/storefronts/urban-style/products/single-lantern', DEV.c).expect(404);
    });
  });

  describe('product views: openings, not revalidations (OVN-073)', () => {
    it('an opening records one product_viewed; a declared revalidation records none; a new opening counts again', async () => {
      const before = await views(P.equal);
      await get('/v1/storefronts/urban-style/products/equal-cups', DEV.a).expect(200);
      expect(await views(P.equal)).toBe(before + 1);
      await get('/v1/storefronts/urban-style/products/equal-cups?revalidate=true', DEV.a).expect(200);
      await get('/v1/storefronts/urban-style/products/equal-cups?revalidate=true', DEV.a).expect(200);
      expect(await views(P.equal)).toBe(before + 1);
      // Repeated deliberate openings are never suppressed; only the exact token withholds.
      await get('/v1/storefronts/urban-style/products/equal-cups', DEV.a).expect(200);
      await get('/v1/storefronts/urban-style/products/equal-cups?revalidate=false', DEV.a).expect(200);
      expect(await views(P.equal)).toBe(before + 3);
    });

    it('a 404 records nothing: unpublished, another Market, an ambiguous handle', async () => {
      const hidden = await views(P.hidden);
      const basket = await views(P.basket);
      await get('/v1/storefronts/urban-style/products/hidden-bowl', DEV.a).expect(404);
      await get('/v1/storefronts/urban-style/products/woven-basket', DEV.b).expect(404);
      await get('/v1/storefronts/urban-style/products/woven-basket').expect(404);
      expect(await views(P.hidden)).toBe(hidden);
      expect(await views(P.basket)).toBe(basket);
    });

    it('concurrent opening requests each record: the server count is not de-duplicated (documented limit)', async () => {
      const before = await views(P.unique);
      await Promise.all([
        get('/v1/storefronts/only-here/products/unique-mat', DEV.a).expect(200),
        get('/v1/storefronts/only-here/products/unique-mat', DEV.a).expect(200),
      ]);
      expect(await views(P.unique)).toBe(before + 2);
    });
  });
});
