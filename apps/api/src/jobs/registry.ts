import type { Job } from './context';
import { E2_JOBS } from './e2-notification';
import { E3_JOBS } from './e3-trust-stock';
import { E4_JOBS } from './e4-retention';
import { E5_JOBS } from './e5-transport-ledger';
import { E6_JOBS } from './e6-billing-nlu';

/**
 * The jobs of ADU-DB-01 S24, in one list, LESS the five retired with the legacy Reservation
 * model and its financial flows (migration 0063, founder pre-launch authorization 2026-11-25):
 * order.expire_sweep, order.close_confirmation_window, buyer_cooldown.decay and
 * subscription.collect_reminder from S24, and the separately ruled payout.activate_due.
 *
 * S24's table IS the specification, so this file is a transcription and the
 * test beside it asserts the set against the document: exactly the names below,
 * exactly as S24 names them, none added and none missing. A job set that
 * drifts from the document is a set where nobody can say what runs.
 *
 * The heartbeat (ADU-CON-02 S20.2) is registered separately by the runtime,
 * because it needs the worker's own identity.
 *
 * NOT HERE, and deliberately: `analytics.retire_partitions` (R19). ADU-CON-02-A1
 * S4.4 builds it "as an ordinary graphile-worker job WHEN TIER 8 LANDS" and
 * needs ~10k sellers plus an R2 Parquet export to be worth anything. Adding
 * it now would be a job that detaches partitions no one has a reader for.
 */
export const S24_JOBS: readonly Job[] = [
  ...E2_JOBS,
  ...E3_JOBS,
  ...E4_JOBS,
  ...E5_JOBS,
  ...E6_JOBS,
];

/**
 * What the worker actually schedules, minus the heartbeat it builds itself.
 */
export const SCHEDULED_JOBS: readonly Job[] = S24_JOBS;

/** S24's names, transcribed from the document's table in its order, less the four retired by 0063. */
export const S24_JOB_NAMES: readonly string[] = [
  'notification.send',
  'notification.morning_reminder',
  'stock.confidence_nudge',
  'level.recompute',
  'financial.purge_payment_evidence',
  'media.lifecycle',
  'subscription.warn',
  'waitlist.retention_purge',
  'nlu.harvest_unmatched',
  'analytics.create_partition',
  'ledger.assert_zero',
  'social_post.availability_check',
  'idempotency.purge_expired',
  'rate_limit.purge_stale',
  'notification.push_seller',
  'device.purge_unbound',
];
