import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from './database.types';

/**
 * Who is asking. Declared to the database on every request that touches it.
 *
 * `sellerId` is null on requests that carry no active seller context (sign-in,
 * bootstrap, anonymous storefront reads). `accountId` is null before the caller
 * is authenticated.
 */
export interface RequestContext {
  readonly accountId: string | null;
  readonly actorRole: string;
  readonly sellerId: string | null;
  /**
   * Register D-27: ADU-CON-02 section 6.1 prints THREE settings; ADU-DB-01
   * v1.7 S12.6a's ratified fn_mark_order_ready body reads a fourth,
   * adulis.audience (the surface check belongs below the endpoint). The
   * function wins - a setting it needs must exist - so the wrapper sets
   * four, additively; recorded for CON-02's next reissue.
   */
  readonly audience?: 'MOBILE' | 'CONSOLE' | '' | undefined;
}

/**
 * ADU-CON-02 v3.0 section 6.1 — every request that touches the database declares
 * who is asking, TRANSACTION-LOCALLY.
 *
 * INVARIANT — the third argument to set_config is `true` (transaction-local) and
 * is the entire control.
 *
 * Connections are pooled and reused. `set_config(..., false)` persists on the
 * connection, so the NEXT request — a different person — inherits a courier's
 * identity or a seller's scope, silently defeating every RLS policy in the
 * schema. ADU-CON-02 names this "the single most likely catastrophic agent
 * mistake in the codebase". ADU-CON-02-A1 section 6 makes the pooled-connection
 * settings-leak test one of the six load tests ADU-CON-05 must run, and
 * ADU-CON-02 section 15 makes it a Tier 3 gate.
 *
 * A1's statement audit found this wrapper is ~47% of all database statements —
 * the receipt for RLS being real, charged knowingly.
 *
 * Written to be compatible with PgBouncer transaction mode on purpose
 * (section 17): the settings are set inside the transaction that uses them, so a
 * connection handed to another client between transactions carries nothing.
 *
 * TIER 0 — nothing calls this yet. It exists so Tier 3 builds on the audited
 * version rather than on whatever an agent writes that day. Do not "improve" it
 * without amending ADU-CON-02 section 6.1 first.
 */
export async function withRequestContext<T>(
  db: Kysely<Database>,
  ctx: RequestContext,
  fn: (trx: Transaction<Database>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`SELECT set_config('adulis.account_id', ${ctx.accountId}, true),
                     set_config('adulis.actor_role',  ${ctx.actorRole}, true),
                     set_config('adulis.seller_id',   ${ctx.sellerId},  true),
                     set_config('adulis.audience',    ${ctx.audience ?? ''}, true)`.execute(trx);
    return fn(trx);
  });
}
