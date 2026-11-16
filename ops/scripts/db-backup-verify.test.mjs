// INF-05: db-backup-verify refuses every damaged backup it must, on synthetic fixtures (never a real backup).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compatProblem, defaultList, parseListHeader, parseSums, verifyBackup } from './db-backup-verify.mjs';

const HEADER = (from) => `;\n; Archive created at 2026-11-17 00:00:00 UTC\n;     dbname: adulis\n;     Dumped from database version: ${from}\n;     Dumped by pg_dump version: ${from}\n;\n3001; 0 16400 TABLE DATA core market adulis_bootstrap\n3002; 0 16401 TABLE DATA core device adulis_bootstrap\n`;
const okList = (from = '17.6') => () => ({ status: 0, stdout: HEADER(from), stderr: '' });
const sha = (s) => createHash('sha256').update(s).digest('hex');

function fixture(files, { sums } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'inf05-backup-'));
  for (const [n, c] of Object.entries(files)) writeFileSync(join(dir, n), c);
  const listing = sums ?? Object.entries(files).map(([n, c]) => `${sha(c)} *${n}`).join('\n');
  writeFileSync(join(dir, 'SHA256SUMS.txt'), listing + '\n');
  return dir;
}
const GOOD = { 'adulis.dump': 'PGDMP-a', 'adulis_gates.dump': 'PGDMP-b', 'globals.sql': 'CREATE ROLE adulis_app;\n', 'taken-at.txt': '2026-11-17T00:00:00Z\n' };

test('a complete backup passes', async () => {
  const dir = fixture(GOOD);
  try {
    const r = await verifyBackup(dir, { list: okList(), targetMajor: 17 });
    assert.deepEqual(r.problems, []);
    assert.ok(r.passed.some((p) => p.includes('adulis.dump: readable; dumped from PostgreSQL 17')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a missing file is refused, by name', async () => {
  const { 'adulis_gates.dump': _, ...rest } = GOOD;
  const dir = fixture(rest);
  try {
    const r = await verifyBackup(dir, { list: okList(), targetMajor: 17 });
    assert.ok(r.problems.includes('missing adulis_gates.dump'));
    assert.ok(r.problems.includes('adulis_gates.dump is not listed in SHA256SUMS.txt'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a file listed in SHA256SUMS.txt but missing is refused', async () => {
  const dir = fixture(GOOD, { sums: [...Object.entries(GOOD), ['extra.tar', 'x']].map(([n, c]) => `${sha(c)} *${n}`).join('\n') });
  try {
    const r = await verifyBackup(dir, { list: okList(), targetMajor: 17 });
    assert.ok(r.problems.includes('SHA256SUMS.txt lists extra.tar, which is missing'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a checksum mismatch is refused', async () => {
  const dir = fixture(GOOD);
  try {
    writeFileSync(join(dir, 'adulis.dump'), 'PGDMP-a-changed');
    const r = await verifyBackup(dir, { list: okList(), targetMajor: 17 });
    assert.ok(r.problems.some((p) => p.startsWith('adulis.dump: SHA-256') && p.includes('does not match')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an unreadable archive is refused', async () => {
  const dir = fixture(GOOD);
  try {
    const list = () => ({ status: 1, stdout: '', stderr: 'pg_restore: error: input file does not appear to be a valid archive\n' });
    const r = await verifyBackup(dir, { list, targetMajor: 17 });
    assert.ok(r.problems.some((p) => p.startsWith('adulis.dump: not a readable archive') && p.includes('valid archive')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a dump from a newer server than the target is refused', async () => {
  assert.match(compatProblem(18, 17), /newer than the target server 17/);
  assert.equal(compatProblem(17, 17), null);
  assert.equal(compatProblem(16, 17), null);
  assert.equal(compatProblem(17, null), null);
  assert.match(compatProblem(null, 17), /no "Dumped from database version"/);
  const dir = fixture(GOOD);
  try {
    const r = await verifyBackup(dir, { list: okList('18.1'), targetMajor: 17 });
    assert.ok(r.problems.some((p) => p.includes('dumped from PostgreSQL 18, newer than the target server 17')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an archive without table data, and globals without roles, are refused', async () => {
  const dir = fixture({ ...GOOD, 'globals.sql': '-- nothing\n' });
  try {
    const list = () => ({ status: 0, stdout: ';     Dumped from database version: 17.6\n', stderr: '' });
    const r = await verifyBackup(dir, { list, targetMajor: 17 });
    assert.ok(r.problems.includes('adulis.dump: the archive holds no TABLE DATA entries'));
    assert.ok(r.problems.some((p) => p.startsWith('globals.sql creates no role')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SHA256SUMS.txt must be well formed and name files in the folder only', () => {
  const ok = parseSums(`${'a'.repeat(64)} *adulis.dump\n${'b'.repeat(64)}  globals.sql\n`);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.entries.get('globals.sql'), 'b'.repeat(64));
  assert.ok(parseSums('nonsense\n').problems[0].includes('is not "<sha256> <name>"'));
  assert.ok(parseSums(`${'a'.repeat(64)} *../etc/x\n`).problems[0].includes('names a path'));
  assert.ok(parseSums('').problems.includes('SHA256SUMS.txt is empty'));
});

test('a missing folder or SHA256SUMS.txt is refused', async () => {
  assert.match((await verifyBackup(join(tmpdir(), 'inf05-does-not-exist'), { list: okList() })).problems[0], /not a folder/);
  const dir = mkdtempSync(join(tmpdir(), 'inf05-backup-'));
  try {
    assert.match((await verifyBackup(dir, { list: okList() })).problems[0], /missing SHA256SUMS.txt/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the list header parser reads versions and counts table data', () => {
  const h = parseListHeader(HEADER('17.6'));
  assert.deepEqual(h, { dumpedFromMajor: 17, dumpedByMajor: 17, tableData: 2 });
});

// Real pg_restore on random bytes, when a pg_restore is installed (skipped otherwise).
const pgRestore = process.env.PG_RESTORE || 'pg_restore';
const hasPgRestore = spawnSync(pgRestore, ['--version']).status === 0;
test('a real pg_restore refuses a corrupt archive', { skip: !hasPgRestore && 'no pg_restore on this machine' }, async () => {
  const dir = fixture({ ...GOOD, 'adulis.dump': 'not a pg_dump archive at all' });
  try {
    const r = await verifyBackup(dir, { list: defaultList(pgRestore), targetMajor: 99 });
    assert.ok(r.problems.some((p) => p.startsWith('adulis.dump: not a readable archive')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
