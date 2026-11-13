#!/usr/bin/env node
/**
 * ops/scripts/fk-audit.mjs -- every foreign key, checked for rows that break it (WO-INFRA-012/013).
 *
 *   node ops/scripts/fk-audit.mjs [--json <file>]            # strict: any orphan fails
 *   node ops/scripts/fk-audit.mjs --known-test-leaks         # gate `fk-integrity`, after the suites
 *
 * Connects with DATABASE_URL_MIGRATE, else DATABASE_URL.
 *
 * The `orphan-sweep` gate enumerates the keys into core.seller; this enumerates all of them the same
 * way (pg_constraint, column pairs joined on ordinal), because `session_replication_role = replica`
 * switches off every foreign key, not only those. A violating row is one whose key columns are all
 * non-NULL (MATCH SIMPLE) with no parent row. PostgreSQL still marks such a key as validated: it
 * checked once, at creation, and the triggers that keep it true were off when the parent went.
 *
 * READ-ONLY: the session is opened with default_transaction_read_only=on and refuses to continue
 * unless the server confirms it, so it is safe against the persistent development database.
 * Exit 0: every key holds (or, with --known-test-leaks, only the keys below leak). 1: violations.
 * 2: could not audit.
 */
import { realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * The five keys today's API suites still leave orphans on, measured on a fresh disposable database
 * (WO-INFRA-012: 201 keys hold before a full run, these five break after it). Each is a teardown
 * that deletes a parent under `replica` without its children; the files are listed in
 * ISSUE-INFRA-CLOSURE-004. A ratchet, not an exemption: any OTHER key with an orphan fails the
 * gate, and each line here is deleted when its teardowns are fixed. Never add one to pass a run.
 */
export const KNOWN_TEST_LEAKS = {
  otp_delivery_attempt_otp_challenge_id_fkey:
    '19 suites delete core.otp_challenge, never its delivery attempts',
  order_state_transition_order_id_fkey:
    '8 suites delete core."order" under replica, never its transitions',
  claim_evidence_item_claim_id_fkey:
    't6-closure-survives-block deletes core.claim, never its evidence items',
  device_market_id_fkey:
    'c6-accounts deletes its market under replica; the API created devices in it',
  notification_recipient_account_id_fkey:
    't26 and disc-001 delete accounts that still have notifications',
};

/** Splits a report into failures and tolerated known leaks. Pure, so the ratchet is testable. */
export function judge(report, allowed = {}) {
  return {
    failures: report.filter((r) => !(r.constraint in allowed)),
    tolerated: report.filter((r) => r.constraint in allowed),
  };
}

const q = (id) => '"' + id.replace(/"/g, '""') + '"';

async function audit(connection) {
  const client = new pg.Client({
    connectionString: connection,
    options: '-c default_transaction_read_only=on',
  });
  await client.connect();
  try {
    const ro = await client.query('SHOW default_transaction_read_only');
    if (ro.rows[0]?.default_transaction_read_only !== 'on')
      throw new Error('the session is not read-only; refusing to continue');
    // One row per foreign key (partition copies excluded), its column pairs in key order, and the
    // child's primary key so each orphan can be named.
    const { rows: fks } = await client.query(
      `SELECT con.conname AS name, con.convalidated AS validated,
              nsrc.nspname::text AS child_schema, src.relname::text AS child_table,
              array_agg(a.attname::text ORDER BY ck.ord) AS child_cols,
              array_agg(f.attname::text ORDER BY ck.ord) AS parent_cols,
              ntgt.nspname::text AS parent_schema, tgt.relname::text AS parent_table,
              (SELECT array_agg(pa.attname::text ORDER BY k.ord)
                 FROM pg_index i
                 JOIN unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
                 JOIN pg_attribute pa ON pa.attrelid = i.indrelid AND pa.attnum = k.attnum
                WHERE i.indrelid = con.conrelid AND i.indisprimary) AS child_pk
         FROM pg_constraint con
         JOIN pg_class src      ON src.oid  = con.conrelid
         JOIN pg_namespace nsrc ON nsrc.oid = src.relnamespace
         JOIN pg_class tgt      ON tgt.oid  = con.confrelid
         JOIN pg_namespace ntgt ON ntgt.oid = tgt.relnamespace
         JOIN unnest(con.conkey)  WITH ORDINALITY AS ck(attnum, ord) ON true
         JOIN unnest(con.confkey) WITH ORDINALITY AS pk(attnum, ord) ON pk.ord = ck.ord
         JOIN pg_attribute a ON a.attrelid = con.conrelid  AND a.attnum = ck.attnum
         JOIN pg_attribute f ON f.attrelid = con.confrelid AND f.attnum = pk.attnum
        WHERE con.contype = 'f' AND con.conparentid = 0
        GROUP BY con.oid, con.conname, con.convalidated, con.conrelid,
                 nsrc.nspname, src.relname, ntgt.nspname, tgt.relname
        ORDER BY nsrc.nspname, src.relname, con.conname`,
    );
    if (fks.length === 0)
      throw new Error(
        'no foreign keys found: the schema is not migrated, or the enumeration is wrong',
      );
    const report = [];
    for (const fk of fks) {
      const notNull = fk.child_cols.map((c) => `c.${q(c)} IS NOT NULL`).join(' AND ');
      const join = fk.child_cols
        .map((c, i) => `p.${q(fk.parent_cols[i])} = c.${q(c)}`)
        .join(' AND ');
      const pkCols = fk.child_pk ?? fk.child_cols;
      const { rows } = await client.query(
        `SELECT ${pkCols.map((c) => `c.${q(c)}::text AS ${q(c)}`).join(', ')}
           FROM ${q(fk.child_schema)}.${q(fk.child_table)} c
          WHERE ${notNull}
            AND NOT EXISTS (SELECT 1 FROM ${q(fk.parent_schema)}.${q(fk.parent_table)} p WHERE ${join})`,
      );
      if (rows.length)
        report.push({
          constraint: fk.name,
          child: `${fk.child_schema}.${fk.child_table}(${fk.child_cols.join(', ')})`,
          parent: `${fk.parent_schema}.${fk.parent_table}(${fk.parent_cols.join(', ')})`,
          validated: fk.validated,
          count: rows.length,
          orphans: rows,
        });
    }
    return { keys: fks.length, report };
  } finally {
    await client.end();
  }
}

async function main() {
  const connection = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
  const jsonAt = process.argv.indexOf('--json');
  const jsonFile = jsonAt === -1 ? null : process.argv[jsonAt + 1];
  if (!connection || (jsonAt !== -1 && !jsonFile)) {
    console.error(
      !connection
        ? 'FAIL  DATABASE_URL_MIGRATE (or DATABASE_URL) is not set.'
        : 'FAIL  --json needs a file name.',
    );
    process.exit(2);
  }
  let result;
  try {
    result = await audit(connection);
  } catch (e) {
    console.error(`FAIL  could not audit: ${e.message}`);
    process.exit(2);
  }
  const allowed = process.argv.includes('--known-test-leaks') ? KNOWN_TEST_LEAKS : {};
  const { failures, tolerated } = judge(result.report, allowed);
  console.log(`\nForeign-key audit -- ${result.keys} keys, read-only session\n`);
  for (const r of failures)
    console.log(
      `  FAIL  ${r.constraint}: ${r.count} row(s) in ${r.child} with no ${r.parent}${r.validated ? ' (marked validated)' : ''}`,
    );
  for (const r of tolerated)
    console.log(
      `  KNOWN ${r.constraint}: ${r.count} row(s) -- ${allowed[r.constraint]} (ISSUE-INFRA-CLOSURE-004)`,
    );
  if (jsonFile) writeFileSync(jsonFile, JSON.stringify(result.report, null, 2));
  const rows = (list) => list.reduce((s, r) => s + r.count, 0);
  if (failures.length)
    console.log(`\nFAIL  ${rows(failures)} orphaned row(s) across ${failures.length} key(s).`);
  else
    console.log(
      `PASS  all ${result.keys} foreign keys hold${tolerated.length ? `, apart from ${tolerated.length} known test leak(s) (${rows(tolerated)} rows)` : ''}.`,
    );
  process.exit(failures.length ? 1 : 0);
}

// Run as a script only (fk-audit.test.mjs imports judge); realpath'd as in gates.mjs.
const self = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
};
if (process.argv[1] && self(process.argv[1]) === self(fileURLToPath(import.meta.url))) main();
