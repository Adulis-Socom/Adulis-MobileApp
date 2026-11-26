import type { DestinationKey, OpId, OpInput, OpOutput } from '../contracts/gap-sc';
import { TransportError, type CallContext } from '../transport/port';

/**
 * Shared helpers for the fixture domain modules (catalogue, content, store). DEVELOPMENT ONLY, reached only through the
 * fixtures door (src/transport/select.ts). A module is a server-like resolver: it enforces what the real backend would
 * (permission, ownership, concurrency, publication rules) so the Console is exercised against realistic answers. It proves
 * nothing about real authorization (GOV-06).
 */
export interface Authz {
  readonly sellerId: string;
  readonly sellerName: string;
  readonly caps: ReadonlySet<string>;
  /** Whether the destination is both permitted and entitled for this account on this Seller. */
  readonly reach: (dest: DestinationKey) => boolean;
}

export interface SellerFlags {
  readonly name: string;
  readonly product: boolean;
  readonly store: boolean;
  readonly fulfilment: boolean;
}

export interface Kit {
  now(): number;
  iso(ms: number): string;
  authz(ctx: CallContext): Authz;
  /** A fresh synthetic id with the reserved fixture prefix. */
  next(prefix: string): string;
  /** Seed flags of the Seller, so the readiness derived from this data starts as the earlier fixture world did. */
  flags(sellerId: string): SellerFlags;
}

export type Handlers<K extends OpId> = { [P in K]: (input: OpInput<P>, ctx: CallContext) => OpOutput<P> };

export const denied = (): TransportError => new TransportError('PERMISSION_DENIED');
export const conflict = (): TransportError => new TransportError('CONFLICT');
export const notFound = (): TransportError => new TransportError('NOT_FOUND');
export const invalid = (fields: Record<string, string>): TransportError => new TransportError('VALIDATION_FAILED', { fields });

export function need(a: Authz, dest: DestinationKey): void {
  if (!a.reach(dest)) throw denied();
}
export function needCap(a: Authz, capability: string): void {
  if (!a.caps.has(capability)) throw denied();
}

/** Idempotency (CATINV S120): the same key returns the first answer and runs nothing again. */
export function replayable<T>(cache: Map<string, T>, ctx: CallContext, run: () => T): T {
  const key = ctx.idempotencyKey;
  if (key) {
    const prior = cache.get(key);
    if (prior) return prior;
  }
  const result = run();
  if (key) cache.set(key, result);
  return result;
}

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
