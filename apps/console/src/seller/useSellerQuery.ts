import { useCallback, useEffect, useState } from 'react';
import type { OpInput, OpOutput, SellerOp } from '../contracts/gap-sc';
import { useSession } from '../session/SessionProvider';
import { asTransportError, type TransportError } from '../transport/port';
import { useSeller } from './context';
import { tick } from './freshness';
import { runScoped } from './scoped';

export type QueryState<T> =
  | { readonly status: 'loading' }
  /** `issued`: the client-side stamp taken when the request that produced `data` was sent (freshness.ts). */
  | { readonly status: 'ready'; readonly data: T; readonly refreshing: boolean; readonly issued: number }
  | { readonly status: 'error'; readonly error: TransportError };

/**
 * Load a Seller-scoped read. The request names the Seller from the URL; the answer is committed only while this
 * very subtree is still mounted AND echoes the same Seller (see scoped.ts). A failure is its own state and is never
 * turned into an empty result. `AUTHENTICATION_REQUIRED` ends the session instead of showing a stale screen.
 */
export function useSellerQuery<K extends SellerOp>(op: K, input: OpInput<K>): { state: QueryState<OpOutput<K>>; retry: () => void } {
  const { sellerId } = useSeller();
  const session = useSession();
  const { transport } = session.selected;
  const expire = session.expire;
  const [state, setState] = useState<QueryState<OpOutput<K>>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // A read whose input changes (a search, a filter) is a different request: the serialised input is part of the trigger.
  const inputKey = JSON.stringify(input);

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const issued = tick();
    setState((prev) => (prev.status === 'ready' ? { ...prev, refreshing: true } : { status: 'loading' }));
    runScoped(transport, op, sellerId, input, controller.signal)
      .then((data) => {
        if (live) setState({ status: 'ready', data, refreshing: false, issued });
      })
      .catch((error: unknown) => {
        if (!live) return;
        const e = asTransportError(error);
        if (e.code === 'AUTHENTICATION_REQUIRED') expire();
        else setState({ status: 'error', error: e });
      });
    return () => {
      live = false;
      controller.abort();
    };
    // `input` is read through its serialised form (`inputKey`); the op, the Seller, the input and a manual retry are the triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport, op, sellerId, attempt, expire, inputKey]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
