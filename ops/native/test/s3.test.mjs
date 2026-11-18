// SigV4 for the signed requests that prove a MinIO is the run's: the core is checked against two
// vectors of the public AWS Signature V4 test suite, and the request it builds against a recomputation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalRequest, EMPTY_SHA256, signature, signedGet } from '../lib/s3.mjs';

const SECRET = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY';
const AMZ = '20150830T123600Z';
const vector = (query) =>
  signature({
    secretKey: SECRET,
    amz: AMZ,
    service: 'service',
    canonical: canonicalRequest({
      path: '/',
      query,
      headers: { host: 'example.amazonaws.com', 'x-amz-date': AMZ },
      signed: 'host;x-amz-date',
      payloadHash: EMPTY_SHA256,
    }),
  });

test('the signature matches the AWS test-suite vector get-vanilla', () => {
  assert.equal(
    vector('').signature,
    '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
  );
  assert.equal(vector('').scope, '20150830/us-east-1/service/aws4_request');
});

test('the signature matches the AWS test-suite vector get-vanilla-empty-query-key', () => {
  assert.equal(
    vector('Param1=value1').signature,
    'a67d582fa61cc504c4bae71f336f98b97f1ea3c7a6bfe1b6e45aec72011b9aeb',
  );
});

test('the empty payload hash is the SHA-256 of nothing', () => {
  assert.equal(EMPTY_SHA256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('a signed request carries the credential, the signed headers and a signature that depends on the secret and the query', async () => {
  const seen = [];
  const fetchImpl = async (url, o) => {
    seen.push({ url, h: o.headers });
    return { status: 200, text: async () => '' };
  };
  const now = new Date('2026-11-18T10:00:00.123Z');
  const base = {
    endpoint: 'http://127.0.0.1:57212',
    accessKey: 'AK',
    secretKey: 'SK',
    fetchImpl,
    now,
  };
  await signedGet({ ...base, path: '/adulis-media', query: 'tagging=' });
  await signedGet({ ...base, path: '/adulis-media', query: 'tagging=', secretKey: 'OTHER' });
  await signedGet({ ...base, path: '/adulis-media' });
  const [a, b, c] = seen;
  assert.equal(a.url, 'http://127.0.0.1:57212/adulis-media?tagging=');
  assert.equal(a.h['x-amz-date'], '20261118T100000Z');
  assert.match(
    a.h.authorization,
    /^AWS4-HMAC-SHA256 Credential=AK\/20261118\/us-east-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
  );
  const sig = (x) => x.h.authorization.split('Signature=')[1];
  assert.notEqual(sig(a), sig(b), 'another secret must sign differently');
  assert.notEqual(sig(a), sig(c), 'the query is part of what is signed');
  // The same request signed again by hand with the documented construction.
  const canonical = canonicalRequest({
    path: '/adulis-media',
    query: 'tagging=',
    headers: {
      host: '127.0.0.1:57212',
      'x-amz-content-sha256': EMPTY_SHA256,
      'x-amz-date': '20261118T100000Z',
    },
    signed: 'host;x-amz-content-sha256;x-amz-date',
    payloadHash: EMPTY_SHA256,
  });
  assert.equal(
    sig(a),
    signature({ secretKey: 'SK', amz: '20261118T100000Z', canonical }).signature,
  );
});
