import { randomUUID } from 'node:crypto';
import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { armFixtureSessions, sessionToken } from './session-fixture';

/**
 * T6 / G1.7 -- the subscription read, after purchasing was retired.
 *
 * Subscription purchase intents, the transfer reference and the "I have
 * transferred" assertion were retired with the legacy payment flows
 * (founder pre-launch authorization, migration 0063). What stays is the
 * status read: CONSOLE-only by permission surface (R4 -- a MOBILE session is
 * 403, never a redirect to an external purchase mechanism), carrying the
 * subscription and no payment instruction.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = randomUUID();
const OWNER = randomUUID();
const DEVICE = randomUUID();
const OWNER_S = randomUUID();
const OWNER_MOBILE_S = randomUUID();
const SELLER = randomUUID();
const SUB = randomUUID();

@Module({ imports: [AppModule] })
class T6AppModule {}

describe('T6 / G1.7 -- the subscription read carries no purchase intent', () => {
  let app: INestApplication;
  let admin: Pool;

  const cookie = (t: string) => `__Host-adulis_session=${sessionToken(t)}`;

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'T6I','Intent','PHASE_1','ETB','Africa/Addis_Ababa','en', 'ACTIVE', true, 'AFROMESSAGE')`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.timing_config (id, market_id, payment_confirmation_window, fulfilment_window, offline_sync_horizon,
         payout_activation_delay, recovery_cooling_period,
         deleted_number_cooling_period, refund_ack_window, media_retention,
         level_credit_grace, mobile_session_lifetime, console_session_lifetime,
         console_idle_timeout, console_remembered_lifetime,
         console_remembered_idle, otp_ttl, otp_max_attempts, step_up_freshness,
         new_device_payout_lock, same_seller_cancellation_threshold,
         same_seller_cooldown, cross_seller_cooldown_ladder,
         cancellation_counter_decay)
       VALUES (gen_random_uuid(), $1,'24 hours','72 hours','7 days',
         '24 hours','7 days','30 days','48 hours','90 days','24 hours',
         '30 days','12 hours','30 minutes','7 days','8 hours','5 minutes',5,
         '5 minutes','24 hours',3,'1 hour',
         ARRAY['1 day','2 days','4 days']::interval[],'30 days')`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status)
       VALUES ($1,'+251919970001',$2,'ACTIVE')`,
      [OWNER, M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at)
       VALUES ($1,$3,'CONSOLE',$4, now() + interval '12 hours'),
              ($2,$3,'MOBILE',$4, now() + interval '30 days')`,
      [OWNER_S, OWNER_MOBILE_S, OWNER, DEVICE],
    );
    await armFixtureSessions(admin, [OWNER_S, OWNER_MOBILE_S]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','Intent Store','t6-intent','ACTIVE')`,
      [SELLER, M, OWNER],
    );
    await admin.query(
      `INSERT INTO billing.subscription (id, seller_id, state) VALUES ($1,$2,'BETA')`,
      [SUB, SELLER],
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
    await admin.query(`DELETE FROM billing.subscription_state_transition WHERE subscription_id = $1`, [SUB]);
    await admin.query(`DELETE FROM billing.subscription WHERE id = $1`, [SUB]);
    await admin.query(`DELETE FROM core.seller_public_stats WHERE seller_id = $1`, [SELLER]);
    await admin.query(`DELETE FROM core.seller WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.session WHERE id = ANY($1::uuid[])`, [[OWNER_S, OWNER_MOBILE_S]]);
    await admin.query(`DELETE FROM core.device WHERE id = $1`, [DEVICE]);
    await admin.query(`DELETE FROM core.account WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.timing_config WHERE market_id = $1`, [M]);
    await admin.query(`DELETE FROM core.market WHERE id = $1`, [M]);
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  it('GET /v1/billing/subscription returns only { subscription }, with no intent', async () => {
    const r = await request(app.getHttpServer())
      .get('/v1/billing/subscription')
      .set('Cookie', cookie(OWNER_S))
      .set('X-Adulis-Seller', SELLER)
      .expect(200);
    expect(Object.keys(r.body)).toEqual(['subscription']);
    expect(r.body).not.toHaveProperty('intent');
    expect(r.body.subscription.state).toBe('BETA');
  });

  it('a MOBILE session is 403 on the read -- never a redirect (R4)', async () => {
    await request(app.getHttpServer())
      .get('/v1/billing/subscription')
      .set('Authorization', `Bearer ${sessionToken(OWNER_MOBILE_S)}`)
      .set('X-Adulis-Seller', SELLER)
      .expect(403);
  });

  it('purchase-intent and mark-transferred are 404 and open no intent or collection record', async () => {
    for (const path of ['/v1/billing/purchase-intent', '/v1/billing/mark-transferred']) {
      await request(app.getHttpServer())
        .post(path)
        .set('Cookie', cookie(OWNER_S))
        .set('X-Adulis-Seller', SELLER)
        .set('Origin', CONSOLE_ORIGIN)
        .set('Idempotency-Key', randomUUID())
        .send({ tier: 'LISTED', term: 'ANNUAL', collection_record_id: randomUUID() })
        .expect(404);
    }
    const n = await admin.query<{ intents: number; records: number }>(
      `SELECT (SELECT count(*)::int FROM billing.purchase_intent WHERE subscription_id = $1) AS intents,
              (SELECT count(*)::int FROM billing.collection_record WHERE subscription_id = $1) AS records`,
      [SUB],
    );
    expect(n.rows[0]).toEqual({ intents: 0, records: 0 });
  });
});
