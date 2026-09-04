import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import {
  FakeSocialPlatformAdapter,
  SOCIAL_PLATFORM_ADAPTER,
} from '../src/modules/onboarding/social-platform.adapter';

/**
 * C1 — onboarding and verification, the per-group gate: every endpoint's
 * happy path, its 403, its 404, and its documented 409, through the same
 * wiring main.ts serves, as the real runtime role.
 *
 * The 403s exercised here are of both kinds and arrive identically
 * (ADU-AUTH-01 S14): a ROLE failure (ANALYST at a write) and a SURFACE
 * failure (a MOBILE session at a CONSOLE-only capability), both
 * PERMISSION_DENIED with the same body. The 404 is the scope failure of a
 * stranger holding no relationship — never 403, no detail.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = '66666666-5555-4000-8000-000000000001';
const OWNER = '66666666-5555-4000-8000-000000000002';
const ANALYST = '66666666-5555-4000-8000-000000000003';
const STRANGER = '66666666-5555-4000-8000-000000000004';
const DEVICE = '66666666-5555-4000-8000-000000000005';
const OWNER_S = '66666666-5555-4000-8000-000000000006';
const ANALYST_S = '66666666-5555-4000-8000-000000000007';
const STRANGER_S = '66666666-5555-4000-8000-000000000008';
const OWNER_MOBILE_S = '66666666-5555-4000-8000-000000000009';
const STEP_UP_OK = '66666666-5555-4000-8000-00000000000a';
const STEP_UP_STALE = '66666666-5555-4000-8000-00000000000b';
const STEP_UP_WRONG = '66666666-5555-4000-8000-00000000000c';
const OTP = '66666666-5555-4000-8000-00000000000d';

const fake = new FakeSocialPlatformAdapter();

@Module({ imports: [AppModule] })
class C1AppModule {}

describe('C1 — onboarding and verification', () => {
  let app: INestApplication;
  let admin: Pool;
  let sellerId = '';

  const cookie = (t: string) => `__Host-adulis_session=${t}`;
  const key = () =>
    `66666666-5555-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;

  /** A console write request with everything the pipeline demands. */
  const post = (path: string, token: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Cookie', cookie(token))
      .set('Origin', CONSOLE_ORIGIN)
      .set('Idempotency-Key', key());

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'C1E','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en', 'ACTIVE', true, 'AFROMESSAGE')`,
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
        ($1,'+251911661001',$4,'ACTIVE'),
        ($2,'+251911661002',$4,'ACTIVE'),
        ($3,'+251911661003',$4,'ACTIVE')`,
      [OWNER, ANALYST, STRANGER, M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at) VALUES
        ($1,$5,'CONSOLE',$4, now()+interval '12 hours'),
        ($2,$6,'CONSOLE',$4, now()+interval '12 hours'),
        ($3,$7,'CONSOLE',$4, now()+interval '12 hours'),
        ($8,$5,'MOBILE',$4, now()+interval '30 days')`,
      [OWNER_S, ANALYST_S, STRANGER_S, DEVICE, OWNER, ANALYST, STRANGER, OWNER_MOBILE_S],
    );
    // step-up fixtures (the OTP row satisfies the challenge FK)
    await admin.query(
      `INSERT INTO core.otp_challenge (id, purpose, phone_e164, code_hash, expires_at, consumed_at, step_up_action)
       VALUES ($1,'STEP_UP','+251911661001', decode('00','hex'), now()+interval '1 hour', now(), 'IDENTITY_CHANGE')`,
      [OTP],
    );
    await admin.query(
      `INSERT INTO core.step_up_challenge (id, account_id, action, otp_challenge_id, satisfied_at, expires_at) VALUES
        ($1,$4,'IDENTITY_CHANGE',$5, now(), now()+interval '1 hour'),
        ($2,$4,'IDENTITY_CHANGE',$5, now()-interval '30 minutes', now()+interval '1 hour'),
        ($3,$4,'PAYOUT_CHANGE',$5, now(), now()+interval '1 hour')`,
      [STEP_UP_OK, STEP_UP_STALE, STEP_UP_WRONG, OWNER, OTP],
    );

    const moduleRef = await Test.createTestingModule({ imports: [C1AppModule] })
      .overrideProvider(SOCIAL_PLATFORM_ADAPTER)
      .useValue(fake)
      .compile();
    app = moduleRef.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    // Fixture teardown only: replica mode silences the append-only triggers
    // for THIS superuser session so test rows can leave. Nothing in runtime
    // code path ever does this.
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id IN ('${OWNER}','${ANALYST}','${STRANGER}')`,
      `DELETE FROM analytics.event WHERE market_id = '${M}'`,
      `DELETE FROM core.account_control_challenge WHERE seller_social_account_id IN
         (SELECT id FROM core.seller_social_account WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}'))`,
      `DELETE FROM core.seller_social_account WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM core.seller_eligibility_evaluation WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM core.seller_availability WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM core.seller_availability_override WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM core.seller_fulfilment_method WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM core.seller_company_detail WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM core.seller_team_member WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM verification.identity_attestation WHERE person_id IN
         (SELECT person_id FROM core.seller WHERE market_id='${M}' AND person_id IS NOT NULL)`,
      `UPDATE core.seller SET person_id = NULL WHERE market_id='${M}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN (SELECT id FROM core.seller WHERE market_id='${M}')`,
      `DELETE FROM core.seller WHERE market_id='${M}'`,
      // WAS A TABLE-WIDE ORPHAN SWEEP (T22, D-273). "Every person nothing
      // references" deletes another worker's row the instant that suite has
      // detached it and not yet re-attached it -- a window every suite with a
      // person fixture opens. Scoped to the people this market's own accounts
      // and sellers ever pointed at.
      `DELETE FROM core.person WHERE id IN (
          SELECT person_id FROM core.account WHERE market_id='${M}' AND person_id IS NOT NULL
          UNION SELECT person_id FROM core.seller WHERE market_id='${M}' AND person_id IS NOT NULL
        )`,
      `DELETE FROM core.step_up_challenge WHERE account_id='${OWNER}'`,
      `DELETE FROM core.otp_challenge WHERE id='${OTP}'`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${OWNER}','${ANALYST}','${STRANGER}')`,
      `DELETE FROM core.session WHERE account_id IN ('${OWNER}','${ANALYST}','${STRANGER}')`,
      `DELETE FROM core.device WHERE id='${DEVICE}'`,
      `DELETE FROM core.account WHERE market_id='${M}'`,
      `DELETE FROM core.identity_config WHERE market_id='${M}'`,
      `DELETE FROM core.eligibility_config WHERE market_id='${M}'`,
      `DELETE FROM core.timing_config WHERE market_id='${M}'`,
      `DELETE FROM core.market WHERE id='${M}'`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  describe('POST /v1/seller — creation', () => {
    it('creates the seller and evaluates eligibility inline (201)', async () => {
      const r = await post('/v1/seller', OWNER_S)
        .send({ entity_type: 'INDIVIDUAL', store_name: 'Habesha Finds', handle: 'habesha-finds' })
        .expect(201);
      sellerId = r.body.seller_id;
      expect(r.body.status).toBe('DRAFT');
      expect(r.body.eligibility.outcome).toBe('NOT_SATISFIED');
      // the ANALYST joins the team for the role-403 cases below
      await admin.query(
        `INSERT INTO core.seller_team_member (id, seller_id, account_id, role)
         VALUES (gen_random_uuid(), $1, $2, 'ANALYST')`,
        [sellerId, ANALYST],
      );
    });

    it('409 HANDLE_TAKEN on a duplicate handle in the market', async () => {
      const r = await post('/v1/seller', OWNER_S)
        .send({ entity_type: 'INDIVIDUAL', store_name: 'Again', handle: 'habesha-finds' })
        .expect(409);
      expect(r.body.code).toBe('HANDLE_TAKEN');
    });

    it('400 IDEMPOTENCY_KEY_MISSING without the key', async () => {
      const r = await request(app.getHttpServer())
        .post('/v1/seller')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .send({ entity_type: 'INDIVIDUAL', store_name: 'X', handle: 'x-store-x' })
        .expect(400);
      expect(r.body.code).toBe('IDEMPOTENCY_KEY_MISSING');
    });
  });

  describe('GET /v1/seller/list — the store list (T18 Phase 3, D-97)', () => {
    it('needs NO seller header — the header is the question, not the input', async () => {
      // The third exemption. Every other GET under /v1/seller is 400
      // SELLER_CONTEXT_REQUIRED without X-Adulis-Seller; this one cannot be,
      // because the caller is asking which sellers they hold.
      const r = await request(app.getHttpServer())
        .get('/v1/seller/list')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .expect(200);
      expect(Array.isArray(r.body.data)).toBe(true);

      // The contrast, on the same session, one endpoint along.
      const other = await request(app.getHttpServer())
        .get('/v1/seller/readiness')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .expect(400);
      expect(other.body.code).toBe('SELLER_CONTEXT_REQUIRED');
    });

    it('the owner sees their store as OWNER', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/seller/list')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .expect(200);
      const mine = r.body.data.find((x: { id: string }) => x.id === sellerId);
      expect(mine).toBeDefined();
      // The Owner is core.seller.owner_account_id and ONLY that -- a CHECK
      // forbids role = 'OWNER' on a team row -- so this string comes from the
      // owner arm of the union, never from a membership.
      expect(mine.role).toBe('OWNER');
      expect(mine.handle).toBe('habesha-finds');
      expect(mine.store_name).toBe('Habesha Finds');
      expect(mine.status).toBe('DRAFT');
    });

    it('a team member sees the same store under THEIR role, not the owner\'s', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/seller/list')
        .set('Cookie', cookie(ANALYST_S))
        .set('Origin', CONSOLE_ORIGIN)
        .expect(200);
      const seen = r.body.data.find((x: { id: string }) => x.id === sellerId);
      expect(seen).toBeDefined();
      expect(seen.role).toBe('ANALYST');
      // S2.1's case: one account, two relationships, and the role is the one
      // that account actually holds on that store.
      expect(seen.handle).toBe('habesha-finds');
    });

    it('a stranger sees an empty list, not a 403 and not a 404', async () => {
      // The rows are selected BY account id, so there is no relationship to
      // deny and no id to probe with. An empty list is the honest answer and
      // it is a 200 -- the same shape a seller with no stores yet receives.
      const r = await request(app.getHttpServer())
        .get('/v1/seller/list')
        .set('Cookie', cookie(STRANGER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .expect(200);
      expect(r.body.data).toEqual([]);
    });

    it('a case-variant path still demands the seller header (pass finding)', async () => {
      /*
       * Express routes case-INSENSITIVELY, and every predicate in
       * requiresSellerContext was case-SENSITIVE -- so GET /v1/SELLER/readiness
       * reached the handler with section 4.2's 400 skipped and actorRole
       * silently BUYER. It failed closed one layer down, but the guard's own
       * docstring promises "absent on a seller-scoped path -> 400", and that
       * promise was false for any capitalisation. The guard now lowercases once.
       *
       * This arm exists because the exemption added in this phase makes
       * "exempt on a /v1/seller path" a legitimate outcome for the first time,
       * which is exactly when a case-variant request stops looking anomalous.
       */
      const r = await request(app.getHttpServer())
        .get('/v1/SELLER/readiness')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .expect(400);
      expect(r.body.code).toBe('SELLER_CONTEXT_REQUIRED');

      // ...and the exemption itself is not case-sensitive either way.
      await request(app.getHttpServer())
        .get('/v1/SELLER/LIST')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .expect(200);
    });

    it('an owner who also holds a team row on their own store is listed ONCE', async () => {
      /*
       * team_member_is_never_owner constrains the ROLE VALUE (role <> 'OWNER'),
       * not the ACCOUNT -- nothing stops an owner holding an ADMIN row on their
       * own store. Under a naive UNION ALL that store appears twice, and the
       * console redirects only when the list has exactly ONE entry, so the
       * duplicate would strand that seller on a chooser showing one store twice.
       */
      await admin.query(
        `INSERT INTO core.seller_team_member (id, seller_id, account_id, role)
         VALUES (gen_random_uuid(), $1, $2, 'ADMIN')`,
        [sellerId, OWNER],
      );
      try {
        const r = await request(app.getHttpServer())
          .get('/v1/seller/list')
          .set('Cookie', cookie(OWNER_S))
          .set('Origin', CONSOLE_ORIGIN)
          .expect(200);
        const mine = r.body.data.filter((x: { id: string }) => x.id === sellerId);
        expect(mine).toHaveLength(1);
        // And it is the OWNER relationship that survives, not the ADMIN one.
        expect(mine[0].role).toBe('OWNER');
      } finally {
        await admin.query(
          `DELETE FROM core.seller_team_member WHERE seller_id=$1 AND account_id=$2`,
          [sellerId, OWNER],
        );
      }
    });

    it('a DELETED store is not listed, so the redirect cannot strand a seller in it', async () => {
      // core.seller_status carries DELETED. A deleted store is not somewhere a
      // seller can be sent, and with the console's exactly-one redirect,
      // listing it would forward a seller into it on every visit and leave them
      // unable to reach the screen offering to create a new one.
      await admin.query(`UPDATE core.seller SET status='DELETED' WHERE id=$1`, [sellerId]);
      try {
        const r = await request(app.getHttpServer())
          .get('/v1/seller/list')
          .set('Cookie', cookie(OWNER_S))
          .set('Origin', CONSOLE_ORIGIN)
          .expect(200);
        expect(r.body.data.some((x: { id: string }) => x.id === sellerId)).toBe(false);
      } finally {
        await admin.query(`UPDATE core.seller SET status='DRAFT' WHERE id=$1`, [sellerId]);
      }
    });

    it('a SUSPENDED membership is logged out AND filtered out (R28)', async () => {
      /*
       * TWO GUARANTEES, and the first is stronger than the one this arm was
       * written for. core.seller_team_member carries
       * trg_revoke_suspended_member_sessions, so suspending a member REVOKES
       * their sessions -- they do not get a filtered list, they get 401 and
       * have to sign in again. R28's "loses every permission on the next
       * request" is enforced by ending the request-making, not by trimming a
       * response.
       *
       * The list filter is therefore defence in depth, and it is asserted on a
       * FRESH session minted after the suspension -- which is exactly what a
       * suspended member holding a phone would obtain by signing in again.
       * Reusing the fixture's session here would prove nothing and would also
       * poison every later ANALYST test in this file, because a revoked session
       * cannot be un-revoked by clearing suspended_at.
       */
      await admin.query(
        `UPDATE core.seller_team_member SET suspended_at = now()
          WHERE seller_id=$1 AND account_id=$2`,
        [sellerId, ANALYST],
      );
      const freshSession = '66666666-5555-4000-8000-0000000000a1';
      try {
        // The existing session is gone -- that is the first guarantee.
        await request(app.getHttpServer())
          .get('/v1/seller/list')
          .set('Cookie', cookie(ANALYST_S))
          .set('Origin', CONSOLE_ORIGIN)
          .expect(401);

        // Signing in again gets them in, and the list is empty -- the second.
        await admin.query(
          `INSERT INTO core.session (id, account_id, audience, device_id, expires_at)
           VALUES ($1,$2,'CONSOLE',$3, now()+interval '12 hours')`,
          [freshSession, ANALYST, DEVICE],
        );
        const r = await request(app.getHttpServer())
          .get('/v1/seller/list')
          .set('Cookie', cookie(freshSession))
          .set('Origin', CONSOLE_ORIGIN)
          .expect(200);
        expect(r.body.data).toEqual([]);

        // The OWNER's view is untouched: suspension is a fact about one
        // membership, not about the store.
        const o = await request(app.getHttpServer())
          .get('/v1/seller/list')
          .set('Cookie', cookie(OWNER_S))
          .set('Origin', CONSOLE_ORIGIN)
          .expect(200);
        expect(o.body.data.some((x: { id: string }) => x.id === sellerId)).toBe(true);
      } finally {
        await admin.query(`DELETE FROM core.session WHERE id=$1`, [freshSession]);
        await admin.query(
          `DELETE FROM core.seller_team_member WHERE seller_id=$1 AND account_id=$2`,
          [sellerId, ANALYST],
        );
        // Re-join cleanly so the role-403 arms further down this file still
        // have their ANALYST membership. The session they use was revoked by
        // the suspension, so those arms are given a new one.
        await admin.query(
          `INSERT INTO core.seller_team_member (id, seller_id, account_id, role)
           VALUES (gen_random_uuid(), $1, $2, 'ANALYST')`,
          [sellerId, ANALYST],
        );
        await admin.query(
          `INSERT INTO core.session (id, account_id, audience, device_id, expires_at)
           VALUES ($1,$2,'CONSOLE',$3, now()+interval '12 hours')
           ON CONFLICT (id) DO UPDATE SET revoked_at = NULL,
                                          expires_at = now()+interval '12 hours'`,
          [ANALYST_S, ANALYST, DEVICE],
        );
      }
    });

  });

  describe('GET /v1/seller/readiness', () => {
    it('200 with the nine items in order', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/seller/readiness')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', sellerId)
        .expect(200);
      expect(r.body.items.map((i: { code: string }) => i.code)).toEqual([
        'ACCOUNT_CREATED', 'SELLER_TYPE_DECLARED', 'ELIGIBILITY_SATISFIED',
        'IDENTITY_VERIFIED', 'COMPANY_DETAILS', 'STORE_PROFILE',
        'PAYOUT_DETAILS', 'FULFILMENT_CONFIG', 'AT_LEAST_ONE_PRODUCT',
      ]);
    });

    it('404 for a stranger — never 403, no detail', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/seller/readiness')
        .set('Cookie', cookie(STRANGER_S))
        .set('X-Adulis-Seller', sellerId)
        .expect(404);
      expect(r.body.code).toBe('NOT_FOUND');
      expect(JSON.stringify(r.body)).not.toContain(sellerId);
    });

    it('403 for a MOBILE session — store:read is CONSOLE-only (surface gate, in the database)', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/seller/readiness')
        .set('Authorization', `Bearer ${OWNER_MOBILE_S}`)
        .set('X-Adulis-Seller', sellerId)
        .expect(403);
      expect(r.body.code).toBe('PERMISSION_DENIED');
    });

    it('400 SELLER_CONTEXT_REQUIRED without the header', async () => {
      await request(app.getHttpServer())
        .get('/v1/seller/readiness')
        .set('Cookie', cookie(OWNER_S))
        .expect(400);
    });
  });

  describe('PATCH /v1/seller/profile', () => {
    it('the owner updates the profile', async () => {
      await request(app.getHttpServer())
        .patch('/v1/seller/profile')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .send({ description: 'Handmade leather goods from Addis.' })
        .expect(200);
    });

    it('GET reads back the saved fields, with status and handle (v1.9 S15.0b)', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/seller/profile')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', sellerId)
        .expect(200);
      // The write-only form can now read what it saved...
      expect(r.body.description).toBe('Handmade leather goods from Addis.');
      expect(r.body.store_name).toBeTruthy();
      // ...plus the two the console had no way to know: status and handle.
      expect(r.body.handle).toBeTruthy();
      expect(r.body.status).toBe('DRAFT'); // created DRAFT, nothing published it
      expect(r.body.entity_type).toBe('INDIVIDUAL');
    });

    it('GET profile is CONSOLE-only: a MOBILE session is 403 (store:read surface gate)', async () => {
      await request(app.getHttpServer())
        .get('/v1/seller/profile')
        .set('Cookie', cookie(OWNER_MOBILE_S))
        .set('X-Adulis-Seller', sellerId)
        .expect(403);
    });

    it('403 for the ANALYST — a role failure, identical body to a surface failure', async () => {
      const r = await request(app.getHttpServer())
        .patch('/v1/seller/profile')
        .set('Cookie', cookie(ANALYST_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .send({ description: 'nope' })
        .expect(403);
      expect(r.body.code).toBe('PERMISSION_DENIED');
      expect(r.body.slots).toBeUndefined();
    });
  });

  describe('social accounts — the audience path', () => {
    let socialId = '';
    let code = '';

    it('links an account and issues the control code (201)', async () => {
      const r = await post('/v1/seller/social-accounts', OWNER_S)
        .set('X-Adulis-Seller', sellerId)
        .send({ platform: 'TIKTOK', handle: '@habesha' })
        .expect(201);
      socialId = r.body.social_account_id;
      code = r.body.code;
      expect(code).toMatch(/^ADU-/);
    });

    it('409 when the code is not in the bio', async () => {
      fake.register('TIKTOK', '@habesha', {
        platformAccountId: 'tk-1',
        followerCount: 5000,
        bio: 'no code here',
      });
      const r = await post(`/v1/seller/social-accounts/${socialId}/verify`, OWNER_S)
        .set('X-Adulis-Seller', sellerId)
        .send({})
        .expect(409);
      expect(r.body.slots.reason).toBe('CODE_NOT_FOUND_IN_BIO');
    });

    it('verifies when the bio carries the code; eligibility flips SATISFIED; ladder entered', async () => {
      fake.register('TIKTOK', '@habesha', {
        platformAccountId: 'tk-1',
        followerCount: 5000,
        bio: `selling soon ${code}`,
      });
      const r = await post(`/v1/seller/social-accounts/${socialId}/verify`, OWNER_S)
        .set('X-Adulis-Seller', sellerId)
        .send({})
        .expect(200);
      expect(r.body.status).toBe('VERIFIED');
      expect(r.body.follower_count_at_verification).toBe(5000);
      expect(r.body.eligibility.outcome).toBe('SATISFIED');
      const ladder = await admin.query(
        `SELECT level FROM core.seller_level_state WHERE seller_id=$1`,
        [sellerId],
      );
      expect(ladder.rows[0]?.level).toBe('NEW');
    });

    it('GET social-accounts carries the follower count AND when it was captured (v1.9 S15.0b)', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/seller/social-accounts')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', sellerId)
        .expect(200);
      const acc = r.body.accounts.find((a: { id: string }) => a.id === socialId);
      expect(acc).toBeTruthy();
      expect(acc.status).toBe('VERIFIED');
      expect(acc.handle).toBe('@habesha');
      // The count persisted, not just witnessed in the verify response...
      expect(acc.follower_count).toBe(5000);
      // ...AND R24's "as of <date>" has a date to name: captured_at is the
      // write-once verified_at, so it exists on the wire past this session.
      expect(acc.captured_at).toBeTruthy();
      expect(Number.isNaN(Date.parse(acc.captured_at))).toBe(false);
    });

    it('404 for a stranger probing the verify path', async () => {
      await request(app.getHttpServer())
        .post(`/v1/seller/social-accounts/${socialId}/verify`)
        .set('Cookie', cookie(STRANGER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .set('Idempotency-Key', key())
        .send({})
        .expect(404);
    });
  });

  describe('identity verification — OPERATOR-ONLY since G1.1', () => {
    const body = {
      // The subject is named explicitly now: an operator attests about
      // someone else and cannot derive them from their own session.
      person_id: '66666666-5555-4000-8000-0000000000f0',
      verifier_kind: 'OPERATOR_ATTESTED',
      vendor_reference: 'vnd-123',
      id_type: 'NATIONAL_ID',
      legal_name: 'Naod Solomon',
      id_hash: 'a'.repeat(64),
      verified_on: '2026-08-27',
    };

    it('403 STEP_UP_EXPIRED on a stale challenge (freshness is 5 minutes)', async () => {
      const r = await post('/v1/seller/identity-verification', OWNER_S)
        .send({ ...body, step_up_challenge_id: STEP_UP_STALE })
        .expect(403);
      expect(r.body.code).toBe('STEP_UP_EXPIRED');
    });

    it('403 STEP_UP_ACTION_MISMATCH on a challenge minted for another action', async () => {
      const r = await post('/v1/seller/identity-verification', OWNER_S)
        .send({ ...body, step_up_challenge_id: STEP_UP_WRONG })
        .expect(403);
      expect(r.body.code).toBe('STEP_UP_ACTION_MISMATCH');
    });

    it('403 PERMISSION_DENIED for the Owner even with a fresh challenge, and no row is written', async () => {
      // This test asserted 201 until T5. The step-up was working perfectly
      // then and is working perfectly now: it proves the person holding
      // the phone is the account holder, which was never the question.
      // The question was whether anyone had checked the document.
      const r = await post('/v1/seller/identity-verification', OWNER_S)
        .send({ ...body, step_up_challenge_id: STEP_UP_OK })
        .expect(403);
      expect(r.body.code).toBe('PERMISSION_DENIED');

      // The attestation is the claim worth asserting, not the readiness
      // item: this market carries identity_required = false, so
      // IDENTITY_VERIFIED is satisfied by S4.2's second arm regardless of
      // whether anyone attested anything.
      const rows = await admin.query(
        `SELECT 1 FROM verification.identity_attestation WHERE person_id = $1`,
        [body.person_id],
      );
      expect(rows.rowCount).toBe(0);
    });

    it('carries no seller context, and does not need it', async () => {
      // The path is exempt from X-Adulis-Seller (guard, S4.2's second
      // exemption). Absent, it is NOT a 400: an operator holds no seller.
      const r = await post('/v1/seller/identity-verification', OWNER_S)
        .send({ ...body, step_up_challenge_id: STEP_UP_STALE })
        .expect(403);
      expect(r.body.code).not.toBe('SELLER_CONTEXT_REQUIRED');
    });
  });

  describe('availability and overrides', () => {
    it('PUT the weekly pattern; zero windows is also valid', async () => {
      await request(app.getHttpServer())
        .put('/v1/seller/availability')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .send({ windows: [{ weekday: 1, opens_at: '09:00', closes_at: '17:00' }] })
        .expect(200);
      await request(app.getHttpServer())
        .put('/v1/seller/availability')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .send({ windows: [] })
        .expect(200);
    });

    it('GET reads back the weekly pattern the editor loads (v1.9 S15.0b)', async () => {
      // Two windows, one weekday carrying two -- the shape the PUT accepts,
      // so the editor round-trips instead of editing a draft it cannot reopen.
      await request(app.getHttpServer())
        .put('/v1/seller/availability')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .send({
          windows: [
            { weekday: 1, opens_at: '09:00', closes_at: '12:00' },
            { weekday: 1, opens_at: '14:00', closes_at: '17:00' },
            { weekday: 3, opens_at: '10:00', closes_at: '18:00' },
          ],
        })
        .expect(200);
      const r = await request(app.getHttpServer())
        .get('/v1/seller/availability')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', sellerId)
        .expect(200);
      // Ordered weekday-then-open, and HH:MM (not HH:MM:SS) as the PUT sends.
      expect(r.body.windows).toEqual([
        { weekday: 1, opens_at: '09:00', closes_at: '12:00' },
        { weekday: 1, opens_at: '14:00', closes_at: '17:00' },
        { weekday: 3, opens_at: '10:00', closes_at: '18:00' },
      ]);
    });

    it('GET availability is empty (not an error) when zero windows -- a valid closed state', async () => {
      await request(app.getHttpServer())
        .put('/v1/seller/availability')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .send({ windows: [] })
        .expect(200);
      const r = await request(app.getHttpServer())
        .get('/v1/seller/availability')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', sellerId)
        .expect(200);
      expect(r.body.windows).toEqual([]);
    });

    it('PUT an override — idempotent by path, NO idempotency key demanded', async () => {
      await request(app.getHttpServer())
        .put('/v1/seller/availability-overrides/2026-09-11')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .send({ note: 'Enkutatash' })
        .expect(200);
      await request(app.getHttpServer())
        .put('/v1/seller/availability-overrides/2026-09-11')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .send({ note: 'Enkutatash - closed all day' })
        .expect(200);
    });

    it('a date more than 24 months ahead is VALIDATION_FAILED', async () => {
      await request(app.getHttpServer())
        .put('/v1/seller/availability-overrides/2031-01-01')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .send({})
        .expect(400);
    });

    it('GET lists ascending from today; DELETE is 204 whether or not it existed', async () => {
      const r = await request(app.getHttpServer())
        .get('/v1/seller/availability-overrides')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', sellerId)
        .expect(200);
      expect(r.body.data[0].date).toBe('2026-09-11');
      await request(app.getHttpServer())
        .delete('/v1/seller/availability-overrides/2026-09-11')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .expect(204);
      await request(app.getHttpServer())
        .delete('/v1/seller/availability-overrides/2026-09-11')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .expect(204);
    });
  });

  describe('company details and fulfilment', () => {
    it('409 SELLER_NOT_COMPANY on an individual seller — the composite FK speaks', async () => {
      const person = await admin.query(
        `INSERT INTO core.person (id) VALUES (gen_random_uuid()) RETURNING id`,
      );
      const r = await request(app.getHttpServer())
        .patch('/v1/seller/company-details')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .send({
          registration_identifier: 'REG-1',
          trade_licence_number: 'TL-1',
          tin: '0012345678',
          representative_person_id: person.rows[0].id,
          representative_relationship: 'Director',
        })
        .expect(409);
      expect(r.body.slots.reason).toBe('SELLER_NOT_COMPANY');
    });

    it('422 FULFILMENT_METHOD_REQUIRED when no method would remain active', async () => {
      const r = await request(app.getHttpServer())
        .put('/v1/seller/fulfilment-methods')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .send({ methods: [{ method: 'BUYER_COLLECTION', is_active: false }] })
        .expect(422);
      expect(r.body.code).toBe('FULFILMENT_METHOD_REQUIRED');
    });

    it('PUT then GET the fulfilment set', async () => {
      await request(app.getHttpServer())
        .put('/v1/seller/fulfilment-methods')
        .set('Cookie', cookie(OWNER_S))
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Seller', sellerId)
        .send({
          methods: [
            { method: 'BUYER_COLLECTION', handoff_note: 'Bole, near Edna Mall', is_active: true },
          ],
        })
        .expect(200);
      const r = await request(app.getHttpServer())
        .get('/v1/seller/fulfilment-methods')
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', sellerId)
        .expect(200);
      expect(r.body.methods).toHaveLength(1);
      expect(r.body.methods[0].method).toBe('BUYER_COLLECTION');
    });
  });
});
