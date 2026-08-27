import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { APP_DATABASE } from '../db/database.module';
import type { Database } from '../db/database.types';
import { AdulisException } from '../errors/adulis-exception';

/**
 * The authenticate stage of the section 5 pipeline — ONE session read.
 *
 * INVARIANT — revocation takes effect server-side immediately, not at next
 * token refresh (ADU-AUTH-01 S8.2). The session row is read on EVERY
 * authenticated request: one indexed primary-key lookup, budgeted in
 * ADU-CON-02 section 17, and the price of the invariant. No stateless token
 * whose validity outlives its row.
 *
 * The read joins the account's standing and its market's timing
 * configuration into the same statement, so "one session read" stays one
 * statement rather than becoming three.
 *
 * Lifetimes (ADU-AUTH-01 S8.1, R17) — all per-market configuration:
 *   MOBILE                      30 days absolute, SLIDING on activity
 *   CONSOLE, remembered device   7 days absolute,  8 hours idle
 *   CONSOLE, any other device   12 hours absolute, 30 minutes idle
 * A session's remembered-ness is the account_device_id column: a remembered
 * device is one the seller has ASSERTED, and R17's longer window rides on
 * that assertion plus four controls that are not the session length.
 */

export interface SessionContext {
  readonly sessionId: string;
  readonly accountId: string;
  readonly audience: 'MOBILE' | 'CONSOLE';
  readonly deviceId: string | null;
  readonly marketId: string;
}

interface SessionRow {
  id: string;
  account_id: string;
  audience: 'MOBILE' | 'CONSOLE';
  device_id: string | null;
  account_device_id: string | null;
  last_activity_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  account_status: string;
  market_id: string;
  mobile_session_lifetime: unknown;
  console_idle_timeout: unknown;
  console_remembered_idle: unknown;
  idle_expired: boolean;
  activity_stale: boolean;
}

/**
 * How stale last_activity_at may grow before it is written again. An
 * unconditional write per request would double the per-request statement
 * count ADU-CON-02-A1 audited; a 60-second floor keeps the idle-timeout
 * arithmetic honest to the minute while costing ~one write per active
 * session per minute.
 */
const ACTIVITY_TOUCH_FLOOR_SECONDS = 60;

@Injectable()
export class SessionService {
  constructor(@Inject(APP_DATABASE) private readonly db: Kysely<Database>) {}

  /**
   * The one read. Raises 401 SESSION_EXPIRED for an unknown, expired or
   * idle-lapsed token, 401 SESSION_REVOKED for a revoked one or a dead
   * account — and nothing else, because a sign-in surface that
   * distinguishes further is an enumeration oracle.
   */
  async authenticate(token: string): Promise<SessionContext> {
    // A token that is not even a uuid cannot be a session id; refusing it
    // here keeps garbage out of the query plan and the log.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      throw new AdulisException('SESSION_EXPIRED');
    }

    const result = await sql<SessionRow>`
      SELECT s.id, s.account_id, s.audience, s.device_id, s.account_device_id,
             s.last_activity_at, s.expires_at, s.revoked_at,
             a.status AS account_status, a.market_id,
             tc.mobile_session_lifetime, tc.console_idle_timeout,
             tc.console_remembered_idle,
             CASE
               WHEN s.audience = 'MOBILE' THEN false
               WHEN s.account_device_id IS NOT NULL
                 THEN now() > s.last_activity_at + tc.console_remembered_idle
               ELSE now() > s.last_activity_at + tc.console_idle_timeout
             END AS idle_expired,
             now() > s.last_activity_at
                       + make_interval(secs => ${ACTIVITY_TOUCH_FLOOR_SECONDS})
               AS activity_stale
        FROM core.session s
        JOIN core.account a ON a.id = s.account_id
        LEFT JOIN core.timing_config tc
          ON tc.market_id = a.market_id AND tc.effective @> now()
       WHERE s.id = ${token}`.execute(this.db);

    const row = result.rows[0];
    if (!row) throw new AdulisException('SESSION_EXPIRED');
    if (row.revoked_at !== null) throw new AdulisException('SESSION_REVOKED');
    if (row.account_status !== 'ACTIVE') throw new AdulisException('SESSION_REVOKED');
    if (new Date() > row.expires_at) throw new AdulisException('SESSION_EXPIRED');

    // Fail closed on absent timing configuration: an idle rule that cannot
    // be evaluated is an idle rule that failed, not one that passed.
    if (row.audience === 'CONSOLE' && row.console_idle_timeout === null) {
      throw new AdulisException('SESSION_EXPIRED');
    }
    if (row.idle_expired) throw new AdulisException('SESSION_EXPIRED');

    if (row.activity_stale) {
      await this.touch(row.id, row.audience);
    }

    return {
      sessionId: row.id,
      accountId: row.account_id,
      audience: row.audience,
      deviceId: row.device_id,
      marketId: row.market_id,
    };
  }

  /**
   * Sliding lifetimes: every audience's idle clock restarts on activity,
   * and MOBILE's 30-day ABSOLUTE window slides too (S8.1 - "30 days,
   * sliding on activity"); both console absolutes are fixed at creation.
   */
  private async touch(sessionId: string, audience: 'MOBILE' | 'CONSOLE'): Promise<void> {
    if (audience === 'MOBILE') {
      await sql`
        UPDATE core.session s
           SET last_activity_at = now(),
               expires_at = now() + tc.mobile_session_lifetime
          FROM core.account a
          JOIN core.timing_config tc
            ON tc.market_id = a.market_id AND tc.effective @> now()
         WHERE s.id = ${sessionId} AND a.id = s.account_id`.execute(this.db);
    } else {
      await sql`
        UPDATE core.session SET last_activity_at = now()
         WHERE id = ${sessionId}`.execute(this.db);
    }
  }
}
