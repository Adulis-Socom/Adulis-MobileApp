import { getTableConfig } from 'drizzle-orm/pg-core';
import { bootstrap } from '../src/db/bootstrap';
import { runMigrations } from '../src/db/migrate';
import * as schema from '../src/db/schema';
import { assertReplacementTarget, DATABASE_IDENTITY, TargetRefused } from '../src/db/target-guard';
import { createEmptyDatabase, freshReplacementDatabase, PASSWORDS, schemaSnapshot, withClient } from './support';

const comment = (url: string) =>
  withClient(url, async (c) => (await c.query(`select shobj_description(oid, 'pg_database') as v from pg_database where datname = current_database()`)).rows[0].v as string | null);

describe('clean replacement lineage (ARC-BE-03)', () => {
  it('bootstrap stamps an empty database once; bootstrap and migrate are idempotent', async () => {
    const db = await freshReplacementDatabase('idem');
    expect(await comment(db.superuser)).toBe(DATABASE_IDENTITY);
    const before = await schemaSnapshot(db.superuser);
    await bootstrap({ DATABASE_URL_BOOTSTRAP: db.superuser, ...PASSWORDS });
    await runMigrations(db.migrator);
    expect(await schemaSnapshot(db.superuser)).toEqual(before);
    const applied = await withClient(db.superuser, async (c) => (await c.query('select count(*)::int as n from drizzle.__drizzle_migrations')).rows[0].n);
    expect(applied).toBe(1);
  });

  it('two independent clean initialisations converge to the same normalized schema', async () => {
    const a = await freshReplacementDatabase('det_a');
    const b = await freshReplacementDatabase('det_b');
    const snapA = await schemaSnapshot(a.superuser);
    expect(snapA.length).toBeGreaterThan(40);
    expect(await schemaSnapshot(b.superuser)).toEqual(snapA);
  });

  it('contains only the platform foundation: no domain, retired or placeholder table', async () => {
    const db = await freshReplacementDatabase('tables');
    const tables = await withClient(db.superuser, async (c) =>
      (await c.query(`select schemaname || '.' || tablename as t from pg_tables where schemaname not in ('pg_catalog', 'information_schema') order by 1`)).rows.map((r: { t: string }) => r.t),
    );
    expect(tables).toEqual(['drizzle.__drizzle_migrations', 'platform.async_dead_letter', 'platform.event_delivery', 'platform.event_outbox', 'platform.processed_event']);
    for (const t of tables) expect(t).not.toMatch(/reservation|order|payment|payout|handoff|evidence|ledger|refund/);
  });

  it('the Drizzle schema agrees with the reviewed SQL column for column', async () => {
    const db = await freshReplacementDatabase('conform');
    const live = await withClient(db.superuser, async (c) =>
      (await c.query(`select table_name, column_name, is_nullable from information_schema.columns where table_schema = 'platform' order by 1, 2`)).rows.map(
        (r: { table_name: string; column_name: string; is_nullable: string }) => `${r.table_name}.${r.column_name}:${r.is_nullable === 'NO' ? 'notnull' : 'null'}`,
      ),
    );
    const declared = [schema.eventOutbox, schema.eventDelivery, schema.processedEvent, schema.asyncDeadLetter]
      .flatMap((t) => {
        const cfg = getTableConfig(t);
        return cfg.columns.map((col) => `${cfg.name}.${col.name}:${col.notNull ? 'notnull' : 'null'}`);
      })
      .sort();
    expect(declared).toEqual([...live].sort());
  });
});

describe('database target safety before any migration (ARC-BE-01/03)', () => {
  it('refuses to adopt an unstamped database that is not empty', async () => {
    const db = await createEmptyDatabase('nonempty');
    await withClient(db.superuser, (c) => c.query('create table public.stray (id int)'));
    await expect(bootstrap({ DATABASE_URL_BOOTSTRAP: db.superuser, ...PASSWORDS })).rejects.toThrow(/not empty/);
    expect(await comment(db.superuser)).toBeNull();
  });

  it('never overwrites a foreign identity comment', async () => {
    const db = await createEmptyDatabase('foreign');
    await withClient(db.superuser, (c) => c.query(`comment on database ${db.name} is 'someone else'`));
    await expect(bootstrap({ DATABASE_URL_BOOTSTRAP: db.superuser, ...PASSWORDS })).rejects.toThrow(/never overwritten/);
    expect(await comment(db.superuser)).toBe('someone else');
  });

  it.each([
    ['node-pg-migrate history', 'create table public.pgmigrations (id int)'],
    ['Graphile Worker schema', 'create schema graphile_worker'],
    ['retired Reservation table', 'create schema core; create table core.reservation (id int)'],
  ])('refuses a database carrying the legacy marker: %s', async (_label, ddl) => {
    const db = await freshReplacementDatabase('marker');
    await withClient(db.superuser, (c) => c.query(ddl));
    await expect(runMigrations(db.migrator)).rejects.toThrow(TargetRefused);
    await expect(bootstrap({ DATABASE_URL_BOOTSTRAP: db.superuser, ...PASSWORDS })).rejects.toThrow(TargetRefused);
  });

  it('refuses a migration history this lineage never wrote', async () => {
    const db = await freshReplacementDatabase('history');
    await withClient(db.superuser, (c) => c.query(`insert into drizzle.__drizzle_migrations (hash, created_at) values ('not-ours', 1)`));
    await expect(runMigrations(db.migrator)).rejects.toThrow(/history is not this lineage/);
  });

  it('refuses a database whose identity comment was removed', async () => {
    const db = await freshReplacementDatabase('unstamped');
    await withClient(db.superuser, (c) => c.query(`comment on database ${db.name} is null`));
    await expect(runMigrations(db.migrator)).rejects.toThrow(/identity/);
  });

  it('the runtime and migration stages refuse a superuser connection', async () => {
    const db = await freshReplacementDatabase('superuser');
    await withClient(db.superuser, async (c) => {
      await expect(assertReplacementTarget(c, db.superuser, { stage: 'runtime' })).rejects.toThrow(/superuser/);
    });
    await withClient(db.api, async (c) => {
      await expect(assertReplacementTarget(c, db.api, { stage: 'runtime' })).resolves.toBeUndefined();
    });
  });
});
