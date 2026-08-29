/**
 * lib/states.ts -- the twelve UI states, ADU-CON-03 v1.1 S3, verbatim keys.
 *
 * THE SET IS CLOSED (S3, line 111): a screen needing a state not on this
 * list has found a contract gap -- report it, do not extend this union.
 *
 * S3.1's invariant travels with the type: the console computes no business
 * state. A countdown may DISPLAY a server-supplied deadline; it may not
 * DECIDE anything when it reaches zero -- it refetches.
 */

export const UI_STATES = [
  'LOADING',            // first fetch, no cached data: layout-shaped skeleton, never a spinner on blank
  'EMPTY',              // request succeeded, zero rows -- MANDATORY on every list (S3.2)
  'READY',              // data present: the screen
  'STALE',              // refetching with data on screen: data stays interactive, quiet indicator only
  'BLOCKED_READINESS',  // a readiness item unsatisfied: what is missing + the one control that fixes it
  'NO_PERMISSION',      // role does not grant it: NOTHING RENDERS (S3.4) -- not a disabled control
  'NO_ENTITLEMENT',     // tier/level excludes it: visible and DISABLED, with what unlocks it (S3.5)
  'CONFLICT',           // 409: the server's message_key + slots, and the state the object is in
  'VALIDATION',         // 400/422: per-field messages AND a summary list linking to each field
  'TERMINAL',           // the object's lifecycle has ended: history, no actions
  'TRANSPORT_ERROR',    // network or 5xx: retry, plus the request id for support (S4.6)
  'UPGRADE_REQUIRED',   // client below the /v1/bootstrap floor: reload prompt, no other content
] as const;

export type UiState = (typeof UI_STATES)[number];

/** The problem-details envelope every non-2xx carries (ADU-API-01 S7). */
export interface AdulisProblem {
  readonly type: string;
  readonly title_key: string;
  readonly status: number;
  readonly code: string;
  readonly request_id: string;
  readonly retryable: boolean;
  readonly slots?: Record<string, unknown>;
  readonly items?: ReadonlyArray<{
    readonly code: string;
    readonly message_key: string;
    readonly slots?: Record<string, unknown>;
    readonly resolving_action?: { readonly kind: string };
  }>;
}

/**
 * Map a request outcome onto the closed vocabulary. Kept total and dumb on
 * purpose: every branch is a transcription of S3's "When" column, and a
 * screen may refine (e.g. EMPTY needs the screen to know it got zero rows;
 * NO_PERMISSION is usually the ABSENCE of a control, decided from
 * allowed_actions, not from an error).
 *
 * NOTE on 429: the state vocabulary defines CONFLICT as "409 from the API",
 * and SC-00 maps rate limiting to CONFLICT ("shows when they may retry",
 * S6). A 429 is therefore rendered through CONFLICT deliberately -- the
 * closed set has no RATE_LIMITED state, and inventing one is exactly what
 * S3 forbids. Recorded in the T7 report as a vocabulary tension.
 */
export function stateFromProblem(p: AdulisProblem): UiState {
  if (p.code === 'CLIENT_UPGRADE_REQUIRED') return 'UPGRADE_REQUIRED';
  if (p.status === 400 || p.status === 422) return 'VALIDATION';
  if (p.status === 409 || p.status === 429) return 'CONFLICT';
  if (p.status >= 500) return 'TRANSPORT_ERROR';
  return 'TRANSPORT_ERROR';
}
