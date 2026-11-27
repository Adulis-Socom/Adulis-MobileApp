/**
 * Which of two answers about the same object is fresher (SC-FE-07-09-CLOSE C).
 *
 * The version decides when it differs: an older version never replaces a newer acknowledged one. When the versions are EQUAL the
 * version cannot tell the answers apart, yet facts derived on the server (readiness, blockers, availability) may legitimately change
 * without a version bump. So every held answer carries a client-side stamp: a READ is stamped when it was ISSUED, an acknowledged WRITE
 * when its answer was ADOPTED. An equal-version answer replaces the held one only if it is stamped later: a read issued after the write
 * was acknowledged brings fresh derived facts; a read issued before it (and answered late) cannot overwrite the acknowledged write.
 */
let clock = 0;
/** A strictly increasing client-side sequence number. Not time; only order. */
export const tick = (): number => ++clock;

export interface Held<T> {
  readonly value: T;
  readonly stamp: number;
}

export function fresher<T extends { readonly version: number }>(current: Held<T> | null, incoming: Held<T>): Held<T> {
  if (current === null) return incoming;
  if (incoming.value.version !== current.value.version) return incoming.value.version > current.value.version ? incoming : current;
  return incoming.stamp > current.stamp ? incoming : current;
}
