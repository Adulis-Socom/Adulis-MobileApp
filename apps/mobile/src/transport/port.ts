// The one choke point between the app and the network (GOV-06 S2). Types and the error class only: nothing here imports a
// fixture or a concrete transport, so a type import can never pull one into a release bundle.
//
// AUTO-R03: the activation seam was `request(operation: string): Promise<unknown>`. Feature code never sees that now:
// every operation is declared in the typed, versioned MobileOps map (contracts/gap-mob-session.ts, PROVISIONAL), and the
// only callers of `json` are the session manager and the domain ports built on it.
import type { MobileOpId, MobileOps, MobileProblemCode, RequestStamp, ServerMessage, Stamped } from '../contracts/gap-mob-session';
import type { UiMessageKey } from '../i18n/messages';

/** A failure the UI can show: a typed code and a catalogue key, never free text from the transport. */
export class TransportError extends Error {
  /** The server-supplied message, when there is one. (`message` is Error's own field and stays the code.) */
  readonly serverMessage: ServerMessage | null;
  readonly retryAt: string | null;
  constructor(
    readonly code: MobileProblemCode,
    options: { readonly message?: ServerMessage | null; readonly retryAt?: string | null } = {},
  ) {
    super(code);
    this.name = 'TransportError';
    this.serverMessage = options.message ?? null;
    this.retryAt = options.retryAt ?? null;
  }
  get messageKey(): UiMessageKey {
    return problemMessageKey(this.code);
  }
}

export function problemMessageKey(code: MobileProblemCode): UiMessageKey {
  switch (code) {
    case 'AUTHENTICATION_REQUIRED':
      return 'error.auth.authentication_required';
    case 'SESSION_EXPIRED':
      return 'mobile.session.ended.expired';
    case 'SESSION_REVOKED':
      return 'mobile.session.ended.revoked';
    case 'PERMISSION_DENIED':
    case 'REFUSED':
      return 'error.rbac.permission_denied';
    case 'VALIDATION_FAILED':
      return 'error.request.validation_failed';
    case 'NOT_FOUND':
      return 'error.request.not_found';
    case 'OTP_INVALID':
      return 'mobile.auth.refused.otp_invalid';
    case 'OTP_EXPIRED':
      return 'mobile.auth.refused.otp_expired';
    case 'RATE_LIMITED':
      return 'mobile.auth.refused.rate_limited';
    case 'NETWORK':
    case 'TIMEOUT':
      return 'mobile.state.offline';
    case 'AUDIENCE_NOT_PERMITTED':
    case 'CONFLICT':
    case 'UNAVAILABLE':
    case 'INTERNAL':
      return 'error.request.internal';
  }
}

/** Taken by the caller at the last moment before sending: the stamp, and the bearer the stamp is still entitled to. */
export interface CallContext {
  readonly stamp: RequestStamp;
  readonly bearer: string | null;
  readonly idempotencyKey?: string;
}

export interface MobileTransport {
  readonly kind: 'live' | 'fixture';
  /** PROVISIONAL (GAP-L2-01): operation ids are placeholders until the owner contract is generated. */
  json<K extends MobileOpId>(op: K, input: MobileOps[K]['in'], ctx: CallContext): Promise<Stamped<MobileOps[K]['out']>>;
}

/** What a development-only fixture contributes to the UI. Null in every release (GOV-06 S1, S3). */
export interface FixtureUi {
  readonly bannerText: string;
}

/**
 * What a development-only fixture contributes to the runtime. Null in every release. A fixture session keeps its
 * credential and device identity in MEMORY only: a development build and a release build share the bundle id, so
 * nothing a fixture mints may ever reach the secure storage a release build would restore from.
 */
export interface FixtureEnvironment {
  readonly deviceId: string;
  /** Bundled demonstration pictures for reserved media refs (the fixture side of the media seam). */
  readonly media: (ref: string) => number | null;
}
