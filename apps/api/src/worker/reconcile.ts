import type { Queue } from 'bullmq';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import { SYSTEM_CONTEXT, withRequestContext, type Db, type Tx } from '../db/client';
import { asyncDeadLetter, eventDelivery, eventOutbox, processedEvent, UNFINISHED_STATES, type FAILURE_CLASSES } from '../db/schema';
import type { ConsumerDefinition, EventRegistry } from '../events/registry';
import { errorFields } from '../platform/logging';
import { eventJobEnvelope, jobOptionsFor } from './relay';

export const REPAIR_OUTCOMES = [
  'PRESENT', // the physical job is alive (waiting, active, delayed for retry): left alone
  'ACK_RECOVERED', // alive, but PostgreSQL never recorded QUEUED: recorded now
  'REMATERIALIZED', // lost from Valkey: re-added under the same deterministic jobId
  'ALREADY_PROCESSED', // a processed-event marker proves the effect: delivery closed as SUCCEEDED
  'SETTLED', // the delivery became terminal while this pass looked at it: nothing to do
  'DEAD_LETTERED', // cannot be repaired automatically: typed dead letter for an operator
  'QUEUE_UNAVAILABLE', // Valkey unreachable: retried on a later pass
  'UNREGISTERED', // no registered consumer: left visible, never dropped
] as const;
export type RepairOutcome = (typeof REPAIR_OUTCOMES)[number];

export interface ReconcileOptions {
  readonly batchSize: number;
  /** A delivery is examined only after this long without change, so a relay mid-publish is never raced. */
  readonly staleMs: number;
  /** Rematerialisations per delivery before it becomes a dead letter. */
  readonly maxRematerializations: number;
}

type Delivery = typeof eventDelivery.$inferSelect;
type DeliveryState = Delivery['state'];
type FailureClass = (typeof FAILURE_CLASSES)[number];

/** BullMQ states in which a job is legitimately alive. Such a job is never recreated or disturbed. */
const LIVE: ReadonlySet<string> = new Set(['waiting', 'active', 'delayed', 'prioritized', 'waiting-children']);
const isUnfinished = (s: string): boolean => (UNFINISHED_STATES as readonly string[]).includes(s);
const pk = (d: Delivery) => and(eq(eventDelivery.eventId, d.eventId), eq(eventDelivery.consumer, d.consumer));

/**
 * reconcile_outbox (EVT-01 S23). PostgreSQL is the authority: event_outbox + event_delivery + processed_event and
 * the consumer registry decide; Valkey is only asked whether the physical job still exists. Repairs a job lost
 * after dispatch (eviction, flush, failover), an acknowledgement the relay never recorded, and a finished job whose
 * outcome never reached PostgreSQL. Never re-enqueues a terminal delivery, never touches a live job, never runs a
 * handler itself; the consumer's processed-event marker keeps any duplicate physical job harmless.
 * Stale relay leases need no reconciler: the relay's claim already re-offers an expired lease (S12).
 */
export class OutboxReconciler {
  constructor(
    private readonly db: Db,
    private readonly queue: Pick<Queue, 'add' | 'getJob'>,
    private readonly registry: EventRegistry,
    private readonly opts: ReconcileOptions,
    private readonly log: Logger,
  ) {}

  private sys<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return withRequestContext(this.db, SYSTEM_CONTEXT, fn);
  }

  async runOnce(): Promise<Record<RepairOutcome, number>> {
    const tally = Object.fromEntries(REPAIR_OUTCOMES.map((o) => [o, 0])) as Record<RepairOutcome, number>;
    for (const d of await this.claim()) tally[await this.repair(d)] += 1;
    return tally;
  }

  /**
   * A bounded batch of stale unfinished deliveries of DISPATCHED events (an undispatched event's deliveries are
   * the relay's, under its lease). reconcile_checked_at is the reconciler's lease: a concurrent reconciler skips the
   * locked rows, then finds them recently checked. Looking never touches updated_at, so the staleDeliveries gauge
   * keeps counting a delivery that stays stuck (a hung but lock-renewing job is PRESENT on every pass).
   */
  private claim(): Promise<Delivery[]> {
    return this.sys((tx) =>
      tx
        .update(eventDelivery)
        .set({ reconcileCheckedAt: sql`now()` })
        .where(
          sql`(${eventDelivery.eventId}, ${eventDelivery.consumer}) in (
            select d.event_id, d.consumer from platform.event_delivery d
              join platform.event_outbox e on e.event_id = d.event_id
             where d.state in ('PENDING', 'ENQUEUE_UNKNOWN', 'QUEUED', 'PROCESSING') and e.dispatched_at is not null
               and d.updated_at < now() - make_interval(secs => ${this.opts.staleMs / 1000})
               and (d.reconcile_checked_at is null or d.reconcile_checked_at < now() - make_interval(secs => ${this.opts.staleMs / 1000}))
             order by d.updated_at limit ${this.opts.batchSize}
               for update of d skip locked)`,
        )
        .returning(),
    );
  }

  private async repair(d: Delivery): Promise<RepairOutcome> {
    const consumer = this.registry.consumer(d.consumer);
    if (!consumer) {
      this.log.error({ consumer: d.consumer }, 'stale delivery for an unregistered consumer');
      return 'UNREGISTERED';
    }
    // A committed marker proves the effect (S13: SUCCEEDED is "applied or proven already applied").
    if (await this.sys((tx) => this.marked(tx, d))) return (await this.transition(d, { state: 'SUCCEEDED' })) ? 'ALREADY_PROCESSED' : 'SETTLED';

    let jobState: string;
    try {
      const job = await this.queue.getJob(d.jobId);
      jobState = job ? await job.getState() : 'missing';
    } catch (err) {
      this.log.warn({ consumer: d.consumer, ...errorFields(err, true) }, 'reconcile: queue unavailable; delivery stays durable');
      return 'QUEUE_UNAVAILABLE';
    }
    if (LIVE.has(jobState)) {
      if (d.state === 'PENDING' || d.state === 'ENQUEUE_UNKNOWN') {
        return (await this.transition(d, { state: 'QUEUED', lastErrorCode: null }, ['PENDING', 'ENQUEUE_UNKNOWN'])) ? 'ACK_RECOVERED' : 'SETTLED';
      }
      return 'PRESENT';
    }
    if (jobState !== 'missing') {
      // Completed or failed with no durable outcome (re-running blindly could repeat a lost decision), or 'unknown':
      // the job hash exists in no list, and add() under that id would be a silent no-op, not a repair.
      return this.deadLetter(d, 'STATE_CONFLICT', `reconcile-${jobState}-without-outcome`);
    }
    if (d.reconcileAttempts >= this.opts.maxRematerializations) return this.deadLetter(d, 'DEPENDENCY_UNAVAILABLE', 'reconcile-exhausted');
    return this.rematerialize(d, consumer);
  }

  private async rematerialize(d: Delivery, consumer: ConsumerDefinition): Promise<RepairOutcome> {
    const event = await this.sys(async (tx) => {
      // The attempt is counted BEFORE the network call, so even a crash right after add() uses it up: bounded.
      const counted = await tx
        .update(eventDelivery)
        .set({
          state: 'ENQUEUE_UNKNOWN',
          reconcileAttempts: sql`${eventDelivery.reconcileAttempts} + 1`,
          enqueueAttempts: sql`${eventDelivery.enqueueAttempts} + 1`,
          updatedAt: sql`now()`,
        })
        .where(and(pk(d), inArray(eventDelivery.state, [...UNFINISHED_STATES])))
        .returning({ eventId: eventDelivery.eventId });
      if (counted.length === 0) return undefined;
      const [row] = await tx.select().from(eventOutbox).where(eq(eventOutbox.eventId, d.eventId));
      return row;
    });
    if (!event) return 'SETTLED';
    try {
      await this.queue.add(consumer.name, eventJobEnvelope(event, d.jobId, consumer), jobOptionsFor(consumer, d.jobId));
    } catch (err) {
      this.log.warn({ consumer: d.consumer, ...errorFields(err, true) }, 'reconcile: re-enqueue failed; delivery stays durable');
      // A refused add() is not a lost job: give the attempt back, so a Valkey write outage (noeviction OOM) cannot use
      // up the budget. If Valkey did accept it after all, the next pass finds the job alive and leaves it alone.
      await this.sys((tx) =>
        tx
          .update(eventDelivery)
          .set({ lastErrorCode: 'ENQUEUE_FAILED', reconcileAttempts: sql`greatest(${eventDelivery.reconcileAttempts} - 1, 0)`, updatedAt: sql`now()` })
          .where(and(pk(d), inArray(eventDelivery.state, [...UNFINISHED_STATES]))),
      );
      return 'QUEUE_UNAVAILABLE';
    }
    await this.transition(d, { state: 'QUEUED', lastErrorCode: null }, ['ENQUEUE_UNKNOWN']);
    return 'REMATERIALIZED';
  }

  /** Moves an unfinished delivery; false when it had already moved on. Never reopens a terminal one. */
  private async transition(
    d: Delivery,
    set: { state: DeliveryState; lastErrorCode?: string | null },
    from: readonly DeliveryState[] = UNFINISHED_STATES,
  ): Promise<boolean> {
    const moved = await this.sys((tx) =>
      tx
        .update(eventDelivery)
        .set({ ...set, updatedAt: sql`now()` })
        .where(and(pk(d), inArray(eventDelivery.state, [...from])))
        .returning({ eventId: eventDelivery.eventId }),
    );
    return moved.length === 1;
  }

  private async marked(tx: Tx, d: Delivery): Promise<boolean> {
    const rows = await tx
      .select({ eventId: processedEvent.eventId })
      .from(processedEvent)
      .where(and(eq(processedEvent.consumer, d.consumer), eq(processedEvent.eventId, d.eventId)));
    return rows.length > 0;
  }

  private deadLetter(d: Delivery, failureClass: FailureClass, fingerprint: string): Promise<RepairOutcome> {
    return this.sys(async (tx): Promise<RepairOutcome> => {
      // Lock and re-read: the consumer may have committed since the scan. The consumer holds the same row lock
      // while it writes its effect, so the two decisions serialise.
      const [current] = await tx.select({ state: eventDelivery.state }).from(eventDelivery).where(pk(d)).for('update');
      if (!current || !isUnfinished(current.state)) return 'SETTLED';
      if (await this.marked(tx, d)) {
        await tx.update(eventDelivery).set({ state: 'SUCCEEDED', updatedAt: sql`now()` }).where(pk(d));
        return 'ALREADY_PROCESSED';
      }
      await tx
        .insert(asyncDeadLetter)
        .values({
          logicalJobId: d.jobId,
          sourceEventId: d.eventId,
          consumer: d.consumer,
          failureClass,
          failureFingerprint: fingerprint,
          sanitizedSummary: `${d.consumer} reconciliation stopped with ${failureClass} (${fingerprint})`.slice(0, 500),
          attemptCount: Math.max(1, d.reconcileAttempts),
          effectMayHaveHappened: false, // no marker: the effect and the marker commit together or not at all
        })
        .onConflictDoNothing({ target: asyncDeadLetter.logicalJobId });
      await tx.update(eventDelivery).set({ state: 'DEAD_LETTERED', lastErrorCode: fingerprint.slice(0, 100), updatedAt: sql`now()` }).where(pk(d));
      this.log.warn({ consumer: d.consumer, outcome: fingerprint }, 'reconcile: delivery dead-lettered');
      return 'DEAD_LETTERED';
    });
  }
}
