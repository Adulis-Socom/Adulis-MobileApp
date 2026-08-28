import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createJobHarness, type Harness } from './jobs-harness';
import {
  orderExpireSweep,
  orderCloseConfirmationWindow,
  buyerCooldownDecay,
} from '../src/jobs/e1-clock';

/**
 * E1 — the clock, at both sides of every boundary.
 *
 * The clock is injected, so 23h59m and 24h01m are two lines apart rather
 * than a day apart. Every job runs TWICE against the same state and the
 * second run must change nothing — that is S24's idempotency invariant, and
 * it is asserted per job rather than assumed.
 */

const ADMIN = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];

const M = 'aaaae111-0000-4000-8000-000000000001';
const OWNER = 'aaaae111-0000-4000-8000-000000000002';
const BUYER = 'aaaae111-0000-4000-8000-000000000003';
const SELLER = 'aaaae111-0000-4000-8000-000000000004';
const PRODUCT = 'aaaae111-0000-4000-8000-000000000005';
const VARIANT = 'aaaae111-0000-4000-8000-000000000006';
const DEVICE = 'aaaae111-0000-4000-8000-000000000007';

/** The instant every fixture is anchored to; the clock moves, not the rows. */
const T0 = new Date('2026-06-01T09:00:00.000Z');

describe('E1 — the clock', () => {
  let admin: Pool;
  let h: Harness;

  const stock = async (variant: string): Promise<number> => {
    const r = await admin.query(`SELECT stock_count FROM core.product_variant WHERE id=$1`, [
      variant,
    ]);
    return r.rows[0].stock_count;
  };
  const orderState = async (id: string): Promise<string> => {
    const r = await admin.query(`SELECT state FROM core."order" WHERE id=$1`, [id]);
    return r.rows[0].state;
  };

  /**
   * An order with one ACTIVE reservation, at a chosen state and expiry.
   *
   * Each call mints its OWN variant: `reservation_no_duplicate_active` is an
   * exclusion constraint over (buyer, variant) while a reservation is live,
   * so a fixture that reuses one variant across flows collides on the
   * second order — the same per-flow isolation the C3/C4 suites needed.
   */
  const makeOrder = async (opts: {
    state: string;
    expiresAt: Date;
    clockStopped?: Date | null;
    qty?: number;
  }): Promise<{ id: string; variant: string }> => {
    const id = randomUUID();
    const resId = randomUUID();
    const variant = randomUUID();
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
         price_currency, variant_key) VALUES ($1,$2,$3,1000,'ETB',$4)`,
      [variant, PRODUCT, SELLER, 'v-' + variant.slice(0, 8)],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       VALUES (gen_random_uuid(),$1,$2,100,'SELLER_SET')`,
      [variant, SELLER],
    );
    await admin.query(`SET session_replication_role = replica`);
    await admin.query(
      `INSERT INTO core."order" (id, market_id, seller_id, buyer_account_id, state,
         total_minor, total_currency, display_currency, expires_at, clock_stopped_at)
       VALUES ($1,$2,$3,$4,$5::core.order_state,1000,'ETB','ETB',$6,$7)`,
      [id, M, SELLER, BUYER, opts.state, opts.expiresAt, opts.clockStopped ?? null],
    );
    await admin.query(
      `INSERT INTO core.reservation (id, order_id, seller_id, buyer_account_id, variant_id,
         quantity, unit_price_minor, unit_price_currency, state)
       VALUES ($1,$2,$3,$4,$5,$6,1000,'ETB','ACTIVE')`,
      [resId, id, SELLER, BUYER, variant, opts.qty ?? 1],
    );
    await admin.query(`SET session_replication_role = DEFAULT`);
    return { id, variant };
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN, max: 2 });
    await admin.query(
      `INSERT INTO core.market (id, code, display_name, phase, display_currency,
         display_timezone, default_locale, is_live)
       VALUES ($1,'E1T','ClockTest','PHASE_1','ETB','Africa/Addis_Ababa','en',false)`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.timing_config (id, market_id, reservation_window,
         payment_confirmation_window, fulfilment_window, offline_sync_horizon,
         payout_activation_delay, recovery_cooling_period,
         deleted_number_cooling_period, refund_ack_window, media_retention,
         level_credit_grace, mobile_session_lifetime, console_session_lifetime,
         console_idle_timeout, console_remembered_lifetime, console_remembered_idle,
         otp_ttl, otp_max_attempts, step_up_freshness, new_device_payout_lock,
         same_seller_cancellation_threshold, same_seller_cooldown,
         cross_seller_cooldown_ladder, cancellation_counter_decay, effective)
       VALUES (gen_random_uuid(), $1, '48 hours','24 hours','72 hours','7 days',
         '24 hours','7 days','30 days','48 hours','90 days','24 hours',
         '30 days','12 hours','30 minutes','7 days','8 hours','5 minutes',5,
         '5 minutes','24 hours',3,'1 hour',
         ARRAY['1 day','2 days','4 days']::interval[],'30 days',
         -- EXPLICIT, and not the now() default: the injected clock runs at
         -- T0, and a config that only becomes effective at real-wall-now is
         -- in force for no instant this suite ever asks about.
         tstzrange('2020-01-01T00:00:00Z','2030-01-01T00:00:00Z','[)'))`,
      [M],
    );
    await admin.query(
      `INSERT INTO core.account (id, phone_e164, market_id, status) VALUES
        ($1,'+251911991701',$3,'ACTIVE'), ($2,'+251911991702',$3,'ACTIVE')`,
      [OWNER, BUYER, M],
    );
    await admin.query(`INSERT INTO core.device (id, platform) VALUES ($1,'ANDROID')`, [DEVICE]);
    await admin.query(
      `INSERT INTO core.seller (id, market_id, owner_account_id, entity_type,
         store_name, handle, status)
       VALUES ($1,$2,$3,'INDIVIDUAL','E1 Store','e1-store','ACTIVE')`,
      [SELLER, M, OWNER],
    );
    await admin.query(
      `INSERT INTO core.seller_public_stats (seller_id) VALUES ($1)
       ON CONFLICT (seller_id) DO NOTHING`,
      [SELLER],
    );
    await admin.query(
      `INSERT INTO core.product (id, seller_id, market_id, name, base_price_minor,
         base_price_currency, visibility)
       VALUES ($1,$2,$3,'Clock',1000,'ETB','PUBLISHED')`,
      [PRODUCT, SELLER, M],
    );
    await admin.query(
      `INSERT INTO core.product_variant (id, product_id, seller_id, price_minor,
         price_currency, variant_key) VALUES ($1,$2,$3,1000,'ETB','one')`,
      [VARIANT, PRODUCT, SELLER],
    );
    await admin.query(
      `INSERT INTO core.stock_event (id, variant_id, seller_id, delta, reason)
       VALUES (gen_random_uuid(),$1,$2,100,'SELLER_SET')`,
      [VARIANT, SELLER],
    );
    h = createJobHarness(T0);
  });

  afterAll(async () => {
    await h.close();
    await admin.query(`SET session_replication_role = replica`);
    for (const q of [
      `DELETE FROM core.claim_evidence_item WHERE claim_id IN (SELECT id FROM core.claim WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}'))`,
      `DELETE FROM core.claim WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.stock_event WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.payment_submission WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.reservation WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.order_state_transition WHERE order_id IN (SELECT id FROM core."order" WHERE market_id='${M}')`,
      `DELETE FROM core.notification WHERE recipient_account_id IN ('${BUYER}','${OWNER}')`,
      `DELETE FROM core."order" WHERE market_id='${M}'`,
      `DELETE FROM core.buyer_cancellation_counter WHERE buyer_account_id='${BUYER}'`,
      `DELETE FROM core.seller_public_stats WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.product_variant WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.product WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_eligibility_evaluation WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller_level_state WHERE seller_id='${SELLER}'`,
      `DELETE FROM core.seller WHERE id='${SELLER}'`,
      `DELETE FROM core.device WHERE id='${DEVICE}'`,
      `DELETE FROM core.account WHERE market_id='${M}'`,
      `DELETE FROM core.timing_config WHERE market_id='${M}'`,
      `DELETE FROM core.market WHERE id='${M}'`,
    ]) {
      await admin.query(q);
    }
    await admin.query(`SET session_replication_role = DEFAULT`);
    await admin.end();
  });

  describe('order.expire_sweep (S24, S9.1)', () => {
    it('does nothing one second BEFORE the window closes, and expires one second after', async () => {
      const due = new Date(T0.getTime() + 60_000);
      const { id, variant } = await makeOrder({ state: 'CREATED', expiresAt: due });
      const before = await stock(variant);

      h.clock.set(new Date(due.getTime() - 1000));
      const early = await orderExpireSweep.run(h.ctx);
      expect(early['expired']).toBe(0);
      expect(await orderState(id)).toBe('CREATED');
      expect(await stock(variant)).toBe(before);

      h.clock.set(new Date(due.getTime() + 1000));
      const late = await orderExpireSweep.run(h.ctx);
      expect(late['expired']).toBe(1);
      expect(await orderState(id)).toBe('EXPIRED_UNCLAIMED');
      // The stock came back — the whole point of the sweep.
      expect(await stock(variant)).toBe(before + 1);
    });

    it('runs twice and the second run changes nothing (S24 idempotency)', async () => {
      const due = new Date(T0.getTime() + 120_000);
      const { variant } = await makeOrder({ state: 'NOTIFIED', expiresAt: due, qty: 3 });
      h.clock.set(new Date(due.getTime() + 1000));

      const first = await orderExpireSweep.run(h.ctx);
      const afterFirst = await stock(variant);
      expect(first['expired']).toBe(1);

      const second = await orderExpireSweep.run(h.ctx);
      expect(second['expired']).toBe(0);
      expect(second['considered']).toBe(0);
      // The release happened exactly once: a double release is the failure
      // stock_release_once exists to make impossible.
      expect(await stock(variant)).toBe(afterFirst);
    });

    it('never touches an order whose clock is stopped, at any age', async () => {
      // PAYMENT_CONFIRMED is where a stopped clock is legal (the
      // order_clock_consistency CHECK pairs the two), and it is the real
      // case: a paid order must not expire because a courier is slow.
      const { id } = await makeOrder({
        state: 'PAYMENT_CONFIRMED',
        expiresAt: new Date(T0.getTime() - 86_400_000),
        clockStopped: T0,
      });
      h.clock.set(new Date(T0.getTime() + 30 * 86_400_000));
      await orderExpireSweep.run(h.ctx);
      expect(await orderState(id)).toBe('PAYMENT_CONFIRMED');
    });

    it('a PAYMENT_SUBMITTED order NEVER expires, however old (R8prime, S12.4a)', async () => {
      const { id } = await makeOrder({
        state: 'PAYMENT_SUBMITTED',
        expiresAt: new Date(T0.getTime() - 86_400_000),
      });
      h.clock.set(new Date(T0.getTime() + 30 * 86_400_000));
      // The sweep is GLOBAL — it is one worker over every market — so its
      // counters belong to the whole database and a suite must assert on
      // its OWN row. That this order did not move is the invariant; how
      // many other rows the sweep touched is not this test's business.
      await orderExpireSweep.run(h.ctx);
      expect(await orderState(id)).toBe('PAYMENT_SUBMITTED');
      // And the reservation is still ACTIVE: stock stays held.
      const res = await admin.query(
        `SELECT state FROM core.reservation WHERE order_id=$1`,
        [id],
      );
      expect(res.rows[0].state).toBe('ACTIVE');
    });
  });

  describe('order.close_confirmation_window — the two branches (T4 S1.1)', () => {
    it('24h seller silence: no cancellation, stock HELD, SYSTEM claim, miss counted', async () => {
      const submittedAt = new Date(T0.getTime() + 200_000);
      const { id, variant } = await makeOrder({
        state: 'PAYMENT_SUBMITTED',
        expiresAt: new Date(submittedAt.getTime() + 86_400_000),
      });
      // The window is measured from the transition INTO PAYMENT_SUBMITTED.
      await admin.query(`SET session_replication_role = replica`);
      await admin.query(
        `INSERT INTO core.order_state_transition (order_id, from_state, to_state, occurred_at)
         VALUES ($1,'NOTIFIED','PAYMENT_SUBMITTED',$2)`,
        [id, submittedAt],
      );
      await admin.query(`SET session_replication_role = DEFAULT`);
      const stockBefore = await stock(variant);
      const missBefore = (
        await admin.query(
          `SELECT missed_confirmation_windows AS n FROM core.seller_public_stats WHERE seller_id=$1`,
          [SELLER],
        )
      ).rows[0].n;

      // One second short of 24 hours: nothing.
      h.clock.set(new Date(submittedAt.getTime() + 86_400_000 - 1000));
      const early = await orderCloseConfirmationWindow.run(h.ctx);
      expect(early['confirmation_window_lapsed']).toBe(0);
      expect(
        (await admin.query(`SELECT count(*)::int AS n FROM core.claim WHERE order_id=$1`, [id]))
          .rows[0].n,
      ).toBe(0);

      // One second past: the claim opens and nothing else moves.
      h.clock.set(new Date(submittedAt.getTime() + 86_400_000 + 1000));
      const late = await orderCloseConfirmationWindow.run(h.ctx);
      expect(late['confirmation_window_lapsed']).toBe(1);

      expect(await orderState(id)).toBe('PAYMENT_SUBMITTED');
      expect(await stock(variant)).toBe(stockBefore);
      const res = await admin.query(`SELECT state FROM core.reservation WHERE order_id=$1`, [id]);
      expect(res.rows[0].state).toBe('ACTIVE');
      const claim = await admin.query(
        `SELECT opened_by_kind, trigger, state FROM core.claim WHERE order_id=$1`,
        [id],
      );
      expect(claim.rows[0]).toMatchObject({
        opened_by_kind: 'SYSTEM',
        trigger: 'SLA_BREACH',
      });
      const missAfter = (
        await admin.query(
          `SELECT missed_confirmation_windows AS n FROM core.seller_public_stats WHERE seller_id=$1`,
          [SELLER],
        )
      ).rows[0].n;
      expect(missAfter).toBe(missBefore + 1);

      // Twice: still exactly one claim (one-open-claim-per-scope is the guard).
      await orderCloseConfirmationWindow.run(h.ctx);
      expect(
        (await admin.query(`SELECT count(*)::int AS n FROM core.claim WHERE order_id=$1`, [id]))
          .rows[0].n,
      ).toBe(1);
    });

    it('12h buyer silence after a rejection: cancels, releases stock, NO claim', async () => {
      const retryDeadline = new Date(T0.getTime() + 300_000);
      const { id, variant } = await makeOrder({
        state: 'NOTIFIED',
        expiresAt: retryDeadline,
        qty: 2,
      });
      await admin.query(`SET session_replication_role = replica`);
      await admin.query(
        `INSERT INTO core.payment_submission (id, order_id, evidence_ref, state, decided_at)
         VALUES (gen_random_uuid(), $1, gen_random_uuid(), 'REJECTED', $2)`,
        [id, T0],
      );
      await admin.query(`SET session_replication_role = DEFAULT`);
      const before = await stock(variant);

      h.clock.set(new Date(retryDeadline.getTime() - 1000));
      expect((await orderCloseConfirmationWindow.run(h.ctx))['retry_window_closed']).toBe(0);
      expect(await orderState(id)).toBe('NOTIFIED');

      h.clock.set(new Date(retryDeadline.getTime() + 1000));
      const r = await orderCloseConfirmationWindow.run(h.ctx);
      expect(r['retry_window_closed']).toBe(1);
      expect(await orderState(id)).toBe('EXPIRED_UNCLAIMED');
      expect(await stock(variant)).toBe(before + 2);
      // Nobody performed, so nobody has a claim.
      expect(
        (await admin.query(`SELECT count(*)::int AS n FROM core.claim WHERE order_id=$1`, [id]))
          .rows[0].n,
      ).toBe(0);

      // Idempotent, and the expire sweep seeing the same row is a no-op too.
      const again = await orderCloseConfirmationWindow.run(h.ctx);
      expect(again['retry_window_closed']).toBe(0);
      const sweep = await orderExpireSweep.run(h.ctx);
      expect(sweep['expired']).toBe(0);
      expect(await stock(variant)).toBe(before + 2);
    });
  });

  describe('buyer_cooldown.decay (S9.5)', () => {
    it('removes a counter only after the configured decay, and is idempotent', async () => {
      await admin.query(
        `INSERT INTO core.buyer_cancellation_counter (id, buyer_account_id, seller_id, count, window_start)
         VALUES (gen_random_uuid(), $1, $2, 2, $3)`,
        [BUYER, SELLER, T0],
      );
      // 29 days: the streak stands.
      h.clock.set(new Date(T0.getTime() + 29 * 86_400_000));
      expect((await buyerCooldownDecay.run(h.ctx))['decayed']).toBe(0);
      expect(
        (
          await admin.query(
            `SELECT count(*)::int AS n FROM core.buyer_cancellation_counter WHERE buyer_account_id=$1`,
            [BUYER],
          )
        ).rows[0].n,
      ).toBe(1);

      // 31 days: clean, so the row goes — absence and zero mean the same
      // thing to fn_assert_no_cooldown, and one representation cannot drift.
      h.clock.set(new Date(T0.getTime() + 31 * 86_400_000));
      expect((await buyerCooldownDecay.run(h.ctx))['decayed']).toBe(1);
      expect((await buyerCooldownDecay.run(h.ctx))['decayed']).toBe(0);
    });
  });
});
