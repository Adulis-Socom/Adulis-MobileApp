import { useCallback, useEffect, useRef, useState } from 'react';
import type { OpId, OpInput, OpOutput } from '../contracts/gap-sc';
import { outcomeOfFailure, requestSignature } from '../seller/retry';
import { asTransportError, TransportError } from '../transport/port';
import type { QueryState } from '../seller/useSellerQuery';
import { useSession } from './SessionProvider';

/**
 * Reads and writes that belong to the signed-in ACCOUNT, not to a Seller (GAP-SC-21): they carry no Seller id. Same rules as the Seller hooks: a
 * late answer for a screen that is gone is dropped, a failure is never an empty result, AUTHENTICATION_REQUIRED ends the session that sent the
 * request (and only that one), and a write keeps its request identity while its outcome is unresolved (retry.ts).
 */
export function useAccountQuery<K extends OpId>(op: K, input: OpInput<K>): { state: QueryState<OpOutput<K>>; retry: () => void; replace: (data: OpOutput<K>) => void } {
  const session = useSession();
  const { transport } = session.selected;
  const expire = session.expire;
  const [state, setState] = useState<QueryState<OpOutput<K>>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const inputKey = JSON.stringify(input);
  useEffect(() => {
    let live = true;
    setState((prev) => (prev.status === 'ready' ? { ...prev, refreshing: true } : { status: 'loading' }));
    transport
      .send(op, input)
      .then((data) => {
        if (live) setState({ status: 'ready', data, refreshing: false, issued: 0 });
      })
      .catch((error: unknown) => {
        if (!live) return;
        const e = asTransportError(error);
        if (e.code === 'AUTHENTICATION_REQUIRED') expire();
        else setState({ status: 'error', error: e });
      });
    return () => {
      live = false;
    };
    // `input` is read through its serialised form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport, op, attempt, expire, inputKey]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // The answer to a write on this page is the newer truth: adopt it directly (the account views carry no version to compare).
  const replace = useCallback((data: OpOutput<K>) => setState({ status: 'ready', data, refreshing: false, issued: 0 }), []);
  return { state, retry, replace };
}

export type AccountCommand = <K extends OpId>(op: K, input: OpInput<K>) => Promise<OpOutput<K>>;

export function useAccountCommand(): AccountCommand {
  const session = useSession();
  const { transport } = session.selected;
  const expire = session.expire;
  // One retry store per authenticated session, owned by SessionProvider: it survives navigation and never crosses into the next session.
  const keys = session.accountRetryKeys;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(
    async <K extends OpId>(op: K, input: OpInput<K>): Promise<OpOutput<K>> => {
      const signature = requestSignature(op, input);
      const key = keys.begin(signature);
      if (key === null) throw new TransportError('RETRY_STORE_FULL'); // refused before dispatch: nothing is sent
      try {
        const result = await transport.send(op, input, { idempotencyKey: key });
        keys.settle(signature, key, 'APPLIED');
        if (!mounted.current) throw new TransportError('CONTEXT_MISMATCH', { detail: 'STALE_COMPLETION' });
        return result;
      } catch (error) {
        if (error instanceof TransportError && error.detail === 'STALE_COMPLETION') throw error;
        const e = asTransportError(error);
        keys.settle(signature, key, outcomeOfFailure(e.code));
        if (e.code === 'AUTHENTICATION_REQUIRED') expire();
        if (!mounted.current) throw new TransportError('CONTEXT_MISMATCH', { detail: 'STALE_COMPLETION' });
        throw e;
      }
    },
    [transport, expire, keys],
  );
}
