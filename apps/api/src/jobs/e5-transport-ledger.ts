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

export const E5_JOBS: readonly Job[] = [
  idempotencyPurgeExpired,
  rateLimitPurgeStale,
  ledgerAssertZero,
  analyticsCreatePartition,
];
