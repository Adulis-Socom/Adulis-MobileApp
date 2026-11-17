#!/usr/bin/env node
// INF-CLOSE-01: a fail-closed verdict on PostgreSQL's startup after a crash, from its COMPLETE log.
//
//   docker logs --since <crash time> adulis-postgres 2>&1 | node ops/scripts/pg-recovery-verdict.mjs
//
// Prints one JSON object and exits 0 for RECOVERED or CLEAN, 1 for FAILED, 2 for UNKNOWN.
// FAILED on: a PANIC; a FATAL that is not a known client error; an ERROR that reports corruption or a missing
// file; a backend crash or reinitialisation ("terminated by signal", "terminating any other active server
// processes", "reinitializing"); an aborted startup; a last startup that never reached "ready to accept
// connections"; unfinished redo; more than one crash recovery, or three or more startups, in the interval.
// Routine client errors (a failed password, a missing role or database, "starting up") never fail it.
// No startup in the log is UNKNOWN, never a pass. (INF-CLOSE-01 review A, M-1: "in recovery mode" is NOT
// routine -- clients see it while the server recovers from a crashed process.)
import { pathToFileURL } from 'node:url';

const CLIENT_FATAL = [
  /password authentication failed/i,
  /role ".*" does not exist/i,
  /database ".*" does not exist/i,
  /the database system is (starting up|shutting down|not yet accepting connections)/i,
  /no pg_hba\.conf entry/i,
  /terminating connection due to (administrator command|idle-session timeout)/i,
  /connection to client lost/i,
  /canceling (statement|authentication) due to/i,
  /remaining connection slots are reserved/i,
  /sorry, too many clients already/i,
  /unsupported frontend protocol/i,
];
// ERRORs that mean damaged or missing data, not a failed query.
const CORRUPTION = /invalid page in block|could not read block|page verification failed|checksum (verification failed|mismatch)|could not open file|could not access status of transaction|missing chunk number|unexpected zero page|invalid memory alloc request|right sibling's left-link doesn't match|index ".*" contains unexpected zero page|xlog flush request .* is not satisfied/i;
// A backend crash makes the postmaster kill every session and reinitialise (crash recovery again).
const CRASH = /server process \(PID \d+\) was terminated by signal|terminating any other active server processes|all server processes terminated; reinitializing|was terminated by signal \d+/;

export function classify(text) {
  const r = {
    starts: 0, crashRestarts: 0, crashRecoveries: 0, uncleanDetected: 0, cleanShutdownSeen: 0,
    redoStarted: 0, redoDone: 0, ready: 0, panics: [], startupFatals: [], corruption: [], crashes: [],
    clientFatals: 0, aborted: [], lastEvent: null,
  };
  for (const line of text.split(/\r?\n/)) {
    if (/starting PostgreSQL \d+/.test(line)) { r.starts++; r.lastEvent = 'start'; }
    if (/all server processes terminated; reinitializing/.test(line)) { r.crashRestarts++; r.lastEvent = 'start'; }
    if (/database system was interrupted/.test(line)) r.crashRecoveries++;
    if (/database system was (interrupted|not properly shut down)/.test(line)) r.uncleanDetected++;
    if (/database system was shut down at/.test(line)) r.cleanShutdownSeen++;
    if (/redo starts at/.test(line)) r.redoStarted++;
    if (/redo done at/.test(line)) r.redoDone++;
    if (/database system is ready to accept connections/.test(line)) { r.ready++; r.lastEvent = 'ready'; }
    if (/\bPANIC:/.test(line)) r.panics.push(line.trim());
    if (CRASH.test(line)) r.crashes.push(line.trim());
    if (/aborting startup due to startup process failure|database files are incompatible with server/.test(line)) r.aborted.push(line.trim());
    if (/\bERROR:/.test(line) && CORRUPTION.test(line)) r.corruption.push(line.trim());
    if (/\bFATAL:/.test(line)) {
      if (CLIENT_FATAL.some((re) => re.test(line))) r.clientFatals++;
      else r.startupFatals.push(line.trim());
    }
  }
  const problems = [];
  if (r.panics.length) problems.push(`${r.panics.length} PANIC line(s)`);
  if (r.aborted.length) problems.push(`startup aborted: ${r.aborted[0]}`);
  if (r.crashes.length) problems.push(`${r.crashes.length} backend crash or reinitialisation line(s): ${r.crashes[0]}`);
  if (r.corruption.length) problems.push(`${r.corruption.length} ERROR line(s) reporting damaged or missing data: ${r.corruption[0]}`);
  if (r.startupFatals.length) problems.push(`${r.startupFatals.length} non-client FATAL line(s): ${r.startupFatals[0]}`);
  if ((r.starts > 0 || r.crashRestarts > 0) && r.lastEvent !== 'ready') problems.push('the last startup never reached "ready to accept connections"');
  if (r.redoStarted > r.redoDone) problems.push('WAL redo started but did not finish');
  if (r.crashRecoveries > 1) problems.push(`${r.crashRecoveries} crash recoveries in the interval (repeated unclean stops)`);
  const restartLoop = r.starts + r.crashRestarts >= 3;
  if (restartLoop) problems.push(`${r.starts + r.crashRestarts} startups in the interval (restart loop?)`);
  let verdict;
  if (problems.length) verdict = 'FAILED';
  else if (r.starts === 0 && r.crashRestarts === 0) verdict = 'UNKNOWN';
  else if (r.uncleanDetected) verdict = 'RECOVERED';
  else verdict = 'CLEAN';
  return { verdict, problems, ...r, restartLoop };
}

const exitFor = { RECOVERED: 0, CLEAN: 0, FAILED: 1, UNKNOWN: 2 };

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const result = classify(Buffer.concat(chunks).toString('utf8'));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = exitFor[result.verdict];
}
