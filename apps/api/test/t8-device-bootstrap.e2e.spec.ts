import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

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
  const minted: string[] = [];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [T8AppModule] }).compile();
    app = mod.createNestApplication();
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
    admin = new Pool({ connectionString: ADMIN });
  });

  afterAll(async () => {
    if (minted.length) {
      await admin.query(`DELETE FROM core.device WHERE id = ANY($1::uuid[])`, [minted]);
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

    const again = await boot(id).expect(200);
    const back = cookieFrom(again, '__Host-adulis_browser');
    expect(back).toBe(id);

    const other = await boot().expect(200);
    const otherId = cookieFrom(other, '__Host-adulis_browser') as string;
    minted.push(otherId);
    expect(otherId).not.toBe(id);

    const n = await admin.query(`SELECT count(*)::int AS n FROM core.device WHERE id = ANY($1::uuid[])`, [
      [id, otherId],
    ]);
    expect(n.rows[0].n).toBe(2);
  });

  it('THE CLOSED ARM: a web client supplying its own device id is ignored, not honoured', async () => {
    const chosen = randomUUID();
    const res = await boot(undefined, { 'X-Adulis-Device': chosen }).expect(200);
    const issued = cookieFrom(res, '__Host-adulis_browser') as string;
    minted.push(issued);

    // The server issued its own identity...
    expect(issued).not.toBe(chosen);
    // ...and the client's choice was never written anywhere.
    const row = await admin.query(`SELECT id FROM core.device WHERE id = $1`, [chosen]);
    expect(row.rowCount).toBe(0);
  });

  it('a cookie naming a row that no longer exists mints a new one rather than trusting it', async () => {
    const stale = randomUUID();
    const res = await boot(stale).expect(200);
    const issued = cookieFrom(res, '__Host-adulis_browser') as string;
    minted.push(issued);
    expect(issued).not.toBe(stale);
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
    expect(idA).not.toBe(idB);

    const rows = await admin.query(
      `SELECT count(*)::int AS n FROM core.device
        WHERE id = ANY($1::uuid[]) AND account_id IS NULL`,
      [[idA, idB]],
    );
    expect(rows.rows[0].n).toBe(2);
  });

  it('no browser-minted device carries a native platform', async () => {
    const bad = await admin.query(
      `SELECT count(*)::int AS n FROM core.device
        WHERE id = ANY($1::uuid[]) AND platform <> 'WEB'`,
      [minted.filter((_, i) => i >= 0)],
    );
    // Every id this suite collected from a cookie is a WEB row; the one
    // ANDROID row it created by hand was never issued in a cookie.
    expect(bad.rows[0].n).toBeLessThanOrEqual(1);
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
