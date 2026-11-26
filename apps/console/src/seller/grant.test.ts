import { describe, expect, it } from 'vitest';
import type { OpId, OpInput, OpOutput, SellerAccess } from '../contracts/gap-sc';
import { TransportError, type Transport } from '../transport/port';
import { authorize, failureFor, generationOf, grantFor, type Outcome } from './grant';

const access = (sellerId: string): SellerAccess => ({ seller_id: sellerId, seller_status: 'ACTIVE', capabilities: [], destinations: [], restriction: null });

function deferred() {
  let resolve!: (v: SellerAccess) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<SellerAccess>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const transport: Transport = { send: <K extends OpId>(_op: K, _input: OpInput<K>) => promise as unknown as Promise<OpOutput<K>> };
  return { transport, resolve, reject };
}
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('a grant is valid only for the account, Seller and navigation it was asked for', () => {
  const here = generationOf('acct1', 'fx_a', '/s/fx_a/products');
  const granted: Outcome = { generation: here, access: access('fx_a') };

  it('serves the grant for the same generation and for no other', () => {
    expect(grantFor(granted, here)).not.toBeNull();
    expect(grantFor(granted, generationOf('acct1', 'fx_a', '/s/fx_a/inbox'))).toBeNull();
    expect(grantFor(granted, generationOf('acct1', 'fx_b', '/s/fx_b/products'))).toBeNull();
    expect(grantFor(granted, generationOf('acct2', 'fx_a', '/s/fx_a/products'))).toBeNull();
    expect(grantFor(null, here)).toBeNull();
  });

  it('a failure is likewise bound, and a failure never carries a grant', () => {
    const failed: Outcome = { generation: here, failure: new TransportError('NETWORK') };
    expect(failureFor(failed, here)?.code).toBe('NETWORK');
    expect(grantFor(failed, here)).toBeNull();
    expect(failureFor(failed, generationOf('acct1', 'fx_a', '/s/fx_a/inbox'))).toBeNull();
  });

  it('separator-like characters cannot make two different triples collide', () => {
    expect(generationOf('a|b', 'c', 'd')).not.toBe(generationOf('a', 'b|c', 'd'));
  });
});

describe('authorize: a late answer cannot change what the Console believes', () => {
  const generation = generationOf('acct1', 'fx_a', '/s/fx_a');

  it('applies an answer that arrives while the scope is live', async () => {
    const d = deferred();
    const applied: Outcome[] = [];
    authorize({ transport: d.transport, sellerId: 'fx_a', generation, live: () => true, apply: (o) => applied.push(o), expire: () => undefined });
    expect(applied).toHaveLength(0); // nothing is granted while the question is open
    d.resolve(access('fx_a'));
    await tick();
    expect(applied).toHaveLength(1);
    expect(grantFor(applied[0] ?? null, generation)?.seller_id).toBe('fx_a');
  });

  it('drops a late success once the scope was torn down (another Seller, sign-out, expiry)', async () => {
    const d = deferred();
    let live = true;
    const applied: Outcome[] = [];
    authorize({ transport: d.transport, sellerId: 'fx_a', generation, live: () => live, apply: (o) => applied.push(o), expire: () => undefined });
    live = false;
    d.resolve(access('fx_a'));
    await tick();
    expect(applied).toHaveLength(0);
  });

  it('drops a late failure too, and a late AUTHENTICATION_REQUIRED does not expire a newer session', async () => {
    const d = deferred();
    let live = true;
    let expired = 0;
    const applied: Outcome[] = [];
    authorize({ transport: d.transport, sellerId: 'fx_a', generation, live: () => live, apply: (o) => applied.push(o), expire: () => (expired += 1) });
    live = false;
    d.reject(new TransportError('AUTHENTICATION_REQUIRED'));
    await tick();
    expect(applied).toHaveLength(0);
    expect(expired).toBe(0);
  });

  it('a live AUTHENTICATION_REQUIRED expires the session and records no grant', async () => {
    const d = deferred();
    let expired = 0;
    const applied: Outcome[] = [];
    authorize({ transport: d.transport, sellerId: 'fx_a', generation, live: () => true, apply: (o) => applied.push(o), expire: () => (expired += 1) });
    d.reject(new TransportError('AUTHENTICATION_REQUIRED'));
    await tick();
    expect(expired).toBe(1);
    expect(applied).toHaveLength(0);
  });

  it('fails closed: a denial, an unknown error and an answer for another Seller all end without access', async () => {
    for (const make of [
      (d: ReturnType<typeof deferred>) => d.reject(new TransportError('PERMISSION_DENIED')),
      (d: ReturnType<typeof deferred>) => d.reject(new Error('boom')),
      (d: ReturnType<typeof deferred>) => d.resolve(access('fx_other')),
    ]) {
      const d = deferred();
      const applied: Outcome[] = [];
      authorize({ transport: d.transport, sellerId: 'fx_a', generation, live: () => true, apply: (o) => applied.push(o), expire: () => undefined });
      make(d);
      await tick();
      expect(applied).toHaveLength(1);
      expect(grantFor(applied[0] ?? null, generation)).toBeNull();
      expect(failureFor(applied[0] ?? null, generation)).not.toBeNull();
    }
  });
});
