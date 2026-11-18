// A stateful fake Docker engine for `up`: it creates, inspects, lists and removes the run's network,
// volumes and containers from the argument lists the harness sends, and answers the PostgreSQL and
// MinIO probes from what those arguments configured. Nothing here starts a process or opens a socket.
import { createHash } from 'node:crypto';
import { IDENT_SQL, runValue } from '../lib/identity.mjs';
import { canonicalRequest, EMPTY_SHA256, signature } from '../lib/s3.mjs';
import { LABEL } from '../lib/protected.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '', error: null });
const fail = (stderr) => ({ status: 1, stdout: '', stderr, error: null });
const res = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => body,
  json: async () => JSON.parse(body),
});

/** `opts`: { engineId, systemId, wrongServerOnPort, secondVolume, failRun }. */
export function engineWorld(opts = {}) {
  const st = {
    engine: { id: opts.engineId ?? 'engine-up-0001', context: 'fake-context' },
    clock: new Date().toISOString(),
    containers: {},
    volumes: {},
    networks: {},
    pg: {
      systemId: opts.systemId ?? '7570000000000000042',
      startTime: '2026-11-18T10:00:05.000001',
      oid: '16402',
    },
    events: [],
    nodeRuns: [],
    runs: [],
  };
  const flagValues = (args, flag) => args.flatMap((a, i) => (args[i - 1] === flag ? [a] : []));
  const labelsOf = (args) =>
    Object.fromEntries(
      flagValues(args, '--label').map((l) => [
        l.slice(0, l.indexOf('=')),
        l.slice(l.indexOf('=') + 1),
      ]),
    );
  const portOf = (c) => Object.values(c.NetworkSettings.Ports)[0]?.[0]?.HostPort;
  const byRole = (role) =>
    Object.values(st.containers).find((c) => c.Config.Labels[LABEL.role] === role);

  const filterIds = (store, idOf, labelsFn, args) => {
    const f = args[args.indexOf('--filter') + 1] ?? '';
    const hit = Object.values(store).filter((o) => {
      if (f.startsWith('label=')) {
        const [k, v] = [f.slice(6, f.indexOf('=', 6)), f.slice(f.indexOf('=', 6) + 1)];
        return labelsFn(o)[k] === v;
      }
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
    return ok(hit.map(idOf).join('\n'));
  };

  const exec = (args, input) => {
    const rest = args.slice(1);
    const env = Object.fromEntries(
      flagValues(rest, '-e').map((e) => [e.slice(0, e.indexOf('=')), e.slice(e.indexOf('=') + 1)]),
    );
    const flagless = rest.filter((a, i) => a !== '-i' && a !== '-e' && rest[i - 1] !== '-e');
    const c = st.containers[flagless[0]];
    if (!c) return fail('Error: No such container');
    const cmd = flagless.slice(1);
    if (cmd[0] === 'psql') {
      const sql = flagValues(cmd, '-c')[0];
      const dbName = c.Config.Env.find((e) => e.startsWith('POSTGRES_DB='))?.slice(12);
      if (sql === 'select 1') return ok('1');
      if (sql === IDENT_SQL)
        return ok(
          [
            st.pg.systemId,
            st.pg.startTime,
            dbName,
            st.pg.oid,
            c.marker ?? '',
            c.setting ?? '',
          ].join('|'),
        );
      if (sql?.includes('pg_stat_activity')) return ok('');
      if (input !== undefined) {
        if (input.includes('COMMENT ON DATABASE')) {
          st.events.push('stamp');
          c.marker = /IS '([^']*)'/.exec(input)?.[1];
          c.setting = /adulis\.native_run = '([^']*)'/.exec(input)?.[1];
        } else st.events.push('psql input');
        return ok();
      }
      return ok();
    }
    if (cmd[0] === 'mc' && cmd.includes('info'))
      return ok(JSON.stringify({ info: { deploymentID: 'deployment-up-1' } }));
    if (cmd[0] === '/bin/sh' && input !== undefined) {
      const m = (st.minio ??= { tags: {}, marker: null, repoMarker: null, buckets: [] });
      if (input.includes('mc mb') && input.includes('adulis-media'))
        m.buckets = ['adulis-media', 'adulis-evidence'];
      if (input.includes('disposable-test-storage'))
        m.repoMarker = 'adulis:disposable-test-storage';
      if (input.includes('mc tag set')) {
        if (!opts.noTags)
          for (const b of ['adulis-media', 'adulis-evidence']) m.tags[b] = env.NATIVE_RUN;
        m.marker = env.NATIVE_RUN_VALUE;
      }
      st.events.push('minio script');
      return ok();
    }
    return ok();
  };

  const docker = async (args, o = {}) => {
    const [a, b] = args;
    if (st.dead)
      return { status: null, stdout: '', stderr: '', error: new Error('engine is not running') };
    if (a === 'info')
      return ok(args.includes('--format') ? `${st.engine.id}|${st.clock}` : '29.0.0');
    if (a === 'context' && b === 'show') return ok(st.engine.context);
    if (a === 'ps' && opts.failList) return fail('Error: cannot list containers');
    if (a === 'ps')
      return filterIds(
        st.containers,
        (x) => x.Id,
        (x) => x.Config.Labels,
        args,
      );
    if (a === 'volume' && b === 'ls')
      return filterIds(
        st.volumes,
        (x) => x.Name,
        (x) => x.Labels,
        args,
      );
    if (a === 'network' && b === 'ls')
      return filterIds(
        st.networks,
        (x) => x.Id,
        (x) => x.Labels,
        args,
      );
    if (a === 'inspect') {
      const x = st.containers[args.at(-1)];
      return x
        ? ok(JSON.stringify([x]))
        : fail(`Error response from daemon: No such container: ${args.at(-1)}`);
    }
    if (a === 'volume' && b === 'inspect') {
      const x = st.volumes[args[2]];
      return x
        ? ok(JSON.stringify([x]))
        : fail(`Error response from daemon: get ${args[2]}: no such volume`);
    }
    if (a === 'network' && b === 'inspect') {
      const x = st.networks[args[2]];
      return x
        ? ok(JSON.stringify([x]))
        : fail(`Error response from daemon: network ${args[2]} not found`);
    }
    if (a === 'network' && b === 'create') {
      const name = args.at(-1);
      const Id = sha(`net:${name}`);
      st.networks[Id] = { Id, Name: name, Labels: labelsOf(args), Containers: {} };
      st.events.push('network create');
      return ok(Id);
    }
    if (a === 'volume' && b === 'create') {
      const name = args.at(-1);
      st.volumes[name] = { Name: name, Driver: 'local', Labels: labelsOf(args), Options: null };
      st.events.push('volume create');
      return ok();
    }
    if (a === 'run') {
      const name = flagValues(args, '--name')[0];
      const role = labelsOf(args)[LABEL.role];
      if (opts.failRun === role) return fail('Error: cannot start the container');
      const [vol, dest] = flagValues(args, '-v')[0].split(':');
      const [hostIp, hostPort, cport] = flagValues(args, '-p')[0].split(':');
      const Id = sha(`ctr:${name}`);
      const net = flagValues(args, '--network')[0];
      st.containers[Id] = {
        Id,
        Name: `/${name}`,
        Created: st.clock,
        Image: `sha256:${role}`,
        Config: { Labels: labelsOf(args), Env: flagValues(args, '-e') },
        Mounts: [
          { Type: 'volume', Name: vol, Destination: dest },
          ...(opts.secondVolume
            ? [{ Type: 'volume', Name: 'f'.repeat(64), Destination: '/extra' }]
            : []),
        ],
        HostConfig: { Binds: [`${vol}:${dest}`], VolumesFrom: null, Tmpfs: null },
        NetworkSettings: {
          Networks: { [net]: {} },
          Ports: { [`${cport}/tcp`]: [{ HostIp: hostIp, HostPort: hostPort }] },
        },
      };
      for (const n of Object.values(st.networks)) if (n.Name === net) n.Containers[Id] = {};
      st.events.push(`run ${role}`);
      return ok(Id);
    }
    if (a === 'exec') return exec(args, o.input);
    if (a === 'rm') {
      const id = args.at(-1);
      delete st.containers[id];
      for (const n of Object.values(st.networks)) delete n.Containers[id];
      st.events.push('rm');
      return ok();
    }
    if (a === 'volume' && b === 'rm') {
      delete st.volumes[args[2]];
      st.events.push('volume rm');
      return ok();
    }
    if (a === 'network' && b === 'rm') {
      delete st.networks[args[2]];
      st.events.push('network rm');
      return ok();
    }
    return fail(`unexpected docker call ${args.join(' ')}`);
  };

  class Client {
    constructor(cfg) {
      this.cfg = cfg;
    }
    async connect() {
      if (!Object.values(st.containers).some((c) => portOf(c) === `${this.cfg.port}`))
        throw new Error('ECONNREFUSED');
    }
    async query(sql) {
      if (sql !== IDENT_SQL) throw new Error('unexpected SQL over TCP');
      const c = byRole('postgres');
      const systemId = opts.wrongServerOnPort ? '1111111111111111111' : st.pg.systemId;
      const dbName = c.Config.Env.find((e) => e.startsWith('POSTGRES_DB='))?.slice(12);
      return {
        rows: [
          {
            r: [systemId, st.pg.startTime, dbName, st.pg.oid, c.marker ?? '', c.setting ?? ''].join(
              '|',
            ),
          },
        ],
      };
    }
    async end() {}
  }

  const fetch = async (url, o = {}) => {
    const u = new URL(url);
    const minio = byRole('minio');
    if (!minio || u.port !== portOf(minio)) return Promise.reject(new Error('ECONNREFUSED'));
    if (u.pathname === '/minio/health/live') return res(200, '');
    const m = st.minio ?? { tags: {}, buckets: [] };
    const auth = o.headers?.authorization ?? '';
    if (!auth) {
      return u.pathname === '/adulis-test-marker/disposable' && m.repoMarker
        ? res(200, m.repoMarker)
        : res(404, '');
    }
    // Recompute the signature from what the request carries and compare: a request signed with another
    // key, or with headers that differ from the signed ones, is rejected.
    const key = minio.Config.Env.find((e) => e.startsWith('MINIO_ROOT_USER='))?.slice(16);
    const secret = minio.Config.Env.find((e) => e.startsWith('MINIO_ROOT_PASSWORD='))?.slice(20);
    const amz = o.headers['x-amz-date'];
    const canonical = canonicalRequest({
      path: u.pathname,
      query: u.search.slice(1),
      signed: 'host;x-amz-content-sha256;x-amz-date',
      payloadHash: EMPTY_SHA256,
      headers: {
        host: u.host,
        'x-amz-content-sha256': o.headers['x-amz-content-sha256'],
        'x-amz-date': amz,
      },
    });
    const want = signature({ secretKey: secret, amz, canonical });
    if (!auth.includes(`Credential=${key}/`) || !auth.endsWith(`Signature=${want.signature}`))
      return res(403, '<Error>SignatureDoesNotMatch</Error>');
    if (u.pathname === '/')
      return res(200, m.buckets.map((b) => `<Bucket><Name>${b}</Name></Bucket>`).join(''));
    if (u.search === '?tagging=') {
      const t = m.tags[u.pathname.slice(1)];
      return t
        ? res(200, `<Tag><Key>adulis-native-run</Key><Value>${t}</Value></Tag>`)
        : res(404, '');
    }
    if (u.pathname === '/adulis-test-marker/native-run')
      return m.marker ? res(200, m.marker) : res(404, '');
    return res(404, '');
  };

  const io = {
    docker,
    Client,
    fetch,
    node: 'node',
    run: async (file, args, o = {}) => {
      st.nodeRuns.push(args[0]);
      st.runs.push({ file, args, env: o.env, cwd: o.cwd });
      st.events.push(`node ${args[0].replaceAll('\\', '/').split('/').pop()}`);
      if (opts.guardRefuses && /migration-guard/.test(args[0]))
        return { status: 1, stdout: '', stderr: opts.guardRefuses, error: null };
      return ok();
    },
    proc: {
      listeners: async () => [],
      info: async () => ({ createdAt: null, commandLine: '' }),
      kill: () => {},
    },
  };
  return { st, io, runValue };
}
