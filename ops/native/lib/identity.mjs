// Positive identity verification for a native test run.
//
// An environment variable states what someone intended. Each check below reads the LIVE resource
// and compares it with the manifest the harness wrote when it created that resource. A check is
// PASS, FAIL or UNKNOWN (it could not be determined: a docker, psql or http error, a timeout).
// Only PASS lets an operation through; nothing is retried into a pass.
//
// The checks are pure functions over `facts`; `observe` collects the facts through an injected
// `io` ({ docker, Client, fetch, proc }), so the refusal tests run without Docker or a network.
import { checkUrlConfig, DISPOSABLE_MARKER } from '../../scripts/lib/disposable-db.mjs';
import { checkStorageConfig, STORAGE_MARKER } from '../../scripts/lib/disposable-storage.mjs';
import { signedGet } from './s3.mjs';
import {
  hasComposeLabel,
  isProtectedContainer,
  isProtectedNetwork,
  isProtectedVolume,
  LABEL,
  namePrefix,
  OWNER,
  PORT_BLOCK,
  PROTECTED_DATABASES,
  PROTECTED_PORTS,
} from './protected.mjs';
import { RUN_RE, SCHEMA } from './manifest.mjs';

export const CHECKS = {
  'ID-00': 'manifest',
  'ID-01': 'PostgreSQL server',
  'ID-02': 'database',
  'ID-03': 'database marker',
  'ID-04': 'API instance',
  'ID-05': 'API environment',
  'ID-06': 'MinIO endpoint',
  'ID-07': 'bucket marker',
  'ID-08': 'mounts and volumes',
  'ID-09': 'addresses, ports and credentials',
  'ID-10': 'ownership labels',
};

export const ROLES = {
  postgres: {
    name: 'pg',
    volume: 'pgVolume',
    dest: '/var/lib/postgresql/data',
    cport: '5432/tcp',
    port: 'pg',
    vrole: 'volume-pgdata',
  },
  minio: {
    name: 'minio',
    volume: 'minioVolume',
    dest: '/data',
    cport: '9000/tcp',
    port: 's3',
    vrole: 'volume-miniodata',
  },
};
export const MARKER_BUCKET = STORAGE_MARKER.bucket;
export const RUN_MARKER_KEY = 'native-run';
export const BUCKETS = ['adulis-media', 'adulis-evidence'];
export const apiAppName = (m) => `adulis-native-${m.run8}-app`;
export const runValue = (m) => `${m.run}:${m.nonce}`;

const result = (id, problems, unknowns = []) => ({
  id,
  verdict: problems.length ? 'FAIL' : unknowns.length ? 'UNKNOWN' : 'PASS',
  detail: [...problems, ...unknowns].join('; '),
});
const bad = (f) => f === undefined || f === null || f.error !== undefined;
const why = (f) => (f?.error ? f.error : 'not collected');

/* ---------- ID-00 and the configuration checks (no I/O) ---------- */

const ID64 = /^[0-9a-f]{64}$/;

export function manifestProblems(m, { run, states } = {}) {
  const p = [];
  if (!m || typeof m !== 'object') return ['there is no manifest'];
  if (m.schema !== SCHEMA) p.push(`manifest schema ${m.schema} is not ${SCHEMA}`);
  if (!RUN_RE.test(`${m.run}`)) p.push(`run id '${m.run}' is not a native run id`);
  if (run !== undefined && m.run !== run)
    p.push(`manifest run ${m.run} is not the run asked for (${run})`);
  if (!/^[0-9a-f]{8}$/.test(`${m.run8}`) || !`${m.run}`.endsWith(`-${m.run8}`))
    p.push('run8 does not match the run id');
  if (!/^[0-9a-f]{64}$/.test(`${m.nonce}`)) p.push('the run nonce is missing or malformed');
  if (states && !states.includes(m.state))
    p.push(`the run is in state '${m.state}', not one of ${states.join(', ')}`);
  // Ids reach docker argument lists: only full ids, never anything that could read as an option.
  for (const [role, c] of Object.entries(m.containers ?? {}))
    if (!ID64.test(`${c?.id}`))
      p.push(`the recorded id of container ${role} is not a full container id`);
  if (m.network && !ID64.test(`${m.network.id}`))
    p.push('the recorded network id is not a full id');
  return p;
}

/** Which host, ports, database name, names and secrets the run uses. Decidable before any connection. */
export function configProblems(m) {
  const p = [];
  const dbp = [];
  const prefix = namePrefix(m.run8);
  const ports = m.ports ?? {};
  const seen = new Set();
  for (const k of ['pg', 's3', 'api']) {
    const v = ports[k];
    if (k === 'api' && v === undefined) continue;
    if (!Number.isInteger(v)) p.push(`port ${k} is not set`);
    else {
      if (v < PORT_BLOCK.from || v > PORT_BLOCK.to)
        p.push(`port ${k}=${v} is outside the reserved block ${PORT_BLOCK.from}-${PORT_BLOCK.to}`);
      if (PROTECTED_PORTS.has(v)) p.push(`port ${k}=${v} is a protected port`);
      if (seen.has(v)) p.push(`port ${v} is used twice`);
      seen.add(v);
    }
  }
  if (m.db?.host !== '127.0.0.1')
    p.push(`the database host is '${m.db?.host}', not the literal 127.0.0.1`);
  const db = `${m.db?.name}`;
  if (PROTECTED_DATABASES.has(db)) dbp.push(`database ${db} is a protected database`);
  if (db !== `adulis_native_${m.run8}`)
    dbp.push(`database ${db} is not this run's database adulis_native_${m.run8}`);
  for (const [k, v] of Object.entries(m.names ?? {})) {
    if (!`${v}`.startsWith(prefix))
      p.push(`name ${k}='${v}' does not carry this run's prefix ${prefix}`);
  }
  if (!m.names?.pg || !m.names?.minio || !m.names?.network) p.push('resource names are missing');
  for (const [k, v] of Object.entries(m.secrets ?? {})) {
    if (!/^[0-9a-f]{20,}$/.test(`${v}`)) p.push(`credential ${k} is not a per-run random value`);
  }
  return { database: dbp, other: p };
}

const ALLOWED_API_ENV = new Set([
  'NODE_ENV',
  'PORT',
  'CONSOLE_ORIGIN',
  'DATABASE_URL',
  'DATABASE_URL_JOBS',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_MEDIA_BUCKET',
  'R2_EVIDENCE_BUCKET',
  'R2_MEDIA_PUBLIC_ORIGIN',
  'EVIDENCE_ENCRYPTION_KEY_V1',
  'PAYOUT_ENCRYPTION_KEY_V1',
  'IDENTITY_HASH_KEY_V1',
  'ADULIS_BOOT_MARKER',
  'DEV_SMS_LOG',
  'SystemRoot',
  'PATH',
  'TEMP',
  'TMP',
]);

/** The environment the API child is given is an allow-list: it never inherits and never reads an env file. */
export function apiEnvProblems(env, m) {
  const p = [];
  for (const k of Object.keys(env))
    if (!ALLOWED_API_ENV.has(k)) p.push(`environment variable ${k} is not on the allow-list`);
  if (env.NODE_ENV !== 'development') p.push(`NODE_ENV is '${env.NODE_ENV}', not development`);
  if (env.PORT !== `${m.ports?.api}`)
    p.push(`PORT ${env.PORT} is not this run's API port ${m.ports?.api}`);
  const urls = checkUrlConfig(env, ['DATABASE_URL', 'DATABASE_URL_JOBS'], new Set());
  p.push(...urls.problems);
  for (const { name, url } of urls.urls) {
    if (url.hostname !== '127.0.0.1')
      p.push(`${name} host is ${url.hostname}, not the literal 127.0.0.1`);
    if (url.port !== `${m.ports?.pg}`)
      p.push(`${name} port ${url.port} is not this run's PostgreSQL port ${m.ports?.pg}`);
    if (decodeURIComponent(url.pathname.slice(1)) !== m.db?.name)
      p.push(`${name} names database ${url.pathname.slice(1)}, not ${m.db?.name}`);
    const [user, secret] = {
      DATABASE_URL: ['adulis_app', m.secrets?.app],
      DATABASE_URL_JOBS: ['adulis_jobs', m.secrets?.jobs],
    }[name];
    if (decodeURIComponent(url.username) !== user || decodeURIComponent(url.password) !== secret)
      p.push(`${name} does not carry this run's ${user} credential`);
  }
  const s = checkStorageConfig(env);
  if (!s.configured) p.push('the six R2_* values are not set');
  p.push(...s.problems);
  if (s.endpoint && s.endpoint !== `http://127.0.0.1:${m.ports?.s3}`)
    p.push(`R2_ACCOUNT_ID ${s.endpoint} is not this run's MinIO`);
  if (env.R2_ACCESS_KEY_ID !== m.secrets?.s3Key)
    p.push("R2_ACCESS_KEY_ID is not this run's access key");
  if (env.R2_SECRET_ACCESS_KEY !== m.secrets?.s3Secret)
    p.push("R2_SECRET_ACCESS_KEY is not this run's secret key");
  return p;
}

/* ---------- Docker resource rules (used by verify and by cleanup) ---------- */

const labelsOf = (o) => o?.Config?.Labels ?? o?.Labels ?? {};
// A problem is { id, msg, hard }: ID-08 isolation (mounts, volumes, networks), ID-09 addresses,
// ID-10 ownership. Cleanup applies the ownership problems and the `hard` ones (a protected volume);
// verification applies every one.
const P = (id, msg, hard = false) => ({ id, msg, hard });
/** What cleanup must prove before it removes anything: ownership, plus the hard isolation rules. */
export const ownership = (problems) => problems.filter((x) => x.id === 'ID-10' || x.hard);
// Created-time floor on the DAEMON's clock (recorded before anything was created), not the host's.
const createdFloor = (m) => Date.parse(m.engine?.systemTime ?? m.createdAt) - 1000;
const labelProblems = (m, labels, role, what) => {
  const p = [];
  if (labels[LABEL.owner] !== OWNER)
    p.push(P('ID-10', `${what} has no ${LABEL.owner}=${OWNER} label`));
  if (labels[LABEL.run] !== m.run)
    p.push(P('ID-10', `${what} carries run label '${labels[LABEL.run]}', not ${m.run}`));
  if (labels[LABEL.role] !== role)
    p.push(P('ID-10', `${what} carries role label '${labels[LABEL.role]}', not ${role}`));
  if (hasComposeLabel(labels))
    p.push(P('ID-10', `${what} carries compose labels: it belongs to a compose project`));
  return p;
};

/** Ownership and isolation of one container, from `docker inspect`. */
export function containerProblems(m, role, info) {
  const r = ROLES[role];
  const rec = m.containers?.[role];
  if (!info?.Id) return [P('ID-10', `${role} container was not found`)];
  const p = [];
  const name = `${info.Name ?? ''}`.replace(/^\//, '');
  const what = `container ${name}`;
  if (info.Id !== rec?.id)
    p.push(P('ID-10', `${what} has id ${info.Id}, not the recorded ${rec?.id}`));
  if (name !== m.names[r.name]) p.push(P('ID-10', `${what} is not named ${m.names[r.name]}`));
  if (!name.startsWith(namePrefix(m.run8)))
    p.push(P('ID-10', `${what} does not carry this run's prefix`));
  if (isProtectedContainer(name)) p.push(P('ID-10', `${what} is a protected container`));
  p.push(...labelProblems(m, labelsOf(info), role, what));
  if (!(Date.parse(info.Created) >= createdFloor(m)))
    p.push(P('ID-10', `${what} was created before this run`));
  const mounts = info.Mounts ?? [];
  for (const mt of mounts) {
    const ok = mt.Type === 'volume' && mt.Name === m.names[r.volume] && mt.Destination === r.dest;
    if (!ok)
      p.push(
        P(
          'ID-08',
          `${what} mounts ${mt.Type} ${mt.Name ?? mt.Source} at ${mt.Destination}` +
            `${isProtectedVolume(mt.Name) ? ' (a protected volume)' : ''}: not this run's volume`,
          isProtectedVolume(mt.Name),
        ),
      );
  }
  if (!mounts.some((mt) => mt.Name === m.names[r.volume]))
    p.push(P('ID-08', `${what} does not mount this run's volume ${m.names[r.volume]}`));
  // Docker lists a named volume's mount in Binds too ("<volume>:<destination>"); only that exact
  // entry is this run's own volume, every other entry is a host path.
  const own = `${m.names[r.volume]}:${r.dest}`;
  for (const b of info.HostConfig?.Binds ?? [])
    if (b !== own && !b.startsWith(`${own}:`)) p.push(P('ID-08', `${what} has bind mount ${b}`));
  if ((info.HostConfig?.VolumesFrom ?? []).length)
    p.push(P('ID-08', `${what} takes volumes from another container`));
  if (Object.keys(info.HostConfig?.Tmpfs ?? {}).length)
    p.push(P('ID-08', `${what} has tmpfs mounts`));
  const nets = Object.keys(info.NetworkSettings?.Networks ?? {});
  if (nets.length !== 1 || nets[0] !== m.names.network)
    p.push(P('ID-08', `${what} is attached to [${nets.join(', ')}], not only ${m.names.network}`));
  return p;
}

/** Published ports of one container: loopback only, this run's port only. */
export function portProblems(m, role, info) {
  const r = ROLES[role];
  const p = [];
  const published = Object.entries(info?.NetworkSettings?.Ports ?? {}).filter(([, v]) => v);
  const want = `${m.ports?.[r.port]}`;
  for (const [cport, binds] of published) {
    for (const b of binds) {
      if (b.HostIp !== '127.0.0.1')
        p.push(
          P(
            'ID-09',
            `${role} publishes ${cport} on ${b.HostIp || 'all interfaces'}, not 127.0.0.1`,
          ),
        );
      if (cport !== r.cport || b.HostPort !== want)
        p.push(
          P(
            'ID-09',
            `${role} publishes ${cport} as host port ${b.HostPort}, not ${r.cport} as ${want}`,
          ),
        );
    }
  }
  if (!published.some(([c]) => c === r.cport))
    p.push(P('ID-09', `${role} does not publish ${r.cport}`));
  return p;
}

export function volumeProblems(m, key, info) {
  const r = ROLES[key];
  const want = m.names[r.volume];
  if (!info?.Name) return [P('ID-10', `volume ${want} was not found`)];
  const p = [];
  if (info.Name !== want) p.push(P('ID-10', `volume ${info.Name} is not ${want}`));
  if (isProtectedVolume(info.Name))
    p.push(P('ID-08', `volume ${info.Name} is a protected volume`, true));
  if (!info.Name.startsWith(namePrefix(m.run8)))
    p.push(P('ID-10', `volume ${info.Name} does not carry this run's prefix`));
  p.push(...labelProblems(m, info.Labels ?? {}, r.vrole, `volume ${info.Name}`));
  // A local volume with driver options can be a bind mount in disguise.
  if (info.Options && Object.keys(info.Options).length)
    p.push(P('ID-08', `volume ${info.Name} has driver options (a disguised bind mount?)`));
  return p;
}

export function networkProblems(m, info) {
  const want = m.names.network;
  if (!info?.Id) return [P('ID-10', `network ${want} was not found`)];
  const p = [];
  if (info.Id !== m.network?.id)
    p.push(P('ID-10', `network ${info.Name} has id ${info.Id}, not the recorded ${m.network?.id}`));
  if (info.Name !== want) p.push(P('ID-10', `network ${info.Name} is not ${want}`));
  if (isProtectedNetwork(info.Name))
    p.push(P('ID-10', `network ${info.Name} is a protected network`));
  if (!`${info.Name}`.startsWith(namePrefix(m.run8)))
    p.push(P('ID-10', `network ${info.Name} does not carry this run's prefix`));
  p.push(...labelProblems(m, info.Labels ?? {}, 'network', `network ${info.Name}`));
  const mine = new Set(Object.values(m.containers ?? {}).map((c) => c.id));
  for (const id of Object.keys(info.Containers ?? {}))
    if (!mine.has(id))
      p.push(
        P(
          'ID-08',
          `network ${info.Name} has an attached container ${id} that is not this run's`,
          true,
        ),
      );
  return p;
}

/** The live listing by this run's label must equal what the manifest records. */
export function listingProblems(m, listing) {
  const p = [];
  const want = {
    containers: Object.values(m.containers ?? {}).map((c) => c.id),
    volumes: [m.names.pgVolume, m.names.minioVolume],
    networks: m.network ? [m.network.id] : [],
  };
  for (const kind of ['containers', 'volumes', 'networks']) {
    const l = listing?.[kind];
    if (bad(l)) continue; // an unreadable listing is UNKNOWN, reported by the caller
    for (const id of l.ids)
      if (!want[kind].includes(id))
        p.push(
          P(
            'ID-10',
            `a ${kind.slice(0, -1)} labelled with this run (${id}) is not in the manifest`,
          ),
        );
  }
  return p;
}

/* ---------- the identity checks over facts ---------- */

function dockerChecks(m, f) {
  const d = f.docker;
  const found = [];
  const unk = [];
  for (const role of Object.keys(ROLES)) {
    const info = d?.containers?.[role];
    if (bad(info)) unk.push(`${role}: ${why(info)}`);
    else found.push(...containerProblems(m, role, info), ...portProblems(m, role, info));
    const vol = d?.volumes?.[role];
    if (bad(vol)) unk.push(`volume of ${role}: ${why(vol)}`);
    else found.push(...volumeProblems(m, role, vol));
  }
  if (bad(d?.network)) unk.push(`network: ${why(d?.network)}`);
  else found.push(...networkProblems(m, d.network));
  for (const kind of ['containers', 'volumes', 'networks'])
    if (bad(d?.listing?.[kind])) unk.push(`listing of ${kind}: ${why(d?.listing?.[kind])}`);
  found.push(...listingProblems(m, d?.listing));
  const only = (id) => found.filter((x) => x.id === id).map((x) => x.msg);
  return ['ID-08', 'ID-09', 'ID-10'].map((id) => result(id, only(id), unk));
}

function pgChecks(m, f) {
  const { tcp, inside } = f.pg ?? {};
  const unk = [];
  const same = (name, pick, want, p) => {
    for (const [chan, v] of [
      ['over TCP', tcp],
      ['inside the container', inside],
    ])
      if (!bad(v) && pick(v) !== want)
        p.push(`${name} ${chan} is '${pick(v)}', not the recorded '${want}'`);
  };
  for (const [chan, v] of [
    ['over TCP', tcp],
    ['inside the container', inside],
  ])
    if (bad(v)) unk.push(`${chan}: ${why(v)}`);
  const p1 = [];
  const p2 = [];
  const p3 = [];
  if (!bad(tcp) && !bad(inside) && tcp.systemId !== inside.systemId)
    p1.push(
      `PostgreSQL over TCP (${tcp.systemId}) is a different server from the container (${inside.systemId})`,
    );
  same('system identifier', (v) => v.systemId, m.db.systemId, p1);
  same('postmaster start time', (v) => v.startTime, m.db.postmasterStart, p1);
  same('database', (v) => v.db, m.db.name, p2);
  same('database oid', (v) => v.oid, m.db.oid, p2);
  same('database comment', (v) => v.marker, DISPOSABLE_MARKER, p3);
  same('run setting', (v) => v.setting, runValue(m), p3);
  return [result('ID-01', p1, unk), result('ID-02', p2, unk), result('ID-03', p3, unk)];
}

const tagOf = (xml, key) =>
  new RegExp(`<Key>${key}</Key>\\s*<Value>([^<]*)</Value>`).exec(`${xml}`)?.[1];

function s3Checks(m, f) {
  const s = f.s3 ?? {};
  const p6 = [];
  const p7 = [];
  const unk6 = [];
  const unk7 = [];
  if (bad(s.list)) unk6.push(`signed ListBuckets: ${why(s.list)}`);
  else if (s.list.status !== 200)
    p6.push(`the store rejected the run's credentials (HTTP ${s.list.status})`);
  else
    for (const b of BUCKETS)
      if (!s.list.body.includes(`<Name>${b}</Name>`)) p6.push(`bucket ${b} is missing`);
  if (bad(s.deployment)) unk6.push(`deployment id: ${why(s.deployment)}`);
  else if (s.deployment.id !== m.s3?.deploymentId)
    p6.push(`deployment id ${s.deployment.id} is not the recorded ${m.s3?.deploymentId}`);
  for (const b of BUCKETS) {
    const t = s.tags?.[b];
    if (bad(t)) unk7.push(`tags of ${b}: ${why(t)}`);
    else if (t.status !== 200 || tagOf(t.body, 'adulis-native-run') !== m.run)
      p7.push(`bucket ${b} is not tagged with this run`);
  }
  if (bad(s.marker)) unk7.push(`run marker object: ${why(s.marker)}`);
  else if (s.marker.status !== 200 || s.marker.body.trim() !== runValue(m))
    p7.push('the run marker object is missing or belongs to another run');
  if (bad(s.repoMarker)) unk7.push(`storage marker: ${why(s.repoMarker)}`);
  else if (s.repoMarker.status !== 200 || s.repoMarker.body.trim() !== STORAGE_MARKER.body)
    p7.push('the disposable-storage marker is missing');
  return [result('ID-06', p6, unk6), result('ID-07', p7, unk7)];
}

/** Splits a Windows command line into tokens (double quotes group; no escapes are needed here). */
export const tokens = (line) =>
  [...`${line}`.matchAll(/"([^"]*)"|(\S+)/g)].map((x) => x[1] ?? x[2]);
const norm = (s) => `${s}`.replaceAll('\\', '/').toLowerCase();

function apiChecks(m, f) {
  const a = f.api ?? {};
  const rec = m.api;
  const p4 = [];
  const p5 = [];
  const unk4 = [];
  if (!rec)
    return [
      result('ID-04', ['no API was started by this run']),
      result('ID-05', ['no API was started by this run']),
    ];
  if (bad(a.health)) unk4.push(`/healthz: ${why(a.health)}`);
  else {
    if (a.health.status !== 200 || a.health.json?.db !== 'up')
      p4.push(`/healthz answered ${a.health.status} with db '${a.health.json?.db}'`);
    if (a.health.json?.boot_marker !== rec.bootMarker)
      p4.push(`/healthz boot marker '${a.health.json?.boot_marker}' is not this start's marker`);
  }
  if (bad(a.listeners)) unk4.push(`listener lookup: ${why(a.listeners)}`);
  else if (a.listeners.length !== 1 || a.listeners[0] !== rec.pid)
    p4.push(
      `the listener(s) on the API port are [${a.listeners.join(', ')}], not the recorded pid ${rec.pid}`,
    );
  if (bad(a.proc)) unk4.push(`process lookup: ${why(a.proc)}`);
  else {
    if (a.proc.createdAt !== rec.createdAt)
      p4.push(
        `process ${rec.pid} was created at ${a.proc.createdAt}, not the recorded ${rec.createdAt} (pid reused?)`,
      );
    const t = tokens(a.proc.commandLine);
    if (t.length !== 2 || norm(t[0]) !== norm(rec.node) || norm(t[1]) !== norm(rec.main))
      p4.push(`process ${rec.pid} runs '${a.proc.commandLine}', not '${rec.node} ${rec.main}'`);
  }
  if (bad(a.activity)) unk4.push(`pg_stat_activity: ${why(a.activity)}`);
  else if (!a.activity.rows.some((r) => r.user === 'adulis_app' && r.app === apiAppName(m)))
    p4.push(
      `no connection from application ${apiAppName(m)} in this server (the API is attached to another database or server)`,
    );
  if (bad(a.bootstrap)) unk4.push(`/v1/bootstrap: ${why(a.bootstrap)}`);
  else {
    const j = a.bootstrap.json;
    if (a.bootstrap.status !== 200 || j?.environment !== 'development')
      p5.push(`/v1/bootstrap reports environment '${j?.environment}', not development`);
    if (j?.media_public_origin !== `http://127.0.0.1:${m.ports.s3}/adulis-media`)
      p5.push(`media origin '${j?.media_public_origin}' is not this run's MinIO`);
  }
  return [
    result('ID-04', p4, unk4),
    result('ID-05', p5, bad(a.bootstrap) ? [`/v1/bootstrap: ${why(a.bootstrap)}`] : []),
  ];
}

/** The engine and context a command talks to must be the ones the run was created in. */
export function engineProblems(m, e) {
  if (!m.engine?.id)
    return ['the manifest records no Docker engine: the run cannot be proven present or absent'];
  const p = [];
  if (e.id !== m.engine.id)
    p.push(`this Docker engine (${e.id}) is not the one the run was created in (${m.engine.id})`);
  if (e.context !== m.engine.context)
    p.push(`the Docker context is '${e.context}', not the recorded '${m.engine.context}'`);
  return p;
}

/** All results for the facts that were collected. */
export function checkFacts(m, f, need) {
  const out = [];

  if (need.some((id) => ['ID-08', 'ID-09', 'ID-10'].includes(id))) out.push(...dockerChecks(m, f));
  if (need.some((id) => ['ID-01', 'ID-02', 'ID-03'].includes(id))) out.push(...pgChecks(m, f));
  if (need.some((id) => ['ID-06', 'ID-07'].includes(id))) out.push(...s3Checks(m, f));
  if (need.some((id) => ['ID-04', 'ID-05'].includes(id))) out.push(...apiChecks(m, f));
  return out;
}

/* ---------- collecting the facts ---------- */

const safe = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    return { error: e?.message ?? String(e) };
  }
};
const text = (r) => `${r.stderr || r.stdout || r.error?.message || ''}`.trim().slice(-300);
const ok = (r) => !r.error && r.status === 0;

// What `docker inspect` of a missing object says, read from a real engine: "No such container: <id>",
// "get <name>: no such volume", "network <id> not found", each as the daemon's own error. Anything else
// that merely contains those words ("connect: no such file or directory", "page not found", "executable
// file not found") is not a missing object: it stays an unknown and refuses.
export const NOT_FOUND =
  /Error response from daemon: (?:No such container: \S+|get \S+: no such volume|network \S+ not found)\s*$/i;

async function inspectJson(io, args) {
  const r = await io.docker(args);
  if (!ok(r))
    return {
      error: `docker ${args[0]} failed: ${text(r)}`,
      absent: NOT_FOUND.test(text(r)),
    };
  try {
    const o = JSON.parse(r.stdout)[0];
    return o ?? { error: 'docker returned nothing' };
  } catch {
    return { error: 'docker returned no readable description' };
  }
}

/** The Docker engine (id and clock) and context behind `io.docker`; `up` records them, every command compares. */
export async function engineFacts(io) {
  const r = await io.docker(['info', '--format', '{{.ID}}|{{.SystemTime}}']);
  if (!ok(r)) return { error: `docker info failed: ${text(r)}` };
  const [id, systemTime] = r.stdout.trim().split('|');
  if (!id || Number.isNaN(Date.parse(systemTime)))
    return { error: 'docker info returned no engine id or clock' };
  const c = await io.docker(['context', 'show']);
  if (!ok(c) || !c.stdout.trim()) return { error: `docker context show failed: ${text(c)}` };
  return { id, systemTime, context: c.stdout.trim() };
}

async function listIds(io, args) {
  const r = await io.docker(args);
  if (!ok(r)) return { error: `listing failed: ${text(r)}` };
  return { ids: r.stdout.split(/\s+/).filter(Boolean) };
}

export const IDENT_SQL =
  "SELECT (SELECT system_identifier::text FROM pg_control_system()) || '|' || " +
  "to_char(pg_postmaster_start_time() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US') || '|' || " +
  "current_database() || '|' || d.oid::text || '|' || coalesce(shobj_description(d.oid, 'pg_database'), '') || '|' || " +
  "coalesce((SELECT substr(s, length('adulis.native_run=') + 1) FROM pg_db_role_setting r, unnest(r.setconfig) s " +
  "WHERE r.setdatabase = d.oid AND r.setrole = 0 AND starts_with(s, 'adulis.native_run=') LIMIT 1), '') AS r " +
  'FROM pg_database d WHERE d.datname = current_database()';

const parseIdent = (line) => {
  const [systemId, startTime, db, oid, marker, setting] = `${line}`.trim().split('|');
  return { systemId, startTime, db, oid, marker, setting };
};

export async function pgTcp(m, io) {
  const c = new io.Client({
    host: m.db.host,
    port: m.ports.pg,
    user: m.db.user,
    password: m.secrets.pg,
    database: m.db.name,
    options: '-c default_transaction_read_only=on',
    connectionTimeoutMillis: 5000,
  });
  try {
    await c.connect();
    const { rows } = await c.query(IDENT_SQL);
    if (!rows[0]) throw new Error('the identity query returned no row');
    return parseIdent(rows[0].r);
  } finally {
    await c.end().catch(() => {});
  }
}

export const psqlArgs = (m, id, extra = [], stdin = false) => [
  'exec',
  ...(stdin ? ['-i'] : []),
  id,
  'psql',
  '-U',
  m.db.user,
  '-d',
  m.db.name,
  '-AtX',
  '-v',
  'ON_ERROR_STOP=1',
  ...extra,
];

async function pgInside(m, io) {
  const r = await io.docker(psqlArgs(m, m.containers.postgres.id, ['-c', IDENT_SQL]));
  if (!ok(r)) throw new Error(`psql inside the container failed: ${text(r)}`);
  return parseIdent(r.stdout);
}

async function activity(m, io) {
  const sql =
    "SELECT usename || '|' || application_name FROM pg_stat_activity WHERE datname = current_database() AND backend_type = 'client backend'";
  const r = await io.docker(psqlArgs(m, m.containers.postgres.id, ['-c', sql]));
  if (!ok(r)) throw new Error(`psql inside the container failed: ${text(r)}`);
  return {
    rows: r.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        const [user, app] = l.split('|');
        return { user, app };
      }),
  };
}

const http = async (io, url, headers = {}) => {
  const res = await io.fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
    headers,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

/** Collects only the facts the required checks need. Every probe fails into `{ error }`. */
export async function observe(m, io, need) {
  const want = (...ids) => ids.some((id) => need.includes(id));
  const f = {};
  if (want('ID-08', 'ID-09', 'ID-10')) {
    f.docker = { containers: {}, volumes: {}, listing: {} };
    for (const role of Object.keys(ROLES)) {
      const id = m.containers?.[role]?.id;
      f.docker.containers[role] = id
        ? await safe(() => inspectJson(io, ['inspect', '--type', 'container', id]))
        : { error: 'not recorded in the manifest' };
      f.docker.volumes[role] = await safe(() =>
        inspectJson(io, ['volume', 'inspect', m.names[ROLES[role].volume]]),
      );
    }
    f.docker.network = m.network?.id
      ? await safe(() => inspectJson(io, ['network', 'inspect', m.network.id]))
      : { error: 'not recorded in the manifest' };
    const filter = `label=${LABEL.run}=${m.run}`;
    f.docker.listing.containers = await safe(() =>
      listIds(io, ['ps', '-a', '--no-trunc', '-q', '--filter', filter]),
    );
    f.docker.listing.volumes = await safe(() =>
      listIds(io, ['volume', 'ls', '-q', '--filter', filter]),
    );
    f.docker.listing.networks = await safe(() =>
      listIds(io, ['network', 'ls', '--no-trunc', '-q', '--filter', filter]),
    );
  }
  if (want('ID-01', 'ID-02', 'ID-03')) {
    f.pg = { tcp: await safe(() => pgTcp(m, io)), inside: await safe(() => pgInside(m, io)) };
  }
  if (want('ID-06', 'ID-07')) {
    const endpoint = `http://127.0.0.1:${m.ports.s3}`;
    const creds = {
      endpoint,
      accessKey: m.secrets.s3Key,
      secretKey: m.secrets.s3Secret,
      fetchImpl: io.fetch,
    };
    f.s3 = { tags: {} };
    f.s3.list = await safe(() => signedGet({ ...creds, path: '/' }));
    for (const b of BUCKETS)
      f.s3.tags[b] = await safe(() => signedGet({ ...creds, path: `/${b}`, query: 'tagging=' }));
    f.s3.marker = await safe(() =>
      signedGet({ ...creds, path: `/${MARKER_BUCKET}/${RUN_MARKER_KEY}` }),
    );
    f.s3.repoMarker = await safe(async () => {
      const res = await io.fetch(`${endpoint}/${STORAGE_MARKER.bucket}/${STORAGE_MARKER.key}`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      return { status: res.status, body: await res.text() };
    });
    f.s3.deployment = await safe(async () => {
      const r = await io.docker([
        'exec',
        '-e',
        `MC_HOST_local=http://${m.secrets.s3Key}:${m.secrets.s3Secret}@127.0.0.1:9000`,
        m.containers.minio.id,
        'mc',
        'admin',
        'info',
        'local',
        '--json',
      ]);
      if (!ok(r)) throw new Error(`mc admin info failed: ${text(r)}`);
      const j = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
      const id = j?.info?.deploymentID ?? j?.deploymentID;
      if (!id) throw new Error('mc admin info returned no deployment id');
      return { id };
    });
  }
  if (want('ID-04', 'ID-05') && m.api) {
    const base = `http://127.0.0.1:${m.ports.api}`;
    f.api = {};
    f.api.health = await safe(() => http(io, `${base}/healthz`));
    f.api.bootstrap = await safe(() =>
      http(io, `${base}/v1/bootstrap`, { 'X-Adulis-Client': 'android/0.0.0' }),
    );
    f.api.activity = await safe(() => activity(m, io));
    f.api.listeners = await safe(() => io.proc.listeners(m.ports.api));
    f.api.proc = await safe(() => io.proc.info(m.api.pid));
  }
  return f;
}

/**
 * Runs the required checks. The no-I/O checks (manifest, configuration) always run first and a
 * failure there returns before ANYTHING is contacted: a manifest that names a protected port is
 * refused without ever connecting to it.
 */
export async function verify(m, io, need, { run, states } = {}) {
  const first = [result('ID-00', manifestProblems(m, { run, states }))];
  if (first[0].verdict === 'PASS') {
    const c = configProblems(m);
    first.push(result('ID-09', c.other), result('ID-02', c.database));
  }
  if (first.some((r) => r.verdict !== 'PASS')) return first;
  // The first I/O: the engine and context must be the ones the run was created in, before any
  // resource is looked up (in another engine every lookup would answer "no such object").
  if (need.some((id) => id !== 'ID-00')) {
    const e = await safe(() => engineFacts(io));
    const r = bad(e)
      ? result('ID-00', [], [`docker engine: ${why(e)}`])
      : result('ID-00', engineProblems(m, e));
    first.push(r);
    if (r.verdict !== 'PASS') return first;
  }
  return [...first, ...checkFacts(m, await observe(m, io, need), need)];
}
