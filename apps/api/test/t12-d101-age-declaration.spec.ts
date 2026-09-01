import { randomUUID } from 'node:crypto';
import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { FakeSmsAdapter, SMS_ADAPTER } from '../src/modules/auth/sms.adapter';

/**
 * D-101, RULED (WORK ORDER T12 S5.1, under ADU-AUTH-01 v2.6 S18.1/S18.2 --
 * the document is not yet installed, register D-176; this is the
 * founder-ruled shape and the debt is recorded there).
 *
 * "Rendered to everyone on the OTP screen; required by the server only when
 * creating an account." And the refusal is AGE_DECLARATION_REQUIRED, its own
 * code -- the whole defect was the API demanding a field the schema called
 * optional and answering "The request is not valid" with nothing to correct.
 *
 * THE THIRD TEST IS THE ORACLE HALF: an existing account signing in WITHOUT
 * the declaration must succeed, because requiring it only for new phones is
 * exactly why the client must render the box unconditionally -- asking the
 * server which case applies would enumerate accounts (S17).
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const CONSOLE_ORIGIN = 'http://localhost:5173';

const M = randomUUID();
const P_NEW = '+251911441894'; // no account until this suite creates one
const P_EXISTING = '+251911441895'; // account seeded below

const sms = new FakeSmsAdapter();

@Module({ imports: [AppModule] })
class T12D101Module {}

describe('D-101 -- the age declaration is a named refusal, and only for identity creation', () => {
  let app: INestApplication;
  let admin: Pool;

  const key = () => randomUUID();
  const http = () => request(app.getHttpServer());
  const codeFor = (phone: string): string => {
    const m = sms.lastTo(phone);
    if (!m) throw new Error(`no SMS captured for ${phone}`);
    return m.slots['code'] as string;
  };
  const webDevices: string[] = [];
  const browserCookie = async (): Promise<string> => {
    const res = await http().get('/v1/bootstrap').set('X-Adulis-Client', 'web/9.9.9').expect(200);
    const raw = res.headers['set-cookie'] as unknown as string[];
    const line = raw.find((c) => c.startsWith('__Host-adulis_browser='));
    if (!line) throw new Error('bootstrap issued no device cookie');
    const id = line.split('=', 2)[1]?.split(';')[0] as string;
    webDevices.push(id);
    return `__Host-adulis_browser=${id}`;
  };

  const verify = async (phone: string, declared: boolean) => {
    const device = await browserCookie();
    await http()
      .post('/v1/auth/otp/request')
      .set('Idempotency-Key', key())
      .set('Cookie', device)
      .send({ phone, purpose: 'SIGN_IN', audience: 'CONSOLE' })
      .expect(202);
    return http()
      .post('/v1/auth/otp/verify')
      .set('Idempotency-Key', key())
      .set('Cookie', device)
      .send({
        phone,
        code: codeFor(phone),
        // Stamped at request; the verify endpoint refuses the field (S5.2).
        ...(declared ? { age_declared_over_18: true } : {}),
      });
  };

  beforeAll(async () => {
    if (!ADMIN) throw new Error('DATABASE_URL_MIGRATE is not set.');
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await admin.query(
      `DELETE FROM core.rate_limit_bucket WHERE bucket_key IN ('otp-request','otp-request-ip')`,
    );
      /*
       * NOT LIVE, deliberately. Bootstrap binds a browser DEVICE to the
       * oldest LIVE market, and an account created at sign-in takes the
       * device's market (D-104) -- so a live test market here would capture
       * devices and accounts from EVERY parallel suite, and each suite's
       * teardown would trip over the other's rows (market_code_key on the
       * next run was the symptom). Non-live, this market exists only for
       * this suite's seeded rows; sign-in devices bind to the seed market.
       */
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'T101','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en',false, 'ACTIVE', true, 'AFROMESSAGE')`,
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
      `INSERT INTO core.account (id, phone_e164, market_id, status, age_declared_over_18)
       VALUES ($1, $2, $3, 'ACTIVE', true)`,
      [randomUUID(), P_EXISTING, M],
    );

    const moduleRef = await Test.createTestingModule({ imports: [T12D101Module] })
      .overrideProvider(SMS_ADAPTER)
      .useValue(sms)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    // SCOPED BY PHONE, NOT BY MARKET -- see t12-d89's teardown comment: a
    // created account takes its market from the DEVICE (oldest live market),
    // so market-scoped deletes miss rows under parallel workers.
    const PHONES = `'${P_NEW}','${P_EXISTING}'`;
    const ACCTS = `SELECT id FROM core.account WHERE phone_e164 IN (${PHONES})`;
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id IN (${ACCTS})`,
      `DELETE FROM core.notification WHERE recipient_account_id IN (${ACCTS})`,
      `DELETE FROM core.session WHERE account_id IN (${ACCTS})`,
      `DELETE FROM core.otp_challenge WHERE phone_e164 IN (${PHONES})`,
      `DELETE FROM core.device WHERE id = ANY($1::uuid[])`,
      `DELETE FROM core.account WHERE phone_e164 IN (${PHONES})`,
      `DELETE FROM core.timing_config WHERE market_id = '${M}'`,
      `DELETE FROM core.market WHERE id = '${M}'`,
    ]) {
      await admin.query(q, q.includes('$1::uuid[]') ? [webDevices] : undefined);
    }
    await admin.end();
  });

  test('a NEW phone without the declaration is refused BY NAME, and no account is created', async () => {
    const r = await verify(P_NEW, false);
    expect(r.status).toBe(400);
    // THE DEFECT WAS THE CODE: a bare VALIDATION_FAILED rendered as "The
    // request is not valid" with nothing to correct. The name is the fix.
    expect(r.body.code).toBe('AGE_DECLARATION_REQUIRED');
    expect(r.body.title_key).toBe('error.auth.age_declaration_required');
    expect(r.body.slots?.path).toBe('age_declared_over_18');

    const acc = await admin.query(`SELECT 1 FROM core.account WHERE phone_e164 = $1`, [P_NEW]);
    expect(acc.rows).toHaveLength(0);
  });

  test('the same phone WITH the declaration creates the account, with the confirmation stored', async () => {
    const r = await verify(P_NEW, true);
    expect(r.status).toBe(200);
    const acc = await admin.query(
      `SELECT age_declared_over_18, age_declared_at FROM core.account WHERE phone_e164 = $1`,
      [P_NEW],
    );
    expect(acc.rows).toHaveLength(1);
    expect(acc.rows[0].age_declared_over_18).toBe(true);
    expect(acc.rows[0].age_declared_at).not.toBeNull();
  });

  test('an EXISTING account without the declaration signs in -- required only for identity creation', async () => {
    const r = await verify(P_EXISTING, false);
    expect(r.status).toBe(200);
  });
});
