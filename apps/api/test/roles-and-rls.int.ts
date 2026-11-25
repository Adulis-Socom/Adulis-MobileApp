import { sql } from 'drizzle-orm';
import { createDb, createPool, withRequestContext } from '../src/db/client';
import { freshReplacementDatabase, withClient, type TestDb } from './support';

const EVENT_COLUMNS = `event_id, event_type, event_version, scope, aggregate_type, aggregate_id, aggregate_revision, logical_effect_id, actor_type, trusted_service_ref, correlation_id, payload, occurred_at`;
const eventValues = (id: string) => `'${id}', 'test.synthetic_happened', 1, 'GLOBAL', 'synthetic', 'a1', 0, 'e1', 'SYSTEM', 'test', 'corr-0001', '{}', now()`;
const ID = '00000000-0000-4000-8000-0000000000a1';

async function sqlstate(url: string, statement: string): Promise<string | undefined> {
  return withClient(url, async (c) => {
    try {
      await c.query(statement);
      return undefined;
    } catch (err) {
      return (err as { code?: string }).code;
    }
  });
}

describe('roles and privileges (ARC-BE-03)', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await freshReplacementDatabase('roles');
  });

  it('no runtime role is a superuser or can bypass RLS, create databases or roles', async () => {
    const rows = await withClient(db.superuser, async (c) =>
      (await c.query(`select rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication from pg_roles where rolname like 'adulis\\_%' order by 1`)).rows,
    );
    expect(rows.map((r: { rolname: string }) => r.rolname)).toEqual(['adulis_api', 'adulis_migrator', 'adulis_worker']);
    for (const r of rows as Record<string, unknown>[]) for (const attr of ['rolsuper', 'rolbypassrls', 'rolcreatedb', 'rolcreaterole', 'rolreplication']) expect(r[attr]).toBe(false);
  });

  it('the API appends facts and can do nothing else with them', async () => {
    expect(await sqlstate(db.api, `insert into platform.event_outbox (${EVENT_COLUMNS}) values (${eventValues(ID)})`)).toBeUndefined();
    // A row can never be inserted pre-dispatched or back-dated: the insert trigger normalises it.
    expect(await sqlstate(db.api, `insert into platform.event_outbox (${EVENT_COLUMNS}, dispatched_at, recorded_at) values (${eventValues(ID.replace('a1', 'b1'))}, now(), now() - interval '1 day')`)).toBeUndefined();
    const forged = await withClient(db.superuser, async (c) => (await c.query(`select dispatched_at is null as undispatched, recorded_at > now() - interval '1 hour' as fresh from platform.event_outbox where event_id = $1`, [ID.replace('a1', 'b1')])).rows[0]);
    expect(forged).toEqual({ undispatched: true, fresh: true });
    expect(await sqlstate(db.api, 'select * from platform.event_outbox')).toBe('42501');
    expect(await sqlstate(db.api, `update platform.event_outbox set dispatched_at = now()`)).toBe('42501');
    expect(await sqlstate(db.api, 'delete from platform.event_outbox')).toBe('42501');
    expect(await sqlstate(db.api, 'select * from platform.event_delivery')).toBe('42501');
    expect(await sqlstate(db.api, 'create table platform.x (id int)')).toBe('42501');
    expect(await sqlstate(db.api, 'create table public.x (id int)')).toBe('42501');
  });

  it('the worker moves only relay columns, never facts, and deletes nothing', async () => {
    expect(await sqlstate(db.worker, 'select count(*) from platform.event_outbox')).toBeUndefined();
    expect(await sqlstate(db.worker, `update platform.event_outbox set payload = '{"x":1}'`)).toBe('42501');
    expect(await sqlstate(db.worker, `update platform.event_outbox set lease_expires_at = now() where event_id = '${ID}'`)).toBeUndefined();
    expect(await sqlstate(db.worker, 'delete from platform.event_outbox')).toBe('42501');
    expect(await sqlstate(db.worker, 'delete from platform.processed_event')).toBe('42501');
    expect(await sqlstate(db.worker, 'insert into platform.event_outbox (event_id) values (gen_random_uuid())')).toBe('42501');
  });

  it('an outbox fact is immutable even for its owner, and dispatch is final', async () => {
    expect(await sqlstate(db.migrator, `update platform.event_outbox set payload = '{"x":1}' where event_id = '${ID}'`)).toBe('P0001');
    await withClient(db.migrator, (c) => c.query(`update platform.event_outbox set dispatched_at = now(), relay_owner = null, lease_expires_at = null where event_id = '${ID}'`));
    expect(await sqlstate(db.migrator, `update platform.event_outbox set dispatched_at = null where event_id = '${ID}'`)).toBe('P0001');
  });

  it('the envelope constraints hold in the database, not only in TypeScript', async () => {
    const insert = (cols: string, vals: string) => sqlstate(db.migrator, `insert into platform.event_outbox (${cols}) values (${vals})`);
    // SYSTEM actor without its service reference
    expect(await insert(EVENT_COLUMNS.replace(', trusted_service_ref', ''), eventValues(ID.replace('a1', 'a2')).replace(", 'test'", ''))).toBe('23514');
    // MARKET scope without a market
    expect(await insert(EVENT_COLUMNS, eventValues(ID.replace('a1', 'a3')).replace("'GLOBAL'", "'MARKET'"))).toBe('23514');
  });
});

describe('transaction-local authorization context and RLS', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await freshReplacementDatabase('rls');
    // A probe table (not part of the lineage) showing the pattern every domain RLS policy will use.
    await withClient(db.migrator, (c) =>
      c.query(`create schema rls_probe;
               create table rls_probe.owned (owner_id text not null, v int not null);
               insert into rls_probe.owned values ('acct-a', 1), ('acct-b', 2);
               alter table rls_probe.owned enable row level security;
               create policy owner_only on rls_probe.owned using (owner_id = current_setting('adulis.account_id', true));
               grant usage on schema rls_probe to adulis_api;
               grant select on rls_probe.owned to adulis_api;`),
    );
  });

  it('set_config(..., true) is visible inside the transaction and gone after it', async () => {
    const pool = createPool(db.api, 'test', 1);
    const drz = createDb(pool);
    try {
      const inside = await withRequestContext(drz, { actorRole: 'SELLER', accountId: 'acct-a' }, async (tx) =>
        (await tx.execute<{ v: string }>(sql`select current_setting('adulis.account_id', true) as v`)).rows[0]?.v,
      );
      expect(inside).toBe('acct-a');
      const after = (await drz.execute<{ v: string | null }>(sql`select nullif(current_setting('adulis.account_id', true), '') as v`)).rows[0]?.v;
      expect(after ?? null).toBeNull();
    } finally {
      await pool.end();
    }
  });

  it('a policy keyed on the context shows each account only its rows, and nothing without context', async () => {
    const pool = createPool(db.api, 'test', 1);
    const drz = createDb(pool);
    const visible = (accountId?: string) =>
      withRequestContext(drz, { actorRole: 'SELLER', ...(accountId ? { accountId } : {}) }, async (tx) =>
        (await tx.execute<{ owner_id: string }>(sql`select owner_id from rls_probe.owned order by 1`)).rows.map((r) => r.owner_id),
      );
    try {
      expect(await visible('acct-a')).toEqual(['acct-a']);
      expect(await visible('acct-b')).toEqual(['acct-b']);
      expect(await visible()).toEqual([]);
    } finally {
      await pool.end();
    }
  });
});
