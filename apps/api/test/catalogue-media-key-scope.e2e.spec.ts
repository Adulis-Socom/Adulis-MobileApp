import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Kysely, PostgresDialect } from 'kysely';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { mediaLifecycle } from '../src/jobs/e4-retention';
import {
  FakeMediaStorageAdapter,
  MEDIA_STORAGE_ADAPTER,
} from '../src/modules/catalogue/media-storage.adapter';
import type { Database } from '../src/common/db/database.types';
import { createJobHarness, type Harness } from './jobs-harness';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * Product media: which object keys a commit accepts, and what a replace or a delete
 * schedules for purge. A commit names only keys minted for this Product and this media
 * kind; an object is scheduled for purge only in the transaction that removed its last
 * reference, and the purge job removes only what was scheduled.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = '5eed0001-0000-4000-8000-000000000001';
const OWNER_A = '5eed0001-0000-4000-8000-000000000002';
const OWNER_B = '5eed0001-0000-4000-8000-000000000003';
const DEVICE = '5eed0001-0000-4000-8000-000000000004';
const SELLER_A = '5eed0001-0000-4000-8000-000000000005';
const SELLER_B = '5eed0001-0000-4000-8000-000000000006';
const SESSION_A = '5eed0001-0000-4000-8000-000000000007';
const SESSION_B = '5eed0001-0000-4000-8000-000000000008';
const OWNER_C = '5eed0001-0000-4000-8000-000000000009';
const SELLER_C = '5eed0001-0000-4000-8000-00000000000a';
const SESSION_C = '5eed0001-0000-4000-8000-00000000000b';

type Actor = { session: string; seller: string };
const A: Actor = { session: SESSION_A, seller: SELLER_A };
const B: Actor = { session: SESSION_B, seller: SELLER_B };
const C: Actor = { session: SESSION_C, seller: SELLER_C };

type ImageKeys = { thumb: string; card: string; full: string };

const storage = new FakeMediaStorageAdapter();

@Module({ imports: [AppModule] })
class MediaKeyScopeAppModule {}

describe('Product media: key scope and purge scheduling', () => {
  let app: INestApplication;
  let admin: Pool;
  let harness: Harness;
  const products: string[] = [];

  const cookie = (t: string) => `__Host-adulis_session=${sessionToken(t)}`;
  const call = (actor: Actor, method: 'post' | 'put' | 'delete', path: string) => {
    const agent = request(app.getHttpServer());
    const r = agent[method](path)
      .set('Cookie', cookie(actor.session))
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Seller', actor.seller);
    return method === 'post' ? r.set('Idempotency-Key', randomUUID()) : r;
  };

  const newProduct = async (actor: Actor): Promise<string> => {
    const id = randomUUID();
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor,
         base_price_currency, visibility)
       VALUES ($1,$2,$3,'Media scope',1000,'ETB','DRAFT')`,
      [id, actor.seller, M],
    );
    products.push(id);
    return id;
  };

  // --- keys and objects ---------------------------------------------------
  const mintImage = async (actor: Actor, pid: string): Promise<ImageKeys> => {
    const r = await call(actor, 'post', `/v1/seller/products/${pid}/images`)
      .send({ action: 'REQUEST_UPLOAD', position: 1 })
      .expect(200);
    return { thumb: r.body.uploads.thumb.key, card: r.body.uploads.card.key, full: r.body.uploads.full.key };
  };
  const mintVideo = async (actor: Actor, pid: string): Promise<string> => {
    const r = await call(actor, 'post', `/v1/seller/products/${pid}/video`)
      .send({ action: 'REQUEST_UPLOAD' })
      .expect(200);
    return r.body.upload.key;
  };
  const land = (...keys: string[]) =>
    keys.forEach((k) => storage.put(k, { bytes: 100_000, contentType: 'application/octet-stream' }));
  const exists = async (key: string) => (await storage.inspect(key)) !== null;

  const commitImage = (actor: Actor, pid: string, position: number, k: ImageKeys) =>
    call(actor, 'post', `/v1/seller/products/${pid}/images`).send({
      action: 'COMMIT',
      position,
      thumb_key: k.thumb,
      card_key: k.card,
      full_key: k.full,
    });
  const commitVideo = (actor: Actor, pid: string, key: string) =>
    call(actor, 'post', `/v1/seller/products/${pid}/video`).send({
      action: 'COMMIT',
      key,
      duration_seconds: 20,
      height_px: 480,
    });
  const committedVideo = async (actor: Actor, pid: string): Promise<string> => {
    const key = await mintVideo(actor, pid);
    land(key);
    await commitVideo(actor, pid, key).expect(201);
    return key;
  };
  const committedImage = async (actor: Actor, pid: string, position: number): Promise<ImageKeys> => {
    const keys = await mintImage(actor, pid);
    land(keys.thumb, keys.card, keys.full);
    await commitImage(actor, pid, position, keys).expect(201);
    return keys;
  };

  // --- database state -----------------------------------------------------
  const videoKey = async (pid: string): Promise<string | null> =>
    (await admin.query(`SELECT key FROM core.product_video WHERE product_id=$1`, [pid])).rows[0]?.key ?? null;
  const imageKeys = async (pid: string): Promise<string[]> =>
    (
      await admin.query(
        `SELECT thumb_key, card_key, full_key FROM core.product_image WHERE product_id=$1 ORDER BY position`,
        [pid],
      )
    ).rows.flatMap((r) => [r.thumb_key, r.card_key, r.full_key]);
  const scheduled = async (...pids: string[]): Promise<{ object_key: string; reason: string }[]> =>
    (
      await admin.query(
        `SELECT object_key, reason FROM core.media_lifecycle WHERE object_key LIKE ANY($1::text[])`,
        [pids.map((p) => `products/${p}/%`)],
      )
    ).rows.sort((a, b) => (a.object_key < b.object_key ? -1 : 1));
  const scheduledKeys = async (...pids: string[]) => (await scheduled(...pids)).map((r) => r.object_key).sort();

  /**
   * Runs the purge job, unchanged, against the shared fake storage. The job reads EVERY due row
   * of the one shared schedule table, and another suite counts its own rows through the same job,
   * so this suite never lets the two meet: (1) the job's due-row query is limited, at the driver,
   * to this suite's Products (a query the limit cannot be applied to fails the test); (2) the
   * rows made due are this suite's, dated one day ahead of the wall clock, so no other suite's
   * clock (a fixed past date, or now) ever finds them due; (3) the job runs at two days ahead.
   * A row of this suite that was not made due stays at its natural date, 30 days ahead.
   */
  const runPurge = async (...pids: string[]) => {
    await admin.query(
      `UPDATE core.media_lifecycle SET purge_after = now() + interval '1 day'
        WHERE object_key LIKE ANY($1::text[])`,
      [pids.map((p) => `products/${p}/%`)],
    );
    const patterns = products.map((p) => `'products/${p}/%'`).join(', ');
    const real = new Pool({ connectionString: process.env['DATABASE_URL_JOBS'], max: 1 });
    let limited = 0;
    const db = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: {
          connect: async () => {
            const client = await real.connect();
            return {
              query: ((text: unknown, values?: unknown[]) => {
                let sqlText = text as string;
                if (sqlText.includes('FROM core.media_lifecycle') && sqlText.includes('WHERE purge_after <')) {
                  limited += 1;
                  sqlText = sqlText.replace(
                    'WHERE purge_after <',
                    `WHERE object_key LIKE ANY (ARRAY[${patterns}]) AND purge_after <`,
                  );
                }
                return client.query(sqlText, values);
              }) as never,
              release: () => client.release(),
            };
          },
          end: () => real.end(),
        },
      }),
    });
    try {
      harness.clock.set(new Date(Date.now() + 2 * 86_400_000));
      const result = await mediaLifecycle.run({ ...harness.ctx, db, mediaStorage: storage });
      expect(limited).toBe(1);
      return result;
    } finally {
      await db.destroy();
    }
  };

  const expectRefused = (res: request.Response, path: string) => {
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED', slots: { path } });
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'MKS','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE')`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.timing_config (id, market_id, payment_confirmation_window, fulfilment_window, offline_sync_horizon,
         payout_activation_delay, recovery_cooling_period,
         deleted_number_cooling_period, refund_ack_window, media_retention,
         level_credit_grace, mobile_session_lifetime, console_session_lifetime,
         console_idle_timeout, console_remembered_lifetime,
         console_remembered_idle, otp_ttl, otp_max_attempts, step_up_freshness,
         new_device_payout_lock, same_seller_cancellation_threshold,
         same_seller_cooldown, cross_seller_cooldown_ladder,
         cancellation_counter_decay)
       VALUES (gen_random_uuid(), $1,'24 hours','72 hours','7 days',
         '24 hours','7 days','30 days','48 hours','90 days','24 hours',
         '30 days','12 hours','30 minutes','7 days','8 hours','5 minutes',5,
         '5 minutes','24 hours',3,'1 hour',
         ARRAY['1 day','2 days','4 days']::interval[],'30 days')`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251919000101',$3,'ACTIVE'), ($2,'+251919000102',$3,'ACTIVE'),
        ($4,'+251919000103',$3,'ACTIVE')`,
      [OWNER_A, OWNER_B, M, OWNER_C],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status)
       VALUES ($1,$3,$4,'INDIVIDUAL','Scope A','scope-a','ACTIVE'),
              ($2,$3,$5,'INDIVIDUAL','Scope B','scope-b','ACTIVE'),
              ($6,$3,$7,'INDIVIDUAL','Scope C','scope-c','ACTIVE')`,
      [SELLER_A, SELLER_B, M, OWNER_A, OWNER_B, SELLER_C, OWNER_C],
    );
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$4,'CONSOLE',$7, now()+interval '12 hours'),
        ($2,$5,'CONSOLE',$7, now()+interval '12 hours'),
        ($3,$6,'CONSOLE',$7, now()+interval '12 hours')`,
      [SESSION_A, SESSION_B, SESSION_C, OWNER_A, OWNER_B, OWNER_C, DEVICE],
    );
    await armFixtureSessions(admin, [SESSION_A, SESSION_B, SESSION_C]);

    const moduleRef = await Test.createTestingModule({ imports: [MediaKeyScopeAppModule] })
      .overrideProvider(MEDIA_STORAGE_ADAPTER)
      .useValue(storage)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
    harness = createJobHarness(new Date());
  });

  afterAll(async () => {
    await app?.close();
    await harness?.close();
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${OWNER_A}','${OWNER_B}','${OWNER_C}')`,
      `DELETE FROM core.stock_event WHERE seller_id IN ('${SELLER_A}','${SELLER_B}','${SELLER_C}')`,
      `DELETE FROM core.product_variant WHERE seller_id IN ('${SELLER_A}','${SELLER_B}','${SELLER_C}')`,
      `DELETE FROM core.product_image WHERE product_id IN (SELECT id FROM core.product WHERE market_id='${M}')`,
      `DELETE FROM core.product_video WHERE product_id IN (SELECT id FROM core.product WHERE market_id='${M}')`,
      `DELETE FROM core.product WHERE market_id='${M}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN ('${SELLER_A}','${SELLER_B}','${SELLER_C}')`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN ('${SELLER_A}','${SELLER_B}','${SELLER_C}')`,
      `DELETE FROM core.seller_level_event WHERE seller_id IN ('${SELLER_A}','${SELLER_B}','${SELLER_C}')`,
      `DELETE FROM core.seller WHERE market_id='${M}'`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER_A}','${OWNER_B}','${OWNER_C}')`,
      `DELETE FROM core.session WHERE account_id IN ('${OWNER_A}','${OWNER_B}','${OWNER_C}')`,
      `DELETE FROM core.device WHERE id='${DEVICE}'`,
      `DELETE FROM core.account WHERE market_id='${M}'`,
      `DELETE FROM core.timing_config WHERE market_id='${M}'`,
      `DELETE FROM core.market WHERE id='${M}'`,
    ]) {
      await admin.query(q);
    }
    if (products.length) {
      await admin.query(`DELETE FROM core.media_lifecycle WHERE object_key LIKE ANY($1::text[])`, [
        products.map((p) => `products/${p}/%`),
      ]);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  describe('authorized uploads keep working', () => {
    it('a minted video and a minted image commit; nothing is scheduled', async () => {
      const pid = await newProduct(A);
      const vkey = await committedVideo(A, pid);
      const ikeys = await committedImage(A, pid, 1);
      expect(await videoKey(pid)).toBe(vkey);
      expect(await imageKeys(pid)).toEqual([ikeys.thumb, ikeys.card, ikeys.full]);
      expect(await scheduled(pid)).toEqual([]);
    });
  });

  describe('a video commit accepts only keys minted for this Product', () => {
    it("another Seller's image key is refused; that Seller's media and the Product are unchanged", async () => {
      const mine = await newProduct(A);
      const theirs = await newProduct(B);
      const theirKeys = await committedImage(B, theirs, 1);
      for (const key of [theirKeys.full, theirKeys.card, theirKeys.thumb]) {
        expectRefused(await commitVideo(A, mine, key), 'key');
      }
      expect(await videoKey(mine)).toBeNull();
      expect(await scheduled(mine, theirs)).toEqual([]);
      expect(await imageKeys(theirs)).toEqual([theirKeys.thumb, theirKeys.card, theirKeys.full]);
      expect(await exists(theirKeys.full)).toBe(true);
    });

    it("another Seller's video key is refused", async () => {
      const mine = await newProduct(A);
      const theirs = await newProduct(B);
      const theirVideo = await committedVideo(B, theirs);
      expectRefused(await commitVideo(A, mine, theirVideo), 'key');
      expect(await videoKey(mine)).toBeNull();
      expect(await videoKey(theirs)).toBe(theirVideo);
    });

    it("a key minted for another Product of the same Seller is refused, for a video and for an image", async () => {
      const p1 = await newProduct(A);
      const p2 = await newProduct(A);
      const otherVideo = await mintVideo(A, p2);
      const otherImage = await committedImage(A, p2, 1);
      land(otherVideo);
      expectRefused(await commitVideo(A, p1, otherVideo), 'key');
      expectRefused(await commitVideo(A, p1, otherImage.full), 'key');
      expectRefused(await commitImage(A, p1, 1, otherImage), 'thumb_key');
      expect(await videoKey(p1)).toBeNull();
      expect(await imageKeys(p1)).toEqual([]);
      expect(await scheduled(p1, p2)).toEqual([]);
    });

    it("the Product's own image key is not a video key", async () => {
      const pid = await newProduct(A);
      const img = await committedImage(A, pid, 1);
      for (const key of [img.full, img.card, img.thumb]) expectRefused(await commitVideo(A, pid, key), 'key');
      expect(await videoKey(pid)).toBeNull();
      expect(await imageKeys(pid)).toEqual([img.thumb, img.card, img.full]);
      expect(await scheduled(pid)).toEqual([]);
    });

    it('a key that was not minted in the video shape is refused even when an object exists there', async () => {
      const pid = await newProduct(A);
      const other = await newProduct(A);
      const uuid = randomUUID();
      const malformed = [
        `products/${pid}/video/${uuid}.mp4/extra`,
        `products/${pid}/video/${uuid}.mov`,
        `products/${pid}/video/not-a-uuid.mp4`,
        `products/${pid}/video/../../${other}/video/${uuid}.mp4`,
        `products/${pid}/video/${uuid}.mp4?x=1`,
        `/products/${pid}/video/${uuid}.mp4`,
        `products/${pid}/img/${uuid}/full.webp`,
        `${pid}`,
        'x',
      ];
      land(...malformed);
      for (const key of malformed) expectRefused(await commitVideo(A, pid, key), 'key');
      expect(await videoKey(pid)).toBeNull();
      expect(await scheduled(pid, other)).toEqual([]);
    });

    it('the upload id must be the lower-case one that was minted', async () => {
      const pid = await newProduct(A);
      const minted = await mintVideo(A, pid);
      const upper = minted.replace(/[0-9a-f-]{36}(?=\.mp4$)/, (id) => id.toUpperCase());
      expect(upper).not.toBe(minted);
      land(upper);
      expectRefused(await commitVideo(A, pid, upper), 'key');
      expect(await videoKey(pid)).toBeNull();
    });

    it('an upper-case Product id in the path mints and accepts keys under the canonical id only', async () => {
      const pid = await newProduct(A);
      const path = `/v1/seller/products/${pid.toUpperCase()}`;
      expect(path).not.toContain(pid);

      const v = await call(A, 'post', `${path}/video`).send({ action: 'REQUEST_UPLOAD' }).expect(200);
      const video = v.body.upload.key as string;
      expect(video.startsWith(`products/${pid}/video/`)).toBe(true);
      land(video);
      await call(A, 'post', `${path}/video`)
        .send({ action: 'COMMIT', key: video, duration_seconds: 20, height_px: 480 })
        .expect(201);
      expect(await videoKey(pid)).toBe(video);

      const i = await call(A, 'post', `${path}/images`).send({ action: 'REQUEST_UPLOAD', position: 1 }).expect(200);
      const image = { thumb: i.body.uploads.thumb.key, card: i.body.uploads.card.key, full: i.body.uploads.full.key };
      expect(image.full.startsWith(`products/${pid}/img/`)).toBe(true);
      land(image.thumb, image.card, image.full);
      await call(A, 'post', `${path}/images`)
        .send({ action: 'COMMIT', position: 1, thumb_key: image.thumb, card_key: image.card, full_key: image.full })
        .expect(201);
      expect(await imageKeys(pid)).toEqual([image.thumb, image.card, image.full]);

      // The same keys under an upper-case prefix are not the minted shape, through either spelling of the path.
      const shouting = (key: string) => key.replace(pid, pid.toUpperCase());
      land(shouting(video));
      expectRefused(await commitVideo(A, pid, shouting(video)), 'key');
      const shoutingImage = { thumb: shouting(image.thumb), card: shouting(image.card), full: shouting(image.full) };
      land(shoutingImage.thumb, shoutingImage.card, shoutingImage.full);
      expectRefused(await commitImage(A, pid, 2, shoutingImage), 'thumb_key');
    });

    it('a well-formed key whose object was never uploaded is a 409', async () => {
      const pid = await newProduct(A);
      const key = await mintVideo(A, pid);
      const r = await commitVideo(A, pid, key);
      expect(r.status).toBe(409);
      expect(r.body).toMatchObject({ code: 'VALIDATION_FAILED', slots: { reason: 'OBJECT_NOT_UPLOADED' } });
      expect(await videoKey(pid)).toBeNull();
    });
  });

  describe('an image commit accepts only the three keys minted together for this Product', () => {
    it('the upload id must be the lower-case one that was minted', async () => {
      const pid = await newProduct(A);
      const minted = await mintImage(A, pid);
      const upper = (key: string) => key.replace(/(\/img\/)([0-9a-f-]{36})/, (_all, dir: string, id: string) => dir + id.toUpperCase());
      const keys = { thumb: upper(minted.thumb), card: upper(minted.card), full: upper(minted.full) };
      expect(keys.full).not.toBe(minted.full);
      land(keys.thumb, keys.card, keys.full);
      expectRefused(await commitImage(A, pid, 1, keys), 'thumb_key');
      expect(await imageKeys(pid)).toEqual([]);
    });

    it('keys from another Seller are refused', async () => {
      const mine = await newProduct(A);
      const theirs = await newProduct(B);
      const theirKeys = await committedImage(B, theirs, 1);
      expectRefused(await commitImage(A, mine, 1, theirKeys), 'thumb_key');
      expect(await imageKeys(mine)).toEqual([]);
    });

    it('keys that only share the Product prefix, or mix two uploads, or swap file slots, are refused', async () => {
      const pid = await newProduct(A);
      const other = await newProduct(A);
      const one = await mintImage(A, pid);
      const two = await mintImage(A, pid);
      const traversal = `products/${pid}/img/../../${other}/img/${randomUUID()}`;
      const cases: [ImageKeys, string][] = [
        [{ thumb: `${traversal}/thumb.webp`, card: `${traversal}/card.webp`, full: `${traversal}/full.webp` }, 'thumb_key'],
        [{ thumb: one.thumb, card: two.card, full: two.full }, 'thumb_key'],
        [{ thumb: one.card, card: one.thumb, full: one.full }, 'thumb_key'],
        [{ thumb: one.thumb, card: one.card, full: one.card }, 'full_key'],
      ];
      for (const [keys] of cases) land(keys.thumb, keys.card, keys.full);
      for (const [keys, path] of cases) expectRefused(await commitImage(A, pid, 2, keys), path);
      expect(await imageKeys(pid)).toEqual([]);
      expect(await scheduled(pid, other)).toEqual([]);
    });
  });

  describe('replace, delete and the purge job', () => {
    it('replacing a video schedules the old key once, and only that key', async () => {
      const pid = await newProduct(A);
      const bystander = await newProduct(A);
      const bystanderVideo = await committedVideo(A, bystander);
      const first = await committedVideo(A, pid);
      expect(await scheduled(pid)).toEqual([]);

      const second = await committedVideo(A, pid);
      expect(await videoKey(pid)).toBe(second);
      expect(await scheduled(pid)).toEqual([{ object_key: first, reason: 'VIDEO_REPLACED' }]);
      const due = await admin.query(`SELECT purge_after > now() AS future FROM core.media_lifecycle WHERE object_key=$1`, [first]);
      expect(due.rows[0].future).toBe(true);
      expect(await exists(first)).toBe(true); // nothing is deleted by the request itself

      // The same key again (a client retry) schedules nothing, and replacing again does not duplicate.
      await commitVideo(A, pid, second).expect(201);
      expect(await scheduledKeys(pid)).toEqual([first]);
      const third = await committedVideo(A, pid);
      expect(await scheduledKeys(pid)).toEqual([first, second].sort());

      const purge = await runPurge(pid);
      expect(purge).toMatchObject({ deleted: 2 });
      expect(await exists(first)).toBe(false);
      expect(await exists(second)).toBe(false);
      expect(await exists(third)).toBe(true);
      expect(await videoKey(pid)).toBe(third);
      expect(await videoKey(bystander)).toBe(bystanderVideo);
      expect(await exists(bystanderVideo)).toBe(true);
      expect(await scheduled(pid, bystander)).toEqual([]);
    });

    it("deleting a video schedules only that key; the purge removes only that object", async () => {
      const pid = await newProduct(A);
      const bystander = await newProduct(A);
      const bystanderVideo = await committedVideo(A, bystander);
      const bystanderImage = await committedImage(A, bystander, 1);
      const key = await committedVideo(A, pid);
      const image = await committedImage(A, pid, 1);
      // Deleted too, but its grace period has not run out: the purge must not touch it.
      const later = await newProduct(A);
      const laterVideo = await committedVideo(A, later);
      await call(A, 'delete', `/v1/seller/products/${later}/video`).expect(204);

      await call(A, 'delete', `/v1/seller/products/${pid}/video`).expect(204);
      expect(await scheduled(pid)).toEqual([{ object_key: key, reason: 'VIDEO_DELETED' }]);
      expect(await videoKey(pid)).toBeNull();

      await runPurge(pid);
      expect(await exists(key)).toBe(false);
      expect(await exists(laterVideo)).toBe(true);
      expect(await scheduledKeys(later)).toEqual([laterVideo]);
      expect(await scheduled(pid, bystander)).toEqual([]);
      for (const k of [image.thumb, image.card, image.full, bystanderVideo, bystanderImage.thumb, bystanderImage.card, bystanderImage.full]) {
        expect(await exists(k)).toBe(true);
      }
      expect(await imageKeys(pid)).toEqual([image.thumb, image.card, image.full]);
      expect(await videoKey(bystander)).toBe(bystanderVideo);
      expect(await imageKeys(bystander)).toEqual([bystanderImage.thumb, bystanderImage.card, bystanderImage.full]);
    });

    it('replacing and then deleting a video schedules both files once; deleting and then committing keeps the new one', async () => {
      const pid = await newProduct(A);
      const first = await committedVideo(A, pid);
      const second = await committedVideo(A, pid);
      await call(A, 'delete', `/v1/seller/products/${pid}/video`).expect(204);
      expect(await scheduled(pid)).toEqual(
        [first, second].sort().map((object_key) => ({
          object_key,
          reason: object_key === first ? 'VIDEO_REPLACED' : 'VIDEO_DELETED',
        })),
      );

      const other = await newProduct(A);
      const old = await committedVideo(A, other);
      await call(A, 'delete', `/v1/seller/products/${other}/video`).expect(204);
      const fresh = await committedVideo(A, other);
      expect(await videoKey(other)).toBe(fresh);
      expect(await scheduledKeys(other)).toEqual([old]);
    });

    it('deleting an image schedules its three keys once; the others stay', async () => {
      const pid = await newProduct(A);
      const keep = await committedImage(A, pid, 1);
      const drop = await committedImage(A, pid, 2);
      await call(A, 'delete', `/v1/seller/products/${pid}/images/2`).expect(204);
      expect(await scheduledKeys(pid)).toEqual([drop.thumb, drop.card, drop.full].sort());
      await runPurge(pid);
      for (const k of [drop.thumb, drop.card, drop.full]) expect(await exists(k)).toBe(false);
      for (const k of [keep.thumb, keep.card, keep.full]) expect(await exists(k)).toBe(true);
      expect(await imageKeys(pid)).toEqual([keep.thumb, keep.card, keep.full]);
    });

    it('an object that another row still references is never scheduled, and the purge leaves it', async () => {
      const pid = await newProduct(A);
      const keys = await committedImage(A, pid, 1);
      await commitImage(A, pid, 2, keys).expect(201); // the same upload registered twice
      await call(A, 'delete', `/v1/seller/products/${pid}/images/1`).expect(204);
      expect(await scheduled(pid)).toEqual([]);
      await runPurge(pid);
      for (const k of [keys.thumb, keys.card, keys.full]) expect(await exists(k)).toBe(true);
      expect(await imageKeys(pid)).toEqual([keys.thumb, keys.card, keys.full]);
    });

    it('registering a key again inside its grace period cancels its purge', async () => {
      const pid = await newProduct(A);
      const video = await committedVideo(A, pid);
      const image = await committedImage(A, pid, 1);
      await call(A, 'delete', `/v1/seller/products/${pid}/video`).expect(204);
      await call(A, 'delete', `/v1/seller/products/${pid}/images/1`).expect(204);
      expect(await scheduled(pid)).toHaveLength(4);

      await commitVideo(A, pid, video).expect(201);
      await commitImage(A, pid, 3, image).expect(201);
      expect(await scheduled(pid)).toEqual([]);
      await runPurge(pid);
      for (const k of [video, image.thumb, image.card, image.full]) expect(await exists(k)).toBe(true);
      expect(await videoKey(pid)).toBe(video);
      expect(await imageKeys(pid)).toEqual([image.thumb, image.card, image.full]);
    });

    it("deleting a Product schedules its media; a refused deletion schedules nothing and keeps the media", async () => {
      const pid = await newProduct(A);
      const video = await committedVideo(A, pid);
      const image = await committedImage(A, pid, 1);
      await call(A, 'delete', `/v1/seller/products/${pid}`).expect(200);
      expect(await scheduledKeys(pid)).toEqual([video, image.thumb, image.card, image.full].sort());
      await runPurge(pid);
      for (const k of [video, image.thumb, image.card, image.full]) expect(await exists(k)).toBe(false);

      // A Product whose variant has stock history cannot be deleted: nothing may change.
      const kept = await newProduct(A);
      const keptVideo = await committedVideo(A, kept);
      const keptImage = await committedImage(A, kept, 1);
      const v = await call(A, 'post', `/v1/seller/products/${kept}/variants`)
        .send({ variant_key: 'one', price_minor: 1000, price_currency: 'ETB' })
        .expect(201);
      await call(A, 'post', `/v1/seller/variants/${v.body.variant_id}/stock`).send({ count: 3 }).expect(201);
      const refused = await call(A, 'delete', `/v1/seller/products/${kept}`);
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('PRODUCT_HAS_ACTIVE_ORDERS');
      expect(await scheduled(kept)).toEqual([]);
      expect(await videoKey(kept)).toBe(keptVideo);
      expect(await imageKeys(kept)).toEqual([keptImage.thumb, keptImage.card, keptImage.full]);
    });

    it('a Product whose media row names the same upload twice schedules each key once', async () => {
      const pid = await newProduct(A);
      const keys = await committedImage(A, pid, 1);
      await commitImage(A, pid, 2, keys).expect(201);
      await call(A, 'delete', `/v1/seller/products/${pid}`).expect(200);
      expect(await scheduledKeys(pid)).toEqual([keys.thumb, keys.card, keys.full].sort());
    });
  });

  describe("a schedule written for another reason is the other writer's", () => {
    const rowsOf = async (pid: string) =>
      (
        await admin.query(
          `SELECT object_key, reason, purge_after FROM core.media_lifecycle WHERE object_key LIKE $1`,
          [`products/${pid}/%`],
        )
      ).rows.sort((a, b) => (a.object_key < b.object_key ? -1 : 1));

    it("a store's deletion schedule is unchanged by later media writes of that store", async () => {
      const pid = await newProduct(C);
      const video = await committedVideo(C, pid);
      const image = await committedImage(C, pid, 1);
      await admin.query(`SELECT core.fn_delete_seller_effects($1)`, [SELLER_C]);
      const before = await rowsOf(pid);
      expect(before.map((r) => [r.object_key, r.reason])).toEqual(
        [video, image.thumb, image.card, image.full].sort().map((k) => [k, 'SELLER_DELETED']),
      );

      // The same media is registered, deleted and registered again after the store's deletion.
      const attempts = [
        (await commitVideo(C, pid, video)).status,
        (await call(C, 'delete', `/v1/seller/products/${pid}/images/1`)).status,
        (await commitImage(C, pid, 1, image)).status,
        (await call(C, 'delete', `/v1/seller/products/${pid}/video`)).status,
        (await commitVideo(C, pid, video)).status,
      ];
      // Whatever each write is answered, the schedule below must not change.
      expect(attempts.every((status) => status < 500)).toBe(true);

      const after = await rowsOf(pid);
      expect(after.map((r) => [r.object_key, r.reason, r.purge_after])).toEqual(
        before.map((r) => [r.object_key, r.reason, r.purge_after]),
      );
    });

    it('a schedule this module wrote earlier is never postponed, and keeps its reason', async () => {
      const pid = await newProduct(A);
      const key = await committedVideo(A, pid);
      const inserted = await admin.query(
        `INSERT INTO core.media_lifecycle (object_key, class, purge_after, reason)
         VALUES ($1, 'INFREQUENT', now() + interval '5 days', 'VIDEO_REPLACED') RETURNING purge_after`,
        [key],
      );
      await call(A, 'delete', `/v1/seller/products/${pid}/video`).expect(204);
      const after = await rowsOf(pid);
      expect(after).toHaveLength(1);
      expect(after[0].reason).toBe('VIDEO_REPLACED');
      expect(after[0].purge_after).toEqual(inserted.rows[0].purge_after);
    });

    it('a deleted store schedule is neither postponed nor brought forward, and keeps its reason', async () => {
      const pid = await newProduct(A);
      const key = await committedVideo(A, pid);
      const inserted = await admin.query(
        `INSERT INTO core.media_lifecycle (object_key, class, purge_after, reason)
         VALUES ($1, 'INFREQUENT', now() + interval '90 days', 'SELLER_DELETED') RETURNING purge_after`,
        [key],
      );
      await call(A, 'delete', `/v1/seller/products/${pid}/video`).expect(204);
      const after = await rowsOf(pid);
      expect(after).toHaveLength(1);
      expect(after[0].reason).toBe('SELLER_DELETED');
      expect(after[0].purge_after).toEqual(inserted.rows[0].purge_after);
    });
  });

  describe("only this Product's own keys are scheduled", () => {
    it("a media row that names an object outside the Product's prefix schedules nothing for it", async () => {
      const pid = await newProduct(A);
      const other = await newProduct(A);
      const outside = [`scenes/${randomUUID()}/img/${randomUUID()}/full.webp`, `products/${other}/video/${randomUUID()}.mp4`];
      await admin.query(
        `INSERT INTO core.product_video (id, product_id, key, duration_seconds, height_px, bytes)
         VALUES ($1,$2,$3,10,480,1000)`,
        [randomUUID(), pid, outside[0]],
      );
      await call(A, 'delete', `/v1/seller/products/${pid}/video`).expect(204);

      const own = await mintImage(A, pid);
      await admin.query(
        `INSERT INTO core.product_image (id, product_id, position, thumb_key, card_key, full_key)
         VALUES ($1,$2,1,$3,$4,$5)`,
        [randomUUID(), pid, own.thumb, own.card, outside[1]],
      );
      await call(A, 'delete', `/v1/seller/products/${pid}`).expect(200);

      const rows = await admin.query(`SELECT object_key FROM core.media_lifecycle WHERE object_key = ANY($1::text[])`, [outside]);
      expect(rows.rows).toEqual([]);
      expect(await scheduledKeys(pid)).toEqual([own.thumb, own.card].sort());
    });
  });

  describe('failed operations schedule nothing and change nothing', () => {
    it('a refused replace keeps the current video and schedules nothing', async () => {
      const pid = await newProduct(A);
      const current = await committedVideo(A, pid);
      const missing = await mintVideo(A, pid);
      const oversize = await mintVideo(A, pid);
      storage.put(oversize, { bytes: 60 * 1024 * 1024, contentType: 'video/mp4' });
      const foreign = await newProduct(B);
      const foreignImage = await committedImage(B, foreign, 1);

      expect((await commitVideo(A, pid, missing)).status).toBe(409);
      const big = await commitVideo(A, pid, oversize);
      expect(big.status).toBe(413);
      expect(big.body.code).toBe('PAYLOAD_TOO_LARGE');
      expectRefused(await commitVideo(A, pid, foreignImage.full), 'key');
      const badDuration = await call(A, 'post', `/v1/seller/products/${pid}/video`).send({
        action: 'COMMIT',
        key: oversize,
        duration_seconds: 31,
        height_px: 480,
      });
      expect(badDuration.status).toBe(400);

      expect(await videoKey(pid)).toBe(current);
      expect(await scheduled(pid, foreign)).toEqual([]);
      expect(await exists(current)).toBe(true);
    });

    it('deleting what does not exist, or what belongs to another Seller, schedules nothing', async () => {
      const pid = await newProduct(A);
      const theirs = await newProduct(B);
      const theirVideo = await committedVideo(B, theirs);
      const theirImage = await committedImage(B, theirs, 1);
      for (const path of [
        `/v1/seller/products/${pid}/video`,
        `/v1/seller/products/${pid}/images/1`,
        `/v1/seller/products/${theirs}/video`,
        `/v1/seller/products/${theirs}/images/1`,
      ]) {
        const r = await call(A, 'delete', path);
        expect(r.status).toBe(404);
        expect(r.body.code).toBe('NOT_FOUND');
      }
      expect(await scheduled(pid, theirs)).toEqual([]);
      expect(await videoKey(theirs)).toBe(theirVideo);
      expect(await imageKeys(theirs)).toEqual([theirImage.thumb, theirImage.card, theirImage.full]);
    });
  });

  describe('concurrent operations on one Product keep one consistent state', () => {
    it('two commits at once leave one live video and the other key scheduled', async () => {
      const pid = await newProduct(A);
      const k1 = await mintVideo(A, pid);
      const k2 = await mintVideo(A, pid);
      land(k1, k2);
      const [r1, r2] = await Promise.all([commitVideo(A, pid, k1), commitVideo(A, pid, k2)]);
      expect([r1.status, r2.status]).toEqual([201, 201]);
      const live = await videoKey(pid);
      expect([k1, k2]).toContain(live);
      expect(await scheduledKeys(pid)).toEqual([live === k1 ? k2 : k1]);
    });

    it('a replace racing a delete ends consistently whichever goes first', async () => {
      for (let round = 0; round < 3; round += 1) {
        const pid = await newProduct(A);
        const k0 = await committedVideo(A, pid);
        const k1 = await mintVideo(A, pid);
        land(k1);
        const [commit, del] = await Promise.all([
          commitVideo(A, pid, k1),
          call(A, 'delete', `/v1/seller/products/${pid}/video`),
        ]);
        expect(commit.status).toBe(201);
        expect(del.status).toBe(204);
        const live = await videoKey(pid);
        expect(live === null || live === k1).toBe(true);
        // Every key is either live or scheduled, never both and never neither.
        const expected = [k0, k1].filter((k) => k !== live).sort();
        expect(await scheduledKeys(pid)).toEqual(expected);
      }
    });

    it('every media change of a Product waits for whoever holds the Product row', async () => {
      const pid = await newProduct(A);
      await committedVideo(A, pid);
      await committedImage(A, pid, 1);
      const nextVideo = await mintVideo(A, pid);
      const nextImage = await mintImage(A, pid);
      land(nextVideo, nextImage.thumb, nextImage.card, nextImage.full);
      const base = `/v1/seller/products/${pid}`;
      const changes: [string, () => PromiseLike<request.Response>, number][] = [
        ['video commit', () => commitVideo(A, pid, nextVideo), 201],
        ['image commit', () => commitImage(A, pid, 2, nextImage), 201],
        ['image delete', () => call(A, 'delete', `${base}/images/1`), 204],
        ['video delete', () => call(A, 'delete', `${base}/video`), 204],
        ['product delete', () => call(A, 'delete', base), 200],
      ];
      for (const [name, send, status] of changes) {
        const holder = new Client({ connectionString: ADMIN });
        await holder.connect();
        await holder.query('BEGIN');
        // NO KEY UPDATE: the same strength the media changes take, and not the foreign-key check's.
        await holder.query(`SELECT 1 FROM core.product WHERE id = $1 FOR NO KEY UPDATE`, [pid]);
        let finished = false;
        const pending = Promise.resolve(send()).then((r) => {
          finished = true;
          return r;
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        const finishedWhileLocked = finished;
        await holder.query('COMMIT');
        await holder.end();
        const res = await pending;
        expect([name, finishedWhileLocked, res.status]).toEqual([name, false, status]);
      }
    });

    it('two image commits for one position leave one row and no purge', async () => {
      const pid = await newProduct(A);
      const one = await mintImage(A, pid);
      const two = await mintImage(A, pid);
      land(one.thumb, one.card, one.full, two.thumb, two.card, two.full);
      const [r1, r2] = await Promise.all([commitImage(A, pid, 1, one), commitImage(A, pid, 1, two)]);
      expect([r1.status, r2.status].sort()).toEqual([201, 409]);
      expect(await imageKeys(pid)).toHaveLength(3);
      expect(await scheduled(pid)).toEqual([]);
    });
  });
});
