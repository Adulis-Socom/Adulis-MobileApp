import { IDLE, isPending, reduceAdd, type AddEvent, type AddState } from './intent';
import type { VariantId } from './model';
import type { Scope } from './port';

/** What `begin` did with a Buyer's tap. */
export type BeginResult = Readonly<{
  state: AddState;
  /**
   * started: a new add was made and its request must now be sent; same: an add for this option was already
   * pending with the same quantity; ignored: one is pending with ANOTHER quantity, or one could not be
   * resolved and waits to be dismissed, and nothing is sent; offline: the device is known to be offline,
   * so nothing was sent.
   */
  result: 'started' | 'same' | 'ignored' | 'offline';
}>;

type Entry = { epoch: number; state: AddState };

/**
 * Every add of this run, in memory only, one per option. It is a plain synchronous object on purpose:
 * `begin` decides in the same tick whether a tap starts an add, so two taps in one frame (before React
 * has drawn anything) are one add with one key. The runtime that owns it empties it when the session
 * changes; an entry is also tied to the epoch that made it and is never shown to another.
 */
export interface IntentStore {
  begin(
    scope: Scope,
    input: { variantId: VariantId; quantity: number },
    context: { now: number; online: boolean; mintKey: () => string },
  ): BeginResult | null;
  /** The add for this option in this scope: IDLE when there is none or the scope is not current. */
  read(scope: Scope, variantId: VariantId): AddState;
  /** Applies one event. Null when the scope is not current: nothing is touched. */
  apply(scope: Scope, variantId: VariantId, event: AddEvent): AddState | null;
  dismiss(scope: Scope, variantId: VariantId): AddState;
  /** Empties the store. With `silent`, watchers are not told: for a caller that is rendering, whose watchers re-render on their own. */
  clear(options?: { silent?: boolean }): void;
  subscribe(listener: () => void): () => void;
}

export function createIntentStore(): IntentStore {
  const entries = new Map<VariantId, Entry>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  const current = (scope: Scope, variantId: VariantId): Entry | undefined => {
    const entry = entries.get(variantId);
    return entry && entry.epoch === scope.epoch ? entry : undefined;
  };

  const set = (scope: Scope, variantId: VariantId, state: AddState) => {
    entries.set(variantId, { epoch: scope.epoch, state });
    notify();
  };

  const apply: IntentStore['apply'] = (scope, variantId, event) => {
    if (!scope.isCurrent()) return null;
    const before = current(scope, variantId)?.state ?? IDLE;
    const after = reduceAdd(before, event);
    if (after !== before) set(scope, variantId, after);
    return after;
  };

  return {
    begin(scope, input, { now, online, mintKey }) {
      if (!scope.isCurrent()) return null;
      const before = current(scope, input.variantId)?.state ?? IDLE;
      if (before.kind === 'UNRESOLVED') return { state: before, result: 'ignored' };
      if (isPending(before) && 'intent' in before) {
        return { state: before, result: before.intent.quantity === input.quantity ? 'same' : 'ignored' };
      }
      // The key is made here, once, and only for an add that is really new.
      const after = reduceAdd(before, {
        type: 'BEGIN',
        variantId: input.variantId,
        quantity: input.quantity,
        key: mintKey(),
        now,
        online,
      });
      set(scope, input.variantId, after);
      return { state: after, result: after.kind === 'OFFLINE_NOT_SENT' ? 'offline' : 'started' };
    },

    read(scope, variantId) {
      if (!scope.isCurrent()) return IDLE;
      return current(scope, variantId)?.state ?? IDLE;
    },

    apply,

    dismiss(scope, variantId) {
      return apply(scope, variantId, { type: 'DISMISS' }) ?? IDLE;
    },

    clear(options) {
      if (entries.size === 0) return;
      entries.clear();
      if (options?.silent !== true) notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
