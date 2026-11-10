import {
  APP_POOL_MAX,
  FINANCIAL_POOL_MAX,
  POOL_ACQUIRE_TIMEOUT_DEFAULT_MS,
  createAppPool,
  createFinancialPool,
  isPoolAcquireTimeout,
  poolAcquireTimeoutMs,
} from './database';

/** WO-SEC-001 -- the bounded pool acquisition (OVN-045's defence in depth). */
describe('pool acquire timeout', () => {
  const ENV = 'DB_POOL_ACQUIRE_TIMEOUT_MS';
  const saved = process.env[ENV];
  afterEach(() => {
    if (saved === undefined) delete process.env[ENV];
    else process.env[ENV] = saved;
  });

  it('defaults to 5000 ms when unset or empty', () => {
    expect(POOL_ACQUIRE_TIMEOUT_DEFAULT_MS).toBe(5000);
    expect(poolAcquireTimeoutMs(undefined)).toBe(5000);
    expect(poolAcquireTimeoutMs('')).toBe(5000);
  });

  it.each(['100', '750', '60000'])('accepts %s', (v) => {
    expect(poolAcquireTimeoutMs(v)).toBe(Number(v));
  });

  // 0 is pg's "wait forever": refusing it is the point of the bound.
  it.each(['0', '-1', '99', '60001', '5000.5', '5s', ' 5000', '1e4', 'Infinity'])(
    'refuses %p at boot',
    (v) => {
      expect(() => poolAcquireTimeoutMs(v)).toThrow(/DB_POOL_ACQUIRE_TIMEOUT_MS/);
    },
  );

  it('both pools carry the bound and keep their size', async () => {
    process.env[ENV] = '750';
    const app = createAppPool('postgres://unused@127.0.0.1:1/unused');
    const financial = createFinancialPool('postgres://unused@127.0.0.1:1/unused');
    try {
      expect(app.options.connectionTimeoutMillis).toBe(750);
      expect(app.options.max).toBe(APP_POOL_MAX);
      expect(financial.options.connectionTimeoutMillis).toBe(750);
      expect(financial.options.max).toBe(FINANCIAL_POOL_MAX);
    } finally {
      await app.end();
      await financial.end();
    }
  });

  it('a bad value stops the pool being built at all', () => {
    process.env[ENV] = '0';
    expect(() => createAppPool('postgres://unused@127.0.0.1:1/unused')).toThrow(
      /DB_POOL_ACQUIRE_TIMEOUT_MS/,
    );
  });

  it('recognises the driver timeouts and nothing else', () => {
    expect(isPoolAcquireTimeout(new Error('timeout exceeded when trying to connect'))).toBe(true);
    expect(isPoolAcquireTimeout(new Error('Connection terminated due to connection timeout'))).toBe(
      true,
    );
    expect(isPoolAcquireTimeout(new Error('timeout exceeded'))).toBe(false);
    expect(isPoolAcquireTimeout({ message: 'timeout exceeded when trying to connect' })).toBe(false);
    expect(isPoolAcquireTimeout(undefined)).toBe(false);
  });
});
