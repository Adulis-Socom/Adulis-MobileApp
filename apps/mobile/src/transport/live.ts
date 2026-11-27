// The live transport. No business operation exists in the generated contract yet (it holds /livez and /healthz
// only), so every operation fails closed with UNAVAILABLE and nothing is sent: no fetch, no fallback to a fixture
// (GOV-06 S2: production fails closed). The day an operation is generated, this file is wired to it by its owner order.
import { TransportError, type MobileTransport } from './port';

export const liveTransport: MobileTransport = {
  kind: 'live',
  request: () => Promise.reject(new TransportError('UNAVAILABLE', 'error.request.internal')),
};
