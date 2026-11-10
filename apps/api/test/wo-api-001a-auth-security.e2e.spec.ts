import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { FakeSmsAdapter, SMS_ADAPTER } from '../src/modules/auth/sms.adapter';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * WO-API-001A -- session security, auth schemas and Mobile account context.
 *
 *   SEC-1  the credential is not the session id; PostgreSQL holds its hash
 *   SEC-2  a device update is bound to the calling session's own device
 *   SEC-3  no credential enters the generic idempotency store
 *   SEC-4  self sign-out is free; another session costs a CONSOLE step-up
 *   account_context  server-derived mode availability; Courier fails closed
 *   migration 0053   global sign-out held; no legacy credential can match
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const id = (n: number) => `a001a000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const M = id(1);
const BUYER = id(2);
const OWNER = id(3);
const MEMBER = id(4);
const MEMBER_REVOKED = id(5);
const MEMBER_SUSPENDED = id(6);
const COURIER = id(7);
const DELETED_OWNER = id(8);
const SELLER = id(9);
const DELETED_SELLER = id(10);
const OWNER_DEVICE = id(11);
// Fixture MOBILE sessions, one per account (account_context arms).
const BUYER_S = id(20);
const OWNER_S = id(21);
const MEMBER_S = id(22);
const MEMBER_REVOKED_S = id(23);
const MEMBER_SUSPENDED_S = id(24);
const COURIER_S = id(25);
const DELETED_OWNER_S = id(26);
// CONSOLE fixtures for SEC-4.
const OWNER_CON_S = id(30);
const OWNER_CON_S2 = id(31);
const OWNER_CON_S3 = id(32);
const EXPIRED_S = id(33);
const OWNER_CON_S4 = id(34);
const OTP_FIX = id(40);

// Fresh numbers each run, so the per-phone OTP budget never carries over.
const phone = () => `+2519${randomInt(10_000_000, 99_999_999)}`;
const P_OWNER = phone();
const sms = new FakeSmsAdapter();
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest();

@Module({ imports: [AppModule] })
class WoApi001aModule {}

describe('WO-API-001A -- session security and account context', () => {
  let app: INestApplication;
  let admin: Pool;
  const signInPhones: string[] = [];
  const devices: string[] = [];
  const http = () => request(app.getHttpServer());
  const cookie = (t: string) => `__Host-adulis_session=${sessionToken(t)}`;

  const freshStepUp = async (account: string, targetRef: string | null = null): Promise<string> => {
    const challenge = randomUUID();
    await admin.query(
      `INSERT INTO core.step_up_challenge
         (id, account_id, action, target_ref, otp_challenge_id, satisfied_at, expires_at)
       VALUES ($1, $2, 'REVOKE_ALL_SESSIONS', $3, $4, now(), now() + interval '1 hour')`,
      [challenge, account, targetRef, OTP_FIX],
    );
    return challenge;
  };

  /** The real MOBILE door: register, place in the market, request, verify. */
  const mobileSignIn = async (p = phone()) => {
    signInPhones.push(p);
    const device = randomUUID();
    devices.push(device);
    await http().post('/v1/devices').set('Idempotency-Key', randomUUID()).set('X-Adulis-Device', device)
      .send({ id: device, platform: 'ANDROID' }).expect(201);
    await admin.query(`UPDATE core.device SET market_id = $1 WHERE id = $2`, [M, device]);
    await http().post('/v1/auth/otp/request').set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', device)
      .send({ phone: p, purpose: 'SIGN_IN', audience: 'MOBILE' }).expect(202);
    const key = randomUUID();
    const body = {
      phone: p,
      code: sms.lastTo(p)?.slots['code'] as string,
      device_id: device,
      age_declared_over_18: true,
    };
    const res = await http().post('/v1/auth/otp/verify').set('Idempotency-Key', key)
      .set('X-Adulis-Device', device).send(body).expect(200);
    return { token: res.body.token as string, accountId: res.body.account_id as string, device, key, body };
  };

  const sessionIdOf = async (token: string): Promise<string> => {
    const r = await admin.query(`SELECT id FROM core.session WHERE token_hash = $1`, [sha256(token)]);
    return r.rows[0].id as string;
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'A1A','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE')`,
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
    const accounts = [BUYER, OWNER, MEMBER, MEMBER_REVOKED, MEMBER_SUSPENDED, COURIER, DELETED_OWNER];
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status)
       SELECT a, p, $3, 'ACTIVE' FROM unnest($1::uuid[], $2::text[]) AS t(a, p)`,
      [accounts, [phone(), P_OWNER, phone(), phone(), phone(), phone(), phone()], M],
    );
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id, account_id) VALUES ($1,'ANDROID',$2,$3)`,
      [OWNER_DEVICE, M, OWNER],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status) VALUES
        ($1,$3,$4,'INDIVIDUAL','A1A Store','a1a-store','ACTIVE'),
        ($2,$3,$5,'INDIVIDUAL','A1A Gone','a1a-gone','DELETED')`,
      [SELLER, DELETED_SELLER, M, OWNER, DELETED_OWNER],
    );
    await admin.query(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role, suspended_at, revoked_at) VALUES
        (gen_random_uuid(), $1, $2, 'ANALYST', NULL, NULL),
        (gen_random_uuid(), $1, $3, 'ANALYST', NULL, now()),
        (gen_random_uuid(), $1, $4, 'ANALYST', now(), NULL)`,
      [SELLER, MEMBER, MEMBER_REVOKED, MEMBER_SUSPENDED],
    );
    await admin.query(
      `INSERT INTO core.seller_courier (id, seller_id, account_id) VALUES (gen_random_uuid(), $1, $2)`,
      [SELLER, COURIER],
    );
    await admin.query(
      `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash, expires_at, consumed_at, step_up_action)
       VALUES ($1,'STEP_UP',$2, decode('00','hex'), now()+interval '1 hour', now(), 'REVOKE_ALL_SESSIONS')`,
      [OTP_FIX, P_OWNER],
    );
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$8,'MOBILE',NULL, now()+interval '30 days'),
        ($2,$9,'MOBILE',$15, now()+interval '30 days'),
        ($3,$10,'MOBILE',NULL, now()+interval '30 days'),
        ($4,$11,'MOBILE',NULL, now()+interval '30 days'),
        ($5,$12,'MOBILE',NULL, now()+interval '30 days'),
        ($6,$13,'MOBILE',NULL, now()+interval '30 days'),
        ($7,$14,'MOBILE',NULL, now()+interval '30 days'),
        ($16,$9,'CONSOLE',NULL, now()+interval '12 hours'),
        ($17,$9,'CONSOLE',NULL, now()+interval '12 hours'),
        ($18,$9,'CONSOLE',NULL, now()+interval '12 hours'),
        ($19,$8,'MOBILE',NULL, now()+interval '1 hour'),
        ($20,$9,'CONSOLE',NULL, now()+interval '12 hours')`,
      [BUYER_S, OWNER_S, MEMBER_S, MEMBER_REVOKED_S, MEMBER_SUSPENDED_S, COURIER_S, DELETED_OWNER_S,
       BUYER, OWNER, MEMBER, MEMBER_REVOKED, MEMBER_SUSPENDED, COURIER, DELETED_OWNER, OWNER_DEVICE,
       OWNER_CON_S, OWNER_CON_S2, OWNER_CON_S3, EXPIRED_S, OWNER_CON_S4],
    );
    await armFixtureSessions(admin, [BUYER_S, OWNER_S, MEMBER_S, MEMBER_REVOKED_S, MEMBER_SUSPENDED_S,
      COURIER_S, DELETED_OWNER_S, OWNER_CON_S, OWNER_CON_S2, OWNER_CON_S3, EXPIRED_S, OWNER_CON_S4]);
    await admin.query(`UPDATE core.session SET expires_at = now() - interval '1 minute' WHERE id = $1`, [EXPIRED_S]);

    const moduleRef = await Test.createTestingModule({ imports: [WoApi001aModule] })
      .overrideProvider(SMS_ADAPTER)
      .useValue(sms)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    const accounts = `SELECT id FROM core.account WHERE market_id = '${M}'`;
    const q = (text: string, values: unknown[] = []) => admin.query(text, values);
    await q(`SET session_replication_role = replica`);
    await q(`DELETE FROM core.notification WHERE recipient_account_id IN (${accounts})`);
    await q(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [devices]);
    await q(`DELETE FROM core.step_up_challenge WHERE account_id IN (${accounts})`);
    await q(`DELETE FROM core.session WHERE account_id IN (${accounts})`);
    await q(`DELETE FROM core.account_device WHERE account_id IN (${accounts})`);
    await q(`DELETE FROM core.seller_team_member WHERE seller_id = $1`, [SELLER]);
    await q(`DELETE FROM core.seller_courier WHERE seller_id = $1`, [SELLER]);
    // Rows a seller INSERT's triggers made: replica mode would orphan them (D-134).
    for (const child of ['seller_public_stats', 'seller_level_state', 'seller_eligibility_evaluation']) {
      await q(`DELETE FROM core.${child} WHERE seller_id = ANY($1::uuid[])`, [[SELLER, DELETED_SELLER]]);
    }
    await q(`DELETE FROM core.seller WHERE market_id = $1`, [M]);
    await q(`DELETE FROM core.otp_challenge WHERE phone_e164 = ANY($1::text[]) OR id = $2`,
      [[...signInPhones, P_OWNER], OTP_FIX]);
    await q(`DELETE FROM core.device WHERE id = ANY($1::uuid[]) OR id = $2 OR account_id IN (${accounts})`,
      [devices, OWNER_DEVICE]);
    await q(`DELETE FROM core.account WHERE market_id = $1`, [M]);
    await q(`DELETE FROM core.timing_config WHERE market_id = $1`, [M]);
    await q(`DELETE FROM core.market WHERE id = $1`, [M]);
    await q(`SET session_replication_role = DEFAULT`);
    await admin.end();
    await app.close();
  });

  describe('SEC-1 -- the credential is not the session id', () => {
    it('mints a separate high-entropy credential and stores only its hash', async () => {
      const s = await mobileSignIn();
      expect(s.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const row = await admin.query(
        `SELECT id::text AS id, token_hash, row_to_json(x)::text AS whole
           FROM core.session x WHERE token_hash = $1`,
        [sha256(s.token)],
      );
      expect(row.rows).toHaveLength(1);
      expect(row.rows[0].id).not.toBe(s.token);
      expect((row.rows[0].token_hash as Buffer).length).toBe(32);
      // The plaintext is in no column of the row.
      expect(row.rows[0].whole).not.toContain(s.token);
    });

    it('the bearer authenticates; the public session id does not', async () => {
      const s = await mobileSignIn();
      await http().get('/v1/auth/sessions').set('Authorization', `Bearer ${s.token}`).expect(200);
      const publicId = await sessionIdOf(s.token);
      const asBearer = await http().get('/v1/auth/sessions').set('Authorization', `Bearer ${publicId}`).expect(401);
      expect(asBearer.body.code).toBe('SESSION_EXPIRED');
      await http().get('/v1/auth/sessions').set('Cookie', `__Host-adulis_session=${publicId}`).expect(401);
    });

    it("another session's credential cannot be obtained from the session list", async () => {
      const p = phone();
      const first = await mobileSignIn(p);
      const second = await mobileSignIn(p);
      const secondId = await sessionIdOf(second.token);
      const list = await http().get('/v1/auth/sessions').set('Authorization', `Bearer ${first.token}`).expect(200);
      const raw = JSON.stringify(list.body);
      expect(raw).not.toContain(second.token);
      expect(raw).not.toContain(sha256(second.token).toString('hex'));
      expect(raw).not.toContain(sha256(second.token).toString('base64'));
      const allowed = [
        'id', 'audience', 'first_seen_at', 'last_activity_at', 'approx_location', 'expires_at',
        'device_platform', 'remembered_label', 'remembered_device_id', 'remembered', 'current',
      ].sort();
      for (const row of list.body.data) expect(Object.keys(row).sort()).toEqual(allowed);
      // Every listed id is inert as a credential, including the other session's.
      expect(list.body.data.map((r: { id: string }) => r.id)).toContain(secondId);
      for (const r of list.body.data as { id: string }[]) {
        await http().get('/v1/auth/sessions').set('Authorization', `Bearer ${r.id}`).expect(401);
      }
      // ...while the other session itself still works.
      await http().get('/v1/auth/sessions').set('Authorization', `Bearer ${second.token}`).expect(200);
    });

    it('a refused session cookie is cleared, so a dead cookie never blocks sign-in', async () => {
      // EXPIRED_S's cookie on the public bootstrap route: refused AND expired in the browser.
      const r = await http().get('/v1/bootstrap').set('Cookie', cookie(EXPIRED_S)).expect(401);
      expect(String(r.headers['set-cookie'])).toMatch(/__Host-adulis_session=; Max-Age=0/);
      // A dead BEARER is the app's to drop; the server sets no cookie for it.
      const b = await http().get('/v1/bootstrap')
        .set('Authorization', `Bearer ${sessionToken(EXPIRED_S)}`).expect(401);
      expect(b.headers['set-cookie']).toBeUndefined();
    });

    it('a revoked credential fails; an expired one fails', async () => {
      const s = await mobileSignIn();
      await http().post('/v1/auth/logout').set('Authorization', `Bearer ${s.token}`).expect(204);
      const revoked = await http().get('/v1/auth/sessions').set('Authorization', `Bearer ${s.token}`).expect(401);
      expect(revoked.body.code).toBe('SESSION_REVOKED');
      const expired = await http().get('/v1/auth/sessions')
        .set('Authorization', `Bearer ${sessionToken(EXPIRED_S)}`).expect(401);
      expect(expired.body.code).toBe('SESSION_EXPIRED');
    });
  });

  describe('SEC-2 -- a device update is bound to the calling session', () => {
    it('updates its own device, and nothing else', async () => {
      const s = await mobileSignIn();
      await http().patch(`/v1/devices/${s.device}`).set('Authorization', `Bearer ${s.token}`)
        .send({ push_token: 'own-token', notification_permission: 'GRANTED' }).expect(200);
      const own = await admin.query(`SELECT push_token FROM core.device WHERE id = $1`, [s.device]);
      expect(own.rows[0].push_token).toBe('own-token');

      // Another account's device and an id that does not exist answer alike.
      const cross = await http().patch(`/v1/devices/${OWNER_DEVICE}`).set('Authorization', `Bearer ${s.token}`)
        .send({ push_token: 'hijack' }).expect(404);
      const absent = await http().patch(`/v1/devices/${randomUUID()}`).set('Authorization', `Bearer ${s.token}`)
        .send({ push_token: 'hijack' }).expect(404);
      expect(cross.body.code).toBe(absent.body.code);
      const victim = await admin.query(`SELECT push_token FROM core.device WHERE id = $1`, [OWNER_DEVICE]);
      expect(victim.rows[0].push_token).toBeNull();
    });

    it('a device of the same account that is not this session’s is refused', async () => {
      const p = phone();
      const a = await mobileSignIn(p);
      const b = await mobileSignIn(p);
      await http().patch(`/v1/devices/${b.device}`).set('Authorization', `Bearer ${a.token}`)
        .send({ push_token: 'sideways' }).expect(404);
    });

    it('an unauthenticated update fails', async () => {
      await http().patch(`/v1/devices/${OWNER_DEVICE}`).send({ push_token: 'anon' }).expect(401);
    });
  });

  describe('SEC-3 -- no credential in the idempotency store', () => {
    it('records a non-secret marker; a replay answers OTP_EXPIRED and returns no credential', async () => {
      const s = await mobileSignIn();
      const rec = await admin.query(
        `SELECT response_body, response_body::text AS raw FROM core.idempotency_record
          WHERE key = $1 AND actor_id = $2`,
        [s.key, s.device],
      );
      expect(rec.rows).toHaveLength(1);
      expect(rec.rows[0].raw).not.toContain(s.token);
      expect(rec.rows[0].response_body).toEqual({
        credential_withheld: true,
        session_id: await sessionIdOf(s.token),
      });

      const replay = await http().post('/v1/auth/otp/verify').set('Idempotency-Key', s.key)
        .set('X-Adulis-Device', s.device).send(s.body).expect(401);
      expect(replay.body.code).toBe('OTP_EXPIRED');
      expect(replay.body.token).toBeUndefined();
      expect(replay.headers['x-adulis-idempotent-replay']).toBe('true');
      expect(replay.headers['set-cookie']).toBeUndefined();

      // Same key, different body: still the client bug it always was.
      await http().post('/v1/auth/otp/verify').set('Idempotency-Key', s.key)
        .set('X-Adulis-Device', s.device).send({ ...s.body, code: '000000' }).expect(409);
    });

    it('stores neither the console cookie nor the remembered-device secret', async () => {
      const device = randomUUID();
      devices.push(device);
      await http().post('/v1/devices').set('Idempotency-Key', randomUUID()).set('X-Adulis-Device', device)
        .send({ id: device, platform: 'ANDROID' }).expect(201);
      await admin.query(`UPDATE core.device SET market_id = $1 WHERE id = $2`, [M, device]);
      await http().post('/v1/auth/otp/request').set('Idempotency-Key', randomUUID())
        .set('X-Adulis-Device', device)
        .send({ phone: P_OWNER, purpose: 'SIGN_IN', audience: 'CONSOLE' }).expect(202);
      const boot = await http().get('/v1/bootstrap').set('X-Adulis-Client', 'web/9.9.9').expect(200);
      const browser = (boot.headers['set-cookie'] as unknown as string[])
        .find((c) => c.startsWith('__Host-adulis_browser='))?.split(';')[0] as string;
      devices.push(browser.split('=')[1] as string);
      const key = randomUUID();
      const r = await http().post('/v1/auth/otp/verify').set('Idempotency-Key', key)
        .set('Cookie', browser).set('X-Adulis-Client', 'web/9.9.9').set('Origin', CONSOLE_ORIGIN)
        .send({ phone: P_OWNER, code: sms.lastTo(P_OWNER)?.slots['code'] as string, remember_device: true })
        .expect(200);
      const cookies = r.headers['set-cookie'] as unknown as string[];
      const value = (name: string) =>
        cookies.find((c) => c.startsWith(`${name}=`))?.split(';')[0]?.split('=')[1] as string;
      const sessionSecret = value('__Host-adulis_session');
      const deviceSecret = value('__Host-adulis_device');
      expect(sessionSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(deviceSecret).toBeTruthy();
      const leaked = await admin.query(
        `SELECT count(*)::int AS n FROM core.idempotency_record
          WHERE response_body::text LIKE '%' || $1 || '%' OR response_body::text LIKE '%' || $2 || '%'`,
        [sessionSecret, deviceSecret],
      );
      expect(leaked.rows[0].n).toBe(0);
    });
  });

  describe('SEC-4 -- revocation', () => {
    it('self sign-out needs no step-up and kills the credential at once', async () => {
      const s = await mobileSignIn();
      await http().post('/v1/auth/logout').set('Authorization', `Bearer ${s.token}`).expect(204);
      await http().get('/v1/auth/sessions').set('Authorization', `Bearer ${s.token}`).expect(401);
      // DELETE on one's own id is the same ordinary sign-out, in any letter case.
      const t = await mobileSignIn();
      await http().delete(`/v1/auth/sessions/${(await sessionIdOf(t.token)).toUpperCase()}`)
        .set('Authorization', `Bearer ${t.token}`).expect(204);
      await http().get('/v1/auth/sessions').set('Authorization', `Bearer ${t.token}`).expect(401);
    });

    it('a console logout clears the session cookie', async () => {
      const r = await http().post('/v1/auth/logout').set('Cookie', cookie(OWNER_CON_S3))
        .set('Origin', CONSOLE_ORIGIN).expect(204);
      expect(String(r.headers['set-cookie'])).toMatch(/__Host-adulis_session=; Max-Age=0/);
      await http().get('/v1/auth/sessions').set('Cookie', cookie(OWNER_CON_S3)).expect(401);
    });

    it('MOBILE cannot revoke another session, with or without a step-up, nor revoke all', async () => {
      const denied = await http().delete(`/v1/auth/sessions/${OWNER_CON_S2}`)
        .set('Authorization', `Bearer ${sessionToken(OWNER_S)}`).expect(403);
      expect(denied.body.code).toBe('PERMISSION_DENIED');
      await http().delete(`/v1/auth/sessions/${OWNER_CON_S2}`)
        .set('Authorization', `Bearer ${sessionToken(OWNER_S)}`)
        .send({ step_up_challenge_id: await freshStepUp(OWNER) }).expect(403);
      await http().post('/v1/auth/sessions/revoke-others')
        .set('Authorization', `Bearer ${sessionToken(OWNER_S)}`)
        .send({ step_up_challenge_id: await freshStepUp(OWNER) }).expect(403);
      await http().get('/v1/auth/sessions').set('Cookie', cookie(OWNER_CON_S2)).expect(200);
    });

    it("CONSOLE revokes another session only with a one-use step-up bound to it; a stranger's is 404", async () => {
      const del = (target: string, body?: object) =>
        http().delete(`/v1/auth/sessions/${target}`)
          .set('Cookie', cookie(OWNER_CON_S)).set('Origin', CONSOLE_ORIGIN).send(body ?? {});
      const bare = await del(OWNER_CON_S2).expect(403);
      expect(bare.body.code).toBe('STEP_UP_REQUIRED');

      // An unbound REVOKE_ALL_SESSIONS proof covers one session, once.
      const unbound = await freshStepUp(OWNER);
      await del(OWNER_CON_S2, { step_up_challenge_id: unbound }).expect(204);
      await http().get('/v1/auth/sessions').set('Cookie', cookie(OWNER_CON_S2)).expect(401);
      const reuse = await del(OWNER_CON_S4, { step_up_challenge_id: unbound }).expect(403);
      expect(reuse.body.code).toBe('STEP_UP_REQUIRED');

      // A proof bound to one session cannot revoke another.
      await del(OWNER_CON_S4, { step_up_challenge_id: await freshStepUp(OWNER, OWNER_S) }).expect(403);
      await http().get('/v1/auth/sessions').set('Cookie', cookie(OWNER_CON_S4)).expect(200);
      await del(OWNER_CON_S4, { step_up_challenge_id: await freshStepUp(OWNER, OWNER_CON_S4) }).expect(204);

      await http().delete(`/v1/auth/sessions/${BUYER_S}`)
        .set('Cookie', cookie(OWNER_CON_S)).set('Origin', CONSOLE_ORIGIN)
        .send({ step_up_challenge_id: await freshStepUp(OWNER) }).expect(404);
    });

    it('revoke-others still demands its step-up, and never a proof bound to one session', async () => {
      const r = await http().post('/v1/auth/sessions/revoke-others')
        .set('Cookie', cookie(OWNER_CON_S)).set('Origin', CONSOLE_ORIGIN)
        .send({ step_up_challenge_id: randomUUID() }).expect(403);
      expect(r.body.code).toBe('STEP_UP_REQUIRED');
      const bound = await http().post('/v1/auth/sessions/revoke-others')
        .set('Cookie', cookie(OWNER_CON_S)).set('Origin', CONSOLE_ORIGIN)
        .send({ step_up_challenge_id: await freshStepUp(OWNER, OWNER_S) }).expect(403);
      expect(bound.body.code).toBe('STEP_UP_REQUIRED');
      await http().get('/v1/auth/sessions').set('Authorization', `Bearer ${sessionToken(OWNER_S)}`).expect(200);
    });
  });

  describe('account_context -- server-derived, Courier fail-closed', () => {
    const contextFor = async (session: string) =>
      (await http().get('/v1/bootstrap').set('Authorization', `Bearer ${sessionToken(session)}`).expect(200))
        .body.account_context;

    it('is null without a MOBILE session', async () => {
      expect((await http().get('/v1/bootstrap').expect(200)).body.account_context).toBeNull();
      const consoleBoot = await http().get('/v1/bootstrap').set('Cookie', cookie(OWNER_CON_S)).expect(200);
      expect(consoleBoot.body.account_context).toBeNull();
    });

    it.each([
      ['an ordinary Buyer', BUYER_S, false],
      ['a Seller owner', OWNER_S, true],
      ['an active team member', MEMBER_S, true],
      ['a revoked team member', MEMBER_REVOKED_S, false],
      ['a suspended team member', MEMBER_SUSPENDED_S, false],
      ['the owner of a deleted Seller only', DELETED_OWNER_S, false],
      ['a Courier with a live seller_courier relationship', COURIER_S, false],
    ])('%s', async (_label, session, seller) => {
      expect(await contextFor(session)).toEqual({
        buyer: { available: true },
        seller_companion: { available: seller },
        courier: { available: false },
      });
    });

    it('is never cached by a shared cache', async () => {
      const r = await http().get('/v1/bootstrap').set('Authorization', `Bearer ${sessionToken(OWNER_S)}`).expect(200);
      expect(r.headers['cache-control']).toBe('private, no-store');
    });

    it('ignores anything the client claims', async () => {
      const r = await http().get('/v1/bootstrap?mode=seller&courier=true')
        .set('Authorization', `Bearer ${sessionToken(BUYER_S)}`)
        .set('X-Adulis-Seller', SELLER)
        .expect(200);
      expect(r.body.account_context.seller_companion.available).toBe(false);
      expect(r.body.account_context.courier.available).toBe(false);
    });
  });

  describe('migration 0053 -- session credential schema', () => {
    it('token_hash is required, unique, 32 bytes, and defaults to an unusable random value', async () => {
      const cols = await admin.query(
        `SELECT is_nullable FROM information_schema.columns
          WHERE table_schema = 'core' AND table_name = 'session' AND column_name = 'token_hash'`,
      );
      expect(cols.rows[0].is_nullable).toBe('NO');
      const constraints = await admin.query(
        `SELECT conname FROM pg_constraint WHERE conrelid = 'core.session'::regclass
            AND conname IN ('session_token_hash_unique', 'session_token_hash_is_sha256') ORDER BY 1`,
      );
      expect(constraints.rows.map((r) => r.conname)).toEqual([
        'session_token_hash_is_sha256',
        'session_token_hash_unique',
      ]);
      // A writer that omits the hash gets a row no credential can open.
      const a = randomUUID();
      const b = randomUUID();
      await admin.query(
        `INSERT INTO core.session (id, account_id, audience, expires_at) VALUES
          ($1,$3,'MOBILE', now()+interval '1 hour'), ($2,$3,'MOBILE', now()+interval '1 hour')`,
        [a, b, BUYER],
      );
      const rows = await admin.query(
        `SELECT token_hash FROM core.session WHERE id = ANY($1::uuid[])`, [[a, b]],
      );
      expect(rows.rows.map((r) => (r.token_hash as Buffer).length)).toEqual([32, 32]);
      expect((rows.rows[0].token_hash as Buffer).equals(rows.rows[1].token_hash as Buffer)).toBe(false);
      await http().get('/v1/auth/sessions').set('Authorization', `Bearer ${a}`).expect(401);
      await http().get('/v1/auth/sessions').set('Authorization', `Bearer ${sessionToken(a)}`).expect(401);
    });

    it('the 0053 file signs every legacy session out and gives each an unmatchable hash', async () => {
      // Replays the migration FILE against a temporary copy of the pre-0053
      // table holding legacy rows, then rolls back. Nothing outside the
      // transaction is touched.
      const sqlText = readFileSync(
        resolve(__dirname, '..', '..', '..', 'db', 'migrations', '0053_session_token_hash.sql'), 'utf8',
      )
        .replaceAll('core.session', 'pg_temp.session_probe')
        .replaceAll('core.idempotency_record', 'pg_temp.idem_probe');
      const c = await admin.connect();
      try {
        await c.query('BEGIN');
        await c.query(`CREATE TEMP TABLE session_probe (LIKE core.session INCLUDING DEFAULTS INCLUDING CONSTRAINTS)`);
        await c.query(`ALTER TABLE session_probe DROP COLUMN token_hash`);
        await c.query(`CREATE TEMP TABLE idem_probe (LIKE core.idempotency_record INCLUDING DEFAULTS)`);
        await c.query(
          `INSERT INTO idem_probe (id, key, actor_kind, actor_id, endpoint, request_hash,
                                  response_status, response_body, expires_at)
           VALUES (gen_random_uuid(), gen_random_uuid(), 'DEVICE', gen_random_uuid(), 'POST /v1/auth/otp/verify',
                   '\\x00', 200, '{"session_token":"legacy","device_cookie_token":"live"}', now() + interval '1 day'),
                  (gen_random_uuid(), gen_random_uuid(), 'DEVICE', gen_random_uuid(), 'POST /v1/devices',
                   '\\x00', 201, '{"id":"kept"}', now() + interval '1 day')`,
        );
        const live = [randomUUID(), randomUUID(), randomUUID()];
        const revoked = randomUUID();
        await c.query(
          `INSERT INTO session_probe (id, account_id, audience, expires_at, revoked_at)
           SELECT x, $2::uuid, 'MOBILE'::core.session_audience, now() + interval '30 days', NULL::timestamptz
             FROM unnest($1::uuid[]) AS t(x)
           UNION ALL
           SELECT $3::uuid, $2::uuid, 'CONSOLE', now() + interval '1 hour', now() - interval '1 day'`,
          [live, BUYER, revoked],
        );
        await c.query(sqlText);
        const r = await c.query(
          `SELECT count(*)::int AS n,
                  count(*) FILTER (WHERE revoked_at IS NULL)::int AS still_live,
                  count(DISTINCT token_hash)::int AS distinct_hashes,
                  count(*) FILTER (WHERE octet_length(token_hash) = 32)::int AS sha256_sized,
                  count(*) FILTER (WHERE token_hash = sha256(convert_to(id::text, 'UTF8')))::int AS id_matches
             FROM session_probe`,
        );
        expect(r.rows[0]).toEqual({ n: 4, still_live: 0, distinct_hashes: 4, sha256_sized: 4, id_matches: 0 });
        // SEC-3: the legacy verify records holding raw tokens are gone; others stay.
        const idem = await c.query(`SELECT endpoint FROM idem_probe`);
        expect(idem.rows.map((x) => x.endpoint)).toEqual(['POST /v1/devices']);
      } finally {
        await c.query('ROLLBACK');
        c.release();
      }
      // And on the real table: no row's hash is the hash of its own id.
      const real = await admin.query(
        `SELECT count(*)::int AS n FROM core.session s
          WHERE s.token_hash = sha256(convert_to(s.id::text, 'UTF8'))`,
      );
      expect(real.rows[0].n).toBe(0);
    });
  });
});
