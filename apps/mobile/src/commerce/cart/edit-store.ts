import {
  IDLE_EDIT,
  isPendingEdit,
  reduceEdit,
  sameTarget,
  type EditEvent,
  type EditState,
  type EditTarget,
} from './edit';
import type { LineId } from './model';
import type { Scope } from './port';

/** What `begin` did with a Buyer's tap. */
export type EditBeginResult = Readonly<{
  state: EditState;
  /**
   * started: a new edit was made and its request must now be sent; same: an edit with this target was
   * already pending; ignored: one is pending with ANOTHER target, or one could not be resolved and waits
   * to be dismissed, and nothing is sent; offline: the device is known to be offline, so nothing was sent.
   */
  result: 'started' | 'same' | 'ignored' | 'offline';
}>;

type Entry = { epoch: number; state: EditState };

/**
 * Every edit of this run, in memory only, one per line. A plain synchronous object on purpose: `begin`
 * decides in the same tick whether a tap starts an edit, so two taps in one frame (before React has drawn
 * anything) are one edit with one key. The runtime that owns it empties it when the session changes; an
 * entry is also tied to the epoch that made it and is never shown to another.
 */
export interface EditStore {
  begin(
    scope: Scope,
    target: EditTarget,
    context: { now: number; online: boolean; mintKey: () => string },
  ): EditBeginResult | null;
  /** The edit for this line in this scope: IDLE when there is none or the scope is not current. */
  read(scope: Scope, lineId: LineId): EditState;
  /** Applies one event. Null when the scope is not current: nothing is touched. */
  apply(scope: Scope, lineId: LineId, event: EditEvent): EditState | null;
  /** Ends an edit that is not in flight. One that ended without proof leaves the line marked. */
  dismiss(scope: Scope, lineId: LineId): EditState;
  /**
   * Whether an earlier change to this line ended unconfirmed and was dismissed, so the next one starts by
   * saying so. The mark holds no quantity and no key; a confirmed change or a line that is gone clears it.
   */
  unconfirmed(scope: Scope, lineId: LineId): boolean;
  /** Empties the store. With `silent`, watchers are not told: for a caller that is rendering, whose watchers re-render on their own. */
  clear(options?: { silent?: boolean }): void;
  subscribe(listener: () => void): () => void;
}

export function createEditStore(): EditStore {
  const entries = new Map<LineId, Entry>();
  const marks = new Map<LineId, number>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  const current = (scope: Scope, lineId: LineId): Entry | undefined => {
    const entry = entries.get(lineId);
    return entry && entry.epoch === scope.epoch ? entry : undefined;
  };

  const set = (scope: Scope, lineId: LineId, state: EditState) => {
    if (state.kind === 'CONFIRMED' || state.kind === 'LINE_GONE') marks.delete(lineId);
    entries.set(lineId, { epoch: scope.epoch, state });
    notify();
  };

  const apply: EditStore['apply'] = (scope, lineId, event) => {
    if (!scope.isCurrent()) return null;
    const before = current(scope, lineId)?.state ?? IDLE_EDIT;
    const after = reduceEdit(before, event);
    if (after !== before) set(scope, lineId, after);
    return after;
  };

  return {
    begin(scope, target, { now, online, mintKey }) {
      if (!scope.isCurrent()) return null;
      const before = current(scope, target.lineId)?.state ?? IDLE_EDIT;
      if (before.kind === 'UNRESOLVED') return { state: before, result: 'ignored' };
      if (isPendingEdit(before) && 'intent' in before) {
        return {
          state: before,
          result: sameTarget(before.intent, target) ? 'same' : 'ignored',
        };
      }
      // The key is made here, once, and only for an edit that is really new.
      const after = reduceEdit(before, { type: 'BEGIN', target, key: mintKey(), now, online });
      set(scope, target.lineId, after);
      return { state: after, result: after.kind === 'OFFLINE_NOT_SENT' ? 'offline' : 'started' };
    },

    read(scope, lineId) {
      if (!scope.isCurrent()) return IDLE_EDIT;
      return current(scope, lineId)?.state ?? IDLE_EDIT;
    },

    apply,

    dismiss(scope, lineId) {
      if (!scope.isCurrent()) return IDLE_EDIT;
      const before = current(scope, lineId)?.state ?? IDLE_EDIT;
      if (before.kind === 'UNKNOWN' || before.kind === 'UNRESOLVED') marks.set(lineId, scope.epoch);
      return apply(scope, lineId, { type: 'DISMISS' }) ?? IDLE_EDIT;
    },

    unconfirmed(scope, lineId) {
      return scope.isCurrent() && marks.get(lineId) === scope.epoch;
    },

    clear(options) {
      if (entries.size === 0 && marks.size === 0) return;
      entries.clear();
      marks.clear();
      if (options?.silent !== true) notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
