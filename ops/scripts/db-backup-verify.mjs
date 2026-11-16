#!/usr/bin/env node
// INF-05: verifies a development-database backup folder WITHOUT a server and without writing anything.
//
//   node ops/scripts/db-backup-verify.mjs <backup-dir> [--target-major <n>] [--pg-restore <path>]
//
// The folder holds `adulis.dump` and `adulis_gates.dump` (pg_dump -Fc), `globals.sql` (pg_dumpall
// --globals-only) and `SHA256SUMS.txt` (sha256sum format, `*name` or ` name`), as the WO-INFRA backup and
// docs/infrastructure/WO-INFRA-013-REPAIR-PLAN.md produce. It checks, and says which check failed:
//   1. every expected file exists and is non-empty, and every file is listed in SHA256SUMS.txt;
//   2. every listed file exists and matches its SHA-256 (a corrupt or swapped file is refused);
//   3. each dump is a readable archive: `pg_restore --list` (reads the file only, needs no server);
//   4. each dump's "Dumped from database version" major is not newer than --target-major (the server it
//      would be restored into: a newer dump does not restore into an older server);
//   5. each dump has table data, and globals.sql creates roles.
// Exit 0 = every check passed, 1 = a check failed, 2 = usage.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

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

/** Why a dump made from server `fromMajor` cannot go into server `targetMajor`, or null. */
export function compatProblem(fromMajor, targetMajor) {
  if (fromMajor == null) return 'the archive header has no "Dumped from database version"';
  if (targetMajor == null) return null;
  if (fromMajor > targetMajor) return `dumped from PostgreSQL ${fromMajor}, newer than the target server ${targetMajor}: it will not restore there`;
  return null;
}

export async function sha256File(path) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(path)) h.update(chunk);
  return h.digest('hex');
}

export function defaultList(pgRestore) {
  return (file) => {
    const r = spawnSync(pgRestore, ['--list', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.error) return { status: null, stdout: '', stderr: String(r.error.message) };
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  };
}

/** Verifies `dir`. `list(file)` returns { status, stdout, stderr } like `pg_restore --list`. Never writes. */
export async function verifyBackup(dir, { list, targetMajor = null } = {}) {
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
  for (const [name, want] of entries) {
    const p = join(dir, name);
    if (!existsSync(p)) { problems.push(`${SUMS} lists ${name}, which is missing`); continue; }
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
    const c = compatProblem(h.dumpedFromMajor, targetMajor);
    if (c) problems.push(`${name}: ${c}`);
    if (h.tableData === 0) problems.push(`${name}: the archive holds no TABLE DATA entries`);
    if (!c && h.tableData > 0) passed.push(`${name}: readable; dumped from PostgreSQL ${h.dumpedFromMajor} by pg_dump ${h.dumpedByMajor}; ${h.tableData} table-data entries`);
  }
  const g = join(dir, 'globals.sql');
  if (existsSync(g) && statSync(g).size > 0) {
    if (!/^CREATE ROLE /m.test(readFileSync(g, 'utf8'))) problems.push('globals.sql creates no role (not a pg_dumpall --globals-only file?)');
    else passed.push('globals.sql: creates roles');
  }
  return { problems, passed };
}

const USAGE = 'usage: node ops/scripts/db-backup-verify.mjs <backup-dir> [--target-major <n>] [--pg-restore <path>]';

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
  if (!dir) { console.error(USAGE); return 2; }
  const { problems, passed } = await verifyBackup(dir, { list: defaultList(pgRestore), targetMajor });
  for (const p of passed) console.log(`  PASS  ${p}`);
  for (const p of problems) console.log(`  FAIL  ${p}`);
  console.log(problems.length ? `FAIL  ${problems.length} problem(s) in ${dir}` : `PASS  backup verified: ${dir}${targetMajor == null ? ' (no --target-major: version compatibility not judged)' : ''}`);
  return problems.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = await main(process.argv.slice(2));
