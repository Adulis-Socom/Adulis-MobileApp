import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SessionProvider } from '../../auth/session';
import { disabledCartAdapter } from '../adapters/disabled';
import { cartsKey, useAddToCart } from '../cart/hooks';
import { asVariantId } from '../cart/model';
import { offline } from '../testing/api-errors';
import { fakeDeviceStorage, fakeSessionStorage, renderWithCommerce } from '../testing/harness';
import { stubAdapter } from '../testing/stub-adapter';
import { resolveAdapter, SHIPPED_COMMERCE_MODE } from './mode';
import { CommerceProvider, useCommerce, useCommerceContext } from './provider';
import { createRuntime } from './runtime';

jest.mock('expo-secure-store', () => jest.requireActual('../../testing/secure-store-mock'));

const V1 = asVariantId('de000000-0000-4000-8000-000000000001');

describe('the owner of the session scope', () => {
  const guest = { kind: 'guest', token: null } as const;
  const account = (token: string) => ({ kind: 'account', token }) as const;

  it('has no scope and epoch 0 until an identity is known', () => {
    const runtime = createRuntime();
    runtime.observe(null);
    expect(runtime.scope).toBeNull();
    expect(runtime.epoch).toBe(0);
  });

  it('numbers the first identity 1 and every change after it one more', () => {
    const runtime = createRuntime();
    const seen: Array<[string | undefined, number]> = [];
    for (const identity of [guest, account('a'), account('b'), guest]) {
      runtime.observe(identity);
      seen.push([runtime.scope?.kind, runtime.epoch]);
    }
    expect(seen).toEqual([
      ['guest', 1],
      ['account', 2],
      ['account', 3],
      ['guest', 4],
    ]);
  });

  it('does not change anything for an identity it already holds', () => {
    const runtime = createRuntime();
    runtime.observe(account('a'));
    const scope = runtime.scope;
    runtime.observe(account('a'));
    runtime.observe({ kind: 'account', token: 'a' });
    expect(runtime.scope).toBe(scope);
    expect(runtime.epoch).toBe(1);
  });

  it('ends the old scope the moment a new identity is seen, and keeps the new one current', () => {
    const runtime = createRuntime();
    runtime.observe(account('a'));
    const first = runtime.scope!;
    expect(first.isCurrent()).toBe(true);
    runtime.observe(account('b'));
    expect(first.isCurrent()).toBe(false);
    expect(runtime.scope!.isCurrent()).toBe(true);
    runtime.observe(null);
    expect(runtime.scope).toBeNull();
  });

  it('drops every pending add when the identity changes', () => {
    const runtime = createRuntime();
    runtime.observe(account('a'));
    const scope = runtime.scope!;
    runtime.intents.begin(
      scope,
      { variantId: V1, quantity: 1 },
      { now: 1, online: true, mintKey: () => 'key-a' },
    );
    expect(runtime.intents.read(scope, V1).kind).toBe('SENDING');
    runtime.observe(account('b'));
    expect(runtime.intents.read(runtime.scope!, V1).kind).toBe('IDLE');
    expect(runtime.intents.read(scope, V1).kind).toBe('IDLE');
  });
});

describe('which adapter is served', () => {
  const fixture = stubAdapter().adapter;

  it('serves a fixture adapter only when the build allows fixtures AND this is a development run', () => {
    expect(resolveAdapter({ requested: fixture, build: 'fixture', dev: true })).toBe(fixture);
    expect(resolveAdapter({ requested: fixture, build: 'fixture', dev: false })).toBe(
      disabledCartAdapter,
    );
    expect(resolveAdapter({ requested: fixture, build: 'disabled', dev: true })).toBe(
      disabledCartAdapter,
    );
    expect(resolveAdapter({ requested: fixture, build: 'disabled', dev: false })).toBe(
      disabledCartAdapter,
    );
  });

  it('serves a non-fixture adapter as it is', () => {
    expect(resolveAdapter({ requested: disabledCartAdapter, build: 'disabled', dev: false })).toBe(
      disabledCartAdapter,
    );
  });

  it('ships with the disabled mode', () => {
    expect(SHIPPED_COMMERCE_MODE).toBe('disabled');
  });
});

describe('the commerce provider', () => {
  function Mode() {
    return <Text testID="mode">{useCommerce().mode}</Text>;
  }

  it('is the disabled adapter outside any provider', async () => {
    await render(<Mode />);
    expect(screen.getByTestId('mode')).toHaveTextContent('disabled');
  });

  it('serves a fixture adapter when a test provider allows it', async () => {
    await renderWithCommerce(<Mode />, {
      adapter: stubAdapter().adapter,
      build: 'fixture',
      dev: true,
    });
    expect(screen.getByTestId('mode')).toHaveTextContent('fixture');
  });

  it('serves the disabled adapter to a fixture request in a release run', async () => {
    await renderWithCommerce(<Mode />, {
      adapter: stubAdapter().adapter,
      build: 'fixture',
      dev: false,
    });
    expect(screen.getByTestId('mode')).toHaveTextContent('disabled');
  });

  it('the production provider refuses a fixture adapter even in a development run', async () => {
    expect(__DEV__).toBe(true);
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider storage={fakeSessionStorage(null)} deviceStorage={fakeDeviceStorage()}>
          <CommerceProvider adapter={stubAdapter().adapter}>
            <Mode />
          </CommerceProvider>
        </SessionProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('disabled');
  });
});

describe('one scope for every screen', () => {
  const seen: Array<{
    name: string;
    kind: string | undefined;
    epoch: number | undefined;
    key: string;
  }> = [];
  function ScopeProbe({ name }: { name: string }) {
    const scope = useCommerceContext()?.scope ?? null;
    seen.push({
      name,
      kind: scope?.kind,
      epoch: scope?.epoch,
      key: scope ? JSON.stringify(cartsKey(scope)) : 'none',
    });
    return <Text testID={`scope-${name}`}>{scope ? `${scope.kind}:${scope.epoch}` : 'none'}</Text>;
  }
  const latest = (name: string) => [...seen].reverse().find((entry) => entry.name === name);

  beforeEach(() => {
    seen.length = 0;
  });

  it('two screens mounted at different times read the same scope and build the same cache key', async () => {
    const stub = stubAdapter();
    const { show } = await renderWithCommerce(<ScopeProbe name="early" />, {
      adapter: stub.adapter,
      token: 'token-a',
    });
    await waitFor(() => expect(screen.getByTestId('scope-early')).toHaveTextContent('account:1'));
    await show(
      <>
        <ScopeProbe name="early" />
        <ScopeProbe name="late" />
      </>,
    );
    expect(screen.getByTestId('scope-late')).toHaveTextContent('account:1');
    expect(latest('late')?.key).toBe(latest('early')?.key);
  });

  it('keeps one epoch across a re-render with the same credential, and under StrictMode', async () => {
    const stub = stubAdapter();
    const { session } = await renderWithCommerce(<ScopeProbe name="a" />, {
      adapter: stub.adapter,
      token: 'token-a',
      strict: true,
    });
    await waitFor(() => expect(screen.getByTestId('scope-a')).toHaveTextContent('account:1'));
    await act(() => session.current!.clearSession());
    await waitFor(() => expect(screen.getByTestId('scope-a')).toHaveTextContent('guest:2'));
    await act(() => session.current!.signIn('token-b'));
    await waitFor(() => expect(screen.getByTestId('scope-a')).toHaveTextContent('account:3'));
  });

  it('ends the scope a port was bound to when the session changes', async () => {
    const stub = stubAdapter();
    const scopes: Array<ReturnType<typeof useCommerceContext>> = [];
    function Capture() {
      scopes.push(useCommerceContext());
      return null;
    }
    const { session } = await renderWithCommerce(<Capture />, {
      adapter: stub.adapter,
      token: 'token-a',
    });
    await waitFor(() => expect(scopes.at(-1)?.scope?.kind).toBe('account'));
    const held = scopes.at(-1)!.scope!;
    expect(held.isCurrent()).toBe(true);
    await act(() => session.current!.clearSession());
    expect(held.isCurrent()).toBe(false);
  });
});

describe('an add left unconfirmed by a screen that has gone', () => {
  it('is gone after A signs out and B signs in with the screen unmounted in between, and is never sent as B', async () => {
    const stub = stubAdapter();
    const handle: { current: ReturnType<typeof useAddToCart> | null } = { current: null };
    function Add() {
      const hook = useAddToCart(V1);
      handle.current = hook;
      return <Text testID="add-state">{hook.state.kind}</Text>;
    }
    const { show, session } = await renderWithCommerce(<Add />, {
      adapter: stub.adapter,
      token: 'token-a',
    });
    await waitFor(() => expect(screen.getByTestId('add-state')).toHaveTextContent('IDLE'));

    stub.failNext('addLine', offline());
    await act(async () => {
      handle.current!.add(2);
    });
    await waitFor(() => expect(screen.getByTestId('add-state')).toHaveTextContent('UNKNOWN'));
    expect(stub.calls.filter((c) => c.op === 'addLine')).toHaveLength(1);
    const keyOfA = stub.calls.find((c) => c.op === 'addLine')!.key;

    // The screen goes away; A signs out; B signs in.
    await show(null);
    await act(() => session.current!.clearSession());
    await act(() => session.current!.signIn('token-b'));

    // A screen mounted afterwards finds nothing of A's add.
    await show(<Add />);
    await waitFor(() => expect(screen.getByTestId('add-state')).toHaveTextContent('IDLE'));
    expect(stub.calls.filter((c) => c.op === 'addLine')).toHaveLength(1);

    // A fresh add as B is a new intent with a new key, in B's scope.
    await act(async () => {
      handle.current!.add(2);
    });
    await waitFor(() => expect(screen.getByTestId('add-state')).toHaveTextContent('ADDED'));
    const sent = stub.calls.filter((c) => c.op === 'addLine');
    expect(sent).toHaveLength(2);
    expect(sent[1]!.key).not.toBe(keyOfA);
    expect(sent[1]).toMatchObject({ scopeKind: 'account', epoch: 3 });
  });

  it('is dropped for a screen that stays mounted, without that screen being updated while the provider renders', async () => {
    const stub = stubAdapter();
    const handle: { current: ReturnType<typeof useAddToCart> | null } = { current: null };
    function Add() {
      const hook = useAddToCart(V1);
      handle.current = hook;
      return <Text testID="add-state">{hook.state.kind}</Text>;
    }
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { session } = await renderWithCommerce(<Add />, {
        adapter: stub.adapter,
        token: 'token-a',
      });
      stub.failNext('addLine', offline());
      await act(async () => {
        handle.current!.add(1);
      });
      await waitFor(() => expect(screen.getByTestId('add-state')).toHaveTextContent('UNKNOWN'));
      await act(() => session.current!.clearSession());
      await waitFor(() => expect(screen.getByTestId('add-state')).toHaveTextContent('IDLE'));
      expect(
        errors.mock.calls
          .map((call) => String(call[0]))
          .filter((text) => text.includes('Cannot update a component')),
      ).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });
});
