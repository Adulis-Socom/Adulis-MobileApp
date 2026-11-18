import { ApiError } from '../api/client';
import { keyConflict, keyUsable, waitBeforeRetryMs } from '../api/mutation';
import { sendOutcome } from './chat';

/**
 * What the Buyer's conversation screen knows about the message it is sending, and what a failed
 * attempt proves. Buyer only: the store's replies keep the rule in chat.ts (`sendOutcome`).
 *
 * - unsent: text in the box, nothing sent
 * - sending: a request is in flight
 * - sent: the server accepted it with a message id (the message then comes from the server's history)
 * - failed: the API rejected the request itself (a 4xx problem other than a key conflict or a rate
 *   limit); nothing was stored and the intent has ended
 * - unknown: no proof either way (lost connection, timeout, a gateway's page, an unreadable
 *   acceptance, any 5xx, a rate limit, a key conflict). The message may be stored: the text, Product
 *   and key are kept
 */
export type SendStatus = 'unsent' | 'sending' | 'sent' | 'failed' | 'unknown';

export type FailureJudgement = {
  /** `failed` ends the intent (the next send is a new message with a new key); `unknown` keeps it. */
  outcome: 'failed' | 'unknown';
  /**
   * Only when unknown: the same key may be sent again. False after a key conflict, past the key's
   * safe age, or with nothing to replay: the outcome can then no longer be confirmed by the server,
   * and the only way on is an explicit new message.
   */
  replay: boolean;
  /** Milliseconds the server or an intermediary asked to wait before any further attempt (429, 503). */
  holdMs: number | null;
};

/**
 * Judge one failed attempt of a keyed send, at `now`, for the intent that began at `intent.startedAt`.
 *
 * Only the API's own 4xx problem (a validation error, a missing conversation, a permission refusal)
 * proves the request was rejected before anything was stored. A 5xx proves nothing, even with the
 * API's problem body: the server stores the message and its idempotency record in one transaction,
 * and a connection lost at the commit answers 503 although the commit happened. A rate limit (429)
 * and a key conflict (409) are not rejections of the message either, and a key conflict says the key
 * was already used, so the first attempt may be stored. All of those, and everything that is not the
 * API's own answer, leave the outcome unknown: sending the same text again under the SAME key is
 * always safe inside the key's life (stored: the stored answer comes back; not stored: it is
 * processed once). A wait that was asked for holds the next attempt whatever the outcome.
 */
export function judgeFailure(failure: unknown, intent: { startedAt: number } | null, now: number): FailureJudgement {
  const holdMs = waitBeforeRetryMs(failure);
  if (keyConflict(failure)) return { outcome: 'unknown', replay: false, holdMs };
  if (rejectedByApi(failure)) return { outcome: 'failed', replay: false, holdMs };
  return { outcome: 'unknown', replay: intent !== null && keyUsable(intent, now), holdMs };
}

/** The API's own problem answer with a 4xx status other than a conflict (409) or a rate limit (429). */
function rejectedByApi(failure: unknown): boolean {
  if (!(failure instanceof ApiError) || failure.failure.kind !== 'problem' || sendOutcome(failure) !== 'refused') return false;
  const { status } = failure.failure;
  return status >= 400 && status < 500 && status !== 409 && status !== 429;
}
