import { randomUUID } from 'node:crypto';
import { UnrecoverableError } from 'bullmq';
import { and, eq, sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import { SYSTEM_CONTEXT, withRequestContext, type Db } from '../db/client';
import { asyncDeadLetter, eventDelivery, eventOutbox, FAILURE_CLASSES, processedEvent } from '../db/schema';
import { jobEnvelopeSchema } from '../events/envelope';
import type { EventRegistry } from '../events/registry';
import { errorFields } from '../platform/logging';

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
  readonly data: unknown;
  readonly attemptsMade: number;
  readonly opts: { readonly attempts?: number };
}

export type Outcome = 'SUCCEEDED' | 'SKIPPED' | 'DUPLICATE';

/**
 * At-least-once in, exactly-once effect out (EVT-01 S18). The processed-event marker is INSERTED FIRST in the
 * same transaction as the handler's effect: a concurrent duplicate blocks on the primary key and then sees
 * the conflict; a retry after commit sees it and does nothing; a rollback removes both. BullMQ's jobId dedup
 * is only an optimisation on top. Final failures become an application dead letter (S22).
 */
export class EventConsumerRunner {
  constructor(
    private readonly db: Db,
    private readonly registry: EventRegistry,
    private readonly log: Logger,
  ) {}

  async process(job: JobLike): Promise<Outcome> {
    const parsed = jobEnvelopeSchema.safeParse(job.data);
    if (!parsed.success || parsed.data.source_event_id === undefined) {
      await this.deadLetter(job, null, new ConsumerError('POISON_PAYLOAD', 'envelope-invalid'));
      throw new UnrecoverableError('POISON_PAYLOAD');
    }
    const env = parsed.data;
    const eventId = env.source_event_id as string;
    const consumer = this.registry.consumer(env.job_type);
    if (!consumer || consumer.jobVersion !== env.job_version) {
      await this.deadLetter(job, env, new ConsumerError('UNSUPPORTED_VERSION', `${env.job_type}@${env.job_version}`));
      throw new UnrecoverableError('UNSUPPORTED_VERSION');
    }

    try {
      const outcome = await withRequestContext(this.db, SYSTEM_CONTEXT, async (tx): Promise<Outcome> => {
        // Existence first: the marker's foreign key would otherwise turn a missing event into endless retries.
        const [event] = await tx.select().from(eventOutbox).where(eq(eventOutbox.eventId, eventId));
        if (!event) throw new ConsumerError('PERMANENT_VALIDATION', 'event-missing');
        if (event.eventType !== consumer.eventType || event.eventVersion !== consumer.eventVersion) throw new ConsumerError('PERMANENT_VALIDATION', 'event-mismatch');
        const marked = await tx.insert(processedEvent).values({ consumer: consumer.name, eventId }).onConflictDoNothing().returning({ eventId: processedEvent.eventId });
        if (marked.length === 0) return 'DUPLICATE';
        const result = await consumer.handle(tx, event);
        await tx
          .update(eventDelivery)
          .set({ state: result, updatedAt: sql`now()` })
          .where(and(eq(eventDelivery.eventId, eventId), eq(eventDelivery.consumer, consumer.name)));
        return result;
      });
      this.log.info({ consumer: consumer.name, outcome, attempt: job.attemptsMade + 1 }, 'job processed');
      return outcome;
    } catch (err) {
      const permanent = err instanceof ConsumerError && PERMANENT.has(err.failureClass);
      const final = permanent || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      this.log.warn({ consumer: consumer.name, attempt: job.attemptsMade + 1, outcome: final ? 'dead-lettered' : 'retrying', ...errorFields(err, true) }, 'job failed');
      if (final) await this.deadLetter(job, env, err);
      if (permanent) throw new UnrecoverableError((err as ConsumerError).failureClass);
      // BullMQ keeps the thrown message in Valkey: rethrow a class name only, never the original text.
      throw new Error(err instanceof Error ? err.name : 'Error');
    }
  }

  /**
   * Fallback for failures that never reached process() (a job BullMQ failed after stalling, for example). Keeps an
   * existing dead letter, because process() already wrote the precise class; only fills the gap when none exists.
   */
  async recordFinalFailure(job: JobLike): Promise<void> {
    const parsed = jobEnvelopeSchema.safeParse(job.data);
    await this.deadLetter(job, parsed.success ? parsed.data : null, new ConsumerError('TRANSIENT', 'failed-outside-processor'), 'keep');
  }

  private async deadLetter(
    job: JobLike,
    env: { logical_job_id: string; job_type: string; source_event_id?: string | undefined } | null,
    err: unknown,
    onConflict: 'update' | 'keep' = 'update',
  ): Promise<void> {
    const failureClass: FailureClass = err instanceof ConsumerError ? err.failureClass : 'TRANSIENT';
    const name = err instanceof Error ? err.name : 'unknown';
    const fingerprint = (err instanceof ConsumerError ? err.fingerprint : name).slice(0, 200);
    const consumer = env?.job_type ?? 'unknown';
    // Never a payload, message body or error message: names and classes only (S22).
    const row = {
      logicalJobId: (env?.logical_job_id ?? `invalid.${randomUUID()}`).slice(0, 200),
      // A missing event cannot be referenced (foreign key); the fingerprint records why it is absent.
      sourceEventId: err instanceof ConsumerError && err.fingerprint === 'event-missing' ? null : (env?.source_event_id ?? null),
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
        const sourceEventId = row.sourceEventId;
        if (written.length > 0 && sourceEventId !== null) {
          await tx
            .update(eventDelivery)
            .set({ state: 'DEAD_LETTERED', updatedAt: sql`now()` })
            .where(and(eq(eventDelivery.eventId, sourceEventId), eq(eventDelivery.consumer, consumer)));
        }
      });
    } catch (writeErr) {
      // The job still fails visibly in BullMQ's failed set; this line makes the missing dead letter visible too.
      this.log.error({ consumer, ...errorFields(writeErr, true) }, 'dead letter could not be written');
    }
  }
}
