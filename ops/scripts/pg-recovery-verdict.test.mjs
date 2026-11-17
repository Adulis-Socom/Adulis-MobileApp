// INF-CLOSE-01: the post-crash verdict fails closed on startup failures and ignores routine client errors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classify } from './pg-recovery-verdict.mjs';

const L = (m) => `2026-11-17 08:28:00.000 UTC [29] ${m}`;
// The real adulis-postgres startup after the 16 November power loss (log prefix shortened).
const RECOVERY = [
  'PostgreSQL Database directory appears to contain a database; Skipping initialization',
  L('LOG:  starting PostgreSQL 17.11 (Debian 17.11-1.pgdg12+2) on x86_64-pc-linux-gnu'),
  L('LOG:  listening on IPv4 address "0.0.0.0", port 5432'),
  L('LOG:  database system was interrupted; last known up at 2026-11-16 10:40:09 UTC'),
  L('LOG:  database system was not properly shut down; automatic recovery in progress'),
  L('LOG:  redo starts at 0/E3574768'),
  L('LOG:  invalid record length at 0/E35747A0: expected at least 24, got 0'),
  L('LOG:  redo done at 0/E3574768 system usage: CPU: user: 0.00 s, system: 0.00 s, elapsed: 0.00 s'),
  L('LOG:  database system is ready to accept connections'),
].join('\n');

test('the real crash recovery is RECOVERED', () => {
  const r = classify(RECOVERY);
  assert.equal(r.verdict, 'RECOVERED');
  assert.deepEqual([r.starts, r.uncleanDetected, r.redoStarted, r.redoDone, r.ready], [1, 2, 1, 1, 1]);
  assert.deepEqual(r.problems, []);
});

test('a clean restart is CLEAN', () => {
  const r = classify([L('LOG:  starting PostgreSQL 17.11'), L('LOG:  database system was shut down at 2026-11-17 08:00:00 UTC'), L('LOG:  database system is ready to accept connections')].join('\n'));
  assert.equal(r.verdict, 'CLEAN');
});

test('routine client FATALs never fail the verdict', () => {
  const r = classify([RECOVERY,
    L('FATAL:  password authentication failed for user "adulis_app"'),
    L('FATAL:  role "root" does not exist'),
    L('FATAL:  database "adulis_test" does not exist'),
    L('FATAL:  the database system is starting up'),
    L('FATAL:  terminating connection due to administrator command'),
    L('FATAL:  no pg_hba.conf entry for host "172.18.0.1"'),
  ].join('\n'));
  assert.equal(r.verdict, 'RECOVERED');
  assert.equal(r.clientFatals, 6);
});

test('a PANIC, a startup FATAL or an aborted startup is FAILED', () => {
  for (const bad of [
    L('PANIC:  could not locate a valid checkpoint record'),
    L('FATAL:  could not open file "pg_wal/0000000100000000000000E3": No such file or directory'),
    L('LOG:  startup process (PID 29) was terminated by signal 6: Aborted'),
    L('LOG:  aborting startup due to startup process failure'),
    L('FATAL:  database files are incompatible with server'),
  ]) {
    const r = classify(`${RECOVERY}\n${bad}`);
    assert.equal(r.verdict, 'FAILED', bad);
    assert.ok(r.problems.length > 0);
  }
});

test('a startup that never became ready, or redo that never finished, is FAILED', () => {
  assert.equal(classify([L('LOG:  starting PostgreSQL 17.11'), L('LOG:  database system was interrupted; last known up at x'), L('LOG:  redo starts at 0/1')].join('\n')).verdict, 'FAILED');
  const r = classify([RECOVERY, L('LOG:  starting PostgreSQL 17.11'), L('LOG:  redo starts at 0/2')].join('\n'));
  assert.equal(r.verdict, 'FAILED');
  assert.ok(r.problems.some((p) => p.includes('never reached')));
});

test('three or more startups in the interval are a suspected restart loop', () => {
  const r = classify([RECOVERY, RECOVERY, RECOVERY].join('\n'));
  assert.equal(r.verdict, 'FAILED');
  assert.ok(r.restartLoop);
});

test('review A, M-1: a crash-restart, corruption, "in recovery mode" and repeated recoveries are FAILED', () => {
  const crash = [
    L('LOG:  server process (PID 812) was terminated by signal 9: Killed'),
    L('LOG:  terminating any other active server processes'),
    L('LOG:  all server processes terminated; reinitializing'),
    L('LOG:  database system was interrupted; last known up at 2026-11-17 08:28:01 UTC'),
  ].join('\n');
  // Stuck after a backend crash: reinitialised, never ready again.
  assert.equal(classify(`${RECOVERY}\n${crash}`).verdict, 'FAILED');
  // A crash-restart that did become ready again is still FAILED (a backend crashed).
  assert.equal(classify(`${RECOVERY}\n${crash}\n${L('LOG:  database system is ready to accept connections')}`).verdict, 'FAILED');
  // Corruption reported as ERROR lines.
  for (const bad of ['ERROR:  invalid page in block 4 of relation base/16384/16385', 'ERROR:  could not read block 2 in file "base/16384/16390": read only 0 of 8192 bytes', 'WARNING:  page verification failed, calculated checksum 1234 but expected 5678\n' + L('ERROR:  invalid page in block 7 of relation base/1/2')]) {
    assert.equal(classify(`${RECOVERY}\n${L(bad)}`).verdict, 'FAILED', bad);
  }
  // Clients told "in recovery mode" means the server was recovering from a crashed process.
  assert.equal(classify(`${RECOVERY}\n${L('FATAL:  the database system is in recovery mode')}`).verdict, 'FAILED');
  // Two container starts, each a crash recovery: repeated unclean stops.
  assert.equal(classify(`${RECOVERY}\n${RECOVERY}`).verdict, 'FAILED');
  // A query ERROR that is not corruption does not fail it.
  assert.equal(classify(`${RECOVERY}\n${L('ERROR:  duplicate key value violates unique constraint "x"')}`).verdict, 'RECOVERED');
  // A crash recovery followed by a clean restart is fine.
  assert.equal(classify([RECOVERY, L('LOG:  starting PostgreSQL 17.11'), L('LOG:  database system was shut down at 2026-11-17 09:00:00 UTC'), L('LOG:  database system is ready to accept connections')].join('\n')).verdict, 'RECOVERED');
});

test('a log without any startup is UNKNOWN, never a pass', () => {
  assert.equal(classify('').verdict, 'UNKNOWN');
  assert.equal(classify(L('LOG:  checkpoint starting: time')).verdict, 'UNKNOWN');
});

test('the command line exits 0 / 1 / 2 for RECOVERED / FAILED / UNKNOWN', () => {
  const script = fileURLToPath(new URL('./pg-recovery-verdict.mjs', import.meta.url));
  const run = (input) => spawnSync(process.execPath, [script], { input, encoding: 'utf8' }).status;
  assert.equal(run(RECOVERY), 0);
  assert.equal(run(`${RECOVERY}\n${L('PANIC:  x')}`), 1);
  assert.equal(run(''), 2);
});
