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
 * WO-008 -- Marketplace Search (ADU-SRC-01 v3.2): Products, Sellers and Scenes of the requester's
 * Market, lexical matching (exact, prefix, substring, pg_trgm fuzzy) in English and Amharic,
 * eligibility before ranking, query-bound cursors. Products and Sellers are rows (the WO-006
 * pattern); Scenes are published through the Seller API so the canonical public gate decides.
 * Disposable database.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const CONSOLE_ORIGIN = 'http://localhost:5173';

const id = (n: number) => `0e080000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const MA = id(1);
const MB = id(2);
const MS = id(3); // a SUSPENDED Market
const OWNER = { weaves: id(10), house: id(11), hidden: id(12), bulk: id(13), b: id(14), s: id(15) };
const SELLER = { weaves: id(20), house: id(21), hidden: id(22), bulk: id(23), b: id(24), s: id(25) };
const DEV = { a: id(30), b: id(31), s: id(32), session: id(33), rate: id(34) };
const SESSION = { weaves: id(40) };
const P = (n: number) => id(0x100 + n);
const V = (n: number) => id(0x1000 + n);
const BULK = 45;

const storage = new FakeMediaStorageAdapter();

@Module({ imports: [AppModule] })
class Wo008AppModule {}

type Item =
  | { type: 'PRODUCT_POST'; payload: { id: string; name: string; available: boolean; seller: { handle: string }; price_min_minor: number | null } }
  | { type: 'SELLER'; payload: { handle: string; store_name: string; trust_level: string | null } }
  | { type: 'SCENE_POST'; payload: { public_ref: string; caption: string; seller: { handle: string } } };
interface Page {
  market_resolved: boolean;
  type: string;
  algorithm_version: string;
  items: Item[];
  next_cursor: string | null;
}

describe('WO-008 -- Marketplace Search', () => {
  let app: INestApplication;
  let admin: Pool;
  const scenes: Record<string, string> = {};

  const server = () => request(app.getHttpServer());
  const get = (path: string, device: string | null = DEV.a) => {
    const r = server().get(path).set('X-Adulis-Client', 'android/1.0.0');
    return device ? r.set('X-Adulis-Device', device) : r;
  };
  const search = async (q: string, type?: string, extra = '', device: string | null = DEV.a) => {
    const r = await get(`/v1/search?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ''}${extra}`, device).expect(200);
    return r.body as Page;
  };
  const productNames = (p: Page) => p.items.flatMap((i) => (i.type === 'PRODUCT_POST' ? [i.payload.name] : []));
  const sellerHandles = (p: Page) => p.items.flatMap((i) => (i.type === 'SELLER' ? [i.payload.handle] : []));
  const sceneRefs = (p: Page) => p.items.flatMap((i) => (i.type === 'SCENE_POST' ? [i.payload.public_ref] : []));
  const stockOf = async (variant: string) =>
    (await admin.query<{ n: number }>(`SELECT stock_count AS n FROM core.product_variant WHERE id = $1`, [variant])).rows[0]!.n;
  const setStock = async (variant: string, seller: string, to: number) => {
    const n = await stockOf(variant);
    if (n !== to) {
      await admin.query(`INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(), $1, $2, $3, $4)`, [
        variant,
        seller,
        to - n,
        to > n ? 'RESTOCK' : 'SELLER_SET',
      ]);
    }
  };
  const product = async (n: number, seller: string, market: string, name: string, stock: number, visibility = 'PUBLISHED') => {
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor, base_price_currency, visibility, published_at, unpublished_reason)
       VALUES ($1,$2,$3,$4,1,'ETB',$5::core.product_visibility, now(), CASE WHEN $5 = 'UNPUBLISHED' THEN 'MODERATION' END::core.unpublished_reason)`,
      [P(n), seller, market, name, visibility],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key) VALUES ($1,$2,$3,$4,'ETB','one')`,
      [V(n), P(n), seller, 10000 + n],
    );
    if (stock > 0) await setStock(V(n), seller, stock);
  };
  const asOwner = (r: request.Test) =>
    r.set('Cookie', `__Host-adulis_session=${sessionToken(SESSION.weaves)}`).set('Origin', CONSOLE_ORIGIN).set('X-Adulis-Seller', SELLER.weaves);
  const publishScene = async (key: string, caption: string, products: string[]) => {
    const created = await asOwner(server().post('/v1/seller/scene-posts').set('Idempotency-Key', randomUUID()))
      .send({ caption, product_ids: products })
      .expect(201);
    const up = await asOwner(server().post(`/v1/seller/scene-posts/${created.body.id}/image-uploads`))
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
    const patched = await asOwner(server().patch(`/v1/seller/scene-posts/${created.body.id}/draft`))
      .set('If-Match', `"${created.body.edit_version}"`)
      .send({ image: { thumb_key: k.thumb.key, card_key: k.card.key, full_key: k.full.key } })
      .expect(200);
    const published = await asOwner(server().post(`/v1/seller/scene-posts/${created.body.id}/publish`))
      .set('Idempotency-Key', randomUUID())
      .set('If-Match', `"${patched.body.edit_version}"`)
      .expect(200);
    scenes[key] = published.body.public_ref as string;
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone,
                                default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'V8A','Search A','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($2,'V8B','Search B','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($3,'V8S','Search S','PHASE_1','ETB','Africa/Addis_Ababa','en','SUSPENDED',false,'AFROMESSAGE')`,
      [MA, MB, MS],
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
    const owners: Array<[string, string]> = [
      [OWNER.weaves, MA], [OWNER.house, MA], [OWNER.hidden, MA], [OWNER.bulk, MA], [OWNER.b, MB], [OWNER.s, MS],
    ];
    for (let i = 0; i < owners.length; i++) {
      await admin.query(`INSERT INTO core.account (id, phone_e164, market_id, status) VALUES ($1,$2,$3,'ACTIVE')`, [owners[i]![0], `+25191170802${i}`, owners[i]![1]]);
    }
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$6), ($2,'ANDROID',$7), ($3,'ANDROID',$8), ($4,'ANDROID',$6), ($5,'ANDROID',$6)`,
      [DEV.a, DEV.b, DEV.s, DEV.session, DEV.rate, MA, MB, MS],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status) VALUES
        ($1,$7,$10,'INDIVIDUAL','Addis Weaves','addis-weaves','ACTIVE'),
        ($2,$7,$11,'INDIVIDUAL','Basket House','basket-house','ACTIVE'),
        ($3,$7,$12,'INDIVIDUAL','Hidden Baskets','hidden-baskets','SAFETY_SUSPENDED'),
        ($4,$7,$13,'INDIVIDUAL','Bulk Store','bulk-store','ACTIVE'),
        ($5,$8,$14,'INDIVIDUAL','Woven Market B','woven-market-b','ACTIVE'),
        ($6,$9,$15,'INDIVIDUAL','Suspended Market Weaves','suspended-weaves','ACTIVE')`,
      [SELLER.weaves, SELLER.house, SELLER.hidden, SELLER.bulk, SELLER.b, SELLER.s, MA, MB, MS, OWNER.weaves, OWNER.house, OWNER.hidden, OWNER.bulk, OWNER.b, OWNER.s],
    );
    await admin.query(`INSERT INTO core.seller_public_stats (seller_id, level) VALUES ($1,'ESTABLISHED') ON CONFLICT (seller_id) DO UPDATE SET level = 'ESTABLISHED'`, [SELLER.weaves]);
    // Addis Weaves
    await product(1, SELLER.weaves, MA, 'Woven basket', 3);
    await product(2, SELLER.weaves, MA, 'Woven basket large', 0); // relevant, out of stock
    await product(3, SELLER.weaves, MA, 'Woven basket stand', 3);
    await product(4, SELLER.weaves, MA, 'Clay cup', 3);
    await product(5, SELLER.weaves, MA, 'ቡና ስኒ', 3); // "coffee cup"
    await product(6, SELLER.weaves, MA, 'ትልቅ ጀበና', 3); // "large jebena"
    await product(7, SELLER.weaves, MA, 'Studio lamp', 3); // its Scene will lose stock
    await product(8, SELLER.weaves, MA, 'Withdrawn basket', 3, 'UNPUBLISHED'); // moderation-unpublished
    await product(9, SELLER.weaves, MA, '100% cotton scarf', 3);
    // Others
    await product(20, SELLER.house, MA, 'Market basket', 3);
    await product(21, SELLER.hidden, MA, 'Hidden basket', 3);
    await product(22, SELLER.b, MB, 'Woven basket', 3);
    await product(23, SELLER.s, MS, 'Woven basket', 3);
    for (let n = 1; n <= BULK; n++) await product(100 + n, SELLER.bulk, MA, `Pagination item ${String(n).padStart(2, '0')}`, n % 4 === 0 ? 0 : 2);

    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES ($1,$2,'CONSOLE',$3, now()+interval '12 hours')`,
      [SESSION.weaves, OWNER.weaves, DEV.session],
    );
    await armFixtureSessions(admin, [SESSION.weaves]);

    const moduleRef = await Test.createTestingModule({ imports: [Wo008AppModule] }).overrideProvider(MEDIA_STORAGE_ADAPTER).useValue(storage).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();

    await publishScene('light', 'Morning light on the new woven baskets', [P(1)]);
    await publishScene('coffee', 'ቡና ሰዓት with the new cups', [P(5)]);
    await publishScene('lamp', 'Evening glow in the studio', [P(7)]);
  });

  afterAll(async () => {
    await app?.close();
    const sellers = Object.values(SELLER)
      .map((s) => `'${s}'`)
      .join(',');
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM analytics.event WHERE market_id IN ('${MA}','${MB}','${MS}')`,
      `DELETE FROM core.rate_limit_bucket WHERE subject_id LIKE '0e080000-%' OR subject_id = 'marketplace-search-anonymous'`,
      `DELETE FROM core.idempotency_record WHERE actor_id = '${OWNER.weaves}'`,
      `DELETE FROM core.notification WHERE recipient_account_id = '${OWNER.weaves}'`,
      `DELETE FROM core.scene_post_transition WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.scene_post_product WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.scene_post_revision WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.scene_post WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.stock_event WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.product_variant WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.product WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.session WHERE id = '${SESSION.weaves}'`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller WHERE id IN (${sellers})`,
      `DELETE FROM core.device WHERE id::text LIKE '0e080000-%'`,
      `DELETE FROM core.account WHERE id::text LIKE '0e080000-%'`,
      `DELETE FROM core.timing_config WHERE market_id IN ('${MA}','${MB}','${MS}')`,
      `DELETE FROM core.market WHERE id IN ('${MA}','${MB}','${MS}')`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  // Each test starts with a fresh per-device budget (the limit has its own test below).
  beforeEach(() => admin.query(`DELETE FROM core.rate_limit_bucket WHERE subject_id IN ($1,$2) AND bucket_key = 'marketplace-search'`, [DEV.a, DEV.b]));

  describe('matching', () => {
    it('1, 12. an exact Product name leads; relevant available Products precede relevant unavailable ones', async () => {
      const p = await search('Woven basket', 'PRODUCT_POST');
      // Exact, then the prefix band (available before unavailable); only then fuzzy neighbours
      // ("Market basket": word similarity 0.54 >= 0.5), never ahead of a lexical match.
      expect(productNames(p).slice(0, 3)).toEqual(['Woven basket', 'Woven basket stand', 'Woven basket large']);
      expect(p.items.slice(0, 3).map((i) => (i.type === 'PRODUCT_POST' ? i.payload.available : null))).toEqual([true, true, false]);
      expect(productNames(p).slice(3)).toEqual(['Market basket']);
      // An exact unavailable match is not displaced by an available weaker match.
      expect(productNames(await search('Woven basket large', 'PRODUCT_POST'))[0]).toBe('Woven basket large');
    });

    it('2. an exact Seller handle or name leads Top, with or without @, public Trust level only', async () => {
      for (const q of ['addis-weaves', '@addis-weaves', 'Addis Weaves']) {
        const top = await search(q);
        expect(top.items[0]).toEqual({ type: 'SELLER', payload: { handle: 'addis-weaves', store_name: 'Addis Weaves', trust_level: 'ESTABLISHED' } });
      }
    });

    it('3. a Scene caption matches through the canonical gate', async () => {
      const p = await search('Morning light on the new woven baskets', 'SCENE_POST');
      expect(sceneRefs(p)).toEqual([scenes['light']]);
      expect(p.items[0]).toMatchObject({ type: 'SCENE_POST', payload: { seller: { handle: 'addis-weaves' }, caption: 'Morning light on the new woven baskets' } });
      // A tagged Product's name admits its Scene as secondary context.
      expect(sceneRefs(await search('clay cup', 'SCENE_POST'))).toEqual([]);
      expect(sceneRefs(await search('woven basket', 'SCENE_POST'))).toContain(scenes['light']);
    });

    it('4, 5, 6. prefix and case variations', async () => {
      expect(productNames(await search('wov', 'PRODUCT_POST'))).toEqual(['Woven basket', 'Woven basket stand', 'Woven basket large']);
      expect(productNames(await search('WOVEN BASKET', 'PRODUCT_POST'))).toEqual(productNames(await search('woven basket', 'PRODUCT_POST')));
      // A word prefix inside a name ("basket" in "Market basket").
      expect(productNames(await search('bask', 'PRODUCT_POST'))).toEqual(expect.arrayContaining(['Market basket', 'Woven basket']));
    });

    it('7. Amharic-script queries: a two-letter word by prefix, a longer one by substring, a Scene caption', async () => {
      expect(productNames(await search('ቡና', 'PRODUCT_POST'))).toEqual(['ቡና ስኒ']);
      expect(productNames(await search('ጀበና', 'PRODUCT_POST'))).toEqual(['ትልቅ ጀበና']);
      expect(sceneRefs(await search('ቡና ሰዓት', 'SCENE_POST'))).toEqual([scenes['coffee']]);
    });

    it('8. a typographical variation finds the Product by bounded fuzzy matching, ranked below lexical matches', async () => {
      const p = await search('baskte', 'PRODUCT_POST');
      expect(productNames(p)).toEqual(expect.arrayContaining(['Woven basket']));
      expect(productNames(await search('zzqx', 'PRODUCT_POST'))).toEqual([]);
    });

    it('punctuation is literal, never a wildcard', async () => {
      // The literal match leads; digit trigrams may add fuzzy neighbours after it.
      expect(productNames(await search('100%', 'PRODUCT_POST'))[0]).toBe('100% cotton scarf');
      // A two-character query is prefix-only (no fuzzy): as LIKE wildcards "%a" would match every
      // name containing an "a"; escaped, it matches only a name that starts with "%a".
      expect(productNames(await search('%a', 'PRODUCT_POST'))).toEqual([]);
      expect(productNames(await search('_l', 'PRODUCT_POST'))).toEqual([]);
    });

    it('9, 10. empty, too short, oversized queries and an unknown type are 400 with a reason; nothing is a catalogue dump', async () => {
      expect((await get('/v1/search').expect(400)).body.slots).toMatchObject({ path: 'q', reason: 'QUERY_REQUIRED' });
      expect((await get('/v1/search?q=').expect(400)).body.slots).toMatchObject({ reason: 'QUERY_TOO_SHORT' });
      expect((await get('/v1/search?q=%20%20a%20').expect(400)).body.slots).toMatchObject({ reason: 'QUERY_TOO_SHORT' });
      expect((await get(`/v1/search?q=${'x'.repeat(101)}`).expect(400)).body.slots).toMatchObject({ reason: 'QUERY_TOO_LONG' });
      expect((await get('/v1/search?q=basket&type=CREATOR').expect(400)).body.slots).toMatchObject({ path: 'type' });
      await get('/v1/search?q=basket&type=PRODUCT_POST&limit=51').expect(400);
    });
  });

  describe('eligibility', () => {
    it('11, 19. unpublished and moderation-unpublished Products are excluded', async () => {
      expect(productNames(await search('Withdrawn basket', 'PRODUCT_POST'))).toEqual([]);
      await admin.query(`UPDATE core.product SET visibility = 'UNPUBLISHED', unpublished_reason = 'SELLER' WHERE id = $1`, [P(4)]);
      try {
        expect(productNames(await search('Clay cup', 'PRODUCT_POST'))).toEqual([]);
      } finally {
        await admin.query(`UPDATE core.product SET visibility = 'PUBLISHED', unpublished_reason = NULL WHERE id = $1`, [P(4)]);
      }
      expect(productNames(await search('Clay cup', 'PRODUCT_POST'))).toEqual(['Clay cup']);
    });

    it('13, 14, 15. a Scene that loses its last available Product goes PRIVATE and leaves Search; restock brings it back', async () => {
      expect(sceneRefs(await search('Evening glow in the studio', 'SCENE_POST'))).toEqual([scenes['lamp']]);
      await setStock(V(7), SELLER.weaves, 0);
      try {
        const state = await admin.query(`SELECT visibility FROM core.scene_post WHERE public_ref = $1`, [scenes['lamp']]);
        expect(state.rows[0].visibility).toBe('PRIVATE');
        expect(sceneRefs(await search('Evening glow in the studio', 'SCENE_POST'))).toEqual([]);
        expect(sceneRefs(await search('Evening glow in the studio'))).toEqual([]);
        // The Product itself stays findable, unavailable.
        expect((await search('Studio lamp', 'PRODUCT_POST')).items[0]).toMatchObject({ payload: { name: 'Studio lamp', available: false } });
      } finally {
        await setStock(V(7), SELLER.weaves, 3);
      }
      expect(sceneRefs(await search('Evening glow in the studio', 'SCENE_POST'))).toEqual([scenes['lamp']]);
    });

    it('16. a suspended Seller is excluded with all its Products', async () => {
      expect(sellerHandles(await search('hidden-baskets', 'SELLER'))).not.toContain('hidden-baskets');
      expect(sellerHandles(await search('Hidden Baskets', 'SELLER'))).not.toContain('hidden-baskets');
      // Other baskets may match fuzzily; the suspended Seller's own exact-named Product never does.
      const p = await search('Hidden basket', 'PRODUCT_POST');
      expect(productNames(p)).not.toContain('Hidden basket');
      expect(p.items.every((i) => i.type === 'PRODUCT_POST' && i.payload.seller.handle !== 'hidden-baskets')).toBe(true);
    });

    it('17. a device in an inactive Market searches nothing, and says so', async () => {
      const p = await search('Woven basket', undefined, '', DEV.s);
      expect(p).toMatchObject({ market_resolved: false, items: [], next_cursor: null });
      expect(await search('Woven basket', undefined, '', null)).toMatchObject({ market_resolved: false, items: [] });
    });

    it("18. another Market's Products and Sellers never appear; that Market's requester sees only its own", async () => {
      const a = await search('woven', 'PRODUCT_POST');
      expect(a.items.every((i) => i.type === 'PRODUCT_POST' && i.payload.seller.handle === 'addis-weaves')).toBe(true);
      expect(sellerHandles(await search('woven-market-b', 'SELLER'))).toEqual([]);
      const b = await search('woven', 'PRODUCT_POST', '', DEV.b);
      expect(b.items.map((i) => (i.type === 'PRODUCT_POST' ? i.payload.seller.handle : ''))).toEqual(['woven-market-b']);
    });

    it('20. a hidden Seller answers exactly like one that never existed', async () => {
      // Nothing about the hidden Seller appears in any type, and the envelope is the same as for a
      // name that never existed (fuzzy neighbours such as "...woven baskets" may still match).
      const hidden = await search('hidden-baskets');
      const none = await search('nonexistent-shop');
      const mentions = (p: Page) =>
        p.items.filter((i) => (i.type === 'SELLER' ? i.payload.handle : i.payload.seller.handle) === 'hidden-baskets');
      expect(mentions(hidden)).toEqual([]);
      expect(productNames(hidden)).not.toContain('Hidden basket');
      const envelope = ({ items: _items, ...rest }: Page) => rest;
      expect(envelope(hidden)).toEqual(envelope(none));
      expect(none.items).toEqual([]);
    });

    it('the response carries only public fields; Top is bounded; no-store', async () => {
      const r = await get('/v1/search?q=basket').expect(200);
      expect(r.headers['cache-control']).toBe('no-store');
      const top = r.body as Page;
      expect(top.type).toBe('TOP');
      expect(top.algorithm_version).toBe('lexical-trgm-v1');
      expect(top.next_cursor).toBeNull();
      expect(top.items.length).toBeLessThanOrEqual(12);
      expect(top.items.filter((i) => i.type === 'PRODUCT_POST').length).toBeLessThanOrEqual(6);
      const product = top.items.find((i) => i.type === 'PRODUCT_POST')!;
      expect(Object.keys(product.payload).sort()).toEqual([
        'available',
        'base_price_currency',
        'base_price_minor',
        'id',
        'image_key',
        'name',
        'price_currency',
        'price_max_minor',
        'price_min_minor',
        'seller',
        'slug',
      ]);
      // A Top cursor does not exist.
      await get('/v1/search?q=basket&cursor=abc').expect(400);
    });
  });

  describe('pagination', () => {
    const walk = async (q: string, type: string, limit: number) => {
      const pages: Page[] = [];
      let cursor: string | null = null;
      do {
        pages.push(await search(q, type, `&limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`));
        cursor = pages[pages.length - 1]!.next_cursor;
      } while (cursor && pages.length < 20);
      return pages;
    };

    it('21, 22, 23, 28. first, middle and last pages; bounded; every match once, available ones first', async () => {
      const pages = await walk('Pagination item', 'PRODUCT_POST', 20);
      expect(pages.map((p) => p.items.length)).toEqual([20, 20, 5]);
      expect(pages[2]!.next_cursor).toBeNull();
      const all = pages.flatMap((p) => p.items);
      const ids = all.map((i) => (i.type === 'PRODUCT_POST' ? i.payload.id : ''));
      expect(new Set(ids).size).toBe(BULK);
      const available = all.map((i) => i.type === 'PRODUCT_POST' && i.payload.available);
      expect(available.indexOf(false)).toBe(available.filter(Boolean).length); // every available before every unavailable
    });

    it('24, 25, 26. an invalid cursor, a cursor of another query, and one of another type are refused', async () => {
      const first = await search('Pagination item', 'PRODUCT_POST', '&limit=5');
      expect(first.next_cursor).not.toBeNull();
      for (const bad of ['not-a-cursor', Buffer.from('[1,2]').toString('base64url')]) {
        expect((await get(`/v1/search?q=Pagination%20item&type=PRODUCT_POST&cursor=${bad}`).expect(400)).body.slots).toMatchObject({ reason: 'CURSOR_INVALID' });
      }
      await get(`/v1/search?q=Pagination%20items&type=PRODUCT_POST&cursor=${first.next_cursor}`).expect(400);
      await get(`/v1/search?q=Pagination%20item&type=SCENE_POST&cursor=${first.next_cursor}`).expect(400);
      await get(`/v1/search?q=Pagination%20item&type=PRODUCT_POST&cursor=${first.next_cursor}`, DEV.b).expect(400);
      // Case-folded like matching: the same query in other case keeps its cursor.
      await get(`/v1/search?q=PAGINATION%20ITEM&type=PRODUCT_POST&cursor=${first.next_cursor}`).expect(200);
    });

    it('27. publication changes mid-browse: an unpublished match leaves later pages, nothing repeats', async () => {
      const first = await search('Pagination item', 'PRODUCT_POST', '&limit=10');
      const seen = new Set(first.items.map((i) => (i.type === 'PRODUCT_POST' ? i.payload.id : '')));
      const later = P(100 + BULK - 1);
      await admin.query(`UPDATE core.product SET visibility = 'UNPUBLISHED', unpublished_reason = 'SELLER' WHERE id = $1`, [later]);
      try {
        let cursor = first.next_cursor;
        const rest: string[] = [];
        while (cursor) {
          const p = await search('Pagination item', 'PRODUCT_POST', `&limit=10&cursor=${cursor}`);
          rest.push(...p.items.map((i) => (i.type === 'PRODUCT_POST' ? i.payload.id : '')));
          cursor = p.next_cursor;
        }
        expect(rest).not.toContain(later);
        expect(rest.filter((x) => seen.has(x))).toEqual([]);
      } finally {
        await admin.query(`UPDATE core.product SET visibility = 'PUBLISHED', unpublished_reason = NULL WHERE id = $1`, [later]);
      }
    });
  });

  it('is rate-limited per device (60 a minute) with a 429 and Retry-After slot', async () => {
    let limited: request.Response | undefined;
    // Fixed one-minute windows: 125 requests cross at most one boundary and still fill a window.
    for (let i = 0; i < 125 && !limited; i++) {
      const r = await get('/v1/search?q=basket&type=SELLER', DEV.rate);
      if (r.status === 429) limited = r;
    }
    expect(limited?.body).toMatchObject({ code: 'RATE_LIMITED' });
    expect(limited?.body.slots.retry_after_seconds).toBeGreaterThan(0);
  });
});
