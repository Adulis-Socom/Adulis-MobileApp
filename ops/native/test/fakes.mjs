// The double kit: a complete, consistent fake world for one run, and the doubles that read it.
// A test takes `world()`, breaks ONE thing, and asserts the refusal, the check that refused, and
// that no mutating call was made. Nothing here starts a process, opens a socket or runs Docker.
import { createHash } from 'node:crypto';
import { IDENT_SQL, apiAppName, runValue } from '../lib/identity.mjs';
import { evaluateGuard } from './guard-model.mjs';
import { newRun } from '../lib/manifest.mjs';
import { LABEL, OWNER } from '../lib/protected.mjs';
import { DISPOSABLE_MARKER } from '../../scripts/lib/disposable-db.mjs';
import { STORAGE_MARKER } from '../../scripts/lib/disposable-storage.mjs';

let seq = 0;
const hex = (n) =>
  createHash('sha256')
    .update(`fake-${seq++}`)
    .digest('hex')
    .repeat(2)
    .slice(0, n * 2);
export const id64 = () => hex(32);
export const NOW = new Date('2026-11-18T10:00:00Z');

/** A tripwire: records every call and returns an error-shaped result, so a test can assert zero calls. */
export function makeIo(world) {
  const calls = [];
  const note = (what) => calls.push(what);
  const docker = async (args, opts) => {
    note(`docker ${args.join(' ')}`);
    return world.docker(args, opts);
  };
  class Client {
    constructor(cfg) {
      this.cfg = cfg;
      note(`pg connect ${cfg.host}:${cfg.port}`);
    }
    async connect() {
      if (world.pg.tcpFails) throw new Error('connect ECONNREFUSED');
    }
    async query(sql) {
      note('pg query');
      if (sql !== IDENT_SQL) throw new Error('unexpected SQL over TCP');
      return { rows: [{ r: world.pg.tcp }] };
    }
    async end() {}
  }
  const fetch = async (url, opts = {}) => {
    note(`fetch ${url}`);
    return world.fetch(url, opts);
  };
  const proc = {
    listeners: async (port) => {
      note(`listeners ${port}`);
      return world.proc.listeners;
    },
    info: async (pid) => {
      note(`info ${pid}`);
      return world.proc.byPid[pid] ?? { createdAt: null, commandLine: '' };
    },
    kill: (pid) => {
      note(`kill ${pid}`);
      world.proc.kills.push(pid);
    },
  };
  return { calls, docker, Client, fetch, proc };
}

const res = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
});

/** Builds a manifest and the docker/pg/s3/api state that matches it exactly. */
export function world({ api = false } = {}) {
  const m = newRun(NOW, hex);
  m.ports = { pg: 57211, s3: 57212, api: 57213 };
  m.state = 'ready';
  const pgId = id64();
  const s3Id = id64();
  m.containers = {
    postgres: { id: pgId, imageId: 'sha256:pg' },
    minio: { id: s3Id, imageId: 'sha256:minio' },
  };
  m.network = { id: id64() };
  m.db = {
    ...m.db,
    systemId: '7570000000000000001',
    postmasterStart: '2026-11-18T10:00:05.000001',
    oid: '16401',
  };
  m.s3 = { deploymentId: 'deployment-1' };
  m.engine = { id: 'engine-0001', systemTime: NOW.toISOString(), context: 'fake-context' };
  const labels = (role) => ({ [LABEL.owner]: OWNER, [LABEL.run]: m.run, [LABEL.role]: role });
  const container = (role, key, volume, dest, cport, port, id) => ({
    Id: id,
    Name: `/${m.names[key]}`,
    Created: '2026-11-18T10:00:01Z',
    Image: `sha256:${role}`,
    Config: { Labels: labels(role) },
    Mounts: [{ Type: 'volume', Name: m.names[volume], Destination: dest }],
    HostConfig: { Binds: [`${m.names[volume]}:${dest}`], VolumesFrom: null, Tmpfs: null },
    NetworkSettings: {
      Networks: { [m.names.network]: {} },
      Ports: { [cport]: [{ HostIp: '127.0.0.1', HostPort: `${port}` }] },
    },
  });
  const d = {
    containers: {
      [pgId]: container(
        'postgres',
        'pg',
        'pgVolume',
        '/var/lib/postgresql/data',
        '5432/tcp',
        m.ports.pg,
        pgId,
      ),
      [s3Id]: container('minio', 'minio', 'minioVolume', '/data', '9000/tcp', m.ports.s3, s3Id),
    },
    volumes: {
      [m.names.pgVolume]: {
        Name: m.names.pgVolume,
        Driver: 'local',
        Labels: labels('volume-pgdata'),
        Options: null,
      },
      [m.names.minioVolume]: {
        Name: m.names.minioVolume,
        Driver: 'local',
        Labels: labels('volume-miniodata'),
        Options: null,
      },
    },
    networks: {
      [m.network.id]: {
        Id: m.network.id,
        Name: m.names.network,
        Labels: labels('network'),
        Containers: { [pgId]: {}, [s3Id]: {} },
      },
    },
    listFails: {},
    engine: { ...m.engine },
    engineDead: false,
    rmFails: false,
    rmKillsEngine: false,
    mutations: [],
    log: [],
  };
  const ident = `${m.db.systemId}|${m.db.postmasterStart}|${m.db.name}|${m.db.oid}|${DISPOSABLE_MARKER}|${runValue(m)}`;
  const w = {
    m,
    d,
    // `live` is what the server really is at the moment a script runs (the identity guard reads it);
    // tcp and inside are what the earlier checks saw. A test that changes only `live` simulates a
    // server that was replaced between the check and the use.
    pg: {
      tcp: ident,
      inside: ident,
      activity: [],
      tcpFails: false,
      live: { systemId: m.db.systemId, db: m.db.name, setting: runValue(m) },
      committed: [],
    },
    s3: {
      accept: m.secrets.s3Key,
      buckets: ['adulis-media', 'adulis-evidence'],
      tags: { 'adulis-media': m.run, 'adulis-evidence': m.run },
      marker: runValue(m),
      repoMarker: STORAGE_MARKER.body,
      deployment: 'deployment-1',
    },
    api: {
      health: { status: 'ok', db: 'up', worker: 'never_started', boot_marker: null },
      bootstrap: {
        environment: 'development',
        media_public_origin: `http://127.0.0.1:${m.ports.s3}/adulis-media`,
      },
    },
    proc: { listeners: [], byPid: {}, kills: [] },
  };
  if (api) {
    const node = 'C:\\Program Files\\nodejs\\node.exe';
    const main = 'C:\\wt\\x\\apps\\api\\dist\\main.js';
    m.api = {
      pid: 4242,
      createdAt: '2026-11-18T10:01:00.0000000Z',
      node,
      main,
      bootMarker: `native.${m.run}.aaaa1111`,
      checkout: 'C:\\wt\\x',
      sha: 'a'.repeat(40),
      mainSha256: 'b'.repeat(64),
    };
    w.api.health.boot_marker = m.api.bootMarker;
    w.proc.listeners = [4242];
    w.proc.byPid[4242] = { createdAt: m.api.createdAt, commandLine: `"${node}" ${main}` };
    w.pg.activity = [`adulis_app|${apiAppName(m)}`, 'adulis_bootstrap|psql'];
  }
  w.docker = (args, opts = {}) => dockerFake(w, args, opts);
  w.fetch = (url, opts) => fetchFake(w, url, opts);
  return w;
}

const ok = (stdout = '') => ({ status: 0, stdout, stderr: '', error: null });
const fail = (stderr) => ({ status: 1, stdout: '', stderr, error: null });
const filterValue = (args) => args[args.indexOf('--filter') + 1] ?? '';

function dockerFake(w, args, opts) {
  const { d } = w;
  d.log.push(args.join(' '));
  const mutate = () => d.mutations.push(args.join(' '));
  const [a, b] = args;
  if (d.engineDead)
    return {
      status: null,
      stdout: '',
      stderr: '',
      error: new Error('docker engine is not running'),
    };
  if (a === 'info')
    return ok(args.includes('--format') ? `${d.engine.id}|${d.engine.systemTime}` : '29.0.0');
  if (a === 'context' && b === 'show') return ok(d.engine.context);
  if (a === 'inspect') {
    const o = d.containers[args[args.length - 1]];
    if (d.inspectFails?.[args[args.length - 1]]) return fail('Error: inspect failed');
    return o ? ok(JSON.stringify([o])) : fail('Error: No such container: x');
  }
  if (a === 'volume' && b === 'inspect') {
    const o = d.volumes[args[2]];
    return o ? ok(JSON.stringify([o])) : fail('Error: No such volume: x');
  }
  if (a === 'network' && b === 'inspect') {
    const o = d.networks[args[2]];
    return o ? ok(JSON.stringify([o])) : fail('Error: No such network: x');
  }
  const listing = (kind, store, idOf, labelsOf) => {
    if (d.listFails[kind]) return fail('Error: cannot connect to the Docker daemon');
    const f = filterValue(args);
    const hit = Object.entries(store).filter(([, o]) => {
      if (f.startsWith('label='))
        return `${f.slice(6)}` === `${LABEL.run}=${labelsOf(o)[LABEL.run]}`;
      if (f.startsWith('id=')) return idOf(o) === f.slice(3);
      if (f.startsWith('name='))
        return (
          `${o.Name}`.replace(/^\//, '') ===
          f
            .slice(5)
            .replace(/^\^\/?/, '')
            .replace(/\$$/, '')
        );
      if (f.startsWith('volume=')) return (o.Mounts ?? []).some((x) => x.Name === f.slice(7));
      return false;
    });
    return ok(hit.map(([, o]) => idOf(o)).join('\n'));
  };
  if (a === 'ps')
    return listing(
      'containers',
      d.containers,
      (o) => o.Id,
      (o) => o.Config.Labels,
    );
  if (a === 'volume' && b === 'ls')
    return listing(
      'volumes',
      d.volumes,
      (o) => o.Name,
      (o) => o.Labels,
    );
  if (a === 'network' && b === 'ls')
    return listing(
      'networks',
      d.networks,
      (o) => o.Id,
      (o) => o.Labels,
    );
  if (a === 'rm') {
    mutate();
    if (d.rmKillsEngine) d.engineDead = true;
    else if (!d.rmFails) {
      const rid = args[args.length - 1];
      delete d.containers[rid];
      for (const n of Object.values(d.networks)) delete n.Containers?.[rid];
    }
    return ok();
  }
  if (a === 'volume' && b === 'rm') {
    mutate();
    if (!d.rmFails) delete d.volumes[args[2]];
    return ok();
  }
  if (a === 'network' && b === 'rm') {
    mutate();
    if (!d.rmFails) delete d.networks[args[2]];
    return ok();
  }
  if (a === 'exec') {
    const rest = args.slice(1);
    if (rest.includes('mc') && rest.includes('info'))
      return ok(JSON.stringify({ info: { deploymentID: w.s3.deployment } }));
    if (rest.includes('psql')) {
      const cIdx = rest.indexOf('-c');
      const sql = cIdx >= 0 ? rest[cIdx + 1] : '';
      if (sql === IDENT_SQL) return ok(w.pg.inside);
      if (sql.includes('pg_stat_activity')) return ok(w.pg.activity.join('\n'));
      if (opts.input !== undefined) {
        // The write channel, as psql --single-transaction runs it: a guard that is first and raises
        // rolls everything back; a script without a guard runs as it is.
        mutate();
        const g = evaluateGuard(opts.input, w.pg.live);
        if (g.raises) return fail(`ERROR:  ${g.message}`);
        w.pg.executed = opts.input;
        w.pg.committed.push(opts.input);
        return ok();
      }
      if (sql.includes('core.device')) return ok(w.pg.canary ?? 't');
      return ok();
    }
    mutate();
    return ok();
  }
  mutate();
  return ok();
}

async function fetchFake(w, url, opts) {
  const u = new URL(url);
  const auth = opts.headers?.authorization ?? '';
  const signed = auth.includes('Credential=');
  if (u.port === `${w.m.ports.s3}`) {
    if (u.pathname === `/${STORAGE_MARKER.bucket}/${STORAGE_MARKER.key}` && !signed)
      return res(w.s3.repoMarker ? 200 : 404, w.s3.repoMarker ?? '');
    if (u.pathname === '/minio/health/live') return res(200, '');
    if (!signed || !auth.includes(`Credential=${w.s3.accept}/`))
      return res(403, '<Error>InvalidAccessKeyId</Error>');
    if (u.pathname === '/')
      return res(
        200,
        `<ListAllMyBucketsResult>${w.s3.buckets.map((x) => `<Bucket><Name>${x}</Name></Bucket>`).join('')}</ListAllMyBucketsResult>`,
      );
    if (u.search === '?tagging=') {
      const t = w.s3.tags[u.pathname.slice(1)];
      return t === undefined
        ? res(404, '<Error>NoSuchTagSet</Error>')
        : res(
            200,
            `<Tagging><TagSet><Tag><Key>adulis-native-run</Key><Value>${t}</Value></Tag></TagSet></Tagging>`,
          );
    }
    if (u.pathname === `/${STORAGE_MARKER.bucket}/native-run`)
      return w.s3.marker === null ? res(404, '') : res(200, w.s3.marker);
  }
  if (u.port === `${w.m.ports.api}`) {
    if (u.pathname === '/healthz')
      return w.api.health === null
        ? Promise.reject(new Error('ECONNREFUSED'))
        : res(200, w.api.health);
    if (u.pathname === '/v1/bootstrap') {
      // The canary's request carries a device id: tests may make the API answer it with an error.
      if (opts.headers?.['X-Adulis-Device'] && w.api.deviceStatus)
        return res(w.api.deviceStatus, {});
      return res(200, w.api.bootstrap);
    }
  }
  return Promise.reject(new Error(`unexpected request ${url}`));
}

/** Asserts a promise rejects with a Refusal that names `id`, with exit code `code`. */
export async function refusal(assert, promise, id, code = 1) {
  const e = await promise.then(
    () => null,
    (x) => x,
  );
  assert.ok(e, 'expected a refusal, but the operation was allowed');
  assert.ok(e.results, `expected a Refusal, got: ${e.stack ?? e}`);
  assert.equal(e.code, code, e.message);
  assert.ok(
    e.results.some((r) => r.id === id && r.verdict !== 'PASS'),
    `expected ${id} to fail: ${e.message}`,
  );
  return e;
}
