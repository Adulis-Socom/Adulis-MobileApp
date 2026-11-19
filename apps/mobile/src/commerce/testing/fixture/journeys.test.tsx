import { onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useAddToCart, useCarts } from '../../cart/hooks';
import type { VariantId } from '../../cart/model';
import type { CartViewState } from '../../cart/view-state';
import { renderWithCommerce } from '../harness';
import { createFixtureWorld } from './adapter';
import { A_BOWL, A_SHIRT_LARGE, A_SHIRT_SMALL, B_LAMP, B_MUG } from './scenarios';

jest.mock('expo-secure-store', () => jest.requireActual('../../../testing/secure-store-mock'));

/**
 * The cart hooks against the simulator, end to end, with plain text probes and no styled screen: Seller
 * carts, duplicate adds, an unconfirmed add that was committed, signing in and out, what the server
 * reports. The simulator plays the server and is labelled a fixture; nothing here is a real Product or a
 * real server answer.
 */
const renders: string[] = [];
const adds = new Map<string, ReturnType<typeof useAddToCart>>();
const refresh: { current: (() => void) | null } = { current: null };

const dump = (view: CartViewState): string => {
  if (view.kind !== 'LISTED') return view.kind;
  const carts = view.carts.carts
    .map((cart) => {
      const lines = cart.lines
        .map((l) => `${l.name} ${l.option ?? ''} x${l.quantity} @${l.unitPrice?.amountMinor}${l.issues.length ? ` !${l.issues.join('+')}` : ''}${l.previousUnitPrice ? ` was ${l.previousUnitPrice.amountMinor}` : ''}`)
        .join('; ');
      return `${cart.handle}[${lines}]${cart.subtotal ? ` sub ${cart.subtotal.amountMinor}` : ''}`;
    })
    .join(' | ');
  return `LISTED:${view.freshness.kind} ${carts}`;
};

function CartsDump() {
  const { view, refresh: reread } = useCarts({ focused: true });
  refresh.current = reread;
  const text = dump(view);
  renders.push(text);
  return <Text testID="carts">{text}</Text>;
}
function AddFor({ variant }: { variant: VariantId }) {
  const handle = useAddToCart(variant);
  adds.set(variant, handle);
  return <Text testID={`add-${variant}`}>{handle.state.kind}</Text>;
}

const tapAdd = (variant: VariantId, quantity = 1) =>
  act(async () => {
    adds.get(variant)!.add(quantity);
  });
const carts = () => screen.getByTestId('carts');
const addState = (variant: VariantId) => screen.getByTestId(`add-${variant}`);
const contains = { exact: false } as const;

beforeEach(() => {
  renders.length = 0;
  adds.clear();
  refresh.current = null;
});
afterEach(() => {
  onlineManager.setOnline(true);
});

describe('several Sellers, Products and options', () => {
  it('keeps each Seller\'s lines in its own cart, in the order the server lists them', async () => {
    const world = createFixtureWorld();
    await renderWithCommerce(
      <>
        <CartsDump />
        <AddFor variant={A_SHIRT_SMALL} />
        <AddFor variant={A_SHIRT_LARGE} />
        <AddFor variant={A_BOWL} />
        <AddFor variant={B_MUG} />
      </>,
      { adapter: world.adapter, token: null },
    );
    await waitFor(() => expect(carts()).toHaveTextContent('LISTED:VERIFIED', contains));
    await tapAdd(A_SHIRT_SMALL);
    await waitFor(() => expect(addState(A_SHIRT_SMALL)).toHaveTextContent('ADDED'));
    await tapAdd(B_MUG);
    await tapAdd(A_BOWL);
    await tapAdd(A_SHIRT_LARGE, 2);
    await waitFor(() => expect(addState(A_SHIRT_LARGE)).toHaveTextContent('ADDED'));
    await waitFor(() =>
      expect(carts()).toHaveTextContent(
        'LISTED:VERIFIED demo-seller-a[Demo shirt size=s x1 @120000; Demo bowl default x1 @45000; Demo shirt size=l x2 @130000] | demo-seller-b[Demo mug default x1 @30000]',
      ),
    );
  });

  it('adds a second deliberate add of the same option to its line, or draws two lines when the server makes two', async () => {
    const merging = createFixtureWorld();
    await renderWithCommerce(
      <>
        <CartsDump />
        <AddFor variant={A_BOWL} />
      </>,
      { adapter: merging.adapter, token: null },
    );
    await tapAdd(A_BOWL, 1);
    await waitFor(() => expect(addState(A_BOWL)).toHaveTextContent('ADDED'));
    await tapAdd(A_BOWL, 2);
    await waitFor(() => expect(carts()).toHaveTextContent('demo-seller-a[Demo bowl default x3 @45000]', contains));
    expect(merging.server.calls.filter((c) => c.op === 'addLine').map((c) => c.key)).toHaveLength(2);
    const [first, second] = merging.server.calls.filter((c) => c.op === 'addLine');
    expect(second?.key).not.toBe(first?.key);
  });

  it('draws the server\'s two lines for one option as two lines, and merges nothing itself', async () => {
    const separate = createFixtureWorld({ mergeDuplicates: false });
    await renderWithCommerce(
      <>
        <CartsDump />
        <AddFor variant={A_BOWL} />
      </>,
      { adapter: separate.adapter, token: null },
    );
    await tapAdd(A_BOWL, 1);
    await waitFor(() => expect(addState(A_BOWL)).toHaveTextContent('ADDED'));
    await tapAdd(A_BOWL, 2);
    await waitFor(() => expect(carts()).toHaveTextContent('demo-seller-a[Demo bowl default x1 @45000; Demo bowl default x2 @45000]', contains));
  });
});

describe('an add whose answer was lost after the server committed it', () => {
  it('is unknown, and trying again with the same key returns the stored answer: one line, not two', async () => {
    const world = createFixtureWorld();
    await renderWithCommerce(
      <>
        <CartsDump />
        <AddFor variant={A_SHIRT_SMALL} />
      </>,
      { adapter: world.adapter, token: null },
    );
    world.server.failNext('addLine', { kind: 'unexpected', status: 502, afterCommit: true });
    await tapAdd(A_SHIRT_SMALL, 2);
    await waitFor(() => expect(addState(A_SHIRT_SMALL)).toHaveTextContent('UNKNOWN'));
    // The re-read after an unknown add shows what the server really holds.
    await waitFor(() => expect(carts()).toHaveTextContent('demo-seller-a[Demo shirt size=s x2 @120000]', contains));
    await act(async () => adds.get(A_SHIRT_SMALL)!.retry());
    await waitFor(() => expect(addState(A_SHIRT_SMALL)).toHaveTextContent('ADDED'));
    const sent = world.server.calls.filter((c) => c.op === 'addLine');
    expect(sent.map((c) => c.key)).toEqual([sent[0]?.key, sent[0]?.key]);
    await waitFor(() => expect(carts()).toHaveTextContent('demo-seller-a[Demo shirt size=s x2 @120000]', contains));
    expect(world.server.carts(world.actor()).carts[0]?.lines).toHaveLength(1);
  });
});

describe('signing in and out', () => {
  const seed = (world: ReturnType<typeof createFixtureWorld>, actor: string, variantId: VariantId, key: string) =>
    world.server.addLine({ actor }, { variantId, quantity: 1, idempotencyKey: key });

  it('shows nothing of the earlier account, and ignores an answer the earlier account was still waiting for', async () => {
    const world = createFixtureWorld();
    await seed(world, 'ACCOUNT:A', A_SHIRT_SMALL, 'seed-a');
    await seed(world, 'ACCOUNT:B', B_MUG, 'seed-b');
    world.asAccount('A');
    const held = world.server.pause('getCarts');
    const { session } = await renderWithCommerce(<CartsDump />, { adapter: world.adapter, token: 'token-a' });
    await waitFor(() => expect(world.server.calls.filter((c) => c.op === 'getCarts')).toHaveLength(1));
    expect(carts()).toHaveTextContent('LOADING');

    // A signs out and B signs in while A's read waits.
    world.asGuest();
    await act(() => session.current!.clearSession());
    world.asAccount('B');
    await act(() => session.current!.signIn('token-b'));
    await waitFor(() => expect(carts()).toHaveTextContent('demo-seller-b[Demo mug default x1 @30000]', contains));
    renders.length = 0;
    await act(async () => held.release());
    await waitFor(() => expect(carts()).toHaveTextContent('demo-seller-b[Demo mug default x1 @30000]', contains));

    // A's read was made as A, answered for A, and never reached the screen.
    const reads = world.server.calls.filter((c) => c.op === 'getCarts');
    expect(reads[0]).toMatchObject({ actorAtSend: 'ACCOUNT:A', actorAtProcess: 'ACCOUNT:A' });
    expect(reads.slice(1).every((c) => c.actorAtSend !== 'ACCOUNT:A')).toBe(true);
    expect(renders.some((text) => text.includes('Demo shirt'))).toBe(false);
  });

  it.each([
    ['ADOPT_IF_EMPTY', false, 'LISTED:VERIFIED demo-seller-a[Demo shirt size=s x1 @120000]'],
    ['DROP_GUEST', false, 'LISTED:VERIFIED'],
    ['UNRESOLVED_CONFLICT', true, 'LISTED:VERIFIED demo-seller-a[Demo bowl default x1 @45000] | demo-seller-a[Demo shirt size=s x1 @120000]'],
  ] as const)('a guest cart then a sign-in under %s: the guest answer is dropped and the server\'s answer is what is drawn', async (policy, accountHasCart, expected) => {
    const world = createFixtureWorld({ adoption: policy });
    if (accountHasCart) await seed(world, 'ACCOUNT:A', A_BOWL, 'seed-a');
    const { session } = await renderWithCommerce(
      <>
        <CartsDump />
        <AddFor variant={A_SHIRT_SMALL} />
      </>,
      { adapter: world.adapter, token: null },
    );
    await waitFor(() => expect(carts()).toHaveTextContent('LISTED:VERIFIED', contains));
    await tapAdd(A_SHIRT_SMALL);
    await waitFor(() => expect(carts()).toHaveTextContent('demo-seller-a[Demo shirt size=s x1 @120000]', contains));

    renders.length = 0;
    world.asAccount('A');
    await act(() => session.current!.signIn('token-a'));
    // The first thing drawn for the new session is a load, never the guest's answer.
    expect(renders[0]).toBe('LOADING');
    await waitFor(() => expect((carts().props.children as string).trim()).toBe(expected));
  });
});

describe('what the server reports', () => {
  it('shows an add the server accepted for an option that is sold out, with the server\'s reason, never as fine', async () => {
    const world = createFixtureWorld();
    world.server.setQuantityAvailable(B_LAMP, 0);
    await renderWithCommerce(
      <>
        <CartsDump />
        <AddFor variant={B_LAMP} />
      </>,
      { adapter: world.adapter, token: null },
    );
    await tapAdd(B_LAMP);
    await waitFor(() => expect(carts()).toHaveTextContent('demo-seller-b[Demo lamp default x1 @250000 !SOLD_OUT]', contains));
  });

  it('ends an add the server refused as refused, and reads nothing into it', async () => {
    const world = createFixtureWorld({ refuseUnavailableAdds: true });
    world.server.setQuantityAvailable(B_LAMP, 0);
    await renderWithCommerce(<AddFor variant={B_LAMP} />, { adapter: world.adapter, token: null });
    await tapAdd(B_LAMP);
    await waitFor(() => expect(addState(B_LAMP)).toHaveTextContent('REFUSED'));
    expect(world.server.carts(world.actor()).carts).toEqual([]);
  });

  it('draws the server\'s previous price only when the server reports a change, and otherwise just the new price', async () => {
    const reporting = createFixtureWorld({ reportPriceChanges: true });
    await renderWithCommerce(
      <>
        <CartsDump />
        <AddFor variant={A_BOWL} />
      </>,
      { adapter: reporting.adapter, token: null },
    );
    await tapAdd(A_BOWL);
    await waitFor(() => expect(carts()).toHaveTextContent('Demo bowl default x1 @45000', contains));
    reporting.server.setPrice(A_BOWL, 50000);
    await act(async () => refresh.current!());
    await waitFor(() => expect(carts()).toHaveTextContent('@50000 !PRICE_CHANGED was 45000', contains));
  });

  it('shows a changed price as just the new price when the server does not report changes', async () => {
    const quiet = createFixtureWorld();
    await renderWithCommerce(
      <>
        <CartsDump />
        <AddFor variant={A_BOWL} />
      </>,
      { adapter: quiet.adapter, token: null },
    );
    await tapAdd(A_BOWL);
    await waitFor(() => expect(carts()).toHaveTextContent('Demo bowl default x1 @45000', contains));
    quiet.server.setPrice(A_BOWL, 50000);
    await act(async () => refresh.current!());
    await waitFor(() => expect(carts()).toHaveTextContent('Demo bowl default x1 @50000', contains));
    expect(carts().props.children as string).not.toContain('PRICE_CHANGED');
  });

  it('draws a Seller subtotal only when the server sends one, and never a total across Sellers', async () => {
    const world = createFixtureWorld({ serverSubtotal: true });
    await renderWithCommerce(
      <>
        <CartsDump />
        <AddFor variant={A_BOWL} />
        <AddFor variant={B_MUG} />
      </>,
      { adapter: world.adapter, token: null },
    );
    await tapAdd(A_BOWL, 2);
    await tapAdd(B_MUG, 1);
    await waitFor(() => expect(carts()).toHaveTextContent('demo-seller-a[Demo bowl default x2 @45000] sub 90000 | demo-seller-b[Demo mug default x1 @30000] sub 30000', contains));
  });
});
