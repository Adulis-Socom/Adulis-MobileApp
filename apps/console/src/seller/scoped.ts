import type { OpInput, OpOutput, SellerOp } from '../contracts/gap-sc';
import { TransportError, type Transport } from '../transport/port';

/**
 * Run one Seller-scoped operation and verify the answer belongs to the Seller that asked (defence in depth for
 * RN-4). Every Seller-scoped response echoes `seller_id`; a response for a different Seller is a CONTEXT_MISMATCH
 * failure, never rendered. This is the second layer; the first is that the data hook ignores any answer that arrives
 * after its own Seller subtree was torn down.
 */
export async function runScoped<K extends SellerOp>(
  transport: Transport,
  op: K,
  sellerId: string,
  input: OpInput<K>,
  signal?: AbortSignal,
  idempotencyKey?: string,
): Promise<OpOutput<K>> {
  const result = await transport.send(op, input, {
    sellerId,
    ...(signal ? { signal } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
  const echoed = (result as { seller_id?: unknown }).seller_id;
  if (echoed !== sellerId) throw new TransportError('CONTEXT_MISMATCH');
  return result;
}
