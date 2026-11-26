import { useCallback, useRef } from 'react';
import type { OpInput, OpOutput, SellerOp } from '../contracts/gap-sc';
import { useSession } from '../session/SessionProvider';
import { asTransportError } from '../transport/port';
import { useSeller } from './context';
import { runScoped } from './scoped';

/**
 * Run a Seller-scoped WRITE. The request names the Seller from the URL and the answer must echo it (scoped.ts).
 * Idempotency (CATINV S120): one key per command body. A retry of the SAME op and body reuses its key, so a lost response
 * can never apply twice; a different body is a different command with its own key; a success ends the command.
 * `AUTHENTICATION_REQUIRED` ends the session; every other failure is thrown as a TransportError for the caller to show.
 */
export type SellerCommand = <K extends SellerOp>(op: K, input: OpInput<K>) => Promise<OpOutput<K>>;

export function useSellerCommand(): SellerCommand {
  const { sellerId } = useSeller();
  const session = useSession();
  const { transport } = session.selected;
  const expire = session.expire;
  const pending = useRef({ signature: '', key: '' });
  return useCallback(
    async <K extends SellerOp>(op: K, input: OpInput<K>): Promise<OpOutput<K>> => {
      const signature = `${op}:${JSON.stringify(input)}`;
      if (pending.current.signature !== signature) pending.current = { signature, key: crypto.randomUUID() };
      try {
        const result = await runScoped(transport, op, sellerId, input, undefined, pending.current.key);
        pending.current = { signature: '', key: '' };
        return result;
      } catch (error) {
        const e = asTransportError(error);
        if (e.code === 'AUTHENTICATION_REQUIRED') expire();
        throw e;
      }
    },
    [transport, sellerId, expire],
  );
}
