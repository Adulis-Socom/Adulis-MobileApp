import { UnrecoverableError } from 'bullmq';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import { SYSTEM_CONTEXT, withRequestContext, type Db } from '../db/client';
import { asyncDeadLetter, eventDelivery, eventOutbox, FAILURE_CLASSES, processedEvent, UNFINISHED_STATES } from '../db/schema';
import { jobEnvelopeSchema, type JobEnvelope } from '../events/envelope';
import type { ConsumerDefinition, EventRegistry, StoredEvent } from '../events/registry';
import { errorFields } from '../platform/logging';
import { jobIdFor, RELAY_SERVICE_REF } from './relay';

export type FailureClass = (typeof FAILURE_CLASSES)[number];

/** A handler's typed failure (EVT-01 S20). Permanent classes are not retried. */
export class ConsumerError extends Error {
  override readonly name = 'ConsumerError';
  constructor(
    readonly failureClass: FailureClass,
    readonly fingerprint: string,
    readonly effectMayHaveHappened = false,
  ) {
    super(failureClass);
  }
}

const PERMANENT: ReadonlySet<FailureClass> = new Set(['PERMANENT_VALIDATION', 'POISON_PAYLOAD', 'SECURITY_FAILURE', 'UNSUPPORTED_VERSION']);

/** The subset of a BullMQ Job the runner reads, so tests can drive it without Valkey. */
export interface JobLike {
  /** The physical BullMQ job id; checked against the durable delivery when present. */
  readonly id?: string | undefined;
  readonly data: unknown;
  readonly attemptsMade: number;
  readonly opts: { readonly attempts?: number };
}

/** TERMINAL: the delivery is already DEAD_LETTERED; a stray job never reopens it (replay is an operator action, S22). */
export type Outcome = 'SUCCEEDED' | 'SKIPPED' | 'DUPLICATE' | 'TERMINAL';

/** The durable delivery a job was verified against. Only a verified failure may be attributed to a delivery. */
interface VerifiedDelivery {
  readonly jobId: string;
  readonly eventId: string;
  readonly consumer: string;
}

/**
 * Queue metadata is never authority (founder ruling, 01_FOUNDER_RULINGS): a job must be exactly what the relay
 * would build from the durable records. Returns the refusal fingerprint, or null when it is.
 */
export function deliveryMismatch(
  env: JobEnvelope,
  physicalJobId: string | undefined,
  event: StoredEvent,
  delivery: { readonly jobId: string } | undefined,
  consumer: ConsumerDefinition,
): string | null {
  if (!delivery) return 'delivery-missing';
  const expected = jobIdFor(consumer.name, event.eventId);
  if (delivery.jobId !== expected || env.logical_job_id !== expected || (physicalJobId !== undefined && physicalJobId !== expected)) return 'job-identity-mismatch';
  const actor = env.actor_context;
  if (
    (env.market_id ?? null) !== event.marketId ||
    env.aggregate_type !== event.aggregateType ||
    env.aggregate_id !== event.aggregateId ||
    env.correlation_id !== event.correlationId ||
    env.causation_id !== event.eventId ||
    actor.actor_type !== 'SYSTEM' ||
    actor.trusted_service_ref !== RELAY_SERVICE_REF ||
    Object.keys(env.payload).length > 0
  ) {
    return 'context-mismatch';
  }
  return null;
}

/**
 * At-least-once in, exactly-once effect out (EVT-01 S18). Before any effect the job is verified against durable
 * state: the event exists, its consumer is registered at this job version, the event type and version match,
 * the event_delivery row exists, and the job's identity and context equal what the relay derives from them. The
 * processed-event marker is then INSERTED FIRST in the same transaction as the handler's effect: a concurrent
 * duplicate blocks on the locked delivery row and then sees the marker; a rollback removes both. Final failures
 * become an application dead letter (S22). A job that fails verification is QUARANTINED under its own id: it can
 * never mark, overwrite or dead-letter another delivery.
 */
export class EventConsumerRunner {
  constructor(
    private readonly db: Db,
    private readonly registry: EventRegistry,
    private readonly log: Logger,
  ) {}

  async process(job: JobLike): Promise<Outcome> {
    const parsed = jobEnvelopeSchema.safeParse(job.data);
    const eventId = parsed.success ? parsed.data.source_event_id : undefined;
    if (!parsed.success || eventId === undefined) return this.refuse(job, undefined, new ConsumerError('POISON_PAYLOAD', 'envelope-invalid'));
    const env = parsed.data;
    const consumer = this.registry.consumer(env.job_type);
    if (!consumer || consumer.jobVersion !== env.job_version) {
      return this.refuse(job, consumer?.name, new ConsumerError('UNSUPPORTED_VERSION', 'consumer-version-unsupported'));
    }

    let verified: VerifiedDelivery | null = null;
    try {
      const outcome = await withRequestContext(this.db, SYSTEM_CONTEXT, async (tx): Promise<Outcome> => {
        // Existence first: the marker's foreign key would otherwise turn a missing event into endless retries.
        const [event] = await tx.select().from(eventOutbox).where(eq(eventOutbox.eventId, eventId));
        if (!event) throw new ConsumerError('PERMANENT_VALIDATION', 'event-missing');
        if (event.eventType !== consumer.eventType || event.eventVersion !== consumer.eventVersion) throw new ConsumerError('UNSUPPORTED_VERSION', 'event-mismatch');
        const pk = and(eq(eventDelivery.eventId, eventId), eq(eventDelivery.consumer, consumer.name));
        // Locked: serialises a duplicate, and the reconciler's dead-letter decision, behind this effect.
        const [delivery] = await tx.select().from(eventDelivery).where(pk).for('update');
        const mismatch = deliveryMismatch(env, job.id, event, delivery, consumer);
        if (mismatch !== null || !delivery) throw new ConsumerError('SECURITY_FAILURE', mismatch ?? 'delivery-missing');
        verified = { jobId: delivery.jobId, eventId, consumer: consumer.name };
        if (delivery.state === 'DEAD_LETTERED') return 'TERMINAL';
        const marked = await tx.insert(processedEvent).values({ consumer: consumer.name, eventId }).onConflictDoNothing().returning({ eventId: processedEvent.eventId });
        if (marked.length === 0) return 'DUPLICATE';
        const result = await consumer.handle(tx, event);
        await tx.update(eventDelivery).set({ state: result, updatedAt: sql`now()` }).where(pk);
        return result;
      });
      this.log.info({ consumer: consumer.name, outcome, attempt: job.attemptsMade + 1 }, 'job processed');
      return outcome;
    } catch (err) {
      const permanent = err instanceof ConsumerError && PERMANENT.has(err.failureClass);
      const final = permanent || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      this.log.warn({ consumer: consumer.name, attempt: job.attemptsMade + 1, outcome: final ? 'dead-lettered' : 'retrying', ...errorFields(err, true) }, 'job failed');
      if (final) await this.deadLetter(job, verified, err, 'update', consumer.name);
      if (permanent) throw new UnrecoverableError((err as ConsumerError).failureClass);
      // BullMQ keeps the thrown message in Valkey: rethrow a class name only, never the original text.
      throw new Error(err instanceof Error ? err.name : 'Error');
    }
  }

  /**
   * Fallback for failures that never reached process() (a job BullMQ failed after stalling, for example). The job
   * is attributed to a delivery only if it verifies against durable state, exactly as process() requires; keeps
   * an existing dead letter, because process() already wrote the precise class.
   */
  async recordFinalFailure(job: JobLike): Promise<void> {
    const parsed = jobEnvelopeSchema.safeParse(job.data);
    let target: VerifiedDelivery | null = null;
    try {
      if (parsed.success && job.id !== undefined) target = await this.verifyByJobId(job.id, parsed.data);
    } catch (err) {
      this.log.error({ ...errorFields(err, true) }, 'failed job could not be verified; quarantined');
    }
    const label = parsed.success ? this.registry.consumer(parsed.data.job_type)?.name : undefined;
    await this.deadLetter(job, target, new ConsumerError('TRANSIENT', 'failed-outside-processor'), 'keep', label);
  }

  private async verifyByJobId(jobId: string, env: JobEnvelope): Promise<VerifiedDelivery | null> {
    return withRequestContext(this.db, SYSTEM_CONTEXT, async (tx) => {
      const [delivery] = await tx.select().from(eventDelivery).where(eq(eventDelivery.jobId, jobId));
      const consumer = delivery ? this.registry.consumer(delivery.consumer) : undefined;
      if (!delivery || !consumer || consumer.name !== env.job_type || consumer.jobVersion !== env.job_version || env.source_event_id !== delivery.eventId) return null;
      const [event] = await tx.select().from(eventOutbox).where(eq(eventOutbox.eventId, delivery.eventId));
      if (!event || deliveryMismatch(env, jobId, event, delivery, consumer) !== null) return null;
      return { jobId: delivery.jobId, eventId: delivery.eventId, consumer: consumer.name };
    });
  }

  private async refuse(job: JobLike, consumer: string | undefined, err: ConsumerError): Promise<never> {
    this.log.warn({ consumer: consumer ?? 'unverified', outcome: 'quarantined', errorCode: err.fingerprint }, 'job refused');
    await this.deadLetter(job, null, err, 'update', consumer);
    throw new UnrecoverableError(err.failureClass);
  }

  private async deadLetter(job: JobLike, target: VerifiedDelivery | null, err: unknown, onConflict: 'update' | 'keep', label: string | undefined): Promise<void> {
    const failureClass: FailureClass = err instanceof ConsumerError ? err.failureClass : 'TRANSIENT';
    const name = err instanceof Error ? err.name : 'unknown';
    const fingerprint = (err instanceof ConsumerError ? err.fingerprint : name).slice(0, 200);
    const consumer = target?.consumer ?? label ?? 'unverified';
    // Never a payload, message body or error message: names and classes only (S22). An unverified job is recorded
    // under quarantine.<physical id>, so it cannot collide with, or overwrite, any real delivery's dead letter.
    const row = {
      logicalJobId: target?.jobId ?? `quarantine.${job.id ?? 'no-id'}`.slice(0, 200),
      sourceEventId: target?.eventId ?? null,
      consumer,
      failureClass,
      failureFingerprint: fingerprint,
      sanitizedSummary: `${consumer} exhausted with ${failureClass} (${name})`.slice(0, 500),
      attemptCount: job.attemptsMade + 1,
      effectMayHaveHappened: err instanceof ConsumerError ? err.effectMayHaveHappened : false,
    };
    try {
      await withRequestContext(this.db, SYSTEM_CONTEXT, async (tx) => {
        const insert = tx.insert(asyncDeadLetter).values(row);
        const written =
          onConflict === 'keep'
            ? await insert.onConflictDoNothing({ target: asyncDeadLetter.logicalJobId }).returning({ id: asyncDeadLetter.deadLetterId })
            : await insert
                .onConflictDoUpdate({
                  target: asyncDeadLetter.logicalJobId,
                  set: { failureClass, failureFingerprint: fingerprint, sanitizedSummary: row.sanitizedSummary, attemptCount: row.attemptCount, effectMayHaveHappened: row.effectMayHaveHappened, updatedAt: sql`now()` },
                })
                .returning({ id: asyncDeadLetter.deadLetterId });
        if (written.length > 0 && target !== null) {
          // Only an unfinished delivery becomes DEAD_LETTERED: a terminal one is never reopened or relabelled.
          await tx
            .update(eventDelivery)
            .set({ state: 'DEAD_LETTERED', updatedAt: sql`now()` })
            .where(and(eq(eventDelivery.eventId, target.eventId), eq(eventDelivery.consumer, target.consumer), inArray(eventDelivery.state, [...UNFINISHED_STATES])));
        }
      });
    } catch (writeErr) {
      // The job still fails visibly in BullMQ's failed set; this line makes the missing dead letter visible too.
      this.log.error({ consumer, ...errorFields(writeErr, true) }, 'dead letter could not be written');
    }
  }
}
