// One identity-transition and private-cache policy for the whole app (MOB-FE-01 s7). Three layers, all driven by the session
// manager's synchronous identity hook:
//   1. TanStack Query: every key outside the `public` root is cancelled and removed (query-keys.ts).
//   2. Account-scoped in-memory stores: purged for the Account that just ended; mode-scoped ones dropped with it.
//   3. Image caches: cleared as a backstop (the app image wrapper classifies public versus private in MOB-FE-02).
// A read or write under a non-current epoch is a no-op, so a late response cannot repopulate what was just purged.
import type { QueryClient } from '@tanstack/react-query';

import type { AccountRef, Epoch, GatedMode, SellerRef, SessionState } from '../contracts/gap-mob-session';

export type CacheClass = 'GUEST_SCOPED' | 'ACCOUNT_PRIVATE' | 'MODE_SCOPED';

export interface ScopeKey {
  readonly accountRef: AccountRef;
  readonly epoch: Epoch;
  readonly mode?: GatedMode;
  readonly sellerRef?: SellerRef;
}

export interface AccountScopedStore<V> {
  readonly name: string;
  readonly persistence: 'MEMORY'; // anything persisted is a decision, not a value of this type
  read(scope: ScopeKey, key: string): V | undefined; // undefined when scope.epoch is not current
  write(scope: ScopeKey, key: string, value: V): boolean; // false = dropped as stale
  purgeAccount(accountRef: AccountRef): void;
  purgeMode(accountRef: AccountRef, mode: GatedMode, sellerRef?: SellerRef): void;
  purgeAll(): void;
  size(): number;
}

const slot = (scope: ScopeKey, key: string) => `${scope.accountRef}|${scope.mode ?? '-'}|${scope.sellerRef ?? '-'}|${key}`;

export class PrivateStateRegistry {
  private readonly stores: { readonly cacheClass: CacheClass; readonly store: AccountScopedStore<never>; readonly purgeMode: (a: AccountRef, m: GatedMode) => void }[] = [];

  constructor(private readonly currentEpoch: () => Epoch) {}

  create<V>(name: string, cacheClass: CacheClass): AccountScopedStore<V> {
    const map = new Map<string, V>();
    const dropWhere = (test: (k: string) => boolean) => {
      for (const k of [...map.keys()]) if (test(k)) map.delete(k);
    };
    const store: AccountScopedStore<V> = {
      name,
      persistence: 'MEMORY',
      read: (scope, key) => (scope.epoch === this.currentEpoch() ? map.get(slot(scope, key)) : undefined),
      write: (scope, key, value) => {
        if (scope.epoch !== this.currentEpoch()) return false;
        map.set(slot(scope, key), value);
        return true;
      },
      purgeAccount: (accountRef) => dropWhere((k) => k.startsWith(`${accountRef}|`)),
      purgeMode: (accountRef, mode, sellerRef) => dropWhere((k) => k.startsWith(`${accountRef}|${mode}|${sellerRef ?? ''}`)),
      purgeAll: () => map.clear(),
      size: () => map.size,
    };
    this.stores.push({ cacheClass, store: store as unknown as AccountScopedStore<never>, purgeMode: (a, m) => store.purgeMode(a, m) });
    return store;
  }

  /** Wired as the session manager's identity hook: runs before any subscriber renders. */
  onIdentityChange = (prev: SessionState, _next: SessionState): void => {
    for (const { cacheClass, store } of this.stores) {
      if (cacheClass === 'GUEST_SCOPED') store.purgeAll();
      else if (prev.kind === 'AUTHENTICATED') store.purgeAccount(prev.accountRef);
      else store.purgeAll(); // an unconfirmed restore had no account ref to key by: drop everything private
    }
  };

  /** A mode was left or ELIGIBILITY_CHANGED removed it: its caches and active Seller go, nothing else does. */
  purgeMode(accountRef: AccountRef, mode: GatedMode): void {
    for (const { purgeMode } of this.stores) purgeMode(accountRef, mode);
  }
}

/** Everything outside the `public` root is private by construction. The public namespace survives every transition. */
export function purgePrivateQueries(queryClient: QueryClient): void {
  const isPrivate = (query: { readonly queryKey: readonly unknown[] }) => query.queryKey[0] !== 'public';
  void queryClient.cancelQueries({ predicate: isPrivate });
  queryClient.removeQueries({ predicate: isPrivate });
}

export interface ImageCacheControl {
  clear(): Promise<void>;
}

/** Backstop: clears what the image library cached. A failure is counted, never thrown into a transition. */
export function purgeImages(control: ImageCacheControl, onFailure: () => void): void {
  void control.clear().catch(onFailure);
}
