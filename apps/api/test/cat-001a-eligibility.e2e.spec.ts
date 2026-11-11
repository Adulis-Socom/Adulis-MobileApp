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
 * WO-CAT-001A -- Scene and Catalogue item-level eligibility agree (OVN-087), Variant prices
 * are in the Market currency (OVN-088), a Product's Market is its Seller's (OVN-090).
 *
 * Real PostgreSQL (the disposable database). Scenes are published the production way (Seller
 * API); availability moves through StockEvents, Product and Variant writes, Seller and Market
 * changes -- never by writing Scene rows. Each lifecycle step is checked on the direct Scene
 * read, in For You delivery and in the Seller's management view.
 *
 *   Market M  (ACTIVE)  Seller A: Products P1, P2, P3 (Scene S tags P1, P2)
 *   Market M2 (ACTIVE)  Seller B: Product PB (Scene SB tags PB)
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const id = (n: number) => `ca71a000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const M = id(1);
const M2 = id(2);
const OWNER_A = id(10);
const OWNER_B = id(11);
const SELLER_A = id(20);
const SELLER_B = id(21);
const P1 = id(30);
const P2 = id(31);
const P3 = id(32);
const PB = id(33);
const V1 = id(40);
const V2 = id(41);
const V3 = id(42);
const VB = id(43);
const DEV_SESSION = id(50);
const S = { ownerA: id(70), ownerB: id(71) };
let devices = 0;
const freshDevice = () => id(0x100 + devices++);

const storage = new FakeMediaStorageAdapter();

@Module({ imports: [AppModule] })
class Cat001aAppModule {}

describe('WO-CAT-001A -- Scene and Catalogue eligibility consistency', () => {
  let app: INestApplication;
  let admin: Pool;
  const scenes = new Map<string, { id: string; ref: string }>();

  const server = () => request(app.getHttpServer());
  const asOwner = (seller: string, session: string, r: request.Test) =>
    r
      .set('Cookie', `__Host-adulis_session=${sessionToken(session)}`)
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Seller', seller);

  const stockOf = async (variant: string) =>
    (await admin.query<{ n: number }>(`SELECT stock_count AS n FROM core.product_variant WHERE id = $1`, [variant]))
      .rows[0]!.n;
  const setStock = async (variant: string, seller: string, to: number) => {
    const n = await stockOf(variant);
    if (n !== to) {
      await admin.query(
        `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
        [variant, seller, to - n, to > n ? 'RESTOCK' : 'SELLER_SET'],
      );
    }
  };
  const state = async (name: string) =>
    (
      await admin.query<{ visibility: string; visibility_reason: string | null }>(
        `SELECT visibility, visibility_reason FROM core.scene_post WHERE id = $1`,
        [scenes.get(name)!.id],
      )
    ).rows[0]!;
  /** A new device in the Market, registered (rows): one For You session each. */
  const deviceIn = async (market: string) => {
    const d = freshDevice();
    await admin.query(`INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$2)`, [d, market]);
    return d;
  };
  /** The Scene as a Buyer meets it: the direct read, For You, and the Seller's own list. */
  const observe = async (name: string, market: string, seller: string, session: string) => {
    const { ref } = scenes.get(name)!;
    const read = (await server().get(`/v1/scene-posts/${ref}`)).status;
    // For You serves only from core.v_scene_post_public (disc-002 proves the delivery); reading the
    // gate itself keeps this suite independent of the shared ACTIVE algorithm version, which
    // disc-002 switches while it runs in a parallel worker.
    const gate = await admin.query(`SELECT 1 FROM core.v_scene_post_public WHERE public_ref = $1 AND market_id = $2`, [
      ref,
      market,
    ]);
    const inFeed = gate.rows.length === 1;
    const list = await asOwner(seller, session, server().get('/v1/seller/scene-posts')).expect(200);
    const mine = (list.body.data as Array<{ public_ref: string; visibility: string; visibility_reason: string | null }>).find(
      (s) => s.public_ref === ref,
    )!;
    return { read, inFeed, visibility: mine.visibility, reason: mine.visibility_reason };
  };
  const PUBLIC_EVERYWHERE = { read: 200, inFeed: true, visibility: 'PUBLIC', reason: null };

  const publishScene = async (name: string, seller: string, session: string, products: string[]) => {
    const idem = () => randomUUID();
    const created = await asOwner(seller, session, server().post('/v1/seller/scene-posts').set('Idempotency-Key', idem()))
      .send({ caption: `CAT-001A ${name}`, product_ids: products })
      .expect(201);
    const sceneId = created.body.id as string;
    const up = await asOwner(seller, session, server().post(`/v1/seller/scene-posts/${sceneId}/image-uploads`))
      .set('Idempotency-Key', idem())
      .expect(200);
    const keys = up.body.uploads as Record<'thumb' | 'card' | 'full', { key: string }>;
    storage.put(keys.thumb.key, { bytes: 30_000, contentType: 'image/webp' });
    storage.put(keys.card.key, { bytes: 150_000, contentType: 'image/webp' });
    storage.put(keys.full.key, { bytes: 700_000, contentType: 'image/webp' });
    const patched = await asOwner(seller, session, server().patch(`/v1/seller/scene-posts/${sceneId}/draft`))
      .set('If-Match', `"${created.body.edit_version}"`)
      .send({ image: { thumb_key: keys.thumb.key, card_key: keys.card.key, full_key: keys.full.key } })
      .expect(200);
    const published = await asOwner(seller, session, server().post(`/v1/seller/scene-posts/${sceneId}/publish`))
      .set('Idempotency-Key', idem())
      .set('If-Match', `"${patched.body.edit_version}"`)
      .expect(200);
    scenes.set(name, { id: sceneId, ref: published.body.public_ref as string });
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 4 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone,
                                default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'C1A','Market M','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($2,'C1B','Market M2','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',false,'AFROMESSAGE')`,
      [M, M2],
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
      [[M, M2]],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251911701001',$3,'ACTIVE'), ($2,'+251911701002',$4,'ACTIVE')`,
      [OWNER_A, OWNER_B, M, M2],
    );
    await admin.query(`INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$2)`, [DEV_SESSION, M]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status)
       VALUES ($1,$3,$5,'INDIVIDUAL','C1A Alpha','c1a-alpha','ACTIVE'),
              ($2,$4,$6,'INDIVIDUAL','C1A Beta','c1a-beta','ACTIVE')`,
      [SELLER_A, SELLER_B, M, M2, OWNER_A, OWNER_B],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, visibility, base_price_minor,
                                 base_price_currency, published_at) VALUES
        ($1,$5,$7,'Basket','PUBLISHED',1,'ETB',now()), ($2,$5,$7,'Lamp','PUBLISHED',1,'ETB',now()),
        ($3,$5,$7,'Cup','PUBLISHED',1,'ETB',now()), ($4,$6,$8,'Jebena','PUBLISHED',1,'ETB',now())`,
      [P1, P2, P3, PB, SELLER_A, SELLER_B, M, M2],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key)
       VALUES ($1,$5,$9,1000,'ETB','one'), ($2,$6,$9,2000,'ETB','one'), ($3,$7,$9,3000,'ETB','one'),
              ($4,$8,$10,4000,'ETB','one')`,
      [V1, V2, V3, VB, P1, P2, P3, PB, SELLER_A, SELLER_B],
    );
    for (const [v, s] of [
      [V1, SELLER_A],
      [V2, SELLER_A],
      [V3, SELLER_A],
      [VB, SELLER_B],
    ] as const) {
      await setStock(v, s, 3);
    }
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$3,'CONSOLE',$5, now()+interval '12 hours'), ($2,$4,'CONSOLE',$5, now()+interval '12 hours')`,
      [S.ownerA, S.ownerB, OWNER_A, OWNER_B, DEV_SESSION],
    );
    await armFixtureSessions(admin, Object.values(S));

    const moduleRef = await Test.createTestingModule({ imports: [Cat001aAppModule] })
      .overrideProvider(MEDIA_STORAGE_ADAPTER)
      .useValue(storage)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();

    await publishScene('S', SELLER_A, S.ownerA, [P1, P2]);
    await publishScene('SB', SELLER_B, S.ownerB, [PB]);
  });

  afterEach(async () => {
    // Every case starts from the same live state.
    await admin.query(`UPDATE core.seller SET status = 'ACTIVE' WHERE id IN ($1,$2) AND status <> 'ACTIVE'`, [SELLER_A, SELLER_B]);
    await admin.query(`UPDATE core.market SET activation_state = 'ACTIVE' WHERE id = $1 AND activation_state <> 'ACTIVE'`, [M2]);
    await admin.query(`UPDATE core.market SET display_currency = 'ETB' WHERE id = $1 AND display_currency <> 'ETB'`, [M2]);
    await admin.query(
      `UPDATE core.product SET visibility = 'PUBLISHED', unpublished_reason = NULL WHERE id IN ($1,$2,$3,$4) AND visibility <> 'PUBLISHED'`,
      [P1, P2, P3, PB],
    );
    await admin.query(`UPDATE core.product_variant SET status = 'ACTIVE' WHERE id IN ($1,$2,$3,$4) AND status <> 'ACTIVE'`, [V1, V2, V3, VB]);
    // A failed D5 must not leave its legacy currency behind for the next case.
    await admin.query(`UPDATE core.product_variant SET price_currency = 'ETB' WHERE id IN ($1,$2,$3,$4) AND price_currency <> 'ETB'`, [V1, V2, V3, VB]);
    for (const [v, s] of [
      [V1, SELLER_A],
      [V2, SELLER_A],
      [V3, SELLER_A],
      [VB, SELLER_B],
    ] as const) {
      await setStock(v, s, 3);
    }
  });

  afterAll(async () => {
    await app?.close();
    const sellers = `'${SELLER_A}','${SELLER_B}'`;
    const markets = `'${M}','${M2}'`;
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.fyp_impression WHERE scene_post_id IN (SELECT id FROM core.scene_post WHERE seller_id IN (${sellers}))`,
      `DELETE FROM core.fyp_session WHERE market_id IN (${markets})`,
      `DELETE FROM core.rate_limit_bucket WHERE subject_id IN (SELECT id::text FROM core.device WHERE id::text LIKE 'ca71a000-%')`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER_A}','${OWNER_B}')`,
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${OWNER_A}','${OWNER_B}')`,
      `DELETE FROM core.scene_post_transition WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.scene_post_product WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.scene_post_revision WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.scene_post WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.stock_event WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.product_variant WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.product WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.session WHERE id IN ('${S.ownerA}','${S.ownerB}')`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller WHERE id IN (${sellers})`,
      `DELETE FROM core.device WHERE id::text LIKE 'ca71a000-%'`,
      `DELETE FROM core.account WHERE id IN ('${OWNER_A}','${OWNER_B}')`,
      `DELETE FROM core.timing_config WHERE market_id IN (${markets})`,
      `DELETE FROM core.market WHERE id IN (${markets})`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  describe('Scene lifecycle (S D1-D10)', () => {
    it('D1-D4: several available -> one unavailable stays PUBLIC -> last unavailable goes PRIVATE -> availability restores PUBLIC', async () => {
      expect(await observe('S', M, SELLER_A, S.ownerA)).toEqual(PUBLIC_EVERYWHERE);
      await setStock(V1, SELLER_A, 0);
      expect(await observe('S', M, SELLER_A, S.ownerA)).toEqual(PUBLIC_EVERYWHERE);
      await setStock(V2, SELLER_A, 0);
      expect(await observe('S', M, SELLER_A, S.ownerA)).toEqual({
        read: 404,
        inFeed: false,
        visibility: 'PRIVATE',
        reason: 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK',
      });
      await setStock(V1, SELLER_A, 2);
      expect(await observe('S', M, SELLER_A, S.ownerA)).toEqual(PUBLIC_EVERYWHERE);
    });

    it('D5: a Variant priced outside the Market currency is not available; correcting it restores the Scene', async () => {
      // Since 0056 no write can create one, so it is a LEGACY row (triggers off), the only in-stock option.
      await setStock(V1, SELLER_A, 0);
      const legacy = await admin.connect();
      try {
        await legacy.query(`SET session_replication_role = replica`);
        await legacy.query(`UPDATE core.product_variant SET price_currency = 'USD' WHERE id = $1`, [V2]);
      } finally {
        await legacy.query(`SET session_replication_role = DEFAULT`);
        legacy.release();
      }
      const view = await admin.query<{ available: boolean }>(
        `SELECT available FROM core.v_scene_product_availability WHERE product_id = $1`,
        [P2],
      );
      expect(view.rows[0]!.available).toBe(false);
      // Any availability input re-evaluates: the Scene's tags now have nothing sellable.
      await setStock(V2, SELLER_A, 2);
      expect(await state('S')).toEqual({ visibility: 'PRIVATE', visibility_reason: 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK' });
      // Correcting the currency is a write the guard allows, and price_currency re-evaluates.
      await admin.query(`UPDATE core.product_variant SET price_currency = 'ETB' WHERE id = $1`, [V2]);
      expect(await observe('S', M, SELLER_A, S.ownerA)).toEqual(PUBLIC_EVERYWHERE);
    });

    it("D5: a Market with Products keeps its currency, so its Scenes stay as they are (ON-009, WO-007A)", async () => {
      // This case changed the currency and watched the Scenes go PRIVATE and back. The founder
      // fixed a Market's currency once it has Products (0059): the change is refused.
      expect(await observe('SB', M2, SELLER_B, S.ownerB)).toEqual(PUBLIC_EVERYWHERE);
      await expect(admin.query(`UPDATE core.market SET display_currency = 'USD' WHERE id = $1`, [M2])).rejects.toMatchObject({
        code: '23514',
        constraint: 'market_currency_fixed_with_products',
      });
      const m = await admin.query<{ c: string }>(`SELECT display_currency AS c FROM core.market WHERE id = $1`, [M2]);
      expect(m.rows[0]!.c).toBe('ETB');
      expect(await observe('SB', M2, SELLER_B, S.ownerB)).toEqual(PUBLIC_EVERYWHERE);
    });

    it('D6: a suspended Seller hides the Scene at once and blocks restoration until it is ACTIVE again', async () => {
      await admin.query(`UPDATE core.seller SET status = 'SAFETY_SUSPENDED' WHERE id = $1`, [SELLER_A]);
      // Hidden from every Buyer surface at once (the public gate), whatever its stored visibility.
      expect((await server().get(`/v1/scene-posts/${scenes.get('S')!.ref}`)).status).toBe(404);
      const gate = await admin.query(`SELECT 1 FROM core.v_scene_post_public WHERE public_ref = $1`, [scenes.get('S')!.ref]);
      expect(gate.rows).toEqual([]);
      // Stock goes and comes back while suspended: PRIVATE, and no restoration past the gate.
      await setStock(V1, SELLER_A, 0);
      await setStock(V2, SELLER_A, 0);
      expect(await state('S')).toMatchObject({ visibility: 'PRIVATE' });
      await setStock(V1, SELLER_A, 2);
      expect(await state('S')).toMatchObject({ visibility: 'PRIVATE' });
      // The gate clears: the Seller trigger restores it in the same COMMIT sweep.
      await admin.query(`UPDATE core.seller SET status = 'ACTIVE' WHERE id = $1`, [SELLER_A]);
      expect(await observe('S', M, SELLER_A, S.ownerA)).toEqual(PUBLIC_EVERYWHERE);
    });

    it('D7: a deactivated Market hides its Scene; reactivation shows it again', async () => {
      await admin.query(`UPDATE core.market SET activation_state = 'SUSPENDED' WHERE id = $1`, [M2]);
      expect((await server().get(`/v1/scene-posts/${scenes.get('SB')!.ref}`)).status).toBe(404);
      await admin.query(`UPDATE core.market SET activation_state = 'ACTIVE' WHERE id = $1`, [M2]);
      expect(await observe('SB', M2, SELLER_B, S.ownerB)).toEqual(PUBLIC_EVERYWHERE);
    });

    it('D8: unpublishing the last available Product makes the Scene PRIVATE (unavailable); republishing restores it', async () => {
      await setStock(V1, SELLER_A, 0);
      await admin.query(`UPDATE core.product SET visibility = 'UNPUBLISHED', unpublished_reason = 'SELLER' WHERE id = $1`, [P2]);
      expect(await observe('S', M, SELLER_A, S.ownerA)).toEqual({
        read: 404,
        inFeed: false,
        visibility: 'PRIVATE',
        reason: 'ALL_TAGGED_PRODUCTS_UNAVAILABLE',
      });
      await admin.query(`UPDATE core.product SET visibility = 'PUBLISHED', unpublished_reason = NULL WHERE id = $1`, [P2]);
      expect(await observe('S', M, SELLER_A, S.ownerA)).toEqual(PUBLIC_EVERYWHERE);
    });

    it('D9: withdrawing the last in-stock Variant makes the Scene PRIVATE; reactivating restores it', async () => {
      await setStock(V1, SELLER_A, 0);
      await admin.query(`UPDATE core.product_variant SET status = 'WITHDRAWN' WHERE id = $1`, [V2]);
      expect(await state('S')).toMatchObject({ visibility: 'PRIVATE' });
      await admin.query(`UPDATE core.product_variant SET status = 'ACTIVE' WHERE id = $1`, [V2]);
      expect(await observe('S', M, SELLER_A, S.ownerA)).toEqual(PUBLIC_EVERYWHERE);
    });

    it('D10: concurrent last-stock changes in two transactions leave no PUBLIC Scene without an available tag', async () => {
      const a = await admin.connect();
      const b = await admin.connect();
      try {
        await a.query('BEGIN');
        await b.query('BEGIN');
        await a.query(
          `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(), $1, $2, -3, 'SELLER_SET')`,
          [V1, SELLER_A],
        );
        await b.query(
          `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(), $1, $2, -3, 'SELLER_SET')`,
          [V2, SELLER_A],
        );
        await Promise.all([a.query('COMMIT'), b.query('COMMIT')]);
      } finally {
        a.release();
        b.release();
      }
      expect(await state('S')).toMatchObject({ visibility: 'PRIVATE' });
      const broken = await admin.query(
        `SELECT sp.id FROM core.scene_post sp
          WHERE sp.publication_state = 'PUBLISHED' AND sp.visibility = 'PUBLIC'
            AND sp.seller_id IN ($1,$2)
            AND NOT EXISTS (SELECT 1 FROM core.scene_post_product t
                              JOIN core.v_scene_product_availability v ON v.product_id = t.product_id
                             WHERE t.revision_id = sp.current_published_revision_id AND v.available)`,
        [SELLER_A, SELLER_B],
      );
      expect(broken.rows).toEqual([]);
      // And concurrently back: restored exactly once.
      const c = await admin.connect();
      const d = await admin.connect();
      try {
        await c.query('BEGIN');
        await d.query('BEGIN');
        await c.query(
          `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(), $1, $2, 3, 'RESTOCK')`,
          [V1, SELLER_A],
        );
        await d.query(
          `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(), $1, $2, 3, 'RESTOCK')`,
          [V2, SELLER_A],
        );
        await Promise.all([c.query('COMMIT'), d.query('COMMIT')]);
      } finally {
        c.release();
        d.release();
      }
      expect(await observe('S', M, SELLER_A, S.ownerA)).toEqual(PUBLIC_EVERYWHERE);
    });
  });

  describe('Catalogue and Scene agree item by item (OVN-087)', () => {
    it("every tag's Scene availability equals the Catalogue projection's, across stock, status, publication and Seller changes", async () => {
      const device = await deviceIn(M);
      const compare = async () => {
        const scene = await server().get(`/v1/scene-posts/${scenes.get('S')!.ref}`).set('X-Adulis-Device', device);
        const view = await admin.query<{ product_id: string; available: boolean }>(
          `SELECT product_id, available FROM core.v_scene_product_availability WHERE product_id IN ($1,$2,$3)`,
          [P1, P2, P3],
        );
        for (const [pid, slug] of [
          [P1, 'basket'],
          [P2, 'lamp'],
          [P3, 'cup'],
        ] as const) {
          const product = await server().get(`/v1/storefronts/c1a-alpha/products/${slug}?revalidate=true`).set('X-Adulis-Device', device);
          const viewAvailable = view.rows.find((r) => r.product_id === pid)!.available;
          if (product.status === 200) {
            // Item level identical; the Catalogue adds the Seller/Market gates (ACTIVE here).
            expect(product.body.available).toBe(viewAvailable);
          }
          if (scene.status === 200) {
            const tag = (scene.body.products as Array<{ slug: string; available: boolean }>).find((t) => t.slug === slug);
            if (tag) expect(tag.available).toBe(viewAvailable);
          }
        }
      };
      await compare();
      await setStock(V1, SELLER_A, 0);
      await compare();
      // The case the two rules used to disagree on: the only in-stock option of a Product is a
      // legacy row priced outside the Market currency (inserted with triggers off, stock set).
      const legacyVariant = randomUUID();
      const legacy = await admin.connect();
      try {
        await legacy.query(`SET session_replication_role = replica`);
        await legacy.query(
          `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key, stock_count)
           VALUES ($1, $2, $3, 500, 'USD', 'legacy-usd', 5)`,
          [legacyVariant, P1, SELLER_A],
        );
      } finally {
        await legacy.query(`SET session_replication_role = DEFAULT`);
        legacy.release();
      }
      await compare();
      const p1 = await admin.query<{ available: boolean; in_stock: boolean }>(
        `SELECT available, in_stock FROM core.v_scene_product_availability WHERE product_id = $1`,
        [P1],
      );
      expect(p1.rows[0]).toEqual({ available: false, in_stock: true });
      await admin.query(`DELETE FROM core.product_variant WHERE id = $1`, [legacyVariant]);
      await admin.query(`UPDATE core.product_variant SET status = 'WITHDRAWN' WHERE id = $1`, [V3]);
      await compare();
      await admin.query(`UPDATE core.product SET visibility = 'UNPUBLISHED', unpublished_reason = 'SELLER' WHERE id = $1`, [P3]);
      await compare();
    });
  });

  describe('Variant currency integrity (OVN-088)', () => {
    it('the Seller API refuses a Variant or a Product priced outside the Market currency, naming the field', async () => {
      const variant = await asOwner(SELLER_A, S.ownerA, server().post(`/v1/seller/products/${P1}/variants`))
        .set('Idempotency-Key', randomUUID())
        .send({ variant_key: 'usd', price_minor: 100, price_currency: 'USD' })
        .expect(400);
      expect(variant.body).toMatchObject({ code: 'VALIDATION_FAILED', slots: { path: 'price_currency' } });
      const product = await asOwner(SELLER_A, S.ownerA, server().post('/v1/seller/products'))
        .set('Idempotency-Key', randomUUID())
        .send({ name: 'Dollar mug', base_price_minor: 100, base_price_currency: 'USD' })
        .expect(400);
      expect(product.body).toMatchObject({ code: 'VALIDATION_FAILED', slots: { path: 'base_price_currency' } });
    });

    it('a valid ETB Variant is accepted', async () => {
      const ok = await asOwner(SELLER_A, S.ownerA, server().post(`/v1/seller/products/${P1}/variants`))
        .set('Idempotency-Key', randomUUID())
        .send({ variant_key: 'large-etb', price_minor: 1500, price_currency: 'ETB' })
        .expect(201);
      expect(ok.body.variant_id).toEqual(expect.any(String));
      await admin.query(`DELETE FROM core.product_variant WHERE id = $1`, [ok.body.variant_id]);
    });

    it('the database refuses a mixed-currency insert or an invalid update by any path', async () => {
      await expect(
        admin.query(
          `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key)
           VALUES (gen_random_uuid(), $1, $2, 100, 'USD', 'mixed')`,
          [P1, SELLER_A],
        ),
      ).rejects.toMatchObject({ code: '23514', message: expect.stringContaining('not the Market currency') });
      await expect(
        admin.query(`UPDATE core.product_variant SET price_currency = 'USD' WHERE id = $1`, [V1]),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        admin.query(`UPDATE core.product SET base_price_currency = 'USD' WHERE id = $1`, [P1]),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  describe('Product/Seller Market integrity (OVN-090)', () => {
    it("a Product's Market cannot contradict its Seller's, on insert or update", async () => {
      await expect(
        admin.query(
          `INSERT INTO core.product (id, seller_id, market_id, name, visibility, base_price_minor, base_price_currency)
           VALUES (gen_random_uuid(), $1, $2, 'Elsewhere', 'DRAFT', 1, 'ETB')`,
          [SELLER_A, M2],
        ),
      ).rejects.toMatchObject({ code: '23503', constraint: 'product_market_is_seller_market' });
      await expect(admin.query(`UPDATE core.product SET market_id = $2 WHERE id = $1`, [P1, M2])).rejects.toMatchObject({
        code: '23503',
        constraint: 'product_market_is_seller_market',
      });
    });
  });
});
