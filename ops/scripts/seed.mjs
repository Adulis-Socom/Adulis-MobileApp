#!/usr/bin/env node
/**
 * `pnpm db:seed` -- the seeded seller ADU-CON-02 S13 promises and stage
 * C-2's done-clause needs: "A seeded seller signs in against the real API
 * and is warned before idle expiry."
 *
 * Idempotent: fixed uuids, ON CONFLICT DO NOTHING -- run it twice, get one
 * seller. Prints everything the console dev loop needs, including the
 * device id (VITE_DEVICE_ID): a web console has no honest value for
 * core.device_platform (ANDROID|IOS -- register D-95) and nowhere
 * permitted to persist a minted id, so the seed provisions the device row
 * the sign-in flow requires until that enum is ruled.
 *
 * The INDIVIDUAL seller is seeded WITH its person row -- D-57 is honored
 * even here, where a fixture could technically skip it.
 */

import pg from 'pg';

const CONNECTION = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL;
if (!CONNECTION) {
  console.error('FAIL  DATABASE_URL_MIGRATE is not set. Run: docker compose up -d && cp .env.example .env');
  process.exit(2);
}
// This script writes a market and an account that can receive a code. The
// fake adapters refuse to construct in production; this had no equivalent
// refusal, so it inherits the same one.
if (process.env.NODE_ENV === 'production') {
  console.error('FAIL  refusing to seed with NODE_ENV=production. This script writes a live market and a test account.');
  process.exit(2);
}

const M = '5eed0000-0000-4000-8000-000000000001';
const ACCOUNT = '5eed0000-0000-4000-8000-000000000002';
const PERSON = '5eed0000-0000-4000-8000-000000000003';
const SELLER = '5eed0000-0000-4000-8000-000000000004';
const DEVICE = '5eed0000-0000-4000-8000-000000000005';
const PHONE = '+251900000001';

const client = new pg.Client({ connectionString: CONNECTION });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                              display_timezone, default_locale, is_live)
     VALUES ($1,'SEED','Ethiopia (seed)','PHASE_1','ETB','Africa/Addis_Ababa','en',false)
     ON CONFLICT (id) DO NOTHING`,
    [M],
  );
  // is_live = FALSE, deliberately, and re-asserted here so a database seeded
  // by an earlier version of this script is corrected by re-running it.
  //
  // Identity creation resolves "the market" with `SELECT id FROM core.market
  // WHERE is_live LIMIT 1` -- no ORDER BY, and no uniqueness behind it
  // (register D-104). A second live market makes that lookup arbitrary, and
  // the c6 suite's new-account tests then land their accounts in THIS market,
  // where c6's market-scoped teardown cannot see them -- so the next run of
  // c6 gets a 200 where a 400 belongs. The seeded account already exists, and
  // both live-market lookups are fallbacks used only when a phone has no
  // account, so the console dev loop never needed this market to be live.
  await client.query(`UPDATE core.market SET is_live = false WHERE id = $1`, [M]);
  await client.query(
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
     SELECT '5eed0000-0000-4000-8000-000000000006', $1, interval '48 hours',
       interval '24 hours', interval '7 days', interval '7 days',
       interval '24 hours', interval '7 days', interval '30 days',
       interval '72 hours', interval '90 days', interval '24 hours',
       interval '30 days', interval '12 hours', interval '30 minutes',
       interval '7 days', interval '8 hours', interval '5 minutes', 5,
       interval '1 hour', interval '24 hours', 3, interval '1 hour',
       ARRAY[interval '1 day', interval '2 days', interval '4 days'],
       interval '30 days'
     WHERE NOT EXISTS (SELECT 1 FROM core.timing_config WHERE market_id = $1)`,
    [M],
  );
  // ADU-VAL-01 S2's SET values only; every OPEN column stays NULL -- which
  // is the whole point of ADU-RUL-02, and this seed is the first real
  // consumer of it: before 0039 this INSERT was impossible to write
  // without inventing the ten deferred numbers (D-90 corrects D-61's count of
// eight; 0039 drops NOT NULL on exactly ten).
  await client.query(
    `INSERT INTO core.ladder_config (id, market_id,
       new_to_established_min_tenure, new_to_established_min_orders,
       new_level_product_cap, new_level_transaction_cap_minor)
     SELECT '5eed0000-0000-4000-8000-000000000007', $1,
            interval '60 days', 50, 10, NULL
     WHERE NOT EXISTS (SELECT 1 FROM core.ladder_config WHERE market_id = $1)`,
    [M],
  );
  // follower_threshold NULL: PRD S4.1 -- no threshold during the beta.
  await client.query(
    `INSERT INTO core.eligibility_config (id, market_id, audience_required,
       follower_threshold, counting_platforms, threshold_basis,
       permitted_seller_types, id_verification_requirement)
     SELECT '5eed0000-0000-4000-8000-000000000008', $1, false, NULL,
            ARRAY['TIKTOK','INSTAGRAM']::core.platform[],
            'HIGHEST_SINGLE'::core.threshold_basis,
            ARRAY['INDIVIDUAL','COMPANY']::core.seller_entity_type[],
            'OPTIONAL'::core.id_verification_requirement
     WHERE NOT EXISTS (SELECT 1 FROM core.eligibility_config WHERE market_id = $1)`,
    [M],
  );
  await client.query(
    `INSERT INTO core.account (id, phone_e164, market_id, status, age_declared_over_18)
     VALUES ($1,$2,$3,'ACTIVE', true) ON CONFLICT (id) DO NOTHING`,
    [ACCOUNT, PHONE, M],
  );
  await client.query(
    `INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')
     ON CONFLICT (id) DO NOTHING`,
    [DEVICE],
  );
  await client.query(
    `INSERT INTO core.person (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    [PERSON],
  );
  await client.query(
    `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                              store_name, handle, status, person_id)
     VALUES ($1,$2,$3,'INDIVIDUAL','Seed Store','seed-store','ACTIVE',$4)
     ON CONFLICT (id) DO NOTHING`,
    [SELLER, M, ACCOUNT, PERSON],
  );
  await client.query(
    `INSERT INTO core.seller_level_state (seller_id, level, since, computed_at)
     VALUES ($1,'NEW', now(), now()) ON CONFLICT (seller_id) DO NOTHING`,
    [SELLER],
  );
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}

console.log(`
Seeded (idempotent -- reruns change nothing):

  phone      ${PHONE}
  seller     ${SELLER}
  device     ${DEVICE}

Console dev loop (three terminals):
  1. pnpm dev:api            # OTP codes print here (dev SMS adapter)
  2. pnpm dev:console        # with VITE_API_BASE_URL=http://localhost:3000
                             # and  VITE_DEVICE_ID=${DEVICE}
  3. sign in at http://localhost:5173/sign-in with ${PHONE},
     read the 6-digit code off the API terminal, and open
     /s/${SELLER}
`);
