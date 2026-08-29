/**
 * lib/idempotency.ts -- keys are minted WHEN THE CONTROL MOUNTS, never on
 * click (ADU-CON-02 v3.1 S7; console CLAUDE.md). A double-tap must be one
 * key: the first click's request and the second's carry the same key, and
 * the server replays rather than re-executes.
 */
import { useRef } from 'react';

export function mintKey(): string {
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
