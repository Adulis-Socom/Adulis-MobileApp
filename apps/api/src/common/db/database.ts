import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './database.types';

/**
 * ADU-CON-02 v3.0 section 6.2 — two pools, one privilege.
 *
 * Both pools use the SAME database role. The privilege boundary is the schema
 * grant, not a second credential: `adulis_app` has no grant on the `financial`
 * or `verification` schemas at all, and reaches them only through the
 * SECURITY DEFINER functions that write the access log in the same transaction
 * (ADU-DB-01 Appendix C check 10).
 *
 * The second pool is an AUDIT boundary, not a security one, and this is stated
 * accurately on purpose: grep the import of `financialPool` and you hold the
 * complete list of code that can reach payment evidence and payout credentials.
 * ADU-DB-01 section 13.6 makes the same honesty correction about the `financial`
 * schema itself — review ergonomics, not a second wall.
 */

export interface PoolConfig {
  readonly connectionString: string;
  readonly max: number;
}

/**
 * Connection budget. ADU-CON-02 v3.0 section 17 certifies ~30 direct connections
 * at 10,000 sellers against a 100-connection plan limit, with PgBouncer
 * transaction mode as the action at >=70. Keep the totals small deliberately.
 */
export const APP_POOL_MAX = 10;
export const FINANCIAL_POOL_MAX = 4;

/**
 * How long a caller waits for a pooled connection before failing (OVN-045,
 * defence in depth). pg's default is to wait forever, so an accidental nested
 * acquisition -- a transaction holding one connection while asking for a
 * second -- HANGS the API under a burst instead of failing. With a bound, a
 * starved pool answers 503 + Retry-After (ProblemDetailsFilter) and recovers.
 *
 * A TECHNICAL OPERATIONAL SAFEGUARD, NOT A PRODUCT RULE. No governing
 * document sets a value (ADU-CON-02 v3.2 S17 budgets connections, not
 * waits; ADU-OBS-01 v3.2 S22 asks that pool wait be MONITORED, and the 503
 * log line is that signal), so the default is a conservative 5 s and
 * DB_POOL_ACQUIRE_TIMEOUT_MS overrides it. It bounds opening a new
 * connection too. Whole milliseconds, 100 to 60000: 0 would mean "wait
 * forever" to pg, the hang this exists to prevent, so it is refused at boot
 * rather than honoured (the TRUSTED_PROXY_HOPS precedent).
 */
export const POOL_ACQUIRE_TIMEOUT_DEFAULT_MS = 5000;

export function poolAcquireTimeoutMs(
  raw: string | undefined = process.env['DB_POOL_ACQUIRE_TIMEOUT_MS'],
): number {
  if (raw === undefined || raw === '') return POOL_ACQUIRE_TIMEOUT_DEFAULT_MS;
  const ms = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!(ms >= 100 && ms <= 60_000)) {
    throw new Error(
      `DB_POOL_ACQUIRE_TIMEOUT_MS is '${raw}', which is not whole milliseconds ` +
        'from 100 to 60000. Leave it unset for the 5000 ms default; 0 is refused ' +
        'because pg reads it as "wait forever".',
    );
  }
  return ms;
}

/**
 * pg-pool 3.x's words for "no connection within connectionTimeoutMillis"
 * (a full pool), and pg's for a new connection that did not open in time.
 * Neither carries a code; wo-sec-001's real-pool test pins the first, so a
 * driver upgrade that rewords it fails a test instead of serving 500s.
 */
const ACQUIRE_TIMEOUT_MESSAGES: ReadonlySet<string> = new Set([
  'timeout exceeded when trying to connect',
  'Connection terminated due to connection timeout',
]);

export function isPoolAcquireTimeout(e: unknown): boolean {
  return e instanceof Error && ACQUIRE_TIMEOUT_MESSAGES.has(e.message);
}

export function createAppPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: APP_POOL_MAX,
    connectionTimeoutMillis: poolAcquireTimeoutMs(),
  });
}

/**
 * The only pool permitted to call the two decrypting functions
 * (`financial.read_payment_evidence`, `financial.render_payment_instructions`).
 * TIER 0 — no module imports it yet, because those functions do not exist until
 * migration 10.
 */
export function createFinancialPool(connectionString: string): Pool {
  // The same bound: no handler nests this pool today (WO-SEC-001 audit), and
  // a stuck evidence read should fail in bounded time, not queue forever.
  return new Pool({
    connectionString,
    max: FINANCIAL_POOL_MAX,
    connectionTimeoutMillis: poolAcquireTimeoutMs(),
  });
}

export function createDatabase(pool: Pool): Kysely<Database> {
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

/**
 * The liveness probe behind `GET /healthz`. A real round trip, not a cached
 * flag: ADU-CON-02 section 20.2 puts an uptime ping on this endpoint precisely
 * so that a database the API cannot reach pages a human.
 */
export async function pingDatabase(db: Kysely<Database>): Promise<boolean> {
  try {
    await sql`SELECT 1`.execute(db);
    return true;
  } catch {
    return false;
  }
}
