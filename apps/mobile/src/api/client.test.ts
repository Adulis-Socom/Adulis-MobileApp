import { en } from '@adulis/locale/mobile';

import { ApiError, createApiClient, isTransient, newIdempotencyKey, parseRetryAfter, retryAfterMs, wasAnswered } from './client';
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

  it('reads a Scene and a Product: path values stay one segment; the session is presented when held (WO-CAT-001)', async () => {
    const fake = installFakeApi();
    const { api } = client(GOOD_TOKEN);
    fake.on('GET /v1/scene-posts/scene-ref-000000000001', () => ({ status: 200, body: publicScene(1) }));
    fake.on('GET /v1/storefronts/seller-1/products/woven-basket', () => ({
      status: 200,
      body: storefrontProduct('woven-basket', 'Woven basket'),
    }));
    expect((await api.scene('scene-ref-000000000001')).public_ref).toBe('scene-ref-000000000001');
    expect((await api.product('seller-1', 'woven-basket')).slug).toBe('woven-basket');
    for (const call of fake.calls) expect(call.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);

    // Whatever a value holds, it cannot add a segment or a query to the path.
    await failureOf(api.scene('../fyp?x=1'));
    expect(fake.calls.at(-1)?.path).toBe('/v1/scene-posts/..%2Ffyp%3Fx%3D1');
    // A dot segment or an empty value is refused before any request is made.
    const before = fake.calls.length;
    for (const [handle, slug] of [['..', 'x'], ['.', 'x'], ['seller-1', ''], ['seller-1', '..']] as const) {
      await expect(api.product(handle, slug)).rejects.toThrow('invalid path parameter');
    }
    await expect(api.scene('')).rejects.toThrow('invalid path parameter');
    expect(fake.calls).toHaveLength(before);
  });
});

describe('retry hints on a failed answer', () => {
  const REF = 'c0000000-0000-4000-8000-000000000001';
  const send = (api: ReturnType<typeof client>['api']) => api.sendMessage(REF, 'Hello', 'k');
  const failureFor = async (reply: Parameters<ReturnType<typeof installFakeApi>['on']>[1]) => {
    installFakeApi().on(`POST /v1/conversations/${REF}/messages`, reply);
    return (await failureOf(send(client(GOOD_TOKEN).api))) as ApiError;
  };

  it('reads Retry-After from the API problem answer, and the header wins over the problem slot', async () => {
    const limited = problem(429, 'RATE_LIMITED', 'request', { retry_after_seconds: 10 });
    const error = await failureFor(() => ({ ...limited, headers: { 'Retry-After': '30' } }));
    expect(error.failure).toMatchObject({ kind: 'problem', status: 429, retryAfterSeconds: 30 });
    expect(retryAfterMs(error)).toBe(30_000);
  });

  it('falls back to the problem slot when no header came', async () => {
    const error = await failureFor(() => problem(429, 'RATE_LIMITED', 'request', { retry_after_seconds: 12 }));
    expect(retryAfterMs(error)).toBe(12_000);
  });

  it('reads Retry-After from a gateway answer that is not the API problem (header only, header name in any case)', async () => {
    const error = await failureFor(() => ({ status: 503, unreadable: true, headers: { 'retry-after': '5' } }));
    expect(error.failure).toEqual({ kind: 'unexpected', status: 503, retryAfterSeconds: 5 });
    expect(retryAfterMs(error)).toBe(5_000);
  });

  it('has no wait when the answer asked for none, and for anything that is not an API failure', async () => {
    const error = await failureFor(() => problem(503, 'INTERNAL', 'request'));
    expect(retryAfterMs(error)).toBeNull();
    expect('retryAfterSeconds' in (error.failure as object)).toBe(false);
    expect(retryAfterMs(new ApiError({ kind: 'offline' }))).toBeNull();
    expect(retryAfterMs(new ApiError({ kind: 'timeout' }))).toBeNull();
    expect(retryAfterMs(new Error('x'))).toBeNull();
  });

  it('parses delta-seconds and an HTTP-date, clamps to an hour, and ignores anything else', () => {
    const now = Date.parse('2026-11-18T10:00:00.000Z');
    expect(parseRetryAfter('0', now)).toBe(0);
    expect(parseRetryAfter(' 45 ', now)).toBe(45);
    expect(parseRetryAfter('999999', now)).toBe(3600);
    expect(parseRetryAfter('Wed, 18 Nov 2026 10:01:30 GMT', now)).toBe(90);
    // A date already past is no wait; a far one is the ceiling.
    expect(parseRetryAfter('Wed, 18 Nov 2026 09:00:00 GMT', now)).toBe(0);
    expect(parseRetryAfter('Fri, 18 Dec 2026 10:00:00 GMT', now)).toBe(3600);
    for (const garbage of [null, '', 'soon', '1.5', '-5', '30s', '1e3', '12 34', 'Wed 18 Nov 2026']) {
      expect(parseRetryAfter(garbage, now)).toBeNull();
    }
    // A run of digits of any length is a wait, clamped to the hour; it is never ignored.
    expect(parseRetryAfter('9999999999', now)).toBe(3600);
    expect(parseRetryAfter('99999999999999', now)).toBe(3600);
    expect(parseRetryAfter('9'.repeat(400), now)).toBe(3600);
    expect(parseRetryAfter('0007', now)).toBe(7);
  });

  it('reads a date only with the real day and month names of an HTTP-date', () => {
    const now = Date.parse('2026-11-18T10:00:00.000Z');
    expect(parseRetryAfter('Wed, 18 Nov 2026 10:01:30 GMT', now)).toBe(90);
    // A loose parser skips a word it does not know and reads the rest: such a value is not a date.
    expect(parseRetryAfter('Foo, 18 Nov 2026 10:01:30 GMT', now)).toBeNull();
    expect(parseRetryAfter('wed, 18 nov 2026 10:01:30 GMT', now)).toBeNull();
  });

  // A wait written as a date is the server's own time, so it is measured against the Date of the same
  // answer; the device clock decides only when that header is missing or unreadable.
  describe('a Retry-After written as a date', () => {
    const SERVER_NOW = Date.parse('2026-11-18T10:00:00.000Z');
    const inSeconds = (s: number) => new Date(SERVER_NOW + s * 1000).toUTCString();
    async function waitWith(deviceNow: number, headers: Record<string, string>) {
      jest.useFakeTimers({ now: deviceNow });
      try {
        return retryAfterMs(await failureFor(() => ({ status: 503, unreadable: true, headers })));
      } finally {
        jest.useRealTimers();
      }
    }

    it('is 90 seconds with a device clock an hour behind (it used to hold for the whole hour)', async () => {
      const ms = await waitWith(SERVER_NOW - 3600_000, { 'Retry-After': inSeconds(90), Date: inSeconds(0) });
      expect(ms).toBe(90_000);
    });

    it('is 90 seconds with a device clock an hour ahead (it used to be no wait at all)', async () => {
      const ms = await waitWith(SERVER_NOW + 3600_000, { 'Retry-After': inSeconds(90), Date: inSeconds(0) });
      expect(ms).toBe(90_000);
    });

    it('falls back to the device clock when the answer has no usable Date', async () => {
      expect(await waitWith(SERVER_NOW, { 'Retry-After': inSeconds(45) })).toBe(45_000);
      expect(await waitWith(SERVER_NOW, { 'Retry-After': inSeconds(45), Date: 'not a date' })).toBe(45_000);
    });

    // A loose date parser reads "1.5" or a bare number as a day in 2001, so a Date that is not an HTTP-date is
    // ignored exactly as such a Retry-After is, and the device clock decides.
    it.each([
      ['a decimal', '1.5'],
      ['a bare number', '12'],
      ['a bare year', '2026'],
      ['an ISO date', new Date(SERVER_NOW + 3600_000).toISOString()],
      ['a date in the long local form', new Date(SERVER_NOW + 3600_000).toString()],
    ])('ignores a Date that is not an HTTP-date (%s)', async (_name, stamp) => {
      expect(await waitWith(SERVER_NOW, { 'Retry-After': inSeconds(45), Date: stamp })).toBe(
        45_000,
      );
    });

    it('leaves a wait in seconds alone, whatever the clocks say', async () => {
      expect(await waitWith(SERVER_NOW + 3600_000, { 'Retry-After': '30', Date: inSeconds(0) })).toBe(30_000);
    });
  });

  it('never puts the header or the slot in the error message', async () => {
    const limited = problem(429, 'RATE_LIMITED', 'request', { retry_after_seconds: 777 });
    const error = await failureFor(() => ({ ...limited, headers: { 'Retry-After': '888' } }));
    expect(error.message).toBe('api problem 429 RATE_LIMITED');
  });

  it('classifies a lost keyed send as a timeout at ten seconds, never earlier', async () => {
    jest.useFakeTimers();
    try {
      installFakeApi().on(`POST /v1/conversations/${REF}/messages`, () => 'hang');
      const pending = failureOf(send(client(GOOD_TOKEN).api));
      await jest.advanceTimersByTimeAsync(9_999);
      let settled = false;
      void pending.then(() => (settled = true));
      await jest.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      const error = (await pending) as ApiError;
      expect(error.failure).toEqual({ kind: 'timeout' });
      expect(isTransient(error)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
