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

export function createAppPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: APP_POOL_MAX });
}

/**
 * The only pool permitted to call the two decrypting functions
 * (`financial.read_payment_evidence`, `financial.render_payment_instructions`).
 * TIER 0 — no module imports it yet, because those functions do not exist until
 * migration 10.
 */
export function createFinancialPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: FINANCIAL_POOL_MAX });
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
