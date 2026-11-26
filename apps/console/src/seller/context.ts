import { createContext, useContext } from 'react';
import type { Membership, SellerAccess } from '../contracts/gap-sc';

export interface SellerContextValue {
  /** From the URL and nowhere else. */
  readonly sellerId: string;
  readonly membership: Membership;
  readonly access: SellerAccess;
}

export const SellerContext = createContext<SellerContextValue | null>(null);

export function useSeller(): SellerContextValue {
  const value = useContext(SellerContext);
  if (!value) throw new Error('useSeller outside a Seller route');
  return value;
}
