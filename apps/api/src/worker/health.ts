import { sql } from 'drizzle-orm';
import type { Queue } from 'bullmq';
import { SYSTEM_CONTEXT, withRequestContext, type Db } from '../db/client';

export interface QueueHealth {
  readonly waiting: number;
  readonly active: number;
  readonly delayed: number;
  readonly failed: number;
  readonly undispatched: number;
  readonly oldestUndispatchedSeconds: number;
  readonly unresolvedDeadLetters: number;
  /** Deliveries not finished 10 minutes after their last change: a lost or stalled job (reconciliation is deferred). */
  readonly staleDeliveries: number;
}

/** Failure visibility (EVT-01 S33, DEPLOY-01 S51): queue depth, outbox age and unresolved dead letters. */
export async function queueHealth(db: Db, queue: Pick<Queue, 'getJobCounts'>): Promise<QueueHealth> {
  const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
  const [outbox, dead, stale] = await withRequestContext(db, SYSTEM_CONTEXT, async (tx) => [
    await tx.execute<{ n: number; oldest: number }>(sql`
      select count(*)::int as n, coalesce(extract(epoch from now() - min(recorded_at)), 0)::int as oldest
        from platform.event_outbox where dispatched_at is null`),
    await tx.execute<{ n: number; oldest: number }>(sql`select count(*)::int as n, 0 as oldest from platform.async_dead_letter where resolution_status = 'UNRESOLVED'`),
    await tx.execute<{ n: number; oldest: number }>(sql`
      select count(*)::int as n, 0 as oldest from platform.event_delivery
       where state in ('PENDING', 'ENQUEUE_UNKNOWN', 'QUEUED', 'PROCESSING') and updated_at < now() - interval '10 minutes'`),
  ] as const);
  return {
    waiting: counts['waiting'] ?? 0,
    active: counts['active'] ?? 0,
    delayed: counts['delayed'] ?? 0,
    failed: counts['failed'] ?? 0,
    undispatched: outbox.rows[0]?.n ?? 0,
    oldestUndispatchedSeconds: outbox.rows[0]?.oldest ?? 0,
    unresolvedDeadLetters: dead.rows[0]?.n ?? 0,
    staleDeliveries: stale.rows[0]?.n ?? 0,
  };
}
