import { randomUUID } from 'node:crypto';
import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { sql, type Kysely } from 'kysely';
import { APP_DATABASE } from '../../common/db/database.module';
import type { Database } from '../../common/db/database.types';
import { Public, type AuthedRequest } from '../../common/auth/auth.guard';
import { AdulisException } from '../../common/errors/adulis-exception';
import { BootstrapResponseDto } from './bootstrap.dto';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import {
  BROWSER_DEVICE_COOKIE,
  clientSurface,
  hostCookie,
  readCookie,
  sessionHostCookie,
} from '../../common/http/cookies';

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

/** Same derivation the auth surface uses, so one IP is one subject. */
/**
 * The single subject the platform-scoped mint limiter counts against
 * (ADU-RUL-06 S6, D-192). Not an IP and not a device -- ONE bucket for the
 * whole platform, on purpose, because behind a proxy every caller shares an
 * address and a per-IP limit here is a platform counter mislabelled. The
 * `DEVICE` kind is honest (this counts device minting) and the constant id
 * says in the row itself that there is exactly one subject.
 */
const PLATFORM_MINT_SUBJECT = 'platform';

@Controller('bootstrap')
export class BootstrapController {
  constructor(
    @Inject(APP_DATABASE) private readonly db: Kysely<Database>,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Client floor, market configuration and the clock reference.' })
  @ApiOkResponse({ type: BootstrapResponseDto })
  async bootstrap(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BootstrapResponse> {
    const r = await sql<{
      id: string;
      code: string;
      display_currency: string;
      display_timezone: string;
      default_locale: string;
      device_ttl_seconds: string | null;
    }>`
      SELECT m.id, m.code, m.display_currency, m.display_timezone, m.default_locale,
             -- The browser's device cookie lives exactly as long as the row it
             -- names would survive without being seen: a device is purged after
             -- media_retention of inactivity (G1.11 / S11.5), and every
             -- bootstrap refreshes both. Deriving it means no invented number
             -- and no cookie that outlives its row by a rule nobody wrote.
             -- Where the market has no configuration in force, the SHORTEST in
             -- force is used, because a retention default must fail toward
             -- deletion (0032's reasoning, applied to the cookie).
             extract(epoch FROM coalesce(
               (SELECT tc.media_retention FROM core.timing_config tc
                 WHERE tc.market_id = m.id AND tc.effective @> now() LIMIT 1),
               (SELECT min(tc2.media_retention) FROM core.timing_config tc2
                 WHERE tc2.effective @> now())
             ))::bigint::text AS device_ttl_seconds
        FROM core.market m
        -- ACTIVE markets only, oldest first (D-183: is_live withdrawn; every
        -- market resolution reads activation_state = 'ACTIVE'). No ACTIVE
        -- market means an unprovisioned deployment, and the 503 below says so.
       WHERE m.activation_state = 'ACTIVE'
       ORDER BY m.created_at ASC
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

    // TWO SURFACES, TWO DEVICE MECHANISMS (ADU-RUL-03 S2, T8 Phase 2 S2).
    // The difference is not a preference: a native app has a platform
    // keystore and a browser does not, so a browser cannot be trusted to
    // carry an identity it is able to read.
    const surface = clientSurface(req.headers['x-adulis-client']);

    if (surface === 'web') {
      // THE CLOSED ARM STAYS CLOSED. A web client's X-Adulis-Device is
      // ignored outright -- not read, not used as a fallback. Honouring it
      // would restore exactly the arm the ruling closes: a client-chosen
      // identity for the value that gates the new-device payout lock.
      const presented = readCookie(req.headers.cookie, BROWSER_DEVICE_COOKIE);
      let deviceId: string | null = null;

      if (presented && UUID_RE.test(presented)) {
        // Returning browser: the row must still exist (it is purged after
        // media_retention of silence). Its market is stamped only if unset,
        // for the same reason as before -- a market is where a device FIRST
        // appeared, and re-stamping lets it drift.
        const seen = await sql<{ id: string }>`
          UPDATE core.device
             SET last_seen_at = now(),
                 market_id = coalesce(market_id, ${market.id})
           WHERE id = ${presented} AND platform = 'WEB'
       RETURNING id`.execute(this.db);
        deviceId = seen.rows[0]?.id ?? null;
      }

      if (!deviceId) {
        /**
         * MINTING IS THE ONLY WRITE AN ANONYMOUS CALLER CAN CAUSE HERE, and
         * before this limit it was unbounded: a bare loop produced hundreds
         * of core.device rows a second. Reading is never limited -- a
         * returning browser presents a cookie and takes the branch above,
         * consuming no budget.
         *
         * PLATFORM-SCOPED BY DESIGN (ADU-RUL-06 S6, D-192). It used to key on
         * `req.ip`, and nothing in this API sets Express's `trust proxy`, so
         * behind any CDN or load balancer `req.ip` is the PROXY's address --
         * one subject for everyone. That is not a per-IP limit that happens to
         * collapse; it is a platform-wide counter WEARING a per-IP label, and
         * the label was the lie. S15 removed the OTP path's IP limiter for the
         * same reason (D-192).
         *
         * So it collapses ON PURPOSE, to a fixed subject, and bounds the total
         * mint rate honestly. The ceiling is sized for the PLATFORM in a beta
         * hour -- a flood is orders of magnitude above legitimate first-time
         * visits (the measured attack was ~230 rows/second), so a ceiling far
         * above any plausible hour still cuts it by orders of magnitude while
         * never being a number a real hour reaches.
         *
         * This is THE SECOND PLATFORM-SCOPED CONTROL, beside
         * core.platform_otp_budget; the shape now has two members. When
         * S15.1's trusted-proxy work lands it becomes per-IP at this ceiling,
         * which is one configuration change rather than a redesign.
         */
        await this.rateLimit.consume('DEVICE', PLATFORM_MINT_SUBJECT, {
          bucketKey: 'bootstrap-device-mint',
          windowSeconds: 3600,
          max: 50000,
        });

        // First load, or a cookie whose row is gone. The row and the
        // identifier are created by the SAME act, so an identifier can never
        // exist without its row -- which was the failure of the arm where the
        // client minted a uuid and verify rejected it.
        deviceId = randomUUID();
        await sql`
          INSERT INTO core.device (id, platform, market_id)
          VALUES (${deviceId}, 'WEB', ${market.id})`.execute(this.db);
      }

      // Two simultaneous first loads can mint two rows: the second was in
      // flight before this response set the cookie. The browser keeps the
      // last cookie, so the other row is orphaned -- unbound, so
      // device.purge_unbound reaches it (T8 Phase 2 S3.2).
      // A COOKIE IS ALWAYS SET. The earlier version skipped it when no
      // timing_config was in force, which sounded conservative and was not:
      // with no cookie the browser can never present a device, so
      // otp/verify's console branch refuses forever and tells the client to
      // call the endpoint it just called. A freshly migrated database is
      // exactly that state -- no migration seeds timing_config.
      //
      // Without configuration there is no honest MAX-AGE, so none is given
      // and the browser keeps it for the session. That is a real cookie the
      // browser will send back, so sign-in works; it simply does not survive
      // a restart, which is the conservative half done correctly.
      const ttl = Number(market.device_ttl_seconds ?? 0);
      res.setHeader(
        'Set-Cookie',
        ttl > 0
          ? hostCookie(BROWSER_DEVICE_COOKIE, deviceId, ttl)
          : sessionHostCookie(BROWSER_DEVICE_COOKIE, deviceId),
      );
    } else {
      // App clients (ADU-API-01 S3: X-Adulis-Device is an app header). The
      // device is client-generated, keystore-persisted and registered via
      // POST /v1/devices; bootstrap only places it in a market.
      //
      // Best-effort and never fatal, as before: bootstrap is the anonymous
      // first call, and failing it because a header was absent would break a
      // client's first request in order to say something about retention.
      const deviceHeader = req.headers['x-adulis-device'];
      if (typeof deviceHeader === 'string' && UUID_RE.test(deviceHeader)) {
        await sql`
          UPDATE core.device
             SET market_id = ${market.id}
           WHERE id = ${deviceHeader} AND market_id IS NULL`.execute(this.db);
      }
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
