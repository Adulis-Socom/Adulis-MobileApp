import { asLineId, type CartSet } from '../cart/model';
import {
  ScopeChanged,
  type AddRequest,
  type CartAdapter,
  type Scope,
  type Verified,
} from '../cart/port';

/**
 * A scripted adapter for the tests of the hooks and the runtime: it records every call, answers from a
 * cart set the test sets, and can fail or hold the next call. It is not the server simulator: it models
 * no Seller, no key store and no adoption. It is labelled as a fixture, so only a test provider that
 * allows fixtures will serve it.
 */
export type Held = { release(): void };

export type StubCall = Readonly<{
  op: 'getCarts' | 'addLine';
  scopeKind: 'guest' | 'account';
  epoch: number;
  key: string | null;
  variantId: string | null;
  quantity: number | null;
}>;

export const EMPTY_CARTS: CartSet = { carts: [], checkedAt: null };

export function stubAdapter() {
  let carts: CartSet = EMPTY_CARTS;
  let lines = 0;
  const calls: StubCall[] = [];
  const failures: Record<'getCarts' | 'addLine', unknown[]> = { getCarts: [], addLine: [] };
  const holds: Record<'getCarts' | 'addLine', Array<Promise<void>>> = { getCarts: [], addLine: [] };

  const enter = async (op: 'getCarts' | 'addLine', scope: Scope, request: AddRequest | null) => {
    if (!scope.isCurrent()) throw new ScopeChanged();
    calls.push({
      op,
      scopeKind: scope.kind,
      epoch: scope.epoch,
      key: request?.idempotencyKey ?? null,
      variantId: request?.variantId ?? null,
      quantity: request?.quantity ?? null,
    });
    const hold = holds[op].shift();
    if (hold) await hold;
    const failure = failures[op].shift();
    if (failure !== undefined) throw failure;
  };

  const adapter: CartAdapter = {
    mode: 'fixture',
    provenance: 'FIXTURE',
    availability: { available: true },
    bind: (scope) => ({
      getCarts: async (): Promise<Verified<CartSet>> => {
        await enter('getCarts', scope, null);
        return { value: carts, receivedAt: Date.now(), provenance: 'FIXTURE' };
      },
      addLine: async (request) => {
        await enter('addLine', scope, request);
        lines += 1;
        return { lineId: asLineId(`DEMO-LINE-${lines}`) };
      },
    }),
  };

  return {
    adapter,
    calls,
    setCarts: (next: CartSet) => void (carts = next),
    /** The next call of this operation rejects with `error`. */
    failNext: (op: 'getCarts' | 'addLine', error: unknown) => void failures[op].push(error),
    /** The next call of this operation waits (after it is recorded) until released. */
    hold: (op: 'getCarts' | 'addLine'): Held => {
      let release: () => void = () => undefined;
      holds[op].push(new Promise<void>((resolve) => (release = resolve)));
      return { release: () => release() };
    },
  };
}
