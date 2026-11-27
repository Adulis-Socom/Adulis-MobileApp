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
 * Idempotency (CATINV S120). The key belongs to the request (operation plus body) and is remembered, in memory, per Seller scope and
 * session, while that request is UNRESOLVED: in flight, or answered with an unknown outcome (network failure, server could not say).
 * Every attempt of the same request, concurrent ones included, carries that key, so a lost response cannot become a duplicate, even after
 * navigating elsewhere in the Seller and back. A definite answer ends the request (retry.ts). The guarantee holds only while the key is
 * held; the Console therefore never promises that a retry cannot duplicate (P-49).
 *
 * Late completion. If the screen that sent the write is gone by the time it settles (the Seller was switched, the user navigated, signed
 * out or the session expired) the result is NOT delivered: the call rejects with STALE_COMPLETION, so no completion effect runs
 * (no navigation, no notice, no overwrite of newer data). The server may still have applied the write; this does not and cannot undo it.
 * `AUTHENTICATION_REQUIRED` ends the session that sent the request; if that session has already ended, it changes nothing (SessionProvider).
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
      const key = retryKeys.begin(signature);
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
