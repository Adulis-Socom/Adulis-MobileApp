import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import pino from 'pino';
import type { Database } from '../src/common/db/database.types';
import type { JobContext } from '../src/jobs/context';
import { FixedClock } from '../src/jobs/clock';
import { FakeFinancialStorageAdapter } from '../src/modules/financial/financial-storage.adapter';
import { FakeMediaStorageAdapter } from '../src/modules/catalogue/media-storage.adapter';
import { FakeSmsAdapter } from '../src/modules/auth/sms.adapter';
import { FakeSocialPlatformAdapter } from '../src/modules/onboarding/social-platform.adapter';
import { FakePushAdapter } from '../src/jobs/push.adapter';

/**
 * The job-test harness. Jobs are plain functions over a JobContext, so a test
 * builds one and calls `job.run(ctx)` — graphile-worker is a scheduler and
 * has no business in a behaviour test.
 *
 * The pool connects as **adulis_jobs**, not as the admin role. That is the
 * whole point: T4's first finding was a missing schema grant that only
 * appears when the real role runs the real statement, and a test on an admin
 * connection would have certified it green.
 */

export interface Harness {
  readonly ctx: JobContext;
  /** The concrete fakes, so a test can drive the degradation paths. */
  readonly social: FakeSocialPlatformAdapter;
  readonly clock: FixedClock;
  readonly evidenceStorage: FakeFinancialStorageAdapter;
  readonly mediaStorage: FakeMediaStorageAdapter;
  readonly sms: FakeSmsAdapter;
  readonly push: FakePushAdapter;
  close(): Promise<void>;
}

export function createJobHarness(at: Date): Harness {
  const connectionString =
    process.env['DATABASE_URL_JOBS'] ??
    // Fail loudly rather than quietly testing as the wrong role.
    (() => {
      throw new Error(
        'DATABASE_URL_JOBS is not set. Job tests MUST run as adulis_jobs — ' +
          'running them as the admin role proves nothing about the grants.',
      );
    })();

  const pool = new Pool({ connectionString, max: 4 });
  const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
  const clock = new FixedClock(at);
  const evidenceStorage = new FakeFinancialStorageAdapter();
  const mediaStorage = new FakeMediaStorageAdapter();
  const sms = new FakeSmsAdapter();
  const push = new FakePushAdapter();
  const social = new FakeSocialPlatformAdapter();
  const log = pino({ level: 'silent' });

  const ctx: JobContext = {
    db,
    clock,
    log,
    evidenceStorage,
    mediaStorage,
    sms,
    push,
    social,
  };

  return {
    ctx,
    clock,
    evidenceStorage,
    mediaStorage,
    sms,
    push,
    social,
    close: () => db.destroy(),
  };
}
