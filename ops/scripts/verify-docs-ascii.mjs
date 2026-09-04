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

/**
 * Enforced. A failure here fails the build.
 *
 * A DOCUMENT IS GOVERNED IF IT GOVERNS *OR* IF A GATE PARSES IT. Those are two
 * different reasons and this list holds both, which is why superseded revisions
 * appear in it: `verify-permission-doc` parses AUTH v2.5 for the 42 codes and
 * 139 grants, and `verify-transcription` parses AUTH v2.6 for the delivery
 * layer. A mangled byte in either corrupts a gate's source of truth rather than
 * merely its prose.
 *
 * [!] T22 FOUND TWO ENTRIES NAMING SUPERSEDED REVISIONS WHILE THE INSTALLED ONES
 * WENT UNCHECKED (D-274): this list said AUTH `v2_6` after v2.7 was installed at
 * T20, and API `v1_10` after v1.11 was installed in the same order. Both files
 * still existed, so `readFile` succeeded and the gate reported PASS -- it was
 * enforcing ASCII on documents nobody reads and not on the documents that
 * govern. The `mustBeCurrent` check below is what makes that shape impossible
 * to repeat: it is the comparator this list never had.
 */
const GOVERNED = [
  'docs/ADU-DB-01_Database_and_Data_Model_v1_16_ASCII.md',
  // T22: AUTH-01 governs at v2.8 for authentication, sessions, recovery,
  // operators and abuse control. v2.6 and v2.5 stay enforced because gates
  // still parse them, NOT because they govern -- see the note above.
  'docs/ADU-AUTH-01_Authentication_and_Authorization_v2_8_ASCII.md',
  'docs/ADU-AUTH-01_Authentication_and_Authorization_v2_6.md',
  'docs/ADU-AUTH-01_Authentication_and_Authorization_v2_5.md',
  'docs/ADU-API-01_API_Contract_v1_11_ASCII.md',
  // T15: ADU-CON-03 arrives ASCII for the first time at v1.3 (v1.2 was a
  // pre-A3.5 supply); governed from this installation.
  'docs/ADU-CON-03_Seller_Console_Content_Architecture_v1_3.md',
  // T14-C: the T13 and contract rulings, ASCII-clean and binding, added to the
  // enforced set so they cannot drift the way carried documents do.
  'docs/ADU-RUL-06_Rulings_on_the_T13_Register.md',
  'docs/ADU-RUL-07_Contract_Rulings.md',
  // T5: ADU-CON-02 becomes GOVERNED at v3.1 -- it was supplied ASCII, so it
  // is enforced rather than merely reported as debt.
  'docs/ADU-CON-02_Seller_Console_System_Design_v3_2_ASCII.md',
  // T7: v1.1 supersedes v1.0 and is GOVERNED with real teeth: S1.1 is
  // machine-read -- verify-deferred-values.mjs parses it and compares it to
  // db/checks/fixtures/deferred-values.json and the live schema, so a
  // corrupted byte here corrupts a gate's source of truth, not just prose.
  'docs/registers/ADU-VAL-01_Deferred_Value_Decisions_Register_v1_2.md',
  // T10: ADU-REPO-01 is GOVERNED from its FIRST installation. It was cited
  // 77 times across 33 files -- including this gate's neighbour, the `deps`
  // gate title -- and existed in no directory until now (D-94, D-140). Its
  // own S0.4 says a structure document that governs a tree it does not live
  // in is a document an agent cannot read.
  'docs/ADU-REPO-01_Repository_Structure_and_Concurrent_Development_v1_3.md',
  // T8: ADU-RUL-03 is GOVERNED from installation, and for a reason the other
  // entries do not have: its S4 carries the age declaration's wording
  // VERBATIM -- the sentence a person is legally bound by, which the console
  // transcribes character for character. A mangled byte in a legal
  // attestation is not a typo, it is an attestation to something else.
  'docs/ADU-RUL-03_Console_Blockers_and_the_NODE_ENV_Class.md',
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

// ---------------------------------------------------------------------------
// THE COMPARATOR THIS LIST NEVER HAD (T22, D-274).
//
// GOVERNED is a hand-maintained transcription of "which revision governs", and
// nothing compared it to the directory. Two entries had gone stale -- AUTH v2.6
// after v2.7 installed, API v1.10 after v1.11 installed -- and the gate passed
// both times, because the superseded file was still on disk and still ASCII.
// The check ran; it just ran on the wrong document.
//
// Two rules, and between them a newly installed revision cannot go unnoticed:
//
//   1. Every governed path EXISTS and is not under docs/superseded/. A
//      superseded revision may be governed only if a gate parses it, and those
//      live in docs/ by deliberate exception (v2.5, v2.6), never in superseded/.
//   2. For every document FAMILY present at the top of docs/, the NEWEST
//      revision on disk is governed. That is the rule that fires the day a new
//      revision is installed and this list is not touched.
// ---------------------------------------------------------------------------
const familyOf = (base) => {
  const m = /^(ADU-[A-Z0-9-]+?)_/.exec(base);
  return m ? m[1] : base;
};
/** Sort key for a revision: v2_10 must beat v2_9, so compare numerically. */
const revOf = (base) => {
  const m = /_v(\d+)_(\d+)/.exec(base);
  return m ? Number(m[1]) * 1000 + Number(m[2]) : -1;
};

/**
 * Every ADU document currently INSTALLED -- all of docs/ except superseded/.
 * Recursive, because a governed document need not sit at the top level:
 * ADU-VAL-01 lives in docs/registers/ and is governed from there.
 */
const walkDocs = async (dir) => {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === 'superseded') continue;
      out.push(...(await walkDocs(path.join(dir, e.name))));
    } else if (e.name.endsWith('.md') && e.name.startsWith('ADU-')) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
};
const installed = await walkDocs(path.join(root, 'docs'));
const installedNames = new Set(installed.map((p) => path.basename(p)));

const governedSet = new Set(GOVERNED.map((r) => path.basename(r)));
const listProblems = [];

for (const rel of GOVERNED) {
  if (rel.includes('/superseded/')) {
    listProblems.push(`${path.basename(rel)} is governed from docs/superseded/`);
    continue;
  }
  if (!installedNames.has(path.basename(rel))) {
    listProblems.push(`${path.basename(rel)} is governed but is not installed under docs/`);
  }
}

const newestByFamily = new Map();
for (const p of installed) {
  const base = path.basename(p);
  const fam = familyOf(base);
  const cur = newestByFamily.get(fam);
  if (!cur || revOf(base) > revOf(cur)) newestByFamily.set(fam, base);
}
for (const [fam, newest] of newestByFamily) {
  // A family with no governed member at all is carried pre-A3.5 debt, which is
  // reported below rather than enforced. This rule only says: IF a family is
  // governed, it must be governed at its NEWEST installed revision.
  const anyGoverned = [...governedSet].some((g) => familyOf(g) === fam);
  if (anyGoverned && !governedSet.has(newest)) {
    listProblems.push(
      `${fam}: docs/ holds ${newest} but the governed entry is ` +
        `${[...governedSet].filter((g) => familyOf(g) === fam).join(', ')}`,
    );
  }
}

console.log('\nA3.5 — ADU specification documents are ASCII\n');
console.log('  the governed list itself:');
if (listProblems.length === 0) {
  console.log(`    PASS  every governed path exists and names the newest installed revision  ${GOVERNED.length} documents`);
} else {
  failures += 1;
  console.log('    FAIL  the governed list has gone stale against docs/');
  for (const p of listProblems) console.log(`          ${p}`);
  console.log('          A gate that checks a superseded revision reports PASS while the');
  console.log('          document that governs is unchecked. Advance the list.');
}

console.log('\n  governed (enforced):');
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

// ---------------------------------------------------------------------------
// A NUL-byte guard over source. Not A3.5, but the same class of fault.
//
// TWICE NOW a template literal in this repository has been written through a
// shell heredoc and had the space inside an interpolation replaced by byte 0.
// IT DOES NOT FAIL LOUDLY: verify-permission-doc kept passing for a whole
// session because BOTH sides of the comparison used the same corrupt
// separator, so the keys matched each other while matching nothing a human
// would ever write. The only outward sign was git reporting the file binary.
//
// A control byte in source is never intentional and scanning for one costs
// nothing. Same argument as check 15 and as the comparator above: the
// corruption that leaves the structure intact is the one nothing else catches.
// ---------------------------------------------------------------------------
const SOURCE_DIRS = ['db', 'ops', 'apps', 'packages', '.github'];
const SOURCE_EXT = /\.(m?[jt]sx?|sql|json|ya?ml|md)$/;
const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage', '.next', '.turbo']);

const walkSrc = async (dir) => {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkSrc(p)));
    else if (SOURCE_EXT.test(e.name)) out.push(p);
  }
  return out;
};

const nulOffenders = [];
let scanned = 0;
for (const d of SOURCE_DIRS) {
  for (const p of await walkSrc(path.join(root, d))) {
    scanned += 1;
    const buf = await readFile(p);
    let n = 0;
    for (const b of buf) if (b === 0) n += 1;
    if (n > 0) nulOffenders.push([path.relative(root, p).replace(/\\/g, '/'), n]);
  }
}

console.log(`\n  NUL-byte guard over ${scanned} source files: ${nulOffenders.length === 0 ? 'clean' : 'FAILED'}`);
for (const [p, n] of nulOffenders) {
  console.log(`    FAIL  ${p} carries ${n} NUL byte(s)`);
  failures += 1;
}
if (nulOffenders.length > 0) {
  console.log('\n  A control byte in source is never intentional. It is almost always a');
  console.log('  template literal written through a shell heredoc, where the space inside');
  console.log('  an interpolation became byte 0. It does not fail loudly: both sides of a');
  console.log('  comparison can share the corrupt separator and agree with each other.');
}

console.log();
if (failures) {
  console.error(`FAIL  ${failures} problem(s): non-ASCII in a governed document, or a NUL byte in source.`);
  console.error('      A3.5: a document that will not survive transit governs nothing.\n');
  process.exit(1);
}
console.log('PASS  governed specifications are ASCII; no source file carries a NUL byte.\n');
