import { Pool, type PoolClient } from 'pg';

/**
 * T6 / G1.2 + AMENDMENT A1.3 -- the NEW level's exit, at its boundary.
 *
 * The ruling is an AND, and an OR passes two of the three cases below. That
 * is the whole reason this file exists: a seller who signs up and never
 * trades must not leave NEW on tenure alone, and the test that proves it is
 * the one where tenure is satisfied and volume is not.
 *
 * Every case runs against the SHIPPED DEFAULTS -- 60 days and 50 orders --
 * by inserting a ladder_config row that names neither column. If a later
 * migration changes those defaults, these tests fail, which is correct: the
 * numbers are the ruling.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

type Tx = PoolClient;

describe('T6 / G1.2 -- NEW leaves only on tenure AND orders', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: ADMIN, max: 2 });
  });
  afterAll(async () => {
    await pool.end();
  });

  /** Every case in its own transaction, rolled back. Nothing persists. */
  const tx = async (fn: (c: Tx) => Promise<void>) => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await fn(c);
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      c.release();
    }
  };

  /**
   * A market whose ladder_config names NEITHER new_to_established column, so
   * both arrive from the migration's DEFAULTs. That is the point: these
   * tests assert the shipped numbers, not numbers the fixture chose.
   */
  const seedMarket = async (c: Tx, suffix: string) => {
    const market = `88888888-2222-4000-8000-0000000000${suffix}0`;
    const seller = `88888888-2222-4000-8000-0000000000${suffix}1`;
    const owner = `88888888-2222-4000-8000-0000000000${suffix}2`;
    const buyer = `88888888-2222-4000-8000-0000000000${suffix}3`;

    await c.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
                                display_timezone, default_locale, is_live)
       VALUES ($1, $2, 'Boundary', 'PHASE_1', 'ETB', 'Africa/Addis_Ababa', 'en', false)`,
      [market, `B${suffix}`],
    );
    // NEITHER new_to_established column is named, so both arrive from the
    // migration's DEFAULTs -- that is what makes these tests assert the
    // SHIPPED numbers rather than numbers the fixture chose.
    //
    // NO trusted_* column is named either, so all four are NULL: ADU-VAL-01
    // Group A, deferred, and since T6 expressible as such. The established_*
    // and demotion_* columns are supplied only because they are still NOT
    // NULL; nothing reads established_* since A1.3.
    await c.query(
      `INSERT INTO core.ladder_config (id, market_id,
         established_min_handoffs, established_window,
         established_min_avg_rating, established_max_claim_rate,
         demotion_max_claim_rate, demotion_max_cancellation_rate,
         demotion_min_scan_completion_rate, demotion_window,
         distinct_buyer_window, distinct_buyer_max_count)
       VALUES (gen_random_uuid(), $1, 1, '90 days', 1.0, 0.99,
               0.99, 0.99, 0.0, '60 days', '30 days', 3)`,
      [market],
    );
    await c.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status)
       VALUES ($1, $3, $5, 'ACTIVE'), ($2, $4, $5, 'ACTIVE')`,
      [owner, buyer, `+2519160000${suffix}1`, `+2519160000${suffix}2`, market],
    );
    await c.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
                                store_name, handle, status)
       VALUES ($1, $2, $3, 'INDIVIDUAL', 'B', $4, 'ACTIVE')`,
      [seller, market, owner, `bnd-${suffix}`],
    );
    return { market, seller, buyer };
  };

  /**
   * Put the seller on the ladder at NEW, `days` ago. Tenure is measured from
   * seller_level_state.since -- the moment they ENTERED the ladder -- so the
   * fixture writes that instant directly rather than waiting sixty days.
   */
  const enterLadder = async (c: Tx, seller: string, days: number) =>
    c.query(
      `INSERT INTO core.seller_level_state (seller_id, level, since, computed_at)
       VALUES ($1, 'NEW', now() - make_interval(days => $2::int), now())`,
      [seller, days],
    );

  /**
   * N orders already COMPLETED. Inserted directly in the terminal state: the
   * transition guard and the three stats triggers are all BEFORE/AFTER
   * UPDATE, so an INSERT reaches none of them, and order_clock_consistency
   * is satisfied because clock_stopped_at is set. What is under test is the
   * ladder gate, not the state machine -- which has its own suite.
   */
  const completedOrders = async (c: Tx, m: string, seller: string, buyer: string, n: number) => {
    if (n === 0) return;
    await c.query(
      `INSERT INTO core."order"
         (id, market_id, seller_id, buyer_account_id, state, expires_at,
          clock_stopped_at, total_currency, display_currency)
       SELECT gen_random_uuid(), $1, $2, $3, 'COMPLETED',
              now() + interval '48 hours', now(), 'ETB', 'ETB'
         FROM generate_series(1, $4::int)`,
      [m, seller, buyer, n],
    );
  };

  const levelOf = async (c: Tx, seller: string) =>
    (
      await c.query(`SELECT level FROM core.seller_level_state WHERE seller_id = $1`, [seller])
    ).rows[0]?.level as string | undefined;

  // ------------------------------------------------------------ the boundary

  it('60 days and 49 orders is NEW -- one order short of the bar', () =>
    tx(async (c) => {
      const { market, seller, buyer } = await seedMarket(c, '1');
      await enterLadder(c, seller, 60);
      await completedOrders(c, market, seller, buyer, 49);

      await c.query(`SELECT core.fn_recompute_seller_level($1)`, [seller]);
      expect(await levelOf(c, seller)).toBe('NEW');
    }));

  it('60 days and 50 orders is ESTABLISHED -- both arms satisfied', () =>
    tx(async (c) => {
      const { market, seller, buyer } = await seedMarket(c, '2');
      await enterLadder(c, seller, 60);
      await completedOrders(c, market, seller, buyer, 50);

      await c.query(`SELECT core.fn_recompute_seller_level($1)`, [seller]);
      expect(await levelOf(c, seller)).toBe('ESTABLISHED');

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

  it('59 days and 100 orders is NEW -- THE AND IS THE WHOLE RULING', () =>
    tx(async (c) => {
      // An OR passes both cases above and fails only here. This is the
      // dormant-seller hole in reverse: volume without tenure must not
      // promote either, and only this case can tell the two apart.
      const { market, seller, buyer } = await seedMarket(c, '3');
      await enterLadder(c, seller, 59);
      await completedOrders(c, market, seller, buyer, 100);

      await c.query(`SELECT core.fn_recompute_seller_level($1)`, [seller]);
      expect(await levelOf(c, seller)).toBe('NEW');
    }));

  it('the dormant seller: 400 days and no orders is NEW', () =>
    tx(async (c) => {
      // v1.12's own argument for AND over OR: "sign up, never trade, and
      // sixty days later leave NEW on tenure alone -- an uncapped catalogue
      // and no caution flag, having done nothing."
      const { seller } = await seedMarket(c, '4');
      await enterLadder(c, seller, 400);

      await c.query(`SELECT core.fn_recompute_seller_level($1)`, [seller]);
      expect(await levelOf(c, seller)).toBe('NEW');
    }));

  // -------------------------------------------------- the deferral is real

  it('TRUSTED is unreachable on ANY input while trusted_* are NULL', () =>
    tx(async (c) => {
      // A1.3: "Test that the deferral is real, not just believed." The
      // seller below satisfies every NEW->ESTABLISHED arm many times over
      // and has counting handoffs; TRUSTED still cannot be reached, because
      // its own four thresholds are ADU-VAL-01 Group A and NULL.
      const { market, seller, buyer } = await seedMarket(c, '5');
      await enterLadder(c, seller, 4000);
      await completedOrders(c, market, seller, buyer, 500);

      const cfg = await c.query(
        `SELECT trusted_min_handoffs, trusted_window,
                trusted_min_scan_completion_rate, trusted_max_claim_rate
           FROM core.ladder_config WHERE market_id = $1`,
        [market],
      );
      // ALL FOUR are NULL. Before T6 they were NOT NULL, so a configured
      // market had to supply them and TRUSTED became reachable the moment
      // any market existed -- the opposite of the ruling. The deferral was
      // not expressible, which is why the guards that check for it were
      // guarding against a value the schema forbade.
      expect(cfg.rows[0].trusted_min_handoffs).toBeNull();
      expect(cfg.rows[0].trusted_window).toBeNull();
      expect(cfg.rows[0].trusted_min_scan_completion_rate).toBeNull();
      expect(cfg.rows[0].trusted_max_claim_rate).toBeNull();

      await c.query(`SELECT core.fn_recompute_seller_level($1)`, [seller]);
      expect(await levelOf(c, seller)).toBe('ESTABLISHED');
      expect(await levelOf(c, seller)).not.toBe('TRUSTED');
    }));

  // ------------------------------------------------------------- the caps

  it('the shipped defaults are 60 days, 50 orders, 10 products and NO transaction cap', () =>
    tx(async (c) => {
      const { market } = await seedMarket(c, '6');
      const r = await c.query(
        `SELECT new_to_established_min_tenure::text AS tenure,
                new_to_established_min_orders      AS orders,
                new_level_product_cap              AS product_cap,
                new_level_transaction_cap_minor    AS txn_cap
           FROM core.ladder_config WHERE market_id = $1`,
        [market],
      );
      expect(r.rows[0].tenure).toBe('60 days');
      expect(r.rows[0].orders).toBe(50);
      expect(r.rows[0].product_cap).toBe(10);
      // NULL is NO CAP, and it has to be legal for the ruling to be
      // expressible at all -- the column was NOT NULL before T6.
      expect(r.rows[0].txn_cap).toBeNull();
    }));
});
