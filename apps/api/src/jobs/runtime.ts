import { hostname } from 'node:os';
import { S3ObjectStorage, resolveObjectStorageEnv } from '../common/adapters/s3-object-storage';
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import {
  parseCronItems,
  run,
  type CronItem,
  type Runner,
  type TaskList,
} from 'graphile-worker';
import type { Logger } from 'pino';
import type { Database } from '../common/db/database.types';
import type { Job, JobContext } from './context';
import { systemClock } from './clock';
import { SCHEDULED_JOBS } from './registry';
import { makeHeartbeatJob } from './heartbeat';
import { FakeFinancialStorageAdapter } from '../modules/financial/financial-storage.adapter';
import { FakeMediaStorageAdapter } from '../modules/catalogue/media-storage.adapter';
import { FakeSmsAdapter } from '../modules/auth/sms.adapter';
import { NullSocialPlatformAdapter } from '../modules/onboarding/social-platform.adapter';
import { NullPushAdapter } from './push.adapter';

/**
 * The worker runtime (ADU-CON-02 v3.0 S1): "the same codebase started
 * differently". graphile-worker in the `jobs` schema — Postgres is the sole
 * datastore, including the queue.
 *
 * Concurrency 10 (T4 S2.1). The pool is sized to match plus headroom for the
 * cron scheduler's own connection; ADU-CON-02 S17 budgets ~30 direct
 * connections across both processes, and this half is 12 of them.
 */

export const WORKER_CONCURRENCY = 10;
const WORKER_POOL_MAX = 12;

export interface WorkerHandle {
  readonly runner: Runner;
  readonly jobNames: readonly string[];
  stop(): Promise<void>;
}

/**
 * Build the context every job is handed. Adapters bind by environment; the
 * fakes refuse to construct under NODE_ENV=production (T4 S3.2), so a
 * worker started in production without real integrations does not boot —
 * which is the intended failure, because a worker that "runs" while sending
 * nothing is worse than one that will not start.
 */
export function createJobContext(log: Logger): { ctx: JobContext; close: () => Promise<void> } {
  const connectionString = process.env['DATABASE_URL_JOBS'];
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL_JOBS is not set. The worker connects as adulis_jobs, never as ' +
        'adulis_app: the two processes hold different privileges by design (T4 S1.2).',
    );
  }
  const pool = new Pool({ connectionString, max: WORKER_POOL_MAX });
  const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });

  const storageEnv = resolveObjectStorageEnv();
  const ctx: JobContext = {
    db,
    clock: systemClock,
    log,
    // Real storage when the six R2_* values are present (T20 S4) -- the
    // worker purges media.lifecycle keys, so it needs the same store the API
    // wrote to, or purges delete nothing while reporting success.
    evidenceStorage: storageEnv
      ? new S3ObjectStorage(storageEnv.evidence, 'worker FINANCIAL storage')
      : new FakeFinancialStorageAdapter(),
    mediaStorage: storageEnv
      ? new S3ObjectStorage(storageEnv.media, 'worker MEDIA storage')
      : new FakeMediaStorageAdapter(),
    sms: new FakeSmsAdapter(),
    push: new NullPushAdapter(),
    social: new NullSocialPlatformAdapter(),
  };
  return { ctx, close: () => db.destroy() };
}

/** One graphile-worker task per Job, wrapping the run with its own logging. */
function toTaskList(jobs: readonly Job[], ctx: JobContext, log: Logger): TaskList {
  const tasks: TaskList = {};
  for (const job of jobs) {
    tasks[job.name] = async () => {
      const startedAt = Date.now();
      try {
        const result = await job.run(ctx);
        log.info({ msg: 'job ok', job: job.name, ms: Date.now() - startedAt, ...result });
      } catch (e) {
        // Rethrow: graphile-worker records the failure and retries with
        // backoff. A job that swallows its own error is a job that is
        // reported healthy while doing nothing — the exact failure the
        // heartbeat exists to make visible for the whole process.
        log.error({ msg: 'job failed', job: job.name, ms: Date.now() - startedAt, err: String(e) });
        throw e;
      }
    };
  }
  return tasks;
}

function toCronItems(jobs: readonly Job[]): CronItem[] {
  return jobs
    .filter((j): j is Job & { cron: string } => j.cron !== null)
    .map((j) => ({
      task: j.name,
      match: j.cron,
      identifier: j.name,
      options: {
        // At-least-once is the queue's guarantee and every job is written
        // for it (S24). backfillPeriod 0: a worker that was down for an
        // hour does not wake up and run sixty expiry sweeps — the next
        // tick's sweep finds everything the missed ones would have.
        backfillPeriod: 0,
      },
      payload: {},
    }));
}

export async function startWorker(log: Logger): Promise<WorkerHandle> {
  const { ctx, close } = createJobContext(log);
  const workerId = `${hostname()}:${process.pid}`;
  // The count the heartbeat publishes is what this worker SCHEDULES, not the
  // size of the S24 transcription. They were the same number until T20 added a
  // job from another document, and a heartbeat that reports twenty while
  // twenty-one are scheduled answers "is this worker running the full set?"
  // with a number that cannot detect the one failure it is watched for.
  const heartbeat = makeHeartbeatJob(workerId, SCHEDULED_JOBS.length);
  const jobs = [...SCHEDULED_JOBS, heartbeat];

  const runner = await run({
    connectionString: process.env['DATABASE_URL_JOBS'] as string,
    schema: 'jobs',
    concurrency: WORKER_CONCURRENCY,
    // The process owns its own signal handling (below), so the runner must
    // not also install handlers and race us to the exit.
    noHandleSignals: true,
    taskList: toTaskList(jobs, ctx, log),
    // parseCronItems is the documented conversion; hand-building
    // ParsedCronItem is explicitly unsafe per the library's own typings.
    parsedCronItems: parseCronItems(toCronItems(jobs)),
  });

  log.info({
    msg: 'worker started',
    worker_id: workerId,
    jobs: jobs.length,
    concurrency: WORKER_CONCURRENCY,
  });

  return {
    runner,
    jobNames: jobs.map((j) => j.name),
    stop: async () => {
      await runner.stop();
      await close();
    },
  };
}

/**
 * Exported for the runtime test: the cron items for the SCHEDULED jobs.
 *
 * Not quite "the schedule the runner is given" as this comment used to claim
 * -- the heartbeat's cron is built inside startWorker, because it needs the
 * worker's identity and cannot be constructed without a live process.
 */
export function cronItemsForTest(): CronItem[] {
  return toCronItems(SCHEDULED_JOBS);
}
