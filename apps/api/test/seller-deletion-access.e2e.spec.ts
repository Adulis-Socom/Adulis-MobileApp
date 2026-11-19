import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * POST /v1/seller/deletion answers a caller who holds seller.account:delete for the named store on a console
 * session, and nobody else. Everyone else is refused: not-found when the
 * caller has no relationship with the store (the same answer as for a store that does not exist or has nothing
 * outstanding), permission-denied when the caller is a member without the permission, is no longer in good standing,
 * or presents a mobile session. The refusal carries no items, counts or store identifiers, and writes nothing.
 *
 * The store used throughout carries several deletion obligations at once, so a refused answer that described any of
 * them would be visible in the test.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = randomUUID();
const OWNER = randomUUID(); // owns SELLER_A and SELLER_T (the latter is transferred away)
const ADMIN_M = randomUUID(); // ADMIN of SELLER_A
const ANALYST_M = randomUUID(); // ANALYST of SELLER_A
const REVOKED_M = randomUUID(); // was an ADMIN of SELLER_A
const SUSPENDED_M = randomUUID(); // an ADMIN of SELLER_A, suspended
const STRANGER = randomUUID(); // no relationship with any store here
const OTHER_OWNER = randomUUID(); // owns SELLER_B and receives SELLER_T
const CLEAN_OWNER = randomUUID(); // owns SELLER_C, which owes nothing
const BUYER = randomUUID(); // buyer of every order
const DEVICE = randomUUID();
const SELLER_A = randomUUID(); // four obligations
const SELLER_B = randomUUID(); // one different obligation
const SELLER_C = randomUUID(); // none
const SELLER_T = randomUUID(); // one obligation; ownership moves from OWNER to OTHER_OWNER during the run
const SELLER_Z = randomUUID(); // does not exist
const ORDERS = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const CLAIM = randomUUID();
const PS = randomUUID();
const TRANSFER = randomUUID();

const FOUR = ['EVIDENCE_AWAITING_CONFIRMATION', 'OPEN_CLAIMS', 'ORDERS_AWAITING_HANDOFF', 'SUBSCRIPTION_PAST_DUE'];
const ALL_CODES = [...FOUR, 'DELETION_BLOCKED'];

const ACCOUNTS: Record<string, [string, string]> = {
  OWNER: [OWNER, '+251911600201'],
  ADMIN_M: [ADMIN_M, '+251911600202'],
  ANALYST_M: [ANALYST_M, '+251911600203'],
  REVOKED_M: [REVOKED_M, '+251911600204'],
  SUSPENDED_M: [SUSPENDED_M, '+251911600205'],
  STRANGER: [STRANGER, '+251911600206'],
  OTHER_OWNER: [OTHER_OWNER, '+251911600207'],
  CLEAN_OWNER: [CLEAN_OWNER, '+251911600208'],
  BUYER: [BUYER, '+251911600209'],
};
const ACCOUNT_IDS = Object.values(ACCOUNTS).map(([id]) => id);
const SELLERS = [SELLER_A, SELLER_B, SELLER_C, SELLER_T];

const S: Record<string, string> = {};
const sess = (name: string): string => (S[name] ??= randomUUID());

@Module({ imports: [AppModule] })
class SellerDeletionOrderModule {}

describe('seller deletion access', () => {
  let app: INestApplication;
  let admin: Pool;
  const http = () => request(app.getHttpServer());
  const bearer = (n: string) => ({ Authorization: `Bearer ${sessionToken(sess(n))}` });
  const cookie = (n: string) => ({ Cookie: `__Host-adulis_session=${sessionToken(sess(n))}`, Origin: CONSOLE_ORIGIN });

  const del = (auth: Record<string, string>, seller: string | null, challenge: string = randomUUID(), key: string = randomUUID()) => {
    let r = http().post('/v1/seller/deletion').set(auth).set('Idempotency-Key', key);
    if (seller) r = r.set('X-Adulis-Seller', seller);
    return r.send({ step_up_challenge_id: challenge });
  };

  /** A refusal that says nothing about the store: the envelope only, no items, no store ids, no obligation codes. */
  const expectNothingAboutTheStore = (r: request.Response, status: number, code: string, seller: string = SELLER_A): void => {
    expect(r.status).toBe(status);
    expect(r.body.code).toBe(code);
    expect(r.body.items).toBeUndefined();
    expect(r.body.slots).toBeUndefined();
    const text = JSON.stringify(r.body);
    expect(text).not.toContain(seller);
    for (const c of ALL_CODES) expect(text).not.toContain(c);
    expect(r.headers['x-adulis-idempotent-replay']).toBeUndefined();
  };
  /** The whole envelope except the per-request correlation id. */
  const stripId = (body: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'request_id'));
  const freshStepUp = async (account: string, action: 'SELLER_DELETION' | 'OWNERSHIP_TRANSFER', phone: string): Promise<string> => {
    const otp = randomUUID();
    await admin.query(
      `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash, expires_at, consumed_at, step_up_action)
       VALUES ($1,'STEP_UP',$2, decode('00','hex'), now() + interval '1 hour', now(), $3::core.step_up_action)`,
      [otp, phone, action],
    );
    const id = randomUUID();
    await admin.query(
      `INSERT INTO core.step_up_challenge (id, account_id, action, otp_challenge_id, satisfied_at, expires_at)
       VALUES ($1,$2,$3::core.step_up_action,$4, now(), now() + interval '1 hour')`,
      [id, account, action, otp],
    );
    return id;
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'SH9','Deletion order','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE', true, 'AFROMESSAGE')`,
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
    for (const [id, phone] of Object.values(ACCOUNTS)) {
      await admin.query(`INSERT INTO core.account (id, phone_e164, market_id, status) VALUES ($1,$2,$3,'ACTIVE')`, [id, phone, M]);
    }
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type, store_name, handle, status)
       VALUES ($1,$5,$6,'INDIVIDUAL','A','sdo-a','ACTIVE'),
              ($2,$5,$7,'INDIVIDUAL','B','sdo-b','ACTIVE'),
              ($3,$5,$8,'INDIVIDUAL','C','sdo-c','ACTIVE'),
              ($4,$5,$6,'INDIVIDUAL','T','sdo-t','ACTIVE')`,
      [SELLER_A, SELLER_B, SELLER_C, SELLER_T, M, OWNER, OTHER_OWNER, CLEAN_OWNER],
    );
    await admin.query(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role, revoked_at, suspended_at)
       VALUES ($1,$5,$6,'ADMIN', NULL, NULL),
              ($2,$5,$7,'ANALYST', NULL, NULL),
              ($3,$5,$8,'ADMIN', now(), NULL),
              ($4,$5,$9,'ADMIN', NULL, now())`,
      [randomUUID(), randomUUID(), randomUUID(), randomUUID(), SELLER_A, ADMIN_M, ANALYST_M, REVOKED_M, SUSPENDED_M],
    );
    const sessions: Array<[string, string, 'MOBILE' | 'CONSOLE']> = [
      ['owner_c', OWNER, 'CONSOLE'], ['owner_m', OWNER, 'MOBILE'],
      ['admin_c', ADMIN_M, 'CONSOLE'], ['admin_m', ADMIN_M, 'MOBILE'],
      ['analyst_c', ANALYST_M, 'CONSOLE'],
      ['revoked_c', REVOKED_M, 'CONSOLE'], ['suspended_c', SUSPENDED_M, 'CONSOLE'],
      ['stranger_m', STRANGER, 'MOBILE'], ['stranger_c', STRANGER, 'CONSOLE'],
      ['other_owner_c', OTHER_OWNER, 'CONSOLE'], ['clean_owner_c', CLEAN_OWNER, 'CONSOLE'],
    ];
    for (const [name, account, audience] of sessions) {
      await admin.query(
        `INSERT INTO core.session (id, account_id, audience, device_id, expires_at, last_activity_at)
         VALUES ($1,$2,$3::core.session_audience,$4, now() + CASE WHEN $3::core.session_audience = 'CONSOLE' THEN interval '12 hours'
                                          ELSE interval '30 days' END, now())`,
        [sess(name), account, audience, DEVICE],
      );
    }
    await armFixtureSessions(admin, sessions.map(([n]) => sess(n)));

    // SELLER_A: 2 payment-confirmed orders, 1 payment-submitted order, 1 open claim, a past-due subscription.
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state, expires_at, clock_stopped_at,
                                 total_minor, total_currency, display_currency)
       VALUES ($1,$3,$4,$5,'PAYMENT_CONFIRMED', now() + interval '2 days', now(), 50000,'ETB','ETB'),
              ($2,$3,$4,$5,'PAYMENT_CONFIRMED', now() + interval '2 days', now(), 50000,'ETB','ETB')`,
      [ORDERS[0], ORDERS[1], M, SELLER_A, BUYER],
    );
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state, expires_at, total_minor, total_currency, display_currency)
       VALUES ($1,$3,$4,$6,'PAYMENT_SUBMITTED', now() + interval '2 days', 50000,'ETB','ETB'),
              ($2,$3,$5,$6,'PAYMENT_SUBMITTED', now() + interval '2 days', 50000,'ETB','ETB')`,
      [ORDERS[2], ORDERS[3], M, SELLER_A, SELLER_B, BUYER],
    );
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state, expires_at, total_minor, total_currency, display_currency)
       VALUES ($1,$2,$3,$4,'PAYMENT_SUBMITTED', now() + interval '2 days', 50000,'ETB','ETB')`,
      [ORDERS[4], M, SELLER_T, BUYER],
    );
    await admin.query(
      `INSERT INTO core.claim (id, order_id, opened_by_kind, opened_by_account_id, trigger, state)
       VALUES ($1,$2,'BUYER',$3,'GOODS_NOT_RECEIVED','UNDER_REVIEW')`,
      [CLAIM, ORDERS[0], BUYER],
    );
    await admin.query(
      `INSERT INTO billing.price_schedule (id, market_id, tier, price_minor, currency, usd_reference_minor, fx_rate, derived_at, effective)
       VALUES ($1,$2,'LISTED',100000,'ETB',1800,55.0, now(), tstzrange(now() - interval '1 day', NULL))`,
      [PS, M],
    );
    await admin.query(
      `INSERT INTO billing.subscription (seller_id, state, tier, term, current_period_start, current_period_end,
         locked_rate_minor, locked_rate_currency, price_schedule_version_id)
       VALUES ($1,'PAST_DUE','LISTED','MONTHLY', now() - interval '40 days', now() - interval '10 days', 100000,'ETB',$2)`,
      [SELLER_A, PS],
    );

    const moduleRef = await Test.createTestingModule({ imports: [SellerDeletionOrderModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.listen(0, '127.0.0.1'); // listen first: the concurrent test sends several requests at once
  });

  afterAll(async () => {
    await app?.close();
    const accounts = ACCOUNT_IDS.map((a) => `'${a}'`).join(',');
    const sellers = SELLERS.map((s) => `'${s}'`).join(',');
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id IN (${accounts})`);
    await admin.query(`DELETE FROM billing.subscription_state_transition WHERE subscription_id IN (SELECT id FROM billing.subscription WHERE seller_id IN (${sellers}))`);
    await admin.query(`DELETE FROM billing.subscription WHERE seller_id IN (${sellers})`);
    await admin.query(`DELETE FROM billing.price_schedule WHERE id = $1`, [PS]);
    await admin.query(`DELETE FROM core.claim_evidence_item WHERE claim_id = $1`, [CLAIM]);
    await admin.query(`DELETE FROM core.claim WHERE id = $1`, [CLAIM]);
    await admin.query(`DELETE FROM core."order" WHERE seller_id IN (${sellers})`);
    await admin.query(`DELETE FROM core.seller_ownership_transfer WHERE seller_id IN (${sellers})`);
    await admin.query(`DELETE FROM core.step_up_challenge WHERE account_id IN (${accounts})`);
    await admin.query(`DELETE FROM core.otp_challenge WHERE phone_e164 LIKE '+2519116002__'`);
    await admin.query(`DELETE FROM core.notification WHERE recipient_account_id IN (${accounts})`);
    await admin.query(`DELETE FROM core.phone_reuse_block WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.session WHERE account_id IN (${accounts})`);
    await admin.query(`DELETE FROM core.seller_team_member WHERE seller_id IN (${sellers})`);
    await admin.query(`DELETE FROM core.seller_public_stats WHERE seller_id IN (${sellers})`);
    await admin.query(`DELETE FROM core.seller WHERE id IN (${sellers})`);
    await admin.query(`DELETE FROM core.device WHERE id = $1`, [DEVICE]);
    await admin.query(`DELETE FROM core.account WHERE id IN (${accounts})`);
    await admin.query(`DELETE FROM core.timing_config WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.market WHERE id = $1`, [M]);
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  describe('callers who are not the store Owner on a console session', () => {
    it('a signed-in account with no relationship to the store (mobile) gets the not-found answer and nothing about the store', async () => {
      expectNothingAboutTheStore(await del(bearer('stranger_m'), SELLER_A), 404, 'NOT_FOUND');
    });

    it('a signed-in account with no relationship to the store (console) gets the not-found answer and nothing about the store', async () => {
      expectNothingAboutTheStore(await del(cookie('stranger_c'), SELLER_A), 404, 'NOT_FOUND');
    });

    it('the answer is the same as for a store that does not exist and for a store with nothing outstanding', async () => {
      const owed = await del(bearer('stranger_m'), SELLER_A);
      const missing = await del(bearer('stranger_m'), SELLER_Z);
      const clean = await del(bearer('stranger_m'), SELLER_C);
      expect(missing.status).toBe(404);
      expect(clean.status).toBe(404);
      expect(stripId(owed.body)).toEqual(stripId(missing.body));
      expect(stripId(clean.body)).toEqual(stripId(missing.body));
    });

    it('the Owner of another store gets the not-found answer, and the other store is not described either', async () => {
      expectNothingAboutTheStore(await del(cookie('other_owner_c'), SELLER_A), 404, 'NOT_FOUND');
      // The Owner of SELLER_A naming SELLER_B: B owes one obligation of a different kind.
      expectNothingAboutTheStore(await del(cookie('owner_c'), SELLER_B, randomUUID()), 404, 'NOT_FOUND', SELLER_B);
    });

    it('a member without the permission gets permission-denied and nothing about the store', async () => {
      expectNothingAboutTheStore(await del(cookie('admin_c'), SELLER_A), 403, 'PERMISSION_DENIED');
      expectNothingAboutTheStore(await del(cookie('analyst_c'), SELLER_A), 403, 'PERMISSION_DENIED');
    });

    it('a member on a mobile session gets permission-denied and nothing about the store', async () => {
      expectNothingAboutTheStore(await del(bearer('admin_m'), SELLER_A), 403, 'PERMISSION_DENIED');
    });

    it('the Owner on a mobile session gets permission-denied: the permission is console-only', async () => {
      expectNothingAboutTheStore(await del(bearer('owner_m'), SELLER_A), 403, 'PERMISSION_DENIED');
    });

    it('a member who was removed, and one who is suspended, get permission-denied and nothing about the store', async () => {
      expectNothingAboutTheStore(await del(cookie('revoked_c'), SELLER_A), 403, 'PERMISSION_DENIED');
      expectNothingAboutTheStore(await del(cookie('suspended_c'), SELLER_A), 403, 'PERMISSION_DENIED');
    });

    it('a caller with no credential, and one with an unknown credential, get the session answer', async () => {
      const anonymous = await del({}, SELLER_A);
      expectNothingAboutTheStore(anonymous, 401, 'SESSION_EXPIRED');
      const unknown = await del({ Authorization: `Bearer ${sessionToken(randomUUID())}` }, SELLER_A);
      expectNothingAboutTheStore(unknown, 401, 'SESSION_EXPIRED');
    });

    it('a refused request writes nothing: no stored response, no store change, no step-up consumed', async () => {
      const su = await freshStepUp(OWNER, 'SELLER_DELETION', ACCOUNTS['OWNER']![1]);
      const key = randomUUID();
      expectNothingAboutTheStore(await del(bearer('stranger_m'), SELLER_A, su, key), 404, 'NOT_FOUND');
      expectNothingAboutTheStore(await del(cookie('admin_c'), SELLER_A, su, key), 403, 'PERMISSION_DENIED');
      const records = await admin.query(
        `SELECT count(*)::int AS n FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[]) AND endpoint = 'POST /v1/seller/deletion'`,
        [[STRANGER, ADMIN_M, ANALYST_M, REVOKED_M, SUSPENDED_M, OTHER_OWNER]],
      );
      expect(records.rows[0].n).toBe(0);
      const seller = await admin.query(`SELECT status FROM core.seller WHERE id = $1`, [SELLER_A]);
      expect(seller.rows[0].status).toBe('ACTIVE');
      const challenge = await admin.query(`SELECT consumed_at FROM core.step_up_challenge WHERE id = $1`, [su]);
      expect(challenge.rows[0].consumed_at).toBeNull();
    });

    it('the neighbouring seller routes keep refusing a caller with no relationship to the store', async () => {
      const blockers = await http().get('/v1/seller/deletion/blockers').set(bearer('stranger_m')).set('X-Adulis-Seller', SELLER_A);
      expectNothingAboutTheStore(blockers, 404, 'NOT_FOUND');
      const closure = await http().post('/v1/seller/closure').set(bearer('stranger_m')).set('X-Adulis-Seller', SELLER_A)
        .set('Idempotency-Key', randomUUID()).send({});
      expectNothingAboutTheStore(closure, 404, 'NOT_FOUND');
    });
  });

  describe('the Owner on a console session', () => {
    it('is still told every obligation with its count', async () => {
      const r = await del(cookie('owner_c'), SELLER_A);
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('DELETION_BLOCKED');
      const items = r.body.items as Array<{ code: string; slots: { count: number } }>;
      expect(items.map((i) => i.code).sort()).toEqual(FOUR);
      expect(Object.fromEntries(items.map((i) => [i.code, i.slots.count]))).toEqual({
        EVIDENCE_AWAITING_CONFIRMATION: 1,
        ORDERS_AWAITING_HANDOFF: 2,
        OPEN_CLAIMS: 1,
        SUBSCRIPTION_PAST_DUE: 1,
      });
    });

    it('still deletes a store that owes nothing, and the step-up is used', async () => {
      const su = await freshStepUp(CLEAN_OWNER, 'SELLER_DELETION', ACCOUNTS['CLEAN_OWNER']![1]);
      const r = await del(cookie('clean_owner_c'), SELLER_C, su);
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ deleted: true });
      const seller = await admin.query(`SELECT status FROM core.seller WHERE id = $1`, [SELLER_C]);
      expect(seller.rows[0].status).toBe('DELETED');
      const challenge = await admin.query(`SELECT consumed_at FROM core.step_up_challenge WHERE id = $1`, [su]);
      expect(challenge.rows[0].consumed_at).not.toBeNull();
    });
  });

  describe('the answer follows the current relationship', () => {
    it('after ownership moves, the former Owner is refused and the new Owner is told the obligations', async () => {
      const su = await freshStepUp(OWNER, 'OWNERSHIP_TRANSFER', ACCOUNTS['OWNER']![1]);
      await admin.query(
        `INSERT INTO core.seller_ownership_transfer
           (id, seller_id, from_account_id, to_account_id, step_up_challenge_id, activates_at, residual_role)
         VALUES ($1,$2,$3,$4,$5, now() - interval '1 minute', 'ANALYST')`,
        [TRANSFER, SELLER_T, OWNER, OTHER_OWNER, su],
      );
      // The first request to the store activates the due transfer; the former Owner is judged as what they now are.
      const former = await del(cookie('owner_c'), SELLER_T);
      expectNothingAboutTheStore(former, 403, 'PERMISSION_DENIED', SELLER_T);
      const incoming = await del(cookie('other_owner_c'), SELLER_T);
      expect(incoming.status).toBe(409);
      expect(incoming.body.code).toBe('DELETION_BLOCKED');
      expect((incoming.body.items as Array<{ code: string }>).map((i) => i.code)).toEqual(['EVIDENCE_AWAITING_CONFIRMATION']);
      // ...and the former Owner is still refused on a second try.
      expectNothingAboutTheStore(await del(cookie('owner_c'), SELLER_T), 403, 'PERMISSION_DENIED', SELLER_T);
    });

    it('no relationship, then a member, then a removed member: not-found, permission-denied, permission-denied', async () => {
      const member = randomUUID();
      expectNothingAboutTheStore(await del(cookie('stranger_c'), SELLER_B), 404, 'NOT_FOUND', SELLER_B);
      await admin.query(
        `INSERT INTO core.seller_team_member (id, seller_id, account_id, role) VALUES ($1,$2,$3,'ADMIN')`,
        [member, SELLER_B, STRANGER],
      );
      expectNothingAboutTheStore(await del(cookie('stranger_c'), SELLER_B), 403, 'PERMISSION_DENIED', SELLER_B);
      await admin.query(`UPDATE core.seller_team_member SET revoked_at = now() WHERE id = $1`, [member]);
      expectNothingAboutTheStore(await del(cookie('stranger_c'), SELLER_B), 403, 'PERMISSION_DENIED', SELLER_B);
    });
  });

  describe('concurrent requests', () => {
    it('each caller in a burst gets the answer for that caller, and a shared key crosses nothing', async () => {
      const shared = randomUUID();
      const sends = [
        ...Array.from({ length: 3 }, () => ['owner', del(cookie('owner_c'), SELLER_A)] as const),
        ...Array.from({ length: 3 }, () => ['stranger', del(bearer('stranger_m'), SELLER_A)] as const),
        ...Array.from({ length: 3 }, () => ['admin', del(cookie('admin_c'), SELLER_A)] as const),
        ['owner-shared', del(cookie('owner_c'), SELLER_A, randomUUID(), shared)] as const,
        ['stranger-shared', del(bearer('stranger_m'), SELLER_A, randomUUID(), shared)] as const,
      ];
      const results = await Promise.all(sends.map(async ([who, t]) => [who, await t] as const));
      for (const [who, r] of results) {
        if (who.startsWith('owner')) {
          expect(r.status).toBe(409);
          expect(r.body.code).toBe('DELETION_BLOCKED');
        } else if (who.startsWith('stranger')) {
          expectNothingAboutTheStore(r, 404, 'NOT_FOUND');
        } else {
          expectNothingAboutTheStore(r, 403, 'PERMISSION_DENIED');
        }
      }
    });
  });
});
