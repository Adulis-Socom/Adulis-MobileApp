import type { ComponentType } from 'react';
import type { OpId, OpInput, OpOutput } from '../contracts/gap-sc';

/**
 * The transport port (GOV-06 S2): the ONE choke point every Console request crosses. `liveTransport` speaks the
 * generated client; the fixture transport is development-only and chosen at build time (select.ts).
 *
 * ProblemCode is a Console-side vocabulary mapped to localisable message keys (problem-message.ts). Codes the
 * replacement API already publishes keep their meaning; OTP_INVALID, OTP_EXPIRED and RATE_LIMITED are PROVISIONAL
 * (RB-B02A-02: the RATE_LIMITED error contract is assigned to SC-BE-02) and UNAVAILABLE/NETWORK are client-side.
 */
export type ProblemCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'NETWORK'
  | 'INTERNAL'
  | 'CONTEXT_MISMATCH'
  | 'REFUSED';

export class TransportError extends Error {
  readonly code: ProblemCode;
  /** Absolute instant the server says to retry after (RATE_LIMITED), never a duration the client invented. */
  readonly retryAt: string | null;
  /** Per-field problem codes for VALIDATION_FAILED, keyed by input field name. */
  readonly fields: Readonly<Record<string, string>>;
  /** Free diagnostic text; never shown to a person. */
  readonly detail: string | null;
  constructor(code: ProblemCode, options: { retryAt?: string; fields?: Record<string, string>; detail?: string } = {}) {
    super(code);
    this.name = 'TransportError';
    this.code = code;
    this.retryAt = options.retryAt ?? null;
    this.fields = options.fields ?? {};
    this.detail = options.detail ?? null;
  }
}

export interface CallContext {
  /** Required for Seller-scoped operations: every Seller request names its Seller (CONSOLE-02 S14). */
  readonly sellerId?: string;
  readonly signal?: AbortSignal;
  /** Minted when the control MOUNTS, not on click: a key minted per tap is exactly the retry the header defeats. */
  readonly idempotencyKey?: string;
}

export interface Transport {
  send<K extends OpId>(op: K, input: OpInput<K>, ctx?: CallContext): Promise<OpOutput<K>>;
}

export function isTransportError(value: unknown): value is TransportError {
  return value instanceof TransportError;
}

/** Anything that is not already a TransportError is an unexpected failure: never shown as an empty result. */
export function asTransportError(value: unknown): TransportError {
  return isTransportError(value) ? value : new TransportError('INTERNAL');
}

/** UI the fixture module contributes. Absent in a release build, which is how the app knows nothing is simulated. */
export interface FixtureUi {
  readonly Banner: ComponentType;
  readonly SignInHelper: ComponentType<{ onPick: (phone: string) => void }>;
}
