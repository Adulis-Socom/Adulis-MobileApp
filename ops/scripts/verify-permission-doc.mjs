#!/usr/bin/env node
/**
 * `pnpm verify:permission-doc` — ADU-AUTH-01 v2.4 §16.6, made executable.
 *
 * §16.6, first clause: "Where a value must survive transit, give it twice in
 *  different forms. §16.2 is a table for a human; §16.2a is SQL for a machine;
 *  both come from one generator. Corruption that damages one is visible against
 *  the other."
 *
 * §16.6, SECOND clause — added in v2.4, and this script is what it names:
 *  "A VALUE GIVEN IN TWO FORMS IS NOT VERIFIED UNTIL A COMPARATOR RUNS. Two
 *   forms that nothing compares are two chances to be wrong, not a check.
 *   `pnpm verify:permission-doc` compares all 252 cells of §16.2 against §16.2a
 *   in both directions and is a standing CI gate alongside the Appendix C
 *   checks." 
 *
 * WHY IT EXISTS AT ALL. v2.2 shipped a matrix whose 252 cells all collapsed to
 * one character in transit. It did not fail loudly — the table still parsed, and
 * a reader who had not seen the original would have seeded 252 grants with
 * confidence. The defence against that class of corruption is redundancy plus a
 * comparison, and this is the comparison.
 *
 * It reads only the two files under docs/amendments/. It never touches the
 * database: what it checks is that the DOCUMENT is internally consistent, before
 * anything is seeded from it. The database is checked separately, against the
 * .sql, by apps/api/test/permission-matrix.spec.ts.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const SQL_FILE = path.join(root, 'docs/amendments/ADU-AUTH-01_v2_4_permission_seed.sql');
const DOC_FILE = path.join(root, 'docs/ADU-AUTH-01_Authentication_and_Authorization_v2_5.md');

const ROLES = ['OWNER', 'ADMIN', 'SALES_SUPPORT', 'INVENTORY', 'ANALYST', 'CAMPAIGN_MANAGER'];
const PER_ROLE = { OWNER: 42, ADMIN: 40, SALES_SUPPORT: 19, INVENTORY: 16, ANALYST: 10, CAMPAIGN_MANAGER: 12 };
const STEP_UP = [
  'seller.account:delete', 'seller.identity:manage', 'seller.orders:reissue_instructions',
  'seller.ownership:transfer', 'seller.payout:update', 'seller.sessions:revoke_all',
  'seller.staff:admin', 'seller.subscription:update',
];

const failures = [];
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

// --- §16.2a, the generated SQL ----------------------------------------------
function parseSql(sql) {
  const permBlock = sql.split('INSERT INTO core.permission')[1].split(';')[0];
  const grantBlock = sql.split('INSERT INTO core.role_permission')[1].split(';')[0];

  const permissions = new Map();
  const permRe = /\('([^']+)',\s*ARRAY\[([^\]]*)\]::core\.session_audience\[\],\s*(true|false)\)/g;
  for (let m = permRe.exec(permBlock); m !== null; m = permRe.exec(permBlock)) {
    permissions.set(m[1], {
      surfaces: m[2].split(',').map((x) => x.trim().replace(/'/g, '')),
      stepUp: m[3] === 'true',
    });
  }

  const grants = new Set();
  const grantRe = /\('([A-Z_]+)',\s*'([^']+)'\)/g;
  for (let m = grantRe.exec(grantBlock); m !== null; m = grantRe.exec(grantBlock)) {
    grants.add(`${m[1]} ${m[2]}`);
  }
  return { permissions, grants };
}

// --- §16.2, the ASCII table -------------------------------------------------
function parseDoc(md) {
  const permissions = new Map();
  const grants = new Set();
  // | Group | `code` | Step-up | Own | Adm | Sal | Inv | Ana | Cam |
  const rowRe = /^\|[^|]*\|\s*`([a-z_.:]+)`\s*\|\s*(YES)?\s*\|((?:\s*[Y.]\s*\|){6})\s*$/gm;
  for (let m = rowRe.exec(md); m !== null; m = rowRe.exec(md)) {
    const code = m[1];
    const cells = m[3].split('|').map((c) => c.trim()).filter((c) => c !== '');
    if (cells.length !== 6) continue;
    permissions.set(code, { stepUp: m[2] === 'YES' });
    cells.forEach((c, i) => {
      if (c === 'Y') grants.add(`${ROLES[i]} ${code}`);
    });
  }
  return { permissions, grants };
}

const [sqlText, docText] = await Promise.all([
  readFile(SQL_FILE, 'utf8'),
  readFile(DOC_FILE, 'utf8'),
]);
const sql = parseSql(sqlText);
const doc = parseDoc(docText);

console.log('\nADU-AUTH-01 v2.4 - section 16.2 (table) against section 16.2a (SQL)\n');

check('the ASCII table parsed 42 rows', doc.permissions.size === 42, `${doc.permissions.size}`);
check('the generated SQL parsed 42 permissions', sql.permissions.size === 42, `${sql.permissions.size}`);
check('the generated SQL parsed 139 grants', sql.grants.size === 139, `${sql.grants.size}`);
check('the ASCII table parsed 139 grants', doc.grants.size === 139, `${doc.grants.size}`);

const codesOnlyInDoc = [...doc.permissions.keys()].filter((c) => !sql.permissions.has(c));
const codesOnlyInSql = [...sql.permissions.keys()].filter((c) => !doc.permissions.has(c));
check('the same 42 codes appear in both', !codesOnlyInDoc.length && !codesOnlyInSql.length,
  codesOnlyInDoc.length || codesOnlyInSql.length
    ? `table-only ${JSON.stringify(codesOnlyInDoc)} sql-only ${JSON.stringify(codesOnlyInSql)}` : '');

const onlyDoc = [...doc.grants].filter((g) => !sql.grants.has(g));
const onlySql = [...sql.grants].filter((g) => !doc.grants.has(g));
const fmt = (s) => s.map((g) => g.replace(' ', ' ')).sort().join(', ');
check('all 252 cells agree, both directions', !onlyDoc.length && !onlySql.length,
  onlyDoc.length || onlySql.length ? `\n        table-only: ${fmt(onlyDoc)}\n        sql-only:   ${fmt(onlySql)}` : '');

const stepDoc = [...doc.permissions].filter(([, v]) => v.stepUp).map(([c]) => c).sort();
const stepSql = [...sql.permissions].filter(([, v]) => v.stepUp).map(([c]) => c).sort();
check('the same eight step-up codes in both', JSON.stringify(stepDoc) === JSON.stringify(stepSql));
check('and they are the eight of section 16.3', JSON.stringify(stepSql) === JSON.stringify(STEP_UP));

for (const role of ROLES) {
  const n = [...sql.grants].filter((g) => g.startsWith(`${role} `)).length;
  check(`${role.padEnd(17)} holds ${PER_ROLE[role]}`, n === PER_ROLE[role], `got ${n}`);
}

check('every step-up permission is CONSOLE-only',
  [...sql.permissions].every(([, v]) => !v.stepUp || (v.surfaces.length === 1 && v.surfaces[0] === 'CONSOLE')));
check('twelve permissions are mobile-reachable',
  [...sql.permissions].filter(([, v]) => v.surfaces.includes('MOBILE')).length === 12);

const analyst = [...sql.grants].filter((g) => g.startsWith('ANALYST ')).map((g) => g.split(' ')[1]);
check('ANALYST holds zero writes',
  analyst.every((c) => ['read', 'export'].includes(c.split(':')[1])),
  `held: ${analyst.filter((c) => !['read', 'export'].includes(c.split(':')[1])).join(', ') || 'none'}`);

const owner = new Set([...sql.grants].filter((g) => g.startsWith('OWNER ')).map((g) => g.split(' ')[1]));
const admin = new Set([...sql.grants].filter((g) => g.startsWith('ADMIN ')).map((g) => g.split(' ')[1]));
check('OWNER holds all 42', owner.size === 42);
check('ADMIN lacks exactly delete and ownership transfer',
  JSON.stringify([...owner].filter((c) => !admin.has(c)).sort())
    === JSON.stringify(['seller.account:delete', 'seller.ownership:transfer']));

console.log();
if (failures.length) {
  console.error(`FAIL  ${failures.length} check(s) failed. The two forms of section 16.2 disagree,`);
  console.error('      which is exactly what having two forms is for. Do not seed from either');
  console.error('      until the document is corrected.\n');
  process.exit(1);
}
console.log('PASS  the table and the SQL agree in all 252 cells, both directions.\n');
