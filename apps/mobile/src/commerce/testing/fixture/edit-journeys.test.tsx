import { act, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useCartEdit } from '../../cart/edit-hooks';
import { useCarts } from '../../cart/hooks';
import { findLine, type LineId } from '../../cart/model';
import { renderWithCommerce } from '../harness';
import { DEMO_DEVICE, createFixtureWorld } from './adapter';
import { A_BOWL, A_SHIRT_SMALL } from './scenarios';

jest.mock('expo-secure-store', () => jest.requireActual('../../../testing/secure-store-mock'));

/** The matcher is an exact match by default; every assertion on a probe here is about a part of its text. */
const contains = { exact: false } as const;

/**
 * The edit hooks against the simulator, end to end, with plain text probes and no styled screen. The
 * simulator plays the server and is labelled a fixture; nothing here is a real Product or a real answer.
 */
const GUEST = { actor: `DEVICE:${DEMO_DEVICE}` };
const frames: string[] = [];
let edit: ReturnType<typeof useCartEdit> | null = null;
let refresh: () => void = () => undefined;

function Probe({ lineId }: { lineId: LineId }) {
  const { view, refresh: reread } = useCarts({ focused: true });
  const editing = useCartEdit(lineId, view);
  edit = editing;
  refresh = reread;
  const line = view.kind === 'LISTED' ? findLine(view.carts, lineId) : null;
  const names =
    view.kind === 'LISTED'
      ? view.carts.carts.flatMap((c) => c.lines.map((l) => l.name)).join(',')
      : '';
  const frame = `${editing.state.kind} q=${line?.quantity ?? 'none'} [${names}]`;
  frames.push(frame);
  return <Text testID="probe">{frame}</Text>;
}
const probe = () => screen.getByTestId('probe');
const setCalls = (world: ReturnType<typeof createFixtureWorld>) =>
  world.server.calls.filter((c) => c.op === 'setQuantity');
const removeCalls = (world: ReturnType<typeof createFixtureWorld>) =>
  world.server.calls.filter((c) => c.op === 'removeLine');

beforeEach(() => {
  frames.length = 0;
  edit = null;
});

async function startGuest(options: Parameters<typeof createFixtureWorld>[0] = {}) {
  const world = createFixtureWorld(options);
  const { lineId } = await world.server.addLine(GUEST, {
    variantId: A_SHIRT_SMALL,
    quantity: 2,
    idempotencyKey: 'seed',
  });
  const rendered = await renderWithCommerce(<Probe lineId={lineId} />, {
    adapter: world.adapter,
    token: null,
  });
  await waitFor(() => expect(probe()).toHaveTextContent('IDLE q=2', contains));
  return { world, lineId, ...rendered };
}

describe('changing a quantity and removing a line', () => {
  it('confirms a quantity only when the read made after the edit shows it, naming the line and the number and nothing else', async () => {
    const { world, lineId } = await startGuest();
    await act(async () => {
      edit!.changeQuantity(5);
    });
    await waitFor(() => expect(probe()).toHaveTextContent('CONFIRMED q=5', contains));
    expect(setCalls(world)).toHaveLength(1);
    expect(setCalls(world)[0]).toMatchObject({ lineId, quantity: 5, variantId: null });
    // No frame claimed a change the carts on screen did not show.
    expect(frames.filter((f) => f.startsWith('CONFIRMED')).every((f) => f.includes('q=5'))).toBe(
      true,
    );
    expect(frames.some((f) => f.startsWith('CONFIRMED q=2'))).toBe(false);
  });

  it('removes a line: the row stays until the read no longer lists it, then the Seller cart is gone', async () => {
    const { world } = await startGuest();
    await act(async () => {
      edit!.remove();
    });
    await waitFor(() => expect(probe()).toHaveTextContent('CONFIRMED q=none', contains));
    expect(removeCalls(world)).toHaveLength(1);
    const applied = frames.findIndex((f) => f.startsWith('APPLIED'));
    if (applied >= 0) expect(frames[applied]).toContain('q=2');
    expect(world.server.carts(GUEST.actor).carts).toEqual([]);
  });
});

describe('a quantity the server will not take', () => {
  it('is sent as typed, and the server refusal is what is shown, with no Try again: the client sets no ceiling of its own', async () => {
    const { world } = await startGuest();
    await act(async () => {
      edit!.changeQuantity(100);
    });
    await waitFor(() => expect(probe()).toHaveTextContent('REFUSED', contains));
    expect(setCalls(world)).toHaveLength(1);
    expect(setCalls(world)[0]).toMatchObject({ quantity: 100 });
    await act(async () => edit!.retry());
    expect(setCalls(world)).toHaveLength(1);
    // The refusal stored nothing: the line still shows the server quantity.
    expect(probe()).toHaveTextContent('q=2', contains);
  });
});

describe('when the answer to an edit is lost', () => {
  it('reads first: a change that committed is found by the read, and nothing is sent again', async () => {
    const { world } = await startGuest();
    world.server.failNext('setQuantity', { kind: 'timeout', afterCommit: true });
    await act(async () => {
      edit!.changeQuantity(5);
    });
    await waitFor(() => expect(probe()).toHaveTextContent('CONFIRMED q=5', contains));
    expect(setCalls(world)).toHaveLength(1);
  });

  it('a removal that committed is found by the read too', async () => {
    const { world } = await startGuest();
    world.server.failNext('removeLine', { kind: 'unreadable-2xx' });
    await act(async () => {
      edit!.remove();
    });
    await waitFor(() => expect(probe()).toHaveTextContent('CONFIRMED q=none', contains));
    expect(removeCalls(world)).toHaveLength(1);
  });

  it('a change that did not commit stays unknown, and trying again sends the same key once more with one effect', async () => {
    const { world } = await startGuest();
    world.server.failNext('setQuantity', { kind: 'offline' });
    await act(async () => {
      edit!.changeQuantity(5);
    });
    await waitFor(() => expect(probe()).toHaveTextContent('UNKNOWN q=2', contains));
    await act(async () => edit!.retry());
    await waitFor(() => expect(probe()).toHaveTextContent('CONFIRMED q=5', contains));
    const [first, second] = setCalls(world);
    expect(second?.key).toBe(first?.key);
    expect(world.server.carts(GUEST.actor).carts[0]?.lines[0]?.quantity).toBe(5);
  });

  it('a line that left the cart under an edit ends as gone, never as removed by the Buyer', async () => {
    const { world, lineId } = await startGuest();
    await world.server.removeLine(GUEST, { lineId, idempotencyKey: 'elsewhere' });
    await act(async () => {
      edit!.changeQuantity(5);
    });
    await waitFor(() => expect(probe()).toHaveTextContent('LINE_GONE', contains));
    await waitFor(() => expect(probe()).toHaveTextContent('q=none', contains));
  });
});

describe('another device changes the same line', () => {
  it("an unknown edit stays unknown while the read shows another quantity, and the server's quantity is what is drawn", async () => {
    const { world, lineId } = await startGuest();
    world.server.failNext('setQuantity', { kind: 'offline' });
    await act(async () => {
      edit!.changeQuantity(5);
    });
    await waitFor(() => expect(probe()).toHaveTextContent('UNKNOWN q=2', contains));
    await world.server.setQuantity(GUEST, { lineId, quantity: 7, idempotencyKey: 'device-2' });
    await act(async () => refresh());
    await waitFor(() => expect(probe()).toHaveTextContent('UNKNOWN q=7', contains));
    expect(probe()).not.toHaveTextContent(/CONFIRMED|REFUSED/);
  });
});

describe('another Account', () => {
  async function startAs(accountId: string) {
    const world = createFixtureWorld();
    world.asAccount(accountId);
    const actor = `ACCOUNT:${accountId}`;
    const { lineId } = await world.server.addLine(
      { actor },
      { variantId: A_SHIRT_SMALL, quantity: 2, idempotencyKey: 'seed-a' },
    );
    await world.server.addLine(
      { actor: 'ACCOUNT:B' },
      { variantId: A_BOWL, quantity: 1, idempotencyKey: 'seed-b' },
    );
    const rendered = await renderWithCommerce(<Probe lineId={lineId} />, {
      adapter: world.adapter,
      token: 'token-a',
    });
    await waitFor(() => expect(probe()).toHaveTextContent('IDLE q=2', contains));
    return { world, lineId, actor, ...rendered };
  }

  it('shows the new Account nothing of the first: no frame after the switch draws its text, and a held edit is processed as the first Account', async () => {
    const { world, lineId, actor, session } = await startAs('A');
    const held = world.server.pause('setQuantity');
    await act(async () => {
      edit!.changeQuantity(5);
    });
    await waitFor(() => expect(setCalls(world)).toHaveLength(1));
    expect(setCalls(world)[0]).toMatchObject({ actorAtSend: actor });

    // A signs out; B signs in on the same device.
    const switchedAt = frames.length;
    world.asGuest();
    await act(() => session.current!.clearSession());
    world.asAccount('B');
    await act(() => session.current!.signIn('token-b'));
    await waitFor(() => expect(probe()).toHaveTextContent('[Demo bowl]', contains));
    // The first Account's held edit finishes now.
    await act(async () => held.release());
    await act(async () => undefined);

    expect(frames.slice(switchedAt).filter((f) => f.includes('Demo shirt'))).toEqual([]);
    expect(frames.slice(switchedAt).filter((f) => /APPLIED|CONFIRMED|UNKNOWN/.test(f))).toEqual([]);
    // It was processed as A, and B's cart is untouched.
    expect(setCalls(world)[0]).toMatchObject({ actorAtSend: actor, actorAtProcess: actor });
    expect(findLine(world.server.carts(actor), lineId)?.quantity).toBe(5);
    expect(world.server.carts('ACCOUNT:B').carts[0]?.lines[0]?.quantity).toBe(1);
    expect(probe()).toHaveTextContent('[Demo bowl]', contains);
  });

  it("never sends the first Account's unknown edit as the second", async () => {
    const { world, session } = await startAs('A');
    world.server.failNext('setQuantity', { kind: 'offline' });
    await act(async () => {
      edit!.changeQuantity(5);
    });
    await waitFor(() => expect(probe()).toHaveTextContent('UNKNOWN', contains));
    const stale = edit!;
    world.asGuest();
    await act(() => session.current!.clearSession());
    world.asAccount('B');
    await act(() => session.current!.signIn('token-b'));
    await waitFor(() => expect(probe()).toHaveTextContent('[Demo bowl]', contains));
    await act(async () => {
      stale.retry();
    });
    expect(probe()).toHaveTextContent('IDLE', contains);
    expect(setCalls(world)).toHaveLength(1);
    expect(setCalls(world).map((c) => c.actorAtSend)).toEqual(['ACCOUNT:A']);
  });
});
