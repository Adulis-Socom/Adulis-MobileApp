import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { isTransient, problemCode } from '../api/client';
import { keepIfCurrent, usePrivateApi } from '../buyer/saved';
import { parseSellerList, type SellerRow } from './seller-api';

/** Every query of one store lives under this prefix and that store's id (so a switch never shows another's). */
export const SELLER = 'seller';
export const SELLER_LIST = 'seller-list';
export const sellerRetry = (failures: number, error: unknown) => isTransient(error) && failures < 2;

/**
 * GET /v1/seller/list for the session on screen: the authority on which stores this Account may
 * open (WO-020). Bound to the session (a late answer for an earlier session is refused), read on
 * every visit (gcTime 0: a relationship revoked elsewhere is not shown from memory).
 */
export function useSellerList() {
  const priv = usePrivateApi();
  return useQuery({
    queryKey: [SELLER_LIST],
    queryFn: async () => parseSellerList(await keepIfCurrent(priv!, (api) => api.sellerList())),
    enabled: priv !== null,
    gcTime: 0,
    retry: sellerRetry,
  });
}

type SellerContextValue = {
  list: ReturnType<typeof useSellerList>;
  sellers: readonly SellerRow[];
  /** The store on screen: always one the Seller list returned, never a remembered or typed id. */
  active: SellerRow | null;
  choose: (id: string) => void;
  /** Back to the chooser (Change store). */
  change: () => void;
  /**
   * A store-scoped read answered 404: the Account no longer holds that store (the server reports
   * scope failures as 404, ADU-AUTH-01 S19). The store is dropped and the relationship read again,
   * so a stale bootstrap or list cannot keep it open. A 403 is a feature this role lacks and is
   * shown where it happens; offline and server errors change nothing.
   */
  refused: (error: unknown) => void;
};

const SellerContext = createContext<SellerContextValue | null>(null);

/**
 * The active Seller (WO-020): a UI selection held in memory for this visit to Seller mode, never a
 * session identity and never persisted. Keyed by the session where it is mounted, so another
 * Account starts with none; leaving Seller mode unmounts it.
 */
export function SellerProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const list = useSellerList();
  const sellers = useMemo(() => list.data ?? [], [list.data]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  // One store: it opens directly. Several: the one chosen, while the list still returns it.
  const active = sellers.length === 1 ? sellers[0]! : (sellers.find((s) => s.id === chosenId) ?? null);

  const choose = useCallback(
    (id: string) => {
      if (!sellers.some((s) => s.id === id)) return;
      setChosenId((previous) => {
        // The previous store's private reads go with it (they are also keyed by its id).
        if (previous && previous !== id) qc.removeQueries({ queryKey: [SELLER, previous] });
        return id;
      });
    },
    [sellers, qc],
  );
  const change = useCallback(() => {
    setChosenId((previous) => {
      if (previous) qc.removeQueries({ queryKey: [SELLER, previous] });
      return null;
    });
  }, [qc]);
  const refused = useCallback(
    (error: unknown) => {
      if (problemCode(error) !== 'NOT_FOUND') return;
      setChosenId(null);
      qc.removeQueries({ queryKey: [SELLER] });
      void qc.invalidateQueries({ queryKey: [SELLER_LIST] });
      void qc.invalidateQueries({ queryKey: ['bootstrap'] });
    },
    [qc],
  );

  const value = useMemo(() => ({ list, sellers, active, choose, change, refused }), [list, sellers, active, choose, change, refused]);
  return <SellerContext.Provider value={value}>{children}</SellerContext.Provider>;
}

export function useSellerContext(): SellerContextValue {
  const value = useContext(SellerContext);
  if (!value) throw new Error('useSellerContext outside SellerProvider');
  return value;
}
