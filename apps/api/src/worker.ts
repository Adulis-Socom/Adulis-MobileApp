import { createLogger } from './common/logging';

/**
 * Process 2 of 2 — the job runner (ADU-CON-02 v3.0 section 1).
 *
 * "The worker is the same codebase started differently." Two processes so a
 * heavy job can never make a seller's click slow.
 *
 * TIER 0 — no jobs are registered, and graphile-worker is not started. The 21
 * jobs of ADU-DB-01 section 24 plus v3.0's two additions
 * (`analytics.retire_partitions`, R19; the worker heartbeat, section 20.1) all
 * need the `jobs` schema from migration 14 — Tier 2 at the earliest. Starting a
 * worker against a database with no `graphile_worker` schema would fail loudly
 * and mean nothing, so it idles instead.
 */
function main(): void {
  const log = createLogger();
  console.log('worker: no jobs registered pre-Tier-1');
  log.info({ msg: 'worker: no jobs registered pre-Tier-1' });

  // Idle cleanly: hold the process open so a container running this does not
  // restart-loop, and exit on the signals an orchestrator actually sends.
  const keepAlive = setInterval(() => {}, 60_000);
  const shutdown = (signal: string) => () => {
    clearInterval(keepAlive);
    log.info({ msg: `worker: ${signal} received, exiting` });
    process.exit(0);
  };
  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));
}

main();
