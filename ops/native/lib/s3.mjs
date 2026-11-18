// A signed GET against the run's MinIO (AWS Signature V4, no SDK: nothing here may depend on a
// package the harness does not already have). The credentials are the run's own random pair, so
// only the store that was started with them answers 200: that is the proof of identity.
import { createHash, createHmac } from 'node:crypto';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const hmac = (k, s) => createHmac('sha256', k).update(s).digest();
export const EMPTY_SHA256 = sha256('');

/** The canonical request: `headers` maps lower-case names to values, `signed` lists them in order. */
export function canonicalRequest({
  method = 'GET',
  path,
  query = '',
  headers,
  signed,
  payloadHash,
}) {
  const names = signed.split(';');
  const block = names.map((n) => `${n}:${headers[n]}\n`).join('');
  return [method, path, query, block, signed, payloadHash].join('\n');
}

/** The hex signature of a canonical request (verified against the AWS test-suite vector). */
export function signature({ secretKey, amz, region = 'us-east-1', service = 's3', canonical }) {
  const day = amz.slice(0, 8);
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amz, scope, sha256(canonical)].join('\n');
  let key = hmac(`AWS4${secretKey}`, day);
  for (const part of [region, service, 'aws4_request']) key = hmac(key, part);
  return { signature: createHmac('sha256', key).update(toSign).digest('hex'), scope };
}

/** Returns { status, body } or throws on a network error or timeout. */
export async function signedGet({
  endpoint,
  path,
  query = '',
  accessKey,
  secretKey,
  fetchImpl = fetch,
  now = new Date(),
}) {
  const url = new URL(endpoint);
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const signed = 'host;x-amz-content-sha256;x-amz-date';
  const canonical = canonicalRequest({
    path,
    query,
    signed,
    payloadHash: EMPTY_SHA256,
    headers: { host: url.host, 'x-amz-content-sha256': EMPTY_SHA256, 'x-amz-date': amz },
  });
  const sig = signature({ secretKey, amz, canonical });
  const res = await fetchImpl(`${url.origin}${path}${query ? `?${query}` : ''}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
    headers: {
      'x-amz-content-sha256': EMPTY_SHA256,
      'x-amz-date': amz,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${sig.scope}, SignedHeaders=${signed}, Signature=${sig.signature}`,
    },
  });
  return { status: res.status, body: await res.text() };
}
