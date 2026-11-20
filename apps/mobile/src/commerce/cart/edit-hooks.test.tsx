import { onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { disabledCartAdapter } from '../adapters/disabled';
import { apiProblem, gatewayPage, offline, proxyJson } from '../testing/api-errors';
import { cartSet, line, sellerCart, serverItem, V1, V2 } from '../testing/builders';
import { renderWithCommerce } from '../testing/harness';
import { stubAdapter } from '../testing/stub-adapter';
import { useCartEdit } from './edit-hooks';
import { useCarts } from './hooks';
import { applyItems, asLineId, findLine, type CartSet } from './model';
import { AdapterUnavailable, ScopeChanged } from './port';
import { useCartReview } from './review-hooks';
import type { CartViewState } from './view-state';

jest.mock('expo-secure-store', () => jest.requireActual('../../testing/secure-store-mock'));

/** The matcher is an exact match by default; every assertion on a probe here is about a part of its text. */
const contains = { exact: false } as const;

const L1 = asLineId('line-1');
const L2 = asLineId('line-2');

/** The carts the server holds: line 1 with this quantity, and line 2 of the same cart. */
const holding = (q1 = 2, q2 = 1): CartSet =>
  cartSet(
    sellerCart([
      line('line-1', { quantity: q1, variantId: V1 }),
      line('line-2', { quantity: q2, variantId: V2 }),
    ]),
  );
const without = (...ids: string[]): CartSet =>
  cartSet(sellerCart(holding().carts[0]!.lines.filter((l) => !ids.includes(l.lineId))));

type Handle = {
  current: {
    edit: ReturnType<typeof useCartEdit>;
    refresh: () => void;
    view: CartViewState;
  } | null;
};
const handles = new Map<string, Handle>();

const shown = (view: CartViewState, id: typeof L1) =>
  view.kind === 'LISTED' ? (findLine(view.carts, id)?.quantity ?? 'none') : view.kind;

function Probe({ lineId = L1, name = 'a' }: { lineId?: typeof L1; name?: string }) {
  const { view, refresh } = useCarts({ focused: true });
  const edit = useCartEdit(lineId, view);
  handles.set(name, { current: { edit, refresh, view } });
  const freshness = view.kind === 'LISTED' ? view.freshness.kind : view.kind;
  return (
    <Text testID={`probe-${name}`}>
      {edit.state.kind} q={String(shown(view, lineId))} {freshness}
      {edit.earlierUnconfirmed ? ' earlier-unconfirmed' : ''}
    </Text>
  );
}

const now = (name = 'a') => handles.get(name)!.current!;
const text = (name = 'a') => screen.getByTestId(`probe-${name}`);
const sent = (stub: ReturnType<typeof stubAdapter>, op: 'setQuantity' | 'removeLine') =>
  stub.calls.filter((c) => c.op === op);
const reads = (stub: ReturnType<typeof stubAdapter>) =>
  stub.calls.filter((c) => c.op === 'getCarts');
const loaded = async (name = 'a') =>
  waitFor(() => expect(text(name)).toHaveTextContent(/IDLE q=\d VERIFIED/));

async function start(options: { token?: string | null; carts?: CartSet } = {}) {
  const stub = stubAdapter();
  stub.setCarts(options.carts ?? holding());
  const rendered = await renderWithCommerce(<Probe />, {
    adapter: stub.adapter,
    token: options.token === undefined ? 'token-a' : options.token,
  });
  await loaded();
  return { stub, ...rendered };
}

afterEach(() => {
  onlineManager.setOnline(true);
  handles.clear();
});

describe('beginning an edit', () => {
  it('is unavailable with the disabled adapter, and sends nothing', async () => {
    await renderWithCommerce(<Probe />, { adapter: disabledCartAdapter, token: 'token-a' });
    let outcome = '';
    await act(async () => {
      outcome = now().edit.setQuantity(3);
    });
    expect(outcome).toBe('unavailable');
    expect(text()).toHaveTextContent('IDLE', contains);
  });

  it('refuses a quantity that is not a positive safe whole number, and one that is unchanged', async () => {
    const { stub } = await start();
    const outcomes: string[] = [];
    await act(async () => {
      for (const quantity of [0, -1, 1.5, Number.NaN, 2 ** 53, 1e21])
        outcomes.push(now().edit.setQuantity(quantity));
      outcomes.push(now().edit.setQuantity(2));
    });
    expect(outcomes).toEqual([
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'unchanged',
    ]);
    expect(sent(stub, 'setQuantity')).toHaveLength(0);
  });

  it('refuses a line the answer does not hold', async () => {
    const { stub, show } = await start();
    await show(<Probe lineId={asLineId('absent')} name="absent" />);
    await waitFor(() => expect(text('absent')).toHaveTextContent('VERIFIED', contains));
    const outcomes: string[] = [];
    await act(async () => {
      outcomes.push(now('absent').edit.remove(), now('absent').edit.setQuantity(3));
    });
    expect(outcomes).toEqual(['absent', 'absent']);
    expect(stub.calls.filter((c) => c.op !== 'getCarts')).toEqual([]);
  });

  it('refuses while the view is not verified: a re-read that failed', async () => {
    const { stub } = await start();
    stub.failNext('getCarts', apiProblem(500, 'INTERNAL'));
    await act(async () => now().refresh());
    await waitFor(() => expect(text()).toHaveTextContent('UNVERIFIED', contains));
    const outcomes: string[] = [];
    await act(async () => {
      outcomes.push(now().edit.setQuantity(3), now().edit.remove());
    });
    expect(outcomes).toEqual(['unverified', 'unverified']);
    expect(stub.calls.filter((c) => c.op !== 'getCarts')).toEqual([]);
  });

  it('refuses while the first read has not landed', async () => {
    const stub = stubAdapter();
    stub.setCarts(holding());
    const held = stub.hold('getCarts');
    await renderWithCommerce(<Probe />, { adapter: stub.adapter, token: 'token-a' });
    expect(text()).toHaveTextContent('LOADING', contains);
    let outcome = '';
    await act(async () => {
      outcome = now().edit.remove();
    });
    expect(outcome).toBe('unverified');
    await act(async () => held.release());
    expect(stub.calls.filter((c) => c.op !== 'getCarts')).toEqual([]);
  });

  it('refuses while the first read ended in an error', async () => {
    const stub = stubAdapter();
    stub.failNext('getCarts', apiProblem(500, 'INTERNAL'));
    await renderWithCommerce(<Probe />, { adapter: stub.adapter, token: 'token-a' });
    await waitFor(() => expect(text()).toHaveTextContent('ERROR', contains));
    let outcome = '';
    await act(async () => {
      outcome = now().edit.remove();
    });
    expect(outcome).toBe('unverified');
    expect(stub.calls.filter((c) => c.op !== 'getCarts')).toEqual([]);
  });

  it('sends exactly one request for a double tap, with one key, naming the line and the quantity only', async () => {
    const { stub } = await start();
    stub.setCarts(holding(3));
    const release = stub.hold('setQuantity');
    let outcomes: string[] = [];
    await act(async () => {
      outcomes = [now().edit.setQuantity(3), now().edit.setQuantity(3), now().edit.setQuantity(5)];
    });
    expect(outcomes).toEqual(['started', 'same', 'ignored']);
    expect(sent(stub, 'setQuantity')).toHaveLength(1);
    await act(async () => release.release());
    await waitFor(() => expect(text()).toHaveTextContent('CONFIRMED', contains));
    expect(sent(stub, 'setQuantity')).toHaveLength(1);
    expect(sent(stub, 'setQuantity')[0]).toMatchObject({
      lineId: L1,
      quantity: 3,
      variantId: null,
    });
    expect(sent(stub, 'setQuantity')[0]?.key).toEqual(expect.any(String));
  });

  it('sends nothing while the device is known to be offline, queues nothing, and does not send when the connection returns', async () => {
    const { stub } = await start();
    await act(async () => onlineManager.setOnline(false));
    let outcome = '';
    await act(async () => {
      outcome = now().edit.setQuantity(3);
    });
    expect(outcome).toBe('offline');
    expect(text()).toHaveTextContent('OFFLINE_NOT_SENT', contains);
    await act(async () => onlineManager.setOnline(true));
    // The connection returning reads the carts once and replays nothing.
    await waitFor(() => expect(reads(stub)).toHaveLength(2));
    await waitFor(() => expect(text()).toHaveTextContent('VERIFIED', contains));
    expect(sent(stub, 'setQuantity')).toHaveLength(0);
    expect(text()).toHaveTextContent('OFFLINE_NOT_SENT', contains);
    expect(reads(stub)).toHaveLength(2);
    // Only the Buyer trying again sends it.
    await act(async () => now().edit.retry());
    await waitFor(() => expect(sent(stub, 'setQuantity')).toHaveLength(1));
  });

  it('is two independent edits for two lines at once: each settles on its own', async () => {
    const { stub, show } = await start();
    await show(
      <>
        <Probe />
        <Probe lineId={L2} name="b" />
      </>,
    );
    await waitFor(() => expect(text('b')).toHaveTextContent('VERIFIED', contains));
    // What the server will hold once both edits are in; the views still show the earlier answer.
    stub.setCarts(holding(3, 4));
    const first = stub.hold('setQuantity');
    const second = stub.hold('setQuantity');
    await act(async () => {
      now('a').edit.setQuantity(3);
      now('b').edit.setQuantity(4);
    });
    expect(sent(stub, 'setQuantity').map((c) => [c.lineId, c.quantity])).toEqual([
      [L1, 3],
      [L2, 4],
    ]);
    await act(async () => first.release());
    await waitFor(() => expect(text('a')).toHaveTextContent('CONFIRMED', contains));
    expect(text('b')).not.toHaveTextContent('CONFIRMED', contains);
    await act(async () => second.release());
    await waitFor(() => expect(text('b')).toHaveTextContent('CONFIRMED', contains));
    expect(sent(stub, 'setQuantity')[0]?.key).not.toBe(sent(stub, 'setQuantity')[1]?.key);
  });
});

describe('what is drawn after an edit', () => {
  it('draws no claim from the 2xx: not until a read begun AFTER the edit settled shows it, and a read held across the edit does not supply it', async () => {
    const { stub } = await start();
    // A read begins before the edit and is held: it answers with the carts as they were.
    const early = stub.hold('getCarts');
    await act(async () => now().refresh());
    await waitFor(() => expect(reads(stub)).toHaveLength(2));
    // The read after the edit is its own request, and it is held too.
    const after = stub.hold('getCarts');
    stub.setCarts(holding(3));
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(text()).toHaveTextContent('APPLIED', contains));
    await waitFor(() => expect(reads(stub)).toHaveLength(3));
    // The edit was accepted, and nothing is claimed: the line still shows the server's last quantity.
    expect(text()).toHaveTextContent('APPLIED q=2', contains);
    // The read that began before the edit comes back late: it is not the answer.
    await act(async () => early.release());
    expect(text()).toHaveTextContent('APPLIED q=2', contains);
    await act(async () => after.release());
    await waitFor(() => expect(text()).toHaveTextContent('CONFIRMED q=3', contains));
  });

  it('an accepted edit that the read does not show ends with no claim at all', async () => {
    const { stub } = await start();
    // The server accepted, yet its next answer still shows the old quantity (another device, a late commit).
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(reads(stub)).toHaveLength(2));
    await waitFor(() => expect(text()).toHaveTextContent('IDLE q=2', contains));
  });

  it('an accepted edit whose verification read fails claims nothing, and the line shows what it showed', async () => {
    const { stub } = await start();
    stub.setCarts(holding(3));
    // The next read is the one made after the edit settles.
    stub.failNext('getCarts', apiProblem(500, 'INTERNAL'));
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(text()).toHaveTextContent('UNVERIFIED', contains));
    expect(text()).toHaveTextContent('IDLE q=2', contains);
    expect(text()).not.toHaveTextContent('CONFIRMED', contains);
  });

  it('removing a line is confirmed only when the read no longer lists it', async () => {
    const { stub } = await start();
    stub.setCarts(without('line-1'));
    await act(async () => {
      now().edit.remove();
    });
    await waitFor(() => expect(text()).toHaveTextContent('CONFIRMED q=none', contains));
    expect(sent(stub, 'removeLine')[0]).toMatchObject({ lineId: L1, quantity: null });
  });
});

describe('when the outcome is not known', () => {
  it('is UNKNOWN, never refused, updated or removed; the next verified read that shows the quantity confirms it', async () => {
    const { stub } = await start();
    stub.setCarts(holding(3));
    stub.failNext('setQuantity', gatewayPage(502));
    await act(async () => {
      now().edit.setQuantity(3);
    });
    // The edit committed before the answer was lost: the read made afterwards shows it.
    await waitFor(() => expect(text()).toHaveTextContent('CONFIRMED q=3', contains));
  });

  it('stays UNKNOWN while no read shows the target, and is confirmed by a later verified read that does', async () => {
    const { stub } = await start();
    stub.failNext('setQuantity', offline());
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(reads(stub)).toHaveLength(2));
    await waitFor(() => expect(text()).toHaveTextContent('UNKNOWN q=2', contains));
    expect(text()).not.toHaveTextContent(/REFUSED|CONFIRMED|APPLIED/);
    stub.setCarts(holding(3));
    await act(async () => now().refresh());
    await waitFor(() => expect(text()).toHaveTextContent('CONFIRMED q=3', contains));
    expect(sent(stub, 'setQuantity')).toHaveLength(1);
  });

  it('a quantity edit whose line is no longer in the read ends as the line being gone', async () => {
    const { stub } = await start();
    stub.setCarts(without('line-1'));
    stub.failNext('setQuantity', gatewayPage(500));
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(text()).toHaveTextContent('LINE_GONE', contains));
  });

  it('a removal whose line is no longer in the read is done, whatever the answer to it was', async () => {
    const { stub } = await start();
    stub.setCarts(without('line-1'));
    stub.failNext('removeLine', gatewayPage(500));
    await act(async () => {
      now().edit.remove();
    });
    await waitFor(() => expect(text()).toHaveTextContent('CONFIRMED q=none', contains));
  });

  it('trying again sends the SAME key and body, and the line is then confirmed by a read', async () => {
    const { stub } = await start();
    stub.failNext('setQuantity', gatewayPage(502));
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(text()).toHaveTextContent('UNKNOWN', contains));
    stub.setCarts(holding(3));
    await act(async () => now().edit.retry());
    await waitFor(() => expect(text()).toHaveTextContent('CONFIRMED q=3', contains));
    const [firstSend, secondSend] = sent(stub, 'setQuantity');
    expect(secondSend?.key).toBe(firstSend?.key);
    expect(secondSend).toMatchObject({ lineId: L1, quantity: 3 });
  });

  it('an unconfirmed removal is replayed under the same key too', async () => {
    const { stub } = await start();
    stub.failNext('removeLine', offline());
    await act(async () => {
      now().edit.remove();
    });
    await waitFor(() => expect(text()).toHaveTextContent('UNKNOWN', contains));
    await act(async () => now().edit.retry());
    await waitFor(() => expect(sent(stub, 'removeLine')).toHaveLength(2));
    expect(sent(stub, 'removeLine')[1]?.key).toBe(sent(stub, 'removeLine')[0]?.key);
  });

  it('a key that was already used is UNRESOLVED and has no Try again, and nothing else begins until it is dismissed', async () => {
    const { stub } = await start();
    stub.failNext('setQuantity', apiProblem(409, 'IDEMPOTENCY_KEY_REUSED'));
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(text()).toHaveTextContent('UNRESOLVED', contains));
    await act(async () => now().edit.retry());
    expect(sent(stub, 'setQuantity')).toHaveLength(1);
    expect(text()).toHaveTextContent('UNRESOLVED', contains);
    let outcome = '';
    await act(async () => {
      outcome = now().edit.setQuantity(3);
    });
    expect(outcome).toBe('ignored');
    expect(sent(stub, 'setQuantity')).toHaveLength(1);
    await act(async () => now().edit.dismiss());
    expect(text()).toHaveTextContent('IDLE', contains);
    expect(text()).toHaveTextContent('earlier-unconfirmed', contains);
    await act(async () => {
      outcome = now().edit.setQuantity(3);
    });
    expect(outcome).toBe('started');
    expect(sent(stub, 'setQuantity')[1]?.key).not.toBe(sent(stub, 'setQuantity')[0]?.key);
  });

  it('a refusal by the API is REFUSED and has no Try again', async () => {
    const { stub } = await start();
    stub.failNext('setQuantity', apiProblem(400, 'VALIDATION_FAILED'));
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(text()).toHaveTextContent('REFUSED', contains));
    const readsBefore = reads(stub).length;
    await act(async () => now().edit.retry());
    expect(sent(stub, 'setQuantity')).toHaveLength(1);
    expect(text()).toHaveTextContent('REFUSED', contains);
    // A refusal stored nothing, so nothing is read again for it.
    expect(reads(stub)).toHaveLength(readsBefore);
  });

  it('a proxy JSON with a code is UNKNOWN, not a refusal', async () => {
    const { stub } = await start();
    stub.failNext('setQuantity', proxyJson(400, 'VALIDATION_FAILED'));
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(text()).toHaveTextContent('UNKNOWN', contains));
    expect(text()).not.toHaveTextContent('REFUSED', contains);
  });

  it('a 404 ends as the line being gone for both kinds, and the carts are read again', async () => {
    const { stub } = await start();
    stub.failNext('setQuantity', apiProblem(404, 'NOT_FOUND'));
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(text()).toHaveTextContent('LINE_GONE', contains));
    await waitFor(() => expect(reads(stub)).toHaveLength(2));
    await act(async () => now().edit.dismiss());
    stub.failNext('removeLine', apiProblem(404, 'NOT_FOUND'));
    await act(async () => {
      now().edit.remove();
    });
    await waitFor(() => expect(text()).toHaveTextContent('LINE_GONE', contains));
    await waitFor(() => expect(reads(stub)).toHaveLength(3));
  });

  it('a hold the server asked for disables Try again until it is over', async () => {
    const real = Date.now.bind(Date);
    let skew = 0;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => real() + skew);
    try {
      const { stub } = await start();
      stub.failNext('setQuantity', apiProblem(429, 'RATE_LIMITED', 60));
      await act(async () => {
        now().edit.setQuantity(3);
      });
      await waitFor(() => expect(text()).toHaveTextContent('UNKNOWN', contains));
      await act(async () => now().edit.retry());
      expect(sent(stub, 'setQuantity')).toHaveLength(1);
      skew += 61_000;
      await act(async () => now().edit.retry());
      await waitFor(() => expect(sent(stub, 'setQuantity')).toHaveLength(2));
    } finally {
      clock.mockRestore();
    }
  });

  it('Try again while known offline sends nothing', async () => {
    const { stub } = await start();
    stub.failNext('setQuantity', gatewayPage(502));
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(text()).toHaveTextContent('UNKNOWN', contains));
    await act(async () => onlineManager.setOnline(false));
    await act(async () => now().edit.retry());
    expect(sent(stub, 'setQuantity')).toHaveLength(1);
    expect(text()).toHaveTextContent('UNKNOWN', contains);
  });

  it('a port that refuses to send for a scope that is still current leaves an unknown outcome', async () => {
    const { stub } = await start();
    stub.failNext('setQuantity', new ScopeChanged());
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(text()).toHaveTextContent('UNKNOWN', contains));
    await act(async () => now().edit.retry());
    await waitFor(() => expect(sent(stub, 'setQuantity')).toHaveLength(2));
    expect(sent(stub, 'setQuantity')[1]?.key).toBe(sent(stub, 'setQuantity')[0]?.key);
  });

  it('an adapter that turns out to be unavailable is a refusal, not an unknown outcome', async () => {
    const { stub } = await start();
    stub.failNext('setQuantity', new AdapterUnavailable('CONTRACT_MISSING'));
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(text()).toHaveTextContent('REFUSED', contains));
  });
});

describe('another session', () => {
  it('ignores an answer for an edit held across a sign-out: it belongs to nobody on screen', async () => {
    const { stub, session } = await start();
    const held = stub.hold('setQuantity');
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(sent(stub, 'setQuantity')).toHaveLength(1));
    await act(() => session.current!.clearSession());
    await waitFor(() => expect(text()).toHaveTextContent('IDLE', contains));
    await act(async () => held.release());
    expect(text()).toHaveTextContent('IDLE', contains);
    expect(text()).not.toHaveTextContent(/APPLIED|CONFIRMED/);
    // Nothing was read on behalf of the session that ended: its one read is the first one.
    await act(async () => undefined);
    expect(reads(stub).filter((c) => c.epoch === 1)).toHaveLength(1);
  });

  it('ignores a failure for an edit held across a sign-out, and does not mark the new session', async () => {
    const { stub, session } = await start();
    const held = stub.hold('setQuantity');
    stub.failNext('setQuantity', offline());
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(sent(stub, 'setQuantity')).toHaveLength(1));
    await act(() => session.current!.clearSession());
    await act(async () => held.release());
    await waitFor(() => expect(text()).toHaveTextContent('IDLE', contains));
    expect(text()).not.toHaveTextContent(/UNKNOWN|earlier-unconfirmed/);
  });

  it('a stale screen cannot send for a session that has ended', async () => {
    const { stub, session } = await start();
    stub.failNext('setQuantity', gatewayPage(502));
    await act(async () => {
      now().edit.setQuantity(3);
    });
    await waitFor(() => expect(text()).toHaveTextContent('UNKNOWN', contains));
    const stale = now().edit;
    await act(() => session.current!.clearSession());
    await act(async () => {
      stale.retry();
      stale.setQuantity(3);
      stale.remove();
    });
    expect(sent(stub, 'setQuantity')).toHaveLength(1);
    expect(sent(stub, 'removeLine')).toHaveLength(0);
  });
});

describe('nothing is sent but by the Buyer', () => {
  it('a hook that is only mounted, refreshed and focused sends no edit', async () => {
    const { stub } = await start();
    await act(async () => now().refresh());
    await waitFor(() => expect(reads(stub)).toHaveLength(2));
    expect(sent(stub, 'setQuantity')).toHaveLength(0);
    expect(sent(stub, 'removeLine')).toHaveLength(0);
  });
});

describe("the Buyer's review of a reported price change", () => {
  const changed = (price = 1000): CartSet => {
    const base = sellerCart([line('line-1', { quantity: 2 }), line('line-2', { quantity: 1 })]);
    return cartSet(
      applyItems(base, [serverItem({ variantId: line('line-1').variantId, nowMinor: price })]),
    );
  };
  type ReviewHandle = { current: ReturnType<typeof useCartReview> | null; refresh: () => void };
  const review: ReviewHandle = { current: null, refresh: () => undefined };
  function Review({ focused = true }: { focused?: boolean }) {
    const { view, refresh } = useCarts({ focused });
    const reviews = useCartReview(view);
    const edit = useCartEdit(L2, view);
    review.current = reviews;
    review.refresh = refresh;
    handles.set('review', { current: { edit, refresh, view } });
    const target = view.kind === 'LISTED' ? findLine(view.carts, L1) : null;
    return (
      <Text testID="review">
        {target ? reviews.reviewOf(target) : view.kind}
        {target?.priceChangeRef ? ' ref' : ''}
      </Text>
    );
  }
  const reviewText = () => screen.getByTestId('review');
  const refOf = () => {
    const view = handles.get('review')!.current!.view;
    return view.kind === 'LISTED' ? (findLine(view.carts, L1)?.priceChangeRef ?? '') : '';
  };

  it('needs the Buyer: a reported change is NEEDS_ACCEPT, and no re-read, focus, reconnect, edit or wait accepts it', async () => {
    const stub = stubAdapter();
    stub.setCarts(changed());
    const { show } = await renderWithCommerce(<Review focused />, {
      adapter: stub.adapter,
      token: 'token-a',
    });
    await waitFor(() => expect(reviewText()).toHaveTextContent('NEEDS_ACCEPT', contains));
    // Pull.
    await act(async () => review.refresh());
    await waitFor(() => expect(reads(stub)).toHaveLength(2));
    // Focus lost and regained.
    await show(<Review focused={false} />);
    await show(<Review focused />);
    await waitFor(() => expect(reads(stub)).toHaveLength(3));
    // Connection lost and returned.
    await act(async () => onlineManager.setOnline(false));
    await act(async () => onlineManager.setOnline(true));
    await waitFor(() => expect(reads(stub)).toHaveLength(4));
    // An edit of another line, settled by a read.
    stub.setCarts(changed());
    await act(async () => {
      handles.get('review')!.current!.edit.setQuantity(5);
    });
    await waitFor(() => expect(sent(stub, 'setQuantity')).toHaveLength(1));
    // A while.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await act(async () => undefined);
    expect(reviewText()).toHaveTextContent('NEEDS_ACCEPT', contains);
    expect(review.current!.consentOf(L1)).toBeNull();
  });

  it('accepts exactly the difference shown, and only through accept', async () => {
    const stub = stubAdapter();
    stub.setCarts(changed());
    await renderWithCommerce(<Review />, { adapter: stub.adapter, token: 'token-a' });
    await waitFor(() => expect(reviewText()).toHaveTextContent('NEEDS_ACCEPT', contains));
    let result = '';
    await act(async () => {
      result = review.current!.accept(L1, refOf());
    });
    expect(result).toBe('ACCEPTED');
    await waitFor(() => expect(reviewText()).toHaveTextContent('ACCEPTED', contains));
    expect(review.current!.consentOf(L1)?.ref).toBe(refOf());
    // Nothing was sent to the server for it.
    expect(stub.calls.filter((c) => c.op !== 'getCarts')).toEqual([]);
  });

  it('records nothing when the difference moved between what was drawn and the tap', async () => {
    const stub = stubAdapter();
    stub.setCarts(changed(1000));
    await renderWithCommerce(<Review />, { adapter: stub.adapter, token: 'token-a' });
    await waitFor(() => expect(reviewText()).toHaveTextContent('NEEDS_ACCEPT', contains));
    const drawn = refOf();
    stub.setCarts(changed(1100));
    await act(async () => review.refresh());
    await waitFor(() => expect(refOf()).not.toBe(drawn));
    let result = '';
    await act(async () => {
      result = review.current!.accept(L1, drawn);
    });
    expect(result).toBe('CHANGED');
    expect(review.current!.consentOf(L1)).toBeNull();
    expect(reviewText()).toHaveTextContent('NEEDS_ACCEPT', contains);
  });

  it('reviews the same difference again after a clean answer in between', async () => {
    const stub = stubAdapter();
    stub.setCarts(changed());
    await renderWithCommerce(<Review />, { adapter: stub.adapter, token: 'token-a' });
    await waitFor(() => expect(reviewText()).toHaveTextContent('NEEDS_ACCEPT', contains));
    await act(async () => {
      review.current!.accept(L1, refOf());
    });
    await waitFor(() => expect(reviewText()).toHaveTextContent('ACCEPTED', contains));
    stub.setCarts(holding());
    await act(async () => review.refresh());
    await waitFor(() => expect(reviewText()).toHaveTextContent('OK', contains));
    expect(review.current!.consentOf(L1)).toBeNull();
    stub.setCarts(changed());
    await act(async () => review.refresh());
    await waitFor(() => expect(reviewText()).toHaveTextContent('NEEDS_ACCEPT', contains));
  });

  it('draws no review state while the view cannot be vouched for, and refuses to accept then', async () => {
    const stub = stubAdapter();
    stub.setCarts(changed());
    await renderWithCommerce(<Review />, { adapter: stub.adapter, token: 'token-a' });
    await waitFor(() => expect(reviewText()).toHaveTextContent('NEEDS_ACCEPT', contains));
    const drawn = refOf();
    stub.failNext('getCarts', apiProblem(500, 'INTERNAL'));
    await act(async () => review.refresh());
    await waitFor(() => expect(reviewText()).toHaveTextContent('UNVERIFIED', contains));
    let result = '';
    await act(async () => {
      result = review.current!.accept(L1, drawn);
    });
    expect(result).toBe('NOT_ACCEPTABLE');
    expect(review.current!.consentOf(L1)).toBeNull();
  });

  it('keeps a consent while the view is unverified and the same difference comes back', async () => {
    const stub = stubAdapter();
    stub.setCarts(changed());
    await renderWithCommerce(<Review />, { adapter: stub.adapter, token: 'token-a' });
    await waitFor(() => expect(reviewText()).toHaveTextContent('NEEDS_ACCEPT', contains));
    await act(async () => {
      review.current!.accept(L1, refOf());
    });
    stub.failNext('getCarts', apiProblem(500, 'INTERNAL'));
    await act(async () => review.refresh());
    await waitFor(() => expect(reviewText()).toHaveTextContent('UNVERIFIED', contains));
    expect(review.current!.consentOf(L1)).not.toBeNull();
    await act(async () => review.refresh());
    await waitFor(() => expect(reviewText()).toHaveTextContent('ACCEPTED', contains));
  });
});
