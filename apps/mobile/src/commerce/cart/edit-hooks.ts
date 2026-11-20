import { onlineManager, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { newIdempotencyKey } from '../../api/client';
import { disabledCartAdapter } from '../adapters/disabled';
import { useCommerceContext } from '../runtime/provider';
import {
  IDLE_EDIT,
  toEditInput,
  type EditInputFailure,
  type EditIntent,
  type EditKind,
  type EditState,
} from './edit';
import { judgeEdit, reconcileEdit, type EditJudgement } from './edit-outcome';
import type { EditStore } from './edit-store';
import { cartsKey } from './hooks';
import type { CartSet, LineId } from './model';
import { AdapterUnavailable, type CartAdapter, type Scope, type Verified } from './port';
import type { CartViewState } from './view-state';

export type EditOutcome =
  | 'started'
  | 'same'
  | 'ignored'
  | 'offline'
  | 'unavailable'
  | 'unverified'
  | 'absent'
  | 'invalid'
  | 'unchanged';

const OUTCOME_OF: Record<EditInputFailure, EditOutcome> = {
  UNAVAILABLE: 'unavailable',
  NOT_VERIFIED: 'unverified',
  LINE_ABSENT: 'absent',
  INVALID_QUANTITY: 'invalid',
  UNCHANGED: 'unchanged',
};

const unavailableJudgement: EditJudgement = { outcome: 'refused', code: 'ADAPTER_UNAVAILABLE' };

/** Whether the carts must be read again once an edit has settled in this state. */
const readsAgain = (state: EditState): boolean =>
  state.kind === 'APPLIED' ||
  state.kind === 'UNKNOWN' ||
  state.kind === 'UNRESOLVED' ||
  state.kind === 'LINE_GONE';

/**
 * Sends one request of an edit and settles the intent with what came back. Then the carts are read again
 * as a NEW request, begun after the edit settled: a read that began earlier may not show the change, and a
 * claim is drawn only from the answer THAT read produced. No read, a failed read or an answer that shows
 * something else claims nothing.
 *
 * A read happens only for a query that has a screen mounted. When none has, the answer in the cache is
 * known to be out of date (the server accepted a change it does not show), so it is dropped: the next
 * screen to show the carts starts from "loading", not from the old answer.
 */
async function sendEdit(args: {
  adapter: CartAdapter;
  store: EditStore;
  qc: QueryClient;
  scope: Scope;
  intent: EditIntent;
}): Promise<void> {
  const { adapter, store, qc, scope, intent } = args;
  // Nothing is sent for a session that is no longer the one on screen.
  if (!scope.isCurrent()) return;
  try {
    const port = adapter.bind(scope);
    if (intent.kind === 'REMOVE') {
      await port.removeLine({ lineId: intent.lineId, idempotencyKey: intent.key });
    } else {
      await port.setQuantity({
        lineId: intent.lineId,
        quantity: intent.quantity,
        idempotencyKey: intent.key,
      });
    }
    if (!scope.isCurrent()) return;
    store.apply(scope, intent.lineId, { type: 'ACCEPTED' });
  } catch (failure) {
    // A refusal to send for a scope that is still current says nothing about whether the request left, so
    // it is judged like any lost answer: unknown, and the same key may be sent again.
    if (!scope.isCurrent()) return;
    const judgement =
      failure instanceof AdapterUnavailable
        ? unavailableJudgement
        : judgeEdit(failure, intent, Date.now());
    store.apply(scope, intent.lineId, { type: 'FAILED', judgement, now: Date.now() });
  }
  if (!scope.isCurrent() || !readsAgain(store.read(scope, intent.lineId))) return;

  const key = cartsKey(scope);
  const before = qc.getQueryData<Verified<CartSet>>(key);
  await qc.invalidateQueries({ queryKey: key }, { cancelRefetch: true });
  if (!scope.isCurrent()) return;
  const after = qc.getQueryData<Verified<CartSet>>(key);
  const produced = after !== undefined && after !== before;
  if (
    !produced &&
    qc.getQueryCache().find({ queryKey: key, exact: true })?.getObserversCount() === 0
  ) {
    qc.removeQueries({ queryKey: key, exact: true });
  }
  const verdict = produced
    ? reconcileEdit(
        intent,
        { carts: after.value, receivedAt: after.receivedAt, verified: true, epoch: scope.epoch },
        scope.epoch,
      )
    : 'NOT_A_BASIS';
  store.apply(scope, intent.lineId, { type: 'READ', verdict });
}

/**
 * One line's edit: its state, and what the Buyer can do. `view` is the cart view the line is drawn from
 * (from `useCarts`): an edit is named only from a verified view. The state lives in the commerce runtime,
 * not in this component, so a screen that unmounts does not lose it and a screen mounted later finds it,
 * within one session only. Nothing is sent while the device is known to be offline, and nothing is queued.
 * An edit whose outcome is unknown is settled by READING: each later verified answer is compared with it,
 * and it is sent again only when the Buyer asks, under the same key.
 */
export function useCartEdit(
  lineId: LineId,
  view: CartViewState,
): {
  state: EditState;
  /** An earlier change to this line ended unconfirmed and was dismissed. */
  earlierUnconfirmed: boolean;
  changeQuantity: (quantity: number) => EditOutcome;
  remove: () => EditOutcome;
  retry: () => void;
  dismiss: () => void;
} {
  const context = useCommerceContext();
  const qc = useQueryClient();
  const store = context?.runtime.edits ?? null;
  const scope = context?.scope ?? null;
  const adapter = context?.adapter ?? disabledCartAdapter;

  const subscribe = useCallback(
    (listener: () => void) => (store ? store.subscribe(listener) : () => undefined),
    [store],
  );
  const state = useSyncExternalStore(subscribe, () =>
    store && scope ? store.read(scope, lineId) : IDLE_EDIT,
  );
  const earlierUnconfirmed = useSyncExternalStore(subscribe, () =>
    store && scope ? store.unconfirmed(scope, lineId) : false,
  );

  // Each verified answer is compared with an edit whose outcome is unknown. Reading changes nothing else.
  const listed = view.kind === 'LISTED' && view.freshness.kind !== 'UNVERIFIED' ? view : null;
  useEffect(() => {
    if (!store || !scope || listed === null) return;
    const held = store.read(scope, lineId);
    if (held.kind !== 'UNKNOWN' && held.kind !== 'UNRESOLVED') return;
    const verdict = reconcileEdit(
      held.intent,
      { carts: listed.carts, receivedAt: listed.receivedAt, verified: true, epoch: scope.epoch },
      scope.epoch,
    );
    store.apply(scope, lineId, { type: 'READ', verdict });
  }, [store, scope, lineId, listed?.carts, listed?.receivedAt, state]);

  const begin = (kind: EditKind, quantity?: number): EditOutcome => {
    if (!store || !scope || !adapter.availability.available) return 'unavailable';
    const input = toEditInput(view, lineId, kind, quantity);
    if (!input.ok) return OUTCOME_OF[input.reason];
    const begun = store.begin(scope, input.target, {
      now: Date.now(),
      online: onlineManager.isOnline(),
      mintKey: newIdempotencyKey,
    });
    if (begun === null) return 'unavailable';
    if (begun.result === 'started' && begun.state.kind === 'SENDING') {
      void sendEdit({ adapter, store, qc, scope, intent: begun.state.intent });
    }
    return begun.result;
  };

  const retry = () => {
    if (!store || !scope) return;
    const before = store.read(scope, lineId);
    const after = store.apply(scope, lineId, {
      type: 'RETRY',
      now: Date.now(),
      online: onlineManager.isOnline(),
    });
    if (after && after.kind === 'SENDING' && before.kind !== 'SENDING') {
      void sendEdit({ adapter, store, qc, scope, intent: after.intent });
    }
  };

  const dismiss = () => {
    if (store && scope) store.dismiss(scope, lineId);
  };

  return {
    state,
    earlierUnconfirmed,
    changeQuantity: (quantity) => begin('SET_QUANTITY', quantity),
    remove: () => begin('REMOVE'),
    retry,
    dismiss,
  };
}
