import { sql } from 'kysely';
import type { Job, JobContext, JobResult } from './context';

/**
 * E5 — transport and ledger. Three purges that keep hot tables small, and
 * one assertion that is allowed to fail the job.
 */

export const idempotencyPurgeExpired: Job = {
  name: 'idempotency.purge_expired',
  cron: '10 * * * *',
  cadenceNote: 'S24: hourly. S12.8 — 24-hour records',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();
    // expires_at is written at record time, so the retention decision lives
    // in the row and this job only honours it. Deleting an EXPIRED record is
    // not a correctness risk: past its window a retry is a new request by
    // definition (S8), which is what the window means.
    const purged = await sql`
      DELETE FROM core.idempotency_record WHERE expires_at < ${at}`.execute(ctx.db);
    return { purged: Number(purged.numAffectedRows ?? 0) };
  },
};

export const rateLimitPurgeStale: Job = {
  name: 'rate_limit.purge_stale',
  cron: '20 * * * *',
  cadenceNote: 'S24: hourly. S12.9 — buckets older than the widest window',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();
    // "Older than the widest window" — the widest in the catalogue is
    // auth/recovery's 2-per-DAY (86400s). One day plus a margin, expressed
    // once here rather than derived per bucket_key: a bucket whose window
    // has closed can never be consulted again, because consultation floors
    // now() into the CURRENT window.
    const purged = await sql`
      DELETE FROM core.rate_limit_bucket
       WHERE window_start < ${at}::timestamptz - interval '2 days'`.execute(ctx.db);
    return { purged: Number(purged.numAffectedRows ?? 0) };
  },
};

export const ledgerAssertZero: Job = {
  name: 'ledger.assert_zero',
  cron: '35 * * * *',
  cadenceNote: 'S24: hourly (S23)',
  async run(ctx: JobContext): Promise<JobResult> {
    // S23: Adulis takes no custody, so every ADULIS:* balance is zero, in
    // every currency, always. This job exists to notice the hour that stops
    // being true.
    //
    // IT IS ALLOWED — REQUIRED — TO FAIL. A silent counter here would be
    // a job that watches money and shrugs; throwing is what makes the queue
    // record a failure and the weekly half-hour see it. Nothing is repaired
    // automatically, because an unbalanced ledger is a question, not a bug
    // with a known fix.
    const balances = await sql<{ currency: string; balance: string }>`
      SELECT currency, balance::text AS balance FROM ledger.v_adulis_balance`.execute(ctx.db);
    const nonZero = balances.rows.filter((r) => BigInt(r.balance ?? '0') !== 0n);
    if (nonZero.length > 0) {
      const detail = nonZero.map((r) => `${r.currency}=${r.balance}`).join(', ');
      ctx.log.error({ msg: 'LEDGER DOES NOT BALANCE', detail });
      throw new Error(
        `ledger.assert_zero: ADULIS balance is non-zero (${detail}). ` +
          'S23: Adulis holds no custody, so this is a money question, not a job failure to retry.',
      );
    }
    return { currencies_checked: balances.rows.length, all_zero: true };
  },
};

export const payoutActivateDue: Job = {
  name: 'payout.activate_due',
  cron: '*/5 * * * *',
  cadenceNote: 'ADU-AUTH-01 v2.8 S20.1: the delay must mean twenty-four hours',
  /**
   * THE JOB THAT MAKES THE INTERVAL MEAN WHAT IT SAYS (v2.8 S20.1).
   *
   * core.fn_activate_due_payout was invoked from exactly ONE place in the
   * product -- the GET on /v1/seller/payout -- and no job called it. A due
   * PENDING therefore stayed PENDING, and stayed CANCELLABLE, until somebody
   * opened the payout screen: the exposure was never twenty-four hours, it was
   * "until the seller next looks". This job is what gives the number its
   * meaning.
   *
   * AND SINCE T21 S1 IT IS THE ONLY THING THAT ACTIVATES. v2.7 S20.1 kept the
   * lazy path -- "it costs nothing and makes the screen correct at the moment
   * it is read" -- and the founder ruling in T21 S1 dropped it. A read that
   * writes was the defect, not the transaction it wrote in; against a
   * twenty-four hour delay the freshness it bought is imperceptible. The cost
   * is real and bounded and worth naming: a due PENDING can display as PENDING
   * for up to five minutes after activates_at, which is this job's period.
   * ADU-AUTH-01 v2.8 WITHDRAWS that sentence, so the document and this job now
   * agree and D-268's debt is discharged.
   *
   * [!] AND IT HAD NEVER RUN. v2.8 S20.1a: this job held EXECUTE on the
   * SECURITY DEFINER function and no SELECT on core.payout_details, which the
   * discovery query below reads DIRECTLY -- outside the per-seller try/catch,
   * so every tick died whole. Migration 0049 supplies the grant. The rule the
   * document draws from it governs every job in this file: a grant on a
   * function is not a grant on what the function reads, and a job is proven by
   * running it as its own role, never by reading the migration.
   *
   * PER-PAYOUT CONTAINMENT, and it is the requirement rather than a nicety.
   * The ownership-transfer activation had none: one raise would have fronted
   * its ORDER BY and stopped the sweep platform-wide, so one seller's bad row
   * halts every other seller's activation. Each seller is claimed and run
   * ALONE here, and a raise is logged and stepped over.
   *
   * ITS OWN TRANSACTION, NEVER LAZILY INSIDE A HANDLER'S -- D-74's lesson,
   * paid twice. The ownership activation ran at the top of a seller-scoped
   * handler transaction, the handler then failed, and the rollback took the
   * activation with it. `fn_activate_due_payout` HAD THE SAME SHAPE ON THE GET
   * PATH (getPayout ran it inside the handler's trx, so a later failure in that
   * read rolled back an activation it had just performed) -- D-74's twin,
   * present in 0022 since Tier 3, registered as D-255 and REMOVED in T21 S1.
   * THIS job was immune by construction from the day it was written: one
   * statement, one transaction, per seller, with nothing after it to fail. That
   * property is why it could be handed the whole job rather than half of it.
   */
  async run(ctx: JobContext): Promise<JobResult> {
    const due = await sql<{ seller_id: string }>`
      SELECT DISTINCT seller_id
        FROM core.payout_details
       WHERE state = 'PENDING' AND activates_at IS NOT NULL AND activates_at <= now()`
      .execute(ctx.db);

    let activated = 0;
    let raised = 0;
    for (const row of due.rows) {
      try {
        // One seller, one statement, its own implicit transaction.
        const r = await sql<{ fn_activate_due_payout: boolean }>`
          SELECT core.fn_activate_due_payout(${row.seller_id})`.execute(ctx.db);
        if (r.rows[0]?.fn_activate_due_payout) activated += 1;
      } catch (e) {
        // CONTAINED. A raise on one seller must not halt the sweep.
        raised += 1;
        ctx.log.error({
          msg: 'payout.activate_due failed for one seller',
          sellerId: row.seller_id,
          err: String(e),
        });
      }
    }
    return { due: due.rows.length, activated, raised };
  },
};

export const analyticsCreatePartition: Job = {
  name: 'analytics.create_partition',
  cron: '0 6 1 * *',
  cadenceNote: 'S24: monthly',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();
    // NEXT month, not this one: a partition created on the first of the
    // month it serves is a partition that did not exist for the events of
    // the preceding minute. Creating ahead means the DEFAULT partition
    // stays empty, which is what makes R19's future detach-and-export
    // possible at all.
    const next = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
    const monthAfter = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 2, 1));
    const created: string[] = [];
    for (const month of [next, monthAfter]) {
      const name = await sql<{ name: string }>`
        SELECT analytics.create_partition(${month.toISOString().slice(0, 10)}::date) AS name`.execute(
        ctx.db,
      );
      const value = name.rows[0]?.name;
      if (value) created.push(value);
    }
    // Idempotent inside the function (existence check, not exception
    // handling — a CREATE that raises inside a transaction poisons it).
    return { ensured: created.length, partitions: created.join(',') };
  },
};

/**
 * E5's contribution to the S24 transcription -- FOUR, and payoutActivateDue is
 * deliberately NOT among them. S24 does not name it: it comes from ADU-AUTH-01
 * v2.8 S20.1, so it is registered through registry.ts's RULED_JOBS instead.
 * Adding it here would have made the "exactly the twenty S24 names, and no
 * others" assertion a test that no longer transcribes anything.
 */
export const E5_JOBS: readonly Job[] = [
  idempotencyPurgeExpired,
  rateLimitPurgeStale,
  ledgerAssertZero,
  analyticsCreatePartition,
];
