import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * WO-010 -- Catalogue category taxonomy and category discovery (migration 0062; GET /v1/categories;
 * ?category on GET /v1/shop/products and GET /v1/search?type=PRODUCT_POST). Disposable database.
 *
 *   Market A (ACTIVE): FASHION and COSMETICS enabled, ELECTRONICS disabled, a label-less category
 *                      enabled; Seller sa (ACTIVE) and sd (DRAFT)
 *   Market B (ACTIVE): ELECTRONICS and COSMETICS enabled; Seller sb
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const id = (n: number) => `0e100000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const FASHION = 'ca7e0000-0000-4000-8000-000000000001';
const COSMETICS = 'ca7e0000-0000-4000-8000-000000000002';
const ELECTRONICS = 'ca7e0000-0000-4000-8000-000000000003';
const HIDDEN = id(0x99); // enabled in A, but with no label key: never listed
const MA = id(1);
const MB = id(2);
const SEL = { sa: id(0x20), sd: id(0x21), sb: id(0x22) };
const OWN = (n: number) => id(0x10 + n);
const DEV = { a: id(0x30), b: id(0x31), none: id(0x32) };

@Module({ imports: [AppModule] })
class Wo010AppModule {}

type Item = { id: string; name: string; available: boolean };

describe('WO-010 -- category taxonomy, Shop and Search category discovery', () => {
  let app: INestApplication;
  let admin: Pool;
  const server = () => request(app.getHttpServer());
  const get = (path: string, device?: string) => {
    const r = server().get(path).set('X-Adulis-Client', 'android/1.0.0');
    return device ? r.set('X-Adulis-Device', device) : r;
  };
  const names = (items: Item[]) => items.map((p) => p.name);
  const searchNames = (items: Array<{ type: string; payload: Item }>) => items.map((i) => i.payload.name);

  // [n, seller, market, name, category, visibility, minutesAgo, stock]
  const PRODUCTS: Array<[number, string, string, string, string | null, string, number, number]> = [
    [1, SEL.sa, MA, 'Silk scarf', FASHION, 'PUBLISHED', 60, 3],
    [2, SEL.sa, MA, 'Linen shirt', FASHION, 'PUBLISHED', 50, 2],
    [3, SEL.sa, MA, 'Wool scarf', FASHION, 'PUBLISHED', 40, 0], // out of stock: listed, unavailable
    [4, SEL.sa, MA, 'Rose lip balm', COSMETICS, 'PUBLISHED', 30, 5],
    [5, SEL.sa, MA, 'Cotton scarf', null, 'PUBLISHED', 20, 4], // uncategorised: only in All
    [6, SEL.sa, MA, 'Hidden scarf', FASHION, 'UNPUBLISHED', 10, 4],
    [7, SEL.sd, MA, 'Draft seller scarf', FASHION, 'PUBLISHED', 15, 4],
    [8, SEL.sb, MB, 'Phone charger', ELECTRONICS, 'PUBLISHED', 25, 4],
    [9, SEL.sb, MB, 'Scarf B', null, 'PUBLISHED', 35, 4],
  ];

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone,
                                default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'W10A','Market A','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($2,'W10B','Market B','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE')`,
      [MA, MB],
    );
    await admin.query(`INSERT INTO core.category (id, code) VALUES ($1, 'W10_HIDDEN')`, [HIDDEN]);
    await admin.query(
      `INSERT INTO core.category_market_availability (category_id, market_id, is_available)
       VALUES ($1,$5,true), ($2,$5,true), ($3,$5,false), ($4,$5,true), ($3,$6,true), ($2,$6,true)`,
      [FASHION, COSMETICS, ELECTRONICS, HIDDEN, MA, MB],
    );
    const sellers: Array<[string, string, string, string]> = [
      [SEL.sa, MA, 'w10-sa', 'ACTIVE'],
      [SEL.sd, MA, 'w10-sd', 'DRAFT'],
      [SEL.sb, MB, 'w10-sb', 'ACTIVE'],
    ];
    for (const [i, [sid, mid, handle, status]] of sellers.entries()) {
      await admin.query(`INSERT INTO core.account (id, phone_e164, market_id, status) VALUES ($1,$2,$3,'ACTIVE')`, [OWN(i), `+25191171000${i}`, mid]);
      await admin.query(
        `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status)
         VALUES ($1,$2,$3,'INDIVIDUAL',$4,$5,$6)`,
        [sid, mid, OWN(i), `Store ${handle}`, handle, status],
      );
    }
    for (const [n, sid, mid, name, category, vis, ago, stock] of PRODUCTS) {
      await admin.query(
        `INSERT INTO core.product (id, seller_id, market_id, name, category_id, base_price_minor, base_price_currency, visibility, published_at)
         VALUES ($1,$2,$3,$4,$5,1,'ETB',$6, now() - ($7 || ' minutes')::interval)`,
        [id(0x100 + n), sid, mid, name, category, vis, String(ago)],
      );
      await admin.query(
        `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key) VALUES ($1,$2,$3,1000,'ETB','v')`,
        [id(0x200 + n), id(0x100 + n), sid],
      );
      if (stock > 0) {
        await admin.query(`INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(),$1,$2,$3,'RESTOCK')`, [
          id(0x200 + n),
          sid,
          stock,
        ]);
      }
    }
    await admin.query(`INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$4), ($2,'ANDROID',$5), ($3,'ANDROID',NULL)`, [
      DEV.a,
      DEV.b,
      DEV.none,
      MA,
      MB,
    ]);
    const moduleRef = await Test.createTestingModule({ imports: [Wo010AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, 'http://localhost:5173');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    // core.stock_event is append-only: the fixture rows go the way other suites remove theirs.
    await admin.query(`SET session_replication_role = replica`);
    for (const statement of [
      `DELETE FROM core.rate_limit_bucket WHERE subject_id IN ('${DEV.a}','${DEV.b}','${DEV.none}')`,
      `DELETE FROM core.stock_event WHERE seller_id IN ('${SEL.sa}','${SEL.sd}','${SEL.sb}')`,
      `DELETE FROM core.product_variant WHERE seller_id IN ('${SEL.sa}','${SEL.sd}','${SEL.sb}')`,
      `DELETE FROM core.product WHERE market_id IN ('${MA}','${MB}')`,
      // Rows the Seller insert's triggers made (D-134: what an INSERT caused, not only what it named).
      `DELETE FROM core.seller_level_state WHERE seller_id IN ('${SEL.sa}','${SEL.sd}','${SEL.sb}')`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN ('${SEL.sa}','${SEL.sd}','${SEL.sb}')`,
      `DELETE FROM core.seller WHERE id IN ('${SEL.sa}','${SEL.sd}','${SEL.sb}')`,
      `DELETE FROM core.device WHERE id IN ('${DEV.a}','${DEV.b}','${DEV.none}')`,
      `DELETE FROM core.account WHERE id IN ('${OWN(0)}','${OWN(1)}','${OWN(2)}')`,
      `DELETE FROM core.category_market_availability WHERE market_id IN ('${MA}','${MB}')`,
      `DELETE FROM core.category WHERE id = '${HIDDEN}'`,
      `DELETE FROM core.market WHERE id IN ('${MA}','${MB}')`,
    ]) {
      await admin.query(statement);
    }
    await admin.query(`SET session_replication_role = origin`);
    await admin.end();
  });

  describe('the taxonomy (migration 0062)', () => {
    it('holds the three approved top-level categories with stable ids, codes, label keys and order', async () => {
      const r = await admin.query(
        `SELECT id, code, parent_id, label_key, display_order FROM core.category WHERE code IN ('FASHION','COSMETICS','ELECTRONICS') ORDER BY display_order`,
      );
      expect(r.rows).toEqual([
        { id: FASHION, code: 'FASHION', parent_id: null, label_key: 'catalogue.category.fashion', display_order: 10 },
        { id: COSMETICS, code: 'COSMETICS', parent_id: null, label_key: 'catalogue.category.cosmetics', display_order: 20 },
        { id: ELECTRONICS, code: 'ELECTRONICS', parent_id: null, label_key: 'catalogue.category.electronics', display_order: 30 },
      ]);
      // No subcategory was invented.
      const children = await admin.query(`SELECT count(*)::int AS n FROM core.category WHERE parent_id IN ($1,$2,$3)`, [FASHION, COSMETICS, ELECTRONICS]);
      expect(children.rows[0].n).toBe(0);
    });

    it('initialisation is idempotent and never duplicates an existing code', async () => {
      const migration = readFileSync(join(__dirname, '../../../db/migrations/0062_catalogue_category_taxonomy.sql'), 'utf8');
      const insert = /INSERT INTO core\.category[\s\S]*?ON CONFLICT \(code\) DO NOTHING;/.exec(migration)?.[0];
      expect(insert).toBeDefined();
      await admin.query(insert!);
      await admin.query(`INSERT INTO core.category (id, code) VALUES (gen_random_uuid(), 'FASHION') ON CONFLICT (code) DO NOTHING`);
      const r = await admin.query(`SELECT code, count(*)::int AS n, min(id::text) AS id FROM core.category WHERE code IN ('FASHION','COSMETICS','ELECTRONICS') GROUP BY code ORDER BY code`);
      expect(r.rows).toEqual([
        { code: 'COSMETICS', n: 1, id: COSMETICS },
        { code: 'ELECTRONICS', n: 1, id: ELECTRONICS },
        { code: 'FASHION', n: 1, id: FASHION },
      ]);
      await expect(admin.query(`INSERT INTO core.category (id, code) VALUES (gen_random_uuid(), 'FASHION')`)).rejects.toMatchObject({ code: '23505' });
    });

    it('a Product may be assigned only a category enabled in its Market; NULL always; a later disable keeps it', async () => {
      const insert = (n: number, market: string, seller: string, category: string | null) =>
        admin.query(
          `INSERT INTO core.product (id, seller_id, market_id, name, category_id, base_price_minor, base_price_currency) VALUES ($1,$2,$3,'Probe',$4,1,'ETB')`,
          [id(0x300 + n), seller, market, category],
        );
      // Disabled in A, enabled only in B, unknown: refused by the database whoever writes.
      for (const [n, category] of [[1, ELECTRONICS], [2, id(0xfff)]] as const) {
        await expect(insert(n, MA, SEL.sa, category)).rejects.toMatchObject({ code: '23514', constraint: 'product_category_available' });
      }
      // Enabled in A but unlabelled (not presentable): refused too.
      await expect(insert(4, MA, SEL.sa, HIDDEN)).rejects.toMatchObject({ constraint: 'product_category_available' });
      await insert(3, MA, SEL.sa, null);
      await expect(admin.query(`UPDATE core.product SET category_id = $1 WHERE id = $2`, [ELECTRONICS, id(0x303)])).rejects.toMatchObject({
        constraint: 'product_category_available',
      });
      // A Market change re-checks the category: FASHION is not enabled in B.
      await expect(admin.query(`UPDATE core.product SET market_id = $1 WHERE id = $2`, [MB, id(0x101)])).rejects.toMatchObject({
        constraint: 'product_category_available',
      });
      // Disabled after assignment: unrelated edits of a Product holding it still work.
      await admin.query(`UPDATE core.category_market_availability SET is_available = false WHERE category_id = $1 AND market_id = $2`, [COSMETICS, MA]);
      try {
        await admin.query(`UPDATE core.product SET name = 'Rose lip balm' WHERE id = $1`, [id(0x104)]);
      } finally {
        await admin.query(`UPDATE core.category_market_availability SET is_available = true WHERE category_id = $1 AND market_id = $2`, [COSMETICS, MA]);
        await admin.query(`DELETE FROM core.product WHERE id = $1`, [id(0x303)]);
      }
    });
  });

  describe('GET /v1/categories', () => {
    it("lists only the requester Market's enabled, labelled top-level categories, in order, and nothing else", async () => {
      const a = await get('/v1/categories', DEV.a).expect(200);
      expect(a.headers['cache-control']).toBe('no-store');
      expect(a.body).toEqual({
        market_resolved: true,
        data: [
          { id: FASHION, code: 'FASHION', parent_id: null, label_key: 'catalogue.category.fashion', display_order: 10 },
          { id: COSMETICS, code: 'COSMETICS', parent_id: null, label_key: 'catalogue.category.cosmetics', display_order: 20 },
        ],
      });
      const b = await get('/v1/categories', DEV.b).expect(200);
      expect(b.body.data.map((c: { code: string }) => c.code)).toEqual(['COSMETICS', 'ELECTRONICS']);
    });

    it('without a Market: says so, lists nothing', async () => {
      expect((await get('/v1/categories', DEV.none).expect(200)).body).toEqual({ market_resolved: false, data: [] });
      expect((await get('/v1/categories').expect(200)).body).toEqual({ market_resolved: false, data: [] });
    });
  });

  describe('Shop category browsing', () => {
    const shop = (query: string, device = DEV.a) => get(`/v1/shop/products${query}`, device);

    it('All keeps every public Product, uncategorised included; a category narrows it in the same order', async () => {
      expect(names((await shop('').expect(200)).body.data)).toEqual(['Cotton scarf', 'Rose lip balm', 'Wool scarf', 'Linen shirt', 'Silk scarf']);
      const fashion = (await shop('?category=FASHION').expect(200)).body;
      expect(names(fashion.data)).toEqual(['Wool scarf', 'Linen shirt', 'Silk scarf']);
      // Out of stock stays listed, unavailable; unpublished and non-public Sellers never appear.
      expect(fashion.data.find((p: Item) => p.name === 'Wool scarf').available).toBe(false);
      expect(names((await shop('?category=COSMETICS').expect(200)).body.data)).toEqual(['Rose lip balm']);
    });

    it('an enabled category with no Products is an empty page; Market B sees only its own', async () => {
      expect((await shop('?category=COSMETICS', DEV.b).expect(200)).body).toEqual({ market_resolved: true, data: [], next_cursor: null });
      expect(names((await shop('?category=ELECTRONICS', DEV.b).expect(200)).body.data)).toEqual(['Phone charger']);
    });

    it('refuses a disabled, other-Market, unknown or malformed category', async () => {
      for (const [query, device] of [
        ['?category=ELECTRONICS', DEV.a],
        ['?category=FASHION', DEV.b],
        ['?category=TOYS', DEV.a],
        ['?category=W10_HIDDEN', DEV.a], // enabled in A, but unlabelled: not offered, not accepted
        ['?category=fashion', DEV.a],
      ] as const) {
        const r = await shop(query, device).expect(400);
        expect(r.body).toMatchObject({ code: 'VALIDATION_FAILED', slots: { path: 'category' } });
      }
    });

    it('pages by a cursor bound to its category and Market; no other filter or Market can use it', async () => {
      const p1 = (await shop('?category=FASHION&limit=1').expect(200)).body;
      const p2 = (await shop(`?category=FASHION&limit=1&cursor=${p1.next_cursor}`).expect(200)).body;
      const p3 = (await shop(`?category=FASHION&limit=1&cursor=${p2.next_cursor}`).expect(200)).body;
      expect([...names(p1.data), ...names(p2.data), ...names(p3.data)]).toEqual(['Wool scarf', 'Linen shirt', 'Silk scarf']);
      expect(p3.next_cursor).toBeNull();
      const all = (await shop('?limit=1').expect(200)).body;
      for (const query of [
        `?category=COSMETICS&cursor=${p1.next_cursor}`, // another category
        `?cursor=${p1.next_cursor}`, // the unfiltered list
        `?category=FASHION&cursor=${all.next_cursor}`, // an unfiltered cursor
        `?category=FASHION&cursor=bm90LWEtY3Vyc29y`, // tampered
      ]) {
        const r = await shop(query).expect(400);
        expect(r.body).toMatchObject({ code: 'VALIDATION_FAILED', slots: { path: 'cursor', reason: 'CURSOR_INVALID' } });
      }
      // Market B with its own category cannot use Market A's cursor.
      await shop(`?category=ELECTRONICS&cursor=${p1.next_cursor}`, DEV.b).expect(400);
    });
  });

  describe('Marketplace Search category filter', () => {
    const search = (query: string, device = DEV.a) => get(`/v1/search${query}`, device);

    it('narrows Product results server-side and keeps the ranking (available before unavailable)', async () => {
      const unfiltered = (await search('?q=scarf&type=PRODUCT_POST').expect(200)).body;
      // Available Products first (the unavailable Wool scarf last); unpublished and non-public never.
      expect([...searchNames(unfiltered.items)].sort()).toEqual(['Cotton scarf', 'Silk scarf', 'Wool scarf']);
      expect(searchNames(unfiltered.items).at(-1)).toBe('Wool scarf');
      const fashion = (await search('?q=scarf&type=PRODUCT_POST&category=FASHION').expect(200)).body;
      expect(searchNames(fashion.items)).toEqual(['Silk scarf', 'Wool scarf']);
      // The same relative order as the unfiltered ranking.
      expect(searchNames(unfiltered.items).filter((n: string) => searchNames(fashion.items).includes(n))).toEqual(searchNames(fashion.items));
      // Fuzzy matching still applies inside the category (a doubled letter: word similarity 0.71 >= 0.5).
      expect(searchNames((await search('?q=scarff&type=PRODUCT_POST&category=FASHION').expect(200)).body.items)).toEqual(['Silk scarf', 'Wool scarf']);
    });

    it('pages with a cursor bound to the category; another filter cannot use it', async () => {
      const p1 = (await search('?q=scarf&type=PRODUCT_POST&category=FASHION&limit=1').expect(200)).body;
      const p2 = (await search(`?q=scarf&type=PRODUCT_POST&category=FASHION&limit=1&cursor=${p1.next_cursor}`).expect(200)).body;
      expect([...searchNames(p1.items), ...searchNames(p2.items)]).toEqual(['Silk scarf', 'Wool scarf']);
      for (const query of [`?q=scarf&type=PRODUCT_POST&category=COSMETICS&cursor=${p1.next_cursor}`, `?q=scarf&type=PRODUCT_POST&cursor=${p1.next_cursor}`]) {
        expect((await search(query).expect(400)).body).toMatchObject({ slots: { path: 'cursor', reason: 'CURSOR_INVALID' } });
      }
    });

    it('refuses a category outside Product results, or not enabled in the Market', async () => {
      for (const query of [
        '?q=scarf&category=FASHION', // Top
        '?q=scarf&type=TOP&category=FASHION',
        '?q=store&type=SELLER&category=FASHION',
        '?q=scarf&type=SCENE_POST&category=FASHION',
        '?q=scarf&type=PRODUCT_POST&category=ELECTRONICS', // disabled in A
        '?q=scarf&type=PRODUCT_POST&category=TOYS',
      ]) {
        expect((await search(query).expect(400)).body).toMatchObject({ code: 'VALIDATION_FAILED', slots: { path: 'category' } });
      }
      // Market B: its own category, its own Products only.
      expect(searchNames((await search('?q=charger&type=PRODUCT_POST&category=ELECTRONICS', DEV.b).expect(200)).body.items)).toEqual(['Phone charger']);
    });
  });
});
