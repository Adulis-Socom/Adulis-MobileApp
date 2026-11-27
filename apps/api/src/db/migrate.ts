import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { Client } from 'pg';
import { loadEnv, migrateEnvSchema } from '../config/env';
import { assertReplacementTarget } from './target-guard';

export const MIGRATIONS_FOLDER = path.resolve(__dirname, '../../db/migrations');
/** One migrator at a time per database: a fixed advisory-lock key for this lineage. */
const MIGRATION_LOCK = 'adulis-rebuild-20261125-migrate';

/**
 * `pnpm db:migrate` (ARC-BE-03): the ONE migration actor, as adulis_migrator (never a superuser). The target
 * and its applied history are verified against the local journal BEFORE any statement runs, so a database
 * from another lineage, or with history this lineage never wrote, is refused rather than "completed".
 */
export async function runMigrations(url: string): Promise<void> {
  const journalHashes = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER }).map((m) => m.hash);
  const client = new Client({ connectionString: url, application_name: 'adulis-migrate' });
  await client.connect();
  try {
    await client.query('select pg_advisory_lock(hashtext($1))', [MIGRATION_LOCK]);
    await assertReplacementTarget(client, url, { stage: 'migrate', journalHashes, expectedRole: 'adulis_migrator' });
    await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await client.end(); // ends the session, releasing the advisory lock
  }
}

if (require.main === module) {
  runMigrations(loadEnv(migrateEnvSchema).DATABASE_URL_MIGRATE).then(
    () => process.stdout.write('db:migrate: replacement lineage up to date\n'),
    (err: unknown) => {
      process.stderr.write(`db:migrate: ${err instanceof Error ? err.message : 'failed'}\n`);
      process.exit(2);
    },
  );
}
