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
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * The five keys today's API suites still leave orphans on, measured on a fresh disposable database
 * (WO-INFRA-012: 201 keys hold before a full run, these five break after it). Each is a teardown
 * that deletes a parent under `replica` without its children; the files are listed in
 * ISSUE-INFRA-CLOSURE-004. A ratchet, not an exemption: any OTHER key with an orphan fails the
 * gate, and each line here is deleted when its teardowns are fixed. Never add one to pass a run.
 */
//
// COUNTED, NOT ONLY NAMED (WO-INFRA-015B). Each known leak carries the most orphaned rows it may
// leave (`maxRows`): a suite that starts leaking MORE on a known key fails like a new key does.
// maxRows is the count measured after a full API run on the line with the most suites (the closure
// line; this line's suites are a subset, so its counts are lower). Never raise it to pass a run.
// Measured 2026-11-13: one full run on a fresh disposable database left 35 rows; repeated runs on the
// same database add exactly the same counts again, so they are deterministic.
export const KNOWN_TEST_LEAKS = {
  'core.otp_delivery_attempt.otp_delivery_attempt_otp_challenge_id_fkey': {
    reason: '19 suites delete core.otp_challenge, never its delivery attempts',
    maxRows: 23,
  },
  'core.order_state_transition.order_state_transition_order_id_fkey': {
    reason: '8 suites delete core."order" under replica, never its transitions',
    maxRows: 2,
  },
  'core.claim_evidence_item.claim_evidence_item_claim_id_fkey': {
    reason: 't6-closure-survives-block deletes core.claim, never its evidence items',
    maxRows: 3,
  },
  'core.device.device_market_id_fkey': {
    reason: 'c6-accounts deletes its market under replica; the API created devices in it',
    maxRows: 3,
  },
  'core.notification.notification_recipient_account_id_fkey': {
    reason: 't26 and disc-001 delete accounts that still have notifications',
    maxRows: 4,
  },
};

/**
 * Splits a report into failures, tolerated known leaks, counts below their maximum, and known keys
 * with no orphan left. Pure, so the ratchet is testable. A failure is an orphan on a key not in
 * `allowed`, or more orphans on a known key than its maxRows; an entry without a usable maxRows
 * tolerates nothing (fails closed).
 */
export function judge(report, allowed = {}) {
  // Own keys only (`in` would follow the prototype chain), keyed by schema.table.constraint: a
  // constraint name is unique per table, not per database (review).
  const limit = (r) => {
    if (!Object.hasOwn(allowed, r.key)) return null;
    const max = allowed[r.key]?.maxRows;
    return Number.isInteger(max) && max >= 0 ? max : null;
  };
  const failures = [];
  const tolerated = [];
  const lowered = [];
  for (const r of report) {
    const max = limit(r);
    if (max === null) failures.push(r);
    else if (r.count > max) failures.push({ ...r, exceeded: max });
    else {
      tolerated.push(r);
      if (r.count < max) lowered.push({ key: r.key, count: r.count, maxRows: max });
    }
  }
  const seen = new Set(report.map((r) => r.key));
  const gone = Object.keys(allowed).filter((k) => !seen.has(k));
  return { failures, tolerated, lowered, gone };
}

const q = (id) => '"' + id.replace(/"/g, '""') + '"';

async function audit(connection) {
  const client = new pg.Client({
    connectionString: connection,
    // row_security=off: row-level security makes a query ERROR instead of silently hiding rows from
    // a non-owner role, so an audit through a restricted credential exits 2, never a false PASS.
    options: '-c default_transaction_read_only=on -c row_security=off',
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
          key: `${fk.child_schema}.${fk.child_table}.${fk.name}`,
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
  const { failures, tolerated, lowered, gone } = judge(result.report, allowed);
  console.log(`\nForeign-key audit -- ${result.keys} keys, read-only session\n`);
  for (const r of failures)
    console.log(
      r.exceeded === undefined
        ? `  FAIL  ${r.constraint}: ${r.count} row(s) in ${r.child} with no ${r.parent}${r.validated ? ' (marked validated)' : ''}`
        : `  FAIL  ${r.constraint}: ${r.count} row(s), more than the ${r.exceeded} this known leak may leave -- a suite now leaks more`,
    );
  for (const r of tolerated)
    console.log(
      `  KNOWN ${r.constraint}: ${r.count} of at most ${allowed[r.key].maxRows} row(s) -- ${allowed[r.key].reason} (ISSUE-INFRA-CLOSURE-004)`,
    );
  // Informational: a lower count or a vanished key means cleanup improved (or fewer suites ran);
  // lower maxRows in KNOWN_TEST_LEAKS once the full suite confirms it.
  for (const l of lowered)
    console.log(`  NOTE  ${l.key}: ${l.count} row(s), below its maximum of ${l.maxRows}.`);
  for (const k of gone)
    console.log(`  NOTE  ${k}: no orphan left; remove it from KNOWN_TEST_LEAKS once confirmed.`);
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
// Run by name but not recognised as itself: fail loudly instead of exiting 0 having audited nothing
// (WO-INFRA-015B, PR105-F11). The Jest teardown also requires the PASS line.
else if (process.argv[1] && basename(process.argv[1]) === 'fk-audit.mjs') {
  console.error(
    'FAIL  fk-audit.mjs could not recognise itself as the script being run; nothing was audited.',
  );
  process.exit(2);
}
