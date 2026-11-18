import { keyConflict, keyUsable, waitBeforeRetryMs } from '../api/mutation';
import { sendOutcome } from './chat';

/**
 * What the Buyer's conversation screen knows about the message it is sending, and what a failed
 * attempt proves. Buyer only: the store's replies keep the rule in chat.ts (`sendOutcome`).
 *
 * - unsent: text in the box, nothing sent
 * - sending: a request is in flight
 * - sent: the server accepted it with a message id (the message then comes from the server's history)
 * - failed: the API answered with its own problem; nothing was stored and the intent has ended
 * - unknown: no proof either way (lost connection, timeout, a gateway's page, an unreadable
 *   acceptance, a key conflict). The message may be stored: the text, Product and key are kept
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
 * The API's own problem answer proves the message was not stored (a refusal leaves no idempotency
 * record), with one exception: a key conflict, which says the key was already used and so the first
 * attempt may be stored. Everything else leaves the outcome unknown. A wait that was asked for holds
 * the next attempt whatever the outcome: after an API answer it was not processed, after an
 * intermediary's answer the replay stays safe because it carries the same key.
 */
export function judgeFailure(failure: unknown, intent: { startedAt: number } | null, now: number): FailureJudgement {
  const holdMs = waitBeforeRetryMs(failure);
  if (keyConflict(failure)) return { outcome: 'unknown', replay: false, holdMs };
  if (sendOutcome(failure) === 'refused') return { outcome: 'failed', replay: false, holdMs };
  return { outcome: 'unknown', replay: intent !== null && keyUsable(intent, now), holdMs };
}
