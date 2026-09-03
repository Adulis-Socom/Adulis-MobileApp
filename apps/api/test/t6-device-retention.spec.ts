import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { devicePurgeUnbound } from '../src/jobs/e4-retention';
import { createJobHarness, type Harness } from './jobs-harness';

/**
 * T6 / G1.11 -- a device's retention comes from ITS market, and a device
 * with no market gets the SHORTEST interval in force rather than the
 * longest.
 *
 * THE EXISTING PURGE TEST CANNOT SEE THIS CHANGE. It seeds two markets
 * through the same literal, so `media_retention` is '90 days' for both and
 * max() and min() over {90, 90} are the same number. An implementation that
 * changed nothing, or that swapped max for min and got the per-device join
 * backwards, would ship green. Every market below therefore has a
 * DIFFERENT retention, which is the only way to tell the two rules apart.
 *
 * Direction matters here more than most rules: under the old longest-wins
 * reading, an anonymous device the system knows nothing about was kept the
 * LONGEST. That is the wrong answer to the question a DPIA asks.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

// Deliberately the smallest media_retention any suite configures, so the
// global minimum is this one whatever else is in the database at the time.
const SHORT = '10 days';
const LONG = '400 days';

const T0 = new Date('2026-06-01T09:00:00.000Z');
const daysAgo = (n: number) => new Date(T0.getTime() - n * 86_400_000);

describe('T6 / G1.11 -- device retention follows the device market', () => {
  let admin: Pool;
  let h: Harness;

  const shortMarket = randomUUID();
  const longMarket = randomUUID();
  const inShort = randomUUID();
  const inLong = randomUUID();
  const noMarket = randomUUID();
  const noMarketFresh = randomUUID();
  const wedged = randomUUID();
  const wedgedAccount = randomUUID();
  const wedgedSession = randomUUID();

  const timingFor = async (market: string, retention: string) =>
    admin.query(
      `INSERT INTO core.timing_config (id, market_id, reservation_window,
         payment_confirmation_window, fulfilment_window, offline_sync_horizon,
         payout_activation_delay, recovery_cooling_period,
         deleted_number_cooling_period, refund_ack_window, media_retention,
         level_credit_grace, mobile_session_lifetime, console_session_lifetime,
         console_idle_timeout, console_remembered_lifetime,
         console_remembered_idle, otp_ttl, otp_max_attempts, step_up_freshness,
         new_device_payout_lock, same_seller_cancellation_threshold,
         same_seller_cooldown, cross_seller_cooldown_ladder,
         cancellation_counter_decay, effective)
       VALUES (gen_random_uuid(), $1, '48 hours','24 hours','72 hours','7 days',
         '24 hours','7 days','30 days','48 hours', $2::interval, '24 hours',
         '30 days','12 hours','30 minutes','7 days','8 hours','5 minutes',5,
         '5 minutes','24 hours',3,'1 hour',
         ARRAY['1 day','2 days','4 days']::interval[],'30 days',
         tstzrange('2020-01-01','2030-01-01','[)'))`,
      [market, retention],
    );

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 1 });
    h = createJobHarness(T0);

    for (const [id, code] of [
      [shortMarket, 'T6S'],
      [longMarket, 'T6L'],
    ] as const) {
      await admin.query(
        `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                  display_timezone, default_locale, is_live, activation_state, otp_enabled, sms_primary_provider)
         VALUES ($1,$2,'Retention','PHASE_1','ETB','Africa/Addis_Ababa','en',false, 'ACTIVE', true, 'AFROMESSAGE')`,
        [id, code],
      );
    }
    await timingFor(shortMarket, SHORT);
    await timingFor(longMarket, LONG);

    // Four devices, all unbound, all last seen 15 days ago except one.
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id, last_seen_at) VALUES
        ($1,'ANDROID',$5,$7), ($2,'ANDROID',$6,$7),
        ($3,'ANDROID',NULL,$7), ($4,'ANDROID',NULL,$8)`,
      [inShort, inLong, noMarket, noMarketFresh, shortMarket, longMarket, daysAgo(15), daysAgo(5)],
    );

    // And one that a deleted account left behind: unbound, ancient, and
    // still referenced by a session row. This is the wedge -- before T6 it
    // was selected and the DELETE raised 23503, on the same rows, nightly.
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status)
       VALUES ($1,'+251918880001',$2,'ACTIVE')`,
      [wedgedAccount, shortMarket],
    );
    await admin.query(
      `INSERT INTO core.device (id, platform, market_id, last_seen_at)
       VALUES ($1,'ANDROID',$2,$3)`,
      [wedged, shortMarket, daysAgo(300)],
    );
    await admin.query(
      `INSERT INTO core.session (id, account_id, audience, device_id, expires_at)
       VALUES ($1,$2,'MOBILE',$3, now() + interval '30 days')`,
      [wedgedSession, wedgedAccount, wedged],
    );
    // The account is then deleted the way fn_delete_account does it: the
    // device is un-bound and the session row is left in place.
    await admin.query(`UPDATE core.device SET account_id = NULL WHERE id = $1`, [wedged]);
  });

  afterAll(async () => {
    await h.close();
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(`DELETE FROM core.session WHERE id = $1`, [wedgedSession]);
    await admin.query(`DELETE FROM core.device WHERE id = ANY($1::uuid[])`, [
      [inShort, inLong, noMarket, noMarketFresh, wedged],
    ]);
    await admin.query(`DELETE FROM core.account WHERE id = $1`, [wedgedAccount]);
    await admin.query(`DELETE FROM core.timing_config WHERE market_id = ANY($1::uuid[])`, [
      [shortMarket, longMarket],
    ]);
    await admin.query(`DELETE FROM core.market WHERE id = ANY($1::uuid[])`, [
      [shortMarket, longMarket],
    ]);
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  const survives = async (id: string) =>
    (await admin.query(`SELECT count(*)::int AS n FROM core.device WHERE id = $1`, [id])).rows[0]
      .n === 1;

  it('purges by the DEVICE market, and a marketless device by the SHORTEST interval', async () => {
    h.clock.set(T0);
    await devicePurgeUnbound.run(h.ctx);

    // 15 days old in a market that keeps devices 10 days: gone.
    expect(await survives(inShort)).toBe(false);
    // 15 days old in a market that keeps them 400: kept. Under a single
    // global interval one of these two must be wrong.
    expect(await survives(inLong)).toBe(true);
    // NO MARKET, 15 days old. SHORTEST in force is 10 days, so it goes.
    // This is the assertion the old test could not make: under T4's
    // longest-wins rule this device survived 400 days precisely because
    // nothing was known about it.
    expect(await survives(noMarket)).toBe(false);
    // No market and only 5 days old: inside even the shortest window.
    expect(await survives(noMarketFresh)).toBe(true);
  });

  it('does not wedge on a device a deleted account left a session pointing at', async () => {
    h.clock.set(T0);
    // The job must complete rather than raise. core.session.device_id has no
    // ON DELETE, so before the two NOT EXISTS guards this device was
    // selected every night and the DELETE raised 23503 -- and because the
    // batch is ordered the same way each time, the job failed on the same
    // rows forever rather than skipping them.
    await expect(devicePurgeUnbound.run(h.ctx)).resolves.toBeDefined();
    expect(await survives(wedged)).toBe(true);
  });
});
