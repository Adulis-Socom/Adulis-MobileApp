#!/usr/bin/env node
// Fail-closed MinIO data move (WO-INFRA-007): the objects in the old volume `adulis-pgdata` are copied
// into the MinIO volume the compose file names, then MinIO is switched onto it. Every step checks its
// own exit code and every comparison is made here, not by reading terminal output. Any failure after
// the source is stopped puts the old MinIO back. The procedure, approvals and rollback are in
// docs/infrastructure/WO-INFRA-002-MIGRATION-RUNBOOK.md.
//
//   node ops/scripts/minio-migrate.mjs plan                  read-only preflight and source inventory
//   node ops/scripts/minio-migrate.mjs migrate               backup, copy, verify, switch, verify again
//   node ops/scripts/minio-migrate.mjs rollback              back onto the old volume after a migrate
//   node ops/scripts/minio-migrate.mjs recover               after a migrate that did not finish (killed,
//                                                            or its undo incomplete): the old MinIO back
//   node ops/scripts/minio-migrate.mjs verify-backup <tar> [<sha256sums file>]
//
// Environment: MIGRATE_BACKUP_DIR (migrate, rollback, recover), MIGRATE_SRC_CONTAINER (default
// adulis-minio), MIGRATE_SRC_VOLUME (default adulis-pgdata), MIGRATE_LIVE=approved (required to
// migrate, roll back or recover the real `adulis-pgdata`), and what docker compose itself reads
// (MINIO_HOST_PORT, COMPOSE_FILE, ...). Rehearsals only: MIGRATE_FAULT, MIGRATE_PAUSE.
//
// THE MOVE RECORD IS TWO-PHASE (INF-04). The data-volume guard (docker-compose.yml) serves the new
// volume beside a legacy volume holding data only with a record in it. migrate writes it as
// `pending <run>` before the switch, and the guard accepts a pending record only for that run's own
// switch (compose receives ADULIS_MINIO_SWITCH_RUN for that one command). Only after the switched
// MinIO is verified is it rewritten `complete <run>`. An undo, a recover or a rollback renames it
// aside (verified, with bounded retries). So a record nobody could clear (Docker down, the console
// closed mid-undo) is still pending, and the guard refuses it on every later start.
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

export const BUCKETS = ['adulis-media', 'adulis-evidence'];
// The other top-level directories of `adulis-pgdata` (WO-INFRA-015A): the pre-2026-09-03 PostgreSQL
// data directory MinIO has written beside since then, which MinIO lists as "buckets". They are kept
// in the backup (BACKUP_MUST_HOLD) and in the never-deleted source volume, and are not copied.
// Any other bucket on the source refuses the migration, so nothing is left behind unnoticed.
export const POSTGRES_DIRS = [
  'base',
  'global',
  'pg_commit_ts',
  'pg_dynshmem',
  'pg_logical',
  'pg_multixact',
  'pg_notify',
  'pg_replslot',
  'pg_serial',
  'pg_snapshots',
  'pg_stat',
  'pg_stat_tmp',
  'pg_subtrans',
  'pg_tblspc',
  'pg_twophase',
  'pg_wal',
  'pg_xact',
];
// Anonymous access the target must show: single media objects readable, nothing listable or
// writable (minio-init.sh; listing media was closed by WO-INFRA-009, ISSUE-INFRA-013).
export const ANON_EXPECT = {
  'read-media': 'ALLOWED',
  'list-media': 'DENIED',
  'write-media': 'DENIED',
  'list-evidence': 'DENIED',
  'read-evidence': 'DENIED',
  'write-evidence': 'DENIED',
};
// The backup must hold the MinIO data AND the pre-2026-09-03 PostgreSQL directory (ISSUE-INFRA-005).
export const BACKUP_MUST_HOLD = [
  '.minio.sys/format.json',
  'adulis-media/',
  'adulis-evidence/',
  'PG_VERSION',
  'global/pg_control',
  'base/',
];
const RAW_RULE = 'Days=1 Prefix=evidence/raw/ Enabled';
const FAULTS = [
  'write-source',
  'corrupt-backup',
  'touch-source',
  'drop-object',
  'alter-object',
  'alter-metadata',
  'public-evidence',
  // WO-INFRA-015A: an interrupt arriving at each stage, and a rollback that fails half-way.
  'interrupt-preflight',
  'interrupt-backup',
  'interrupt-hash',
  'interrupt-copy',
  'interrupt-switch',
  'fail-rollback',
  // WO-INFRA-015B: the switch fails after the move record is written, before compose replaces the
  // old container (the undo must remove the record in that branch too: review M1).
  'fail-before-switch',
  // INF-04: a failure at every remaining step, the record clear failing (the first 1 or 2 attempts,
  // or all of them), and a hard kill (no handler, no undo: a closed console) at each window that
  // leaves state for `recover` or a rerun of `rollback`.
  'fail-image-save',
  'fail-source-stop',
  'fail-backup',
  'fail-target-create',
  'fail-copy',
  'fail-record-write',
  'fail-after-switch',
  'fail-commit',
  'fail-clear-record-1',
  'fail-clear-record-2',
  'fail-clear-record-all',
  'fail-rollback-invalidate',
  'fail-rollback-restore',
  'kill-before-switch',
  'kill-after-switch',
  'kill-in-undo',
  'kill-after-commit',
  'kill-rollback-after-invalidate',
  'kill-rollback-after-legacy',
];
// Rehearsals only: MIGRATE_PAUSE=<point>:<seconds> waits at a named point, so a real console Ctrl+C
// or a closed window can be aimed at that window (INF-04 task D). Refused on the live volume.
export const PAUSE_POINTS = ['before-switch', 'after-switch', 'in-undo', 'rollback-after-invalidate', 'rollback-after-legacy'];
// MIGRATE_FAULT may name several faults, comma-separated (a failing switch AND a failing record clear).
export const faultsOf = (env) => (env.MIGRATE_FAULT ?? '').split(',').map((f) => f.trim()).filter(Boolean);
const hasFault = (f) => faultsOf(process.env).includes(f);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export class Refusal extends Error {}
const refuse = (msg) => {
  throw new Refusal(msg);
};
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

// ---------- interruption (WO-INFRA-015A) ----------
// Ctrl+C or SIGTERM is never only logged. It aborts the hashing or streaming in progress (their
// AbortSignal), and every step boundary refuses once it has arrived: a migrate then undoes itself
// (verified), a rollback stops before its critical section or puts the new MinIO back, and no
// success line is printed. Signal handlers run only when the event loop turns, and most steps are
// synchronous (spawnSync), so every checkpoint first gives the loop a full turn. A docker child
// ended by a signal, or by a Windows console Ctrl+C, counts as the interrupt itself. The handler
// never stops the undo; a SECOND terminal Ctrl+C can still end a docker call of the undo, which is
// then reported (UNDO STEP FAILED / UNDO INCOMPLETE), never hidden.
export function createInterruption(logFn = log) {
  const controller = new AbortController();
  const state = {
    signal: null,
    finished: false,
    abortSignal: controller.signal,
    on(sig) {
      if (state.finished) {
        logFn(`${sig} after the run had finished: nothing to stop or undo`);
        return;
      }
      if (state.signal) {
        logFn(`${sig} again: still stopping safely; wait for the undo to finish`);
        return;
      }
      state.signal = sig;
      controller.abort(new Refusal(`interrupted by ${sig}`));
      logFn(`interrupt (${sig}): stopping at the next step; anything already changed is undone; wait`);
    },
    checkpoint() {
      if (state.signal) refuse(`interrupted by ${state.signal}: stopped before the next step`);
    },
  };
  return state;
}
const interruption = createInterruption();
export const turnEventLoop = () => new Promise((r) => setImmediate(() => setImmediate(r)));
const checkpoint = async () => {
  await turnEventLoop(); // let a pending SIGINT/SIGTERM handler run first
  interruption.checkpoint();
};
// Exit status of a Windows console program ended by Ctrl+C (STATUS_CONTROL_C_EXIT).
const CTRL_C_EXIT = new Set([3221225786, -1073741510]);
// Rehearsal only (guard() refuses MIGRATE_FAULT on the live volume): an interrupt at a named stage,
// delivered like a real signal: through the event loop, not in the middle of a synchronous step.
const rehearseInterrupt = (stage) => {
  if (hasFault(`interrupt-${stage}`)) {
    log(`FAULT INJECTED (rehearsal): interrupt during ${stage}`);
    setImmediate(() => interruption.on('SIGINT'));
  }
};
// Rehearsal only: a failure (fail-<point>) or a hard kill (kill-<point>) at a named point. The kill
// runs no handler, no finally and no undo, as a console window closed mid-run would end Node.
const faultAt = (point) => {
  if (hasFault(`fail-${point}`)) refuse(`rehearsal fault: ${point} failed`);
  if (hasFault(`kill-${point}`)) {
    log(`FAULT INJECTED (rehearsal): hard kill at ${point}`);
    process.kill(process.pid, 'SIGKILL');
  }
};
// Rehearsal only: MIGRATE_PAUSE=<point>:<seconds>. An interrupt ends a pause early (it would end a
// long docker step too), except inside the undo, which an interrupt never shortens.
async function pauseAt(point) {
  const m = /^([a-z-]+):(\d+)$/.exec(process.env.MIGRATE_PAUSE ?? '');
  if (!m || m[1] !== point) return;
  log(`PAUSE (rehearsal): ${m[2]} s at ${point}; interrupt now to rehearse this window`);
  await new Promise((done) => {
    const t = setTimeout(done, Number(m[2]) * 1000);
    if (point !== 'in-undo')
      interruption.abortSignal.addEventListener('abort', () => (clearTimeout(t), done()), { once: true });
  });
}

// The source's buckets: the two copied, the PostgreSQL directories, and nothing else.
export function sourceBucketProblems(inv) {
  return inv.buckets
    .filter((b) => !BUCKETS.includes(b) && !POSTGRES_DIRS.includes(b))
    .map(
      (b) =>
        `unexpected bucket ${b} on the source: this migration copies only ${BUCKETS.join(' and ')}, so it would be left behind. Inspect it first; nothing was deleted`,
    );
}

// ---------- pure checks (unit-tested in minio-migrate.test.mjs) ----------

// Refuses before anything runs: the live volume needs the founder's approval, and test faults never
// touch it.
export function guard(cmd, srcVolume, env) {
  const live = srcVolume === 'adulis-pgdata';
  if (live && ['migrate', 'rollback', 'recover'].includes(cmd) && env.MIGRATE_LIVE !== 'approved')
    refuse(
      `'${cmd}' on the live volume adulis-pgdata needs the founder's approval (ISSUE-INFRA-001): set MIGRATE_LIVE=approved`,
    );
  const faults = faultsOf(env);
  if (faults.length && live) refuse('MIGRATE_FAULT is for rehearsals only, never the live volume');
  for (const f of faults) if (!FAULTS.includes(f)) refuse(`unknown MIGRATE_FAULT ${f}`);
  if (env.MIGRATE_PAUSE) {
    if (live) refuse('MIGRATE_PAUSE is for rehearsals only, never the live volume');
    const m = /^([a-z-]+):(\d+)$/.exec(env.MIGRATE_PAUSE);
    if (!m || !PAUSE_POINTS.includes(m[1]) || Number(m[2]) > 600)
      refuse(`MIGRATE_PAUSE must be <point>:<seconds up to 600>, point one of ${PAUSE_POINTS.join(', ')}`);
  }
  return live;
}

// ---------- the move record (two-phase, INF-04) ----------

// The record's first line: `pending <run>` before the switch is verified, `complete <run>` after.
// Anything else (an empty file, the JSON of runs before INF-04) is not a record this tool accepts.
export function parseRecord(line) {
  const m = /^(pending|complete) ([0-9]{14}-[0-9a-f]{4})$/.exec(String(line ?? '').trim());
  return m ? { state: m[1], run: m[2] } : { state: 'unknown', run: null };
}

// The outcome of a failed migrate's undo, from verified facts only (B5: no line claims the record is
// gone unless its absence was read back).
export function undoVerdict({ changed, failedSteps, record, answers, port }) {
  const manual = [];
  if (record === 'not-cleared')
    manual.push(
      'the PENDING move record could not be cleared from the target volume: the guard refuses a pending record on every normal start, but delete it by hand (runbook, "A record that could not be cleared") before any compose up',
    );
  if (!answers) manual.push(`nothing answers on port ${port}: act by hand (runbook, Rollback), or run recover`);
  for (const s of failedSteps) manual.push(`undo step failed: ${s}`);
  let outcome;
  if (!changed && answers) outcome = 'NOTHING CHANGED: the run failed before the source was stopped';
  else if (!answers) outcome = `UNDO INCOMPLETE: nothing answers on port ${port}`;
  else if (manual.length) outcome = `UNDO PARTIAL: MinIO answers on port ${port}, but ${manual.length} item(s) need a person`;
  else outcome = `UNDO OK: the old MinIO answers on port ${port} again`;
  return { outcome, manual, manualInterventionRequired: manual.length > 0 };
}

// What `recover` must do after a migrate that did not finish, from the state it observed. `current`
// is the container now holding the MinIO name (null if none); the old one is known by its recorded
// ID. Volumes are never deleted here, and the source volume is only ever mounted.
export function recoveryPlan({ current, legacyId, srcVolume, dstVolume, recordPresent, recordState, failedNameTaken }) {
  // Killed after its verified commit, before it recorded its end: it IS migrated. Nothing is undone;
  // the end is recorded, and rollback stays the way back.
  if (recordState === 'complete' && current?.mount === dstVolume) {
    if (!current.running) return { refuse: 'the move record is complete but the new MinIO is stopped: start it, then run recover again' };
    return { reconcile: true, actions: [] };
  }
  const actions = [];
  if (recordPresent) actions.push('invalidate-record');
  actions.push('remove-helpers');
  if (current && current.id === legacyId) {
    if (!current.running) actions.push('start-legacy');
  } else if (current && current.mount === dstVolume) {
    if (failedNameTaken)
      return { refuse: 'the MinIO name serves the target volume and the name for setting it aside is taken: act by hand (runbook, Rollback)' };
    actions.push('stop-new', 'set-aside-new', 'recreate-legacy');
  } else if (current && current.mount === srcVolume) {
    if (!current.running) actions.push('start-legacy');
  } else if (current) {
    return { refuse: `the MinIO name is held by a container on ${current.mount ?? 'no volume'}, neither the source nor the target: act by hand` };
  } else actions.push('recreate-legacy');
  return { actions };
}

// What a rollback finds when MinIO is not on the target volume, or the MinIO name is free (INF01-007:
// a rollback killed part-way). `record` is the target's record state, `kept` whether this run's
// set-aside container exists.
export function rollbackRerun({ current, srcVolume, dstVolume, record, kept }) {
  if (current?.mount === dstVolume) return 'proceed';
  if (!current && kept) return 'recreate-legacy'; // stopped and renamed, killed before the old one came back
  if (current?.mount === srcVolume) return record === 'complete' || record === 'pending' ? 'clear-record' : 'already-rolled-back';
  return 'refuse';
}

// On another drive, relative() is absolute rather than '..'-prefixed (Windows: C: repo, G: backups).
export function insideRepo(dir, repo = root) {
  const rel = relative(repo, resolve(dir));
  return !rel.startsWith('..') && !isAbsolute(rel);
}

// Entry names of a tar stream, as GNU tar writes it. A missing end-of-archive marker or a corrupt
// header refuses: a backup cut short by a failed docker run still gets a checksum.
export function tarEntries(read) {
  const names = [];
  let off = 0;
  let longName = null;
  for (;;) {
    const h = read(off, 512);
    if (h.length < 512) refuse(`backup is truncated at byte ${off}: no end-of-archive marker`);
    if (h.every((b) => b === 0)) {
      const next = read(off + 512, 512);
      if (next.length < 512 || !next.every((b) => b === 0))
        refuse(`backup is truncated at byte ${off}: one end block of two`);
      return names;
    }
    const octal = (a, b) =>
      parseInt(
        h
          .toString('latin1', a, b)
          .replace(/\0[\s\S]*$/, '')
          .trim() || '0',
        8,
      );
    const sum = h.reduce((s, b, i) => s + (i >= 148 && i < 156 ? 32 : b), 0);
    if (sum !== octal(148, 156)) refuse(`backup header at byte ${off} is corrupt (checksum)`);
    const size = octal(124, 136);
    const type = String.fromCharCode(h[156]);
    const field = (a, b) => h.toString('utf8', a, b).replace(/\0[\s\S]*$/, '');
    if (type === 'L') {
      longName = read(off + 512, size)
        .toString('utf8')
        .replace(/\0[\s\S]*$/, '');
    } else if (type !== 'x' && type !== 'g') {
      const ustar = h.toString('latin1', 257, 263) === 'ustar\0' && field(345, 500);
      names.push(
        (longName ?? (ustar ? `${field(345, 500)}/${field(0, 100)}` : field(0, 100))).replace(
          /^\.\//,
          '',
        ),
      );
      longName = null;
    }
    off += 512 + Math.ceil(size / 512) * 512;
  }
}

// The SHA-256 recorded for one file in a sha256sum-style file, exact name, hash format checked. A BOM
// or leading blank used to yield an empty hash, which skipped the comparison (review).
export function recordedSha(sums, name) {
  for (const raw of sums.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = raw.trim().match(/^([0-9a-fA-F]{64}) [ *](.+)$/);
    if (m && m[2] === name) return m[1].toLowerCase();
  }
  refuse(`no well-formed SHA-256 recorded for ${name}`);
}

// The inventory script's output (INVENTORY_SH) as data.
export function parseInventory(text) {
  const inv = { buckets: [], objects: new Map(), hashes: new Map(), policy: {}, lifecycle: {} };
  for (const line of text.split('\n')) {
    const [tag, rest] = [line.slice(0, 1), line.slice(2)];
    if (tag === 'B') inv.buckets.push(JSON.parse(rest).key.replace(/\/$/, ''));
    else if (tag === 'S') {
      const s = JSON.parse(rest);
      if (s.status !== 'success' || s.type !== 'file')
        refuse(`inventory: unexpected stat entry ${rest.slice(0, 200)}`);
      inv.objects.set(s.name, { size: s.size, etag: s.etag, meta: s.metadata ?? {} });
    } else if (tag === 'H') {
      const [bucket, sha, ...key] = rest.split(' ');
      inv.hashes.set(`${bucket}/${key.join(' ')}`, sha);
    } else if (tag === 'P' || tag === 'L') {
      const [bucket, ...json] = rest.split(' ');
      (tag === 'P' ? inv.policy : inv.lifecycle)[bucket] = JSON.parse(json.join(' '));
    } else if (line.trim()) refuse(`inventory: unexpected line ${line.slice(0, 200)}`);
  }
  // Every listed object must have been read back and hashed, and nothing else.
  for (const [k, o] of inv.objects) {
    if (!inv.hashes.has(k)) refuse(`inventory: ${k} is listed but could not be read back`);
    o.sha256 = inv.hashes.get(k);
  }
  for (const k of inv.hashes.keys())
    if (!inv.objects.has(k)) refuse(`inventory: ${k} was read back but is not listed`);
  return inv;
}

const canonical = (o) =>
  JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))));
export const counts = (inv) =>
  Object.fromEntries(
    BUCKETS.map((b) => [b, [...inv.objects.keys()].filter((k) => k.startsWith(`${b}/`)).length]),
  );

// Same keys, and per key the same size, ETag, SHA-256 of the content and metadata.
export function compareObjects(src, dst) {
  const problems = [];
  for (const [k, s] of src.objects) {
    const d = dst.objects.get(k);
    if (!d) {
      problems.push(`missing: ${k}`);
      continue;
    }
    for (const f of ['size', 'etag', 'sha256'])
      if (s[f] !== d[f]) problems.push(`${f} differs: ${k}`);
    if (canonical(s.meta) !== canonical(d.meta))
      problems.push(`metadata differs: ${k} ${canonical(s.meta)} -> ${canonical(d.meta)}`);
  }
  for (const k of dst.objects.keys()) if (!src.objects.has(k)) problems.push(`unexpected: ${k}`);
  return problems;
}

// The distinct lifecycle rules of a bucket, IDs dropped (the old init added the same rule on every run).
export function ruleSet(lc) {
  const rules = (lc?.Rules ?? []).map(
    (r) => `Days=${r.Expiration?.Days} Prefix=${r.Filter?.Prefix ?? r.Prefix ?? ''} ${r.Status}`,
  );
  return [...new Set(rules)].sort();
}

// The target holds exactly the two buckets, evidence stays private with its expiry rule, and the
// anonymous probes behave as ANON_EXPECT says.
export function checkTarget(dst, src, probes) {
  const problems = [];
  if ([...dst.buckets].sort().join() !== [...BUCKETS].sort().join())
    problems.push(
      `buckets are [${dst.buckets.join(', ')}], expected exactly [${BUCKETS.join(', ')}]`,
    );
  if ((dst.policy['adulis-evidence']?.Statement ?? []).length > 0)
    problems.push('adulis-evidence has an anonymous policy');
  const mediaActions = (dst.policy['adulis-media']?.Statement ?? []).flatMap((st) =>
    [st.Action].flat(),
  );
  if (mediaActions.some((a) => a !== 's3:GetObject'))
    problems.push(
      `adulis-media grants anonymous ${mediaActions.join(', ')}; only s3:GetObject is intended`,
    );
  for (const b of BUCKETS) {
    const [s, d] = [ruleSet(src.lifecycle[b]), ruleSet(dst.lifecycle[b])];
    if (s.join() !== d.join())
      problems.push(`${b} lifecycle differs: [${s.join('; ')}] -> [${d.join('; ')}]`);
  }
  if (!ruleSet(dst.lifecycle['adulis-evidence']).includes(RAW_RULE))
    problems.push(`adulis-evidence lacks the rule ${RAW_RULE}`);
  for (const [name, want] of Object.entries(ANON_EXPECT))
    if (probes.results[name] !== want)
      problems.push(`anonymous ${name}: ${probes.results[name] ?? 'not run'}, expected ${want}`);
  const mediaKey = probes.mediaKey && `adulis-media/${probes.mediaKey}`;
  if (mediaKey && probes.mediaSha !== src.objects.get(mediaKey)?.sha256)
    problems.push(`anonymous read of ${mediaKey} returned different bytes`);
  return problems;
}

// ---------- docker ----------

function docker(args, { input, allowFail = false, env } = {}) {
  const r = spawnSync('docker', args, {
    cwd: root,
    input,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    ...(env ? { env: { ...process.env, ...env } } : {}),
  });
  if (r.error) refuse(`could not run docker: ${r.error.message}`);
  // Ended by a signal, or by a console Ctrl+C on Windows: that IS the interrupt (WO-INFRA-015A).
  if (r.signal || CTRL_C_EXIT.has(r.status)) {
    interruption.on(r.signal ?? 'SIGINT');
    if (!allowFail) refuse(`docker ${args.slice(0, 2).join(' ')} was interrupted`);
  }
  // Only the first words of the command: later arguments carry MC_HOST URLs with credentials.
  if (r.status !== 0 && !allowFail)
    refuse(
      `docker ${args.slice(0, 2).join(' ')} exited ${r.status}: ${(r.stderr || r.stdout).trim().slice(-1500)}`,
    );
  return allowFail ? r : r.stdout;
}
// Absent only when docker says so; any other inspect failure refuses rather than reading as "absent".
function exists(kind, name) {
  const r = docker([kind, 'inspect', name], { allowFail: true });
  if (r.status === 0) return true;
  if (/no such/i.test(`${r.stderr}${r.stdout}`)) return false;
  refuse(`docker ${kind} inspect ${name} failed: ${`${r.stderr}`.trim().slice(-300)}`);
}

// docker with stdin from a file and/or stdout into a stream; resolves only on exit 0. pipeline()
// turns a stream error (disk full, EPIPE) into a rejection: with pipe() it was an unhandled 'error'
// event that killed the process before the undo could restart the source (review).
async function dockerPipe(args, { from, to }) {
  const p = spawn('docker', args, { cwd: root, stdio: [from ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => (err = (err + d).slice(-1500)));
  const exited = new Promise((res, rej) => {
    p.on('error', rej);
    p.on('close', res);
  });
  // Handled now: a spawn error before Promise.all settles would otherwise crash Node unhandled and
  // skip the undo with the source stopped (PHASE-002B-01 review). It is still awaited below.
  exited.catch(() => {});
  const what = `docker ${args.slice(0, 2).join(' ')}`;
  const signal = interruption.abortSignal; // an interrupt stops the stream and kills the child
  try {
    await Promise.all([
      from && pipeline(createReadStream(from), p.stdin, { signal }),
      to ? pipeline(p.stdout, to, { signal }) : p.stdout.resume(),
    ]);
  } catch (e) {
    p.kill();
    await exited.catch(() => {});
    refuse(`${what}: ${e.message} ${err.trim()}`);
  }
  const code = await exited.catch((e) => refuse(`${what}: ${e.message}`));
  if (code !== 0) refuse(`${what} exited ${code}: ${err.trim()}`);
}
function sha256Sink() {
  const h = createHash('sha256');
  const w = new Writable({ write: (c, _e, cb) => (h.update(c), cb()) });
  w.digest = () => h.digest('hex');
  return w;
}
async function fileSha256(file) {
  const sink = sha256Sink();
  const signal = interruption.abortSignal; // hashing a multi-GB tar stops on an interrupt
  try {
    await pipeline(createReadStream(file), sink, { signal });
  } catch (e) {
    if (signal.aborted) refuse(`hashing ${basename(file)} stopped: interrupted by ${interruption.signal}`);
    throw e;
  }
  return sink.digest();
}

// A server reachable from a helper container: on a private network by name, or on the host's port.
const mcEnv = (alias, s) => [
  '-e',
  `MC_HOST_${alias}=http://${s.user ? `${encodeURIComponent(s.user)}:${encodeURIComponent(s.pass)}@` : ''}${s.host}`,
];
const mc = (cfg, s, script, extra = []) =>
  docker(
    [
      'run',
      '--rm',
      '-i',
      '--network',
      s.network,
      ...extra,
      '--entrypoint',
      '/bin/bash',
      cfg.dstImage,
      '-s',
    ],
    { input: script },
  );

const INVENTORY_SH = [
  'set -euo pipefail',
  'mc ls --json s | while IFS= read -r l; do printf "B %s\\n" "$l"; done',
  'for b in $BUCKETS; do',
  '  mc stat --recursive --json "s/$b" | while IFS= read -r l; do printf "S %s\\n" "$l"; done',
  '  mkdir -p "/tmp/m/$b" && mc mirror --quiet "s/$b" "/tmp/m/$b" > /dev/null',
  '  cd "/tmp/m/$b"; shopt -s globstar dotglob nullglob',
  '  for f in **; do if [[ -f $f ]]; then h=$(sha256sum -- "$f"); printf "H %s %s %s\\n" "$b" "${h%% *}" "$f"; fi; done',
  '  cd /',
  '  p=$(mc anonymous get-json "s/$b"); printf "P %s %s\\n" "$b" "${p//$\'\\n\'/}"',
  '  if l=$(mc ilm rule export "s/$b" 2>&1); then printf "L %s %s\\n" "$b" "${l//$\'\\n\'/}"',
  '  else case $l in *"lifecycle configuration does not exist"*) printf "L %s {}\\n" "$b" ;; *) echo "$l" >&2; exit 1 ;; esac; fi',
  'done',
].join('\n');

function inventory(cfg, s) {
  return parseInventory(
    mc(cfg, s, INVENTORY_SH, [...mcEnv('s', s), '-e', `BUCKETS=${BUCKETS.join(' ')}`]),
  );
}

const PROBE_SH = [
  'probe() { local name=$1 out; shift',
  '  if out=$("$@" 2>&1); then printf "A %s ALLOWED\\n" "$name"',
  '  else case $out in *"Access Denied"*|*"Insufficient permissions"*) printf "A %s DENIED\\n" "$name" ;; *) printf "A %s ERROR %s\\n" "$name" "${out//$\'\\n\'/ }" ;; esac; fi; }',
  'probe read-media bash -c \'mc cat "$0" > /dev/null\' "a/adulis-media/$MEDIA_KEY"',
  'probe list-media mc ls a/adulis-media',
  'probe write-media bash -c \'echo probe | mc pipe "$0"\' "a/adulis-media/minio-migrate-probe-$RUN"',
  'probe list-evidence mc ls a/adulis-evidence',
  'probe read-evidence bash -c \'mc cat "$0" > /dev/null\' "a/adulis-evidence/$EVIDENCE_KEY"',
  'probe write-evidence bash -c \'echo probe | mc pipe "$0"\' "a/adulis-evidence/minio-migrate-probe-$RUN"',
  'set -o pipefail; if m=$(mc cat "a/adulis-media/$MEDIA_KEY" 2>/dev/null | sha256sum); then printf "M %s\\n" "${m%% *}"; else echo "M FAILED"; fi',
].join('\n');

function anonymousProbes(cfg, s, src) {
  const first = (b) =>
    [...src.objects.keys()].find((k) => k.startsWith(`${b}/`))?.slice(b.length + 1) ?? '';
  // With no evidence object, probe a key that does not exist: anonymous S3 is denied either way.
  const [mediaKey, evidenceKey] = [
    first('adulis-media'),
    first('adulis-evidence') || 'minio-migrate-probe-absent',
  ];
  const out = mc(cfg, s, PROBE_SH, [
    ...mcEnv('a', { ...s, user: '' }),
    '-e',
    `MEDIA_KEY=${mediaKey}`,
    '-e',
    `EVIDENCE_KEY=${evidenceKey}`,
    '-e',
    `RUN=${cfg.run}`,
  ]);
  const results = {};
  let mediaSha = null;
  for (const line of out.split('\n')) {
    const [tag, name, verdict] = line.split(' ');
    if (tag === 'A') results[name] = verdict;
    if (tag === 'M') mediaSha = name;
  }
  return { results, mediaKey, mediaSha, raw: out.trim() };
}

function waitReady(cfg, s) {
  // `mc ready` blocks until the server answers, so the limit is kept outside it.
  const sh =
    'mc ready s > /dev/null 2>&1 & p=$!; for ((i=0;i<90;i++)); do kill -0 $p 2>/dev/null || { wait $p; exit $?; }; sleep 1; done; kill $p; echo "not ready after 90 s" >&2; exit 1';
  mc(cfg, s, sh, mcEnv('s', s));
}

// ---------- configuration and preflight ----------

function resolveConfig(cmd, env) {
  const srcContainer = env.MIGRATE_SRC_CONTAINER || 'adulis-minio';
  const srcVolume = env.MIGRATE_SRC_VOLUME || 'adulis-pgdata';
  const live = guard(cmd, srcVolume, env);
  const compose = JSON.parse(docker(['compose', 'config', '--format', 'json']));
  const minio = compose.services?.minio;
  const init = compose.services?.['minio-init'];
  if (!minio || !init) refuse('the compose configuration has no minio and minio-init services');
  const data = (minio.volumes ?? []).find((v) => v.target === '/data' && v.type === 'volume');
  const dstVolume = data && compose.volumes?.[data.source]?.name;
  const hostPort = String(
    (minio.ports ?? []).find((p) => Number(p.target) === 9000)?.published ?? '',
  );
  if (!dstVolume || !hostPort)
    refuse('the compose minio service has no named /data volume or no published port 9000');
  const backupDir = env.MIGRATE_BACKUP_DIR ? resolve(env.MIGRATE_BACKUP_DIR) : null;
  const run = `${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${randomBytes(2).toString('hex')}`;
  return {
    cmd,
    live,
    run,
    srcContainer,
    srcVolume,
    dstVolume,
    hostPort,
    backupDir,
    project: compose.name,
    dstContainer: minio.container_name,
    initContainer: init.container_name,
    dstImage: minio.image,
    tarImage: compose.services.postgres?.image ?? 'pgvector/pgvector:pg17',
    // `compose create minio` also creates its dependency, which mounts the target volume.
    guardContainer: compose.services['minio-volume-guard']?.container_name ?? null,
    dstCreds: {
      user: minio.environment?.MINIO_ROOT_USER,
      pass: minio.environment?.MINIO_ROOT_PASSWORD,
    },
  };
}

function preflight(cfg) {
  const problems = [];
  if (!exists('container', cfg.srcContainer))
    refuse(`source container ${cfg.srcContainer} does not exist`);
  const src = JSON.parse(docker(['inspect', cfg.srcContainer]))[0];
  const envOf = (k) =>
    (src.Config.Env ?? []).find((e) => e.startsWith(`${k}=`))?.slice(k.length + 1);
  const srcMount = (src.Mounts ?? []).find((m) => m.Destination === '/data');
  const srcPort = src.HostConfig?.PortBindings?.['9000/tcp']?.[0]?.HostPort;
  if (!src.State.Running)
    problems.push(
      `source ${cfg.srcContainer} is not running (its inventory is read from the running server)`,
    );
  if (srcMount?.Name !== cfg.srcVolume)
    problems.push(
      `source ${cfg.srcContainer} mounts ${srcMount?.Name ?? 'nothing'} at /data, not ${cfg.srcVolume}`,
    );
  if (srcPort !== cfg.hostPort)
    problems.push(
      `compose would publish MinIO on ${cfg.hostPort} but the source (and the API's R2_ACCOUNT_ID) uses ${srcPort}: set MINIO_HOST_PORT=${srcPort}`,
    );
  const owner = src.Config.Labels?.['com.docker.compose.project'];
  if (
    cfg.srcContainer === cfg.dstContainer &&
    (owner !== cfg.project || src.Config.Labels?.['com.docker.compose.service'] !== 'minio')
  )
    problems.push(
      `source ${cfg.srcContainer} is not the minio service of compose project ${cfg.project} (it is ${owner ?? 'not compose-managed'}): compose could not replace it`,
    );
  if (cfg.srcContainer !== cfg.dstContainer && exists('container', cfg.dstContainer))
    problems.push(`container ${cfg.dstContainer} already exists and is not the source`);
  if (cfg.srcVolume === cfg.dstVolume) problems.push('source and target volume are the same');
  if (
    !cfg.dstCreds.user ||
    !cfg.dstCreds.pass ||
    !envOf('MINIO_ROOT_USER') ||
    !envOf('MINIO_ROOT_PASSWORD')
  )
    problems.push('MinIO root credentials are missing on the source or in compose');
  let targetExists = exists('volume', cfg.dstVolume);
  if (targetExists) {
    const n = docker([
      'run',
      '--rm',
      '-v',
      `${cfg.dstVolume}:/d:ro`,
      '--entrypoint',
      '/bin/bash',
      cfg.dstImage,
      '-c',
      // The MinIO image's empty .minio.sys skeleton (Docker copies it into a new volume on first
      // mount, e.g. by a compose run before the move) holds no file and counts as empty.
      'shopt -s dotglob nullglob globstar; f=(/d/*); if [ ${#f[@]} -eq 1 ] && [ "${f[0]}" = /d/.minio.sys ]; then n=0; for x in /d/.minio.sys/**; do [ -f "$x" ] && n=$((n+1)); done; [ $n -eq 0 ] && { echo 0; exit 0; }; fi; echo ${#f[@]}',
    ]).trim();
    if (n !== '0')
      problems.push(
        `target volume ${cfg.dstVolume} already exists and is not empty (${n} entries): inspect it; this script never writes into a used volume`,
      );
  }
  if (cfg.cmd !== 'plan') {
    if (!cfg.backupDir) problems.push('MIGRATE_BACKUP_DIR is not set');
    else if (insideRepo(cfg.backupDir))
      problems.push('MIGRATE_BACKUP_DIR is inside the repository; backups never go into git');
    else if (existsSync(cfg.backupDir) && readdirSync(cfg.backupDir).length > 0)
      problems.push(`MIGRATE_BACKUP_DIR ${cfg.backupDir} is not empty: use a fresh folder per run`);
  }
  if (problems.length) refuse(`preflight:\n  - ${problems.join('\n  - ')}`);
  return {
    inspect: src,
    targetExists,
    server: {
      network: 'host',
      host: `127.0.0.1:${srcPort}`,
      user: envOf('MINIO_ROOT_USER'),
      pass: envOf('MINIO_ROOT_PASSWORD'),
    },
  };
}

// ---------- backup ----------

export async function verifyBackup(tar, expectedSha) {
  if (!/^[0-9a-f]{64}$/.test(expectedSha ?? ''))
    refuse(`backup ${tar}: no recorded SHA-256 to verify against`);
  const sha = await fileSha256(tar);
  if (sha !== expectedSha)
    refuse(`backup ${tar}: SHA-256 ${sha} does not match the recorded ${expectedSha}`);
  const fd = openSync(tar, 'r');
  let names;
  try {
    names = tarEntries((off, len) => {
      const b = Buffer.alloc(len);
      return b.subarray(0, readSync(fd, b, 0, len, off));
    });
  } finally {
    closeSync(fd);
  }
  const set = new Set(names);
  const missing = BACKUP_MUST_HOLD.filter((n) => !set.has(n));
  if (missing.length) refuse(`backup ${tar} lacks ${missing.join(', ')}`);
  return { sha, entries: names.length };
}

async function takeBackup(cfg) {
  const tar = join(cfg.backupDir, `${cfg.srcVolume}.tar`);
  if (hasFault('interrupt-backup')) setTimeout(() => rehearseInterrupt('backup'), 300);
  await dockerPipe(
    [
      'run',
      '--rm',
      '-v',
      `${cfg.srcVolume}:/src:ro`,
      '--entrypoint',
      'tar',
      cfg.tarImage,
      '-C',
      '/src',
      '-cf',
      '-',
      '.',
    ],
    { to: createWriteStream(tar, { mode: 0o600 }) },
  );
  faultAt('backup');
  await checkpoint();
  if (hasFault('interrupt-hash')) setImmediate(() => rehearseInterrupt('hash'));
  const sha = await fileSha256(tar);
  writeFileSync(`${tar}.sha256`, `${sha} *${basename(tar)}\n`, { mode: 0o600 });
  if (hasFault('corrupt-backup')) {
    const b = readFileSync(tar);
    b[600] ^= 0xff; // one flipped byte after the checksum was recorded
    writeFileSync(tar, b);
  }
  return {
    tar,
    ...(await verifyBackup(tar, recordedSha(readFileSync(`${tar}.sha256`, 'utf8'), basename(tar)))),
  };
}

// Hash of a fresh tar of the (stopped) source: equal to the backup's only if nothing in it changed.
async function sourceStreamSha(cfg) {
  const sink = sha256Sink();
  await dockerPipe(
    [
      'run',
      '--rm',
      '-v',
      `${cfg.srcVolume}:/src:ro`,
      '--entrypoint',
      'tar',
      cfg.tarImage,
      '-C',
      '/src',
      '-cf',
      '-',
      '.',
    ],
    { to: sink },
  );
  return sink.digest();
}

// ---------- commands ----------

function summary(label, inv) {
  log(
    `${label}: ${Object.entries(counts(inv))
      .map(([b, n]) => `${b}=${n}`)
      .join(' ')} (buckets on server: ${inv.buckets.length})`,
  );
}

function fail(label, problems) {
  if (problems.length)
    refuse(
      `${label}:\n  - ${problems.slice(0, 40).join('\n  - ')}${problems.length > 40 ? `\n  - ... ${problems.length - 40} more` : ''}`,
    );
}

async function plan(cfg) {
  const pre = preflight(cfg);
  log(
    `source ${cfg.srcContainer} on ${cfg.srcVolume} (image ${pre.inspect.Image.slice(7, 19)}), port ${cfg.hostPort}`,
  );
  log(
    `target ${cfg.dstVolume} (${pre.targetExists ? 'exists, empty' : 'will be created by this run (external volume)'}), compose project ${cfg.project}, image ${cfg.dstImage}`,
  );
  const inv = inventory(cfg, pre.server);
  summary('source inventory', inv);
  fail('the source holds data this migration would not copy', sourceBucketProblems(inv));
  await checkpoint();
  interruption.finished = true;
  log('PLAN OK: preflight passed; nothing was changed');
}

// The record of the move, at the root of the new volume (MinIO ignores files at the root: the
// PostgreSQL files beside its buckets in adulis-pgdata prove it). Two-phase: see the top of this file.
export const MOVE_RECORD = '.adulis-migration-complete';
// Where an undone record goes, renamed in one step (never half-written): a failed or recovered
// migrate, and a rollback. The guard also refuses a volume holding either of them beside a record.
export const INVALIDATED_RECORD = '.adulis-migration-invalidated';
export const ROLLED_BACK_RECORD = '.adulis-migration-rolled-back';
const LEGACY_IMAGE_TAR = 'legacy-image.tar';
// Four attempts, about 17 s at most: bounded, never a loop. A second Ctrl+C that ends one attempt's
// docker call, or a transient Docker error, is retried; a Docker that stays down is reported.
export const CLEAR_DELAYS_S = [0, 2, 5, 10];
function onTarget(cfg, script, args = [], opts = {}) {
  return docker(
    ['run', '--rm', '-v', `${cfg.dstVolume}:/d`, '--entrypoint', 'sh', cfg.tarImage, '-c', script, 'move-record', ...args],
    opts,
  );
}

// The record as it is on the target volume, read back, never assumed. Never run against an absent
// volume (`docker run -v name:` would create it). END proves the script ran to its end.
function readRecord(cfg) {
  if (!exists('volume', cfg.dstVolume)) return { readable: true, volume: false, present: false, state: 'absent', run: null };
  const r = onTarget(
    cfg,
    `if [ -f /d/${MOVE_RECORD} ]; then l=; IFS= read -r l < /d/${MOVE_RECORD} || :; echo "R $l"; fi; [ -e /d/${INVALIDATED_RECORD} ] && echo I; [ -e /d/${ROLLED_BACK_RECORD} ] && echo B; echo END`,
    [],
    { allowFail: true },
  );
  const lines = `${r.stdout ?? ''}`.split('\n').map((l) => l.trimEnd());
  if (r.status !== 0 || !lines.includes('END'))
    return { readable: false, error: `${r.stderr ?? ''}`.trim().slice(-300) || `exit ${r.status}` };
  const rec = lines.find((l) => l.startsWith('R '));
  return {
    readable: true,
    volume: true,
    present: Boolean(rec),
    ...(rec ? parseRecord(rec.slice(2)) : { state: 'absent', run: null }),
    invalidated: lines.includes('I'),
    rolledBack: lines.includes('B'),
  };
}

// Written under a temporary name and renamed over the record in one step, then read back.
function writeRecord(cfg, journal, state) {
  faultAt(state === 'pending' ? 'record-write' : 'commit');
  onTarget(cfg, `printf '%s\\n' "$1" > /d/.adulis-migration-record.tmp && mv -f /d/.adulis-migration-record.tmp /d/${MOVE_RECORD}`, [`${state} ${cfg.run}`]);
  const back = readRecord(cfg);
  if (!back.readable || back.state !== state || back.run !== cfg.run)
    refuse(
      `the move record in ${cfg.dstVolume} reads back as ${back.readable ? `${back.state} ${back.run ?? ''}` : `unreadable (${back.error})`}, not ${state} ${cfg.run}`,
    );
  journal.record.state = state;
  journal.record[state === 'pending' ? 'writtenAt' : 'committedAt'] = new Date().toISOString();
  journal.save();
}

// Renames the record aside (`as`), retried with bounded delays; cleared only when a SEPARATE read
// finds no record. Every attempt is journaled, failures included, and kept. Never throws: the caller
// decides what an uncleared record means (PHASE-002B-01 review M1, INF01-006).
async function invalidateRecord(cfg, journal, as, why) {
  for (let i = 0; i < CLEAR_DELAYS_S.length; i++) {
    if (CLEAR_DELAYS_S[i]) await new Promise((r) => setTimeout(r, CLEAR_DELAYS_S[i] * 1000));
    const at = new Date().toISOString();
    let error = null;
    let note;
    try {
      if (!exists('volume', cfg.dstVolume)) note = 'the target volume does not exist';
      else {
        const injected = hasFault('fail-clear-record-all') || (hasFault('fail-clear-record-1') && i < 1) || (hasFault('fail-clear-record-2') && i < 2);
        const r = onTarget(
          cfg,
          injected
            ? 'echo "rehearsal fault: the record clear fails" >&2; exit 1'
            : `if [ -e /d/${MOVE_RECORD} ]; then mv -f /d/${MOVE_RECORD} /d/${as} && echo MOVED; else echo ABSENT; fi; [ ! -e /d/${MOVE_RECORD} ]`,
          [],
          { allowFail: true },
        );
        if (r.status !== 0) error = `${r.stderr ?? ''}`.trim().slice(-300) || `exit ${r.status}`;
        else {
          if (!`${r.stdout ?? ''}`.includes('MOVED')) note = 'there was no record to rename';
          const back = readRecord(cfg);
          if (!back.readable) error = `the read-back failed: ${back.error}`;
          else if (back.present) error = `the read-back still finds the record (${back.state})`;
        }
      }
    } catch (e) {
      error = e.message;
    }
    journal.record.attempts.push({ at, attempt: i + 1, action: `rename to ${as}`, reason: why, ok: !error, ...(error ? { error } : {}), ...(note ? { note } : {}) });
    if (!error) {
      if (!note) journal.record.state = as === ROLLED_BACK_RECORD ? 'rolled-back' : 'invalidated';
      else if (journal.record.state === 'absent' || journal.record.state === 'pending' || journal.record.state === 'complete') journal.record.state = 'absent';
      journal.save();
      log(note ? `no move record to clear (${note})` : `move record cleared from ${cfg.dstVolume}: renamed to ${as}, read back absent (attempt ${i + 1})`);
      return true;
    }
    journal.save();
    log(`move record NOT cleared, attempt ${i + 1} of ${CLEAR_DELAYS_S.length}: ${error}`);
  }
  journal.record.state = 'not-cleared';
  journal.save();
  return false;
}

// manifest.json, append-only (INF-04 B4): every step, undo step, record attempt, rollback and
// recovery is added, never replaced, and the file is rewritten after each, so a killed run leaves
// its last state and a later success never erases an earlier failure.
function openJournal(dir, m) {
  m.schema = 2;
  m.steps ??= [];
  m.undo ??= [];
  m.record ??= { state: 'absent', attempts: [] };
  m.record.attempts ??= [];
  m.manualActions ??= [];
  m.rollbacks ??= [];
  m.recoveries ??= [];
  const now = () => new Date().toISOString();
  const j = {
    m,
    record: m.record,
    save: () =>
      writeFileSync(join(dir, 'manifest.json'), JSON.stringify(m, (_k, v) => (v instanceof Map ? Object.fromEntries(v) : v), 2), { mode: 0o600 }),
    // Closes the step in progress as done and opens the next.
    mark(step) {
      const last = m.steps.at(-1);
      if (last && !last.endedAt) Object.assign(last, { endedAt: now(), status: 'ok' });
      m.steps.push({ step, startedAt: now() });
      m.phase = step;
      j.save();
    },
    endStep(error) {
      const last = m.steps.at(-1);
      if (last && !last.endedAt) Object.assign(last, { endedAt: now(), status: error ? 'failed' : 'ok', ...(error ? { error } : {}) });
      j.save();
    },
  };
  return j;
}

// The old image must exist before anything stops: it can no longer be pulled. Loaded from the run's
// saved copy when it was pruned (PHASE-002B-01 review L1).
function ensureLegacyImage(cfg, legacy) {
  if (exists('image', legacy.Image)) return;
  const tar = join(cfg.backupDir, LEGACY_IMAGE_TAR);
  if (existsSync(tar)) {
    log(`the old image ${legacy.Image} is gone (pruned?): loading the copy migrate saved`);
    docker(['load', '-i', tar]);
  }
  if (!exists('image', legacy.Image))
    refuse(`the old image ${legacy.Image} is gone and no saved copy restores it: docker load it first`);
}

// The containers, network and scratch volume a run creates are named after it, so only that run's
// leftovers are removed (a killed run leaves them).
function removeRunHelpers(run) {
  const net = `minio-migrate-${run}`;
  for (const role of ['src', 'dst']) docker(['rm', '-f', `${net}-${role}`], { allowFail: true });
  docker(['network', 'rm', net], { allowFail: true });
  docker(['volume', 'rm', `${net}-snapshot`], { allowFail: true });
}

function recreateLegacy(saved) {
  const c = saved;
  const name = c.Name.replace(/^\//, '');
  const bind = c.HostConfig.PortBindings['9000/tcp'][0];
  const [netName, net] = Object.entries(c.NetworkSettings?.Networks ?? {})[0] ?? [];
  const args = [
    'run',
    '-d',
    '--name',
    name,
    '--restart',
    c.HostConfig.RestartPolicy?.Name || 'no',
    '-p',
    // Loopback, never every interface (WO-INFRA-015A): the API reaches MinIO on 127.0.0.1.
    `${bind.HostIp && bind.HostIp !== '0.0.0.0' && bind.HostIp !== '::' ? bind.HostIp : '127.0.0.1'}:${bind.HostPort}:9000`,
  ];
  for (const e of c.Config.Env ?? []) args.push('-e', e);
  for (const m of c.Mounts.filter((x) => x.Type === 'volume'))
    args.push('-v', `${m.Name}:${m.Destination}`);
  if (netName && exists('network', netName))
    args.push('--network', netName, ...(net.Aliases ?? []).flatMap((a) => ['--network-alias', a]));
  // Not carried over, said out loud: compose labels (deliberate: compose must not adopt it), the
  // healthcheck, bind mounts, other ports and networks. The API reaches MinIO by the host port.
  const left = [
    ...Object.keys(c.HostConfig.PortBindings ?? {})
      .filter((k) => k !== '9000/tcp')
      .map((k) => `port ${k}`),
    ...Object.keys(c.NetworkSettings?.Networks ?? {})
      .filter((n) => n !== netName || !args.includes(n))
      .map((n) => `network ${n}`),
    ...c.Mounts.filter((x) => x.Type !== 'volume').map((x) => `mount ${x.Destination}`),
    ...(c.Config.Healthcheck ? ['healthcheck'] : []),
    'compose labels',
  ];
  log(`recreating ${name} from its recorded configuration; not carried over: ${left.join(', ')}`);
  const id = docker([...args, c.Image, ...(c.Config.Cmd ?? [])]).trim();
  return { name, id };
}

async function migrate(cfg) {
  const pre = preflight(cfg);
  // Each undo or cleanup step is [name, fn]: the undo journals every one by name (INF-04 B4).
  const undo = [];
  const always = [];
  // Owner-only: legacy-container.json keeps the old container's environment (its MinIO credentials)
  // because rollback recreates it from that. exFAT and Windows ignore the modes; Linux honours them.
  mkdirSync(cfg.backupDir, { recursive: true, mode: 0o700 });
  const save = (name, data) =>
    writeFileSync(
      join(cfg.backupDir, name),
      JSON.stringify(data, (_k, v) => (v instanceof Map ? Object.fromEntries(v) : v), 2),
      { mode: 0o600 },
    );
  save('legacy-container.json', pre.inspect);
  // Recorded at once (WO-INFRA-015B review) and after every step (INF-04): a killed run leaves its
  // phase, steps and record state, which `recover` reads.
  const J = openJournal(cfg.backupDir, {
    run: cfg.run,
    command: 'migrate',
    startedAt: new Date().toISOString(),
    source: { container: cfg.srcContainer, containerId: pre.inspect.Id, volume: cfg.srcVolume, image: pre.inspect.Image },
    target: { container: cfg.dstContainer, volume: cfg.dstVolume, image: cfg.dstImage, port: cfg.hostPort, createdByRun: !pre.targetExists },
    project: cfg.project,
    legacyImage: { id: pre.inspect.Image, archive: LEGACY_IMAGE_TAR, saved: false },
    manualInterventionRequired: false,
  });
  const manifest = J.m;
  J.save();
  const net = `minio-migrate-${cfg.run}`;
  const snap = `minio-migrate-${cfg.run}-snapshot`;
  const srv = (role, image, volume, creds) => {
    // Registered first: a run that creates the container but fails to start it still leaves one.
    always.push([`remove helper ${role}`, () => docker(['rm', '-f', `${net}-${role}`], { allowFail: true })]);
    docker([
      'run',
      '-d',
      '--name',
      `${net}-${role}`,
      '--network',
      net,
      '-e',
      `MINIO_ROOT_USER=${creds.user}`,
      '-e',
      `MINIO_ROOT_PASSWORD=${creds.pass}`,
      '-v',
      `${volume}:/data`,
      image,
      'server',
      '/data',
    ]);
    return { user: creds.user, pass: creds.pass, network: net, host: `${net}-${role}:9000` };
  };
  // What the record-clear undo step read back (null: it never ran), and the failure it is undoing.
  let recordCleared = null;
  let failureMsg = '';
  // Ctrl+C: see createInterruption. The handler is installed by main(); every step boundary checks.
  try {
    // The way back must survive an image prune before anything stops (PHASE-002B-01 review L1): after
    // the switch nothing references the old image, and it can no longer be pulled. Rollback loads it.
    // Inside the failure path (INF-04 B6): a failed save is recorded as that, never read as a kill.
    J.mark('image-save');
    docker([
      'save',
      '-o',
      join(cfg.backupDir, LEGACY_IMAGE_TAR),
      hasFault('fail-image-save') ? 'adulis-rehearsal/absent-image:none' : pre.inspect.Image,
    ]);
    manifest.legacyImage.saved = true;
    rehearseInterrupt('preflight');
    await checkpoint();
    J.mark('source-inventory');
    log('1/8 source inventory, read from the running server');
    const i0 = inventory(cfg, pre.server);
    summary('source', i0);
    // Before anything stops: a bucket this run would not copy refuses it (WO-INFRA-015A).
    fail('the source holds data this migration would not copy', sourceBucketProblems(i0));
    await checkpoint();
    if (hasFault('write-source'))
      mc(
        cfg,
        pre.server,
        'echo late | mc pipe s/adulis-media/rehearsal-late-write',
        mcEnv('s', pre.server),
      );

    J.mark('stop-source');
    log(`2/8 stopping ${cfg.srcContainer}: from here nothing can write to the source`);
    // Registered BEFORE the stop: a stop interrupted half-way still gets the source started again
    // (`docker start` on a running container changes nothing).
    undo.push(['start the source again', () => docker(['start', cfg.srcContainer])]);
    docker(['stop', cfg.srcContainer]);
    faultAt('source-stop');

    await checkpoint();
    J.mark('backup');
    log('3/8 backup of the stopped source volume, then its checks');
    const backup = await takeBackup(cfg);
    manifest.backup = backup;
    J.save();
    log(`backup ${backup.tar}: ${backup.entries} entries, sha256 ${backup.sha}`);

    await checkpoint();
    J.mark('snapshot');
    log('4/8 restoring the backup into a scratch volume and serving it read-side');
    docker(['volume', 'create', snap]);
    always.push(['remove the scratch volume', () => docker(['volume', 'rm', snap], { allowFail: true })]);
    await dockerPipe(
      [
        'run',
        '--rm',
        '-i',
        '-v',
        `${snap}:/dst`,
        '--entrypoint',
        'tar',
        cfg.tarImage,
        '-C',
        '/dst',
        '-xpf',
        '-',
      ],
      { from: backup.tar },
    );
    docker(['network', 'create', '--internal', net]);
    always.push(['remove the private network', () => docker(['network', 'rm', net], { allowFail: true })]);
    const snapshot = srv('src', pre.inspect.Image, snap, pre.server);

    await checkpoint();
    J.mark('target');
    log(
      `5/8 target volume ${cfg.dstVolume} (external: created here, never deleted by compose) and a private target server`,
    );
    if (!pre.targetExists)
      undo.push([
        'remove the target volume this run created (before the switch it holds only a copy)',
        () => {
          // The guard container compose creates holds the volume; remove it first, then verify: a
          // volume left behind may hold a partial copy (WO-INFRA-015A review).
          if (cfg.guardContainer) docker(['rm', '-f', cfg.guardContainer], { allowFail: true });
          docker(['volume', 'rm', cfg.dstVolume], { allowFail: true });
          if (exists('volume', cfg.dstVolume))
            refuse(`target volume ${cfg.dstVolume} could not be removed and may hold a partial copy: remove it by hand before any compose up`);
        },
      ]);
    // External in docker-compose.yml (WO-INFRA-015B), so `down -v` cannot delete it: compose expects
    // it to exist. Created only when absent; the undo registered above removes it again.
    if (!pre.targetExists) docker(['volume', 'create', cfg.dstVolume]);
    faultAt('target-create');
    docker(['compose', 'create', '--no-recreate', 'minio']);
    // Not needed until the switch, and it would hold the target volume against the undo.
    if (cfg.guardContainer) {
      docker(['rm', '-f', cfg.guardContainer], { allowFail: true });
      if (exists('container', cfg.guardContainer)) refuse(`${cfg.guardContainer} could not be removed`);
    }
    if (!exists('volume', cfg.dstVolume)) refuse(`${cfg.dstVolume} does not exist after it was created`);
    if (JSON.parse(docker(['inspect', cfg.srcContainer]))[0].Id !== pre.inspect.Id)
      refuse(`compose replaced ${cfg.srcContainer} before the copy was verified`);
    const target = srv('dst', cfg.dstImage, cfg.dstVolume, cfg.dstCreds);
    waitReady(cfg, snapshot);
    waitReady(cfg, target);
    mc(cfg, target, readFileSync(join(root, 'ops/scripts/minio-init.sh'), 'utf8'), [
      '-e',
      `MINIO_URL=http://${target.host}`,
      '-e',
      `MINIO_ROOT_USER=${target.user}`,
      '-e',
      `MINIO_ROOT_PASSWORD=${target.pass}`,
    ]);

    await checkpoint();
    J.mark('copy');
    log('6/8 copying the two buckets (never the phantom PostgreSQL directories)');
    rehearseInterrupt('copy');
    mc(cfg, target, BUCKETS.map((b) => `mc mirror --quiet "src/${b}" "dst/${b}"`).join(' && '), [
      ...mcEnv('src', snapshot),
      ...mcEnv('dst', target),
    ]);
    faultAt('copy');
    await injectFault(cfg, target, i0);

    await checkpoint();
    J.mark('verify');
    log('7/8 verification: source unchanged, snapshot = source, target = snapshot, security');
    const i1 = inventory(cfg, snapshot);
    fail(
      'the restored backup differs from the source inventory (a writer still active before the stop, or an incomplete restore)',
      compareObjects(i0, i1),
    );
    const i2 = inventory(cfg, target);
    summary('target before the switch', i2);
    fail('target differs from the source', compareObjects(i1, i2));
    const p2 = anonymousProbes(cfg, target, i1);
    fail('target security', checkTarget(i2, i1, p2));
    const again = await sourceStreamSha(cfg);
    if (again !== backup.sha)
      refuse(
        `the source volume changed during the migration (tar ${again} != backup ${backup.sha})`,
      );
    save('inventory-source.json', i1.objects);
    save('buckets-source.json', { buckets: i1.buckets, policy: i1.policy, lifecycle: i1.lifecycle });
    for (const [, f] of always.splice(0).reverse()) f();
    // A helper still serving the target volume would run beside compose's MinIO on the same data.
    for (const role of ['src', 'dst'])
      if (exists('container', `${net}-${role}`))
        refuse(`helper ${net}-${role} could not be removed`);

    await checkpoint();
    J.mark('record-pending');
    log(
      `8/8 switching: compose recreates ${cfg.dstContainer} on ${cfg.dstVolume}; ${cfg.srcVolume} is not touched`,
    );
    undo.length = 0; // pre-switch undo steps no longer apply: the old container is replaced by compose
    // Two undo steps, run in REVERSE, each on its own: the record is renamed aside FIRST, so even a
    // failed restore of the old container leaves no record beside a volume that is not serving
    // (PHASE-002B-01 review M1; first, not last: WO-INFRA-015B review). The restore step's log line
    // says what the clear step read back, never more (INF-04 B5).
    undo.push([
      'restore the old MinIO',
      async () => {
        await pauseAt('in-undo');
        faultAt('in-undo');
        const cur = docker(['inspect', cfg.srcContainer], { allowFail: true });
        if (cur.status === 0 && JSON.parse(cur.stdout)[0].Id === pre.inspect.Id) {
          docker(['start', cfg.srcContainer]); // compose never replaced it
          log(
            recordCleared
              ? `the verified copy stays in ${cfg.dstVolume}; its move record was renamed aside and read back absent, so the guard will not serve it; remove the volume before a new run`
              : `the copy stays in ${cfg.dstVolume} WITH ITS PENDING MOVE RECORD (not cleared, see above): the guard refuses a pending record on a normal start; delete it by hand before any compose up (runbook)`,
          );
          return;
        }
        const failed = `${cfg.dstContainer}-failed-${cfg.run}`;
        docker(['stop', cfg.dstContainer], { allowFail: true });
        docker(['rename', cfg.dstContainer, failed], { allowFail: true });
        // Docker must never start it again: its configuration accepts this run's pending record.
        docker(['update', '--restart', 'no', failed], { allowFail: true });
        recreateLegacy(pre.inspect);
      },
    ]);
    undo.push([
      'clear the move record',
      async () => {
        recordCleared = await invalidateRecord(cfg, J, INVALIDATED_RECORD, `migrate failed: ${failureMsg}`);
        if (!recordCleared)
          refuse(`the pending move record could not be cleared from ${cfg.dstVolume} after ${CLEAR_DELAYS_S.length} attempts`);
      },
    ]); // pushed last, so it runs first
    // The record the data-volume guard (docker-compose.yml) requires before it serves this volume
    // while adulis-pgdata still holds MinIO data. Written after the target was verified equal to the
    // stopped source (step 7), PENDING: the guard accepts it only for this run's switch below, so a
    // record an undo cannot clear is refused on every later start (INF-04 B3).
    writeRecord(cfg, J, 'pending');
    await pauseAt('before-switch');
    faultAt('before-switch');
    await checkpoint(); // an interrupt here stops before compose replaces the old container
    J.mark('switch');
    docker(['compose', 'up', '-d', 'minio', 'minio-init'], { env: { ADULIS_MINIO_SWITCH_RUN: cfg.run } });
    rehearseInterrupt('switch');
    const code = docker(['wait', cfg.initContainer]).trim();
    const initLog = () => {
      const r = docker(['logs', cfg.initContainer], { allowFail: true });
      return `${r.stdout}${r.stderr}`.trim().slice(-800);
    };
    if (code !== '0') refuse(`${cfg.initContainer} exited ${code}: ${initLog()}`);
    const now = JSON.parse(docker(['inspect', cfg.dstContainer]))[0];
    const mount = now.Mounts.find((m) => m.Destination === '/data');
    if (mount?.Name !== cfg.dstVolume)
      refuse(`${cfg.dstContainer} mounts ${mount?.Name} at /data, not ${cfg.dstVolume}`);
    await pauseAt('after-switch');
    faultAt('after-switch');
    await checkpoint(); // an interrupt here goes straight back to the old MinIO
    J.mark('verify-served');
    const served = { network: 'host', host: `127.0.0.1:${cfg.hostPort}`, ...cfg.dstCreds };
    waitReady(cfg, served);
    const i3 = inventory(cfg, served);
    summary('target after the switch', i3);
    fail('served target differs from the source', compareObjects(i1, i3));
    const p3 = anonymousProbes(cfg, served, i1);
    fail('served target security', checkTarget(i3, i1, p3));
    // An interrupt during the switch or its verification is honoured: back to the old MinIO.
    await checkpoint();
    // Only now, verified, does the record become complete: the guard's only lasting authorisation.
    J.mark('commit');
    writeRecord(cfg, J, 'complete');
    faultAt('after-commit');
    interruption.finished = true;
    J.endStep();
    Object.assign(manifest, {
      finishedAt: new Date().toISOString(),
      outcome: 'MIGRATED',
      counts: { source: counts(i0), served: counts(i3) },
      probes: p3.results,
      finalState: { serving: cfg.dstVolume, record: 'complete', oldVolume: `${cfg.srcVolume} untouched` },
      rollback: 'node ops/scripts/minio-migrate.mjs rollback (same MIGRATE_BACKUP_DIR)',
    });
    J.save();
    log(
      `MIGRATED: ${Object.entries(counts(i3))
        .map(([b, n]) => `${b}=${n}`)
        .join(' ')}; old volume ${cfg.srcVolume} untouched; move record complete (read back)`,
    );
    log(
      `the next plain \`docker compose up\` recreates ${cfg.dstContainer} once (the switch variable is gone); its guard accepts the completed record`,
    );
  } catch (e) {
    J.endStep(e.message);
    failureMsg = e.message;
    log(`FAILED, undoing: ${e.message}`);
    const changed = undo.length > 0 || always.length > 0;
    const failedSteps = [];
    for (const [name, f] of [...always.splice(0).reverse(), ...undo.reverse()]) {
      const entry = { step: name, at: new Date().toISOString() };
      manifest.undo.push(entry);
      try {
        await f();
        entry.status = 'ok';
      } catch (u) {
        Object.assign(entry, { status: 'failed', error: u.message });
        if (name !== 'clear the move record') failedSteps.push(name);
        log(`UNDO STEP FAILED, act by hand (runbook, Rollback): ${name}: ${u.message}`);
      }
      J.save();
    }
    // Verified, not assumed: the old MinIO must answer on its port again.
    let answers = true;
    try {
      waitReady(cfg, pre.server);
    } catch (w) {
      answers = false;
      log(`the old MinIO does not answer on port ${cfg.hostPort}: ${w.message}`);
    }
    const v = undoVerdict({
      changed,
      failedSteps,
      record: recordCleared === false ? 'not-cleared' : 'ok',
      answers,
      port: cfg.hostPort,
    });
    log(v.outcome);
    for (const a of v.manual) log(`MANUAL ACTION REQUIRED: ${a}`);
    // The outcome is recorded too: a terminal that lost the output still leaves the file.
    Object.assign(manifest, {
      failedAt: new Date().toISOString(),
      failure: e.message,
      outcome: v.outcome,
      manualInterventionRequired: v.manualInterventionRequired,
      finalState: { oldMinioAnswers: answers, record: J.record.state },
    });
    manifest.manualActions.push(...v.manual);
    J.save();
    throw e;
  }
}

// Rehearsal-only faults, each placed where a real failure of that kind would show up.
async function injectFault(cfg, target, i0) {
  // Only the object faults act here; the others are placed where their failure occurs.
  const f = ['touch-source', 'drop-object', 'alter-object', 'alter-metadata', 'public-evidence'].find(hasFault);
  if (!f) return;
  log(`FAULT INJECTED (rehearsal): ${f}`);
  const key = [...i0.objects.keys()].find((k) => k.startsWith('adulis-media/'));
  const cmds = {
    'drop-object': `mc rm "s/${key}"`,
    'alter-object': `head -c ${i0.objects.get(key).size} /dev/zero | mc pipe "s/${key}"`,
    'alter-metadata': `mc cp "s/${key}" /tmp/x && mc cp --attr "Content-Type=text/plain" /tmp/x "s/${key}"`,
    'public-evidence': 'mc anonymous set download s/adulis-evidence',
  };
  if (f === 'touch-source')
    docker([
      'run',
      '--rm',
      '-v',
      `${cfg.srcVolume}:/s`,
      '--entrypoint',
      'touch',
      cfg.tarImage,
      '/s/adulis-media/.rehearsal-fault',
    ]);
  else mc(cfg, target, cmds[f], mcEnv('s', target));
}

// A container by name: null when docker says it does not exist; any other inspect error refuses.
function containerState(name) {
  const r = docker(['inspect', name], { allowFail: true });
  if (r.status !== 0) {
    if (/no such/i.test(`${r.stderr}${r.stdout}`)) return null;
    refuse(`docker inspect ${name} failed: ${`${r.stderr}`.trim().slice(-300)}`);
  }
  const c = JSON.parse(r.stdout)[0];
  return { id: c.Id, mount: c.Mounts.find((x) => x.Destination === '/data')?.Name ?? null, running: Boolean(c.State.Running) };
}

// The recorded run in MIGRATE_BACKUP_DIR: its manifest and the old container's configuration.
function recordedRun(cfg) {
  const saved = join(cfg.backupDir ?? '', 'legacy-container.json');
  const manifest = join(cfg.backupDir ?? '', 'manifest.json');
  if (!existsSync(saved) || !existsSync(manifest)) refuse(`no migrate run recorded in ${cfg.backupDir}`);
  const m = JSON.parse(readFileSync(manifest, 'utf8'));
  if (m.target?.volume && m.target.volume !== cfg.dstVolume)
    refuse(`that run moved into ${m.target.volume}, but this configuration names ${cfg.dstVolume}: use the run's environment`);
  return { m, legacy: JSON.parse(readFileSync(saved, 'utf8')) };
}

// The rollback's own undo: the record goes back (renamed, read back complete) before the new MinIO
// starts again, since its guard refuses the volume without it.
function restoreRecord(cfg, journal) {
  const at = new Date().toISOString();
  let error = null;
  try {
    if (hasFault('fail-rollback-restore')) refuse('rehearsal fault: the record could not be restored');
    const r = onTarget(cfg, `[ -e /d/${ROLLED_BACK_RECORD} ] && mv -f /d/${ROLLED_BACK_RECORD} /d/${MOVE_RECORD}`, [], { allowFail: true });
    if (r.status !== 0) refuse(`${r.stderr ?? ''}`.trim().slice(-300) || `exit ${r.status}`);
    const back = readRecord(cfg);
    if (!back.readable || back.state !== 'complete') error = `read back as ${back.readable ? back.state : back.error}`;
  } catch (e) {
    error = e.message;
  }
  journal.record.attempts.push({ at, action: `restore from ${ROLLED_BACK_RECORD}`, ok: !error, ...(error ? { error } : {}) });
  if (!error) journal.record.state = 'complete';
  journal.save();
  return !error;
}

async function rollback(cfg) {
  const { m, legacy } = recordedRun(cfg);
  if (!m.finishedAt)
    refuse(
      m.failedAt
        ? `that run did not finish its switch; its undo ran (${m.outcome ?? m.undo ?? 'outcome not recorded'}). If the undo was incomplete, run recover (same MIGRATE_BACKUP_DIR)`
        : m.undo?.length
          ? `that run failed and was killed during its undo (last undo step: ${m.undo.at(-1).step}): run recover (same MIGRATE_BACKUP_DIR), which inspects the containers, the volumes and the move record`
          : 'that run neither finished nor recorded a failure (killed?): run recover (same MIGRATE_BACKUP_DIR), which inspects the containers, the volumes and the move record',
    );
  // The recorded source decides, not the environment: MIGRATE_SRC_VOLUME=x must not skip the approval.
  guard('rollback', m.source.volume, process.env);
  const J = openJournal(cfg.backupDir, m);
  const rb = { startedAt: new Date().toISOString(), steps: [] };
  m.rollbacks.push(rb);
  J.save();
  const note = (step) => {
    rb.steps.push({ step, at: new Date().toISOString() });
    J.save();
  };
  const kept = `${cfg.dstContainer}-migrated-${m.run}`;
  const envOf = (k) => legacy.Config.Env.find((e) => e.startsWith(`${k}=`))?.slice(k.length + 1);
  const old = { network: 'host', host: `127.0.0.1:${cfg.hostPort}`, user: envOf('MINIO_ROOT_USER'), pass: envOf('MINIO_ROOT_PASSWORD') };
  const served = { network: 'host', host: `127.0.0.1:${cfg.hostPort}`, ...cfg.dstCreds };
  const failRun = (msg) => {
    Object.assign(rb, { failedAt: new Date().toISOString(), failure: msg });
    J.save();
    refuse(msg);
  };

  const current = containerState(cfg.dstContainer);
  const rec = readRecord(cfg);
  if (!rec.readable) failRun(`the move record in ${cfg.dstVolume} cannot be read (${rec.error}): nothing was changed`);
  const situation = rollbackRerun({ current, srcVolume: m.source.volume, dstVolume: cfg.dstVolume, record: rec.state, kept: containerState(kept) !== null });
  if (situation === 'refuse')
    failRun(`${cfg.dstContainer} mounts ${current?.mount ?? 'nothing'}, neither ${cfg.dstVolume} nor ${m.source.volume}: nothing to roll back; check by hand (runbook, Rollback)`);
  if (situation !== 'proceed') {
    // A rollback killed part-way (INF01-007): finish what it left, then verify as a full one does.
    const prior = m.rollbacks.slice(0, -1).find((r) => r.finishedAt);
    log(
      situation === 'already-rolled-back' && prior
        ? `run ${m.run} was already rolled back (${prior.finishedAt}): verifying it again`
        : `an earlier rollback of run ${m.run} did not finish (${situation}): completing it`,
    );
    note(`rerun: ${situation}`);
    if ((situation === 'clear-record' || rec.present) && !(await invalidateRecord(cfg, J, ROLLED_BACK_RECORD, `rollback rerun: ${situation}`)))
      failRun(`the move record in ${cfg.dstVolume} could not be cleared: delete /${MOVE_RECORD} in it by hand, and remove ADULIS_MINIO_VOLUME from .env, before any compose up`);
    if (situation === 'recreate-legacy') {
      ensureLegacyImage(cfg, legacy);
      recreateLegacy(legacy);
      note('recreated the old MinIO');
    } else if (current && !current.running) docker(['start', cfg.dstContainer]);
    waitReady(cfg, old);
    return finishRollback(cfg, J, rb, m, old, null, kept, true);
  }

  ensureLegacyImage(cfg, legacy);
  for (const v of legacy.Mounts.filter((x) => x.Type === 'volume'))
    if (!exists('volume', v.Name)) failRun(`the old volume ${v.Name} does not exist`);
  let now = null;
  try {
    now = inventory(cfg, served);
  } catch (e) {
    log(`the new MinIO could not be read (${e.message}); check ${cfg.dstVolume} by hand for objects written after the switch`);
  }
  // Last point where an interrupt changes nothing.
  await checkpoint();
  // FAIL-CLOSED ORDER (INF-04): the record is renamed aside BEFORE anything stops. A kill at any later
  // point leaves no record a later start could serve: at worst the new MinIO, still running, is
  // refused at its next start (unavailable, never stale), and a rerun of rollback finishes the job.
  faultAt('rollback-invalidate');
  if (!(await invalidateRecord(cfg, J, ROLLED_BACK_RECORD, 'rollback')))
    failRun(`the move record in ${cfg.dstVolume} could not be cleared, so nothing was stopped: ${cfg.dstContainer} still serves ${cfg.dstVolume}`);
  note('record renamed aside');
  await pauseAt('rollback-after-invalidate');
  faultAt('rollback-after-invalidate');
  // From the stop to the old MinIO answering, an interrupt is only recorded (the handler keeps Node
  // alive), and a failure puts the new one back.
  let made = null;
  let renamed = false;
  try {
    docker(['stop', cfg.dstContainer]);
    docker(['rename', cfg.dstContainer, kept]);
    renamed = true;
    made = recreateLegacy(legacy);
    if (hasFault('fail-rollback')) refuse('rehearsal fault: the old MinIO did not come back');
    waitReady(cfg, old);
    note('the old MinIO answers');
    await pauseAt('rollback-after-legacy');
    faultAt('rollback-after-legacy');
  } catch (e) {
    // Never leave nothing serving: remove only what this call created, give the new MinIO its record
    // back (its guard needs it), start it again, and say whether it answers (verified, not assumed).
    if (made) docker(['rm', '-f', made.id], { allowFail: true });
    if (renamed) docker(['rename', kept, cfg.dstContainer], { allowFail: true });
    let back;
    if (!restoreRecord(cfg, J))
      back = `but its move record could not be restored, so it was NOT started (its guard would refuse it): NOTHING SERVES on port ${cfg.hostPort}; act by hand (runbook, Rollback)`;
    else {
      docker(['start', cfg.dstContainer], { allowFail: true });
      back = 'and it answers again';
      try {
        waitReady(cfg, served);
      } catch (w) {
        back = `but NOTHING ANSWERS on port ${cfg.hostPort} (${w.message}); act by hand (runbook, Rollback)`;
      }
    }
    rb.outcome = `ROLLBACK FAILED: ${cfg.dstContainer} was put back on ${cfg.dstVolume}, ${back}`;
    m.manualInterventionRequired = !back.startsWith('and it answers');
    failRun(`rollback failed (${e.message}); ${cfg.dstContainer} was put back on ${cfg.dstVolume}, ${back}`);
  }
  // Docker must never start the set-aside new MinIO by itself.
  docker(['update', '--restart', 'no', kept], { allowFail: true });
  if (interruption.signal)
    log(`interrupt (${interruption.signal}) arrived during the switch back, which completed; verifying it`);
  return finishRollback(cfg, J, rb, m, old, now, kept, false);
}

// The old MinIO serves the old volume again: compare it with the inventory taken at the migration.
// After an interrupted rollback, the old MinIO may already have served writes, so differences are
// reported, not treated as a failure (rerun).
function finishRollback(cfg, J, rb, m, old, now, kept, rerun) {
  const back = inventory(cfg, old);
  const savedInv = {
    objects: new Map(Object.entries(JSON.parse(readFileSync(join(cfg.backupDir, 'inventory-source.json'), 'utf8')))),
  };
  const drift = compareObjects(savedInv, back);
  if (now) {
    const after = compareObjects(back, now);
    log(
      `${kept} and ${cfg.dstVolume} are kept, unchanged. Changes after the switch, only there ("unexpected" = added, "missing" = deleted, "differs" = changed): ${after.length}${after.length ? `\n  ${after.slice(0, 20).join('\n  ')}` : ''}`,
    );
  } else log(`${cfg.dstVolume} is kept, unchanged; changes made there after the switch were not measured by this rerun: compare it by hand`);
  if (rerun && drift.length)
    log(`differences from the state at the migration (the old MinIO may have served writes since the interrupted rollback): ${drift.length}\n  ${drift.slice(0, 20).join('\n  ')}`);
  else fail(`${cfg.dstContainer} serves ${m.source.volume} again, but it differs from its state at the migration`, drift);
  const rec = readRecord(cfg);
  if (!rec.readable || rec.present) refuse(`the move record in ${cfg.dstVolume} is still there (or unreadable): delete it by hand before any compose up`);
  interruption.finished = true;
  Object.assign(rb, { finishedAt: new Date().toISOString(), outcome: 'ROLLED BACK', ...(rerun ? { completedAnInterruptedRollback: true } : {}) });
  m.finalState = { serving: m.source.volume, record: J.record.state, kept: cfg.dstVolume };
  J.save();
  log(
    `ROLLED BACK: ${cfg.dstContainer} serves ${m.source.volume} again${rerun ? '' : ', identical to its state at the migration'} (${Object.entries(counts(back))
      .map(([b, n]) => `${b}=${n}`)
      .join(' ')}); the move record is renamed aside (read back).`,
  );
  log(
    `While rolled back, \`docker compose up\` fails: it starts ${kept}, whose port ${cfg.dstContainer} now holds (rehearsed). Nothing is changed by that failure.`,
  );
}

// After a migrate that did not finish: killed (a closed console), or its undo incomplete. Brings
// the old MinIO back on the old volume from the recorded configuration, renames any record aside,
// and removes only this run's helpers. Never deletes a volume; repeatable (INF-04 C5, D3).
async function recover(cfg) {
  const { m, legacy } = recordedRun(cfg);
  guard('recover', m.source.volume, process.env);
  if (m.finishedAt)
    refuse(`that run finished its migration (${m.finishedAt}): there is nothing to recover. rollback undoes it; an interrupted rollback is finished by running rollback again`);
  const J = openJournal(cfg.backupDir, m);
  const rc = { startedAt: new Date().toISOString(), actions: [] };
  m.recoveries.push(rc);
  J.save();
  const srcName = m.source.container;
  const failedName = `${cfg.dstContainer}-failed-${m.run}`;
  const current = containerState(srcName);
  const rec = readRecord(cfg);
  rc.observed = { phase: m.phase ?? null, current, record: rec, failedNameTaken: containerState(failedName) !== null };
  J.save();
  log(
    `observed: run ${m.run} stopped in phase ${m.phase ?? 'unknown'}; ${srcName}: ${current ? `${current.id.slice(0, 12)} on ${current.mount} (${current.running ? 'running' : 'stopped'})` : 'absent'}; move record: ${rec.readable ? rec.state : `unreadable (${rec.error})`}`,
  );
  const plan = recoveryPlan({
    current,
    legacyId: legacy.Id,
    srcVolume: m.source.volume,
    dstVolume: cfg.dstVolume,
    recordPresent: !rec.readable || rec.present,
    recordState: rec.readable ? rec.state : 'unknown',
    failedNameTaken: rc.observed.failedNameTaken,
  });
  if (plan.refuse) {
    rc.outcome = `REFUSED: ${plan.refuse}`;
    J.save();
    refuse(plan.refuse);
  }
  if (plan.reconcile) {
    const end = new Date().toISOString();
    Object.assign(rc, { finishedAt: end, outcome: 'MIGRATED: the run was killed after its verified commit; its end is recorded now' });
    Object.assign(m, { finishedAt: end, outcome: 'MIGRATED (end recorded by recover)', finalState: { serving: cfg.dstVolume, record: 'complete' } });
    J.save();
    log(`MIGRATED: run ${m.run} had committed (record complete, read back) and ${srcName} serves ${cfg.dstVolume}; it was killed only before recording its end, which is recorded now. rollback undoes it`);
    interruption.finished = true;
    return;
  }
  const manual = [];
  for (const a of plan.actions) {
    const entry = { action: a, at: new Date().toISOString() };
    rc.actions.push(entry);
    try {
      if (a === 'invalidate-record') {
        if (!(await invalidateRecord(cfg, J, INVALIDATED_RECORD, 'recover'))) refuse('the move record could not be cleared');
      } else if (a === 'remove-helpers') removeRunHelpers(m.run);
      else if (a === 'start-legacy') docker(['start', srcName]);
      else if (a === 'stop-new') docker(['stop', srcName]);
      else if (a === 'set-aside-new') {
        docker(['rename', srcName, failedName]);
        docker(['update', '--restart', 'no', failedName], { allowFail: true });
      } else if (a === 'recreate-legacy') {
        ensureLegacyImage(cfg, legacy);
        recreateLegacy(legacy);
      }
      entry.status = 'ok';
    } catch (e) {
      Object.assign(entry, { status: 'failed', error: e.message });
      manual.push(`${a}: ${e.message}`);
      log(`RECOVERY STEP FAILED: ${a}: ${e.message}`);
      // The restore steps build on each other; the record and the helpers do not.
      if (a !== 'invalidate-record' && a !== 'remove-helpers') {
        J.save();
        break;
      }
    }
    J.save();
  }
  const envOf = (k) => legacy.Config.Env.find((e) => e.startsWith(`${k}=`))?.slice(k.length + 1);
  const old = { network: 'host', host: `127.0.0.1:${cfg.hostPort}`, user: envOf('MINIO_ROOT_USER'), pass: envOf('MINIO_ROOT_PASSWORD') };
  let answers = true;
  try {
    waitReady(cfg, old);
  } catch (w) {
    answers = false;
    manual.push(`nothing answers on port ${cfg.hostPort} (${w.message})`);
  }
  if (answers) {
    const back = inventory(cfg, old);
    summary(`${srcName} after the recovery`, back);
    const invFile = join(cfg.backupDir, 'inventory-source.json');
    if (existsSync(invFile)) {
      const drift = compareObjects({ objects: new Map(Object.entries(JSON.parse(readFileSync(invFile, 'utf8')))) }, back);
      rc.differencesFromRunInventory = drift.length;
      log(
        `against the inventory the run took of the stopped source: ${drift.length} difference(s)${drift.length ? ' (writes since the undo restarted it, or damage: check)' : ''}${drift.length ? `\n  ${drift.slice(0, 20).join('\n  ')}` : ''}`,
      );
    } else log('the run stopped before its verification step: no inventory of its own to compare with; the counts above are what the old MinIO serves');
  }
  const after = readRecord(cfg);
  if (!after.readable || after.present)
    manual.push(`the move record is still in ${cfg.dstVolume} (${after.readable ? after.state : 'unreadable'}): delete it by hand before any compose up`);
  const outcome = manual.length
    ? `RECOVERY INCOMPLETE: ${manual.length} item(s) need a person`
    : `RECOVERED: ${srcName} serves ${m.source.volume} on port ${cfg.hostPort} again; ${cfg.dstVolume} is kept without a move record (remove it before a new run)`;
  Object.assign(rc, { finishedAt: new Date().toISOString(), outcome, manualActions: manual, finalState: { oldMinioAnswers: answers, record: after.readable ? after.state : 'unreadable' } });
  m.manualInterventionRequired = manual.length > 0;
  m.manualActions.push(...manual);
  J.save();
  log(outcome);
  for (const a of manual) log(`MANUAL ACTION REQUIRED: ${a}`);
  if (manual.length) refuse('the recovery is incomplete: see the MANUAL ACTION lines above');
  interruption.finished = true;
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  // Installed for every command, so Node never dies between two steps of a migrate or rollback.
  // SIGHUP: the console window closed (Windows then ends Node and its docker children about 5 s later,
  // measured in INF-04: the undo may not finish, and `recover` picks up what it leaves); SIGBREAK: Ctrl+Break.
  // Both used to kill Node between two steps with the source stopped and no undo (review M1).
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) process.on(sig, () => interruption.on(sig));
  try {
    if (cmd === 'verify-backup') {
      if (!args[0]) refuse('usage: verify-backup <tar> [<sha256sums file>]');
      const sums = args[1]
        ? readFileSync(args[1], 'utf8')
        : existsSync(`${args[0]}.sha256`)
          ? readFileSync(`${args[0]}.sha256`, 'utf8')
          : null;
      if (sums === null) refuse(`no checksum file for ${basename(args[0])}`);
      const r = await verifyBackup(args[0], recordedSha(sums, basename(args[0])));
      log(
        `BACKUP OK: ${args[0]} sha256 ${r.sha}, ${r.entries} entries, holds ${BACKUP_MUST_HOLD.join(', ')}`,
      );
    } else if (['plan', 'migrate', 'rollback', 'recover'].includes(cmd)) {
      const cfg = resolveConfig(cmd, process.env);
      await { plan, migrate, rollback, recover }[cmd](cfg);
    } else
      refuse('usage: minio-migrate.mjs plan | migrate | rollback | recover | verify-backup <tar> [<sums>]');
  } catch (e) {
    console.error(`\nREFUSED: ${e instanceof Refusal ? e.message : e.stack}`);
    process.exitCode = 1;
  }
}

const self = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
};
if (process.argv[1] && self(process.argv[1]) === self(fileURLToPath(import.meta.url))) main();
