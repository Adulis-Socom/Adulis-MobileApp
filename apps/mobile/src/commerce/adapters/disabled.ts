import { AdapterUnavailable, type CartAdapter, type CartPort } from '../cart/port';

const port: CartPort = Object.freeze({
  getCarts: () => Promise.reject(new AdapterUnavailable('ADAPTER_DISABLED')),
  addLine: () => Promise.reject(new AdapterUnavailable('ADAPTER_DISABLED')),
  setQuantity: () => Promise.reject(new AdapterUnavailable('ADAPTER_DISABLED')),
  removeLine: () => Promise.reject(new AdapterUnavailable('ADAPTER_DISABLED')),
});

/** The only adapter a shipped build may use: it answers "not available" and does nothing else. */
export const disabledCartAdapter: CartAdapter = Object.freeze({
  mode: 'disabled',
  provenance: null,
  availability: Object.freeze({ available: false, reason: 'ADAPTER_DISABLED' }),
  bind: () => port,
});
