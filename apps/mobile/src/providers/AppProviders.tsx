import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createQueryClient } from '../api/query-client';
import { SessionProvider } from '../auth/session';
import { secureSessionStorage, type SessionStorage } from '../auth/session-storage';

const appQueryClient = createQueryClient();

/**
 * Root provider composition. Theme and locale need no provider: they are hooks over the
 * UI store, which is already their single authority. SafeAreaProvider is supplied by
 * Expo Router's root. Both dependencies are injectable so tests boot the real tree.
 */
export function AppProviders({
  children,
  queryClient = appQueryClient,
  sessionStorage = secureSessionStorage,
}: {
  children: ReactNode;
  queryClient?: QueryClient;
  sessionStorage?: SessionStorage;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider storage={sessionStorage}>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
