#!/usr/bin/env node
/**
 * ops/scripts/verify-orphan-sweep.mjs -- gate `orphan-sweep`.
 *
 * ==========================================================================
 * WHAT `session_replication_role = replica` ACTUALLY TURNS OFF
 * ==========================================================================
 * Every trigger. Including the internal constraint triggers that IMPLEMENT
 * referential integrity -- so a teardown that sets it to defeat an append-only
 * guard also defeats `ON DELETE CASCADE` and every `NO ACTION` check, **and it
 * does not error.** The DELETE succeeds, the children are orphaned, and the
 * database keeps rows the foreign key exists to prevent.
 *
 * Of the 31 foreign keys into `core.seller`, four carry `ON DELETE CASCADE`.
 * Under replica those four do not cascade. Nothing says so at the time.
 *
 * ==========================================================================
 * WHY A GATE AND NOT ANOTHER ROUND OF EDITS
 * ==========================================================================
 * This class was fixed at T7 in ten suites. D-128's fix reintroduced it in an
 * eleventh, and the second adversarial round found it as D-134 -- a
 * `seller_public_stats` row left pointing at a seller that no longer existed.
 *
 * **Ten edits are not a rule.** Fixing a class in N places does nothing about
 * the N+1th, because nothing carries the reasoning to a change nobody had
 * written yet. The gate is what carries it.
 *
 * ==========================================================================
 * ENUMERATED, NEVER LISTED
 * ==========================================================================
 * The constraints come from `pg_constraint` at run time. A hardcoded list is
 * the same defect one level up: it would be right on the day it was written
 * and silent about the thirty-second foreign key. Composite keys are handled
 * because `core.seller` carries two composite anchors -- `(id, market_id)` and
 * `(id, owner_account_id)` -- and a sweep that only understood single columns
 * would skip exactly the constraints S9-S12 rely on.
 *
 * IT RUNS AFTER THE SUITE. Replica mode can leave violations the database will
 * not catch on its own, so the only way to know is to ask afterwards -- which
 * is why this is a gate positioned after `test` rather than an assertion
 * inside a teardown.
 *
 * [!] SCOPE, stated because it is narrower than the problem. WORK ORDER T10 S3
 * scopes this to `core.seller`. The identical failure exists one parent over:
 * ten suites end with `DELETE FROM core.market` under replica, and
 * `core.device.market_id` references it -- measured at 6 orphaned device rows
 * before a full run and 9 after (D-135). Adding `'market'` to PARENTS below is
 * the whole change; whether to is the CEO's, not this gate's.
 */
import pg from 'pg';

/** The parent tables swept. T10 S3 names one. See the scope note above. */
const PARENTS = [{ schema: 'core', table: 'seller' }];

const CONNECTION = process.env['DATABASE_URL_MIGRATE'] ?? process.env['DATABASE_URL'];
if (!CONNECTION) {
  console.error('FAIL  DATABASE_URL_MIGRATE is not set. This gate reads the live schema.');
  process.exit(2);
}

console.log('\nOrphan sweep -- every foreign key into the swept parents, enumerated from pg_constraint\n');

const client = new pg.Client({ connectionString: CONNECTION });
await client.connect();

/**
 * One row per foreign key, with its column pairs aggregated in key order.
 * `WITH ORDINALITY` on both `conkey` and `confkey`, joined on the ordinal, is
 * what keeps a composite key's columns paired correctly -- unnesting them
 * separately pairs them by accident of row order.
 */
const { rows: fks } = await client.query(
  `SELECT con.conname                              AS name,
          nsrc.nspname::text                       AS child_schema,
          src.relname::text                        AS child_table,
          array_agg(a.attname::text ORDER BY ck.ord)  AS child_cols,
          array_agg(f.attname::text ORDER BY ck.ord) AS parent_cols,
          ntgt.nspname::text                       AS parent_schema,
          tgt.relname::text                        AS parent_table,
          con.confdeltype                          AS on_delete
     FROM pg_constraint con
     JOIN pg_class src       ON src.oid  = con.conrelid
     JOIN pg_namespace nsrc  ON nsrc.oid = src.relnamespace
     JOIN pg_class tgt       ON tgt.oid  = con.confrelid
     JOIN pg_namespace ntgt  ON ntgt.oid = tgt.relnamespace
     JOIN unnest(con.conkey)  WITH ORDINALITY AS ck(attnum, ord) ON true
     JOIN unnest(con.confkey) WITH ORDINALITY AS pk(attnum, ord) ON pk.ord = ck.ord
     JOIN pg_attribute a ON a.attrelid = con.conrelid  AND a.attnum = ck.attnum
     JOIN pg_attribute f ON f.attrelid = con.confrelid AND f.attnum = pk.attnum
    WHERE con.contype = 'f'
      AND (ntgt.nspname || '.' || tgt.relname) = ANY($1::text[])
    GROUP BY con.conname, nsrc.nspname, src.relname, ntgt.nspname, tgt.relname, con.confdeltype
    ORDER BY nsrc.nspname, src.relname, con.conname`,
  [PARENTS.map((p) => `${p.schema}.${p.table}`)],
);

if (fks.length === 0) {
  console.error(
    `FAIL  no foreign keys found into ${PARENTS.map((p) => `${p.schema}.${p.table}`).join(', ')}. ` +
      'A sweep that finds nothing to sweep is not a green result -- it means the enumeration is wrong ' +
      'or the schema is not migrated.',
  );
  await client.end();
  process.exit(1);
}

const q = (id) => '"' + id.replace(/"/g, '""') + '"';
let orphanTotal = 0;
const offenders = [];

for (const fk of fks) {
  const child = `${q(fk.child_schema)}.${q(fk.child_table)}`;
  const parent = `${q(fk.parent_schema)}.${q(fk.parent_table)}`;
  // A NULL in any child column means the reference is absent, not dangling.
  const notNull = fk.child_cols.map((c) => `ch.${q(c)} IS NOT NULL`).join(' AND ');
  const join = fk.child_cols.map((c, i) => `p.${q(fk.parent_cols[i])} = ch.${q(c)}`).join(' AND ');
  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM ${child} ch
      WHERE ${notNull}
        AND NOT EXISTS (SELECT 1 FROM ${parent} p WHERE ${join})`,
  );
  const n = rows[0].n;
  if (n > 0) {
    orphanTotal += n;
    offenders.push({ ...fk, n });
  }
}

await client.end();

console.log(
  `  swept ${fks.length} foreign key(s) into ` +
    PARENTS.map((p) => `${p.schema}.${p.table}`).join(', ') +
    ` -- ${fks.filter((f) => f.on_delete === 'c').length} of them ON DELETE CASCADE`,
);

if (orphanTotal === 0) {
  console.log('  PASS  zero orphaned rows\n');
  console.log('PASS  every foreign key into the swept parents is satisfied.\n');
  process.exit(0);
}

for (const o of offenders) {
  console.error(
    `  FAIL  ${o.n} orphaned row(s): ${o.child_schema}.${o.child_table}` +
      `(${o.child_cols.join(', ')}) -> ${o.parent_schema}.${o.parent_table}` +
      `(${o.parent_cols.join(', ')})  [${o.name}${o.on_delete === 'c' ? ', ON DELETE CASCADE' : ''}]`,
  );
}
console.error(
  `\nFAIL  ${orphanTotal} orphaned row(s) across ${offenders.length} foreign key(s).\n` +
    '      The database did not refuse these, and it could not have: a delete under\n' +
    '      `session_replication_role = replica` suppresses the constraint triggers that\n' +
    '      implement referential integrity, INCLUDING ON DELETE CASCADE, and raises\n' +
    '      nothing. Find the teardown that deleted a parent and give it its children --\n' +
    '      by id, in dependency order (D-134), and remember that a row a TRIGGER made\n' +
    '      counts: deleting what you created means what your INSERT caused, not only\n' +
    '      what your INSERT named.\n',
);
process.exit(1);
