import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { createQueryClient } from '../api/query-client';
import { SessionProvider } from '../auth/session';
import { secureSessionStorage, type SessionStorage } from '../auth/session-storage';
import { secureDeviceStorage, type DeviceStorage } from '../device/device-storage';

/**
 * Root provider composition. Theme and locale need no provider: they are hooks over the
 * UI store, which is already their single authority. SafeAreaProvider is supplied by
 * Expo Router's root. The dependencies are injectable so tests boot the real tree, and the
 * query cache belongs to the mounted app: one per app run, and none shared between tests.
 */
export function AppProviders({
  children,
  queryClient,
  sessionStorage = secureSessionStorage,
  deviceStorage = secureDeviceStorage,
}: {
  children: ReactNode;
  queryClient?: QueryClient;
  sessionStorage?: SessionStorage;
  deviceStorage?: DeviceStorage;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <SessionProvider storage={sessionStorage} deviceStorage={deviceStorage}>
        {children}
      </SessionProvider>
    </QueryClientProvider>
  );
}
