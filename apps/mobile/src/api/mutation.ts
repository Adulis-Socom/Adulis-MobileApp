import { ApiError, problemCode, retryAfterMs } from './client';

/**
 * Shared rules for a non-commerce mutation that carries an idempotency key and may be retried. They
 * are opt-in helpers over the API client's failures: nothing here changes how `wasAnswered` or any
 * existing feature decides, and nothing here is used by a payment or order path.
 *
 * The server keeps an idempotency record for 24 hours after the request committed. Within that time
 * a retry with the same key and the same body returns the stored answer instead of running again;
 * a retry after it expired but before it was purged answers 409, and once purged it runs as a new
 * request (a duplicate). So a client may replay a key only while it is surely inside that window.
 */

/**
 * How long a client replays a key: an hour short of the server's 24 hours, counted from the FIRST
 * attempt (the server counts from the commit, which is never earlier). Beyond it a replay can no
 * longer be told from a new request.
 */
export const KEY_SAFE_MS = 23 * 60 * 60 * 1000;

/** Whether an intent that began at `startedAt` (ms) may still be replayed under its key. */
export const keyUsable = (intent: { startedAt: number }, now: number): boolean => now - intent.startedAt < KEY_SAFE_MS;

/**
 * The key was already used for something the server cannot match to this attempt: a same-body retry
 * whose record expired (409 IDEMPOTENCY_KEY_REUSED), or a different body. The first attempt may well
 * be stored, so this is never "not sent".
 */
export const keyConflict = (failure: unknown): boolean => problemCode(failure) === 'IDEMPOTENCY_KEY_REUSED';

/**
 * How long the server or an intermediary asked the client to wait, for the two statuses where that is
 * the contract (429 and 503); null for anything else, whatever header it carries.
 */
export function waitBeforeRetryMs(failure: unknown): number | null {
  if (!(failure instanceof ApiError)) return null;
  const f = failure.failure;
  if (!((f.kind === 'problem' || f.kind === 'unexpected') && (f.status === 429 || f.status === 503))) return null;
  const ms = retryAfterMs(failure);
  // A wait of zero seconds is no wait.
  return ms !== null && ms > 0 ? ms : null;
}
