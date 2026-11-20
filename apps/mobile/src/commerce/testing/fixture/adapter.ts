import type { CartSet } from '../../cart/model';
import { ScopeChanged, type CartAdapter, type Verified } from '../../cart/port';
import { createFixtureServer, type FixtureServer } from './server';

/**
 * The simulator as an adapter, labelled FIXTURE on every answer. The caller is read ONCE, when a request
 * is made (as a bearer is), so a request that waits is still processed for the caller that made it, not
 * for whoever is signed in when it is released. Like a real adapter it refuses to send and refuses to
 * return for a scope that has ended.
 */
export function createFixtureCartAdapter(
  server: FixtureServer,
  harness: { actor: () => string },
): CartAdapter {
  return {
    mode: 'fixture',
    provenance: 'FIXTURE',
    availability: { available: true },
    bind: (scope) => ({
      getCarts: async (): Promise<Verified<CartSet>> => {
        if (!scope.isCurrent()) throw new ScopeChanged();
        const caller = { actor: harness.actor() };
        const value = await server.getCarts(caller);
        if (!scope.isCurrent()) throw new ScopeChanged();
        return { value, receivedAt: Date.now(), provenance: 'FIXTURE' };
      },
      addLine: async (request) => {
        if (!scope.isCurrent()) throw new ScopeChanged();
        const caller = { actor: harness.actor() };
        const accepted = await server.addLine(caller, request);
        if (!scope.isCurrent()) throw new ScopeChanged();
        return accepted;
      },
      setQuantity: async (request) => {
        if (!scope.isCurrent()) throw new ScopeChanged();
        const caller = { actor: harness.actor() };
        await server.setQuantity(caller, request);
        if (!scope.isCurrent()) throw new ScopeChanged();
      },
      removeLine: async (request) => {
        if (!scope.isCurrent()) throw new ScopeChanged();
        const caller = { actor: harness.actor() };
        await server.removeLine(caller, request);
        if (!scope.isCurrent()) throw new ScopeChanged();
      },
    }),
  };
}

/** The device every simulated guest is on. */
export const DEMO_DEVICE = 'DEMO-DEVICE-1';

/**
 * A simulator, its adapter, and who is "signed in" on the demonstration device. `asAccount` also tells the
 * simulator the Account signed in on this device (so its adoption policy applies at the next request); the
 * test then signs in through the app's own session, so the app and the simulator agree about who is who.
 */
export function createFixtureWorld(options: Parameters<typeof createFixtureServer>[0] = {}) {
  const server = createFixtureServer(options);
  let current = `DEVICE:${DEMO_DEVICE}`;
  const adapter = createFixtureCartAdapter(server, { actor: () => current });
  return {
    server,
    adapter,
    actor: () => current,
    asGuest: () => void (current = `DEVICE:${DEMO_DEVICE}`),
    asAccount: (accountId: string) => {
      server.bindAccount(accountId, DEMO_DEVICE);
      current = `ACCOUNT:${accountId}`;
    },
  };
}
