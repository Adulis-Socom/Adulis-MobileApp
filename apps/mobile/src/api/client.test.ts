import { en } from '@adulis/locale/mobile';

import { ApiError, createApiClient, isTransient, newIdempotencyKey, wasAnswered } from './client';
import { failureMessage } from './messages';
import { GOOD_TOKEN, installFakeApi, problem, publicScene, storefrontProduct } from '../testing/fake-api';

const t = (key: keyof typeof en) => en[key];
const DEVICE = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function client(token: string | null = null) {
  const onSessionEnded = jest.fn();
  const api = createApiClient({ deviceId: async () => DEVICE, token: () => token, onSessionEnded });
  return { api, onSessionEnded };
}

const failureOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a failure');
};

describe('the typed API client', () => {
  it('classifies failures: offline, timeout, problem, unexpected', async () => {
    const fake = installFakeApi();
    const { api } = client();

    fake.on('GET /v1/bootstrap', () => 'offline');
    const offline = await failureOf(api.bootstrap());
    expect(offline).toBeInstanceOf(ApiError);
    expect((offline as ApiError).failure).toEqual({ kind: 'offline' });
    expect(isTransient(offline)).toBe(true);

    fake.on('GET /v1/bootstrap', () => problem(503, 'INTERNAL', 'request'));
    const answered = (await failureOf(api.bootstrap())) as ApiError;
    expect(answered.failure).toMatchObject({ kind: 'problem', status: 503 });
    expect(isTransient(answered)).toBe(false);

    fake.on('GET /v1/bootstrap', () => ({ status: 502, body: '<html>bad gateway</html>' }));
    expect(((await failureOf(api.bootstrap())) as ApiError).failure).toEqual({ kind: 'unexpected', status: 502 });

    // A success status whose body is not JSON is still a classified failure.
    fake.fetchMock.mockResolvedValueOnce({
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    } as unknown as Response);
    expect(((await failureOf(api.bootstrap())) as ApiError).failure).toEqual({ kind: 'unexpected', status: 200 });

    expect(wasAnswered(offline)).toBe(false);
    expect(wasAnswered(answered)).toBe(true);
  });

  it('makes idempotency keys as time-ordered UUIDv7s', () => {
    const before = Date.now();
    const keys = [newIdempotencyKey(), newIdempotencyKey()];
    for (const key of keys) {
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      const ms = parseInt(key.replace(/-/g, '').slice(0, 12), 16);
      expect(ms).toBeGreaterThanOrEqual(before);
      expect(ms).toBeLessThanOrEqual(Date.now());
    }
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('times out after ten seconds instead of hanging', async () => {
    jest.useFakeTimers();
    try {
      globalThis.fetch = jest.fn(
        (_url: unknown, init?: { signal?: AbortSignal }) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      ) as unknown as typeof fetch;
      process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test';
      const pending = failureOf(client().api.bootstrap());
      await jest.advanceTimersByTimeAsync(10_000);
      expect(((await pending) as ApiError).failure).toEqual({ kind: 'timeout' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('ends the session only for a SESSION_* 401 on a request that carried the bearer', async () => {
    const fake = installFakeApi();
    fake.on('GET /v1/bootstrap', () => problem(401, 'SESSION_REVOKED', 'auth'));
    const signedIn = client(GOOD_TOKEN);
    await failureOf(signedIn.api.bootstrap());
    expect(signedIn.onSessionEnded).toHaveBeenCalledTimes(1);
    // Names the credential the request carried, so a late answer cannot end a newer session.
    expect(signedIn.onSessionEnded).toHaveBeenCalledWith(GOOD_TOKEN);

    // A wrong code is a 401 too, and ends nothing.
    fake.on('POST /v1/auth/otp/verify', () => problem(401, 'OTP_INVALID', 'auth'));
    const guest = client(null);
    await failureOf(guest.api.verifyOtp({ phone: '+251911234567', code: '000000' }, 'k'));
    expect(guest.onSessionEnded).not.toHaveBeenCalled();

    // Offline never ends a session.
    fake.on('GET /v1/bootstrap', () => 'offline');
    const offline = client(GOOD_TOKEN);
    await failureOf(offline.api.bootstrap());
    expect(offline.onSessionEnded).not.toHaveBeenCalled();
  });

  it('logs out with the given credential; 204 and 401 both count as signed out', async () => {
    const fake = installFakeApi();
    const { api, onSessionEnded } = client(null);
    await expect(api.logout(GOOD_TOKEN)).resolves.toBeUndefined();
    expect(fake.callsTo('POST /v1/auth/logout')[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
    fake.on('POST /v1/auth/logout', () => problem(401, 'SESSION_REVOKED', 'auth'));
    await expect(api.logout(GOOD_TOKEN)).resolves.toBeUndefined();
    expect(onSessionEnded).not.toHaveBeenCalled();
    fake.on('POST /v1/auth/logout', () => problem(500, 'INTERNAL', 'request'));
    const failure = (await failureOf(api.logout(GOOD_TOKEN))) as ApiError;
    expect(failure.message).not.toContain(GOOD_TOKEN);
  });

  it('refuses a plain-HTTP origin in a release build, so the bearer never travels unencrypted', async () => {
    const fake = installFakeApi();
    const devGlobal = globalThis as unknown as { __DEV__: boolean };
    const dev = devGlobal.__DEV__;
    devGlobal.__DEV__ = false;
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.example.test';
    try {
      await expect(client(GOOD_TOKEN).api.bootstrap()).rejects.toThrow(/https/);
      expect(fake.calls).toHaveLength(0);
    } finally {
      devGlobal.__DEV__ = dev;
    }
  });
});

describe('failure messages', () => {
  it('render from the catalogue by kind and by the server key and slots', () => {
    expect(failureMessage(t, new ApiError({ kind: 'offline' }))).toBe(en['common.offline']);
    expect(failureMessage(t, new ApiError({ kind: 'timeout' }))).toBe(en['common.timeout']);
    const limited = problem(429, 'RATE_LIMITED', 'request', { retry_after_seconds: 30 });
    expect(failureMessage(t, new ApiError({ kind: 'problem', status: 429, problem: limited.body }))).toBe(
      'Too many requests. Try again in 30 seconds.',
    );
  });

  it('fall back to the generic error rather than show a gap or a raw key', () => {
    const unslotted = problem(429, 'RATE_LIMITED', 'request');
    expect(failureMessage(t, new ApiError({ kind: 'problem', status: 429, problem: unslotted.body }))).toBe(
      en['error.request.internal'],
    );
    const foreign = { ...problem(409, 'PUBLICATION_BLOCKED', 'seller').body, title_key: 'console.only.key' };
    expect(failureMessage(t, new ApiError({ kind: 'problem', status: 409, problem: foreign }))).toBe(
      en['error.request.internal'],
    );
    expect(failureMessage(t, new Error('anything'))).toBe(en['error.request.internal']);
  });

  it('reads a Scene and a Product publicly: path values stay one segment, no bearer is sent (WO-005)', async () => {
    const fake = installFakeApi();
    const { api } = client(GOOD_TOKEN);
    fake.on('GET /v1/scene-posts/scene-ref-000000000001', () => ({ status: 200, body: publicScene(1) }));
    fake.on('GET /v1/storefronts/seller-1/products/woven-basket', () => ({
      status: 200,
      body: storefrontProduct('woven-basket', 'Woven basket'),
    }));
    expect((await api.scene('scene-ref-000000000001')).public_ref).toBe('scene-ref-000000000001');
    expect((await api.product('seller-1', 'woven-basket')).slug).toBe('woven-basket');
    for (const call of fake.calls) expect(call.headers.Authorization).toBeUndefined();

    // Whatever a value holds, it cannot add a segment or a query to the path.
    await failureOf(api.scene('../fyp?x=1'));
    expect(fake.calls.at(-1)?.path).toBe('/v1/scene-posts/..%2Ffyp%3Fx%3D1');
  });
});
