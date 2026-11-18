// Creating the run's own PostgreSQL and MinIO. Names, labels, ports and credentials are decided
// before anything is created and written to the manifest; each Docker id is recorded the moment
// Docker returns it. No database or bucket is ever created inside an existing server.
import { randomInt } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { assertTarget, Refused } from './guard.mjs';
import {
  BUCKETS,
  engineFacts,
  IDENT_SQL,
  MARKER_BUCKET,
  RUN_MARKER_KEY,
  pgTcp,
  psqlArgs,
  runValue,
} from './identity.mjs';
import { childEnv } from './io.mjs';
import { newRun, runDir, writeManifest } from './manifest.mjs';
import { DEVICE_PORTS_EXTRA, LABEL, OWNER, PORT_BLOCK, PROTECTED_PORTS } from './protected.mjs';
import { DISPOSABLE_MARKER } from '../../scripts/lib/disposable-db.mjs';

export const PG_IMAGE = 'pgvector/pgvector:pg17';
export const minioImage = (repoRoot) => {
  const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
  const image = /^x-minio-image: &minio-image (\S+)$/m.exec(compose)?.[1];
  if (!image) throw new Error('docker-compose.yml names no x-minio-image');
  return image;
};

const labels = (m, role) => [
  '--label',
  `${LABEL.owner}=${OWNER}`,
  '--label',
  `${LABEL.run}=${m.run}`,
  '--label',
  `${LABEL.role}=${role}`,
];

/** The exact docker argument lists `up` uses. `plan` prints these; `up` runs these. */
export function dockerSteps(m, images) {
  return {
    network: ['network', 'create', ...labels(m, 'network'), m.names.network],
    pgVolume: ['volume', 'create', ...labels(m, 'volume-pgdata'), m.names.pgVolume],
    minioVolume: ['volume', 'create', ...labels(m, 'volume-miniodata'), m.names.minioVolume],
    postgres: [
      'run',
      '-d',
      '--name',
      m.names.pg,
      '--network',
      m.names.network,
      '-p',
      `127.0.0.1:${m.ports.pg}:5432`,
      '-v',
      `${m.names.pgVolume}:/var/lib/postgresql/data`,
      ...labels(m, 'postgres'),
      '-e',
      `POSTGRES_USER=${m.db.user}`,
      '-e',
      `POSTGRES_PASSWORD=${m.secrets.pg}`,
      '-e',
      `POSTGRES_DB=${m.db.name}`,
      images.pg,
    ],
    minio: [
      'run',
      '-d',
      '--name',
      m.names.minio,
      '--network',
      m.names.network,
      '-p',
      `127.0.0.1:${m.ports.s3}:9000`,
      '-v',
      `${m.names.minioVolume}:/data`,
      ...labels(m, 'minio'),
      '-e',
      `MINIO_ROOT_USER=${m.secrets.s3Key}`,
      '-e',
      `MINIO_ROOT_PASSWORD=${m.secrets.s3Secret}`,
      images.minio,
      'server',
      '/data',
    ],
  };
}

const free = (port) =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });

/** Three distinct free ports from the reserved block, never a protected one. */
export async function pickPorts(isFree = free) {
  const ports = [];
  for (let tries = 0; ports.length < 3 && tries < 200; tries += 1) {
    const p = randomInt(PORT_BLOCK.from, PORT_BLOCK.to + 1);
    if (PROTECTED_PORTS.has(p) || DEVICE_PORTS_EXTRA.has(p) || ports.includes(p)) continue;
    if (await isFree(p)) ports.push(p);
  }
  if (ports.length < 3) throw new Error('could not find three free ports in the reserved block');
  return { pg: ports[0], s3: ports[1], api: ports[2] };
}

const ok = (r) => !r.error && r.status === 0;
const tail = (r) => `${r.stderr || r.stdout || r.error?.message || ''}`.trim().slice(-400);
const must = (r, what) => {
  if (!ok(r)) throw new Error(`${what} failed: ${tail(r)}`);
  return r.stdout.trim();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(what, fn, seconds = 90) {
  for (let i = 0; i < seconds; i += 1) {
    if (await fn()) return;
    await sleep(1000);
  }
  throw new Error(`${what} was not ready after ${seconds} s`);
}

const SQL_STAMP = (m) =>
  `COMMENT ON DATABASE ${m.db.name} IS '${DISPOSABLE_MARKER}';\n` +
  `ALTER DATABASE ${m.db.name} SET adulis.native_run = '${runValue(m)}';\n`;

// Run inside the MinIO container by its id: reuses the repository's own scripts for the buckets and
// the disposable-storage marker, then tags both buckets and writes the run's marker object.
const TAG_SCRIPT = `set -eu
mc alias set native "$MINIO_URL" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
for b in ${BUCKETS.join(' ')}; do mc tag set "native/$b" "adulis-native-run=$NATIVE_RUN" >/dev/null; done
printf '%s' "$NATIVE_RUN_VALUE" | mc pipe "native/${MARKER_BUCKET}/${RUN_MARKER_KEY}" >/dev/null
`;

/**
 * Creates the stack and leaves the run `ready`. Any failure leaves the run in `creating` with the
 * manifest listing what exists: `down` removes it, with proof, and nothing is removed here.
 */
export async function up(
  io,
  { root, repo, log = () => {}, onRun = () => {}, makeRun = newRun, ports } = {},
) {
  // The engine (id, clock, context) is read FIRST and recorded in the manifest: every later command
  // proves it talks to the same engine, so a `down` in another engine cannot read "absent" as "gone".
  const engine = await engineFacts(io);
  if (engine.error) throw new Error(`the Docker engine could not be identified: ${engine.error}`);
  const m0 = makeRun();
  const dir = runDir(root, m0.run);
  const images = { pg: PG_IMAGE, minio: minioImage(repo) };
  let m = { ...m0, ports: ports ?? (await pickPorts()), engine };
  writeManifest(dir, m);
  writeRunMarker(dir, m.run);
  onRun(m.run);
  const save = (next) => {
    m = next;
    writeManifest(dir, m);
  };
  const steps = dockerSteps(m, images);
  const docker = (args, opts) => io.docker(args, opts);

  // Names must be new: a collision means something else holds them, and it is not touched.
  for (const [kind, args] of [
    ['container', ['ps', '-a', '-q', '--filter', `name=^/${m.names.pg}$`]],
    ['container', ['ps', '-a', '-q', '--filter', `name=^/${m.names.minio}$`]],
    ['volume', ['volume', 'ls', '-q', '--filter', `name=^${m.names.pgVolume}$`]],
    ['network', ['network', 'ls', '-q', '--filter', `name=^${m.names.network}$`]],
  ]) {
    const r = await docker(args);
    if (!ok(r) || r.stdout.trim())
      throw new Refused(
        `a ${kind} with this run's name exists or could not be listed: ${tail(r)}`,
        ok(r) ? 1 : 2,
      );
  }

  log('network');
  const netId = must(await docker(steps.network), 'docker network create');
  save({ ...m, network: { id: netId } });
  must(await docker(steps.pgVolume), 'docker volume create');
  must(await docker(steps.minioVolume), 'docker volume create');

  for (const role of ['postgres', 'minio']) {
    log(role);
    const id = must(await docker(steps[role]), `docker run ${role}`);
    const info = JSON.parse(
      must(await docker(['inspect', '--type', 'container', id]), 'docker inspect'),
    )[0];
    save({ ...m, containers: { ...m.containers, [role]: { id, imageId: info.Image } } });
  }
  const pgId = m.containers.postgres.id;
  const s3Id = m.containers.minio.id;

  log('waiting for PostgreSQL');
  // `-h 127.0.0.1`: ready only once the image's init has restarted the server on its real socket.
  await until('PostgreSQL', async () =>
    ok(await docker([...psqlArgs(m, pgId, ['-h', '127.0.0.1', '-c', 'select 1'])])),
  );
  const inside = must(
    await docker(psqlArgs(m, pgId, ['-c', IDENT_SQL])),
    'identity query inside PostgreSQL',
  ).split('|');

  // Before anything is written over the published port: it must reach THIS container's server.
  const tcp = await pgTcp(m, io);
  if (tcp.systemId !== inside[0])
    throw new Refused(
      `127.0.0.1:${m.ports.pg} is not this run's PostgreSQL (another server answers there); nothing was written`,
    );
  save({ ...m, db: { ...m.db, systemId: inside[0], postmasterStart: inside[1], oid: inside[3] } });

  log('marking the database');
  must(await docker(psqlArgs(m, pgId, ['-q'], true), { input: SQL_STAMP(m) }), 'database marker');
  // The marker is read back and the full DB-WRITE proof must pass before the first migration.
  await assertTarget(m, 'DB-WRITE', io, { dir, states: ['creating'] });

  log('migrating and seeding');
  const dbUrl = `postgres://${m.db.user}:${m.secrets.pg}@127.0.0.1:${m.ports.pg}/${m.db.name}`;
  const env = childEnv({ DATABASE_URL_MIGRATE: dbUrl, NODE_ENV: 'development' });
  must(
    await docker(psqlArgs(m, pgId, ['-q'], true), {
      input: readFileSync(join(repo, 'db', 'init', '00-extensions.sql'), 'utf8'),
    }),
    'extensions',
  );
  const node = (args, what) => run(io, args, { cwd: repo, env, what });
  await node(
    [
      join(repo, 'node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js'),
      '-d',
      'DATABASE_URL_MIGRATE',
      '-m',
      'db/migrations',
      '-j',
      'sql',
      'up',
    ],
    'migrations',
  );
  await node([join(repo, 'ops', 'scripts', 'install-worker-schema.mjs')], 'worker schema');
  const roles = `ALTER ROLE adulis_app LOGIN PASSWORD '${m.secrets.app}';\nALTER ROLE adulis_jobs LOGIN PASSWORD '${m.secrets.jobs}';\n`;
  must(await docker(psqlArgs(m, pgId, ['-q'], true), { input: roles }), 'role passwords');
  await node([join(repo, 'ops', 'scripts', 'seed.mjs')], 'seed');

  log('preparing MinIO');
  await until(
    'MinIO',
    async () =>
      await io
        .fetch(`http://127.0.0.1:${m.ports.s3}/minio/health/live`, {
          signal: AbortSignal.timeout(5000),
        })
        .then((r) => r.ok)
        .catch(() => false),
  );
  const mcEnv = [
    '-e',
    'MINIO_URL=http://127.0.0.1:9000',
    '-e',
    `MINIO_ROOT_USER=${m.secrets.s3Key}`,
    '-e',
    `MINIO_ROOT_PASSWORD=${m.secrets.s3Secret}`,
  ];
  for (const [file, extra] of [
    ['minio-init.sh', []],
    ['minio-test-marker.sh', []],
    [null, ['-e', `NATIVE_RUN=${m.run}`, '-e', `NATIVE_RUN_VALUE=${runValue(m)}`]],
  ]) {
    const script = file ? readFileSync(join(repo, 'ops', 'scripts', file), 'utf8') : TAG_SCRIPT;
    must(
      await docker(['exec', '-i', ...mcEnv, ...extra, s3Id, '/bin/sh', '-s'], { input: script }),
      `MinIO setup ${file ?? 'tags'}`,
    );
  }
  const dep = await io.docker([
    'exec',
    '-e',
    `MC_HOST_local=http://${m.secrets.s3Key}:${m.secrets.s3Secret}@127.0.0.1:9000`,
    s3Id,
    'mc',
    'admin',
    'info',
    'local',
    '--json',
  ]);
  const j = JSON.parse(must(dep, 'mc admin info').split(/\r?\n/).pop());
  const deploymentId = j?.info?.deploymentID ?? j?.deploymentID;
  if (!deploymentId) throw new Error('MinIO reported no deployment id');
  save({ ...m, s3: { deploymentId } });

  // Ready only after every stack check passes on the finished stack (a refusal here leaves `creating`).
  const results = await assertTarget(m, 'STACK', io, { dir, states: ['creating'] });
  save({ ...m, state: 'ready' });
  return { m, results, dir };
}

async function run(io, args, { cwd, env, what }) {
  const r = await io.run(io.node, args, { cwd, env, timeout: 600_000 });
  if (!ok(r)) throw new Error(`${what} failed: ${tail(r)}`);
  return r;
}

function writeRunMarker(dir, run) {
  writeFileSync(join(dir, 'run.marker'), `${run}\n`);
}
