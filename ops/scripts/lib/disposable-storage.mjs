/**
 * WHICH OBJECT STORE THE TEST TOOLING MAY WRITE (WO-INFRA-015B, PR105-F7).
 *
 * The API suites and the console e2e gate upload and delete real objects whenever the six R2_*
 * values are set. The root .env, which both load, points them at the persistent development MinIO,
 * so a run that took its database from test-db.sh but its storage from .env wrote test objects into
 * the store that holds the development media and evidence. The database guard could not see that.
 *
 * So a run proceeds only against storage that says it is disposable:
 *   - none of the six R2_* values set: the API binds its in-memory fake and writes nothing (allowed,
 *     unless the caller needs real storage);
 *   - some but not all set: refused (a half-configured store is a mistake, whatever it reaches);
 *   - all six set: R2_ACCOUNT_ID is an http(s) URL on a loopback host with an explicit port (never a
 *     Cloudflare account id), R2_MEDIA_PUBLIC_ORIGIN is on the same origin, and that store serves
 *     the marker object anonymously. Only ops/scripts/minio-test-marker.sh creates it, run by
 *     test-db.sh and CI on their throwaway MinIO; never compose, never minio-init.sh.
 */
export const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_MEDIA_BUCKET',
  'R2_EVIDENCE_BUCKET',
  'R2_MEDIA_PUBLIC_ORIGIN',
];
// Keep identical to ops/scripts/minio-test-marker.sh.
export const STORAGE_MARKER = {
  bucket: 'adulis-test-marker',
  key: 'disposable',
  body: 'adulis:disposable-test-storage',
};
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const HOW =
  'Use the disposable MinIO: `bash ops/scripts/test-db.sh up`, then `eval "$(bash ops/scripts/test-db.sh env)"` in this shell.';

/** Everything decidable without the network. `endpoint` is set only when all six values are usable. */
export function checkStorageConfig(env) {
  const set = R2_KEYS.filter((k) => env[k]);
  if (set.length === 0) return { configured: false, problems: [], endpoint: null };
  const problems = [];
  if (set.length < R2_KEYS.length)
    problems.push(
      `only some R2_* values are set (${R2_KEYS.filter((k) => !env[k]).join(', ')} unset): set all six or none`,
    );
  const url = (name) => {
    try {
      const u = new URL(env[name]);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
    } catch {
      return null;
    }
  };
  let endpoint = null;
  if (env.R2_ACCOUNT_ID) {
    const u = url('R2_ACCOUNT_ID');
    if (!u) problems.push('R2_ACCOUNT_ID is not an http(s) URL: an account id means Cloudflare R2');
    else if (!LOOPBACK.has(u.hostname))
      problems.push(
        `R2_ACCOUNT_ID points at ${u.hostname}: only a loopback store can be disposable here`,
      );
    else if (!u.port) problems.push('R2_ACCOUNT_ID has no explicit port');
    else if (u.username || u.password) problems.push('R2_ACCOUNT_ID carries credentials');
    else endpoint = u.origin;
  }
  if (env.R2_MEDIA_PUBLIC_ORIGIN && endpoint) {
    const m = url('R2_MEDIA_PUBLIC_ORIGIN');
    if (!m || m.origin !== endpoint)
      problems.push(`R2_MEDIA_PUBLIC_ORIGIN is not on ${endpoint}, the store R2_ACCOUNT_ID names`);
  }
  return { configured: true, problems, endpoint: problems.length ? null : endpoint };
}

/** Reads the marker anonymously; resolves to a list of problems (empty: the store is disposable). */
export async function checkStorageMarker(endpoint, fetchImpl = fetch) {
  const where = `${endpoint}/${STORAGE_MARKER.bucket}/${STORAGE_MARKER.key}`;
  let res;
  try {
    res = await fetchImpl(where, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
  } catch (e) {
    return [`the store at ${endpoint} did not answer (${e.message})`];
  }
  const body = res.status === 200 ? (await res.text()).trim() : '';
  if (body === STORAGE_MARKER.body) return [];
  return [
    `the store at ${endpoint} does not carry the disposable-storage marker (${where}: HTTP ${res.status}); it may be the development MinIO`,
  ];
}

/**
 * { code, out, err } like checkDisposable in ./disposable-db.mjs. code 0: allowed; 1: refused.
 * `required`: the caller needs real storage, so "nothing configured" is refused too.
 */
export async function checkDisposableStorage(env, { required = false, fetchImpl = fetch } = {}) {
  const c = checkStorageConfig(env);
  if (!c.configured) {
    if (!required)
      return {
        code: 0,
        out: [
          '[storage-target] no R2_* value is set: the API uses its in-memory storage; nothing is written to a store.',
        ],
        err: [],
      };
    c.problems.push('no R2_* value is set, and this run needs real object storage');
  }
  const problems = c.endpoint ? await checkStorageMarker(c.endpoint, fetchImpl) : c.problems;
  if (problems.length === 0)
    return {
      code: 0,
      out: [`[storage-target] ${c.endpoint} carries the disposable-storage marker.`],
      err: [],
    };
  return {
    code: 1,
    out: [],
    err: [`[storage-target] refused this object store:`, ...problems.map((p) => `  - ${p}`), HOW],
  };
}
