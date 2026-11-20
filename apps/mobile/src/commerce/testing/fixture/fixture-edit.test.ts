import { ApiError } from '../../../api/client';
import { asLineId, findLine, type CartSet, type LineId, type VariantId } from '../../cart/model';
import { ScopeChanged, type Scope } from '../../cart/port';
import { createFixtureWorld, DEMO_DEVICE } from './adapter';
import { A_BOWL, A_SHIRT_SMALL, B_MUG } from './scenarios';
import { createFixtureServer } from './server';

const GUEST = { actor: `DEVICE:${DEMO_DEVICE}` };
const ACCOUNT_A = { actor: 'ACCOUNT:A' };
const add = (variantId: VariantId, quantity = 1, key = `add-${variantId}-${quantity}`) => ({
  variantId,
  quantity,
  idempotencyKey: key,
});
const setQty = (lineId: LineId, quantity: number, key = `set-${lineId}-${quantity}`) => ({
  lineId,
  quantity,
  idempotencyKey: key,
});
const remove = (lineId: LineId, key = `remove-${lineId}`) => ({ lineId, idempotencyKey: key });
const lines = (set: CartSet) => set.carts.flatMap((c) => c.lines);
const quantities = (server: ReturnType<typeof createFixtureServer>, actor = GUEST.actor) =>
  lines(server.carts(actor)).map((l) => [l.lineId, l.quantity]);

async function withLine(options: Parameters<typeof createFixtureServer>[0] = {}) {
  const server = createFixtureServer(options);
  const { lineId } = await server.addLine(GUEST, add(A_SHIRT_SMALL, 2));
  return { server, lineId };
}

describe('the simulator changes a quantity the way a server would, for tests only', () => {
  it('sets an ABSOLUTE quantity, so doing it twice changes nothing more', async () => {
    const { server, lineId } = await withLine();
    await server.setQuantity(GUEST, setQty(lineId, 5, 'k1'));
    await server.setQuantity(GUEST, setQty(lineId, 5, 'k2'));
    expect(quantities(server)).toEqual([[lineId, 5]]);
    await server.setQuantity(GUEST, setQty(lineId, 1, 'k3'));
    expect(quantities(server)).toEqual([[lineId, 1]]);
  });

  it('takes a very large quantity (it has no ceiling) and refuses one that is not a positive whole number with a 400 that stores nothing', async () => {
    const { server, lineId } = await withLine();
    await server.setQuantity(GUEST, setQty(lineId, 1_000_000, 'big'));
    expect(quantities(server)).toEqual([[lineId, 1_000_000]]);
    for (const quantity of [0, -1, 1.5, Number.NaN]) {
      await expect(
        server.setQuantity(GUEST, setQty(lineId, quantity, 'bad')),
      ).rejects.toMatchObject({
        failure: { status: 400, problem: { code: 'VALIDATION_FAILED' } },
      });
    }
    expect(quantities(server)).toEqual([[lineId, 1_000_000]]);
    // The refusals kept nothing under that key: it can still be used for a valid body.
    await server.setQuantity(GUEST, setQty(lineId, 3, 'bad'));
    expect(quantities(server)).toEqual([[lineId, 3]]);
  });

  it('removes one line, and removing the last line of a Seller makes that Seller cart disappear', async () => {
    const server = createFixtureServer();
    const first = await server.addLine(GUEST, add(A_SHIRT_SMALL));
    const second = await server.addLine(GUEST, add(A_BOWL));
    await server.removeLine(GUEST, remove(first.lineId));
    expect(lines(server.carts(GUEST.actor)).map((l) => l.lineId)).toEqual([second.lineId]);
    await server.removeLine(GUEST, remove(second.lineId));
    expect(server.carts(GUEST.actor).carts).toEqual([]);
    // With the cart empty, the other Seller is welcome again.
    await expect(server.addLine(GUEST, add(B_MUG))).resolves.toBeDefined();
  });

  it('edits only the line it names: nothing else in the cart changes', async () => {
    const server = createFixtureServer();
    const first = await server.addLine(GUEST, add(A_SHIRT_SMALL, 2));
    const second = await server.addLine(GUEST, add(A_BOWL, 3));
    await server.setQuantity(GUEST, setQty(first.lineId, 9));
    expect(quantities(server)).toEqual([
      [first.lineId, 9],
      [second.lineId, 3],
    ]);
    await server.removeLine(GUEST, remove(first.lineId));
    expect(quantities(server)).toEqual([[second.lineId, 3]]);
  });
});

describe("a line that is not in the caller's carts", () => {
  it('is a 404 for a missing line, for both operations, and changes nothing', async () => {
    const { server, lineId } = await withLine();
    const missing = asLineId('DEMO-LINE-404');
    await expect(server.setQuantity(GUEST, setQty(missing, 3))).rejects.toMatchObject({
      failure: { status: 404, problem: { code: 'NOT_FOUND' } },
    });
    await expect(server.removeLine(GUEST, remove(missing))).rejects.toMatchObject({
      failure: { status: 404, problem: { code: 'NOT_FOUND' } },
    });
    expect(quantities(server)).toEqual([[lineId, 2]]);
  });

  it("is the same 404 for another caller's line: whether it exists is not told", async () => {
    const { server, lineId } = await withLine();
    await expect(server.setQuantity(ACCOUNT_A, setQty(lineId, 7))).rejects.toMatchObject({
      failure: { status: 404 },
    });
    await expect(server.removeLine(ACCOUNT_A, remove(lineId))).rejects.toMatchObject({
      failure: { status: 404 },
    });
    expect(quantities(server)).toEqual([[lineId, 2]]);
  });
});

describe('keys on edits', () => {
  it('returns what was stored for the same key and body, without a second effect', async () => {
    const { server, lineId } = await withLine();
    await server.setQuantity(GUEST, setQty(lineId, 5, 'k'));
    // Something else changes the quantity; the replay must not set it again.
    await server.setQuantity(GUEST, setQty(lineId, 8, 'other'));
    await server.setQuantity(GUEST, setQty(lineId, 5, 'k'));
    expect(quantities(server)).toEqual([[lineId, 8]]);
  });

  it('answers a replayed removal with the stored answer, not a 404', async () => {
    const { server, lineId } = await withLine();
    await server.removeLine(GUEST, remove(lineId, 'k'));
    await expect(server.removeLine(GUEST, remove(lineId, 'k'))).resolves.toBeUndefined();
  });

  it('answers a replayed removal with a 404 when edits are not keyed (a server that never kept them)', async () => {
    const { server, lineId } = await withLine({ editsKeyed: false });
    await server.removeLine(GUEST, remove(lineId, 'k'));
    await expect(server.removeLine(GUEST, remove(lineId, 'k'))).rejects.toMatchObject({
      failure: { status: 404 },
    });
  });

  it('answers 409 IDEMPOTENCY_KEY_REUSED for the same key with another body, and for a record past its life', async () => {
    let clock = 1_000;
    const { server, lineId } = await withLine({ clock: () => clock, keyLifeMs: 5_000 });
    await server.setQuantity(GUEST, setQty(lineId, 5, 'k'));
    await expect(server.setQuantity(GUEST, setQty(lineId, 6, 'k'))).rejects.toMatchObject({
      failure: { status: 409, problem: { code: 'IDEMPOTENCY_KEY_REUSED' } },
    });
    await expect(server.removeLine(GUEST, remove(lineId, 'k'))).rejects.toMatchObject({
      failure: { status: 409, problem: { code: 'IDEMPOTENCY_KEY_REUSED' } },
    });
    clock += 5_000;
    await expect(server.setQuantity(GUEST, setQty(lineId, 5, 'k'))).rejects.toMatchObject({
      failure: { status: 409 },
    });
    expect(quantities(server)).toEqual([[lineId, 5]]);
  });
});

describe('failures of an edit', () => {
  it('a failure before the commit changes nothing, so the same key is a first request', async () => {
    const { server, lineId } = await withLine();
    server.failNext('setQuantity', { kind: 'offline' });
    await expect(server.setQuantity(GUEST, setQty(lineId, 5, 'k'))).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(quantities(server)).toEqual([[lineId, 2]]);
    await server.setQuantity(GUEST, setQty(lineId, 5, 'k'));
    expect(quantities(server)).toEqual([[lineId, 5]]);
  });

  it('a failure after the commit loses the answer but not the change, and a replay returns the stored answer', async () => {
    const { server, lineId } = await withLine();
    server.failNext('setQuantity', { kind: 'timeout', afterCommit: true });
    await expect(server.setQuantity(GUEST, setQty(lineId, 5, 'k'))).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(quantities(server)).toEqual([[lineId, 5]]);
    await expect(server.setQuantity(GUEST, setQty(lineId, 5, 'k'))).resolves.toBeUndefined();

    server.failNext('removeLine', { kind: 'unreadable-2xx' });
    await expect(server.removeLine(GUEST, remove(lineId, 'r'))).rejects.toBeInstanceOf(ApiError);
    expect(server.carts(GUEST.actor).carts).toEqual([]);
    await expect(server.removeLine(GUEST, remove(lineId, 'r'))).resolves.toBeUndefined();
  });

  it('a failure set for one operation touches no other', async () => {
    const { server, lineId } = await withLine();
    server.failNext('removeLine', { kind: 'offline' });
    await server.setQuantity(GUEST, setQty(lineId, 4));
    await expect(server.removeLine(GUEST, remove(lineId))).rejects.toBeInstanceOf(ApiError);
    expect(quantities(server)).toEqual([[lineId, 4]]);
  });
});

describe('what the simulator records', () => {
  it('records every edit with its line, key and quantity, and no Seller, option or price', async () => {
    const { server, lineId } = await withLine();
    await server.setQuantity(GUEST, setQty(lineId, 5, 'k1'));
    await server.removeLine(GUEST, remove(lineId, 'k2'));
    expect(server.calls.slice(1)).toEqual([
      {
        op: 'setQuantity',
        actorAtSend: GUEST.actor,
        actorAtProcess: GUEST.actor,
        key: 'k1',
        variantId: null,
        quantity: 5,
        lineId,
      },
      {
        op: 'removeLine',
        actorAtSend: GUEST.actor,
        actorAtProcess: GUEST.actor,
        key: 'k2',
        variantId: null,
        quantity: null,
        lineId,
      },
    ]);
  });

  it('a held edit is processed for the caller that made it, not for whoever is signed in when it is released', async () => {
    const world = createFixtureWorld();
    const scope: Scope = { kind: 'guest', epoch: 1, isCurrent: () => true };
    const port = world.adapter.bind(scope);
    const { lineId } = await port.addLine(add(A_SHIRT_SMALL, 2));
    const held = world.server.pause('setQuantity');
    const pending = port.setQuantity(setQty(lineId, 5, 'k'));
    // The Account signs in on this device while the request waits.
    world.asAccount('A');
    held.release();
    await pending;
    const call = world.server.calls.find((c) => c.op === 'setQuantity');
    expect(call).toMatchObject({ actorAtSend: GUEST.actor, actorAtProcess: GUEST.actor });
    expect(quantities(world.server)).toEqual([[lineId, 5]]);
  });
});

describe('what an edit leaves alone', () => {
  it('a quantity edit changes nothing the server reports about a price', async () => {
    const { server, lineId } = await withLine({ reportPriceChanges: true });
    server.setPrice(A_SHIRT_SMALL, 150000);
    await server.setQuantity(GUEST, setQty(lineId, 4));
    expect(findLine(server.carts(GUEST.actor), lineId)).toMatchObject({
      quantity: 4,
      issues: ['PRICE_CHANGED'],
      previousUnitPrice: { amountMinor: 120000 },
      unitPrice: { amountMinor: 150000 },
    });
  });
});

describe('the simulator adapter', () => {
  it('refuses to send, and refuses to return, for a scope that has ended', async () => {
    const world = createFixtureWorld();
    let live = true;
    const scope: Scope = { kind: 'guest', epoch: 1, isCurrent: () => live };
    const port = world.adapter.bind(scope);
    const { lineId } = await port.addLine(add(A_SHIRT_SMALL, 2));
    live = false;
    await expect(port.setQuantity(setQty(lineId, 5))).rejects.toBeInstanceOf(ScopeChanged);
    await expect(port.removeLine(remove(lineId))).rejects.toBeInstanceOf(ScopeChanged);
    expect(
      world.server.calls.filter((c) => c.op === 'setQuantity' || c.op === 'removeLine'),
    ).toEqual([]);
    // A request on the wire when the scope ends is processed, and its answer is not returned.
    live = true;
    const held = world.server.pause('removeLine');
    const pending = port.removeLine(remove(lineId));
    live = false;
    held.release();
    await expect(pending).rejects.toBeInstanceOf(ScopeChanged);
  });

  it('makes no network call for an edit', async () => {
    const original = globalThis.fetch;
    const fetchMock = jest.fn(() => Promise.reject(new Error('no network is allowed')));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const world = createFixtureWorld();
      const scope: Scope = { kind: 'guest', epoch: 1, isCurrent: () => true };
      const port = world.adapter.bind(scope);
      const { lineId } = await port.addLine(add(A_SHIRT_SMALL));
      await port.setQuantity(setQty(lineId, 3));
      await port.removeLine(remove(lineId));
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
    }
  });
});
