import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { FakeSmsAdapter, SMS_ADAPTER } from '../src/modules/auth/sms.adapter';

/**
 * T8 Phase 3 -- identity creation takes its market from the device
 * (ADU-RUL-03 S3, D-104).
 *
 * The defect this closes did not raise: `SELECT id FROM core.market WHERE
 * is_live LIMIT 1` with no ORDER BY silently decided which market a person's
 * account belonged to -- its currency, its timezone, its ladder -- and a
 * second live market made that arbitrary. It was found because it broke a
 * green test suite, which is a lucky way to find a data-assignment bug.
 *
 * So the test is: with TWO live markets, does a new account still land in the
 * one its device was placed in? An ORDER BY would have made the old lookup
 * deterministic and still wrong; only reading the device answers the question
 * that was actually asked.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const MA = '77e00329-0000-4000-8000-00000000000a';
const MB = '77e00329-0000-4000-8000-00000000000b';
const PHONE = '+251911998001';

@Module({ imports: [AppModule] })
class T8P3AppModule {}

describe('T8 Phase 3 - the market comes from the device', () => {
  let app: INestApplication;
  let admin: Pool;
  const sms = new FakeSmsAdapter();
  const devices: string[] = [];
  const accounts: string[] = [];

  const timingFor = (marketId: string): [string, string[]] => [
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
    [marketId],
  ];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [T8P3AppModule] })
      .overrideProvider(SMS_ADAPTER)
      .useValue(sms)
      .compile();
    app = mod.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
    admin = new Pool({ connectionString: ADMIN });

    await cleanup();
    // TWO LIVE MARKETS. Before this phase that alone made account assignment
    // arbitrary; nothing in the schema forbids it (D-104's ruling question).
    for (const [id, code] of [
      [MA, 'T8A'],
      [MB, 'T8B'],
    ] as const) {
      await admin.query(
        `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                  display_timezone, default_locale, is_live)
         VALUES ($1,$2,'Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en',true)`,
        [id, code],
      );
      const [q, p] = timingFor(id);
      await admin.query(q, p);
    }
  });

  async function cleanup(): Promise<void> {
    await admin.query(`DELETE FROM core.rate_limit_bucket
       WHERE bucket_key IN ('otp-request','otp-request-ip','bootstrap-device-mint')`);
    await admin.query(`DELETE FROM core.otp_challenge WHERE phone_e164 = $1`, [PHONE]);
    for (const m of [MA, MB]) {
      await admin.query(
        `DELETE FROM core.session WHERE account_id IN (SELECT id FROM core.account WHERE market_id = $1)`,
        [m],
      );
      await admin.query(
        `UPDATE core.device SET account_id = NULL
          WHERE account_id IN (SELECT id FROM core.account WHERE market_id = $1)`,
        [m],
      );
      await admin.query(`DELETE FROM core.device WHERE market_id = $1`, [m]);
      await admin.query(`DELETE FROM core.account WHERE market_id = $1`, [m]);
      await admin.query(`DELETE FROM core.timing_config WHERE market_id = $1`, [m]);
      await admin.query(`DELETE FROM core.market WHERE id = $1`, [m]);
    }
    await admin.query(`DELETE FROM core.account WHERE phone_e164 = $1`, [PHONE]);
  }

  afterAll(async () => {
    if (devices.length) {
      await admin.query(`UPDATE core.device SET account_id = NULL WHERE id = ANY($1::uuid[])`, [devices]);
    }
    if (accounts.length) {
      await admin.query(`DELETE FROM core.session WHERE account_id = ANY($1::uuid[])`, [accounts]);
      await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [accounts]);
    }
    if (devices.length) {
      await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [devices]);
      await admin.query(`DELETE FROM core.device WHERE id = ANY($1::uuid[])`, [devices]);
    }
    await cleanup();
    await admin.end();
    await app.close();
  });

  it('a new identity joins the market its DEVICE was placed in, not "a live one"', async () => {
    // The device is placed in MB by hand -- which is what /v1/bootstrap does,
    // and doing it explicitly is what makes the assertion mean something: MA
    // is also live, and was created first, so every ordering the old lookup
    // could have used would have picked MA.
    const device = randomUUID();
    devices.push(device);
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$2)`,
      [device, MB],
    );

    await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', device)
      .send({ phone: PHONE, purpose: 'SIGN_IN' })
      .expect(202);

    const code = sms.lastTo(PHONE)?.slots['code'] as string;
    expect(code).toMatch(/^\d{6}$/);

    await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', device)
      .send({
        phone: PHONE,
        code,
        audience: 'MOBILE',
        device_id: device,
        age_declared_over_18: true,
      })
      .expect(200);

    const acct = await admin.query(
      `SELECT id, market_id FROM core.account WHERE phone_e164 = $1`,
      [PHONE],
    );
    expect(acct.rowCount).toBe(1);
    accounts.push(acct.rows[0].id as string);
    expect(acct.rows[0].market_id).toBe(MB);
  });

  it('a device with no market cannot create an identity, and is told what to call', async () => {
    // Fail closed, and say why. The old code would have picked a market for
    // this person; there is no honest one to pick.
    const orphan = randomUUID();
    devices.push(orphan);
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [orphan]);

    const res = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', orphan)
      .send({ phone: '+251911998002', purpose: 'SIGN_IN' })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('bootstrap');
  });

  it('the auth path chooses no market of its own: only bootstrap does', async () => {
    // A structural assertion, because the defect was structural. If a future
    // change reintroduces a market lookup in the auth path, this fails.
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(__dirname, '..', 'src', 'modules', 'auth');
    for (const f of ['auth.service.ts', 'otp.service.ts']) {
      const text = readFileSync(join(root, f), 'utf8');
      const code = text
        .split('\n')
        .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*'))
        .join('\n');
      expect(code).not.toContain('is_live');
    }
  });
});
