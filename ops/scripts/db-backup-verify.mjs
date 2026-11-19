#!/usr/bin/env node
// INF-05: verifies a development-database backup folder WITHOUT a server and without writing anything.
//
//   node ops/scripts/db-backup-verify.mjs <backup-dir> --target-major <n> [--pg-restore <path>]
//
// The folder holds `adulis.dump` and `adulis_gates.dump` (pg_dump -Fc), `globals.sql` (pg_dumpall
// --globals-only) and `SHA256SUMS.txt` (sha256sum format, `*name` or ` name`), as the WO-INFRA backup and
// docs/infrastructure/WO-INFRA-013-REPAIR-PLAN.md produce. It checks, and says which check failed:
//   1. every expected file exists and is non-empty; every file in the folder is listed in SHA256SUMS.txt
//      (an unlisted file is refused) and is a regular file (a symlink is refused);
//   2. every listed file exists and matches its SHA-256 (a corrupt or swapped file is refused);
//   3. each dump's table of contents is readable (`pg_restore --list`) AND every data block reads to the
//      end (`pg_restore -f -`, output discarded): --list alone passes an archive cut after its TOC or
//      mid-data, which is what a pg_dump killed part-way leaves (INF-05 review B, F1). Neither needs a server;
//   4. each dump's "Dumped from" server major AND "Dumped by" pg_dump major are not newer than --target-major
//      (the server it would be restored into): neither restores reliably into an older server (F3);
//   5. each dump has table data, and globals.sql creates roles.
// PASS means the files are intact and readable offline. It is NOT a restore test: only a restore into a
// disposable server proves that (a dump holding the historical orphans stops at five foreign keys).
// Exit 0 = every check passed, 1 = a check failed, 2 = usage.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED = ['adulis.dump', 'adulis_gates.dump', 'globals.sql'];
export const SUMS = 'SHA256SUMS.txt';

/** Parses sha256sum output. Returns { entries: Map<name, hex>, problems: string[] }. */
export function parseSums(text) {
  const entries = new Map();
  const problems = [];
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([0-9a-f]{64}) [ *](.+)$/i);
    if (!m) { problems.push(`${SUMS} line ${i + 1} is not "<sha256> <name>"`); continue; }
    if (m[2].includes('/') || m[2].includes('\\') || m[2].startsWith('.')) { problems.push(`${SUMS} line ${i + 1} names a path, not a file in the folder: ${m[2]}`); continue; }
    if (entries.has(m[2])) problems.push(`${SUMS} lists ${m[2]} twice`);
    entries.set(m[2], m[1].toLowerCase());
  }
  if (!entries.size && !problems.length) problems.push(`${SUMS} is empty`);
  return { entries, problems };
}

/** Reads the header of `pg_restore --list` output. */
export function parseListHeader(text) {
  const major = (label) => {
    const m = text.match(new RegExp(`^;\\s*${label}:\\s*(\\d+)(?:\\.(\\d+))?`, 'm'));
    return m ? Number(m[1]) : null;
  };
  return {
    dumpedFromMajor: major('Dumped from database version'),
    dumpedByMajor: major('Dumped by pg_dump version'),
    tableData: (text.match(/^\d+;\s+\d+\s+\d+\s+TABLE DATA /gm) || []).length,
  };
}

/** Why a dump made from server `fromMajor` by pg_dump `byMajor` cannot go into server `targetMajor`, or null. */
export function compatProblem(fromMajor, targetMajor, byMajor = fromMajor) {
  if (fromMajor == null) return 'the archive header has no "Dumped from database version"';
  if (byMajor == null) return 'the archive header has no "Dumped by pg_dump version"';
  if (targetMajor == null) return null;
  if (fromMajor > targetMajor) return `dumped from PostgreSQL ${fromMajor}, newer than the target server ${targetMajor}: it will not restore there`;
  if (byMajor > targetMajor) return `written by pg_dump ${byMajor}, newer than the target server ${targetMajor}: not guaranteed to restore there (use pg_dump ${targetMajor})`;
  return null;
}

export async function sha256File(path) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(path)) h.update(chunk);
  return h.digest('hex');
}

const TIMEOUT_MS = 15 * 60 * 1000;

export function defaultList(pgRestore) {
  return (file) => {
    const r = spawnSync(pgRestore, ['--list', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: TIMEOUT_MS });
    if (r.error) return { status: null, stdout: '', stderr: String(r.error.message) };
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  };
}

/** Reads every data block: `pg_restore -f -` with its SQL output discarded. Needs no server. */
export function defaultReadAll(pgRestore) {
  return (file) => {
    const r = spawnSync(pgRestore, ['-f', '-', file], { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8', timeout: TIMEOUT_MS });
    if (r.error) return { status: null, stderr: String(r.error.message) };
    return { status: r.status, stderr: r.stderr };
  };
}

/**
 * Verifies `dir`. `list(file)` returns { status, stdout, stderr } like `pg_restore --list`; `readAll(file)`
 * returns { status, stderr } like `pg_restore -f -`. Never writes.
 */
export async function verifyBackup(dir, { list, readAll, targetMajor = null } = {}) {
  const problems = [];
  const passed = [];
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return { problems: [`not a folder: ${dir}`], passed };
  const sumsPath = join(dir, SUMS);
  if (!existsSync(sumsPath)) return { problems: [`missing ${SUMS}: the backup cannot be checked`], passed };
  const { entries, problems: sumProblems } = parseSums(readFileSync(sumsPath, 'utf8'));
  problems.push(...sumProblems);
  for (const name of EXPECTED) {
    const p = join(dir, name);
    if (!existsSync(p)) problems.push(`missing ${name}`);
    else if (statSync(p).size === 0) problems.push(`${name} is empty`);
    if (!entries.has(name)) problems.push(`${name} is not listed in ${SUMS}`);
  }
  for (const name of readdirSync(dir)) {
    const st = lstatSync(join(dir, name));
    if (st.isSymbolicLink()) problems.push(`${name} is a symbolic link, not a file of the backup`);
    else if (name !== SUMS && !entries.has(name)) problems.push(`${name} is in the folder but not listed in ${SUMS}`);
  }
  for (const [name, want] of entries) {
    const p = join(dir, name);
    if (!existsSync(p)) { problems.push(`${SUMS} lists ${name}, which is missing`); continue; }
    if (lstatSync(p).isSymbolicLink() || !statSync(p).isFile()) continue; // reported above, or a folder: never hashed
    const got = await sha256File(p);
    if (got !== want) problems.push(`${name}: SHA-256 ${got.slice(0, 16)}... does not match ${SUMS} (${want.slice(0, 16)}...)`);
    else passed.push(`${name}: SHA-256 matches`);
  }
  for (const name of EXPECTED.filter((n) => n.endsWith('.dump'))) {
    const p = join(dir, name);
    if (!existsSync(p) || statSync(p).size === 0) continue;
    const r = list(p);
    if (r.status !== 0) { problems.push(`${name}: not a readable archive (pg_restore --list exit ${r.status}: ${(r.stderr || '').trim().split('\n')[0]})`); continue; }
    const h = parseListHeader(r.stdout);
    const c = compatProblem(h.dumpedFromMajor, targetMajor, h.dumpedByMajor);
    if (c) problems.push(`${name}: ${c}`);
    if (h.tableData === 0) problems.push(`${name}: the archive holds no TABLE DATA entries`);
    const all = readAll(p);
    if (all.status !== 0) problems.push(`${name}: a data block does not read to the end (pg_restore -f - exit ${all.status}: ${(all.stderr || '').trim().split('\n')[0]}) -- truncated or corrupt`);
    if (!c && h.tableData > 0 && all.status === 0) passed.push(`${name}: every data block reads; dumped from PostgreSQL ${h.dumpedFromMajor} by pg_dump ${h.dumpedByMajor}; ${h.tableData} table-data entries`);
  }
  const g = join(dir, 'globals.sql');
  if (existsSync(g) && statSync(g).size > 0) {
    if (!/^CREATE ROLE /m.test(readFileSync(g, 'utf8'))) problems.push('globals.sql creates no role (not a pg_dumpall --globals-only file?)');
    else passed.push('globals.sql: creates roles');
  }
  return { problems, passed };
}

const USAGE = 'usage: node ops/scripts/db-backup-verify.mjs <backup-dir> --target-major <n> [--pg-restore <path>]';

async function main(argv) {
  const args = [...argv];
  let dir = null, targetMajor = null, pgRestore = process.env.PG_RESTORE || 'pg_restore';
  while (args.length) {
    const a = args.shift();
    if (a === '--target-major') { targetMajor = Number(args.shift()); if (!Number.isInteger(targetMajor)) { console.error(USAGE); return 2; } }
    else if (a === '--pg-restore') { pgRestore = args.shift(); if (!pgRestore) { console.error(USAGE); return 2; } }
    else if (a === '--help' || a === '-h') { console.log(USAGE); return 0; }
    else if (!dir && !a.startsWith('-')) dir = a;
    else { console.error(`unknown argument: ${a}\n${USAGE}`); return 2; }
  }
  if (!dir || targetMajor == null) { console.error(USAGE); return 2; }
  const { problems, passed } = await verifyBackup(dir, { list: defaultList(pgRestore), readAll: defaultReadAll(pgRestore), targetMajor });
  for (const p of passed) console.log(`  PASS  ${p}`);
  for (const p of problems) console.log(`  FAIL  ${p}`);
  console.log(problems.length ? `FAIL  ${problems.length} problem(s) in ${dir}` : `PASS  backup intact and readable offline (not a restore test): ${dir}`);
  return problems.length ? 1 : 0;
}

// Run as a script only. Both sides are resolved to real paths: through a symlink, a junction or a substituted drive, argv[1] keeps the
// path as typed while the module's own URL is resolved, so a plain comparison runs nothing and exits 0 (a verifier that verifies
// nothing). A file named like this one that cannot be resolved is a refusal, never a silent exit 0.
const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
};
const argv1 = process.argv[1];
if (argv1 && real(argv1) !== null && real(argv1) === real(fileURLToPath(import.meta.url))) {
  process.exitCode = await main(process.argv.slice(2));
} else if (argv1 && real(argv1) === null && basename(argv1) === 'db-backup-verify.mjs') {
  console.error('FAIL  db-backup-verify.mjs could not recognise itself as the script being run; nothing was checked.');
  process.exitCode = 2;
}
