/**
 * Retry identity for writes whose outcome is UNKNOWN (CATINV S120). An idempotency key only protects against a duplicate if the
 * retry carries the SAME key as the attempt that may have succeeded. So a write that failed in a way that does not tell us whether the
 * server applied it keeps its key for that exact request (operation plus body), and the next attempt of that same request reuses it.
 * A definite answer (accepted, or refused with a reason) ends the request, so a later identical request is a new command with a new key.
 *
 * Held in memory only, per Seller scope: it never reaches storage, and it is gone when the Seller scope or the session ends.
 * Nothing protected is kept: only the key and the signature of the request. Real durable idempotency belongs to the backend.
 */
export type WriteOutcome = 'APPLIED' | 'REFUSED' | 'UNKNOWN';

/** The codes after which the server may or may not have applied the write: the network failed, or the server could not say. */
const UNKNOWN_CODES = new Set(['NETWORK', 'UNAVAILABLE', 'INTERNAL']);
export const outcomeOfFailure = (code: string): WriteOutcome => (UNKNOWN_CODES.has(code) ? 'UNKNOWN' : 'REFUSED');
export const isUnknownOutcome = (code: string): boolean => UNKNOWN_CODES.has(code);

export interface RetryKeys {
  /** The key to send for this request: the earlier one if its outcome is still unknown, otherwise a fresh one. */
  keyFor(signature: string): string;
  settle(signature: string, key: string, outcome: WriteOutcome): void;
  readonly size: number;
}

export function createRetryKeys(max = 25, mint: () => string = () => crypto.randomUUID()): RetryKeys {
  const pending = new Map<string, string>();
  return {
    keyFor: (signature) => pending.get(signature) ?? mint(),
    settle(signature, key, outcome) {
      pending.delete(signature);
      if (outcome !== 'UNKNOWN') return;
      pending.set(signature, key);
      // Bounded: the oldest unknown outcome is forgotten first. A forgotten one can only ever cost a duplicate, never a wrong answer.
      while (pending.size > max) {
        const oldest = pending.keys().next();
        if (oldest.done) break;
        pending.delete(oldest.value);
      }
    },
    get size() {
      return pending.size;
    },
  };
}

export const requestSignature = (op: string, input: unknown): string => `${op}:${JSON.stringify(input)}`;
