import { Controller, Get, Inject, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { sql, type Kysely } from 'kysely';
import { APP_DATABASE } from '../../common/db/database.module';
import type { Database } from '../../common/db/database.types';
import { Public, type AuthedRequest } from '../../common/auth/auth.guard';
import { AdulisException } from '../../common/errors/adulis-exception';
import { BootstrapResponseDto } from './bootstrap.dto';

/**
 * GET /v1/bootstrap (ADU-API-01 v1.6 section 3.1). Client version is
 * enforced HERE AND NOWHERE ELSE (ADU-CON-02 section 5): a client below
 * the floor gets one comprehensible upgrade instruction at launch, never
 * an incomprehensible failure at the moment it tries to reserve.
 *
 * `server_time` is load-bearing, not a convenience: it is the reference the
 * client uses to compute the A5 clock offset that handoff completion
 * depends on.
 *
 * Register D-20 — two values this endpoint needs that no document rules:
 * WHICH market an anonymous bootstrap resolves (Phase 1 is one market, so
 * the single live market is taken, the earliest-created row as tiebreak —
 * loudly wrong the day a second market goes live, by design), and
 * `min_supported_client`, which is a value-arrives-later in the ADU-VAL-01
 * sense: floored at 0.0.0 so every client passes until a floor is ruled.
 */

const MIN_SUPPORTED_CLIENT = '0.0.0';

export interface BootstrapResponse {
  server_time: string;
  min_supported_client: string;
  client_status: 'OK' | 'UPGRADE_RECOMMENDED' | 'UPGRADE_REQUIRED';
  market: { code: string; display_currency: string; timezone: string };
  locales: readonly string[];
  feature_flags: Record<string, boolean>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('bootstrap')
export class BootstrapController {
  constructor(@Inject(APP_DATABASE) private readonly db: Kysely<Database>) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Client floor, market configuration and the clock reference.' })
  @ApiOkResponse({ type: BootstrapResponseDto })
  async bootstrap(@Req() req: AuthedRequest): Promise<BootstrapResponse> {
    const r = await sql<{
      id: string;
      code: string;
      display_currency: string;
      display_timezone: string;
      default_locale: string;
    }>`
      SELECT id, code, display_currency, display_timezone, default_locale
        FROM core.market
       ORDER BY is_live DESC, created_at ASC
       LIMIT 1`.execute(this.db);

    const market = r.rows[0];
    if (!market) {
      // No market configured is an unprovisioned deployment, not a client
      // problem: 503, retryable.
      throw new AdulisException('INTERNAL', {
        status: 503,
        retryable: true,
        slots: { retry_after_seconds: 30 },
      });
    }

    // G1.11 — the device is assigned this market, once, here.
    //
    // Bootstrap already resolves a market, and it is the first call every
    // client makes, so this is where a device stops being marketless. It is
    // written ONLY when the device is not already placed: a market is a
    // fact about where a device first appeared, and re-stamping it on every
    // bootstrap would let a device drift between markets and quietly change
    // which retention applies to it.
    //
    // Best-effort and never fatal. A device that has not registered yet has
    // no row, and bootstrap is the ANONYMOUS call every client makes before
    // anything else -- failing it because a header was absent or malformed
    // would break the client's first request to say something about
    // retention. A device that misses this stays NULL, which now means the
    // SHORTEST retention rather than the longest, so the fallback is safe.
    const deviceHeader = req.headers['x-adulis-device'];
    if (typeof deviceHeader === 'string' && UUID_RE.test(deviceHeader)) {
      await sql`
        UPDATE core.device
           SET market_id = ${market.id}
         WHERE id = ${deviceHeader} AND market_id IS NULL`.execute(this.db);
    }

    return {
      server_time: new Date().toISOString(),
      min_supported_client: MIN_SUPPORTED_CLIENT,
      client_status: 'OK',
      market: {
        code: market.code,
        display_currency: market.display_currency,
        timezone: market.display_timezone,
      },
      locales: ['en', 'am'],
      feature_flags: {},
    };
  }
}
