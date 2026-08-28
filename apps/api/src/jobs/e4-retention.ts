import { sql } from 'kysely';
import type { Job, JobContext, JobResult } from './context';

/**
 * E4 — retention. The four jobs that delete things, and the one line in the
 * whole job set that could not be undone if it were wrong.
 *
 * Every job here deletes an OBJECT before it deletes the ROW that points at
 * it. That order is the recoverable one: an orphaned object costs storage
 * and the next run cleans it, while a row pointing at a missing object is a
 * reader that 500s. No storage call happens inside a transaction.
 */

const BATCH = 200;

export const financialPurgePaymentEvidence: Job = {
  name: 'financial.purge_payment_evidence',
  cron: '25 * * * *',
  cadenceNote:
    'S24: hourly. Scoped to financial.payment_evidence BY NAME, never to the ' +
    'schema — payout credentials share it and must not be purged (S13.3)',
  async run(ctx: JobContext): Promise<JobResult> {
    // THE MOST DESTRUCTIVE LINE IN THE JOB SET, and the reason it does not
    // appear here at all.
    //
    // This job holds NO table privilege in `financial` — it cannot name
    // payout_credential even by accident, because it cannot name any table
    // in that schema. It calls two definer functions that each name
    // financial.payment_evidence literally, and the purge function
    // RE-EVALUATES the predicate (validated_at IS NOT NULL AND
    // retention_reason IS NULL) rather than trusting the ids handed to it,
    // so a claim opened between the list and the purge saves its evidence.
    const candidates = await sql<{ id: string; object_key: string }>`
      SELECT id, object_key FROM financial.list_purgeable_evidence(${BATCH})`.execute(ctx.db);
    if (candidates.rows.length === 0) return { candidates: 0, objects_deleted: 0, purged: 0 };

    let objectsDeleted = 0;
    const deletable: string[] = [];
    for (const row of candidates.rows) {
      try {
        // Object first (see the header): outside any transaction.
        await ctx.evidenceStorage.deleteObject(row.object_key);
        objectsDeleted += 1;
        deletable.push(row.id);
      } catch (e) {
        // The row stays; the next run retries. Never delete a row whose
        // object we failed to remove — that is how evidence becomes
        // unreachable but still billed for.
        ctx.log.error({ msg: 'evidence object delete failed', id: row.id, err: String(e) });
      }
    }
    const purged = deletable.length
      ? ((
          await sql<{ n: number }>`
            SELECT financial.purge_payment_evidence(${sql.val(deletable)}::uuid[]) AS n`.execute(
            ctx.db,
          )
        ).rows[0]?.n ?? 0)
      : 0;
    return { candidates: candidates.rows.length, objects_deleted: objectsDeleted, purged };
  },
};

export const mediaLifecycle: Job = {
  name: 'media.lifecycle',
  cron: '15 3 * * *',
  cadenceNote: 'S24: daily (S7.4)',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();
    // core.media_lifecycle rows are PURGE SCHEDULES, not living-media
    // records: purge_after is NOT NULL, and a row exists precisely because
    // something is due to go.
    const due = await sql<{ object_key: string }>`
      SELECT object_key FROM core.media_lifecycle
       WHERE purge_after < ${at}
       ORDER BY purge_after
       LIMIT ${BATCH}`.execute(ctx.db);

    let deleted = 0;
    for (const row of due.rows) {
      try {
        await ctx.mediaStorage.delete(row.object_key);
        // Row after object, and only for the object that actually went.
        await sql`
          DELETE FROM core.media_lifecycle WHERE object_key = ${row.object_key}`.execute(ctx.db);
        deleted += 1;
      } catch (e) {
        ctx.log.error({ msg: 'media purge failed', key: row.object_key, err: String(e) });
      }
    }
    return { due: due.rows.length, deleted };
  },
};

export const waitlistRetentionPurge: Job = {
  name: 'waitlist.retention_purge',
  cron: '45 3 * * *',
  cadenceNote: 'S24: daily. 12 months (S25)',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();
    // The retention decision is already IN THE ROW: purge_after is written
    // at signup (twelve months, S25). The job honours the stamp rather than
    // recomputing a period, so changing the policy changes new rows and
    // never retroactively destroys old ones.
    const purged = await sql`
      DELETE FROM waitlist.application WHERE purge_after < ${at}`.execute(ctx.db);
    return { purged: Number(purged.numAffectedRows ?? 0) };
  },
};

export const devicePurgeUnbound: Job = {
  name: 'device.purge_unbound',
  cron: '50 3 * * *',
  cadenceNote: 'S24: daily. C6 — unbound devices and their carts',
  async run(ctx: JobContext): Promise<JobResult> {
    const at = ctx.clock.now();
    // S11.5: "A device with no account_id and no activity beyond
    // timing_config.media_retention is deleted, TAKING ITS CARTS WITH IT. A
    // bound device is retained while the account is."
    //
    // The cart goes first — it references the device. A cart that ever
    // converted is anchored by an order, so only ACTIVE/ABANDONED carts of
    // unbound devices are reachable here at all.
    // A DEVICE IS NOT MARKET-SCOPED — core.device carries no market_id, by
    // design (it holds no personal data and is registered before any
    // identity exists). So "the retention period" is genuinely ambiguous
    // across markets, and the resolution is the LONGEST media_retention in
    // force anywhere: the only choice that cannot delete a device some
    // market still considers live. Registered for a ruling.
    const stale = await sql<{ id: string }>`
      SELECT d.id
        FROM core.device d
       WHERE d.account_id IS NULL
         AND d.last_seen_at < ${at}::timestamptz - (
           SELECT max(tc.media_retention) FROM core.timing_config tc
            WHERE tc.effective @> ${at}::timestamptz)
       LIMIT ${BATCH}`.execute(ctx.db);
    if (stale.rows.length === 0) return { stale: 0, devices_purged: 0, carts_purged: 0 };

    const ids = stale.rows.map((r) => r.id);
    return ctx.db.transaction().execute(async (trx) => {
      const lines = await sql`
        DELETE FROM core.cart_line
         WHERE cart_id IN (SELECT id FROM core.cart WHERE device_id = ANY(${sql.val(ids)}::uuid[]))`.execute(
        trx,
      );
      const carts = await sql`
        DELETE FROM core.cart WHERE device_id = ANY(${sql.val(ids)}::uuid[])`.execute(trx);
      // Any device that acquired an account or a cart between the read and
      // here is excluded again — the predicate is repeated, not trusted.
      const devices = await sql`
        DELETE FROM core.device d
         WHERE d.id = ANY(${sql.val(ids)}::uuid[])
           AND d.account_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM core.cart c WHERE c.device_id = d.id)`.execute(trx);
      return {
        stale: ids.length,
        devices_purged: Number(devices.numAffectedRows ?? 0),
        carts_purged: Number(carts.numAffectedRows ?? 0),
        cart_lines_purged: Number(lines.numAffectedRows ?? 0),
      };
    });
  },
};

export const E4_JOBS: readonly Job[] = [
  financialPurgePaymentEvidence,
  mediaLifecycle,
  waitlistRetentionPurge,
  devicePurgeUnbound,
];
