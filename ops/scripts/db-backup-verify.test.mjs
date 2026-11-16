// INF-05: db-backup-verify refuses every damaged backup it must, on synthetic fixtures (never a real backup).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compatProblem, defaultList, defaultReadAll, parseListHeader, parseSums, verifyBackup } from './db-backup-verify.mjs';

const HEADER = (from, by = from) => `;\n; Archive created at 2026-11-17 00:00:00 UTC\n;     dbname: adulis\n;     Dumped from database version: ${from}\n;     Dumped by pg_dump version: ${by}\n;\n3001; 0 16400 TABLE DATA core market adulis_bootstrap\n3002; 0 16401 TABLE DATA core device adulis_bootstrap\n`;
const okList = (from = '17.6', by = from) => () => ({ status: 0, stdout: HEADER(from, by), stderr: '' });
const okRead = () => ({ status: 0, stderr: '' });
const opts = (extra = {}) => ({ list: okList(), readAll: okRead, targetMajor: 17, ...extra });
const sha = (s) => createHash('sha256').update(s).digest('hex');

function fixture(files, { sums } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'inf05-backup-'));
  for (const [n, c] of Object.entries(files)) writeFileSync(join(dir, n), c);
  const listing = sums ?? Object.entries(files).map(([n, c]) => `${sha(c)} *${n}`).join('\n');
  writeFileSync(join(dir, 'SHA256SUMS.txt'), listing + '\n');
  return dir;
}
async function check(files, extra, fixtureOpts) {
  const dir = fixture(files, fixtureOpts);
  try { return await verifyBackup(dir, opts(extra)); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const GOOD = { 'adulis.dump': 'PGDMP-a', 'adulis_gates.dump': 'PGDMP-b', 'globals.sql': 'CREATE ROLE adulis_app;\n', 'taken-at.txt': '2026-11-17T00:00:00Z\n' };

test('a complete backup passes', async () => {
  const r = await check(GOOD);
  assert.deepEqual(r.problems, []);
  assert.ok(r.passed.some((p) => p.includes('adulis.dump: every data block reads; dumped from PostgreSQL 17')));
});

test('a missing file is refused, by name', async () => {
  const { 'adulis_gates.dump': _, ...rest } = GOOD;
  const r = await check(rest);
  assert.ok(r.problems.includes('missing adulis_gates.dump'));
  assert.ok(r.problems.includes('adulis_gates.dump is not listed in SHA256SUMS.txt'));
});

test('a file listed in SHA256SUMS.txt but missing is refused', async () => {
  const r = await check(GOOD, {}, { sums: [...Object.entries(GOOD), ['extra.tar', 'x']].map(([n, c]) => `${sha(c)} *${n}`).join('\n') });
  assert.ok(r.problems.includes('SHA256SUMS.txt lists extra.tar, which is missing'));
});

test('a file in the folder but not in SHA256SUMS.txt is refused (review B, F2)', async () => {
  const r = await check({ ...GOOD, 'minio-volume.tar': 'garbage' }, {}, { sums: Object.entries(GOOD).map(([n, c]) => `${sha(c)} *${n}`).join('\n') });
  assert.ok(r.problems.includes('minio-volume.tar is in the folder but not listed in SHA256SUMS.txt'));
});

test('a checksum mismatch is refused', async () => {
  const dir = fixture(GOOD);
  try {
    writeFileSync(join(dir, 'adulis.dump'), 'PGDMP-a-changed');
    const r = await verifyBackup(dir, opts());
    assert.ok(r.problems.some((p) => p.startsWith('adulis.dump: SHA-256') && p.includes('does not match')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an unreadable table of contents is refused', async () => {
  const list = () => ({ status: 1, stdout: '', stderr: 'pg_restore: error: input file does not appear to be a valid archive\n' });
  const r = await check(GOOD, { list });
  assert.ok(r.problems.some((p) => p.startsWith('adulis.dump: not a readable archive') && p.includes('valid archive')));
});

test('a dump whose data blocks do not read to the end is refused, although its TOC reads (review B, F1)', async () => {
  const readAll = (f) => (f.endsWith('adulis.dump') ? { status: 1, stderr: 'pg_restore: error: could not read from input file: end of file\n' } : okRead());
  const r = await check(GOOD, { readAll });
  assert.ok(r.problems.some((p) => p.startsWith('adulis.dump: a data block does not read to the end') && p.includes('end of file')));
  assert.ok(!r.passed.some((p) => p.startsWith('adulis.dump: every data block reads')));
});

test('a dump from, or written by, a newer PostgreSQL than the target is refused (review B, F3)', async () => {
  assert.match(compatProblem(18, 17), /newer than the target server 17/);
  assert.match(compatProblem(17, 17, 18), /written by pg_dump 18, newer than the target server 17/);
  assert.equal(compatProblem(17, 17), null);
  assert.equal(compatProblem(16, 17, 17), null);
  assert.equal(compatProblem(17, null), null);
  assert.match(compatProblem(null, 17), /no "Dumped from database version"/);
  assert.match(compatProblem(17, 17, null), /no "Dumped by pg_dump version"/);
  const r = await check(GOOD, { list: okList('17.6', '18.1') });
  assert.ok(r.problems.some((p) => p.includes('written by pg_dump 18, newer than the target server 17')));
});

test('an archive without table data, and globals without roles, are refused', async () => {
  const list = () => ({ status: 0, stdout: ';     Dumped from database version: 17.6\n;     Dumped by pg_dump version: 17.6\n', stderr: '' });
  const r = await check({ ...GOOD, 'globals.sql': '-- nothing\n' }, { list });
  assert.ok(r.problems.includes('adulis.dump: the archive holds no TABLE DATA entries'));
  assert.ok(r.problems.some((p) => p.startsWith('globals.sql creates no role')));
});

test('SHA256SUMS.txt must be well formed and name files in the folder only', () => {
  const ok = parseSums(`${'a'.repeat(64)} *adulis.dump\r\n${'b'.repeat(64)}  globals.sql\n`);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.entries.get('globals.sql'), 'b'.repeat(64));
  assert.ok(parseSums('nonsense\n').problems[0].includes('is not "<sha256> <name>"'));
  assert.ok(parseSums(`${'a'.repeat(64)} *../etc/x\n`).problems[0].includes('names a path'));
  assert.ok(parseSums('').problems.includes('SHA256SUMS.txt is empty'));
});

test('a missing folder or SHA256SUMS.txt is refused', async () => {
  assert.match((await verifyBackup(join(tmpdir(), 'inf05-does-not-exist'), opts())).problems[0], /not a folder/);
  const dir = mkdtempSync(join(tmpdir(), 'inf05-backup-'));
  try {
    assert.match((await verifyBackup(dir, opts())).problems[0], /missing SHA256SUMS.txt/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the list header parser reads both versions and counts table data', () => {
  assert.deepEqual(parseListHeader(HEADER('17.6', '18.1')), { dumpedFromMajor: 17, dumpedByMajor: 18, tableData: 2 });
});

test('the command line requires --target-major', () => {
  const script = fileURLToPath(new URL('./db-backup-verify.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [script, tmpdir()], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--target-major <n>/);
});

// Real pg_restore on random bytes, when a pg_restore is installed (skipped otherwise).
const pgRestore = process.env.PG_RESTORE || 'pg_restore';
const hasPgRestore = spawnSync(pgRestore, ['--version']).status === 0;
test('a real pg_restore refuses a corrupt archive', { skip: !hasPgRestore && 'no pg_restore on this machine' }, async () => {
  const dir = fixture({ ...GOOD, 'adulis.dump': 'not a pg_dump archive at all' });
  try {
    const r = await verifyBackup(dir, { list: defaultList(pgRestore), readAll: defaultReadAll(pgRestore), targetMajor: 99 });
    assert.ok(r.problems.some((p) => p.startsWith('adulis.dump: not a readable archive')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
