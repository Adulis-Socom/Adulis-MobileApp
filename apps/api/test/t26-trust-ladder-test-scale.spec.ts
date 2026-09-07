import { Pool } from 'pg';
import { createJobHarness, type Harness } from './jobs-harness';
import { levelRecompute } from '../src/jobs/e3-trust-stock';

/**
 * T26 Phase 2 -- the trust ladder, at test scale, with nothing faked.
 *
 * THE PROBLEM THIS ANSWERS. The ladder is configured and has never fired.
 * `new_to_established_min_tenure` is 60 days and `new_to_established_min_orders`
 * is 50, both arms required; the other fourteen ladder columns are NULL so
 * TRUSTED is unreachable by design. Every level-dependent screen -- SC-13, the
 * NEW product cap and its counter, the badges -- has therefore only ever been
 * seen rendering NEW.
 *
 * WHAT IS AND IS NOT LOWERED. The THRESHOLDS move, in the non-production seed
 * and in this fixture: one day, two orders. The MECHANISM does not move at
 * all. These are the real columns, read by the real `AND` inside
 * `core.fn_recompute_seller_level`, in a real per-market `core.ladder_config`
 * row, swept by the real `level.recompute` job -- which this test RUNS, as
 * `adulis_jobs`, exactly as the scheduler will. No function and no job is
 * modified by T26.
 *
 * WHY THAT MATTERS MORE THAN IT SOUNDS. A "dummy ladder" that wrote
 * ESTABLISHED into `core.seller_level_state` would make every screen
 * renderable and leave `fn_recompute_seller_level` as untested as it is
 * today -- and the function is where the ladder's whole judgement lives. A
 * test that watches a real promotion happen in a minute is worth more than
 * one that asserts a level was set.
 *
 * [!] THIS DOES NOT MAKE A SELLER ABLE TO EARN A LEVEL, and the fixture below
 * is the proof rather than the counter-example: the COMPLETED orders are
 * WRITTEN AS ROWS, because register D-328 says nothing in the product moves an
 * order from HANDED_OFF to COMPLETED. `fn_recompute_seller_level` counts
 * COMPLETED orders, so a seller who trades reaches a count of zero and stays
 * there. Two is as unreachable as fifty when the counter cannot move.
 *
 * [!] AND A PROMOTION DOES NOT STICK. See the last describe block: the
 * recompute resets `since` on EVERY level change, and tenure is measured from
 * `since`, so the run after the one that promotes finds tenure at zero and
 * demotes. That is D-358, found by this fixture on the day it first ran a real
 * promotion, and it is PINNED here rather than worked around.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const N = '26260002-0000-4000-8000-0000000000';
const M = `${N}01`;
const OWNER = `${N}02`;
const BUYER = `${N}03`;
/** Tenure satisfied, ONE completed order: one short, so the AND is visible. */
const S_NEW = `${N}04`;
/** Promoted three days ago; both arms still satisfied, so it holds. */
const S_EST = `${N}05`;
/** Both arms satisfied right now. The next sweep promotes it. */
const S_DUE = `${N}06`;

/** The seed's own trio, restored in teardown -- see the note on afterAll. */
const SEED_LADDER = [
  '5eed0000-0000-4000-8000-000000000042',
  '5eed0000-0000-4000-8000-000000000043',
  '5eed0000-0000-4000-8000-000000000044',
];

interface LevelRow {
  level: string;
  tenure_seconds: number;
}

describe('T26 Phase 2 -- a real promotion, at test scale', () => {
  let admin: Pool;
  let h: Harness;

  const levelOf = async (seller: string): Promise<LevelRow> => {
    const r = await admin.query<LevelRow>(
      `SELECT level::text AS level,
              extract(epoch FROM now() - since)::int AS tenure_seconds
         FROM core.seller_level_state WHERE seller_id = $1`,
      [seller],
    );
    return r.rows[0] as LevelRow;
  };

  const events = async (seller: string): Promise<string[]> => {
    const r = await admin.query<{ e: string }>(
      `SELECT from_level::text || '->' || to_level::text || ':' || source::text AS e
         FROM core.seller_level_event WHERE seller_id = $1 ORDER BY occurred_at, to_level`,
      [seller],
    );
    return r.rows.map((x) => x.e);
  };

  /** A COMPLETED order and its fulfilled line, through the schema's own rules. */
  const completedOrder = async (
    seller: string,
    variant: string,
    order: string,
    line: string,
    agoHours: string,
  ): Promise<void> => {
    // order_clock_consistency: COMPLETED requires clock_stopped_at NOT NULL.
    // T25's first probe cohort was refused by this CHECK, correctly.
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state,
         created_at, expires_at, clock_stopped_at, total_minor, total_currency,
         display_currency, seller_level_at_order)
       VALUES ($1,$2,$3,$4,'COMPLETED', now() - $5::interval,
               now() - $5::interval + interval '48 hours',
               now() - $5::interval + interval '20 hours',
               96000,'ETB','ETB','NEW')`,
      [order, M, seller, BUYER, agoHours],
    );
    await admin.query(
      `INSERT INTO core.reservation (id, order_id, variant_id, seller_id,
         buyer_account_id, quantity, unit_price_minor, unit_price_currency, state)
       VALUES ($1,$2,$3,$4,$5,1,48000,'ETB','FULFILLED')`,
      [line, order, variant, seller, BUYER],
    );
  };

  /**
   * `tag` is one hex digit per seller, so every derived id below is this
   * suite's namespace plus a kind letter plus that digit -- distinct by
   * construction rather than by arithmetic on the seller's own uuid.
   */
  const ladderSeller = async (
    id: string,
    handle: string,
    level: string,
    sinceAgo: string,
    orderCount: number,
    tag: string,
  ): Promise<void> => {
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
         store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL',$4,$5,'ACTIVE')`,
      [id, M, OWNER, handle, handle],
    );
    await admin.query(
      `INSERT INTO core.seller_level_state (seller_id, level, since, computed_at)
       VALUES ($1,$2::core.trust_level, now() - $3::interval, now())
       ON CONFLICT (seller_id) DO UPDATE
         SET level = EXCLUDED.level, since = EXCLUDED.since`,
      [id, level, sinceAgo],
    );
    const product = `${N}a${tag}`;
    const variant = `${N}b${tag}`;
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name,
         base_price_minor, base_price_currency, visibility)
       VALUES ($1,$2,$3,$4,48000,'ETB','PUBLISHED')`,
      [product, id, M, `${handle} item`],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
         price_currency, variant_key)
       VALUES ($1,$2,$3,48000,'ETB','default')`,
      [variant, product, id],
    );
    const orderIds = ['c', 'd'];
    const lineIds = ['e', 'f'];
    for (let i = 0; i < orderCount; i += 1) {
      await completedOrder(
        id,
        variant,
        `${N}${orderIds[i]}${tag}`,
        `${N}${lineIds[i]}${tag}`,
        `${60 - i * 5} hours`,
      );
    }
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    h = createJobHarness(new Date());

    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
         display_timezone, default_locale, activation_state, otp_enabled, sms_primary_provider)
       VALUES ($1,'T26L','Ethiopia','PHASE_1','ETB','Africa/Addis_Ababa','en','ACTIVE',true,'AFROMESSAGE')`,
      [M],
    );
    /*
     * THE TEST-SCALE ROW. One day and two orders in the two columns the
     * ruling added; every other ladder column left NULL, exactly as
     * ADU-VAL-01 Group A leaves them -- so TRUSTED stays unreachable here
     * for the same reason it is unreachable in production, and the fixture
     * is not quietly a different ladder.
     */
    await admin.query(
      `INSERT INTO core.ladder_config (id, market_id,
         new_to_established_min_tenure, new_to_established_min_orders,
         new_level_product_cap, new_level_transaction_cap_minor)
       VALUES (gen_random_uuid(), $1, interval '1 day', 2, 10, NULL)`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251933260001',$3,'ACTIVE'), ($2,'+251933260002',$3,'ACTIVE')`,
      [OWNER, BUYER, M],
    );

    await ladderSeller(S_NEW, 't26l-new', 'NEW', '3 days', 1, '1');
    await ladderSeller(S_EST, 't26l-est', 'ESTABLISHED', '3 days', 2, '2');
    await ladderSeller(S_DUE, 't26l-due', 'NEW', '3 days', 2, '3');
  }, 60_000);

  afterAll(async () => {
    await h?.close();
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.seller_level_event WHERE seller_id IN ('${S_NEW}','${S_EST}','${S_DUE}')`,
      `DELETE FROM core.seller_level_state WHERE seller_id IN ('${S_NEW}','${S_EST}','${S_DUE}')`,
      `DELETE FROM core.reservation WHERE seller_id IN ('${S_NEW}','${S_EST}','${S_DUE}')`,
      `DELETE FROM core.order_state_transition WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core."order" WHERE market_id='${M}'`,
      `DELETE FROM core.product_variant WHERE seller_id IN ('${S_NEW}','${S_EST}','${S_DUE}')`,
      `DELETE FROM core.product WHERE market_id='${M}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id IN ('${S_NEW}','${S_EST}','${S_DUE}')`,
      `DELETE FROM core.seller WHERE market_id='${M}'`,
      `DELETE FROM core.account WHERE market_id='${M}'`,
      `DELETE FROM core.ladder_config WHERE market_id='${M}'`,
      `DELETE FROM core.market WHERE id='${M}'`,
      /*
       * THE SEED'S TRIO IS RESTORED, and the reason is worth stating.
       * `level.recompute` is a SWEEP: it selects every ACTIVE seller in the
       * database and recomputes each. There is no market parameter and there
       * should not be -- a nightly pass that skipped a market would be a
       * ladder that stopped for whoever it skipped. So running the real job
       * in a test touches every fixture present, and `seed-ladder-due` is
       * built to promote on exactly this event. It is put back so the next
       * reader of the seed finds what the seed's own summary describes.
       *
       * Sellers in markets with no ladder_config row are untouched by the
       * sweep: the function returns early on `IF NOT FOUND`, stamping only
       * computed_at. That is why the rest of the suite is unaffected.
       */
      `DELETE FROM core.seller_level_event WHERE seller_id IN ('${SEED_LADDER.join("','")}')`,
      `UPDATE core.seller_level_state
          SET level = CASE WHEN seller_id = '${SEED_LADDER[1]}'
                           THEN 'ESTABLISHED'::core.trust_level
                           ELSE 'NEW'::core.trust_level END,
              since = now() - interval '3 days'
        WHERE seller_id IN ('${SEED_LADDER.join("','")}')`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = origin`);
    await admin.end();
  }, 60_000);

  describe('the configuration is the real one, lowered', () => {
    it('reads the two ruled columns and leaves every deferred one NULL', async () => {
      const r = await admin.query<{
        tenure: string;
        orders: number;
        trusted_nulls: number;
      }>(
        `SELECT new_to_established_min_tenure::text AS tenure,
                new_to_established_min_orders AS orders,
                (CASE WHEN trusted_min_handoffs IS NULL THEN 1 ELSE 0 END +
                 CASE WHEN trusted_window IS NULL THEN 1 ELSE 0 END +
                 CASE WHEN trusted_min_scan_completion_rate IS NULL THEN 1 ELSE 0 END +
                 CASE WHEN trusted_max_claim_rate IS NULL THEN 1 ELSE 0 END) AS trusted_nulls
           FROM core.ladder_config WHERE market_id = $1`,
        [M],
      );
      expect(r.rows[0]).toMatchObject({ tenure: '1 day', orders: 2 });
      // All four TRUSTED thresholds absent, so TRUSTED is unreachable here
      // for the same reason it is unreachable in production.
      expect(r.rows[0]?.trusted_nulls).toBe(4);
    });
  });

  describe('the nightly job, run unchanged, promotes the seller that has earned it', () => {
    it('sweeps, and only the seller satisfying BOTH arms moves', async () => {
      expect((await levelOf(S_DUE)).level).toBe('NEW');

      const result = (await levelRecompute.run(h.ctx)) as {
        sellers: number;
        recomputed: number;
        failed: number;
      };
      expect(result.failed).toBe(0);
      expect(result.recomputed).toBe(result.sellers);

      // THE PROMOTION, decided by fn_recompute_seller_level and by nothing in
      // this file: tenure 3 days >= 1 day AND 2 completed orders >= 2.
      expect((await levelOf(S_DUE)).level).toBe('ESTABLISHED');

      // BOTH ARMS ARE REQUIRED, and this is the seller that shows it: same
      // tenure, one completed order instead of two, and it does not move.
      expect((await levelOf(S_NEW)).level).toBe('NEW');

      // A seller already there, still satisfying both arms, is left alone.
      expect((await levelOf(S_EST)).level).toBe('ESTABLISHED');
    }, 60_000);

    it('writes the level event and the evidence it decided on', async () => {
      expect(await events(S_DUE)).toEqual(['NEW->ESTABLISHED:COMPUTED']);
      expect(await events(S_NEW)).toEqual([]);

      const r = await admin.query<{ snapshot: Record<string, unknown> }>(
        `SELECT evidence_snapshot AS snapshot FROM core.seller_level_state
          WHERE seller_id = $1`,
        [S_DUE],
      );
      // The function records what it decided on, not what a test asserted.
      expect(r.rows[0]?.snapshot).toMatchObject({ completed_orders: 2 });
    });

    it('the promotion reaches the public stats row the storefront reads', async () => {
      const r = await admin.query<{ level: string }>(
        `SELECT level::text AS level FROM core.seller_public_stats WHERE seller_id = $1`,
        [S_DUE],
      );
      // Level flows to the public row from the EVENT (migration 0010), so
      // this is a second, independent witness that a real event was written.
      expect(r.rows[0]?.level).toBe('ESTABLISHED');
    });
  });

  /*
   * ------------------------------------------------------------------ D-358
   *
   * A CHARACTERIZATION TEST. What it asserts is a DEFECT, and it asserts it so
   * that the fix flips this expectation deliberately rather than silently.
   *
   * `fn_recompute_seller_level` measures tenure as `now() - seller_level_state.since`
   * and its UPDATE sets `since = now()` on EVERY level change. A promotion is
   * a level change. So the moment a seller reaches ESTABLISHED its tenure is
   * zero, the NEW->ESTABLISHED arm fails on the next sweep, the ELSE branch
   * targets NEW, and the seller is demoted -- one night after being promoted,
   * for as long as the ladder runs.
   *
   * At production scale that is a 61-day cycle in which a seller is
   * ESTABLISHED for exactly one nightly run. It is invisible today only
   * because D-328 means nobody ever reaches the promotion at all.
   *
   * 0028's column comment says "A demotion resets it, which is hysteresis" --
   * which is deliberate and right. The reset on PROMOTION is the part no
   * document asks for, and what tenure should mean after a level change is a
   * product question, so T26 registers it and changes no function.
   */
  describe('D-358 -- the run after a promotion demotes it again', () => {
    it('the second sweep sends the newly promoted seller back to NEW', async () => {
      expect((await levelOf(S_DUE)).level).toBe('ESTABLISHED');
      // Tenure was reset by the promotion itself; it is now seconds, not days.
      expect((await levelOf(S_DUE)).tenure_seconds).toBeLessThan(60);

      await levelRecompute.run(h.ctx);

      // PINNED, NOT ENDORSED. When D-358 is ruled on and fixed, this line
      // becomes 'ESTABLISHED' and this comment goes with it.
      expect((await levelOf(S_DUE)).level).toBe('NEW');
      expect(await events(S_DUE)).toEqual([
        'NEW->ESTABLISHED:COMPUTED',
        'ESTABLISHED->NEW:COMPUTED',
      ]);
    }, 60_000);

    it('the seller promoted long enough ago is stable across sweeps', async () => {
      // S_EST's `since` is three days old, which is what the seeded
      // ESTABLISHED store relies on: above the one-day threshold, so the
      // tenure arm holds and the sweep leaves it alone. Under the production
      // 60-day threshold the same row would be demoted, which is D-358 seen
      // from the other side.
      expect((await levelOf(S_EST)).level).toBe('ESTABLISHED');
      await levelRecompute.run(h.ctx);
      expect((await levelOf(S_EST)).level).toBe('ESTABLISHED');
      expect(await events(S_EST)).toEqual([]);
    }, 60_000);
  });
});
