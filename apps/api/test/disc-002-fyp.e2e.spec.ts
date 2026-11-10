import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { resetNodeEnvForTests } from '../src/common/env';
import { devicePurgeUnbound } from '../src/jobs/e4-retention';
import { configureApp } from '../src/configure-app';
import {
  FakeMediaStorageAdapter,
  MEDIA_STORAGE_ADAPTER,
} from '../src/modules/catalogue/media-storage.adapter';
import { createJobHarness } from './jobs-harness';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * WO-DISC-002 -- GET /v1/fyp (ADU-REC-01 v3.2).
 *
 * Scenes are made the production way (Seller API: create, image, publish) and
 * availability moves through core.stock_event, never by writing Scene rows.
 * Three Markets: M with Sellers A and B, M2 with Seller C, M3 with nothing.
 * Publication order A1, B1, B2, A2, A3, A4, so RECENT order is
 * A4 A3 A2 B2 B1 A1.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const APP_ROLE = process.env['DATABASE_URL'];
const BASELINE = 'technical-baseline-recent-v1';

const id = (n: number) => `d25f0000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const M = id(1);
const M2 = id(2);
const M3 = id(3);
const OWNER_A = id(10);
const OWNER_B = id(11);
const OWNER_C = id(12);
const BUYER = id(13);
const LEAVER = id(14); // a Buyer who deletes the account
const DELETION_TICKET = id(15);
const SELLER_A = id(20);
const SELLER_B = id(21);
const SELLER_C = id(22);
const PA1 = id(30);
const PA2 = id(31); // tagged only by A4, so A4 can go PRIVATE alone
const PB1 = id(32);
const PC1 = id(33);
const VA1 = id(40);
const VA2 = id(41);
const VB1 = id(42);
const VC1 = id(43);
const DEV = {
  a: id(50),
  b: id(51),
  c: id(52),
  d: id(53),
  e: id(54),
  f: id(55),
  noMarket: id(56),
  m2: id(57),
  m3: id(58),
  purge: id(59),
  buyer: id(60),
  unregistered: id(61),
};
const S = { ownerA: id(70), ownerB: id(71), ownerC: id(72), buyer: id(73), leaver: id(74) };
const VARIANTS = [
  [VA1, SELLER_A],
  [VA2, SELLER_A],
  [VB1, SELLER_B],
  [VC1, SELLER_C],
] as const;

const storage = new FakeMediaStorageAdapter();

@Module({ imports: [AppModule] })
class FypAppModule {}

interface Unit {
  type: string;
  serve_id: string;
  position: number;
  candidate_source: string;
  public_ref: string;
  revision_version: number;
  published_at: string;
  caption: string;
  caption_truncated: boolean;
  image: Record<string, string>;
  seller: { handle: string; store_name: string };
  products: Array<Record<string, unknown>>;
}
interface Page {
  feed_session_id: string | null;
  algorithm_version: string | null;
  items: Unit[];
  next_cursor: string | null;
}

describe('WO-DISC-002 -- For You API', () => {
  let app: INestApplication;
  let admin: Pool;
  let appRole: Pool;
  /** public_ref -> fixture name (A1 ... A4, B1, B2, C1). */
  const refs = new Map<string, string>();
  /** fixture name -> Scene id. */
  const sceneIds = new Map<string, string>();
  const names = (p: Page) => p.items.map((u) => refs.get(u.public_ref) ?? u.public_ref);

  const server = () => request(app.getHttpServer());
  const idem = () => crypto.randomUUID();
  const asOwner = (seller: string, session: string, r: request.Test) =>
    r
      .set('Cookie', `__Host-adulis_session=${sessionToken(session)}`)
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Seller', seller);

  const guest = (device: string, query: Record<string, string> = {}) =>
    server().get('/v1/fyp').query(query).set('X-Adulis-Client', 'android/1.0.0').set('X-Adulis-Device', device);
  const signedIn = (query: Record<string, string> = {}) =>
    server()
      .get('/v1/fyp')
      .query(query)
      .set('X-Adulis-Client', 'android/1.0.0')
      .set('X-Adulis-Device', DEV.buyer)
      .set('Authorization', `Bearer ${sessionToken(S.buyer)}`);
  const page = async (r: request.Test) => (await r.expect(200)).body as Page;

  const stock = (variant: string, seller: string, delta: number) =>
    admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [variant, seller, delta, delta >= 0 ? 'RESTOCK' : 'SELLER_SET'],
    );
  const setStock = async (variant: string, seller: string, to: number) => {
    const n = (await admin.query<{ n: number }>(`SELECT stock_count AS n FROM core.product_variant WHERE id = $1`, [variant]))
      .rows[0]!.n;
    if (n !== to) await stock(variant, seller, to - n);
  };

  /** A published Scene, the production way. */
  const publishScene = async (name: string, seller: string, session: string, products: string[], caption = `D25 ${name}`) => {
    const created = await asOwner(seller, session, server().post('/v1/seller/scene-posts').set('Idempotency-Key', idem()))
      .send({ caption, product_ids: products })
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
    refs.set(published.body.public_ref, name);
    sceneIds.set(name, sceneId);
    return sceneId;
  };

  const addVersion = (vid: string, config: object, approved = false) =>
    admin.query(
      `INSERT INTO core.fyp_algorithm_version (id, schema_version, config, production_approved, description)
       VALUES ($1, 1, $2, $3, 'WO-DISC-002 test version')`,
      [vid, JSON.stringify(config), approved],
    );
  const activate = async (vid: string) => {
    await admin.query(`UPDATE core.fyp_algorithm_version SET status = 'RETIRED' WHERE status = 'ACTIVE' AND id <> $1`, [vid]);
    await admin.query(
      `UPDATE core.fyp_algorithm_version SET status = 'ACTIVE', activated_at = coalesce(activated_at, now()) WHERE id = $1`,
      [vid],
    );
  };
  const baselineConfig = {
    sources: { RECENT: { budget: 60 } },
    page: { default_limit: 10, max_limit: 24 },
    session: { ttl_seconds: 3600, max_items: 500 },
    tie_break: 'SEEDED_HASH',
    diversity: { seller_adjacency_max: null },
  };

  const reasonOf = (r: request.Response) => (r.body as { slots?: { reason?: string } }).slots?.reason;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 4 });
    appRole = new Pool({ connectionString: APP_ROLE, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone,
                                default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'D25','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($2,'D26','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE'),
              ($3,'D27','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE')`,
      [M, M2, M3],
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
        ($1,'+251911252001',$5,'ACTIVE'), ($2,'+251911252002',$5,'ACTIVE'),
        ($3,'+251911252003',$6,'ACTIVE'), ($4,'+251911252004',$5,'ACTIVE'),
        ($7,'+251911252005',$5,'ACTIVE')`,
      [OWNER_A, OWNER_B, OWNER_C, BUYER, M, M2, LEAVER],
    );
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES
        ($1,'ANDROID',$13), ($2,'ANDROID',$13), ($3,'ANDROID',$13), ($4,'ANDROID',$13),
        ($5,'ANDROID',$13), ($6,'ANDROID',$13), ($7,'ANDROID',NULL), ($8,'ANDROID',$14),
        ($9,'ANDROID',$15), ($10,'ANDROID',$13), ($11,'ANDROID',$13), ($12,'ANDROID',$13)`,
      [DEV.a, DEV.b, DEV.c, DEV.d, DEV.e, DEV.f, DEV.noMarket, DEV.m2, DEV.m3, DEV.purge, DEV.buyer, id(62), M, M2, M3],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status)
       VALUES ($1,$4,$6,'INDIVIDUAL','D25 Alpha','d25-alpha','ACTIVE'),
              ($2,$4,$7,'INDIVIDUAL','D25 Beta','d25-beta','ACTIVE'),
              ($3,$5,$8,'INDIVIDUAL','D26 Gamma','d26-gamma','ACTIVE')`,
      [SELLER_A, SELLER_B, SELLER_C, M, M2, OWNER_A, OWNER_B, OWNER_C],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, visibility, base_price_minor,
                                 base_price_currency, published_at) VALUES
        ($1,$5,$8,'Basket','PUBLISHED',120000,'ETB',now()),
        ($2,$5,$8,'Lantern','PUBLISHED',40000,'ETB',now()),
        ($3,$6,$8,'Scarf','PUBLISHED',80000,'ETB',now()),
        ($4,$7,$9,'Jebena','PUBLISHED',60000,'ETB',now())`,
      [PA1, PA2, PB1, PC1, SELLER_A, SELLER_B, SELLER_C, M, M2],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key)
       VALUES ($1,$5,$9,120000,'ETB','one'), ($2,$6,$9,40000,'ETB','one'),
              ($3,$7,$10,80000,'ETB','one'), ($4,$8,$11,60000,'ETB','one')`,
      [VA1, VA2, VB1, VC1, PA1, PA2, PB1, PC1, SELLER_A, SELLER_B, SELLER_C],
    );
    for (const [v, s] of VARIANTS) await stock(v, s, 5);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$5,'CONSOLE',$9, now()+interval '12 hours'),
        ($2,$6,'CONSOLE',$9, now()+interval '12 hours'),
        ($3,$7,'CONSOLE',$9, now()+interval '12 hours'),
        ($4,$8,'MOBILE',$10, now()+interval '12 hours'),
        ($11,$12,'MOBILE',$10, now()+interval '12 hours')`,
      [S.ownerA, S.ownerB, S.ownerC, S.buyer, OWNER_A, OWNER_B, OWNER_C, BUYER, id(62), DEV.buyer, S.leaver, LEAVER],
    );
    await armFixtureSessions(admin, Object.values(S));

    const moduleRef = await Test.createTestingModule({ imports: [FypAppModule] })
      .overrideProvider(MEDIA_STORAGE_ADAPTER)
      .useValue(storage)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();

    await publishScene('A1', SELLER_A, S.ownerA, [PA1], `D25 A1 ${'x'.repeat(400)}`);
    await publishScene('B1', SELLER_B, S.ownerB, [PB1]);
    await publishScene('B2', SELLER_B, S.ownerB, [PB1]);
    await publishScene('A2', SELLER_A, S.ownerA, [PA1]);
    await publishScene('A3', SELLER_A, S.ownerA, [PA1]);
    await publishScene('A4', SELLER_A, S.ownerA, [PA2]);
    await publishScene('C1', SELLER_C, S.ownerC, [PC1]);
  });

  afterEach(async () => {
    for (const [v, s] of VARIANTS) await setStock(v, s, 5);
    await activate(BASELINE);
    process.env['NODE_ENV'] = 'test';
    resetNodeEnvForTests();
  });

  afterAll(async () => {
    await app?.close();
    const sellers = `'${SELLER_A}','${SELLER_B}','${SELLER_C}'`;
    const subjects = [BUYER, ...Object.values(DEV)].map((s) => `'${s}'`).join(',');
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.fyp_impression WHERE scene_post_id IN (SELECT id FROM core.scene_post WHERE seller_id IN (${sellers}))`,
      `DELETE FROM core.fyp_session WHERE market_id IN ('${M}','${M2}','${M3}')`,
      `DELETE FROM core.fyp_algorithm_version WHERE id LIKE 'test-d25-%'`,
      `DELETE FROM core.rate_limit_bucket WHERE subject_id IN (${subjects})`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER_A}','${OWNER_B}','${OWNER_C}')`,
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${OWNER_A}','${OWNER_B}','${OWNER_C}')`,
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
      `DELETE FROM core.device WHERE id IN (${[...Object.values(DEV), id(62)].map((s) => `'${s}'`).join(',')})`,
      `DELETE FROM core.otp_challenge WHERE id = '${DELETION_TICKET}'`,
      `DELETE FROM core.account WHERE id IN ('${OWNER_A}','${OWNER_B}','${OWNER_C}','${BUYER}','${LEAVER}')`,
      `DELETE FROM core.timing_config WHERE market_id IN ('${M}','${M2}')`,
      `DELETE FROM core.market WHERE id IN ('${M}','${M2}','${M3}')`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    // Leave the database as migration 0055 left it.
    await activate(BASELINE);
    await appRole.end();
    await admin.end();
  });

  // ------------------------------------------------------------- the subject

  describe('subject and Market', () => {
    it('a guest without a device, or with an unregistered one, is a 400 naming the header', async () => {
      const none = await server().get('/v1/fyp').set('X-Adulis-Client', 'android/1.0.0').expect(400);
      expect(none.body.code).toBe('VALIDATION_FAILED');
      expect(none.body.slots).toEqual({ path: 'X-Adulis-Device' });
      const unknown = await guest(DEV.unregistered).expect(400);
      expect(unknown.body.slots).toEqual({ path: 'X-Adulis-Device' });
    });

    it('a device that never bootstrapped into a Market gets nothing, and no session', async () => {
      const p = await page(guest(DEV.noMarket));
      expect(p).toEqual({ feed_session_id: null, algorithm_version: null, items: [], next_cursor: null });
      const n = await admin.query(`SELECT 1 FROM core.fyp_session WHERE device_id = $1`, [DEV.noMarket]);
      expect(n.rowCount).toBe(0);
    });

    it('an active Market with no eligible Scene answers empty without writing a session', async () => {
      const p = await page(guest(DEV.m3));
      expect(p).toEqual({ feed_session_id: null, algorithm_version: BASELINE, items: [], next_cursor: null });
      const n = await admin.query(`SELECT 1 FROM core.fyp_session WHERE device_id = $1`, [DEV.m3]);
      expect(n.rowCount).toBe(0);
    });

    it('Markets are isolated in both directions', async () => {
      expect(names(await page(guest(DEV.a)))).toEqual(['A4', 'A3', 'A2', 'B2', 'B1', 'A1']);
      expect(names(await page(guest(DEV.m2)))).toEqual(['C1']);
    });

    it('a signed-in Buyer is served as the Account, with the Account Market', async () => {
      const p = await page(signedIn({ limit: '2' }));
      expect(names(p)).toEqual(['A4', 'A3']);
      const s = await admin.query<{ subject_kind: string; account_id: string | null; device_id: string | null }>(
        `SELECT subject_kind, account_id, device_id FROM core.fyp_session WHERE id = $1`,
        [p.feed_session_id],
      );
      expect(s.rows[0]).toEqual({ subject_kind: 'ACCOUNT', account_id: BUYER, device_id: null });
    });
  });

  // ------------------------------------------------------------- the response

  describe('the response', () => {
    it('serves Scene units only, newest first, public identity only, no-store', async () => {
      const r = await guest(DEV.a).expect(200);
      expect(r.headers['cache-control']).toBe('no-store');
      const p = r.body as Page;
      expect(p.feed_session_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(p.algorithm_version).toBe(BASELINE);
      expect(p.next_cursor).toBeNull();
      for (const u of p.items) {
        expect(u.type).toBe('SCENE_POST');
        expect(u.candidate_source).toBe('RECENT');
        expect(Object.keys(u).sort()).toEqual(
          [
            'candidate_source', 'caption', 'caption_truncated', 'image', 'serve_id', 'position',
            'products', 'public_ref', 'published_at', 'revision_version', 'seller', 'type',
          ].sort(),
        );
        expect(Object.keys(u.image).sort()).toEqual(['card_key', 'thumb_key']);
        for (const tag of u.products) expect(Object.keys(tag).sort()).toEqual(['available', 'name', 'position', 'slug']);
      }
      expect(p.items.map((u) => u.position)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(new Set(p.items.map((u) => u.serve_id)).size).toBe(6);
      const times = p.items.map((u) => Date.parse(u.published_at));
      expect([...times].sort((a, b) => b - a)).toEqual(times);
      expect(p.items[0]!.seller).toEqual({ handle: 'd25-alpha', store_name: 'D25 Alpha' });
      expect(p.items[0]!.products).toEqual([{ position: 1, slug: expect.any(String), name: 'Lantern', available: true }]);
    });

    it('bounds the caption to an excerpt and says so', async () => {
      const p = await page(guest(DEV.b));
      const a1 = p.items.find((u) => refs.get(u.public_ref) === 'A1')!;
      expect(a1.caption_truncated).toBe(true);
      expect(Array.from(a1.caption).length).toBeLessThanOrEqual(300);
      expect(p.items.find((u) => refs.get(u.public_ref) === 'A2')!.caption_truncated).toBe(false);
    });

    it('records each served unit bound to session, exact revision, version, position and source', async () => {
      const p = await page(guest(DEV.c, { limit: '3' }));
      const rows = await admin.query<{
        id: string; position: number; candidate_source: string; algorithm_version: string; current: boolean;
      }>(
        `SELECT i.id, i.position, i.candidate_source, i.algorithm_version,
                i.revision_id = sp.current_published_revision_id AS current
           FROM core.fyp_impression i JOIN core.scene_post sp ON sp.id = i.scene_post_id
          WHERE i.session_id = $1 ORDER BY i.position`,
        [p.feed_session_id],
      );
      expect(rows.rows).toEqual(
        p.items.map((u) => ({
          id: u.serve_id, position: u.position, candidate_source: 'RECENT', algorithm_version: BASELINE, current: true,
        })),
      );
      const s = await admin.query<{ served_count: number }>(`SELECT served_count FROM core.fyp_session WHERE id = $1`, [
        p.feed_session_id,
      ]);
      expect(s.rows[0]!.served_count).toBe(3);
    });
  });

  // ------------------------------------------------------------- pagination

  describe('cursor pagination', () => {
    it('continues the session with no duplicate Scene and ends with a null cursor', async () => {
      const p1 = await page(guest(DEV.d, { limit: '4' }));
      expect(names(p1)).toEqual(['A4', 'A3', 'A2', 'B2']);
      expect(p1.next_cursor).toEqual(expect.any(String));
      const p2 = await page(guest(DEV.d, { limit: '4', cursor: p1.next_cursor! }));
      expect(p2.feed_session_id).toBe(p1.feed_session_id);
      expect(names(p2)).toEqual(['B1', 'A1']);
      expect(p2.items.map((u) => u.position)).toEqual([5, 6]);
      expect(p2.next_cursor).toBeNull();
    });

    it('a retried page replays its exact served units', async () => {
      const p1 = await page(guest(DEV.d, { limit: '2' }));
      const p2 = await page(guest(DEV.d, { limit: '2', cursor: p1.next_cursor! }));
      const again = await page(guest(DEV.d, { limit: '2', cursor: p1.next_cursor! }));
      expect(again.items).toEqual(p2.items);
      expect(again.next_cursor).toBe(p2.next_cursor);
      const p3 = await page(guest(DEV.d, { limit: '2', cursor: p2.next_cursor! }));
      expect(names(p3)).toEqual(['B1', 'A1']);
    });

    it('a Scene that went PRIVATE between pages is never served, nor replayed', async () => {
      const p1 = await page(guest(DEV.e, { limit: '1' }));
      expect(names(p1)).toEqual(['A4']);
      await setStock(VA2, SELLER_A, 0); // A4's only tag sells out: A4 goes PRIVATE
      const replay = await page(guest(DEV.e, { limit: '1', cursor: p1.next_cursor!.replace(/\.1\./, '.0.') }));
      expect(replay.items).toEqual([]);
      const p2 = await page(guest(DEV.e, { limit: '10', cursor: p1.next_cursor! }));
      expect(names(p2)).toEqual(['A3', 'A2', 'B2', 'B1', 'A1']);
      // A fresh session after restoration sees it again: eligibility lives in the gate, not the session.
      await setStock(VA2, SELLER_A, 5);
      expect(names(await page(guest(DEV.e, { limit: '1' })))).toEqual(['A4']);
    });

    it.each([
      ['garbage', () => 'not-a-cursor'],
      ['a changed secret', (c: string) => c.slice(0, -1) + (c.endsWith('A') ? 'B' : 'A')],
      ['an offset beyond what was served', (c: string) => c.replace(/\.2\./, '.9.')],
      ['an unknown session', (c: string) => c.replace(/^v1\.[0-9a-f-]{36}/, `v1.${crypto.randomUUID()}`)],
    ])('refuses %s as CURSOR_INVALID', async (_label, mutate) => {
      const p1 = await page(guest(DEV.f, { limit: '2' }));
      const r = await guest(DEV.f, { cursor: mutate(p1.next_cursor!) }).expect(400);
      expect(r.body.code).toBe('VALIDATION_FAILED');
      expect(reasonOf(r)).toBe('CURSOR_INVALID');
    });

    it("never continues another subject's session", async () => {
      const p1 = await page(guest(DEV.f, { limit: '2' }));
      expect(reasonOf(await guest(DEV.a, { cursor: p1.next_cursor! }).expect(400))).toBe('CURSOR_INVALID');
      // Signing in does not adopt the guest session either.
      expect(reasonOf(await signedIn({ cursor: p1.next_cursor! }).expect(400))).toBe('CURSOR_INVALID');
    });

    it('an expired session is CURSOR_EXPIRED', async () => {
      const p1 = await page(guest(DEV.f, { limit: '2' }));
      await admin.query(
        `UPDATE core.fyp_session SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
          WHERE id = $1`,
        [p1.feed_session_id],
      );
      expect(reasonOf(await guest(DEV.f, { cursor: p1.next_cursor! }).expect(400))).toBe('CURSOR_EXPIRED');
    });

    it("a session whose subject changed Market is CURSOR_EXPIRED", async () => {
      const p1 = await page(guest(DEV.b, { limit: '2' }));
      await admin.query(`UPDATE core.device SET market_id = $1 WHERE id = $2`, [M2, DEV.b]);
      try {
        expect(reasonOf(await guest(DEV.b, { cursor: p1.next_cursor! }).expect(400))).toBe('CURSOR_EXPIRED');
      } finally {
        await admin.query(`UPDATE core.device SET market_id = $1 WHERE id = $2`, [M, DEV.b]);
      }
    });
  });

  // ------------------------------------------------------------- versions

  describe('algorithm versions', () => {
    it('retiring a version ends its sessions (kill switch); new sessions take the active one', async () => {
      const p1 = await page(guest(DEV.c, { limit: '2' }));
      await addVersion('test-d25-kill', baselineConfig);
      await activate('test-d25-kill');
      expect(reasonOf(await guest(DEV.c, { cursor: p1.next_cursor! }).expect(400))).toBe('CURSOR_EXPIRED');
      expect((await page(guest(DEV.c, { limit: '2' }))).algorithm_version).toBe('test-d25-kill');
    });

    it('session max_items bounds the session', async () => {
      await addVersion('test-d25-max3', { ...baselineConfig, session: { ttl_seconds: 3600, max_items: 3 } });
      await activate('test-d25-max3');
      const p1 = await page(guest(DEV.c, { limit: '2' }));
      const p2 = await page(guest(DEV.c, { limit: '2', cursor: p1.next_cursor! }));
      expect(names(p2)).toEqual(['A2']);
      expect(p2.next_cursor).toBeNull();
    });

    it('the Seller-run cap reorders when a version configures it', async () => {
      await addVersion('test-d25-div1', { ...baselineConfig, diversity: { seller_adjacency_max: 1 } });
      await activate('test-d25-div1');
      const p1 = await page(guest(DEV.c, { limit: '3' }));
      expect(names(p1)).toEqual(['A4', 'B2', 'A3']);
      // Carried across the page boundary: A3 ended page 1, so B1 opens page 2.
      const p2 = await page(guest(DEV.c, { limit: '3', cursor: p1.next_cursor! }));
      expect(names(p2)).toEqual(['B1', 'A2', 'A1']);
    });

    it('a malformed configuration serves nothing (fail closed)', async () => {
      await addVersion('test-d25-bad', { ...baselineConfig, sources: { TRENDING: { budget: 10 } } });
      await activate('test-d25-bad');
      expect(await page(guest(DEV.c))).toEqual({ feed_session_id: null, algorithm_version: null, items: [], next_cursor: null });
    });

    it('production serves only a founder-approved version', async () => {
      process.env['NODE_ENV'] = 'production';
      resetNodeEnvForTests();
      expect(await page(guest(DEV.c))).toEqual({ feed_session_id: null, algorithm_version: null, items: [], next_cursor: null });
      await addVersion('test-d25-approved', baselineConfig, true);
      await activate('test-d25-approved');
      expect((await page(guest(DEV.c, { limit: '1' }))).algorithm_version).toBe('test-d25-approved');
    });

    it('a version is immutable and never deleted', async () => {
      await expect(
        admin.query(`UPDATE core.fyp_algorithm_version SET config = '{}' WHERE id = $1`, [BASELINE]),
      ).rejects.toMatchObject({ code: '23001' });
      await expect(admin.query(`DELETE FROM core.fyp_algorithm_version WHERE id = $1`, [BASELINE])).rejects.toMatchObject({
        code: '23001',
      });
    });
  });

  // ---------------------------------------------- WO-DISC-002A served units

  /**
   * The served-unit contract (WO-DISC-002A). `serve_id` proves DELIVERY: this Scene
   * revision, at this position, in this session, ranked by this version. It is not an
   * impression; a qualified impression is a later client observation (ADU-ANL-01 S331)
   * and nothing here creates one.
   */
  describe('the served-unit contract', () => {
    it('the server issues serve_id; a client-supplied one is ignored, never echoed, and no impression id is served', async () => {
      const forged = '5e5e5e5e-0000-4000-8000-000000000001';
      const p = await page(guest(DEV.a, { serve_id: forged, impression_id: forged }));
      expect(p.items.length).toBeGreaterThan(0);
      for (const u of p.items) {
        expect(u.serve_id).toMatch(/^[0-9a-f-]{36}$/);
        expect(u.serve_id).not.toBe(forged);
        expect(u).not.toHaveProperty('impression_id');
      }
      const rows = await admin.query<{ id: string }>(
        `SELECT id FROM core.fyp_impression WHERE session_id = $1`,
        [p.feed_session_id],
      );
      expect(rows.rows.map((r) => r.id).sort()).toEqual(p.items.map((u) => u.serve_id).sort());
    });

    it('each serve_id is bound to its session, Market, exact served revision, position and version', async () => {
      const p = await page(guest(DEV.b, { limit: '3' }));
      const rows = await admin.query<{
        id: string; market_id: string; revision_version: number; algorithm_version: string;
        public_ref: string; position: number;
      }>(
        `SELECT i.id, s.market_id, r.version AS revision_version, i.algorithm_version,
                sp.public_ref, i.position
           FROM core.fyp_impression i
           JOIN core.fyp_session s ON s.id = i.session_id
           JOIN core.scene_post_revision r ON r.id = i.revision_id
           JOIN core.scene_post sp ON sp.id = i.scene_post_id
          WHERE i.session_id = $1 ORDER BY i.position`,
        [p.feed_session_id],
      );
      expect(rows.rows).toEqual(
        p.items.map((u) => ({
          id: u.serve_id, market_id: M, revision_version: u.revision_version,
          algorithm_version: p.algorithm_version, public_ref: u.public_ref, position: u.position,
        })),
      );
    });

    it('a retried page keeps its serve_ids; a new session issues new ones for the same Scenes', async () => {
      const p1 = await page(guest(DEV.c, { limit: '2' }));
      const p2 = await page(guest(DEV.c, { limit: '2', cursor: p1.next_cursor! }));
      const again = await page(guest(DEV.c, { limit: '2', cursor: p1.next_cursor! }));
      expect(again.items.map((u) => u.serve_id)).toEqual(p2.items.map((u) => u.serve_id));
      const fresh = await page(guest(DEV.c, { limit: '2' }));
      expect(fresh.feed_session_id).not.toBe(p1.feed_session_id);
      expect(fresh.items.map((u) => u.public_ref)).toEqual(p1.items.map((u) => u.public_ref));
      const earlier = new Set(p1.items.map((u) => u.serve_id));
      expect(fresh.items.every((u) => !earlier.has(u.serve_id))).toBe(true);
    });

    it('serving writes no analytics event: a returned unit is not an impression', async () => {
      const p = await page(guest(DEV.d, { limit: '2' }));
      expect(p.items.length).toBe(2);
      const events = await admin.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM analytics.event
          WHERE device_id = $1 OR payload::text LIKE '%' || $2 || '%'`,
        [DEV.d, p.feed_session_id],
      );
      expect(events.rows[0]!.n).toBe(0);
    });
  });

  // ------------------------------------------------------------- the database

  describe('database guarantees', () => {
    it('the API role cannot rewrite a session, an impression or a version', async () => {
      for (const q of [
        `UPDATE core.fyp_session SET seed = 1`,
        `UPDATE core.fyp_session SET market_id = '${M2}'`,
        `UPDATE core.fyp_impression SET position = 99`,
        `DELETE FROM core.fyp_impression`,
        `DELETE FROM core.fyp_session`,
        `UPDATE core.fyp_algorithm_version SET production_approved = true`,
      ]) {
        await expect(appRole.query(q)).rejects.toMatchObject({ code: '42501' });
      }
    });

    it('one Scene cannot be served twice in one session', async () => {
      const p = await page(guest(DEV.a, { limit: '1' }));
      await expect(
        admin.query(
          `INSERT INTO core.fyp_impression (session_id, scene_post_id, revision_id, algorithm_version, position, candidate_source)
           SELECT session_id, scene_post_id, revision_id, algorithm_version, 2, 'RECENT'
             FROM core.fyp_impression WHERE id = $1`,
          [p.items[0]!.serve_id],
        ),
      ).rejects.toMatchObject({ code: '23505' });
    });

    it('device.purge_unbound, as adulis_jobs, takes a stale guest device with its sessions and served units', async () => {
      const p = await page(guest(DEV.purge, { limit: '2' }));
      // Older than the Market's media_retention (90 days in this fixture).
      await admin.query(`UPDATE core.device SET last_seen_at = now() - interval '200 days' WHERE id = $1`, [DEV.purge]);
      const h = createJobHarness(new Date());
      try {
        for (let i = 0; i < 5; i++) {
          await devicePurgeUnbound.run(h.ctx);
          if (!(await admin.query(`SELECT 1 FROM core.device WHERE id = $1`, [DEV.purge])).rowCount) break;
        }
      } finally {
        await h.close();
      }
      expect((await admin.query(`SELECT 1 FROM core.device WHERE id = $1`, [DEV.purge])).rowCount).toBe(0);
      const left = await admin.query(
        `SELECT (SELECT count(*) FROM core.fyp_session WHERE id = $1)::int AS s,
                (SELECT count(*) FROM core.fyp_impression WHERE session_id = $1)::int AS i`,
        [p.feed_session_id],
      );
      expect(left.rows[0]).toEqual({ s: 0, i: 0 });
    });

    it("deleting an Account purges its For You sessions and served units", async () => {
      const p = await page(
        server()
          .get('/v1/fyp')
          .query({ limit: '2' })
          .set('X-Adulis-Client', 'android/1.0.0')
          .set('X-Adulis-Device', DEV.buyer)
          .set('Authorization', `Bearer ${sessionToken(S.leaver)}`),
      );
      expect(p.items).toHaveLength(2);
      await admin.query(
        `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash, expires_at, consumed_at)
         VALUES ($1, 'ACCOUNT_DELETION', '+251911252005', decode('00','hex'), now() + interval '1 hour', now())`,
        [DELETION_TICKET],
      );
      // The production entry point, as the API role calls it.
      await appRole.query(`SELECT core.fn_delete_account($1, $2, sha256('+251911252005'::bytea))`, [LEAVER, DELETION_TICKET]);
      const left = await admin.query(
        `SELECT (SELECT count(*) FROM core.fyp_session WHERE account_id = $1)::int AS s,
                (SELECT count(*) FROM core.fyp_impression WHERE session_id = $2)::int AS i`,
        [LEAVER, p.feed_session_id],
      );
      expect(left.rows[0]).toEqual({ s: 0, i: 0 });
    });

    it('more concurrent session starts than the pool has connections all complete (no pool starvation)', async () => {
      const burst = await Promise.all(Array.from({ length: 14 }, () => guest(DEV.a, { limit: '1' })));
      expect(burst.map((r) => r.status)).toEqual(Array(14).fill(200));
    }, 20_000);

    it('a device is one subject however the client cases its id', async () => {
      const upper = DEV.d.toUpperCase();
      const p1 = await page(guest(upper, { limit: '2' }));
      const p2 = await page(guest(upper, { limit: '2', cursor: p1.next_cursor! }));
      expect(p2.items.map((u) => u.position)).toEqual([3, 4]);
      const owner = await admin.query<{ device_id: string }>(`SELECT device_id FROM core.fyp_session WHERE id = $1`, [
        p1.feed_session_id,
      ]);
      expect(owner.rows[0]!.device_id).toBe(DEV.d);
      const buckets = await admin.query(`SELECT 1 FROM core.rate_limit_bucket WHERE subject_id = $1`, [upper]);
      expect(buckets.rowCount).toBe(0);
    });

    it('newly served pages are rate-limited per subject; a replay writes nothing and is not limited', async () => {
      const p1 = await page(guest(DEV.e, { limit: '2' }));
      await admin.query(
        `INSERT INTO core.rate_limit_bucket (subject_kind, subject_id, bucket_key, window_start, count)
         VALUES ('DEVICE', $1, 'fyp.page', to_timestamp(floor(extract(epoch FROM now()) / 3600) * 3600), 600)
         ON CONFLICT (subject_kind, subject_id, bucket_key, window_start) DO UPDATE SET count = 600`,
        [DEV.e],
      );
      expect((await guest(DEV.e, { limit: '2', cursor: p1.next_cursor! }).expect(429)).body.code).toBe('RATE_LIMITED');
      const replay = await page(guest(DEV.e, { limit: '2', cursor: p1.next_cursor!.replace(/\.2\./, '.0.') }));
      expect(replay.items.map((u) => u.serve_id)).toEqual(p1.items.map((u) => u.serve_id));
    });

    it('session starts are rate-limited per subject', async () => {
      await admin.query(
        `INSERT INTO core.rate_limit_bucket (subject_kind, subject_id, bucket_key, window_start, count)
         VALUES ('DEVICE', $1, 'fyp.session', to_timestamp(floor(extract(epoch FROM now()) / 3600) * 3600), 120)
         ON CONFLICT (subject_kind, subject_id, bucket_key, window_start) DO UPDATE SET count = 120`,
        [DEV.m2],
      );
      const r = await guest(DEV.m2).expect(429);
      expect(r.body.code).toBe('RATE_LIMITED');
    });

    // LAST: it republishes A3, which later ordering assertions do not expect.
    it('a Scene revised since it was served is not replayed on its old revision, nor served again', async () => {
      const p1 = await page(guest(DEV.f, { limit: '2' }));
      expect(names(p1)).toEqual(['A4', 'A3']);
      const a3 = sceneIds.get('A3')!;
      const view = await asOwner(SELLER_A, S.ownerA, server().get(`/v1/seller/scene-posts/${a3}`)).expect(200);
      const draft = await asOwner(SELLER_A, S.ownerA, server().patch(`/v1/seller/scene-posts/${a3}/draft`))
        .set('If-Match', `"${view.body.edit_version}"`)
        .send({ caption: 'D25 A3 revised' })
        .expect(200);
      await asOwner(SELLER_A, S.ownerA, server().post(`/v1/seller/scene-posts/${a3}/publish`))
        .set('Idempotency-Key', idem())
        .set('If-Match', `"${draft.body.edit_version}"`)
        .expect(200);
      const replay = await page(guest(DEV.f, { limit: '2', cursor: p1.next_cursor!.replace(/\.2\./, '.0.') }));
      expect(names(replay)).toEqual(['A4']);
      const p2 = await page(guest(DEV.f, { limit: '10', cursor: p1.next_cursor! }));
      expect(names(p2)).not.toContain('A3');
      // A new session serves the new revision.
      const fresh = await page(guest(DEV.f));
      const unit = fresh.items.find((u) => refs.get(u.public_ref) === 'A3')!;
      expect(unit.caption).toBe('D25 A3 revised');
      expect(unit.revision_version).toBe(2);
    });
  });
});
