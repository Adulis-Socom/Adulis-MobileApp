#!/usr/bin/env node
/**
 * `pnpm verify:docs-ascii` — AMENDMENT A3.5, made executable.
 *
 * A3.5: "ADU specification documents are ASCII. No character above U+007F
 *  appears in any of them."
 *
 * ADU-AUTH-01 §16.6 had already said load-bearing *data* must be ASCII and left
 * prose exempt. A3.5 withdraws the exemption, and the reasoning is the reason
 * this script exists rather than a note in a README:
 *
 *   "Prose that cannot be installed is not a lesser failure than data that
 *    cannot be read — a document that will not go into docs/ governs nothing,
 *    whatever it says."
 *
 * Three sessions in a row lost documents to transit damage. The rule is the fix;
 * a comparator is what makes a rule hold. Same argument as §16.6's second
 * clause, which `verify-permission-doc` discharges for the matrix.
 *
 * GOVERNED vs CARRIED. The four current binding specifications are ASCII and are
 * enforced. The older documents in docs/ predate A3.5 and were never supplied as
 * ASCII; they are listed as debt on every run rather than silently ignored, and
 * they do not fail the build — failing on a document nobody can currently fix
 * would train everyone to pass `--force`.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

/** Enforced. A failure here fails the build. */
const GOVERNED = [
  'docs/ADU-DB-01_Database_and_Data_Model_v1_10.md',
  'docs/ADU-AUTH-01_Authentication_and_Authorization_v2_4.md',
  'docs/ADU-API-01_API_Contract_v1_6.md',
  'docs/registers/ADU-VAL-01_Deferred_Value_Decisions_Register_v1_0.md',
];

const scan = (buf) => {
  const offenders = new Map();
  let line = 1;
  for (const byte of buf) {
    if (byte === 0x0a) { line += 1; continue; }
    if (byte > 0x7e && byte !== 0x09) {
      if (!offenders.has(byte)) offenders.set(byte, { count: 0, firstLine: line });
      offenders.get(byte).count += 1;
    }
  }
  return offenders;
};

let failures = 0;
console.log('\nA3.5 — ADU specification documents are ASCII\n');
console.log('  governed (enforced):');
for (const rel of GOVERNED) {
  const buf = await readFile(path.join(root, rel));
  const off = scan(buf);
  const total = [...off.values()].reduce((n, o) => n + o.count, 0);
  const ok = total === 0;
  if (!ok) failures += 1;
  console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${path.basename(rel).padEnd(56)} ${
    ok ? `${buf.length.toLocaleString()} bytes, max 0x${buf.reduce((m, b) => (b > m ? b : m), 0).toString(16)}`
       : `${total} non-ASCII byte(s), first at line ${Math.min(...[...off.values()].map((o) => o.firstLine))}`}`);
  if (!ok) {
    for (const [byte, o] of [...off].sort((a, b) => b[1].count - a[1].count).slice(0, 6)) {
      console.log(`            0x${byte.toString(16).padStart(2, '0')} x${o.count}, first line ${o.firstLine}`);
    }
  }
}

// Everything else under docs/ — reported as debt, never a build failure.
const walk = async (dir) => {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
};
const governedAbs = new Set(GOVERNED.map((r) => path.join(root, r)));
const rest = (await walk(path.join(root, 'docs'))).filter((p) => !governedAbs.has(p));

const debt = [];
for (const p of rest) {
  const total = [...scan(await readFile(p)).values()].reduce((n, o) => n + o.count, 0);
  if (total > 0) debt.push([path.relative(root, p).replace(/\\/g, '/'), total]);
}

console.log(`\n  carried, pre-A3.5 (reported, not enforced): ${debt.length} of ${rest.length}`);
for (const [p, n] of debt.sort((a, b) => b[1] - a[1])) {
  console.log(`    DEBT  ${path.basename(p).padEnd(56)} ${n.toLocaleString()} non-ASCII byte(s)`);
}
if (debt.length) {
  console.log('\n  These predate A3.5 and were never supplied as ASCII. They are listed');
  console.log('  every run so the debt stays visible; they become GOVERNED as each is');
  console.log('  reissued. Failing on a document nobody can currently fix would only');
  console.log('  teach everyone to skip this check.');
}

console.log();
if (failures) {
  console.error(`FAIL  ${failures} governed document(s) carry non-ASCII bytes.`);
  console.error('      A3.5: a document that will not survive transit governs nothing.\n');
  process.exit(1);
}
console.log('PASS  every governed specification is ASCII.\n');
