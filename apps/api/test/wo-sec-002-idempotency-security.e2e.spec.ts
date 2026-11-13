import { createHash, randomUUID } from 'node:crypto';
import { Controller, Module, Post, Req, Res } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import { Pool } from 'pg';
import request from 'supertest';
import type { Response } from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { HandlerTransaction } from '../src/common/db/handler-transaction';
import { Public } from '../src/common/auth/auth.guard';
import { AdulisException } from '../src/common/errors/adulis-exception';
import { hashRequest } from '../src/common/idempotency/idempotency';
import type { LocalizedRequest } from '../src/common/http/locale.middleware';
import type { Database } from '../src/common/db/database.types';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * WO-SEC-002 -- idempotency scope and identifier validation.
 *
 *  C1  the selected seller is part of the request identity, and a
 *      seller-context replay waits on the account's current standing;
 *  C2  the unique-collision path serves the winner only for the same
 *      request, and an expired record is never served;
 *  C3  a malformed Idempotency-Key or X-Adulis-Device is a 400, not a 500.
 *
 * The probes call the production HandlerTransaction exactly as handlers do.
 * Every authorised execution writes one marker row (rate_limit_bucket, a
 * table adulis_app may insert into), so a rolled-back execution is visible
 * as a counted run with no surviving marker.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const P = '5ec00200-0002-4000-8000-0000000000';
const M = `${P}01`;
const OWNER = `${P}02`; // owns SELLER_A and SELLER_B
const OTHER = `${P}03`; // owns SELLER_C: OWNER is a stranger to it
const MEMBER_R = `${P}04`; // ADMIN of SELLER_A, revoked during the run
const MEMBER_S = `${P}05`; // ADMIN of SELLER_A, suspended during the run
const SELLER_A = `${P}06`;
const SELLER_B = `${P}07`;
const SELLER_C = `${P}08`;
const DEVICE = `${P}09`;
const S_OWNER = `${P}0a`;
const S_MEMBER_R = `${P}0b`;
const S_MEMBER_S = `${P}0c`;
const S_MEMBER_S_LATER = `${P}0d`; // a sign-in after the suspension
const TM_R = `${P}0e`;
const TM_S = `${P}0f`;
const ANON_DEVICE = `${P}10`; // an app device id never registered
const ACCOUNTS = [OWNER, OTHER, MEMBER_R, MEMBER_S];
const SELLERS = [SELLER_A, SELLER_B, SELLER_C];
const MARKER = 'wo-sec-002:';

const SELLER_PATH = '/v1/seller/wo-sec-002-probe';
const BUYER_PATH = '/v1/wo-sec-002-buyer-probe';
const PUBLIC_PATH = '/v1/wo-sec-002-public-probe';

let permissionCode = '';
/** Authorised handler executions per Idempotency-Key, rolled back or not. */
const executions = new Map<string, number>();
/** Keys whose next execution throws after writing its marker. */
const failNext = new Set<string>();

@Controller()
class WoSec002Probe {
  constructor(private readonly tx: HandlerTransaction) {}

  /** A section 4.2 seller-context write, authorised inside the handler like every real one. */
  @Post('seller/wo-sec-002-probe')
  async seller(@Req() req: LocalizedRequest, @Res({ passthrough: true }) res: Response): Promise<unknown> {
    return this.tx.runIdempotent(req, res, 201, async (trx: Transaction<Database>) => {
      await sql`SELECT core.fn_has_permission(
        ${req.ctx?.accountId}, ${req.ctx?.sellerId}, ${permissionCode}, 'MOBILE')`.execute(trx);
      return this.execute(trx, req);
    });
  }

  /** An authenticated buyer-group write that may still carry X-Adulis-Seller. */
  @Post('wo-sec-002-buyer-probe')
  async buyer(@Req() req: LocalizedRequest, @Res({ passthrough: true }) res: Response): Promise<unknown> {
    return this.tx.runIdempotent(req, res, 201, (trx) => this.execute(trx, req));
  }

  /** Anonymous: the DEVICE actor of actorFor. */
  @Public()
  @Post('wo-sec-002-public-probe')
  async anonymous(@Req() req: LocalizedRequest, @Res({ passthrough: true }) res: Response): Promise<unknown> {
    return this.tx.runIdempotent(req, res, 201, async () => ({ ok: true, body: req.body }));
  }

  private async execute(trx: Transaction<Database>, req: LocalizedRequest): Promise<unknown> {
    const key = req.headers['idempotency-key'] as string;
    executions.set(key, (executions.get(key) ?? 0) + 1);
    await sql`INSERT INTO core.rate_limit_bucket (subject_kind, subject_id, bucket_key, window_start)
              VALUES ('ACCOUNT', ${req.ctx?.accountId}, ${MARKER + key}, clock_timestamp())`.execute(trx);
    if ((req.body as { slow?: boolean } | undefined)?.slow === true) {
      await sql`SELECT pg_sleep(1.5)`.execute(trx);
    }
    if (failNext.delete(key)) throw new AdulisException('ILLEGAL_TRANSITION');
    return { seller_id: req.ctx?.sellerId ?? null, body: req.body, run: randomUUID() };
  }
}

@Module({ imports: [AppModule], controllers: [WoSec002Probe] })
class WoSec002Module {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitForExecution = async (key: string, n = 1): Promise<void> => {
  for (let i = 0; i < 300 && (executions.get(key) ?? 0) < n; i++) await sleep(20);
  expect(executions.get(key) ?? 0).toBeGreaterThanOrEqual(n);
};

/** The one error envelope, refusing with a non-retryable 4xx. */
const expectProblem = (r: request.Response, status: number, code: string, path?: string): void => {
  expect(r.status).toBe(status);
  expect(r.headers['content-type']).toMatch(/application\/problem\+json/);
  expect(r.body).toMatchObject({ status, code, retryable: false });
  expect(typeof r.body.type).toBe('string');
  expect(typeof r.body.title_key).toBe('string');
  expect(r.body.request_id).toBe(r.headers['x-adulis-request-id']);
  if (path !== undefined) expect(r.body.slots).toEqual({ path });
  expect(r.headers['x-adulis-idempotent-replay']).toBeUndefined();
};

describe('WO-SEC-002 idempotency scope and identifier validation', () => {
  let app: INestApplication;
  let admin: Pool;
  const http = () => request(app.getHttpServer());
  const bearer = (session: string) => ({ Authorization: `Bearer ${sessionToken(session)}` });

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'SC2','WO-SEC-002','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE', true, 'AFROMESSAGE')`,
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
       VALUES ($1,'+251911462001',$5,'ACTIVE'), ($2,'+251911462002',$5,'ACTIVE'),
              ($3,'+251911462003',$5,'ACTIVE'), ($4,'+251911462004',$5,'ACTIVE')`,
      [OWNER, OTHER, MEMBER_R, MEMBER_S, M],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status)
       VALUES ($1,$4,$5,'INDIVIDUAL','A','sec002-a','ACTIVE'),
              ($2,$4,$5,'INDIVIDUAL','B','sec002-b','ACTIVE'),
              ($3,$4,$6,'INDIVIDUAL','C','sec002-c','ACTIVE')`,
      [SELLER_A, SELLER_B, SELLER_C, M, OWNER, OTHER],
    );
    await admin.query(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role)
       VALUES ($1,$3,$4,'ADMIN'), ($2,$3,$5,'ADMIN')`,
      [TM_R, TM_S, SELLER_A, MEMBER_R, MEMBER_S],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at, last_activity_at)
       VALUES ($1,$4,'MOBILE',$7, now()+interval '30 days', now()),
              ($2,$5,'MOBILE',$7, now()+interval '30 days', now()),
              ($3,$6,'MOBILE',$7, now()+interval '30 days', now())`,
      [S_OWNER, S_MEMBER_R, S_MEMBER_S, OWNER, MEMBER_R, MEMBER_S, DEVICE],
    );
    await armFixtureSessions(admin, [S_OWNER, S_MEMBER_R, S_MEMBER_S]);
    const perm = await admin.query(
      `SELECT p.code FROM core.permission p
        WHERE 'MOBILE' = ANY(p.surfaces) AND NOT p.requires_step_up
          AND EXISTS (SELECT 1 FROM core.role_permission rp
                       WHERE rp.permission_code = p.code AND rp.role = 'OWNER')
          AND EXISTS (SELECT 1 FROM core.role_permission rp
                       WHERE rp.permission_code = p.code AND rp.role = 'ADMIN')
        ORDER BY p.code LIMIT 1`,
    );
    permissionCode = perm.rows[0].code as string;

    const moduleRef = await Test.createTestingModule({ imports: [WoSec002Module] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, 'http://localhost:5173');
    await app.listen(0, '127.0.0.1'); // listen first: concurrent supertest requests (WO-INFRA-005)
  });

  afterAll(async () => {
    await app?.close();
    const accounts = ACCOUNTS.map((a) => `'${a}'`).join(',');
    const sellers = SELLERS.map((s) => `'${s}'`).join(',');
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id IN (${accounts},'${ANON_DEVICE}','${DEVICE}')`,
      `DELETE FROM core.rate_limit_bucket WHERE bucket_key LIKE '${MARKER}%'`,
      `DELETE FROM core.notification WHERE recipient_account_id IN (${accounts})`,
      `DELETE FROM core.session WHERE account_id IN (${accounts})`,
      `DELETE FROM core.seller_team_member WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.device WHERE id = '${DEVICE}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN (${sellers})`,
      `DELETE FROM core.seller WHERE id IN (${sellers})`,
      `DELETE FROM core.account WHERE id IN (${accounts})`,
      `DELETE FROM core.timing_config WHERE market_id = '${M}'`,
      `DELETE FROM core.market WHERE id = '${M}'`,
    ]) {
      await admin.query(q);
    }
    await admin.end();
  });

  const sellerPost = (session: string, sellerId: string, key: string, body: object) =>
    http().post(SELLER_PATH).set(bearer(session)).set('X-Adulis-Seller', sellerId)
      .set('Idempotency-Key', key).send(body);
  /** Starts the request now (supertest is lazy until awaited). */
  const start = (t: request.Test): Promise<request.Response> => t.then((r) => r);

  const records = async (key: string): Promise<number> =>
    Number((await admin.query(`SELECT count(*) FROM core.idempotency_record WHERE key = $1`, [key])).rows[0].count);
  const markers = async (key: string): Promise<number> =>
    Number((await admin.query(`SELECT count(*) FROM core.rate_limit_bucket WHERE bucket_key = $1`,
      [MARKER + key])).rows[0].count);
  const insertRecord = (key: string, actor: string, endpoint: string, hash: Buffer, body: object, expired: boolean) =>
    admin.query(
      `INSERT INTO core.idempotency_record
         (id, key, actor_kind, actor_id, endpoint, request_hash, response_status, response_body, expires_at)
       VALUES (gen_random_uuid(), $1, 'ACCOUNT', $2, $3, $4, 201, $5::jsonb,
               CASE WHEN $6::boolean THEN now() - interval '1 minute' ELSE now() + interval '24 hours' END)`,
      [key, actor, endpoint, hash, JSON.stringify(body), expired],
    );
  /** The hash every record carried before WO-SEC-002: method, path and body only. */
  const legacyHash = (path: string, body: object): Buffer =>
    createHash('sha256').update(`POST\n${path}\n${JSON.stringify(body)}`).digest();

  describe('C1 -- the selected seller is part of the request identity', () => {
    it('a request without a seller hashes exactly as before (stored records stay valid)', () => {
      const body = { n: 1, s: 'x' };
      expect(hashRequest('POST', BUYER_PATH, body, null).equals(legacyHash(BUYER_PATH, body))).toBe(true);
      expect(hashRequest('POST', BUYER_PATH, body, SELLER_A).equals(legacyHash(BUYER_PATH, body))).toBe(false);
      expect(hashRequest('POST', BUYER_PATH, body, SELLER_A).equals(hashRequest('POST', BUYER_PATH, body, SELLER_B)))
        .toBe(false);
    });

    it('control: a stranger seller is 404 on a fresh key', async () => {
      const r = await sellerPost(S_OWNER, SELLER_C, randomUUID(), { n: 1 });
      expectProblem(r, 404, 'NOT_FOUND');
    });

    it('a same-seller retry replays the stored response', async () => {
      const key = randomUUID();
      const first = await sellerPost(S_OWNER, SELLER_A, key, { n: 2 });
      expect(first.status).toBe(201);
      expect(first.headers['x-adulis-idempotent-replay']).toBeUndefined();
      const again = await sellerPost(S_OWNER, SELLER_A, key, { n: 2 });
      expect(again.status).toBe(201);
      expect(again.headers['x-adulis-idempotent-replay']).toBe('true');
      expect(again.body).toEqual(first.body);
      expect(executions.get(key)).toBe(1);
    });

    it('a key used for Seller A and reused for Seller B is 409, never A replayed as B', async () => {
      const key = randomUUID();
      expect((await sellerPost(S_OWNER, SELLER_A, key, { n: 3 })).status).toBe(201);
      const b = await sellerPost(S_OWNER, SELLER_B, key, { n: 3 });
      expectProblem(b, 409, 'IDEMPOTENCY_KEY_REUSED');
      expect(JSON.stringify(b.body)).not.toContain(SELLER_A);
      expect(executions.get(key)).toBe(1);
    });

    it('a key reused for a seller the account cannot access gets no replay: the handler answers 404', async () => {
      const key = randomUUID();
      expect((await sellerPost(S_OWNER, SELLER_A, key, { n: 4 })).status).toBe(201);
      const c = await sellerPost(S_OWNER, SELLER_C, key, { n: 4 });
      expectProblem(c, 404, 'NOT_FOUND');
      expect(JSON.stringify(c.body)).not.toContain(SELLER_A);
      expect(executions.get(key)).toBe(1);
    });

    it('seller switching: each store keeps its own key and replay', async () => {
      const ka = randomUUID();
      const kb = randomUUID();
      const a = await sellerPost(S_OWNER, SELLER_A, ka, { n: 5 });
      const b = await sellerPost(S_OWNER, SELLER_B, kb, { n: 5 });
      expect([a.status, a.body.seller_id, b.status, b.body.seller_id]).toEqual([201, SELLER_A, 201, SELLER_B]);
      const ra = await sellerPost(S_OWNER, SELLER_A, ka, { n: 5 });
      const rb = await sellerPost(S_OWNER, SELLER_B, kb, { n: 5 });
      expect(ra.headers['x-adulis-idempotent-replay']).toBe('true');
      expect(rb.headers['x-adulis-idempotent-replay']).toBe('true');
      expect([ra.body, rb.body]).toEqual([a.body, b.body]);
    });

    it('a buyer-group request carrying X-Adulis-Seller is scoped by it too', async () => {
      const key = randomUUID();
      const post = (sellerId?: string) => {
        const t = http().post(BUYER_PATH).set(bearer(S_OWNER)).set('Idempotency-Key', key);
        return (sellerId ? t.set('X-Adulis-Seller', sellerId) : t).send({ n: 6 });
      };
      const first = await post(SELLER_A);
      expect(first.status).toBe(201);
      expectProblem(await post(SELLER_B), 409, 'IDEMPOTENCY_KEY_REUSED');
      expectProblem(await post(), 409, 'IDEMPOTENCY_KEY_REUSED');
      const again = await post(SELLER_A);
      expect(again.headers['x-adulis-idempotent-replay']).toBe('true');
      expect(again.body).toEqual(first.body);
    });

    it('a record stored before the change still replays for a request without a seller', async () => {
      const key = randomUUID();
      const body = { n: 7 };
      await insertRecord(key, OWNER, `POST ${BUYER_PATH}`, legacyHash(BUYER_PATH, body), { stored: 'before' }, false);
      const r = await http().post(BUYER_PATH).set(bearer(S_OWNER)).set('Idempotency-Key', key).send(body);
      expect(r.status).toBe(201);
      expect(r.headers['x-adulis-idempotent-replay']).toBe('true');
      expect(r.body).toEqual({ stored: 'before' });
      expect(executions.get(key)).toBeUndefined();
    });

    it('a seller-context retry spanning the change is 409, never a second execution', async () => {
      const key = randomUUID();
      const body = { n: 8 };
      await insertRecord(key, OWNER, `POST ${SELLER_PATH}`, legacyHash(SELLER_PATH, body), { stored: 'before' }, false);
      expectProblem(await sellerPost(S_OWNER, SELLER_A, key, body), 409, 'IDEMPOTENCY_KEY_REUSED');
      expect(executions.get(key)).toBeUndefined();
      expect(await markers(key)).toBe(0);
    });

    it('a revoked team member is not served the replay: the handler answers 403', async () => {
      const key = randomUUID();
      const first = await sellerPost(S_MEMBER_R, SELLER_A, key, { n: 9 });
      expect(first.status).toBe(201);
      expect((await sellerPost(S_MEMBER_R, SELLER_A, key, { n: 9 })).headers['x-adulis-idempotent-replay'])
        .toBe('true');
      await admin.query(`UPDATE core.seller_team_member SET revoked_at = now() WHERE id = $1`, [TM_R]);
      const r = await sellerPost(S_MEMBER_R, SELLER_A, key, { n: 9 });
      expectProblem(r, 403, 'PERMISSION_DENIED');
      expect(executions.get(key)).toBe(1);
      expect(await records(key)).toBe(1);
    });

    it('a suspended team member is not served the replay, even from a later session', async () => {
      const key = randomUUID();
      expect((await sellerPost(S_MEMBER_S, SELLER_A, key, { n: 10 })).status).toBe(201);
      // Suspension also revokes live sessions (hygiene trigger); the replay
      // must not depend on that, so the member signs in again afterwards.
      await admin.query(`UPDATE core.seller_team_member SET suspended_at = now() WHERE id = $1`, [TM_S]);
      await admin.query(
        `INSERT INTO core.session (id, account_id, audience, device_id, expires_at, last_activity_at)
         VALUES ($1,$2,'MOBILE',$3, now()+interval '30 days', now())`,
        [S_MEMBER_S_LATER, MEMBER_S, DEVICE],
      );
      await armFixtureSessions(admin, [S_MEMBER_S_LATER]);
      const r = await sellerPost(S_MEMBER_S_LATER, SELLER_A, key, { n: 10 });
      expectProblem(r, 403, 'PERMISSION_DENIED');
      expect(executions.get(key)).toBe(1);
    });
  });

  describe('C2 -- the unique-collision path and expired records', () => {
    it('concurrent identical requests: the winner executes, the loser rolls back and replays it', async () => {
      const key = randomUUID();
      const winner = start(sellerPost(S_OWNER, SELLER_A, key, { n: 11, slow: true }));
      await waitForExecution(key, 1);
      const loser = start(sellerPost(S_OWNER, SELLER_A, key, { n: 11, slow: true }));
      const [w, l] = await Promise.all([winner, loser]);
      expect(w.status).toBe(201);
      expect(w.headers['x-adulis-idempotent-replay']).toBeUndefined();
      expect(l.status).toBe(201);
      expect(l.headers['x-adulis-idempotent-replay']).toBe('true');
      expect(l.body).toEqual(w.body);
      expect(executions.get(key)).toBe(2); // both ran...
      expect(await markers(key)).toBe(1); // ...and only the winner's effects stand
      expect(await records(key)).toBe(1);
    });

    it('concurrent requests with different bodies: one 201, the other 409, never the other body', async () => {
      const key = randomUUID();
      const winner = start(sellerPost(S_OWNER, SELLER_A, key, { n: 41, slow: true }));
      await waitForExecution(key, 1);
      const loser = start(sellerPost(S_OWNER, SELLER_A, key, { n: 42, slow: true }));
      const [w, l] = await Promise.all([winner, loser]);
      expect(w.status).toBe(201);
      expect(w.body.body).toEqual({ n: 41, slow: true });
      expectProblem(l, 409, 'IDEMPOTENCY_KEY_REUSED');
      expect(executions.get(key)).toBe(2);
      expect(await markers(key)).toBe(1);
    });

    it('an expired record not yet purged is refused, never served', async () => {
      const key = randomUUID();
      const body = { n: 12 };
      await insertRecord(key, OWNER, `POST ${SELLER_PATH}`, hashRequest('POST', SELLER_PATH, body, SELLER_A),
        { stale: true }, true);
      const r = await sellerPost(S_OWNER, SELLER_A, key, body);
      expectProblem(r, 409, 'IDEMPOTENCY_KEY_REUSED');
      expect(JSON.stringify(r.body)).not.toContain('stale');
      expect(executions.get(key)).toBeUndefined();
    });

    it('an expired record met on the collision path is refused too, and the work rolls back', async () => {
      const key = randomUUID();
      const body = { n: 13, slow: true };
      const pending = start(sellerPost(S_OWNER, SELLER_A, key, body));
      await waitForExecution(key, 1);
      await insertRecord(key, OWNER, `POST ${SELLER_PATH}`, hashRequest('POST', SELLER_PATH, body, SELLER_A),
        { stale: true }, true);
      const r = await pending;
      expectProblem(r, 409, 'IDEMPOTENCY_KEY_REUSED');
      expect(JSON.stringify(r.body)).not.toContain('stale');
      expect(await markers(key)).toBe(0);
    });

    it('a handler that fails writes no record, and the retry executes afresh', async () => {
      const key = randomUUID();
      failNext.add(key);
      const failed = await sellerPost(S_OWNER, SELLER_A, key, { n: 14 });
      expect(failed.status).toBe(409);
      expect(failed.body.code).toBe('ILLEGAL_TRANSITION');
      expect(await records(key)).toBe(0);
      expect(await markers(key)).toBe(0);
      const retry = await sellerPost(S_OWNER, SELLER_A, key, { n: 14 });
      expect(retry.status).toBe(201);
      expect(retry.headers['x-adulis-idempotent-replay']).toBeUndefined();
      expect(executions.get(key)).toBe(2);
      expect(await records(key)).toBe(1);
      expect(await markers(key)).toBe(1);
    });
  });

  describe('C3 -- malformed identifiers are a 400, not a 500', () => {
    it('a malformed Idempotency-Key is 400 VALIDATION_FAILED naming the header', async () => {
      for (const bad of ['not-a-uuid', '5ec002000002400080000000000000aa', `{${randomUUID()}}`, `${randomUUID()}x`]) {
        const r = await sellerPost(S_OWNER, SELLER_A, bad, { n: 15 });
        expectProblem(r, 400, 'VALIDATION_FAILED', 'Idempotency-Key');
        expect(executions.get(bad)).toBeUndefined();
      }
    });

    it('a missing key is still IDEMPOTENCY_KEY_MISSING', async () => {
      const r = await http().post(SELLER_PATH).set(bearer(S_OWNER)).set('X-Adulis-Seller', SELLER_A).send({});
      expectProblem(r, 400, 'IDEMPOTENCY_KEY_MISSING');
    });

    it('valid identifiers are still accepted, in either letter case', async () => {
      const key = randomUUID().toUpperCase();
      const r = await sellerPost(S_OWNER, SELLER_A, key, { n: 16 });
      expect(r.status).toBe(201);
      const again = await sellerPost(S_OWNER, SELLER_A, key, { n: 16 });
      expect(again.headers['x-adulis-idempotent-replay']).toBe('true');
    });

    it('anonymous: a malformed X-Adulis-Device is 400 naming the header; a valid one works', async () => {
      const bad = await http().post(PUBLIC_PATH).set('X-Adulis-Device', 'not-a-uuid')
        .set('Idempotency-Key', randomUUID()).send({});
      expectProblem(bad, 400, 'VALIDATION_FAILED', 'X-Adulis-Device');

      const key = randomUUID();
      const ok = () => http().post(PUBLIC_PATH).set('X-Adulis-Device', ANON_DEVICE)
        .set('Idempotency-Key', key).send({ n: 17 });
      expect((await ok()).status).toBe(201);
      expect((await ok()).headers['x-adulis-idempotent-replay']).toBe('true');

      const none = await http().post(PUBLIC_PATH).set('Idempotency-Key', randomUUID()).send({});
      expectProblem(none, 400, 'IDEMPOTENCY_KEY_MISSING', 'X-Adulis-Device');
    });

    it('anonymous: a malformed key is 400 before the device is considered', async () => {
      const r = await http().post(PUBLIC_PATH).set('X-Adulis-Device', ANON_DEVICE)
        .set('Idempotency-Key', 'not-a-uuid').send({});
      expectProblem(r, 400, 'VALIDATION_FAILED', 'Idempotency-Key');
    });

    it('POST /v1/cart/lines (public) with a malformed X-Adulis-Device is 400', async () => {
      const r = await http().post('/v1/cart/lines').set('X-Adulis-Device', 'not-a-uuid')
        .set('Idempotency-Key', randomUUID()).send({ variant_id: randomUUID(), quantity: 1 });
      expectProblem(r, 400, 'VALIDATION_FAILED', 'X-Adulis-Device');
    });

    it('POST /v1/cart/lines signed in, with a malformed X-Adulis-Device, is 400', async () => {
      const r = await http().post('/v1/cart/lines').set(bearer(S_OWNER)).set('X-Adulis-Device', 'not-a-uuid')
        .set('Idempotency-Key', randomUUID()).send({ variant_id: randomUUID(), quantity: 1 });
      expectProblem(r, 400, 'VALIDATION_FAILED', 'X-Adulis-Device');
    });

    it('GET /v1/cart with a malformed X-Adulis-Device is 400; a valid unknown device has an empty cart', async () => {
      const bad = await http().get('/v1/cart').set('X-Adulis-Device', 'not-a-uuid');
      expectProblem(bad, 400, 'VALIDATION_FAILED', 'X-Adulis-Device');
      const ok = await http().get('/v1/cart').set('X-Adulis-Device', ANON_DEVICE);
      expect(ok.status).toBe(200);
      expect(ok.body.cart_id).toBeNull();
    });

    it('POST /v1/auth/otp/verify (public) with a malformed key is 400', async () => {
      const r = await http().post('/v1/auth/otp/verify').set('Idempotency-Key', 'not-a-uuid')
        .send({ phone: '+251911462009', code: '123456', device_id: DEVICE });
      expectProblem(r, 400, 'VALIDATION_FAILED', 'Idempotency-Key');
    });

    it('POST /v1/auth/otp/request (public) with a malformed key is 400', async () => {
      const r = await http().post('/v1/auth/otp/request').set('X-Adulis-Device', DEVICE)
        .set('Idempotency-Key', 'not-a-uuid')
        .send({ phone: '+251911462009', purpose: 'SIGN_IN', audience: 'MOBILE' });
      expectProblem(r, 400, 'VALIDATION_FAILED', 'Idempotency-Key');
    });

    it('POST /v1/deletion/confirm with a malformed key is 400', async () => {
      const r = await http().post('/v1/deletion/confirm').set('Authorization', `Ticket ${randomUUID()}`)
        .set('Idempotency-Key', 'not-a-uuid').send({ acknowledge: true });
      expectProblem(r, 400, 'VALIDATION_FAILED', 'Idempotency-Key');
    });

    it('POST /v1/handoffs/sync with a malformed key is 400', async () => {
      const r = await http().post('/v1/handoffs/sync').set(bearer(S_OWNER)).set('Idempotency-Key', 'not-a-uuid')
        .send({ scans: [{ nonce: randomUUID(), order_ref: randomUUID(), signed_at: Date.now(), signature: 'a'.repeat(64) }] });
      expectProblem(r, 400, 'VALIDATION_FAILED', 'Idempotency-Key');
    });
  });
});
