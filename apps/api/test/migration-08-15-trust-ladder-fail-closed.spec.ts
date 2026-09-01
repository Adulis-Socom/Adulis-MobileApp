import { Pool, PoolClient } from 'pg';

/** A savepoint-guarded client — see the tx helper. */
type Tx = { query: PoolClient['query'] };

/**
 * Migrations 08-15 — the trust ladder fails closed.
 *
 * The one test the T3 work order names: "with thresholds NULL, no seller is
 * ever promoted." In the ratified schema a threshold cannot even be NULL —
 * every ladder_config criterion column is NOT NULL — so ADU-VAL-01's deferral
 * exists as the ABSENCE of the configuration row, and fail-closed means:
 *
 *   1. with no config row in force, fn_recompute_seller_level exits before
 *      reading one row of evidence, and the level never moves;
 *   2. with no config row in force, a scan cannot even ACCRUE level credit
 *      (counts_toward_level is forced false by the validity trigger), so the
 *      evidence that would promote cannot come into existence;
 *   3. forced demotion (an upheld claim) needs NO configuration — "always
 *      demotes" is unconditional, floor NEW.
 *
 * A control market with trivially-low thresholds proves the promotion
 * machinery genuinely promotes on the same evidence shape — otherwise a
 * recompute that was simply broken would pass tests 1 and 2.
 */

// The privileged credential, deliberately: these suites write fixtures into
// configuration tables and assert grants from the outside, neither of which
// adulis_app (the runtime DATABASE_URL from Tier 3) may do.
const CONNECTION_STRING = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

// control market (sane thresholds) and dark market (no config row)
const MC = '44444444-2222-4000-8000-000000000001';
const MD = '44444444-2222-4000-8000-000000000002';

describe('migrations 08-15 — the trust ladder fails closed', () => {
  let pool: Pool;

  const tx = async <T>(fn: (c: Tx) => Promise<T>): Promise<T> => {
    const c = await pool.connect();
    const guarded: Tx = {
      query: async (...args: Parameters<PoolClient['query']>) => {
        await c.query('SAVEPOINT stmt');
        try {
          const r = await (c.query as (...a: unknown[]) => Promise<unknown>)(...args);
          await c.query('RELEASE SAVEPOINT stmt');
          return r;
        } catch (e) {
          await c.query('ROLLBACK TO SAVEPOINT stmt');
          throw e;
        }
      },
    } as Tx;
    try {
      await c.query('BEGIN');
      return await fn(guarded);
    } finally {
      await c.query('ROLLBACK');
      c.release();
    }
  };

  beforeAll(() => {
    pool = new Pool({ connectionString: CONNECTION_STRING, max: 2 });
  });
  afterAll(async () => {
    await pool.end();
  });

  /**
   * A market with a seller on the ladder at NEW, a buyer, and one COMPLETED
   * scanned order plus a five-star review — the evidence shape that promotes
   * wherever thresholds allow it. Returns the seller id.
   */
  const seedMarket = async (c: Tx, market: string, suffix: string, withConfig: boolean) => {
    const seller = `44444444-2222-4000-8000-0000000000${suffix}1`;
    const owner = `44444444-2222-4000-8000-0000000000${suffix}2`;
    const buyer = `44444444-2222-4000-8000-0000000000${suffix}3`;
    const order = `44444444-2222-4000-8000-0000000000${suffix}4`;
    const token = `44444444-2222-4000-8000-0000000000${suffix}5`;

    await c.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1, $2, 'Ladder', 'PHASE_1', 'ETB', 'Africa/Addis_Ababa', 'en',false, 'ACTIVE', true, 'AFROMESSAGE')`,
      [market, `L${suffix}`],
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
       VALUES (gen_random_uuid(), $1, '48 hours', '24 hours', '72 hours',
         '7 days', '24 hours', '7 days', '30 days', '48 hours', '90 days',
         '24 hours', '30 days', '12 hours', '30 minutes', '7 days', '8 hours',
         '5 minutes', 5, '5 minutes', '24 hours', 3, '1 hour',
         ARRAY['1 day','2 days','4 days']::interval[], '30 days')`,
      [market],
    );
    if (withConfig) {
      // Trivially-low thresholds, so that the one completed order clears the
      // ESTABLISHED gate. Since G1.2/A1.3 that gate is TENURE and COMPLETED
      // ORDERS and nothing else -- the established_* columns are retained
      // and read by nothing, so they are seeded here only to satisfy their
      // NOT NULLs, and changing them would change no outcome.
      await c.query(
        `INSERT INTO core.ladder_config (id, market_id,
           new_to_established_min_tenure, new_to_established_min_orders,
           established_min_handoffs, established_window,
           established_min_avg_rating, established_max_claim_rate,
           trusted_min_handoffs, trusted_window,
           trusted_min_scan_completion_rate, trusted_max_claim_rate,
           demotion_max_claim_rate, demotion_max_cancellation_rate,
           demotion_min_scan_completion_rate, demotion_window,
           new_level_product_cap, new_level_transaction_cap_minor,
           distinct_buyer_window, distinct_buyer_max_count)
         VALUES (gen_random_uuid(), $1, interval '0 seconds', 1,
                 1, '90 days', 1.0, 0.99,
                 100, '180 days', 0.9, 0.5,
                 0.99, 0.99, 0.0, '60 days',
                 10, 500000, '30 days', 3)`,
        [market],
      );
    }
    await c.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status)
       VALUES ($1, $3, $5, 'ACTIVE'), ($2, $4, $5, 'ACTIVE')`,
      [owner, buyer, `+2519130000${suffix}1`, `+2519130000${suffix}2`, market],
    );
    await c.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1, $2, $3, 'INDIVIDUAL', 'L', $4, 'ACTIVE')`,
      [seller, market, owner, `lad-${suffix}`],
    );
    // On the ladder at NEW (ladder entry is eligibility's write, D3; direct
    // here because eligibility is not under test).
    await c.query(
      `INSERT INTO core.seller_level_state (seller_id, level) VALUES ($1, 'NEW')`,
      [seller],
    );
    // One completed, scanned, five-star order.
    await c.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id,
                                 state, expires_at, total_currency, display_currency)
       VALUES ($1, $2, $3, $4, 'CREATED', now() + interval '48 hours', 'ETB', 'ETB')`,
      [order, market, seller, buyer],
    );
    await c.query(`UPDATE core."order" SET state = 'PAYMENT_SUBMITTED' WHERE id = $1`, [order]);
    await c.query(
      `UPDATE core."order" SET state = 'PAYMENT_CONFIRMED', clock_stopped_at = now() WHERE id = $1`,
      [order],
    );
    await c.query(
      `INSERT INTO core.order_qr_token (id, order_id, nonce, signing_key_version)
       VALUES ($1, $2, gen_random_uuid(), 1)`,
      [token, order],
    );
    await c.query(
      `INSERT INTO core.handoff_scan (order_id, scanned_by_account_id, nonce, signed_at)
       VALUES ($1, $2, gen_random_uuid(), now())`,
      [order, buyer],
    );
    await c.query(`UPDATE core."order" SET state = 'COMPLETED' WHERE id = $1`, [order]);
    await c.query(
      `INSERT INTO core.review (order_id, buyer_account_id, seller_id, seller_rating, badge)
       VALUES ($1, $2, $3, 5, 'UNVERIFIED')`,
      [order, buyer, seller],
    );
    return seller;
  };

  const levelOf = async (c: Tx, seller: string) => {
    const r = await c.query(
      `SELECT level FROM core.seller_level_state WHERE seller_id = $1`,
      [seller],
    );
    return r.rows[0]?.level as string | undefined;
  };

  it('CONTROL — the same evidence shape genuinely promotes where thresholds allow', () =>
    tx(async (c) => {
      const seller = await seedMarket(c, MC, '1', true);
      const scan = await c.query(
        `SELECT counts_toward_level FROM core.handoff_scan hs
          JOIN core."order" o ON o.id = hs.order_id WHERE o.seller_id = $1`,
        [seller],
      );
      expect(scan.rows[0].counts_toward_level).toBe(true);

      await c.query(`SELECT core.fn_recompute_seller_level($1)`, [seller]);
      expect(await levelOf(c, seller)).toBe('ESTABLISHED');

      // and the move is on the append-only record, sourced COMPUTED
      const ev = await c.query(
        `SELECT from_level, to_level, source FROM core.seller_level_event
          WHERE seller_id = $1 ORDER BY occurred_at DESC LIMIT 1`,
        [seller],
      );
      expect(ev.rows[0]).toMatchObject({
        from_level: 'NEW',
        to_level: 'ESTABLISHED',
        source: 'COMPUTED',
      });
    }));

  it('with no thresholds in force, no seller is ever promoted — layer 1: the recompute exits before evidence', () =>
    tx(async (c) => {
      const seller = await seedMarket(c, MD, '2', false);
      await c.query(`SELECT core.fn_recompute_seller_level($1)`, [seller]);
      expect(await levelOf(c, seller)).toBe('NEW');

      // and no level event was written — nothing moved, nothing pretended to
      const ev = await c.query(
        `SELECT count(*)::int AS n FROM core.seller_level_event WHERE seller_id = $1`,
        [seller],
      );
      expect(ev.rows[0].n).toBe(0);
    }));

  it('with no thresholds in force, level credit cannot even accrue — layer 2: counts_toward_level is forced false', () =>
    tx(async (c) => {
      const seller = await seedMarket(c, MD, '3', false);
      const scan = await c.query(
        `SELECT hs.validity, hs.counts_toward_level FROM core.handoff_scan hs
          JOIN core."order" o ON o.id = hs.order_id WHERE o.seller_id = $1`,
        [seller],
      );
      // the scan is VALID — the buyer's order completes — but it advances
      // nothing: completion and trust are different clocks and different rules
      expect(scan.rows[0].validity).toBe('VALID');
      expect(scan.rows[0].counts_toward_level).toBe(false);
    }));

  it('forced demotion needs no configuration: an upheld claim always demotes, floor NEW', () =>
    tx(async (c) => {
      const seller = await seedMarket(c, MD, '4', false);
      await c.query(
        `UPDATE core.seller_level_state SET level = 'TRUSTED' WHERE seller_id = $1`,
        [seller],
      );

      // through the REAL path: open a claim, uphold it. Each upheld claim
      // demotes one level; the resolved claim frees the scope for the next.
      const uphold = async () => {
        const opened = await c.query(
          `INSERT INTO core.claim (order_id, opened_by_kind, opened_by_account_id,
                                   trigger, state)
           SELECT o.id, 'BUYER', o.buyer_account_id, 'NOT_AS_DESCRIBED',
                  'UNDER_REVIEW'
             FROM core."order" o WHERE o.seller_id = $1
           RETURNING id`,
          [seller],
        );
        await c.query(
          `UPDATE core.claim
              SET outcome = 'UPHELD', state = 'RESOLVED',
                  decided_by = (SELECT owner_account_id FROM core.seller WHERE id = $2),
                  decided_at = now()
            WHERE id = $1`,
          [opened.rows[0].id, seller],
        );
      };

      await uphold();
      expect(await levelOf(c, seller)).toBe('ESTABLISHED');
      await uphold();
      expect(await levelOf(c, seller)).toBe('NEW');
      // the floor: a third upheld claim cannot demote below NEW
      await uphold();
      expect(await levelOf(c, seller)).toBe('NEW');

      // and each demotion carries its audit chain: a moderation_event
      // recording the upheld decision, referenced by the level event
      const ev = await c.query(
        `SELECT count(*)::int AS n FROM core.seller_level_event e
          JOIN core.moderation_event me ON me.id = e.moderation_event_id
         WHERE e.seller_id = $1 AND e.source = 'MODERATION'
           AND me.decision = 'CLAIM_UPHELD'`,
        [seller],
      );
      expect(ev.rows[0].n).toBe(2);
    }));
});
