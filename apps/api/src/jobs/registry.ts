import type { Job } from './context';
import { E1_JOBS } from './e1-clock';
import { E2_JOBS } from './e2-notification';
import { E3_JOBS } from './e3-trust-stock';
import { E4_JOBS } from './e4-retention';
import { E5_JOBS } from './e5-transport-ledger';
import { E6_JOBS } from './e6-billing-nlu';
import { payoutActivateDue } from './e5-transport-ledger';

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

/**
 * JOBS A DOCUMENT OTHER THAN ADU-DB-01 S24 REQUIRES.
 *
 * S24_JOBS above is a TRANSCRIPTION and its test asserts it both ways, so a
 * job from another document cannot live in it without making that assertion
 * meaningless -- which is exactly what happened when payout activation was
 * first added to E5_JOBS: the twenty became twenty-one and the failure read
 * as a broken test rather than as a job filed under the wrong document.
 *
 * The precedent is the heartbeat (ADU-CON-02 S20.2), which has always been
 * registered outside this list. The difference is only that the heartbeat
 * needs the worker's identity and these do not, so these can be named here.
 *
 * Each entry cites the document and section that requires it, and the test
 * beside this file asserts that citation is NOT S24.
 */
export const RULED_JOBS: readonly Job[] = [
  // ADU-AUTH-01 v2.7 S20.1 -- without it the twenty-four hour payout delay
  // means "until the seller next opens the payout screen".
  payoutActivateDue,
];

/**
 * What the worker actually schedules, minus the heartbeat it builds itself.
 */
export const SCHEDULED_JOBS: readonly Job[] = [...S24_JOBS, ...RULED_JOBS];

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
