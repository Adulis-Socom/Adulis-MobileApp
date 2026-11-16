// WO-INFRA-015A. The compose configuration, as `docker compose config` renders it (read-only: it
// starts, creates and changes nothing): loopback-only ports by default, MinIO started only through
// the data-volume guard, the guard service ahead of it, the legacy volume read-only, and the shape
// ops/scripts/minio-migrate.mjs reads (the /data volume and the published port) unchanged.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

const NEW_VOLUME = 'adulis-platform_adulis-miniodata';

function compose(extraEnv) {
  // Only this file, no .env overrides of the values under test, no COMPOSE_* from the caller.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !/^(COMPOSE_|ADULIS_BIND_ADDRESS|ADULIS_MINIO_VOLUME|ADULIS_MINIO_SWITCH_RUN|POSTGRES_HOST_PORT|MINIO_HOST_PORT)/.test(k),
    ),
  );
  return spawnSync(
    'docker',
    ['compose', '--env-file', join(root, 'ops/scripts/compose-safety.test.env'), '-f', join(root, 'docker-compose.yml'), 'config', '--format', 'json'],
    { cwd: root, encoding: 'utf8', env: { ...env, ...extraEnv } },
  );
}

function render(extraEnv = {}) {
  const r = compose({ ADULIS_MINIO_VOLUME: NEW_VOLUME, ...extraEnv });
  assert.equal(r.status, 0, `docker compose config failed: ${r.error?.message ?? r.stderr}`);
  return JSON.parse(r.stdout);
}

test('without ADULIS_MINIO_VOLUME every compose command stops at configuration time', () => {
  // `config` interpolates exactly as `up` does, so `up` would stop at the same point, touching nothing.
  for (const extra of [{}, { ADULIS_MINIO_VOLUME: '' }]) {
    const r = compose(extra);
    assert.notEqual(r.status, 0, 'compose accepted a configuration without the MinIO volume name');
    assert.match(r.stderr, /ADULIS_MINIO_VOLUME/);
    assert.match(r.stderr, /Before the MinIO move, leave it unset and do not run compose/);
  }
});

const mount = (svc, target) => (svc.volumes ?? []).find((v) => v.target === target);

test('PostgreSQL and MinIO publish on loopback only, unless a LAN bind is chosen deliberately', () => {
  const c = render();
  for (const s of ['postgres', 'minio']) {
    assert.equal(c.services[s].ports.length, 1, s);
    assert.equal(c.services[s].ports[0].host_ip, '127.0.0.1', `${s} must bind loopback by default`);
  }
  assert.equal(c.services.postgres.ports[0].published, '5432');
  // INF-04: the MinIO HOST port defaults to 9100, never 9000 (another project's MinIO commonly listens
  // there: the NAC stack on the development machine). The container port stays 9000.
  assert.equal(c.services.minio.ports[0].published, '9100');
  assert.equal(Number(c.services.minio.ports[0].target), 9000);
  const lan = render({ ADULIS_BIND_ADDRESS: '0.0.0.0', POSTGRES_HOST_PORT: '5434', MINIO_HOST_PORT: '9100' });
  assert.equal(lan.services.minio.ports[0].host_ip, '0.0.0.0');
  assert.equal(lan.services.postgres.ports[0].published, '5434'); // the live ports stay settable
  assert.equal(lan.services.minio.ports[0].published, '9100');
  assert.equal(c.services['minio-volume-guard'].network_mode, 'none');
});

test('the MinIO host port: 9100 by default, overridable, container port 9000, services on minio:9000 (INF-04)', () => {
  const c = render();
  assert.equal(c.services.minio.ports[0].published, '9100');
  assert.equal(Number(c.services.minio.ports[0].target), 9000);
  assert.equal(render({ MINIO_HOST_PORT: '19120' }).services.minio.ports[0].published, '19120');
  assert.equal(c.services['minio-init'].environment.MINIO_URL, 'http://minio:9000');
  assert.notEqual(c.services.minio.ports[0].published, '9000', 'the default must not be 9000');
});

test('.env.example points the API at the compose default MinIO port, never 9000 (INF-04)', () => {
  const ex = readFileSync(join(root, '.env.example'), 'utf8');
  const value = (k) => ex.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1];
  const port = render().services.minio.ports[0].published;
  assert.equal(new URL(value('R2_ACCOUNT_ID')).port, port);
  assert.equal(new URL(value('R2_MEDIA_PUBLIC_ORIGIN')).port, port);
  assert.equal(new URL(value('R2_MEDIA_PUBLIC_ORIGIN')).pathname, `/${value('R2_MEDIA_BUCKET')}`);
  const settings = ex.split('\n').filter((l) => !l.startsWith('#')).join('\n');
  assert.doesNotMatch(settings, /localhost:9000\b/);
});

test('the switch variable reaches both guards, empty unless minio-migrate.mjs sets it for its switch (INF-04)', () => {
  const c = render();
  for (const s of ['minio', 'minio-volume-guard']) assert.equal(c.services[s].environment.MINIO_GUARD_SWITCH_RUN, '', s);
  const sw = render({ ADULIS_MINIO_SWITCH_RUN: '20261116120000-abcd' });
  for (const s of ['minio', 'minio-volume-guard'])
    assert.equal(sw.services[s].environment.MINIO_GUARD_SWITCH_RUN, '20261116120000-abcd', s);
});

test('MinIO starts only through the inline guard, after the guard service has accepted', () => {
  const c = render();
  const m = c.services.minio;
  const g = c.services['minio-volume-guard'];
  assert.deepEqual(m.entrypoint.slice(0, 2), ['/bin/sh', '-c']);
  assert.equal(m.entrypoint[3], 'minio-volume-guard');
  assert.equal(g.entrypoint[2], m.entrypoint[2], 'both run the same guard');
  assert.deepEqual(m.command, ['/usr/bin/minio', 'server', '/data']);
  assert.equal(m.environment.MINIO_GUARD_DATA_DIR, '/data');
  assert.equal(m.depends_on['minio-volume-guard'].condition, 'service_completed_successfully');
  // No bind mount: MinIO's restart must not depend on a checkout still existing.
  for (const s of [m, g]) assert.deepEqual((s.volumes ?? []).filter((v) => v.type === 'bind'), []);
});

test('the legacy volume is external: compose never creates or deletes it, down -v included', () => {
  assert.equal(render().volumes['adulis-legacy'].external, true);
});

test('every volume is external under its live name: down -v deletes no data (WO-INFRA-015B)', () => {
  const c = render();
  assert.equal(c.volumes['adulis-pgdata'].external, true);
  assert.equal(c.volumes['adulis-pgdata'].name, 'adulis-platform_adulis-pgdata');
  assert.equal(c.volumes['adulis-miniodata'].external, true);
  assert.equal(c.volumes['adulis-miniodata'].name, 'adulis-platform_adulis-miniodata');
  const managed = Object.entries(c.volumes).filter(([, v]) => !v.external).map(([k]) => k);
  assert.deepEqual(managed, [], 'a compose-managed volume is one `down -v` deletes');
});

test('the guard service reads both volumes as root, and the legacy volume is never writable', () => {
  const c = render();
  const g = c.services['minio-volume-guard'];
  assert.equal(g.user, '0:0');
  assert.equal(g.environment.MINIO_GUARD_DATA_DIR, '/data');
  assert.equal(mount(g, '/data').source, 'adulis-miniodata');
  for (const [name, svc] of Object.entries(c.services))
    for (const v of svc.volumes ?? [])
      if (v.source === 'adulis-legacy') {
        assert.equal(v.read_only, true, `${name} mounts the legacy volume writable`);
        assert.equal(v.volume?.nocopy, true, `${name} would copy image files into the legacy volume`);
        assert.equal(v.target, '/adulis-guard/legacy');
      }
  assert.ok(mount(g, '/adulis-guard/legacy') && mount(c.services.minio, '/adulis-guard/legacy'));
});

test('the volume names are the live ones, and only the legacy key reaches adulis-pgdata', () => {
  const c = render();
  assert.equal(c.name, 'adulis-platform');
  assert.equal(c.volumes['adulis-pgdata'].name, 'adulis-platform_adulis-pgdata');
  assert.equal(c.volumes['adulis-miniodata'].name, 'adulis-platform_adulis-miniodata');
  assert.equal(c.volumes['adulis-legacy'].name, 'adulis-pgdata');
  assert.equal(mount(c.services.postgres, '/var/lib/postgresql/data').source, 'adulis-pgdata');
});

test('minio-migrate.mjs still finds its target: the /data volume and the published port', () => {
  // The same reading as resolveConfig() in minio-migrate.mjs.
  const c = render({ MINIO_HOST_PORT: '9100' });
  const minio = c.services.minio;
  const data = (minio.volumes ?? []).find((v) => v.target === '/data' && v.type === 'volume');
  assert.equal(c.volumes[data.source].name, 'adulis-platform_adulis-miniodata');
  assert.equal(String(minio.ports.find((p) => Number(p.target) === 9000).published), '9100');
  assert.ok(c.services['minio-init'], 'minio-init is still there');
  assert.equal(minio.container_name, 'adulis-minio');
});

// ---------- the guard's behaviour: the script compose would run, run here with sh ----------

// `config` keeps compose's `$$` escape; a container receives `$` (checked with `docker compose create`).
const LEGACY_LINE = 'legacy=/adulis-guard/legacy';
const guardText = (() => {
  const s = render().services['minio-volume-guard'].entrypoint[2].replaceAll('$$', '$');
  assert.equal(s.split(LEGACY_LINE).length, 2, 'the guard names its legacy mount exactly once');
  return s;
})();

const RUN = '20261116120000-abcd';
/** Runs the guard against temporary data and legacy directories. */
// `record`: the move record's content (`marker` = a complete one); `undone`: a renamed-aside record
// beside it; `switchRun`: MINIO_GUARD_SWITCH_RUN (INF-04).
function guard({ data = true, legacy = true, dataFormatted = false, dataSkeleton = false, marker = false, record = marker ? `complete ${RUN}\n` : null, undone = null, switchRun = null, foreign = false, legacyFormatted = false, legacyUnreadable = false, sameDir = false, args = [], unsetData = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'adulis-guard-'));
  const d = join(dir, 'data');
  const l = sameDir ? d : join(dir, 'legacy');
  const formatted = (p) => {
    mkdirSync(join(p, '.minio.sys', 'buckets'), { recursive: true });
    writeFileSync(join(p, '.minio.sys', 'format.json'), '{"version":"1","format":"xl-single"}');
  };
  try {
    if (data) mkdirSync(d);
    if (legacy && !sameDir) mkdirSync(l);
    if (dataFormatted) formatted(d);
    if (dataSkeleton) mkdirSync(join(d, '.minio.sys', 'config'), { recursive: true });
    if (record !== null) writeFileSync(join(d, '.adulis-migration-complete'), record);
    if (undone) writeFileSync(join(d, undone), `complete ${RUN}\n`);
    if (foreign) writeFileSync(join(d, 'PG_VERSION'), '17');
    if (legacyFormatted) formatted(l);
    if (legacyUnreadable) chmodSync(l, 0o000);
    const script = guardText.replace(LEGACY_LINE, `legacy='${l.replaceAll('\\', '/')}'`);
    const env = { ...process.env };
    delete env.MINIO_GUARD_SWITCH_RUN;
    if (switchRun !== null) env.MINIO_GUARD_SWITCH_RUN = switchRun;
    if (unsetData) delete env.MINIO_GUARD_DATA_DIR;
    else env.MINIO_GUARD_DATA_DIR = d.replaceAll('\\', '/');
    const r = spawnSync('sh', ['-c', script, 'minio-volume-guard', ...args], { encoding: 'utf8', env });
    try {
      r.recordAfter = readFileSync(join(d, '.adulis-migration-complete'), 'utf8');
    } catch {
      r.recordAfter = null;
    }
    return r;
  } finally {
    try {
      chmodSync(l, 0o755);
    } catch {
      /* absent */
    }
    rmSync(dir, { recursive: true, force: true });
  }
}
const refused = (r, re) => {
  assert.equal(r.status, 1, `expected a refusal, got ${r.status}: ${r.stdout}${r.stderr}`);
  assert.match(r.stderr, re);
};
const accepted = (r, re) => {
  assert.equal(r.status, 0, `expected acceptance, got ${r.status}: ${r.stderr}`);
  assert.match(r.stdout, re);
};

test('guard: a fresh installation starts (no MinIO data anywhere; the image skeleton is not data)', () => {
  accepted(guard(), /fresh installation/);
  accepted(guard({ dataSkeleton: true }), /fresh installation/);
});

test('guard: an empty data volume while adulis-pgdata holds the objects is refused, even with the skeleton', () => {
  refused(guard({ legacyFormatted: true }), /data volume is empty and adulis-pgdata holds/);
  refused(guard({ legacyFormatted: true, dataSkeleton: true }), /data volume is empty and adulis-pgdata holds/);
});

test('guard: a formatted data volume needs the recorded move while adulis-pgdata holds the objects', () => {
  // A partial copy, or a store started before the move: formatted, but no marker.
  refused(guard({ legacyFormatted: true, dataFormatted: true }), /no completed move from adulis-pgdata is recorded/);
  accepted(guard({ legacyFormatted: true, dataFormatted: true, marker: true }), /holds MinIO data/);
  accepted(guard({ dataFormatted: true }), /holds MinIO data/); // a fresh store that has started once
});

test('guard: a pending record is accepted only for its own switch; a complete one always (INF-04)', () => {
  const moved = { legacyFormatted: true, dataFormatted: true };
  accepted(guard({ ...moved, record: `complete ${RUN}\n` }), /holds MinIO data/);
  accepted(guard({ ...moved, record: `complete ${RUN}` }), /holds MinIO data/); // no final newline
  refused(guard({ ...moved, record: `pending ${RUN}\n` }), /never verified \(record pending, run 20261116120000-abcd\)/);
  refused(guard({ ...moved, record: `pending ${RUN}\n`, switchRun: '' }), /never verified/);
  refused(guard({ ...moved, record: `pending ${RUN}\n`, switchRun: '20261116120000-ffff' }), /never verified/);
  accepted(guard({ ...moved, record: `pending ${RUN}\n`, switchRun: RUN }), /holds MinIO data/);
  refused(guard({ ...moved, record: 'pending \n', switchRun: '' }), /never verified/); // an empty run never matches
});

test('guard: the switch uses the pending record up; no later start accepts it (INF-04 review A-H1)', () => {
  const moved = { legacyFormatted: true, dataFormatted: true, record: `pending ${RUN}\n`, switchRun: RUN };
  const server = ['sh', '-c', 'echo SERVER STARTED'];
  // The one-shot service (no server command) checks without using it up.
  const oneShot = guard(moved);
  accepted(oneShot, /holds MinIO data/);
  assert.equal(oneShot.recordAfter, `pending ${RUN}\n`);
  // The minio service's start uses it up before the server runs.
  const first = guard({ ...moved, args: server });
  accepted(first, /SERVER STARTED/);
  assert.equal(first.recordAfter, `switching ${RUN}\n`);
  // A restart of that container (same configuration, same switch run) is refused, and so is any other start.
  for (const switchRun of [RUN, '', null]) {
    const again = guard({ ...moved, record: `switching ${RUN}\n`, switchRun, args: server });
    refused(again, /never verified \(record switching, run 20261116120000-abcd\)/);
    assert.doesNotMatch(again.stdout, /SERVER STARTED/);
  }
  // The commit replaces it: complete is accepted on every start.
  accepted(guard({ ...moved, record: `complete ${RUN}\n`, args: server }), /SERVER STARTED/);
});

test('guard: a record this tool does not write, or one beside an undone record, is refused (INF-04)', () => {
  const moved = { legacyFormatted: true, dataFormatted: true };
  for (const record of ['{}', '', '{"run":"20261116120000-abcd"}\n', 'COMPLETE x\n', 'done\n'])
    refused(guard({ ...moved, record }), /not one minio-migrate.mjs writes/);
  for (const undone of ['.adulis-migration-invalidated', '.adulis-migration-rolled-back'])
    refused(guard({ ...moved, marker: true, undone }), /undone or rolled back/);
  // With no MinIO data in adulis-pgdata there is nothing a stale copy could hide: a started store runs.
  accepted(guard({ dataFormatted: true, record: `pending ${RUN}\n` }), /holds MinIO data/);
});

test('guard: the legacy volume as the data volume, and a data volume that is not MinIO\'s, are refused', () => {
  refused(guard({ sameDir: true, dataFormatted: true }), /the data volume is the legacy volume adulis-pgdata itself/);
  refused(guard({ foreign: true }), /holds files that are not MinIO data \(PG_VERSION\)/);
});

test('guard: missing mounts or settings refuse', () => {
  refused(guard({ data: false }), /data volume is not mounted/);
  refused(guard({ legacy: false }), /legacy volume is not mounted/);
  refused(guard({ unsetData: true }), /MINIO_GUARD_DATA_DIR is not set/);
});

test('guard: the server command runs only when the guard accepts', () => {
  const ran = guard({ args: ['sh', '-c', 'echo SERVER STARTED'] });
  assert.equal(ran.status, 0);
  assert.match(ran.stdout, /SERVER STARTED/);
  const not = guard({ legacyFormatted: true, args: ['sh', '-c', 'echo SERVER STARTED'] });
  assert.equal(not.status, 1);
  assert.doesNotMatch(not.stdout, /SERVER STARTED/);
});

test('guard: an unreadable legacy volume counts as holding data (the non-root case)', { skip: (process.platform === 'win32' || process.getuid?.() === 0) && 'needs a non-root POSIX user for mode 000' }, () => {
  refused(guard({ legacyUnreadable: true }), /adulis-pgdata holds \(or may hold\)/);
  refused(guard({ legacyUnreadable: true, dataFormatted: true }), /no completed move from adulis-pgdata is recorded/);
  accepted(guard({ legacyUnreadable: true, dataFormatted: true, marker: true }), /holds MinIO data/);
});
