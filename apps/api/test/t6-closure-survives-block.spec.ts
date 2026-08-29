import { randomUUID } from 'node:crypto';
import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * T6 / G1.3 -- closure survives a deletion block.
 *
 * ADU-API-01 v1.7 S12.12: "POST /v1/seller/closure remains available when
 * POST /v1/seller/deletion is blocked. A buyer or seller who wants out
 * immediately closes now and deletes when the money settles. Every blocker
 * names its clearing action, and items[] carries all of them, never the
 * first -- a bare refusal is what fails an app-store review; a stated
 * obligation with a route through it does not."
 *
 * The code satisfied this INCIDENTALLY: the two paths were never wired
 * together, so nothing connected them and nothing proved they stayed
 * unconnected. That is the whole reason this file exists. A future change
 * that gates closure on fn_deletion_blockers -- an entirely reasonable-
 * looking change, since deletion does -- would take the escape hatch away
 * and no other test would notice.
 *
 * FOUR simultaneous blockers, not one. C6 already proves a single blocker
 * surfaces; a single blocker cannot tell "all of them" from "the first",
 * which is exactly the failure the ruling names. The seller below owes on
 * four independent counts at once.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = randomUUID();
const OWNER = randomUUID();
const BUYER = randomUUID();
const DEVICE = randomUUID();
const OWNER_S = randomUUID();
const SELLER = randomUUID();
const O_SUBMITTED = randomUUID();
const O_CONFIRMED = randomUUID();
const CLAIM = randomUUID();
const PS = randomUUID();

const FOUR = [
  'EVIDENCE_AWAITING_CONFIRMATION',
  'OPEN_CLAIMS',
  'ORDERS_AWAITING_HANDOFF',
  'SUBSCRIPTION_PAST_DUE',
];

interface Item {
  code: string;
  slots?: { count?: number };
  resolving_action?: { kind?: string };
}

@Module({ imports: [AppModule] })
class T6AppModule {}

describe('T6 / G1.3 -- closure stays open while deletion is blocked', () => {
  let app: INestApplication;
  let admin: Pool;

  const cookie = (t: string) => `__Host-adulis_session=${t}`;
  const asOwner = (method: 'post' | 'delete' | 'get', path: string) =>
    request(app.getHttpServer())[method](path)
      .set('Cookie', cookie(OWNER_S))
      .set('X-Adulis-Seller', SELLER)
      .set('Origin', CONSOLE_ORIGIN);

  const freshStepUp = async (action: string): Promise<string> => {
    const otp = randomUUID();
    await admin.query(
      `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash,
         expires_at, consumed_at, step_up_action)
       VALUES ($1,'STEP_UP','+251919960001', decode('00','hex'),
               now() + interval '1 hour', now(), $2::core.step_up_action)`,
      [otp, action],
    );
    const id = randomUUID();
    await admin.query(
      `INSERT INTO core.step_up_challenge
         (id, account_id, action, otp_challenge_id, satisfied_at, expires_at)
       VALUES ($1,$2,$3::core.step_up_action,$4, now(), now() + interval '1 hour')`,
      [id, OWNER, action, otp],
    );
    return id;
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live)
       VALUES ($1,'T6X','Closure','PHASE_1','ETB','Africa/Addis_Ababa','en',false)`,
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
       VALUES ($1,'+251919960001',$3,'ACTIVE'), ($2,'+251919960002',$3,'ACTIVE')`,
      [OWNER, BUYER, M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at)
       VALUES ($1,$2,'CONSOLE',$3, now() + interval '12 hours')`,
      [OWNER_S, OWNER, DEVICE],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','Owes On Four','t6-owes-four','ACTIVE')`,
      [SELLER, M, OWNER],
    );

    // ---- blocker 1: EVIDENCE_AWAITING_CONFIRMATION -------------------------
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id,
         state, expires_at, total_minor, total_currency, display_currency)
       VALUES ($1,$2,$3,$4,'PAYMENT_SUBMITTED', now() + interval '2 days',
               50000,'ETB','ETB')`,
      [O_SUBMITTED, M, SELLER, BUYER],
    );
    // ---- blocker 2: ORDERS_AWAITING_HANDOFF --------------------------------
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id,
         state, expires_at, clock_stopped_at, total_minor, total_currency,
         display_currency)
       VALUES ($1,$2,$3,$4,'PAYMENT_CONFIRMED', now() + interval '2 days',
               now(), 50000,'ETB','ETB')`,
      [O_CONFIRMED, M, SELLER, BUYER],
    );
    // ---- blocker 3: OPEN_CLAIMS -------------------------------------------
    await admin.query(
      `INSERT INTO core.claim (id, order_id, opened_by_kind, opened_by_account_id,
         trigger, state)
       VALUES ($1,$2,'BUYER',$3,'GOODS_NOT_RECEIVED','UNDER_REVIEW')`,
      [CLAIM, O_CONFIRMED, BUYER],
    );
    // ---- blocker 4: SUBSCRIPTION_PAST_DUE ----------------------------------
    await admin.query(
      `INSERT INTO billing.price_schedule (id, market_id, tier, price_minor,
         currency, usd_reference_minor, fx_rate, derived_at, effective)
       VALUES ($1,$2,'LISTED',100000,'ETB',1800,55.0, now(),
               tstzrange(now() - interval '1 day', NULL))`,
      [PS, M],
    );
    await admin.query(
      `INSERT INTO billing.subscription (seller_id, state, tier, term,
         current_period_start, current_period_end, locked_rate_minor,
         locked_rate_currency, price_schedule_version_id)
       VALUES ($1,'PAST_DUE','LISTED','MONTHLY', now() - interval '40 days',
               now() - interval '10 days', 100000,'ETB',$2)`,
      [SELLER, PS],
    );

    const moduleRef = await Test.createTestingModule({ imports: [T6AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = $1`, [OWNER]);
    await admin.query(`DELETE FROM billing.subscription WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM billing.price_schedule WHERE id = $1`, [PS]);
    await admin.query(`DELETE FROM core.claim WHERE id = $1`, [CLAIM]);
    await admin.query(`DELETE FROM core."order" WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.step_up_challenge WHERE account_id = $1`, [OWNER]);
    await admin.query(`DELETE FROM core.otp_challenge WHERE phone_e164 = '+251919960001'`);
    await admin.query(`DELETE FROM core.seller_public_stats WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller WHERE id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.session WHERE id = $1`, [OWNER_S]);
    await admin.query(`DELETE FROM core.device WHERE id = $1`, [DEVICE]);
    await admin.query(`DELETE FROM core.account WHERE id = ANY($1::uuid[])`, [[OWNER, BUYER]]);
    await admin.query(`DELETE FROM core.timing_config WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.market WHERE id = $1`, [M]);
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  it('the database returns every standing blocker, not the first', async () => {
    const r = await admin.query<{ blocker: string; count: number; resolving_action: string }>(
      `SELECT * FROM core.fn_deletion_blockers($1)`,
      [SELLER],
    );
    expect(r.rows.map((x) => x.blocker).sort()).toEqual(FOUR);
    // Every one of them names its clearing action, and it is a stable key
    // the client localises -- never assembled prose (S7).
    for (const row of r.rows) {
      expect(row.resolving_action).toMatch(/^[A-Z][A-Z_]+$/);
      expect(Number(row.count)).toBeGreaterThan(0);
    }
  });

  it('POST /v1/seller/deletion refuses with ALL of them in items[]', async () => {
    const su = await freshStepUp('SELLER_DELETION');
    const refused = await asOwner('post', '/v1/seller/deletion')
      .set('Idempotency-Key', randomUUID())
      .send({ step_up_challenge_id: su })
      .expect(409);

    expect(refused.body.code).toBe('DELETION_BLOCKED');
    const items = refused.body.items as Item[];
    // THE ASSERTION THE RULING IS ABOUT. Four, not one -- a refusal that
    // names one obligation sends the seller round the loop three more
    // times, and that is the app-store failure the paragraph describes.
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.code).sort()).toEqual(FOUR);
    for (const i of items) {
      expect(i.resolving_action?.kind).toBeTruthy();
      expect(Number(i.slots?.count)).toBeGreaterThan(0);
    }
  });

  it('GET /v1/seller/deletion/blockers is a 200 state carrying the same four', async () => {
    const r = await asOwner('get', '/v1/seller/deletion/blockers').expect(200);
    const items = r.body.items as Item[];
    expect(items.map((i) => i.code).sort()).toEqual(FOUR);
  });

  it('closure is available anyway, and reversible, with all four still standing', async () => {
    const entered = await asOwner('post', '/v1/seller/closure')
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(200);
    expect(entered.body.status).toBe('CLOSING');

    // The obligations did not move: closure is not a way to shed them.
    const still = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM core.fn_deletion_blockers($1)`,
      [SELLER],
    );
    expect(Number(still.rows[0]?.n)).toBe(4);

    // And deletion is still refused -- the two decisions are independent,
    // which is the point.
    const su = await freshStepUp('SELLER_DELETION');
    await asOwner('post', '/v1/seller/deletion')
      .set('Idempotency-Key', randomUUID())
      .send({ step_up_challenge_id: su })
      .expect(409);

    await asOwner('delete', '/v1/seller/closure').expect(204);
    const status = await admin.query<{ status: string }>(
      `SELECT status FROM core.seller WHERE id=$1`,
      [SELLER],
    );
    expect(status.rows[0]?.status).toBe('ACTIVE');
  });
});
