import { Controller, Get, Module, Post, Req, Res } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { HandlerTransaction } from '../src/common/db/handler-transaction';
import { RateLimitService } from '../src/common/rate-limit/rate-limit.service';
import type { LocalizedRequest } from '../src/common/http/locale.middleware';
import type { Database } from '../src/common/db/database.types';
import type { Response } from 'express';

/**
 * The Tier 3 pipeline, end to end — every stage exercised through the SAME
 * wiring main.ts serves (configureApp), against the real database, as the
 * real runtime role.
 *
 * The probe controller below is test-scoped: it exists to give the
 * pipeline endpoints to run through before Tier 4 ships real ones, and its
 * scope probe is the gate item "scope failure = 404" proven THROUGH the
 * API — fn_has_permission's U0002 leaving the building as an ordinary
 * not-found envelope.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';

// fixtures (privileged writes — the runtime role may not touch config tables)
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const M = '55555555-3333-4000-8000-000000000001';
const OWNER = '55555555-3333-4000-8000-000000000002';
const STRANGER = '55555555-3333-4000-8000-000000000003';
const SELLER = '55555555-3333-4000-8000-000000000004';
const DEVICE = '55555555-3333-4000-8000-000000000005';
const MOBILE_SESSION = '55555555-3333-4000-8000-000000000006';
const CONSOLE_SESSION = '55555555-3333-4000-8000-000000000007';
const REVOKED_SESSION = '55555555-3333-4000-8000-000000000008';
const IDLE_SESSION = '55555555-3333-4000-8000-000000000009';
const STRANGER_SESSION = '55555555-3333-4000-8000-00000000000a';

let permissionCode = '';

@Controller()
class ProbeController {
  constructor(
    private readonly tx: HandlerTransaction,
    private readonly limiter: RateLimitService,
  ) {}

  @Get('probe/context')
  context(@Req() req: LocalizedRequest): unknown {
    return { ctx: req.ctx, locale: req.locale };
  }

  @Post('probe/idempotent')
  async idempotent(
    @Req() req: LocalizedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    return this.tx.runIdempotent(req, res, 201, async (trx: Transaction<Database>) => {
      const r = await sql<{ now: Date }>`SELECT now() AS now`.execute(trx);
      return { at: r.rows[0]?.now?.toISOString(), body: req.body };
    });
  }

  @Get('probe/limited')
  async limited(@Req() req: LocalizedRequest): Promise<unknown> {
    await this.limiter.consume('ACCOUNT', req.ctx?.accountId ?? 'anon', {
      bucketKey: 'probe',
      windowSeconds: 3600,
      max: 2,
    });
    return { ok: true };
  }

  /** The gate item: a stranger probing a seller-scoped object gets 404. */
  @Get('seller/probe')
  async sellerProbe(@Req() req: LocalizedRequest): Promise<unknown> {
    return this.tx.run(req, async (trx) => {
      await sql`SELECT core.fn_has_permission(
        ${req.ctx?.accountId}, ${req.ctx?.sellerId},
        ${permissionCode}, 'CONSOLE')`.execute(trx);
      return { permitted: true };
    });
  }
}

@Module({ imports: [AppModule], controllers: [ProbeController] })
class ProbeAppModule {}

describe('the Tier 3 request pipeline, end to end', () => {
  let app: INestApplication;
  let admin: Pool;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });

    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'P3','Pipeline','PHASE_1','ETB','Africa/Addis_Ababa','en',false, 'ACTIVE', true, 'AFROMESSAGE')`,
      [M],
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
      [M],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status)
       VALUES ($1,'+251911441001',$3,'ACTIVE'), ($2,'+251911441002',$3,'ACTIVE')`,
      [OWNER, STRANGER, M],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','P','p3-s','ACTIVE')`,
      [SELLER, M, OWNER],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at, last_activity_at)
       VALUES
         ($1,$6,'MOBILE',$5, now()+interval '30 days', now()),
         ($2,$6,'CONSOLE',$5, now()+interval '12 hours', now()),
         ($3,$6,'MOBILE',$5, now()+interval '30 days', now()),
         ($4,$6,'CONSOLE',$5, now()+interval '12 hours', now()-interval '31 minutes'),
         ($7,$8,'CONSOLE',$5, now()+interval '12 hours', now())`,
      [MOBILE_SESSION, CONSOLE_SESSION, REVOKED_SESSION, IDLE_SESSION, DEVICE, OWNER,
       STRANGER_SESSION, STRANGER],
    );
    await admin.query(`UPDATE core.session SET revoked_at = now() WHERE id = $1`, [
      REVOKED_SESSION,
    ]);

    const perm = await admin.query(
      `SELECT code FROM core.permission WHERE 'CONSOLE' = ANY(surfaces)
        AND EXISTS (SELECT 1 FROM core.role_permission rp
                     WHERE rp.permission_code = code AND rp.role = 'OWNER')
        ORDER BY code LIMIT 1`,
    );
    permissionCode = perm.rows[0].code as string;

    const moduleRef = await Test.createTestingModule({
      imports: [ProbeAppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    for (const q of [
      `DELETE FROM core.rate_limit_bucket WHERE bucket_key = 'probe'`,
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${OWNER}','${DEVICE}')`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER}','${STRANGER}')`,
      `DELETE FROM core.session WHERE account_id IN ('${OWNER}','${STRANGER}')`,
      `DELETE FROM core.device WHERE id = '${DEVICE}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id = '${SELLER}'`,
      `DELETE FROM core.seller WHERE id = '${SELLER}'`,
      `DELETE FROM core.account WHERE id IN ('${OWNER}','${STRANGER}')`,
      `DELETE FROM core.timing_config WHERE market_id = '${M}'`,
      `DELETE FROM core.market WHERE id = '${M}'`,
    ]) {
      await admin.query(q);
    }
    await admin.end();
  });

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const cookie = (token: string) => ({ Cookie: `__Host-adulis_session=${token}` });

  describe('anonymous surface', () => {
    it('serves /v1/bootstrap with server_time, market and echoed headers', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/bootstrap')
        .set('Accept-Language', 'am')
        .expect(200);
      expect(r.body).toMatchObject({
        client_status: 'OK',
        locales: ['en', 'am'],
      });
      expect(typeof r.body.server_time).toBe('string');
      expect(r.headers['x-adulis-request-id']).toBeDefined();
      expect(r.headers['content-language']).toBe('am');
    });

    it('a protected route without a credential is 401 SESSION_EXPIRED, in the one envelope', async () => {
      const r = await request(app.getHttpServer()).get('/v1/probe/context').expect(401);
      expect(r.body).toMatchObject({
        code: 'SESSION_EXPIRED',
        title_key: 'error.auth.session_expired',
        retryable: false,
      });
      expect(r.body.request_id).toBe(r.headers['x-adulis-request-id']);
    });
  });

  describe('authenticate — one session read, every standing checked', () => {
    it('a live MOBILE session authenticates by bearer', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/probe/context')
        .set(bearer(MOBILE_SESSION))
        .expect(200);
      expect(r.body.ctx).toMatchObject({ accountId: OWNER, actorRole: 'BUYER' });
    });

    it('a live CONSOLE session authenticates by cookie', async () => {
      await request(app.getHttpServer())
        .get('/v1/probe/context')
        .set(cookie(CONSOLE_SESSION))
        .expect(200);
    });

    it('the carrier must match the surface: a MOBILE session in a cookie is refused', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/probe/context')
        .set(cookie(MOBILE_SESSION))
        .expect(403);
      expect(r.body.code).toBe('AUDIENCE_NOT_PERMITTED');
    });

    it('a revoked session is 401 SESSION_REVOKED — immediately, not at refresh', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/probe/context')
        .set(bearer(REVOKED_SESSION))
        .expect(401);
      expect(r.body.code).toBe('SESSION_REVOKED');
    });

    it('a console session past its idle window is expired (R17 arithmetic)', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/probe/context')
        .set(cookie(IDLE_SESSION))
        .expect(401);
      expect(r.body.code).toBe('SESSION_EXPIRED');
    });

    it('garbage tokens are refused without touching the database', async () => {
      await request(app.getHttpServer())
        .get('/v1/probe/context')
        .set(bearer('not-a-uuid'))
        .expect(401);
    });
  });

  describe('seller context (section 4.2)', () => {
    it('a /v1/seller path without X-Adulis-Seller is 400 SELLER_CONTEXT_REQUIRED', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/seller/probe')
        .set(cookie(CONSOLE_SESSION))
        .expect(400);
      expect(r.body.code).toBe('SELLER_CONTEXT_REQUIRED');
    });

    it('the owner, with the header, passes the permission gate', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/seller/probe')
        .set(cookie(CONSOLE_SESSION))
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      expect(r.body.permitted).toBe(true);
    });

    it('GATE — a stranger probing the seller gets 404, never 403, with no detail', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/seller/probe')
        .set(cookie(STRANGER_SESSION))
        .set('X-Adulis-Seller', SELLER)
        .expect(404);
      expect(r.body.code).toBe('NOT_FOUND');
      expect(r.body.slots).toBeUndefined();
      expect(r.body.items).toBeUndefined();
      expect(JSON.stringify(r.body)).not.toContain(SELLER);
    });
  });

  describe('Origin — the second CSRF control', () => {
    it('a cookie-carried write with a foreign Origin is refused', async () => {
      const r = await request(app.getHttpServer())
        .post('/v1/probe/idempotent')
        .set(cookie(CONSOLE_SESSION))
        .set('Origin', 'https://evil.example')
        .set('Idempotency-Key', '55555555-3333-4000-8000-0000000000f1')
        .send({ a: 1 })
        .expect(403);
      expect(r.body.code).toBe('PERMISSION_DENIED');
    });

    it('a cookie-carried write with NO Origin is refused (absent on a write -> 403)', async () => {
      await request(app.getHttpServer())
        .post('/v1/probe/idempotent')
        .set(cookie(CONSOLE_SESSION))
        .set('Idempotency-Key', '55555555-3333-4000-8000-0000000000f2')
        .send({ a: 1 })
        .expect(403);
    });

    it(`a bearer write sends no Origin and is not this control's subject`, async () => {
      await request(app.getHttpServer())
        .post('/v1/probe/idempotent')
        .set(bearer(MOBILE_SESSION))
        .set('Idempotency-Key', '55555555-3333-4000-8000-0000000000f3')
        .send({ a: 1 })
        .expect(201);
    });
  });

  describe('idempotency (section 8)', () => {
    const KEY = '55555555-3333-4000-8000-0000000000e1';

    it('a state-changing POST without a key is 400 IDEMPOTENCY_KEY_MISSING', async () => {
      const r = await request(app.getHttpServer())
        .post('/v1/probe/idempotent')
        .set(bearer(MOBILE_SESSION))
        .send({ n: 1 })
        .expect(400);
      expect(r.body.code).toBe('IDEMPOTENCY_KEY_MISSING');
    });

    it('an identical replay returns the STORED response with the replay header', async () => {
      const first = await request(app.getHttpServer())
        .post('/v1/probe/idempotent')
        .set(bearer(MOBILE_SESSION))
        .set('Idempotency-Key', KEY)
        .send({ n: 42 })
        .expect(201);
      expect(first.headers['x-adulis-idempotent-replay']).toBeUndefined();

      const replay = await request(app.getHttpServer())
        .post('/v1/probe/idempotent')
        .set(bearer(MOBILE_SESSION))
        .set('Idempotency-Key', KEY)
        .send({ n: 42 })
        .expect(201);
      expect(replay.headers['x-adulis-idempotent-replay']).toBe('true');
      // byte-identical answer to "did my request succeed?"
      expect(replay.body).toEqual(first.body);
    });

    it('the same key with a different body is 409 IDEMPOTENCY_KEY_REUSED — the client has a bug', async () => {
      const r = await request(app.getHttpServer())
        .post('/v1/probe/idempotent')
        .set(bearer(MOBILE_SESSION))
        .set('Idempotency-Key', KEY)
        .send({ n: 43 })
        .expect(409);
      expect(r.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });
  });

  describe('rate limiting (section 10)', () => {
    it('the window admits max, then 429 with Retry-After', async () => {
      const call = () =>
        request(app.getHttpServer()).get('/v1/probe/limited').set(bearer(MOBILE_SESSION));
      await call().expect(200);
      await call().expect(200);
      const r = await call().expect(429);
      expect(r.body.code).toBe('RATE_LIMITED');
      expect(r.body.retryable).toBe(true);
      expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
    });
  });
});
