import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * T5 / G1.1 -- identity verification is operator-only.
 *
 * `POST /v1/seller/identity-verification` wrote an attestation from fields
 * the CLIENT supplied: verifier, reference, legal name, ID hash, date. A
 * seller holding `seller.identity:manage` and a step-up code could assert
 * their own ID verification -- the IDENTITY eligibility path, and at Pro
 * the verified badge. It was open from C6.
 *
 * **The step-up was working perfectly throughout, and that is the point.**
 * It proved the person holding the phone was the account holder, which was
 * never the question. The question was whether anyone had checked the
 * document, and nobody had. Test 1 therefore supplies a GENUINE fresh
 * challenge: a test that fails at the step-up gate proves nothing about
 * this change.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = '77777777-5555-4000-8000-000000000001';
const SELLER_ACC = '77777777-5555-4000-8000-000000000002';
const OP_IDENT = '77777777-5555-4000-8000-000000000003';
const OP_ADMIN = '77777777-5555-4000-8000-000000000004';
const OP_SUPPORT = '77777777-5555-4000-8000-000000000005';
const OP_REVOKED = '77777777-5555-4000-8000-000000000006';
const DEVICE = '77777777-5555-4000-8000-000000000007';
const SELLER_S = '77777777-5555-4000-8000-000000000008';
const IDENT_S = '77777777-5555-4000-8000-000000000009';
const ADMIN_S = '77777777-5555-4000-8000-00000000000a';
const SUPPORT_S = '77777777-5555-4000-8000-00000000000b';
const REVOKED_S = '77777777-5555-4000-8000-00000000000c';
const OTP = '77777777-5555-4000-8000-00000000000d';
const SELLER_ID = '77777777-5555-4000-8000-00000000000e';
const SUBJECT_A = '77777777-5555-4000-8000-000000000010';
const SUBJECT_B = '77777777-5555-4000-8000-000000000011';
const SUBJECT_C = '77777777-5555-4000-8000-000000000012';
const AUDIENCE_SELLER = '77777777-5555-4000-8000-000000000013';
const AUDIENCE_ACC = '77777777-5555-4000-8000-000000000014';
const SOCIAL = '77777777-5555-4000-8000-000000000015';

const ACCOUNTS = [SELLER_ACC, OP_IDENT, OP_ADMIN, OP_SUPPORT, OP_REVOKED, AUDIENCE_ACC];

@Module({ imports: [AppModule] })
class T5AppModule {}

describe('T5 / G1.1 -- identity verification is operator-only', () => {
  let app: INestApplication;
  let admin: Pool;
  let challengeSeq = 0;

  const cookie = (t: string) => `__Host-adulis_session=${t}`;
  const key = () =>
    `77777777-5555-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;

  /**
   * A fresh, satisfied, correctly-actioned step-up challenge for one
   * account. Minted per call because consumption is single-use (D-32), so
   * a shared challenge would make the second test fail for the wrong
   * reason.
   */
  const mintStepUp = async (account: string): Promise<string> => {
    const id = `77777777-5555-4000-8000-1000000000${(challengeSeq++).toString().padStart(2, '0')}`;
    await admin.query(
      `INSERT INTO core.step_up_challenge
         (id, account_id, action, otp_challenge_id, satisfied_at, expires_at)
       VALUES ($1, $2, 'IDENTITY_CHANGE', $3, now(), now() + interval '1 hour')`,
      [id, account, OTP],
    );
    return id;
  };

  const attest = (token: string) =>
    request(app.getHttpServer())
      .post('/v1/seller/identity-verification')
      .set('Cookie', cookie(token))
      .set('Origin', CONSOLE_ORIGIN)
      .set('Idempotency-Key', key());

  const body = (personId: string) => ({
    person_id: personId,
    verifier_kind: 'OPERATOR_ATTESTED',
    vendor_reference: 'founder-attested-01',
    id_type: 'NATIONAL_ID',
    legal_name: 'Alem Tesfaye',
    id_hash: 'b'.repeat(64),
    verified_on: '2026-08-27',
  });

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live)
       VALUES ($1,'T5E','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en',false)`,
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
      `INSERT INTO core.eligibility_config (id, market_id, audience_required,
         follower_threshold, counting_platforms, threshold_basis,
         permitted_seller_types, id_verification_requirement)
       VALUES (gen_random_uuid(), $1, true, 1000,
         ARRAY['TIKTOK','INSTAGRAM']::core.platform[], 'HIGHEST_SINGLE',
         ARRAY['INDIVIDUAL','COMPANY']::core.seller_entity_type[], 'OPTIONAL')`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.identity_config (id, market_id, identity_required,
         verifier_kind, accepted_id_types)
       VALUES (gen_random_uuid(), $1, false, 'KYC_VENDOR', ARRAY['NATIONAL_ID'])`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251914551001',$7,'ACTIVE'), ($2,'+251914551002',$7,'ACTIVE'),
        ($3,'+251914551003',$7,'ACTIVE'), ($4,'+251914551004',$7,'ACTIVE'),
        ($5,'+251914551005',$7,'ACTIVE'), ($6,'+251914551006',$7,'ACTIVE')`,
      [...ACCOUNTS, M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$6,'CONSOLE',$11, now()+interval '12 hours'),
        ($2,$7,'CONSOLE',$11, now()+interval '12 hours'),
        ($3,$8,'CONSOLE',$11, now()+interval '12 hours'),
        ($4,$9,'CONSOLE',$11, now()+interval '12 hours'),
        ($5,$10,'CONSOLE',$11, now()+interval '12 hours')`,
      [
        SELLER_S, IDENT_S, ADMIN_S, SUPPORT_S, REVOKED_S,
        SELLER_ACC, OP_IDENT, OP_ADMIN, OP_SUPPORT, OP_REVOKED, DEVICE,
      ],
    );
    await admin.query(
      `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash,
         expires_at, consumed_at, step_up_action)
       VALUES ($1,'STEP_UP','+251914551001', decode('00','hex'),
               now()+interval '1 hour', now(), 'IDENTITY_CHANGE')`,
      [OTP],
    );

    // The seller whose owner will try to attest their own identity.
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','T5 Store','t5-store','DRAFT')`,
      [SELLER_ID, M, SELLER_ACC],
    );
    // The subjects an operator attests ABOUT. They exist already: an
    // operator attests about someone else and cannot conjure a person row.
    await admin.query(`INSERT INTO core.person (id) VALUES ($1),($2),($3)`, [
      SUBJECT_A,
      SUBJECT_B,
      SUBJECT_C,
    ]);

    // Operator grants. IDENTITY_REVIEWER and ADMIN may attest; SUPPORT is
    // an operator and still the wrong one; the fourth is revoked.
    await admin.query(
      `INSERT INTO core.operator_grant (id, account_id, role, reason) VALUES
        (gen_random_uuid(), $1, 'IDENTITY_REVIEWER', 'T5 fixture'),
        (gen_random_uuid(), $2, 'ADMIN',             'T5 fixture'),
        (gen_random_uuid(), $3, 'SUPPORT',           'T5 fixture')`,
      [OP_IDENT, OP_ADMIN, OP_SUPPORT],
    );
    // Append-only: revocation is a stamp, and the row survives it (S6.11).
    // Written revoked here because the fixture is the end state.
    await admin.query(
      `INSERT INTO core.operator_grant
         (id, account_id, role, reason, revoked_at, revoked_by_account_id)
       VALUES (gen_random_uuid(), $1, 'IDENTITY_REVIEWER', 'T5 fixture',
               now() - interval '1 day', $2)`,
      [OP_REVOKED, OP_ADMIN],
    );

    // Test 7's seller: AUDIENCE path only, no attestation anywhere.
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','Audience Only','t5-audience','DRAFT')`,
      [AUDIENCE_SELLER, M, AUDIENCE_ACC],
    );
    await admin.query(
      `INSERT INTO core.seller_social_account (id, seller_id, platform, handle,
         platform_account_id, verified_at, follower_count_at_verification,
         follower_count_source, status)
       VALUES ($1,$2,'TIKTOK','@audienceonly','tt-1', now(), 5000,
               'PLATFORM_FETCH','VERIFIED')`,
      [SOCIAL, AUDIENCE_SELLER],
    );

    const moduleRef = await Test.createTestingModule({ imports: [T5AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`,
      `DELETE FROM verification.access_log WHERE actor_account_id = ANY($1::uuid[])`,
      `DELETE FROM verification.identity_attestation
        WHERE person_id IN ('${SUBJECT_A}','${SUBJECT_B}','${SUBJECT_C}')`,
      `DELETE FROM core.operator_grant WHERE account_id = ANY($1::uuid[])`,
      `DELETE FROM core.step_up_challenge WHERE account_id = ANY($1::uuid[])`,
      `DELETE FROM core.otp_challenge WHERE id = '${OTP}'`,
      `DELETE FROM core.seller_social_account WHERE id = '${SOCIAL}'`,
      `DELETE FROM core.seller_eligibility_evaluation
        WHERE seller_id IN ('${SELLER_ID}','${AUDIENCE_SELLER}')`,
      `DELETE FROM core.seller_level_state
        WHERE seller_id IN ('${SELLER_ID}','${AUDIENCE_SELLER}')`,
      `DELETE FROM core.seller_public_stats
        WHERE seller_id IN ('${SELLER_ID}','${AUDIENCE_SELLER}')`,
      `DELETE FROM core.seller WHERE id IN ('${SELLER_ID}','${AUDIENCE_SELLER}')`,
      `DELETE FROM core.person WHERE id IN ('${SUBJECT_A}','${SUBJECT_B}','${SUBJECT_C}')`,
      `DELETE FROM core.session WHERE account_id = ANY($1::uuid[])`,
      `DELETE FROM core.device WHERE id = '${DEVICE}'`,
      `DELETE FROM core.account WHERE id = ANY($1::uuid[])`,
      `DELETE FROM core.identity_config WHERE market_id = '${M}'`,
      `DELETE FROM core.eligibility_config WHERE market_id = '${M}'`,
      `DELETE FROM core.timing_config WHERE market_id = '${M}'`,
      `DELETE FROM core.market WHERE id = '${M}'`,
    ]) {
      await admin.query(q, q.includes('$1') ? [ACCOUNTS] : undefined);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  // ---------------------------------------------------------------- 1 + 2
  // The two that prove the hole is closed.

  it('1 - a seller with seller.identity:manage AND a valid fresh step-up gets 403', async () => {
    const challenge = await mintStepUp(SELLER_ACC);
    const r = await attest(SELLER_S)
      .set('X-Adulis-Seller', SELLER_ID)
      .send({ ...body(SUBJECT_A), step_up_challenge_id: challenge })
      .expect(403);
    expect(r.body.code).toBe('PERMISSION_DENIED');

    // And nothing was written. A 403 that still wrote the row would be the
    // worst of both: a refusal the caller believes and an attestation the
    // ladder reads.
    const rows = await admin.query(
      `SELECT 1 FROM verification.identity_attestation WHERE person_id = $1`,
      [SUBJECT_A],
    );
    expect(rows.rowCount).toBe(0);
  });

  it('2 - an IDENTITY_REVIEWER succeeds, and the row says OPERATOR_ATTESTED', async () => {
    const challenge = await mintStepUp(OP_IDENT);
    await attest(IDENT_S)
      .send({ ...body(SUBJECT_B), step_up_challenge_id: challenge })
      .expect(201);

    const r = await admin.query(
      `SELECT verifier_kind::text AS kind, legal_name
         FROM verification.identity_attestation WHERE person_id = $1`,
      [SUBJECT_B],
    );
    expect(r.rows).toHaveLength(1);
    // Neither KYC_VENDOR nor VIDEO_CALL would have been true: there is no
    // vendor and there is no call. An audit row that says something other
    // than what occurred is worse than one that says less.
    expect(r.rows[0].kind).toBe('OPERATOR_ATTESTED');
  });

  // ------------------------------------------------------------------ 3-4
  // The wrong operator role is still the wrong role.

  it('3 - ADMIN succeeds; SUPPORT receives 403', async () => {
    const adminChallenge = await mintStepUp(OP_ADMIN);
    await attest(ADMIN_S)
      .send({ ...body(SUBJECT_C), step_up_challenge_id: adminChallenge })
      .expect(201);

    const supportChallenge = await mintStepUp(OP_SUPPORT);
    const r = await attest(SUPPORT_S)
      .send({ ...body(SUBJECT_A), step_up_challenge_id: supportChallenge })
      .expect(403);
    expect(r.body.code).toBe('PERMISSION_DENIED');
  });

  it('4 - a REVOKED IDENTITY_REVIEWER grant receives 403', async () => {
    const challenge = await mintStepUp(OP_REVOKED);
    const r = await attest(REVOKED_S)
      .send({ ...body(SUBJECT_A), step_up_challenge_id: challenge })
      .expect(403);
    expect(r.body.code).toBe('PERMISSION_DENIED');
  });

  // ------------------------------------------------------------------ 5-6
  // The trap: a new signature is a NEW function object, with PostgreSQL's
  // defaults -- PUBLIC execute, default owner -- and the old one still
  // present behind it.

  it('5 - the new function is owned by adulis_verification and is not PUBLIC-executable', async () => {
    const r = await admin.query(
      `SELECT r.rolname AS owner,
              has_function_privilege('public', p.oid, 'EXECUTE') AS public_exec,
              has_function_privilege('adulis_app', p.oid, 'EXECUTE') AS app_exec
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         JOIN pg_roles r ON r.oid = p.proowner
        WHERE n.nspname = 'verification' AND p.proname = 'write_attestation'`,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].owner).toBe('adulis_verification');
    expect(r.rows[0].public_exec).toBe(false);
    expect(r.rows[0].app_exec).toBe(true);
  });

  it('6 - the old eight-argument signature no longer exists', async () => {
    const r = await admin.query(
      `SELECT p.oid::regprocedure::text AS sig, p.pronargs
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'verification' AND p.proname = 'write_attestation'`,
    );
    // Exactly one overload, and it takes the actor. Leaving the old one is
    // leaving the hole open behind a new door.
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].pronargs).toBe(9);
    expect(r.rows[0].sig).toContain('uuid,uuid,verification.verifier_kind');
  });

  // -------------------------------------------------------------------- 7
  // The regression that would hurt most, and would not fail loudly.

  it('7 - an AUDIENCE-only seller is still admitted by fn_evaluate_eligibility', async () => {
    const r = await admin.query(
      `SELECT (e).outcome::text AS outcome, (e).path::text AS path
         FROM core.fn_evaluate_eligibility($1) e`,
      [AUDIENCE_SELLER],
    );
    // ADU-PRD-01 S4.1 admits a seller on EITHER path, and the audience one
    // carries the beta. Closing IDENTITY must not close admission -- and
    // that failure would not raise anywhere; it would appear as a cohort
    // that cannot onboard.
    expect(r.rows[0].outcome).toBe('SATISFIED');
    expect(r.rows[0].path).toBe('AUDIENCE');
  });
});
