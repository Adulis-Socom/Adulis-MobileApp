import { Kysely, sql } from 'kysely';
import { Pool } from 'pg';
import { createDatabase } from './database';
import type { Database } from './database.types';
import { withRequestContext, type RequestContext } from './request-context';

/**
 * ADU-CON-02 v3.0 section 6.1 — the pooled-connection settings-leak test.
 *
 * This is the test the architecture stands on. Section 6.1 calls a leaked
 * setting "the single most likely catastrophic agent mistake in the codebase";
 * section 15 makes this a Tier 3 gate; ADU-CON-02-A1 section 6 makes it load
 * test 6 of the six ADU-CON-05 must run. It is written at Tier 0 so Tier 3
 * builds on an audited helper.
 *
 * It runs against REAL PostgreSQL and cannot be mocked: the property under test
 * IS Postgres's transaction-local GUC behaviour. `max: 1` forces every
 * transaction onto the same physical connection, which is precisely the
 * condition a connection pool creates in production.
 *
 * The suite does not skip when the database is absent. An invariant that
 * silently reports "passed" because nobody started Docker is worse than no test.
 * ADU-CON-02 section 13 starts the database before `pnpm test` for this reason.
 */

const CONNECTION_STRING = process.env['DATABASE_URL'];

const ACTOR_A: RequestContext = {
  accountId: '11111111-1111-4111-8111-111111111111',
  actorRole: 'SELLER_OWNER',
  sellerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

const ACTOR_B: RequestContext = {
  accountId: '22222222-2222-4222-8222-222222222222',
  actorRole: 'COURIER',
  sellerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};

async function readSettings(
  executor: Kysely<Database>,
): Promise<{ account: string | null; role: string | null; seller: string | null }> {
  const result = await sql<{
    account: string | null;
    role: string | null;
    seller: string | null;
  }>`SELECT current_setting('adulis.account_id', true) AS account,
            current_setting('adulis.actor_role',  true) AS role,
            current_setting('adulis.seller_id',   true) AS seller`.execute(executor);
  const row = result.rows[0];
  return row ?? { account: null, role: null, seller: null };
}

describe('withRequestContext — transaction-local settings on a pooled connection', () => {
  let pool: Pool;
  let db: Kysely<Database>;

  beforeAll(() => {
    if (!CONNECTION_STRING) {
      throw new Error(
        'DATABASE_URL is not set. This invariant cannot be tested without PostgreSQL.\n' +
          'Run:  docker compose up -d  &&  cp .env.example .env',
      );
    }
    // max: 1 — every transaction below is guaranteed to share one connection.
    pool = new Pool({ connectionString: CONNECTION_STRING, max: 1 });
    db = createDatabase(pool);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('sets all three adulis.* settings inside the transaction', async () => {
    const seen = await withRequestContext(db, ACTOR_A, async (trx) =>
      readSettings(trx as unknown as Kysely<Database>),
    );
    expect(seen.account).toBe(ACTOR_A.accountId);
    expect(seen.role).toBe(ACTOR_A.actorRole);
    expect(seen.seller).toBe(ACTOR_A.sellerId);
  });

  it('leaves NOTHING behind on the connection after the transaction commits', async () => {
    await withRequestContext(db, ACTOR_A, async (trx) =>
      readSettings(trx as unknown as Kysely<Database>),
    );

    // Same pool, same physical connection, outside any transaction.
    const after = await readSettings(db);
    expect(after.account).toBeFalsy();
    expect(after.role).toBeFalsy();
    expect(after.seller).toBeFalsy();
  });

  it('never lets one actor observe the other on the same pooled connection', async () => {
    // Two SEQUENTIAL transactions on one connection — the exact shape of two
    // consecutive requests from different people served by the same pool slot.
    const first = await withRequestContext(db, ACTOR_A, async (trx) =>
      readSettings(trx as unknown as Kysely<Database>),
    );
    const second = await withRequestContext(db, ACTOR_B, async (trx) =>
      readSettings(trx as unknown as Kysely<Database>),
    );

    expect(first.account).toBe(ACTOR_A.accountId);
    expect(second.account).toBe(ACTOR_B.accountId);

    // The failure this guards: B inheriting A's identity or scope.
    expect(second.account).not.toBe(ACTOR_A.accountId);
    expect(second.role).not.toBe(ACTOR_A.actorRole);
    expect(second.seller).not.toBe(ACTOR_A.sellerId);
  });

  it('rolls the settings back with the transaction when the handler throws', async () => {
    await expect(
      withRequestContext(db, ACTOR_A, async () => {
        throw new Error('handler exploded');
      }),
    ).rejects.toThrow('handler exploded');

    const after = await readSettings(db);
    expect(after.account).toBeFalsy();
  });

  /**
   * The negative control, and the reason the third argument is written down as
   * an invariant rather than a preference. This proves the mechanism: with
   * `false` the value SURVIVES the transaction and the next caller inherits it.
   *
   * Run on its own pool so a deliberately leaked setting cannot contaminate the
   * assertions above.
   */
  it('demonstrates that set_config(..., false) leaks across transactions — which is why it is banned', async () => {
    const leakyPool = new Pool({ connectionString: CONNECTION_STRING, max: 1 });
    const leakyDb = createDatabase(leakyPool);
    try {
      await leakyDb.transaction().execute(async (trx) => {
        await sql`SELECT set_config('adulis.account_id', ${ACTOR_A.accountId}, false)`.execute(trx);
      });

      // Session-scoped: still there, on a connection now free for anyone else.
      const leaked = await readSettings(leakyDb);
      expect(leaked.account).toBe(ACTOR_A.accountId);
    } finally {
      await leakyDb.destroy();
    }
  });
});
