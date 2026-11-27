import type { paths } from '@adulis/api-client';
import { SELLER_SCOPED_OPS, type OpId, type OpInput, type OpOutput } from '../contracts/gap-sc';
import { TransportError, type CallContext, type Transport } from './port';

/**
 * COMPILE-TIME GUARD. The generated contract defines no Seller, auth, account or notification endpoint yet
 * (RBL-04 GAP-RB-06). The day it does, this assignment stops compiling, which is the signal to wire the matching
 * operations to the generated client here and delete their provisional entries in contracts/gap-sc.ts.
 */
type BusinessPaths = Extract<keyof paths, `/v1/${'sellers' | 'auth' | 'account' | 'notifications' | 'market'}${string}`>;
const _noBusinessContractYet: [BusinessPaths] extends [never] ? true : never = true;
void _noBusinessContractYet;

/** Reserved fixture identifier prefix (GOV-06 F6). The live transport refuses it before anything is sent. */
const RESERVED_FIXTURE_PREFIX = 'fx_';

export function containsReservedId(value: unknown): boolean {
  if (typeof value === 'string') return value.startsWith(RESERVED_FIXTURE_PREFIX);
  if (Array.isArray(value)) return value.some(containsReservedId);
  if (value !== null && typeof value === 'object') return Object.values(value).some(containsReservedId);
  return false;
}

/**
 * The live transport. There is nothing to call: every operation is an honest UNAVAILABLE, so a release journey that
 * needs an unimplemented backend contract fails safely and visibly. It performs no network request and fabricates
 * no data. Seller context is checked first so a missing sellerId is a client bug, not an "unavailable".
 */
export const liveTransport: Transport = {
  send<K extends OpId>(op: K, input: OpInput<K>, ctx?: CallContext): Promise<OpOutput<K>> {
    if (containsReservedId(input) || containsReservedId(ctx?.sellerId)) {
      return Promise.reject(new TransportError('REFUSED'));
    }
    if ((SELLER_SCOPED_OPS as readonly OpId[]).includes(op) && !ctx?.sellerId) {
      return Promise.reject(new TransportError('REFUSED'));
    }
    return Promise.reject(new TransportError('UNAVAILABLE'));
  },
};
