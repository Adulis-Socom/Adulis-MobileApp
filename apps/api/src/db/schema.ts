import { bigint, boolean, integer, jsonb, pgSchema, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * The replacement lineage's ONLY tables at foundation (ARC-BE-03/04): the eventing platform of EVT-01 S10-S13
 * and S22. No domain table exists until its own work order. The DDL, constraints, triggers and grants are the
 * reviewed SQL in db/migrations; this file is the typed access to it, and test/lineage.int.ts
 * proves the two agree column for column.
 */
export const platform = pgSchema('platform');

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const ACTOR_TYPES = ['ANONYMOUS_PUBLIC', 'ORDINARY_ACCOUNT', 'OPERATOR_ACCOUNT', 'SYSTEM'] as const;
export const DELIVERY_STATES = ['PENDING', 'ENQUEUE_UNKNOWN', 'QUEUED', 'PROCESSING', 'SUCCEEDED', 'SKIPPED', 'DEAD_LETTERED'] as const;
/** Not yet resolved. SUCCEEDED, SKIPPED and DEAD_LETTERED are terminal: nothing automatic ever reopens them. */
export const UNFINISHED_STATES = ['PENDING', 'ENQUEUE_UNKNOWN', 'QUEUED', 'PROCESSING'] as const;
export const FAILURE_CLASSES = [
  'TRANSIENT', 'RATE_LIMIT', 'DEPENDENCY_UNAVAILABLE', 'PERMANENT_VALIDATION', 'STATE_CONFLICT', 'POISON_PAYLOAD', 'SECURITY_FAILURE', 'UNSUPPORTED_VERSION',
] as const;

export const eventOutbox = platform.table('event_outbox', {
  eventId: uuid('event_id').primaryKey(),
  eventType: text('event_type').notNull(),
  eventVersion: integer('event_version').notNull(),
  scope: text('scope', { enum: ['GLOBAL', 'MARKET'] }).notNull(),
  marketId: uuid('market_id'),
  originatingMarketId: uuid('originating_market_id'),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  aggregateRevision: bigint('aggregate_revision', { mode: 'number' }).notNull(),
  logicalEffectId: text('logical_effect_id').notNull(),
  actorType: text('actor_type', { enum: ACTOR_TYPES }).notNull(),
  ordinaryAccountId: uuid('ordinary_account_id'),
  operatorAccountId: uuid('operator_account_id'),
  anonymousRef: text('anonymous_ref'),
  trustedServiceRef: text('trusted_service_ref'),
  sellerContextId: uuid('seller_context_id'),
  requestId: text('request_id'),
  correlationId: text('correlation_id').notNull(),
  causationId: text('causation_id'),
  policyVersion: text('policy_version'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  occurredAt: ts('occurred_at').notNull(),
  recordedAt: ts('recorded_at').notNull().defaultNow(),
  dispatchedAt: ts('dispatched_at'),
  relayOwner: text('relay_owner'),
  leaseExpiresAt: ts('lease_expires_at'),
});

export const eventDelivery = platform.table(
  'event_delivery',
  {
    eventId: uuid('event_id').notNull().references(() => eventOutbox.eventId),
    consumer: text('consumer').notNull(),
    state: text('state', { enum: DELIVERY_STATES }).notNull().default('PENDING'),
    jobId: text('job_id').notNull().unique(),
    enqueueAttempts: integer('enqueue_attempts').notNull().default(0),
    reconcileAttempts: integer('reconcile_attempts').notNull().default(0),
    lastErrorCode: text('last_error_code'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.consumer] })],
);

export const processedEvent = platform.table(
  'processed_event',
  {
    consumer: text('consumer').notNull(),
    eventId: uuid('event_id').notNull().references(() => eventOutbox.eventId),
    processedAt: ts('processed_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.consumer, t.eventId] })],
);

export const asyncDeadLetter = platform.table('async_dead_letter', {
  deadLetterId: uuid('dead_letter_id').primaryKey().defaultRandom(),
  logicalJobId: text('logical_job_id').notNull().unique(),
  sourceEventId: uuid('source_event_id').references(() => eventOutbox.eventId),
  consumer: text('consumer').notNull(),
  failureClass: text('failure_class', { enum: FAILURE_CLASSES }).notNull(),
  failureFingerprint: text('failure_fingerprint').notNull(),
  sanitizedSummary: text('sanitized_summary').notNull(),
  attemptCount: integer('attempt_count').notNull(),
  effectMayHaveHappened: boolean('effect_may_have_happened').notNull(),
  replayCount: integer('replay_count').notNull().default(0),
  resolutionStatus: text('resolution_status', { enum: ['UNRESOLVED', 'RESOLVED'] }).notNull().default('UNRESOLVED'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});
