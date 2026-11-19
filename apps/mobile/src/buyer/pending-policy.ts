import { useUiStore } from '../state/ui-store';
import type { ProductRef } from './MessageSellerButton';
import type { Baseline } from './pending-match';

/**
 * Whether an unconfirmed message outlives the conversation screen it was sent from.
 *
 * - 'none' (the default, and what ships until it is decided): nothing is kept; leaving the screen drops
 *   the message, its Product and its key.
 * - 'session': the message, its Product, its key and what the history held before it are kept IN MEMORY
 *   for the signed-in session only, until the server confirms it or refuses it, the person gives it up,
 *   the session ends or the Account changes, or 48 hours pass. Nothing is written to the device, and a
 *   restart of the app drops it.
 *
 * It is a source constant that tests set; there is no environment variable or remote flag, so a build
 * cannot turn it on by accident. The test that pins the default must change in the same commit.
 */
export type PendingRetention = 'none' | 'session';

let retention: PendingRetention = 'none';
export const pendingRetention = (): PendingRetention => retention;
export function configurePendingRetention(mode: PendingRetention): void {
  retention = mode;
}

/** How long a kept message is restored at all (the key's own safe age is shorter, mutation.ts). */
export const PENDING_CAP_MS = 48 * 60 * 60 * 1000;

export type PendingSendRecord = {
  /** Whose it is: `credentialTag` of the session that sent it. */
  owner: string;
  text: string;
  productId: string | null;
  /** The Product as the composer shows it (public handle and slug), so a replay can check it again. */
  product: ProductRef | null;
  key: string;
  startedAt: number;
  attempts: number;
  baseline: Baseline;
};

/**
 * A short label for a credential, so a kept message can say whose it is without holding the credential.
 * Two 32-bit FNV-1a hashes with different seeds: a label, not a secret, and no way back to a long random
 * token.
 */
export function credentialTag(token: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ token.length;
  for (let i = 0; i < token.length; i++) {
    const code = token.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/** The kept message of this conversation for this session, or null. Reads only: nothing is changed, so it is safe to call while rendering. */
export function peekPending(owner: string | null, conversationRef: string, now: number): PendingSendRecord | null {
  if (retention !== 'session' || owner === null) return null;
  const kept = useUiStore.getState().pendingSends[conversationRef];
  if (kept === undefined || kept.owner !== owner || now - kept.startedAt >= PENDING_CAP_MS) return null;
  return kept;
}

/** peekPending, and a kept message that cannot be used (another credential, past the cap) is dropped. Never while rendering. */
export function restorePending(owner: string | null, conversationRef: string, now: number): PendingSendRecord | null {
  const kept = peekPending(owner, conversationRef, now);
  if (kept === null && retention === 'session' && owner !== null && useUiStore.getState().pendingSends[conversationRef] !== undefined) {
    useUiStore.getState().setPendingSend(conversationRef, null);
  }
  return kept;
}
