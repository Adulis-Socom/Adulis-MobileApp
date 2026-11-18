import { randomUUID } from 'node:crypto';
import { request as rawRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Controller, Module, Post, Req, Res } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';
import { Client, Pool } from 'pg';
import request from 'supertest';
import type { Response } from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { HandlerTransaction } from '../src/common/db/handler-transaction';
import { ReplayGrant } from '../src/common/auth/auth.guard';
import type { LocalizedRequest } from '../src/common/http/locale.middleware';
import type { Database } from '../src/common/db/database.types';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * SEC-003 -- a stored response is replayed only to the caller's CURRENT
 * authorisation, and seller deletion authorises before it answers.
 *
 *  F1  the route's declared permission(s), every one, are re-tested against
 *      the caller's current role before a replay is served, and an account
 *      with a due, unactivated ownership transfer away from the store is not
 *      served through any of its roles there;
 *  F2  ...and against the presenting session's surface;
 *  F4  POST /v1/seller/deletion checks seller.account:delete first.
 *
 * Also pinned: the 409 outcomes on a declared route with the permission held
 * and lost, the re-run a too-strict declaration costs, and what the two
 * dual-side routes (chat messages, claims evidence) do for a buyer, a store
 * member and an account that is both -- with and without X-Adulis-Seller.
 *
 * The harness is WO-SEC-002's (wo-sec-002-idempotency-security.e2e.spec.ts):
 * probes call the production HandlerTransaction exactly as handlers do, and
 * every authorised execution writes one marker row, so a rolled-back run is
 * visible as a counted execution with no surviving marker. The real-route
 * cases use the chat, claims, closure and deletion endpoints themselves.
 *
 * Roles are changed the way the approved model changes them: a revoke and a
 * new membership row (team invite), or an ownership transfer's residual role.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const P = '5ec00300-0003-4000-8000-0000000000';
const M = `${P}01`;
const OWNER = `${P}02`; // owns SELLER_A, SELLER_E and SELLER_F
const OTHER = `${P}03`; // buyer of SELLER_A; recipient of SELLER_E
const STRANGER = `${P}04`; // no relationship with any seller here
const MEMBER_1 = `${P}05`; // ADMIN of SELLER_A, re-invited as ANALYST
const MEMBER_2 = `${P}06`; // ADMIN of SELLER_A, re-invited as SALES_SUPPORT
const MEMBER_4 = `${P}07`; // ADMIN of SELLER_A, CONSOLE and MOBILE sessions
const MEMBER_5 = `${P}08`; // SALES_SUPPORT of SELLER_A, re-invited as ANALYST
const MEMBER_6 = `${P}09`; // ADMIN of SELLER_A, re-invited as INVENTORY
const MEMBER_7 = `${P}0a`; // ADMIN of SELLER_A (deletion)
const SELLER_A = `${P}0b`;
const SELLER_E = `${P}0c`; // transferred to OTHER during the run
const SELLER_F = `${P}0d`; // enters CLOSING during the run
const DEVICE = `${P}0e`;
const TM_1 = `${P}0f`;
const TM_2 = `${P}10`;
const TM_4 = `${P}11`;
const TM_5 = `${P}12`;
const TM_6 = `${P}13`;
const TM_7 = `${P}14`;
const S_OWNER = `${P}15`; // MOBILE
const S_OWNER_C = `${P}16`; // CONSOLE
const S_STRANGER = `${P}17`; // MOBILE
const S_M1 = `${P}18`; // MOBILE
const S_M2 = `${P}19`; // MOBILE
const S_M4_C = `${P}1a`; // CONSOLE
const S_M4 = `${P}1b`; // MOBILE
const S_M5 = `${P}1c`; // MOBILE
const S_M6_C = `${P}1d`; // CONSOLE
const S_M7_C = `${P}1e`; // CONSOLE
const CONV = `${P}1f`; // SELLER_A <-> OTHER as buyer
const ORDER = `${P}20`; // SELLER_A's order to OTHER (PAYMENT_CONFIRMED: a deletion blocker)
const CLAIM = `${P}21`; // OTHER's open claim on it (a second blocker)
const OTP_CH = `${P}22`;
const STEP_UP = `${P}23`;
const TRANSFER = `${P}24`;
// Review round (A-1, A-5, B-4).
const MEMBER_13 = `${P}25`; // ADMIN of SELLER_A, re-invited as INVENTORY
const MEMBER_15 = `${P}26`; // ADMIN of SELLER_A, re-invited as ANALYST
const TM_13 = `${P}27`;
const TM_15 = `${P}28`;
const S_M13 = `${P}29`; // MOBILE
const S_M15 = `${P}2a`; // MOBILE
const SELLER_G = `${P}2b`; // owned by OWNER, who also holds a membership in it; transferred to OTHER
const TM_G = `${P}2c`; // OWNER's ADMIN membership of SELLER_G
const OTP_CH2 = `${P}2d`;
const STEP_UP2 = `${P}2e`;
const TRANSFER2 = `${P}2f`;
const SELLER_H = `${P}30`; // owned by OTHER
const S_OTHER = `${P}31`; // MOBILE
// The race test: a member demoted while a request of theirs is in flight.
const MEMBER_16 = `${P}32`; // ADMIN of SELLER_A, demoted while a request of theirs is in flight
const TM_16 = `${P}33`;
const S_M16 = `${P}34`; // MOBILE
// The dual-side routes: a thread whose buyer owns no store, and one whose buyer owns the store it talks to.
const CONV_B = `${P}35`; // SELLER_A <-> STRANGER as buyer
const CONV_SELF = `${P}36`; // SELLER_A <-> OWNER as buyer (OWNER also owns SELLER_A)
const CONSOLE_ORIGIN = 'http://localhost:5173';
const ACCOUNTS = [
  OWNER, OTHER, STRANGER, MEMBER_1, MEMBER_2, MEMBER_4, MEMBER_5, MEMBER_6, MEMBER_7, MEMBER_13, MEMBER_15,
  MEMBER_16,
];
/** The latched probe's gate, as in WO-SEC-002's harness: pg_advisory_xact_lock(LATCH_GATE, body.latch). */
const LATCH_GATE = 0x5ec303;
const SELLERS = [SELLER_A, SELLER_E, SELLER_F, SELLER_G, SELLER_H];
const MARKER = 'wo-sec-003:';

/** Held by OWNER, ADMIN and SALES_SUPPORT; not by ANALYST, INVENTORY or CAMPAIGN_MANAGER. Both surfaces. */
const GRANT = 'seller.orders:respond';
/** Held by OWNER, ADMIN, SALES_SUPPORT and INVENTORY. Both surfaces. */
const READY_GRANT = 'seller.order_ready:update';
/** CONSOLE only; held by ADMIN. */
const CONSOLE_GRANT = 'seller.products:write';

/** Authorised handler executions per Idempotency-Key, rolled back or not. */
const executions = new Map<string, number>();

@Controller()
class WoSec003Probe {
  constructor(private readonly tx: HandlerTransaction) {}

  /** A seller-context write that asserts GRANT for the session's own surface, like every real one. */
  @Post('seller/wo-sec-003-probe')
  @ReplayGrant(GRANT)
  async probe(@Req() req: LocalizedRequest, @Res({ passthrough: true }) res: Response): Promise<unknown> {
    return this.tx.runIdempotent(req, res, 201, (trx) => this.authorised(trx, req, GRANT));
  }

  /** The same, for a CONSOLE-only permission. */
  @Post('seller/wo-sec-003-console-probe')
  @ReplayGrant(CONSOLE_GRANT)
  async consoleProbe(@Req() req: LocalizedRequest, @Res({ passthrough: true }) res: Response): Promise<unknown> {
    return this.tx.runIdempotent(req, res, 201, (trx) => this.authorised(trx, req, CONSOLE_GRANT));
  }

  /** Two declared permissions, both asserted, as on the scene and chat routes. */
  @Post('seller/wo-sec-003-two-code-probe')
  @ReplayGrant(READY_GRANT, GRANT)
  async twoCodeProbe(@Req() req: LocalizedRequest, @Res({ passthrough: true }) res: Response): Promise<unknown> {
    return this.tx.runIdempotent(req, res, 201, (trx) => this.authorised(trx, req, READY_GRANT, GRANT));
  }

  /** A declaration stricter than what the handler asserts: the lookup withholds, the handler passes. */
  @Post('seller/wo-sec-003-strict-probe')
  @ReplayGrant(CONSOLE_GRANT)
  async strictProbe(@Req() req: LocalizedRequest, @Res({ passthrough: true }) res: Response): Promise<unknown> {
    return this.tx.runIdempotent(req, res, 201, (trx) => this.authorised(trx, req, GRANT));
  }

  private async authorised(trx: Transaction<Database>, req: LocalizedRequest, ...codes: string[]): Promise<unknown> {
    for (const code of codes) {
      await sql`SELECT core.fn_has_permission(
        ${req.ctx?.accountId}, ${req.ctx?.sellerId}, ${code},
        ${req.auth?.audience ?? ''}::core.session_audience)`.execute(trx);
    }
    const key = req.headers['idempotency-key'] as string;
    executions.set(key, (executions.get(key) ?? 0) + 1);
    await sql`INSERT INTO core.rate_limit_bucket (subject_kind, subject_id, bucket_key, window_start)
              VALUES ('ACCOUNT', ${req.ctx?.accountId}, ${MARKER + key}, clock_timestamp())`.execute(trx);
    // A latched request waits here, permission passed and marker written, its transaction open and no record yet.
    const latch = (req.body as { latch?: number } | undefined)?.latch;
    if (latch !== undefined) await sql`SELECT pg_advisory_xact_lock(${LATCH_GATE}, ${latch})`.execute(trx);
    return { seller_id: req.ctx?.sellerId ?? null, body: req.body, run: randomUUID() };
  }
}

@Module({ imports: [AppModule], controllers: [WoSec003Probe] })
class WoSec003Module {}

/** The one error envelope, refusing with a non-retryable 4xx and no replay header. */
const expectProblem = (r: request.Response, status: number, code: string): void => {
  expect(r.status).toBe(status);
  expect(r.headers['content-type']).toMatch(/application\/problem\+json/);
  expect(r.body).toMatchObject({ status, code, retryable: false });
  expect(r.body.request_id).toBe(r.headers['x-adulis-request-id']);
  expect(r.headers['x-adulis-idempotent-replay']).toBeUndefined();
};

const expectReplay = (r: request.Response, status: number, body: unknown): void => {
  expect(r.status).toBe(status);
  expect(r.headers['x-adulis-idempotent-replay']).toBe('true');
  expect(r.body).toEqual(body);
};

describe('SEC-003 replay authorisation and seller deletion', () => {
  let app: INestApplication;
  let admin: Pool;
  const http = () => request(app.getHttpServer());
  const bearer = (session: string) => ({ Authorization: `Bearer ${sessionToken(session)}` });
  const cookie = (session: string) => ({
    Cookie: `__Host-adulis_session=${sessionToken(session)}`,
    Origin: CONSOLE_ORIGIN,
  });

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'SC3','SEC-003','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE', true, 'AFROMESSAGE')`,
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
    for (const [i, a] of ACCOUNTS.entries()) {
      await admin.query(
        `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES ($1,$2,$3,'ACTIVE')`,
        [a, `+2519114630${String(i + 1).padStart(2, '0')}`, M],
      );
    }
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status)
       VALUES ($1,$4,$5,'INDIVIDUAL','A','sec003-a','ACTIVE'),
              ($2,$4,$5,'INDIVIDUAL','E','sec003-e','ACTIVE'),
              ($3,$4,$5,'INDIVIDUAL','F','sec003-f','ACTIVE'),
              ($6,$4,$5,'INDIVIDUAL','G','sec003-g','ACTIVE'),
              ($7,$4,$8,'INDIVIDUAL','H','sec003-h','ACTIVE')`,
      [SELLER_A, SELLER_E, SELLER_F, M, OWNER, SELLER_G, SELLER_H, OTHER],
    );
    await admin.query(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role)
       VALUES ($1,$7,$8,'ADMIN'), ($2,$7,$9,'ADMIN'), ($3,$7,$10,'ADMIN'),
              ($4,$7,$11,'SALES_SUPPORT'), ($5,$7,$12,'ADMIN'), ($6,$7,$13,'ADMIN')`,
      [TM_1, TM_2, TM_4, TM_5, TM_6, TM_7, SELLER_A, MEMBER_1, MEMBER_2, MEMBER_4, MEMBER_5, MEMBER_6, MEMBER_7],
    );
    // TM_G: an Owner who also holds a membership row in their own store (the R12 fixture state).
    await admin.query(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role)
       VALUES ($1,$4,$5,'ADMIN'), ($2,$4,$6,'ADMIN'), ($3,$7,$8,'ADMIN')`,
      [TM_13, TM_15, TM_G, SELLER_A, MEMBER_13, MEMBER_15, SELLER_G, OWNER],
    );
    await admin.query(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role) VALUES ($1,$2,$3,'ADMIN')`,
      [TM_16, SELLER_A, MEMBER_16],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    const sessions: Array<[string, string, 'MOBILE' | 'CONSOLE']> = [
      [S_OWNER, OWNER, 'MOBILE'],
      [S_OWNER_C, OWNER, 'CONSOLE'],
      [S_STRANGER, STRANGER, 'MOBILE'],
      [S_M1, MEMBER_1, 'MOBILE'],
      [S_M2, MEMBER_2, 'MOBILE'],
      [S_M4_C, MEMBER_4, 'CONSOLE'],
      [S_M4, MEMBER_4, 'MOBILE'],
      [S_M5, MEMBER_5, 'MOBILE'],
      [S_M6_C, MEMBER_6, 'CONSOLE'],
      [S_M7_C, MEMBER_7, 'CONSOLE'],
      [S_M13, MEMBER_13, 'MOBILE'],
      [S_M15, MEMBER_15, 'MOBILE'],
      [S_OTHER, OTHER, 'MOBILE'],
      [S_M16, MEMBER_16, 'MOBILE'],
    ];
    for (const [id, account, audience] of sessions) {
      await admin.query(
        `INSERT INTO core.session (id, account_id, audience, device_id, expires_at, last_activity_at)
         VALUES ($1,$2,$3::core.session_audience,$4, now() + CASE WHEN $3::core.session_audience = 'CONSOLE' THEN interval '12 hours'
                                          ELSE interval '30 days' END, now())`,
        [id, account, audience, DEVICE],
      );
    }
    await armFixtureSessions(admin, sessions.map(([id]) => id));
    await admin.query(
      `INSERT INTO chat.conversation (id, seller_id, buyer_account_id, market_id) VALUES ($1,$2,$3,$4)`,
      [CONV, SELLER_A, OTHER, M],
    );
    await admin.query(
      `INSERT INTO chat.conversation (id, seller_id, buyer_account_id, market_id)
       VALUES ($1,$3,$4,$6), ($2,$3,$5,$6)`,
      [CONV_B, CONV_SELF, SELLER_A, STRANGER, OWNER, M],
    );
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state, expires_at,
         clock_stopped_at, total_minor, total_currency, display_currency)
       VALUES ($1,$2,$3,$4,'PAYMENT_CONFIRMED', now() + interval '2 days', now(), 50000,'ETB','ETB')`,
      [ORDER, M, SELLER_A, OTHER],
    );
    await admin.query(
      `INSERT INTO core.claim (id, order_id, opened_by_kind, opened_by_account_id, trigger, state)
       VALUES ($1,$2,'BUYER',$3,'GOODS_NOT_RECEIVED','AWAITING_SELLER_EVIDENCE')`,
      [CLAIM, ORDER, OTHER],
    );

    const moduleRef = await Test.createTestingModule({ imports: [WoSec003Module] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.listen(0, '127.0.0.1'); // listen first (WO-INFRA-005)
  });

  afterAll(async () => {
    await app?.close();
    const accounts = ACCOUNTS.map((a) => `'${a}'`).join(',');
    const sellers = SELLERS.map((s) => `'${s}'`).join(',');
    // The claim's evidence items are append-only by trigger: replica mode, children before parents.
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(`DELETE FROM core.claim_evidence_item WHERE claim_id = $1`, [CLAIM]);
    await admin.query(`DELETE FROM core.claim WHERE id = $1`, [CLAIM]);
    await admin.query(`DELETE FROM core."order" WHERE id = $1`, [ORDER]);
    await admin.query(`SET session_replication_role = DEFAULT`);
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id IN (${accounts})`,
      `DELETE FROM core.rate_limit_bucket WHERE bucket_key LIKE '${MARKER}%'`,
      `DELETE FROM chat.message WHERE conversation_id IN ('${CONV}','${CONV_B}','${CONV_SELF}')`,
      `DELETE FROM chat.conversation WHERE id IN ('${CONV}','${CONV_B}','${CONV_SELF}')`,
      `DELETE FROM core.seller_ownership_transfer WHERE seller_id IN ('${SELLER_E}','${SELLER_G}')`,
      `DELETE FROM core.step_up_challenge WHERE id IN ('${STEP_UP}','${STEP_UP2}')`,
      `DELETE FROM core.otp_challenge WHERE id IN ('${OTP_CH}','${OTP_CH2}')`,
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

  const probe = (session: string, sellerId: string, key: string, body: object) =>
    http().post('/v1/seller/wo-sec-003-probe').set(bearer(session)).set('X-Adulis-Seller', sellerId)
      .set('Idempotency-Key', key).send(body);
  const records = async (key: string): Promise<number> =>
    Number((await admin.query(`SELECT count(*) FROM core.idempotency_record WHERE key = $1`, [key])).rows[0].count);
  const markers = async (key: string): Promise<number> =>
    Number((await admin.query(`SELECT count(*) FROM core.rate_limit_bucket WHERE bucket_key = $1`,
      [MARKER + key])).rows[0].count);
  /** The approved way a role changes: revoke the membership, then a new row at the new role. */
  const reinvite = async (memberRow: string, account: string, role: string): Promise<void> => {
    await admin.query(`UPDATE core.seller_team_member SET revoked_at = now() WHERE id = $1`, [memberRow]);
    await admin.query(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role)
       VALUES ($1,$2,$3,$4::core.team_role)`,
      [randomUUID(), SELLER_A, account, role],
    );
  };
  /** A due, unactivated transfer of `seller` from OWNER to OTHER, leaving OWNER the ANALYST residual. */
  const dueTransfer = async (otp: string, stepUp: string, transfer: string, seller: string): Promise<void> => {
    await admin.query(
      `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash, expires_at, consumed_at, step_up_action)
       VALUES ($1,'STEP_UP','+251911463001', decode('00','hex'), now() + interval '1 hour', now(), 'OWNERSHIP_TRANSFER')`,
      [otp],
    );
    await admin.query(
      `INSERT INTO core.step_up_challenge (id, account_id, action, otp_challenge_id, satisfied_at, expires_at)
       VALUES ($1,$2,'OWNERSHIP_TRANSFER',$3, now(), now() + interval '1 hour')`,
      [stepUp, OWNER, otp],
    );
    await admin.query(
      `INSERT INTO core.seller_ownership_transfer
         (id, seller_id, from_account_id, to_account_id, step_up_challenge_id, activates_at, residual_role)
       VALUES ($1,$2,$3,$4,$5, now() - interval '1 minute', 'ANALYST')`,
      [transfer, seller, OWNER, OTHER, stepUp],
    );
  };
  /** The transfer's outcome: activated, the store's Owner, and OWNER's live roles there. */
  const transferOutcome = async (transfer: string) =>
    (
      await admin.query(
        `SELECT t.activated_at, s.owner_account_id,
                ARRAY(SELECT tm.role::text FROM core.seller_team_member tm
                       WHERE tm.seller_id = s.id AND tm.account_id = $2 AND tm.revoked_at IS NULL) AS roles
           FROM core.seller_ownership_transfer t JOIN core.seller s ON s.id = t.seller_id
          WHERE t.id = $1`,
        [transfer, OWNER],
      )
    ).rows[0];
  const expire = (key: string) =>
    admin.query(`UPDATE core.idempotency_record SET expires_at = now() - interval '1 minute' WHERE key = $1`, [key]);

  // The latch of the race test (WO-SEC-002's harness, INF-03 F2): the test holds the gate on its own connection; a probe
  // sent with body.latch waits for it after its permission check and marker, its transaction open and no record written.
  // Progress is read from pg_locks, never from elapsed time.
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const start = (t: request.Test): Promise<request.Response> => t.then((r) => r);
  const holdGate = async (latch: number): Promise<{ open: () => Promise<void> }> => {
    const c = new Client({ connectionString: ADMIN });
    await c.connect();
    await c.query('SELECT pg_advisory_lock($1, $2)', [LATCH_GATE, latch]);
    let opened = false;
    return {
      open: async () => {
        if (opened) return;
        opened = true;
        await c.query('SELECT pg_advisory_unlock($1, $2)', [LATCH_GATE, latch]);
        await c.end();
      },
    };
  };
  /** Resolves once some session waits for the gate: proof the request got that far. A deadline, not an iteration count. */
  const waitsOnGate = async (latch: number): Promise<void> => {
    for (const until = Date.now() + 8_000; Date.now() < until; ) {
      const r = await admin.query(
        `SELECT count(*)::int AS n FROM pg_locks
          WHERE locktype = 'advisory' AND classid = $1::oid AND objid = $2::oid AND objsubid = 2 AND NOT granted`,
        [LATCH_GATE, latch],
      );
      if (r.rows[0].n > 0) return;
      await sleep(20);
    }
    throw new Error(`no session waits on advisory lock (${LATCH_GATE}, ${latch})`);
  };

  describe('F1 -- the current role must still hold the route permission', () => {
    it('R1: a member re-invited at a role without the permission is not served the stored response', async () => {
      const key = randomUUID();
      const first = await probe(S_M1, SELLER_A, key, { n: 1 });
      expect(first.status).toBe(201);
      expectReplay(await probe(S_M1, SELLER_A, key, { n: 1 }), 201, first.body); // control
      await reinvite(TM_1, MEMBER_1, 'ANALYST');
      const r = await probe(S_M1, SELLER_A, key, { n: 1 });
      expectProblem(r, 403, 'PERMISSION_DENIED');
      expect(JSON.stringify(r.body)).not.toContain(first.body.run);
      expect(executions.get(key)).toBe(1);
      expect(await markers(key)).toBe(1);
      expect(await records(key)).toBe(1);
    });

    it('R2: a member re-invited at a role that keeps the permission is still served, without a re-run', async () => {
      const key = randomUUID();
      const first = await probe(S_M2, SELLER_A, key, { n: 2 });
      expect(first.status).toBe(201);
      await reinvite(TM_2, MEMBER_2, 'SALES_SUPPORT');
      expectReplay(await probe(S_M2, SELLER_A, key, { n: 2 }), 201, first.body);
      expect(executions.get(key)).toBe(1);
      expect(await records(key)).toBe(1);
    });

    it('R3: an outgoing Owner left with a residual role is not served the stored response after activation', async () => {
      const key = randomUUID();
      const first = await probe(S_OWNER, SELLER_E, key, { n: 3 });
      expect(first.status).toBe(201);
      await dueTransfer(OTP_CH, STEP_UP, TRANSFER, SELLER_E);
      // The first retry activates the due transfer and is judged as ANALYST.
      expectProblem(await probe(S_OWNER, SELLER_E, key, { n: 3 }), 403, 'PERMISSION_DENIED');
      const after = await transferOutcome(TRANSFER);
      expect(after.activated_at).not.toBeNull();
      expect(after.owner_account_id).toBe(OTHER);
      expect(after.roles).toEqual(['ANALYST']);
      // Now a live member: the stored Owner-era response is still not served.
      const r = await probe(S_OWNER, SELLER_E, key, { n: 3 });
      expectProblem(r, 403, 'PERMISSION_DENIED');
      expect(JSON.stringify(r.body)).not.toContain(first.body.run);
      expect(executions.get(key)).toBe(1);
      expect(await records(key)).toBe(1);
    });

    it('R12: an outgoing Owner who also holds a membership is not served while the transfer is due', async () => {
      const key = randomUUID();
      const first = await probe(S_OWNER, SELLER_G, key, { n: 12 });
      expect(first.status).toBe(201);
      expectReplay(await probe(S_OWNER, SELLER_G, key, { n: 12 }), 201, first.body); // control: no transfer
      await dueTransfer(OTP_CH2, STEP_UP2, TRANSFER2, SELLER_G);
      // Due but not activated: neither the Owner arm nor the ADMIN membership stands; the handler
      // activates, and the account is judged by the residual role activation leaves it.
      const r = await probe(S_OWNER, SELLER_G, key, { n: 12 });
      expectProblem(r, 403, 'PERMISSION_DENIED');
      expect(JSON.stringify(r.body)).not.toContain(first.body.run);
      const after = await transferOutcome(TRANSFER2);
      expect(after.activated_at).not.toBeNull();
      expect(after.owner_account_id).toBe(OTHER);
      expect(after.roles).toEqual(['ANALYST']); // the ADMIN membership was revoked by activation
      expect(executions.get(key)).toBe(1);
      expect(await records(key)).toBe(1);
    });

    it('R13: every declared permission must still be held: one of two is not enough', async () => {
      const key = randomUUID();
      const post = () =>
        http().post('/v1/seller/wo-sec-003-two-code-probe').set(bearer(S_M13)).set('X-Adulis-Seller', SELLER_A)
          .set('Idempotency-Key', key).send({ n: 13 });
      const first = await post();
      expect(first.status).toBe(201);
      expectReplay(await post(), 201, first.body); // control: ADMIN holds both
      await reinvite(TM_13, MEMBER_13, 'INVENTORY'); // holds READY_GRANT, not GRANT
      const r = await post();
      expectProblem(r, 403, 'PERMISSION_DENIED');
      expect(JSON.stringify(r.body)).not.toContain(first.body.run);
      expect(executions.get(key)).toBe(1);
      expect(await records(key)).toBe(1);
    });

    it('R14: with the permission held, a different body is still 409 and an expired record is still refused', async () => {
      const key = randomUUID();
      const first = await probe(S_OWNER, SELLER_A, key, { n: 14 });
      expect(first.status).toBe(201);
      expectProblem(await probe(S_OWNER, SELLER_A, key, { n: 140 }), 409, 'IDEMPOTENCY_KEY_REUSED');
      await expire(key);
      const r = await probe(S_OWNER, SELLER_A, key, { n: 14 });
      expectProblem(r, 409, 'IDEMPOTENCY_KEY_REUSED');
      expect(JSON.stringify(r.body)).not.toContain(first.body.run);
      expect(executions.get(key)).toBe(1);
      expect(await records(key)).toBe(1);
    });

    it('R15: with the permission lost, a different body and an expired record both get the handler 403', async () => {
      const kExpired = randomUUID();
      const kOther = randomUUID();
      expect((await probe(S_M15, SELLER_A, kExpired, { n: 15 })).status).toBe(201);
      expect((await probe(S_M15, SELLER_A, kOther, { n: 151 })).status).toBe(201);
      await expire(kExpired);
      await reinvite(TM_15, MEMBER_15, 'ANALYST');
      expectProblem(await probe(S_M15, SELLER_A, kExpired, { n: 15 }), 403, 'PERMISSION_DENIED');
      expectProblem(await probe(S_M15, SELLER_A, kOther, { n: 152 }), 403, 'PERMISSION_DENIED');
      expect([executions.get(kExpired), executions.get(kOther)]).toEqual([1, 1]);
      expect([await records(kExpired), await records(kOther)]).toEqual([1, 1]);
    });

    it('R16: a declaration stricter than its handler costs a re-run, still answers the stored response, and commits once', async () => {
      const key = randomUUID();
      const post = () =>
        http().post('/v1/seller/wo-sec-003-strict-probe').set(bearer(S_OWNER)).set('X-Adulis-Seller', SELLER_A)
          .set('Idempotency-Key', key).send({ n: 16 });
      const first = await post();
      expect(first.status).toBe(201);
      expectReplay(await post(), 201, first.body);
      expect(executions.get(key)).toBe(2); // the handler ran again...
      expect(await markers(key)).toBe(1); // ...and its run rolled back
      expect(await records(key)).toBe(1);
    });
  });

  describe('F2 -- the presenting surface must be one the permission reaches', () => {
    it('R4: a CONSOLE-only result is not replayed to a MOBILE session of the same account', async () => {
      const key = randomUUID();
      const post = (headers: Record<string, string>) =>
        http().post('/v1/seller/wo-sec-003-console-probe').set(headers).set('X-Adulis-Seller', SELLER_A)
          .set('Idempotency-Key', key).send({ n: 4 });
      const first = await post(cookie(S_M4_C));
      expect(first.status).toBe(201);
      expectReplay(await post(cookie(S_M4_C)), 201, first.body); // control: same surface
      const r = await post(bearer(S_M4));
      expectProblem(r, 403, 'PERMISSION_DENIED');
      expect(JSON.stringify(r.body)).not.toContain(first.body.run);
      expect(executions.get(key)).toBe(1);
      expect(await records(key)).toBe(1);
    });
  });

  describe('F1 on the real store-side routes outside /v1/seller', () => {
    it('R5: seller-side chat: a member re-invited without the messaging permissions is not served', async () => {
      const key = randomUUID();
      const send = () =>
        http().post(`/v1/conversations/${CONV}/messages`).set(bearer(S_M5)).set('X-Adulis-Seller', SELLER_A)
          .set('Idempotency-Key', key).send({ text: 'from m5' });
      const first = await send();
      expect(first.status).toBe(201);
      expectReplay(await send(), 201, first.body); // control
      await reinvite(TM_5, MEMBER_5, 'ANALYST');
      const r = await send();
      expectProblem(r, 403, 'PERMISSION_DENIED');
      expect(JSON.stringify(r.body)).not.toContain(first.body.message_id);
      const sent = await admin.query(
        `SELECT count(*)::int AS n FROM chat.message WHERE conversation_id = $1 AND sender_account_id = $2`,
        [CONV, MEMBER_5],
      );
      expect(sent.rows[0].n).toBe(1);
      expect(await records(key)).toBe(1);
    });

    it('R6: seller-side claims evidence: a member re-invited without claims access is not served', async () => {
      const key = randomUUID();
      const ref = randomUUID();
      const attach = () =>
        http().post(`/v1/claims/${CLAIM}/evidence`).set(cookie(S_M6_C)).set('X-Adulis-Seller', SELLER_A)
          .set('Idempotency-Key', key).send({ kind: 'BANK_RECORD', reference_id: ref });
      const first = await attach();
      expect(first.status).toBe(201);
      expectReplay(await attach(), 201, first.body); // control
      await reinvite(TM_6, MEMBER_6, 'INVENTORY');
      const r = await attach();
      expectProblem(r, 403, 'PERMISSION_DENIED');
      expect(JSON.stringify(r.body)).not.toContain(first.body.evidence_item_id);
      const items = await admin.query(
        `SELECT count(*)::int AS n FROM core.claim_evidence_item
          WHERE claim_id = $1 AND kind = 'BANK_RECORD' AND reference_id = $2`,
        [CLAIM, ref],
      );
      expect(items.rows[0].n).toBe(1);
      expect(await records(key)).toBe(1);
    });

    // The store header decides the side of a dual-side route, so it is part of what a retry means. A
    // buyer-side evidence retry that carries X-Adulis-Seller for a store the buyer also owns is judged
    // against that store's grants (claims:read is CONSOLE-only, so on MOBILE no role holds it); the
    // buyer-side re-run then meets the evidence uniqueness first and answers 409. Nothing is duplicated and
    // the answer is the same on every retry. Before this work such a retry was answered with the stored
    // 201; a header naming a store the buyer has no standing in always gave this 409 (R21 below). Clients
    // therefore send X-Adulis-Seller only on store-side calls, which the mobile client's tests pin.
    it('R17: buyer-side evidence retried with a header naming another store: 409, attached once', async () => {
      const key = randomUUID();
      const ref = randomUUID();
      const attach = () =>
        http().post(`/v1/claims/${CLAIM}/evidence`).set(bearer(S_OTHER)).set('X-Adulis-Seller', SELLER_H)
          .set('Idempotency-Key', key).send({ kind: 'BANK_RECORD', reference_id: ref });
      const first = await attach();
      expect(first.status).toBe(201);
      const again = await attach();
      expectProblem(again, 409, 'IDEMPOTENCY_KEY_REUSED');
      const items = await admin.query(
        `SELECT count(*)::int AS n FROM core.claim_evidence_item
          WHERE claim_id = $1 AND kind = 'BANK_RECORD' AND reference_id = $2`,
        [CLAIM, ref],
      );
      expect(items.rows[0].n).toBe(1);
      expect(await records(key)).toBe(1);
    });
  });

  describe('the dual-side routes: a retry is the same request only on the side it first named', () => {
    const say = (session: string, conv: string, key: string, text: string, seller?: string) => {
      const t = http().post(`/v1/conversations/${conv}/messages`).set(bearer(session)).set('Idempotency-Key', key);
      return (seller ? t.set('X-Adulis-Seller', seller) : t).send({ text });
    };
    const attach = (session: string, key: string, ref: string, seller?: string) => {
      const t = http().post(`/v1/claims/${CLAIM}/evidence`).set(bearer(session)).set('Idempotency-Key', key);
      return (seller ? t.set('X-Adulis-Seller', seller) : t).send({ kind: 'BANK_RECORD', reference_id: ref });
    };
    const said = async (conv: string, text: string): Promise<number> =>
      Number((await admin.query(`SELECT count(*) FROM chat.message WHERE conversation_id = $1 AND body = $2`,
        [conv, text])).rows[0].count);
    const attached = async (ref: string): Promise<number> =>
      Number((await admin.query(`SELECT count(*) FROM core.claim_evidence_item WHERE claim_id = $1 AND reference_id = $2`,
        [CLAIM, ref])).rows[0].count);
    /** A request whose response the client never reads: the socket is dropped as soon as the body is written. */
    const lostResponse = (path: string, headers: Record<string, string>, body: object): Promise<void> =>
      new Promise((resolve) => {
        const data = JSON.stringify(body);
        const req = rawRequest({
          host: '127.0.0.1',
          port: (app.getHttpServer().address() as AddressInfo).port,
          path,
          method: 'POST',
          headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...headers },
        });
        req.on('error', () => undefined);
        req.end(data, () => {
          req.destroy();
          resolve();
        });
      });
    /** Resolves once the server has committed a record for `key`: the work the client never saw has finished. */
    const committed = async (key: string): Promise<void> => {
      for (const until = Date.now() + 8_000; Date.now() < until; await sleep(20)) if ((await records(key)) > 0) return;
      throw new Error(`no record was committed for ${key}`);
    };

    it('R18: a buyer who owns no store: a retry is the stored response; a changed body or an expired record is refused; one message exists', async () => {
      const key = randomUUID();
      const text = `r18-${key}`;
      const first = await say(S_STRANGER, CONV_B, key, text);
      expect(first.status).toBe(201);
      expectReplay(await say(S_STRANGER, CONV_B, key, text), 201, first.body);
      expectProblem(await say(S_STRANGER, CONV_B, key, `${text}-changed`), 409, 'IDEMPOTENCY_KEY_REUSED');
      await expire(key);
      const r = await say(S_STRANGER, CONV_B, key, text);
      expectProblem(r, 409, 'IDEMPOTENCY_KEY_REUSED');
      expect(JSON.stringify(r.body)).not.toContain(first.body.message_id);
      expect([await said(CONV_B, text), await said(CONV_B, `${text}-changed`)]).toEqual([1, 0]);
      expect(await records(key)).toBe(1);
    });

    it('R19: a buyer who also owns a store and sends no store header: chat and evidence retries are the stored responses', async () => {
      const keyChat = randomUUID();
      const text = `r19-${keyChat}`;
      const chat = await say(S_OTHER, CONV, keyChat, text);
      expect(chat.status).toBe(201);
      expectReplay(await say(S_OTHER, CONV, keyChat, text), 201, chat.body);
      const keyEvidence = randomUUID();
      const ref = randomUUID();
      const evidence = await attach(S_OTHER, keyEvidence, ref);
      expect(evidence.status).toBe(201);
      expectReplay(await attach(S_OTHER, keyEvidence, ref), 201, evidence.body);
      expect([await said(CONV, text), await attached(ref)]).toEqual([1, 1]);
      expect([await records(keyChat), await records(keyEvidence)]).toEqual([1, 1]);
    });

    it('R20: a buyer-side chat retry that also names a store the account owns is still the stored response, once', async () => {
      const key = randomUUID();
      const text = `r20-${key}`;
      const first = await say(S_OTHER, CONV, key, text, SELLER_H);
      expect(first.status).toBe(201);
      // The owner holds the store's messaging grants on MOBILE, so the stored response is served directly.
      expectReplay(await say(S_OTHER, CONV, key, text, SELLER_H), 201, first.body);
      expect(await said(CONV, text)).toBe(1);
      expect(await records(key)).toBe(1);
    });

    it('R21: buyer-side evidence retried with a header naming a store the account has no standing in: 409, attached once', async () => {
      const key = randomUUID();
      const ref = randomUUID();
      const first = await attach(S_OTHER, key, ref, SELLER_F);
      expect(first.status).toBe(201);
      const again = await attach(S_OTHER, key, ref, SELLER_F);
      expectProblem(again, 409, 'IDEMPOTENCY_KEY_REUSED');
      expect(JSON.stringify(again.body)).not.toContain(first.body.evidence_item_id);
      expect(await attached(ref)).toBe(1);
      expect(await records(key)).toBe(1);
    });

    it('R22: a store reply retried without the store header, or under another store the account owns, is never the stored response', async () => {
      const key = randomUUID();
      const text = `r22-${key}`;
      const first = await say(S_OWNER, CONV, key, text, SELLER_A);
      expect(first.status).toBe(201);
      expectReplay(await say(S_OWNER, CONV, key, text, SELLER_A), 201, first.body); // control
      for (const seller of [undefined, SELLER_F]) {
        const r = await say(S_OWNER, CONV, key, text, seller);
        expectProblem(r, 409, 'IDEMPOTENCY_KEY_REUSED');
        expect(JSON.stringify(r.body)).not.toContain(first.body.message_id);
      }
      expect(await said(CONV, text)).toBe(1);
      expect(await records(key)).toBe(1);
    });

    it('R23: an Owner talking to their own store: a key never crosses from the buyer side to the store side or back', async () => {
      const asBuyer = randomUUID();
      const asStore = randomUUID();
      const text = `r23-${asBuyer}`;
      const buyer = await say(S_OWNER, CONV_SELF, asBuyer, text);
      const store = await say(S_OWNER, CONV_SELF, asStore, text, SELLER_A);
      expect([buyer.status, store.status]).toEqual([201, 201]);
      expectReplay(await say(S_OWNER, CONV_SELF, asBuyer, text), 201, buyer.body);
      expectReplay(await say(S_OWNER, CONV_SELF, asStore, text, SELLER_A), 201, store.body);
      expectProblem(await say(S_OWNER, CONV_SELF, asBuyer, text, SELLER_A), 409, 'IDEMPOTENCY_KEY_REUSED');
      expectProblem(await say(S_OWNER, CONV_SELF, asStore, text), 409, 'IDEMPOTENCY_KEY_REUSED');
      const sent = await admin.query(
        `SELECT sender_kind::text AS kind FROM chat.message WHERE conversation_id = $1 AND body = $2`,
        [CONV_SELF, text],
      );
      expect(sent.rows.map((m) => m.kind).sort()).toEqual(['BUYER', 'SELLER']);
      expect([await records(asBuyer), await records(asStore)]).toEqual([1, 1]);
    });

    it('R24: two identical buyer-side requests at once: one message, and both answers are the same stored response', async () => {
      const key = randomUUID();
      const text = `r24-${key}`;
      const [a, b] = await Promise.all([say(S_STRANGER, CONV_B, key, text), say(S_STRANGER, CONV_B, key, text)]);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(a.body).toEqual(b.body);
      expect([a, b].filter((r) => r.headers['x-adulis-idempotent-replay'] === 'true')).toHaveLength(1);
      expect(await said(CONV_B, text)).toBe(1);
      expect(await records(key)).toBe(1);
    });

    it('R25: a response the client never read: the retry is the stored response and nothing is written twice', async () => {
      const key = randomUUID();
      const text = `r25-${key}`;
      await lostResponse(`/v1/conversations/${CONV_B}/messages`, { ...bearer(S_STRANGER), 'Idempotency-Key': key }, { text });
      await committed(key);
      const stored = await admin.query(`SELECT id FROM chat.message WHERE conversation_id = $1 AND body = $2`, [CONV_B, text]);
      const r = await say(S_STRANGER, CONV_B, key, text);
      expect(r.status).toBe(201);
      expect(r.headers['x-adulis-idempotent-replay']).toBe('true');
      expect(r.body.message_id).toBe(stored.rows[0].id);
      expect(await said(CONV_B, text)).toBe(1);
      expect(await records(key)).toBe(1);
    });
  });

  describe('a retry that races an in-flight original is judged on the CURRENT role', () => {
    it('T1: original in flight, its member demoted, then the same-key retry: 403 and no stored body; the original commits once; a later retry is 403 too', async () => {
      const key = randomUUID();
      const body = { n: 71, latch: 71 };
      const gate = await holdGate(71);
      try {
        const original = start(probe(S_M16, SELLER_A, key, body));
        await waitsOnGate(71); // the original: its permission check passed, marker written, transaction open, no record
        await reinvite(TM_16, MEMBER_16, 'ANALYST'); // now demoted to a role without the permission
        const retry = await probe(S_M16, SELLER_A, key, body);
        expectProblem(retry, 403, 'PERMISSION_DENIED'); // not the original's response (it does not exist yet), not a second run
        await gate.open();
        const first = await original;
        expect(first.status).toBe(201); // the original had passed its own check; the demotion came after
        expect(first.headers['x-adulis-idempotent-replay']).toBeUndefined();
        expect(JSON.stringify(retry.body)).not.toContain(first.body.run);
        expect(executions.get(key)).toBe(1); // the retry was refused before its handler counted an execution
        expect(await markers(key)).toBe(1);
        expect(await records(key)).toBe(1);
        // After the commit the stored response exists; the demoted caller still does not get it.
        const later = await probe(S_M16, SELLER_A, key, body);
        expectProblem(later, 403, 'PERMISSION_DENIED');
        expect(JSON.stringify(later.body)).not.toContain(first.body.run);
        expect(executions.get(key)).toBe(1);
      } finally {
        await gate.open();
      }
    });
  });

  describe('F4 -- POST /v1/seller/deletion authorises before it answers', () => {
    const del = (headers: Record<string, string>) =>
      http().post('/v1/seller/deletion').set(headers).set('X-Adulis-Seller', SELLER_A)
        .set('Idempotency-Key', randomUUID()).send({ step_up_challenge_id: randomUUID() });

    it('R7a: a caller with no relationship to the store gets the not-found answer and nothing about it', async () => {
      const r = await del(bearer(S_STRANGER));
      expectProblem(r, 404, 'NOT_FOUND');
      expect(r.body.items).toBeUndefined();
      expect(JSON.stringify(r.body)).not.toContain(SELLER_A);
    });

    it('R7b: a member without seller.account:delete gets 403 and nothing about the store', async () => {
      const r = await del(cookie(S_M7_C));
      expectProblem(r, 403, 'PERMISSION_DENIED');
      expect(r.body.items).toBeUndefined();
    });

    it('R7c: control: the Owner still gets DELETION_BLOCKED with every blocker', async () => {
      const r = await del(cookie(S_OWNER_C));
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('DELETION_BLOCKED');
      expect((r.body.items as Array<{ code: string }>).map((i) => i.code).sort())
        .toEqual(['OPEN_CLAIMS', 'ORDERS_AWAITING_HANDOFF']);
    });
  });

  describe('legitimate retries keep their replay', () => {
    it('R9: a closure retried after the store became CLOSING is the stored response', async () => {
      const key = randomUUID();
      const close = () =>
        http().post('/v1/seller/closure').set(cookie(S_OWNER_C)).set('X-Adulis-Seller', SELLER_F)
          .set('Idempotency-Key', key).send({});
      const first = await close();
      expect(first.status).toBe(200);
      expect(first.body).toEqual({ status: 'CLOSING' });
      expectReplay(await close(), 200, first.body);
      expect(await records(key)).toBe(1);
    });
  });
});
