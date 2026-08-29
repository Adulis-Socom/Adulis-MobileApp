import { createLogger } from './common/logging';
import { assertNodeEnv } from './common/env';
import { startWorker, type WorkerHandle } from './jobs/runtime';

/**
 * Process 2 of 2 — the job runner (ADU-CON-02 v3.0 section 1).
 *
 * "The worker is the same codebase started differently." Two processes so a
 * heavy job can never make a seller's click slow, and — since T4 — two
 * ROLES: the worker connects as `adulis_jobs`, which holds a different and
 * narrower set of privileges than the API's `adulis_app`.
 *
 * Twenty jobs (ADU-DB-01 S24) plus the heartbeat (ADU-CON-02 S20.2).
 *
 * Shutdown is explicit and ordered: stop accepting work, let in-flight jobs
 * finish, then close the pool. A worker killed mid-job is safe by design —
 * every job is idempotent (S24) — but a clean stop means the next start has
 * nothing to redo.
 */
async function main(): Promise<void> {
  // Process 2 of 2 gets the same boundary as process 1: it constructs the
  // same adapters, so an unset NODE_ENV would take the same permissive
  // branches here (ADU-RUL-03 S1.2).
  const env = assertNodeEnv();
  const log = createLogger();
  log.info({ msg: `worker: starting in ${env}` });
  let handle: WorkerHandle | null = null;

  const shutdown = (signal: string) => (): void => {
    log.info({ msg: `worker: ${signal} received, draining` });
    void (async () => {
      try {
        await handle?.stop();
        log.info({ msg: 'worker: drained, exiting' });
        process.exit(0);
      } catch (e) {
        log.error({ msg: 'worker: unclean shutdown', err: String(e) });
        process.exit(1);
      }
    })();
  };
  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));

  try {
    handle = await startWorker(log);
    log.info({ msg: 'worker: registered', jobs: handle.jobNames.join(',') });
  } catch (e) {
    // A worker that cannot start must EXIT, loudly. Idling would be the
    // worst outcome available: the process looks alive to an orchestrator,
    // the heartbeat never beats, and the only symptom is that nothing ever
    // expires.
    log.error({ msg: 'worker: failed to start', err: String(e) });
    process.exit(1);
  }
}

void main();
