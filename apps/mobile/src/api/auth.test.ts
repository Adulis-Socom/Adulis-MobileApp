import { revokeCurrentSession } from './auth';

const realFetch = globalThis.fetch;
const answer = (status: number) => {
  globalThis.fetch = jest.fn(async () => ({ status }) as Response) as unknown as typeof fetch;
};

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test';
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('revokeCurrentSession (POST /v1/auth/logout)', () => {
  it('accepts 204, and 401 (already signed out)', async () => {
    answer(204);
    await expect(revokeCurrentSession('secret-token')).resolves.toBeUndefined();
    answer(401);
    await expect(revokeCurrentSession('secret-token')).resolves.toBeUndefined();
  });

  it('reports any other answer by status, never by credential', async () => {
    answer(500);
    const failure = revokeCurrentSession('secret-token');
    await expect(failure).rejects.toThrow('sign-out answered 500');
    await expect(failure).rejects.not.toThrow(/secret-token/);
  });
});

describe('revoke timeout', () => {
  it('gives up after ten seconds instead of hanging on a stalled network', async () => {
    jest.useFakeTimers();
    globalThis.fetch = jest.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ) as unknown as typeof fetch;
    try {
      const pending = revokeCurrentSession('secret-token');
      jest.advanceTimersByTime(10_000);
      await expect(pending).rejects.toThrow('aborted');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('apiOrigin in a release build', () => {
  it('refuses a plain-HTTP origin, so the bearer never travels unencrypted', async () => {
    const devGlobal = globalThis as unknown as { __DEV__: boolean };
    const dev = devGlobal.__DEV__;
    devGlobal.__DEV__ = false;
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.example.test';
    answer(204);
    try {
      await expect(revokeCurrentSession('secret-token')).rejects.toThrow(/https/);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      devGlobal.__DEV__ = dev;
      process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test';
    }
  });
});
