#!/usr/bin/env node
/**
 * `pnpm db:seed` -- the seeded seller ADU-CON-02 S13 promises and stage
 * C-2's done-clause needs: "A seeded seller signs in against the real API
 * and is warned before idle expiry."
 *
 * Idempotent: fixed uuids, ON CONFLICT DO NOTHING -- run it twice, get one
 * seller. Prints everything the console dev loop needs, including the
 * NO DEVICE IS SEEDED ANY MORE. It used to provision one, labelled ANDROID,
 * because a browser had no honest platform value and nowhere to persist an
 * id (D-95/D-102). ADU-RUL-03 S2 settles both: core.device_platform has WEB,
 * and /v1/bootstrap mints the row and sets an httpOnly cookie the first time
 * the console loads. The dev loop needs no device configuration at all, and
 * the seed no longer writes a false platform.
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
  console.error('FAIL  refusing to seed with NODE_ENV=production. This script writes a market, a seller and an account that can receive a code.');
  process.exit(2);
}

const M = '5eed0000-0000-4000-8000-000000000001';
const ACCOUNT = '5eed0000-0000-4000-8000-000000000002';
const PERSON = '5eed0000-0000-4000-8000-000000000003';
const SELLER = '5eed0000-0000-4000-8000-000000000004';
const PHONE = '+251900000001';

/*
 * THE TRADE FIXTURE (T10 Phase 5, C-4).
 *
 * Through C-3 the seed made a market, an account and a seller and stopped
 * there, which was right: nothing before C-4 rendered an order. SC-03 against
 * that database is EMPTY forever, and "the list renders" is not a claim any
 * harness can make against zero rows.
 *
 * FOUR ORDERS, CHOSEN FOR THEIR CLOCKS, because the clock is what C-4's
 * done-clause is about (ADU-CON-03 S7: the row must not use one countdown for
 * every state).
 *
 *   CREATED            reservation window running     expires_at ahead
 *   PAYMENT_SUBMITTED  CONFIRMATION window running    sla_deadline ahead
 *                      and expires_at DELIBERATELY IN THE PAST -- a screen
 *                      that shows the reservation clock here shows a NEGATIVE
 *                      one, so the wrong clock is not merely wrong, it is
 *                      visibly wrong and a test can say which
 *   PAYMENT_CONFIRMED  clock STOPPED, no countdown    clock_stopped_at set
 *   COMPLETED          terminal: history, no actions
 *
 * Written as rows rather than driven through the buyer API because the buyer
 * flow needs buyer sign-in, an OTP and an evidence upload, and a fixture that
 * needs three round-trips per order breaks for reasons unrelated to what it
 * is fixing. The STATE MACHINE is still honoured: every row satisfies
 * order_clock_consistency, and the orders past payment carry the transitions
 * they could only have arrived through.
 */
const BUYER = '5eed0000-0000-4000-8000-000000000005';
const PRODUCT = '5eed0000-0000-4000-8000-000000000006';
/*
 * ONE VARIANT PER ORDER, and that is the database's requirement rather than a
 * styling choice. core.reservation carries
 *
 *   EXCLUDE USING gist (seller_id =, buyer_account_id =, variant_id =,
 *                       active_window &&) WHERE (state = 'ACTIVE')
 *
 * -- "duplicate live reservations are structurally impossible" (DB S12.1). The
 * first draft of this fixture gave all four orders the same variant and the
 * seed failed on reservation_no_duplicate_active, correctly: one buyer holding
 * three live reservations of the same variant is not a state the product
 * allows, so it is not a state a fixture may seed.
 */
const VARIANT = {
  created: '5eed0000-0000-4000-8000-000000000007',
  lapsed: '5eed0000-0000-4000-8000-00000000000b',
  submitted: '5eed0000-0000-4000-8000-000000000008',
  confirmed: '5eed0000-0000-4000-8000-000000000009',
  completed: '5eed0000-0000-4000-8000-00000000000a',
};
const BUYER_PHONE = '+251900000002';
const ORDER = {
  created: '5eed0000-0000-4000-8000-000000000011',
  /*
   * T11 Phase 4 (D-167). A PAYMENT_SUBMITTED order whose confirmation
   * deadline has ALREADY PASSED -- the state every real order reaches by
   * simply existing, and the one the fixture deliberately lacked, which is
   * why the unbounded-refetch defect never fired here. The harness asserts a
   * REQUEST COUNT against this order, not a rendering. No worker runs under
   * the harness, so the expiry sweep cannot move it mid-test.
   */
  lapsed: '5eed0000-0000-4000-8000-000000000015',
  submitted: '5eed0000-0000-4000-8000-000000000012',
  confirmed: '5eed0000-0000-4000-8000-000000000013',
  completed: '5eed0000-0000-4000-8000-000000000014',
};
const LINE = {
  created: '5eed0000-0000-4000-8000-000000000021',
  lapsed: '5eed0000-0000-4000-8000-000000000025',
  submitted: '5eed0000-0000-4000-8000-000000000022',
  confirmed: '5eed0000-0000-4000-8000-000000000023',
  completed: '5eed0000-0000-4000-8000-000000000024',
};

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
  // ------------------------------------------------------------------ trade
  await client.query(
    `INSERT INTO core.account (id, phone_e164, market_id, status, age_declared_over_18)
     VALUES ($1,$2,$3,'ACTIVE', true) ON CONFLICT (id) DO NOTHING`,
    [BUYER, BUYER_PHONE, M],
  );
  await client.query(
    `INSERT INTO core.buyer_profile (id, account_id)
     VALUES ($1,$2) ON CONFLICT (account_id) DO NOTHING`,
    [BUYER, BUYER],
  );
  await client.query(
    `INSERT INTO core.product (id, seller_id, market_id, name, visibility,
                               base_price_minor, base_price_currency, published_at)
     VALUES ($1,$2,$3,'Seed Coffee 1kg','PUBLISHED',48000,'ETB', now())
     ON CONFLICT (id) DO NOTHING`,
    [PRODUCT, SELLER, M],
  );
  /*
   * VARIANTS START AT ZERO AND THE LEDGER PRODUCES THE COUNT (T11 Phase 6,
   * D-173's fixture half). The first version set stock_count = 40 directly
   * and wrote NO core.stock_event rows -- so every seeded reservation held
   * stock that was never deducted, and releasing one (Can't Fulfil, or the
   * expiry sweep) INVENTED INVENTORY: fn_cancel_line inserts +quantity and
   * fn_apply_stock_event applied it to a count that had never gone down --
   * 40 became 42 on a variant that was only ever stocked at 40.
   *
   * Now the fixture tells the ledger's story: SELLER_SET +42, then
   * ORDER_CREATED -2 per reservation (below, after the orders exist for the
   * FKs), and stock_count is OUTPUT -- fn_apply_stock_event, the only writer
   * of the column, computes 40. A release then correctly returns held stock.
   *
   * The schema question underneath -- nothing PREVENTS a reservation without
   * its reserving event -- is D-173 and needs a ruling; a fixture cannot fix
   * that and does not try.
   */
  for (const [key, vid] of Object.entries(VARIANT)) {
    await client.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
                                         price_currency, stock_count, variant_key)
       VALUES ($1,$2,$3,48000,'ETB',0,$4)
       ON CONFLICT (id) DO NOTHING`,
      [vid, PRODUCT, SELLER, key],
    );
  }

  /*
   * One order and its line. The clocks are passed as INTERVALS against the
   * database's now() rather than as timestamps computed here: the harness
   * resets and re-seeds, and a baked timestamp is stale by the time a browser
   * reads it -- which is how a fixture starts failing at midnight.
   */
  const order = async (id, lineId, variantId, state, expiresIn, stopped, createdAgo) => {
    await client.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state,
                                 created_at, expires_at, clock_stopped_at,
                                 total_minor, total_currency, display_currency,
                                 seller_level_at_order)
       VALUES ($1,$2,$3,$4,$5::core.order_state,
               now() - $6::interval, now() + $7::interval,
               CASE WHEN $8::boolean THEN now() - $6::interval ELSE NULL END,
               96000,'ETB','ETB','NEW')
       ON CONFLICT (id) DO NOTHING`,
      [id, M, SELLER, BUYER, state, createdAgo, expiresIn, stopped],
    );
    await client.query(
      `INSERT INTO core.reservation (id, order_id, variant_id, seller_id,
                                     buyer_account_id, quantity, unit_price_minor,
                                     unit_price_currency, state)
       VALUES ($1,$2,$3,$4,$5,2,48000,'ETB',
               CASE WHEN $6::text = 'COMPLETED' THEN 'FULFILLED' ELSE 'ACTIVE' END
                 ::core.reservation_state)
       ON CONFLICT (id) DO NOTHING`,
      [lineId, id, variantId, SELLER, BUYER, state],
    );
  };

  await order(ORDER.created, LINE.created, VARIANT.created,
    'CREATED', '40 hours', false, '8 hours');
  await order(ORDER.submitted, LINE.submitted, VARIANT.submitted,
    'PAYMENT_SUBMITTED', '-2 hours', false, '50 hours');
  await order(ORDER.confirmed, LINE.confirmed, VARIANT.confirmed,
    'PAYMENT_CONFIRMED', '-30 hours', true, '78 hours');
  await order(ORDER.completed, LINE.completed, VARIANT.completed,
    'COMPLETED', '-90 hours', true, '140 hours');
  await order(ORDER.lapsed, LINE.lapsed, VARIANT.lapsed,
    'PAYMENT_SUBMITTED', '-40 hours', false, '80 hours');

  /*
   * THE STOCK LEDGER (D-173's fixture half; see the variant block above).
   * WHERE NOT EXISTS rather than ON CONFLICT, and that is load-bearing for
   * idempotency: fn_apply_stock_event is a BEFORE INSERT trigger, and BEFORE
   * triggers FIRE EVEN WHEN ON CONFLICT DO NOTHING then discards the row --
   * so a re-run under ON CONFLICT would re-apply every delta and the counts
   * would climb by 40 per seeding. With NOT EXISTS the INSERT selects zero
   * rows on a re-run and the trigger never fires.
   */
  const stockEvent = async (id, variantId, delta, reason, orderId, resId) => {
    await client.query(
      `INSERT INTO core.stock_event
         (id, variant_id, seller_id, delta, reason, order_id, reservation_id,
          actor_account_id)
       SELECT $1, $2, $3, $4, $5::core.stock_event_reason, $6, $7, $8
        WHERE NOT EXISTS (SELECT 1 FROM core.stock_event WHERE id = $1)`,
      [id, variantId, SELLER, delta, reason, orderId, resId,
       reason === 'SELLER_SET' ? ACCOUNT : BUYER],
    );
  };
  const keys = ['created', 'submitted', 'confirmed', 'completed', 'lapsed'];
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    await stockEvent(
      `5eed0000-0000-4000-8000-0000000000a${i}`, VARIANT[k], 42, 'SELLER_SET',
      null, null,
    );
    await stockEvent(
      `5eed0000-0000-4000-8000-0000000000b${i}`, VARIANT[k], -2, 'ORDER_CREATED',
      ORDER[k], LINE[k],
    );
  }

  /*
   * The open submission carries the 24h confirmation deadline that the SC-03
   * row and SC-04's clock region both read -- taken from timing_config rather
   * than written as "24 hours", because the window is a configuration row and
   * a fixture that hardcodes it stops matching the market it is seeding.
   *
   * evidence_ref is a real uuid with NO OBJECT BEHIND IT. Financial storage is
   * in-memory in development (FakeFinancialStorageAdapter holds a Map), so no
   * SQL fixture can put bytes where the API will look for them. Registered,
   * not papered over.
   */
  await client.query(
    `INSERT INTO core.payment_submission
       (id, order_id, submitted_at, evidence_ref, state, sla_deadline)
     SELECT $1, $2, now() - interval '3 hours', $3, 'SUBMITTED',
            now() - interval '3 hours' + tc.payment_confirmation_window
       FROM core.timing_config tc
      WHERE tc.market_id = $4 AND tc.effective @> now()
     ON CONFLICT (id) DO NOTHING`,
    ['5eed0000-0000-4000-8000-000000000032', ORDER.submitted,
     '5eed0000-0000-4000-8000-0000000000e1', M],
  );
  await client.query(
    `INSERT INTO core.payment_submission
       (id, order_id, submitted_at, evidence_ref, state, sla_deadline)
     VALUES ($1,$2, now() - interval '30 hours', $3, 'SUBMITTED',
             now() - interval '6 hours')
     ON CONFLICT (id) DO NOTHING`,
    ['5eed0000-0000-4000-8000-000000000035', ORDER.lapsed,
     '5eed0000-0000-4000-8000-0000000000e3'],
  );
  await client.query(
    `INSERT INTO core.payment_submission
       (id, order_id, submitted_at, evidence_ref, state, decided_at,
        decided_by_account_id)
     VALUES ($1,$2, now() - interval '70 hours', $3, 'CONFIRMED',
             now() - interval '69 hours', $4)
     ON CONFLICT (id) DO NOTHING`,
    ['5eed0000-0000-4000-8000-000000000033', ORDER.confirmed,
     '5eed0000-0000-4000-8000-0000000000e2', ACCOUNT],
  );

  /*
   * R20's stronger half. A QR token exists only from PAYMENT_CONFIRMED, so the
   * fixture mints one for exactly the orders that could hold one. A token
   * issued earlier is not a UI mistake -- it is a scannable token for an order
   * nobody has paid for.
   */
  for (const [oid, nonce] of [
    [ORDER.confirmed, '5eed0000-0000-4000-8000-0000000000f1'],
    [ORDER.completed, '5eed0000-0000-4000-8000-0000000000f2'],
  ]) {
    await client.query(
      `INSERT INTO core.order_qr_token (id, order_id, nonce, signing_key_version)
       VALUES ($1,$2,$3,1) ON CONFLICT (order_id) DO NOTHING`,
      [nonce, oid, nonce],
    );
  }

  /*
   * SC-04 region 6 reads core.order_state_transition, which is written by a
   * trigger on UPDATE -- so it holds NOTHING for a row inserted at its final
   * state. These are written explicitly so the history region has the real
   * path, and they are the RATIFIED path from migration 11's transition
   * table, not a plausible one.
   */
  const transitions = [
    [ORDER.submitted, 'CREATED', 'NOTIFIED', '49 hours'],
    [ORDER.submitted, 'NOTIFIED', 'PAYMENT_SUBMITTED', '3 hours'],
    [ORDER.confirmed, 'CREATED', 'NOTIFIED', '77 hours'],
    [ORDER.confirmed, 'NOTIFIED', 'PAYMENT_SUBMITTED', '70 hours'],
    [ORDER.confirmed, 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED', '69 hours'],
    [ORDER.completed, 'CREATED', 'NOTIFIED', '139 hours'],
    [ORDER.completed, 'NOTIFIED', 'PAYMENT_SUBMITTED', '130 hours'],
    [ORDER.completed, 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED', '129 hours'],
    [ORDER.completed, 'PAYMENT_CONFIRMED', 'HANDED_OFF', '100 hours'],
    [ORDER.completed, 'HANDED_OFF', 'COMPLETED', '96 hours'],
  ];
  for (const [oid, from, to, ago] of transitions) {
    await client.query(
      `INSERT INTO core.order_state_transition
         (order_id, from_state, to_state, occurred_at)
       SELECT $1, $2::core.order_state, $3::core.order_state, now() - $4::interval
        WHERE NOT EXISTS (
          SELECT 1 FROM core.order_state_transition
           WHERE order_id = $1 AND from_state = $2::core.order_state
             AND to_state = $3::core.order_state)`,
      [oid, from, to, ago],
    );
  }

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
  orders     5: CREATED (reservation window), PAYMENT_SUBMITTED
             (confirmation window), PAYMENT_CONFIRMED (clock stopped),
             COMPLETED (terminal), and PAYMENT_SUBMITTED with the
             confirmation deadline ALREADY PAST (D-167's regression state).

Console dev loop (three terminals):
  1. pnpm dev:api            # OTP codes print here (dev SMS adapter)
  2. pnpm dev:console        # with VITE_API_BASE_URL=http://localhost:3000
                             # (no device configuration: the first load of the
                             #  console is issued its own by /v1/bootstrap)
  3. sign in at http://localhost:5173/sign-in with ${PHONE},
     read the 6-digit code from apps/api/.dev-sms.log (T8: it is no
     longer printed to the terminal -- see D-106), and open
     /s/${SELLER}
`);
