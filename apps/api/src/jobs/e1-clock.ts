import { sql, type Transaction } from 'kysely';
import type { Database } from '../common/db/database.types';
import type { Job, JobContext, JobResult } from './context';

/**
 * E1 — the clock. The three jobs that make a promise the product already
 * makes to a buyer true: the 48-hour reservation window, the 24-hour
 * confirmation window, and the 30-day cancellation decay.
 *
 * Until these ran, nothing expired. That is the largest functional gap T3
 * left, and it is the one a seller would have discovered for us.
 */

const EXPIRABLE = ['CREATED', 'NOTIFIED'] as const;

/**
 * Expire ONE order, terminally, releasing its stock. Shared by
 * `order.expire_sweep` and by the 12-hour retry branch of
 * `order.close_confirmation_window`, and that sharing is the point:
 *
 *   RULING (T4 S1.1) — when the 12h retry window after a first rejection
 *   ends, the order takes THE ORDINARY CANCELLATION PATH. Nobody performed
 *   and nobody lost anything. `fn_reject_payment` already expressed that
 *   window AS `expires_at` (0021), so the two jobs necessarily see the same
 *   row, and the correct answer to that overlap is one routine both call
 *   rather than two implementations that must agree.
 *
 * IDEMPOTENCY, twice over:
 *  - the compare-and-set `WHERE state = ANY(EXPIRABLE)` means a second run
 *    (or the other job) matches zero rows and does nothing;
 *  - `stock_release_once`, the partial unique index on
 *    (reservation_id, reason), is the backstop underneath it. A3.2 warns
 *    against blanket ON CONFLICT DO NOTHING here — that would silently not
 *    return stock on a multi-line order — so the guard is the state, and
 *    the index is what catches a bug rather than what implements the rule.
 */
async function expireOrder(
  trx: Transaction<Database>,
  orderId: string,
  at: Date,
): Promise<boolean> {
  // The state gate and the row lock in one statement. FOR UPDATE would need a
  // separate read; the UPDATE ... RETURNING is the lock.
  const moved = await sql<{ id: string }>`
    UPDATE core."order"
       SET state = 'EXPIRED_UNCLAIMED'
     WHERE id = ${orderId}
       AND state = ANY(${sql.val(EXPIRABLE as unknown as string[])}::core.order_state[])
       AND clock_stopped_at IS NULL
     RETURNING id`.execute(trx);
  if (!moved.rows[0]) return false;

  // Reservations follow the order. ACTIVE -> EXPIRED is the ratified row
  // ('order expires unclaimed'); anything already terminal is left alone.
  const lines = await sql<{ id: string; variant_id: string; seller_id: string; quantity: number }>`
    UPDATE core.reservation
       SET state = 'EXPIRED', cancelled_at = ${at}, cancelled_by = 'SYSTEM'
     WHERE order_id = ${orderId} AND state = 'ACTIVE'
     RETURNING id, variant_id, seller_id, quantity`.execute(trx);

  // One release event per line — the A3.2 anchor. Since T12 S1 (D-173) the
  // quantity, variant and seller all DERIVE FROM THE RESERVING EVENT via
  // fn_release_reservation_stock: a reservation with no ORDER_CREATED event
  // fails this order's expiry loudly instead of inventing stock, and the
  // per-order transaction keeps one bad order from blocking the sweep.
  for (const line of lines.rows) {
    await sql`
      SELECT core.fn_release_reservation_stock(
        ${line.id}, ${orderId}, 'ORDER_EXPIRED')`.execute(trx);
  }
  return true;
}

export const orderExpireSweep: Job = {
  name: 'order.expire_sweep',
  cron: '* * * * *',
  cadenceNote: 'S24: 1 min. Idempotent (S9.1); skips clock_stopped_at IS NOT NULL',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();
    // The working set is the partial index idx_order_expiry_sweep
    // (clock_stopped_at IS NULL) — Phase D measured 10k due against 1M rows
    // at 2.8ms, so the sweep reads its own set and never the table.
    const due = await sql<{ id: string }>`
      SELECT id FROM core."order"
       WHERE clock_stopped_at IS NULL
         AND expires_at < ${at}
         AND state = ANY(${sql.val(EXPIRABLE as unknown as string[])}::core.order_state[])
       ORDER BY expires_at
       LIMIT 500`.execute(ctx.db);

    let expired = 0;
    for (const row of due.rows) {
      // One transaction PER ORDER: a bad row must not take the batch with
      // it, and the batch must not hold one long transaction over 500 orders.
      await ctx.db.transaction().execute(async (trx) => {
        if (await expireOrder(trx, row.id, at)) expired += 1;
      });
    }
    return { considered: due.rows.length, expired };
  },
};

export const orderCloseConfirmationWindow: Job = {
  name: 'order.close_confirmation_window',
  cron: '* * * * *',
  cadenceNote:
    'S24: 1 min. TWO branches, ruled at T4 S1.1 — the 24h seller silence is ' +
    'S12.4a (no cancellation, stock held, SYSTEM claim); the 12h buyer ' +
    'silence after a rejection is ordinary expiry',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();

    // --- Branch A: the SELLER was silent for the 24h confirmation window.
    // S12.4a exactly: the order does NOT move, stock stays held, a SYSTEM
    // claim opens, the evidence is pinned against the purge (by the claim's
    // attach trigger) and the miss is counted. fn_confirmation_window_lapse
    // does all of it in one transaction and re-checks the window itself, so
    // this selection is a candidate list and not a decision.
    const submitted = await sql<{ id: string }>`
      SELECT o.id
        FROM core."order" o
       WHERE o.state = 'PAYMENT_SUBMITTED'
         AND EXISTS (
           SELECT 1 FROM core.order_state_transition t
             JOIN core.timing_config tc
               ON tc.market_id = o.market_id AND tc.effective @> ${at}::timestamptz
            WHERE t.order_id = o.id AND t.to_state = 'PAYMENT_SUBMITTED'
            GROUP BY tc.payment_confirmation_window
           HAVING max(t.occurred_at) + tc.payment_confirmation_window < ${at})
       LIMIT 500`.execute(ctx.db);

    let lapsed = 0;
    for (const row of submitted.rows) {
      await ctx.db.transaction().execute(async (trx) => {
        // The function is the authority; it returns silently when the window
        // has not in fact lapsed or a claim is already open (its own
        // idempotency), so a second run of this job changes nothing.
        await sql`SELECT core.fn_confirmation_window_lapse(${row.id})`.execute(trx);
      });
      lapsed += 1;
    }

    // --- Branch B: the BUYER was silent for the 12h retry window opened by a
    // first rejection. fn_reject_payment wrote that window as expires_at and
    // returned the order to NOTIFIED, so the row is indistinguishable from an
    // ordinary expiry — and is treated as exactly that, through the shared
    // routine. The expire sweep will also see it; whichever arrives first
    // wins the compare-and-set and the other is a no-op. That overlap is
    // safe BY CONSTRUCTION, and is why the 12h window still holds if either
    // job is disabled.
    const rejected = await sql<{ id: string }>`
      SELECT o.id
        FROM core."order" o
       WHERE o.state = 'NOTIFIED'
         AND o.clock_stopped_at IS NULL
         AND o.expires_at < ${at}
         AND EXISTS (SELECT 1 FROM core.payment_submission ps
                      WHERE ps.order_id = o.id AND ps.state = 'REJECTED')
       LIMIT 500`.execute(ctx.db);

    let retryWindowClosed = 0;
    for (const row of rejected.rows) {
      await ctx.db.transaction().execute(async (trx) => {
        if (await expireOrder(trx, row.id, at)) retryWindowClosed += 1;
      });
    }

    return {
      confirmation_window_candidates: submitted.rows.length,
      confirmation_window_lapsed: lapsed,
      retry_window_candidates: rejected.rows.length,
      retry_window_closed: retryWindowClosed,
    };
  },
};

export const buyerCooldownDecay: Job = {
  name: 'buyer_cooldown.decay',
  cron: '17 3 * * *',
  cadenceNote: 'S24: daily. 30-day decay (S9.5)',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();
    // S9.5's decay is "30 days of clean activity resets the streak". The
    // counter row IS the streak, so a decayed streak is a DELETED row:
    // fn_assert_no_cooldown reads absence and a zero identically, and one
    // representation cannot drift from the other.
    //
    // The window is per-market configuration, so the join is required — a
    // hardcoded 30 days here would be the value ADU-VAL-01 defers.
    const purged = await sql`
      DELETE FROM core.buyer_cancellation_counter c
       USING core.account a, core.timing_config tc
       WHERE a.id = c.buyer_account_id
         AND tc.market_id = a.market_id AND tc.effective @> ${at}::timestamptz
         AND c.window_start < ${at}::timestamptz - tc.cancellation_counter_decay`.execute(
      ctx.db,
    );
    return { decayed: Number(purged.numAffectedRows ?? 0) };
  },
};

export const E1_JOBS: readonly Job[] = [
  orderExpireSweep,
  orderCloseConfirmationWindow,
  buyerCooldownDecay,
];
