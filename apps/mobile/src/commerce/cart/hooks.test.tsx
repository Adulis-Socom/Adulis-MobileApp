import { onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text, type AppStateStatus } from 'react-native';

import { disabledCartAdapter } from '../adapters/disabled';
import { apiProblem, gatewayPage, offline } from '../testing/api-errors';
import { renderWithCommerce } from '../testing/harness';
import { stubAdapter } from '../testing/stub-adapter';
import { cartsKey, shouldRetryRead, useAddToCart, useCarts } from './hooks';
import { asLineId, asSellerKey, asVariantId, type CartSet } from './model';
import { ScopeChanged } from './port';
import type { CartViewState } from './view-state';

jest.mock('expo-secure-store', () => jest.requireActual('../../testing/secure-store-mock'));

const V1 = asVariantId('de000000-0000-4000-8000-000000000001');

const oneCart = (): CartSet => ({
  carts: [
    {
      key: asSellerKey('seller-a'),
      handle: 'demo-seller',
      storeName: 'Demo Seller',
      lines: [
        {
          lineId: asLineId('DEMO-LINE-A'),
          variantId: V1,
          quantity: 1,
          name: 'Demo item',
          option: null,
          productSlug: null,
          imageKey: null,
          unitPrice: { amountMinor: 1000, currency: 'ETB' },
          previousUnitPrice: null,
          availableQuantity: null,
          issues: [],
        },
      ],
      subtotal: null,
    },
  ],
  checkedAt: null,
});

const label = (view: CartViewState): string => {
  switch (view.kind) {
    case 'DISABLED':
      return `DISABLED:${view.reason}`;
    case 'LOADING':
      return view.waitingForConnection ? 'LOADING:waiting' : 'LOADING';
    case 'ERROR':
      return 'ERROR';
    case 'LISTED':
      return `LISTED:${view.freshness.kind}${view.freshness.kind === 'UNVERIFIED' ? `:${view.freshness.why}` : ''}:${view.carts.carts.length}`;
  }
};

type CartsHandle = { current: { refresh: () => void } | null };
function Carts({
  name = 'carts',
  focused = true,
  handle,
}: {
  name?: string;
  focused?: boolean;
  handle?: CartsHandle;
}) {
  const { view, refresh } = useCarts({ focused });
  if (handle) handle.current = { refresh };
  return <Text testID={`view-${name}`}>{label(view)}</Text>;
}

type AddHandle = { current: ReturnType<typeof useAddToCart> | null };
function Add({ handle }: { handle: AddHandle }) {
  const hook = useAddToCart(V1);
  handle.current = hook;
  return <Text testID="add-state">{hook.state.kind}</Text>;
}

const view = (name = 'carts') => screen.getByTestId(`view-${name}`);
const addState = () => screen.getByTestId('add-state');
const reads = (stub: ReturnType<typeof stubAdapter>) =>
  stub.calls.filter((c) => c.op === 'getCarts');
const sends = (stub: ReturnType<typeof stubAdapter>) =>
  stub.calls.filter((c) => c.op === 'addLine');

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('which reads are repeated', () => {
  it('repeats only a failure of the network, and at most twice', () => {
    expect(shouldRetryRead(0, offline())).toBe(true);
    expect(shouldRetryRead(1, offline())).toBe(true);
    expect(shouldRetryRead(2, offline())).toBe(false);
    expect(shouldRetryRead(0, apiProblem(500, 'INTERNAL'))).toBe(false);
    expect(shouldRetryRead(0, new Error('x'))).toBe(false);
  });
});

describe('reading the carts', () => {
  it("loads, then lists the answer as the server's last word", async () => {
    const stub = stubAdapter();
    stub.setCarts(oneCart());
    await renderWithCommerce(<Carts />, { adapter: stub.adapter, token: 'token-a' });
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
    expect(reads(stub)).toHaveLength(1);
  });

  it('is DISABLED, reads nothing and sends nothing, with the disabled adapter', async () => {
    const original = globalThis.fetch;
    const fetchMock = jest.fn(() => Promise.reject(new Error('no network is allowed')));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      await renderWithCommerce(<Carts />, { adapter: disabledCartAdapter, token: 'token-a' });
      expect(view()).toHaveTextContent('DISABLED:ADAPTER_DISABLED');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
    }
  });

  it('shows an error for a first read the server refused, and nothing of a cart', async () => {
    const stub = stubAdapter();
    stub.failNext('getCarts', apiProblem(500, 'INTERNAL'));
    await renderWithCommerce(<Carts />, { adapter: stub.adapter, token: 'token-a' });
    await waitFor(() => expect(view()).toHaveTextContent('ERROR'));
  });

  it('two screens showing the carts share ONE read', async () => {
    const stub = stubAdapter();
    stub.setCarts(oneCart());
    await renderWithCommerce(
      <>
        <Carts name="one" />
        <Carts name="two" />
      </>,
      { adapter: stub.adapter, token: 'token-a' },
    );
    await waitFor(() => expect(view('one')).toHaveTextContent('LISTED:VERIFIED:1'));
    expect(view('two')).toHaveTextContent('LISTED:VERIFIED:1');
    expect(reads(stub)).toHaveLength(1);
  });

  it('reads again as the new scope after a sign-in, and an answer for the old scope is not kept', async () => {
    const stub = stubAdapter();
    stub.setCarts(oneCart());
    const held = stub.hold('getCarts');
    const { session, queryClient } = await renderWithCommerce(<Carts />, {
      adapter: stub.adapter,
      token: null,
    });
    await waitFor(() => expect(reads(stub)).toHaveLength(1));
    expect(reads(stub)[0]).toMatchObject({ scopeKind: 'guest', epoch: 1 });
    expect(view()).toHaveTextContent('LOADING');

    await act(() => session.current!.signIn('token-b'));
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
    expect(reads(stub)[1]).toMatchObject({ scopeKind: 'account', epoch: 2 });

    // The guest read finishes after the sign-in: the account on screen is untouched and the guest answer is not cached.
    await act(async () => held.release());
    expect(view()).toHaveTextContent('LISTED:VERIFIED:1');
    expect(queryClient.getQueryData(['commerce', 'carts', 'guest', 1])).toBeUndefined();
  });

  it('shows nothing of a scope that has ended: a sign-out starts a new read as the guest', async () => {
    const stub = stubAdapter();
    stub.setCarts(oneCart());
    const { session } = await renderWithCommerce(<Carts />, {
      adapter: stub.adapter,
      token: 'token-a',
    });
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
    stub.setCarts({ carts: [], checkedAt: null });
    await act(() => session.current!.clearSession());
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:0'));
    expect(reads(stub).map((c) => [c.scopeKind, c.epoch])).toEqual([
      ['account', 1],
      ['guest', 2],
    ]);
  });
});

describe('revalidation', () => {
  it('asks again on a pull, as a new read', async () => {
    const stub = stubAdapter();
    stub.setCarts(oneCart());
    const handle: CartsHandle = { current: null };
    await renderWithCommerce(<Carts handle={handle} />, {
      adapter: stub.adapter,
      token: 'token-a',
    });
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
    await act(async () => handle.current!.refresh());
    await waitFor(() => expect(reads(stub)).toHaveLength(2));
  });

  it('asks again when the connection returns, once, and not before', async () => {
    const stub = stubAdapter();
    stub.setCarts(oneCart());
    await renderWithCommerce(<Carts />, { adapter: stub.adapter, token: 'token-a' });
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
    await act(async () => onlineManager.setOnline(false));
    expect(reads(stub)).toHaveLength(1);
    await act(async () => onlineManager.setOnline(true));
    await waitFor(() => expect(reads(stub)).toHaveLength(2));
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
    expect(reads(stub)).toHaveLength(2);
  });

  it('waits for a connection for a first read, and says so, instead of showing an empty cart', async () => {
    const stub = stubAdapter();
    stub.setCarts(oneCart());
    onlineManager.setOnline(false);
    await renderWithCommerce(<Carts />, { adapter: stub.adapter, token: 'token-a' });
    expect(view()).toHaveTextContent('LOADING:waiting');
    expect(reads(stub)).toHaveLength(0);
    await act(async () => onlineManager.setOnline(true));
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
  });

  it('withholds the answer while a re-read waits for a connection, and trusts it again once a new answer lands', async () => {
    const stub = stubAdapter();
    stub.setCarts(oneCart());
    const handle: CartsHandle = { current: null };
    await renderWithCommerce(<Carts handle={handle} />, {
      adapter: stub.adapter,
      token: 'token-a',
    });
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
    await act(async () => onlineManager.setOnline(false));
    await act(async () => handle.current!.refresh());
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:UNVERIFIED:offline:1'));
    await act(async () => onlineManager.setOnline(true));
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
  });

  it('withholds the answer when a re-read failed', async () => {
    const stub = stubAdapter();
    stub.setCarts(oneCart());
    const handle: CartsHandle = { current: null };
    await renderWithCommerce(<Carts handle={handle} />, {
      adapter: stub.adapter,
      token: 'token-a',
    });
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
    stub.failNext('getCarts', apiProblem(500, 'INTERNAL'));
    await act(async () => handle.current!.refresh());
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:UNVERIFIED:failed:1'));
  });

  it('asks again on regaining focus, and not for the first focus', async () => {
    const stub = stubAdapter();
    stub.setCarts(oneCart());
    const { show } = await renderWithCommerce(<Carts focused={false} />, {
      adapter: stub.adapter,
      token: 'token-a',
    });
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
    expect(reads(stub)).toHaveLength(1);
    await show(<Carts focused />);
    await waitFor(() => expect(reads(stub)).toHaveLength(2));
  });

  describe('returning from the background', () => {
    let listeners: Array<(state: AppStateStatus) => void> = [];
    let appState: jest.SpyInstance;
    let original: ((...args: never[]) => unknown) | undefined;
    let skew = 0;
    let clock: jest.SpyInstance;
    const goTo = (state: AppStateStatus) =>
      act(async () => {
        for (const listener of [...listeners]) listener(state);
      });

    beforeEach(() => {
      listeners = [];
      skew = 0;
      const real = Date.now.bind(Date);
      clock = jest.spyOn(Date, 'now').mockImplementation(() => real() + skew);
      appState = jest.spyOn(AppState, 'addEventListener');
      original = appState.getMockImplementation();
      appState.mockImplementation((type, listener) => {
        if (type === 'change') listeners.push(listener as (state: AppStateStatus) => void);
        return {
          remove: () => (listeners = listeners.filter((l) => l !== listener)),
        } as ReturnType<typeof AppState.addEventListener>;
      });
    });
    afterEach(() => {
      // The platform mock has its own implementation: put it back rather than resetting it.
      if (original) appState.mockImplementation(original);
      clock.mockRestore();
    });

    it('withholds the answer at once after the freshness interval, asks again, and draws the new one when it lands', async () => {
      const stub = stubAdapter();
      stub.setCarts(oneCart());
      await renderWithCommerce(<Carts />, { adapter: stub.adapter, token: 'token-a' });
      await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));

      const held = stub.hold('getCarts');
      await goTo('background');
      skew += 6 * 60_000;
      await goTo('active');
      await waitFor(() => expect(view()).toHaveTextContent('LISTED:UNVERIFIED:checking:1'));
      await waitFor(() => expect(reads(stub)).toHaveLength(2));
      await act(async () => held.release());
      await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
    });

    it('keeps drawing the answer for a short stay in the background', async () => {
      const stub = stubAdapter();
      stub.setCarts(oneCart());
      await renderWithCommerce(<Carts />, { adapter: stub.adapter, token: 'token-a' });
      await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
      await goTo('background');
      skew += 30_000;
      await goTo('active');
      expect(view()).toHaveTextContent('LISTED:VERIFIED:1');
      expect(reads(stub)).toHaveLength(1);
    });
  });
});

describe('adding a line', () => {
  it('is unavailable with the disabled adapter, and sends nothing', async () => {
    const handle: AddHandle = { current: null };
    await renderWithCommerce(<Add handle={handle} />, {
      adapter: disabledCartAdapter,
      token: 'token-a',
    });
    expect(handle.current!.add(1)).toBe('unavailable');
    expect(addState()).toHaveTextContent('IDLE');
  });

  it('refuses a quantity that is not a positive whole number', async () => {
    const stub = stubAdapter();
    const handle: AddHandle = { current: null };
    await renderWithCommerce(<Add handle={handle} />, { adapter: stub.adapter, token: 'token-a' });
    for (const quantity of [0, -2, 1.5, 2 ** 53, 1e21, Number.NaN])
      expect(handle.current!.add(quantity)).toBe('invalid');
    expect(sends(stub)).toHaveLength(0);
  });

  it('sends one request for a double tap, with one key', async () => {
    const stub = stubAdapter();
    const handle: AddHandle = { current: null };
    await renderWithCommerce(<Add handle={handle} />, { adapter: stub.adapter, token: 'token-a' });
    const release = stub.hold('addLine');
    let outcomes: string[] = [];
    await act(async () => {
      outcomes = [handle.current!.add(2), handle.current!.add(2), handle.current!.add(5)];
    });
    expect(outcomes).toEqual(['started', 'same', 'ignored']);
    expect(sends(stub)).toHaveLength(1);
    await act(async () => release.release());
    await waitFor(() => expect(addState()).toHaveTextContent('ADDED'));
    expect(sends(stub)).toHaveLength(1);
    expect(sends(stub)[0]).toMatchObject({ variantId: V1, quantity: 2 });
  });

  it('sends nothing while the device is known to be offline, and queues nothing', async () => {
    const stub = stubAdapter();
    const handle: AddHandle = { current: null };
    await renderWithCommerce(<Add handle={handle} />, { adapter: stub.adapter, token: 'token-a' });
    await act(async () => onlineManager.setOnline(false));
    let outcome = '';
    await act(async () => {
      outcome = handle.current!.add(1);
    });
    expect(outcome).toBe('offline');
    expect(addState()).toHaveTextContent('OFFLINE_NOT_SENT');
    // The connection returning sends nothing by itself.
    await act(async () => onlineManager.setOnline(true));
    await act(async () => undefined);
    expect(sends(stub)).toHaveLength(0);
    expect(addState()).toHaveTextContent('OFFLINE_NOT_SENT');
    // Only the Buyer trying again sends it.
    await act(async () => handle.current!.retry());
    await waitFor(() => expect(addState()).toHaveTextContent('ADDED'));
    expect(sends(stub)).toHaveLength(1);
  });

  it('an unconfirmed add is UNKNOWN, never failed or added, and trying again sends the SAME key and body', async () => {
    const stub = stubAdapter();
    const handle: AddHandle = { current: null };
    await renderWithCommerce(<Add handle={handle} />, { adapter: stub.adapter, token: 'token-a' });
    stub.failNext('addLine', gatewayPage(502));
    await act(async () => {
      handle.current!.add(3);
    });
    await waitFor(() => expect(addState()).toHaveTextContent('UNKNOWN'));
    await act(async () => handle.current!.retry());
    await waitFor(() => expect(addState()).toHaveTextContent('ADDED'));
    const [first, second] = sends(stub);
    expect(second?.key).toBe(first?.key);
    expect(second).toMatchObject({ variantId: V1, quantity: 3 });
  });

  it('a key that was already used is UNRESOLVED and has no retry', async () => {
    const stub = stubAdapter();
    const handle: AddHandle = { current: null };
    await renderWithCommerce(<Add handle={handle} />, { adapter: stub.adapter, token: 'token-a' });
    stub.failNext('addLine', apiProblem(409, 'IDEMPOTENCY_KEY_REUSED'));
    await act(async () => {
      handle.current!.add(1);
    });
    await waitFor(() => expect(addState()).toHaveTextContent('UNRESOLVED'));
    await act(async () => handle.current!.retry());
    expect(sends(stub)).toHaveLength(1);
    expect(addState()).toHaveTextContent('UNRESOLVED');
  });

  it('does not begin another add over one that could not be resolved: only dismissing it starts over, with a new key', async () => {
    const stub = stubAdapter();
    const handle: AddHandle = { current: null };
    await renderWithCommerce(<Add handle={handle} />, { adapter: stub.adapter, token: 'token-a' });
    stub.failNext('addLine', apiProblem(409, 'IDEMPOTENCY_KEY_REUSED'));
    await act(async () => {
      handle.current!.add(2);
    });
    await waitFor(() => expect(addState()).toHaveTextContent('UNRESOLVED'));

    let outcome = '';
    await act(async () => {
      outcome = handle.current!.add(2);
    });
    expect(outcome).toBe('ignored');
    expect(sends(stub)).toHaveLength(1);
    expect(addState()).toHaveTextContent('UNRESOLVED');

    await act(async () => handle.current!.dismiss());
    expect(addState()).toHaveTextContent('IDLE');
    await act(async () => {
      outcome = handle.current!.add(2);
    });
    expect(outcome).toBe('started');
    await waitFor(() => expect(addState()).toHaveTextContent('ADDED'));
    expect(sends(stub)).toHaveLength(2);
    expect(sends(stub)[1]?.key).not.toBe(sends(stub)[0]?.key);
  });

  it('a port that refuses to send for a scope that is still current leaves an unknown outcome, never an add stuck sending', async () => {
    const stub = stubAdapter();
    const handle: AddHandle = { current: null };
    await renderWithCommerce(<Add handle={handle} />, { adapter: stub.adapter, token: 'token-a' });
    stub.failNext('addLine', new ScopeChanged());
    await act(async () => {
      handle.current!.add(1);
    });
    await waitFor(() => expect(addState()).toHaveTextContent('UNKNOWN'));
    await act(async () => handle.current!.retry());
    await waitFor(() => expect(addState()).toHaveTextContent('ADDED'));
    expect(sends(stub)).toHaveLength(2);
    expect(sends(stub)[1]?.key).toBe(sends(stub)[0]?.key);
  });

  it('a refusal by the API ends the add as REFUSED', async () => {
    const stub = stubAdapter();
    const handle: AddHandle = { current: null };
    await renderWithCommerce(<Add handle={handle} />, { adapter: stub.adapter, token: 'token-a' });
    stub.failNext('addLine', apiProblem(404, 'NOT_FOUND'));
    await act(async () => {
      handle.current!.add(1);
    });
    await waitFor(() => expect(addState()).toHaveTextContent('REFUSED'));
  });

  it('a stale screen cannot send for a session that has ended', async () => {
    const stub = stubAdapter();
    const handle: AddHandle = { current: null };
    const { session } = await renderWithCommerce(<Add handle={handle} />, {
      adapter: stub.adapter,
      token: 'token-a',
    });
    stub.failNext('addLine', gatewayPage(502));
    await act(async () => {
      handle.current!.add(1);
    });
    await waitFor(() => expect(addState()).toHaveTextContent('UNKNOWN'));
    // The Buyer's old screen still holds the functions it was drawn with.
    const stale = handle.current!;
    await act(() => session.current!.clearSession());
    await act(async () => {
      stale.retry();
      stale.add(1);
    });
    expect(sends(stub)).toHaveLength(1);
  });

  it("an answer for an add held across a sign-out never completes the next session's own add of the same option", async () => {
    const stub = stubAdapter();
    const handle: AddHandle = { current: null };
    const { session } = await renderWithCommerce(<Add handle={handle} />, {
      adapter: stub.adapter,
      token: 'token-a',
    });
    const heldBeforeSignOut = stub.hold('addLine');
    await act(async () => {
      handle.current!.add(1);
    });
    await waitFor(() => expect(sends(stub)).toHaveLength(1));

    await act(() => session.current!.clearSession());
    await act(() => session.current!.signIn('token-b'));
    expect(addState()).toHaveTextContent('IDLE');

    const heldAfterSignIn = stub.hold('addLine');
    await act(async () => {
      handle.current!.add(1);
    });
    await waitFor(() => expect(sends(stub)).toHaveLength(2));
    expect(addState()).toHaveTextContent('SENDING');
    expect(sends(stub)[1]).toMatchObject({ scopeKind: 'account', epoch: 3 });

    // The answer the earlier session was waiting for arrives now: it belongs to nobody on screen.
    await act(async () => heldBeforeSignOut.release());
    expect(addState()).toHaveTextContent('SENDING');
    await act(async () => heldAfterSignIn.release());
    await waitFor(() => expect(addState()).toHaveTextContent('ADDED'));
    expect(sends(stub)).toHaveLength(2);
    expect(sends(stub)[1]?.key).not.toBe(sends(stub)[0]?.key);
  });

  it('reads the carts again as a NEW request after an add: a read begun before the add is not the answer', async () => {
    const stub = stubAdapter();
    stub.setCarts(oneCart());
    const handle: AddHandle = { current: null };
    const carts: CartsHandle = { current: null };
    await renderWithCommerce(
      <>
        <Carts handle={carts} />
        <Add handle={handle} />
      </>,
      { adapter: stub.adapter, token: 'token-a' },
    );
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));

    // A read starts and is held: it began before the add.
    const early = stub.hold('getCarts');
    await act(async () => carts.current!.refresh());
    await waitFor(() => expect(reads(stub)).toHaveLength(2));

    await act(async () => {
      handle.current!.add(1);
    });
    await waitFor(() => expect(addState()).toHaveTextContent('ADDED'));
    // The read after the add is its own request.
    await waitFor(() => expect(reads(stub)).toHaveLength(3));
    await act(async () => early.release());
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
  });

  it('reads the carts again after a known refusal that says they changed', async () => {
    const stub = stubAdapter();
    stub.setCarts(oneCart());
    const handle: AddHandle = { current: null };
    await renderWithCommerce(
      <>
        <Carts />
        <Add handle={handle} />
      </>,
      { adapter: stub.adapter, token: 'token-a' },
    );
    await waitFor(() => expect(view()).toHaveTextContent('LISTED:VERIFIED:1'));
    stub.failNext('addLine', apiProblem(409, 'CART_SELLER_CONFLICT'));
    await act(async () => {
      handle.current!.add(1);
    });
    await waitFor(() => expect(addState()).toHaveTextContent('REFUSED_RELOAD'));
    await waitFor(() => expect(reads(stub)).toHaveLength(2));
  });

  it('keeps the carts in the cache under the key of the scope that asked', () => {
    expect(cartsKey({ kind: 'account', epoch: 3, isCurrent: () => true })).toEqual([
      'commerce',
      'carts',
      'account',
      3,
    ]);
  });
});
