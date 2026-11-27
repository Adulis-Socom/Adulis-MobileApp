import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { bootstrapEnvSchema, loadEnv } from '../config/env';
import { assertReplacementTarget, DATABASE_IDENTITY, identityComment, TargetRefused } from './target-guard';

/**
 * `pnpm db:bootstrap` (ARC-BE-03): the provisioning step, run as a superuser BEFORE the first migration.
 * 1. proves the target is the replacement lineage (name, no legacy markers);
 * 2. stamps the identity comment ONLY on an empty, unstamped database; verifies it otherwise; refuses a foreign one;
 * 3. creates/reduces the three roles (bootstrap.sql), sets their passwords, and grants database-level access.
 */
export async function bootstrap(env: { DATABASE_URL_BOOTSTRAP: string; ADULIS_DB_MIGRATOR_PASSWORD: string; ADULIS_DB_API_PASSWORD: string; ADULIS_DB_WORKER_PASSWORD: string }): Promise<void> {
  const client = new Client({ connectionString: env.DATABASE_URL_BOOTSTRAP, application_name: 'adulis-bootstrap' });
  await client.connect();
  try {
    await assertReplacementTarget(client, env.DATABASE_URL_BOOTSTRAP, { stage: 'bootstrap' });
    const comment = await identityComment(client);
    if (comment === null) {
      const objects = await client.query(
        `select count(*)::int as n from pg_namespace where nspname not like 'pg\\_%' and nspname not in ('public', 'information_schema')`,
      );
      const tables = await client.query(`select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'`);
      if ((objects.rows[0] as { n: number }).n !== 0 || (tables.rows[0] as { n: number }).n !== 0) {
        throw new TargetRefused('database target refused: unstamped database is not empty; it is never adopted');
      }
      await runBuilt(client, `select format('COMMENT ON DATABASE %I IS %L', current_database(), $1::text) as stmt`, [DATABASE_IDENTITY]);
    } else if (comment !== DATABASE_IDENTITY) {
      throw new TargetRefused('database target refused: a foreign identity comment is present; it is never overwritten');
    }

    await client.query(readFileSync(path.resolve(__dirname, '../../db/bootstrap.sql'), 'utf8'));
    const passwords: [string, string][] = [
      ['adulis_migrator', env.ADULIS_DB_MIGRATOR_PASSWORD],
      ['adulis_api', env.ADULIS_DB_API_PASSWORD],
      ['adulis_worker', env.ADULIS_DB_WORKER_PASSWORD],
    ];
    for (const [role, password] of passwords) await runBuilt(client, `select format('ALTER ROLE %I PASSWORD %L', $1::text, $2::text) as stmt`, [role, password]);
    await runBuilt(client, `select format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database()) as stmt`);
    await runBuilt(client, `select format('GRANT CONNECT, CREATE ON DATABASE %I TO adulis_migrator', current_database()) as stmt`);
    await runBuilt(client, `select format('GRANT CONNECT ON DATABASE %I TO adulis_api, adulis_worker', current_database()) as stmt`);
  } finally {
    await client.end();
  }
}

/** Builds a utility statement with server-side quoting, then runs it. Values never meet string concatenation. */
async function runBuilt(client: Client, builder: string, values: unknown[] = []): Promise<void> {
  const stmt = (await client.query(builder, values)).rows[0] as { stmt: string };
  await client.query(stmt.stmt);
}

if (require.main === module) {
  bootstrap(loadEnv(bootstrapEnvSchema)).then(
    () => process.stdout.write('db:bootstrap: replacement target verified, roles and grants in place\n'),
    (err: unknown) => {
      process.stderr.write(`db:bootstrap: ${err instanceof Error ? err.message : 'failed'}\n`);
      process.exit(2);
    },
  );
}
