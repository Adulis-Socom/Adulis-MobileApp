import { randomUUID } from 'node:crypto';
import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * Claims evidence: who may attach a bank record to a claim.
 *
 * The seller side of POST /v1/claims/{id}/evidence is a write on the claim, so
 * it needs the claims response permission (seller.claims:respond), the same one
 * POST /v1/seller/claims/{id}/remedy needs. A role that can only read claims
 * (ANALYST) is refused, and the refusal writes nothing. The Buyer who opened
 * the claim attaches evidence exactly as before, and the store must be the
 * claim's own store.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const P = 'c1a10000-0000-4000-8000-0000000000';
const M = `${P}01`;
const SELLER_A = `${P}02`;
const SELLER_A2 = `${P}03`; // a second store of the same owner
const SELLER_B = `${P}04`;
const OWNER_A = `${P}05`;
const OWNER_B = `${P}06`;
const BUYER = `${P}07`;
const ANALYST_M = `${P}08`; // ANALYST of SELLER_A: claims:read, not claims:respond
const SUPPORT_M = `${P}09`; // SALES_SUPPORT of SELLER_A: claims:respond
const ADMIN_M = `${P}0a`; // ADMIN of SELLER_A, revoked during the run
const DEMOTE_M = `${P}0b`; // SALES_SUPPORT of SELLER_A, demoted to ANALYST during the run
const TM_ANALYST = `${P}0c`;
const TM_SUPPORT = `${P}0d`;
const TM_ADMIN = `${P}0e`;
const TM_DEMOTE = `${P}0f`;
const DEVICE = `${P}10`;
const ORDER = `${P}11`;
const CLAIM = `${P}12`;
const S_OWNER_A = `${P}13`;
const S_OWNER_B = `${P}14`;
const S_BUYER = `${P}15`; // MOBILE
const S_ANALYST = `${P}16`;
const S_SUPPORT = `${P}17`;
const S_ADMIN = `${P}18`;
const S_DEMOTE = `${P}19`;

const ACCOUNTS = [OWNER_A, OWNER_B, BUYER, ANALYST_M, SUPPORT_M, ADMIN_M, DEMOTE_M];
const SELLERS = [SELLER_A, SELLER_A2, SELLER_B];
const SESSIONS = [S_OWNER_A, S_OWNER_B, S_BUYER, S_ANALYST, S_SUPPORT, S_ADMIN, S_DEMOTE];

@Module({ imports: [AppModule] })
class ClaimsEvidenceAppModule {}

describe('claims evidence: attaching a bank record needs the response permission on the seller side', () => {
  let app: INestApplication;
  let admin: Pool;
  const http = () => request(app.getHttpServer());

  /** The seller side: a console session acting as the store named in the header. */
  const attachAsStore = (session: string, store: string, key: string, ref: string) =>
    http()
      .post(`/v1/claims/${CLAIM}/evidence`)
      .set('Cookie', `__Host-adulis_session=${sessionToken(session)}`)
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Seller', store)
      .set('Idempotency-Key', key)
      .send({ kind: 'BANK_RECORD', reference_id: ref });
  /** The Buyer side: a mobile session, no store header. */
  const attachAsBuyer = (key: string, ref: string) =>
    http()
      .post(`/v1/claims/${CLAIM}/evidence`)
      .set('Authorization', `Bearer ${sessionToken(S_BUYER)}`)
      .set('X-Adulis-Device', DEVICE)
      .set('Idempotency-Key', key)
      .send({ kind: 'BANK_RECORD', reference_id: ref });
  const rows = async (ref: string): Promise<number> =>
    Number(
      (
        await admin.query(
          `SELECT count(*) FROM core.claim_evidence_item
            WHERE claim_id = $1 AND kind = 'BANK_RECORD' AND reference_id = $2`,
          [CLAIM, ref],
        )
      ).rows[0].count,
    );
  const records = async (key: string): Promise<number> =>
    Number(
      (await admin.query(`SELECT count(*) FROM core.idempotency_record WHERE key = $1`, [key]))
        .rows[0].count,
    );
  /** The whole refusal in one comparison, so a failure prints the status, the body and what was written. */
  const expectRefusedAndUnwritten = async (
    r: request.Response,
    status: number,
    code: string,
    key: string,
    ref: string,
  ): Promise<void> => {
    const written = { evidenceRows: await rows(ref), idempotencyRecords: await records(key) };
    expect({ status: r.status, type: r.headers['content-type'], body: r.body, ...written }).toMatchObject({
      status,
      type: expect.stringMatching(/application\/problem\+json/),
      body: { status, code, retryable: false },
      evidenceRows: 0,
      idempotencyRecords: 0,
    });
    expect(r.body).not.toHaveProperty('evidence_item_id');
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'CWP','Claims write permission','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE', true, 'AFROMESSAGE')`,
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
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251911481001',$8,'ACTIVE'), ($2,'+251911481002',$8,'ACTIVE'),
        ($3,'+251911481003',$8,'ACTIVE'), ($4,'+251911481004',$8,'ACTIVE'),
        ($5,'+251911481005',$8,'ACTIVE'), ($6,'+251911481006',$8,'ACTIVE'),
        ($7,'+251911481007',$8,'ACTIVE')`,
      [OWNER_A, OWNER_B, BUYER, ANALYST_M, SUPPORT_M, ADMIN_M, DEMOTE_M, M],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status)
       VALUES ($1,$4,$5,'INDIVIDUAL','CW A','cwp-a','ACTIVE'),
              ($2,$4,$5,'INDIVIDUAL','CW A2','cwp-a2','ACTIVE'),
              ($3,$4,$6,'INDIVIDUAL','CW B','cwp-b','ACTIVE')`,
      [SELLER_A, SELLER_A2, SELLER_B, M, OWNER_A, OWNER_B],
    );
    await admin.query(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role) VALUES
        ($1,$5,$6,'ANALYST'), ($2,$5,$7,'SALES_SUPPORT'),
        ($3,$5,$8,'ADMIN'), ($4,$5,$9,'SALES_SUPPORT')`,
      [TM_ANALYST, TM_SUPPORT, TM_ADMIN, TM_DEMOTE, SELLER_A, ANALYST_M, SUPPORT_M, ADMIN_M, DEMOTE_M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at, last_activity_at)
       VALUES ($1,$8,'CONSOLE',$15, now()+interval '12 hours', now()),
              ($2,$9,'CONSOLE',$15, now()+interval '12 hours', now()),
              ($3,$10,'MOBILE',$15, now()+interval '30 days', now()),
              ($4,$11,'CONSOLE',$15, now()+interval '12 hours', now()),
              ($5,$12,'CONSOLE',$15, now()+interval '12 hours', now()),
              ($6,$13,'CONSOLE',$15, now()+interval '12 hours', now()),
              ($7,$14,'CONSOLE',$15, now()+interval '12 hours', now())`,
      [...SESSIONS, ...ACCOUNTS, DEVICE],
    );
    await armFixtureSessions(admin, SESSIONS);
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state, expires_at,
         clock_stopped_at, total_minor, total_currency, display_currency)
       VALUES ($1,$2,$3,$4,'PAYMENT_CONFIRMED', now() + interval '2 days', now(), 50000,'ETB','ETB')`,
      [ORDER, M, SELLER_A, BUYER],
    );
    await admin.query(
      `INSERT INTO core.claim (id, order_id, opened_by_kind, opened_by_account_id, trigger, state)
       VALUES ($1,$2,'BUYER',$3,'GOODS_NOT_RECEIVED','AWAITING_SELLER_EVIDENCE')`,
      [CLAIM, ORDER, BUYER],
    );

    const moduleRef = await Test.createTestingModule({ imports: [ClaimsEvidenceAppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    const accounts = ACCOUNTS.map((a) => `'${a}'`).join(',');
    const sellers = SELLERS.map((s) => `'${s}'`).join(',');
    // Evidence items are append-only by trigger: replica mode, children before parents.
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(`DELETE FROM core.claim_evidence_item WHERE claim_id = $1`, [CLAIM]);
    await admin.query(`DELETE FROM core.claim WHERE id = $1`, [CLAIM]);
    await admin.query(`DELETE FROM core."order" WHERE id = $1`, [ORDER]);
    await admin.query(`SET session_replication_role = DEFAULT`);
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id IN (${accounts})`,
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

  it('a read-only team role can read the claim but is refused, and nothing is written', async () => {
    const read = await http()
      .get(`/v1/claims/${CLAIM}`)
      .set('Cookie', `__Host-adulis_session=${sessionToken(S_ANALYST)}`)
      .set('X-Adulis-Seller', SELLER_A);
    expect({ status: read.status, viewer: read.body.viewer }).toEqual({ status: 200, viewer: 'SELLER' });

    const key = randomUUID();
    const ref = randomUUID();
    const r = await attachAsStore(S_ANALYST, SELLER_A, key, ref);
    await expectRefusedAndUnwritten(r, 403, 'PERMISSION_DENIED', key, ref);
  });

  it('a role that holds the response permission attaches evidence', async () => {
    const ref = randomUUID();
    const r = await attachAsStore(S_SUPPORT, SELLER_A, randomUUID(), ref);
    expect({ status: r.status, body: r.body }).toMatchObject({
      status: 201,
      body: { kind: 'BANK_RECORD', evidence_item_id: expect.any(String) },
    });
    expect(await rows(ref)).toBe(1);
  });

  it('the store owner attaches evidence', async () => {
    const ref = randomUUID();
    const r = await attachAsStore(S_OWNER_A, SELLER_A, randomUUID(), ref);
    expect({ status: r.status, body: r.body }).toMatchObject({
      status: 201,
      body: { kind: 'BANK_RECORD', evidence_item_id: expect.any(String) },
    });
    expect(await rows(ref)).toBe(1);
  });

  it('the Buyer who opened the claim still attaches evidence, once per record', async () => {
    const ref = randomUUID();
    const r = await attachAsBuyer(randomUUID(), ref);
    expect({ status: r.status, body: r.body }).toMatchObject({
      status: 201,
      body: { kind: 'BANK_RECORD', evidence_item_id: expect.any(String) },
    });
    expect(await rows(ref)).toBe(1);
    const again = await attachAsBuyer(randomUUID(), ref);
    expect(again.status).toBe(409);
    expect(await rows(ref)).toBe(1);
  });

  it('a revoked member is refused, and nothing is written', async () => {
    const before = randomUUID();
    const ok = await attachAsStore(S_ADMIN, SELLER_A, randomUUID(), before);
    expect(ok.status).toBe(201);
    await admin.query(`UPDATE core.seller_team_member SET revoked_at = now() WHERE id = $1`, [TM_ADMIN]);
    const key = randomUUID();
    const ref = randomUUID();
    const r = await attachAsStore(S_ADMIN, SELLER_A, key, ref);
    await expectRefusedAndUnwritten(r, 403, 'PERMISSION_DENIED', key, ref);
    expect(await rows(before)).toBe(1);
  });

  it('a member demoted to the read-only role is refused, and nothing is written', async () => {
    const before = randomUUID();
    const ok = await attachAsStore(S_DEMOTE, SELLER_A, randomUUID(), before);
    expect(ok.status).toBe(201);
    await admin.query(`UPDATE core.seller_team_member SET role = 'ANALYST' WHERE id = $1`, [TM_DEMOTE]);
    const key = randomUUID();
    const ref = randomUUID();
    const r = await attachAsStore(S_DEMOTE, SELLER_A, key, ref);
    await expectRefusedAndUnwritten(r, 403, 'PERMISSION_DENIED', key, ref);
    expect(await rows(before)).toBe(1);
  });

  it("a member of another store cannot attach to this store's claim", async () => {
    for (const store of [SELLER_B, SELLER_A]) {
      const key = randomUUID();
      const ref = randomUUID();
      const r = await attachAsStore(S_OWNER_B, store, key, ref);
      await expectRefusedAndUnwritten(r, 404, 'NOT_FOUND', key, ref);
    }
  });

  it("a store header that names another store than the claim's is refused", async () => {
    const key = randomUUID();
    const ref = randomUUID();
    const r = await attachAsStore(S_OWNER_A, SELLER_A2, key, ref);
    await expectRefusedAndUnwritten(r, 404, 'NOT_FOUND', key, ref);
  });
});
