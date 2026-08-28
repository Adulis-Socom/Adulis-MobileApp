import { Controller, Get, Res, HttpStatus, Inject } from '@nestjs/common';
import type { Response } from 'express';
import { Kysely, sql } from 'kysely';
import { pingDatabase } from './common/db/database';
import { APP_DATABASE } from './common/db/database.module';
import type { Database } from './common/db/database.types';
import { HEARTBEAT_STALE_AFTER_SECONDS } from './jobs/heartbeat';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  worker: 'up' | 'stale' | 'never_started';
  worker_last_beat_at?: string | null;
}

/**
 * ADU-CON-02 v3.0 sections 15, 18 and 20.2.
 *
 * `db` is a real SELECT 1, not a cached flag: section 20.2 puts an uptime
 * ping on this endpoint so a database the API cannot reach pages a human,
 * and section 18's Render topology names /healthz as the API health check,
 * so a 503 here is what stops a bad instance taking traffic.
 *
 * `worker` is the section 20.2 heartbeat, live since T4. "A worker heartbeat
 * row every 5 minutes; /healthz reddens when stale — A DEAD WORKER IS
 * DISCOVERED BY US, NOT BY 48-HOUR-OLD UNEXPIRED ORDERS." That sentence is
 * the whole reason this check exists: the worker holds the reservation
 * clock, and its silence has no other symptom until a seller notices.
 *
 * DECIDED (T4, register E-5) — A STALE WORKER REDDENS THE BODY, NOT THE
 * STATUS CODE. Sections 20.2 and 18 give this one endpoint two jobs that
 * conflict exactly here: 20.2 wants it to go red when the worker dies, and
 * 18 makes a 503 the signal that "stops a bad instance taking traffic". A
 * 503 for a dead WORKER would pull every healthy API instance out of
 * rotation and turn "orders stop expiring" into "the storefront is down" —
 * a strictly worse outcome, and one caused by the monitoring rather than the
 * fault. So the status code answers only "can this instance serve?", and
 * `status: "degraded"` with `worker: "stale"` is what the uptime check
 * alarms on. Recorded for ADU-CON-02's next reissue.
 */
@Controller()
export class HealthController {
  constructor(@Inject(APP_DATABASE) private readonly db: Kysely<Database>) {}

  @Get('/healthz')
  async healthz(@Res() res: Response): Promise<void> {
    const up = await pingDatabase(this.db);
    if (!up) {
      const down: HealthResponse = { status: 'degraded', db: 'down', worker: 'never_started' };
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json(down);
      return;
    }

    let worker: HealthResponse['worker'] = 'never_started';
    let lastBeat: string | null = null;
    try {
      const beat = await sql<{ beat_at: Date; stale: boolean }>`
        SELECT beat_at,
               now() > beat_at + make_interval(secs => ${HEARTBEAT_STALE_AFTER_SECONDS}) AS stale
          FROM jobs.worker_heartbeat`.execute(this.db);
      const row = beat.rows[0];
      if (row) {
        lastBeat = row.beat_at.toISOString();
        worker = row.stale ? 'stale' : 'up';
      }
    } catch {
      // A readable database with an unreadable heartbeat is still a
      // degraded system, and saying so is better than pretending the
      // worker is fine — but it must not be reported as a DB outage.
      worker = 'never_started';
    }

    const body: HealthResponse = {
      status: worker === 'up' ? 'ok' : 'degraded',
      db: 'up',
      worker,
      worker_last_beat_at: lastBeat,
    };
    // 200 even when degraded: this instance can serve. See the DECIDED note.
    res.status(HttpStatus.OK).json(body);
  }
}
