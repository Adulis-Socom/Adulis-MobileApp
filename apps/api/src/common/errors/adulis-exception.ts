import { ERROR_CATALOGUE, type ErrorCode } from './error-catalogue';

/**
 * ADU-API-01 v1.6 section 7 — ONE envelope: RFC 9457 Problem Details plus
 * `items[]`.
 *
 * INVARIANT — no error body contains rendered prose in any language.
 * `message_key` + typed `slots` only; the client renders from its own
 * catalogue. Slots are typed primitives, never pre-formatted text: money is
 * { amount_minor, currency }, timestamps RFC 3339 UTC, counts integers. The
 * server never formats a number, a date or a currency.
 */
export interface ErrorItem {
  readonly code: string;
  readonly subject?: { readonly kind: string; readonly id: string } | undefined;
  readonly message_key: string;
  readonly slots?: Record<string, unknown> | undefined;
  readonly resolving_action?:
    | { readonly kind: string; readonly [k: string]: unknown }
    | undefined;
}

export interface ProblemEnvelope {
  readonly type: string;
  readonly title_key: string;
  readonly status: number;
  readonly code: ErrorCode;
  readonly request_id: string;
  readonly retryable: boolean;
  readonly slots?: Record<string, unknown> | undefined;
  readonly items?: readonly ErrorItem[] | undefined;
}

interface RaiseOptions {
  readonly slots?: Record<string, unknown> | undefined;
  readonly items?: readonly ErrorItem[] | undefined;
  /** Override the catalogue's default status for this raise site. */
  readonly status?: number | undefined;
  /** Override the catalogue's default retryable for this raise site. */
  readonly retryable?: boolean | undefined;
}

/**
 * The one exception the API raises deliberately. The filter turns it into the
 * envelope; nothing else in the codebase builds an error body.
 */
export class AdulisException extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly slots?: Record<string, unknown> | undefined;
  readonly items?: readonly ErrorItem[] | undefined;

  constructor(code: ErrorCode, opts: RaiseOptions = {}) {
    super(code);
    this.name = 'AdulisException';
    this.code = code;
    this.status = opts.status ?? ERROR_CATALOGUE[code].status;
    this.retryable = opts.retryable ?? ERROR_CATALOGUE[code].retryable;
    this.slots = opts.slots;
    this.items = opts.items;
  }
}

/**
 * ADU-AUTH-01 S21 / S19 — a scope failure is 404 and CARRIES NO DETAIL. No
 * items, no slots naming the object, no hint a permission was involved. An
 * actor with no relationship to a seller must not learn the seller exists.
 */
export function notFound(): AdulisException {
  return new AdulisException('NOT_FOUND');
}
