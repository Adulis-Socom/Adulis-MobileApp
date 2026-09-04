import { randomUUID } from 'node:crypto';
import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * T6-B / G1.6 -- ownership transfer, with AMENDMENT A1.
 *
 * ADU-API-01 v1.7 S12.12: "It had an endpoint, a permission and a function,
 * and no rules; ADU-RUL-01 supplies them." It had none of those three, in
 * fact -- only `seller.ownership:transfer` (OWNER-only, requires_step_up)
 * and the OWNERSHIP_TRANSFER step-up action, both waiting since migration 06.
 *
 * "The 24-hour delay is the design, not a formality ... a compromised Owner
 * session cannot hand the store away before anyone notices, and the
 * unsuppressible notice is what makes the delay useful rather than merely
 * slow."
 *
 * A1.2 withdraws the ADMIN residual: the outgoing owner keeps NOTHING by
 * default, and may nominate any role except ADMIN, "excluded for exactly one
 * reason: it holds payout".
 *
 * A1.1 withdraws the foreign-key warning -- the trap enumerates to zero --
 * and replaces it with the assertion in the last test here.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = randomUUID();
const OWNER = randomUUID();
const RECIPIENT = randomUUID();
const ANALYST = randomUUID();
const BUYER = randomUUID();
const DEVICE = randomUUID();
const OWNER_S = randomUUID();
const RECIPIENT_S = randomUUID();
const ANALYST_S = randomUUID();
const SELLER = randomUUID();
const TM_ADMIN = randomUUID();
const TM_ANALYST = randomUUID();

const P_OWNER = '+251919980001';
const P_RECIPIENT = '+251919980002';
const P_ANALYST = '+251919980003';
const P_BUYER = '+251919980004';

interface Item {
  code: string;
  resolving_action?: { kind?: string };
}

@Module({ imports: [AppModule] })
class T6AppModule {}

describe('T6-B / G1.6 -- ownership transfer has a policy', () => {
  let app: INestApplication;
  let admin: Pool;

  const cookie = (t: string) => `__Host-adulis_session=${t}`;
  const as = (session: string, method: 'get' | 'post' | 'delete', path: string) =>
    request(app.getHttpServer())[method](path)
      .set('Cookie', cookie(session))
      .set('X-Adulis-Seller', SELLER)
      .set('Origin', CONSOLE_ORIGIN);

  const stepUp = async (account: string, phone: string): Promise<string> => {
    const otp = randomUUID();
    await admin.query(
      `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash,
         expires_at, consumed_at, step_up_action)
       VALUES ($1,'STEP_UP',$2, decode('00','hex'),
               now() + interval '1 hour', now(), 'OWNERSHIP_TRANSFER')`,
      [otp, phone],
    );
    const id = randomUUID();
    await admin.query(
      `INSERT INTO core.step_up_challenge
         (id, account_id, action, otp_challenge_id, satisfied_at, expires_at)
       VALUES ($1,$2,'OWNERSHIP_TRANSFER',$3, now(), now() + interval '1 hour')`,
      [id, account, otp],
    );
    return id;
  };

  /** Request a transfer as the owner. */
  const requestTransfer = async (
    body: Record<string, unknown>,
    status: number,
  ) =>
    as(OWNER_S, 'post', '/v1/seller/ownership-transfer')
      .set('Idempotency-Key', randomUUID())
      .send({ step_up_challenge_id: await stepUp(OWNER, P_OWNER), ...body })
      .expect(status);

  /** Put the pending transfer's clock in the past without touching anything else. */
  const makeDue = () =>
    admin.query(
      `UPDATE core.seller_ownership_transfer
          SET activates_at = now() - interval '1 minute'
        WHERE seller_id = $1 AND activated_at IS NULL AND cancelled_at IS NULL`,
      [SELLER],
    );

  const resetStore = async () => {
    // Fixture teardown only, and for one reason: core.claim_evidence_item is
    // append-only and a claim opened by a test cannot otherwise be removed.
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(`DELETE FROM core.seller_ownership_transfer WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.claim_evidence_item WHERE claim_id IN
                        (SELECT c.id FROM core.claim c JOIN core."order" o ON o.id = c.order_id
                          WHERE o.seller_id = $1)`, [SELLER]);
    await admin.query(`DELETE FROM core.claim WHERE order_id IN
                        (SELECT id FROM core."order" WHERE seller_id = $1)`, [SELLER]);
    await admin.query(`DELETE FROM core."order" WHERE seller_id = $1`, [SELLER]);
    // trg_revoke_suspended_member_sessions (0016) ends a member's sessions the
    // moment their membership is suspended or revoked -- R28's standing gate,
    // doing exactly its job. This suite suspends and re-creates memberships
    // between tests, so the sessions have to come back with them.
    await admin.query(`UPDATE core.session SET revoked_at = NULL, expires_at = now() + interval '12 hours'
                        WHERE id = ANY($1::uuid[])`, [[OWNER_S, RECIPIENT_S, ANALYST_S]]);
    await admin.query(`UPDATE core.seller SET owner_account_id = $2 WHERE id = $1`, [
      SELLER,
      OWNER,
    ]);
    await admin.query(`DELETE FROM core.seller_team_member WHERE seller_id = $1`, [SELLER]);
    await admin.query(
      `INSERT INTO core.seller_team_member (id, seller_id, account_id, role) VALUES
        ($1,$3,$4,'ADMIN'), ($2,$3,$5,'ANALYST')`,
      [TM_ADMIN, TM_ANALYST, SELLER, RECIPIENT, ANALYST],
    );
    await admin.query(`DELETE FROM core.notification WHERE recipient_account_id = ANY($1::uuid[])`, [
      [OWNER, RECIPIENT],
    ]);
    await admin.query(`SET session_replication_role = DEFAULT`);
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'T6O','Ownership','PHASE_1','ETB','Africa/Addis_Ababa','en', 'ACTIVE', true, 'AFROMESSAGE')`,
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
        ($1,$5,$9,'ACTIVE'), ($2,$6,$9,'ACTIVE'),
        ($3,$7,$9,'ACTIVE'), ($4,$8,$9,'ACTIVE')`,
      [OWNER, RECIPIENT, ANALYST, BUYER, P_OWNER, P_RECIPIENT, P_ANALYST, P_BUYER, M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$4,'CONSOLE',$7, now() + interval '12 hours'),
        ($2,$5,'CONSOLE',$7, now() + interval '12 hours'),
        ($3,$6,'CONSOLE',$7, now() + interval '12 hours')`,
      [OWNER_S, RECIPIENT_S, ANALYST_S, OWNER, RECIPIENT, ANALYST, DEVICE],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','Handover','t6-handover','ACTIVE')`,
      [SELLER, M, OWNER],
    );

    const moduleRef = await Test.createTestingModule({ imports: [T6AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  beforeEach(resetStore);

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [
      [OWNER, RECIPIENT, ANALYST],
    ]);
    await admin.query(`DELETE FROM core.notification WHERE recipient_account_id = ANY($1::uuid[])`, [
      [OWNER, RECIPIENT, ANALYST],
    ]);
    await admin.query(`DELETE FROM core.seller_ownership_transfer WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller_team_member WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.claim_evidence_item WHERE claim_id IN
                        (SELECT c.id FROM core.claim c JOIN core."order" o ON o.id = c.order_id
                          WHERE o.seller_id = $1)`, [SELLER]);
    await admin.query(`DELETE FROM core.claim WHERE order_id IN
                        (SELECT id FROM core."order" WHERE seller_id = $1)`, [SELLER]);
    await admin.query(`DELETE FROM core."order" WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.payout_details WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller_public_stats WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller WHERE id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.step_up_challenge WHERE account_id = ANY($1::uuid[])`, [
      [OWNER, RECIPIENT, ANALYST],
    ]);
    await admin.query(`DELETE FROM core.otp_challenge WHERE phone_e164 = ANY($1::core.e164[])`, [
      [P_OWNER, P_RECIPIENT, P_ANALYST],
    ]);
    await admin.query(`DELETE FROM core.session WHERE id = ANY($1::uuid[])`, [
      [OWNER_S, RECIPIENT_S, ANALYST_S],
    ]);
    await admin.query(`DELETE FROM core.device WHERE id = $1`, [DEVICE]);
    await admin.query(`DELETE FROM core.account WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.timing_config WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.market WHERE id = $1`, [M]);
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  // ---- 1 -----------------------------------------------------------------
  it('only an ACTIVE ADMIN may receive it, and the refusal names the remedy', async () => {
    // An Analyst is known to the store and is not eligible.
    const r = await requestTransfer({ to_member_id: TM_ANALYST }, 422);
    const items = r.body.items as Item[];
    expect(items[0]?.code).toBe('NO_ELIGIBLE_ADMIN');
    // T6-B S1.4: "422 naming the reason AND the remedy." A bare refusal
    // leaves the owner with no route; this one is a route.
    expect(items[0]?.resolving_action?.kind).toBe('INVITE_AND_PROMOTE_ADMIN');

    // A SUSPENDED admin is not active. R28's standing gate, read here too:
    // handing the store to a suspended Admin would restore every permission
    // they had just lost.
    await admin.query(`UPDATE core.seller_team_member SET suspended_at = now() WHERE id = $1`, [
      TM_ADMIN,
    ]);
    await requestTransfer({ to_member_id: TM_ADMIN }, 422);

    await admin.query(`UPDATE core.seller_team_member SET suspended_at = NULL WHERE id = $1`, [
      TM_ADMIN,
    ]);
    await requestTransfer({ to_member_id: TM_ADMIN }, 201);
  });

  // ---- 2 -----------------------------------------------------------------
  it('nothing happens for 24 hours, and both parties are told unsuppressibly', async () => {
    const r = await requestTransfer({ to_member_id: TM_ADMIN }, 201);
    const delay = new Date(r.body.activates_at).getTime() - Date.now();
    expect(delay).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(delay).toBeLessThan(25 * 60 * 60 * 1000);

    // The store has NOT moved, and a request in the meantime does not move
    // it: the lazy activation runs on every seller-scoped call and finds
    // nothing due.
    await as(OWNER_S, 'get', '/v1/seller/ownership-transfer').expect(200);
    const s = await admin.query<{ owner_account_id: string }>(
      `SELECT owner_account_id FROM core.seller WHERE id = $1`,
      [SELLER],
    );
    expect(s.rows[0]?.owner_account_id).toBe(OWNER);

    // "Both parties notified unsuppressibly." A delay nobody is told about
    // is not a control, it is a wait.
    const n = await admin.query<{ recipient_account_id: string; suppressible: boolean }>(
      // SCOPED TO THIS SUITE'S OWN PARTIES (T22, D-273). This read used to
      // select every OWNERSHIP_TRANSFER_REQUESTED row in the database and
      // compare the set to two account ids -- so ONE foreign row of that
      // template failed it. c8-analytics-public inserts exactly that template
      // for its own owner, in a different jest worker, and lives with it until
      // its afterAll. The suite already knows its own ids; it just was not
      // using them here (its beforeEach cleanup at :135 does).
      `SELECT recipient_account_id, suppressible FROM core.notification
        WHERE template_key = 'OWNERSHIP_TRANSFER_REQUESTED'
          AND recipient_account_id = ANY($1::uuid[])`,
      [[OWNER, RECIPIENT]],
    );
    expect(n.rows.map((x) => x.recipient_account_id).sort()).toEqual([OWNER, RECIPIENT].sort());
    expect(n.rows.every((x) => x.suppressible === false)).toBe(true);
  });

  // ---- 3 -----------------------------------------------------------------
  it('EITHER party ends it -- the owner cancels, the recipient declines', async () => {
    await requestTransfer({ to_member_id: TM_ADMIN }, 201);
    await as(OWNER_S, 'delete', '/v1/seller/ownership-transfer').expect(204);
    let row = await admin.query<{ cancel_reason: string; by: string }>(
      `SELECT cancel_reason, cancelled_by_account_id AS by
         FROM core.seller_ownership_transfer WHERE seller_id = $1`,
      [SELLER],
    );
    expect(row.rows[0]?.cancel_reason).toBe('CANCELLED');
    expect(row.rows[0]?.by).toBe(OWNER);

    await admin.query(`DELETE FROM core.seller_ownership_transfer WHERE seller_id = $1`, [SELLER]);
    await requestTransfer({ to_member_id: TM_ADMIN }, 201);

    // THE RECIPIENT DECLINES. They hold no seller.ownership:transfer -- it
    // is OWNER-only and always will be -- so this route cannot be gated on
    // fn_has_permission. Its gate is the function's own party test.
    await as(RECIPIENT_S, 'delete', '/v1/seller/ownership-transfer').expect(204);
    row = await admin.query(
      `SELECT cancel_reason, cancelled_by_account_id AS by
         FROM core.seller_ownership_transfer WHERE seller_id = $1`,
      [SELLER],
    );
    expect(row.rows[0]?.cancel_reason).toBe('DECLINED');
    expect(row.rows[0]?.by).toBe(RECIPIENT);

    // A third party who is neither gets the ordinary not-found envelope --
    // never a 403, which would confirm the transfer exists.
    await admin.query(`DELETE FROM core.seller_ownership_transfer WHERE seller_id = $1`, [SELLER]);
    await requestTransfer({ to_member_id: TM_ADMIN }, 201);
    await as(ANALYST_S, 'delete', '/v1/seller/ownership-transfer').expect(404);
  });

  // ---- 4 -----------------------------------------------------------------
  it('activation does four things in one transaction, and the residual is A1.2', async () => {
    await requestTransfer({ to_member_id: TM_ADMIN, residual_role: 'INVENTORY' }, 201);
    await makeDue();

    // Any seller-scoped request activates it. Here it is the recipient's own
    // read; the next test uses the OUTGOING owner's.
    await as(RECIPIENT_S, 'get', '/v1/seller/ownership-transfer').expect(200);

    const s = await admin.query<{ owner_account_id: string }>(
      `SELECT owner_account_id FROM core.seller WHERE id = $1`,
      [SELLER],
    );
    // (b) the store moved
    expect(s.rows[0]?.owner_account_id).toBe(RECIPIENT);

    const tm = await admin.query<{ account_id: string; role: string; revoked_at: Date | null }>(
      `SELECT account_id, role::text, revoked_at FROM core.seller_team_member
        WHERE seller_id = $1 ORDER BY created_at`,
      [SELLER],
    );
    // (a) THE STEP THAT WILL BE MISSED -- the recipient's ADMIN membership is
    // revoked. The Owner is core.seller.owner_account_id and only that, and
    // core.seller_team_member never holds the Owner.
    const recipientRows = tm.rows.filter((x) => x.account_id === RECIPIENT);
    expect(recipientRows.every((x) => x.revoked_at !== null)).toBe(true);

    // (c) the residual, created HERE and not at request time
    const residual = tm.rows.filter((x) => x.account_id === OWNER && x.revoked_at === null);
    expect(residual).toHaveLength(1);
    expect(residual[0]?.role).toBe('INVENTORY');

    // (d) both told, again unsuppressibly
    const n = await admin.query<{ recipient_account_id: string; suppressible: boolean }>(
      // Scoped, for the same reason as the REQUESTED read above (D-273).
      `SELECT recipient_account_id, suppressible FROM core.notification
        WHERE template_key = 'OWNERSHIP_TRANSFER_ACTIVATED'
          AND recipient_account_id = ANY($1::uuid[])`,
      [[OWNER, RECIPIENT]],
    );
    expect(n.rows.map((x) => x.recipient_account_id).sort()).toEqual([OWNER, RECIPIENT].sort());
    expect(n.rows.every((x) => x.suppressible === false)).toBe(true);
  });

  it('the outgoing owner keeps NOTHING when no residual role is nominated', async () => {
    await requestTransfer({ to_member_id: TM_ADMIN }, 201);
    await makeDue();
    await as(RECIPIENT_S, 'get', '/v1/seller/ownership-transfer').expect(200);

    const live = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM core.seller_team_member
        WHERE seller_id = $1 AND account_id = $2 AND revoked_at IS NULL`,
      [SELLER, OWNER],
    );
    // A1.2, verbatim: no membership by default. The withdrawn promise of an
    // ADMIN membership was incompatible with "payout access ends at
    // activation" under the shipped matrix.
    expect(Number(live.rows[0]?.n)).toBe(0);
  });

  it('ADMIN is not nominable as a residual role -- it holds payout', async () => {
    // Refused at the wire by the zod enum, and refused again in the database
    // by residual_role_is_never_admin, so neither is load-bearing alone.
    await requestTransfer({ to_member_id: TM_ADMIN, residual_role: 'ADMIN' }, 400);
    await expect(
      admin.query(
        `INSERT INTO core.seller_ownership_transfer
           (seller_id, from_account_id, to_account_id, residual_role,
            step_up_challenge_id, activates_at)
         SELECT $1,$2,$3,'ADMIN', c.id, now()
           FROM core.step_up_challenge c WHERE c.account_id = $2 LIMIT 1`,
        [SELLER, OWNER, RECIPIENT],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  // ---- 5 -----------------------------------------------------------------
  it('the blocking conditions are re-checked AT ACTIVATION, and a violation cancels', async () => {
    await requestTransfer({ to_member_id: TM_ADMIN }, 201);

    // A claim opens during the 24 hours. Twenty-four hours is long enough
    // for exactly this, which is why the check cannot be at request only.
    const order = randomUUID();
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id,
         state, expires_at, clock_stopped_at, total_minor, total_currency,
         display_currency)
       VALUES ($1,$2,$3,$4,'PAYMENT_CONFIRMED', now() + interval '2 days',
               now(), 50000,'ETB','ETB')`,
      [order, M, SELLER, BUYER],
    );
    const claim = randomUUID();
    await admin.query(
      `INSERT INTO core.claim (id, order_id, opened_by_kind, opened_by_account_id,
         trigger, state)
       VALUES ($1,$2,'BUYER',$3,'GOODS_NOT_RECEIVED','UNDER_REVIEW')`,
      [claim, order, BUYER],
    );

    await makeDue();
    await as(RECIPIENT_S, 'get', '/v1/seller/ownership-transfer').expect(200);

    const s = await admin.query<{ owner_account_id: string }>(
      `SELECT owner_account_id FROM core.seller WHERE id = $1`,
      [SELLER],
    );
    expect(s.rows[0]?.owner_account_id).toBe(OWNER);

    const t = await admin.query<{ cancel_reason: string; activated_at: Date | null }>(
      `SELECT cancel_reason, activated_at FROM core.seller_ownership_transfer
        WHERE seller_id = $1`,
      [SELLER],
    );
    // Cancelled, not postponed: a pending transfer that silently waits is a
    // transfer nobody is watching any more.
    expect(t.rows[0]?.cancel_reason).toBe('BLOCKED_AT_ACTIVATION');
    expect(t.rows[0]?.activated_at).toBeNull();

    const n = await admin.query<{ n: number }>(
      // Scoped, for the same reason (D-273). An exact count over a shared
      // table is the purest form of "a test about other people's rows".
      `SELECT count(*)::int AS n FROM core.notification
        WHERE template_key = 'OWNERSHIP_TRANSFER_CANCELLED'
          AND recipient_account_id = ANY($1::uuid[])`,
      [[OWNER, RECIPIENT]],
    );
    expect(Number(n.rows[0]?.n)).toBe(2);

    // And the same conditions refuse a fresh request, with the blocker named
    // and its clearing action beside it.
    const refused = await requestTransfer({ to_member_id: TM_ADMIN }, 409);
    const items = refused.body.items as Item[];
    expect(items.map((i) => i.code)).toContain('OPEN_CLAIMS');
    expect(items.every((i) => i.resolving_action?.kind)).toBe(true);

  });

  // ---- 6 -- AMENDMENT A1.1 ------------------------------------------------
  it('the outgoing owner LOSES OWNER on their very next request, with no re-authentication', async () => {
    await requestTransfer({ to_member_id: TM_ADMIN }, 201);

    // The owner's session is live and stays live: the same cookie is used
    // before and after, and nothing re-authenticates. A1.1 asks for exactly
    // this, because the risk it names is not a foreign key -- the FK trap
    // enumerates to zero -- but that EIGHT functions resolve authority from
    // core.seller.owner_account_id, so one UPDATE changes every answer.
    await as(OWNER_S, 'get', '/v1/seller/deletion/blockers').expect(200);

    await makeDue();

    // THE NEXT REQUEST. The outgoing owner's own call activates the transfer
    // and is then judged by what it did: seller.account:delete is OWNER-only
    // and they are no longer the Owner. They hold no membership either (no
    // residual was nominated), so fn_has_permission finds no relationship at
    // all -- U0002, a 404, because a stranger must not be told the store
    // exists.
    await as(OWNER_S, 'get', '/v1/seller/deletion/blockers').expect(404);

    const s = await admin.query<{ owner_account_id: string }>(
      `SELECT owner_account_id FROM core.seller WHERE id = $1`,
      [SELLER],
    );
    expect(s.rows[0]?.owner_account_id).toBe(RECIPIENT);

    // The new owner holds it on their next request, equally without
    // re-authenticating: their session was minted before the transfer.
    await as(RECIPIENT_S, 'get', '/v1/seller/deletion/blockers').expect(200);
  });
});
