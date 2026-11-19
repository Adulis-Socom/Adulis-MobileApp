import { ApiError } from '../../../api/client';
import { asVariantId, type CartSet, type VariantId } from '../../cart/model';
import { ScopeChanged, type Scope } from '../../cart/port';
import { createFixtureWorld, DEMO_DEVICE } from './adapter';
import { A_BOWL, A_SHIRT_LARGE, A_SHIRT_SMALL, B_LAMP, B_MUG } from './scenarios';
import { createFixtureServer, type FailureSpec } from './server';

const GUEST = { actor: `DEVICE:${DEMO_DEVICE}` };
const ACCOUNT_A = { actor: 'ACCOUNT:A' };
const add = (variantId: VariantId, quantity = 1, key = `key-${variantId}-${quantity}`) => ({ variantId, quantity, idempotencyKey: key });
const lines = (set: CartSet) => set.carts.flatMap((c) => c.lines);

describe('the simulator is plainly a fixture', () => {
  it('names everything as demonstration data: ids, Sellers and Products', async () => {
    const server = createFixtureServer();
    const accepted = await server.addLine(GUEST, add(A_SHIRT_SMALL));
    expect(accepted.lineId).toMatch(/^DEMO-LINE-/);
    const set = server.carts(GUEST.actor);
    expect(set.carts[0]?.key).toMatch(/^DEMO-SELLER-/);
    expect(set.carts[0]?.storeName).toMatch(/^Demo /);
    expect(lines(set)[0]?.name).toMatch(/^Demo /);
  });

  it('labels every answer of its adapter FIXTURE and makes no network call', async () => {
    const original = globalThis.fetch;
    const fetchMock = jest.fn(() => Promise.reject(new Error('no network is allowed')));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const world = createFixtureWorld();
      const scope: Scope = { kind: 'guest', epoch: 1, isCurrent: () => true };
      const port = world.adapter.bind(scope);
      await port.addLine(add(A_SHIRT_SMALL));
      const read = await port.getCarts();
      expect(read.provenance).toBe('FIXTURE');
      expect(world.adapter.provenance).toBe('FIXTURE');
      expect(world.adapter.mode).toBe('fixture');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('Seller carts', () => {
  it('follows the cart contract by default: one Seller per cart, and a second Seller is refused with CART_SELLER_CONFLICT and changes nothing', async () => {
    const server = createFixtureServer();
    await server.addLine(GUEST, add(A_SHIRT_SMALL));
    await expect(server.addLine(GUEST, add(B_MUG))).rejects.toMatchObject({ failure: { status: 409, problem: { code: 'CART_SELLER_CONFLICT' } } });
    await expect(server.addLine(GUEST, add(A_BOWL))).resolves.toBeDefined();
    expect(server.carts(GUEST.actor).carts.map((c) => [c.handle, c.lines.map((l) => l.variantId)])).toEqual([['demo-seller-a', [A_SHIRT_SMALL, A_BOWL]]]);
    // The refusal stored nothing: another Account is free to start with the other Seller.
    await expect(server.addLine(ACCOUNT_A, add(B_MUG))).resolves.toBeDefined();
    expect(server.carts(ACCOUNT_A.actor).carts.map((c) => c.handle)).toEqual(['demo-seller-b']);
  });

  it('with several Seller carts at once (asked for; a shape the cart contract does not describe), puts an option in its own Seller\'s cart, taken from the option and never from the request, and never merges two Sellers', async () => {
    const server = createFixtureServer({ sellerCarts: 'MULTI' });
    await server.addLine(GUEST, add(A_SHIRT_SMALL));
    await server.addLine(GUEST, add(B_MUG));
    await server.addLine(GUEST, add(A_BOWL));
    const set = server.carts(GUEST.actor);
    expect(set.carts.map((c) => [c.handle, c.lines.map((l) => l.variantId)])).toEqual([
      ['demo-seller-a', [A_SHIRT_SMALL, A_BOWL]],
      ['demo-seller-b', [B_MUG]],
    ]);
  });

  it('keeps each caller\'s carts apart', async () => {
    const server = createFixtureServer();
    await server.addLine(GUEST, add(A_SHIRT_SMALL));
    await server.addLine(ACCOUNT_A, add(B_MUG));
    expect(lines(server.carts(GUEST.actor)).map((l) => l.variantId)).toEqual([A_SHIRT_SMALL]);
    expect(lines(server.carts(ACCOUNT_A.actor)).map((l) => l.variantId)).toEqual([B_MUG]);
  });

  it('makes a second line for an option already in the cart by default, and merges only when asked to (not what the cart contract describes)', async () => {
    const separate = createFixtureServer();
    await separate.addLine(GUEST, add(A_SHIRT_SMALL, 1, 'k1'));
    await separate.addLine(GUEST, add(A_SHIRT_SMALL, 2, 'k2'));
    expect(lines(separate.carts(GUEST.actor)).map((l) => [l.variantId, l.quantity])).toEqual([
      [A_SHIRT_SMALL, 1],
      [A_SHIRT_SMALL, 2],
    ]);

    const merged = createFixtureServer({ mergeDuplicates: true });
    await merged.addLine(GUEST, add(A_SHIRT_SMALL, 1, 'k1'));
    await merged.addLine(GUEST, add(A_SHIRT_SMALL, 2, 'k2'));
    expect(lines(merged.carts(GUEST.actor)).map((l) => l.quantity)).toEqual([3]);
  });

  it('refuses an unknown option and a quantity that is not a positive whole number', async () => {
    const server = createFixtureServer();
    await expect(server.addLine(GUEST, add(asVariantId('de000000-0000-4000-8000-0000000000ff')))).rejects.toMatchObject({ failure: { status: 404 } });
    await expect(server.addLine(GUEST, add(A_SHIRT_SMALL, 0))).rejects.toMatchObject({ failure: { status: 400 } });
  });
});

describe('idempotency keys', () => {
  it('returns the stored answer for the same key and body, and adds nothing', async () => {
    const server = createFixtureServer();
    const first = await server.addLine(GUEST, add(A_SHIRT_SMALL, 2, 'k1'));
    const again = await server.addLine(GUEST, add(A_SHIRT_SMALL, 2, 'k1'));
    expect(again).toEqual(first);
    expect(lines(server.carts(GUEST.actor))).toHaveLength(1);
    expect(lines(server.carts(GUEST.actor))[0]?.quantity).toBe(2);
  });

  it('refuses the same key with a different body', async () => {
    const server = createFixtureServer();
    await server.addLine(GUEST, add(A_SHIRT_SMALL, 2, 'k1'));
    await expect(server.addLine(GUEST, add(A_SHIRT_SMALL, 3, 'k1'))).rejects.toMatchObject({ failure: { status: 409, problem: { code: 'IDEMPOTENCY_KEY_REUSED' } } });
    await expect(server.addLine(GUEST, add(A_BOWL, 2, 'k1'))).rejects.toMatchObject({ failure: { status: 409 } });
    expect(lines(server.carts(GUEST.actor))[0]?.quantity).toBe(2);
  });

  it('refuses a key past the life of its record, and scopes a key to the caller', async () => {
    let clock = 1_000;
    const server = createFixtureServer({ clock: () => clock, keyLifeMs: 10_000 });
    await server.addLine(GUEST, add(A_SHIRT_SMALL, 1, 'k1'));
    // Another caller with the same key is a different request.
    await expect(server.addLine(ACCOUNT_A, add(A_SHIRT_SMALL, 1, 'k1'))).resolves.toBeDefined();
    clock += 10_000;
    await expect(server.addLine(GUEST, add(A_SHIRT_SMALL, 1, 'k1'))).rejects.toMatchObject({ failure: { status: 409 } });
  });
});

describe('what a read reports', () => {
  const reasons = (set: CartSet) => lines(set).map((l) => l.issues);

  it('reports nothing for an option that can be bought', async () => {
    const server = createFixtureServer();
    await server.addLine(GUEST, add(A_SHIRT_SMALL, 2));
    expect(reasons(server.carts(GUEST.actor))).toEqual([[]]);
  });

  it('reports not enough in stock with the number available, and sold out at zero', async () => {
    const server = createFixtureServer();
    await server.addLine(GUEST, add(A_SHIRT_SMALL, 5));
    server.setQuantityAvailable(A_SHIRT_SMALL, 2);
    expect(lines(server.carts(GUEST.actor))[0]).toMatchObject({ issues: ['INSUFFICIENT_STOCK'], availableQuantity: 2 });
    server.setQuantityAvailable(A_SHIRT_SMALL, 0);
    expect(lines(server.carts(GUEST.actor))[0]).toMatchObject({ issues: ['SOLD_OUT'], availableQuantity: 0 });
  });

  it('reports a withdrawn option and an unpublished Product, on every line that names them', async () => {
    const server = createFixtureServer();
    await server.addLine(GUEST, add(A_SHIRT_SMALL, 1, 'k1'));
    await server.addLine(GUEST, add(A_SHIRT_SMALL, 1, 'k2'));
    await server.addLine(GUEST, add(A_SHIRT_LARGE, 1, 'k3'));
    server.setVariantStatus(A_SHIRT_SMALL, 'WITHDRAWN');
    expect(reasons(server.carts(GUEST.actor))).toEqual([['VARIANT_WITHDRAWN'], ['VARIANT_WITHDRAWN'], []]);
    server.setProductPublished('demo-shirt', false);
    expect(reasons(server.carts(GUEST.actor))).toEqual([['NO_LONGER_PUBLISHED', 'VARIANT_WITHDRAWN'], ['NO_LONGER_PUBLISHED', 'VARIANT_WITHDRAWN'], ['NO_LONGER_PUBLISHED']]);
  });

  it('reports an unavailable Seller on every line of that Seller\'s cart only', async () => {
    const server = createFixtureServer({ sellerCarts: 'MULTI' });
    await server.addLine(GUEST, add(A_SHIRT_SMALL));
    await server.addLine(GUEST, add(A_BOWL));
    await server.addLine(GUEST, add(B_MUG));
    server.setSellerActive('demo-seller-a', false);
    expect(reasons(server.carts(GUEST.actor))).toEqual([['SELLER_UNAVAILABLE'], ['SELLER_UNAVAILABLE'], []]);
  });

  it('reports a changed price with the previous one only when told to, and otherwise just shows the new price', async () => {
    const quiet = createFixtureServer();
    await quiet.addLine(GUEST, add(A_SHIRT_SMALL));
    quiet.setPrice(A_SHIRT_SMALL, 150000);
    expect(lines(quiet.carts(GUEST.actor))[0]).toMatchObject({ issues: [], unitPrice: { amountMinor: 150000 }, previousUnitPrice: null });

    const reporting = createFixtureServer({ reportPriceChanges: true });
    await reporting.addLine(GUEST, add(A_SHIRT_SMALL));
    reporting.setPrice(A_SHIRT_SMALL, 150000);
    expect(lines(reporting.carts(GUEST.actor))[0]).toMatchObject({
      issues: ['PRICE_CHANGED'],
      unitPrice: { amountMinor: 150000, currency: 'ETB' },
      previousUnitPrice: { amountMinor: 120000, currency: 'ETB' },
    });
  });

  it('sends a Seller subtotal only when told to, and never a total across Sellers', async () => {
    const without = createFixtureServer();
    await without.addLine(GUEST, add(A_SHIRT_SMALL, 2));
    expect(without.carts(GUEST.actor).carts[0]?.subtotal).toBeNull();

    const withSubtotal = createFixtureServer({ serverSubtotal: true, sellerCarts: 'MULTI' });
    await withSubtotal.addLine(GUEST, add(A_SHIRT_SMALL, 2));
    await withSubtotal.addLine(GUEST, add(B_MUG, 1));
    const set = withSubtotal.carts(GUEST.actor);
    expect(set.carts.map((c) => c.subtotal)).toEqual([
      { amountMinor: 240000, currency: 'ETB' },
      { amountMinor: 30000, currency: 'ETB' },
    ]);
    expect(Object.keys(set).sort()).toEqual(['carts', 'checkedAt']);
  });

  it('refuses an add of an option that cannot be bought only when told to; otherwise it accepts and reports', async () => {
    const accepting = createFixtureServer();
    accepting.setQuantityAvailable(B_LAMP, 0);
    await accepting.addLine(GUEST, add(B_LAMP));
    expect(lines(accepting.carts(GUEST.actor))[0]?.issues).toEqual(['SOLD_OUT']);

    const refusing = createFixtureServer({ refuseUnavailableAdds: true });
    refusing.setQuantityAvailable(B_LAMP, 0);
    await expect(refusing.addLine(GUEST, add(B_LAMP))).rejects.toMatchObject({ failure: { status: 404 } });
  });
});

describe('a guest who signs in on the device', () => {
  it('ADOPT_IF_EMPTY: the guest\'s Seller carts become the Account\'s when it has none', async () => {
    const world = createFixtureWorld({ adoption: 'ADOPT_IF_EMPTY' });
    await world.server.addLine({ actor: world.actor() }, add(A_SHIRT_SMALL));
    world.asAccount('A');
    const read = await world.server.getCarts({ actor: world.actor() });
    expect(lines(read).map((l) => l.variantId)).toEqual([A_SHIRT_SMALL]);
    expect(world.server.carts(`DEVICE:${DEMO_DEVICE}`).carts).toEqual([]);
  });

  it('ADOPT_IF_EMPTY: an Account that already has carts keeps only its own', async () => {
    const world = createFixtureWorld({ adoption: 'ADOPT_IF_EMPTY' });
    await world.server.addLine({ actor: world.actor() }, add(A_SHIRT_SMALL));
    await world.server.addLine(ACCOUNT_A, add(B_MUG));
    world.asAccount('A');
    const read = await world.server.getCarts({ actor: world.actor() });
    expect(lines(read).map((l) => l.variantId)).toEqual([B_MUG]);
  });

  it('DROP_GUEST: the Account starts empty and the guest cart is left behind', async () => {
    const world = createFixtureWorld({ adoption: 'DROP_GUEST' });
    await world.server.addLine({ actor: world.actor() }, add(A_SHIRT_SMALL));
    world.asAccount('A');
    const read = await world.server.getCarts({ actor: world.actor() });
    expect(read.carts).toEqual([]);
  });

  it('UNRESOLVED_CONFLICT: both are returned without a merge, so one Seller can appear twice', async () => {
    const world = createFixtureWorld({ adoption: 'UNRESOLVED_CONFLICT' });
    await world.server.addLine({ actor: world.actor() }, add(A_SHIRT_SMALL, 1, 'guest-key'));
    await world.server.addLine(ACCOUNT_A, add(A_BOWL, 1, 'account-key'));
    world.asAccount('A');
    const read = await world.server.getCarts({ actor: world.actor() });
    expect(read.carts.map((c) => [c.handle, c.lines.map((l) => l.variantId)])).toEqual([
      ['demo-seller-a', [A_BOWL]],
      ['demo-seller-a', [A_SHIRT_SMALL]],
    ]);
  });
});

describe('failing on command', () => {
  const failing: Array<[FailureSpec, (e: ApiError) => void]> = [
    [{ kind: 'offline' }, (e) => expect(e.failure.kind).toBe('offline')],
    [{ kind: 'timeout' }, (e) => expect(e.failure.kind).toBe('timeout')],
    [{ kind: 'problem', status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 7 }, (e) => expect(e.failure).toMatchObject({ kind: 'problem', status: 429, retryAfterSeconds: 7 })],
    [{ kind: 'proxy-json', status: 502, code: 'BAD_GATEWAY' }, (e) => expect(e.failure).toMatchObject({ kind: 'problem', status: 502, problem: { code: 'BAD_GATEWAY' } })],
    [{ kind: 'unexpected', status: 503 }, (e) => expect(e.failure).toMatchObject({ kind: 'unexpected', status: 503 })],
    [{ kind: 'unreadable-2xx' }, (e) => expect(e.failure).toMatchObject({ kind: 'unexpected', status: 200 })],
  ];

  it.each(failing)('fails the next call as %j, once, and then works', async (spec, check) => {
    const server = createFixtureServer();
    server.failNext('addLine', spec);
    const error = await server.addLine(GUEST, add(A_SHIRT_SMALL)).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    check(error as ApiError);
    // The same key then succeeds, and the cart holds one line either way.
    await expect(server.addLine(GUEST, add(A_SHIRT_SMALL))).resolves.toBeDefined();
    expect(lines(server.carts(GUEST.actor))).toHaveLength(1);
  });

  it('a failure after the commit still processed the request, and the same key then returns the stored answer', async () => {
    const server = createFixtureServer();
    server.failNext('addLine', { kind: 'unexpected', status: 502, afterCommit: true });
    await expect(server.addLine(GUEST, add(A_SHIRT_SMALL, 2, 'k1'))).rejects.toBeInstanceOf(ApiError);
    expect(lines(server.carts(GUEST.actor))).toHaveLength(1);
    const again = await server.addLine(GUEST, add(A_SHIRT_SMALL, 2, 'k1'));
    expect(again.lineId).toBe(lines(server.carts(GUEST.actor))[0]?.lineId);
    expect(lines(server.carts(GUEST.actor))[0]?.quantity).toBe(2);
  });

  it('a failure before the commit stores nothing, so the same key is a first request', async () => {
    const server = createFixtureServer();
    server.failNext('addLine', { kind: 'offline' });
    await expect(server.addLine(GUEST, add(A_SHIRT_SMALL, 2, 'k1'))).rejects.toBeInstanceOf(ApiError);
    expect(lines(server.carts(GUEST.actor))).toEqual([]);
  });

  it('records every call with its key, option and quantity', async () => {
    const server = createFixtureServer();
    await server.addLine(GUEST, add(A_SHIRT_SMALL, 2, 'k1'));
    await server.getCarts(GUEST);
    expect(server.calls).toEqual([
      { op: 'addLine', actorAtSend: GUEST.actor, actorAtProcess: GUEST.actor, key: 'k1', variantId: A_SHIRT_SMALL, quantity: 2 },
      { op: 'getCarts', actorAtSend: GUEST.actor, actorAtProcess: GUEST.actor, key: null, variantId: null, quantity: null },
    ]);
  });
});

describe('a request that waits is processed for the caller that made it', () => {
  it('reads the caller when the request is made, so a read held across a sign-in answers for the earlier caller', async () => {
    const world = createFixtureWorld();
    await world.server.addLine(ACCOUNT_A, add(A_SHIRT_SMALL));
    world.asAccount('A');
    const scope: Scope = { kind: 'account', epoch: 1, isCurrent: () => true };
    const held = world.server.pause('getCarts');
    const pending = world.adapter.bind(scope).getCarts();
    // Another Account signs in while the request waits.
    world.asAccount('B');
    held.release();
    const answered = await pending;
    expect(lines(answered.value).map((l) => l.variantId)).toEqual([A_SHIRT_SMALL]);
    const reads = world.server.calls.filter((c) => c.op === 'getCarts');
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatchObject({ actorAtSend: 'ACCOUNT:A', actorAtProcess: 'ACCOUNT:A' });
  });

  it('refuses to send for a scope that has ended, and refuses to return an answer to one that ended meanwhile', async () => {
    const world = createFixtureWorld();
    let current = true;
    const scope: Scope = { kind: 'guest', epoch: 1, isCurrent: () => current };
    const port = world.adapter.bind(scope);
    const held = world.server.pause('addLine');
    const pending = port.addLine(add(A_SHIRT_SMALL));
    current = false;
    held.release();
    await expect(pending).rejects.toBeInstanceOf(ScopeChanged);
    await expect(port.getCarts()).rejects.toBeInstanceOf(ScopeChanged);
    expect(world.server.calls.filter((c) => c.op === 'getCarts')).toEqual([]);
  });
});
