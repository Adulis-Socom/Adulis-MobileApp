// The object-storage target check (WO-INFRA-015B): what the test tooling may write to.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  R2_KEYS,
  STORAGE_MARKER,
  checkDisposableStorage,
  checkStorageConfig,
} from './lib/disposable-storage.mjs';

const ok = {
  R2_ACCOUNT_ID: 'http://127.0.0.1:59000',
  R2_ACCESS_KEY_ID: 'adulis-local',
  R2_SECRET_ACCESS_KEY: 'adulis-local-secret',
  R2_MEDIA_BUCKET: 'adulis-media',
  R2_EVIDENCE_BUCKET: 'adulis-evidence',
  R2_MEDIA_PUBLIC_ORIGIN: 'http://127.0.0.1:59000/adulis-media',
};
const fetched = [];
const serving =
  (status, body = '') =>
  async (url) => {
    fetched.push(url);
    return { status, text: async () => body };
  };
const marker = serving(200, STORAGE_MARKER.body);

test('nothing configured: allowed (the in-memory fake), unless real storage is required', async () => {
  assert.equal((await checkDisposableStorage({}, { fetchImpl: marker })).code, 0);
  assert.equal((await checkDisposableStorage({}, { required: true, fetchImpl: marker })).code, 1);
});

test('the disposable store with its marker is accepted, and the marker is read where it lives', async () => {
  fetched.length = 0;
  const r = await checkDisposableStorage(ok, { fetchImpl: marker });
  assert.equal(r.code, 0, r.err.join('\n'));
  assert.deepEqual(fetched, ['http://127.0.0.1:59000/adulis-test-marker/disposable']);
  // localhost and IPv6 loopback, as CI and some shells spell it.
  for (const host of ['localhost:9000', '[::1]:9000']) {
    const env = {
      ...ok,
      R2_ACCOUNT_ID: `http://${host}`,
      R2_MEDIA_PUBLIC_ORIGIN: `http://${host}/adulis-media`,
    };
    assert.equal((await checkDisposableStorage(env, { fetchImpl: marker })).code, 0, host);
  }
});

test('a store without the marker is refused: the development MinIO answers 404 there', async () => {
  for (const f of [serving(404), serving(403), serving(200, 'something else'), serving(301)]) {
    const r = await checkDisposableStorage(ok, { fetchImpl: f });
    assert.equal(r.code, 1);
    assert.match(r.err.join('\n'), /does not carry the disposable-storage marker/);
  }
  const down = async () => {
    throw new Error('connect ECONNREFUSED');
  };
  assert.match(
    (await checkDisposableStorage(ok, { fetchImpl: down })).err.join('\n'),
    /did not answer/,
  );
});

test('configuration refused before any request', async () => {
  const cases = [
    [{ R2_ACCOUNT_ID: ok.R2_ACCOUNT_ID }, /only some R2_\* values are set/],
    [{ ...ok, R2_MEDIA_BUCKET: '' }, /R2_MEDIA_BUCKET unset/],
    [{ ...ok, R2_ACCOUNT_ID: '0123456789abcdef' }, /an account id means Cloudflare R2/],
    [{ ...ok, R2_ACCOUNT_ID: 'http://192.168.1.20:9000' }, /only a loopback store/],
    [{ ...ok, R2_ACCOUNT_ID: 'https://x.r2.cloudflarestorage.com' }, /only a loopback store/],
    [{ ...ok, R2_ACCOUNT_ID: 'http://127.0.0.1' }, /no explicit port/],
    [{ ...ok, R2_ACCOUNT_ID: 'http://u:p@127.0.0.1:59000' }, /carries credentials/],
    [
      { ...ok, R2_MEDIA_PUBLIC_ORIGIN: 'http://127.0.0.1:9100/adulis-media' },
      /not on http:\/\/127.0.0.1:59000/,
    ],
    [{ ...ok, R2_MEDIA_PUBLIC_ORIGIN: 'not a url' }, /R2_MEDIA_PUBLIC_ORIGIN is not on/],
  ];
  for (const [env, why] of cases) {
    fetched.length = 0;
    const r = await checkDisposableStorage(env, { fetchImpl: marker });
    assert.equal(r.code, 1, JSON.stringify(env));
    assert.match(r.err.join('\n'), why);
    assert.deepEqual(fetched, [], 'no request for a refused configuration');
  }
});

test('the six keys are the ones the API reads, and the marker matches the script that creates it', () => {
  const adapter = readFileSync(
    new URL('../../apps/api/src/common/adapters/s3-object-storage.ts', import.meta.url),
    'utf8',
  );
  for (const k of R2_KEYS) assert.ok(adapter.includes(`process.env['${k}']`), k);
  const sh = readFileSync(new URL('./minio-test-marker.sh', import.meta.url), 'utf8');
  assert.ok(
    sh.includes(
      `printf '${STORAGE_MARKER.body}' | mc pipe marker/${STORAGE_MARKER.bucket}/${STORAGE_MARKER.key}`,
    ),
  );
  assert.ok(sh.includes(`arn:aws:s3:::${STORAGE_MARKER.bucket}/${STORAGE_MARKER.key}`));
  // Never part of the init that compose runs against the stores we keep.
  assert.ok(
    !readFileSync(new URL('./minio-init.sh', import.meta.url), 'utf8').includes(
      STORAGE_MARKER.bucket,
    ),
  );
  assert.equal(checkStorageConfig({}).configured, false);
});
