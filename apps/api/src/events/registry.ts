import type { z } from 'zod';
import type { Tx } from '../db/client';
import type { eventOutbox } from '../db/schema';

export type StoredEvent = typeof eventOutbox.$inferSelect;

/** One registered (event_type, event_version): EVT-01 S9 and S13. */
export interface EventDefinition {
  readonly type: string;
  readonly version: number;
  readonly scopes: readonly ('GLOBAL' | 'MARKET')[];
  readonly payload: z.ZodType<Record<string, unknown>>;
}

/** One registered consumer of one event version: EVT-01 S15, S17, S21. */
export interface ConsumerDefinition {
  readonly name: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly jobVersion: number;
  readonly priorityClass: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  readonly criticality: 'CRITICAL' | 'IMPORTANT' | 'BEST_EFFORT';
  readonly attempts: number;
  /** Applies the consequence inside the transaction that also writes the processed-event marker. */
  handle(tx: Tx, event: StoredEvent): Promise<'SUCCEEDED' | 'SKIPPED'>;
}

const key = (type: string, version: number): string => `${type}@${version}`;

export class EventRegistry {
  private readonly events = new Map<string, EventDefinition>();
  private readonly consumers = new Map<string, ConsumerDefinition>();

  constructor(events: readonly EventDefinition[], consumers: readonly ConsumerDefinition[]) {
    for (const e of events) {
      if (this.events.has(key(e.type, e.version))) throw new Error(`event ${key(e.type, e.version)} registered twice`);
      this.events.set(key(e.type, e.version), e);
    }
    for (const c of consumers) {
      if (this.consumers.has(c.name)) throw new Error(`consumer ${c.name} registered twice`);
      if (!this.events.has(key(c.eventType, c.eventVersion))) throw new Error(`consumer ${c.name} consumes unregistered ${key(c.eventType, c.eventVersion)}`);
      if (!Number.isInteger(c.attempts) || c.attempts < 1 || c.attempts > 25) throw new Error(`consumer ${c.name}: attempts must be 1-25`);
      this.consumers.set(c.name, c);
    }
  }

  event(type: string, version: number): EventDefinition | undefined {
    return this.events.get(key(type, version));
  }

  consumer(name: string): ConsumerDefinition | undefined {
    return this.consumers.get(name);
  }

  consumersOf(type: string, version: number): ConsumerDefinition[] {
    return [...this.consumers.values()].filter((c) => c.eventType === type && c.eventVersion === version);
  }
}

/**
 * The PRODUCTION registry is deliberately EMPTY at foundation (ARC-BE-04). RBL-04-EVENT-REGISTER.csv's 64
 * ACTIVE rows are approved build scope, not instructions to activate: each event and consumer is added by its
 * owner work order. DORMANT financial events are never added here; Story events belong to SC-BE-05S.
 */
export const PRODUCTION_EVENTS: readonly EventDefinition[] = [];
export const PRODUCTION_CONSUMERS: readonly ConsumerDefinition[] = [];
