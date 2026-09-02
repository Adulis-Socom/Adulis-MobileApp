import { randomUUID } from 'node:crypto';
import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { createJobHarness, type Harness } from './jobs-harness';

/**
 * T6 / G1.7 -- the subscription lifecycle.
 *
 * ADU-API-01 v1.7 S12.12: "Three rules: an intent expires after 24 hours; a
 * subscription becomes ACTIVE only on a payment reconciled against a live
 * intent, never on the intent alone; and the rate is locked at intent
 * creation, so the price shown is the price charged. Nothing depends on this
 * today -- beta sellers pay nothing -- but v1.6's endpoints opened a
 * collection record that no path closed."
 *
 * The last sentence is the one with teeth, and it had two halves:
 *
 *   - reconciled_at was the reminder job's only exit and NO CODE WROTE IT,
 *     so every open record SMSed its seller every seven days forever; and
 *   - every call with a fresh Idempotency-Key opened ANOTHER record, so a
 *     seller who tapped four times got four of them.
 *
 * Both are asserted below, along with the three rules and the two gates the
 * rules imply: only an operator reconciles, and a closing store cannot buy.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = randomUUID();
const OWNER = randomUUID();
const OPERATOR = randomUUID();
const DEVICE = randomUUID();
const OWNER_S = randomUUID();
const SELLER = randomUUID();
const SELLER2 = randomUUID();
const OWNER2 = randomUUID();
const OWNER2_S = randomUUID();
const SUB = randomUUID();
const SUB2 = randomUUID();
const PS = randomUUID();
const PS_DEARER = randomUUID();

const P_OWNER = '+251919970001';
const P_OWNER2 = '+251919970002';
const P_OPERATOR = '+251919970003';

@Module({ imports: [AppModule] })
class T6AppModule {}

describe('T6 / G1.7 -- the intent expires, the rate is locked, the record closes', () => {
  let app: INestApplication;
  let admin: Pool;
  let jobs: Harness;

  const cookie = (t: string) => `__Host-adulis_session=${t}`;

  const stepUp = async (account: string): Promise<string> => {
    const otp = randomUUID();
    await admin.query(
      `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash,
         expires_at, consumed_at, step_up_action)
       VALUES ($1,'STEP_UP',$2, decode('00','hex'),
               now() + interval '1 hour', now(), 'SUBSCRIPTION_CHANGE')`,
      [otp, account === OWNER ? P_OWNER : P_OWNER2],
    );
    const id = randomUUID();
    await admin.query(
      `INSERT INTO core.step_up_challenge
         (id, account_id, action, otp_challenge_id, satisfied_at, expires_at)
       VALUES ($1,$2,'SUBSCRIPTION_CHANGE',$3, now(), now() + interval '1 hour')`,
      [id, account, otp],
    );
    return id;
  };

  const openIntent = async (
    seller: string,
    session: string,
    account: string,
    status = 201,
    tier = 'LISTED',
    term = 'ANNUAL',
  ) =>
    request(app.getHttpServer())
      .post('/v1/billing/purchase-intent')
      .set('Cookie', cookie(session))
      .set('X-Adulis-Seller', seller)
      .set('Origin', CONSOLE_ORIGIN)
      .set('Idempotency-Key', randomUUID())
      .send({ tier, term, step_up_challenge_id: await stepUp(account) })
      .expect(status);

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    jobs = createJobHarness(new Date('2026-08-29T06:30:00Z'));

    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'T6I','Intent','PHASE_1','ETB','Africa/Addis_Ababa','en', 'ACTIVE', true, 'AFROMESSAGE')`,
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
        ($1,$4,$7,'ACTIVE'), ($2,$5,$7,'ACTIVE'), ($3,$6,$7,'ACTIVE')`,
      [OWNER, OWNER2, OPERATOR, P_OWNER, P_OWNER2, P_OPERATOR, M],
    );
    await admin.query(
      `INSERT INTO core.operator_grant (id, account_id, role)
       VALUES (gen_random_uuid(), $1, 'ADMIN')`,
      [OPERATOR],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at)
       VALUES ($1,$3,'CONSOLE',$5, now() + interval '12 hours'),
              ($2,$4,'CONSOLE',$5, now() + interval '12 hours')`,
      [OWNER_S, OWNER2_S, OWNER, OWNER2, DEVICE],
    );
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status) VALUES
        ($1,$3,$4,'INDIVIDUAL','Intent Store','t6-intent','ACTIVE'),
        ($2,$3,$5,'INDIVIDUAL','Closing Store','t6-intent-closing','CLOSING')`,
      [SELLER, SELLER2, M, OWNER, OWNER2],
    );
    await admin.query(
      `INSERT INTO billing.price_schedule (id, market_id, tier, price_minor,
         currency, usd_reference_minor, fx_rate, derived_at, effective)
       VALUES ($1,$2,'LISTED',100000,'ETB',1800,55.0, now(),
               tstzrange(now() - interval '1 day', NULL))`,
      [PS, M],
    );
    await admin.query(
      `INSERT INTO billing.subscription (id, seller_id, state) VALUES
        ($1,$3,'BETA'), ($2,$4,'BETA')`,
      [SUB, SUB2, SELLER, SELLER2],
    );

    const moduleRef = await Test.createTestingModule({ imports: [T6AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await jobs?.close();
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [
      [OWNER, OWNER2],
    ]);
    await admin.query(`DELETE FROM billing.purchase_intent WHERE subscription_id = ANY($1::uuid[])`, [
      [SUB, SUB2],
    ]);
    await admin.query(
      `DELETE FROM billing.collection_record WHERE subscription_id = ANY($1::uuid[])`,
      [[SUB, SUB2]],
    );
    await admin.query(`DELETE FROM billing.subscription_state_transition
                        WHERE subscription_id = ANY($1::uuid[])`, [[SUB, SUB2]]);
    await admin.query(`DELETE FROM billing.subscription WHERE id = ANY($1::uuid[])`, [[SUB, SUB2]]);
    await admin.query(`DELETE FROM billing.price_schedule WHERE market_id = $1`, [M]);
    await admin.query(
      `DELETE FROM core.seller_public_stats WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id = $1)`,
      [M],
    );
    await admin.query(`DELETE FROM core.seller WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.step_up_challenge WHERE account_id = ANY($1::uuid[])`, [
      [OWNER, OWNER2],
    ]);
    await admin.query(
      `DELETE FROM core.otp_challenge WHERE phone_e164 = ANY($1::core.e164[])`,
      [[P_OWNER, P_OWNER2]],
    );
    await admin.query(`DELETE FROM core.session WHERE id = ANY($1::uuid[])`, [[OWNER_S, OWNER2_S]]);
    await admin.query(`DELETE FROM core.device WHERE id = $1`, [DEVICE]);
    await admin.query(`DELETE FROM core.operator_grant WHERE account_id = $1`, [OPERATOR]);
    await admin.query(`DELETE FROM core.account WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.timing_config WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.market WHERE id = $1`, [M]);
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  // Each test owns its subscription's intents so ordering between them is not
  // load-bearing; only ONE open intent may exist per subscription, so the
  // slot is cleared first.
  // Through the named function, not a bare UPDATE: cancelling an intent and
  // closing its record are one decision, and a fixture that cancels the
  // intent alone leaves an open collection_record behind -- which is the
  // exact defect this file exists to prove is gone.
  const clearOpen = () =>
    admin.query(
      `SELECT billing.fn_close_intent(pi.id, 'TEST_RESET')
         FROM billing.purchase_intent pi
        WHERE pi.subscription_id = $1
          AND pi.reconciled_at IS NULL AND pi.cancelled_at IS NULL`,
      [SUB],
    );

  it('two taps are ONE obligation, not two', async () => {
    const a = await openIntent(SELLER, OWNER_S, OWNER);
    const b = await openIntent(SELLER, OWNER_S, OWNER);

    // The second call returns the standing quote. Before G1.7 it inserted a
    // second billing.collection_record and the seller owed twice.
    expect(b.body.intent_id).toBe(a.body.intent_id);
    expect(b.body.collection_record_id).toBe(a.body.collection_record_id);

    const n = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM billing.collection_record WHERE subscription_id = $1`,
      [SUB],
    );
    expect(Number(n.rows[0]?.n)).toBe(1);

    // 100000 x 12 months x (1 - 0 annual discount on this schedule)
    expect(Number(a.body.amount_minor)).toBe(1200000);
    expect(new Date(a.body.expires_at).getTime() - Date.now()).toBeGreaterThan(
      23 * 60 * 60 * 1000,
    );
    await clearOpen();
  });

  it('the GET carries the transfer REFERENCE the POST minted (A7 / v1.9 item 12)', async () => {
    // A7: the POST returned a `reference` to write on the bank transfer, and
    // the GET dropped it -- so a seller who closed the tab had the amount but
    // not the string. The GET now derives it identically, so a re-open reads
    // back what to transfer instead of the console recomputing a business fact.
    const opened = await openIntent(SELLER, OWNER_S, OWNER);
    expect(opened.body.reference).toMatch(/^ADU-SUB-/);

    const sub = await request(app.getHttpServer())
      .get('/v1/billing/subscription')
      .set('Cookie', cookie(OWNER_S))
      .set('X-Adulis-Seller', SELLER)
      .set('Origin', CONSOLE_ORIGIN)
      .expect(200);
    expect(sub.body.intent).not.toBeNull();
    // Same reference, same derivation, off the same collection record.
    expect(sub.body.intent.reference).toBe(opened.body.reference);
    expect(sub.body.intent.reference).toBe(
      `ADU-SUB-${String(sub.body.intent.collection_record_id).slice(0, 8).toUpperCase()}`,
    );
    await clearOpen();
  });

  it('the rate is locked at creation: the schedule may move, the quote does not', async () => {
    const a = await openIntent(SELLER, OWNER_S, OWNER);
    expect(Number(a.body.amount_minor)).toBe(1200000);

    // The market reprices. The EXCLUDE constraint means the old row must
    // close before the new one opens, which is the real-world shape.
    await admin.query(
      `UPDATE billing.price_schedule
          SET effective = tstzrange(lower(effective), now())
        WHERE id = $1`,
      [PS],
    );
    await admin.query(
      `INSERT INTO billing.price_schedule (id, market_id, tier, price_minor,
         currency, usd_reference_minor, fx_rate, derived_at, effective)
       VALUES ($1,$2,'LISTED',500000,'ETB',9000,55.0, now(),
               tstzrange(now(), NULL))`,
      [PS_DEARER, M],
    );

    // Asked again inside the window: the price shown is the price charged.
    const b = await openIntent(SELLER, OWNER_S, OWNER);
    expect(b.body.intent_id).toBe(a.body.intent_id);
    expect(Number(b.body.amount_minor)).toBe(1200000);

    // And it is the OLD schedule row the intent points at, not the one in
    // force now -- which is what reconciliation will stamp on the
    // subscription to satisfy priced_state_names_its_schedule.
    const pi = await admin.query<{ price_schedule_version_id: string }>(
      `SELECT price_schedule_version_id FROM billing.purchase_intent WHERE id = $1`,
      [a.body.intent_id],
    );
    expect(pi.rows[0]?.price_schedule_version_id).toBe(PS);

    await clearOpen();
    // Put the cheap schedule back so the remaining tests quote 1200000.
    await admin.query(`DELETE FROM billing.price_schedule WHERE id = $1`, [PS_DEARER]);
    await admin.query(
      `UPDATE billing.price_schedule SET effective = tstzrange(lower(effective), NULL)
        WHERE id = $1`,
      [PS],
    );
  });

  it('a payment reconciled against a LIVE intent is the only path to ACTIVE', async () => {
    const a = await openIntent(SELLER, OWNER_S, OWNER);

    const sub = await admin.query<{ state: string }>(
      `SELECT state FROM billing.subscription WHERE id = $1`,
      [SUB],
    );
    // The intent alone changes nothing. "never on the intent alone".
    expect(sub.rows[0]?.state).toBe('BETA');

    await admin.query(`SELECT billing.fn_reconcile_purchase($1,$2,$3)`, [
      OPERATOR,
      a.body.collection_record_id,
      'CBE-REF-0001',
    ]);

    const after = await admin.query<Record<string, unknown>>(
      `SELECT state::text, tier::text, term::text, locked_rate_minor,
              locked_rate_currency, price_schedule_version_id,
              current_period_start, current_period_end
         FROM billing.subscription WHERE id = $1`,
      [SUB],
    );
    expect(after.rows[0]).toMatchObject({
      state: 'ACTIVE',
      tier: 'LISTED',
      term: 'ANNUAL',
      locked_rate_minor: '1200000',
      locked_rate_currency: 'ETB',
      price_schedule_version_id: PS,
    });
    // priced_state_names_its_schedule has never been exercised by
    // production code because nothing ever set ACTIVE. It is now, and the
    // row carries its schedule.
    expect(after.rows[0]?.['current_period_end']).toBeTruthy();

    const cr = await admin.query<{ reconciled_by: string; provider_ref: string }>(
      `SELECT reconciled_by, provider_ref FROM billing.collection_record WHERE id = $1`,
      [a.body.collection_record_id],
    );
    expect(cr.rows[0]?.reconciled_by).toBe(OPERATOR);
    expect(cr.rows[0]?.provider_ref).toBe('CBE-REF-0001');

    await admin.query(`UPDATE billing.subscription SET state = 'BETA', tier = NULL, term = NULL,
                         price_schedule_version_id = NULL, locked_rate_minor = NULL,
                         locked_rate_currency = NULL WHERE id = $1`, [SUB]);
  });

  it('an EXPIRED intent activates nothing, whoever presents the payment', async () => {
    const a = await openIntent(SELLER, OWNER_S, OWNER);
    // 24 hours and a minute. The clock is the whole rule.
    await admin.query(
      `UPDATE billing.purchase_intent
          SET created_at = now() - interval '25 hours',
              expires_at = now() - interval '1 minute'
        WHERE id = $1`,
      [a.body.intent_id],
    );

    await expect(
      admin.query(`SELECT billing.fn_reconcile_purchase($1,$2,$3)`, [
        OPERATOR,
        a.body.collection_record_id,
        'CBE-REF-LATE',
      ]),
    ).rejects.toMatchObject({ code: '23001' });

    const sub = await admin.query<{ state: string }>(
      `SELECT state FROM billing.subscription WHERE id = $1`,
      [SUB],
    );
    expect(sub.rows[0]?.state).toBe('BETA');
    await clearOpen();
  });

  it('a payment with NO intent behind it activates nothing either', async () => {
    const bare = randomUUID();
    await admin.query(
      `INSERT INTO billing.collection_record
         (id, subscription_id, amount_minor, currency, provider_kind)
       VALUES ($1,$2,999999,'ETB','BANK_TRANSFER')`,
      [bare, SUB],
    );
    // Money against an unknown purchase cannot decide a tier, a term or a
    // rate, so it must not decide a state.
    await expect(
      admin.query(`SELECT billing.fn_reconcile_purchase($1,$2,$3)`, [OPERATOR, bare, 'CBE-X']),
    ).rejects.toMatchObject({ code: '23001' });
    const sub = await admin.query<{ state: string }>(
      `SELECT state FROM billing.subscription WHERE id = $1`,
      [SUB],
    );
    expect(sub.rows[0]?.state).toBe('BETA');
    await admin.query(`DELETE FROM billing.collection_record WHERE id = $1`, [bare]);
  });

  it('only a live operator grant may reconcile -- the seller cannot', async () => {
    await clearOpen();
    const a = await openIntent(SELLER, OWNER_S, OWNER);
    // The store's own Owner is not an operator. T5's derivation, reused:
    // the function reads core.operator_grant itself rather than trusting
    // whatever role reached it.
    await expect(
      admin.query(`SELECT billing.fn_reconcile_purchase($1,$2,$3)`, [
        OWNER,
        a.body.collection_record_id,
        'CBE-SELF',
      ]),
    ).rejects.toMatchObject({ code: 'U0001' });
    await clearOpen();
  });

  it('the sweep closes what no path closed, and the reminder stops', async () => {
    await clearOpen();
    const a = await openIntent(SELLER, OWNER_S, OWNER);
    await admin.query(
      `UPDATE billing.purchase_intent
          SET created_at = now() - interval '25 hours',
              expires_at = now() - interval '1 minute'
        WHERE id = $1`,
      [a.body.intent_id],
    );

    // THE SWEEP DIRECTLY, NOT THE JOB. `subscription.collect_reminder` calls
    // billing.fn_close_stale_collections() on every tick and e2-e6 owns that
    // job's test; running one global sweep from two suites in parallel
    // workers is a flake, not a redundancy (D-83). What THIS file is about
    // is that the record closes and stops being remindable, and the sweep is
    // where that happens.
    const before = jobs.sms.sent.length;
    const closed = await admin.query<{ n: number }>(
      `SELECT billing.fn_close_stale_collections() AS n`,
    );
    expect(Number(closed.rows[0]?.n)).toBeGreaterThan(0);

    const cr = await admin.query<{ voided_at: Date; void_reason: string; reminder: Date }>(
      `SELECT voided_at, void_reason, reminder_sent_at AS reminder
         FROM billing.collection_record WHERE id = $1`,
      [a.body.collection_record_id],
    );
    expect(cr.rows[0]?.voided_at).toBeTruthy();
    expect(cr.rows[0]?.void_reason).toBe('EXPIRED');
    // Never reminded: it was closed before the reminder query ran, in the
    // same job. Before G1.7 this record had no exit at all and would have
    // been SMSed every seven days in perpetuity.
    expect(cr.rows[0]?.reminder).toBeNull();
    expect(
      jobs.sms.sent
        .slice(before)
        .filter((m) => m.slots['collection_id'] === a.body.collection_record_id),
    ).toHaveLength(0);
  });

  it('a record the seller says they PAID is never voided under the operator', async () => {
    await clearOpen();
    const a = await openIntent(SELLER, OWNER_S, OWNER);
    await request(app.getHttpServer())
      .post('/v1/billing/mark-transferred')
      .set('Cookie', cookie(OWNER_S))
      .set('X-Adulis-Seller', SELLER)
      .set('Origin', CONSOLE_ORIGIN)
      .set('Idempotency-Key', randomUUID())
      .send({ collection_record_id: a.body.collection_record_id })
      .expect(200);

    await admin.query(
      `UPDATE billing.purchase_intent
          SET created_at = now() - interval '25 hours',
              expires_at = now() - interval '1 minute'
        WHERE id = $1`,
      [a.body.intent_id],
    );
    await admin.query(`SELECT billing.fn_close_stale_collections()`);

    const cr = await admin.query<{ voided_at: Date | null }>(
      `SELECT voided_at FROM billing.collection_record WHERE id = $1`,
      [a.body.collection_record_id],
    );
    // The intent is dead -- the quote is stale -- but an operator may be
    // matching a real bank line to this record right now, and expiry is not
    // ours to spend on their behalf.
    expect(cr.rows[0]?.voided_at).toBeNull();
    await clearOpen();
  });

  it('a CLOSING store cannot open a purchase intent', async () => {
    const r = await openIntent(SELLER2, OWNER2_S, OWNER2, 409);
    // ADU-AUTH-01 v2.5 S14's fifth check, which sits above authorization and
    // is not authorization: a CLOSING seller is blocked from forward-looking
    // actions regardless of who is asking. Buying is forward-looking, and
    // before this the billing group read core.seller.status never.
    expect(r.body.code).toBe('SELLER_UNAVAILABLE');
    const n = await admin.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM billing.collection_record WHERE subscription_id = $1`,
      [SUB2],
    );
    expect(Number(n.rows[0]?.n)).toBe(0);
  });
});
