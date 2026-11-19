import type { CartSet, LineId, VariantId } from './model';

export type Provenance = 'SERVER' | 'FIXTURE';

/** What a read returned, and when it arrived (the client's clock, for staleness only). */
export type Verified<T> = Readonly<{ value: T; receivedAt: number; provenance: Provenance }>;

/**
 * The session scope a port is bound to. Only the commerce runtime makes one. It stops being current when
 * the commerce provider next renders the changed session (sign-in, sign-out, another Account), which is
 * one render after the session's own credential changes. A port bound to it must then refuse to send and
 * refuse to return an answer; a request already on the wire needs the port's own check at send time.
 */
export type Scope = Readonly<{ kind: 'guest' | 'account'; epoch: number; isCurrent(): boolean }>;

export type AddRequest = Readonly<{ variantId: VariantId; quantity: number; idempotencyKey: string }>;
/** The server's acknowledgement. It is never drawn: the carts are read again. */
export type AddAccepted = Readonly<{ lineId: LineId }>;

/**
 * Both methods REJECT: with an ApiError (the class the client throws), with ScopeChanged, or with
 * AdapterUnavailable. They never resolve with a failure value, so the one classification of failures
 * the app already has is the only one.
 */
export interface CartPort {
  /** Every Seller cart of this scope, revalidated by the server. */
  getCarts(): Promise<Verified<CartSet>>;
  /** Idempotent by key. The request names no Seller: the server derives it from the Variant. */
  addLine(request: AddRequest): Promise<AddAccepted>;
}

export type UnavailableReason = 'ADAPTER_DISABLED' | 'CONTRACT_MISSING';

export type Availability =
  | Readonly<{ available: true }>
  | Readonly<{ available: false; reason: UnavailableReason }>;

export interface CartAdapter {
  /** There is no 'live' mode. */
  readonly mode: 'disabled' | 'fixture';
  /** Null for an adapter that returns nothing. */
  readonly provenance: Provenance | null;
  /** Read BEFORE any call: an unavailable adapter is never called. */
  readonly availability: Availability;
  bind(scope: Scope): CartPort;
}

export class AdapterUnavailable extends Error {
  constructor(readonly reason: UnavailableReason) {
    super(reason);
    this.name = 'AdapterUnavailable';
  }
}

export class ScopeChanged extends Error {
  constructor() {
    super('SCOPE_CHANGED');
    this.name = 'ScopeChanged';
  }
}
