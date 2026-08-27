import { Controller, Get, Res, HttpStatus, Inject } from '@nestjs/common';
import type { Response } from 'express';
import { Kysely } from 'kysely';
import { pingDatabase } from './common/db/database';
import { APP_DATABASE } from './common/db/database.module';
import type { Database } from './common/db/database.types';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
}

/**
 * The only route that exists at Tier 0 (ADU-CON-02 v3.0 section 15).
 *
 * `db` is a real SELECT 1 against DATABASE_URL, not a cached flag: section 20.2
 * puts an uptime ping on this endpoint so that a database the API cannot reach
 * pages a human. Section 18's Render topology names /healthz as the API health
 * check, so a 503 here is what stops a bad instance taking traffic.
 *
 * NOT here, and deliberately: the worker heartbeat staleness check (section 20.2
 * reddens /healthz when the heartbeat row is stale). That needs the `jobs`
 * schema from migration 14 — Tier 2. Adding it now would mean inventing the
 * table.
 */
@Controller()
export class HealthController {
  constructor(@Inject(APP_DATABASE) private readonly db: Kysely<Database>) {}

  @Get('/healthz')
  async healthz(@Res() res: Response): Promise<void> {
    const up = await pingDatabase(this.db);
    const body: HealthResponse = { status: up ? 'ok' : 'degraded', db: up ? 'up' : 'down' };
    res.status(up ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(body);
  }
}
