// WO-INFRA-015A. The compose configuration, as `docker compose config` renders it (read-only: it
// starts, creates and changes nothing): loopback-only ports by default, MinIO started only through
// the data-volume guard, the guard service ahead of it, the legacy volume read-only, and the shape
// ops/scripts/minio-migrate.mjs reads (the /data volume and the published port) unchanged.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

const NEW_VOLUME = 'adulis-platform_adulis-miniodata';

function compose(extraEnv) {
  // Only this file, no .env overrides of the values under test, no COMPOSE_* from the caller.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !/^(COMPOSE_|ADULIS_BIND_ADDRESS|ADULIS_MINIO_VOLUME|POSTGRES_HOST_PORT|MINIO_HOST_PORT)/.test(k),
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
  assert.equal(c.services.minio.ports[0].published, '9000');
  const lan = render({ ADULIS_BIND_ADDRESS: '0.0.0.0', POSTGRES_HOST_PORT: '5434', MINIO_HOST_PORT: '9100' });
  assert.equal(lan.services.minio.ports[0].host_ip, '0.0.0.0');
  assert.equal(lan.services.postgres.ports[0].published, '5434'); // the live ports stay settable
  assert.equal(lan.services.minio.ports[0].published, '9100');
  assert.equal(c.services['minio-volume-guard'].network_mode, 'none');
});

test('MinIO starts only through the guard, after the guard service has accepted', () => {
  const m = render().services.minio;
  assert.deepEqual(m.entrypoint, ['/bin/sh', '/adulis-guard/minio-volume-guard.sh']);
  assert.deepEqual(m.command, ['/usr/bin/minio', 'server', '/data']);
  assert.equal(m.environment.MINIO_GUARD_DATA_DIR, '/data');
  assert.equal(m.depends_on['minio-volume-guard'].condition, 'service_completed_successfully');
  assert.ok(existsSync(join(root, 'ops/scripts/minio-volume-guard.sh')));
  assert.equal(mount(m, '/adulis-guard/minio-volume-guard.sh').read_only, true);
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
