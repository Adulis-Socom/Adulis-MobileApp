import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { FakeMediaStorageAdapter, MEDIA_STORAGE_ADAPTER } from '../src/modules/catalogue/media-storage.adapter';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * WO-009 -- Private Buyer Collections (ADU-SRC-01 v3.2 S18-S22, S25-S27): ownership from the
 * session, typed idempotent memberships, a concurrency-safe DEFAULT, current-state resolution
 * through the public gates, server-validated provenance, batched saved state, and the
 * account-deletion purge. Matrix numbers are the work order's section 23 (cases 1-32).
 * Disposable database; real PostgreSQL; Scenes published through the Seller API.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const APP_ROLE = process.env['DATABASE_URL'];
const CONSOLE_ORIGIN = 'http://localhost:5173';

const id = (n: number) => `0e090000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const MA = id(1);
const MB = id(2);
const OWNER = id(10);
const SELLER = id(20);
const BUYER = { a: id(30), b: id(31), c: id(32), leaver: id(33), d: id(34) };
const DEV = { a: id(40), b: id(41), c: id(42), leaver: id(43), d: id(44), seller: id(45) };
const SESSION = { a: id(50), b: id(51), c: id(52), leaver: id(53), d: id(54), owner: id(55) };
const TICKET = id(60);
const P = (n: number) => id(0x100 + n);
const V = (n: number) => id(0x1000 + n);
const MANY = 35;
const PHONE = (n: number) => `+25191170900${n}`;

const storage = new FakeMediaStorageAdapter();

@Module({ imports: [AppModule] })
class Wo009AppModule {}

type Buyer = keyof typeof BUYER;
interface Item {
  ref: string;
  collection_ref: string;
  target_type: 'PRODUCT_POST' | 'SCENE_POST';
  state: 'VISIBLE' | 'UNAVAILABLE';
  saved_at: string;
  product: { id: string; name: string; available: boolean; price_min_minor: number | null } | null;
  scene: { public_ref: string; caption: string } | null;
}
interface Collection {
  ref: string;
  kind: 'DEFAULT' | 'USER_CREATED';
  name: string | null;
  product_count: number;
  scene_count: number;
}

describe('WO-009 -- Buyer Saved Collections', () => {
  let app: INestApplication;
  let admin: Pool;
  let appRole: Pool;
  const scenes: Record<string, string> = {};

  const server = () => request(app.getHttpServer());
  const as = (r: request.Test, who: Buyer | null) => {
    r.set('X-Adulis-Client', 'android/1.0.0');
    if (who) r.set('X-Adulis-Device', DEV[who]).set('Authorization', `Bearer ${sessionToken(SESSION[who])}`);
    return r;
  };
  const get = (path: string, who: Buyer | null = 'a') => as(server().get(path), who);
  const post = (path: string, body: unknown, who: Buyer | null = 'a', key: string | null = randomUUID()) => {
    const r = as(server().post(path), who);
    if (key) r.set('Idempotency-Key', key);
    return r.send(body as object);
  };
  const patch = (path: string, body: unknown, who: Buyer | null = 'a') => as(server().patch(path), who).send(body as object);
  const del = (path: string, who: Buyer | null = 'a') => as(server().delete(path), who);

  const collections = async (who: Buyer = 'a') => (await get('/v1/collections', who).expect(200)).body as { default_collection_ref: string; data: Collection[]; next_cursor: string | null };
  const defaultRef = async (who: Buyer = 'a') => (await collections(who)).default_collection_ref;
  const create = async (name: string, who: Buyer = 'a') => {
    const { ref } = (await post('/v1/collections', { name }, who).expect(201)).body as { ref: string };
    return (await get(`/v1/collections/${ref}`, who).expect(200)).body.collection as Collection;
  };
  const saveProduct = (coll: string, product: string, who: Buyer = 'a', context?: { scene_ref: string }) =>
    post(`/v1/collections/${coll}/items`, { target: { type: 'PRODUCT_POST', ref: product }, source_surface: 'PRODUCT_DETAIL', ...(context ? { context } : {}) }, who);
  const saveScene = (coll: string, ref: string, who: Buyer = 'a') =>
    post(`/v1/collections/${coll}/items`, { target: { type: 'SCENE_POST', ref }, source_surface: 'SCENE_EXPLORER' }, who);
  const items = async (coll: string, who: Buyer = 'a', query = '') =>
    (await get(`/v1/collections/${coll}${query}`, who).expect(200)).body as { collection: Collection; data: Item[]; next_cursor: string | null };
  const savedState = async (targets: Array<{ type: string; ref: string }>, who: Buyer = 'a') =>
    (await post('/v1/collections/saved-state:batch', { targets }, who, null).expect(200)).body as {
      default_collection_ref: string;
      items: Array<{ type: string; ref: string; saved: boolean; default_item_ref: string | null; memberships: Array<{ collection_ref: string; item_ref: string }> }>;
    };
  const itemOf = async (coll: string, ref: string, who: Buyer = 'a') => (await items(coll, who)).data.find((i) => i.ref === ref)!;

  const stockOf = async (variant: string) =>
    (await admin.query<{ n: number }>(`SELECT stock_count AS n FROM core.product_variant WHERE id = $1`, [variant])).rows[0]!.n;
  const setStock = async (variant: string, to: number) => {
    const n = await stockOf(variant);
    if (n !== to) {
      await admin.query(`INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(), $1, $2, $3, $4)`, [
        variant,
        SELLER,
        to - n,
        to > n ? 'RESTOCK' : 'SELLER_SET',
      ]);
    }
  };
  const product = async (n: number, name: string, stock: number) => {
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor, base_price_currency, visibility, published_at)
       VALUES ($1,$2,$3,$4,1,'ETB','PUBLISHED', now())`,
      [P(n), SELLER, MA, name],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key) VALUES ($1,$2,$3,$4,'ETB','one')`,
      [V(n), P(n), SELLER, 10000 + n],
    );
    if (stock > 0) await setStock(V(n), stock);
  };
  const asOwner = (r: request.Test) =>
    r.set('Cookie', `__Host-adulis_session=${sessionToken(SESSION.owner)}`).set('Origin', CONSOLE_ORIGIN).set('X-Adulis-Seller', SELLER);
  const publishScene = async (key: string, caption: string, products: string[]) => {
    const created = await asOwner(server().post('/v1/seller/scene-posts').set('Idempotency-Key', randomUUID()))
      .send({ caption, product_ids: products })
      .expect(201);
    const up = await asOwner(server().post(`/v1/seller/scene-posts/${created.body.id}/image-uploads`)).set('Idempotency-Key', randomUUID()).expect(200);
    const k = up.body.uploads as Record<'thumb' | 'card' | 'full', { key: string }>;
    for (const [kind, bytes] of [['thumb', 30_000], ['card', 150_000], ['full', 700_000]] as const) {
      storage.put(k[kind].key, { bytes, contentType: 'image/webp' });
    }
    const patched = await asOwner(server().patch(`/v1/seller/scene-posts/${created.body.id}/draft`))
      .set('If-Match', `"${created.body.edit_version}"`)
      .send({ image: { thumb_key: k.thumb.key, card_key: k.card.key, full_key: k.full.key } })
      .expect(200);
    const published = await asOwner(server().post(`/v1/seller/scene-posts/${created.body.id}/publish`))
      .set('Idempotency-Key', randomUUID())
      .set('If-Match', `"${patched.body.edit_version}"`)
      .expect(200);
    scenes[key] = published.body.public_ref as string;
    return created.body.id as string;
  };
  const sceneId = async (ref: string) => (await admin.query<{ id: string }>(`SELECT id FROM core.scene_post WHERE public_ref = $1`, [ref])).rows[0]!.id;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    appRole = new Pool({ connectionString: APP_ROLE, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone,
                                default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'V9A','Collections A','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($2,'V9B','Collections B','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE')`,
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
       VALUES (gen_random_uuid(), $1, '48 hours','24 hours','72 hours','7 days',
         '24 hours','7 days','30 days','48 hours','90 days','24 hours',
         '30 days','12 hours','30 minutes','7 days','8 hours','5 minutes',5,
         '5 minutes','24 hours',3,'1 hour',
         ARRAY['1 day','2 days','4 days']::interval[],'30 days')`,
      [MA],
    );
    const accounts: Array<[string, number]> = [[OWNER, 0], [BUYER.a, 1], [BUYER.b, 2], [BUYER.c, 3], [BUYER.leaver, 4], [BUYER.d, 5]];
    for (const [acct, n] of accounts) {
      await admin.query(`INSERT INTO core.account (id, phone_e164, market_id, status) VALUES ($1,$2,$3,'ACTIVE')`, [acct, PHONE(n), MA]);
    }
    for (const dev of Object.values(DEV)) await admin.query(`INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$2)`, [dev, MA]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','Saved Weaves','saved-weaves','ACTIVE')`,
      [SELLER, MA, OWNER],
    );
    await product(1, 'Saved basket', 3); // tagged in the "morning" Scene
    await product(2, 'Empty jar', 0); // out of stock from the start
    await product(3, 'Moderated lamp', 3);
    await product(4, 'Deletable cup', 0); // never tagged, ordered or stocked: a Seller may hard-delete it
    await product(5, 'Scarf', 3); // tagged in the "archive" Scene
    await product(6, 'Untagged mat', 3);
    for (let n = 1; n <= MANY; n++) await product(100 + n, `Page item ${String(n).padStart(2, '0')}`, 2);

    const sessions: Array<[string, string, string, string]> = [
      [SESSION.a, BUYER.a, 'MOBILE', DEV.a],
      [SESSION.b, BUYER.b, 'MOBILE', DEV.b],
      [SESSION.c, BUYER.c, 'MOBILE', DEV.c],
      [SESSION.leaver, BUYER.leaver, 'MOBILE', DEV.leaver],
      [SESSION.d, BUYER.d, 'MOBILE', DEV.d],
      [SESSION.owner, OWNER, 'CONSOLE', DEV.seller],
    ];
    for (const [s, acct, aud, dev] of sessions) {
      await admin.query(`INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES ($1,$2,$3,$4, now()+interval '12 hours')`, [s, acct, aud, dev]);
    }
    await armFixtureSessions(admin, Object.values(SESSION));

    const moduleRef = await Test.createTestingModule({ imports: [Wo009AppModule] }).overrideProvider(MEDIA_STORAGE_ADAPTER).useValue(storage).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
    // Listen before any request (ISSUE-INFRA-015). Otherwise supertest listens per request and closes
    // the server when the first one finishes, resetting the rest of a concurrent burst (read ECONNRESET).
    await app.listen(0, '127.0.0.1');

    await publishScene('morning', 'Morning baskets by the window', [P(1)]);
    await publishScene('archive', 'Scarves for the cold season', [P(5)]);
  });

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.collection_item WHERE collection_id IN (SELECT id FROM core.collection WHERE owner_account_id::text LIKE '0e090000-%')`,
      `DELETE FROM core.collection WHERE owner_account_id::text LIKE '0e090000-%'`,
      `DELETE FROM analytics.event WHERE market_id IN ('${MA}','${MB}')`,
      `DELETE FROM core.idempotency_record WHERE actor_id::text LIKE '0e090000-%'`,
      `DELETE FROM core.notification WHERE recipient_account_id::text LIKE '0e090000-%'`,
      `DELETE FROM core.otp_challenge WHERE id = '${TICKET}'`,
      `DELETE FROM core.scene_post_transition WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.scene_post_product WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.scene_post_revision WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.scene_post WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.stock_event WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.product_variant WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.product WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.session WHERE id::text LIKE '0e090000-%'`,
      `DELETE FROM core.seller_level_state WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.seller WHERE id = '${SELLER}'`,
      `DELETE FROM core.device WHERE id::text LIKE '0e090000-%'`,
      `DELETE FROM core.account WHERE id::text LIKE '0e090000-%'`,
      `DELETE FROM core.timing_config WHERE market_id IN ('${MA}','${MB}')`,
      `DELETE FROM core.market WHERE id IN ('${MA}','${MB}')`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
    await appRole.end();
  });

  describe('collections', () => {
    it('1. the DEFAULT Collection is created once, unnamed, first in the list, and reused', async () => {
      const first = await collections('a');
      const again = await collections('a');
      expect(again.default_collection_ref).toBe(first.default_collection_ref);
      expect(first.data[0]).toMatchObject({ ref: first.default_collection_ref, kind: 'DEFAULT', name: null, product_count: 0, scene_count: 0 });
      const n = await admin.query(`SELECT count(*)::int AS n FROM core.collection WHERE owner_account_id = $1 AND kind = 'DEFAULT'`, [BUYER.a]);
      expect(n.rows[0].n).toBe(1);
      // saved-state reports the same DEFAULT
      expect((await savedState([{ type: 'PRODUCT_POST', ref: P(1) }])).default_collection_ref).toBe(first.default_collection_ref);
    });

    it('2. concurrent first requests create exactly one DEFAULT', async () => {
      const answers = await Promise.all([
        ...Array.from({ length: 6 }, () => get('/v1/collections', 'c')),
        ...Array.from({ length: 4 }, () => post('/v1/collections/saved-state:batch', { targets: [{ type: 'PRODUCT_POST', ref: P(1) }] }, 'c', null)),
      ]);
      const refs = new Set(answers.map((r) => (r.status === 200 ? r.body.default_collection_ref : `status ${r.status}`)));
      expect(refs.size).toBe(1);
      const n = await admin.query(`SELECT count(*)::int AS n FROM core.collection WHERE owner_account_id = $1`, [BUYER.c]);
      expect(n.rows[0].n).toBe(1);
      // The database refuses a second DEFAULT outright.
      await expect(admin.query(`INSERT INTO core.collection (owner_account_id, kind) VALUES ($1, 'DEFAULT')`, [BUYER.c])).rejects.toMatchObject({ code: '23505' });
    });

    it('3. creates a named Collection (normalised name), replays an Idempotency-Key, refuses bad names', async () => {
      const key = randomUUID();
      const r1 = await post('/v1/collections', { name: '  Outfit \t ideas  ' }, 'a', key).expect(201);
      expect(Object.keys(r1.body)).toEqual(['ref']); // no private name in an answer the idempotency store keeps
      expect((await items(r1.body.ref)).collection).toMatchObject({ kind: 'USER_CREATED', name: 'Outfit ideas', product_count: 0, scene_count: 0 });
      const r2 = await post('/v1/collections', { name: '  Outfit \t ideas  ' }, 'a', key).expect(201);
      expect(r2.headers['x-adulis-idempotent-replay']).toBe('true');
      expect(r2.body.ref).toBe(r1.body.ref);
      expect((await create('የቡና ዕቃዎች')).name).toBe('የቡና ዕቃዎች');
      for (const name of ['', '   ', 'x'.repeat(61), 'bad\u0007name']) {
        await post('/v1/collections', { name }, 'a').expect(400);
      }
      await post('/v1/collections', { name: 'ok', owner_account_id: BUYER.b }, 'a').expect(400); // no client-supplied owner
      await post('/v1/collections', { name: 'no key' }, 'a', null).expect(400); // IDEMPOTENCY_KEY_MISSING
      expect((await create('x'.repeat(60))).name).toHaveLength(60);
    });

    it('4. renames a named Collection; DEFAULT cannot be renamed', async () => {
      const c = await create('Before');
      const r = await patch(`/v1/collections/${c.ref}`, { name: 'After' }).expect(200);
      expect(r.body).toMatchObject({ ref: c.ref, name: 'After' });
      expect(r.headers['cache-control']).toBe('no-store');
      await patch(`/v1/collections/${await defaultRef()}`, { name: 'Renamed default' }).expect(400);
      await patch(`/v1/collections/${c.ref}`, { name: ' ' }).expect(400);
    });

    it('5, 6. deletes a named Collection with its memberships (not the saved objects); DEFAULT deletion is refused', async () => {
      const c = await create('Temporary');
      await saveProduct(c.ref, P(6)).expect(201);
      await del(`/v1/collections/${c.ref}`).expect(204);
      await get(`/v1/collections/${c.ref}`).expect(404);
      await del(`/v1/collections/${c.ref}`).expect(404); // already gone
      const left = await admin.query(`SELECT count(*)::int AS n FROM core.collection_item WHERE collection_id = $1`, [c.ref]);
      expect(left.rows[0].n).toBe(0);
      const stillThere = await admin.query(`SELECT count(*)::int AS n FROM core.product WHERE id = $1`, [P(6)]);
      expect(stillThere.rows[0].n).toBe(1);
      const d = await defaultRef();
      await del(`/v1/collections/${d}`).expect(400);
      await get(`/v1/collections/${d}`).expect(200);
    });

    it('7, 8. a repeated Product or Scene Save is one membership with the same ref', async () => {
      const d = await defaultRef();
      const a = await saveProduct(d, P(1)).expect(201);
      const b = await saveProduct(d, P(1)).expect(201);
      expect(b.body.ref).toBe(a.body.ref);
      const s1 = await saveScene(d, scenes['morning']!).expect(201);
      const s2 = await saveScene(d, scenes['morning']!).expect(201);
      expect(s2.body.ref).toBe(s1.body.ref);
      const n = await admin.query(`SELECT count(*)::int AS n FROM core.collection_item WHERE collection_id = $1`, [d]);
      expect(n.rows[0].n).toBe(2);
      // The partial unique indexes refuse a duplicate at the database too.
      await expect(
        admin.query(`INSERT INTO core.collection_item (collection_id, product_post_id, source_surface) VALUES ($1,$2,'SHOP')`, [d, P(1)]),
      ).rejects.toMatchObject({ code: '23505' });
    });

    it('9. Remove is idempotent; saved state follows', async () => {
      const d = await defaultRef();
      const item = (await saveProduct(d, P(6)).expect(201)).body as Item;
      await del(`/v1/collections/${d}/items/${item.ref}`).expect(204);
      await del(`/v1/collections/${d}/items/${item.ref}`).expect(204);
      const st = await savedState([{ type: 'PRODUCT_POST', ref: P(6) }]);
      expect(st.items[0]).toMatchObject({ saved: false, default_item_ref: null, memberships: [] });
    });

    it('10, 11. a whole Scene and its tagged Product coexist; mixed memberships across Collections are independent', async () => {
      const d = await defaultRef();
      const outfit = await create('Outfit');
      await saveScene(outfit.ref, scenes['morning']!).expect(201);
      await saveProduct(outfit.ref, P(1)).expect(201);
      await saveProduct(outfit.ref, P(2)).expect(201);
      const detail = await items(outfit.ref);
      expect(detail.collection).toMatchObject({ product_count: 2, scene_count: 1 });
      expect(detail.data.map((i) => i.target_type).sort()).toEqual(['PRODUCT_POST', 'PRODUCT_POST', 'SCENE_POST']);
      expect((await items(outfit.ref, 'a', '?type=SCENE_POST')).data.map((i) => i.scene?.public_ref)).toEqual([scenes['morning']]);
      const st = await savedState([
        { type: 'PRODUCT_POST', ref: P(1) },
        { type: 'SCENE_POST', ref: scenes['morning']! },
        { type: 'PRODUCT_POST', ref: P(2) },
      ]);
      expect(st.items.map((i) => i.saved)).toEqual([true, true, false]); // P(2) only in "Outfit"
      expect(st.items[0]!.memberships.map((m) => m.collection_ref).sort()).toEqual([d, outfit.ref].sort());
      expect(st.items[2]!.memberships).toEqual([{ collection_ref: outfit.ref, item_ref: expect.any(String) }]);
      // The database admits exactly one target per row.
      await expect(
        admin.query(`INSERT INTO core.collection_item (collection_id, source_surface) VALUES ($1,'SHOP')`, [d]),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('12, 13. invalid target types and refs are refused; an unknown target is a safe 404', async () => {
      const d = await defaultRef();
      const bad = [
        { target: { type: 'SELLER', ref: P(1) }, source_surface: 'SEARCH' },
        { target: { type: 'PRODUCT_POST', ref: 'not-a-uuid' }, source_surface: 'SEARCH' },
        { target: { type: 'SCENE_POST', ref: 'short' }, source_surface: 'SEARCH' },
        { target: { type: 'PRODUCT_POST', ref: P(1) }, source_surface: 'NOWHERE' },
        { target: { type: 'PRODUCT_POST', ref: P(1) } },
        { target: { type: 'PRODUCT_POST', ref: P(1), extra: 1 }, source_surface: 'SEARCH' },
      ];
      for (const body of bad) await post(`/v1/collections/${d}/items`, body).expect(400);
      await saveProduct(d, id(0xdead)).expect(404);
      await saveScene(d, 'AAAAAAAAAAAAAAAAAAAAAA').expect(404);
      // saved-state: malformed entries and oversized batches are refused; unknown refs are simply not saved
      await post('/v1/collections/saved-state:batch', { targets: [] }, 'a', null).expect(400);
      await post('/v1/collections/saved-state:batch', { targets: Array.from({ length: 61 }, () => ({ type: 'PRODUCT_POST', ref: P(1) })) }, 'a', null).expect(400);
      await post('/v1/collections/saved-state:batch', { targets: [{ type: 'SELLER', ref: 'x' }] }, 'a', null).expect(400);
      expect((await savedState([{ type: 'PRODUCT_POST', ref: id(0xdead) }])).items[0]!.saved).toBe(false);
    });

    it('14-17. forged and foreign Collection refs answer 404 and change nothing; names never leak', async () => {
      const aPrivate = await create('Private of A');
      await saveProduct(aPrivate.ref, P(1)).expect(201);
      const aItem = (await items(aPrivate.ref)).data[0]!;
      const bDefault = await defaultRef('b');
      // 14 forged
      await get(`/v1/collections/${id(0xbeef)}`, 'b').expect(404);
      await get('/v1/collections/not-a-ref', 'b').expect(404);
      // 15 read
      const read = await get(`/v1/collections/${aPrivate.ref}`, 'b').expect(404);
      expect(JSON.stringify(read.body)).not.toContain('Private of A');
      expect((await collections('b')).data.map((c) => c.ref)).not.toContain(aPrivate.ref);
      // 16 write
      await saveProduct(aPrivate.ref, P(6), 'b').expect(404);
      await patch(`/v1/collections/${aPrivate.ref}`, { name: 'Hijacked' }, 'b').expect(404);
      // 17 delete: the Collection, and A's item through A's or B's own Collection ref
      await del(`/v1/collections/${aPrivate.ref}`, 'b').expect(404);
      await del(`/v1/collections/${aPrivate.ref}/items/${aItem.ref}`, 'b').expect(404);
      await del(`/v1/collections/${bDefault}/items/${aItem.ref}`, 'b').expect(204);
      expect((await items(aPrivate.ref)).data.map((i) => i.ref)).toEqual([aItem.ref]);
      expect((await items(aPrivate.ref)).collection.name).toBe('Private of A');
      // saved-state reports only the caller's memberships
      expect((await savedState([{ type: 'PRODUCT_POST', ref: P(1) }], 'b')).items[0]!.memberships).toEqual([]);
      // Seller context changes nothing: the owner is the session's Account
      const withSeller = await get(`/v1/collections/${aPrivate.ref}`, 'b').set('X-Adulis-Seller', SELLER);
      expect(withSeller.status).toBe(404);
    });

    it('18. a guest is refused every read and write', async () => {
      const d = await defaultRef();
      const answers = await Promise.all([
        get('/v1/collections', null),
        get('/v1/collections/saves', null),
        get(`/v1/collections/${d}`, null),
        post('/v1/collections', { name: 'Guest' }, null),
        patch(`/v1/collections/${d}`, { name: 'Guest' }, null),
        del(`/v1/collections/${d}`, null),
        saveProduct(d, P(1)).set('Authorization', ''),
        del(`/v1/collections/${d}/items/${id(1)}`, null),
        post('/v1/collections/saved-state:batch', { targets: [{ type: 'PRODUCT_POST', ref: P(1) }] }, null, null),
      ]);
      expect(answers.map((r) => r.status)).toEqual(Array(9).fill(401));
      const guestRows = await admin.query(`SELECT count(*)::int AS n FROM core.collection WHERE name = 'Guest'`);
      expect(guestRows.rows[0].n).toBe(0);
    });

    it('19. pages newest first with a stable cursor; Recent Saves list each target once', async () => {
      const c = await create('Many');
      for (let n = 1; n <= MANY; n++) await saveProduct(c.ref, P(100 + n)).expect(201);
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const page: { data: Item[]; next_cursor: string | null } = await items(c.ref, 'a', `?limit=10${cursor ? `&cursor=${cursor}` : ''}`);
        seen.push(...page.data.map((i) => i.product!.name));
        cursor = page.next_cursor;
        pages++;
      } while (cursor);
      expect(pages).toBe(4);
      expect(seen).toEqual(Array.from({ length: MANY }, (_, i) => `Page item ${String(MANY - i).padStart(2, '0')}`));
      await get(`/v1/collections/${c.ref}?cursor=garbage`).expect(400);
      await get(`/v1/collections/${c.ref}?type=SELLER`).expect(400);
      // Recent Saves: P(1) is in two Collections, listed once
      const recent: Item[] = [];
      cursor = null;
      do {
        const page: { data: Item[]; next_cursor: string | null } = (await get(`/v1/collections/saves?limit=20${cursor ? `&cursor=${cursor}` : ''}`).expect(200)).body;
        recent.push(...page.data);
        cursor = page.next_cursor;
      } while (cursor);
      const targets = recent.map((i) => i.product?.id ?? i.scene?.public_ref ?? i.ref);
      expect(new Set(targets).size).toBe(targets.length);
      expect(targets.filter((t) => t === P(1))).toHaveLength(1);
      expect(recent[0]!.product?.name).toBe(`Page item ${MANY}`);
      const scenesOnly = (await get('/v1/collections/saves?type=SCENE_POST').expect(200)).body.data as Item[];
      expect(scenesOnly.every((i) => i.target_type === 'SCENE_POST')).toBe(true);
    });

    it('20. concurrent duplicate Saves under different keys converge on one membership', async () => {
      const d = await defaultRef('d');
      const answers = await Promise.all(Array.from({ length: 8 }, () => saveProduct(d, P(3), 'd')));
      expect(answers.map((r) => r.status)).toEqual(Array(8).fill(201));
      expect(new Set(answers.map((r) => r.body.ref)).size).toBe(1);
      const n = await admin.query(`SELECT count(*)::int AS n FROM core.collection_item WHERE collection_id = $1`, [d]);
      expect(n.rows[0].n).toBe(1);
    });
  });

  describe('content visibility', () => {
    it('21, 22. an available Product shows current price; an out-of-stock one stays saved, visible, unavailable to buy', async () => {
      const c = await create('Stock');
      const ok = (await saveProduct(c.ref, P(1)).expect(201)).body as Item;
      expect(Object.keys(ok).sort()).toEqual(['collection_ref', 'ref', 'saved_at', 'target_type']); // the membership only
      expect(await itemOf(c.ref, ok.ref)).toMatchObject({ state: 'VISIBLE', product: { id: P(1), name: 'Saved basket', available: true, price_min_minor: 10001 } });
      const jar = (await saveProduct(c.ref, P(2)).expect(201)).body as Item;
      expect(await itemOf(c.ref, jar.ref)).toMatchObject({ state: 'VISIBLE', product: { available: false } });
      await setStock(V(1), 0);
      expect((await itemOf(c.ref, ok.ref)).product).toMatchObject({ available: false });
      await setStock(V(1), 3);
      expect((await itemOf(c.ref, ok.ref)).product).toMatchObject({ available: true });
    });

    it('23, 24. an unpublished or moderation-restricted Product is a neutral tombstone, then returns', async () => {
      const c = await create('Lifecycle');
      const lamp = (await saveProduct(c.ref, P(3)).expect(201)).body as Item;
      for (const reason of ['SELLER', 'MODERATION']) {
        await admin.query(`UPDATE core.product SET visibility = 'UNPUBLISHED', unpublished_reason = $2 WHERE id = $1`, [P(3), reason]);
        const tomb = await itemOf(c.ref, lamp.ref);
        expect(tomb).toMatchObject({ state: 'UNAVAILABLE', product: null, scene: null, target_type: 'PRODUCT_POST' });
        expect(JSON.stringify(tomb)).not.toContain('Moderated lamp');
        await saveProduct(c.ref, P(3)).expect(404); // cannot newly save a hidden Product
      }
      await admin.query(`UPDATE core.product SET visibility = 'PUBLISHED', unpublished_reason = NULL WHERE id = $1`, [P(3)]);
      expect((await itemOf(c.ref, lamp.ref)).state).toBe('VISIBLE');
    });

    it('Product deleted by its Seller: the membership goes with it (the FK cascades; deletion is never blocked)', async () => {
      const c = await create('Deleted');
      await saveProduct(c.ref, P(4)).expect(201);
      await asOwner(server().delete(`/v1/seller/products/${P(4)}`)).expect(200);
      expect((await items(c.ref)).data).toEqual([]);
      expect((await savedState([{ type: 'PRODUCT_POST', ref: P(4) }])).items[0]!.saved).toBe(false);
    });

    it('25-27. a PUBLIC Scene renders; PRIVATE hides everything; restored PUBLIC renders again, membership unchanged', async () => {
      const c = await create('Scenes');
      const saved = (await saveScene(c.ref, scenes['morning']!).expect(201)).body as Item;
      expect(saved).not.toHaveProperty('scene'); // a replayed answer can never carry content
      expect(await itemOf(c.ref, saved.ref)).toMatchObject({ state: 'VISIBLE', scene: { public_ref: scenes['morning'], caption: 'Morning baskets by the window' } });
      await setStock(V(1), 0); // its only tagged Product: the Scene goes PRIVATE
      const hidden = await itemOf(c.ref, saved.ref);
      expect(hidden).toMatchObject({ state: 'UNAVAILABLE', scene: null, product: null });
      expect(JSON.stringify(hidden)).not.toMatch(/Morning|thumb|card_key|saved-weaves/);
      await saveScene(c.ref, scenes['morning']!).expect(404); // a hidden Scene cannot be saved: answers as a nonexistent one
      expect((await items(c.ref)).data).toHaveLength(1);
      await setStock(V(1), 3);
      expect((await itemOf(c.ref, saved.ref))).toMatchObject({ ref: saved.ref, state: 'VISIBLE', scene: { public_ref: scenes['morning'] } });
    });

    it('28. an ARCHIVED Scene is unavailable and cannot be newly saved', async () => {
      const c = await create('Archive');
      const saved = (await saveScene(c.ref, scenes['archive']!).expect(201)).body as Item;
      await admin.query(
        `UPDATE core.scene_post SET publication_state = 'ARCHIVED', visibility = 'PRIVATE',
                lifecycle_version = lifecycle_version + 1 WHERE public_ref = $1`,
        [scenes['archive']],
      );
      expect(await itemOf(c.ref, saved.ref)).toMatchObject({ state: 'UNAVAILABLE', scene: null });
      await saveScene(c.ref, scenes['archive']!).expect(404);
      expect((await items(c.ref)).data.map((i) => i.ref)).toEqual([saved.ref]); // membership retained
    });

    it('29. Scene deletion: none exists (0054 retains Scenes); targets cascade and provenance nulls for any future purge', async () => {
      // No Scene delete command or purge exists, and append-only transitions keep the root, so the
      // proof is the referential action itself: every target FK cascades, every provenance FK nulls.
      const fks = await admin.query<{ conname: string; confdeltype: string }>(
        `SELECT conname, confdeltype FROM pg_constraint
          WHERE conrelid = 'core.collection_item'::regclass AND contype = 'f' ORDER BY conname`,
      );
      expect(Object.fromEntries(fks.rows.map((r) => [r.conname, r.confdeltype]))).toEqual({
        collection_item_collection_id_fkey: 'c',
        collection_item_origin_revision: 'n',
        collection_item_origin_tag: 'n',
        collection_item_originating_scene_post_id_fkey: 'n',
        collection_item_product_post_id_fkey: 'c',
        collection_item_scene_post_id_fkey: 'c',
        collection_item_seen_revision: 'n',
      });
    });

    it('30. provenance is validated, never fabricated, and never an access path to an old revision', async () => {
      const c = await create('Provenance');
      const fromScene = (await saveProduct(c.ref, P(1), 'a', { scene_ref: scenes['morning']! }).expect(201)).body as Item;
      const row = await admin.query(
        `SELECT originating_scene_post_id, originating_scene_revision_id, source_surface FROM core.collection_item WHERE id = $1`,
        [fromScene.ref],
      );
      const morningId = await sceneId(scenes['morning']!);
      expect(row.rows[0]).toMatchObject({ originating_scene_post_id: morningId, source_surface: 'PRODUCT_DETAIL' });
      expect(row.rows[0].originating_scene_revision_id).not.toBeNull();
      // A Scene that does not tag the Product records nothing.
      const forged = (await saveProduct(c.ref, P(6), 'a', { scene_ref: scenes['morning']! }).expect(201)).body as Item;
      const none = await admin.query(`SELECT originating_scene_post_id, originating_scene_revision_id FROM core.collection_item WHERE id = $1`, [forged.ref]);
      expect(none.rows[0]).toEqual({ originating_scene_post_id: null, originating_scene_revision_id: null });
      // The database refuses a fabricated tag relationship outright.
      const otherRevision = await admin.query(`SELECT current_published_revision_id AS r FROM core.scene_post WHERE id = $1`, [morningId]);
      await expect(
        admin.query(
          `INSERT INTO core.collection_item (collection_id, product_post_id, originating_scene_post_id, originating_scene_revision_id, source_surface)
           VALUES ($1,$2,$3,$4,'PRODUCT_DETAIL')`,
          [await defaultRef('b'), P(6), morningId, otherRevision.rows[0].r],
        ),
      ).rejects.toMatchObject({ code: '23503' });
      // A new published revision: the saved Scene renders the CURRENT caption, never the one seen at save.
      const sceneItem = (await saveScene(c.ref, scenes['morning']!).expect(201)).body as Item;
      const seen = await admin.query(`SELECT scene_revision_seen_at_save_id AS r FROM core.collection_item WHERE id = $1`, [sceneItem.ref]);
      expect(seen.rows[0].r).toBe(otherRevision.rows[0].r);
      const view = await asOwner(server().get(`/v1/seller/scene-posts/${morningId}`)).expect(200);
      const edited = await asOwner(server().patch(`/v1/seller/scene-posts/${morningId}/draft`))
        .set('If-Match', `"${view.body.edit_version}"`)
        .send({ caption: 'Evening baskets, new light' })
        .expect(200);
      await asOwner(server().post(`/v1/seller/scene-posts/${morningId}/publish`))
        .set('Idempotency-Key', randomUUID())
        .set('If-Match', `"${edited.body.edit_version}"`)
        .expect(200);
      const now = await itemOf(c.ref, sceneItem.ref);
      expect(now.scene?.caption).toBe('Evening baskets, new light');
      expect(JSON.stringify(await items(c.ref))).not.toContain('Morning baskets');
    });

    it('31. a Market change keeps memberships and shows them unavailable; switching back restores them', async () => {
      const c = await create('Travel');
      await saveProduct(c.ref, P(1)).expect(201);
      await saveScene(c.ref, scenes['morning']!).expect(201);
      await admin.query(`UPDATE core.account SET market_id = $2 WHERE id = $1`, [BUYER.a, MB]);
      try {
        const away = await items(c.ref);
        expect(away.data.map((i) => i.state)).toEqual(['UNAVAILABLE', 'UNAVAILABLE']);
        expect(away.collection).toMatchObject({ product_count: 1, scene_count: 1 });
        await saveProduct(c.ref, P(6)).expect(404); // not visible in the current Market
      } finally {
        await admin.query(`UPDATE core.account SET market_id = $2 WHERE id = $1`, [BUYER.a, MA]);
      }
      expect((await items(c.ref)).data.map((i) => i.state)).toEqual(['VISIBLE', 'VISIBLE']);
    });

    it('32. a suspended Seller hides its saved Products and Scenes; reinstatement restores them', async () => {
      const c = await create('Suspension');
      await saveProduct(c.ref, P(1)).expect(201);
      await saveScene(c.ref, scenes['morning']!).expect(201);
      await admin.query(`UPDATE core.seller SET status = 'SAFETY_SUSPENDED' WHERE id = $1`, [SELLER]);
      try {
        expect((await items(c.ref)).data.map((i) => i.state)).toEqual(['UNAVAILABLE', 'UNAVAILABLE']);
      } finally {
        await admin.query(`UPDATE core.seller SET status = 'ACTIVE' WHERE id = $1`, [SELLER]);
      }
      await admin.query(`SELECT core.fn_scene_post_reevaluate($1)`, [await sceneId(scenes['morning']!)]);
      expect((await items(c.ref)).data.map((i) => i.state)).toEqual(['VISIBLE', 'VISIBLE']);
    });
  });

  describe('privacy and contract', () => {
    it('account deletion purges every Collection, name and membership; canonical content stays', async () => {
      const d = await defaultRef('leaver');
      const named = await create('Leaving soon', 'leaver');
      await saveProduct(d, P(1), 'leaver').expect(201);
      await saveScene(named.ref, scenes['morning']!, 'leaver').expect(201);
      await admin.query(
        `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash, expires_at, consumed_at)
         VALUES ($1, 'ACCOUNT_DELETION', $2, decode('00','hex'), now() + interval '1 hour', now())`,
        [TICKET, PHONE(4)],
      );
      await appRole.query(`SELECT core.fn_delete_account($1, $2, sha256($3::bytea))`, [BUYER.leaver, TICKET, PHONE(4)]);
      const left = await admin.query(
        `SELECT (SELECT count(*)::int FROM core.collection WHERE owner_account_id = $1) AS c,
                (SELECT count(*)::int FROM core.collection_item WHERE collection_id = ANY($2::uuid[])) AS i,
                (SELECT count(*)::int FROM core.product WHERE id = $3) AS p`,
        [BUYER.leaver, [d, named.ref], P(1)],
      );
      expect(left.rows[0]).toEqual({ c: 0, i: 0, p: 1 });
    });

    it('stored POST answers (the idempotency store) carry no Collection name and no target content', async () => {
      const stored = await admin.query<{ body: string }>(
        `SELECT response_body::text AS body FROM core.idempotency_record WHERE actor_id::text LIKE '0e090000-%' AND endpoint LIKE '%/v1/collections%'`,
      );
      expect(stored.rows.length).toBeGreaterThan(0);
      const all = stored.rows.map((r) => r.body).join('\n');
      for (const secret of ['Outfit', 'Private of A', 'Morning baskets', 'Saved basket', 'card_key', 'caption']) expect(all).not.toContain(secret);
    });

    it('the API role holds exactly the grants it needs; responses are never cached', async () => {
      const grants = await admin.query(
        `SELECT table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS p
           FROM information_schema.role_table_grants
          WHERE grantee = 'adulis_app' AND table_schema = 'core' AND table_name IN ('collection','collection_item')
          GROUP BY 1 ORDER BY 1`,
      );
      expect(grants.rows).toEqual([
        { table_name: 'collection', p: 'DELETE,INSERT,SELECT' },
        { table_name: 'collection_item', p: 'DELETE,INSERT,SELECT' },
      ]);
      await expect(appRole.query(`UPDATE core.collection SET owner_account_id = owner_account_id`)).rejects.toMatchObject({ code: '42501' });
      await expect(appRole.query(`UPDATE core.collection_item SET product_post_id = product_post_id`)).rejects.toMatchObject({ code: '42501' });
      const readonly = await admin.query(
        `SELECT count(*)::int AS n FROM information_schema.role_table_grants
          WHERE grantee = 'adulis_readonly' AND table_schema = 'core' AND table_name IN ('collection','collection_item')`,
      );
      expect(readonly.rows[0].n).toBe(0);
      for (const r of [await get('/v1/collections'), await get('/v1/collections/saves'), await post('/v1/collections/saved-state:batch', { targets: [{ type: 'PRODUCT_POST', ref: P(1) }] }, 'a', null)]) {
        expect(r.headers['cache-control']).toBe('no-store');
      }
    });

    it('saving creates no Cart, reservation, Order or stock change', async () => {
      const counts = async () =>
        (
          await admin.query(
            `SELECT (SELECT count(*)::int FROM core.cart) AS carts, (SELECT count(*)::int FROM core.reservation) AS reservations,
                    (SELECT count(*)::int FROM core."order") AS orders, (SELECT stock_count FROM core.product_variant WHERE id = $1) AS stock`,
            [V(6)],
          )
        ).rows[0];
      const before = await counts();
      const c = await create('No commerce');
      await saveProduct(c.ref, P(6)).expect(201);
      expect(await counts()).toEqual(before);
    });
  });
});
