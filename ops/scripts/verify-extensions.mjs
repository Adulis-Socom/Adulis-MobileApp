#!/usr/bin/env node
// Gate D (ADU-CON-02 v3.0 section 18, verification step 1).
//
// The four extensions are not optional and not interchangeable:
//   vector      pgvector, chatbot cascade layer 3 (ADU-DB-01 section 17)
//   btree_gist  makes EXCLUDE USING gist possible, which is the ONLY
//               implementation of the duplicate-reservation invariant
//   pg_trgm     search indexes
//   pgcrypto    digest/gen_random_bytes used by the schema
//
// ADU-DB-01 section 29 records this as a hosting-selection criterion: without
// the first the chatbot cascade has no layer 3; without the second section 9.1's
// duplicate-reservation invariant has no implementation. A provider that
// cannot create all four is disqualified that day.

import pg from 'pg';

const REQUIRED = ['vector', 'btree_gist', 'pg_trgm', 'pgcrypto'];

// Privileged tooling credential first: from Tier 3, DATABASE_URL carries
// adulis_app, which is not provisioned LOGIN until after the migrations -
// and this gate runs before them.
const connectionString = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('FAIL  DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(2);
}

const client = new pg.Client({ connectionString });

try {
  await client.connect();
} catch (err) {
  console.error(`FAIL  cannot connect to the database: ${err.message}`);
  console.error('      Is it up?  docker compose up -d');
  process.exit(2);
}

let present;
try {
  const { rows } = await client.query(
    'SELECT extname, extversion FROM pg_extension WHERE extname = ANY($1::text[])',
    [REQUIRED],
  );
  present = new Map(rows.map((r) => [r.extname, r.extversion]));
} finally {
  await client.end();
}

console.log('Extension     Status  Version');
console.log('------------  ------  -------');
let failed = 0;
for (const name of REQUIRED) {
  const version = present.get(name);
  if (version) {
    console.log(`${name.padEnd(12)}  PASS    ${version}`);
  } else {
    console.log(`${name.padEnd(12)}  FAIL    not installed`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${REQUIRED.length} required extensions missing.`);
  process.exit(1);
}
console.log(`\nAll ${REQUIRED.length} required extensions present.`);
