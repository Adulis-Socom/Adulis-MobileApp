// The one private-cache policy (MOB-FE-01 s7): stores, query roots and image caches, driven by identity transitions.
import { QueryClient } from '@tanstack/react-query';

import { asAccountRef, asDeviceId, asEpoch, asSellerRef, type SessionState } from '../contracts/gap-mob-session';
import { PrivateStateRegistry, purgeImages, purgePrivateQueries } from './private-state';
import { queryKeys } from './query-keys';

const A = asAccountRef('acct-a');
const B = asAccountRef('acct-b');
const authed = (ref: typeof A, epoch: number): SessionState => ({ kind: 'AUTHENTICATED', epoch: asEpoch(epoch), accountRef: ref, confirmedAt: 0 });
const guest = (epoch: number): SessionState => ({ kind: 'GUEST', epoch: asEpoch(epoch), lastEnd: null });

describe('account-scoped stores', () => {
  it('drops a read or write under a non-current epoch', () => {
    let epoch = 2;
    const registry = new PrivateStateRegistry(() => asEpoch(epoch));
    const store = registry.create<string>('s', 'ACCOUNT_PRIVATE');
    expect(store.write({ accountRef: A, epoch: asEpoch(2) }, 'k', 'v')).toBe(true);
    epoch = 3;
    expect(store.read({ accountRef: A, epoch: asEpoch(2) }, 'k')).toBeUndefined();
    expect(store.write({ accountRef: A, epoch: asEpoch(2) }, 'k', 'late')).toBe(false);
  });

  it('keeps accounts apart and purges only the account that ended', () => {
    const registry = new PrivateStateRegistry(() => asEpoch(1));
    const store = registry.create<string>('s', 'ACCOUNT_PRIVATE');
    store.write({ accountRef: A, epoch: asEpoch(1) }, 'k', 'a');
    store.write({ accountRef: B, epoch: asEpoch(1) }, 'k', 'b');
    registry.onIdentityChange(authed(A, 1), guest(2));
    expect(store.read({ accountRef: A, epoch: asEpoch(1) }, 'k')).toBeUndefined();
    expect(store.read({ accountRef: B, epoch: asEpoch(1) }, 'k')).toBe('b');
  });

  it('purges guest-scoped stores on any identity change, and everything private when the prior account is unknown', () => {
    const registry = new PrivateStateRegistry(() => asEpoch(1));
    const guestStore = registry.create<string>('g', 'GUEST_SCOPED');
    const priv = registry.create<string>('p', 'ACCOUNT_PRIVATE');
    guestStore.write({ accountRef: A, epoch: asEpoch(1) }, 'k', 'g');
    priv.write({ accountRef: A, epoch: asEpoch(1) }, 'k', 'p');
    registry.onIdentityChange({ kind: 'RESTORED_UNCONFIRMED', epoch: asEpoch(1) }, guest(2));
    expect(guestStore.size()).toBe(0);
    expect(priv.size()).toBe(0);
  });

  it('leaving a mode drops that mode and Seller scope and nothing else', () => {
    const registry = new PrivateStateRegistry(() => asEpoch(1));
    const store = registry.create<string>('m', 'MODE_SCOPED');
    store.write({ accountRef: A, epoch: asEpoch(1), mode: 'SELLER_COMPANION', sellerRef: asSellerRef('s1') }, 'k', 'companion');
    store.write({ accountRef: A, epoch: asEpoch(1) }, 'k', 'buyer');
    registry.purgeMode(A, 'SELLER_COMPANION');
    expect(store.size()).toBe(1);
    expect(store.read({ accountRef: A, epoch: asEpoch(1) }, 'k')).toBe('buyer');
  });
});

describe('query roots and image caches', () => {
  it('removes every private root and keeps the public namespace', () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.public('feed'), 1);
    client.setQueryData(queryKeys.guest(asDeviceId('dv-1'), 'saved'), 2);
    client.setQueryData(queryKeys.account(A, 'saved'), 3);
    client.setQueryData(queryKeys.companion(A, asSellerRef('s1'), 'orders'), 4);
    client.setQueryData(queryKeys.courier(A, 'offers'), 5);
    purgePrivateQueries(client);
    expect(client.getQueryData(queryKeys.public('feed'))).toBe(1);
    expect(client.getQueryCache().getAll().map((query) => query.queryKey[0])).toEqual(['public']);
  });

  it('counts an image-cache failure instead of throwing into a transition', async () => {
    let failures = 0;
    purgeImages({ clear: () => Promise.reject(new Error('disk')) }, () => {
      failures += 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(failures).toBe(1);
  });
});
