import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * WO-007B -- the Seller Profile Products tab lists available Products first, then unavailable
 * ones, each group in the Seller's display order (MOB-02 R-09), by two-phase keyset pagination
 * (founder decision ON-026, option A). No snapshot is stored: a Product that changes group
 * between pages may come again (the client de-duplicates by id) or appear only on a refresh.
 * Disposable database; Products are rows (the WO-006 pattern), stock moves through stock_event.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const CONSOLE_ORIGIN = 'http://localhost:5173';

const id = (n: number) => `0e07b000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const MA = id(1);
const MB = id(2);
const OWNER = { all: id(10), none: id(11), mixed: id(12), big: id(13), twinB: id(14) };
const SELLER = { all: id(20), none: id(21), mixed: id(22), big: id(23), twinB: id(24) };
const DEV = { a: id(30), b: id(31) };
// Products and Variants per Seller: base + n.
const BASE = { all: 0x1000, none: 0x2000, mixed: 0x3000, big: 0x4000, twinB: 0x5000 } as const;
type Key = keyof typeof BASE;
const productId = (k: Key, n: number) => id(BASE[k] + n);
const variantId = (k: Key, n: number) => id(0x10000 + BASE[k] + n);
const BIG = 130;

@Module({ imports: [AppModule] })
class Wo007bAppModule {}

interface Item {
  id: string;
  slug: string;
  name: string;
  available: boolean;
  display_order: number;
}

describe('WO-007B -- available-first Seller catalogue', () => {
  let app: INestApplication;
  let admin: Pool;

  const server = () => request(app.getHttpServer());
  const get = (path: string, device: string = DEV.a) =>
    server().get(path).set('X-Adulis-Client', 'android/1.0.0').set('X-Adulis-Device', device);
  const page = async (handle: string, limit: number, cursor: string | null, device: string = DEV.a) => {
    const r = await get(`/v1/storefronts/${handle}/products?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`, device).expect(200);
    return r.body as { data: Item[]; next_cursor: string | null };
  };
  /** Every page to the end (bounded: a loop would fail, not hang). */
  const walk = async (handle: string, limit: number, device: string = DEV.a) => {
    const items: Item[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const p = await page(handle, limit, cursor, device);
      items.push(...p.data);
      cursor = p.next_cursor;
      pages += 1;
    } while (cursor && pages < 400);
    expect(cursor).toBeNull();
    return items;
  };
  const names = (items: Item[]) => items.map((i) => i.name);
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

  /**
   * Products of one Seller in ONE statement (same created_at, so ties fall to the slug), one ACTIVE
   * Variant each, in stock when `available(n)`. Names sort like their numbers ("P007").
   */
  const seed = async (k: Key, seller: string, market: string, count: number, order: (n: number) => number, available: (n: number) => boolean) => {
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor, base_price_currency, visibility, published_at, display_order)
       SELECT ('0e07b000-0000-4000-8000-' || lpad(to_hex($4::int + n), 12, '0'))::uuid, $1, $2,
              $5 || lpad(n::text, 3, '0'), 1, 'ETB', 'PUBLISHED', now(), ($6::int[])[n]
         FROM generate_series(1, $3::int) AS n`,
      [seller, market, count, BASE[k], `${k.toUpperCase()} P`, Array.from({ length: count }, (_, i) => order(i + 1))],
    );
    for (let n = 1; n <= count; n++) {
      await admin.query(
        `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key) VALUES ($1,$2,$3,$4,'ETB','one')`,
        [variantId(k, n), productId(k, n), seller, 1000 + n],
      );
      if (available(n)) await setStock(variantId(k, n), seller, 2);
    }
  };
  /** The expected order: available first, then unavailable, each by (display_order, created_at, slug). */
  const expected = (items: Array<{ name: string; slug: string; order: number; available: boolean }>) =>
    [...items]
      .sort((x, y) => Number(!x.available) - Number(!y.available) || x.order - y.order || (x.slug < y.slug ? -1 : x.slug > y.slug ? 1 : 0))
      .map((x) => x.name);
  const current = async (seller: string) =>
    (
      await admin.query<{ name: string; slug: string; order: number; available: boolean }>(
        `SELECT p.name, p.slug, p.display_order AS "order",
                EXISTS (SELECT 1 FROM core.product_variant v WHERE v.product_id = p.id AND v.status = 'ACTIVE' AND v.stock_count > 0) AS available
           FROM core.product p WHERE p.seller_id = $1 AND p.visibility = 'PUBLISHED'`,
        [seller],
      )
    ).rows;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone,
                                default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'V7E','Market A','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($2,'V7F','Market B','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE')`,
      [MA, MB],
    );
    const owners = Object.values(OWNER);
    for (let i = 0; i < owners.length; i++) {
      await admin.query(`INSERT INTO core.account (id, phone_e164, market_id, status) VALUES ($1,$2,$3,'ACTIVE')`, [
        owners[i],
        `+25191170791${i}`,
        owners[i] === OWNER.twinB ? MB : MA,
      ]);
    }
    await admin.query(`INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$3), ($2,'ANDROID',$4)`, [DEV.a, DEV.b, MA, MB]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status) VALUES
        ($1,$6,$8,'INDIVIDUAL','All Available','af-all','ACTIVE'),
        ($2,$6,$9,'INDIVIDUAL','None Available','af-none','ACTIVE'),
        ($3,$6,$10,'INDIVIDUAL','Mixed','af-mixed','ACTIVE'),
        ($4,$6,$11,'INDIVIDUAL','Big Catalogue','af-big','ACTIVE'),
        ($5,$7,$12,'INDIVIDUAL','Mixed in Market B','af-mixed','ACTIVE')`,
      [SELLER.all, SELLER.none, SELLER.mixed, SELLER.big, SELLER.twinB, MA, MB, OWNER.all, OWNER.none, OWNER.mixed, OWNER.big, OWNER.twinB],
    );
    // Display orders are deliberately not the creation order, and repeat.
    await seed('all', SELLER.all, MA, 5, (n) => 6 - n, () => true);
    await seed('none', SELLER.none, MA, 5, (n) => 6 - n, () => false);
    await seed('mixed', SELLER.mixed, MA, 12, (n) => n % 4, (n) => n % 3 !== 0);
    await seed('big', SELLER.big, MA, BIG, (n) => n % 7, (n) => n % 3 !== 0);
    await seed('twinB', SELLER.twinB, MB, 3, (n) => n, () => true);

    const moduleRef = await Test.createTestingModule({ imports: [Wo007bAppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    const sellers = Object.values(SELLER)
      .map((s) => `'${s}'`)
      .join(',');
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM analytics.event WHERE market_id IN ('${MA}','${MB}')`,
      `DELETE FROM core.stock_event WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.product_variant WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.product WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller WHERE id IN (${sellers})`,
      `DELETE FROM core.device WHERE id::text LIKE '0e07b000-%'`,
      `DELETE FROM core.account WHERE id::text LIKE '0e07b000-%'`,
      `DELETE FROM core.market WHERE id IN ('${MA}','${MB}')`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  it('1. all available: the Seller display order, unchanged', async () => {
    const items = await walk('af-all', 100);
    expect(names(items)).toEqual(['ALL P005', 'ALL P004', 'ALL P003', 'ALL P002', 'ALL P001']);
    expect(items.every((i) => i.available)).toBe(true);
  });

  it('2. all unavailable: the Seller display order, every one available=false', async () => {
    const items = await walk('af-none', 100);
    expect(names(items)).toEqual(['NONE P005', 'NONE P004', 'NONE P003', 'NONE P002', 'NONE P001']);
    expect(items.every((i) => !i.available)).toBe(true);
  });

  it('3. mixed: every available Product before every unavailable one, each group in display order', async () => {
    const items = await walk('af-mixed', 100);
    expect(names(items)).toEqual(expected(await current(SELLER.mixed)));
    const firstUnavailable = items.findIndex((i) => !i.available);
    expect(firstUnavailable).toBeGreaterThan(0);
    expect(items.slice(firstUnavailable).every((i) => !i.available)).toBe(true);
    // The phase boundary falls inside a page at any page size.
    for (const limit of [1, 3, 5, 7]) expect(names(await walk('af-mixed', limit))).toEqual(names(items));
  });

  it('4, 5, 11. more than 100 Products with repeated display orders: bounded pages, no repeat or gap, an end marker', async () => {
    const p1 = await page('af-big', 100, null);
    expect(p1.data).toHaveLength(100);
    expect(p1.next_cursor).not.toBeNull();
    const p2 = await page('af-big', 100, p1.next_cursor);
    expect(p2.data).toHaveLength(BIG - 100);
    expect(p2.next_cursor).toBeNull();
    const all = [...p1.data, ...p2.data];
    expect(new Set(all.map((i) => i.id)).size).toBe(BIG);
    // display_order = n % 7 repeats; one INSERT gave one created_at, so the slug orders the ties.
    expect(names(all)).toEqual(expected(await current(SELLER.big)));
    expect(names(await walk('af-big', 17))).toEqual(names(all));
    // The default page and the bound.
    expect((await get('/v1/storefronts/af-big/products').expect(200)).body.data).toHaveLength(100);
    await get('/v1/storefronts/af-big/products?limit=101').expect(400);
    await get('/v1/storefronts/af-big/products?limit=0').expect(400);
  });

  it('6, 7, 9 (server half). available -> unavailable after it was sent: it comes again in the unavailable group, nothing is skipped', async () => {
    const p1 = await page('af-mixed', 3, null);
    const moved = p1.data[0]!;
    expect(moved.available).toBe(true);
    const n = Number(moved.name.slice(-3));
    try {
      await setStock(variantId('mixed', n), SELLER.mixed, 0);
      const rest: Item[] = [];
      let cursor = p1.next_cursor;
      while (cursor) {
        const p = await page('af-mixed', 3, cursor);
        rest.push(...p.data);
        cursor = p.next_cursor;
      }
      const seen = [...p1.data, ...rest];
      // Controlled duplication: the moved Product appears twice (once per group) ...
      expect(seen.filter((i) => i.id === moved.id).map((i) => i.available)).toEqual([true, false]);
      // ... and de-duplicated by id the browse covers every Product exactly once.
      expect(new Set(seen.map((i) => i.id)).size).toBe((await current(SELLER.mixed)).length);
    } finally {
      await setStock(variantId('mixed', n), SELLER.mixed, 2);
    }
  });

  it('8, 10. unavailable -> available behind the cursor: absent from this browse, present after a refresh in the right place', async () => {
    // Read past the whole available group (first page reaching phase 1), then make an unavailable
    // Product whose display position the cursor already passed available.
    const target = (await current(SELLER.mixed)).filter((x) => !x.available).sort((x, y) => x.order - y.order || (x.slug < y.slug ? -1 : 1))[0]!;
    const n = Number(target.name.slice(-3));
    let cursor: string | null = null;
    const seen: Item[] = [];
    do {
      const p = await page('af-mixed', 4, cursor);
      seen.push(...p.data);
      cursor = p.next_cursor;
    } while (cursor && seen.every((i) => i.available));
    expect(seen.some((i) => !i.available)).toBe(true);
    try {
      await setStock(variantId('mixed', n), SELLER.mixed, 2);
      while (cursor) {
        const p = await page('af-mixed', 4, cursor);
        seen.push(...p.data);
        cursor = p.next_cursor;
      }
      // The accepted limit: this browse never shows it as available (it was already behind) ...
      expect(seen.filter((i) => i.name === target.name).every((i) => !i.available)).toBe(true);
      // ... and the refresh reconciles: available, in its display place, every Product once.
      const refreshed = await walk('af-mixed', 4);
      expect(names(refreshed)).toEqual(expected(await current(SELLER.mixed)));
      expect(refreshed.find((i) => i.name === target.name)!.available).toBe(true);
      expect(new Set(refreshed.map((i) => i.id)).size).toBe(refreshed.length);
    } finally {
      await setStock(variantId('mixed', n), SELLER.mixed, 0);
    }
  });

  it('12. malformed cursors are 400 CURSOR_INVALID, including the pre-WO-007B three-part cursor and a phase outside 0/1', async () => {
    const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const ts = '2026-11-11T08:00:00.000000Z';
    for (const bad of [
      'not-a-cursor',
      b64([0, ts, 'p001']), // the WO-006 shape
      b64([2, 0, ts, 'p001']),
      b64([true, 0, ts, 'p001']),
      b64([0, 0, '2026-02-30T00:00:00.000000Z', 'p001']),
      b64([0, 2147483648, ts, 'p001']),
      b64([0, 0, ts, 'Not A Slug']),
    ]) {
      const r = await get(`/v1/storefronts/af-mixed/products?cursor=${bad}`).expect(400);
      expect(r.body.slots).toMatchObject({ reason: 'CURSOR_INVALID' });
    }
  });

  it("13. the same handle in another Market resolves to that Market's Seller, and a cursor cannot cross", async () => {
    expect(names(await walk('af-mixed', 100, DEV.b))).toEqual(['TWINB P001', 'TWINB P002', 'TWINB P003']);
    // A Market A cursor replayed against Market B only positions inside Market B's Seller.
    const a1 = await page('af-mixed', 2, null, DEV.a);
    const crossed = await page('af-mixed', 2, a1.next_cursor, DEV.b);
    expect(crossed.data.every((i) => i.name.startsWith('TWINB'))).toBe(true);
  });

  it('14. an unpublished Product leaves the list, mid-browse included', async () => {
    const p1 = await page('af-mixed', 2, null);
    const all = await walk('af-mixed', 100);
    const victim = all[all.length - 1]!;
    await admin.query(`UPDATE core.product SET visibility = 'UNPUBLISHED', unpublished_reason = 'SELLER' WHERE id = $1`, [victim.id]);
    try {
      const rest: Item[] = [];
      let cursor = p1.next_cursor;
      while (cursor) {
        const p = await page('af-mixed', 2, cursor);
        rest.push(...p.data);
        cursor = p.next_cursor;
      }
      expect(rest.map((i) => i.id)).not.toContain(victim.id);
      expect((await walk('af-mixed', 100)).map((i) => i.id)).not.toContain(victim.id);
    } finally {
      await admin.query(`UPDATE core.product SET visibility = 'PUBLISHED', unpublished_reason = NULL WHERE id = $1`, [victim.id]);
    }
  });

  it('the response is unchanged in shape: lean items, the first image card key, no-store', async () => {
    const r = await get('/v1/storefronts/af-mixed/products?limit=1').expect(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(Object.keys(r.body.data[0]).sort()).toEqual([
      'available',
      'base_price_currency',
      'base_price_minor',
      'display_order',
      'id',
      'image_key',
      'name',
      'price_currency',
      'price_max_minor',
      'price_min_minor',
      'slug',
    ]);
  });

  it('16. the Market-wide Shop stays newest first, not available first', async () => {
    const r = await get('/v1/shop/products?limit=50').expect(200);
    const published = r.body.data as Array<{ name: string; available: boolean }>;
    // All fixtures share one published_at instant per Seller statement; the Shop orders by
    // (published_at, id) DESC, so unavailable Products interleave with available ones.
    const firstUnavailable = published.findIndex((p) => !p.available);
    expect(firstUnavailable).toBeGreaterThanOrEqual(0);
    expect(published.slice(firstUnavailable).some((p) => p.available)).toBe(true);
  });
});
