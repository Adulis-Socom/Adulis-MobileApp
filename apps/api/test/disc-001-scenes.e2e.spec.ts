import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool, type PoolClient } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import {
  FakeMediaStorageAdapter,
  MEDIA_STORAGE_ADAPTER,
} from '../src/modules/catalogue/media-storage.adapter';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * WO-DISC-001 -- the Scene domain foundation (ADU-SCN-01 v3.2).
 *
 * Creation and authorization, same-Seller tags, initial publication gates,
 * availability-driven PUBLIC/PRIVATE transitions and automatic restoration,
 * Product retirement, concurrency, public privacy, the Seller notices and the
 * revision model. Availability always moves the way production moves it:
 * through core.stock_event and Product visibility, never by writing Scene rows.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const APP_ROLE = process.env['DATABASE_URL'];

const id = (n: number) => `d15c0000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const M = id(1);
const OWNER = id(2);
const CAMPAIGN = id(3);
const INVENTORY = id(4);
const ANALYST = id(5);
const STRANGER = id(6);
const OWNER_B = id(7);
const DEVICE = id(8);
const SELLER = id(9);
const SELLER_B = id(10);
const S = {
  owner: id(20),
  campaign: id(21),
  inventory: id(22),
  analyst: id(23),
  stranger: id(24),
  ownerB: id(25),
  ownerMobile: id(26),
};
const P1 = id(40);
const P2 = id(41);
const P3 = id(42);
const P_DRAFT = id(43);
const P_B = id(44);
const P_BARE = id(45); // published, no Variant: deletable unless something references it
const P_RACE = id(46); // tagged by one test only, after its stock change began
const V1 = id(50);
const V2 = id(51);
const V3 = id(52);
const V_DRAFT = id(53);
const V_B = id(54);
const V_RACE = id(55);

const AVAILABILITY_REASONS = ['ALL_TAGGED_PRODUCTS_UNAVAILABLE', 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK'];

const VARIANTS = [
  [V1, SELLER], [V2, SELLER], [V3, SELLER], [V_DRAFT, SELLER], [V_B, SELLER_B], [V_RACE, SELLER],
] as const;

const storage = new FakeMediaStorageAdapter();

@Module({ imports: [AppModule] })
class DiscAppModule {}

interface SceneView {
  id: string;
  public_ref: string;
  publication_state: string;
  visibility: string;
  visibility_reason: string | null;
  restores_automatically: boolean;
  effective_public: boolean;
  edit_version: number;
  lifecycle_version: number;
  published_revision: { version: number; caption: string | null; products: Array<{ product_id: string; available: boolean }> } | null;
  working_revision: { version: number; caption: string | null; products: Array<{ product_id: string; position: number }> } | null;
}

describe('WO-DISC-001 -- Scene domain foundation', () => {
  let app: INestApplication;
  let admin: Pool;
  let appRole: Pool;

  const cookie = (session: string) => `__Host-adulis_session=${sessionToken(session)}`;
  const idem = () => crypto.randomUUID();
  const asSeller = (seller: string, session: string, r: request.Test) =>
    r.set('Cookie', cookie(session)).set('Origin', CONSOLE_ORIGIN).set('X-Adulis-Seller', seller);
  const server = () => request(app.getHttpServer());

  const create = (body: object, session = S.owner, seller = SELLER) =>
    asSeller(seller, session, server().post('/v1/seller/scene-posts').set('Idempotency-Key', idem())).send(body);
  const patch = (sceneId: string, etag: number | string | null, body: object, session = S.owner) => {
    const r = asSeller(SELLER, session, server().patch(`/v1/seller/scene-posts/${sceneId}/draft`));
    return (etag === null ? r : r.set('If-Match', `"${etag}"`)).send(body);
  };
  const publish = (sceneId: string, etag: number | null, session = S.owner) => {
    const r = asSeller(SELLER, session, server().post(`/v1/seller/scene-posts/${sceneId}/publish`)).set(
      'Idempotency-Key',
      idem(),
    );
    return etag === null ? r : r.set('If-Match', `"${etag}"`);
  };
  const sellerGet = (sceneId: string, session = S.owner, seller = SELLER) =>
    asSeller(seller, session, server().get(`/v1/seller/scene-posts/${sceneId}`));
  const publicGet = (ref: string) => server().get(`/v1/scene-posts/${ref}`);

  /** Stock moves only through core.stock_event (autocommit: the COMMIT re-evaluates). */
  const stock = (variant: string, seller: string, delta: number, db: Pool | PoolClient = admin) =>
    db.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [variant, seller, delta, delta >= 0 ? 'RESTOCK' : 'SELLER_SET'],
    );
  const stockOf = async (variant: string) =>
    (await admin.query<{ n: number }>(`SELECT stock_count AS n FROM core.product_variant WHERE id = $1`, [variant]))
      .rows[0]!.n;
  /** Set a Variant's stock to an exact value through one event. */
  const setStock = async (variant: string, seller: string, to: number, db: Pool | PoolClient = admin) =>
    stock(variant, seller, to - (await stockOf(variant)), db);

  const row = async (sceneId: string) =>
    (
      await admin.query<{ publication_state: string; visibility: string; visibility_reason: string | null; lifecycle_version: number }>(
        `SELECT publication_state, visibility, visibility_reason, lifecycle_version
           FROM core.scene_post WHERE id = $1`,
        [sceneId],
      )
    ).rows[0]!;
  const notices = async (sceneId: string) =>
    (
      await admin.query<{ template_key: string; channel: string; recipient_account_id: string }>(
        `SELECT template_key, channel, recipient_account_id FROM core.notification
          WHERE slots ->> 'scene_post_id' = $1 ORDER BY scheduled_for, template_key`,
        [sceneId],
      )
    ).rows;
  const transitions = async (sceneId: string) =>
    (
      await admin.query<{ to_visibility: string; reason: string | null; actor_account_id: string | null }>(
        `SELECT to_visibility, reason, actor_account_id FROM core.scene_post_transition
          WHERE scene_post_id = $1 ORDER BY lifecycle_version`,
        [sceneId],
      )
    ).rows;

  /** The invariant of WO-DISC-001 S18, over every Scene of this suite. */
  const publicWithZeroAvailable = async () =>
    (
      await admin.query<{ id: string }>(
        `SELECT sp.id FROM core.scene_post sp
          WHERE sp.seller_id IN ($1, $2)
            AND sp.publication_state = 'PUBLISHED' AND sp.visibility = 'PUBLIC'
            AND NOT EXISTS (SELECT 1 FROM core.scene_post_product t
                              JOIN core.v_scene_product_availability a ON a.product_id = t.product_id
                             WHERE t.revision_id = sp.current_published_revision_id AND a.available)`,
        [SELLER, SELLER_B],
      )
    ).rows;

  const backendPid = async (c: PoolClient) =>
    (await c.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
  /** Wait until that backend is blocked on a lock: proves the interleaving happened. */
  const blockedOnLock = async (pid: number) => {
    for (let i = 0; i < 100; i += 1) {
      const r = await admin.query(
        `SELECT 1 FROM pg_stat_activity WHERE pid = $1 AND wait_event_type = 'Lock'`,
        [pid],
      );
      if (r.rowCount) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`backend ${pid} never blocked on a lock`);
  };
  /** Never return a connection with an open transaction to the pool. */
  const done = async (...clients: PoolClient[]) => {
    for (const c of clients) {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  };

  /** Attach a real (fake-landed) image to the Scene's working revision. */
  const attachImage = async (sceneId: string, etag: number) => {
    const up = await asSeller(SELLER, S.owner, server().post(`/v1/seller/scene-posts/${sceneId}/image-uploads`))
      .set('Idempotency-Key', idem())
      .expect(200);
    const keys = up.body.uploads as Record<'thumb' | 'card' | 'full', { key: string }>;
    storage.put(keys.thumb.key, { bytes: 30_000, contentType: 'image/webp' });
    storage.put(keys.card.key, { bytes: 150_000, contentType: 'image/webp' });
    storage.put(keys.full.key, { bytes: 700_000, contentType: 'image/webp' });
    const r = await patch(sceneId, etag, {
      image: { thumb_key: keys.thumb.key, card_key: keys.card.key, full_key: keys.full.key },
    }).expect(200);
    return r.body as SceneView;
  };

  /** A ready draft: caption, image, the given tags. Returns the current view. */
  const readyDraft = async (productIds: string[], caption = 'Market morning') => {
    const created = await create({ caption, product_ids: productIds }).expect(201);
    return attachImage(created.body.id, created.body.edit_version);
  };
  const readyPublished = async (productIds: string[]) => {
    const draft = await readyDraft(productIds);
    const r = await publish(draft.id, draft.edit_version).expect(200);
    return r.body as SceneView;
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 4 });
    appRole = new Pool({ connectionString: APP_ROLE, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency, display_timezone,
                                default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'D15','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE')`,
      [M],
    );
    // Session validation reads the Market's timing (Console idle timeout).
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
        ($1,'+251911151001',$7,'ACTIVE'), ($2,'+251911151002',$7,'ACTIVE'),
        ($3,'+251911151003',$7,'ACTIVE'), ($4,'+251911151004',$7,'ACTIVE'),
        ($5,'+251911151005',$7,'ACTIVE'), ($6,'+251911151006',$7,'ACTIVE')`,
      [OWNER, CAMPAIGN, INVENTORY, ANALYST, STRANGER, OWNER_B, M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status)
       VALUES ($1,$3,$4,'INDIVIDUAL','D15 Store','d15-store','ACTIVE'),
              ($2,$3,$5,'INDIVIDUAL','D15 Other','d15-other','ACTIVE')`,
      [SELLER, SELLER_B, M, OWNER, OWNER_B],
    );
    await admin.query(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role) VALUES
        (gen_random_uuid(), $1, $2, 'CAMPAIGN_MANAGER'),
        (gen_random_uuid(), $1, $3, 'INVENTORY'),
        (gen_random_uuid(), $1, $4, 'ANALYST')`,
      [SELLER, CAMPAIGN, INVENTORY, ANALYST],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, visibility, base_price_minor,
                                 base_price_currency, published_at) VALUES
        ($1,$6,$8,'Basket','PUBLISHED',120000,'ETB',now()),
        ($2,$6,$8,'Scarf','PUBLISHED',80000,'ETB',now()),
        ($3,$6,$8,'Jebena','PUBLISHED',60000,'ETB',now()),
        ($4,$6,$8,'Unreleased','DRAFT',10000,'ETB',NULL),
        ($5,$7,$8,'Other seller item','PUBLISHED',50000,'ETB',now()),
        ($9,$6,$8,'Sketch','PUBLISHED',30000,'ETB',now()),
        ($10,$6,$8,'Lantern','PUBLISHED',40000,'ETB',now())`,
      [P1, P2, P3, P_DRAFT, P_B, SELLER, SELLER_B, M, P_BARE, P_RACE],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor, price_currency, variant_key)
       VALUES ($1,$6,$11,120000,'ETB','one'), ($2,$7,$11,80000,'ETB','one'),
              ($3,$8,$11,60000,'ETB','one'), ($4,$9,$11,10000,'ETB','one'),
              ($5,$10,$12,50000,'ETB','one'), ($13,$14,$11,40000,'ETB','one')`,
      [V1, V2, V3, V_DRAFT, V_B, P1, P2, P3, P_DRAFT, P_B, SELLER, SELLER_B, V_RACE, P_RACE],
    );
    for (const [v, s] of VARIANTS) {
      await stock(v, s, 5);
    }
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$8,'CONSOLE',$15, now()+interval '12 hours'),
        ($2,$9,'CONSOLE',$15, now()+interval '12 hours'),
        ($3,$10,'CONSOLE',$15, now()+interval '12 hours'),
        ($4,$11,'CONSOLE',$15, now()+interval '12 hours'),
        ($5,$12,'CONSOLE',$15, now()+interval '12 hours'),
        ($6,$13,'CONSOLE',$15, now()+interval '12 hours'),
        ($7,$14,'MOBILE',$15, now()+interval '12 hours')`,
      [S.owner, S.campaign, S.inventory, S.analyst, S.stranger, S.ownerB, S.ownerMobile,
       OWNER, CAMPAIGN, INVENTORY, ANALYST, STRANGER, OWNER_B, OWNER, DEVICE],
    );
    await armFixtureSessions(admin, Object.values(S));

    const moduleRef = await Test.createTestingModule({ imports: [DiscAppModule] })
      .overrideProvider(MEDIA_STORAGE_ADAPTER)
      .useValue(storage)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterEach(async () => {
    // The WO S18 invariant, read BEFORE anything is reset: whatever the test did.
    expect(await publicWithZeroAvailable()).toEqual([]);
    // Every test leaves stock where it found it, so the next starts from a known catalogue.
    for (const [v, s] of VARIANTS) {
      await setStock(v, s, 5);
    }
    await admin.query(
      `UPDATE core.product SET visibility = 'PUBLISHED', unpublished_reason = NULL
        WHERE id IN ($1, $2, $3, $4)`,
      [P1, P2, P3, P_B],
    );
    await admin.query(`UPDATE core.seller SET status = 'ACTIVE' WHERE id IN ($1, $2)`, [SELLER, SELLER_B]);
  });

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER}','${OWNER_B}')`,
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${OWNER}','${CAMPAIGN}','${INVENTORY}','${ANALYST}','${STRANGER}','${OWNER_B}')`,
      `DELETE FROM core.scene_post_transition WHERE seller_id IN ('${SELLER}','${SELLER_B}')`,
      `DELETE FROM core.scene_post_product WHERE seller_id IN ('${SELLER}','${SELLER_B}')`,
      // Replica mode lifts the root <-> revision FKs, so the rows go in any order.
      `DELETE FROM core.scene_post_revision WHERE seller_id IN ('${SELLER}','${SELLER_B}')`,
      `DELETE FROM core.scene_post WHERE seller_id IN ('${SELLER}','${SELLER_B}')`,
      `DELETE FROM core.stock_event WHERE seller_id IN ('${SELLER}','${SELLER_B}')`,
      `DELETE FROM core.product_variant WHERE seller_id IN ('${SELLER}','${SELLER_B}')`,
      `DELETE FROM core.product WHERE seller_id IN ('${SELLER}','${SELLER_B}')`,
      `DELETE FROM core.session WHERE id IN (${Object.values(S).map((s) => `'${s}'`).join(',')})`,
      `DELETE FROM core.seller_team_member WHERE seller_id = '${SELLER}'`,
      // Rows the seller INSERT's own triggers made (orphan-sweep, D-134).
      `DELETE FROM core.seller_level_state WHERE seller_id IN ('${SELLER}','${SELLER_B}')`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN ('${SELLER}','${SELLER_B}')`,
      `DELETE FROM core.seller WHERE id IN ('${SELLER}','${SELLER_B}')`,
      `DELETE FROM core.device WHERE id = '${DEVICE}'`,
      `DELETE FROM core.account WHERE id IN ('${OWNER}','${CAMPAIGN}','${INVENTORY}','${ANALYST}','${STRANGER}','${OWNER_B}')`,
      `DELETE FROM core.timing_config WHERE market_id = '${M}'`,
      `DELETE FROM core.market WHERE id = '${M}'`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await appRole.end();
    await admin.end();
  });

  // ---------------------------------------------------------------- creation

  describe('creation and authorization', () => {
    it('the owner creates a private DRAFT with ordered same-Seller tags', async () => {
      const r = await create({ caption: 'Woven things', product_ids: [P2, P1] }).expect(201);
      const view = r.body as SceneView;
      expect(view.publication_state).toBe('DRAFT');
      expect(view.visibility).toBe('PRIVATE');
      expect(view.visibility_reason).toBeNull();
      expect(view.effective_public).toBe(false);
      expect(view.public_ref).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(r.headers['etag']).toBe('"1"');
      expect(view.working_revision?.products.map((p) => p.product_id)).toEqual([P2, P1]);
      expect(view.published_revision).toBeNull();
    });

    it('a CAMPAIGN_MANAGER may author Scenes (ADU-SCN-01 S13)', async () => {
      await create({ caption: 'Campaign' }, S.campaign).expect(201);
    });

    it.each([
      ['an INVENTORY member (no Scene capability)', S.inventory, 403],
      ['an ANALYST member', S.analyst, 403],
      ['an Account with no relationship to the Seller', S.stranger, 404],
      ['the owner on a Seller Companion (MOBILE) session', S.ownerMobile, 403],
    ])('%s cannot create one', async (_who, session, status) => {
      const before = await admin.query(`SELECT count(*)::int AS n FROM core.scene_post WHERE seller_id = $1`, [SELLER]);
      await create({ caption: 'x' }, session).expect(status);
      const after = await admin.query(`SELECT count(*)::int AS n FROM core.scene_post WHERE seller_id = $1`, [SELLER]);
      expect(after.rows[0].n).toBe(before.rows[0].n);
    });
  });

  // -------------------------------------------------------------------- tags

  describe('Product tags', () => {
    it.each([
      ['another Seller’s Product', P_B],
      ['a Product that does not exist', id(999)],
    ])('%s is refused with a bare 404 and nothing is created', async (_what, product) => {
      const before = await admin.query(`SELECT count(*)::int AS n FROM core.scene_post WHERE seller_id = $1`, [SELLER]);
      const r = await create({ caption: 'x', product_ids: [P1, product] }).expect(404);
      expect(r.body.code).toBe('NOT_FOUND');
      expect(r.body.items).toBeUndefined();
      const after = await admin.query(`SELECT count(*)::int AS n FROM core.scene_post WHERE seller_id = $1`, [SELLER]);
      expect(after.rows[0].n).toBe(before.rows[0].n);
    });

    it('a duplicate tag is refused', async () => {
      const r = await create({ caption: 'x', product_ids: [P1, P1] }).expect(400);
      expect(r.body.code).toBe('VALIDATION_FAILED');
    });

    it('the database itself refuses a cross-Seller tag row (composite FK)', async () => {
      const draft = await create({ caption: 'x' }).expect(201);
      const revision = draft.body.working_revision.id as string;
      await expect(
        admin.query(
          `INSERT INTO core.scene_post_product (revision_id, seller_id, product_id, position)
           VALUES ($1, $2, $3, 1)`,
          [revision, SELLER, P_B],
        ),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });

  // ------------------------------------------------------ initial publication

  describe('initial publication', () => {
    const blockedItems = (body: { code: string; items?: Array<{ slots: { item: string } }> }) => {
      expect(body.code).toBe('PUBLICATION_BLOCKED');
      return (body.items ?? []).map((i) => i.slots.item).sort();
    };

    it('zero tags: PRODUCT_TAG_REQUIRED, and the Scene stays a private DRAFT', async () => {
      const draft = await readyDraft([]);
      const r = await publish(draft.id, draft.edit_version).expect(409);
      expect(blockedItems(r.body)).toEqual(['PRODUCT_TAG_REQUIRED']);
      expect(await row(draft.id)).toMatchObject({ publication_state: 'DRAFT', visibility: 'PRIVATE' });
    });

    it('every tag unavailable: NO_AVAILABLE_TAGGED_PRODUCT, never a silent private publish', async () => {
      await setStock(V1, SELLER, 0);
      await setStock(V2, SELLER, 0);
      const draft = await readyDraft([P1, P2]);
      const r = await publish(draft.id, draft.edit_version).expect(409);
      expect(blockedItems(r.body)).toEqual(['NO_AVAILABLE_TAGGED_PRODUCT']);
      expect(await row(draft.id)).toMatchObject({ publication_state: 'DRAFT', visibility: 'PRIVATE' });
    });

    it('reports every missing gate at once (caption, media, eligible tag)', async () => {
      const draft = await create({ caption: '   ', product_ids: [P_DRAFT, P1] }).expect(201);
      const r = await publish(draft.body.id, draft.body.edit_version).expect(409);
      expect(blockedItems(r.body)).toEqual(['CAPTION_REQUIRED', 'MEDIA_MISSING', 'PRODUCT_NOT_ELIGIBLE']);
      const notEligible = r.body.items.find((i: { slots: { item: string } }) => i.slots.item === 'PRODUCT_NOT_ELIGIBLE');
      expect(notEligible.slots.product_id).toBe(P_DRAFT);
    });

    it('a Seller that is not public commerce cannot publish (a Scene never makes a Seller public)', async () => {
      const draft = await readyDraft([P1]);
      await admin.query(`UPDATE core.seller SET status = 'CLOSING' WHERE id = $1`, [SELLER]);
      const r = await publish(draft.id, draft.edit_version).expect(409);
      expect(blockedItems(r.body)).toEqual(['SELLER_NOT_PUBLIC_ELIGIBLE']);
    });

    it('one available tag publishes PUBLISHED + PUBLIC, with its transition fact', async () => {
      await setStock(V2, SELLER, 0);
      const draft = await readyDraft([P1, P2]);
      const r = await publish(draft.id, draft.edit_version).expect(200);
      const view = r.body as SceneView;
      expect(view).toMatchObject({ publication_state: 'PUBLISHED', visibility: 'PUBLIC', effective_public: true });
      expect(view.working_revision).toBeNull();
      expect(view.published_revision?.products.map((p) => p.available)).toEqual([true, false]);
      expect(view.edit_version).toBe(draft.edit_version + 1);
      expect(r.headers['etag']).toBe(`"${view.edit_version}"`);
      expect(await transitions(draft.id)).toEqual([
        { to_visibility: 'PUBLIC', reason: null, actor_account_id: OWNER },
      ]);
      const pub = await publicGet(view.public_ref).expect(200);
      expect(pub.body.products.map((p: { slug: string; available: boolean }) => p.available)).toEqual([true, false]);
    });

    it('If-Match is required, and a stale one is a 409 STALE_REVISION', async () => {
      const draft = await readyDraft([P1]);
      await publish(draft.id, null).expect(400);
      const r = await publish(draft.id, draft.edit_version - 1).expect(409);
      expect(r.body.code).toBe('VALIDATION_FAILED');
      expect(r.body.slots).toMatchObject({ reason: 'STALE_REVISION', current_version: draft.edit_version });
      const edit = await patch(draft.id, draft.edit_version - 1, { caption: 'late' }).expect(409);
      expect(edit.body.slots.reason).toBe('STALE_REVISION');
    });
  });

  // ------------------------------------------------- availability transitions

  describe('availability transitions', () => {
    it('losing one of several tags keeps it PUBLIC; losing the last makes it PRIVATE but PUBLISHED', async () => {
      const scene = await readyPublished([P1, P2]);

      await setStock(V1, SELLER, 0);
      expect(await row(scene.id)).toMatchObject({ publication_state: 'PUBLISHED', visibility: 'PUBLIC' });
      const partial = await publicGet(scene.public_ref).expect(200);
      expect(partial.body.products.map((p: { available: boolean }) => p.available)).toEqual([false, true]);

      await setStock(V2, SELLER, 0);
      expect(await row(scene.id)).toMatchObject({
        publication_state: 'PUBLISHED',
        visibility: 'PRIVATE',
        visibility_reason: 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK',
      });
      await publicGet(scene.public_ref).expect(404);

      // The Seller still manages it, with the badge, the reason and the restoration condition.
      const mine = (await sellerGet(scene.id).expect(200)).body as SceneView;
      expect(mine).toMatchObject({
        publication_state: 'PUBLISHED',
        visibility: 'PRIVATE',
        visibility_reason: 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK',
        restores_automatically: true,
        effective_public: false,
      });

      // Exactly one in-app advisory notice to the owner, and one system transition.
      expect(await notices(scene.id)).toEqual([
        { template_key: 'SCENE_BECAME_PRIVATE', channel: 'IN_APP', recipient_account_id: OWNER },
      ]);
      const history = await transitions(scene.id);
      expect(history[history.length - 1]).toEqual({
        to_visibility: 'PRIVATE',
        reason: 'ALL_TAGGED_PRODUCTS_OUT_OF_STOCK',
        actor_account_id: null,
      });
    });

    it('re-evaluation is idempotent: repeats and no-op stock events write nothing', async () => {
      const scene = await readyPublished([P1]);
      await setStock(V1, SELLER, 0);
      const before = await row(scene.id);
      await stock(V1, SELLER, 0); // a delta-0 event (RECONCILIATION-shaped)
      await admin.query(`SELECT core.fn_scene_post_reevaluate_products($1::uuid[])`, [[P1]]);
      await admin.query(`SELECT core.fn_scene_post_reevaluate($1)`, [scene.id]);
      expect(await row(scene.id)).toEqual(before);
      expect((await notices(scene.id)).length).toBe(1);
    });

    it('restocking restores PUBLIC automatically, with one SCENE_BECAME_PUBLIC notice', async () => {
      const scene = await readyPublished([P1, P2]);
      await setStock(V1, SELLER, 0);
      await setStock(V2, SELLER, 0);
      expect((await row(scene.id)).visibility).toBe('PRIVATE');

      await setStock(V2, SELLER, 3);
      expect(await row(scene.id)).toMatchObject({ visibility: 'PUBLIC', visibility_reason: null });
      await publicGet(scene.public_ref).expect(200);
      expect((await notices(scene.id)).map((n) => n.template_key)).toEqual([
        'SCENE_BECAME_PRIVATE',
        'SCENE_BECAME_PUBLIC',
      ]);
    });

    it('restoration waits for every gate: a suspended Seller stays PRIVATE until the suspension lifts', async () => {
      const scene = await readyPublished([P1]);
      await admin.query(`UPDATE core.seller SET status = 'SAFETY_SUSPENDED' WHERE id = $1`, [SELLER]);
      // Suspension alone mutates no Scene row (S41): the read gate denies every Buyer read.
      await publicGet(scene.public_ref).expect(404);
      expect((await sellerGet(scene.id).expect(200)).body.effective_public).toBe(false);
      await setStock(V1, SELLER, 0);
      expect((await row(scene.id)).visibility).toBe('PRIVATE');
      // Restock alone cannot restore while the Seller gate fails (S41, SCN-INV-08).
      await setStock(V1, SELLER, 4);
      expect((await row(scene.id)).visibility).toBe('PRIVATE');
      expect((await notices(scene.id)).map((n) => n.template_key)).toEqual(['SCENE_BECAME_PRIVATE']);
      // The gate clearing is itself a re-evaluation: the Scene returns, with its notice.
      await admin.query(`UPDATE core.seller SET status = 'ACTIVE' WHERE id = $1`, [SELLER]);
      expect(await row(scene.id)).toMatchObject({ visibility: 'PUBLIC', visibility_reason: null });
      expect((await notices(scene.id)).map((n) => n.template_key)).toEqual([
        'SCENE_BECAME_PRIVATE',
        'SCENE_BECAME_PUBLIC',
      ]);
      await publicGet(scene.public_ref).expect(200);
    });

    it('the private reason follows its cause while the Scene stays PRIVATE', async () => {
      const scene = await readyPublished([P1, P3]);
      await setStock(V1, SELLER, 0);
      await setStock(V3, SELLER, 0);
      expect((await row(scene.id)).visibility_reason).toBe('ALL_TAGGED_PRODUCTS_OUT_OF_STOCK');
      await admin.query(
        `UPDATE core.product SET visibility = 'UNPUBLISHED', unpublished_reason = 'SELLER' WHERE id = $1`,
        [P1],
      );
      expect(await row(scene.id)).toMatchObject({
        visibility: 'PRIVATE',
        visibility_reason: 'ALL_TAGGED_PRODUCTS_UNAVAILABLE',
      });
      expect((await transitions(scene.id)).filter((t) => t.to_visibility === 'PRIVATE')).toHaveLength(1);
      expect((await notices(scene.id)).length).toBe(1);
    });

    it('an ARCHIVED Scene is never reopened by stock', async () => {
      const scene = await readyPublished([P1]);
      // No archive command yet: set as an operator would.
      await admin.query(
        `UPDATE core.scene_post SET publication_state = 'ARCHIVED', visibility = 'PRIVATE',
                lifecycle_version = lifecycle_version + 1 WHERE id = $1`,
        [scene.id],
      );
      await setStock(V1, SELLER, 0);
      await setStock(V1, SELLER, 6);
      expect(await row(scene.id)).toMatchObject({ publication_state: 'ARCHIVED', visibility: 'PRIVATE' });
      await publicGet(scene.public_ref).expect(404);
    });
  });

  // ------------------------------------------------------- Product retirement

  describe('Product retirement', () => {
    it('unpublishing the last available tagged Product makes the Scene PRIVATE; republishing restores it', async () => {
      const scene = await readyPublished([P1, P3]);
      await setStock(V3, SELLER, 0);
      await admin.query(
        `UPDATE core.product SET visibility = 'UNPUBLISHED', unpublished_reason = 'SELLER' WHERE id = $1`,
        [P1],
      );
      expect(await row(scene.id)).toMatchObject({
        visibility: 'PRIVATE',
        visibility_reason: 'ALL_TAGGED_PRODUCTS_UNAVAILABLE',
      });
      await admin.query(`UPDATE core.product SET visibility = 'PUBLISHED', unpublished_reason = NULL WHERE id = $1`, [P1]);
      expect((await row(scene.id)).visibility).toBe('PUBLIC');
      // While public, an unpublished tag is omitted from the public list rather than exposed.
      await admin.query(
        `UPDATE core.product SET visibility = 'UNPUBLISHED', unpublished_reason = 'SELLER' WHERE id = $1`,
        [P3],
      );
      const pub = await publicGet(scene.public_ref).expect(200);
      expect(pub.body.products.map((p: { name: string }) => p.name)).toEqual(['Basket']);
    });

    it('a tagged Product cannot be hard-deleted: the relationship is retained evidence', async () => {
      // P_BARE has no Variant, stock or order: only the tag references it.
      await create({ caption: 'Sketchbook', product_ids: [P_BARE] }).expect(201);
      await asSeller(SELLER, S.owner, server().delete(`/v1/seller/products/${P_BARE}`)).expect(409);
      const still = await admin.query(`SELECT count(*)::int AS n FROM core.product WHERE id = $1`, [P_BARE]);
      expect(still.rows[0].n).toBe(1);
    });
  });

  // ---------------------------------------------------------------- concurrency

  describe('concurrency', () => {
    it('publication racing the last stock loss cannot leave a PUBLIC Scene with nothing available', async () => {
      const draft = await readyDraft([P1]);
      const publisher = await admin.connect();
      const seller = await admin.connect();
      try {
        // The publish transaction holds the Scene lock, uncommitted.
        await publisher.query('BEGIN');
        await publisher.query(`SELECT core.fn_scene_post_publish($1, $2, $3)`, [draft.id, SELLER, OWNER]);
        // The stock loss commits meanwhile; its COMMIT-time re-evaluation waits for the Scene.
        await seller.query('BEGIN');
        await setStock(V1, SELLER, 0, seller);
        const sellerPid = await backendPid(seller);
        const sellerCommit = seller.query('COMMIT');
        await blockedOnLock(sellerPid);
        await publisher.query('COMMIT');
        await sellerCommit;
      } finally {
        await done(publisher, seller);
      }
      expect(await row(draft.id)).toMatchObject({ publication_state: 'PUBLISHED', visibility: 'PRIVATE' });
      expect(await publicWithZeroAvailable()).toEqual([]);
    });

    it('republishing a revised Scene while its last unit sells cannot leave it PUBLIC', async () => {
      const scene = await readyPublished([P1]);
      // v2 clones v1 (same tag): a caption edit only.
      const edited = (await patch(scene.id, scene.edit_version, { caption: 'Revised' }).expect(200)).body as SceneView;
      expect(edited.working_revision?.version).toBe(2);
      const publisher = await admin.connect();
      const seller = await admin.connect();
      try {
        await publisher.query('BEGIN');
        await publisher.query(`SELECT core.fn_scene_post_publish($1, $2, $3)`, [scene.id, SELLER, OWNER]);
        await seller.query('BEGIN');
        await setStock(V1, SELLER, 0, seller);
        const sellerPid = await backendPid(seller);
        const sellerCommit = seller.query('COMMIT');
        await blockedOnLock(sellerPid);
        await publisher.query('COMMIT');
        await sellerCommit;
      } finally {
        await done(publisher, seller);
      }
      expect(await row(scene.id)).toMatchObject({ publication_state: 'PUBLISHED', visibility: 'PRIVATE' });
    });

    it('a tag added while a stock change is still open is re-evaluated at that change\u2019s COMMIT', async () => {
      // The stock change begins before any Scene tags P_RACE.
      const seller = await admin.connect();
      try {
        await seller.query('BEGIN');
        await setStock(V_RACE, SELLER, 0, seller);
        // Meanwhile the Seller tags it and publishes: the open change is not yet visible.
        const draft = await readyDraft([P_RACE]);
        const published = await publish(draft.id, draft.edit_version).expect(200);
        expect(published.body.visibility).toBe('PUBLIC');
        await seller.query('COMMIT');
        expect(await row(draft.id)).toMatchObject({ publication_state: 'PUBLISHED', visibility: 'PRIVATE' });
      } finally {
        await done(seller);
      }
    });

    it('a stock loss committed before publication makes the publish refuse', async () => {
      const draft = await readyDraft([P1]);
      await setStock(V1, SELLER, 0);
      await publish(draft.id, draft.edit_version).expect(409);
      expect((await row(draft.id)).publication_state).toBe('DRAFT');
    });

    it('two simultaneous last-unit losses converge on exactly one PRIVATE transition and notice', async () => {
      const scene = await readyPublished([P1, P2]);
      const a = await admin.connect();
      const b = await admin.connect();
      try {
        await a.query('BEGIN');
        await b.query('BEGIN');
        await setStock(V1, SELLER, 0, a);
        await setStock(V2, SELLER, 0, b);
        await Promise.all([a.query('COMMIT'), b.query('COMMIT')]);
      } finally {
        await done(a, b);
      }
      expect(await row(scene.id)).toMatchObject({ visibility: 'PRIVATE' });
      expect((await transitions(scene.id)).filter((t) => t.to_visibility === 'PRIVATE')).toHaveLength(1);
      expect((await notices(scene.id)).map((n) => n.template_key)).toEqual(['SCENE_BECAME_PRIVATE']);

      // And two simultaneous restocks converge on exactly one restoration.
      const c = await admin.connect();
      const d = await admin.connect();
      try {
        await c.query('BEGIN');
        await d.query('BEGIN');
        await setStock(V1, SELLER, 2, c);
        await setStock(V2, SELLER, 2, d);
        await Promise.all([c.query('COMMIT'), d.query('COMMIT')]);
      } finally {
        await done(c, d);
      }
      expect(await row(scene.id)).toMatchObject({ visibility: 'PUBLIC' });
      expect((await notices(scene.id)).map((n) => n.template_key)).toEqual([
        'SCENE_BECAME_PRIVATE',
        'SCENE_BECAME_PUBLIC',
      ]);
    });
  });

  // ------------------------------------------------------------ public privacy

  describe('public privacy', () => {
    it('a draft, an unknown reference and a malformed one are the same bare 404', async () => {
      const draft = await readyDraft([P1]);
      for (const ref of [draft.public_ref, 'AAAAAAAAAAAAAAAAAAAAAA', 'not-a-ref', id(1)]) {
        const r = await publicGet(ref).expect(404);
        expect(r.body.code).toBe('NOT_FOUND');
        expect(JSON.stringify(r.body)).not.toContain('Market morning');
      }
    });

    it('the public shape carries no management field, reason or internal id', async () => {
      const scene = await readyPublished([P1]);
      const r = await publicGet(scene.public_ref).expect(200);
      expect(r.headers['cache-control']).toBe('no-store');
      expect(Object.keys(r.body).sort()).toEqual(
        ['caption', 'image', 'products', 'public_ref', 'published_at', 'revision_version', 'seller'].sort(),
      );
      const text = JSON.stringify(r.body);
      for (const forbidden of ['visibility', 'reason', 'edit_version', 'lifecycle', scene.id, SELLER, P1, ...AVAILABILITY_REASONS]) {
        expect(text).not.toContain(forbidden);
      }
    });

    it("another Seller cannot read the management representation", async () => {
      const scene = await readyPublished([P1]);
      // Seller B's owner, in Seller B's context, asking for Seller A's Scene id.
      await sellerGet(scene.id, S.ownerB, SELLER_B).expect(404);
      // Seller B's owner presenting Seller A's context: no relationship.
      await sellerGet(scene.id, S.ownerB, SELLER).expect(404);
      // A member without the Scene capability.
      await sellerGet(scene.id, S.inventory).expect(403);
      // The owner on a Seller Companion session reads nothing either.
      await sellerGet(scene.id, S.ownerMobile).expect(403);
    });

    it('another Seller cannot edit, publish or upload into a Scene, whatever context it presents', async () => {
      const draft = await readyDraft([P1]);
      for (const seller of [SELLER_B, SELLER]) {
        await asSeller(seller, S.ownerB, server().patch(`/v1/seller/scene-posts/${draft.id}/draft`))
          .set('If-Match', `"${draft.edit_version}"`)
          .send({ caption: 'hijacked' })
          .expect(404);
        await asSeller(seller, S.ownerB, server().post(`/v1/seller/scene-posts/${draft.id}/publish`))
          .set('Idempotency-Key', idem())
          .set('If-Match', `"${draft.edit_version}"`)
          .expect(404);
        await asSeller(seller, S.ownerB, server().post(`/v1/seller/scene-posts/${draft.id}/image-uploads`))
          .set('Idempotency-Key', idem())
          .expect(404);
      }
      expect((await sellerGet(draft.id).expect(200)).body.working_revision.caption).toBe('Market morning');
    });
  });

  // ---------------------------------------------------------- revisions, media

  describe('revisions and media', () => {
    it('editing a published Scene clones a working revision; the public sees v1 until v2 is published', async () => {
      const scene = await readyPublished([P1]);
      const edited = (await patch(scene.id, scene.edit_version, { caption: 'Evening light', product_ids: [P1, P2] }).expect(200))
        .body as SceneView;
      expect(edited.working_revision).toMatchObject({ version: 2, caption: 'Evening light' });
      expect(edited.published_revision).toMatchObject({ version: 1, caption: 'Market morning' });
      expect((await publicGet(scene.public_ref).expect(200)).body.caption).toBe('Market morning');

      const published = (await publish(scene.id, edited.edit_version).expect(200)).body as SceneView;
      expect(published.published_revision).toMatchObject({ version: 2, caption: 'Evening light' });
      expect((await publicGet(scene.public_ref).expect(200)).body.caption).toBe('Evening light');
    });

    it('the application role cannot rewrite a published revision or move lifecycle columns', async () => {
      const scene = await readyPublished([P1]);
      await expect(
        appRole.query(`UPDATE core.scene_post SET visibility = 'PRIVATE' WHERE id = $1`, [scene.id]),
      ).rejects.toMatchObject({ code: '23001' });
      const rev = await admin.query<{ current_published_revision_id: string }>(
        `SELECT current_published_revision_id FROM core.scene_post WHERE id = $1`,
        [scene.id],
      );
      await expect(
        appRole.query(`UPDATE core.scene_post_revision SET caption = 'rewritten' WHERE id = $1`, [
          rev.rows[0]!.current_published_revision_id,
        ]),
      ).rejects.toMatchObject({ code: '23001' });
      await expect(
        appRole.query(`DELETE FROM core.scene_post_product WHERE revision_id = $1`, [
          rev.rows[0]!.current_published_revision_id,
        ]),
      ).rejects.toMatchObject({ code: '23001' });
      await expect(
        appRole.query(
          `INSERT INTO core.scene_post_transition (scene_post_id, seller_id, lifecycle_version,
             from_publication_state, to_publication_state, from_visibility, to_visibility)
           VALUES ($1, $2, 99, 'PUBLISHED', 'PUBLISHED', 'PUBLIC', 'PRIVATE')`,
          [scene.id, SELLER],
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('image keys must be this Scene’s and must have landed', async () => {
      const draft = await create({ caption: 'x' }).expect(201);
      const foreign = await patch(draft.body.id, 1, {
        image: { thumb_key: 'products/x/img/a/thumb.webp', card_key: 'a', full_key: 'b' },
      }).expect(400);
      expect(foreign.body.code).toBe('VALIDATION_FAILED');
      // The internal id is not the key prefix either: only the public reference is.
      const byId = `scenes/${draft.body.id}/img/x`;
      await patch(draft.body.id, 1, {
        image: { thumb_key: `${byId}/thumb.webp`, card_key: `${byId}/card.webp`, full_key: `${byId}/full.webp` },
      }).expect(400);
      const base = `scenes/${draft.body.public_ref}/img/33333333-3333-4333-8333-333333333333`; // well-formed, never uploaded
      const missing = await patch(draft.body.id, 1, {
        image: { thumb_key: `${base}/thumb.webp`, card_key: `${base}/card.webp`, full_key: `${base}/full.webp` },
      }).expect(409);
      expect(missing.body.slots.reason).toBe('OBJECT_NOT_UPLOADED');
      // Only the exact minted shape: no traversal, no swapped slots, no mixed uploads,
      // no other Scene's prefix.
      const other = await create({ caption: 'other' }).expect(201);
      const u1 = '11111111-1111-4111-8111-111111111111';
      const u2 = '22222222-2222-4222-8222-222222222222';
      const mine = `scenes/${draft.body.public_ref}/img`;
      for (const image of [
        { thumb_key: `${mine}/${u1}/thumb.webp`, card_key: `${mine}/${u1}/card.webp`, full_key: `${mine}/../../x/${u1}/full.webp` },
        { thumb_key: `${mine}/${u1}/full.webp`, card_key: `${mine}/${u1}/card.webp`, full_key: `${mine}/${u1}/full.webp` },
        { thumb_key: `${mine}/${u1}/thumb.webp`, card_key: `${mine}/${u2}/card.webp`, full_key: `${mine}/${u1}/full.webp` },
        {
          thumb_key: `scenes/${other.body.public_ref}/img/${u1}/thumb.webp`,
          card_key: `scenes/${other.body.public_ref}/img/${u1}/card.webp`,
          full_key: `scenes/${other.body.public_ref}/img/${u1}/full.webp`,
        },
      ]) {
        const r = await patch(draft.body.id, 1, { image }).expect(400);
        expect(r.body.code).toBe('VALIDATION_FAILED');
      }
      const withImage = await attachImage(draft.body.id, 1);
      expect(withImage.working_revision).not.toBeNull();
    });
  });
});
