import { describe, expect, it } from 'vitest';
import type { OpId, OpInput, OpOutput, SellerAccess } from '../contracts/gap-sc';
import { TransportError, type Transport } from '../transport/port';
import { DESTINATIONS, can, destinationAccess, navFor } from './access';
import { runScoped } from './scoped';

const access = (destinations: SellerAccess['destinations'], capabilities: string[] = []): SellerAccess => ({
  seller_id: 'fx_seller_a',
  seller_status: 'ACTIVE',
  capabilities,
  destinations,
  restriction: null,
});

describe('runScoped: the answer must belong to the Seller that asked', () => {
  const echoing = (sellerId: string): Transport => ({
    send: <K extends OpId>(_op: K, _input: OpInput<K>) => Promise.resolve({ seller_id: sellerId } as unknown as OpOutput<K>),
  });

  it('passes an answer that echoes the asking Seller', async () => {
    await expect(runScoped(echoing('fx_seller_a'), 'seller.home.get', 'fx_seller_a', {})).resolves.toMatchObject({ seller_id: 'fx_seller_a' });
  });

  it('turns an answer for ANOTHER Seller into CONTEXT_MISMATCH instead of returning it', async () => {
    await expect(runScoped(echoing('fx_seller_b'), 'seller.home.get', 'fx_seller_a', {})).rejects.toMatchObject({ code: 'CONTEXT_MISMATCH' });
    await expect(runScoped({ send: () => Promise.resolve({} as never) }, 'seller.home.get', 'fx_seller_a', {})).rejects.toBeInstanceOf(TransportError);
  });
});

describe('navigation follows the server access, never a role name', () => {
  it('offers exactly the five-plus destinations the server listed and no Orders destination exists at all', () => {
    expect(DESTINATIONS.map((d) => d.key)).not.toContain('orders' as never);
    const nav = navFor(access([{ key: 'home', access: 'GRANTED' }, { key: 'inbox', access: 'GRANTED' }]));
    expect(nav.sidebar.map((i) => i.meta.key)).toEqual(['home', 'inbox']);
    expect(nav.bottom.map((i) => i.meta.key)).toEqual(['home', 'inbox']);
    expect(nav.more).toHaveLength(0);
  });

  it('the narrow bar is Home, Products, Inbox (granted only) and everything else is in More', () => {
    const all = DESTINATIONS.map((d) => ({ key: d.key, access: 'GRANTED' as const }));
    const nav = navFor(access(all));
    expect(nav.bottom.map((i) => i.meta.key)).toEqual(['home', 'products', 'inbox']);
    expect(nav.more.map((i) => i.meta.key)).toEqual(['content', 'insights', 'store', 'trust', 'settings']);
  });

  it('missing permission hides; missing entitlement stays visible and moves to More with its reason', () => {
    const nav = navFor(access([{ key: 'home', access: 'GRANTED' }, { key: 'products', access: 'NO_ENTITLEMENT' }]));
    expect(nav.sidebar.map((i) => i.meta.key)).toEqual(['home', 'products']);
    expect(nav.bottom.map((i) => i.meta.key)).toEqual(['home']);
    expect(nav.more.map((i) => [i.meta.key, i.access])).toEqual([['products', 'NO_ENTITLEMENT']]);
    expect(destinationAccess(access([]), 'products')).toBe('HIDDEN');
  });

  it('an unknown capability string is never a grant', () => {
    const a = access([], ['readiness.resolve', 'something.new']);
    expect(can(a, 'readiness.resolve')).toBe(true);
    expect(can(a, 'admission.manage')).toBe(false);
  });
});
