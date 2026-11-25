import { UnrecoverableError } from 'bullmq';
import { and, eq, sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { Db } from '../db/client';
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
      const outcome = await this.db.transaction(async (tx): Promise<Outcome> => {
        const marked = await tx.insert(processedEvent).values({ consumer: consumer.name, eventId }).onConflictDoNothing().returning({ eventId: processedEvent.eventId });
        if (marked.length === 0) return 'DUPLICATE';
        const [event] = await tx.select().from(eventOutbox).where(eq(eventOutbox.eventId, eventId));
        if (!event || event.eventType !== consumer.eventType || event.eventVersion !== consumer.eventVersion) {
          throw new ConsumerError('PERMANENT_VALIDATION', 'event-mismatch');
        }
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
      throw err;
    }
  }

  private async deadLetter(job: JobLike, env: { logical_job_id: string; job_type: string; source_event_id?: string | undefined } | null, err: unknown): Promise<void> {
    const failureClass: FailureClass = err instanceof ConsumerError ? err.failureClass : 'TRANSIENT';
    const name = err instanceof Error ? err.name : 'unknown';
    const fingerprint = (err instanceof ConsumerError ? err.fingerprint : name).slice(0, 200);
    const consumer = env?.job_type ?? 'unknown';
    // Never a payload, message body or error message: names and classes only (S22).
    const row = {
      logicalJobId: (env?.logical_job_id ?? `invalid.${Date.now()}`).slice(0, 200),
      sourceEventId: env?.source_event_id ?? null,
      consumer,
      failureClass,
      failureFingerprint: fingerprint,
      sanitizedSummary: `${consumer} exhausted with ${failureClass} (${name})`.slice(0, 500),
      attemptCount: job.attemptsMade + 1,
      effectMayHaveHappened: err instanceof ConsumerError ? err.effectMayHaveHappened : false,
    };
    try {
      await this.db.transaction(async (tx) => {
        await tx
          .insert(asyncDeadLetter)
          .values(row)
          .onConflictDoUpdate({
            target: asyncDeadLetter.logicalJobId,
            set: { failureClass, failureFingerprint: fingerprint, sanitizedSummary: row.sanitizedSummary, attemptCount: row.attemptCount, effectMayHaveHappened: row.effectMayHaveHappened, updatedAt: sql`now()` },
          });
        if (env?.source_event_id) {
          await tx
            .update(eventDelivery)
            .set({ state: 'DEAD_LETTERED', updatedAt: sql`now()` })
            .where(and(eq(eventDelivery.eventId, env.source_event_id), eq(eventDelivery.consumer, consumer)));
        }
      });
    } catch (writeErr) {
      // The job still fails visibly in BullMQ's failed set; this line makes the missing dead letter visible too.
      this.log.error({ consumer, ...errorFields(writeErr, true) }, 'dead letter could not be written');
    }
  }
}
