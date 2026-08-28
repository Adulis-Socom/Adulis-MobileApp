import type { Kysely } from 'kysely';
import type { Logger } from 'pino';
import type { Database } from '../common/db/database.types';
import type { Clock } from './clock';
import type { FinancialStorageAdapter } from '../modules/financial/financial-storage.adapter';
import type { MediaStorageAdapter } from '../modules/catalogue/media-storage.adapter';
import type { SmsAdapter } from '../modules/auth/sms.adapter';
import type { SocialPlatformAdapter } from '../modules/onboarding/social-platform.adapter';
import type { PushAdapter } from './push.adapter';

/**
 * What a job is handed. Everything a job depends on arrives here, so a test
 * constructs one and calls the job function directly — graphile-worker is a
 * scheduler, not a thing tests should have to boot.
 *
 * `db` is the adulis_jobs pool. It is a DIFFERENT ROLE from the API's
 * adulis_app, deliberately (ADU-CON-02 S1: two processes, and T4 S1.2: the
 * worker's privileges are its own). Where a job needs a boundary function it
 * calls a definer granted to adulis_jobs by name; it holds no table
 * privilege in `financial` or `verification` at all.
 */
export interface JobContext {
  readonly db: Kysely<Database>;
  readonly clock: Clock;
  readonly log: Logger;
  readonly evidenceStorage: FinancialStorageAdapter;
  readonly mediaStorage: MediaStorageAdapter;
  readonly sms: SmsAdapter;
  readonly push: PushAdapter;
  readonly social: SocialPlatformAdapter;
}

/**
 * What a job reports. Counters only: a job's return value is what the weekly
 * half-hour reads (ADU-CON-02 S20.5), and a job that returns prose cannot be
 * counted or alarmed on.
 */
export type JobResult = Readonly<Record<string, number | string | boolean | null>>;

export interface Job {
  /** The S24 name, verbatim — it is the queue's identifier and the log's. */
  readonly name: string;
  /** graphile-worker cron, or null for a job only ever run by hand/on write. */
  readonly cron: string | null;
  /** One line: what S24 says this does, for the registry listing. */
  readonly cadenceNote: string;
  run(ctx: JobContext): Promise<JobResult>;
}
