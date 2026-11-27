// The live transport. No business operation exists in the generated contract yet (it holds /livez and /healthz
// only), so every operation fails closed and nothing is sent: no fetch, no fallback to a fixture
// (GOV-06 S2: production fails closed). The day an operation is generated, this file is wired to it by its owner order.
import type { MobileOpId } from '../contracts/gap-mob-session';
import { carriesReservedId } from './guard';
import { TransportError, type MobileTransport } from './port';

export const liveTransport: MobileTransport = {
  kind: 'live',
  json: (op: MobileOpId, input, ctx) => {
    // A reserved identifier, or a credential that is one, is refused as such; everything else is UNAVAILABLE.
    if (carriesReservedId(op, input) || (ctx.bearer !== null && ctx.bearer.startsWith('fx_'))) {
      return Promise.reject(new TransportError('REFUSED'));
    }
    return Promise.reject(new TransportError('UNAVAILABLE'));
  },
};
