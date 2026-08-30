import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { FakeSmsAdapter, SMS_ADAPTER } from '../src/modules/auth/sms.adapter';

/**
 * T8 Phase 2 -- /v1/bootstrap mints the browser's device (ADU-RUL-03 S2).
 *
 * The ruling closes an arm, and an arm that is closed only in prose reopens
 * the first time someone adds a fallback "just in case". So the test that
 * matters most here is the one asserting a CONSOLE request's own device id is
 * IGNORED rather than honoured.
 */

const CONSOLE_ORIGIN = 'http://localhost:5173';
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const WEB = 'web/9.9.9';

@Module({ imports: [AppModule] })
class T8AppModule {}

const cookieFrom = (res: request.Response, name: string): string | null => {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  const hit = list.find((c) => c.startsWith(`${name}=`));
  return hit ? (hit.split('=', 2)[1]?.split(';')[0] ?? null) : null;
};
const rawCookie = (res: request.Response, name: string): string | null => {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  return list.find((c) => c.startsWith(`${name}=`)) ?? null;
};

describe('T8 Phase 2 - the browser device is server-minted', () => {
  let app: INestApplication;
  let admin: Pool;
  const sms = new FakeSmsAdapter();
  /**
   * The market that has timing_config in force. The OTP paths resolve their
   * configuration through the ACCOUNT's market, so an account created
   * anywhere else reaches a lookup with no row -- which is a real fragility
   * (D-104, removed in Phase 3) but not this phase's subject.
   */
  let configuredMarket: string;
  const minted: string[] = [];
  /** Only ids a COOKIE issued -- the invariant is about those. */
  const issued: string[] = [];
  const accounts: string[] = [];

  /** An account in the configured market, so the OTP paths find their config. */
  const makeAccount = async (phone: string): Promise<string> => {
    // In dependency order: a device row points at an account, so a leftover
    // from an earlier run has to be unbound before the account can go.
    await admin.query(
      `UPDATE core.device SET account_id = NULL
        WHERE account_id IN (SELECT id FROM core.account WHERE phone_e164 = $1)`,
      [phone],
    );
    await admin.query(
      `DELETE FROM core.session
        WHERE account_id IN (SELECT id FROM core.account WHERE phone_e164 = $1)`,
      [phone],
    );
    await admin.query(`DELETE FROM core.account WHERE phone_e164 = $1`, [phone]);
    const id = randomUUID();
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES ($1,$2,$3,'ACTIVE')`,
      [id, phone, configuredMarket],
    );
    accounts.push(id);
    return id;
  };

  /** Drive a real OTP: these tests are about the DEVICE check, which sits
   *  behind the code check, so a bogus code never reaches it. */
  const realCode = async (phone: string, cookie: string): Promise<string> => {
    await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Client', WEB)
      .set('Idempotency-Key', randomUUID())
      .set('Cookie', cookie)
      .send({ phone, purpose: 'SIGN_IN' })
      .expect(202);
    const m = sms.lastTo(phone);
    if (!m) throw new Error(`no SMS captured for ${phone}`);
    return m.slots['code'] as string;
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [T8AppModule] })
      .overrideProvider(SMS_ADAPTER)
      .useValue(sms)
      .compile();
    app = mod.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
    admin = new Pool({ connectionString: ADMIN });
    await purgeBuckets();
    const m = await admin.query(
      `SELECT market_id FROM core.timing_config WHERE effective @> now() LIMIT 1`,
    );
    configuredMarket = m.rows[0].market_id as string;
  });

  /**
   * The IP-keyed buckets are shared by every suite and by every rerun on a
   * developer's machine, so a suite that spends them must also return them --
   * otherwise the next run fails on a 429 that has nothing to do with the
   * code under test. bootstrap-device-mint is this phase's own bucket.
   */
  async function purgeBuckets(): Promise<void> {
    await admin.query(
      `DELETE FROM core.rate_limit_bucket
        WHERE bucket_key IN ('otp-request','otp-request-ip','bootstrap-device-mint')`,
    );
  }

  afterAll(async () => {
    await purgeBuckets();
    await admin.query(`DELETE FROM core.otp_challenge WHERE phone_e164 LIKE '+25191199900%'`);
    if (minted.length) {
      await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [minted]);
    }
    if (accounts.length) {
      await admin.query(`DELETE FROM core.session WHERE account_id = ANY($1::uuid[])`, [accounts]);
      await admin.query(`DELETE FROM core.idempotency_record WHERE actor_id = ANY($1::uuid[])`, [accounts]);
    }
    // Devices before accounts: device.account_id is a foreign key, and the
    // rows this suite made are exactly the ones pointing at its accounts.
    if (minted.length) {
      await admin.query(`DELETE FROM core.device WHERE id = ANY($1::uuid[])`, [minted]);
    }
    if (accounts.length) {
      await admin.query(`DELETE FROM core.account WHERE id = ANY($1::uuid[])`, [accounts]);
    }
    await admin.end();
    await app.close();
  });

  const boot = (cookie?: string, extra?: Record<string, string>) => {
    let r = request(app.getHttpServer()).get('/v1/bootstrap').set('X-Adulis-Client', WEB);
    if (cookie) r = r.set('Cookie', `__Host-adulis_browser=${cookie}`);
    for (const [k, v] of Object.entries(extra ?? {})) r = r.set(k, v);
    return r;
  };

  it('a fresh browser is issued a device it did not choose, with the __Host- flags', async () => {
    const res = await boot().expect(200);
    const raw = rawCookie(res, '__Host-adulis_browser');
    expect(raw).toBeTruthy();
    // ADU-SEC-01 S4: the prefix is refused by the browser without these.
    expect(raw).toContain('HttpOnly');
    expect(raw).toContain('Secure');
    expect(raw).toContain('SameSite=Strict');
    expect(raw).toContain('Path=/');
    expect(raw).not.toContain('Domain=');

    const id = cookieFrom(res, '__Host-adulis_browser') as string;
    minted.push(id);
    issued.push(id);
    const row = await admin.query(
      `SELECT platform::text AS platform, market_id, account_id FROM core.device WHERE id = $1`,
      [id],
    );
    expect(row.rows[0].platform).toBe('WEB');
    // G1.11 -- the device is placed in a market at its first bootstrap.
    expect(row.rows[0].market_id).not.toBeNull();
    // It is minted BEFORE any session exists, so it starts unbound (D-64
    // already depends on account_id being nullable).
    expect(row.rows[0].account_id).toBeNull();
  });

  it('two loads in one browser are one device; two browsers are two', async () => {
    const first = await boot().expect(200);
    const id = cookieFrom(first, '__Host-adulis_browser') as string;
    minted.push(id);
    issued.push(id);

    const again = await boot(id).expect(200);
    const back = cookieFrom(again, '__Host-adulis_browser');
    expect(back).toBe(id);

    const other = await boot().expect(200);
    const otherId = cookieFrom(other, '__Host-adulis_browser') as string;
    minted.push(otherId);
    issued.push(otherId);
    expect(otherId).not.toBe(id);

    const n = await admin.query(`SELECT count(*)::int AS n FROM core.device WHERE id = ANY($1::uuid[])`, [
      [id, otherId],
    ]);
    expect(n.rows[0].n).toBe(2);
  });

  it('THE CLOSED ARM: a web client supplying its own device id is ignored, not honoured', async () => {
    const chosen = randomUUID();
    const res = await boot(undefined, { 'X-Adulis-Device': chosen }).expect(200);
    const issuedId = cookieFrom(res, '__Host-adulis_browser') as string;
    minted.push(issuedId);
    issued.push(issuedId);

    // The server issued its own identity...
    expect(issuedId).not.toBe(chosen);
    // ...and the client's choice was never written anywhere.
    const row = await admin.query(`SELECT id FROM core.device WHERE id = $1`, [chosen]);
    expect(row.rowCount).toBe(0);
  });

  it('a cookie naming a row that no longer exists mints a new one rather than trusting it', async () => {
    const stale = randomUUID();
    const res = await boot(stale).expect(200);
    const issuedId = cookieFrom(res, '__Host-adulis_browser') as string;
    minted.push(issuedId);
    issued.push(issuedId);
    expect(issuedId).not.toBe(stale);
    const gone = await admin.query(`SELECT id FROM core.device WHERE id = $1`, [stale]);
    expect(gone.rowCount).toBe(0);
  });

  it('an app client keeps the client-generated mechanism and is issued no cookie', async () => {
    const deviceId = randomUUID();
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [deviceId]);
    minted.push(deviceId);

    const res = await request(app.getHttpServer())
      .get('/v1/bootstrap')
      .set('X-Adulis-Client', 'android/1.6.2')
      .set('X-Adulis-Device', deviceId)
      .expect(200);

    expect(rawCookie(res, '__Host-adulis_browser')).toBeNull();
    const row = await admin.query(`SELECT market_id FROM core.device WHERE id = $1`, [deviceId]);
    expect(row.rows[0].market_id).not.toBeNull();
  });

  it('racing first loads leave two unbound rows, and an unbound row is what the purge collects', async () => {
    // Both were in flight before either response set a cookie. The browser
    // keeps the last one; the other is orphaned -- and orphaned means
    // account_id IS NULL, which is exactly what device.purge_unbound looks
    // for, so nothing leaks permanently (T8 Phase 2 S3.2).
    const [a, b] = await Promise.all([boot().expect(200), boot().expect(200)]);
    const idA = cookieFrom(a, '__Host-adulis_browser') as string;
    const idB = cookieFrom(b, '__Host-adulis_browser') as string;
    minted.push(idA, idB);
    issued.push(idA, idB);
    expect(idA).not.toBe(idB);

    const rows = await admin.query(
      `SELECT count(*)::int AS n FROM core.device
        WHERE id = ANY($1::uuid[]) AND account_id IS NULL`,
      [[idA, idB]],
    );
    expect(rows.rows[0].n).toBe(2);
  });

  it('no browser-minted device carries a native platform', async () => {
    // Only the ids a cookie actually issued, so the assertion can be ZERO.
    // It was written over `minted`, which also holds the ANDROID row this
    // suite inserts by hand, and was therefore loosened to `<= 1` -- an
    // assertion that would have passed if a browser-minted row came back
    // ANDROID, which is the one thing it exists to forbid.
    expect(issued.length).toBeGreaterThan(0);
    const bad = await admin.query(
      `SELECT count(*)::int AS n FROM core.device
        WHERE id = ANY($1::uuid[]) AND platform <> 'WEB'`,
      [issued],
    );
    expect(bad.rows[0].n).toBe(0);
  });

  /**
   * The #26 review found each of the following live. They are tests now
   * because the ruling closes an arm, and an arm closed only in prose reopens
   * the first time someone adds a fallback.
   */

  it('an anonymous console POST is accepted on the cookie alone -- no app header', async () => {
    // THE BLOCKER: the idempotency actor demanded X-Adulis-Device, which the
    // console must not send, so sign-in 400d at step one while every test
    // passed -- because every test still sent the header a browser cannot.
    const res = await boot().expect(200);
    const id = cookieFrom(res, '__Host-adulis_browser') as string;
    minted.push(id);
    issued.push(id);

    await makeAccount('+251911999002');
    const res2 = await request(app.getHttpServer())
      .post('/v1/auth/otp/request')
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Client', WEB)
      .set('Idempotency-Key', randomUUID())
      .set('Cookie', `__Host-adulis_browser=${id}`)
      .send({ phone: '+251911999002', purpose: 'SIGN_IN' });
    expect(res2.status).toBe(202);
  });

  it('a malformed cookie is a refusal, not a 500', async () => {
    for (const junk of ['not-a-uuid', "' OR 1=1 --"]) {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/otp/verify')
        .set('Origin', CONSOLE_ORIGIN)
        .set('X-Adulis-Client', WEB)
        .set('Idempotency-Key', randomUUID())
        .set('Cookie', `__Host-adulis_browser=${junk}`)
        .send({ phone: '+251911999003', code: '000000', audience: 'CONSOLE' });
      expect(res.status).toBe(400);
    }
  });

  it('a cookie naming a NATIVE device row cannot carry a console sign-in', async () => {
    // bootstrap refuses to reuse one; verify used only to check existence, so
    // a console session could be anchored to a row whose platform says
    // ANDROID -- the false statement 0040 exists to prevent.
    const native = randomUUID();
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'IOS')`, [native]);
    minted.push(native);
    await makeAccount('+251911999004');
    const cookie = `__Host-adulis_browser=${native}`;
    const code = await realCode('+251911999004', cookie);

    const res = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Client', WEB)
      .set('Idempotency-Key', randomUUID())
      .set('Cookie', cookie)
      .send({ phone: '+251911999004', code, audience: 'CONSOLE' })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('bootstrap');

    const still = await admin.query(`SELECT account_id FROM core.device WHERE id = $1`, [native]);
    expect(still.rows[0].account_id).toBeNull();
  });

  it('a cookie naming a device bound to ANOTHER account is refused outright', async () => {
    // The bind was guarded by `account_id IS NULL` and nobody read the row
    // count, so the bind was refused and the SESSION created anyway --
    // pinning a stranger's device row against the retention purge.
    const foreign = randomUUID();
    const stranger = await makeAccount('+251911999005');
    await admin.query(`INSERT INTO core.device (id, platform, account_id) VALUES ($1,'WEB',$2)`, [
      foreign,
      stranger,
    ]);
    minted.push(foreign);
    await makeAccount('+251911999006');
    const cookie = `__Host-adulis_browser=${foreign}`;
    const code = await realCode('+251911999006', cookie);

    const res = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Client', WEB)
      .set('Idempotency-Key', randomUUID())
      .set('Cookie', cookie)
      .send({ phone: '+251911999006', code, audience: 'CONSOLE' })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('bootstrap');

    const sessions = await admin.query(
      `SELECT count(*)::int AS n FROM core.session WHERE device_id = $1`,
      [foreign],
    );
    expect(sessions.rows[0].n).toBe(0);
  });

  it('a CONSOLE verify without the bootstrap cookie is refused, naming what is missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .set('Origin', CONSOLE_ORIGIN)
      .set('X-Adulis-Client', WEB)
      .set('Idempotency-Key', randomUUID())
      .send({ phone: '+251911999001', code: '000000', audience: 'CONSOLE' })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('bootstrap');
  });
});
