import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { APP_DATABASE } from '../src/common/db/database.module';
import { OtpService } from '../src/modules/auth/otp.service';
import { OtpDeliveryService } from '../src/modules/auth/otp-delivery.service';
import {
  FakeSmsProviderSet,
  SMS_PROVIDERS,
  definitiveNotSent,
} from '../src/modules/auth/sms-provider';

/**
 * T14 A4 -- transport before supersession (ADU-RUL-06 S5, D-204.1).
 *
 * RULING: a challenge that has not been transported is not live and cannot be
 * verified against; supersession happens at transport ACCEPTANCE; there is
 * exactly one verifiable challenge at every instant. So a resend whose
 * delivery fails must leave the PREVIOUS code live -- the defect was that
 * superseding at mint left two dead codes.
 */
const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
const MK = '77e14a40-0000-4000-8000-0000000000a4';
const PP = '+2519114440';

@Module({ imports: [AppModule] })
class T14A4Module {}

describe('T14 A4 - transport before supersession', () => {
  let app: INestApplication;
  let admin: Pool;
  let otp: OtpService;
  let delivery: OtpDeliveryService;
  let db: { transaction: () => { execute: <T>(f: (trx: never) => Promise<T>) => Promise<T> } };
  const providers = new FakeSmsProviderSet();

  const timing = (m: string): [string, string[]] => [
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
    [m],
  ];
  const DEVICE = '77e14a40-0000-4000-8000-0000000000d4';

  const inTrx = <T>(f: (trx: never) => Promise<T>): Promise<T> => db.transaction().execute(f);

  /** Issue a SIGN_IN challenge and return its id and plaintext code. */
  const issue = async (): Promise<{ id: string; code: string }> => {
    const issued = await inTrx((trx) =>
      otp.issueChallenge(trx, {
        phone: PP + '1',
        purpose: 'SIGN_IN',
        audience: 'MOBILE',
        templateKey: 'sms.otp.sign_in',
        deviceId: DEVICE,
      }),
    );
    return { id: issued.challengeId, code: issued.sms.slots['code'] as string };
  };

  const verify = (code: string): Promise<{ id: string } | Error> =>
    inTrx((trx) => otp.verifyCode(trx, { phone: PP + '1', purpose: 'SIGN_IN', code }))
      .then((r) => ({ id: r.id }))
      .catch((e) => e as Error);

  const transportedAt = async (id: string): Promise<Date | null> =>
    (await admin.query<{ t: Date | null }>(
      `SELECT transported_at t FROM core.otp_challenge WHERE id = $1`, [id],
    )).rows[0]?.t ?? null;

  async function cleanup(): Promise<void> {
    await admin.query(`DELETE FROM core.otp_challenge WHERE phone_e164 LIKE $1`, [PP + '%']);
    await admin.query(`DELETE FROM core.timing_config WHERE market_id = $1`, [MK]);
    await admin.query(`DELETE FROM core.device WHERE id = $1`, [DEVICE]);
    await admin.query(`DELETE FROM core.market WHERE id = $1`, [MK]);
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [T14A4Module] })
      .overrideProvider(SMS_PROVIDERS)
      .useValue(providers)
      .compile();
    app = mod.createNestApplication();
    await configureApp(app, 'http://localhost:5173');
    await app.init();
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    otp = app.get(OtpService);
    delivery = app.get(OtpDeliveryService);
    db = app.get(APP_DATABASE);
    await cleanup();
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live,
                                activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'T14A4','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en',false,
               'ACTIVE', true, 'AFROMESSAGE')`,
      [MK],
    );
    const [q, p] = timing(MK);
    await admin.query(q, p);
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id) VALUES ($1,'ANDROID',$2)`,
      [DEVICE, MK],
    );
  });

  afterAll(async () => {
    await cleanup();
    await admin.end();
    await app.close();
  });

  beforeEach(() => {
    providers.resetAll();
  });

  it('a minted-but-untransported code is NOT verifiable', async () => {
    const c = await issue();
    expect(await transportedAt(c.id)).toBeNull();
    // Not transported -> not the live challenge -> the code does not verify.
    const r = await verify(c.code);
    expect(r).toBeInstanceOf(Error);
    expect((r as Error).message).toMatch(/OTP_EXPIRED|OTP_INVALID/);
  });

  it('acceptance transports it and makes it verifiable', async () => {
    const c = await issue();
    const report = await delivery.deliver(c.id, MK, {
      phone: PP + '1', templateKey: 'sms.otp.sign_in', slots: { code: c.code },
    });
    expect(report.outcome).toBe('ACCEPTED');
    expect(await transportedAt(c.id)).not.toBeNull();
    const r = await verify(c.code);
    expect(r).not.toBeInstanceOf(Error);
  });

  it('a FAILED resend leaves the PREVIOUS code live', async () => {
    // Code 1: issued and accepted -> live.
    const c1 = await issue();
    await delivery.deliver(c1.id, MK, {
      phone: PP + '1', templateKey: 'sms.otp.sign_in', slots: { code: c1.code },
    });
    expect(await transportedAt(c1.id)).not.toBeNull();

    // Code 2: issued, but the only provider REFUSES (Ethiopia has no fallback).
    const c2 = await issue();
    providers.AFROMESSAGE.willReturn(definitiveNotSent('provider_down'));
    const report = await delivery.deliver(c2.id, MK, {
      phone: PP + '1', templateKey: 'sms.otp.sign_in', slots: { code: c2.code },
    });
    expect(report.outcome).toBe('DEFINITIVE_NOT_SENT');

    // C2 never transported -> C1 never superseded.
    expect(await transportedAt(c2.id)).toBeNull();
    const c1row = await admin.query<{ e: Date }>(
      `SELECT expires_at e FROM core.otp_challenge WHERE id = $1`, [c1.id],
    );
    expect(new Date(c1row.rows[0]!.e).getTime()).toBeGreaterThan(Date.now());

    // THE RULING, OBSERVED: code 1 still verifies. (A failed resend did not
    // strand the user with two dead codes.)
    const r = await verify(c1.code);
    expect(r).not.toBeInstanceOf(Error);
    expect((r as { id: string }).id).toBe(c1.id);
  });

  it('a SUCCESSFUL resend supersedes the previous code at acceptance', async () => {
    const c1 = await issue();
    await delivery.deliver(c1.id, MK, {
      phone: PP + '1', templateKey: 'sms.otp.sign_in', slots: { code: c1.code },
    });
    const c2 = await issue();
    // C1 is still live and unconsumed; C2 is minted, not yet transported. Do
    // NOT verify C1 here -- verifying consumes it, and a consumed code is dead
    // regardless of supersession, which would make this assertion vacuous.
    const before = await admin.query<{ e: Date }>(
      `SELECT expires_at e FROM core.otp_challenge WHERE id = $1`, [c1.id],
    );
    expect(new Date(before.rows[0]!.e).getTime()).toBeGreaterThan(Date.now());

    await delivery.deliver(c2.id, MK, {
      phone: PP + '1', templateKey: 'sms.otp.sign_in', slots: { code: c2.code },
    });
    // C2 accepted -> C2 live, C1 superseded (expired) in the same act.
    expect(await transportedAt(c2.id)).not.toBeNull();
    const c1row = await admin.query<{ e: Date }>(
      `SELECT expires_at e FROM core.otp_challenge WHERE id = $1`, [c1.id],
    );
    expect(new Date(c1row.rows[0]!.e).getTime()).toBeLessThanOrEqual(Date.now());

    // Exactly one verifiable challenge: C2 works, C1 is now expired.
    expect(((await verify(c2.code)) as { id: string }).id).toBe(c2.id);
    const old = await verify(c1.code);
    expect(old).toBeInstanceOf(Error);
    expect((old as Error).message).toBe('OTP_EXPIRED');
  });
});