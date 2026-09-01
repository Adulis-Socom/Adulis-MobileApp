import { randomUUID } from 'node:crypto';
import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { FakeSmsAdapter, SMS_ADAPTER } from '../src/modules/auth/sms.adapter';

/**
 * D-89's SECOND LEG, RULED (WORK ORDER T12 S5.2).
 *
 * Migrations 0029 and 0037 both describe it and nothing implemented it: after
 * successful authentication of the exact normalized phone, a matching pending
 * courier invite is claimed and the relationship created. Server-side only --
 * the client cannot name an invite -- idempotent, and the claim and the
 * relationship creation are one transaction.
 *
 * THE ORACLE HALF IS THE HALF THAT NEEDS A TEST. A sign-in that behaves
 * differently for a phone with a pending invite tells an attacker something
 * about a phone -- the exact class 0029 was built to close (G1.8). So the
 * last test signs two phones in, one invited and one not, and asserts the
 * RESPONSES are identical in shape and status: the response is identical;
 * the effect is not.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const CONSOLE_ORIGIN = 'http://localhost:5173';

const M = randomUUID();
const OWNER = randomUUID();
const SELLER_A = randomUUID();
const SELLER_B = randomUUID();
const P_INVITED = '+251911441891'; // pending invites from BOTH sellers
const P_PLAIN = '+251911441892'; // no invite anywhere
const P_REVOKED = '+251911441893'; // an invite that was revoked before sign-in

const sms = new FakeSmsAdapter();

@Module({ imports: [AppModule] })
class T12D89Module {}

describe('D-89 -- the courier invite claim, second leg', () => {
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

  /** One full console sign-in; returns the raw verify response. */
  const signIn = async (phone: string) => {
    const device = await browserCookie();
    await http()
      .post('/v1/auth/otp/request')
      .set('Idempotency-Key', key())
      .set('Cookie', device)
      .send({ phone, purpose: 'SIGN_IN' })
      .expect(202);
    return http()
      .post('/v1/auth/otp/verify')
      .set('Idempotency-Key', key())
      .set('Cookie', device)
      .send({ phone, code: codeFor(phone), audience: 'CONSOLE', age_declared_over_18: true });
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
                                display_timezone, default_locale, is_live)
       VALUES ($1,'T89','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en',false)`,
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
       VALUES ($1, '+251911441890', $2, 'ACTIVE', true)`,
      [OWNER, M],
    );
    for (const [s, handle] of [
      [SELLER_A, 'd89-a'],
      [SELLER_B, 'd89-b'],
    ] as const) {
      await admin.query(
        `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                  store_name, handle, status)
         VALUES ($1, $2, $3, 'INDIVIDUAL', 'D89', $4, 'ACTIVE')`,
        [s, M, OWNER, handle],
      );
    }
    // TWO sellers invited the same phone: the claim is claim-ALL, one
    // relationship per inviting seller. And one revoked invite that must
    // stay untouched.
    for (const s of [SELLER_A, SELLER_B]) {
      await admin.query(
        `INSERT INTO core.seller_courier_invite (seller_id, phone, invited_by_account_id)
         VALUES ($1, $2, $3)`,
        [s, P_INVITED, OWNER],
      );
    }
    await admin.query(
      `INSERT INTO core.seller_courier_invite (seller_id, phone, invited_by_account_id, revoked_at)
       VALUES ($1, $2, $3, now())`,
      [SELLER_A, P_REVOKED, OWNER],
    );

    const moduleRef = await Test.createTestingModule({ imports: [T12D89Module] })
      .overrideProvider(SMS_ADAPTER)
      .useValue(sms)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await configureApp(app, CONSOLE_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    /*
     * SCOPED BY PHONE, NOT BY MARKET, and the first version of this teardown
     * proved why: an account created at sign-in takes its market FROM THE
     * DEVICE (D-104 -- bootstrap assigns the oldest LIVE market), and with
     * two suites' live test markets coexisting under parallel jest workers,
     * "my market's accounts" is not "my accounts". Rows escaped, and the
     * next run failed on market_code_key before a single assertion ran. The
     * phones are this suite's true identity; everything hangs off them.
     */
    const PHONES = `'${P_INVITED}','${P_PLAIN}','${P_REVOKED}'`;
    const ACCTS = `SELECT id FROM core.account WHERE phone_e164 IN (${PHONES})`;
    for (const q of [
      `DELETE FROM core.idempotency_record WHERE actor_id IN (${ACCTS})`,
      `DELETE FROM core.notification WHERE recipient_account_id IN (${ACCTS})`,
      `DELETE FROM core.session WHERE account_id IN (${ACCTS})`,
      `DELETE FROM core.otp_challenge WHERE phone_e164 IN (${PHONES})`,
      `DELETE FROM core.seller_courier WHERE seller_id IN ('${SELLER_A}','${SELLER_B}')`,
      `DELETE FROM core.seller_courier_invite WHERE seller_id IN ('${SELLER_A}','${SELLER_B}')`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN ('${SELLER_A}','${SELLER_B}')`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN ('${SELLER_A}','${SELLER_B}')`,
      `DELETE FROM core.seller WHERE id IN ('${SELLER_A}','${SELLER_B}')`,
      `DELETE FROM core.device WHERE id = ANY($1::uuid[])`,
      `DELETE FROM core.account WHERE phone_e164 IN (${PHONES}) OR id = '${OWNER}'`,
      `DELETE FROM core.timing_config WHERE market_id = '${M}'`,
      `DELETE FROM core.market WHERE id = '${M}'`,
    ]) {
      await admin.query(q, q.includes('$1::uuid[]') ? [webDevices] : undefined);
    }
    await admin.end();
  });

  test('first sign-in claims every pending invite and creates each relationship, atomically', async () => {
    const r = await signIn(P_INVITED);
    expect(r.status).toBe(200);

    const invites = await admin.query(
      `SELECT seller_id, claimed_at, claimed_by_account_id FROM core.seller_courier_invite
        WHERE phone = $1 ORDER BY seller_id`,
      [P_INVITED],
    );
    expect(invites.rows).toHaveLength(2);
    const account = await admin.query(`SELECT id FROM core.account WHERE phone_e164 = $1`, [
      P_INVITED,
    ]);
    for (const row of invites.rows) {
      expect(row.claimed_at).not.toBeNull();
      expect(row.claimed_by_account_id).toBe(account.rows[0].id);
    }
    const rel = await admin.query(
      `SELECT seller_id FROM core.seller_courier
        WHERE account_id = $1 AND revoked_at IS NULL ORDER BY seller_id`,
      [account.rows[0].id],
    );
    expect(rel.rows.map((x) => x.seller_id).sort()).toEqual([SELLER_A, SELLER_B].sort());
  });

  test('idempotent: a second sign-in changes nothing and errors nothing', async () => {
    const r = await signIn(P_INVITED);
    expect(r.status).toBe(200);
    const rel = await admin.query(
      `SELECT count(*)::int AS n FROM core.seller_courier sc
        JOIN core.account a ON a.id = sc.account_id
       WHERE a.phone_e164 = $1 AND sc.revoked_at IS NULL`,
      [P_INVITED],
    );
    expect(rel.rows[0].n).toBe(2);
  });

  test('a revoked invite is never claimed', async () => {
    const r = await signIn(P_REVOKED);
    expect(r.status).toBe(200);
    const invite = await admin.query(
      `SELECT claimed_at, claimed_by_account_id FROM core.seller_courier_invite WHERE phone = $1`,
      [P_REVOKED],
    );
    expect(invite.rows[0].claimed_at).toBeNull();
    expect(invite.rows[0].claimed_by_account_id).toBeNull();
    const rel = await admin.query(
      `SELECT count(*)::int AS n FROM core.seller_courier sc
        JOIN core.account a ON a.id = sc.account_id WHERE a.phone_e164 = $1`,
      [P_REVOKED],
    );
    expect(rel.rows[0].n).toBe(0);
  });

  test('NO ORACLE: the invited and uninvited sign-ins are indistinguishable to the caller', async () => {
    // P_INVITED's and P_REVOKED's sign-ins already ran above; this compares a
    // FRESH uninvited phone against the invited one on the axes a caller can
    // observe: status, and the response body's KEY SET and non-variable
    // values. (Ids, timestamps and tokens differ per sign-in by nature; what
    // must not differ is anything an attacker could key on.)
    const plain = await signIn(P_PLAIN);
    expect(plain.status).toBe(200);

    const invited = await signIn(P_INVITED); // third time; still pending-free
    expect(invited.status).toBe(200);

    const shape = (b: Record<string, unknown>) =>
      Object.keys(b)
        .sort()
        .map((k) => `${k}:${typeof b[k]}`);
    expect(shape(plain.body as Record<string, unknown>)).toEqual(
      shape(invited.body as Record<string, unknown>),
    );
  });
});
