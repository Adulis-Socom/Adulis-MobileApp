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
      // LIVE, because the removed lookup filtered on is_live and the test has
      // to be discriminating -- but created in the FUTURE, so bootstrap's
      // `is_live DESC, created_at ASC` prefers any other suite's live market
      // over these two. A parallel suite whose devices landed here would have
      // had its rows deleted by this file's teardown, which is the same
      // reach-across that t8-device-bootstrap avoids by staying non-live.
      await admin.query(
        `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                  display_timezone, default_locale, is_live, created_at)
         VALUES ($1,$2,'Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en',true,
                 now() + interval '10 years')`,
        [id, code],
      );
      const [q, p] = timingFor(id);
      await admin.query(q, p);
    }
  });

  /**
   * ORDER MATTERS, and the first version had it wrong: it tried to drop the
   * markets while its own accounts still pointed at them, so the guarded
   * DELETE correctly declined and the next run collided on the primary key.
   * Rows first, then configuration, then the market.
   */
  async function cleanup(): Promise<void> {
    await admin.query(`DELETE FROM core.rate_limit_bucket
       WHERE bucket_key IN ('otp-request','otp-request-ip','bootstrap-device-mint')`);
    await admin.query(`DELETE FROM core.otp_challenge WHERE phone_e164 LIKE '+2519119980%'`);

    // This suite's own phones, and the devices its markets hold. Unbound
    // devices only: a BOUND one belongs to an account this file did not
    // create, and deleting it is not this file's business.
    const mine = await admin.query<{ id: string }>(
      `SELECT id FROM core.account WHERE phone_e164 LIKE '+2519119980%'`,
    );
    const ids = mine.rows.map((r) => r.id);
    if (ids.length) {
      await admin.query(`DELETE FROM core.session WHERE account_id = ANY($1::uuid[])`, [ids]);
      await admin.query(`UPDATE core.device SET account_id = NULL WHERE account_id = ANY($1::uuid[])`, [ids]);
      await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [ids]);
      await admin.query(`DELETE FROM core.account WHERE id = ANY($1::uuid[])`, [ids]);
    }
    for (const m of [MA, MB]) {
      await admin.query(
        `DELETE FROM core.device WHERE market_id = $1 AND account_id IS NULL`,
        [m],
      );
      await admin.query(`DELETE FROM core.timing_config WHERE market_id = $1`, [m]);
      // Still guarded: if anything this file did not create still points at
      // the market, the market stays. A leftover market row is harmless; a
      // parallel suite losing its fixtures is not.
      await admin.query(
        `DELETE FROM core.market m WHERE m.id = $1
          AND NOT EXISTS (SELECT 1 FROM core.account a WHERE a.market_id = m.id)
          AND NOT EXISTS (SELECT 1 FROM core.device d WHERE d.market_id = m.id)`,
        [m],
      );
    }
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

  it('a device with no market is refused at the first step, and told what to call', async () => {
    // Fail closed, and say why. The old code would have picked a market for
    // this person; there is no honest one to pick.
    //
    // NOTE what this does and does not cover: the refusal fires at
    // otp/request, so identity creation is never reached. auth.service keeps
    // its own market check for the same condition, and that one is now
    // unreachable through the API -- defence in depth behind a door that
    // shuts first, not a second door anyone can knock on.
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

  /**
   * ADU-AUTH-01 S22, and the reason this test exists: the first version of
   * Phase 3 refused when coalesce(account market, device market) was NULL,
   * which made the refusal depend on whether the phone had an account. An
   * unregistered number got 400 where a registered one got 202 -- an
   * enumeration oracle on unauthenticated endpoints, in a product where an
   * account is a business. The answers must be indistinguishable.
   */
  it('a known and an unknown phone are indistinguishable on every anonymous path', async () => {
    const device = randomUUID();
    devices.push(device);
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$2)`,
      [device, MA],
    );

    const known = '+251911998010';
    const unknown = '+251911998011';
    const acct = randomUUID();
    accounts.push(acct);
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES ($1,$2,$3,'ACTIVE')`,
      [acct, known, MA],
    );

    const shape = (r: request.Response): string =>
      `${r.status}:${(r.body as { code?: string }).code ?? ''}`;

    // Sign-in request
    const a1 = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', device)
      .send({ phone: known, purpose: 'SIGN_IN' });
    const a2 = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', device)
      .send({ phone: unknown, purpose: 'SIGN_IN' });
    expect(shape(a2)).toBe(shape(a1));

    // Deletion request -- @Public and phone-taking, the door the first
    // version left widest open.
    const d1 = await request(app.getHttpServer())
      .post('/v1/deletion/otp/request')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', device)
      .send({ phone: known });
    const d2 = await request(app.getHttpServer())
      .post('/v1/deletion/otp/request')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', device)
      .send({ phone: unknown });
    expect(shape(d2)).toBe(shape(d1));
  });

  it('and the refusal for a market-less device is the same for both phones', async () => {
    // The refusal is about the CALLER'S device, so it must fire identically
    // whoever the phone belongs to.
    const orphan2 = randomUUID();
    devices.push(orphan2);
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [orphan2]);

    const shape = (r: request.Response): string =>
      `${r.status}:${JSON.stringify((r.body as { slots?: unknown }).slots ?? {})}`;
    const r1 = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', orphan2)
      .send({ phone: '+251911998010', purpose: 'SIGN_IN' });
    const r2 = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', orphan2)
      .send({ phone: '+251911998012', purpose: 'SIGN_IN' });
    expect(r1.status).toBe(400);
    expect(shape(r2)).toBe(shape(r1));
  });

  /**
   * T8 Phase 4 / ADU-RUL-03 S4 -- the age declaration.
   *
   * The API half was already built (ADU-AUTH-01 S13); what was missing was a
   * console that could send it, which made first-time sign-in impossible
   * (D-101). These assert the server side of the contract the console now
   * satisfies: the declaration is REQUIRED to create an identity, it is
   * recorded, and it is ignored once an account exists.
   */
  it('an identity cannot be created without the declaration, and the refusal names it', async () => {
    const device = randomUUID();
    devices.push(device);
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$2)`,
      [device, MA],
    );
    const phone = '+251911998020';

    await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', device)
      .send({ phone, purpose: 'SIGN_IN' })
      .expect(202);
    const code = sms.lastTo(phone)?.slots['code'] as string;

    const refused = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', device)
      .send({ phone, code, audience: 'MOBILE', device_id: device })
      .expect(400);
    expect((refused.body as { slots?: { path?: string } }).slots?.path).toBe(
      'age_declared_over_18',
    );

    const none = await admin.query(`SELECT id FROM core.account WHERE phone_e164 = $1`, [phone]);
    expect(none.rowCount).toBe(0);
  });

  it('the declaration is RECORDED, not just checked', async () => {
    const device = randomUUID();
    devices.push(device);
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$2)`,
      [device, MA],
    );
    const phone = '+251911998021';

    await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', device)
      .send({ phone, purpose: 'SIGN_IN' })
      .expect(202);
    const code = sms.lastTo(phone)?.slots['code'] as string;

    await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .set('Idempotency-Key', randomUUID())
      .set('X-Adulis-Device', device)
      .send({
        phone,
        code,
        audience: 'MOBILE',
        device_id: device,
        age_declared_over_18: true,
      })
      .expect(200);

    // ADU-AUTH-01 S13: "store the confirmation, not the date."
    const row = await admin.query(
      `SELECT id, age_declared_over_18, age_declared_at FROM core.account WHERE phone_e164 = $1`,
      [phone],
    );
    expect(row.rows[0].age_declared_over_18).toBe(true);
    expect(row.rows[0].age_declared_at).not.toBeNull();
    accounts.push(row.rows[0].id as string);
  });

  it('the auth path chooses no market of its own: only bootstrap does', async () => {
    // A structural assertion, because the defect was structural. If a future
    // change reintroduces a market lookup in the auth path, this fails.
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(__dirname, '..', 'src', 'modules');
    const files = [
      join(root, 'auth', 'auth.service.ts'),
      join(root, 'auth', 'otp.service.ts'),
      // The controller does the device resolution now, so it is the third
      // place a market lookup could plausibly reappear.
      join(root, 'auth', 'auth.controller.ts'),
      join(root, 'deletion', 'deletion.controller.ts'),
    ];
    for (const f of files) {
      const code = readFileSync(f, 'utf8')
        .split('\n')
        .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*'))
        .join('\n');
      // Not just `is_live`: any read of core.market from the auth path is the
      // thing the ruling removed. A lookup written a different way is still
      // the same lookup.
      expect(code).not.toContain('is_live');
      expect(code).not.toContain('core.market');
    }
  });
});
