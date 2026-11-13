#!/usr/bin/env node
// Exit 0 only if the database DATABASE_URL_MIGRATE names carries the disposable mark (WO-INFRA-012).
// gates.mjs runs it before the first gate that writes to the database: locally the root .env points
// at the persistent development database, and `migrate` (migrations + seed) runs before `test`.
// The mark, and why NODE_ENV is not enough: apps/api/test/db-target.ts.
import pg from 'pg';

export const DISPOSABLE_MARKER = 'adulis:disposable-test-database';

const url = process.env['DATABASE_URL_MIGRATE'];
if (!url) {
  console.error('FAIL  DATABASE_URL_MIGRATE is not set: no default is safe.');
  process.exit(2);
}
const client = new pg.Client({
  connectionString: url,
  options: '-c default_transaction_read_only=on',
});
try {
  await client.connect();
  const { rows } = await client.query(
    `SELECT current_database() AS db, shobj_description(oid, 'pg_database') AS marker
       FROM pg_database WHERE datname = current_database()`,
  );
  if (rows[0]?.marker !== DISPOSABLE_MARKER) {
    console.error(
      `FAIL  database ${rows[0]?.db} is not marked disposable: the gates that write to it refuse.\n` +
        '      Start one: bash ops/scripts/test-db.sh up && eval "$(bash ops/scripts/test-db.sh env)"',
    );
    process.exitCode = 1;
  } else console.log(`  PASS  ${rows[0].db} is marked disposable`);
} catch (e) {
  console.error(`FAIL  could not read the database mark: ${e.message}`);
  process.exitCode = 2;
} finally {
  await client.end().catch(() => {});
}
