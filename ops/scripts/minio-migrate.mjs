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
//   node ops/scripts/minio-migrate.mjs verify-backup <tar> [<sha256sums file>]
//
// Environment: MIGRATE_BACKUP_DIR (migrate, rollback), MIGRATE_SRC_CONTAINER (default adulis-minio),
// MIGRATE_SRC_VOLUME (default adulis-pgdata), MIGRATE_LIVE=approved (required to migrate or roll back
// the real `adulis-pgdata`), and what docker compose itself reads (MINIO_HOST_PORT, COMPOSE_FILE, ...).
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
];
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
  if (process.env.MIGRATE_FAULT === `interrupt-${stage}`) {
    log(`FAULT INJECTED (rehearsal): interrupt during ${stage}`);
    setImmediate(() => interruption.on('SIGINT'));
  }
};

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
  if (live && (cmd === 'migrate' || cmd === 'rollback') && env.MIGRATE_LIVE !== 'approved')
    refuse(
      `'${cmd}' on the live volume adulis-pgdata needs the founder's approval (ISSUE-INFRA-001): set MIGRATE_LIVE=approved`,
    );
  if (env.MIGRATE_FAULT && (live || !FAULTS.includes(env.MIGRATE_FAULT)))
    refuse(
      live
        ? 'MIGRATE_FAULT is for rehearsals only, never the live volume'
        : `unknown MIGRATE_FAULT ${env.MIGRATE_FAULT}`,
    );
  return live;
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

function docker(args, { input, allowFail = false } = {}) {
  const r = spawnSync('docker', args, {
    cwd: root,
    input,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
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
  if (process.env.MIGRATE_FAULT === 'interrupt-backup') setTimeout(() => rehearseInterrupt('backup'), 300);
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
  await checkpoint();
  if (process.env.MIGRATE_FAULT === 'interrupt-hash') setImmediate(() => rehearseInterrupt('hash'));
  const sha = await fileSha256(tar);
  writeFileSync(`${tar}.sha256`, `${sha} *${basename(tar)}\n`, { mode: 0o600 });
  if (process.env.MIGRATE_FAULT === 'corrupt-backup') {
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
    `target ${cfg.dstVolume} (${pre.targetExists ? 'exists, empty' : 'will be created by compose'}), compose project ${cfg.project}, image ${cfg.dstImage}`,
  );
  const inv = inventory(cfg, pre.server);
  summary('source inventory', inv);
  fail('the source holds data this migration would not copy', sourceBucketProblems(inv));
  await checkpoint();
  interruption.finished = true;
  log('PLAN OK: preflight passed; nothing was changed');
}

// The record of a completed, verified move, at the root of the new volume (MinIO ignores files at
// the root: the PostgreSQL files beside its buckets in adulis-pgdata prove it). The data-volume
// guard in docker-compose.yml serves the new volume beside a legacy volume holding data only with it.
export const MOVE_RECORD = '.adulis-migration-complete';
const LEGACY_IMAGE_TAR = 'legacy-image.tar';
function onTarget(cfg, script, args = [], opts = {}) {
  return docker(
    ['run', '--rm', '-v', `${cfg.dstVolume}:/d`, '--entrypoint', 'sh', cfg.tarImage, '-c', script, 'move-record', ...args],
    opts,
  );
}
// Every undo of the switch ends here, verified (PHASE-002B-01 review M1): a record left beside a
// volume that is not serving lets the next `compose up` serve that stale copy without a word.
function clearMoveRecord(cfg) {
  const r = onTarget(cfg, `rm -f /d/${MOVE_RECORD} && [ ! -e /d/${MOVE_RECORD} ]`, [], { allowFail: true });
  if (r.status !== 0)
    refuse(
      `the move record could not be removed from ${cfg.dstVolume}: delete /${MOVE_RECORD} in it by hand before any compose up`,
    );
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
  const undo = [];
  const always = [];
  const manifest = {
    run: cfg.run,
    startedAt: new Date().toISOString(),
    source: { container: cfg.srcContainer, volume: cfg.srcVolume, image: pre.inspect.Image },
    target: {
      container: cfg.dstContainer,
      volume: cfg.dstVolume,
      image: cfg.dstImage,
      port: cfg.hostPort,
    },
    project: cfg.project,
  };
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
  // The way back must survive an image prune before anything stops (PHASE-002B-01 review L1): after
  // the switch nothing references the old image, and it can no longer be pulled. Rollback loads it.
  docker(['save', '-o', join(cfg.backupDir, LEGACY_IMAGE_TAR), pre.inspect.Image]);
  const net = `minio-migrate-${cfg.run}`;
  const snap = `minio-migrate-${cfg.run}-snapshot`;
  const srv = (role, image, volume, creds) => {
    // Registered first: a run that creates the container but fails to start it still leaves one.
    always.push(() => docker(['rm', '-f', `${net}-${role}`], { allowFail: true }));
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
  // Ctrl+C: see createInterruption. The handler is installed by main(); every step boundary checks.
  try {
    rehearseInterrupt('preflight');
    await checkpoint();
    log('1/8 source inventory, read from the running server');
    const i0 = inventory(cfg, pre.server);
    summary('source', i0);
    // Before anything stops: a bucket this run would not copy refuses it (WO-INFRA-015A).
    fail('the source holds data this migration would not copy', sourceBucketProblems(i0));
    await checkpoint();
    if (process.env.MIGRATE_FAULT === 'write-source')
      mc(
        cfg,
        pre.server,
        'echo late | mc pipe s/adulis-media/rehearsal-late-write',
        mcEnv('s', pre.server),
      );

    log(`2/8 stopping ${cfg.srcContainer}: from here nothing can write to the source`);
    // Registered BEFORE the stop: a stop interrupted half-way still gets the source started again
    // (`docker start` on a running container changes nothing).
    undo.push(() => docker(['start', cfg.srcContainer]));
    docker(['stop', cfg.srcContainer]);

    await checkpoint();
    log('3/8 backup of the stopped source volume, then its checks');
    const backup = await takeBackup(cfg);
    manifest.backup = backup;
    log(`backup ${backup.tar}: ${backup.entries} entries, sha256 ${backup.sha}`);

    await checkpoint();
    log('4/8 restoring the backup into a scratch volume and serving it read-side');
    docker(['volume', 'create', snap]);
    always.push(() => docker(['volume', 'rm', snap], { allowFail: true }));
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
    always.push(() => docker(['network', 'rm', net], { allowFail: true }));
    const snapshot = srv('src', pre.inspect.Image, snap, pre.server);

    await checkpoint();
    log(
      `5/8 target volume ${cfg.dstVolume} (external: created here, never deleted by compose) and a private target server`,
    );
    if (!pre.targetExists)
      undo.push(() => {
        // The guard container compose creates holds the volume; remove it first, then verify: a
        // volume left behind may hold a partial copy (WO-INFRA-015A review).
        if (cfg.guardContainer) docker(['rm', '-f', cfg.guardContainer], { allowFail: true });
        docker(['volume', 'rm', cfg.dstVolume], { allowFail: true });
        if (exists('volume', cfg.dstVolume))
          refuse(`target volume ${cfg.dstVolume} could not be removed and may hold a partial copy: remove it by hand before any compose up`);
      });
    // External in docker-compose.yml (WO-INFRA-015B), so `down -v` cannot delete it: compose expects
    // it to exist. Created only when absent; the undo registered above removes it again.
    if (!pre.targetExists) docker(['volume', 'create', cfg.dstVolume]);
    docker(['compose', 'create', '--no-recreate', 'minio']);
    // Not needed until the switch, and it would hold the target volume against the undo.
    if (cfg.guardContainer) {
      docker(['rm', '-f', cfg.guardContainer], { allowFail: true });
      if (exists('container', cfg.guardContainer)) refuse(`${cfg.guardContainer} could not be removed`);
    }
    if (!exists('volume', cfg.dstVolume)) refuse(`compose did not create ${cfg.dstVolume}`);
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
    log('6/8 copying the two buckets (never the phantom PostgreSQL directories)');
    rehearseInterrupt('copy');
    mc(cfg, target, BUCKETS.map((b) => `mc mirror --quiet "src/${b}" "dst/${b}"`).join(' && '), [
      ...mcEnv('src', snapshot),
      ...mcEnv('dst', target),
    ]);
    await injectFault(cfg, target, i0);

    await checkpoint();
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
    for (const f of always.splice(0).reverse()) f();
    // A helper still serving the target volume would run beside compose's MinIO on the same data.
    for (const role of ['src', 'dst'])
      if (exists('container', `${net}-${role}`))
        refuse(`helper ${net}-${role} could not be removed`);

    await checkpoint();
    log(
      `8/8 switching: compose recreates ${cfg.dstContainer} on ${cfg.dstVolume}; ${cfg.srcVolume} is not touched`,
    );
    undo.length = 0; // pre-switch undo steps no longer apply: the old container is replaced by compose
    // A step of its own, so it runs even when restoring the old container fails (the undo runs its
    // steps in reverse, each on its own): no record of a completed move may remain on a volume that
    // is not serving, whichever branch below ran (PHASE-002B-01 review M1).
    undo.push(() => clearMoveRecord(cfg));
    undo.push(() => {
      const cur = docker(['inspect', cfg.srcContainer], { allowFail: true });
      if (cur.status === 0 && JSON.parse(cur.stdout)[0].Id === pre.inspect.Id) {
        docker(['start', cfg.srcContainer]); // compose never replaced it
        log(`the verified copy stays in ${cfg.dstVolume}, without its record (the guard will not serve it); remove the volume before a new run`);
        return;
      }
      docker(['stop', cfg.dstContainer], { allowFail: true });
      docker(['rename', cfg.dstContainer, `${cfg.dstContainer}-failed-${cfg.run}`], {
        allowFail: true,
      });
      recreateLegacy(pre.inspect);
    });
    // The record the data-volume guard (docker-compose.yml) requires before it serves this volume
    // while adulis-pgdata still holds MinIO data. Written here, after the target was verified equal
    // to the stopped source (step 7), because the switch itself runs the guard; any failure from
    // here on runs the undo above, which removes it again (rehearsed, WO-INFRA-015A round 3).
    onTarget(cfg, `printf '%s\\n' "$1" > /d/${MOVE_RECORD}`, [
      JSON.stringify({ run: cfg.run, at: new Date().toISOString(), source: cfg.srcVolume, counts: counts(i2) }),
    ]);
    if (process.env.MIGRATE_FAULT === 'fail-before-switch')
      refuse('rehearsal fault: compose up failed before it replaced the old container');
    docker(['compose', 'up', '-d', 'minio', 'minio-init']);
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
    const served = { network: 'host', host: `127.0.0.1:${cfg.hostPort}`, ...cfg.dstCreds };
    waitReady(cfg, served);
    const i3 = inventory(cfg, served);
    summary('target after the switch', i3);
    fail('served target differs from the source', compareObjects(i1, i3));
    const p3 = anonymousProbes(cfg, served, i1);
    fail('served target security', checkTarget(i3, i1, p3));
    // An interrupt during the switch or its verification is honoured: back to the old MinIO.
    await checkpoint();
    interruption.finished = true;
    Object.assign(manifest, {
      finishedAt: new Date().toISOString(),
      counts: { source: counts(i0), served: counts(i3) },
      probes: p3.results,
      rollback: 'node ops/scripts/minio-migrate.mjs rollback (same MIGRATE_BACKUP_DIR)',
    });
    save('manifest.json', manifest);
    log(
      `MIGRATED: ${Object.entries(counts(i3))
        .map(([b, n]) => `${b}=${n}`)
        .join(' ')}; old volume ${cfg.srcVolume} untouched`,
    );
  } catch (e) {
    log(`FAILED, undoing: ${e.message}`);
    let clean = true;
    for (const f of [...always.splice(0).reverse(), ...undo.reverse()]) {
      try {
        f();
      } catch (u) {
        clean = false;
        log(`UNDO STEP FAILED, act by hand (runbook, Rollback): ${u.message}`);
      }
    }
    // Verified, not assumed: the old MinIO must answer on its port again.
    let undone;
    try {
      waitReady(cfg, pre.server);
      undone = clean
        ? `UNDO OK: ${cfg.srcContainer} answers on port ${cfg.hostPort} again`
        : 'UNDO PARTIAL: MinIO answers, but a step above failed';
    } catch (w) {
      undone = `UNDO INCOMPLETE: nothing answers on port ${cfg.hostPort} (${w.message}); act by hand (runbook, Rollback)`;
    }
    log(undone);
    // The outcome is recorded too: a terminal that lost the output still leaves the file.
    save('manifest.json', { ...manifest, failedAt: new Date().toISOString(), failure: e.message, undo: undone });
    throw e;
  }
}

// Rehearsal-only faults, each placed where a real failure of that kind would show up.
async function injectFault(cfg, target, i0) {
  const f = process.env.MIGRATE_FAULT;
  // Only the object faults act here; the others are placed where their failure occurs.
  if (!['touch-source', 'drop-object', 'alter-object', 'alter-metadata', 'public-evidence'].includes(f)) return;
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

async function rollback(cfg) {
  const saved = join(cfg.backupDir ?? '', 'legacy-container.json');
  const manifest = join(cfg.backupDir ?? '', 'manifest.json');
  if (!existsSync(saved) || !existsSync(manifest))
    refuse(`no migrate run recorded in ${cfg.backupDir}`);
  const m = JSON.parse(readFileSync(manifest, 'utf8'));
  if (!m.finishedAt)
    refuse(
      m.failedAt
        ? `that run did not finish its switch; its failure path ran (${m.undo ?? 'outcome not recorded'})`
        : 'that run neither finished nor recorded a failure (killed?): check the containers, the volumes and the move record by hand (runbook, Rollback)',
    );
  const legacy = JSON.parse(readFileSync(saved, 'utf8'));
  // The recorded source decides, not the environment: MIGRATE_SRC_VOLUME=x must not skip the approval.
  guard('rollback', m.source.volume, process.env);
  const cur = docker(['inspect', cfg.dstContainer], { allowFail: true });
  const curMount =
    cur.status === 0
      ? JSON.parse(cur.stdout)[0].Mounts.find((x) => x.Destination === '/data')?.Name
      : null;
  if (curMount !== cfg.dstVolume)
    refuse(
      `${cfg.dstContainer} mounts ${curMount ?? 'nothing'}, not ${cfg.dstVolume}: nothing to roll back (already rolled back?)`,
    );
  // The way back must exist before anything stops: the old image can no longer be pulled.
  if (!exists('image', legacy.Image)) {
    const tar = join(cfg.backupDir, LEGACY_IMAGE_TAR);
    if (existsSync(tar)) {
      log(`the old image ${legacy.Image} is gone (pruned?): loading the copy migrate saved`);
      docker(['load', '-i', tar]);
    }
    if (!exists('image', legacy.Image))
      refuse(`the old image ${legacy.Image} is gone and no saved copy restores it: docker load it first`);
  }
  for (const v of legacy.Mounts.filter((x) => x.Type === 'volume'))
    if (!exists('volume', v.Name)) refuse(`the old volume ${v.Name} does not exist`);
  const served = { network: 'host', host: `127.0.0.1:${cfg.hostPort}`, ...cfg.dstCreds };
  let now = null;
  try {
    now = inventory(cfg, served);
  } catch (e) {
    log(
      `the new MinIO could not be read (${e.message}); check ${cfg.dstVolume} by hand for objects written after the switch`,
    );
  }
  // Last point where an interrupt changes nothing. From the stop to the old MinIO answering, an
  // interrupt is only recorded (the handler keeps Node alive), and a failure puts the new one back.
  await checkpoint();
  const kept = `${cfg.dstContainer}-migrated-${m.run}`;
  const envOf = (k) => legacy.Config.Env.find((e) => e.startsWith(`${k}=`))?.slice(k.length + 1);
  const old = {
    network: 'host',
    host: `127.0.0.1:${cfg.hostPort}`,
    user: envOf('MINIO_ROOT_USER'),
    pass: envOf('MINIO_ROOT_PASSWORD'),
  };
  let made = null;
  let renamed = false;
  try {
    // The stop and the rename are inside the recovery too: an interrupted stop still gets the new
    // MinIO started again (WO-INFRA-015A review).
    docker(['stop', cfg.dstContainer]);
    docker(['rename', cfg.dstContainer, kept]);
    renamed = true;
    made = recreateLegacy(legacy);
    if (process.env.MIGRATE_FAULT === 'fail-rollback') refuse('rehearsal fault: the old MinIO did not come back');
    waitReady(cfg, old);
  } catch (e) {
    // Never leave nothing serving: remove only what this call created, put the new MinIO back,
    // and say whether it answers again (verified, not assumed; WO-INFRA-015A).
    if (made) docker(['rm', '-f', made.id], { allowFail: true });
    if (renamed) docker(['rename', kept, cfg.dstContainer], { allowFail: true });
    docker(['start', cfg.dstContainer], { allowFail: true });
    let back = 'and it answers again';
    try {
      waitReady(cfg, served);
    } catch (w) {
      back = `but NOTHING ANSWERS on port ${cfg.hostPort} (${w.message}); act by hand (runbook, Rollback)`;
    }
    refuse(`rollback failed (${e.message}); ${cfg.dstContainer} was put back on ${cfg.dstVolume}, ${back}`);
  }
  if (interruption.signal)
    log(`interrupt (${interruption.signal}) arrived during the switch back, which completed; verifying it`);
  // The move is undone, so its record goes FIRST, before any check that can fail: the guard must not
  // serve the kept volume again. Verified; a failure is an error, not a warning (PHASE-002B-01 review).
  const cleared = onTarget(
    cfg,
    `if [ -f /d/${MOVE_RECORD} ]; then mv -f /d/${MOVE_RECORD} /d/.adulis-migration-rolled-back; fi; [ ! -e /d/${MOVE_RECORD} ]`,
    [],
    { allowFail: true },
  );
  if (cleared.status !== 0)
    refuse(
      `${made.name} serves ${m.source.volume} again, BUT the move record in ${cfg.dstVolume} could not be cleared: delete /${MOVE_RECORD} in it by hand, and leave ADULIS_MINIO_VOLUME unset, before any compose up`,
    );
  const back = inventory(cfg, old);
  const savedInv = {
    objects: new Map(
      Object.entries(
        JSON.parse(readFileSync(join(cfg.backupDir, 'inventory-source.json'), 'utf8')),
      ),
    ),
  };
  const drift = compareObjects(savedInv, back);
  const after = now ? compareObjects(back, now) : ['not readable: check by hand'];
  log(
    `${kept} and ${cfg.dstVolume} are kept, unchanged. Changes after the switch, only there ("unexpected" = added, "missing" = deleted, "differs" = changed): ${after.length}${after.length ? `\n  ${after.slice(0, 20).join('\n  ')}` : ''}`,
  );
  fail(
    `${made.name} serves ${m.source.volume} again, but it differs from its state at the migration`,
    drift,
  );
  interruption.finished = true;
  log(
    `ROLLED BACK: ${made.name} serves ${m.source.volume} again, identical to its state at the migration (${Object.entries(
      counts(back),
    )
      .map(([b, n]) => `${b}=${n}`)
      .join(' ')}).`,
  );
  log(
    `While rolled back, \`docker compose up\` fails: it starts ${kept}, whose port ${made.name} now holds (rehearsed). Nothing is changed by that failure.`,
  );
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  // Installed for every command, so Node never dies between two steps of a migrate or rollback.
  // SIGHUP: the console window closed (Node on Windows then has about 10 s); SIGBREAK: Ctrl+Break.
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
    } else if (cmd === 'plan' || cmd === 'migrate' || cmd === 'rollback') {
      const cfg = resolveConfig(cmd, process.env);
      await { plan, migrate, rollback }[cmd](cfg);
    } else
      refuse('usage: minio-migrate.mjs plan | migrate | rollback | verify-backup <tar> [<sums>]');
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
