// The run manifest: what the harness created, written when it created it. Every later command reads
// it and compares it with the live resources; the environment says what someone intended, the
// manifest says what exists.
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { namePrefix } from './protected.mjs';

export const SCHEMA = 1;
export const RUN_RE = /^native-\d{8}-[0-9a-f]{8}$/;
// Where each command may run: `refused` and `cleaned` runs cannot be used again.
export const STATES = ['creating', 'ready', 'cleanup', 'cleanup-incomplete', 'cleaned'];

export const rand = (bytes = 16) => randomBytes(bytes).toString('hex');

/** A new run's identity and the names of everything it will create. Pure apart from randomness. */
export function newRun(now = new Date(), random = rand) {
  const run8 = random(4);
  const run = `native-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${run8}`;
  const p = namePrefix(run8);
  return {
    schema: SCHEMA,
    run,
    run8,
    nonce: random(32),
    state: 'creating',
    createdAt: now.toISOString(),
    names: {
      network: `${p}net`,
      pgVolume: `${p}pgdata`,
      minioVolume: `${p}miniodata`,
      pg: `${p}pg`,
      minio: `${p}minio`,
    },
    db: { host: '127.0.0.1', name: `adulis_native_${run8}`, user: 'adulis_bootstrap' },
    secrets: {
      pg: random(16),
      app: random(16),
      jobs: random(16),
      s3Key: random(10),
      s3Secret: random(20),
    },
    containers: {},
    volumes: {},
    network: null,
    engine: null,
    fixtures: [],
    api: null,
  };
}

export const runDir = (root, run) => join(root, 'runs', run);

export function writeManifest(dir, m) {
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `manifest.json.${process.pid}.tmp`);
  writeFileSync(tmp, `${JSON.stringify(m, null, 2)}\n`);
  renameSync(tmp, join(dir, 'manifest.json')); // atomic: a reader sees the old or the new, never half
}

export function readManifest(dir) {
  return JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
}
