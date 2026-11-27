import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function createPool(url: string, applicationName: string, max: number): Pool {
  return new Pool({ connectionString: url, application_name: applicationName, max, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000 });
}

export const createDb = (pool: Pool): Db => drizzle({ client: pool, schema });

/** What a request or job may assert to the database. Values are opaque ids; empty means "none". */
export interface DbContext {
  readonly actorRole: string;
  readonly accountId?: string;
  readonly sellerId?: string;
}

/** The worker's context: trusted SYSTEM provenance, no account or Seller (EVT-01 S16). */
export const SYSTEM_CONTEXT: DbContext = { actorRole: 'SYSTEM' };

/**
 * Root CLAUDE.md, non-negotiable: every database access runs in a transaction whose FIRST statement sets the
 * three settings with set_config(..., true). The third argument makes them transaction-local; it is the entire
 * RLS control. Never SET, never set_config(..., false). Proven in test/roles-and-rls.int.ts.
 */
export function withRequestContext<T>(db: Db, ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('adulis.account_id', ${ctx.accountId ?? ''}, true),
                                set_config('adulis.actor_role', ${ctx.actorRole}, true),
                                set_config('adulis.seller_id', ${ctx.sellerId ?? ''}, true)`);
    return fn(tx);
  });
}
