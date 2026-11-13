import { DISPOSABLE_MARKER, MarkerReader, assertDisposable, resolveTarget } from './db-target';

// WO-INFRA-012: the refusals of test/db-target.ts, which global-setup.ts runs before every suite.
const url = (user: string, host = '127.0.0.1', port = '55432', db = 'adulis', q = '') =>
  `postgres://${user}:fake@${host}:${port}/${db}${q}`;
const env = (over: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({
  DATABASE_URL: url('adulis_app'),
  DATABASE_URL_MIGRATE: url('adulis_bootstrap'),
  ...over,
});
const reader = (row: { db?: string; marker?: string | null } | undefined) => (): MarkerReader => ({
  connect: async () => undefined,
  query: async () => ({ rows: row ? [row] : [] }),
  end: async () => undefined,
});
// A different answer per URL: `pick` sees the URL each connection is opened with.
const readerBy =
  (pick: (u: string) => { db?: string; marker?: string | null }) =>
  (u: string): MarkerReader => ({
    connect: async () => undefined,
    query: async () => ({ rows: [pick(u)] }),
    end: async () => undefined,
  });

describe('db-target: decided before connecting', () => {
  it('accepts one loopback database named by every URL', () => {
    expect(resolveTarget(env({ DATABASE_URL_JOBS: url('adulis_jobs') }))).toEqual({
      host: '127.0.0.1',
      port: '55432',
      database: 'adulis',
    });
  });

  it.each([
    [
      'DATABASE_URL unset (no fallback to libpq defaults)',
      { DATABASE_URL: undefined },
      /DATABASE_URL is not set/,
    ],
    [
      'DATABASE_URL_MIGRATE unset',
      { DATABASE_URL_MIGRATE: undefined },
      /DATABASE_URL_MIGRATE is not set/,
    ],
    [
      'a staging host',
      { DATABASE_URL: url('adulis_app', 'adulis-staging-db.internal') },
      /only a loopback database/,
    ],
    [
      'a production host',
      { DATABASE_URL_MIGRATE: url('x', 'dpg-prod.frankfurt-postgres.render.com', '5432') },
      /only a loopback/,
    ],
    ['NODE_ENV=production', { NODE_ENV: 'production' }, /NODE_ENV is production/],
    ['NODE_ENV=staging', { NODE_ENV: 'staging' }, /NODE_ENV is staging/],
    [
      'a query-string host override',
      { DATABASE_URL: url('adulis_app', '127.0.0.1', '55432', 'adulis', '?host=db.example.com') },
      /overrides its target/,
    ],
    [
      'two different databases',
      { DATABASE_URL_MIGRATE: url('adulis_bootstrap', '127.0.0.1', '5434') },
      /name different databases/,
    ],
    [
      'a jobs URL elsewhere',
      { DATABASE_URL_JOBS: url('adulis_jobs', '127.0.0.1', '55432', 'adulis_dev') },
      /name different databases/,
    ],
    ['not a URL', { DATABASE_URL: 'adulis' }, /is not a URL/],
    [
      'a URL without a port (pg would take PGPORT, another server)',
      { DATABASE_URL: 'postgres://adulis_app:fake@127.0.0.1/adulis' },
      /has no explicit port/,
    ],
    [
      'localhost beside 127.0.0.1 (they can reach different servers)',
      { DATABASE_URL: url('adulis_app', 'localhost') },
      /name different databases/,
    ],
    [
      'an empty DATABASE_URL_JOBS (libpq defaults)',
      { DATABASE_URL_JOBS: '' },
      /DATABASE_URL_JOBS is empty/,
    ],
  ])('refuses %s', (_name, over, message) => {
    expect(() => resolveTarget(env(over))).toThrow(message);
  });
});

describe('db-target: the marker', () => {
  it('refuses a database without the marker, as the development database is', async () => {
    await expect(assertDisposable(env(), reader({ db: 'adulis', marker: null }))).rejects.toThrow(
      /not marked disposable/,
    );
  });

  it('refuses a similar but different comment', async () => {
    await expect(
      assertDisposable(env(), reader({ db: 'adulis', marker: `${DISPOSABLE_MARKER} (old)` })),
    ).rejects.toThrow(/not marked disposable/);
  });

  it('refuses when the connection lands on another database', async () => {
    await expect(
      assertDisposable(env(), reader({ db: 'postgres', marker: DISPOSABLE_MARKER })),
    ).rejects.toThrow(/connected to postgres/);
    await expect(assertDisposable(env(), reader(undefined))).rejects.toThrow(
      /connected to nothing/,
    );
  });

  it('reads the mark through every URL: one reaching an unmarked database refuses', async () => {
    const appUnmarked = readerBy((u) =>
      u.includes('adulis_app')
        ? { db: 'adulis', marker: null }
        : { db: 'adulis', marker: DISPOSABLE_MARKER },
    );
    await expect(assertDisposable(env(), appUnmarked)).rejects.toThrow(
      /DATABASE_URL reaches a database not marked disposable/,
    );
  });

  it('accepts the marked database', async () => {
    await expect(
      assertDisposable(env(), reader({ db: 'adulis', marker: DISPOSABLE_MARKER })),
    ).resolves.toMatchObject({
      database: 'adulis',
    });
  });
});

describe('db-target: against the real server this run uses', () => {
  it('this run passed the check (global-setup ran it), and the same check passes here', async () => {
    await expect(assertDisposable()).resolves.toBeDefined();
  });

  it("refuses the same server's unmarked maintenance database", async () => {
    const swap = (raw: string | undefined) => {
      const u = new URL(raw!);
      u.pathname = '/postgres';
      return u.toString();
    };
    const other: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: swap(process.env['DATABASE_URL']),
      DATABASE_URL_MIGRATE: swap(process.env['DATABASE_URL_MIGRATE']),
    };
    delete other['DATABASE_URL_JOBS'];
    await expect(assertDisposable(other)).rejects.toThrow(/not marked disposable/);
  });
});
