import { onlineManager, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { isTransient, newIdempotencyKey } from '../../api/client';
import { useForegroundRevalidation } from '../../buyer/for-you-feed';
import { disabledCartAdapter } from '../adapters/disabled';
import { useCommerceContext } from '../runtime/provider';
import { IDLE, type AddIntent, type AddState } from './intent';
import type { IntentStore } from './intent-store';
import type { VariantId } from './model';
import { judgeAdd, type AddJudgement } from './outcome';
import { AdapterUnavailable, ScopeChanged, type CartAdapter, type Scope } from './port';
import { deriveViewState, type CartViewState } from './view-state';

/** Every cart answer of one scope shares this key family, so every screen that shows the carts reads one entry. */
export const cartsKey = (scope: Scope) => ['commerce', 'carts', scope.kind, scope.epoch] as const;

/** A read is repeated only when the network failed it, and at most twice: a server answer never retries. */
export const shouldRetryRead = (failures: number, error: unknown): boolean =>
  isTransient(error) && failures < 2;

/**
 * The Seller carts of the session on screen. `focused`: whether the screen is the one the Buyer is on,
 * so coming back to it asks again. A screen that stays mounted behind another still reads when the
 * connection returns and when the app comes back to the foreground, so its answer is ready when it is
 * shown again; nothing reads while no screen that shows the carts is mounted. The answer is drawn only
 * while it is the server's last word (see `deriveViewState`); returning from the background past the
 * freshness interval withholds it until a new one lands.
 */
export function useCarts({ focused }: { focused: boolean }): {
  view: CartViewState;
  refresh: () => void;
} {
  const context = useCommerceContext();
  const adapter = context?.adapter ?? disabledCartAdapter;
  const scope = context?.scope ?? null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: scope ? cartsKey(scope) : ['commerce', 'carts', 'none'],
    enabled: adapter.availability.available && scope !== null,
    queryFn: async () => {
      if (scope === null) throw new ScopeChanged();
      const answer = await adapter.bind(scope).getCarts();
      // An answer is kept only while the session that asked is still the one on screen.
      if (!scope.isCurrent()) throw new ScopeChanged();
      return answer;
    },
    staleTime: 0,
    refetchOnReconnect: true,
    // Coming back to the app is the foreground policy below, not a blind refetch.
    refetchOnWindowFocus: false,
    // Each read is a new answer, so "not replaced yet" can be told by identity.
    structuralSharing: false,
    retry: shouldRetryRead,
  });

  const [withheldAnswer, setWithheldAnswer] = useState<unknown>(null);
  const answer = query.data;
  useForegroundRevalidation(
    () => answer?.receivedAt,
    () => {
      setWithheldAnswer(answer ?? null);
      if (scope) void qc.invalidateQueries({ queryKey: cartsKey(scope) }, { cancelRefetch: false });
    },
  );
  const withheld = withheldAnswer !== null && answer === withheldAnswer;

  const wasFocused = useRef(focused);
  useEffect(() => {
    if (focused && !wasFocused.current && scope) {
      void qc.invalidateQueries({ queryKey: cartsKey(scope) }, { cancelRefetch: false });
    }
    wasFocused.current = focused;
  }, [focused, scope, qc]);

  const refresh = useCallback(() => {
    if (scope) void qc.invalidateQueries({ queryKey: cartsKey(scope) }, { cancelRefetch: true });
  }, [qc, scope]);

  const view = deriveViewState({
    availability: adapter.availability,
    scopeCurrent: scope !== null && scope.isCurrent(),
    query: {
      status: query.status,
      fetchStatus: query.fetchStatus,
      data: answer,
      error: query.error,
    },
    withheld,
  });
  return { view, refresh };
}

export type AddOutcome = 'started' | 'same' | 'ignored' | 'offline' | 'unavailable' | 'invalid';

/** Whether the carts must be read again once an add has settled in this state. */
const readsAgain = (state: AddState): boolean =>
  state.kind === 'ADDED' ||
  state.kind === 'UNKNOWN' ||
  state.kind === 'UNRESOLVED' ||
  state.kind === 'REFUSED_RELOAD';

const unavailableJudgement: AddJudgement = {
  outcome: 'refused',
  reload: false,
  code: 'ADAPTER_UNAVAILABLE',
  holdMs: null,
};

/** Sends one request of an add and settles the intent with what came back. */
async function send(args: {
  adapter: CartAdapter;
  store: IntentStore;
  qc: QueryClient;
  scope: Scope;
  variantId: VariantId;
  intent: AddIntent;
}): Promise<void> {
  const { adapter, store, qc, scope, variantId, intent } = args;
  // Nothing is sent for a session that is no longer the one on screen.
  if (!scope.isCurrent()) return;
  try {
    const accepted = await adapter.bind(scope).addLine({
      variantId,
      quantity: intent.quantity,
      idempotencyKey: intent.key,
    });
    if (!scope.isCurrent()) return;
    store.apply(scope, variantId, { type: 'ACCEPTED', lineId: accepted.lineId });
  } catch (failure) {
    // A refusal to send for a scope that is still current says nothing about whether the request left, so
    // it is judged like any lost answer: unknown, and the same key may be sent again.
    if (!scope.isCurrent()) return;
    const judgement =
      failure instanceof AdapterUnavailable
        ? unavailableJudgement
        : judgeAdd(failure, { startedAt: intent.startedAt, attempts: intent.attempts }, Date.now());
    store.apply(scope, variantId, { type: 'FAILED', judgement, now: Date.now() });
  }
  if (scope.isCurrent() && readsAgain(store.read(scope, variantId))) {
    // A NEW read, begun now: one that started before the add settled may not hold the line.
    void qc.invalidateQueries({ queryKey: cartsKey(scope) }, { cancelRefetch: true });
  }
}

/**
 * One option's add: its state, and what the Buyer can do. The state lives in the commerce runtime, not in
 * this component, so a screen that unmounts does not lose it and a screen mounted later finds it, within
 * one session only. There is no queue: nothing is sent while the device is known to be offline.
 */
export function useAddToCart(variantId: VariantId | null): {
  state: AddState;
  add: (quantity: number) => AddOutcome;
  retry: () => void;
  dismiss: () => void;
} {
  const context = useCommerceContext();
  const qc = useQueryClient();
  const store = context?.runtime.intents ?? null;
  const scope = context?.scope ?? null;
  const adapter = context?.adapter ?? disabledCartAdapter;

  const subscribe = useCallback(
    (listener: () => void) => (store ? store.subscribe(listener) : () => undefined),
    [store],
  );
  const state = useSyncExternalStore(subscribe, () =>
    store && scope && variantId ? store.read(scope, variantId) : IDLE,
  );

  const add = (quantity: number): AddOutcome => {
    if (!store || !scope || variantId === null || !adapter.availability.available)
      return 'unavailable';
    if (!Number.isSafeInteger(quantity) || quantity < 1) return 'invalid';
    const begun = store.begin(
      scope,
      { variantId, quantity },
      { now: Date.now(), online: onlineManager.isOnline(), mintKey: newIdempotencyKey },
    );
    if (begun === null) return 'unavailable';
    if (begun.result === 'started' && begun.state.kind === 'SENDING') {
      void send({ adapter, store, qc, scope, variantId, intent: begun.state.intent });
    }
    return begun.result;
  };

  const retry = () => {
    if (!store || !scope || variantId === null) return;
    const before = store.read(scope, variantId);
    const after = store.apply(scope, variantId, {
      type: 'RETRY',
      now: Date.now(),
      online: onlineManager.isOnline(),
    });
    if (after && after.kind === 'SENDING' && before.kind !== 'SENDING') {
      void send({ adapter, store, qc, scope, variantId, intent: after.intent });
    }
  };

  const dismiss = () => {
    if (store && scope && variantId !== null) store.dismiss(scope, variantId);
  };

  return { state, add, retry, dismiss };
}
