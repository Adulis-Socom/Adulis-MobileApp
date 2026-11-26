import { createContext, useContext } from 'react';
import { createRetryKeys, type RetryKeys } from './retry';

/** One store per Seller scope (created in SellerScope): it survives navigation inside the Seller and dies with the Seller, the account or the session. */
export const RetryKeysContext = createContext<RetryKeys | null>(null);

/** Outside a Seller scope there is nothing to survive, so a throwaway store is returned and behaviour is simply "no memory". */
export function useRetryKeys(): RetryKeys {
  return useContext(RetryKeysContext) ?? createRetryKeys();
}
