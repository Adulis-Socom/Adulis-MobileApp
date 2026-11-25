import { hostname } from 'node:os';
import { Queue, Worker } from 'bullmq';
import type { Logger } from 'pino';
import { loadEnv, workerEnvSchema, type WorkerEnv } from './config/env';
import { createDb, createPool } from './db/client';
import { assertReplacementTarget, TargetRefused } from './db/target-guard';
import { EventRegistry, PRODUCTION_CONSUMERS, PRODUCTION_EVENTS } from './events/registry';
import { createLogger, errorFields } from './platform/logging';
import { assertQueuePolicy, QueuePolicyRefused, queueProducerConnection, queueWorkerConnection } from './platform/valkey';
import { EventConsumerRunner } from './worker/consumer';
import { queueHealth } from './worker/health';
import { OutboxReconciler } from './worker/reconcile';
import { EVENTS_QUEUE, OutboxRelay } from './worker/relay';

/** A repeating task that never overlaps itself and can be stopped between iterations. */
export function repeat(task: () => Promise<void>, intervalMs: number): { stop(): Promise<void> } {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> = Promise.resolve();
  const tick = (): void => {
    running = task().finally(() => {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    });
  };
  tick();
  return {
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await running;
    },
  };
}

/**
 * The WORKER process (ARC-BE-04): same codebase as the API, separate entry point, no HTTP listener.
 * Startup refuses a wrong database target, a superuser role, or an evicting queue Valkey. SIGTERM stops
 * claiming, lets in-flight jobs finish, closes BullMQ/Valkey and PostgreSQL, then exits (DEPLOY-01 S29).
 */
export async function startWorker(env: WorkerEnv, log: Logger): Promise<{ shutdown(): Promise<void> }> {
  const pool = createPool(env.DATABASE_URL, 'adulis-worker', env.WORKER_CONCURRENCY + 2);
  pool.on('error', (err) => log.error({ ...errorFields(err, true) }, 'idle database client error'));
  await assertReplacementTarget(pool, env.DATABASE_URL, { stage: 'runtime', expectedRole: 'adulis_worker' });
  const db = createDb(pool);

  const producer = queueProducerConnection(env.QUEUE_VALKEY_URL, log);
  await producer.connect();
  await assertQueuePolicy(producer);
  const queue = new Queue(EVENTS_QUEUE, { connection: producer });
  // Without a listener an 'error' event would crash the process whenever Valkey drops; events stay durable anyway.
  queue.on('error', (err) => log.warn({ queue: EVENTS_QUEUE, ...errorFields(err, true) }, 'queue connection error'));
  const registry = new EventRegistry(PRODUCTION_EVENTS, PRODUCTION_CONSUMERS);
  const runner = new EventConsumerRunner(db, registry, log);
  const workerConnection = queueWorkerConnection(env.QUEUE_VALKEY_URL, log);
  const worker = new Worker(EVENTS_QUEUE, (job) => runner.process(job), { connection: workerConnection, concurrency: env.WORKER_CONCURRENCY });
  worker.on('error', (err) => log.error({ queue: EVENTS_QUEUE, ...errorFields(err, true) }, 'worker error'));
  // A job can fail without process() running (stalled past BullMQ's limit): make sure it still leaves a dead letter.
  worker.on('failed', (job) => {
    if (!job) return;
    void job
      .isFailed()
      .then((final) => (final ? runner.recordFinalFailure(job) : undefined))
      .catch((err: unknown) => log.error({ queue: EVENTS_QUEUE, jobId: job.id, ...errorFields(err, true) }, 'final-failure handling failed; the reconciler will see the delivery'));
  });

  const relay = new OutboxRelay(db, queue, registry, { owner: `${hostname()}:${process.pid}`, batchSize: env.RELAY_BATCH_SIZE, leaseMs: env.RELAY_LEASE_MS }, log);
  const relayLoop = repeat(async () => {
    try {
      const r = await relay.runOnce();
      if (r.claimed > 0) log.info({ count: r.claimed, outcome: `${r.dispatched} dispatched` }, 'relay pass');
    } catch (err) {
      log.error({ ...errorFields(err, true) }, 'relay pass failed; events remain durable');
    }
  }, env.RELAY_INTERVAL_MS);
  const reconciler = new OutboxReconciler(
    db,
    queue,
    registry,
    { batchSize: env.RECONCILE_BATCH_SIZE, staleMs: env.RECONCILE_STALE_MS, maxRematerializations: env.RECONCILE_MAX_ATTEMPTS },
    log,
  );
  const reconcileLoop = repeat(async () => {
    try {
      const repairs = await reconciler.runOnce();
      const touched = Object.values(repairs).reduce((a, b) => a + b, 0);
      if (touched > repairs.PRESENT) log.info({ queue: EVENTS_QUEUE, repairs }, 'reconcile pass');
    } catch (err) {
      log.error({ ...errorFields(err, true) }, 'reconcile pass failed; deliveries remain durable');
    }
  }, env.RECONCILE_INTERVAL_MS);
  const healthLoop = repeat(async () => {
    try {
      const h = await queueHealth(db, queue);
      const level = h.unresolvedDeadLetters > 0 || h.staleDeliveries > 0 || h.oldestUndispatchedSeconds > 60 ? 'warn' : 'info';
      log[level]({ queue: EVENTS_QUEUE, ...h }, 'queue health');
    } catch (err) {
      log.warn({ ...errorFields(err, true) }, 'queue health unavailable');
    }
  }, env.HEALTH_LOG_INTERVAL_MS);
  log.info({ queue: EVENTS_QUEUE }, 'worker ready');

  return {
    async shutdown() {
      await relayLoop.stop();
      await reconcileLoop.stop();
      await healthLoop.stop();
      await worker.close(); // waits for active jobs; claims nothing new
      await queue.close();
      producer.disconnect();
      workerConnection.disconnect();
      await pool.end();
    },
  };
}

if (require.main === module) {
  let log: Logger | undefined;
  (async () => {
    const env = loadEnv(workerEnvSchema);
    const logger = createLogger({ service: 'adulis-worker', level: env.LOG_LEVEL, release: env.RELEASE });
    log = logger;
    const handle = await startWorker(env, logger);
    const stop = (): void => {
      setTimeout(() => process.exit(1), env.SHUTDOWN_GRACE_MS).unref();
      handle.shutdown().then(
        () => process.exit(0),
        (err: unknown) => {
          logger.error({ ...errorFields(err, true) }, 'shutdown failed');
          process.exit(1);
        },
      );
    };
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
  })().catch((err: unknown) => {
    if (log) log.fatal({ ...errorFields(err, true) }, err instanceof TargetRefused || err instanceof QueuePolicyRefused ? err.message : 'worker cannot start');
    else process.stderr.write(`worker cannot start: ${err instanceof Error ? err.message : 'unknown'}\n`);
    process.exit(1);
  });
}
