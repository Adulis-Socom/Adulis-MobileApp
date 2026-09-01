import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { FakeSmsAdapter, SMS_ADAPTER } from '../src/modules/auth/sms.adapter';

/**
 * T14 A3 -- ADU-AUTH-01 v2.6 S31.1, by name, plus the stamp that makes it
 * enforceable (ADU-RUL-06 S2, migration 0044).
 *
 *   - MOBILE -> MOBILE only
 *   - CONSOLE -> CONSOLE only
 *   - the verify endpoint cannot override the audience
 *
 * The mechanism under test is the STAMP: the audience is written on the
 * challenge at request, the verify body cannot carry one at all, and the
 * device CHANNEL (cookie vs body) is what a caller physically cannot fake --
 * the httpOnly cookie is server-minted and a native client has no cookie jar.
 * A surface conversion therefore needs a door that does not exist, instead of
 * a field nobody checked.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const P = (n: string): string => `+251911334${n}`;

@Module({ imports: [AppModule] })
class T14A3AppModule {}

describe('T14 A3 - the audience is the challenge stamp (S31.1)', () => {
  let app: INestApplication;
  let admin: Pool;
  const sms = new FakeSmsAdapter();
  const key = () => randomUUID();
  const http = () => request(app.getHttpServer());
  /** ANDROID device for the MOBILE door, minted directly like c6 does. */
  const DEVICE = randomUUID();
  const webDevices: string[] = [];

  const codeFor = (phone: string): string => {
    const m = sms.lastTo(phone);
    if (!m) throw new Error(`no SMS captured for ${phone}`);
    return m.slots['code'] as string;
  };

  const browserCookie = async (): Promise<string> => {
    const res = await http()
      .get('/v1/bootstrap')
      .set('X-Adulis-Client', 'web/9.9.9')
      .expect(200);
    const raw = res.headers['set-cookie'] as unknown as string[];
    const line = raw.find((c) => c.startsWith('__Host-adulis_browser='));
    if (!line) throw new Error('bootstrap issued no device cookie');
    const id = line.split('=', 2)[1]?.split(';')[0] as string;
    webDevices.push(id);
    return `__Host-adulis_browser=${id}`;
  };

  const requestOtp = (phone: string, audience: 'MOBILE' | 'CONSOLE', cookie?: string) => {
    let r = http()
      .post('/v1/auth/otp/request')
      .set('Idempotency-Key', key())
      .set('X-Adulis-Device', DEVICE);
    if (cookie) r = r.set('Cookie', cookie).set('Origin', CONSOLE_ORIGIN);
    return r.send({ phone, purpose: 'SIGN_IN', audience });
  };

  async function cleanup(): Promise<void> {
    // SESSIONS FIRST: core.session references the challenge it was created
    // from, so the challenge delete declines while a session stands.
    const a = await admin.query<{ id: string }>(
      `SELECT id FROM core.account WHERE phone_e164 LIKE '+251911334%'`,
    );
    const ids = a.rows.map((r) => r.id);
    if (ids.length) {
      await admin.query(`DELETE FROM core.session WHERE account_id = ANY($1::uuid[])`, [ids]);
      await admin.query(`UPDATE core.device SET account_id = NULL WHERE account_id = ANY($1::uuid[])`, [ids]);
      await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [ids]);
      await admin.query(`DELETE FROM core.account WHERE id = ANY($1::uuid[])`, [ids]);
    }
    await admin.query(`DELETE FROM core.otp_challenge WHERE phone_e164 LIKE '+251911334%'`);
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [T14A3AppModule] })
      .overrideProvider(SMS_ADAPTER)
      .useValue(sms)
      .compile();
    app = mod.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await cleanup();
    // The seeded market is ACTIVE with OTP enabled; the ANDROID device joins
    // it so the issue gate passes on the MOBILE door.
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id)
       SELECT $1, 'ANDROID', id FROM core.market WHERE code = 'SEED'`,
      [DEVICE],
    );
  });

  afterAll(async () => {
    await cleanup();
    await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = $1`, [DEVICE]);
    await admin.query(`DELETE FROM core.device WHERE id = $1`, [DEVICE]);
    if (webDevices.length) {
      await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [webDevices]);
      await admin.query(`DELETE FROM core.device WHERE id = ANY($1::uuid[]) AND account_id IS NULL`, [webDevices]);
    }
    await admin.end();
    await app.close();
  });

  it('the stamp is written at request, and it is what the wire said', async () => {
    const phone = P('01');
    await requestOtp(phone, 'MOBILE').expect(202);
    const row = await admin.query<{ audience: string; market_id: string | null; max_attempts: number }>(
      `SELECT audience::text AS audience, market_id, max_attempts
         FROM core.otp_challenge WHERE phone_e164 = $1
        ORDER BY created_at DESC LIMIT 1`,
      [phone],
    );
    expect(row.rows[0]?.audience).toBe('MOBILE');
    // Every governing parameter is on the row (ADU-RUL-06 S2): the market
    // that governed creation, and the frozen attempt budget.
    expect(row.rows[0]?.market_id).toBeTruthy();
    expect(row.rows[0]?.max_attempts).toBeGreaterThan(0);
  });

  it('MOBILE -> MOBILE only: the console door cannot mint from a MOBILE stamp', async () => {
    const phone = P('02');
    await requestOtp(phone, 'MOBILE').expect(202);
    const code = codeFor(phone);

    // The browser door: a real bootstrap cookie, no body device. The
    // challenge says MOBILE, the door says browser -- refused, and the code
    // is NOT consumed by the refusal.
    const cookie = await browserCookie();
    const refused = await http()
      .post('/v1/auth/otp/verify')
      .set('Idempotency-Key', key())
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Client', 'web/9.9.9')
      .set('Cookie', cookie)
      .send({ phone, code, age_declared_over_18: true })
      .expect(400);
    expect(JSON.stringify(refused.body)).toContain('bootstrap');

    // The mobile door mints -- same challenge, same code.
    const ok = await http()
      .post('/v1/auth/otp/verify')
      .set('Idempotency-Key', key())
      .set('X-Adulis-Device', DEVICE)
      .send({ phone, code, device_id: DEVICE, age_declared_over_18: true })
      .expect(200);
    expect(ok.body.token).toBeTruthy();
    const session = await admin.query<{ audience: string }>(
      `SELECT s.audience::text AS audience FROM core.session s
        JOIN core.account a ON a.id = s.account_id WHERE a.phone_e164 = $1`,
      [phone],
    );
    expect(session.rows.map((r) => r.audience)).toEqual(['MOBILE']);
  });

  it('CONSOLE -> CONSOLE only: a body device cannot mint from a CONSOLE stamp', async () => {
    const phone = P('03');
    const cookie = await browserCookie();
    await requestOtp(phone, 'CONSOLE', cookie).expect(202);
    const code = codeFor(phone);

    // The body door with a NATIVE device row: the challenge says CONSOLE --
    // refused, nothing consumed, no session anywhere.
    await http()
      .post('/v1/auth/otp/verify')
      .set('Idempotency-Key', key())
      .set('X-Adulis-Device', DEVICE)
      .send({ phone, code, device_id: DEVICE, age_declared_over_18: true })
      .expect(400);

    // The browser door mints, as a CONSOLE session, as a cookie -- no token
    // in the body.
    const ok = await http()
      .post('/v1/auth/otp/verify')
      .set('Idempotency-Key', key())
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Client', 'web/9.9.9')
      .set('Cookie', cookie)
      .send({ phone, code, age_declared_over_18: true })
      .expect(200);
    expect(ok.body.token).toBeUndefined();
    const session = await admin.query<{ audience: string }>(
      `SELECT s.audience::text AS audience FROM core.session s
        JOIN core.account a ON a.id = s.account_id WHERE a.phone_e164 = $1`,
      [phone],
    );
    expect(session.rows.map((r) => r.audience)).toEqual(['CONSOLE']);
  });

  it('the verify endpoint cannot override the audience -- the field itself is refused', async () => {
    const phone = P('04');
    await requestOtp(phone, 'MOBILE').expect(202);
    const code = codeFor(phone);

    for (const claimed of ['MOBILE', 'CONSOLE']) {
      const r = await http()
        .post('/v1/auth/otp/verify')
        .set('Idempotency-Key', key())
        .set('X-Adulis-Device', DEVICE)
        .send({ phone, code, audience: claimed, device_id: DEVICE, age_declared_over_18: true })
        .expect(400);
      // REFUSED BY NAME, not silently stripped: a field silently discarded
      // is a field a client keeps sending (S5.2, S31.1).
      expect((r.body as { slots?: { path?: string } }).slots?.path).toBe('audience');
    }

    // And the refusal consumed nothing: the same code still signs in.
    await http()
      .post('/v1/auth/otp/verify')
      .set('Idempotency-Key', key())
      .set('X-Adulis-Device', DEVICE)
      .send({ phone, code, device_id: DEVICE, age_declared_over_18: true })
      .expect(200);
  });
});