import { AdapterUnavailable, type CartAdapter, type CartPort } from '../cart/port';

/**
 * What the real adapter is waiting for, per operation. It is data, not code: a test holds that every
 * port method has an entry. Nothing here binds anything.
 */
export const REAL_ADAPTER_GAPS = {
  getCarts: [
    'the contract does not yet type the answer',
    'the answer describes one Seller cart',
    'the answer carries no Seller handle, store name, option label, Product slug or image',
    'the answer carries no per-line reasons',
    'the answer carries no previous price or subtotal',
  ],
  addLine: [
    'the contract does not yet type the request or the answer',
    'the key requirement is not yet declared in the contract',
    'the rule for adding the same option twice is not yet stated',
    'a send-time check that the session that asked is still the session on screen',
    'no operation changes the option of a line',
  ],
  setQuantity: [
    'the contract does not yet type the edit request or its answer',
    'the key requirement for edits is not yet declared in the contract',
    'the refusal answer for a quantity the server will not take is not yet stated',
    'a send-time check that the session that asked is still the session on screen',
  ],
  removeLine: [
    'the contract does not yet type the edit request or its answer',
    'the key requirement for edits is not yet declared in the contract',
    'the answer for removing a line that is already absent is not yet stated',
    'a send-time check that the session that asked is still the session on screen',
  ],
} as const satisfies Record<keyof CartPort, readonly string[]>;

const port: CartPort = Object.freeze({
  getCarts: () => Promise.reject(new AdapterUnavailable('CONTRACT_MISSING')),
  addLine: () => Promise.reject(new AdapterUnavailable('CONTRACT_MISSING')),
  setQuantity: () => Promise.reject(new AdapterUnavailable('CONTRACT_MISSING')),
  removeLine: () => Promise.reject(new AdapterUnavailable('CONTRACT_MISSING')),
});

/**
 * The place a real adapter will go once the cart contract is typed. It has no imports from the API
 * client and no network code: until then it answers "not available", exactly like the disabled adapter.
 */
export function createRealCartAdapter(): CartAdapter {
  return Object.freeze({
    mode: 'disabled',
    provenance: null,
    availability: Object.freeze({ available: false, reason: 'CONTRACT_MISSING' }),
    bind: () => port,
  });
}
