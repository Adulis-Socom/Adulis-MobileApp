import type { Job } from './context';
import { E1_JOBS } from './e1-clock';
import { E2_JOBS } from './e2-notification';
import { E3_JOBS } from './e3-trust-stock';
import { E4_JOBS } from './e4-retention';
import { E5_JOBS } from './e5-transport-ledger';
import { E6_JOBS } from './e6-billing-nlu';

/**
 * The twenty jobs of ADU-DB-01 S24, in one list.
 *
 * S24's table IS the specification, so this file is a transcription and the
 * test beside it asserts the set against the document: exactly twenty, named
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
  ...E1_JOBS,
  ...E2_JOBS,
  ...E3_JOBS,
  ...E4_JOBS,
  ...E5_JOBS,
  ...E6_JOBS,
];

/** S24's twenty names, transcribed from the document's table, in its order. */
export const S24_JOB_NAMES: readonly string[] = [
  'order.expire_sweep',
  'notification.send',
  'notification.morning_reminder',
  'stock.confidence_nudge',
  'level.recompute',
  'financial.purge_payment_evidence',
  'media.lifecycle',
  'subscription.warn',
  'subscription.collect_reminder',
  'waitlist.retention_purge',
  'nlu.harvest_unmatched',
  'analytics.create_partition',
  'ledger.assert_zero',
  'social_post.availability_check',
  'buyer_cooldown.decay',
  'idempotency.purge_expired',
  'rate_limit.purge_stale',
  'order.close_confirmation_window',
  'notification.push_seller',
  'device.purge_unbound',
];
