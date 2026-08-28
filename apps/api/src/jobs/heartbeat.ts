import { sql } from 'kysely';
import type { Job, JobContext, JobResult } from './context';

/**
 * The worker heartbeat (ADU-CON-02 v3.0 S20.2) — the one job S24 does not
 * list, and the one that makes the other twenty observable.
 *
 * "A worker heartbeat row every 5 minutes; /healthz reddens when stale — a
 * dead worker is discovered by us, not by 48-hour-old unexpired orders."
 *
 * Written as an UPSERT onto a single constant-keyed row, so the table can
 * never accumulate one row per deploy: a heartbeat table with many rows is
 * a heartbeat that reads green because SOME worker beat recently.
 */

export const HEARTBEAT_STALE_AFTER_SECONDS = 900; // 3 missed beats

export function makeHeartbeatJob(workerId: string, jobCount: number): Job {
  return {
    name: 'worker.heartbeat',
    cron: '*/5 * * * *',
    cadenceNote: 'ADU-CON-02 S20.2: every 5 min; /healthz reddens when stale',
    async run(ctx: JobContext): Promise<JobResult> {
      const at = ctx.clock.now();
      await sql`
        INSERT INTO jobs.worker_heartbeat (id, beat_at, worker_id, jobs_registered)
        VALUES (true, ${at}, ${workerId}, ${jobCount})
        ON CONFLICT (id) DO UPDATE
           SET beat_at = EXCLUDED.beat_at,
               worker_id = EXCLUDED.worker_id,
               jobs_registered = EXCLUDED.jobs_registered`.execute(ctx.db);
      return { beat_at: at.toISOString(), worker_id: workerId, jobs_registered: jobCount };
    },
  };
}
