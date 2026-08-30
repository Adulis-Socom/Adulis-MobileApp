/**
 * lib/idempotency.ts -- keys are minted WHEN THE CONTROL MOUNTS, never on
 * click (ADU-CON-02 v3.1 S7; console CLAUDE.md). A double-tap must be one
 * key: the first click's request and the second's carry the same key, and
 * the server replays rather than re-executes.
 */
import { useRef } from 'react';

export function mintKey(): string {
  // NOT the minting ADU-RUL-03 S2 bans. That rule is about IDENTITY -- a
  // value the server trusts to say which browser this is, which a browser
  // may not choose for itself. An idempotency key is the opposite: a
  // per-intent nonce the server treats as opaque, which the client MUST
  // generate because only the client knows when two taps are one intent
  // (ADU-CON-02 v3.1 S7). T8 Phase 2's gate greps for crypto.randomUUID in
  // this tree; this is the one call, and this comment is why it stays.
  return crypto.randomUUID();
}

/** One key per mount; remint AFTER a completed action to arm the control again. */
export function useIdempotencyKey(): { current: () => string; remint: () => void } {
  const ref = useRef<string>(mintKey());
  return {
    current: () => ref.current,
    remint: () => {
      ref.current = mintKey();
    },
  };
}
