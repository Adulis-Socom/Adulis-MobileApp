#!/usr/bin/env node
// INF-CLOSE-01: a fail-closed verdict on PostgreSQL's startup after a crash, from its COMPLETE log.
//
//   docker logs --since <crash time> adulis-postgres 2>&1 | node ops/scripts/pg-recovery-verdict.mjs
//
// Prints one JSON object and exits 0 for RECOVERED or CLEAN, 1 for FAILED, 2 for UNKNOWN. A client error
// (a failed password, a missing role or database, "the database system is starting up") is routine and
// never fails the verdict; a PANIC, a FATAL raised by the startup process, an aborted startup, or a
// startup that never reached "ready to accept connections" does. No startup in the log is UNKNOWN, not PASS.
import { pathToFileURL } from 'node:url';

// FATAL messages a CLIENT session gets: they say nothing about the cluster's health.
const CLIENT_FATAL = [
  /password authentication failed/i,
  /role ".*" does not exist/i,
  /database ".*" does not exist/i,
  /the database system is (starting up|shutting down|in recovery mode|not yet accepting connections)/i,
  /no pg_hba\.conf entry/i,
  /terminating connection due to (administrator command|idle-session timeout)/i,
  /connection to client lost/i,
  /canceling (statement|authentication) due to/i,
  /remaining connection slots are reserved/i,
  /sorry, too many clients already/i,
  /invalid value for parameter/i,
  /unsupported frontend protocol/i,
];

export function classify(text) {
  const lines = text.split(/\r?\n/);
  const r = {
    starts: 0, uncleanDetected: 0, cleanShutdownSeen: 0, redoStarted: 0, redoDone: 0, ready: 0,
    panics: [], startupFatals: [], clientFatals: 0, aborted: [], lastEvent: null,
  };
  for (const line of lines) {
    if (/starting PostgreSQL \d+/.test(line)) { r.starts++; r.lastEvent = 'start'; }
    if (/database system was (interrupted|not properly shut down)/.test(line)) r.uncleanDetected++;
    if (/database system was shut down at/.test(line)) r.cleanShutdownSeen++;
    if (/redo starts at/.test(line)) r.redoStarted++;
    if (/redo done at/.test(line)) r.redoDone++;
    if (/database system is ready to accept connections/.test(line)) { r.ready++; r.lastEvent = 'ready'; }
    if (/\bPANIC:/.test(line)) r.panics.push(line.trim());
    if (/aborting startup due to startup process failure|startup process .* was terminated by signal|database files are incompatible with server/.test(line)) r.aborted.push(line.trim());
    if (/\bFATAL:/.test(line)) {
      if (CLIENT_FATAL.some((re) => re.test(line))) r.clientFatals++;
      else r.startupFatals.push(line.trim());
    }
  }
  const problems = [];
  if (r.panics.length) problems.push(`${r.panics.length} PANIC line(s)`);
  if (r.aborted.length) problems.push(`startup aborted: ${r.aborted[0]}`);
  if (r.startupFatals.length) problems.push(`${r.startupFatals.length} non-client FATAL line(s): ${r.startupFatals[0]}`);
  if (r.starts > 0 && r.lastEvent !== 'ready') problems.push('the last startup never reached "ready to accept connections"');
  if (r.uncleanDetected && r.redoStarted > r.redoDone) problems.push('WAL redo started but did not finish');
  // More starts than one per ready line after the crash means the server came up more than once: a loop if repeated.
  const restartLoop = r.starts >= 3;
  if (restartLoop) problems.push(`${r.starts} startups in the interval (restart loop?)`);
  let verdict;
  if (problems.length) verdict = 'FAILED';
  else if (r.starts === 0) verdict = 'UNKNOWN';
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
