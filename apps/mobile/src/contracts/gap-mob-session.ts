// PROVISIONAL, GAP-L2-01. Hand-written shapes for the session, device and bootstrap operations, because the generated
// contract holds /livez and /healthz only (GOV-06). Not a final API contract and never a duplicate of a generated DTO:
// the day the owner order publishes the contract these types are replaced by the generated ones.
//
// Nothing here models an OTP provider, a code length, an attempt limit, a token lifetime or an authentication policy.
// Where the client would need one it is an opaque value the server supplies (decision rows in the L2-MOBILE-01 register).

export const CONTRACT = { gap: 'GAP-L2-01', version: 'mob-session-0', provisional: true } as const;

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type Epoch = Brand<number, 'SessionEpoch'>; // 0 = no scope yet
export type AccountRef = Brand<string, 'AccountRef'>; // opaque, SERVER-supplied
export type DeviceId = Brand<string, 'DeviceId'>;
export type MarketRef = Brand<string, 'MarketRef'>; // opaque, SERVER-supplied
export type SellerRef = Brand<string, 'SellerRef'>; // opaque, SERVER-supplied

export const asEpoch = (n: number) => n as Epoch;
export const asAccountRef = (s: string) => s as AccountRef;
export const asDeviceId = (s: string) => s as DeviceId;
export const asMarketRef = (s: string) => s as MarketRef;
export const asSellerRef = (s: string) => s as SellerRef;

/** What the server says to show: a catalogue key plus slots. Never server English. */
export interface ServerMessage {
  readonly key: string;
  readonly slots?: Readonly<Record<string, string | number>>;
}

/** Closed set. There is no OPERATOR member: Operator is a separate identity and never a Mobile mode (AUTH-02 S33). */
export type Mode = 'BUYER' | 'SELLER_COMPANION' | 'COURIER';
export type GatedMode = Exclude<Mode, 'BUYER'>;
export const GATED_MODES: readonly GatedMode[] = ['SELLER_COMPANION', 'COURIER'];

// ---- Session ------------------------------------------------------------------------------------------------------

export type SessionEndReason = 'SIGNED_OUT' | 'EXPIRED' | 'REVOKED' | 'CREDENTIAL_REJECTED' | 'ACCOUNT_DELETED' | 'SWITCHED';

export interface SessionEnd {
  readonly reason: SessionEndReason;
  readonly endedEpoch: Epoch;
  readonly message: ServerMessage | null;
  readonly at: number; // client clock, display ordering only
}

/** The credential is NEVER a member: it lives in secure storage and inside the session manager. */
export type SessionState =
  | { readonly kind: 'RESTORING'; readonly epoch: Epoch }
  | { readonly kind: 'GUEST'; readonly epoch: Epoch; readonly lastEnd: SessionEnd | null }
  | { readonly kind: 'RESTORED_UNCONFIRMED'; readonly epoch: Epoch }
  | { readonly kind: 'AUTHENTICATED'; readonly epoch: Epoch; readonly accountRef: AccountRef; readonly confirmedAt: number };

/** Taken synchronously when a request is CREATED, before any await, and carried to the response. */
export interface RequestStamp {
  readonly epoch: Epoch;
  readonly accountRef: AccountRef | null; // null for GUEST and RESTORED_UNCONFIRMED
  readonly deviceId: DeviceId;
}

export class SessionChanged extends Error {
  constructor() {
    super('SESSION_CHANGED');
    this.name = 'SessionChanged';
  }
}

// ---- Problem vocabulary (PROVISIONAL) -----------------------------------------------------------------------------
// SESSION_EXPIRED and SESSION_REVOKED are NOT in the authoritative clean error catalogue yet (register ISS-003): they are
// frontend outcomes only, and no shared backend error definition is edited here.

export type MobileProblemCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'PERMISSION_DENIED'
  | 'AUDIENCE_NOT_PERMITTED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'RATE_LIMITED'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAVAILABLE'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'INTERNAL'
  | 'REFUSED';

// ---- Sign-in flow (memory only) -----------------------------------------------------------------------------------

export type OpaqueHint = Readonly<Record<string, string | number | boolean>>;

export interface CodeChallenge {
  readonly ref: string; // opaque, SERVER-supplied
  readonly destination: string; // exactly what the person typed (trimmed); memory only; never logged
  readonly inputHint: OpaqueHint | null; // any mask or length hint comes from the server, never hard-coded
}

export interface SignInRefusal {
  readonly code: MobileProblemCode;
  readonly message: ServerMessage | null;
  readonly retryAt: string | null; // an absolute instant the SERVER names, never a duration the client invented
}

export interface VerifyInput {
  readonly challenge: CodeChallenge;
  readonly code: string; // as typed; the client does not validate its shape
  readonly intentKey: string; // one per user intent, kept across retries
}

export type RequestCodeOutcome =
  | { readonly kind: 'SENT'; readonly challenge: CodeChallenge }
  | { readonly kind: 'REFUSED'; readonly refusal: SignInRefusal }
  | { readonly kind: 'STALE' }; // an answer for a session that no longer exists is discarded

export type VerifyOutcome =
  | { readonly kind: 'SIGNED_IN'; readonly accountRef: AccountRef }
  | { readonly kind: 'REFUSED'; readonly refusal: SignInRefusal }
  | { readonly kind: 'STALE' }
  | { readonly kind: 'REJECTED_FOR_SURFACE' }; // the response was not an ordinary MOBILE principal; nothing stored

/** The audience and principal values the client ASSERTS (never interprets further). Decision D-EG-04. */
export const MOBILE_AUDIENCE = 'MOBILE';
export const ORDINARY_PRINCIPAL = 'ACCOUNT';

// ---- Device, Market, eligibility ----------------------------------------------------------------------------------

export type DeviceRegistration =
  | { readonly kind: 'UNREGISTERED' }
  | { readonly kind: 'REGISTERING' }
  | { readonly kind: 'REGISTERED' }
  | { readonly kind: 'REFUSED'; readonly message: ServerMessage | null };

export type NetworkState = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface DeviceContext {
  readonly deviceId: DeviceId;
  readonly platform: 'android' | 'ios';
  readonly registration: DeviceRegistration;
  readonly network: NetworkState; // observed from the OS, never persisted
}

/** The BACKEND resolves the Market. The client never reads its own proposals back as truth. */
export type MarketContext =
  | { readonly status: 'UNRESOLVED' }
  | { readonly status: 'RESOLVED'; readonly marketRef: MarketRef; readonly resolvedAt: number };

export type ModeAvailability =
  | { readonly status: 'AVAILABLE' }
  | { readonly status: 'NOT_ELIGIBLE' }
  | { readonly status: 'PENDING'; readonly message: ServerMessage | null }
  | { readonly status: 'REVOKED'; readonly message: ServerMessage | null }
  | { readonly status: 'RESTRICTED'; readonly message: ServerMessage };

/** Shape owned by the backend; opaque to UI code. Parsed once, in adoptEligibility. */
export type ModeEligibilityWire = Readonly<Record<string, unknown>>;

export interface ModeEligibility {
  readonly source: 'SERVER';
  readonly accountRef: AccountRef;
  readonly epoch: Epoch;
  readonly resolvedAt: number;
  readonly modes: Readonly<Record<Mode, ModeAvailability>>; // BUYER is always AVAILABLE for an Account
}

// ---- Version floor ------------------------------------------------------------------------------------------------

export interface UpgradeRequired {
  readonly status: 'UPGRADE_REQUIRED';
  readonly message: ServerMessage | null;
  readonly storeLink: { readonly href: string } | null; // null until a store listing exists; never invented
}
export type ClientVerdict =
  | { readonly status: 'OK' }
  | { readonly status: 'UPGRADE_RECOMMENDED'; readonly message: ServerMessage | null }
  | UpgradeRequired;

// ---- Operations (the typed, versioned port) -----------------------------------------------------------------------

export type Empty = Readonly<Record<string, never>>;

export interface BootstrapView {
  readonly serverTime: string; // ISO 8601 UTC instant, SERVER
  readonly client: ClientVerdict;
  readonly market: MarketContext;
  readonly account: null | { readonly accountRef: AccountRef; readonly eligibility: ModeEligibilityWire };
}

export interface VerifyWire {
  readonly accountRef: AccountRef;
  readonly credential: string; // opaque; how it is delivered (body or header) is an owner decision
  readonly audience: string;
  readonly principalKind: string;
}

export interface MobileOps {
  'device.register': { in: { deviceId: DeviceId; platform: 'android' | 'ios' }; out: Empty };
  'bootstrap.get': { in: Empty; out: BootstrapView };
  'session.requestCode': { in: { destination: string }; out: { challengeRef: string; inputHint: OpaqueHint | null } };
  'session.verifyCode': { in: { challengeRef: string; code: string; intentKey: string }; out: VerifyWire };
  'session.signOut': { in: Empty; out: Empty };
}
export type MobileOpId = keyof MobileOps;

export interface Stamped<T> {
  readonly value: T;
  readonly stamp: RequestStamp;
}
