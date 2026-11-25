import { z } from 'zod';

/**
 * Versioned envelopes (EVT-01 S9 event, S15 job). Runtime validation is mandatory; unexpected fields are
 * rejected (strict objects). Shape validation grants no authority: the registry decides which events exist,
 * and owner modules decide who may emit them.
 */
export const SAFE_ID = z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/);
export const EVENT_TYPE = z.string().max(100).regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
export const CONSUMER_NAME = z.string().regex(/^[a-z][a-z0-9_.-]{0,99}$/);

/** S9 ActorContext: discriminated; anonymous input is never SYSTEM; identities never overload each other. */
export const actorSchema = z.discriminatedUnion('actor_type', [
  z.strictObject({ actor_type: z.literal('ANONYMOUS_PUBLIC'), anonymous_ref: z.string().min(1).max(128) }),
  z.strictObject({ actor_type: z.literal('ORDINARY_ACCOUNT'), ordinary_account_id: z.uuid(), seller_context_id: z.uuid().optional() }),
  z.strictObject({ actor_type: z.literal('OPERATOR_ACCOUNT'), operator_account_id: z.uuid(), seller_context_id: z.uuid().optional() }),
  z.strictObject({ actor_type: z.literal('SYSTEM'), trusted_service_ref: z.string().min(1).max(128) }),
]);
export type ActorContext = z.infer<typeof actorSchema>;

export const eventEnvelopeSchema = z
  .strictObject({
    event_id: z.uuid(),
    event_type: EVENT_TYPE,
    event_version: z.int().min(1),
    scope: z.enum(['GLOBAL', 'MARKET']),
    market_id: z.uuid().optional(),
    originating_market_id: z.uuid().optional(),
    occurred_at: z.iso.datetime({ offset: true }),
    aggregate_type: z.string().min(1).max(100),
    aggregate_id: z.string().min(1).max(200),
    aggregate_revision: z.int().min(0),
    logical_effect_id: z.string().min(1).max(200),
    actor: actorSchema,
    request_id: SAFE_ID.optional(),
    correlation_id: SAFE_ID,
    causation_id: SAFE_ID.optional(),
    policy_version: z.string().min(1).max(64).optional(),
    payload: z.record(z.string(), z.unknown()),
  })
  .superRefine((e, ctx) => {
    // S9: MARKET facts need a resource-derived market; GLOBAL facts never fabricate one.
    if ((e.scope === 'MARKET') !== (e.market_id !== undefined)) ctx.addIssue({ code: 'custom', path: ['market_id'], message: 'market_id iff scope is MARKET' });
    if (e.scope === 'MARKET' && e.originating_market_id !== undefined) ctx.addIssue({ code: 'custom', path: ['originating_market_id'], message: 'GLOBAL only' });
  });
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

/**
 * S15 job envelope. For an event delivery it carries the source_event_id, NOT the event payload: the worker
 * re-reads the fact from PostgreSQL, so Valkey never holds domain data (S31 data minimisation).
 */
export const jobEnvelopeSchema = z.strictObject({
  logical_job_id: z.string().min(1).max(200),
  job_type: CONSUMER_NAME,
  job_version: z.int().min(1),
  market_id: z.uuid().optional(),
  priority_class: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']),
  criticality: z.enum(['CRITICAL', 'IMPORTANT', 'BEST_EFFORT']),
  run_at: z.iso.datetime({ offset: true }).optional(),
  correlation_id: SAFE_ID,
  causation_id: SAFE_ID.optional(),
  source_event_id: z.uuid().optional(),
  aggregate_type: z.string().min(1).max(100).optional(),
  aggregate_id: z.string().min(1).max(200).optional(),
  actor_context: actorSchema,
  payload: z.record(z.string(), z.unknown()),
});
export type JobEnvelope = z.infer<typeof jobEnvelopeSchema>;
