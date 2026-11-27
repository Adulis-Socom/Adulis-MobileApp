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
 * Never evicted (FE12-01): an unresolved request keeps its key for as long as its store lives, because dropping it would silently turn the
 * next retry into a possible duplicate. The store lives per Seller scope and session (SellerScope replaces it on a change of account,
 * session or Seller), in memory only, never in storage. Each entry is one write a person started whose outcome is unknown, so the store
 * grows only with those. The Console still never promises a write "will not be done twice" (P-49): durable idempotency is the backend's.
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

// shortcut: no size cap; entries are per-person unknown writes inside one scope's lifetime. Upgrade to a cap that REFUSES new writes (never evicts) if a scope can live long enough to matter.
export function createRetryKeys(mint: () => string = () => crypto.randomUUID()): RetryKeys {
  const entries = new Map<string, Entry>();
  return {
    begin(signature) {
      const found = entries.get(signature);
      if (found && !found.resolved) {
        found.inFlight += 1;
        return found.key;
      }
      const entry: Entry = { key: mint(), inFlight: 1, unknown: false, resolved: false };
      entries.set(signature, entry);
      return entry.key;
    },
    settle(signature, key, outcome) {
      const entry = entries.get(signature);
      if (!entry || entry.key !== key) return;
      entry.inFlight = Math.max(0, entry.inFlight - 1);
      if (outcome === 'UNKNOWN') entry.unknown = entry.unknown || !entry.resolved;
      else entry.resolved = true;
      if (entry.inFlight === 0 && (entry.resolved || !entry.unknown)) entries.delete(signature);
    },
    get size() {
      return entries.size;
    },
  };
}

export const requestSignature = (op: string, input: unknown): string => `${op}:${JSON.stringify(input)}`;
