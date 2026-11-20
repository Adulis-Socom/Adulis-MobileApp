import { act, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useCartEdit } from '../cart/edit-hooks';
import { useCarts } from '../cart/hooks';
import { applyItems, asLineId, findLine } from '../cart/model';
import { useCartReview } from '../cart/review-hooks';
import { offline } from '../testing/api-errors';
import { cartSet, line, sellerCart, serverItem } from '../testing/builders';
import { renderWithCommerce } from '../testing/harness';
import { stubAdapter } from '../testing/stub-adapter';
import { createRuntime } from './runtime';

jest.mock('expo-secure-store', () => jest.requireActual('../../testing/secure-store-mock'));

/** The matcher is an exact match by default; every assertion on a probe here is about a part of its text. */
const contains = { exact: false } as const;

const L1 = asLineId('line-1');
const account = (token: string) => ({ kind: 'account', token }) as const;
const holding = () => cartSet(sellerCart([line('line-1', { quantity: 2 })]));

describe('the runtime owns the edit and review stores', () => {
  it('empties both inside observe() when the identity changes, before any screen draws for the new one', () => {
    const runtime = createRuntime();
    runtime.observe(account('a'));
    const scope = runtime.scope!;
    runtime.edits.begin(
      scope,
      { kind: 'SET_QUANTITY', lineId: L1, quantity: 3 },
      { now: 1, online: true, mintKey: () => 'key-a' },
    );
    const answer = {
      carts: cartSet(applyItems(sellerCart([line('line-1')]), [serverItem()])),
      verified: true,
    };
    runtime.reviews.accept(scope, L1, findLine(answer.carts, L1)!.priceChangeRef as string, answer);
    expect(runtime.edits.read(scope, L1).kind).toBe('SENDING');
    expect(runtime.reviews.acceptedFor(scope, L1)).not.toBeNull();

    runtime.observe(account('b'));
    expect(runtime.edits.read(runtime.scope!, L1).kind).toBe('IDLE');
    expect(runtime.edits.read(scope, L1).kind).toBe('IDLE');
    expect(runtime.reviews.acceptedFor(runtime.scope!, L1)).toBeNull();
    expect(runtime.reviews.snapshot().size).toBe(0);
  });

  it('does not tell watchers while it clears, so a screen that is rendering is not updated', () => {
    const runtime = createRuntime();
    runtime.observe(account('a'));
    const told = jest.fn();
    runtime.edits.subscribe(told);
    runtime.reviews.subscribe(told);
    runtime.edits.begin(
      runtime.scope!,
      { kind: 'REMOVE', lineId: L1 },
      { now: 1, online: true, mintKey: () => 'key-a' },
    );
    told.mockClear();
    runtime.observe(account('b'));
    expect(told).not.toHaveBeenCalled();
  });
});

describe('an edit left unconfirmed by a screen that has gone', () => {
  type Handle = { current: ReturnType<typeof useCartEdit> | null };
  const handle: Handle = { current: null };
  function Edit() {
    const { view } = useCarts({ focused: true });
    const edit = useCartEdit(L1, view);
    handle.current = edit;
    return <Text testID="edit-state">{edit.state.kind}</Text>;
  }
  const state = () => screen.getByTestId('edit-state');
  const sent = (stub: ReturnType<typeof stubAdapter>) =>
    stub.calls.filter((c) => c.op === 'setQuantity');

  it('is gone after A signs out and B signs in with the screen unmounted in between, and is never sent as B', async () => {
    const stub = stubAdapter();
    stub.setCarts(holding());
    const { show, session } = await renderWithCommerce(<Edit />, {
      adapter: stub.adapter,
      token: 'token-a',
    });
    await waitFor(() => expect(state()).toHaveTextContent('IDLE', contains));
    await waitFor(() => expect(stub.calls.some((c) => c.op === 'getCarts')).toBe(true));

    stub.failNext('setQuantity', offline());
    await act(async () => {
      handle.current!.setQuantity(3);
    });
    await waitFor(() => expect(state()).toHaveTextContent('UNKNOWN', contains));
    const keyOfA = sent(stub)[0]!.key;

    await show(null);
    await act(() => session.current!.clearSession());
    await act(() => session.current!.signIn('token-b'));

    await show(<Edit />);
    await waitFor(() => expect(state()).toHaveTextContent('IDLE', contains));
    expect(sent(stub)).toHaveLength(1);

    // A fresh edit as B is a new intent with a new key, in B's scope.
    await waitFor(() => expect(handle.current).not.toBeNull());
    await act(async () => {
      handle.current!.setQuantity(3);
    });
    await waitFor(() => expect(sent(stub)).toHaveLength(2));
    expect(sent(stub)[1]!.key).not.toBe(keyOfA);
    expect(sent(stub)[1]).toMatchObject({ scopeKind: 'account', epoch: 3 });
  });

  it('is dropped for a screen that stays mounted, without that screen being updated while the provider renders', async () => {
    const stub = stubAdapter();
    stub.setCarts(holding());
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { session } = await renderWithCommerce(<Edit />, {
        adapter: stub.adapter,
        token: 'token-a',
      });
      await waitFor(() => expect(stub.calls.some((c) => c.op === 'getCarts')).toBe(true));
      await waitFor(() => expect(handle.current).not.toBeNull());
      stub.failNext('setQuantity', offline());
      await act(async () => {
        handle.current!.setQuantity(3);
      });
      await waitFor(() => expect(state()).toHaveTextContent('UNKNOWN', contains));
      await act(() => session.current!.clearSession());
      await waitFor(() => expect(state()).toHaveTextContent('IDLE', contains));
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

describe('two screens, one set of stores', () => {
  const handles: {
    first: ReturnType<typeof useCartEdit> | null;
    second: ReturnType<typeof useCartEdit> | null;
    review: ReturnType<typeof useCartReview> | null;
  } = { first: null, second: null, review: null };
  function Two() {
    const { view } = useCarts({ focused: true });
    const first = useCartEdit(L1, view);
    const second = useCartEdit(L1, view);
    const review = useCartReview(view);
    handles.first = first;
    handles.second = second;
    handles.review = review;
    return (
      <Text testID="two">
        {first.state.kind}/{second.state.kind}
      </Text>
    );
  }
  it('an edit begun through one hook instance is seen by the other, and a second begin joins it', async () => {
    const stub = stubAdapter();
    stub.setCarts(holding());
    await renderWithCommerce(<Two />, { adapter: stub.adapter, token: 'token-a' });
    await waitFor(() => expect(stub.calls.some((c) => c.op === 'getCarts')).toBe(true));
    await waitFor(() => expect(handles.first).not.toBeNull());
    const release = stub.hold('setQuantity');
    let outcomes: string[] = [];
    await act(async () => {
      outcomes = [handles.first!.setQuantity(3), handles.second!.setQuantity(3)];
    });
    expect(outcomes).toEqual(['started', 'same']);
    expect(screen.getByTestId('two')).toHaveTextContent('SENDING/SENDING', contains);
    expect(stub.calls.filter((c) => c.op === 'setQuantity')).toHaveLength(1);
    await act(async () => release.release());
  });
});
