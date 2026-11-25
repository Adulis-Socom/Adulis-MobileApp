import { randomUUID } from 'node:crypto';
import type { Tx } from '../db/client';
import { eventOutbox } from '../db/schema';
import { eventEnvelopeSchema, type EventEnvelope } from './envelope';
import type { EventRegistry } from './registry';

export type NewEvent = Omit<EventEnvelope, 'event_id' | 'occurred_at'> & { occurred_at?: string };

export class UnregisteredEvent extends Error {
  override readonly name = 'UnregisteredEvent';
}

/**
 * EVT-01 S10: the ONLY way a fact leaves its owner. Called inside the owner's transaction, so the canonical
 * mutation and its outbox row commit or roll back together, and nothing here touches Valkey (no dual write).
 * The relay publishes after commit.
 */
export async function appendEvent(tx: Tx, registry: EventRegistry, input: NewEvent): Promise<string> {
  const envelope = eventEnvelopeSchema.parse({ ...input, event_id: randomUUID(), occurred_at: input.occurred_at ?? new Date().toISOString() });
  const def = registry.event(envelope.event_type, envelope.event_version);
  if (!def) throw new UnregisteredEvent(`${envelope.event_type}@${envelope.event_version} is not registered`);
  if (!def.scopes.includes(envelope.scope)) throw new UnregisteredEvent(`${envelope.event_type}@${envelope.event_version} does not allow scope ${envelope.scope}`);
  const payload = def.payload.parse(envelope.payload);
  const a = envelope.actor;

  await tx.insert(eventOutbox).values({
    eventId: envelope.event_id,
    eventType: envelope.event_type,
    eventVersion: envelope.event_version,
    scope: envelope.scope,
    marketId: envelope.market_id ?? null,
    originatingMarketId: envelope.originating_market_id ?? null,
    aggregateType: envelope.aggregate_type,
    aggregateId: envelope.aggregate_id,
    aggregateRevision: envelope.aggregate_revision,
    logicalEffectId: envelope.logical_effect_id,
    actorType: a.actor_type,
    ordinaryAccountId: a.actor_type === 'ORDINARY_ACCOUNT' ? a.ordinary_account_id : null,
    operatorAccountId: a.actor_type === 'OPERATOR_ACCOUNT' ? a.operator_account_id : null,
    anonymousRef: a.actor_type === 'ANONYMOUS_PUBLIC' ? a.anonymous_ref : null,
    trustedServiceRef: a.actor_type === 'SYSTEM' ? a.trusted_service_ref : null,
    sellerContextId: a.actor_type === 'ORDINARY_ACCOUNT' || a.actor_type === 'OPERATOR_ACCOUNT' ? (a.seller_context_id ?? null) : null,
    requestId: envelope.request_id ?? null,
    correlationId: envelope.correlation_id,
    causationId: envelope.causation_id ?? null,
    policyVersion: envelope.policy_version ?? null,
    payload,
    occurredAt: envelope.occurred_at,
  });
  return envelope.event_id;
}
