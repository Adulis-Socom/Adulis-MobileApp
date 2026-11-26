/**
 * Retry identity for writes whose outcome is UNKNOWN (CATINV S120). An idempotency key only protects against a duplicate if the
 * retry carries the SAME key as the attempt that may have succeeded. So a request (operation plus body) keeps one key while it is
 * unresolved: in flight, or answered in a way that does not tell us whether the server applied it. Every attempt of that request
 * joins the same key, including concurrent ones. A definite answer (accepted, or refused with a reason) resolves the request, so a
 * later identical request is a new command with a new key.
 *
 * Settlement is matched by key: an answer for a key that is no longer the request's key (the request was resolved and a new command
 * began) is stale and changes nothing, so it can neither forget an unresolved key nor resurrect a resolved one.
 *
 * Bounded. Only an IDLE unknown entry (nothing in flight) can be evicted, oldest first. An evicted request loses its key, so a later
 * attempt may be a duplicate; that is why the Console never promises a write "will not be done twice" (P-49), and asks the person to
 * check the current status first. Held in memory only, per Seller scope and session: never in storage. Durable idempotency is the backend's.
 */
export type WriteOutcome = 'APPLIED' | 'REFUSED' | 'UNKNOWN';

/** The codes after which the server may or may not have applied the write: the network failed, or the server could not say. */
const UNKNOWN_CODES = new Set(['NETWORK', 'UNAVAILABLE', 'INTERNAL']);
export const outcomeOfFailure = (code: string): WriteOutcome => (UNKNOWN_CODES.has(code) ? 'UNKNOWN' : 'REFUSED');
export const isUnknownOutcome = (code: string): boolean => UNKNOWN_CODES.has(code);

export interface RetryKeys {
  /** Start an attempt: joins the unresolved request with the same signature, or begins a new one with a fresh key. */
  begin(signature: string): string;
  /** Record the answer to the attempt that used `key`. A stale key (not the request's current key) is ignored. */
  settle(signature: string, key: string, outcome: WriteOutcome): void;
  /** Unresolved requests held (in flight or unknown). */
  readonly size: number;
}

interface Entry {
  readonly key: string;
  inFlight: number;
  unknown: boolean;
  resolved: boolean;
}

export function createRetryKeys(max = 25, mint: () => string = () => crypto.randomUUID()): RetryKeys {
  const entries = new Map<string, Entry>();
  const evict = () => {
    for (const [signature, entry] of entries) {
      if (entries.size <= max) return;
      if (entry.inFlight === 0) entries.delete(signature);
    }
  };
  return {
    begin(signature) {
      const found = entries.get(signature);
      if (found && !found.resolved) {
        found.inFlight += 1;
        // Most recently used goes last, so eviction takes the request that has waited longest.
        entries.delete(signature);
        entries.set(signature, found);
        return found.key;
      }
      const entry: Entry = { key: mint(), inFlight: 1, unknown: false, resolved: false };
      entries.delete(signature);
      entries.set(signature, entry);
      evict();
      return entry.key;
    },
    settle(signature, key, outcome) {
      const entry = entries.get(signature);
      if (!entry || entry.key !== key) return;
      entry.inFlight = Math.max(0, entry.inFlight - 1);
      if (outcome === 'UNKNOWN') entry.unknown = entry.unknown || !entry.resolved;
      else entry.resolved = true;
      if (entry.inFlight === 0 && (entry.resolved || !entry.unknown)) entries.delete(signature);
      evict();
    },
    get size() {
      return entries.size;
    },
  };
}

export const requestSignature = (op: string, input: unknown): string => `${op}:${JSON.stringify(input)}`;
