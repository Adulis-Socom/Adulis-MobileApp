import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * WO-007 -- GET /v1/shop/products: the requester Market's public Products, newest first
 * publication, keyset-paginated, priced and qualified by the shared Catalogue projection.
 * Disposable database.
 *
 *   Market A (ACTIVE)    Seller a1 (ACTIVE): four published, one unpublished, one out of stock
 *                        Seller a2 (CLOSING): one published (listed, unavailable)
 *                        Seller a3 (DRAFT):   one published (not public: excluded)
 *   Market B (ACTIVE)    Seller b1: one published
 *   Market C (SUSPENDED) Seller c1: one published (excluded for everyone)
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const id = (n: number) => `0e070000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const MA = id(1);
const MB = id(2);
const MC = id(3);
const OWN = (n: number) => id(0x10 + n);
const SEL = { a1: id(0x20), a2: id(0x21), a3: id(0x22), b1: id(0x23), c1: id(0x24) };
const DEV = { a: id(0x30), b: id(0x31), noMarket: id(0x32), session: id(0x33) };
const BUYER_B = id(0x40);
const SESSION_B = id(0x41);

@Module({ imports: [AppModule] })
class Wo007AppModule {}

type ShopItem = {
  id: string;
  slug: string;
  name: string;
  price_min_minor: number | null;
  price_max_minor: number | null;
  price_currency: string | null;
  available: boolean;
  seller: { handle: string; store_name: string };
  thumb_key: string | null;
};

describe('WO-007 -- Shop products', () => {
  let app: INestApplication;
  let admin: Pool;
  const server = () => request(app.getHttpServer());
  const shop = (device?: string, query = '') => {
    const r = server().get(`/v1/shop/products${query}`).set('X-Adulis-Client', 'android/1.0.0');
    return device ? r.set('X-Adulis-Device', device) : r;
  };
  const names = (items: ShopItem[]) => items.map((p) => p.name);

  // [productNo, seller, market, name, visibility, minutesAgo, variants [price, stock][]]
  const PRODUCTS: Array<[number, string, string, string, string, number, Array<[number, number]>]> = [
    [1, SEL.a1, MA, 'A1 oldest', 'PUBLISHED', 60, [[1000, 2]]],
    [2, SEL.a1, MA, 'A1 second', 'PUBLISHED', 50, [[2000, 2], [2500, 0]]],
    [3, SEL.a1, MA, 'A1 sold out', 'PUBLISHED', 40, [[3000, 0]]],
    [4, SEL.a1, MA, 'A1 newest', 'PUBLISHED', 10, [[4000, 1]]],
    [5, SEL.a1, MA, 'A1 hidden', 'UNPUBLISHED', 5, [[5000, 3]]],
    [6, SEL.a2, MA, 'A2 closing', 'PUBLISHED', 30, [[6000, 4]]],
    [7, SEL.a3, MA, 'A3 draft seller', 'PUBLISHED', 20, [[7000, 4]]],
    [8, SEL.b1, MB, 'B1 lamp', 'PUBLISHED', 15, [[8000, 4]]],
    [9, SEL.c1, MC, 'C1 cup', 'PUBLISHED', 25, [[9000, 4]]],
  ];

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone,
                                default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'W7A','Market A','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($2,'W7B','Market B','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($3,'W7C','Market C','PHASE_1','ETB','Africa/Addis_Ababa','en','SUSPENDED',false,'AFROMESSAGE')`,
      [MA, MB, MC],
    );
    const sellers: Array<[string, string, string, string]> = [
      [SEL.a1, MA, 'shop-a1', 'ACTIVE'],
      [SEL.a2, MA, 'shop-a2', 'CLOSING'],
      [SEL.a3, MA, 'shop-a3', 'DRAFT'],
      [SEL.b1, MB, 'shop-b1', 'ACTIVE'],
      [SEL.c1, MC, 'shop-c1', 'ACTIVE'],
    ];
    for (const [i, [sid, mid, handle, status]] of sellers.entries()) {
      await admin.query(`INSERT INTO core.account (id, phone_e164, market_id, status) VALUES ($1,$2,$3,'ACTIVE')`, [
        OWN(i),
        `+25191170700${i}`,
        mid,
      ]);
      await admin.query(
        `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status)
         VALUES ($1,$2,$3,'INDIVIDUAL',$4,$5,$6)`,
        [sid, mid, OWN(i), `Store ${handle}`, handle, status],
      );
    }
    for (const [n, sid, mid, name, vis, ago, variants] of PRODUCTS) {
      await admin.query(
        `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor, base_price_currency, visibility, published_at)
         VALUES ($1,$2,$3,$4,1,'ETB',$5, now() - ($6 || ' minutes')::interval)`,
        [id(0x100 + n), sid, mid, name, vis, String(ago)],
      );
      for (const [k, [price, stock]] of variants.entries()) {
        const vid = id(0x200 + n * 4 + k);
        await admin.query(
          `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key)
           VALUES ($1,$2,$3,$4,'ETB',$5)`,
          [vid, id(0x100 + n), sid, price, `v${k}`],
        );
        if (stock > 0) {
          await admin.query(
            `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(),$1,$2,$3,'RESTOCK')`,
            [vid, sid, stock],
          );
        }
      }
    }
    await admin.query(
      `INSERT INTO core.product_image (id, product_id, position, thumb_key, card_key, full_key)
       VALUES (gen_random_uuid(), $1, 1, 'products/x/thumb.webp', 'products/x/card.webp', 'products/x/full.webp')`,
      [id(0x104)],
    );
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$5), ($2,'ANDROID',$6), ($3,'ANDROID',NULL), ($4,'ANDROID',$5)`,
      [DEV.a, DEV.b, DEV.noMarket, DEV.session, MA, MB],
    );
    await admin.query(`INSERT INTO core.account (id, phone_e164, market_id, status) VALUES ($1,'+251911707099',$2,'ACTIVE')`, [
      BUYER_B,
      MB,
    ]);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES ($1,$2,'MOBILE',$3, now()+interval '12 hours')`,
      [SESSION_B, BUYER_B, DEV.session],
    );
    await armFixtureSessions(admin, [SESSION_B]);

    const moduleRef = await Test.createTestingModule({ imports: [Wo007AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, 'http://localhost:5173');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    const sellers = Object.values(SEL).map((s) => `'${s}'`).join(',');
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.product_image WHERE product_id IN (SELECT id FROM core.product WHERE seller_id IN (${sellers}))`,
      `DELETE FROM core.stock_event WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.product_variant WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.product WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.session WHERE id = '${SESSION_B}'`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller WHERE id IN (${sellers})`,
      `DELETE FROM core.rate_limit_bucket WHERE subject_id LIKE '0e070000-%'`,
      `DELETE FROM core.device WHERE id::text LIKE '0e070000-%'`,
      `DELETE FROM core.account WHERE id::text LIKE '0e070000-%'`,
      `DELETE FROM core.market WHERE id IN ('${MA}','${MB}','${MC}')`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  it("lists the requester Market's public Products newest first, priced and qualified by the projection", async () => {
    const r = await shop(DEV.a).expect(200);
    expect(r.headers['cache-control']).toBe('no-store');
    const items = r.body.data as ShopItem[];
    expect(names(items)).toEqual(['A1 newest', 'A2 closing', 'A1 sold out', 'A1 second', 'A1 oldest']);
    const byName = Object.fromEntries(items.map((p) => [p.name, p]));
    expect(byName['A1 newest']).toMatchObject({
      price_min_minor: 4000,
      price_max_minor: 4000,
      price_currency: 'ETB',
      available: true,
      seller: { handle: 'shop-a1', store_name: 'Store shop-a1' },
      thumb_key: 'products/x/thumb.webp',
    });
    // Price span over ACTIVE Variants in stock or not; availability separate.
    expect(byName['A1 second']).toMatchObject({ price_min_minor: 2000, price_max_minor: 2500, available: true });
    // Legitimately published but unavailable Products stay, labelled so.
    expect(byName['A1 sold out']).toMatchObject({ available: false });
    expect(byName['A2 closing']).toMatchObject({ available: false });
    expect(r.body.next_cursor).toBeNull();
  });

  it('excludes unpublished Products, non-public Sellers, other Markets and inactive Markets', async () => {
    const all = names(((await shop(DEV.a).expect(200)).body.data as ShopItem[]));
    for (const excluded of ['A1 hidden', 'A3 draft seller', 'B1 lamp', 'C1 cup']) expect(all).not.toContain(excluded);
    expect(names((await shop(DEV.b).expect(200)).body.data)).toEqual(['B1 lamp']);
  });

  it('with no Market evidence the answer is an empty page, never another Market', async () => {
    for (const device of [undefined, DEV.noMarket]) {
      const r = await shop(device).expect(200);
      expect(r.body).toEqual({ data: [], next_cursor: null });
    }
  });

  it("a signed-in Account's Market wins over the device's", async () => {
    const r = await shop(DEV.a).set('Authorization', `Bearer ${sessionToken(SESSION_B)}`).expect(200);
    expect(names(r.body.data)).toEqual(['B1 lamp']);
  });

  it('pages to the end with no repeat or gap; an invalid cursor or limit is a 400', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const r: request.Response = await shop(DEV.a, `?limit=2${cursor ? `&cursor=${cursor}` : ''}`).expect(200);
      seen.push(...names(r.body.data));
      cursor = r.body.next_cursor;
      pages++;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(seen).toEqual(['A1 newest', 'A2 closing', 'A1 sold out', 'A1 second', 'A1 oldest']);
    const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    for (const bad of ['garbage', b64(['2026-02-30T00:00:00.000000Z', id(1)]), b64(['2026-11-11T00:00:00.000000Z', 'not-a-uuid'])]) {
      const r = await shop(DEV.a, `?cursor=${bad}`).expect(400);
      expect(r.body.slots).toMatchObject({ reason: 'CURSOR_INVALID' });
    }
    await shop(DEV.a, '?limit=0').expect(400);
    await shop(DEV.a, '?limit=51').expect(400);
  });

  it('an unpublished Product leaves the next read; a stock change shows on it', async () => {
    await admin.query(`UPDATE core.product SET visibility = 'UNPUBLISHED', unpublished_reason = 'SELLER' WHERE id = $1`, [id(0x104)]);
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(),$1,$2,2,'RESTOCK')`,
      [id(0x200 + 3 * 4), SEL.a1],
    );
    try {
      const items = (await shop(DEV.a).expect(200)).body.data as ShopItem[];
      expect(names(items)).not.toContain('A1 newest');
      expect(items.find((p) => p.name === 'A1 sold out')).toMatchObject({ available: true });
    } finally {
      await admin.query(`UPDATE core.product SET visibility = 'PUBLISHED', unpublished_reason = NULL WHERE id = $1`, [id(0x104)]);
      await admin.query(
        `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason) VALUES (gen_random_uuid(),$1,$2,-2,'SELLER_SET')`,
        [id(0x200 + 3 * 4), SEL.a1],
      );
    }
  });

  it('the read uses the Shop index when the planner is made to choose', async () => {
    const c = await admin.connect();
    try {
      await c.query('BEGIN');
      await c.query('SET LOCAL enable_seqscan = off');
      const plan = await c.query<{ 'QUERY PLAN': unknown }>(
        `EXPLAIN (FORMAT JSON) SELECT p.id FROM core.product p
          WHERE p.market_id = $1 AND p.visibility = 'PUBLISHED' AND p.published_at IS NOT NULL
          ORDER BY p.published_at DESC, p.id DESC LIMIT 31`,
        [MA],
      );
      expect(JSON.stringify(plan.rows[0])).toContain('idx_product_shop');
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
  });
});
