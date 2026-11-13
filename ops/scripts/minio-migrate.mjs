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
import { fileURLToPath } from 'node:url';

export const BUCKETS = ['adulis-media', 'adulis-evidence'];
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
];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export class Refusal extends Error {}
const refuse = (msg) => {
  throw new Refusal(msg);
};
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

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
  // Only the first words of the command: later arguments carry MC_HOST URLs with credentials.
  if (r.status !== 0 && !allowFail)
    refuse(
      `docker ${args.slice(0, 2).join(' ')} exited ${r.status}: ${(r.stderr || r.stdout).trim().slice(-1500)}`,
    );
  return allowFail ? r : r.stdout;
}
const exists = (kind, name) => docker([kind, 'inspect', name], { allowFail: true }).status === 0;

// docker with stdin from a file and/or stdout into a stream; resolves only on exit 0.
function dockerPipe(args, { from, to }) {
  return new Promise((res, rej) => {
    const p = spawn('docker', args, {
      cwd: root,
      stdio: [from ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    });
    let err = '';
    p.stderr.on('data', (d) => (err = (err + d).slice(-1500)));
    if (from) createReadStream(from).on('error', rej).pipe(p.stdin);
    const flushed = to
      ? new Promise((ok) => p.stdout.pipe(to).on('finish', ok))
      : (p.stdout.resume(), Promise.resolve());
    p.on('error', rej);
    p.on('close', (code) =>
      code === 0
        ? flushed.then(res)
        : rej(new Refusal(`docker ${args.slice(0, 2).join(' ')} exited ${code}: ${err.trim()}`)),
    );
  });
}
function sha256Sink() {
  const h = createHash('sha256');
  const w = new Writable({ write: (c, _e, cb) => (h.update(c), cb()) });
  w.digest = () => h.digest('hex');
  return w;
}
async function fileSha256(file) {
  const sink = sha256Sink();
  await new Promise((ok, ko) => createReadStream(file).on('error', ko).pipe(sink).on('finish', ok));
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
  'm=$(mc cat "a/adulis-media/$MEDIA_KEY" 2>/dev/null | sha256sum); printf "M %s\\n" "${m%% *}"',
].join('\n');

function anonymousProbes(cfg, s, src) {
  const first = (b) =>
    [...src.objects.keys()].find((k) => k.startsWith(`${b}/`))?.slice(b.length + 1) ?? '';
  const [mediaKey, evidenceKey] = [first('adulis-media'), first('adulis-evidence')];
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
      'shopt -s dotglob nullglob; f=(/d/*); echo ${#f[@]}',
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
  const sha = await fileSha256(tar);
  if (expectedSha && sha !== expectedSha)
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
    { to: createWriteStream(tar) },
  );
  const sha = await fileSha256(tar);
  writeFileSync(`${tar}.sha256`, `${sha} *${basename(tar)}\n`);
  if (process.env.MIGRATE_FAULT === 'corrupt-backup') {
    const b = readFileSync(tar);
    b[600] ^= 0xff; // one flipped byte after the checksum was recorded
    writeFileSync(tar, b);
  }
  return { tar, ...(await verifyBackup(tar, readFileSync(`${tar}.sha256`, 'utf8').split(' ')[0])) };
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
  summary('source inventory', inventory(cfg, pre.server));
  log('PLAN OK: preflight passed; nothing was changed');
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
    `${bind.HostIp ? `${bind.HostIp}:` : ''}${bind.HostPort}:9000`,
  ];
  for (const e of c.Config.Env ?? []) args.push('-e', e);
  for (const m of c.Mounts.filter((x) => x.Type === 'volume'))
    args.push('-v', `${m.Name}:${m.Destination}`);
  if (netName && exists('network', netName))
    args.push('--network', netName, ...(net.Aliases ?? []).flatMap((a) => ['--network-alias', a]));
  docker([...args, c.Image, ...(c.Config.Cmd ?? [])]);
  return name;
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
  mkdirSync(cfg.backupDir, { recursive: true });
  const save = (name, data) =>
    writeFileSync(
      join(cfg.backupDir, name),
      JSON.stringify(data, (_k, v) => (v instanceof Map ? Object.fromEntries(v) : v), 2),
    );
  save('legacy-container.json', pre.inspect);
  const net = `minio-migrate-${cfg.run}`;
  const snap = `minio-migrate-${cfg.run}-snapshot`;
  const srv = (role, image, volume, creds) => {
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
    always.push(() => docker(['rm', '-f', `${net}-${role}`], { allowFail: true }));
    return { user: creds.user, pass: creds.pass, network: net, host: `${net}-${role}:9000` };
  };
  try {
    log('1/8 source inventory, read from the running server');
    const i0 = inventory(cfg, pre.server);
    summary('source', i0);
    if (process.env.MIGRATE_FAULT === 'write-source')
      mc(
        cfg,
        pre.server,
        'echo late | mc pipe s/adulis-media/rehearsal-late-write',
        mcEnv('s', pre.server),
      );

    log(`2/8 stopping ${cfg.srcContainer}: from here nothing can write to the source`);
    docker(['stop', cfg.srcContainer]);
    undo.push(() => docker(['start', cfg.srcContainer]));

    log('3/8 backup of the stopped source volume, then its checks');
    const backup = await takeBackup(cfg);
    manifest.backup = backup;
    log(`backup ${backup.tar}: ${backup.entries} entries, sha256 ${backup.sha}`);

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

    log(
      `5/8 target volume ${cfg.dstVolume} (created by compose, so compose owns it) and a private target server`,
    );
    if (!pre.targetExists)
      undo.push(() => docker(['volume', 'rm', cfg.dstVolume], { allowFail: true }));
    docker(['compose', 'create', '--no-recreate', 'minio']);
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

    log('6/8 copying the two buckets (never the phantom PostgreSQL directories)');
    mc(cfg, target, BUCKETS.map((b) => `mc mirror --quiet "src/${b}" "dst/${b}"`).join(' && '), [
      ...mcEnv('src', snapshot),
      ...mcEnv('dst', target),
    ]);
    await injectFault(cfg, target, i0);

    log('7/8 verification: source unchanged, snapshot = source, target = snapshot, security');
    const i1 = inventory(cfg, snapshot);
    fail(
      'the source changed between its inventory and the stop (a writer is still active?)',
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

    log(
      `8/8 switching: compose recreates ${cfg.dstContainer} on ${cfg.dstVolume}; ${cfg.srcVolume} is not touched`,
    );
    undo.length = 0; // pre-switch undo steps no longer apply: the old container is replaced by compose
    undo.push(() => {
      const cur = docker(['inspect', cfg.srcContainer], { allowFail: true });
      if (cur.status === 0 && JSON.parse(cur.stdout)[0].Id === pre.inspect.Id)
        return docker(['start', cfg.srcContainer]); // compose never replaced it
      docker(['stop', cfg.dstContainer], { allowFail: true });
      docker(['rename', cfg.dstContainer, `${cfg.dstContainer}-failed-${cfg.run}`], {
        allowFail: true,
      });
      recreateLegacy(pre.inspect);
    });
    docker(['compose', 'up', '-d', 'minio', 'minio-init']);
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
        .join(
          ' ',
        )}; old volume ${cfg.srcVolume} untouched`,
    );
  } catch (e) {
    log(`FAILED, undoing: ${e.message}`);
    for (const f of always.splice(0).reverse()) f();
    for (const f of undo.reverse()) {
      try {
        f();
      } catch (u) {
        log(`UNDO STEP FAILED, act by hand (runbook, Rollback): ${u.message}`);
      }
    }
    save('manifest.json', { ...manifest, failedAt: new Date().toISOString(), failure: e.message });
    throw e;
  }
}

// Rehearsal-only faults, each placed where a real failure of that kind would show up.
async function injectFault(cfg, target, i0) {
  const f = process.env.MIGRATE_FAULT;
  if (!f || ['corrupt-backup', 'write-source'].includes(f)) return;
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
      'that run did not finish its switch; the failure path already restored the old container',
    );
  const legacy = JSON.parse(readFileSync(saved, 'utf8'));
  const served = { network: 'host', host: `127.0.0.1:${cfg.hostPort}`, ...cfg.dstCreds };
  const now = inventory(cfg, served);
  docker(['stop', cfg.dstContainer]);
  const kept = `${cfg.dstContainer}-migrated-${m.run}`;
  docker(['rename', cfg.dstContainer, kept]);
  const name = recreateLegacy(legacy);
  const envOf = (k) => legacy.Config.Env.find((e) => e.startsWith(`${k}=`))?.slice(k.length + 1);
  const old = {
    network: 'host',
    host: `127.0.0.1:${cfg.hostPort}`,
    user: envOf('MINIO_ROOT_USER'),
    pass: envOf('MINIO_ROOT_PASSWORD'),
  };
  waitReady(cfg, old);
  const back = inventory(cfg, old);
  const newer = [...now.objects.keys()].filter((k) => !back.objects.has(k));
  log(
    `ROLLED BACK: ${name} serves ${m.source.volume} again (${Object.entries(counts(back))
      .map(([b, n]) => `${b}=${n}`)
      .join(' ')}).`,
  );
  log(
    `${kept} and ${cfg.dstVolume} are kept, unchanged. Objects written after the switch, still only there: ${newer.length}${newer.length ? `\n  ${newer.slice(0, 20).join('\n  ')}` : ''}`,
  );
  log(
    `While rolled back, \`docker compose up\` fails: it starts ${kept}, whose port ${name} now holds (rehearsed). Nothing is changed by that failure.`,
  );
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    if (cmd === 'verify-backup') {
      if (!args[0]) refuse('usage: verify-backup <tar> [<sha256sums file>]');
      const sums = args[1]
        ? readFileSync(args[1], 'utf8')
        : existsSync(`${args[0]}.sha256`)
          ? readFileSync(`${args[0]}.sha256`, 'utf8')
          : null;
      const line = sums?.split('\n').find((l) => l.trim().endsWith(basename(args[0])));
      if (!line) refuse(`no recorded SHA-256 for ${basename(args[0])}`);
      const r = await verifyBackup(args[0], line.split(/\s+/)[0]);
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
