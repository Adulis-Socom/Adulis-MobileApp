/**
 * Phase D — the three DB-level loads of ADU-CON-02-A1 section 6:
 *
 *   (2) the expiry sweep against 1M orders with 10k live — partial-index
 *       behaviour: the sweep's working set must be the 10k, never the 1M;
 *   (3) the stats-update trigger path under 100 scans/s — R16's O(1):
 *       per-scan cost flat as the scan table grows;
 *   (4) the 08:00 dispatch at 10k queued notifications — the sender's
 *       SKIP LOCKED batch draw.
 *
 * The section 24 JOB BODIES do not exist yet (worker slab, parked): what
 * is measured here is the exact query path each job will run, against the
 * real schema, indexes and triggers. Synthetic rows are inserted under
 * session_replication_role = replica (triggers off) EXCEPT where the
 * trigger IS the thing measured, then removed.
 *
 * Run:  node ops/load/db-loads.mjs   (root .env supplies DATABASE_URL_MIGRATE)
 */

import { readFileSync } from 'node:fs';
import { Client } from 'pg';

for (const line of readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const MARKET = 'ffff9999-0000-4000-8000-000000000001';
const SELLER = 'ffff9999-0000-4000-8000-000000000002';
const OWNER = 'ffff9999-0000-4000-8000-000000000003';
const BUYER = 'ffff9999-0000-4000-8000-000000000004';
const PRODUCT = 'ffff9999-0000-4000-8000-000000000005';
const VARIANT = 'ffff9999-0000-4000-8000-000000000006';

const c = new Client({ connectionString: process.env.DATABASE_URL_MIGRATE });
const results = [];

const ms = async (fn) => {
  const t0 = process.hrtime.bigint();
  const out = await fn();
  return { out, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
};

async function seedBase() {
  await c.query(`SET session_replication_role = replica`);
  await c.query(
    `INSERT INTO core.market (id, code, display_name, phase, display_currency,
       display_timezone, default_locale, is_live)
     VALUES ($1,'LDT','LoadTest','PHASE_1','ETB','Africa/Addis_Ababa','en',false)
     ON CONFLICT (id) DO NOTHING`,
    [MARKET],
  );
  await c.query(
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
    [MARKET],
  );
  await c.query(
    `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
       ($1,'+251911771701',$3,'ACTIVE'), ($2,'+251911771702',$3,'ACTIVE')
     ON CONFLICT (id) DO NOTHING`,
    [OWNER, BUYER, MARKET],
  );
  await c.query(
    `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
       store_name, handle, status)
     VALUES ($1,$2,$3,'INDIVIDUAL','Load Store','load-store','ACTIVE')
     ON CONFLICT (id) DO NOTHING`,
    [SELLER, MARKET, OWNER],
  );
  await c.query(
    `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor,
       base_price_currency, visibility)
     VALUES ($1,$2,$3,'Load',1000,'ETB','PUBLISHED') ON CONFLICT (id) DO NOTHING`,
    [PRODUCT, SELLER, MARKET],
  );
  await c.query(
    `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
       price_currency, variant_key)
     VALUES ($1,$2,$3,1000,'ETB','load') ON CONFLICT (id) DO NOTHING`,
    [VARIANT, PRODUCT, SELLER],
  );
  await c.query(`SET session_replication_role = DEFAULT`);
}

/** (2) 1M settled orders, 10k with the clock running and due. */
async function expirySweep() {
  await c.query(`SET session_replication_role = replica`);
  console.log('seeding 1,000,000 settled orders (bulk, triggers off)...');
  const { ms: seedMs } = await ms(() =>
    c.query(
      `INSERT INTO core."order"
         (id, market_id, seller_id, buyer_account_id, state, total_minor,
          total_currency, display_currency, expires_at, clock_stopped_at, created_at)
       SELECT gen_random_uuid(), $1, $2, $3, 'COMPLETED', 1000, 'ETB','ETB',
              now() - interval '30 days', now() - interval '30 days',
              now() - interval '60 days'
         FROM generate_series(1, 990000)`,
      [MARKET, SELLER, BUYER],
    ),
  );
  await c.query(
    `INSERT INTO core."order"
       (id, market_id, seller_id, buyer_account_id, state, total_minor,
        total_currency, display_currency, expires_at, created_at)
     SELECT gen_random_uuid(), $1, $2, $3, 'CREATED', 1000, 'ETB','ETB',
            now() - interval '1 minute', now() - interval '49 hours'
       FROM generate_series(1, 10000)`,
    [MARKET, SELLER, BUYER],
  );
  await c.query(`SET session_replication_role = DEFAULT`);
  await c.query(`ANALYZE core."order"`);

  // The sweep's read — the working set must be the partial index.
  const plan = await c.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
     SELECT id FROM core."order"
      WHERE clock_stopped_at IS NULL AND expires_at < now()`,
  );
  const root = plan.rows[0]['QUERY PLAN'][0];
  const { ms: sweepMs, out } = await ms(() =>
    c.query(
      `SELECT count(*)::int AS n FROM core."order"
        WHERE clock_stopped_at IS NULL AND expires_at < now()`,
    ),
  );
  const planText = JSON.stringify(root.Plan);
  results.push({
    test: 'expiry sweep (A1 6.2)',
    seeded: '1,000,000 orders, 10,000 due',
    seed_ms: Math.round(seedMs),
    sweep_rows: out.rows[0].n,
    sweep_ms: +sweepMs.toFixed(1),
    exec_ms: +root['Execution Time'].toFixed(1),
    uses_partial_index: planText.includes('idx_order_expiry_sweep'),
  });
}

/** (3) the scan-effects trigger at scan volume — per-row cost must stay flat. */
async function statsTrigger() {
  // Real rows through the REAL triggers: an order per scan (the validity
  // trigger discriminates per order), batches timed as the table grows.
  const batches = [];
  for (let batch = 0; batch < 3; batch += 1) {
    const { ms: t } = await ms(() =>
      c.query(
        `WITH o AS (
           INSERT INTO core."order"
             (id, market_id, seller_id, buyer_account_id, state, total_minor,
              total_currency, display_currency, expires_at, clock_stopped_at)
           SELECT gen_random_uuid(), $1, $2, $3, 'PAYMENT_CONFIRMED', 1000,
                  'ETB','ETB', now() + interval '1 day', now()
             FROM generate_series(1, 100)
           RETURNING id
         ), t AS (
           INSERT INTO core.order_qr_token (id, order_id, nonce, signing_key_version)
           SELECT gen_random_uuid(), id, gen_random_uuid(), 1 FROM o
           RETURNING order_id, nonce
         )
         INSERT INTO core.handoff_scan
           (order_id, nonce, scanned_by_account_id, signed_at)
         SELECT order_id, nonce, $3, now() FROM t`,
        [MARKET, SELLER, BUYER],
      ),
    );
    batches.push(+t.toFixed(1));
  }
  results.push({
    test: 'stats trigger path, 100 scans per statement (A1 6.3)',
    batch_ms: batches,
    per_scan_ms_first: +(batches[0] / 100).toFixed(2),
    per_scan_ms_last: +(batches[batches.length - 1] / 100).toFixed(2),
    flat: batches[batches.length - 1] < batches[0] * 3,
  });
}

/** (4) the dispatch draw at 10k queued. */
async function dispatchDraw() {
  await c.query(`SET session_replication_role = replica`);
  await c.query(
    `INSERT INTO core.notification
       (recipient_account_id, channel, template_key, locale, slots, state, scheduled_for)
     SELECT $1, 'PUSH', 'ORDER_EXPIRY_WARNING', 'en', '{}'::jsonb, 'QUEUED',
            now() - interval '1 minute'
       FROM generate_series(1, 10000)`,
    [BUYER],
  );
  await c.query(`SET session_replication_role = DEFAULT`);
  await c.query(`ANALYZE core.notification`);
  const { ms: drawMs, out } = await ms(() =>
    c.query(
      `WITH batch AS (
         SELECT id FROM core.notification
          WHERE state = 'QUEUED' AND scheduled_for <= now()
          ORDER BY scheduled_for
          LIMIT 500
            FOR UPDATE SKIP LOCKED
       )
       UPDATE core.notification n SET state = 'SENT', sent_at = now()
         FROM batch WHERE n.id = batch.id
       RETURNING n.id`,
    ),
  );
  const { ms: drainMs } = await ms(async () => {
    let total = 0;
    for (;;) {
      const r = await c.query(
        `WITH batch AS (
           SELECT id FROM core.notification
            WHERE state = 'QUEUED' AND scheduled_for <= now()
            ORDER BY scheduled_for LIMIT 500 FOR UPDATE SKIP LOCKED)
         UPDATE core.notification n SET state = 'SENT', sent_at = now()
           FROM batch WHERE n.id = batch.id`,
      );
      total += r.rowCount;
      if (r.rowCount === 0) break;
    }
    return total;
  });
  results.push({
    test: '08:00 dispatch draw at 10k queued (A1 6.4)',
    first_batch_of_500_ms: +drawMs.toFixed(1),
    first_batch_rows: out.rowCount,
    full_drain_ms: +drainMs.toFixed(1),
  });
}

async function cleanup() {
  await c.query(`SET session_replication_role = replica`);
  await c.query(`DELETE FROM core.handoff_scan WHERE order_id IN (SELECT id FROM core."order" WHERE market_id=$1)`, [MARKET]);
  await c.query(`DELETE FROM core.order_qr_token WHERE order_id IN (SELECT id FROM core."order" WHERE market_id=$1)`, [MARKET]);
  await c.query(`DELETE FROM core.order_state_transition WHERE order_id IN (SELECT id FROM core."order" WHERE market_id=$1)`, [MARKET]);
  await c.query(`DELETE FROM core."order" WHERE market_id=$1`, [MARKET]);
  await c.query(`DELETE FROM core.notification WHERE recipient_account_id=$1`, [BUYER]);
  await c.query(`DELETE FROM core.seller_public_stats WHERE seller_id=$1`, [SELLER]);
  await c.query(`DELETE FROM core.product_variant WHERE seller_id=$1`, [SELLER]);
  await c.query(`DELETE FROM core.product WHERE seller_id=$1`, [SELLER]);
  await c.query(`DELETE FROM core.seller WHERE id=$1`, [SELLER]);
  await c.query(`DELETE FROM core.account WHERE market_id=$1`, [MARKET]);
  await c.query(`DELETE FROM core.timing_config WHERE market_id=$1`, [MARKET]);
  await c.query(`DELETE FROM core.market WHERE id=$1`, [MARKET]);
  await c.query(`SET session_replication_role = DEFAULT`);
}

try {
  await c.connect();
  await seedBase();
  await expirySweep();
  await statsTrigger();
  await dispatchDraw();
  console.log(JSON.stringify(results, null, 2));
} finally {
  console.log('cleaning up synthetic rows...');
  await cleanup();
  await c.end();
}
