import { asLineId, type CartSet } from '../cart/model';
import {
  ScopeChanged,
  type AddRequest,
  type CartAdapter,
  type RemoveLineRequest,
  type Scope,
  type SetQuantityRequest,
  type Verified,
} from '../cart/port';

/**
 * A scripted adapter for the tests of the hooks and the runtime: it records every call, answers from a
 * cart set the test sets, and can fail or hold the next call. It is not the server simulator: it models
 * no Seller, no key store and no adoption. It is labelled as a fixture, so only a test provider that
 * allows fixtures will serve it.
 */
export type Held = { release(): void };

export type StubOp = 'getCarts' | 'addLine' | 'setQuantity' | 'removeLine';

export type StubCall = Readonly<{
  op: StubOp;
  scopeKind: 'guest' | 'account';
  epoch: number;
  key: string | null;
  variantId: string | null;
  quantity: number | null;
  lineId: string | null;
}>;

export const EMPTY_CARTS: CartSet = { carts: [], checkedAt: null };

export function stubAdapter() {
  let carts: CartSet = EMPTY_CARTS;
  let lines = 0;
  const calls: StubCall[] = [];
  const failures: Record<StubOp, unknown[]> = {
    getCarts: [],
    addLine: [],
    setQuantity: [],
    removeLine: [],
  };
  const holds: Record<StubOp, Array<Promise<void>>> = {
    getCarts: [],
    addLine: [],
    setQuantity: [],
    removeLine: [],
  };

  const enter = async (
    op: StubOp,
    scope: Scope,
    request: AddRequest | SetQuantityRequest | RemoveLineRequest | null,
  ) => {
    if (!scope.isCurrent()) throw new ScopeChanged();
    calls.push({
      op,
      scopeKind: scope.kind,
      epoch: scope.epoch,
      key: request?.idempotencyKey ?? null,
      variantId: request !== null && 'variantId' in request ? request.variantId : null,
      quantity: request !== null && 'quantity' in request ? request.quantity : null,
      lineId: request !== null && 'lineId' in request ? request.lineId : null,
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
        // A read answers with the carts as they were when it was made, even if it is held and released later.
        const asked = carts;
        await enter('getCarts', scope, null);
        return { value: asked, receivedAt: Date.now(), provenance: 'FIXTURE' };
      },
      addLine: async (request) => {
        await enter('addLine', scope, request);
        lines += 1;
        return { lineId: asLineId(`DEMO-LINE-${lines}`) };
      },
      setQuantity: async (request) => {
        await enter('setQuantity', scope, request);
      },
      removeLine: async (request) => {
        await enter('removeLine', scope, request);
      },
    }),
  };

  return {
    adapter,
    calls,
    setCarts: (next: CartSet) => void (carts = next),
    /** The next call of this operation rejects with `error`. */
    failNext: (op: StubOp, error: unknown) => void failures[op].push(error),
    /** The next call of this operation waits (after it is recorded) until released. */
    hold: (op: StubOp): Held => {
      let release: () => void = () => undefined;
      holds[op].push(new Promise<void>((resolve) => (release = resolve)));
      return { release: () => release() };
    },
  };
}
