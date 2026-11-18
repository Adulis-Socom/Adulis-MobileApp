// A signed GET against the run's MinIO (AWS Signature V4, no SDK: nothing here may depend on a
// package the harness does not already have). The credentials are the run's own random pair, so
// only the store that was started with them answers 200: that is the proof of identity.
import { createHash, createHmac } from 'node:crypto';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const hmac = (k, s) => createHmac('sha256', k).update(s).digest();

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
  const day = amz.slice(0, 8);
  const empty = sha256('');
  const headers = `host:${url.host}\nx-amz-content-sha256:${empty}\nx-amz-date:${amz}\n`;
  const signed = 'host;x-amz-content-sha256;x-amz-date';
  const canonical = ['GET', path, query, headers, signed, empty].join('\n');
  const scope = `${day}/us-east-1/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amz, scope, sha256(canonical)].join('\n');
  let key = hmac(`AWS4${secretKey}`, day);
  for (const part of ['us-east-1', 's3', 'aws4_request']) key = hmac(key, part);
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  const res = await fetchImpl(`${url.origin}${path}${query ? `?${query}` : ''}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
    headers: {
      'x-amz-content-sha256': empty,
      'x-amz-date': amz,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
    },
  });
  return { status: res.status, body: await res.text() };
}
