import { useCallback, useEffect, useRef } from 'react';
import type { OpInput, OpOutput, SellerOp } from '../contracts/gap-sc';
import { useSession } from '../session/SessionProvider';
import { asTransportError, TransportError } from '../transport/port';
import { useSeller } from './context';
import { outcomeOfFailure, requestSignature } from './retry';
import { useRetryKeys } from './retryContext';
import { runScoped } from './scoped';

export type SellerCommand = <K extends SellerOp>(op: K, input: OpInput<K>) => Promise<OpOutput<K>>;

/** What a write that finished after its screen was gone rejects with. Callers treat it as "nothing more to do here". */
export const STALE_COMPLETION = 'STALE_COMPLETION';
export const isStaleCompletion = (e: unknown): boolean => e instanceof TransportError && e.detail === STALE_COMPLETION;

/**
 * Run a Seller-scoped WRITE. The request names the Seller from the URL and the answer must echo it (scoped.ts).
 *
 * Idempotency (CATINV S120). The key belongs to the request (operation plus body) and is remembered, in memory and per Seller scope,
 * only while the outcome of that request is UNKNOWN (network failure, server could not say). The next attempt of the same request then
 * carries the same key, so a lost response cannot become a duplicate, even after navigating elsewhere in the Seller and back. A definite
 * answer ends the request. A fresh key is never minted for a request whose outcome is unknown.
 *
 * Late completion. If the screen that sent the write is gone by the time it settles (the Seller was switched, the user navigated, signed
 * out or the session expired) the result is NOT delivered: the call rejects with STALE_COMPLETION, so no completion effect runs
 * (no navigation, no notice, no overwrite of newer data). The server may still have applied the write; this does not and cannot undo it.
 * `AUTHENTICATION_REQUIRED` always ends the session.
 */
export function useSellerCommand(): SellerCommand {
  const { sellerId } = useSeller();
  const session = useSession();
  const { transport } = session.selected;
  const expire = session.expire;
  const retryKeys = useRetryKeys();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(
    async <K extends SellerOp>(op: K, input: OpInput<K>): Promise<OpOutput<K>> => {
      const signature = requestSignature(op, input);
      const key = retryKeys.keyFor(signature);
      let result: OpOutput<K>;
      try {
        result = await runScoped(transport, op, sellerId, input, undefined, key);
      } catch (error) {
        const e = asTransportError(error);
        retryKeys.settle(signature, key, outcomeOfFailure(e.code));
        if (e.code === 'AUTHENTICATION_REQUIRED') expire();
        if (!mounted.current) throw new TransportError('CONTEXT_MISMATCH', { detail: STALE_COMPLETION });
        throw e;
      }
      retryKeys.settle(signature, key, 'APPLIED');
      if (!mounted.current) throw new TransportError('CONTEXT_MISMATCH', { detail: STALE_COMPLETION });
      return result;
    },
    [transport, sellerId, expire, retryKeys],
  );
}
