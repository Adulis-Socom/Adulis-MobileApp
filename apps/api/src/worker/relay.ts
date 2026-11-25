import { and, eq, inArray, sql } from 'drizzle-orm';
import type { JobsOptions, Queue } from 'bullmq';
import type { Logger } from 'pino';
import { SYSTEM_CONTEXT, withRequestContext, type Db, type Tx } from '../db/client';
import { eventDelivery, eventOutbox } from '../db/schema';
import type { JobEnvelope } from '../events/envelope';
import type { ConsumerDefinition, EventRegistry, StoredEvent } from '../events/registry';
import { errorFields } from '../platform/logging';

export const EVENTS_QUEUE = 'adulis-events';
/** Deterministic physical job identity (EVT-01 S12 step 4). BullMQ forbids ':' in custom ids. */
export const jobIdFor = (consumer: string, eventId: string): string => `${consumer}.${eventId}`;

/** The trusted service reference every event-derived job carries; the consumer refuses any other actor. */
export const RELAY_SERVICE_REF = 'adulis-worker.outbox-relay';

/**
 * The S15 envelope of an event-derived job. Business payload is EMPTY (founder ruling, 01_FOUNDER_RULINGS): the
 * consumer re-reads the fact from PostgreSQL. Market, aggregate and actor are routing/trace metadata, never
 * authority: the consumer checks each against the durable event before any effect. Relay and reconciler both
 * build jobs here, so a rematerialised job is identical to the original.
 */
export function eventJobEnvelope(event: StoredEvent, jobId: string, consumer: ConsumerDefinition): JobEnvelope {
  return {
    logical_job_id: jobId,
    job_type: consumer.name,
    job_version: consumer.jobVersion,
    ...(event.marketId ? { market_id: event.marketId } : {}),
    priority_class: consumer.priorityClass,
    criticality: consumer.criticality,
    correlation_id: event.correlationId,
    causation_id: event.eventId,
    source_event_id: event.eventId,
    aggregate_type: event.aggregateType,
    aggregate_id: event.aggregateId,
    actor_context: { actor_type: 'SYSTEM', trusted_service_ref: RELAY_SERVICE_REF },
    payload: {},
  };
}

/** BullMQ execution properties come from the registry, never from business truth (S15). */
export function jobOptionsFor(consumer: ConsumerDefinition, jobId: string): JobsOptions {
  return {
    jobId,
    attempts: consumer.attempts,
    backoff: { type: 'exponential', delay: 1_000 },
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 7 * 86_400 },
    stackTraceLimit: 0, // no stack (and so no error text) is kept in Valkey
  };
}

export interface RelayOptions {
  readonly owner: string;
  readonly batchSize: number;
  readonly leaseMs: number;
}

/**
 * The outbox relay (EVT-01 S12):
 *  1-3. claim a small batch of undispatched events under a short PostgreSQL lease and materialise one
 *       event_delivery row per registered consumer, then COMMIT (no Valkey call inside that transaction);
 *  4.   enqueue each open delivery with its deterministic jobId, marking it ENQUEUE_UNKNOWN first;
 *  5.   mark it QUEUED once BullMQ accepts;
 *  6.   a crash between 4 and 5 leaves ENQUEUE_UNKNOWN, and the lease expiry hands the event to the next
 *       relay pass, which re-enqueues under the same jobId; a job lost AFTER dispatch is the reconciler's
 *       (reconcile.ts, S23);
 *  7.   duplicate physical execution is safe because consumers commit a processed-event marker.
 * An event is marked dispatched only when every delivery is past enqueue. Valkey being down leaves events
 * undispatched and durable; nothing is lost and nothing is dual-written.
 */
export class OutboxRelay {
  constructor(
    private readonly db: Db,
    private readonly queue: Pick<Queue, 'add'>,
    private readonly registry: EventRegistry,
    private readonly opts: RelayOptions,
    private readonly log: Logger,
  ) {}

  /** Every relay database access runs in a transaction that sets the SYSTEM context first (root CLAUDE.md). */
  private sys<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return withRequestContext(this.db, SYSTEM_CONTEXT, fn);
  }

  async runOnce(): Promise<{ claimed: number; dispatched: number }> {
    const claimed = await this.claim();
    let dispatched = 0;
    for (const event of claimed) if (await this.publish(event)) dispatched += 1;
    return { claimed: claimed.length, dispatched };
  }

  private async claim(): Promise<StoredEvent[]> {
    return this.sys(async (tx) => {
      const leased = await tx
        .update(eventOutbox)
        .set({ relayOwner: this.opts.owner, leaseExpiresAt: sql`now() + make_interval(secs => ${this.opts.leaseMs / 1000})` })
        .where(
          sql`${eventOutbox.eventId} in (select event_id from platform.event_outbox
                where dispatched_at is null and (lease_expires_at is null or lease_expires_at < now())
                order by recorded_at limit ${this.opts.batchSize} for update skip locked)`,
        )
        .returning();
      for (const event of leased) {
        const consumers = this.registry.consumersOf(event.eventType, event.eventVersion);
        if (consumers.length === 0) continue;
        await tx
          .insert(eventDelivery)
          .values(consumers.map((c) => ({ eventId: event.eventId, consumer: c.name, jobId: jobIdFor(c.name, event.eventId) })))
          .onConflictDoNothing();
      }
      return leased;
    });
  }

  private async publish(event: StoredEvent): Promise<boolean> {
    const open = await this.sys((tx) =>
      tx
      .select()
      .from(eventDelivery)
      .where(and(eq(eventDelivery.eventId, event.eventId), inArray(eventDelivery.state, ['PENDING', 'ENQUEUE_UNKNOWN']))),
    );
    let allQueued = true;
    for (const delivery of open) {
      const consumer = this.registry.consumer(delivery.consumer);
      if (!consumer) {
        allQueued = false; // a consumer removed while deliveries were open: leave them visible, never drop them
        this.log.error({ consumer: delivery.consumer, eventType: event.eventType }, 'delivery for an unregistered consumer');
        continue;
      }
      const pk = and(eq(eventDelivery.eventId, delivery.eventId), eq(eventDelivery.consumer, delivery.consumer));
      await this.sys((tx) =>
        tx
        .update(eventDelivery)
        .set({ state: 'ENQUEUE_UNKNOWN', enqueueAttempts: sql`${eventDelivery.enqueueAttempts} + 1`, updatedAt: sql`now()` })
        .where(and(pk, inArray(eventDelivery.state, ['PENDING', 'ENQUEUE_UNKNOWN']))),
      );
      const envelope = eventJobEnvelope(event, delivery.jobId, consumer);
      try {
        await this.queue.add(consumer.name, envelope, jobOptionsFor(consumer, delivery.jobId));
      } catch (err) {
        allQueued = false;
        this.log.warn({ consumer: consumer.name, eventType: event.eventType, ...errorFields(err, true) }, 'enqueue failed; event stays durable for retry');
        await this.sys((tx) =>
          tx.update(eventDelivery).set({ lastErrorCode: 'ENQUEUE_FAILED', updatedAt: sql`now()` }).where(and(pk, inArray(eventDelivery.state, ['PENDING', 'ENQUEUE_UNKNOWN']))),
        );
        continue;
      }
      // Accepted by BullMQ. Only advance from ENQUEUE_UNKNOWN: the consumer may already have written SUCCEEDED.
      // If this write fails the pass fails, the delivery stays ENQUEUE_UNKNOWN, and the lease re-offers it.
      await this.sys((tx) =>
        tx.update(eventDelivery).set({ state: 'QUEUED', lastErrorCode: null, updatedAt: sql`now()` }).where(and(pk, eq(eventDelivery.state, 'ENQUEUE_UNKNOWN'))),
      );
    }
    if (!allQueued) return false;
    const done = await this.sys((tx) =>
      tx
      .update(eventOutbox)
      .set({ dispatchedAt: sql`now()`, relayOwner: null, leaseExpiresAt: null })
      .where(and(eq(eventOutbox.eventId, event.eventId), eq(eventOutbox.relayOwner, this.opts.owner), sql`${eventOutbox.dispatchedAt} is null`))
      .returning({ id: eventOutbox.eventId }),
    );
    return done.length === 1;
  }
}
