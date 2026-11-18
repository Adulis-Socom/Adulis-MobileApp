import { ApiError } from '../api/client';

/**
 * What a failed keyed write of a Collection tells the Buyer's device about its first attempt, by the rules
 * of the API's idempotency store: it keeps a stored answer under the key, writes nothing for a refusal, and
 * answers 409 to a key it can no longer replay.
 *
 * - `refused`: the API answered with its own 4xx (a bad name, a session that ended): nothing was stored, so
 *   the next attempt is a new one and takes a new key.
 * - `conflict`: 409. The key cannot be sent again, and the first attempt may have been stored. Nothing is
 *   sent behind the Buyer's back: the list is read again, and only the Buyer's own Create is a new attempt.
 * - `unknown`: no answer, a gateway page, a 429 or any 5xx. The first attempt may well have been stored (a
 *   connection can drop after the commit), so the SAME key goes with the next attempt, which is always safe
 *   inside the key's life, and the list is read again.
 */
export type WriteOutcome = 'refused' | 'conflict' | 'unknown';

export function judgeWrite(error: unknown): WriteOutcome {
  if (error instanceof ApiError && error.failure.kind === 'problem') {
    const { status } = error.failure;
    if (status === 409) return 'conflict';
    if (status >= 400 && status < 500 && status !== 429) return 'refused';
  }
  return 'unknown';
}

/**
 * A failed change to Saved or a Collection may have been made anyway, unless the API itself refused it.
 * Only a refusal may say "not changed"; every other outcome says the app could not confirm it.
 */
export const outcomeUnknown = (error: unknown): boolean => judgeWrite(error) !== 'refused';

/**
 * Collections deleted since the app started, counted. A Create whose answer was lost keeps its key, and a
 * replay of that key answers the Collection it stored, even one deleted since (the API keeps the answer for a
 * day): so any deletion ends such an attempt (SavedScreen's NewCollection compares the count). Only a count,
 * never a name or a reference, so nothing of an Account is held here.
 */
let deletions = 0;
export const noteCollectionDeleted = () => {
  deletions += 1;
};
export const collectionDeletions = () => deletions;
