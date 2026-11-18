// Every refusal of the native harness's identity checks, against doubles. Each test breaks one thing in an
// otherwise consistent fake world and asserts: the operation is refused, the named check refused it, and
// nothing was written. Refusals decidable from configuration are asserted to happen BEFORE any connection.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertTarget, REQUIRED } from '../lib/guard.mjs';
import { apiEnvProblems, ROLES } from '../lib/identity.mjs';
import { buildApiEnv } from '../lib/api.mjs';
import { LABEL } from '../lib/protected.mjs';
import { id64, makeIo, refusal, world } from './fakes.mjs';

/** Refused with `id`; no mutating call; optionally zero calls of any kind (refused before connecting). */
async function refuses(w, op, id, { code = 1, beforeConnect = false, states = ['ready'] } = {}) {
  const io = makeIo(w);
  await refusal(assert, assertTarget(w.m, op, io, { states }), id, code);
  assert.deepEqual(w.d.mutations, [], 'a mutating call was made');
  assert.equal(w.pg.executed, undefined, 'SQL was executed');
  if (beforeConnect)
    assert.deepEqual(io.calls, [], `connected before refusing: ${io.calls.join(' | ')}`);
}
const allowed = (w, op = 'STACK') => assertTarget(w.m, op, makeIo(w), { states: ['ready'] });
const pgId = (w) => w.m.containers.postgres.id;
const s3Id = (w) => w.m.containers.minio.id;

test('control: a consistent world passes the stack checks and, with an API, every check', async () => {
  const r = await allowed(world());
  assert.ok(
    ['ID-01', 'ID-02', 'ID-03', 'ID-06', 'ID-07', 'ID-08', 'ID-09', 'ID-10'].every((id) =>
      r.some((x) => x.id === id),
    ),
  );
  await allowed(world({ api: true }), 'API-WRITE');
});

test('every operation class names only known checks', () => {
  for (const [op, ids] of Object.entries(REQUIRED)) assert.ok(ids.includes('ID-00'), op);
});

/* ---- persistent PostgreSQL ---- */

test('persistent PostgreSQL by port only: refused before any connection', async () => {
  const w = world();
  w.m.ports.pg = 5434;
  await refuses(w, 'DB-WRITE', 'ID-09', { beforeConnect: true });
});

test('every protected port is refused for PostgreSQL, MinIO and the API, before connecting', async () => {
  for (const port of [
    5432, 5433, 5434, 9000, 9001, 9100, 6379, 8025, 1025, 5050, 55432, 55444, 59000, 3000,
  ]) {
    for (const key of ['pg', 's3', 'api']) {
      const w = world();
      w.m.ports[key] = port;
      await refuses(w, 'STACK', 'ID-09', { beforeConnect: true });
    }
  }
});

test('a port outside the reserved block, or shared by two services, is refused before connecting', async () => {
  for (const edit of [(p) => (p.pg = 60000), (p) => (p.s3 = 57000), (p) => (p.api = p.pg)]) {
    const w = world();
    edit(w.m.ports);
    await refuses(w, 'DB-WRITE', 'ID-09', { beforeConnect: true });
  }
});

test('a database host other than the literal 127.0.0.1 is refused before connecting', async () => {
  for (const host of ['localhost', '0.0.0.0', '::1', '10.0.2.2', 'db.example.com']) {
    const w = world();
    w.m.db.host = host;
    await refuses(w, 'DB-WRITE', 'ID-09', { beforeConnect: true });
  }
});

test('the persistent PostgreSQL container, named in the manifest, is refused (name, volume, port, labels)', async () => {
  const w = world();
  const persistent = id64();
  w.d.containers[persistent] = {
    Id: persistent,
    Name: '/adulis-postgres',
    Created: '2026-09-03T10:03:33Z',
    Config: { Labels: { 'com.docker.compose.project': 'adulis-platform' } },
    Mounts: [
      {
        Type: 'bind',
        Source: '/run/desktop/mnt/host/c/x/db/init',
        Destination: '/docker-entrypoint-initdb.d',
      },
      {
        Type: 'volume',
        Name: 'adulis-platform_adulis-pgdata',
        Destination: '/var/lib/postgresql/data',
      },
    ],
    HostConfig: {},
    NetworkSettings: {
      Networks: { 'adulis-platform_default': {} },
      Ports: { '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '5434' }] },
    },
  };
  w.m.containers.postgres.id = persistent;
  const e = await refusal(
    assert,
    assertTarget(w.m, 'STACK', makeIo(w), { states: ['ready'] }),
    'ID-08',
  );
  for (const id of ['ID-08', 'ID-09', 'ID-10'])
    assert.ok(
      e.results.some((r) => r.id === id && r.verdict === 'FAIL'),
      id,
    );
  assert.match(e.message, /protected volume/);
  assert.deepEqual(w.d.mutations, []);
});

test('a different PostgreSQL answering on the port (system identifier differs over TCP) is refused', async () => {
  const w = world();
  w.pg.tcp = w.pg.tcp.replace('7570000000000000001', '9999999999999999999');
  await refuses(w, 'DB-WRITE', 'ID-01');
});

test('a PostgreSQL that restarted since the run was created is refused (start time differs)', async () => {
  for (const chan of ['tcp', 'inside']) {
    const w = world();
    w.pg[chan] = w.pg[chan].replace('2026-11-18T10:00:05.000001', '2026-11-18T11:00:00.000000');
    await refuses(w, 'DB-WRITE', 'ID-01');
  }
});

test('a wrong database (name or oid), live or in the manifest, is refused', async () => {
  const w = world();
  w.pg.tcp = w.pg.tcp.replace(w.m.db.name, 'adulis');
  await refuses(w, 'DB-WRITE', 'ID-02');
  const o = world();
  o.pg.inside = o.pg.inside.replace('|16401|', '|99999|');
  await refuses(o, 'DB-WRITE', 'ID-02');
  for (const name of [
    'adulis',
    'adulis_gates',
    'postgres',
    'template1',
    'adulis_native_00000000',
  ]) {
    const m = world();
    m.m.db.name = name;
    await refuses(m, 'DB-WRITE', 'ID-02', { beforeConnect: true });
  }
});

test("a database that is not marked disposable, or carries another run's setting, is refused", async () => {
  const marks = [
    (s) => s.replace('adulis:disposable-test-database', ''),
    (s) => s.replace('adulis:disposable-test-database', 'something-else'),
  ];
  for (const edit of marks) {
    const w = world();
    w.pg.tcp = edit(w.pg.tcp);
    await refuses(w, 'DB-WRITE', 'ID-03');
  }
  const s = world();
  s.pg.inside = s.pg.inside.replace(/\|[^|]*$/, '|native-20200101-deadbeef:' + 'f'.repeat(64));
  await refuses(s, 'DB-WRITE', 'ID-03');
  const none = world();
  none.pg.tcp = none.pg.tcp.replace(/\|[^|]*$/, '|');
  await refuses(none, 'DB-WRITE', 'ID-03');
});

test('the run nonce is part of the marker: the right run id with another nonce is refused', async () => {
  const w = world();
  w.pg.tcp = w.pg.tcp.replace(/:[0-9a-f]{64}$/, `:${'0'.repeat(64)}`);
  await refuses(w, 'DB-WRITE', 'ID-03');
});

/* ---- persistent MinIO ---- */

test('persistent MinIO by port: refused before any connection', async () => {
  const w = world();
  w.m.ports.s3 = 9100;
  await refuses(w, 'OBJECT-WRITE', 'ID-09', { beforeConnect: true });
});

test('the persistent MinIO container (legacy volume, all interfaces) is refused', async () => {
  const w = world();
  const persistent = id64();
  w.d.containers[persistent] = {
    Id: persistent,
    Name: '/adulis-minio',
    Created: '2026-09-03T10:03:33Z',
    Config: { Labels: {} },
    Mounts: [{ Type: 'volume', Name: 'adulis-pgdata', Destination: '/data' }],
    HostConfig: {},
    NetworkSettings: {
      Networks: { 'adulis-platform_default': {} },
      Ports: { '9000/tcp': [{ HostIp: '0.0.0.0', HostPort: '9100' }] },
    },
  };
  w.m.containers.minio.id = persistent;
  await refuses(w, 'OBJECT-WRITE', 'ID-08');
});

test("a store that rejects the run's random credentials is refused (the persistent MinIO holds other keys)", async () => {
  const w = world();
  w.s3.accept = 'adulis-local';
  await refuses(w, 'OBJECT-WRITE', 'ID-06');
});

test('a MinIO whose deployment id differs from the recorded one is refused', async () => {
  const w = world();
  w.s3.deployment = 'another-deployment';
  await refuses(w, 'OBJECT-WRITE', 'ID-06');
});

test("a missing bucket tag, another run's tag, a missing run marker or storage marker is refused", async () => {
  const edits = [
    (w) => delete w.s3.tags['adulis-media'],
    (w) => (w.s3.tags['adulis-evidence'] = 'native-20200101-deadbeef'),
    (w) => (w.s3.marker = null),
    (w) => (w.s3.marker = 'native-20200101-deadbeef:abc'),
    (w) => (w.s3.repoMarker = null),
  ];
  for (const edit of edits) {
    const w = world();
    edit(w);
    await refuses(w, 'OBJECT-WRITE', 'ID-07');
  }
});

/* ---- the API ---- */

test('an API listener that is another process is refused (pid, creation time, command line)', async () => {
  const cases = [
    (w) => (w.proc.listeners = [31337]),
    (w) => (w.proc.listeners = [4242, 31337]),
    (w) => (w.proc.byPid[4242].createdAt = '2026-11-18T12:00:00.0000000Z'),
    (w) => (w.proc.byPid[4242].commandLine = `"${w.m.api.node}" --require x ${w.m.api.main}`),
    (w) => (w.proc.byPid[4242].commandLine = `"${w.m.api.node}" ${w.m.api.main}.bak`),
    (w) => (w.proc.byPid[4242].commandLine = `"C:\\evil\\node.exe" ${w.m.api.main}`),
  ];
  for (const edit of cases) {
    const w = world({ api: true });
    edit(w);
    await refuses(w, 'API-WRITE', 'ID-04');
  }
});

test('an API that answers with the wrong or no boot marker is refused', async () => {
  for (const marker of [null, 'native.other.run', undefined]) {
    const w = world({ api: true });
    w.api.health.boot_marker = marker;
    await refuses(w, 'API-WRITE', 'ID-04');
  }
});

test("an API with no connection in this server's pg_stat_activity is refused (attached elsewhere)", async () => {
  const w = world({ api: true });
  w.pg.activity = ['adulis_bootstrap|psql'];
  await refuses(w, 'API-WRITE', 'ID-04');
  const o = world({ api: true });
  o.pg.activity = ['adulis_app|some-other-app'];
  await refuses(o, 'API-WRITE', 'ID-04');
});

test('an API reporting another environment or media origin is refused', async () => {
  const a = world({ api: true });
  a.api.bootstrap.environment = 'staging';
  await refuses(a, 'API-WRITE', 'ID-05');
  const b = world({ api: true });
  b.api.bootstrap.media_public_origin = 'http://127.0.0.1:9100/adulis-media';
  await refuses(b, 'API-WRITE', 'ID-05');
});

test('an API write is refused when no API was started by the run', async () => {
  await refuses(world(), 'API-WRITE', 'ID-04');
});

/* ---- ownership labels ---- */

test("a container, volume or network without or with another run's label is refused", async () => {
  const cases = [
    (w) => delete w.d.containers[pgId(w)].Config.Labels[LABEL.owner],
    (w) => (w.d.containers[s3Id(w)].Config.Labels[LABEL.run] = 'native-20200101-deadbeef'),
    (w) => (w.d.containers[pgId(w)].Config.Labels[LABEL.role] = 'minio'),
    (w) => delete w.d.volumes[w.m.names.pgVolume].Labels[LABEL.run],
    (w) => (w.d.volumes[w.m.names.minioVolume].Labels[LABEL.owner] = 'someone-else'),
    (w) => (w.d.networks[w.m.network.id].Labels = {}),
  ];
  for (const edit of cases) {
    const w = world();
    edit(w);
    await refuses(w, 'DOCKER-REMOVE', 'ID-10');
  }
});

test('a container created before the run, or with an id other than the recorded one, is refused', async () => {
  const a = world();
  a.d.containers[pgId(a)].Created = '2026-01-01T00:00:00Z';
  await refuses(a, 'DB-WRITE', 'ID-10');
  const b = world();
  b.d.containers[pgId(b)].Id = id64();
  await refuses(b, 'DB-WRITE', 'ID-10');
});

test("another resource carrying this run's label that the manifest does not record is refused", async () => {
  const w = world();
  const stray = id64();
  w.d.containers[stray] = {
    ...structuredClone(w.d.containers[pgId(w)]),
    Id: stray,
    Name: '/adulis-native-stray',
  };
  await refuses(w, 'DOCKER-REMOVE', 'ID-10');
});

test('a container whose name lacks the run prefix is refused even with the right labels', async () => {
  const w = world();
  w.d.containers[pgId(w)].Name = '/some-other-name';
  await refuses(w, 'DOCKER-REMOVE', 'ID-10');
});

/* ---- mounts and volumes ---- */

test('an unrecognised mount is refused: protected volume, other volume, bind mount, volumes-from, tmpfs', async () => {
  const cases = [
    (c) =>
      c.Mounts.push({ Type: 'volume', Name: 'adulis-platform_adulis-pgdata', Destination: '/x' }),
    (c) => c.Mounts.push({ Type: 'volume', Name: 'adulis-pgdata', Destination: '/y' }),
    (c) => c.Mounts.push({ Type: 'volume', Name: 'someone-elses-volume', Destination: '/z' }),
    (c) => c.Mounts.push({ Type: 'bind', Source: '/c/Users/data', Destination: '/data2' }),
    (c) => (c.HostConfig.VolumesFrom = ['adulis-postgres']),
    (c) => (c.HostConfig.Binds = ['/c/Users/data:/data']),
    (c) => (c.HostConfig.Tmpfs = { '/var/lib/postgresql/data': '' }),
    (c) =>
      (c.Mounts = [
        {
          Type: 'volume',
          Name: 'adulis-platform_adulis-pgdata',
          Destination: '/var/lib/postgresql/data',
        },
      ]),
  ];
  for (const edit of cases) {
    const w = world();
    edit(w.d.containers[pgId(w)]);
    await refuses(w, 'DB-WRITE', 'ID-08');
  }
});

test('a container attached to another network, or a foreign container on the run network, is refused', async () => {
  const a = world();
  a.d.containers[pgId(a)].NetworkSettings.Networks['adulis-platform_default'] = {};
  await refuses(a, 'DB-WRITE', 'ID-08');
  const b = world();
  b.d.networks[b.m.network.id].Containers[id64()] = {};
  await refuses(b, 'DB-WRITE', 'ID-08');
});

test('a volume with driver options (a disguised bind mount) or a protected name is refused', async () => {
  const a = world();
  a.d.volumes[a.m.names.pgVolume].Options = { type: 'none', o: 'bind', device: '/c/Users/data' };
  await refuses(a, 'DB-WRITE', 'ID-08');
  const b = world();
  b.m.names.pgVolume = 'adulis-pgdata';
  await refuses(b, 'DB-WRITE', 'ID-09', { beforeConnect: true });
});

test('a container publishing on all interfaces, or on a port the run does not own, is refused', async () => {
  const a = world();
  a.d.containers[pgId(a)].NetworkSettings.Ports['5432/tcp'][0].HostIp = '0.0.0.0';
  await refuses(a, 'DB-WRITE', 'ID-09');
  const b = world();
  b.d.containers[s3Id(b)].NetworkSettings.Ports['9000/tcp'][0].HostPort = '9100';
  await refuses(b, 'OBJECT-WRITE', 'ID-09');
  const c = world();
  c.d.containers[pgId(c)].NetworkSettings.Ports['5433/tcp'] = [
    { HostIp: '127.0.0.1', HostPort: '5433' },
  ];
  await refuses(c, 'DB-WRITE', 'ID-09');
});

/* ---- credentials and configuration ---- */

test('production-like or known credentials in the manifest are refused before connecting', async () => {
  for (const [k, v] of [
    ['pg', 'local-dev-password'],
    ['app', 'ci-password'],
    ['s3Key', 'adulis-local'],
    ['s3Secret', 'adulis-local-secret'],
    ['jobs', 'ci-fake-evidence-key'],
    ['pg', 'short'],
  ]) {
    const w = world();
    w.m.secrets[k] = v;
    await refuses(w, 'DB-WRITE', 'ID-09', { beforeConnect: true });
  }
});

test('the API environment is an allow-list and every unsafe value is refused', () => {
  const w = world();
  const good = () =>
    buildApiEnv(w.m, {
      dir: 'C:\\run',
      bootMarker: 'm',
      host: { PATH: 'p', SystemRoot: 'r', TEMP: 't', TMP: 't', PGHOST: 'x' },
    });
  assert.deepEqual(apiEnvProblems(good(), w.m), []);
  const cases = {
    'NODE_ENV=production': { NODE_ENV: 'production' },
    'NODE_ENV=staging': { NODE_ENV: 'staging' },
    'NODE_ENV unset': { NODE_ENV: undefined },
    'a PG variable': { PGHOST: '127.0.0.1' },
    'an SMS variable': { SMS_PRIMARY_API_KEY: 'x' },
    NODE_OPTIONS: { NODE_OPTIONS: '--require x' },
    'the persistent database port': {
      DATABASE_URL: `postgres://adulis_app:${w.m.secrets.app}@127.0.0.1:5434/${w.m.db.name}`,
    },
    'localhost as the database host': {
      DATABASE_URL: `postgres://adulis_app:${w.m.secrets.app}@localhost:${w.m.ports.pg}/${w.m.db.name}`,
    },
    'the development database name': {
      DATABASE_URL_JOBS: `postgres://adulis_jobs:${w.m.secrets.jobs}@127.0.0.1:${w.m.ports.pg}/adulis`,
    },
    'a target override in the URL': {
      DATABASE_URL: `postgres://adulis_app:${w.m.secrets.app}@127.0.0.1:${w.m.ports.pg}/${w.m.db.name}?host=db.example.com`,
    },
    'a known database credential': {
      DATABASE_URL: `postgres://adulis_app:local-dev-password@127.0.0.1:${w.m.ports.pg}/${w.m.db.name}`,
    },
    'the persistent MinIO': {
      R2_ACCOUNT_ID: 'http://127.0.0.1:9100',
      R2_MEDIA_PUBLIC_ORIGIN: 'http://127.0.0.1:9100/adulis-media',
    },
    'a Cloudflare account id': { R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef' },
    'an https endpoint': {
      R2_ACCOUNT_ID: 'https://127.0.0.1:57212',
      R2_MEDIA_PUBLIC_ORIGIN: 'https://127.0.0.1:57212/adulis-media',
    },
    'a non-loopback endpoint': {
      R2_ACCOUNT_ID: 'http://203.0.113.5:57212',
      R2_MEDIA_PUBLIC_ORIGIN: 'http://203.0.113.5:57212/adulis-media',
    },
    'a half-set R2 configuration': { R2_SECRET_ACCESS_KEY: undefined },
    'a known storage credential': { R2_ACCESS_KEY_ID: 'adulis-local' },
    "a port other than the run's API port": { PORT: '3000' },
  };
  for (const [what, patch] of Object.entries(cases)) {
    const env = { ...good(), ...patch };
    for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
    assert.notDeepEqual(apiEnvProblems(env, w.m), [], what);
  }
});

test('the API environment never inherits the host environment', () => {
  const env = buildApiEnv(world().m, {
    dir: 'C:\\run',
    bootMarker: 'm',
    host: {
      PATH: 'p',
      PGHOST: 'x',
      SMS_PRIMARY_API_KEY: 'k',
      NODE_OPTIONS: '--inspect',
      DATABASE_URL: 'postgres://x',
      R2_ACCOUNT_ID: 'y',
    },
  });
  assert.deepEqual(
    Object.keys(env).filter((k) => /^(PG|SMS_|NODE_OPTIONS)/.test(k)),
    [],
  );
  assert.match(env.DATABASE_URL, /127\.0\.0\.1:57211\//);
  assert.match(env.DATABASE_URL, /application_name=adulis-native-/);
});

/* ---- manifest ---- */

test('a missing, tampered, foreign or wrongly-staged manifest is refused before connecting', async () => {
  const edits = [
    (m) => (m.nonce = 'short'),
    (m) => (m.run = 'native-20260101-00000000'),
    (m) => (m.state = 'cleaned'),
    (m) => (m.state = 'creating'),
    (m) => (m.schema = 99),
    (m) => (m.run8 = 'ffffffff'),
  ];
  for (const edit of edits) {
    const w = world();
    edit(w.m);
    await refuses(w, 'DB-WRITE', 'ID-00', { beforeConnect: true });
  }
  const io = makeIo(world());
  await refusal(
    assert,
    assertTarget(world().m, 'DB-WRITE', io, { run: 'native-20260101-ffffffff', states: ['ready'] }),
    'ID-00',
  );
});

/* ---- fail closed ---- */

test('a docker, psql or http error is UNKNOWN: refused with exit 2, nothing written', async () => {
  const cases = [
    ['STACK', 'ID-08', (w) => (w.d.engineDead = true)],
    ['STACK', 'ID-08', (w) => (w.d.listFails.containers = true)],
    ['STACK', 'ID-10', (w) => (w.d.listFails.volumes = true)],
    ['STACK', 'ID-01', (w) => (w.pg.tcpFails = true)],
    ['API-WRITE', 'ID-04', (w) => (w.api.health = null)],
  ];
  for (const [op, id, edit] of cases) {
    const w = world({ api: true });
    edit(w);
    await refuses(w, op, id, { code: 2 });
  }
});

test('an unreadable listing is never read as "no extra resources"', async () => {
  const w = world();
  w.d.listFails.networks = true;
  await refuses(w, 'DOCKER-REMOVE', 'ID-10', { code: 2 });
});

test('every environment variable can name the disposable pair while reality differs: the live probe refuses', async () => {
  const w = world({ api: true });
  w.proc.listeners = [31337]; // something else owns the port the environment says is the API's
  w.api.health.boot_marker = 'native.someone-else';
  const e = await refusal(
    assert,
    assertTarget(w.m, 'API-WRITE', makeIo(w), { states: ['ready'] }),
    'ID-04',
  );
  assert.match(e.message, /boot marker/);
  assert.match(e.message, /listener/);
});

test('both roles are covered by the container rules', () => {
  assert.deepEqual(Object.keys(ROLES).sort(), ['minio', 'postgres']);
});
